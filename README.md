# Expense Tracker

Natural-language personal expense tracker. Speak or type a sentence — a Cloudflare
Worker parses it with an LLM (Groq), stores it in MongoDB Atlas, mirrors it to a
Google Sheet, and shows it on a dark analytics dashboard. Runs entirely on free tiers.

> All dates are handled explicitly in **IST (UTC+5:30)**: stored as ISO (IST
> midnight), displayed as `DD-MM-YYYY`.

## Features

- **Natural language** → structured expense via Groq (Llama 3.3). Four intents:
  - `ADD` — "I spent 450 on groceries via GPay"
  - `SPLIT` — "spent 1200 on dinner, paneer is mine, rest split 3 ways" (stores *your* share)
  - `UPDATE` — "fix the last grocery entry, it was 380 not 450"
  - `DELETE` — "remove the last grocery entry"
- **Dashboard** (Cloudflare Pages): summary cards, category donut + daily-trend charts,
  paginated table with inline add/edit/delete, month picker + custom date-range / MTD,
  30s auto-refresh.
- **Monthly reports**: auto-generated on the 1st (IST) via cron, or on demand; printable.
- **Google Sheets mirror**: every add/update mirrored to a Sheet as a passive backup.
- **Manual REST API** for use without the LLM.
- **Auth**: single static Bearer token; CORS lockable to the dashboard origin.

## Architecture

```
Phone / curl ──> Cloudflare Worker (API) ──> MongoDB Atlas (primary)
   (text)            │  Groq (parse)     └──> Google Sheet (mirror)
                     │
Dashboard (Pages) ───┘
```

## Tech

Cloudflare Workers + Pages · MongoDB Atlas (M0) · Groq API · Chart.js · Apps Script.
No build step (plain ESM + static files).

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | no | `?check=db` pings Atlas |
| POST | `/parse` | yes | natural language → add/split/update/delete |
| GET | `/expenses?month=YYYY-MM` | yes | also `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| POST | `/expenses` | yes | manual create (no AI) |
| PUT | `/expenses/:id` | yes | edit |
| DELETE | `/expenses/:id` | yes | delete |
| GET | `/reports/:month` | yes | fetch report |
| POST | `/reports/:month` | yes | generate/regenerate |

All protected routes require `Authorization: Bearer <AUTH_TOKEN>`.

## Setup

See **[SETUP.md](SETUP.md)** for full step-by-step instructions (Atlas, Groq,
Cloudflare, secrets, deploy, Tasker / "OK Google" voice logging, testing).

Quick version:

```bash
npm install
# set secrets: MONGODB_URI, GROQ_API_KEY, SHEETS_WEBHOOK_URL,
#              SHEETS_SHARED_SECRET, AUTH_TOKEN  (optional: DASHBOARD_ORIGIN)
npx wrangler secret put MONGODB_URI
# ...
npx wrangler deploy

cp dashboard/config.example.js dashboard/config.js   # set window.API_BASE
npx wrangler pages deploy dashboard --project-name expense-tracker-dashboard
```

## Project structure

```
src/            Worker: routing, auth, LLM parsing, handlers, DB, reports
dashboard/      Cloudflare Pages SPA (login, dashboard, report)
apps-script/    Google Apps Script Sheets mirror (Code.gs)
scripts/        One-off migration helper
SETUP.md        Full setup & deployment guide
```

## Configuration & secrets

Secrets are never committed. They are set via `wrangler secret put` and read from
`env` at runtime. `dashboard/config.js` (your API URL) and `.env` are gitignored;
use `dashboard/config.example.js` as the template. CORS origin is configured via the
`DASHBOARD_ORIGIN` variable, not hardcoded.

## License

Personal project — use as you like.
