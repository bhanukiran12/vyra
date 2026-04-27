"""
Pure game engine for Vyra (Goats vs Tigers).

Abstract state:
{
  "phase": "placement" | "movement" | "finished",
  "turn": "tiger" | "goat",
  "board": [None | "tiger" | "goat" | "decoy", ...]  # length 23
  "goats_to_place": int,        # starts at 15
  "goats_captured": int,        # tiger wins at 6
  "tiger_nodes": [int, ...],    # cached positions
  "cooldowns": {
      "tiger": {"pounce": 0, "roar": 0},
      "goat":  {"fortify": 0, "decoy": 0}
  },
  "frozen_nodes": [int, ...],        # goats frozen this turn by Roar
  "fortified_nodes": [int, ...],     # uncapturable goats this turn
  "decoy_node": int | None,          # temporary blocker
  "turn_number": int,
  "winner": None | "tiger" | "goat"
}
"""
from board import (
    ADJACENCY,
    NODE_COUNT,
    get_jump_target,
    get_pounce_targets,
    find_triangles,
)

# Initial tiger nodes (apex and two middle-row positions) — classic setup
INITIAL_TIGER_NODES = [0, 3, 5]

GOATS_TOTAL = 15
TIGER_WIN_CAPTURES = 6


def new_game():
    board = [None] * NODE_COUNT
    for t in INITIAL_TIGER_NODES:
        board[t] = "tiger"
    return {
        "phase": "placement",
        "turn": "goat",  # Goats move first during placement
        "board": board,
        "goats_to_place": GOATS_TOTAL,
        "goats_captured": 0,
        "tiger_nodes": list(INITIAL_TIGER_NODES),
        "cooldowns": {
            "tiger": {"pounce": 0, "roar": 0},
            "goat": {"fortify": 0, "decoy": 0},
        },
        "frozen_nodes": [],
        "frozen_until": None,
        "fortified_nodes": [],
        "fortified_until": None,
        "decoy_node": None,
        "decoy_until": None,
        "turn_number": 1,
        "winner": None,
    }


def _clear_expired_effects(state):
    tn = state["turn_number"]
    if state.get("decoy_until") is not None and tn > state["decoy_until"]:
        state["decoy_node"] = None
        state["decoy_until"] = None
    if state.get("frozen_until") is not None and tn > state["frozen_until"]:
        state["frozen_nodes"] = []
        state["frozen_until"] = None
    if state.get("fortified_until") is not None and tn > state["fortified_until"]:
        state["fortified_nodes"] = []
        state["fortified_until"] = None


# ------- Queries -------

def tiger_capture_moves(state, from_id):
    """Return list of dicts {to, over} for normal capture jumps from tiger at from_id."""
    moves = []
    b = state["board"]
    for over in ADJACENCY[from_id]:
        if b[over] != "goat":
            continue
        if over in state["fortified_nodes"]:
            continue
        land = get_jump_target(from_id, over)
        if land is None:
            continue
        if b[land] is not None:
            continue
        moves.append({"to": land, "over": over})
    return moves


def get_valid_moves(state, node_id):
    """
    Returns list of move dicts. Each move has:
      { "type": "place" | "move" | "capture", "to": int, "over"?: int }
    for the piece at node_id (or for goat placement when state is placement phase
    and node_id is an empty node).
    """
    b = state["board"]
    if state["phase"] == "finished":
        return []
    if state["phase"] == "placement":
        if state["turn"] == "goat" and b[node_id] is None and state["decoy_node"] != node_id:
            return [{"type": "place", "to": node_id}]
        if state["turn"] == "tiger" and b[node_id] == "tiger":
            if node_id in state["frozen_nodes"]:
                return []
            moves = []
            # simple slides
            for nb in ADJACENCY[node_id]:
                if b[nb] is None and state["decoy_node"] != nb:
                    moves.append({"type": "move", "to": nb})
            # captures
            for cap in tiger_capture_moves(state, node_id):
                moves.append({"type": "capture", "to": cap["to"], "over": cap["over"]})
            return moves
        return []
    # movement phase
    piece = b[node_id]
    if piece is None or piece == "decoy":
        return []
    if state["turn"] == "goat" and piece == "goat":
        if node_id in state["frozen_nodes"]:
            return []
        return [
            {"type": "move", "to": nb}
            for nb in ADJACENCY[node_id]
            if b[nb] is None and state["decoy_node"] != nb
        ]
    if state["turn"] == "tiger" and piece == "tiger":
        if node_id in state["frozen_nodes"]:
            return []
        moves = []
        for nb in ADJACENCY[node_id]:
            if b[nb] is None and state["decoy_node"] != nb:
                moves.append({"type": "move", "to": nb})
        for cap in tiger_capture_moves(state, node_id):
            moves.append({"type": "capture", "to": cap["to"], "over": cap["over"]})
        return moves
    return []


