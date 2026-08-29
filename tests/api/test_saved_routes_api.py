"""API tests for the saved-route endpoints: CRUD, ownership, budgets."""

import uuid

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import PASSWORD, register_account, unique_email


def _fresh_client() -> TestClient:
    """An authorized client owning a brand-new account, so pagination tests
    see a pristine route list (auth_headers is session-scoped and shared)."""
    client = TestClient(app)
    email = unique_email()
    code = register_account(email)
    verified = client.post(
        "/api/v1/auth/verify", json={"email": email, "code": code}
    )
    assert verified.status_code == 200, verified.text
    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert logged.status_code == 200, logged.text
    token = logged.json()["tokens"]["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


def _second_user_client() -> TestClient:
    return _fresh_client()


def test_saved_route_crud_roundtrip(auth_headers):
    body = {"name": "Algete 70", "payload": {"polyline": "abc", "distance_km": 70.0}}

    created = TestClient(app).post(
        "/api/v1/routes/saved", json=body, headers=auth_headers
    )
    assert created.status_code == 201, created.text
    saved = created.json()
    assert str(saved["id"])
    assert saved["payload"] == body["payload"]

    listed = TestClient(app).get("/api/v1/routes/saved", headers=auth_headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["meta"]["total"] == 1 and body["meta"]["total_pages"] == 1
    assert body["meta"]["page"] == 1 and body["meta"]["limit"] == 50
    assert body["meta"]["is_last"] is True
    assert any(r["id"] == saved["id"] for r in body["data"])

    got = TestClient(app).get(
        f"/api/v1/routes/saved/{saved['id']}", headers=auth_headers
    )
    assert got.status_code == 200
    assert got.json()["name"] == "Algete 70"

    deleted = TestClient(app).delete(
        f"/api/v1/routes/saved/{saved['id']}", headers=auth_headers
    )
    assert deleted.status_code == 204

    gone = TestClient(app).get(
        f"/api/v1/routes/saved/{saved['id']}", headers=auth_headers
    )
    assert gone.status_code == 404
    assert gone.json()["error"] == "NOT_FOUND"


def test_saved_route_update_roundtrip(auth_headers):
    client = _fresh_client()
    created = client.post(
        "/api/v1/routes/saved",
        json={"name": "before", "payload": {}},
    )
    assert created.status_code == 201
    route_id = created.json()["id"]

    renamed = client.patch(
        f"/api/v1/routes/saved/{route_id}",
        json={"name": "after"},
    )
    assert renamed.status_code == 204, renamed.text

    got = client.get(f"/api/v1/routes/saved/{route_id}")
    assert got.status_code == 200
    body = got.json()
    assert body["name"] == "after"
    assert body["created_at"] and body["updated_at"]

    # A partial body with nothing to change is a harmless 204 no-op.
    noop = client.patch(f"/api/v1/routes/saved/{route_id}", json={})
    assert noop.status_code == 204
    assert client.get(f"/api/v1/routes/saved/{route_id}").json()["name"] == "after"

    # Foreign users cannot edit what they do not own.
    stranger = _second_user_client()
    foreign = stranger.patch(
        f"/api/v1/routes/saved/{route_id}", json={"name": "sneaky"}
    )
    assert foreign.status_code == 404
    assert foreign.json()["error"] == "NOT_FOUND"


def test_saved_route_update_name_validation(auth_headers):
    client = _fresh_client()
    created = client.post(
        "/api/v1/routes/saved",
        json={"name": "keep me", "payload": {}},
    )
    route_id = created.json()["id"]

    empty = client.patch(f"/api/v1/routes/saved/{route_id}", json={"name": ""})
    assert empty.status_code == 422

    too_long = client.patch(
        f"/api/v1/routes/saved/{route_id}", json={"name": "x" * 101}
    )
    assert too_long.status_code == 422


def test_saved_routes_are_invisible_to_other_users(auth_headers):
    mine = TestClient(app).post(
        "/api/v1/routes/saved",
        json={"name": "private", "payload": {}},
        headers=auth_headers,
    )
    route_id = mine.json()["id"]
    stranger = _second_user_client()

    foreign_get = stranger.get(f"/api/v1/routes/saved/{route_id}")
    assert foreign_get.status_code == 404

    foreign_list = stranger.get("/api/v1/routes/saved")
    assert all(r["id"] != route_id for r in foreign_list.json()["data"])

    foreign_delete = stranger.delete(f"/api/v1/routes/saved/{route_id}")
    assert foreign_delete.status_code == 404


def test_list_limit_validation_and_clamp(auth_headers):
    client = _fresh_client()
    for i in range(3):
        resp = client.post(
            "/api/v1/routes/saved",
            json={"name": f"r{i}", "payload": {}},
        )
        assert resp.status_code == 201

    ok = client.get("/api/v1/routes/saved?limit=2")
    assert len(ok.json()["data"]) == 2
    assert ok.json()["meta"]["total"] == 3
    assert ok.json()["meta"]["is_last"] is False

    zero = client.get("/api/v1/routes/saved?limit=0")
    assert zero.status_code == 422

    huge = client.get("/api/v1/routes/saved?limit=9999")
    assert huge.status_code == 422


def test_offset_pagination_pages_without_overlap_or_gaps():
    client = _fresh_client()
    for name in [f"r{i}" for i in range(5)]:
        resp = client.post(
            "/api/v1/routes/saved",
            json={"name": name, "payload": {}},
        )
        assert resp.status_code == 201

    page1 = client.get("/api/v1/routes/saved?page=1&limit=2").json()
    assert page1["meta"]["total"] == 5 and page1["meta"]["total_pages"] == 3
    assert page1["meta"]["is_last"] is False
    assert [r["name"] for r in page1["data"]] == ["r4", "r3"]

    page2 = client.get("/api/v1/routes/saved?page=2&limit=2").json()
    assert [r["name"] for r in page2["data"]] == ["r2", "r1"]
    assert {r["id"] for r in page1["data"]}.isdisjoint(r["id"] for r in page2["data"])

    page3 = client.get("/api/v1/routes/saved?page=3&limit=2").json()
    assert [r["name"] for r in page3["data"]] == ["r0"]
    assert page3["meta"]["is_last"] is True

    beyond = client.get("/api/v1/routes/saved?page=9&limit=2").json()
    assert beyond["data"] == [] and beyond["meta"]["total"] == 5
    assert beyond["meta"]["total_pages"] == 3

    bad_page = client.get("/api/v1/routes/saved?page=0")
    assert bad_page.status_code == 422


def test_exact_multiple_pages_cleanly():
    client = _fresh_client()
    for i in range(4):
        resp = client.post(
            "/api/v1/routes/saved",
            json={"name": f"x{i}", "payload": {}},
        )
        assert resp.status_code == 201

    page1 = client.get("/api/v1/routes/saved?page=1&limit=2").json()
    page2 = client.get("/api/v1/routes/saved?page=2&limit=2").json()
    assert page1["meta"]["total_pages"] == 2
    assert [r["name"] for r in page2["data"]] == ["x1", "x0"]
    assert page2["meta"]["is_last"] is True


def test_saved_route_bulk_delete(auth_headers):
    client = _fresh_client()
    created = [
        client.post("/api/v1/routes/saved", json={"name": f"r{i}", "payload": {}})
        for i in range(3)
    ]
    assert all(r.status_code == 201 for r in created)
    route_ids = [r.json()["id"] for r in created]

    deleted = client.delete(
        f"/api/v1/routes/saved?ids={route_ids[0]},{route_ids[1]}"
    )
    assert deleted.status_code == 204, deleted.text

    remaining = client.get("/api/v1/routes/saved").json()
    assert [r["id"] for r in remaining["data"]] == [route_ids[2]]

    # Idempotent: re-running the same deletion is still a 204 no-op.
    again = client.delete(
        f"/api/v1/routes/saved?ids={route_ids[0]},{route_ids[1]}"
    )
    assert again.status_code == 204


def test_saved_route_bulk_delete_ignores_foreign_and_missing(auth_headers):
    client = _fresh_client()
    own = client.post(
        "/api/v1/routes/saved", json={"name": "mine", "payload": {}}
    ).json()["id"]

    mixed = client.delete(
        f"/api/v1/routes/saved?ids={own},{uuid.uuid4()},{uuid.uuid4()}"
    )
    assert mixed.status_code == 204

    remaining = client.get("/api/v1/routes/saved").json()
    assert remaining["meta"]["total"] == 0

    # Unknown ids alone are a silent success too.
    unknown = client.delete(
        f"/api/v1/routes/saved?ids={uuid.uuid4()},{uuid.uuid4()}"
    )
    assert unknown.status_code == 204


def test_saved_route_bulk_delete_caps_at_fifty(auth_headers):
    client = _fresh_client()

    over = client.delete(
        "/api/v1/routes/saved?ids="
        + ",".join(str(uuid.uuid4()) for _ in range(51))
    )
    assert over.status_code == 400
    assert over.json()["error"] == "VALIDATION_ERROR"

    # Exactly 50 unique ids pass (they just match nothing here).
    at_cap = client.delete(
        "/api/v1/routes/saved?ids="
        + ",".join(str(uuid.uuid4()) for _ in range(50))
    )
    assert at_cap.status_code == 204

    # Duplicates do not push past the cap.
    dup = str(uuid.uuid4())
    dup_ids = client.delete(
        "/api/v1/routes/saved?ids=" + ",".join([dup] * 51)
    )
    assert dup_ids.status_code == 204


def test_saved_route_bulk_delete_rejects_malformed_ids(auth_headers):
    client = _fresh_client()
    resp = client.delete("/api/v1/routes/saved?ids=not-a-uuid")
    assert resp.status_code == 400
    assert resp.json()["error"] == "VALIDATION_ERROR"


def test_saved_routes_require_authentication():
    resp = TestClient(app).get("/api/v1/routes/saved")
    assert resp.status_code == 401
    assert resp.json()["error"] == "UNAUTHORIZED"


def test_malformed_route_id_is_a_validation_error(auth_headers):
    resp = TestClient(app).get(
        "/api/v1/routes/saved/not-a-uuid", headers=auth_headers
    )
    assert resp.status_code == 422


def test_name_length_is_validated(auth_headers):
    resp = TestClient(app).post(
        "/api/v1/routes/saved",
        json={"name": "x" * 101, "payload": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 422
