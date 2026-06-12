#!/usr/bin/env node
// Expense CLI — entry point and dispatcher.
//
// Dispatch rules (designed for "less movement"):
//   exp                        → interactive TUI (static home view when piped)
//   exp <command> [args]       → that command
//   exp <anything else>        → natural-language parse (the common case)
//
// So `exp spent 450 on chai` Just Works without quotes or a subcommand.

import { registry } from "../src/commands/index.js";
import { run as runHome } from "../src/commands/home.js";
import { run as runTui } from "../src/commands/tui.js";
import { run as runParse } from "../src/commands/parse.js";
import { run as runHelp, VERSION } from "../src/commands/help.js";
import { die } from "../src/helpers.js";

async function main() {
  const argv = process.argv.slice(2);

  // Global flags.
  if (argv[0] === "-v" || argv[0] === "--version" || argv[0] === "version") {
    console.log("expense-cli v" + VERSION);
    return;
  }
  if (argv.length === 0) {
    return process.stdin.isTTY && process.stdout.isTTY ? runTui() : runHome();
  }

  const first = argv[0];
  const rest = argv.slice(1);

  // `-h`/`--help` anywhere → help (command-specific if a command precedes it).
  if (first === "-h" || first === "--help" || first === "help" || first === "h") {
    return runHelp(rest);
  }
  if (rest.includes("-h") || rest.includes("--help")) {
    if (registry[first]) return runHelp([registry[first].meta.name]);
  }

  const mod = registry[first];
  if (mod) return mod.run(rest);

  // Not a known command → treat the entire input as natural language.
  return runParse(argv);
}

// One-shot CLI: once the command resolves there is no more useful work, but
// keep-alive sockets (undici/global fetch, the loopback server) can keep the
// event loop alive for seconds. Flush output, then exit deterministically.
function shutdown(code) {
  const exit = () => process.exit(code);
  const streams = [process.stdout, process.stderr].filter((s) => s.writableLength > 0);
  if (streams.length === 0) return exit();
  let remaining = streams.length;
  for (const s of streams) s.once("drain", () => --remaining === 0 && exit());
  setTimeout(exit, 1500).unref(); // safety net if a drain never fires
}

main()
  .then(() => shutdown(process.exitCode ?? 0))
  .catch((err) => {
    die(err);
    shutdown(process.exitCode ?? 1);
  });
