// Popup: quick-add in plain English + this month at a glance.

import {
  api, getConfig, hasApiPermission, originPattern,
  currentMonthIST, money, colorFor, esc, CATEGORIES,
} from "./shared.js";

const $ = (id) => document.getElementById(id);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

function show(setup, mainVisible) {
  $("setup").classList.toggle("hidden", !setup);
  $("main").classList.toggle("hidden", !mainVisible);
}

let lastSnapshot = "";
let lastData = null;
let fetching = false;
let editingId = null; // expense being edited inline
let armedDel = null;  // expense whose delete button is armed ("sure?")
let armTimer = null;

async function loadMonth({ silent = false } = {}) {
  if (fetching || editingId || armedDel) return; // don't disturb an interaction
  fetching = true;
  let data;
  try {
    data = await api.list(currentMonthIST());
  } catch (e) {
    if (!silent) setStatus(e.message, "err");
    return;
  } finally {
    fetching = false;
  }

  // Re-render only when something actually changed — keeps the 2s refresh
  // invisible (no flicker, no DOM churn) while the popup sits open.
  const snapshot = JSON.stringify(data);
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;

  const [y, m] = currentMonthIST().split("-").map(Number);
  $("month").textContent = `${MONTH_NAMES[m - 1]} ${y}`;
  const s = data.summary || {};
  $("total").textContent = money(s.grandTotal || 0);

  // Top categories with proportional bars.
  const cats = (s.breakdown || []).slice(0, 4);
  const top = cats[0]?.total || 1;
  $("breakdown").innerHTML =
    "<h3>Where it went</h3>" +
    (cats.length
      ? cats
          .map((r) => {
            const col = colorFor(r.category);
            return `<div class="cat-row">
              <span class="cat-dot" style="background:${col}"></span>
              <span class="cat-name">${esc(r.category)}</span>
              <span class="cat-amt">${money(r.total)} · ${Math.round(r.percentage)}%</span>
              <span class="cat-bar"><i style="width:${Math.max(2, (r.total / top) * 100)}%;background:${col}"></i></span>
            </div>`;
          })
          .join("")
      : '<div class="empty">Nothing logged yet this month.</div>');

  lastData = data;
  renderRecent();
}

function txRow(e) {
  if (e._id === editingId) {
    const opts = CATEGORIES.map(
      (cat) => `<option ${cat === e.category ? "selected" : ""}>${cat}</option>`
    ).join("");
    return `<form class="tx-edit" data-id="${esc(e._id)}">
      <input name="amount" type="number" step="0.01" min="0" value="${esc(e.amount)}" required />
      <input name="item" value="${esc(e.item ?? e.note ?? "")}" placeholder="item" />
      <select name="category">${opts}</select>
      <button class="icon" type="submit" title="Save">✓</button>
      <button class="icon act-cancel" type="button" title="Cancel">✕</button>
    </form>`;
  }
  const day = (e.displayDate || "").slice(0, 5); // DD-MM
  const armed = e._id === armedDel;
  return `<div class="tx-row" data-id="${esc(e._id)}">
    <span class="tx-date">${esc(day)}</span>
    <span class="tx-item"><span style="color:${colorFor(e.category)}">●</span> ${esc(e.item ?? e.note ?? "")}</span>
    <span class="tx-amt">${money(e.amount)}</span>
    <span class="tx-actions">
      <button class="icon act-edit" title="Edit">✎</button>
      <button class="icon act-del${armed ? " armed" : ""}" title="Delete">${armed ? "sure?" : "✕"}</button>
    </span>
  </div>`;
}

function renderRecent() {
  const txns = (lastData?.expenses || []).slice(0, 5);
  $("recent").innerHTML =
    "<h3>Recent</h3>" +
    (txns.length
      ? txns.map(txRow).join("")
      : '<div class="empty">No transactions yet — log one above.</div>');
  if (editingId) $("recent").querySelector(".tx-edit input")?.focus();
}

function refresh() {
  lastSnapshot = ""; // force a re-render with fresh data
  return loadMonth({ silent: true });
}

// Edit / delete actions, delegated so re-renders don't lose handlers.
$("recent").addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  const id = btn.closest("[data-id]")?.dataset.id;
  if (!id) return;

  if (btn.classList.contains("act-edit")) {
    editingId = id;
    armedDel = null;
    renderRecent();
  } else if (btn.classList.contains("act-cancel")) {
    editingId = null;
    renderRecent();
  } else if (btn.classList.contains("act-del")) {
    if (armedDel !== id) {
      // First click arms the button; it disarms itself after a moment.
      armedDel = id;
      renderRecent();
      clearTimeout(armTimer);
      armTimer = setTimeout(() => { armedDel = null; renderRecent(); }, 2500);
      return;
    }
    clearTimeout(armTimer);
    armedDel = null;
    btn.disabled = true;
    try {
      await api.remove(id);
      setStatus("✓ Deleted.", "ok");
    } catch (e) {
      setStatus(e.message, "err");
    }
    await refresh();
  }
});

$("recent").addEventListener("submit", async (ev) => {
  const form = ev.target.closest(".tx-edit");
  if (!form) return;
  ev.preventDefault();
  const amount = Number(form.elements.amount.value);
  if (!Number.isFinite(amount) || amount < 0) return setStatus("Amount must be a positive number.", "err");
  form.querySelectorAll("button, input, select").forEach((el) => (el.disabled = true));
  try {
    await api.update(form.dataset.id, {
      amount,
      item: form.elements.item.value.trim(),
      category: form.elements.category.value,
    });
    setStatus("✓ Updated.", "ok");
  } catch (e) {
    setStatus(e.message, "err");
  }
  editingId = null;
  await refresh();
});

async function init() {
  const { apiBase, token } = await getConfig();

  if (!apiBase || !token) {
    show(true, false);
    $("setup-msg").textContent = "Connect the extension to your expense tracker to get started.";
    return;
  }

  if (!(await hasApiPermission(apiBase))) {
    show(true, false);
    $("setup-msg").textContent = "One more step: allow the extension to reach your API.";
    $("setup-btn").classList.add("hidden");
    const grant = $("grant-btn");
    grant.classList.remove("hidden");
    grant.addEventListener("click", async () => {
      const ok = await chrome.permissions.request({ origins: [originPattern(apiBase)] });
      if (ok) init();
    });
    return;
  }

  show(false, true);
  $("add-input").focus();
  await loadMonth();
  // Live-update while the popup is open (the interval dies with the popup).
  setInterval(() => loadMonth({ silent: true }), 2000);
}

$("add-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = $("add-input");
  const text = input.value.trim();
  if (!text) return;
  const btn = $("add-btn");
  btn.disabled = true;
  setStatus("Saving…");
  try {
    const reply = await api.parse(text);
    setStatus(reply.replace(/\s+/g, " ").trim(), "ok");
    input.value = "";
    await loadMonth();
  } catch (e) {
    setStatus(e.message, "err");
  } finally {
    btn.disabled = false;
    input.focus();
  }
});

for (const id of ["open-options", "setup-btn"]) {
  $(id).addEventListener("click", (ev) => {
    ev.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
