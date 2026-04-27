import React from "react";
import { motion } from "framer-motion";
import { Flame, Shield, Zap, Target } from "lucide-react";

const META = {
  tiger: [
    {
      key: "pounce",
      name: "Pounce",
      desc: "Jump 2 nodes in a line. Captures the goat in between if present.",
      cd: 3,
      icon: Zap,
      color: "#ff3366",
    },
    {
      key: "roar",
      name: "Roar",
      desc: "Freeze up to 2 adjacent goats for one turn.",
      cd: 5,
      icon: Flame,
      color: "#ff3366",
    },
  ],
  goat: [
    {
      key: "fortify",
      name: "Fortify",
      desc: "Select 3 connected goats — uncapturable for 1 turn.",
      cd: 4,
      icon: Shield,
      color: "#39ff14",
    },
    {
      key: "decoy",
      name: "Decoy",
      desc: "Drop a temporary blocker on any empty node for 1 turn.",
      cd: 5,
      icon: Target,
      color: "#00e5ff",
    },
  ],
};

export default function AbilityPanel({
  yourSide,
  state,
  pendingAbility,
  onStartAbility,
  onCancelAbility,
}) {
  if (!yourSide) return null;
  const abilities = META[yourSide] || [];
  const cds = state?.cooldowns?.[yourSide] || {};
  const isYourTurn = state?.turn === yourSide && state?.phase !== "finished";

  return (
    <div className="vyra-card p-5" data-testid="ability-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="overline">abilities</div>
        {pendingAbility && (
          <button
            data-testid="ability-cancel"
            className="text-xs text-[#ff3366] hover:underline"
            onClick={onCancelAbility}
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-3">
        {abilities.map((a) => {
          const cd = cds[a.key] || 0;
          const ready = cd === 0 && isYourTurn && !pendingAbility;
          const Icon = a.icon;
          const active = pendingAbility === a.key;
          return (
            <motion.button
              key={a.key}
              whileHover={{ y: ready ? -1 : 0 }}
              disabled={!ready}
              data-testid={`ability-${a.key}`}
              onClick={() => ready && onStartAbility(a.key)}
              className="w-full rounded-md border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: active
                  ? "#ffd700"
                  : ready
                    ? a.color
                    : "#2a2a2a",
                background: active ? "rgba(255,215,0,0.06)" : "transparent",
                boxShadow: ready
                  ? `0 0 16px ${a.color}22`
                  : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: a.color }} />
                  <span className="font-head text-base">{a.name}</span>
                </div>
                <span
                  className="font-mono-tech text-xs"
                  style={{ color: cd > 0 ? "#525252" : "#a3a3a3" }}
                >
                  {cd > 0 ? `CD ${cd}` : `READY`}
                </span>
              </div>
              <div className="mt-2 text-xs leading-relaxed text-neutral-400">
                {a.desc}
              </div>
            </motion.button>
          );
        })}
      </div>
      {pendingAbility && (
        <div
          className="mt-4 rounded-md border border-[#ffd700] bg-[#ffd700]/5 p-3 text-xs text-[#ffd700]"
          data-testid="ability-instructions"
        >
          {pendingAbility === "roar" &&
            "Pick 1 or 2 adjacent goats, then press Confirm."}
          {pendingAbility === "fortify" &&
            "Pick 3 of your goats forming a connected triangle, then press Confirm."}
          {pendingAbility === "decoy" && "Click an empty node to drop a decoy."}
          {pendingAbility === "pounce" &&
            "Select one of your tigers, then click a valid 2-step landing node."}
        </div>
      )}
    </div>
  );
}
