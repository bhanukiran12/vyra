import React from "react";
import { motion } from "framer-motion";

export default function StatsPanel({ state, yourSide, room }) {
  if (!state) return null;

  const goatsLeft = state.board?.filter((x) => x === "goat").length || 0;
  const placed = 15 - state.goats_to_place;

  const stat = (label, value, accent, testId) => (
    <div className="flex items-center justify-between border-b border-[#1f1f1f] py-3">
      <span className="overline">{label}</span>
      <span
        className="font-mono-tech text-lg"
        style={{ color: accent || "#f5f5f5" }}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );

  const turnLabel =
    state.phase === "finished"
      ? state.winner === yourSide
        ? "YOU WIN"
        : "YOU LOSE"
      : state.turn === yourSide
        ? "YOUR TURN"
        : "OPPONENT";

  const turnColor =
    state.phase === "finished"
      ? state.winner === yourSide
        ? "#39ff14"
        : "#ff3366"
      : state.turn === "tiger"
        ? "#ff3366"
        : "#00e5ff";

  return (
    <div className="vyra-card p-5" data-testid="stats-panel">
      <div className="mb-4">
        <div className="overline">match</div>
        <div className="font-head text-xl">
          {room?.host?.username || "—"} <span className="text-neutral-500">vs</span>{" "}
          {room?.guest?.username || "..."}
        </div>
        <div className="overline mt-1">
          you play {yourSide || "—"}
        </div>
      </div>

      <motion.div
        key={turnLabel}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-md border px-4 py-3 text-center"
        style={{
          borderColor: turnColor,
          color: turnColor,
          boxShadow: `0 0 22px ${turnColor}33`,
        }}
        data-testid="turn-indicator"
      >
        <div className="font-head text-xl tracking-wide">{turnLabel}</div>
        <div className="overline mt-1">phase · {state.phase}</div>
      </motion.div>

      {stat(
        "captures",
        `${state.goats_captured} / 6`,
        "#ff3366",
        "stat-captures"
      )}
      {stat("goats left", goatsLeft, "#00e5ff", "stat-goats-left")}
      {stat(
        "placed",
        `${placed} / 15`,
        "#f5f5f5",
        "stat-placed"
      )}
      {stat("turn #", state.turn_number, "#a3a3a3", "stat-turn-number")}
    </div>
  );
}
