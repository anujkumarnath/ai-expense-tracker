// Edit a transaction by id or trailing ref.
//   exp edit 4f2a9c -a 380
//   exp edit 4f2a9c -c Food -i "team lunch"

import { parseArgs } from "node:util";
import { api } from "../api.js";
import { CliError, resolveId, refOf } from "../helpers.js";
import { ok } from "../render.js";
import { c, money } from "../ui.js";

export const meta = {
  name: "edit",
  aliases: ["e"],
  summary: "Edit a transaction's amount/category/item/source.",
  usage: "exp edit <ref> [-a amount] [-c category] [-i item] [-s source]",
};

export async function run(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      amount: { type: "string", short: "a" },
      category: { type: "string", short: "c" },
      item: { type: "string", short: "i" },
      source: { type: "string", short: "s" },
      month: { type: "string", short: "m" }, // help resolve refs in other months
    },
    allowPositionals: true,
  });

  const ref = positionals[0];
  if (!ref) throw new CliError("Which transaction? Pass its ref.", meta.usage);

  const patch = {};
  if (values.amount !== undefined) {
    const n = Number(values.amount);
    if (!Number.isFinite(n) || n < 0) throw new CliError("Amount must be a positive number.");
    patch.amount = n;
  }
  if (values.category !== undefined) patch.category = values.category;
  if (values.item !== undefined) patch.item = values.item;
  if (values.source !== undefined) patch.source = values.source;
  if (Object.keys(patch).length === 0)
    throw new CliError("Nothing to change.", "Pass at least one of -a, -c, -i, -s.");

  const id = await resolveId(ref, { month: values.month });
  const { expense } = await api.update(id, patch);
  ok(
    `Updated ${c.bold(money(expense.amount))} → ${expense.category} ` +
      `${c.dim("| " + (expense.item || "—"))}  ${c.dim("[" + refOf(expense._id) + "]")}`
  );
}
