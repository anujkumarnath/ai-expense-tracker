// Thin HTTP client around the Worker API. Adds auth, timeout, and clean errors.

import { settings } from "./config.js";

export class ApiError extends Error {
  constructor(message, { status, hint } = {}) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

async function call(method, path, { body, raw = false, auth = true, timeout = 20000 } = {}) {
  const { apiBase, token } = settings();
  if (!apiBase) {
    throw new ApiError("API base URL is not set.", {
      hint: "Run `exp config`, or set EXPENSE_API_BASE.",
    });
  }
  if (auth && !token) {
    throw new ApiError("Not signed in.", {
      hint: "Run `exp config` to set your API token, or export EXPENSE_TOKEN.",
    });
  }

  const headers = {};
  if (auth) headers["Authorization"] = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    if (typeof body === "string") {
      headers["Content-Type"] = "text/plain";
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: payload,
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new ApiError(`Request timed out after ${timeout / 1000}s`, {
        hint: "Check your connection or the API base in `exp config`.",
      });
    }
    throw new ApiError(`Network error: ${err.message}`, {
      hint: `Is the API reachable? Base: ${apiBase}`,
    });
  }
  clearTimeout(timer);

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const msg = isJson ? data.error || JSON.stringify(data) : data || res.statusText;
    let hint;
    if (res.status === 401) hint = "Session expired or token rejected. Run `exp login` (or `exp config`).";
    if (res.status === 404) hint = undefined;
    throw new ApiError(String(msg).trim(), { status: res.status, hint });
  }
  return raw ? String(data) : data;
}

export const api = {
  health: () => call("GET", "/health?check=db", { auth: false }),
  googleAuth: (idToken) => call("POST", "/auth/google", { body: { idToken }, auth: false }),
  parse: (text) => call("POST", "/parse", { body: text, raw: true }),
  list: (qs) => call("GET", `/expenses${qs ? "?" + qs : ""}`),
  create: (body) => call("POST", "/expenses", { body }),
  update: (id, body) => call("PUT", `/expenses/${id}`, { body }),
  remove: (id) => call("DELETE", `/expenses/${id}`),
  getReport: (month) => call("GET", `/reports/${month}`),
  genReport: (month) => call("POST", `/reports/${month}`),
};
