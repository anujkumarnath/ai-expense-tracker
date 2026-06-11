import { c, log, nl, pad, width } from "../ui.js";
import { registry } from "./index.js";

export const meta = {
  name: "help",
  aliases: ["h"],
  summary: "Show this help.",
  usage: "exp help [command]",
};

const VERSION = "1.0.0";

export function run(argv = []) {
  const cmd = argv[0];
  if (cmd && registry[cmd]) {
    const m = registry[cmd].meta;
    nl();
    log(`  ${c.bold(m.name)} ${c.dim("— " + m.summary)}`);
    log(`  ${c.cyan(m.usage)}`);
    if (m.aliases?.length) log(`  ${c.dim("aliases: " + m.aliases.join(", "))}`);
    nl();
    return;
  }

  nl();
  log(`  ${c.bold(c.green("💸 Expense CLI"))} ${c.dim("v" + VERSION)}`);
  log(c.dim("  Track expenses in plain English, from your terminal.\n"));

  log(c.bold("  Quick start"));
  log(`    ${c.green('exp "spent 450 on groceries via gpay"')}   ${c.dim("log it")}`);
  log(`    ${c.green("exp")}                                      ${c.dim("this month + prompt")}`);
  log(`    ${c.green("exp ls")}                                   ${c.dim("list transactions")}`);
  log(`    ${c.green("exp chart")}                                ${c.dim("visual dashboard")}`);
  nl();

  log(c.bold("  Commands"));
  const seen = new Set();
  const items = [];
  for (const key of Object.keys(registry)) {
    const m = registry[key].meta;
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    items.push(m);
  }
  const w = Math.max(...items.map((m) => width(m.name)));
  for (const m of items) {
    const al = m.aliases?.length ? c.dim(` (${m.aliases.join(", ")})`) : "";
    log(`    ${c.cyan(pad(m.name, w))}  ${m.summary}${al}`);
  }
  nl();

  log(c.bold("  Examples"));
  log(`    ${c.dim("exp")} new -a 250 -c Food -i lunch -s UPI`);
  log(`    ${c.dim("exp")} ls --from 2026-06-01 --to 2026-06-07`);
  log(`    ${c.dim("exp")} chart -m 2026-05            ${c.dim("# category + daily-trend charts")}`);
  log(`    ${c.dim("exp")} edit 4f2a9c -a 380`);
  log(`    ${c.dim("exp")} rm 4f2a9c`);
  log(`    ${c.dim("exp")} report 2026-05 --gen`);
  log(`    ${c.dim('exp "remove the last coffee"')}`);
  nl();
  log(c.dim(`  Config: exp config   ·   Help on a command: exp help <command>`));
  nl();
}

export { VERSION };
