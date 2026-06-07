# Expense Tracker — Setup Guide

A natural-language expense tracker: speak/type a sentence → a Cloudflare Worker
parses it with an LLM (Groq, Llama 3.3 70B) → stores in MongoDB Atlas → mirrors
to Google Sheets → view it on a Cloudflare Pages dashboard.

**100% free tier:** Cloudflare Workers + Pages, MongoDB Atlas M0, Groq API.
No card required anywhere. All dates handled explicitly in IST (UTC+5:30).

---

## 0. Prerequisites

- Node.js 18+ and npm
- A Google account (for Gemini + Sheets)
- A Cloudflare account (free)
- A MongoDB Atlas account (free)

```bash
cd ai-expense-tracker
npm install
```

---

## 1. MongoDB Atlas (M0 free cluster)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a Deployment** → choose **M0 (Free)** → pick a nearby region
   (e.g. Mumbai `ap-south-1`) → Create.
3. **Database Access** → Add New Database User → username + password
   (auth method: password). Save these.
4. **Network Access** → Add IP Address → **Allow access from anywhere**
   (`0.0.0.0/0`). Workers have no fixed egress IP, so this is required.
5. **Database → Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
   ```
   Substitute your real password. You do **not** need to append a DB name — the
   Worker uses the `DB_NAME` var (`expense_tracker`) from `wrangler.toml`.
   Collections (`expenses`, `reports`) are created automatically on first write.

> Tip: if your password has special characters, URL-encode them.

---

## 2. Groq API key (free, no card)

1. Go to <https://console.groq.com/keys> (sign in with Google/GitHub).
2. **Create API Key** → copy it (shown once).
3. Model used: `llama-3.3-70b-versatile` (free tier; set via `GROQ_MODEL` in
   `wrangler.toml`). Groq's free tier needs no billing account — it avoids the
   Google "free trial disables free tier" quota trap.

---

## 3. Google Sheets mirror (passive backup)

1. Create a new Google Sheet (keep it **private** — sharing it is independent of
   the web-app step below).
2. **Extensions → Apps Script**. Delete boilerplate, paste the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs).
3. **Project Settings (gear) → Script Properties → Add property**
   - Name: `SHARED_SECRET`
   - Value: a strong secret you generate (see box below). Keep it — you'll reuse it.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorize (your own unverified script → **Advanced → Go to … (unsafe) → Allow**).
6. Copy the **Web app URL** ending in `/exec`. That's your `SHEETS_WEBHOOK_URL`.

> **Generate a strong secret** (used for both `SHARED_SECRET` and `SHEETS_SHARED_SECRET`):
> ```bash
> openssl rand -base64 32
> ```

The Worker sends `secret` in every mirror request; the script rejects any POST
whose secret doesn't match. The Sheet itself stays private.

---

## 4. Cloudflare + Wrangler

```bash
npm install -g wrangler
wrangler login
```

---

## 5. Set Worker secrets

Run each command, paste the value when prompted. All five are required
(`SHEETS_*` can be skipped only if you don't want the mirror).

```bash
wrangler secret put MONGODB_URI            # mongodb+srv://...
wrangler secret put GROQ_API_KEY           # from console.groq.com/keys
wrangler secret put SHEETS_WEBHOOK_URL     # the /exec URL
wrangler secret put SHEETS_SHARED_SECRET   # same value as Apps Script SHARED_SECRET
wrangler secret put AUTH_TOKEN             # YOUR chosen dashboard/API token (strong!)
```

> `AUTH_TOKEN` is the static token for **Tasker/curl** (sent as `Authorization:
> Bearer <token>`). The **dashboard** signs in with Google (below), not this token —
> but it stays valid as a break-glass login at `/login?token`.

Dashboard Google sign-in (see §12 to create the OAuth client first):
```bash
wrangler secret put SESSION_SECRET    # random key for signing dashboard sessions
wrangler secret put GOOGLE_CLIENT_ID  # …apps.googleusercontent.com
wrangler secret put ALLOWED_EMAILS    # comma-separated, e.g. you@gmail.com
```

Optional — lock browser CORS to your dashboard origin (recommended once you have a
custom domain). Keeps the URL out of the repo:
```bash
wrangler secret put DASHBOARD_ORIGIN       # e.g. https://tracker.example.com
```
If unset, CORS defaults to `*` (still token-protected; only browser access is wider).

Non-secret config lives in `wrangler.toml`:
- `compatibility_flags = ["nodejs_compat"]` — required for the MongoDB driver.
- `[triggers] crons = ["0 18 * * *"]` — 00:00 IST; the handler only generates a
  report when it's the 1st of the month in IST (for the previous month).
- `[vars] DB_NAME = "expense_tracker"`.

---

## 6. Deploy the Worker

```bash
wrangler deploy
```

Note the printed URL, e.g. `https://expense-tracker.<subdomain>.workers.dev`.

