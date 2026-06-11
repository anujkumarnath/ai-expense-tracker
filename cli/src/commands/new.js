// Manual create with no AI — precise control over every field.
//   exp new -a 450 -c Groceries -i "milk, eggs" -s GPay
//   exp new 450 Groceries "milk, eggs" GPay   (positional shorthand)

import { parseArgs } from "node:util";
import { api } from "../api.js";
import { CliError, isDate, todayYMD, refOf } from "../helpers.js";
import { ok } from "../render.js";
import { c, money, log } from "../ui.js";

const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Health",
  "Entertainment", "Groceries", "Subscriptions", "Investment", "Other",
];

export const meta = {
  name: "new",
  aliases: ["manual"],
  summary: "Create a transaction precisely with flags (no AI).",
  usage: 'exp new -a 450 -c Groceries -i "milk, eggs" -s GPay [-d YYYY-MM-DD]',
};

export async function run(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      amount: { type: "string", short: "a" },
      category: { type: "string", short: "c" },
      item: { type: "string", short: "i" },
      source: { type: "string", short: "s" },
      date: { type: "string", short: "d" },
    },
    allowPositionals: true,
  });

  // Positional shorthand: amount, category, item, source.
  const amountRaw = values.amount ?? positionals[0];
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0)
    throw new CliError("Amount is required and must be a positive number.", meta.usage);

  const category = values.category ?? positionals[1] ?? "Other";
  if (!CATEGORIES.includes(category))
    throw new CliError(
      `Invalid category '${category}'.`,
      `Allowed: ${CATEGORIES.join(", ")}`
    );

  const date = values.date;
  if (date && !isDate(date)) throw new CliError("Date must be YYYY-MM-DD.");

  const body = {
    amount,
    category,
    item: values.item ?? positionals[2] ?? "",
    source: values.source ?? positionals[3] ?? "Other",
    date: date || todayYMD(),
  };

  const { expense } = await api.create(body);
  ok(
    `${c.bold(money(expense.amount))} → ${expense.category} ` +
      `${c.dim("| " + (expense.item || "—"))}  ${c.dim("[" + refOf(expense._id) + "]")}`
  );
}