def tigers_immobile(state):
    """Return True if no tiger has any legal move."""
    b = state["board"]
    for t in state["tiger_nodes"]:
        # ignore frozen status for win-check (frozen is only current turn)
        for nb in ADJACENCY[t]:
            if b[nb] is None:
                return False
        if tiger_capture_moves(state, t):
            return False
    return True


def check_win(state):
    if state["goats_captured"] >= TIGER_WIN_CAPTURES:
        return "tiger"
    if state["phase"] == "movement" and tigers_immobile(state):
        return "goat"
    return None


# ------- Actions -------

def _advance_turn(state):
    """Switch turn and decrement cooldowns. Expired single-turn effects are
    cleared lazily via _clear_expired_effects at the start of the next action."""
    # Switch turn
    state["turn"] = "tiger" if state["turn"] == "goat" else "goat"
    state["turn_number"] += 1

    # Decrement cooldowns for the player whose turn it now is
    cds = state["cooldowns"][state["turn"]]
    for k in list(cds.keys()):
        if cds[k] > 0:
            cds[k] -= 1

    # Exit placement phase when all goats placed
    if state["phase"] == "placement" and state["goats_to_place"] == 0:
        state["phase"] = "movement"

    winner = check_win(state)
    if winner:
        state["winner"] = winner
        state["phase"] = "finished"


def validate_and_apply_move(state, player, from_id, to_id):
    """
    Apply a move for `player` from `from_id` to `to_id`.
    from_id may be None if this is a goat placement.
    Returns (ok, message, events).
    Events is a list of dicts for the client (e.g., capture event).
    """
    _clear_expired_effects(state)
    if state["phase"] == "finished":
        return False, "Game is over", []
    if state["turn"] != player:
        return False, "Not your turn", []

    b = state["board"]
    events = []

    # Goat placement
    if state["phase"] == "placement" and player == "goat" and from_id is None:
        if state["goats_to_place"] <= 0:
            return False, "No goats to place", []
        if to_id is None or to_id < 0 or to_id >= NODE_COUNT:
            return False, "Invalid node", []
        if b[to_id] is not None or state["decoy_node"] == to_id:
            return False, "Node occupied", []
        b[to_id] = "goat"
        state["goats_to_place"] -= 1
        events.append({"type": "place", "to": to_id})
        _advance_turn(state)
        return True, "ok", events

    # Movement / capture (both phases for tigers; movement phase for goats)
    if from_id is None:
        return False, "from_id required", []
    if b[from_id] is None:
        return False, "No piece at source", []
    if b[from_id] == "tiger" and player != "tiger":
        return False, "Not your piece", []
    if b[from_id] == "goat" and player != "goat":
        return False, "Not your piece", []
    if from_id in state["frozen_nodes"]:
        return False, "Piece is frozen", []

    if player == "goat" and state["phase"] != "movement":
        return False, "Goats cannot move during placement", []

    moves = get_valid_moves(state, from_id)
    chosen = next((m for m in moves if m["to"] == to_id), None)
    if not chosen:
        return False, "Illegal move", []

    if chosen["type"] == "move":
        b[to_id] = b[from_id]
        b[from_id] = None
        if player == "tiger":
            state["tiger_nodes"] = [to_id if n == from_id else n for n in state["tiger_nodes"]]
        events.append({"type": "move", "from": from_id, "to": to_id})
    elif chosen["type"] == "capture":
        over = chosen["over"]
        b[to_id] = b[from_id]
        b[from_id] = None
        b[over] = None
        state["tiger_nodes"] = [to_id if n == from_id else n for n in state["tiger_nodes"]]
        state["goats_captured"] += 1
        events.append({"type": "capture", "from": from_id, "to": to_id, "over": over})
    else:
        return False, "Unknown move type", []

    _advance_turn(state)
    return True, "ok", events


