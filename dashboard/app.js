// Expense Tracker dashboard SPA.
// Routes: /login, /dashboard, /report/:month  (history API + _redirects fallback)

const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
const TOKEN_KEY = "et_token";

const CATEGORIES = ["Food","Transport","Shopping","Bills","Health","Entertainment","Groceries","Subscriptions","Investment","Other"];
const SOURCES = ["Cash","UPI","Credit Card","Amazon Pay","GPay","PhonePe","Debit Card","Other"];

// Consistent colors across charts + table badges, keyed by category.
const CATEGORY_COLORS = {
  Food: "#ff7a59", Transport: "#4f8cff", Shopping: "#c678dd", Bills: "#e5c07b",
  Health: "#56d364", Entertainment: "#ff6b9d", Groceries: "#3fb6b6",
  Subscriptions: "#9d7bff", Investment: "#3fb950", Other: "#8b949e",
};
const colorFor = (c) => CATEGORY_COLORS[c] || "#8b949e";

// ---------- token ----------
const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ---------- helpers ----------
const app = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
// item value, falling back to the legacy `note` field on older records
const itemOf = (e) => e.item ?? e.note ?? "";

// current month YYYY-MM in IST, regardless of viewer timezone
function currentMonthIST() {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------- API ----------
async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      ...(opts.body ? { "content-type": "application/json" } : {}),
      Authorization: "Bearer " + getToken(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    navigate("/login");
    throw new Error("Unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- router ----------
let refreshTimer = null;
let charts = [];

function cleanup() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  charts.forEach((c) => c.destroy());
  charts = [];
}

function navigate(path) {
  history.pushState({}, "", path);
  route();
}

function route() {
  cleanup();
  const path = location.pathname;
  const authed = !!getToken();

  if (path === "/login") return renderLogin();
  if (!authed) return navigate("/login");

  if (path === "/" || path === "/dashboard") return renderDashboard();

  const m = path.match(/^\/report\/(\d{4}-\d{2})$/);
  if (m) return renderReport(m[1]);

  // unknown -> dashboard
  return navigate("/dashboard");
}

window.addEventListener("popstate", route);
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a) { e.preventDefault(); navigate(a.getAttribute("href")); }
});

