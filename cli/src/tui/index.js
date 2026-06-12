// TUI runtime: owns state, keybindings and data flow. Rendering is delegated
// to the pure frame() in views.js; terminal I/O to term.js.
//
// Keys follow vim and "normal" conventions side by side: hjkl/arrows, gg/G,
// ctrl-d/u, / to filter, plus tab-switching, an add bar, an edit modal and a
// help overlay. See helpBox() in views.js for the full map.

import { api } from "../api.js";
import { settings } from "../config.js";
import { currentMonth, refOf } from "../helpers.js";
import { c, money } from "../ui.js";
import { openScreen } from "./term.js";
import { frame, shiftMonth, txPageSize, visibleExpenses } from "./views.js";

// Minimal line editor over { text, cur }. Returns true if the key was handled.
function editText(buf, str, key) {
  const k = key.name;
  if (k === "left") buf.cur = Math.max(0, buf.cur - 1);
  else if (k === "right") buf.cur = Math.min(buf.text.length, buf.cur + 1);
  else if (k === "home" || (key.ctrl && k === "a")) buf.cur = 0;
  else if (k === "end" || (key.ctrl && k === "e")) buf.cur = buf.text.length;
  else if (k === "backspace") {
    if (buf.cur > 0) {
      buf.text = buf.text.slice(0, buf.cur - 1) + buf.text.slice(buf.cur);
      buf.cur--;
    }
  } else if (k === "delete") {
    buf.text = buf.text.slice(0, buf.cur) + buf.text.slice(buf.cur + 1);
  } else if (key.ctrl && k === "u") {
    buf.text = buf.text.slice(buf.cur);
    buf.cur = 0;
  } else if (key.ctrl && k === "w") {
    const head = buf.text.slice(0, buf.cur).replace(/\S+\s*$/, "");
    buf.text = head + buf.text.slice(buf.cur);
    buf.cur = head.length;
  } else if (str && !key.ctrl && !key.meta && str >= " ") {
    buf.text = buf.text.slice(0, buf.cur) + str + buf.text.slice(buf.cur);
    buf.cur += str.length;
  } else {
    return false;
  }
  return true;
}

