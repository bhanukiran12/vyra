import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Coins, ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";

import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import AddCoinsModal from "../components/wallet/AddCoinsModal";

const KIND_LABEL = {
  topup: "Top-up",
  match_win: "Match win",
  match_loss: "Consolation",
  entry_fee: "Entry fee",
  store_purchase: "Store",
  store_purchase_usd: "Store (USD)",
};

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/wallet/transactions?limit=100");
      setTx(data.transactions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10" data-testid="wallet-page">
      <div className="overline">wallet</div>
      <h1 className="font-head text-5xl font-bold tracking-tight">
        Vyra Wallet
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        Coins are the in-game currency for entry fees and store purchases. Top
        up in USD via Razorpay — no real money ever changes hands at the table.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="vyra-card md:col-span-2 flex flex-wrap items-center justify-between gap-4 p-6"
          data-testid="wallet-balance-card"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-md border border-[#ffd700] text-[#ffd700]">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <div className="overline">current balance</div>
              <div className="font-head text-4xl text-[#ffd700]" data-testid="wallet-balance-value">
                {user?.coins ?? 0}
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            data-testid="wallet-add-coins"
            className="flex items-center gap-2 rounded-md border border-[#ffd700] px-5 py-3 font-head uppercase tracking-[0.2em] text-[#ffd700] hover:bg-[#ffd700]/10"
          >
            <Plus className="h-4 w-4" /> Add coins
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="vyra-card p-6"
        >
          <div className="overline">how it works</div>
          <ul className="mt-3 space-y-2 text-xs text-neutral-400">
            <li>• $1 → 100 coins. Bigger packs unlock bonus coins.</li>
            <li>• Match wins return the pot minus a 10% platform fee.</li>
            <li>• Skins &amp; maps cost coins (or USD direct).</li>
          </ul>
        </motion.div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="overline">ledger</div>
            <h2 className="font-head text-2xl">Transactions</h2>
          </div>
          <button
            onClick={reload}
            className="text-xs text-[#00e5ff] hover:underline"
            data-testid="wallet-refresh"
          >
            refresh
          </button>
        </div>
        <div className="vyra-card mt-4 divide-y divide-[#1f1f1f]">
          {loading && (
            <div className="p-5 text-sm text-neutral-500">Loading…</div>
          )}
          {!loading && tx.length === 0 && (
            <div className="p-5 text-sm text-neutral-500">
              No transactions yet — top up to fund your first match.
            </div>
          )}
          {tx.map((t) => {
            const positive = (t.delta ?? 0) >= 0;
            const Icon = positive ? ArrowDownToLine : ArrowUpFromLine;
            const tone = positive ? "#39ff14" : "#ff3366";
            return (
              <div
                key={t.id || `${t.created_at}-${t.kind}`}
                className="flex items-center justify-between p-4"
                data-testid="tx-row"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-md border"
                    style={{ borderColor: tone, color: tone }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-head text-sm">
                      {KIND_LABEL[t.kind] || t.kind}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {t.description || ""}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono-tech text-sm"
                    style={{ color: tone }}
                  >
                    {positive ? "+" : ""}
                    {t.delta ?? 0} {t.currency || "coins"}
                  </div>
                  {t.usd_amount ? (
                    <div className="text-[11px] text-neutral-500">
                      ${Number(t.usd_amount).toFixed(2)}
                    </div>
                  ) : null}
                  <div className="text-[11px] text-neutral-600">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddCoinsModal
        open={open}
        onClose={async () => {
          setOpen(false);
          await refreshUser();
          await reload();
        }}
      />
    </div>
  );
}
