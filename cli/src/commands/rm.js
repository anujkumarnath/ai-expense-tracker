// Delete a transaction by id or trailing ref.
//   exp rm 4f2a9c
//   exp rm 4f2a9c --yes      (skip confirmation)

import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { api } from "../api.js";
import { CliError, resolveId, refOf } from "../helpers.js";
import { ok } from "../render.js";
import { c, money, log } from "../ui.js";

export const meta = {
  name: "rm",
  aliases: ["del", "delete"],
  summary: "Delete a transaction (by ref). Use NL for 'remove the last …'.",
  usage: "exp rm <ref> [--yes]",
};

export async function run(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      yes: { type: "boolean", short: "y" },
      month: { type: "string", short: "m" },
    },
    allowPositionals: true,
  });

  const ref = positionals[0];
  if (!ref) throw new CliError("Which transaction? Pass its ref.", meta.usage);

  const id = await resolveId(ref, { month: values.month });

  // Show what's about to go, then confirm (unless --yes or non-interactive).
  const { expenses = [] } = await api.list(
    values.month ? `month=${values.month}` : ""
  );
  const target = expenses.find((e) => e._id === id);
  if (target)
    log(
      `${c.yellow("About to delete:")} ${c.bold(money(target.amount))} → ` +
        `${target.category} ${c.dim("| " + (target.item || "—"))} ${c.dim("[" + refOf(id) + "]")}`
    );

  if (!values.yes && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = (await rl.question(c.dim("Delete? [y/N] "))).trim().toLowerCase();
    rl.close();
    if (a !== "y" && a !== "yes") {
      log(c.dim("Cancelled."));
      return;
    }
  }

  await api.remove(id);
  ok(`Deleted ${c.dim("[" + refOf(id) + "]")}`);
}
