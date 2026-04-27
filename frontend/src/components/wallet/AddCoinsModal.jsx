import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, X, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { buyCoinPackage } from "../../lib/razorpay";
import { useAuth } from "../../auth/AuthContext";

export default function AddCoinsModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get("/wallet/packages")
      .then((r) => setPackages(r.data.packages || []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleBuy = async (pkg) => {
    setBusyId(pkg.id);
    try {
      const result = await buyCoinPackage(pkg.id);
      toast.success(
        `+${pkg.coins} coins added — new balance ${result.balance}`,
      );
      await refreshUser();
      onClose?.();
    } catch (e) {
      const msg = e?.message || "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur"
          data-testid="add-coins-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 8, opacity: 0 }}
            className="vyra-card relative w-full max-w-3xl overflow-hidden p-6"
          >
            <button
              onClick={onClose}
              data-testid="add-coins-close"
              className="absolute right-4 top-4 rounded-md border border-[#2a2a2a] p-1.5 text-neutral-400 hover:border-[#ff3366] hover:text-[#ff3366]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="overline">recharge wallet</div>
            <h2 className="font-head mt-1 flex items-center gap-3 text-3xl tracking-tight">
              <Coins className="h-7 w-7 text-[#ffd700]" /> Add Vyra coins
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Pay in <span className="text-white">USD</span> via Razorpay. Coins
              are credited the moment payment is verified — never directly
              betted with cash.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-md border border-[#1f1f1f] bg-[#0c0c0c]"
                  />
                ))}
              {!loading &&
                packages.map((p) => {
                  const totalCoins = p.coins;
                  const baseCoins = totalCoins - (p.bonus || 0);
                  const ratio = (totalCoins / p.usd).toFixed(0);
                  return (
                    <div
                      key={p.id}
                      data-testid={`package-${p.id}`}
                      className="relative flex flex-col rounded-md border border-[#1f1f1f] bg-[#0c0c0c] p-4 transition hover:border-[#ffd700]"
                    >
                      {p.popular && (
                        <span className="absolute -top-2 right-3 rounded-full border border-[#ffd700] bg-[#0c0c0c] px-2 py-0.5 text-[10px] font-mono-tech uppercase tracking-widest text-[#ffd700]">
                          popular
                        </span>
                      )}
                      <div className="overline">{p.label}</div>
                      <div className="mt-1 flex items-baseline gap-1 font-head text-3xl text-[#ffd700]">
                        {totalCoins}
                        <Coins className="h-4 w-4" />
                      </div>
                      {p.bonus > 0 && (
                        <div className="text-[11px] text-[#39ff14]">
                          <Sparkles className="mr-1 inline h-3 w-3" />
                          {baseCoins} base + {p.bonus} bonus
                        </div>
                      )}
                      <div className="mt-2 text-xs text-neutral-500">
                        {p.tagline}
                      </div>
                      <div className="mt-auto pt-4">
                        <div className="text-xs text-neutral-400">
                          {ratio} coins / $1
                        </div>
                        <button
                          onClick={() => handleBuy(p)}
                          disabled={!!busyId}
                          data-testid={`buy-package-${p.id}`}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-[#ffd700] px-3 py-2 text-sm font-head uppercase tracking-[0.18em] text-[#ffd700] transition hover:bg-[#ffd700]/10 disabled:opacity-60"
                        >
                          {busyId === p.id ? (
                            "Processing…"
                          ) : (
                            <>
                              Pay ${p.usd.toFixed(2)} <Check className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
              Payments are processed by Razorpay. Vyra never stores card data.
              Coins are an in-game currency and have no cash redemption value.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
