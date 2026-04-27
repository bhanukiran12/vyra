import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Coins, Radar, X, Search, Sparkles } from "lucide-react";

import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";

const TIERS = [0, 10, 25, 50, 100, 250];
const SIDES = [
  { value: "", label: "Any" },
  { value: "tiger", label: "Tiger" },
  { value: "goat", label: "Goat" },
];

export default function QuickMatch() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();

  const [tier, setTier] = useState(0);
  const [sidePref, setSidePref] = useState("");
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const cancelRef = useRef(false);

  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [searching]);

  const stopSearch = async (silent = false) => {
    cancelRef.current = true;
    setSearching(false);
    setElapsed(0);
    try {
      await api.post("/matchmaking/cancel");
    } catch (_) {}
    if (!silent) toast("Quick match cancelled");
    await refreshUser();
  };

  const startSearch = async () => {
    if (searching) return;
    if (tier > 0 && (user?.coins ?? 0) < tier) {
      toast.error("Not enough coins for this tier");
      return;
    }
    cancelRef.current = false;
    setSearching(true);
    setElapsed(0);
    try {
      // Long-poll loop
      while (!cancelRef.current) {
        let resp;
        try {
          const { data } = await api.post("/matchmaking/queue", {
            entry_fee: tier,
            side: sidePref || undefined,
          });
          resp = data;
        } catch (e) {
          if (cancelRef.current) return;
          toast.error(formatApiError(e));
          setSearching(false);
          await refreshUser();
          return;
        }
        if (cancelRef.current) {
          // User cancelled mid-flight; ensure backend cleanup
          try {
            await api.post("/matchmaking/cancel");
          } catch (_) {}
          return;
        }
        if (resp?.matched && resp.code) {
          setSearching(false);
          await refreshUser();
          toast.success(`Match found · joining as ${resp.your_side}`);
          nav(`/game/${resp.code}`);
          return;
        }
        // resp.waiting === true → loop and re-poll
      }
    } finally {
      // safety net
      if (cancelRef.current) {
        setSearching(false);
        setElapsed(0);
      }
    }
  };

  const insufficient = tier > 0 && (user?.coins ?? 0) < tier;

  return (
    <div
      className="vyra-card relative overflow-hidden p-6"
      data-testid="quick-match-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,229,255,0.18), transparent 60%)",
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="overline">quick match</div>
          <h2 className="font-head mt-1 flex items-center gap-2 text-2xl tracking-tight">
            <Radar className="h-5 w-5 text-[#00e5ff]" /> Auto-pair an opponent
          </h2>
        </div>
        <Sparkles className="h-5 w-5 text-[#ffd700]" />
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Pick a stake, hit search. We pair you with the next operator at the
        same tier — no codes to share.
      </p>

      <div className="mt-5">
        <div className="overline">stake tier</div>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="qm-tier-picker">
          {TIERS.map((f) => {
            const cant = f > 0 && (user?.coins ?? 0) < f;
            const active = tier === f;
            return (
              <button
                key={f}
                onClick={() => !searching && setTier(f)}
                disabled={cant || searching}
                data-testid={`qm-tier-${f}`}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-mono-tech transition disabled:opacity-40"
                style={{
                  borderColor: active ? "#00e5ff" : "#2a2a2a",
                  color: active ? "#00e5ff" : "#a3a3a3",
                  background: active ? "rgba(0,229,255,0.06)" : "transparent",
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
      </div>

      <div className="mt-4">
        <div className="overline">side preference</div>
        <div className="mt-2 flex gap-2" data-testid="qm-side-picker">
          {SIDES.map((s) => {
            const active = sidePref === s.value;
            return (
              <button
                key={s.value || "any"}
                onClick={() => !searching && setSidePref(s.value)}
                disabled={searching}
                data-testid={`qm-side-${s.value || "any"}`}
                className="rounded-md border px-3 py-1.5 text-xs font-mono-tech uppercase tracking-[0.18em] transition disabled:opacity-50"
                style={{
                  borderColor: active ? "#ff3366" : "#2a2a2a",
                  color: active ? "#ff3366" : "#a3a3a3",
                  background: active ? "rgba(255,51,102,0.06)" : "transparent",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {tier > 0 && (
        <div
          className="mt-4 flex items-center justify-between rounded-md border border-[#ffd700]/30 bg-[#ffd700]/5 p-2 text-[11px]"
          data-testid="qm-pot-summary"
        >
          <span className="text-neutral-300">
            Pot {tier * 2} · winner takes{" "}
            <span className="text-[#39ff14]">
              {tier * 2 - Math.floor(tier * 2 * 0.1)}
            </span>
          </span>
          <span className="text-neutral-500">
            stake refunded if you cancel
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div
            key="searching"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-5 flex items-center justify-between rounded-md border border-[#00e5ff]/40 bg-[#00e5ff]/5 p-3"
            data-testid="qm-searching-row"
          >
            <div className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-full border border-[#00e5ff] text-[#00e5ff]">
                <Radar className="h-4 w-4 animate-pulse" />
                <span className="absolute inset-0 animate-ping rounded-full border border-[#00e5ff] opacity-30" />
              </span>
              <div>
                <div className="font-head text-sm text-[#00e5ff]">
                  Scanning the network…
                </div>
                <div className="text-[11px] text-neutral-400">
                  {tier > 0 ? `${tier} coin tier` : "casual"} · {elapsed}s
                  elapsed
                </div>
              </div>
            </div>
            <button
              onClick={() => stopSearch(false)}
              data-testid="qm-cancel"
              className="flex items-center gap-1 rounded-md border border-[#ff3366] px-3 py-1.5 text-xs font-head uppercase tracking-[0.18em] text-[#ff3366] hover:bg-[#ff3366]/10"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="search"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={startSearch}
            disabled={insufficient}
            data-testid="qm-find-match"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-[#00e5ff] bg-[#00e5ff]/5 px-4 py-3 font-head uppercase tracking-[0.2em] text-[#00e5ff] transition hover:bg-[#00e5ff]/10 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />{" "}
            {insufficient ? "Insufficient coins" : "Find a match"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
