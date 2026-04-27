import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Coins, Copy, Swords, Trophy, Users, Sparkles } from "lucide-react";

const ENTRY_FEES = [0, 10, 25, 50, 100, 250];

export default function Lobby() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();
  const [side, setSide] = useState("tiger");
  const [code, setCode] = useState("");
  const [joinSide, setJoinSide] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [createdCode, setCreatedCode] = useState(null);
  const [entryFee, setEntryFee] = useState(0);

  useEffect(() => {
    api
      .get("/leaderboard?limit=5")
      .then((r) => setLeaders(r.data))
      .catch(() => {});
  }, []);

  const createRoom = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/rooms/create", {
        side,
        entry_fee: entryFee,
      });
      setCreatedCode(data.code);
      await refreshUser();
      toast.success(
        entryFee > 0
          ? `Room ${data.code} · ${entryFee} coins staked`
          : `Room ${data.code} created — share the code!`,
      );
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    if (!code) return;
    setBusy(true);
    try {
      const { data } = await api.post("/rooms/join", {
        code,
        side: joinSide || undefined,
      });
      await refreshUser();
      nav(`/game/${data.code}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (c) => {
    try {
      await navigator.clipboard.writeText(c);
      toast.success("Code copied to clipboard");
    } catch (_) {
      toast.info(`Code: ${c}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="overline">welcome back</div>
        <h1 className="font-head text-5xl font-bold tracking-tight">
          {user?.username}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-400">
          Create a private arena and share the code with a friend, or enter one
          you&apos;ve received. Every match shifts your rating and earns coin.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Create room */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="vyra-card relative overflow-hidden p-7 lg:col-span-5"
          data-testid="create-room-card"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,51,102,0.25), transparent 60%)",
            }}
          />
          <div className="overline">create private room</div>
          <h2 className="font-head mt-2 text-3xl tracking-tight">
            Open a private <span className="text-[#ff3366]">arena</span>
          </h2>

          <div className="mt-6">
            <div className="overline mb-2">choose your side</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="side-tiger"
                onClick={() => setSide("tiger")}
                className="rounded-md border p-4 text-left transition"
                style={{
                  borderColor: side === "tiger" ? "#ff3366" : "#2a2a2a",
                  background:
                    side === "tiger" ? "rgba(255,51,102,0.08)" : "transparent",
                }}
              >
                <div className="font-head text-lg text-[#ff3366]">Tigers</div>
                <div className="text-xs text-neutral-400">
                  3 pieces · capture 6 goats to win
                </div>
              </button>
              <button
                data-testid="side-goat"
                onClick={() => setSide("goat")}
                className="rounded-md border p-4 text-left transition"
                style={{
                  borderColor: side === "goat" ? "#00e5ff" : "#2a2a2a",
                  background:
                    side === "goat" ? "rgba(0,229,255,0.08)" : "transparent",
                }}
              >
                <div className="font-head text-lg text-[#00e5ff]">Goats</div>
                <div className="text-xs text-neutral-400">
                  15 pieces · immobilize all tigers
                </div>
              </button>
            </div>
          </div>

          {/* Entry fee */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="overline">entry fee (each player)</div>
              <span className="text-[10px] text-neutral-500">
                winner takes pot · 10% platform fee
              </span>
            </div>
            <div
              className="mt-2 flex flex-wrap gap-2"
              data-testid="entry-fee-picker"
            >
              {ENTRY_FEES.map((f) => {
                const insufficient = (user?.coins ?? 0) < f;
                const active = entryFee === f;
                return (
                  <button
                    key={f}
                    onClick={() => setEntryFee(f)}
                    disabled={insufficient}
                    data-testid={`entry-fee-${f}`}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-mono-tech transition disabled:opacity-40"
                    style={{
                      borderColor: active ? "#ffd700" : "#2a2a2a",
                      color: active ? "#ffd700" : "#a3a3a3",
                      background: active ? "rgba(255,215,0,0.08)" : "transparent",
                    }}
                  >
                    {f === 0 ? (
                      "Casual"
                    ) : (
                      <>
                        {f} <Coins className="h-3 w-3" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            {entryFee > 0 && (
              <div
                className="mt-2 flex items-center justify-between rounded-md border border-[#ffd700]/30 bg-[#ffd700]/5 p-2 text-[11px] text-neutral-300"
                data-testid="entry-fee-summary"
              >
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[#ffd700]" />
                  Pot {entryFee * 2} · winner takes{" "}
                  <span className="text-[#39ff14]">
                    {entryFee * 2 - Math.floor((entryFee * 2) * 0.1)}
                  </span>
                </span>
                <span className="text-neutral-500">
                  fee {Math.floor((entryFee * 2) * 0.1)}c
                </span>
              </div>
            )}
          </div>

          <button
            onClick={createRoom}
            disabled={busy}
            data-testid="create-room-button"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-[#ff3366] px-4 py-3 font-head uppercase tracking-[0.2em] text-[#ff3366] transition hover:bg-[#ff3366]/10 disabled:opacity-60"
          >
            <Swords className="h-4 w-4" />{" "}
            {entryFee > 0 ? `Stake ${entryFee} & open arena` : "Generate code"}
          </button>

          {createdCode && (
            <div
              className="mt-5 rounded-md border border-[#39ff14] bg-[#39ff14]/5 p-4"
              data-testid="created-room-code-card"
            >
              <div className="overline">room code</div>
              <div className="flex items-center justify-between gap-4">
                <span
                  className="font-mono-tech text-3xl text-[#39ff14]"
                  data-testid="created-room-code"
                >
                  {createdCode}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyCode(createdCode)}
                    className="rounded border border-[#2a2a2a] p-2 text-neutral-300 hover:border-[#00e5ff] hover:text-[#00e5ff]"
                    data-testid="copy-code-button"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => nav(`/game/${createdCode}`)}
                    data-testid="enter-room-button"
                    className="rounded border border-[#00e5ff] bg-[#00e5ff]/10 px-3 py-2 text-sm text-[#00e5ff]"
                  >
                    Enter room
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Share this code with your opponent, then enter the arena.
              </p>
            </div>
          )}
        </motion.div>

        {/* Join room */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="vyra-card p-7 lg:col-span-4"
          data-testid="join-room-card"
        >
          <div className="overline">join private room</div>
          <h2 className="font-head mt-2 text-3xl tracking-tight">
            Enter an <span className="text-[#00e5ff]">arena</span>
          </h2>
          <div className="mt-6 space-y-3">
            <input
              data-testid="join-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="w-full rounded-md border border-[#2a2a2a] bg-transparent px-4 py-3 font-mono-tech text-lg tracking-[0.4em] outline-none transition focus:border-[#00e5ff] focus:ring-2 focus:ring-[#00e5ff]/30"
            />
            <button
              onClick={joinRoom}
              disabled={busy || !code}
              data-testid="join-room-button"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#00e5ff] px-4 py-3 font-head uppercase tracking-[0.2em] text-[#00e5ff] transition hover:bg-[#00e5ff]/10 disabled:opacity-60"
            >
              <Users className="h-4 w-4" /> Join match
            </button>
          </div>
        </motion.div>

        {/* Leaderboard snapshot */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="vyra-card p-7 lg:col-span-3"
        >
          <div className="flex items-center justify-between">
            <div className="overline">top operators</div>
            <Link
              to="/leaderboard"
              className="text-xs text-[#00e5ff] hover:underline"
              data-testid="lobby-leaderboard-link"
            >
              view all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {leaders.length === 0 && (
              <div className="text-xs text-neutral-500">
                No operators yet. Win a match to claim rank 1.
              </div>
            )}
            {leaders.map((l, i) => (
              <div
                key={l.username}
                className="flex items-center justify-between border-b border-[#1f1f1f] pb-2 last:border-0"
                data-testid={`leader-row-${i}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono-tech text-xs text-neutral-500">
                    #{i + 1}
                  </span>
                  <span className="font-head">{l.username}</span>
                </div>
                <span className="font-mono-tech text-sm text-[#00e5ff]">
                  <Trophy className="mr-1 inline h-3 w-3" />
                  {l.rating}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Rules */}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          {
            t: "Placement",
            d: "Goats deploy 15 pieces one-per-turn. Tigers move and hunt between placements.",
            c: "#00e5ff",
          },
          {
            t: "Movement",
            d: "After placement, both sides slide between adjacent nodes. Tigers capture by jumping over adjacent goats.",
            c: "#ff3366",
          },
          {
            t: "Abilities",
            d: "Pounce & Roar for tigers. Fortify & Decoy for goats. Cooldowns apply — one ability per turn.",
            c: "#ffd700",
          },
        ].map((r) => (
          <div key={r.t} className="vyra-card p-6">
            <div
              className="font-head text-lg"
              style={{ color: r.c }}
            >
              {r.t}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {r.d}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
