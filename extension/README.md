# 💸 Expense Tracker — browser extension

Quick-add expenses in plain English from any tab, see the month at a glance,
and log selected text from any page via the right-click menu. Manifest V3,
zero dependencies — works in Chrome, Edge and Brave.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Click the extension icon → **Open settings** → enter your API base URL and
   auth token (same values as `exp config` in the CLI), then **Save & test**.
   The browser will ask to allow access to your API origin — accept it; that
   grant is what lets the extension call the Worker even with CORS locked to
   the dashboard origin.

## Use

- **Toolbar popup** (`Ctrl+Shift+E` / `Cmd+Shift+E`): type
  `coffee 120 at blue tokai via upi` → **Log**. Shows this month's total, top
  categories and recent transactions.
- **Right-click**: select any text on a page (an order confirmation, a UPI
  SMS pasted in a doc…) → *Log "…" as expense* → the AI parser does the rest;
  the result arrives as a notification.

## Notes

- The token is kept in `chrome.storage.local` (this profile only, not synced).
- All requests go directly from your browser to your Worker — no third party.
- Categories use the same color palette as the web dashboard.
