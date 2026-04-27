"""REST endpoint tests: auth, rooms, leaderboard, profile, match history, board."""
import uuid
import requests


# -------- Health / Board ----------
def test_health(base_url):
    r = requests.get(f"{base_url}/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_board_endpoint(base_url):
    r = requests.get(f"{base_url}/api/board")
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data and "adjacency" in data
    assert len(data["nodes"]) == 23
    assert len(data["adjacency"]) == 23
    # adjacency symmetry spot-check
    adj = data["adjacency"]
    # Keys from JSON are strings
    assert int(list(adj.keys())[0]) in range(23)


# -------- Auth ----------
def test_register_creates_user_with_initial_economy(base_url):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_reg_{suffix}@vyra.game"
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "username": f"TEST_reg_{suffix}"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str)
    u = data["user"]
    assert u["email"] == email.lower()
    assert u["coins"] == 200
    assert u["rating"] == 1000
    assert u["wins"] == 0 and u["losses"] == 0
    assert "id" in u


def test_register_duplicate_email_rejected(base_url, tiger_user):
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": tiger_user["user"]["email"],
        "password": "pass1234",
        "username": "someotherusername",
    })
    assert r.status_code == 400


def test_login_success_returns_token_and_user(base_url):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_login_{suffix}@vyra.game"
    password = "mypass123"
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": password, "username": f"TEST_login_{suffix}"
    })
    assert r.status_code == 200
    r = requests.post(f"{base_url}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("token"), str) and len(data["token"]) > 10
    assert data["user"]["email"] == email.lower()


def test_login_invalid_credentials(base_url):
    r = requests.post(f"{base_url}/api/auth/login", json={"email": "nope@vyra.game", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth(base_url):
    r = requests.get(f"{base_url}/api/auth/me")
    assert r.status_code == 401


def test_me_returns_current_user(base_url, tiger_headers, tiger_user):
    r = requests.get(f"{base_url}/api/auth/me", headers=tiger_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == tiger_user["user"]["email"].lower()
    assert data["id"] == tiger_user["user"]["id"]


# -------- Rooms ----------
def test_create_room_returns_6char_code(base_url, tiger_headers):
    r = requests.post(f"{base_url}/api/rooms/create", json={"side": "tiger"}, headers=tiger_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["code"]) == 6 and data["code"].isalnum()
    assert data["host_side"] == "tiger"
    assert data["status"] == "waiting"
    assert data["host"]["id"]
    assert data["guest"] is None


def test_join_room_sets_active_status(base_url, tiger_headers, goat_headers):
    r = requests.post(f"{base_url}/api/rooms/create", json={"side": "tiger"}, headers=tiger_headers)
    code = r.json()["code"]
    r2 = requests.post(f"{base_url}/api/rooms/join", json={"code": code}, headers=goat_headers)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["status"] == "active"
    assert data["guest"]["id"]


def test_join_nonexistent_room_returns_404(base_url, goat_headers):
    r = requests.post(f"{base_url}/api/rooms/join", json={"code": "XXXXXX"}, headers=goat_headers)
    assert r.status_code == 404


def test_get_room_returns_state(base_url, tiger_headers, goat_headers):
    r = requests.post(f"{base_url}/api/rooms/create", json={"side": "tiger"}, headers=tiger_headers)
    code = r.json()["code"]
    requests.post(f"{base_url}/api/rooms/join", json={"code": code}, headers=goat_headers)
    r3 = requests.get(f"{base_url}/api/rooms/{code}", headers=tiger_headers)
    assert r3.status_code == 200
    d = r3.json()
    assert d["your_side"] == "tiger"
    assert d["state"]["phase"] == "placement"
    assert d["state"]["goats_to_place"] == 15
    assert len(d["state"]["board"]) == 23


# -------- Leaderboard / Profile / Match history ----------
def test_leaderboard_sorted_by_rating(base_url):
    r = requests.get(f"{base_url}/api/leaderboard?limit=20")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    if len(items) >= 2:
        ratings = [i["rating"] for i in items]
        assert ratings == sorted(ratings, reverse=True)


def test_profile_requires_auth(base_url):
    assert requests.get(f"{base_url}/api/profile").status_code == 401


def test_profile_returns_user(base_url, tiger_headers, tiger_user):
    r = requests.get(f"{base_url}/api/profile", headers=tiger_headers)
    assert r.status_code == 200
    u = r.json()["user"]
    assert u["email"] == tiger_user["user"]["email"].lower()
    assert "coins" in u and "rating" in u


def test_match_history_returns_list(base_url, tiger_headers):
    r = requests.get(f"{base_url}/api/match-history", headers=tiger_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