// ---------- login ----------
function renderLogin() {
  if (getToken()) return navigate("/dashboard");
  // Break-glass token field is hidden unless ?token is in the URL.
  const showToken = new URLSearchParams(location.search).has("token");

  app().innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h1>Expense Tracker</h1>
        <p>Sign in to continue.</p>
        <div id="gbtn"></div>
        <div class="login-error" id="login-error"></div>
        ${showToken ? `
        <hr style="border-color:var(--border);margin:18px 0" />
        <form id="token-form">
          <input type="password" id="token" placeholder="Access token (fallback)" autocomplete="current-password" />
          <div style="height:10px"></div>
          <button class="btn btn-primary" type="submit">Sign in with token</button>
        </form>` : ""}
      </div>
    </div>`;

  if (showToken) {
    document.getElementById("token-form").addEventListener("submit", (e) => {
      e.preventDefault();
      tokenLogin(document.getElementById("token").value);
    });
    // Allow /login?token=<value> to log in directly (break-glass).
    const preset = new URLSearchParams(location.search).get("token");
    if (preset) tokenLogin(preset);
  }

  initGoogle();
}

async function tokenLogin(raw) {
  const token = (raw || "").trim();
  const errEl = document.getElementById("login-error");
  if (errEl) errEl.textContent = "";
  if (!token) { if (errEl) errEl.textContent = "Token required."; return; }
  setToken(token);
  try {
    await api("/expenses?month=" + currentMonthIST());
    history.replaceState({}, "", "/login"); // strip token from the URL
    navigate("/dashboard");
  } catch (err) {
    clearToken();
    if (errEl) errEl.textContent = err.message === "Unauthorized" ? "Invalid token." : err.message;
  }
}

function initGoogle() {
  const setErr = (m) => { const el = document.getElementById("login-error"); if (el) el.textContent = m; };
  if (!window.GOOGLE_CLIENT_ID) { setErr("Google sign-in not configured (GOOGLE_CLIENT_ID)."); return; }

  let tries = 0;
  const t = setInterval(() => {
    if (window.google?.accounts?.id) {
      clearInterval(t);
      google.accounts.id.initialize({ client_id: window.GOOGLE_CLIENT_ID, callback: onGoogleCredential });
      const el = document.getElementById("gbtn");
      if (el) google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", text: "signin_with", shape: "pill", width: 280 });
    } else if (++tries > 50) {
      clearInterval(t);
      setErr("Couldn't load Google sign-in.");
    }
  }, 100);
}

async function onGoogleCredential(resp) {
  const errEl = document.getElementById("login-error");
  if (errEl) errEl.textContent = "Signing in…";
  try {
    const r = await fetch(API_BASE + "/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: resp.credential }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Sign-in failed");
    setToken(data.token);
    navigate("/dashboard");
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
}

// ---------- dashboard ----------
const PAGE_SIZE = 10;
const state = {
  view: { mode: "month", month: currentMonthIST(), from: "", to: "" },
  page: 1,
  data: null,
};

const pad2 = (n) => String(n).padStart(2, "0");
const istNow = () => new Date(Date.now() + 5.5 * 3600 * 1000);
const ymdOf = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const todayYmd = () => ymdOf(istNow());
const shiftDays = (n) => ymdOf(new Date(istNow().getTime() + n * 86400000));

const queryFor = (v) => (v.mode === "range" ? `from=${v.from}&to=${v.to}` : `month=${v.month}`);
const reportMonthFor = (v) => (v.mode === "range" ? v.to.slice(0, 7) : v.month);

const SOURCE_DATALIST = `<datalist id="source-list">${SOURCES.map((s) => `<option value="${s}">`).join("")}</datalist>`;

function renderDashboard() {
  const v = state.view;
  app().innerHTML = `
    <div class="container">
      <div class="topbar">
        <h1>Dashboard</h1>
        <div class="topbar-actions">
          <button class="btn btn-sm btn-primary" id="add-btn" style="width:auto">+ Add</button>
          <a class="btn btn-sm" id="view-report" href="/report/${reportMonthFor(v)}" data-link>Report</a>
          <button class="btn btn-sm" id="logout">Logout</button>
        </div>
      </div>

      <div class="controls">
        <label class="ctrl">Month
          <input type="month" id="month-picker" value="${v.month}" />
        </label>
        <span class="ctrl-or">or range</span>
        <input type="date" id="from" value="${v.from}" />
        <span class="ctrl-arrow">→</span>
        <input type="date" id="to" value="${v.to}" />
        <button class="btn btn-sm" data-range="mtd">MTD</button>
        <button class="btn btn-sm" data-range="7">7d</button>
        <button class="btn btn-sm" data-range="30">30d</button>
      </div>

      <div id="summary"></div>
      <div id="charts"></div>
      <div id="txns"><div class="loading">Loading…</div></div>
    </div>`;

  document.getElementById("logout").addEventListener("click", () => {
    clearToken();
    window.google?.accounts?.id?.disableAutoSelect?.();
    navigate("/login");
  });
  document.getElementById("add-btn").addEventListener("click", openAddModal);

  document.getElementById("month-picker").addEventListener("change", (e) => {
    state.view = { mode: "month", month: e.target.value || currentMonthIST(), from: "", to: "" };
    state.page = 1;
    syncControls();
    loadDashboard();
  });

  const applyRange = () => {
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    if (!from || !to) return;
    state.view = { mode: "range", month: state.view.month, from, to };
    state.page = 1;
    syncControls();
    loadDashboard();
  };
  document.getElementById("from").addEventListener("change", applyRange);
  document.getElementById("to").addEventListener("change", applyRange);

  document.querySelectorAll("[data-range]").forEach((b) =>
    b.addEventListener("click", () => {
      const r = b.getAttribute("data-range");
      const to = todayYmd();
      const from = r === "mtd" ? currentMonthIST() + "-01" : shiftDays(-(Number(r) - 1));
      state.view = { mode: "range", month: state.view.month, from, to };
      state.page = 1;
      syncControls();
      loadDashboard();
    })
  );

  loadDashboard();
  refreshTimer = setInterval(loadDashboard, 30000); // auto-refresh
}

function syncControls() {
  const v = state.view;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set("month-picker", v.month);
  set("from", v.from);
  set("to", v.to);
  const rep = document.getElementById("view-report");
  if (rep) rep.setAttribute("href", "/report/" + reportMonthFor(v));
}

async function loadDashboard() {
  try {
    state.data = await api("/expenses?" + queryFor(state.view));
  } catch (err) {
    if (err.message === "Unauthorized") return;
    const t = document.getElementById("txns");
    if (t) t.innerHTML = `<div class="panel"><div class="empty">${esc(err.message)}</div></div>`;
    return;
  }
  renderSummary();
  renderCharts();
  renderTxns();
}

function renderSummary() {
  const d = state.data;
  const s = d.summary;
  const el = document.getElementById("summary");
  if (!el) return;
  el.innerHTML = `
    <div class="cards">
      <div class="card">
        <div class="label">Total spent</div>
        <div class="value">${inr(s.grandTotal)}</div>
        <div class="sub">${esc(d.range.start)} – ${esc(d.range.end)} · ${d.days}d</div>
      </div>
      <div class="card"><div class="label">Transactions</div><div class="value">${s.transactionCount}</div></div>
      <div class="card"><div class="label">Biggest category</div><div class="value">${esc(s.topCategory)}</div></div>
      <div class="card"><div class="label">Daily average</div><div class="value">${inr(s.avgPerDay)}</div></div>
    </div>`;
}

function renderCharts() {
  const s = state.data.summary;
  const el = document.getElementById("charts");
  if (!el) return;
  charts.forEach((c) => c.destroy());
  charts = [];
  el.innerHTML = `
    <div class="charts">
      <div class="panel"><h2>Spend by category</h2><div class="chart-box"><canvas id="donut"></canvas></div></div>
      <div class="panel"><h2>Daily trend</h2><div class="chart-box"><canvas id="bar"></canvas></div></div>
    </div>`;
  drawDonut("donut", s.breakdown);
  drawBar("bar", s.dailyTrend);
}

function renderTxns() {
  const el = document.getElementById("txns");
  if (!el) return;
  const all = state.data.expenses;
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (state.page > pages) state.page = pages;
  const startIdx = (state.page - 1) * PAGE_SIZE;
  const slice = all.slice(startIdx, startIdx + PAGE_SIZE);

  el.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>Transactions (${all.length})</h2></div>
      <div class="table-wrap">${
        all.length
          ? txnTable(slice.map((e) => txnRow(e, true)), true)
          : `<div class="empty">No transactions in this range.</div>`
      }</div>
      ${all.length ? pager(state.page, pages) : ""}
    </div>`;

  el.querySelectorAll("[data-page]").forEach((b) =>
    b.addEventListener("click", () => { state.page = Number(b.getAttribute("data-page")); renderTxns(); })
  );
  const byId = Object.fromEntries(all.map((e) => [e._id, e]));
  el.querySelectorAll("tr[data-id]").forEach((tr) => {
    const id = tr.getAttribute("data-id");
    tr.querySelector(".act-edit")?.addEventListener("click", () => openEditModal(byId[id]));
    tr.querySelector(".act-del")?.addEventListener("click", () => deleteExpense(byId[id]));
  });
}

