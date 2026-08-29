"""API tests for the saved-route endpoints: CRUD, ownership, budgets."""


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
