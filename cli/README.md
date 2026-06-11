# 💸 Expense CLI

A fast, beautiful command-line client for the natural-language expense tracker.
Log, list, edit, delete and report on your spending without leaving the terminal.

- **Plain English** — `exp spent 450 on groceries via gpay`
- **Beautiful** — coloured summary cards, category bars, aligned tables, and
  dashboard-style charts (stacked category share + daily-trend column chart)
- **Less movement** — smart dispatch (no subcommand needed for the common case) and
  an inline prompt so you can log several things in a row
- **Portable** — pure Node.js, **zero dependencies**, runs on Linux & macOS
- **Pipe-friendly** — colour auto-disables when not a TTY (`NO_COLOR` honoured)

It talks to the deployed Cloudflare Worker API, so every feature of the tracker
(AI parse with ADD / SPLIT / UPDATE / DELETE, manual CRUD, monthly reports) is
available from the CLI.

## Requirements

- Node.js **≥ 18.3** (uses built-in `fetch` and `util.parseArgs`). `node -v` to check.

## Install

```bash
cd cli
npm link            # puts `exp` on your PATH (works on Linux & macOS)
```

Prefer no global link? Use the bundled installer, which symlinks into
`~/.local/bin` (make sure that's on your `PATH`):

```bash
./install.sh
```

Or just run it directly: `node bin/exp.js <args>` (alias it to `exp` if you like).

## Setup

### Option A — Sign in with Google (recommended)

A clean browser sign-in (OAuth 2.0 with PKCE + loopback, like `gcloud`/`gh`):

```bash
exp login           # opens the browser, pick your account, done — saves a 7-day session
exp whoami          # who am I signed in as?
exp logout          # forget it
```

**One-time setup** (because any browser OAuth needs a Google client):

1. **Set the API base** if you haven't: `exp config set apiBase https://<your-api>`.
2. **Create a Desktop OAuth client** — Google Cloud Console → *APIs & Services →
   Credentials → Create credentials → OAuth client ID → Application type:
   **Desktop app***. No redirect URIs to configure (loopback is automatic).
3. **Tell the Worker to accept it** — add the new client ID to the Worker's
   accepted audiences and redeploy:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_IDS   # paste the Desktop client ID
   npx wrangler deploy
   ```
   (Your email must already be in the Worker's `ALLOWED_EMAILS`.)
4. **Run `exp login`** — it asks once for the Desktop client ID + secret (stored
   in the `600` config, never committed), opens the browser, and saves the
   session token. Next time it's just `exp login`.

The Desktop "client secret" is non-confidential by Google's design for installed
apps; it's kept in your local config only. When the 7-day session lapses, run
`exp login` again.

### Option B — Static token

```bash
exp config          # prompts for API base URL + auth token, then tests the connection
```

This writes `~/.config/expense/config.json` (chmod `600`). You can also configure
non-interactively or via environment variables:

```bash
exp config set apiBase https://expense-tracker.<you>.workers.dev
exp config set token <AUTH_TOKEN>
# or, per-shell, without touching the config file:
export EXPENSE_API_BASE=https://expense-tracker.<you>.workers.dev
export EXPENSE_TOKEN=<AUTH_TOKEN>
```

Resolution order: **env vars → config file → default base**.

## Usage

```text
exp                                     This month at a glance + inline prompt
exp "spent 450 on groceries via gpay"   Log it (AI parses ADD/SPLIT/UPDATE/DELETE)
exp spent 60 on chai                    Quotes optional — anything unrecognised is parsed
exp "fix the last grocery, it was 380"  Natural-language update
exp "remove the last coffee"            Natural-language delete

exp ls                                  List this month (summary + breakdown + table)
exp ls -m 2026-05                        A specific month
exp ls --from 2026-06-01 --to 2026-06-07 A custom date range
exp ls --all                            Don't truncate the table
exp ls --bare                           Table only (great for piping/grep)
exp ls -g                               List + charts in one go

exp chart                               Visual dashboard: category share + daily trend
exp chart -m 2026-05                     A specific month
exp chart --from 2026-06-01 --to 2026-06-07  A custom range
exp chart --trend                        Only the daily-spend column chart
exp chart --cat                          Only the category-share breakdown
exp chart --height 12                    Taller chart

exp new -a 250 -c Food -i lunch -s UPI   Manual create (no AI), precise fields
exp new 250 Food lunch UPI               Positional shorthand: amount cat item source
exp edit 4f2a9c -a 380                   Edit by ref (last 6 chars of the id)
exp rm 4f2a9c                            Delete (asks to confirm; -y to skip)

exp report                               This month's report
exp report 2026-05                       A specific month
exp report 2026-05 --gen                 Generate / regenerate the report

exp login                                Sign in with Google (browser)
exp whoami                               Show the signed-in account
exp logout                               Forget the saved session/token
exp config                               Setup / re-auth (static token)
exp config --show                        Show current settings (token masked)
exp config --test                        Verify connectivity + token
exp help [command]                       Help, optionally for one command
```

### Refs

Lists show a short **REF** (the last 6 characters of the transaction id). Pass that
ref to `edit`/`rm` — it's resolved within the current month (use `-m YYYY-MM` for
another month). Full 24-char ids are accepted too.

## How it maps to the API

| Command            | Endpoint                         |
| ------------------ | -------------------------------- |
| `login`            | Google OAuth → `POST /auth/google` → session token |
| `parse` / NL input | `POST /parse`                    |
| `ls` / `chart`     | `GET /expenses?month=` / `?from=&to=` |
| `new`              | `POST /expenses`                 |
| `edit`             | `PUT /expenses/:id`              |
| `rm`               | `DELETE /expenses/:id`           |
| `report`           | `GET /reports/:month`            |
| `report --gen`     | `POST /reports/:month`           |
| `config --test`    | `GET /health?check=db`           |

## Notes

- All dates are **IST (UTC+5:30)**, matching the server; displayed as `DD-MM-YYYY`.
- The token is a secret — it's stored in a `600` file and masked in `--show`.
- Set `NO_COLOR=1` to force plain output, or `FORCE_COLOR=1` to keep colour when
  piping (e.g. `exp chart | less -R`). The category-share bar needs colour to read.
