# Butxaca 👛

A Monefy-style expense tracker: **tap +, pick a category, type the amount.** Tap the donut to see where the money went.

## Run it

```bash
npm install
npm start        # desktop app (Electron), phone-sized window
npm run web      # same app in any browser → http://localhost:5173 (open it on your phone on the same Wi-Fi)
npm test         # data-layer unit tests
```

## What's in the MVP (v0.1)

- **+ Expense** → category grid → amount keypad with currency (EUR, USD, GBP, CHF, JPY), date and optional note.
- **Tap a category icon** on the main screen to add straight into it (Monefy shortcut).
- **Donut** of spending per category for the selected period; **tap it** for the breakdown: categories sorted by total with % bars, expand to see/delete individual expenses.
- **Periods**: Day / Week / Month / Year / All, with ‹ › arrows (or swipe on touch).
- **Undo** after adding or deleting.
- **Currency chip** (top right) switches which currency the totals show. No FX conversion — each currency is totalled separately.
- **⤓ Export** to CSV — opens directly in Google Sheets / Excel.
- Keyboard on desktop: type digits, `,`/`.`, Backspace, Enter to save, Esc to close.
- Data is stored locally (Electron's localStorage).

## Data model = spreadsheet columns

Every expense is one flat row, so Google Sheets can become the database without changing the UI:

| id | date | category | amount | currency | note | createdAt |
|----|------|----------|--------|----------|------|-----------|
| uuid | `YYYY-MM-DD` | category id (e.g. `eating_out`) | number | ISO code | text | ISO timestamp |

Category **ids** are stable (labels/icons can change), so other apps reading the sheet can rely on them.

## Project layout

```
src/main/          Electron main + preload (thin shell; future home of Google OAuth)
src/renderer/      The whole app — plain HTML/CSS/JS modules, no build step
  data/store.js    Storage interface (list/add/remove/restore) + CSV export
  data/period.js   Day/week/month/year ranges
  data/categories.js
scripts/serve.js   Zero-dependency static server for `npm run web`
test/              node:test unit tests
```

## Roadmap

1. **Google Sheets as the database** — add a `SheetsStore` with the same interface as `LocalStore`: OAuth in the Electron main process, `spreadsheets.values.append` on add, read on startup, keep the local store as an offline cache/queue.
2. **Import from spreadsheet** (CSV first, then directly from the Sheet).
3. **Recurring charges** — the monthly things drained from the account (rent, subscriptions…) auto-added each month.
4. **Real mobile build** — the renderer is plain web code, so wrap it with Capacitor (iOS/Android) or install as a PWA.
5. Custom categories, editing an expense, income/balance (if wanted).
