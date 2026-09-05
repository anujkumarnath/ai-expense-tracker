# Google Sign-In UX Spec (next iteration — not implemented yet)

This app currently uses token-only auth (`LoginScreen.kt` — paste a static bearer
token once, stored via `EncryptedSharedPreferences`). This document specifies the
intended UX for replacing/augmenting that with Google Sign-In in a future iteration.
**No code for this exists yet.** Written to the new design system's tokens
(`ui/theme/Color.kt`, `Spacing.kt`, `Type.kt`) so implementation can drop straight in.

## Why this is deferred

The backend has no OAuth verification endpoint today — it only checks a static
bearer token. Building real Google Sign-In requires backend work (verify Google ID
token, mint/validate a session) that's out of scope for this redesign pass. Building
a fake "Sign in with Google" button with no backend behind it would be worse than
the current token screen, so it isn't attempted here.

## Screen: first-run auth

**Before asking for anything**, show one calm explanatory screen — not a form:

- App identity: icon/wordmark, using `TextPrimary` on `Bg`.
- One sentence stating what the app does: "Track what you spend, fast." —
  `displayMedium`, `TextPrimary`.
- One supporting line on why sign-in is needed: "Sign in to sync your expenses
  across devices." — `bodyMedium`, `TextSecondary`.
- Primary action: a single full-width button, `ComponentSize.touchTarget` tall,
  `Radius.pill`, containing the standard Google "G" mark + "Continue with Google"
  label. No secondary/tertiary auth options, no "skip," no dev/debug affordances.
- No token field, no "paste your key" instructions anywhere on this screen — this
  is the explicit replacement for that pattern, not an addition alongside it.

## States

1. **Initial** — screen as described above, button enabled, idle.
2. **In progress** — button shows an inline `CircularProgressIndicator` (18dp,
   matching the pattern already used in `DraftCard.kt`'s Save button) in place of
   the label, button disabled, rest of screen unchanged. No full-screen spinner,
   no navigation away yet.
3. **Cancelled** (user dismisses the Google account picker) — return silently to
   Initial. Not an error: no error text, no snackbar. The user changed their mind;
   don't scold them for it.
4. **Failure** (network error, Google Play Services unavailable, backend rejected
   the token) — inline message below the button using the same non-silent-failure
   pattern as `DraftCard`'s `saveError`: `bodySmall`, `MaterialTheme.colorScheme.error`,
   explaining what went wrong in plain language ("Couldn't sign you in — check your
   connection and try again"), button re-enabled. Never a dialog, never a toast that
   disappears before it's read.
5. **Success → transition** — brief confirmation (reuse the same highlight-flash
   pattern already built for a new transaction landing, `TransactionRow`'s `isNew`
   `animateColorAsState`, applied here to a small checkmark/avatar moment) then
   navigate straight into Home. No separate "you're in!" interstitial screen.

## Explicit non-goals for this screen

- No manual token entry field, ever, on this screen.
- No exposed client IDs, scopes, or other dev/debug concepts in the UI.
- No resemblance to the old token-paste screen's layout or copy.
- No mock/fake auth — if the backend isn't ready, this screen doesn't ship.
- Nothing here should assume backend capabilities (session refresh, multi-device
  revocation, etc.) that don't exist yet — scope the first version to exactly what
  the backend can actually do once it exists.

## Implementation note for later

`ui/login/LoginScreen.kt` and `ui/login/LoginViewModel.kt` are the files to replace.
`AuthInterceptor`/`TokenStore` (`data/local/`) will need a second credential type
(Google-issued session token) alongside or instead of the static bearer token —
that's a backend-contract decision to make when this is actually picked up, not now.
