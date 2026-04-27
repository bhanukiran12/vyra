import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { motion } from "framer-motion";
import { Trophy, Coins } from "lucide-react";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/leaderboard?limit=50")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10" data-testid="leaderboard-page">
      <div className="overline">global standings</div>
      <h1 className="font-head text-5xl font-bold tracking-tight">
        Leaderboard
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        Ranked by ELO rating. Victory gains 25 rating points; defeat loses 25.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="vyra-card mt-8 overflow-hidden"
      >
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1f1f1f] text-xs uppercase tracking-widest text-neutral-500">
              <th className="px-6 py-4">#</th>
              <th className="px-6 py-4">Operator</th>
              <th className="px-6 py-4">Rating</th>
              <th className="px-6 py-4">Wins</th>
              <th className="px-6 py-4">Losses</th>
              <th className="px-6 py-4">Coins</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">
                  No operators yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={r.username}
                className="border-b border-[#141414] transition hover:bg-[#0d0d0d]"
                data-testid={`leaderboard-row-${i}`}
              >
                <td className="px-6 py-4 font-mono-tech text-neutral-500">
                  {i + 1}
                </td>
                <td className="px-6 py-4 font-head">{r.username}</td>
                <td className="px-6 py-4 font-mono-tech text-[#00e5ff]">
                  <Trophy className="mr-2 inline h-3.5 w-3.5" />
                  {r.rating}
                </td>
                <td className="px-6 py-4 font-mono-tech text-[#39ff14]">
                  {r.wins}
                </td>
                <td className="px-6 py-4 font-mono-tech text-[#ff3366]">
                  {r.losses}
                </td>
                <td className="px-6 py-4 font-mono-tech">
                  <Coins className="mr-2 inline h-3.5 w-3.5 text-[#ffd700]" />
                  {r.coins}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
