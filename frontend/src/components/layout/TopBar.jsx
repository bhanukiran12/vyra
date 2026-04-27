import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Coins, Trophy, LogOut, User } from "lucide-react";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-40 border-b border-[#1f1f1f] bg-[#050505]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link
          to={user ? "/lobby" : "/"}
          data-testid="vyra-logo"
          className="flex items-center gap-3 font-head text-2xl font-bold tracking-tight"
        >
          <span className="grid h-9 w-9 place-items-center rounded-md border border-[#ff3366] text-[#ff3366] shadow-[0_0_18px_rgba(255,51,102,0.35)]">
            V
          </span>
          <span>VYRA</span>
          <span className="overline ml-2 hidden sm:block">
            goats · vs · tigers
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/leaderboard"
              data-testid="nav-leaderboard"
              className="hidden items-center gap-2 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-neutral-300 transition hover:border-[#00e5ff] hover:text-[#00e5ff] sm:flex"
            >
              <Trophy className="h-4 w-4" /> Leaderboard
            </Link>
            <Link
              to="/profile"
              data-testid="nav-profile"
              className="hidden items-center gap-2 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-neutral-300 transition hover:border-[#00e5ff] hover:text-[#00e5ff] sm:flex"
            >
              <User className="h-4 w-4" /> {user.username}
            </Link>
            <div
              className="vyra-chip"
              data-testid="coin-balance"
              title="Vyra coins"
            >
              <Coins className="h-3.5 w-3.5 text-[#ffd700]" />
              <span className="font-mono-tech">{user.coins}</span>
            </div>
            <div
              className="vyra-chip"
              data-testid="rating-balance"
              title="ELO rating"
            >
              <Trophy className="h-3.5 w-3.5 text-[#00e5ff]" />
              <span className="font-mono-tech">{user.rating}</span>
            </div>
            <button
              data-testid="logout-button"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="flex items-center gap-2 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-neutral-400 transition hover:border-[#ff3366] hover:text-[#ff3366]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              data-testid="nav-login"
              className="rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-neutral-300 hover:border-[#00e5ff] hover:text-[#00e5ff]"
            >
              Log in
            </Link>
            <Link
              to="/register"
              data-testid="nav-register"
              className="rounded-md border border-[#00e5ff] px-3 py-1.5 text-sm text-[#00e5ff] shadow-[0_0_18px_rgba(0,229,255,0.25)] hover:bg-[#00e5ff]/10"
            >
              Enter Vyra
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
