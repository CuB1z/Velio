"""Application-wide structured logging."""

import logging
import os
import sys

from app.core.config import settings


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "source": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return str(log_data)


def setup_logging() -> None:
    """Install the structured handler as the single root output.

    Under pytest the root handlers belong to the test runner (caplog), so
    they are left untouched; the formatter itself is unit-tested.
    """
    if "PYTEST_CURRENT_TEST" in os.environ:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    # Route uvicorn's own records through the structured pipeline instead of
    # its console handlers, so every line shares a single format.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        native = logging.getLogger(name)
        native.handlers.clear()
        native.propagate = True
