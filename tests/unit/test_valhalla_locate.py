"""How /locate answers are read into SnappedEdge."""

import asyncio

import httpx

from app.clients.valhalla import ValhallaClient


def located(**edge) -> dict:
    return {
        "edges": [
            {
                "distance": 8.0,
                "edge": {
                    "classification": {"use": "service_road", "surface": "paved"},
                    **edge,
                },
            }
        ]
    }


def locate(entries: list[dict]):
    client = ValhallaClient(base_url="http://valhalla")
    client._http = httpx.AsyncClient(
        base_url="http://valhalla",
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=entries)),
    )
    points = [(40.0, -3.0)] * len(entries)
    return asyncio.run(client.locate(points))


def test_destination_only_and_car_free_are_read():
    private, open_road, nothing = locate(
        [
            located(destination_only=True, access={"car": True}),
            located(access={"car": False}),
            {"edges": []},
        ]
    )
    assert private.dest_only and not private.car_free
    assert open_road.car_free and not open_road.dest_only
    assert not nothing.reachable and not nothing.dest_only


def test_missing_flag_is_not_destination_only():
    (edge,) = locate([located()])
    assert not edge.dest_only
