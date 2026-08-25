"""API tests for the saved-route endpoints: CRUD, ownership, budgets."""


from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import PASSWORD, register_account, unique_email


def _second_user_client() -> TestClient:
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
    assert any(r["id"] == saved["id"] for r in listed.json())

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
    assert all(r["id"] != route_id for r in foreign_list.json())

    foreign_delete = stranger.delete(f"/api/v1/routes/saved/{route_id}")
    assert foreign_delete.status_code == 404


def test_list_limit_validation_and_clamp(auth_headers):
    for i in range(3):
        resp = TestClient(app).post(
            "/api/v1/routes/saved",
            json={"name": f"r{i}", "payload": {}},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    ok = TestClient(app).get("/api/v1/routes/saved?limit=2", headers=auth_headers)
    assert len(ok.json()) == 2

    zero = TestClient(app).get("/api/v1/routes/saved?limit=0", headers=auth_headers)
    assert zero.status_code == 422

    huge = TestClient(app).get(
        "/api/v1/routes/saved?limit=9999", headers=auth_headers
    )
    assert huge.status_code == 422


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
