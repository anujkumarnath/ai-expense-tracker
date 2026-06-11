import { whoami } from "./login.js";

export const meta = {
  name: "whoami",
  aliases: ["me"],
  summary: "Show who you're signed in as.",
  usage: "exp whoami",
};

export const run = () => whoami();
