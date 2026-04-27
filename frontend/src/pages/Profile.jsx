import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { motion } from "framer-motion";
import { Coins, Trophy, Swords, Skull } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/match-history?limit=20")
      .then((r) => setHistory(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const stat = (label, value, color, Icon, testId) => (
    <div className="vyra-card flex items-center gap-4 p-5" data-testid={testId}>
      <div
        className="grid h-12 w-12 place-items-center rounded-md border"
        style={{ borderColor: color, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="overline">{label}</div>
        <div className="font-head text-2xl" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10" data-testid="profile-page">
      <div className="overline">operator dossier</div>
      <h1 className="font-head text-5xl font-bold tracking-tight">
        {user.username}
      </h1>
      <p className="mt-2 text-sm text-neutral-400">{user.email}</p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        {stat("coins", user.coins, "#ffd700", Coins, "profile-coins")}
        {stat("rating", user.rating, "#00e5ff", Trophy, "profile-rating")}
        {stat("wins", user.wins, "#39ff14", Swords, "profile-wins")}
        {stat("losses", user.losses, "#ff3366", Skull, "profile-losses")}
      </motion.div>

      <div className="mt-10">
        <div className="overline">match history</div>
        <h2 className="font-head text-2xl">Recent engagements</h2>
        <div className="vyra-card mt-4 divide-y divide-[#1f1f1f]">
          {loading && (
            <div className="p-5 text-sm text-neutral-500">Loading…</div>
          )}
          {!loading && history.length === 0 && (
            <div className="p-5 text-sm text-neutral-500">
              No matches yet — your record starts today.
            </div>
          )}
          {history.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4"
              data-testid={`history-row-${i}`}
            >
              <div className="flex items-center gap-4">
                <span
                  className="overline"
                  style={{
                    color: m.result === "win" ? "#39ff14" : "#ff3366",
                  }}
                >
                  {m.result}
                </span>
                <span className="font-head">{m.opponent}</span>
                <span className="overline">· {m.side}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono-tech">
                <span
                  className={
                    m.rating_delta >= 0
                      ? "text-[#39ff14]"
                      : "text-[#ff3366]"
                  }
                >
                  {m.rating_delta >= 0 ? "+" : ""}
                  {m.rating_delta} ELO
                </span>
                <span className="text-[#ffd700]">+{m.coins_delta}c</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
