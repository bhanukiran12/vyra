import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../../store/gameStore";

/**
 * SVG Board
 * Props:
 *  - nodes: [{id,x,y}]
 *  - adjacency: {id: [neighbors]}
 *  - state: server game state
 *  - yourSide: "tiger" | "goat"
 *  - onNodeClick(nodeId)
 *  - pendingAbility: string | null   (for decoy/fortify/roar selection)
 *  - abilitySelection: int[]
 */
export default function Board({
  nodes,
  adjacency,
  state,
  yourSide,
  onNodeClick,
  pendingAbility = null,
  abilitySelection = [],
  validDestinations = [],
}) {
  const selected = useGameStore((s) => s.selected);
  const width = 600;
  const height = 740;

  const edges = useMemo(() => {
    if (!adjacency) return [];
    const list = [];
    const seen = new Set();
    Object.entries(adjacency).forEach(([a, arr]) => {
      arr.forEach((b) => {
        const k = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(k)) return;
        seen.add(k);
        list.push([Number(a), b]);
      });
    });
    return list;
  }, [adjacency]);

  const nodeById = useMemo(() => {
    const m = {};
    (nodes || []).forEach((n) => (m[n.id] = n));
    return m;
  }, [nodes]);

  if (!nodes) return null;

  const isYourTurn = state?.turn === yourSide && state?.phase !== "finished";
  const decoyNode = state?.decoy_node;

  return (
    <div
      className="relative vyra-card overflow-hidden p-4"
      data-testid="game-board"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,229,255,0.07),transparent_60%)]" />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="relative z-10 w-full"
      >
        <defs>
          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map(([a, b]) => {
          const na = nodeById[a];
          const nb = nodeById[b];
          if (!na || !nb) return null;
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="#2a2a2a"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Valid move hints */}
        {validDestinations.map((id) => {
          const n = nodeById[id];
          if (!n) return null;
          return (
            <circle
              key={`hint-${id}`}
              cx={n.x}
              cy={n.y}
              r={10}
              fill="#39ff14"
              opacity={0.65}
              className="node-pulse"
              data-testid={`move-hint-${id}`}
            />
          );
        })}

        {/* Ability selection markers */}
        {abilitySelection.map((id) => {
          const n = nodeById[id];
          if (!n) return null;
          return (
            <circle
              key={`abil-${id}`}
              cx={n.x}
              cy={n.y}
              r={22}
              fill="none"
              stroke="#ffd700"
              strokeDasharray="4 4"
              strokeWidth={2}
            />
          );
        })}

        {/* Nodes & pieces */}
        {nodes.map((n) => {
          const piece = state?.board?.[n.id];
          const frozen = state?.frozen_nodes?.includes(n.id);
          const fortified = state?.fortified_nodes?.includes(n.id);
          const isDecoy = decoyNode === n.id;
          const isSelected = selected === n.id;

          const clickable =
            (pendingAbility ||
              (isYourTurn &&
                (state?.phase === "placement"
                  ? (yourSide === "goat" && piece == null) ||
                    (yourSide === "tiger" && piece === "tiger") ||
                    isSelected
                  : piece === yourSide || validDestinations.includes(n.id)))) &&
            state?.phase !== "finished";

          return (
            <g
              key={n.id}
              onClick={() => onNodeClick && onNodeClick(n.id)}
              style={{ cursor: clickable ? "pointer" : "default" }}
              data-testid={`board-node-${n.id}`}
            >
              {/* Empty node marker */}
              {piece == null && !isDecoy && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={6}
                  fill="#121212"
                  stroke="#00e5ff"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                />
              )}
              {/* Tiger */}
              {piece === "tiger" && (
                <g filter="url(#glow-red)">
                  <motion.circle
                    layoutId={`piece-tiger-${n.id}`}
                    cx={n.x}
                    cy={n.y}
                    r={18}
                    fill="#121212"
                    stroke={isSelected ? "#ffd700" : "#ff3366"}
                    strokeWidth={isSelected ? 3 : 2.5}
                    className={frozen ? "" : "pulse-red"}
                  />
                  <text
                    x={n.x}
                    y={n.y + 5}
                    textAnchor="middle"
                    fill="#ff3366"
                    fontFamily="'Unbounded', sans-serif"
                    fontWeight="700"
                    fontSize="14"
                  >
                    T
                  </text>
                </g>
              )}
              {/* Goat */}
              {piece === "goat" && (
                <g filter="url(#glow-cyan)">
                  <motion.circle
                    layoutId={`piece-goat-${n.id}`}
                    cx={n.x}
                    cy={n.y}
                    r={14}
                    fill="#121212"
                    stroke={
                      isSelected
                        ? "#ffd700"
                        : fortified
                          ? "#39ff14"
                          : "#00e5ff"
                    }
                    strokeWidth={isSelected || fortified ? 2.5 : 2}
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fill="#00e5ff"
                    fontFamily="'Unbounded', sans-serif"
                    fontWeight="600"
                    fontSize="11"
                  >
                    G
                  </text>
                </g>
              )}
              {frozen && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={22}
                  fill="none"
                  stroke="#ffd700"
                  strokeWidth={1.2}
                  strokeDasharray="3 4"
                />
              )}
              {isDecoy && (
                <g>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={12}
                    fill="none"
                    stroke="#39ff14"
                    strokeDasharray="2 3"
                    strokeWidth={2}
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fill="#39ff14"
                    fontFamily="'JetBrains Mono', monospace"
                    fontSize="10"
                  >
                    D
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
