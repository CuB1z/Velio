from fastapi.testclient import TestClient

from app.main import app


def test_patch_me_changes_the_display_name(api_client, auth_headers):
    resp = api_client.patch(
        "/api/v1/auth/me", json={"full_name": "  Marta   Ruiz "}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Marta Ruiz"

    me = api_client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.json()["full_name"] == "Marta Ruiz"


def test_patch_me_rejects_blank_and_overlong_names(api_client, auth_headers):
    for name in ["", "   ", "x" * 256]:
        resp = api_client.patch(
            "/api/v1/auth/me", json={"full_name": name}, headers=auth_headers
        )
        assert resp.status_code == 422, name
        assert resp.json()["error"] == "VALIDATION_ERROR"


def test_patch_me_without_token_is_unauthorized():
    resp = TestClient(app).patch("/api/v1/auth/me", json={"full_name": "Marta"})
    assert resp.status_code == 401
