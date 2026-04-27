import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("vyra_token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("vyra_token");
  }
}

const existing = localStorage.getItem("vyra_token");
if (existing) {
  api.defaults.headers.common.Authorization = `Bearer ${existing}`;
}

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export function wsUrl(code) {
  const token = localStorage.getItem("vyra_token") || "";
  const url = new URL(BACKEND_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/ws/${code}`;
  url.searchParams.set("token", token);
  return url.toString();
}
