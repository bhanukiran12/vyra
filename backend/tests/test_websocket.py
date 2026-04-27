"""WebSocket gameplay tests: auth, turn validation, placement, abilities, gameOver."""
import asyncio
import json
import uuid
import pytest
import requests
import websockets


pytestmark = pytest.mark.asyncio


async def _recv_until(ws, predicate, timeout=5.0):
    """Receive messages until predicate(msg) is truthy or timeout."""
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        remaining = deadline - loop.time()
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None
        msg = json.loads(raw)
        if predicate(msg):
            return msg
    return None


async def _drain(ws, duration=0.3):
    loop = asyncio.get_event_loop()
    end = loop.time() + duration
    msgs = []
    while loop.time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=end - loop.time())
            msgs.append(json.loads(raw))
        except asyncio.TimeoutError:
            break
        except Exception:
            break
    return msgs


def _create_room_and_join(base_url, tiger_headers, goat_headers, host_side="tiger"):
    r = requests.post(f"{base_url}/api/rooms/create", json={"side": host_side}, headers=tiger_headers)
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    r2 = requests.post(f"{base_url}/api/rooms/join", json={"code": code}, headers=goat_headers)
    assert r2.status_code == 200
    return code


# ---------- Auth ----------
async def test_ws_rejects_invalid_token(ws_base, base_url, tiger_headers, goat_headers):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    url = f"{ws_base}/api/ws/{code}?token=not-a-real-token"
    with pytest.raises(Exception):
        async with websockets.connect(url) as ws:
            await asyncio.wait_for(ws.recv(), timeout=3)


async def test_ws_accepts_valid_token_and_sends_state(ws_base, base_url, tiger_headers, tiger_user, goat_headers):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    async with websockets.connect(url) as ws:
        msg = await _recv_until(ws, lambda m: m.get("type") == "state")
        assert msg is not None, "No state received"
        assert msg["state"]["phase"] == "placement"
        assert msg["your_side"] == "tiger"


# ---------- Gameplay ----------
async def test_ws_goat_place_during_placement_updates_board(
    ws_base, base_url, tiger_headers, tiger_user, goat_headers, goat_user
):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    tiger_url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    goat_url = f"{ws_base}/api/ws/{code}?token={goat_user['token']}"
    async with websockets.connect(tiger_url) as tws, websockets.connect(goat_url) as gws:
        await _drain(tws, 0.5)
        await _drain(gws, 0.5)
        # Goat plays first during placement
        await gws.send(json.dumps({"action": "place", "to": 7}))
        msg = await _recv_until(gws, lambda m: m.get("type") == "state" and m.get("events"))
        assert msg is not None
        assert msg["state"]["board"][7] == "goat"
        assert msg["state"]["goats_to_place"] == 14
        assert msg["state"]["turn"] == "tiger"


async def test_ws_tiger_cannot_place_returns_error(
    ws_base, base_url, tiger_headers, tiger_user, goat_headers
):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    async with websockets.connect(url) as ws:
        await _drain(ws, 0.5)
        # It's goat's turn at start; tiger sending 'place' should error
        await ws.send(json.dumps({"action": "place", "to": 7}))
        msg = await _recv_until(ws, lambda m: m.get("type") == "error")
        assert msg is not None
        assert "turn" in msg["message"].lower() or "not" in msg["message"].lower()


async def test_ws_illegal_move_returns_error(
    ws_base, base_url, tiger_headers, tiger_user, goat_headers, goat_user
):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    t_url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    g_url = f"{ws_base}/api/ws/{code}?token={goat_user['token']}"
    async with websockets.connect(t_url) as tws, websockets.connect(g_url) as gws:
        await _drain(tws, 0.5); await _drain(gws, 0.5)
        # Goat place at 7
        await gws.send(json.dumps({"action": "place", "to": 7}))
        await _recv_until(gws, lambda m: m.get("type") == "state" and m.get("events"))
        await _drain(tws, 0.3)
        # Tiger illegal: move from non-tiger node
        await tws.send(json.dumps({"action": "move", "from": 22, "to": 21}))
        msg = await _recv_until(tws, lambda m: m.get("type") == "error")
        assert msg is not None


async def test_ws_unknown_action_returns_error(
    ws_base, base_url, tiger_headers, tiger_user, goat_headers
):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    async with websockets.connect(url) as ws:
        await _drain(ws, 0.5)
        await ws.send(json.dumps({"action": "nonsense"}))
        msg = await _recv_until(ws, lambda m: m.get("type") == "error")
        assert msg is not None
        assert "unknown" in msg["message"].lower()


async def test_ws_ping_returns_pong(
    ws_base, base_url, tiger_headers, tiger_user, goat_headers
):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    async with websockets.connect(url) as ws:
        await _drain(ws, 0.5)
        await ws.send(json.dumps({"action": "ping"}))
        msg = await _recv_until(ws, lambda m: m.get("type") == "pong")
        assert msg is not None


