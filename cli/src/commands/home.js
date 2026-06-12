// Default view (`exp` with no args): this month at a glance, then an optional
// inline prompt so you can log several things without re-typing `exp`.

import { createInterface } from "node:readline/promises";
import { api } from "../api.js";
import { settings } from "../config.js";
import { currentMonth } from "../helpers.js";
import { c, log, nl, spinner } from "../ui.js";
import { renderSummary, renderExpenses } from "../render.js";
import { run as parseRun } from "./parse.js";

export const meta = {
  name: "home",
  aliases: [],
  summary: "This month at a glance (static; the default when output is piped).",
  usage: "exp home",
};

export async function run() {
  const { token, apiBase } = settings();
  if (!token || !apiBase) {
    nl();
    log(`${c.yellow("●")} Welcome to ${c.bold("Expense CLI")}.`);
    log(`  Sign in with ${c.cyan("exp login")} (Google) or ${c.cyan("exp config")} (token),`);
    log(`  then ${c.cyan('exp "spent 250 on lunch"')}.`);
    nl();
    return;
  }

  await dashboard();

  // Inline prompt loop (TTY only): type an expense, blank/q to quit.
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    log(c.dim("  Type an expense to log it, or press Enter to quit. (try: 'help')"));
    while (true) {
      const line = (await rl.question(c.green("  › "))).trim();
      if (!line || line === "q" || line === "quit" || line === "exit") break;
      if (line === "help" || line === "?") {
        rl.close();
        const { run: helpRun } = await import("./help.js");
        helpRun([]);
        return;
      }
      if (line === "ls" || line === "list") {
        await dashboard();
        continue;
      }
      try {
        await parseRun([line]);
      } catch (err) {
        log(`${c.red("✗")} ${err.message}`);
      }
    }
    rl.close();
  } else {
    nl();
    log(c.dim(`  Log one with:  exp "spent 250 on lunch via upi"`));
    nl();
  }
}

async function dashboard() {
  const sp = spinner("Loading…");
  let data;
  try {
    data = await api.list("month=" + currentMonth());
  } finally {
    sp.stop();
  }
  nl();
  renderSummary(data, currentMonth());
  renderExpenses(data.expenses, { limit: 6 });
  nl();
}
