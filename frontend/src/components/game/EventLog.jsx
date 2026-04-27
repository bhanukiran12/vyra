import React from "react";

const LABELS = {
  place: (e) => `Goat placed at ${e.to}`,
  move: (e) => `Moved ${e.from} → ${e.to}`,
  capture: (e) => `Capture! ${e.from} → ${e.to} (ate ${e.over})`,
  pounce: (e) =>
    `Pounce ${e.from} → ${e.to}${e.captured ? ` (captured ${e.over})` : ""}`,
  roar: (e) => `Roar freezes ${e.targets.join(", ")}`,
  fortify: (e) => `Fortify protects ${e.nodes.join(", ")}`,
  decoy: (e) => `Decoy dropped at ${e.node}`,
};

const COLORS = {
  place: "#00e5ff",
  move: "#a3a3a3",
  capture: "#ff3366",
  pounce: "#ff3366",
  roar: "#ffd700",
  fortify: "#39ff14",
  decoy: "#00e5ff",
};

export default function EventLog({ events }) {
  return (
    <div className="vyra-card p-5" data-testid="event-log">
      <div className="overline mb-3">live feed</div>
      <div className="max-h-52 space-y-2 overflow-y-auto pr-2">
        {(!events || events.length === 0) && (
          <div className="text-xs text-neutral-500">
            Events will appear here as the match unfolds…
          </div>
        )}
        {events?.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-l-2 pl-2 text-xs"
            style={{ borderColor: COLORS[e.type] || "#2a2a2a" }}
          >
            <span
              className="overline"
              style={{ color: COLORS[e.type] || "#a3a3a3" }}
            >
              {e.type}
            </span>
            <span className="font-mono-tech text-neutral-300">
              {(LABELS[e.type] || ((x) => JSON.stringify(x)))(e)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