Smoke test:
```bash
curl https://expense-tracker.<subdomain>.workers.dev/health
# {"ok":true}

curl "https://expense-tracker.<subdomain>.workers.dev/health?check=db"
# {"ok":true,"db":"up"}   <- confirms Atlas connection + secret
```

> If `db:"down"`, recheck `MONGODB_URI`, the DB user/password, and that Network
> Access allows `0.0.0.0/0`.

---

## 7. Deploy the dashboard (Cloudflare Pages)

1. Create `dashboard/config.js` from the example and set your deployed Worker URL:
   ```bash
   cp dashboard/config.example.js dashboard/config.js
   ```
   ```js
   // dashboard/config.js  (gitignored — not committed)
   window.API_BASE = "https://expense-tracker.<subdomain>.workers.dev";
   ```
2. Deploy the static folder:
   ```bash
   wrangler pages deploy dashboard --project-name expense-tracker-dashboard
   ```
3. Open the printed `*.pages.dev` URL → you land on `/login` → enter your
   `AUTH_TOKEN`.

> The `_redirects` file routes all paths to `index.html` so `/dashboard` and
> `/report/2026-05` work as a single-page app.

---

## 8. Tasker on Samsung Android (voice → /parse)

Install **Tasker** (Play Store). Create a task that POSTs spoken text to the Worker.

**Task: "Log Expense"**
1. New Task → name it `Log Expense`.
2. Action **Input → Get Voice** (or pass text in via a variable — see step 9).
   - Store result in `%spoken`.
3. Action **Net → HTTP Request**
   - Method: `POST`
   - URL: `https://expense-tracker.<subdomain>.workers.dev/parse`
   - Headers:
     ```
     Authorization: Bearer YOUR_AUTH_TOKEN
     Content-Type: text/plain
     ```
   - Body: `%spoken`
   - (Tick "Trust Any Certificate" not needed; HTTPS is fine.)
   - Output variable: `%http_data`
4. Action **Alert → Toast**: `%http_data`
   (shows `✅ ₹450 → Groceries | groceries`).

**Home-screen widget shortcut**
- Long-press home → Widgets → Tasker → **Task** → pick `Log Expense`.
- One tap → speak → toast confirmation.

---

## 9. Google Assistant routine (hands-free)

Google removed custom Assistant→Tasker text passing on some devices; two options:

**Option A — Assistant Routine + Tasker AutoVoice**
1. Install **AutoVoice** (Tasker plugin) and enable its Assistant integration.
2. Google app → Routines → New → Starter phrase: `log expense`.
3. Action: open/trigger AutoVoice, which captures the follow-up speech into
   `%avcomm` and runs the `Log Expense` task with that as `%spoken`.

**Option B — Tasker voice directly (simplest, reliable)**
- Use the home-screen widget from step 8. Tap → Tasker's **Get Voice** captures
  the full sentence → POSTs it. No Assistant dependency.

Either way the Worker receives one natural-language sentence and replies with the
confirmation string shown as a toast.

---

## 10. Testing checklist

Set convenience vars first:
```bash
URL="https://expense-tracker.<subdomain>.workers.dev"
TOK="YOUR_AUTH_TOKEN"
H="Authorization: Bearer $TOK"
```

**ADD**
```bash
curl -s -X POST "$URL/parse" -H "$H" -H "Content-Type: text/plain" \
  -d "I spent 450 on groceries via GPay"
# ✅ ₹450 → Groceries | groceries
```

**SPLIT**
```bash
curl -s -X POST "$URL/parse" -H "$H" -H "Content-Type: text/plain" \
  -d "spent 1200 on dinner, paneer and naan are mine, rest split 3 ways"
# ✅ ₹<my share> → Food | dinner
```

**UPDATE**
```bash
curl -s -X POST "$URL/parse" -H "$H" -H "Content-Type: text/plain" \
  -d "Fix the last grocery transaction, it was 380 not 450"
# ✅ Updated ₹380 → Groceries | groceries
```

