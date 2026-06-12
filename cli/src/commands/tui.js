// `exp tui` — launch the full-screen interactive dashboard.
// This is also what a bare `exp` runs when attached to a terminal.

import { runTui } from "../tui/index.js";

export const meta = {
  name: "tui",
  aliases: ["ui", "dash", "top"],
  summary: "Full-screen interactive dashboard (also the default `exp`).",
  usage: "exp tui",
};

export async function run() {
  return runTui();
}