# ---------- Abilities ----------
async def test_ws_goat_decoy_ability(
    ws_base, base_url, tiger_headers, tiger_user, goat_headers, goat_user
):
    code = _create_room_and_join(base_url, tiger_headers, goat_headers)
    t_url = f"{ws_base}/api/ws/{code}?token={tiger_user['token']}"
    g_url = f"{ws_base}/api/ws/{code}?token={goat_user['token']}"
    async with websockets.connect(t_url) as tws, websockets.connect(g_url) as gws:
        await _drain(tws, 0.5); await _drain(gws, 0.5)
        # Goat uses decoy at node 22 (empty)
        await gws.send(json.dumps({
            "action": "ability", "ability": "decoy", "payload": {"node": 22}
        }))
        msg = await _recv_until(gws, lambda m: m.get("type") == "state" and m.get("events"))
        assert msg is not None
        assert msg["state"]["decoy_node"] == 22
        assert msg["state"]["cooldowns"]["goat"]["decoy"] >= 5


# ---------- Full game: scripted tiger win -> gameOver + finalization ----------
async def test_ws_full_game_tiger_win_finalizes(
    ws_base, base_url
):
    """Drive 6 captures and verify gameOver + coins/rating/match history update."""
    # Fresh dedicated users for isolation
    suf = uuid.uuid4().hex[:6]
    tiger_reg = requests.post(f"{base_url}/api/auth/register", json={
        "email": f"TEST_ft_{suf}@vyra.game", "password": "p1234567",
        "username": f"TEST_ft_{suf}",
    }).json()
    goat_reg = requests.post(f"{base_url}/api/auth/register", json={
        "email": f"TEST_fg_{suf}@vyra.game", "password": "p1234567",
        "username": f"TEST_fg_{suf}",
    }).json()
    tiger_h = {"Authorization": f"Bearer {tiger_reg['token']}", "Content-Type": "application/json"}
    goat_h = {"Authorization": f"Bearer {goat_reg['token']}", "Content-Type": "application/json"}

    pre_tiger = requests.get(f"{base_url}/api/profile", headers=tiger_h).json()["user"]
    pre_goat = requests.get(f"{base_url}/api/profile", headers=goat_h).json()["user"]

    code = _create_room_and_join(base_url, tiger_h, goat_h, host_side="tiger")
    t_url = f"{ws_base}/api/ws/{code}?token={tiger_reg['token']}"
    g_url = f"{ws_base}/api/ws/{code}?token={goat_reg['token']}"

    # Sequence: (goat place node, tiger move from→to) producing 6 captures
    script = [
        (7,  3, 12),   # capture over 7, cap=1
        (11, 12, 10),  # over 11, cap=2
        (9,  5, 14),   # over 9,  cap=3
        (13, 14, 12),  # over 13, cap=4
        (13, 12, 14),  # over 13, cap=5
        (9,  14, 5),   # over 9,  cap=6 -> WIN
    ]

    async with websockets.connect(t_url) as tws, websockets.connect(g_url) as gws:
        await _drain(tws, 0.5); await _drain(gws, 0.5)
        game_over = None
        for idx, (place_node, t_from, t_to) in enumerate(script):
            # Goat places
            await gws.send(json.dumps({"action": "place", "to": place_node}))
            msg = await _recv_until(
                gws, lambda m: m.get("type") in ("state", "gameOver") and m.get("events"),
                timeout=5,
            )
            assert msg is not None, f"no state after goat place step {idx}"
            assert msg["state"]["board"][place_node] == "goat", f"goat not placed step {idx}"
            # drain tiger socket so we don't buffer
            await _drain(tws, 0.2)

            # Tiger captures
            await tws.send(json.dumps({"action": "move", "from": t_from, "to": t_to}))
            msg = await _recv_until(
                tws, lambda m: m.get("type") in ("state", "gameOver") and m.get("events"),
                timeout=5,
            )
            assert msg is not None, f"no state after tiger move step {idx}"
            # Expect capture event
            assert any(e.get("type") == "capture" for e in msg["events"]), \
                f"Expected capture at step {idx}, got events={msg['events']}, state={msg['state']}"
            await _drain(gws, 0.2)
            if msg.get("type") == "gameOver":
                game_over = msg
                break

        assert game_over is not None, "Expected gameOver message"
        assert game_over["state"]["winner"] == "tiger"
        assert game_over["state"]["goats_captured"] == 6
        assert game_over["room"]["status"] == "finished"

    # Allow DB write
    await asyncio.sleep(0.5)

    post_tiger = requests.get(f"{base_url}/api/profile", headers=tiger_h).json()["user"]
    post_goat = requests.get(f"{base_url}/api/profile", headers=goat_h).json()["user"]

    assert post_tiger["wins"] == pre_tiger["wins"] + 1
    assert post_tiger["coins"] == pre_tiger["coins"] + 100
    assert post_tiger["rating"] == pre_tiger["rating"] + 25
    assert post_goat["losses"] == pre_goat["losses"] + 1
    assert post_goat["coins"] == pre_goat["coins"] + 20
    assert post_goat["rating"] == pre_goat["rating"] - 25

    # Match history entries
    th = requests.get(f"{base_url}/api/match-history", headers=tiger_h).json()
    gh = requests.get(f"{base_url}/api/match-history", headers=goat_h).json()
    assert any(m["result"] == "win" and m["side"] == "tiger" for m in th)
    assert any(m["result"] == "loss" for m in gh)
