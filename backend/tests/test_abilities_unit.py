"""
Unit-level retests for the previous HIGH-priority bug:
goat decoy / goat fortify / tiger roar single-turn effects must persist
through ONE opponent turn, then expire on the setter's next action.
Tiger pounce must enforce a real 3-turn cooldown (no +1 hack).
We exercise game_engine directly to be deterministic and fast.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

import pytest
from game_engine import (
    new_game,
    apply_ability,
    validate_and_apply_move,
    _clear_expired_effects,
    INITIAL_TIGER_NODES,
)
from board import ADJACENCY, get_pounce_targets


# ---------------- decoy ----------------
class TestDecoy:
    def test_decoy_persists_through_tiger_turn_and_clears_on_goat_next_action(self):
        s = new_game()
        # Goat plays decoy at empty node 22 (it's goat's turn at start)
        ok, msg, _ = apply_ability(s, "goat", "decoy", {"node": 22})
        assert ok, msg
        assert s["decoy_node"] == 22
        assert s["decoy_until"] is not None
        # Cooldown set to 5
        assert s["cooldowns"]["goat"]["decoy"] == 5
        # Turn switched to tiger
        assert s["turn"] == "tiger"

        # Tiger plays a normal move (e.g., 0 -> 1, both in adjacency, 1 empty)
        # node 0 is tiger, node 1 is empty
        ok, msg, _ = validate_and_apply_move(s, "tiger", 0, 1)
        assert ok, msg
        # Decoy MUST still be present after tiger's turn
        assert s["decoy_node"] == 22, "Decoy was wiped during tiger's turn — bug not fixed"
        assert s["turn"] == "goat"

        # Now goat acts again (place at node 7); _clear_expired_effects should drop the decoy
        ok, msg, _ = validate_and_apply_move(s, "goat", None, 7)
        assert ok, msg
        assert s["decoy_node"] is None, "Decoy should expire when setter acts again"
        assert s["decoy_until"] is None

    def test_decoy_blocks_tiger_slide_into_node(self):
        s = new_game()
        # Place decoy at node 1 (adjacent to tiger at 0). Tiger should be blocked from moving to 1.
        apply_ability(s, "goat", "decoy", {"node": 1})
        # Now tiger's turn. Tiger at 0 can slide to neighbours 1 or 2 normally.
        ok, msg, _ = validate_and_apply_move(s, "tiger", 0, 1)
        assert not ok, "Tiger should not be able to slide into decoy node"
        # But sliding to 2 should still be allowed
        ok, msg, _ = validate_and_apply_move(s, "tiger", 0, 2)
        assert ok, msg

    def test_decoy_cooldown_decreases_each_goat_turn_and_reusable(self):
        s = new_game()
        apply_ability(s, "goat", "decoy", {"node": 22})
        assert s["cooldowns"]["goat"]["decoy"] == 5
        # Play 5 full rounds (tiger then goat). After each goat turn, CD should -1.
        # We need legal moves: alternate small placements/slides.
        # Simulate: tiger move 0->1, goat place 7, tiger 1->0 won't work (7 is goat).
        # Easier: tiger 3->? then back. Use 5 placements interleaved with tiger oscillation.
        # We'll just do: tiger:0->1, goat:place 7, tiger:1->0, goat:place 8, tiger:0->1, goat:place 9,
        #                tiger:1->0, goat:place 10, tiger:0->1, goat:place 11
        moves = [
            ("tiger", 0, 1),
            ("goat", None, 6),
            ("tiger", 1, 0),
            ("goat", None, 8),
            ("tiger", 0, 1),
            ("goat", None, 10),
            ("tiger", 1, 0),
            ("goat", None, 14),
            ("tiger", 0, 1),
            ("goat", None, 15),
        ]
        prev_cd = s["cooldowns"]["goat"]["decoy"]
        cd_seen = [prev_cd]
        for player, frm, to in moves:
            ok, msg, _ = validate_and_apply_move(s, player, frm, to)
            assert ok, f"{player} {frm}->{to} failed: {msg}"
            cd_seen.append(s["cooldowns"]["goat"]["decoy"])
        # After 5 goat turns post-cast, decoy CD should have reached 0
        assert s["cooldowns"]["goat"]["decoy"] == 0, f"decoy CD didn't reach 0; trace={cd_seen}"


# ---------------- fortify ----------------
class TestFortify:
    def _setup_three_adjacent_goats(self):
        """Build a state with 3 goats forming a triangle so fortify can be cast."""
        s = new_game()
        # Triangle (1,2,4): 1-2 adj? yes; 1-4 adj? yes; 2-4 adj? yes.
        # Manually populate state (skip placement-phase sequencing for speed).
        s["board"][1] = "goat"
        s["board"][2] = "goat"
        s["board"][4] = "goat"
        s["goats_to_place"] = 12  # 3 placed
        # Make it goat's turn (it already is) and set turn_number to even
        return s

    def test_fortify_protects_goats_from_capture(self):
        s = self._setup_three_adjacent_goats()
        # Cast fortify on (1,2,4)
        ok, msg, _ = apply_ability(s, "goat", "fortify", {"triangle": [1, 2, 4]})
        assert ok, msg
        assert sorted(s["fortified_nodes"]) == [1, 2, 4]
        assert s["fortified_until"] is not None
        assert s["cooldowns"]["goat"]["fortify"] == 4
        assert s["turn"] == "tiger"

        # Tiger at 0 attempts to capture goat at 1: jump 0 over 1 to ?  geometry: from (300,60) over (220,150) -> (140,240). Closest node? 3 is at (170,240) — within 30 px, not within 12 px tolerance. So this jump may not be legal.
        # Try tiger at 0 capture over 2: 0(300,60) -> 2(380,150) -> (460,240). Node 5 is (430,240), distance ~30 — not within tol. So normal captures at apex aren't available.
        # Let's use a different setup: place a tiger adjacent so capture is geometrically valid.
        # Easier: directly verify tiger_capture_moves filters fortified.
        from game_engine import tiger_capture_moves
        # Add a tiger at 6 with a goat at 7 (will jump to 8). But 7 is empty in this state.
        s["board"][7] = "goat"
        s["board"][6] = "tiger"
        s["tiger_nodes"].append(6)
        # 6(120,330) over 7(240,330) -> (360,330) which is node 8 ✓
        caps = tiger_capture_moves(s, 6)
        assert any(c["over"] == 7 for c in caps), "expected normal capture at 7"

        # Now fortify includes 7? no, fortified is 1,2,4. So 7 capture allowed.
        # Replace fortified to include 7 to test the gate.
        s["fortified_nodes"] = [7]
        caps2 = tiger_capture_moves(s, 6)
        assert not any(c["over"] == 7 for c in caps2), \
            "Fortified goat at 7 should NOT be capturable"

    def test_fortify_clears_after_one_full_cycle(self):
        s = self._setup_three_adjacent_goats()
        ok, _, _ = apply_ability(s, "goat", "fortify", {"triangle": [1, 2, 4]})
        assert ok
        # Tiger plays a move
        ok, msg, _ = validate_and_apply_move(s, "tiger", 0, None) if False else (False, "", [])
        # Tiger 3 (init tiger) -> 6? 3 adj 6 yes, 6 empty. 
        ok, msg, _ = validate_and_apply_move(s, "tiger", 3, 6)
        assert ok, msg
        # Fortify still active during tiger turn (already past, but shouldn't be cleared yet because new turn is goat)
        assert s["fortified_nodes"] == [1, 2, 4]
        # Goat takes another action -> should clear
        # Place goat at 7
        ok, msg, _ = validate_and_apply_move(s, "goat", None, 7)
        assert ok, msg
        assert s["fortified_nodes"] == []
        assert s["fortified_until"] is None


# ---------------- roar ----------------
class TestRoar:
    def test_roar_freezes_goats_for_goat_next_turn_only(self):
        s = new_game()
        # Goat first must place a goat adjacent to a tiger so roar has a target.
        # Tiger at 0; node 1 adjacent. Goat places at 1.
        ok, _, _ = validate_and_apply_move(s, "goat", None, 1)
        assert ok
        # Now tiger's turn. Cast roar on goat at 1.
        ok, msg, _ = apply_ability(s, "tiger", "roar", {"targets": [1]})
        assert ok, msg
        assert s["frozen_nodes"] == [1]
        assert s["frozen_until"] is not None
        assert s["cooldowns"]["tiger"]["roar"] == 5
        assert s["turn"] == "goat"

        # Goat tries to place a new goat — placement is allowed (frozen affects movement of node 1).
        # But if goat tries to move from 1 (movement phase only), placement still works.
        # During placement phase, the freeze prevents moving the frozen tiger/goat,
        # but placements use from_id=None so they aren't blocked.
        # Verify the freeze persists through goat's placement turn:
        ok, msg, _ = validate_and_apply_move(s, "goat", None, 6)
        assert ok, msg
        # frozen still set during goat's turn? freeze should clear at start of TIGER's next action
        # (the setter is tiger; tiger acts again next).
        assert s["frozen_nodes"] == [1], "frozen should persist through goat's turn"

        # Tiger acts again -> frozen should be cleared
        ok, msg, _ = validate_and_apply_move(s, "tiger", 0, 2)
        assert ok, msg
        assert s["frozen_nodes"] == []
        assert s["frozen_until"] is None

    def test_roar_blocks_goat_movement_when_in_movement_phase(self):
        # Synthesize a movement-phase state with one frozen goat
        s = new_game()
        s["phase"] = "movement"
        s["goats_to_place"] = 0
        s["board"][1] = "goat"
        s["frozen_nodes"] = [1]
        s["frozen_until"] = s["turn_number"] + 1
        s["turn"] = "goat"
        # Goat tries to slide 1 -> 4 (adjacent and empty) — should fail
        ok, msg, _ = validate_and_apply_move(s, "goat", 1, 4)
        assert not ok
        assert "frozen" in msg.lower() or "illegal" in msg.lower()


# ---------------- pounce ----------------
class TestPounce:
    def test_pounce_real_cooldown_3_no_offset(self):
        s = new_game()
        # Goat places first (placement phase, goat goes first) so it becomes tiger's turn.
        ok, _, _ = validate_and_apply_move(s, "goat", None, 7)  # goat at 7 (won't block)
        assert ok
        assert s["turn"] == "tiger"

        # Tiger at node 3 has pounce targets: (5, over=4), (10, over=6), (12, over=7)
        # Use 3 -> 10 (over 6, both empty).
        ok, msg, evs = apply_ability(s, "tiger", "pounce", {"from": 3, "to": 10})
        assert ok, msg
        # Tiger should now be at landing, no longer at 3
        assert s["board"][10] == "tiger"
        assert s["board"][3] is None
        # Cooldown should be exactly 3 (no +1 offset hack)
        assert s["cooldowns"]["tiger"]["pounce"] == 3, \
            f"expected pounce CD == 3, got {s['cooldowns']['tiger']['pounce']}"
        assert s["turn"] == "goat"

    def test_pounce_captures_goat_in_path(self):
        s = new_game()
        # Goat first
        ok, _, _ = validate_and_apply_move(s, "goat", None, 7)  # goat at 7
        assert ok
        # Tiger pounces 3 -> 12 over 7 (which is a goat). Should capture.
        ok, msg, evs = apply_ability(s, "tiger", "pounce", {"from": 3, "to": 12})
        assert ok, msg
        assert s["board"][12] == "tiger"
        assert s["board"][7] is None  # goat captured
        assert s["goats_captured"] == 1
        assert any(e.get("captured") for e in evs)

    def test_pounce_cooldown_blocks_immediate_reuse(self):
        s = new_game()
        ok, _, _ = validate_and_apply_move(s, "goat", None, 7)
        assert ok
        # First pounce 3 -> 10
        ok, _, _ = apply_ability(s, "tiger", "pounce", {"from": 3, "to": 10})
        assert ok
        # Goat takes a turn
        ok, _, _ = validate_and_apply_move(s, "goat", None, 8)
        assert ok
        # Tiger again: CD should have decreased to 2
        assert s["cooldowns"]["tiger"]["pounce"] == 2
        # Try to pounce again — should be rejected (on cooldown)
        # Tiger at 5 has targets (3, 12, 14); 3 empty, 14 empty.
        ok, msg, _ = apply_ability(s, "tiger", "pounce", {"from": 5, "to": 14})
        assert not ok
        assert "cooldown" in msg.lower()
        # Cooldown unchanged
        assert s["cooldowns"]["tiger"]["pounce"] == 2

    def test_pounce_reusable_after_cooldown(self):
        s = new_game()
        ok, _, _ = validate_and_apply_move(s, "goat", None, 1)
        assert ok
        ok, _, _ = apply_ability(s, "tiger", "pounce", {"from": 3, "to": 10})
        assert ok
        assert s["cooldowns"]["tiger"]["pounce"] == 3

        # After 3 tiger turns, CD should reach 0. Use a deterministic oscillation:
        # tiger at 10 can slide to 6 or 11; goats fill different empty nodes.
        cd_trace = []
        # Round 1
        validate_and_apply_move(s, "goat", None, 2)
        validate_and_apply_move(s, "tiger", 10, 6)
        cd_trace.append(s["cooldowns"]["tiger"]["pounce"])
        # Round 2
        validate_and_apply_move(s, "goat", None, 4)
        validate_and_apply_move(s, "tiger", 6, 10)
        cd_trace.append(s["cooldowns"]["tiger"]["pounce"])
        # Round 3
        validate_and_apply_move(s, "goat", None, 8)
        validate_and_apply_move(s, "tiger", 10, 6)
        cd_trace.append(s["cooldowns"]["tiger"]["pounce"])
        # CD trace should be 2,1,0
        assert cd_trace == [2, 1, 0], f"expected CD trace [2,1,0], got {cd_trace}"
        assert s["cooldowns"]["tiger"]["pounce"] == 0


# ---------------- pure scheduler verification ----------------
class TestEffectScheduler:
    def test_clear_expired_effects_idempotent(self):
        s = new_game()
        # No effects → no-op
        _clear_expired_effects(s)
        assert s["decoy_node"] is None
        assert s["frozen_nodes"] == []
        assert s["fortified_nodes"] == []

    def test_legacy_state_without_until_keys_does_not_crash(self):
        """Old rooms in Mongo lack *_until keys — must handle gracefully."""
        s = new_game()
        # Simulate legacy: remove the until keys
        s.pop("decoy_until", None)
        s.pop("frozen_until", None)
        s.pop("fortified_until", None)
        _clear_expired_effects(s)  # must not raise
