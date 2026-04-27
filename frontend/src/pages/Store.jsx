import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins, ShieldCheck, Map as MapIcon, Lock, Check } from "lucide-react";
import { toast } from "sonner";

import { api, formatApiError } from "../lib/api";
import { buyStoreItemWithUsd } from "../lib/razorpay";
import { useAuth } from "../auth/AuthContext";
import AddCoinsModal from "../components/wallet/AddCoinsModal";

export default function Store() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState([]);
  const [owned, setOwned] = useState(new Set());
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const reload = async () => {
    const [itemsRes, invRes] = await Promise.all([
      api.get("/store/items"),
      api.get("/store/inventory"),
    ]);
    setItems(itemsRes.data.items || []);
    setOwned(new Set(invRes.data.owned || []));
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  const visible = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((i) => i.kind === tab);
  }, [items, tab]);

  const buyWithCoins = async (item) => {
    setBusy(item.id + ":coins");
    try {
      await api.post("/store/purchase", { item_id: item.id });
      toast.success(`Unlocked ${item.name}`);
      await refreshUser();
      await reload();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const buyWithUsd = async (item) => {
    setBusy(item.id + ":usd");
    try {
      await buyStoreItemWithUsd(item.id);
      toast.success(`Unlocked ${item.name}`);
      await refreshUser();
      await reload();
    } catch (e) {
      const msg = e?.message || "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10" data-testid="store-page">
      <div className="overline">vyra store</div>
      <h1 className="font-head text-5xl font-bold tracking-tight">
        Skins &amp; Arenas
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        Buy with coins (primary) or USD direct via Razorpay. Items are tied to
        your account forever — no recurring fees.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {["all", "skin", "map"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-testid={`store-tab-${t}`}
            className="rounded-md border px-4 py-1.5 text-xs font-mono-tech uppercase tracking-[0.18em] transition"
            style={{
              borderColor: tab === t ? "#00e5ff" : "#2a2a2a",
              color: tab === t ? "#00e5ff" : "#a3a3a3",
              background: tab === t ? "rgba(0,229,255,0.06)" : "transparent",
            }}
          >
            {t === "all" ? "All" : t === "skin" ? "Skins" : "Maps"}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
          <Coins className="h-4 w-4 text-[#ffd700]" />
          balance{" "}
          <span className="font-mono-tech text-[#ffd700]">
            {user?.coins ?? 0}
          </span>
          <button
            onClick={() => setTopUpOpen(true)}
            className="ml-2 rounded border border-[#ffd700] px-2 py-1 text-[10px] uppercase tracking-widest text-[#ffd700] hover:bg-[#ffd700]/10"
            data-testid="store-add-coins"
          >
            top up
          </button>
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const isOwned = owned.has(item.id);
          const Icon = item.kind === "map" ? MapIcon : ShieldCheck;
          const cantAfford = (user?.coins ?? 0) < item.coins;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="vyra-card relative flex flex-col overflow-hidden p-5"
              data-testid={`store-item-${item.id}`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${item.color}33, transparent 60%)`,
                }}
              />
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-md border"
                  style={{ borderColor: item.color, color: item.color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="overline">
                    {item.kind} {item.side ? `· ${item.side}` : ""}
                  </div>
                  <div
                    className="font-head text-xl"
                    style={{ color: item.color }}
                  >
                    {item.name}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                {item.description}
              </p>

              <div className="mt-auto pt-5">
                {isOwned ? (
                  <div
                    className="flex items-center justify-center gap-2 rounded-md border border-[#39ff14] bg-[#39ff14]/5 py-2 text-sm text-[#39ff14]"
                    data-testid={`owned-${item.id}`}
                  >
                    <Check className="h-4 w-4" /> Owned
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busy === item.id + ":coins" || cantAfford}
                      onClick={() => buyWithCoins(item)}
                      data-testid={`buy-coins-${item.id}`}
                      className="flex items-center justify-center gap-1 rounded-md border border-[#ffd700] px-3 py-2 text-xs font-head uppercase tracking-[0.16em] text-[#ffd700] hover:bg-[#ffd700]/10 disabled:opacity-50"
                    >
                      {cantAfford ? (
                        <>
                          <Lock className="h-3 w-3" /> {item.coins}
                          <Coins className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          {item.coins} <Coins className="h-3 w-3" />
                        </>
                      )}
                    </button>
                    <button
                      disabled={busy === item.id + ":usd"}
                      onClick={() => buyWithUsd(item)}
                      data-testid={`buy-usd-${item.id}`}
                      className="rounded-md border border-[#00e5ff] px-3 py-2 text-xs font-head uppercase tracking-[0.16em] text-[#00e5ff] hover:bg-[#00e5ff]/10 disabled:opacity-50"
                    >
                      ${item.usd.toFixed(2)}
                    </button>
                  </div>
                )}
                {!isOwned && cantAfford && (
                  <div className="mt-2 text-center text-[10px] text-neutral-500">
                    Need {item.coins - (user?.coins ?? 0)} more coins —
                    <button
                      onClick={() => setTopUpOpen(true)}
                      className="ml-1 text-[#ffd700] hover:underline"
                    >
                      top up
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AddCoinsModal
        open={topUpOpen}
        onClose={async () => {
          setTopUpOpen(false);
          await refreshUser();
        }}
      />
    </div>
  );
}
