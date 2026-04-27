import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await register(email, password, username);
      toast.success("Account created. Welcome to Vyra.");
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
        className="flex flex-col justify-center"
      >
        <div className="overline">register · vyra</div>
        <h1 className="font-head mt-2 text-5xl font-bold leading-[1.05] tracking-tight">
          Forge your
          <br />
          <span className="text-[#00e5ff]">sigil</span>.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-neutral-400">
          Starting gift: 200 coins, ELO 1000. Climb the leaderboard by winning
          matches and executing flawless abilities.
        </p>
      </motion.div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="vyra-card p-8 md:self-center"
        data-testid="register-form"
      >
        <div className="overline mb-2">// new_operator.vyra</div>
        <div className="font-head text-3xl font-semibold tracking-tight">
          Create account
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="overline">username</label>
            <input
              data-testid="register-username"
              required
              minLength={2}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-transparent px-4 py-3 font-mono-tech text-sm outline-none transition focus:border-[#00e5ff] focus:ring-2 focus:ring-[#00e5ff]/30"
              placeholder="tiger_king"
            />
          </div>
          <div>
            <label className="overline">email</label>
            <input
              data-testid="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-transparent px-4 py-3 font-mono-tech text-sm outline-none transition focus:border-[#00e5ff] focus:ring-2 focus:ring-[#00e5ff]/30"
              placeholder="you@vyra.game"
            />
          </div>
          <div>
            <label className="overline">password</label>
            <input
              data-testid="register-password"
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-transparent px-4 py-3 font-mono-tech text-sm outline-none transition focus:border-[#00e5ff] focus:ring-2 focus:ring-[#00e5ff]/30"
              placeholder="at least 4 characters"
            />
          </div>
          {err && (
            <div
              data-testid="register-error"
              className="rounded-md border border-[#ff3366] bg-[#ff3366]/10 p-3 text-xs text-[#ff3366]"
            >
              {err}
            </div>
          )}

          <button
            disabled={busy}
            data-testid="register-submit"
            className="mt-2 w-full rounded-md border border-[#ff3366] bg-transparent px-4 py-3 font-head text-sm uppercase tracking-[0.2em] text-[#ff3366] transition hover:bg-[#ff3366]/10 disabled:opacity-60"
          >
            {busy ? "Registering…" : "Forge sigil"}
          </button>
        </div>
        <div className="mt-6 text-center text-xs text-neutral-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-[#00e5ff] hover:underline"
            data-testid="register-login-link"
          >
            Log in
          </Link>
        </div>
      </motion.form>
    </div>
  );
}
