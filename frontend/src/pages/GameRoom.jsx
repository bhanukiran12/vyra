import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, wsUrl } from "../lib/api";
import { useGameStore } from "../store/gameStore";
import { useAuth } from "../auth/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Board from "../components/game/Board";
import StatsPanel from "../components/game/StatsPanel";
import AbilityPanel from "../components/game/AbilityPanel";
import EventLog from "../components/game/EventLog";
import { computeValidDestinations, computeCaptureOver } from "../lib/moves";
import { Check, Copy, DoorOpen, RefreshCw } from "lucide-react";

export default function GameRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const {
    state,
    room,
    yourSide,
    selected,
    events,
    connected,
    applyServer,
    setConnected,
    setCode,
    select,
    reset,
    lastEvents,
  } = useGameStore();

  const [boardMeta, setBoardMeta] = useState(null);
  const [pendingAbility, setPendingAbility] = useState(null);
  const [abilityPicks, setAbilityPicks] = useState([]);
  const wsRef = useRef(null);
  const retryRef = useRef(0);

  // Fetch static board once
  useEffect(() => {
    api.get("/board").then((r) => setBoardMeta(r.data)).catch(() => {
      toast.error("Failed to load game board. Please refresh the page.");
    });
  }, []);

  // Open websocket
  useEffect(() => {
    if (!code) return;
    setCode(code);
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl(code));
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };
      ws.onclose = (ev) => {
        setConnected(false);
        wsRef.current = null;
        if (cancelled) return;
        if (ev.code === 4401 || ev.code === 4403 || ev.code === 4404) {
          toast.error(
            ev.code === 4404 ? "Room not found" : "Unable to join this room"
          );
          nav("/lobby");
          return;
        }
        // reconnect with backoff
        retryRef.current += 1;
        if (retryRef.current > 5) {
          toast.error("Unable to connect to game server. Please try again later.");
          nav("/lobby");
          return;
        }
        const delay = Math.min(5000, 500 * retryRef.current);
        setTimeout(connect, delay);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "state" || msg.type === "gameOver") {
            applyServer(msg);
            if (msg.type === "gameOver") {
              const winner = msg.room?.winner;
              toast.success(
                winner
                  ? winner === useGameStore.getState().yourSide
                    ? "Victory! You have bested your rival."
                    : `Defeat — ${winner}s have won.`
                  : "Match over."
              );
            }
          } else if (msg.type === "error") {
            toast.error(msg.message || "Move rejected");
          }
        } catch (_) {}
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Toasts for events
  useEffect(() => {
    if (!lastEvents || lastEvents.length === 0) return;
    lastEvents.forEach((e) => {
      if (e.type === "capture" || e.type === "pounce")
        toast(
          e.type === "pounce"
            ? "Pounce executed!"
            : `Goat captured at node ${e.over}`,
          { style: { borderLeft: "3px solid #ff3366" } }
        );
      if (e.type === "roar") toast("Roar freezes goats!", { icon: "🔊" });
      if (e.type === "fortify") toast("Fortify active", { icon: "🛡" });
      if (e.type === "decoy") toast("Decoy placed");
    });
  }, [lastEvents]);

  const send = (obj) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(obj));
  };

  const validDests = useMemo(
    () =>
      boardMeta
        ? computeValidDestinations({
            nodes: boardMeta.nodes,
            adjacency: boardMeta.adjacency,
            state,
            yourSide,
            selected,
            pendingAbility,
          })
        : [],
    [boardMeta, state, yourSide, selected, pendingAbility]
  );

  const cancelAbility = () => {
    setPendingAbility(null);
    setAbilityPicks([]);
    select(null);
  };

  const handleNodeClick = (id) => {
    if (!state || !boardMeta) return;
    if (state.phase === "finished") return;
    const b = state.board;

    // Ability interactions
    if (pendingAbility === "decoy") {
      if (b[id] == null && state.decoy_node !== id) {
        send({
          action: "ability",
          ability: "decoy",
          payload: { node: id },
        });
        setPendingAbility(null);
      }
      return;
    }
    if (pendingAbility === "roar") {
      if (b[id] !== "goat") return;
      setAbilityPicks((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 2) return prev;
        return [...prev, id];
      });
      return;
    }
    if (pendingAbility === "fortify") {
      if (b[id] !== "goat") return;
      setAbilityPicks((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 3) return prev;
        return [...prev, id];
      });
      return;
    }
    if (pendingAbility === "pounce") {
      if (selected == null) {
        if (b[id] === "tiger") select(id);
        return;
      }
      if (validDests.includes(id)) {
        send({
          action: "ability",
          ability: "pounce",
          payload: { from: selected, to: id },
        });
        setPendingAbility(null);
        select(null);
      } else if (b[id] === "tiger") {
        select(id);
      }
      return;
    }

    // Regular play
    const isYourTurn = state.turn === yourSide;
    if (!isYourTurn) return;

    if (state.phase === "placement") {
      if (yourSide === "goat" && b[id] == null && state.decoy_node !== id) {
        send({ action: "place", to: id });
        return;
      }
      if (yourSide === "tiger") {
        if (b[id] === "tiger") {
          select(id);
          return;
        }
        if (selected != null && validDests.includes(id)) {
          send({ action: "move", from: selected, to: id });
          select(null);
        }
        return;
      }
      return;
    }

    // Movement phase
    if (b[id] === yourSide) {
      select(id);
      return;
    }
    if (selected != null && validDests.includes(id)) {
      send({ action: "move", from: selected, to: id });
      select(null);
    }
  };

  const startAbility = (key) => {
    setPendingAbility(key);
    setAbilityPicks([]);
    select(null);
  };

  const confirmAbility = () => {
    if (pendingAbility === "roar" && abilityPicks.length >= 1) {
      send({
        action: "ability",
        ability: "roar",
        payload: { targets: abilityPicks },
      });
      setPendingAbility(null);
      setAbilityPicks([]);
    } else if (pendingAbility === "fortify" && abilityPicks.length === 3) {
      send({
        action: "ability",
        ability: "fortify",
        payload: { triangle: abilityPicks },
      });
      setPendingAbility(null);
      setAbilityPicks([]);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch (_) {}
  };

  if (!state || !boardMeta) {
    return (
      <div className="mx-auto max-w-7xl p-10 text-center text-sm text-neutral-400">
        Synchronising match…
      </div>
    );
  }

  const waiting = room?.status === "waiting";

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      {/* Room top strip */}
      <div className="vyra-card mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="overline">room</div>
          <div
            className="font-mono-tech text-xl tracking-[0.3em] text-[#00e5ff]"
            data-testid="room-code-display"
          >
            {code}
          </div>
          <button
            onClick={copyCode}
            className="rounded border border-[#2a2a2a] p-1.5 text-neutral-400 hover:border-[#00e5ff] hover:text-[#00e5ff]"
            data-testid="room-copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <span
            className="vyra-chip"
            data-testid="connection-status"
            style={{
              borderColor: connected ? "#39ff14" : "#ff3366",
              color: connected ? "#39ff14" : "#ff3366",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: connected ? "#39ff14" : "#ff3366" }}
            />
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/lobby")}
            className="flex items-center gap-2 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-neutral-300 hover:border-[#ff3366] hover:text-[#ff3366]"
            data-testid="exit-button"
          >
            <DoorOpen className="h-4 w-4" /> Exit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left */}
        <div className="lg:col-span-3 space-y-4">
          <StatsPanel state={state} yourSide={yourSide} room={room} />
          <EventLog events={events} />
        </div>

        {/* Center board */}
        <div className="lg:col-span-6">
          <Board
            nodes={boardMeta.nodes}
            adjacency={boardMeta.adjacency}
            state={state}
            yourSide={yourSide}
            onNodeClick={handleNodeClick}
            pendingAbility={pendingAbility}
            abilitySelection={abilityPicks}
            validDestinations={validDests}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
            <div>
              {state.phase === "placement" && yourSide === "goat" && state.turn === "goat" && (
                <span className="text-[#00e5ff]">
                  Click any empty node to place a goat ({state.goats_to_place} remaining).
                </span>
              )}
              {state.phase === "movement" && state.turn === yourSide && (
                <span>Select your piece, then click a destination.</span>
              )}
              {state.turn !== yourSide && state.phase !== "finished" && (
                <span>Waiting for opponent…</span>
              )}
            </div>
            {pendingAbility && (pendingAbility === "roar" || pendingAbility === "fortify") && (
              <button
                onClick={confirmAbility}
                data-testid="ability-confirm"
                disabled={
                  (pendingAbility === "roar" && abilityPicks.length < 1) ||
                  (pendingAbility === "fortify" && abilityPicks.length !== 3)
                }
                className="flex items-center gap-2 rounded-md border border-[#ffd700] px-3 py-1.5 text-[#ffd700] transition hover:bg-[#ffd700]/10 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm ({abilityPicks.length})
              </button>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-3 space-y-4">
          <AbilityPanel
            yourSide={yourSide}
            state={state}
            pendingAbility={pendingAbility}
            onStartAbility={startAbility}
            onCancelAbility={cancelAbility}
          />
          <div className="vyra-card p-5" data-testid="selected-panel">
            <div className="overline">selection</div>
            {selected == null ? (
              <div className="mt-2 text-xs text-neutral-500">
                No piece selected.
              </div>
            ) : (
              <div className="mt-2 font-mono-tech text-sm">
                Node <span className="text-[#00e5ff]">#{selected}</span> ·{" "}
                {state.board[selected] || "empty"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Waiting overlay */}
      <AnimatePresence>
        {waiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#050505]/90 backdrop-blur-md"
            data-testid="waiting-overlay"
          >
            <div className="vyra-card max-w-md p-8 text-center">
              <div className="overline">private room</div>
              <div className="font-head mt-2 text-4xl tracking-tight">
                Waiting for opponent
              </div>
              <p className="mt-3 text-sm text-neutral-400">
                Share this code with a friend to begin the hunt.
              </p>
              <div className="mt-6 rounded-md border border-[#00e5ff] bg-[#00e5ff]/5 p-4">
                <div className="overline">room code</div>
                <div className="font-mono-tech text-4xl tracking-[0.4em] text-[#00e5ff]">
                  {code}
                </div>
              </div>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 rounded-md border border-[#00e5ff] px-4 py-2 text-sm text-[#00e5ff] hover:bg-[#00e5ff]/10"
                  data-testid="waiting-copy"
                >
                  <Copy className="h-4 w-4" /> Copy code
                </button>
                <button
                  onClick={() => nav("/lobby")}
                  className="rounded-md border border-[#2a2a2a] px-4 py-2 text-sm text-neutral-400 hover:border-[#ff3366] hover:text-[#ff3366]"
                  data-testid="waiting-cancel"
                >
                  Back to lobby
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over overlay */}
      <AnimatePresence>
        {state.phase === "finished" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#050505]/90 backdrop-blur-md"
            data-testid="gameover-overlay"
          >
            <div className="vyra-card max-w-md p-8 text-center">
              <div className="overline">match concluded</div>
              <div
                className="font-head mt-2 text-5xl font-bold tracking-tight"
                style={{
                  color: state.winner === yourSide ? "#39ff14" : "#ff3366",
                }}
              >
                {state.winner === yourSide ? "Victory" : "Defeat"}
              </div>
              <p className="mt-3 text-sm text-neutral-400">
                Winner: <span className="font-head">{state.winner}s</span>.
                Rewards have been credited to your account.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={() => nav("/lobby")}
                  className="flex items-center gap-2 rounded-md border border-[#00e5ff] px-4 py-2 text-sm text-[#00e5ff] hover:bg-[#00e5ff]/10"
                  data-testid="gameover-lobby"
                >
                  <RefreshCw className="h-4 w-4" /> New match
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
