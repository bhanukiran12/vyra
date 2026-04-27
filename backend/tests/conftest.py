"""Shared fixtures for Vyra backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tiger-goat-battle.preview.emergentagent.com").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def ws_base():
    return WS_BASE


@pytest.fixture()
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register_or_login(session, email, password, username):
    """Register a fresh user; if email exists, login instead."""
    r = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": password, "username": username
    })
    if r.status_code == 200:
        return r.json()
    # fallback login
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def tiger_user():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_tiger_{suffix}@vyra.game"
    return _register_or_login(s, email, "tiger123", f"TEST_tiger_{suffix}")


@pytest.fixture(scope="session")
def goat_user():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_goat_{suffix}@vyra.game"
    return _register_or_login(s, email, "goat123", f"TEST_goat_{suffix}")


@pytest.fixture()
def tiger_headers(tiger_user):
    return {"Authorization": f"Bearer {tiger_user['token']}", "Content-Type": "application/json"}


@pytest.fixture()
def goat_headers(goat_user):
    return {"Authorization": f"Bearer {goat_user['token']}", "Content-Type": "application/json"}
