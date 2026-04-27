# Vyra — Product Requirements

## Problem
Build Vyra: a real-time multiplayer strategy game inspired by Aadu Puli Aatam (Goats vs Tigers) with abilities, economy (coins), ELO leaderboard, and clean modern graphics on a dark neon aesthetic.

## Tech
FastAPI (Python) + MongoDB + WebSockets · React + Tailwind + Zustand + Framer Motion · JWT auth.

## Personas
- Casual duelist — wants to jump into a private match with a friend via a room code.
- Ranked grinder — wants to climb the ELO leaderboard and earn coins.

## Core Requirements
- Two phases: Placement (goats deploy 15) → Movement (both move, tigers capture by jumping).
- Win: tigers at 6 captures; goats by immobilizing all tigers.
- Abilities with cooldowns — Pounce (tiger, cd3), Roar (tiger, cd5), Fortify (goat, cd4), Decoy (goat, cd5). Max 1 ability per turn.
- JWT auth (register/login/me/logout), private room by code, live WebSocket sync, reconnect, toasts.
- Economy: +100 coins win, +20 loss. ELO ±25 per match. Starter: 200 coins, 1000 rating.

## Implemented (Feb 2026)
- Backend: server.py, auth.py, db.py, models.py, board.py, game_engine.py, routes_auth.py, routes_game.py, ws_manager.py
- Frontend: AuthContext, gameStore (Zustand), api client, WS client, Board SVG, StatsPanel, AbilityPanel, EventLog
- Pages: Landing, Login, Register, Lobby (create + join + leaderboard snapshot), GameRoom (WS-driven), Leaderboard, Profile (coins/rating/win/loss + match history)
- End-to-end playable: place, move, capture, all 4 abilities, match finalization, coin + ELO + match history updates.

## Deferred (P1/P2)
- Matchmaking queue / public quick-play
- Spectator / replay system
- Emote chat + in-room chat
- Daily quests / cosmetic skins for pieces
- Mobile responsive polish
- Accessibility (keyboard navigation of the board)

## Next Tasks
- Add Play vs Bot mode
- Consider ranked seasons and reset cadence
