"""Server-Sent Events for long-running generations."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from fastapi import Request
from pydantic import BaseModel

from app.core.exceptions import (
    INTERNAL_ERROR_BODY,
    AppError,
    ClientDisconnectedError,
    error_body,
)

logger = logging.getLogger(__name__)

Emit = Callable[[str, dict[str, Any]], None]

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


async def event_stream(
    run: Callable[[Emit], Awaitable[BaseModel]],
) -> AsyncIterator[str]:
    """Stream `run`'s events, then `result` or `error`; closing cancels `run`."""
    queue: asyncio.Queue[tuple[str, Any] | None] = asyncio.Queue()

    def emit(event: str, payload: dict[str, Any]) -> None:
        queue.put_nowait((event, payload))

    async def produce() -> None:
        try:
            result = await run(emit)
            emit("result", result.model_dump(mode="json"))
        except AppError as exc:
            logger.warning(f"{exc.error_code}: {exc.message}")
            emit("error", {"status": exc.status_code, **error_body(exc)})
        except Exception:
            logger.exception("streamed generation failed")
            emit("error", {"status": 500, **INTERNAL_ERROR_BODY})
        finally:
            queue.put_nowait(None)

    task = asyncio.create_task(produce())
    try:
        while (item := await queue.get()) is not None:
            yield sse(*item)
    finally:
        task.cancel()


async def unless_disconnected[T](request: Request, work: Awaitable[T]) -> T:
    """Await `work`, cancelling it if the client disconnects first."""
    task = asyncio.ensure_future(work)

    async def client_gone() -> None:
        while (await request.receive())["type"] != "http.disconnect":
            pass

    watcher = asyncio.create_task(client_gone())
    try:
        await asyncio.wait({task, watcher}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        watcher.cancel()
    if not task.done():
        task.cancel()
        raise ClientDisconnectedError()
    return task.result()
