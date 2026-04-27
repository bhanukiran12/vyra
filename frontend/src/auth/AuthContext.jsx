import React, { createContext, useContext, useEffect } from "react";
import { api, setAuthToken } from "../lib/api";
import { useAuthStore } from "../store/gameStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const existing = localStorage.getItem("vyra_token");
    if (!existing) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [setUser, setLoading]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, username) => {
    const { data } = await api.post("/auth/register", {
      email,
      password,
      username,
    });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (_) {}
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
