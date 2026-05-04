import axios from "axios";

function resolveBackendUrl() {
  const configured = process.env.REACT_APP_BACKEND_URL;
  if (configured) return configured;

  if (typeof window === "undefined") return "";

  // Render static sites often need to talk to a separate backend service.
  // Fall back to the backend service host when no explicit env var is present.
  if (window.location.hostname.endsWith(".onrender.com")) {
    return "https://vyra-backend.onrender.com";
  }

  return window.location.origin;
}

const BACKEND_URL = resolveBackendUrl();
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

  // If backend URL is relative or same-origin, use the current page origin.
  // Otherwise, build the websocket URL directly from the configured backend host.
  if (!BACKEND_URL || BACKEND_URL === "/" || BACKEND_URL === window.location.origin) {
    const url = new URL(window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/api/ws/${code}`;
    url.search = "";
    url.searchParams.set("token", token);
    url.hash = "";
    return url.toString();
  }
  
  // Otherwise, construct WebSocket URL from explicit backend URL
  const url = new URL(BACKEND_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/ws/${code}`;
  url.searchParams.set("token", token);
  return url.toString();
}
