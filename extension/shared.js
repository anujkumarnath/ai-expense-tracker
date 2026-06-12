// Shared between popup, options and the background worker: config storage,
// a thin API client (same Worker endpoints the CLI and dashboard use), and
// small formatting helpers. Zero dependencies, plain ES modules.

export async function getConfig() {
  const { apiBase = "", token = "" } = await chrome.storage.local.get(["apiBase", "token"]);
  return { apiBase: apiBase.replace(/\/+$/, ""), token };
}

export const originPattern = (apiBase) => new URL(apiBase).origin + "/*";

// Has the user granted us permission to call the configured API origin?
export async function hasApiPermission(apiBase) {
  if (!apiBase) return false;
  try {
    return await chrome.permissions.contains({ origins: [originPattern(apiBase)] });
  } catch {
    return false;
  }
}

export async function call(method, path, { body, raw = false, auth = true } = {}) {
  const { apiBase, token } = await getConfig();
  if (!apiBase) throw new Error("API base URL is not set — open the extension settings.");
  if (auth && !token) throw new Error("No token set — open the extension settings.");

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

  let res;
  try {
    res = await fetch(`${apiBase}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error("Network error — is the API reachable (and access granted in settings)?");
  }

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    let msg = isJson ? data.error || JSON.stringify(data) : data || res.statusText;
    if (res.status === 401) msg = "Token rejected or expired — update it in settings.";
    throw new Error(String(msg).trim());
  }
  return raw ? String(data) : data;
}

export const api = {
  health: () => call("GET", "/health?check=db", { auth: false }),
  parse: (text) => call("POST", "/parse", { body: text, raw: true }),
  list: (month) => call("GET", `/expenses?month=${month}`),
  update: (id, body) => call("PUT", `/expenses/${id}`, { body }),
  remove: (id) => call("DELETE", `/expenses/${id}`),
};

export const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Health",
  "Entertainment", "Groceries", "Subscriptions", "Investment", "Other",
];

// Everything in this app is IST (UTC+5:30), matching the server.
export function currentMonthIST() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
export const money = (n) => "₹" + inr.format(Number(n) || 0);

// Same palette as the dashboard, so categories look identical everywhere.
const CATEGORY_COLORS = {
  Food: "#ff7a59", Transport: "#4f8cff", Shopping: "#c678dd", Bills: "#e5c07b",
  Health: "#56d364", Entertainment: "#ff6b9d", Groceries: "#3fb6b6",
  Subscriptions: "#9d7bff", Investment: "#3fb950", Other: "#8b949e",
};
export const colorFor = (c) => CATEGORY_COLORS[c] || "#8b949e";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}
