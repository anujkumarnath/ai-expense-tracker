// First-run setup and inspection.
//   exp config              interactive setup (API base + token)
//   exp config --show       print current settings (token masked)
//   exp config --test       ping the API and verify the token
//   exp config set <k> <v>  set apiBase | token without the wizard

import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { settings, writeConfig, readConfig, configPath, DEFAULT_BASE } from "../config.js";
import { api } from "../api.js";
import { CliError } from "../helpers.js";
import { c, log, nl, spinner } from "../ui.js";

export const meta = {
  name: "config",
  aliases: ["setup"],
  summary: "Set up the API base URL and auth token.",
  usage: "exp config [--show] [--test] | exp config set <apiBase|token> <value>",
};

const mask = (t) => (t ? t.slice(0, 4) + "…" + t.slice(-4) : c.dim("(unset)"));

export async function run(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      show: { type: "boolean" },
      test: { type: "boolean" },
    },
    allowPositionals: true,
  });

  if (positionals[0] === "set") {
    const key = positionals[1];
    const val = positionals.slice(2).join(" ");
    if (!["apiBase", "token"].includes(key) || !val)
      throw new CliError("Usage: exp config set <apiBase|token> <value>");
    writeConfig({ [key]: key === "apiBase" ? val.replace(/\/+$/, "") : val });
    log(`${c.green("✓")} Saved ${key}.`);
    return;
  }

  if (values.show) {
    const s = settings();
    nl();
    log(`${c.dim("API base")}   ${s.apiBase || c.dim("(unset)")}`);
    if (s.authKind === "google") {
      const left = s.tokenExpiry ? s.tokenExpiry - Date.now() : 0;
      const exp = left <= 0 ? c.red("expired") : `${Math.floor(left / 86400000)}d left`;
      log(`${c.dim("Signed in")}  ${s.email} ${c.dim("(Google · " + exp + ")")}`);
    } else if (s.token) {
      log(`${c.dim("Token")}      ${mask(s.token)} ${c.dim("(static · " + s.source + ")")}`);
    } else {
      log(`${c.dim("Auth")}       ${c.dim("(not signed in — run `exp login` or `exp config`)")}`);
    }
    log(`${c.dim("Config")}     ${configPath()}`);
    nl();
    return;
  }

  if (values.test) {
    await testConnection();
    return;
  }

  // Interactive wizard.
  if (!process.stdin.isTTY)
    throw new CliError("No TTY for interactive setup.", "Use: exp config set token <value>");

  const existing = readConfig();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  nl();
  log(c.bold("  Expense CLI setup"));
  log(c.dim("  Press Enter to keep the current value.\n"));

  const baseDefault = existing.apiBase || DEFAULT_BASE;
  const baseAns = (await rl.question(`  API base [${c.cyan(baseDefault)}]: `)).trim();
  const apiBase = (baseAns || baseDefault).replace(/\/+$/, "");

  const tokDefault = existing.token ? mask(existing.token) : "";
  const tokAns = (
    await rl.question(`  Auth token${tokDefault ? ` [${tokDefault}]` : ""}: `)
  ).trim();
  rl.close();

  const patch = { apiBase };
  if (tokAns) patch.token = tokAns;
  writeConfig(patch);
  log(`\n${c.green("✓")} Saved to ${c.dim(configPath())}`);
  await testConnection();
}

async function testConnection() {
  const sp = spinner("Testing connection…");
  try {
    const health = await api.health();
    // A protected call to confirm the token actually works.
    await api.list("month=" + new Date().toISOString().slice(0, 7));
    sp.stop();
    const db = health?.db?.ok ?? health?.db ?? "ok";
    log(`${c.green("✓")} Connected. ${c.dim("DB: " + JSON.stringify(db))}`);
  } catch (err) {
    sp.stop();
    throw err;
  }
}
