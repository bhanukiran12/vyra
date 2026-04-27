import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await login(email, password);
      toast.success("Welcome back, operator.");
      nav("/lobby");
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col justify-center"
      >
        <div className="overline">encrypted login</div>
        <h1 className="font-head mt-2 text-5xl font-bold leading-[1.05] tracking-tight">
          Return to the
          <br />
          <span className="text-[#ff3366]">hunt</span>.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-neutral-400">
          Vyra blends the ancient Aadu Puli Aatam with a neon battlefield. Your
          rating, coins and rituals await.
        </p>
        <div className="mt-8 flex gap-3 text-xs text-neutral-500">
          <span className="vyra-chip">
            <span className="h-2 w-2 rounded-full bg-[#00e5ff]" /> 15 GOATS
          </span>
          <span className="vyra-chip">
            <span className="h-2 w-2 rounded-full bg-[#ff3366]" /> 3 TIGERS
          </span>
          <span className="vyra-chip">
            <span className="h-2 w-2 rounded-full bg-[#39ff14]" /> 4 ABILITIES
          </span>
        </div>
      </motion.div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="vyra-card p-8 md:self-center"
        data-testid="login-form"
      >
        <div className="overline mb-2">// login.vyra</div>
        <div className="font-head text-3xl font-semibold tracking-tight">
          Sign in
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="overline">email</label>
            <input
              data-testid="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-transparent px-4 py-3 font-mono-tech text-sm outline-none transition focus:border-[#00e5ff] focus:ring-2 focus:ring-[#00e5ff]/30"
              placeholder="operator@vyra.game"
            />
          </div>
          <div>
            <label className="overline">password</label>
            <input
              data-testid="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-transparent px-4 py-3 font-mono-tech text-sm outline-none transition focus:border-[#00e5ff] focus:ring-2 focus:ring-[#00e5ff]/30"
              placeholder="········"
            />
          </div>
          {err && (
            <div
              data-testid="login-error"
              className="rounded-md border border-[#ff3366] bg-[#ff3366]/10 p-3 text-xs text-[#ff3366]"
            >
              {err}
            </div>
          )}

          <button
            disabled={busy}
            data-testid="login-submit"
            className="mt-2 w-full rounded-md border border-[#00e5ff] bg-transparent px-4 py-3 font-head text-sm uppercase tracking-[0.2em] text-[#00e5ff] transition hover:bg-[#00e5ff]/10 disabled:opacity-60"
          >
            {busy ? "Connecting…" : "Enter the arena"}
          </button>
        </div>
        <div className="mt-6 text-center text-xs text-neutral-500">
          New operator?{" "}
          <Link
            to="/register"
            className="text-[#00e5ff] hover:underline"
            data-testid="login-register-link"
          >
            Create an account
          </Link>
        </div>
      </motion.form>
    </div>
  );
}