export async function runTui() {
  const { token, apiBase } = settings();
  if (!token || !apiBase) {
    console.log(
      `\n  ${c.yellow("●")} Sign in first: ${c.cyan("exp login")} (Google) or ${c.cyan("exp config")} (token).\n`
    );
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    // Non-interactive (piped/CI): fall back to the static dashboard.
    const { run: home } = await import("../commands/home.js");
    return home();
  }

  const state = {
    tab: "overview", // overview | tx | report
    month: currentMonth(),
    data: null,
    loading: false,
    error: null,
    spin: 0,
    sel: 0,
    filter: "",
    sortAmount: false,
    mode: "view", // view | add | search | confirm | edit | help
    input: { text: "", cur: 0 },
    edit: null,
    reports: {}, // month → { doc } | { notFound: true } | { error }
    message: c.dim("Press ? for keys — a to add, tab for transactions."),
    pendingG: false,
  };

  const screen = openScreen();
  const render = () => {
    const { W, H } = screen.size();
    const f = frame(state, W, H);
    screen.paint(f.lines, f.cursor);
  };

  // Refcounted spinner: data and report fetches can overlap.
  let spinTimer = null;
  let spinning = 0;
  const startSpin = () => {
    spinning++;
    state.loading = true;
    if (!spinTimer) spinTimer = setInterval(() => { state.spin++; render(); }, 80);
  };
  const stopSpin = () => {
    if (--spinning > 0) return;
    spinning = 0;
    clearInterval(spinTimer);
    spinTimer = null;
    state.loading = false;
  };

  async function load() {
    startSpin();
    render();
    try {
      const d = await api.list("month=" + state.month);
      state.data = d;
      state.error = null;
      state.sel = Math.max(0, Math.min(state.sel, visibleExpenses(state).length - 1));
    } catch (e) {
      const msg = e.message || String(e);
      // Keep showing stale data on a failed refresh; hard-fail only when empty.
      if (state.data) state.message = c.red("✗ ") + msg;
      else state.error = msg;
    } finally {
      stopSpin();
      render();
    }
  }

  async function loadReport({ gen = false } = {}) {
    const m = state.month;
    if (gen) state.message = c.dim("Generating report…");
    startSpin();
    render();
    try {
      const doc = gen ? await api.genReport(m) : await api.getReport(m);
      state.reports[m] = { doc };
      if (gen) state.message = c.green("✓ ") + `Report for ${m} generated.`;
    } catch (e) {
      if (e.status === 404) state.reports[m] = { notFound: true };
      else state.reports[m] = { error: e.message || String(e) };
      if (gen) state.message = "";
    } finally {
      stopSpin();
      render();
    }
  }

  // Fetch the month's report the first time it's looked at.
  const ensureReport = () => {
    if (state.tab === "report" && !state.reports[state.month]) void loadReport();
  };

  let done;
  const finished = new Promise((r) => (done = r));
  function quit() {
    if (spinTimer) clearInterval(spinTimer);
    screen.close();
    done();
  }

  async function commitAdd() {
    const text = state.input.text.trim();
    state.mode = "view";
    state.input = { text: "", cur: 0 };
    if (!text) return render();
    state.message = c.dim("Saving…");
    render();
    try {
      const reply = await api.parse(text);
      state.message = c.green("✓ ") + reply.replace(/\s+/g, " ").trim();
    } catch (e) {
      state.message = c.red("✗ ") + (e.message || String(e));
    }
    await load();
  }

  async function deleteSelected() {
    const e = visibleExpenses(state)[state.sel];
    state.mode = "view";
    if (!e) return render();
    state.message = c.dim("Deleting…");
    render();
    try {
      await api.remove(e._id);
      state.message = c.green("✓ ") + `Deleted ${money(e.amount)} · ${e.item ?? ""}`.trim();
    } catch (err) {
      state.message = c.red("✗ ") + (err.message || String(err));
    }
    await load();
  }

  function openEdit() {
    const e = visibleExpenses(state)[state.sel];
    if (!e) return;
    const field = (key, label, val) => ({ key, label, text: String(val ?? ""), cur: String(val ?? "").length });
    state.edit = {
      id: e._id,
      ref: refOf(e._id),
      active: 0,
      fields: [
        field("amount", "Amount", e.amount),
        field("category", "Category", e.category || ""),
        field("item", "Item", e.item ?? e.note ?? ""),
        field("source", "Source", e.source || ""),
      ],
    };
    state.mode = "edit";
    render();
  }

  async function commitEdit() {
    const ed = state.edit;
    const get = (k) => ed.fields.find((f) => f.key === k).text.trim();
    const amount = Number(get("amount"));
    if (!Number.isFinite(amount) || amount < 0) {
      state.message = c.red("✗ ") + "Amount must be a positive number.";
      return render();
    }
    state.mode = "view";
    state.edit = null;
    state.message = c.dim("Saving…");
    render();
    try {
      const { expense } = await api.update(ed.id, {
        amount,
        category: get("category"),
        item: get("item"),
        source: get("source"),
      });
      state.message = c.green("✓ ") + `Updated ${money(expense.amount)} · ${expense.item || "—"}`;
    } catch (e) {
      state.message = c.red("✗ ") + (e.message || String(e));
    }
    await load();
  }

  function move(delta) {
    if (state.tab !== "tx") {
      // j/k from the overview flows into the list — no dead keys.
      state.tab = "tx";
      render();
      return;
    }
    const n = visibleExpenses(state).length;
    state.sel = Math.max(0, Math.min(n - 1, state.sel + delta));
    render();
  }

  function setMonth(m) {
    state.month = m;
    state.sel = 0;
    state.message = "";
    void load();
    ensureReport();
  }

  function onKey(str, key) {
    key = key || {};
    if (key.ctrl && key.name === "c") return quit();

    const wasPendingG = state.pendingG;
    state.pendingG = false;

    if (state.mode === "help") {
      state.mode = "view";
      return render();
    }

    if (state.mode === "add") {
      if (key.name === "return" || key.name === "enter") return void commitAdd();
      if (key.name === "escape") {
        state.mode = "view";
        state.input = { text: "", cur: 0 };
        return render();
      }
      if (editText(state.input, str, key)) return render();
      return;
    }

    if (state.mode === "search") {
      if (key.name === "return" || key.name === "enter") {
        state.mode = "view";
        return render();
      }
      if (key.name === "escape") {
        state.mode = "view";
        state.filter = "";
        state.input = { text: "", cur: 0 };
        state.sel = 0;
        return render();
      }
      if (editText(state.input, str, key)) {
        state.filter = state.input.text; // live filtering as you type
        state.sel = 0;
        return render();
      }
      return;
    }

    if (state.mode === "confirm") {
      if (str === "y" || str === "Y" || key.name === "return") return void deleteSelected();
      state.mode = "view";
      state.message = c.dim("Kept.");
      return render();
    }

    if (state.mode === "edit") {
      const ed = state.edit;
      if (key.name === "escape") {
        state.mode = "view";
        state.edit = null;
        return render();
      }
      if (key.name === "return" || key.name === "enter") return void commitEdit();
      if (key.name === "tab" || key.name === "down") {
        ed.active = (ed.active + (key.shift ? 3 : 1)) % 4;
        return render();
      }
      if (key.name === "up") {
        ed.active = (ed.active + 3) % 4;
        return render();
      }
      if (editText(ed.fields[ed.active], str, key)) return render();
      return;
    }

    // ── view mode ──
    const page = txPageSize(screen.size().H);
    if (key.ctrl && key.name === "d") return move(page >> 1);
    if (key.ctrl && key.name === "u") return move(-(page >> 1));

    switch (key.name) {
      case "pagedown": return move(page);
      case "pageup": return move(-page);
      case "home": return move(-Infinity);
      case "end": return move(Infinity);
      case "left": return setMonth(shiftMonth(state.month, -1));
      case "right": return setMonth(shiftMonth(state.month, 1));
      case "up": return move(-1);
      case "down": return move(1);
      case "tab":
        state.tab =
          state.tab === "overview" ? "tx" : state.tab === "tx" ? "report" : "overview";
        ensureReport();
        return render();
      case "escape":
        if (state.filter) {
          state.filter = "";
          state.sel = 0;
        } else state.message = "";
        return render();
      case "return": case "enter":
        if (state.tab === "tx") openEdit();
        return;
    }

    switch (str) {
      case "q": return quit();
      case "?": state.mode = "help"; return render();
      case "1": state.tab = "overview"; return render();
      case "2": state.tab = "tx"; return render();
      case "3": state.tab = "report"; ensureReport(); return render();
      case "h": return setMonth(shiftMonth(state.month, -1));
      case "l": return setMonth(shiftMonth(state.month, 1));
      case "j": return move(1);
      case "k": return move(-1);
      case "g":
        // On the reports tab `g` (re)generates; elsewhere `gg` jumps to top.
        if (state.tab === "report") return void loadReport({ gen: true });
        if (wasPendingG) return move(-Infinity);
        state.pendingG = true;
        return;
      case "G": return move(Infinity);
      case "t": return setMonth(currentMonth());
      case "r":
        state.message = "";
        if (state.tab === "report") void loadReport();
        return void load();
      case "s":
        state.sortAmount = !state.sortAmount;
        state.sel = 0;
        state.message = c.dim(state.sortAmount ? "Sorted by amount." : "Sorted by date.");
        return render();
      case "a": case "n": case "o": case "i": case "+":
        state.mode = "add";
        state.input = { text: "", cur: 0 };
        state.message = "";
        return render();
      case "/":
        state.tab = "tx";
        state.mode = "search";
        state.input = { text: state.filter, cur: state.filter.length };
        state.message = "";
        return render();
      case "e":
        if (state.tab === "tx") openEdit();
        return;
      case "d": case "x":
        if (state.tab === "tx" && visibleExpenses(state).length) {
          state.mode = "confirm";
          render();
        }
        return;
    }
  }

  screen.onKey(onKey);
  screen.onResize(render);

  await load();
  await finished;
}