# ------- Abilities -------

def get_cooldown_state(state):
    return state["cooldowns"]


def apply_ability(state, player, ability, payload):
    """
    payload contents depend on ability:
      tiger.pounce: { from: tiger_node, to: landing_node }
      tiger.roar: { targets: [goat_node_1, goat_node_2] } (1 or 2)
      goat.fortify: { triangle: [a,b,c] }
      goat.decoy: { node: int }
    Applying an ability consumes the player's turn (ability used in place of a move)
    and starts the ability's cooldown.
    """
    if state["phase"] == "finished":
        return False, "Game is over", []
    if state["turn"] != player:
        return False, "Not your turn", []

    cds = state["cooldowns"][player]
    if ability not in cds:
        return False, "Unknown ability", []
    if cds[ability] > 0:
        return False, "Ability on cooldown", []

    events = []
    b = state["board"]

    if player == "tiger" and ability == "pounce":
        frm = payload.get("from")
        to = payload.get("to")
        if frm is None or to is None:
            return False, "Missing from/to", []
        if b[frm] != "tiger":
            return False, "Not your tiger", []
        if frm in state["frozen_nodes"]:
            return False, "Tiger frozen", []
        targets = get_pounce_targets(frm)
        match = next(((land_id, over) for (land_id, over) in targets if land_id == to), None)
        if not match:
            return False, "Invalid pounce target", []
        land, over = match
        if b[land] is not None and state["decoy_node"] != land:
            # landing must be empty
            if state["decoy_node"] == land:
                pass
            else:
                return False, "Landing occupied", []
        # capture goat if present at `over`
        b[frm] = None
        captured = False
        if b[over] == "goat" and over not in state["fortified_nodes"]:
            b[over] = None
            state["goats_captured"] += 1
            captured = True
        b[land] = "tiger"
        state["tiger_nodes"] = [land if n == frm else n for n in state["tiger_nodes"]]
        cds["pounce"] = 3
        events.append({"type": "pounce", "from": frm, "to": land, "over": over, "captured": captured})
        _advance_turn(state)
        return True, "ok", events

    if player == "tiger" and ability == "roar":
        targets = payload.get("targets") or []
        if not targets or len(targets) > 2:
            return False, "1 or 2 targets required", []
        tiger_adj = set()
        for t in state["tiger_nodes"]:
            for nb in ADJACENCY[t]:
                tiger_adj.add(nb)
        for tgt in targets:
            if b[tgt] != "goat":
                return False, "Target must be a goat", []
            if tgt not in tiger_adj:
                return False, "Goat not adjacent to any tiger", []
        state["frozen_nodes"] = list(targets)
        state["frozen_until"] = state["turn_number"] + 1
        cds["roar"] = 5
        events.append({"type": "roar", "targets": list(targets)})
        _advance_turn(state)
        return True, "ok", events

    if player == "goat" and ability == "fortify":
        tri = payload.get("triangle") or []
        if len(tri) != 3:
            return False, "Need 3 nodes", []
        for n in tri:
            if b[n] != "goat":
                return False, "All 3 nodes must be goats", []
        a, c, d = tri
        if not (c in ADJACENCY[a] and d in ADJACENCY[a] and d in ADJACENCY[c]):
            return False, "Not a connected triangle", []
        state["fortified_nodes"] = list(tri)
        state["fortified_until"] = state["turn_number"] + 1
        cds["fortify"] = 4
        events.append({"type": "fortify", "nodes": list(tri)})
        _advance_turn(state)
        return True, "ok", events

    if player == "goat" and ability == "decoy":
        node = payload.get("node")
        if node is None or node < 0 or node >= NODE_COUNT:
            return False, "Invalid node", []
        if b[node] is not None:
            return False, "Node occupied", []
        state["decoy_node"] = node
        state["decoy_until"] = state["turn_number"] + 1
        cds["decoy"] = 5
        events.append({"type": "decoy", "node": node})
        _advance_turn(state)
        return True, "ok", events

    return False, "Unsupported ability", []


def available_triangles_for_goats(state):
    goat_nodes = [i for i, v in enumerate(state["board"]) if v == "goat"]
    return find_triangles(goat_nodes)