function pager(page, pages) {
  return `<div class="pager">
    <button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Prev</button>
    <span class="pager-info">Page ${page} of ${pages}</span>
    <button class="btn btn-sm" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button>
  </div>`;
}

function txnRow(e, withActions) {
  return `<tr data-id="${esc(e._id)}">
    <td>${esc(e.displayDate)}</td>
    <td class="item-cell">${esc(itemOf(e))}</td>
    <td><span class="badge" style="background:${colorFor(e.category)}">${esc(e.category)}</span></td>
    <td class="amount">${inr(e.amount)}</td>
    <td>${esc(e.source)}</td>
    ${withActions ? `<td><div class="row-actions">
      <button class="btn btn-sm act-edit">Edit</button>
      <button class="btn btn-sm btn-danger act-del">Del</button>
    </div></td>` : ""}
  </tr>`;
}

function txnTable(rowsHtmlArr, withActions) {
  return `<table>
    <thead><tr>
      <th>Date</th><th>Item(s)</th><th>Category</th><th class="amount">Amount</th><th>Source</th>
      ${withActions ? "<th>Actions</th>" : ""}
    </tr></thead>
    <tbody>${rowsHtmlArr.join("")}</tbody>
  </table>`;
}

async function deleteExpense(e) {
  if (!confirm(`Delete this transaction?\n\n${e.displayDate} · ${itemOf(e)} · ${inr(e.amount)}`)) return;
  try {
    await api("/expenses/" + e._id, { method: "DELETE" });
    loadDashboard();
  } catch (err) {
    if (err.message !== "Unauthorized") alert(err.message);
  }
}

function openAddModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h2>Add transaction</h2>
      <label>Date</label>
      <input type="date" id="a-date" value="${todayYmd()}" />
      <label>Amount (₹)</label>
      <input type="number" id="a-amount" step="0.01" min="0" placeholder="0" autofocus />
      <label>Category</label>
      <select id="a-category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
      <label>Item(s)</label>
      <input type="text" id="a-item" placeholder="e.g. biscuits, milk" />
      <label>Source</label>
      <input type="text" id="a-source" list="source-list" placeholder="e.g. Amazon ICICI Card" />
      ${SOURCE_DATALIST}
      <div class="modal-actions">
        <button class="btn" id="a-cancel">Cancel</button>
        <button class="btn btn-primary" id="a-save">Add</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) close(); });
  backdrop.querySelector("#a-cancel").addEventListener("click", close);
  backdrop.querySelector("#a-save").addEventListener("click", async () => {
    const amount = parseFloat(backdrop.querySelector("#a-amount").value);
    if (!(amount >= 0)) { alert("Enter a valid amount."); return; }
    const body = {
      date: backdrop.querySelector("#a-date").value,
      amount,
      category: backdrop.querySelector("#a-category").value,
      item: backdrop.querySelector("#a-item").value,
      source: backdrop.querySelector("#a-source").value || "Other",
    };
    try {
      await api("/expenses", { method: "POST", body: JSON.stringify(body) });
      close();
      state.page = 1;
      loadDashboard();
    } catch (err) {
      if (err.message !== "Unauthorized") alert(err.message);
    }
  });
}

function openEditModal(e) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h2>Edit transaction</h2>
      <label>Amount (₹)</label>
      <input type="number" id="m-amount" step="0.01" min="0" value="${esc(e.amount)}" />
      <label>Category</label>
      <select id="m-category">${CATEGORIES.map((c) => `<option ${c===e.category?"selected":""}>${c}</option>`).join("")}</select>
      <label>Item(s)</label>
      <input type="text" id="m-item" value="${esc(itemOf(e))}" />
      <label>Source</label>
      <input type="text" id="m-source" list="source-list" value="${esc(e.source)}" placeholder="e.g. Amazon ICICI Card" />
      ${SOURCE_DATALIST}
      <div class="modal-actions">
        <button class="btn" id="m-cancel">Cancel</button>
        <button class="btn btn-primary" id="m-save">Save</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) close(); });
  backdrop.querySelector("#m-cancel").addEventListener("click", close);
  backdrop.querySelector("#m-save").addEventListener("click", async () => {
    const patch = {
      amount: parseFloat(backdrop.querySelector("#m-amount").value),
      category: backdrop.querySelector("#m-category").value,
      item: backdrop.querySelector("#m-item").value,
      source: backdrop.querySelector("#m-source").value,
    };
    try {
      await api("/expenses/" + e._id, { method: "PUT", body: JSON.stringify(patch) });
      close();
      loadDashboard();
    } catch (err) {
      if (err.message !== "Unauthorized") alert(err.message);
    }
  });
}

