// Natural-language entry: the heart of "less movement".
//   exp spent 450 on groceries via gpay
//   exp "fix the last grocery entry, it was 380"
//   exp "remove the last coffee"
// Handles ADD / SPLIT / UPDATE / DELETE — the server's LLM decides the intent.

import { api } from "../api.js";
import { c, spinner, log } from "../ui.js";
import { CliError } from "../helpers.js";

export const meta = {
  name: "parse",
  aliases: ["add", "a"],
  summary: "Log/edit/delete an expense in plain English (AI-parsed).",
  usage: 'exp "spent 450 on groceries via gpay"',
};

export async function run(argv) {
  const text = argv.join(" ").trim();
  if (!text)
    throw new CliError("Nothing to log.", 'Try: exp "spent 250 on lunch via upi"');

  const sp = spinner("Thinking…");
  let reply;
  try {
    reply = await api.parse(text);
  } finally {
    sp.stop();
  }
  // The server returns a ready-made line like "✅ ₹400 → Groceries | milk".
  log(reply.trim());
  if (/^⚠️/.test(reply.trim())) process.exitCode = 1;
}
