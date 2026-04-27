import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import TopBar from "./components/layout/TopBar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Lobby from "./pages/Lobby";
import GameRoom from "./pages/GameRoom";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="mx-auto max-w-xl p-10 text-center text-sm text-neutral-400">
        Authenticating…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/lobby" replace />;
  return children;
}

function Shell() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route
          path="/"
          element={
            <GuestOnly>
              <Landing />
            </GuestOnly>
          }
        />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <Register />
            </GuestOnly>
          }
        />
        <Route
          path="/lobby"
          element={
            <Protected>
              <Lobby />
            </Protected>
          }
        />
        <Route
          path="/game/:code"
          element={
            <Protected>
              <GameRoom />
            </Protected>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <Protected>
              <Leaderboard />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Shell />
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "#121212",
                border: "1px solid #2a2a2a",
                color: "#f5f5f5",
                fontFamily: "'Chivo', sans-serif",
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