// ---------- charts ----------
function drawDonut(canvasId, breakdown) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || !window.Chart) return;
  const labels = breakdown.map((b) => b.category);
  charts.push(new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: breakdown.map((b) => b.total), backgroundColor: labels.map(colorFor), borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { color: "#9aa4b2", boxWidth: 12, padding: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${inr(c.parsed)}` } },
      },
    },
  }));
}

function drawBar(canvasId, dailyTrend) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || !window.Chart) return;
  charts.push(new Chart(ctx, {
    type: "bar",
    data: {
      labels: dailyTrend.map((d) => d.date.slice(0, 5)), // DD-MM
      datasets: [{ data: dailyTrend.map((d) => d.total), backgroundColor: "#4f8cff", borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => inr(c.parsed.y) } } },
      scales: {
        x: { ticks: { color: "#9aa4b2", maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { ticks: { color: "#9aa4b2" }, grid: { color: "#2a2f37" } },
      },
    },
  }));
}

// ---------- report ----------
async function renderReport(month) {
  app().innerHTML = `<div class="report"><div class="loading">Loading report…</div></div>`;

  let report;
  try {
    report = await api("/reports/" + month);
  } catch (err) {
    if (err.message === "Unauthorized") return;
    // most likely not generated yet -> offer to generate
    app().innerHTML = `
      <div class="report">
        <a class="btn btn-sm no-print" href="/dashboard" data-link>← Back</a>
        <div class="empty">
          <p>No report exists for ${esc(month)} yet.</p>
          <button class="btn btn-primary" id="gen" style="max-width:240px;margin:0 auto">Generate report</button>
        </div>
      </div>`;
    document.getElementById("gen")?.addEventListener("click", async () => {
      try { await api("/reports/" + month, { method: "POST" }); renderReport(month); }
      catch (e2) { if (e2.message !== "Unauthorized") alert(e2.message); }
    });
    return;
  }

  // also pull the month's transactions for the full table
  let expenses = [];
  try { expenses = (await api("/expenses?month=" + month)).expenses; } catch { /* keep report */ }

  const genDate = new Date(report.generatedAt);
  const genStr = `${String(genDate.getUTCDate()).padStart(2,"0")}-${String(genDate.getUTCMonth()+1).padStart(2,"0")}-${genDate.getUTCFullYear()}`;

  app().innerHTML = `
    <div class="report">
      <div class="report-header">
        <div>
          <h1>Expense Report — ${esc(report.displayMonth)}</h1>
          <div class="gen">Generated ${esc(genStr)}</div>
        </div>
        <div class="topbar-actions no-print">
          <a class="btn btn-sm" href="/dashboard" data-link>← Dashboard</a>
          <button class="btn btn-sm" id="regen">Regenerate</button>
          <button class="btn btn-primary" id="print" style="width:auto">Print / PDF</button>
        </div>
      </div>

      <div class="report-section">
        <h2>Executive summary</h2>
        <div class="exec-grid">
          <div class="card"><div class="label">Total</div><div class="value">${inr(report.grandTotal)}</div></div>
          <div class="card"><div class="label">Transactions</div><div class="value">${report.transactionCount}</div></div>
          <div class="card"><div class="label">Avg / day</div><div class="value">${inr(report.avgPerDay)}</div></div>
          <div class="card"><div class="label">Top category</div><div class="value">${esc(report.topCategory)}</div></div>
          <div class="card"><div class="label">Top source</div><div class="value">${esc(report.topSource)}</div></div>
        </div>
      </div>

      <div class="report-section">
        <div class="charts">
          <div class="panel">
            <h2>Category breakdown</h2>
            <div class="chart-box"><canvas id="r-donut"></canvas></div>
          </div>
          <div class="panel">
            <h2>Daily spending trend</h2>
            <div class="chart-box"><canvas id="r-bar"></canvas></div>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h2>Category breakdown</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Transactions</th><th class="amount">Amount</th><th class="amount">% of total</th></tr></thead>
            <tbody>${report.breakdown.map((b) => `
              <tr>
                <td><span class="badge" style="background:${colorFor(b.category)}">${esc(b.category)}</span></td>
                <td>${b.count}</td>
                <td class="amount">${inr(b.total)}</td>
                <td class="amount">${b.percentage}%</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="report-section">
        <h2>All transactions</h2>
        <div class="table-wrap">${
          expenses.length
            ? txnTable(expenses.map((e) => txnRow(e, false)), false)
            : `<div class="empty">No transactions.</div>`
        }</div>
      </div>
    </div>`;

  document.getElementById("print").addEventListener("click", () => window.print());
  document.getElementById("regen").addEventListener("click", async () => {
    try { await api("/reports/" + month, { method: "POST" }); renderReport(month); }
    catch (e2) { if (e2.message !== "Unauthorized") alert(e2.message); }
  });

  drawDonut("r-donut", report.breakdown);
  drawBar("r-bar", report.dailyTrend);
}

// ---------- boot ----------
route();
