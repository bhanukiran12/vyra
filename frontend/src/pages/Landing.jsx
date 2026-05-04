import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, Shield, Zap, Flame, ArrowRight } from "lucide-react";
import Board3DShowcase from "../components/Board3DShowcase";

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-4 h-72 w-72 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,51,102,0.25), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-40 h-96 w-96 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(0,229,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="overline">· aadu puli aatam · reforged ·</span>
              <h1 className="font-head mt-4 text-6xl font-bold leading-[1.02] tracking-tight md:text-7xl">
                Hunt the flock.
                <br />
                <span className="text-[#ff3366]">Or</span>
                <span className="text-neutral-500"> / </span>
                <span className="text-[#00e5ff]">cage the beast</span>.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-400">
                Vyra is a reborn Goats-vs-Tigers arena: a 23-node graph, four
                ritual abilities, and real-time duels. Every decision tilts the
                board — one wrong slide and the pack closes in.
              </p>
              <div className="mt-8 flex items-center gap-3">
                <Link
                  to="/register"
                  data-testid="cta-primary"
                  className="group flex items-center gap-2 rounded-md border border-[#00e5ff] bg-[#00e5ff]/5 px-5 py-3 font-head text-sm uppercase tracking-[0.2em] text-[#00e5ff] transition hover:bg-[#00e5ff]/15"
                >
                  Enter the arena
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/login"
                  data-testid="cta-secondary"
                  className="rounded-md border border-[#2a2a2a] px-5 py-3 font-head text-sm uppercase tracking-[0.2em] text-neutral-300 transition hover:border-[#ff3366] hover:text-[#ff3366]"
                >
                  I have an account
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                {[
                  ["15 Goats", "#00e5ff"],
                  ["3 Tigers", "#ff3366"],
                  ["6 to Win", "#ffd700"],
                  ["ELO Ranked", "#39ff14"],
                ].map(([t, c]) => (
                  <span
                    key={t}
                    className="vyra-chip"
                    style={{ borderColor: c, color: c }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Decorative board preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative lg:col-span-5"
          >
            <div className="vyra-card relative aspect-[4/5] overflow-hidden p-6">
              <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
              <svg
                viewBox="0 0 300 380"
                className="relative z-10 h-full w-full"
              >
                <g stroke="#2a2a2a" strokeWidth="1.5" fill="none">
                  <line x1="150" y1="30" x2="40" y2="200" />
                  <line x1="150" y1="30" x2="260" y2="200" />
                  <line x1="40" y1="200" x2="260" y2="200" />
                  <line x1="95" y1="115" x2="205" y2="115" />
                  <line x1="70" y1="157" x2="230" y2="157" />
                  <line x1="40" y1="200" x2="150" y2="300" />
                  <line x1="260" y1="200" x2="150" y2="300" />
                  <line x1="150" y1="300" x2="90" y2="350" />
                  <line x1="150" y1="300" x2="210" y2="350" />
                </g>
                {/* Tigers */}
                <circle cx="150" cy="30" r="14" fill="#121212" stroke="#ff3366" strokeWidth="2.5" filter="drop-shadow(0 0 10px rgba(255,51,102,0.8))" />
                <circle cx="95" cy="115" r="14" fill="#121212" stroke="#ff3366" strokeWidth="2.5" filter="drop-shadow(0 0 10px rgba(255,51,102,0.8))" />
                <circle cx="205" cy="115" r="14" fill="#121212" stroke="#ff3366" strokeWidth="2.5" filter="drop-shadow(0 0 10px rgba(255,51,102,0.8))" />
                {/* Goats */}
                {[
                  [70, 157],
                  [150, 157],
                  [230, 157],
                  [40, 200],
                  [95, 200],
                  [150, 200],
                  [205, 200],
                  [260, 200],
                  [90, 250],
                  [150, 250],
                  [210, 250],
                  [150, 300],
                ].map(([x, y]) => (
                  <circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r="10"
                    fill="#121212"
                    stroke="#00e5ff"
                    strokeWidth="2"
                    filter="drop-shadow(0 0 8px rgba(0,229,255,0.8))"
                  />
                ))}
              </svg>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3D Board Showcase */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="overline mb-4">· the arena ·</div>
        <h2 className="font-head text-4xl font-bold tracking-tight md:text-5xl mb-4">
          The 23-Node Battleground
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-neutral-400 mb-8">
          Navigate triangular geometry where position is power. Every node connects to 2-6 neighbors — there's nowhere to hide.
        </p>
        <div className="vyra-card relative h-[600px] overflow-hidden p-6">
          <Board3DShowcase />
        </div>
      </section>

      {/* Abilities grid */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="overline">four rituals</div>
        <h2 className="font-head text-4xl font-bold tracking-tight md:text-5xl">
          Abilities, not noise.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-neutral-400">
          Every ritual costs a turn and carries a cooldown — balanced so
          positioning still wins duels. No pay-to-win.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Zap,
              name: "Pounce",
              team: "Tiger",
              c: "#ff3366",
              desc: "Leap two nodes in a line — devour the goat in between.",
              cd: "CD 3",
            },
            {
              icon: Flame,
              name: "Roar",
              team: "Tiger",
              c: "#ff3366",
              desc: "Freeze up to 2 adjacent goats for one turn.",
              cd: "CD 5",
            },
            {
              icon: Shield,
              name: "Fortify",
              team: "Goat",
              c: "#39ff14",
              desc: "Shield a connected triangle of 3 goats from capture.",
              cd: "CD 4",
            },
            {
              icon: Swords,
              name: "Decoy",
              team: "Goat",
              c: "#00e5ff",
              desc: "Drop a phantom blocker on any empty node for one turn.",
              cd: "CD 5",
            },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <motion.div
                whileHover={{ y: -3 }}
                key={a.name}
                className="vyra-card p-5"
                style={{ boxShadow: `0 0 0 1px ${a.c}22` }}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5" style={{ color: a.c }} />
                  <span className="overline" style={{ color: a.c }}>
                    {a.team}
                  </span>
                </div>
                <div className="font-head mt-4 text-2xl" style={{ color: a.c }}>
                  {a.name}
                </div>
                <p className="mt-2 text-xs text-neutral-400">{a.desc}</p>
                <div className="mt-4 font-mono-tech text-xs text-neutral-500">
                  {a.cd}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h3 className="font-head text-4xl font-bold tracking-tight md:text-5xl">
          Your first duel is a room code away.
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm text-neutral-400">
          200 starter coins. ELO 1000. The arena remembers.
        </p>
        <div className="mt-8">
          <Link
            to="/register"
            data-testid="cta-footer"
            className="inline-flex items-center gap-2 rounded-md border border-[#ff3366] bg-[#ff3366]/5 px-6 py-3 font-head text-sm uppercase tracking-[0.2em] text-[#ff3366] transition hover:bg-[#ff3366]/15"
          >
            Create your sigil
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