**DELETE**
```bash
curl -s -X POST "$URL/parse" -H "$H" -H "Content-Type: text/plain" \
  -d "Remove the last grocery entry"
# 🗑️ Deleted ₹380 → Groceries | groceries
```

**Dashboard data**
```bash
curl -s "$URL/expenses?month=$(date +%Y-%m)" -H "$H"
```

**Report (generate then fetch)**
```bash
curl -s -X POST "$URL/reports/2026-05" -H "$H"   # generate
curl -s "$URL/reports/2026-05" -H "$H"           # fetch
```

**Auth (should fail)**
```bash
curl -s -o /dev/null -w "%{http_code}\n" "$URL/expenses"   # 401
```

**Dashboard UI**
- Visit your `*.pages.dev` URL → log in → confirm cards, charts, table.
- Edit a row → save → row updates (and Sheet row updates).
- Delete a row → confirm → row disappears.
- Visit `/report/<this-month>` → Generate → Print/PDF.

---

## 11. Direct API (without AI)

Everything works without the LLM too — handy for scripts or manual entry:

```bash
# Create a transaction directly (category must be from the allowed list;
# source is free-form — any card/wallet name)
curl -s -X POST "$URL/expenses" -H "$H" -H "Content-Type: application/json" \
  -d '{"date":"2026-06-07","amount":250,"category":"Food","item":"lunch","source":"Amazon Pay Balance"}'

# Edit by id
curl -s -X PUT "$URL/expenses/<id>" -H "$H" -H "Content-Type: application/json" \
  -d '{"amount":300,"source":"HDFC Credit Card"}'

# Delete by id
curl -s -X DELETE "$URL/expenses/<id>" -H "$H"

# Summary for the whole month
curl -s "$URL/expenses?month=2026-06" -H "$H"

# Summary for a custom date range (e.g. month-to-date)
curl -s "$URL/expenses?from=2026-06-01&to=2026-06-07" -H "$H"
```

The dashboard's **+ Add** button and date-range / MTD controls use exactly these
endpoints.

## 12. Google Sign-In for the dashboard

The dashboard logs in with **Sign in with Google**, restricted to your email; Tasker
keeps using the static `AUTH_TOKEN`.

1. Google Cloud Console → **APIs & Services → Google Auth Platform** (OAuth consent):
   - **Audience:** External. Add yourself under **Test users** (or publish to
     Production — both fine; only basic `openid email profile` scopes are used, so no
     verification is needed). `@gmail.com` accounts can't use "Internal".
   - **Branding:** app name + your support/developer email.
2. **Clients → Create client → Web application:**
   - **Authorized JavaScript origins:** your dashboard origin, e.g. `https://tracker.example.com`
   - **Authorized redirect URIs:** leave empty (ID-token flow needs none).
   - Copy the **Client ID** (`…apps.googleusercontent.com`).
3. Put the Client ID in **both** places:
   - Frontend: `dashboard/config.js` → `window.GOOGLE_CLIENT_ID = "…"`
   - Worker: `wrangler secret put GOOGLE_CLIENT_ID`
4. Set `SESSION_SECRET` (random) and `ALLOWED_EMAILS` (your email). Redeploy the Worker.

**Security:** the Worker verifies the Google ID token's audience + issuer, requires a
verified email, and rejects any address not in `ALLOWED_EMAILS` (403). The publishing
status doesn't widen access — the allowlist is the gate.

Break-glass: visit `/login?token` to reveal the static-token field if Google sign-in
is ever misconfigured.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/health?check=db` → `db:"down"` | Check `MONGODB_URI`, DB user/pass, Atlas Network Access `0.0.0.0/0`. |
| 401 on every call | `AUTH_TOKEN` secret vs token typed don't match. Re-run `wrangler secret put AUTH_TOKEN`. |
| Sheet not updating | Web app access must be **Anyone**; `SHARED_SECRET` (Apps Script) must equal `SHEETS_SHARED_SECRET` (worker). Mirror failures never block the DB write. |
| Dashboard can't reach API | `dashboard/config.js` `API_BASE` must be the exact Worker URL, no trailing slash. |
| LLM / parse errors | Verify `GROQ_API_KEY`; check rate limits at console.groq.com. |
| Report 404 | Use the dashboard **Generate** button or `POST /reports/:month`. Cron only runs on the 1st (IST). |
