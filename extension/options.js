// Options: store apiBase + token, ask for host permission for that origin
// (which lets extension fetches bypass the Worker's locked CORS), then verify
// connectivity and the token in one go.

import { api, originPattern, currentMonthIST } from "./shared.js";

const $ = (id) => document.getElementById(id);

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

async function load() {
  const { apiBase = "", token = "" } = await chrome.storage.local.get(["apiBase", "token"]);
  $("apiBase").value = apiBase;
  $("token").value = token;
}

$("save").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim().replace(/\/+$/, "");
  const token = $("token").value.trim();

  let origin;
  try {
    origin = originPattern(apiBase);
  } catch {
    return setStatus("That doesn't look like a valid URL.", "err");
  }
  if (!token) return setStatus("Token is required.", "err");

  // Host permission must be requested from a user gesture — this click.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return setStatus("Permission denied — the extension can't reach the API without it.", "err");

  await chrome.storage.local.set({ apiBase, token });

  setStatus("Testing…");
  try {
    await api.health();
    await api.list(currentMonthIST()); // exercises auth
    setStatus("✓ Connected — API and token both check out.", "ok");
  } catch (e) {
    setStatus("✗ " + e.message, "err");
  }
});

load();
