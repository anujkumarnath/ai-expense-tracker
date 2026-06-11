// Config: where the API lives + the bearer token.
// Resolution order (first wins): env vars > config file > defaults.
// File: $XDG_CONFIG_HOME/expense/config.json  (~/.config/expense/config.json)

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

// No hosted URL is committed (matches the repo convention). Set it via
// `exp config`, `exp config set apiBase <url>`, or $EXPENSE_API_BASE.
const DEFAULT_BASE = "";

export function configDir() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "expense");
}
export const configPath = () => join(configDir(), "config.json");

export function readConfig() {
  try {
    return JSON.parse(readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

export function writeConfig(patch) {
  const dir = configDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const next = { ...readConfig(), ...patch };
  writeFileSync(configPath(), JSON.stringify(next, null, 2) + "\n");
  // Token is a secret — keep the file private (0600).
  try {
    chmodSync(configPath(), 0o600);
  } catch {}
  return next;
}

// The effective settings used by every command.
export function settings() {
  const file = readConfig();
  return {
    apiBase: (process.env.EXPENSE_API_BASE || file.apiBase || DEFAULT_BASE || "").replace(/\/+$/, ""),
    token: process.env.EXPENSE_TOKEN || file.token || "",
    source: process.env.EXPENSE_TOKEN ? "env" : file.token ? "file" : "none",
    // Auth kind for display: a Google session carries an email + expiry.
    authKind: process.env.EXPENSE_TOKEN ? "static" : file.email ? "google" : file.token ? "static" : "none",
    email: file.email || "",
    tokenExpiry: file.tokenExpiry || 0, // epoch ms
    // Desktop OAuth client used by `exp login` (client_secret is non-confidential
    // per Google for installed apps; still kept in the 0600 config, never committed).
    googleClientId: process.env.EXPENSE_GOOGLE_CLIENT_ID || file.googleClientId || "",
    googleClientSecret: process.env.EXPENSE_GOOGLE_CLIENT_SECRET || file.googleClientSecret || "",
  };
}

export { DEFAULT_BASE };
