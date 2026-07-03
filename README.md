# Household Ledger

A lightweight, offline-capable budget tracker: income, accounts, debts, bills,
spending categories, net worth trend, and recent activity — all client-side.

## Running locally

```
npm install
npm run dev
```

## Data & sync

All data lives in `localStorage` on whatever device/browser you're using — there's
no server, no account, and nothing leaves your device. Since each device keeps its
own copy, use the **export** / **import** buttons in the top right to move a
snapshot from one device to another (e.g. phone → laptop).

## Installing as an app

Once deployed (see below), open the site in your phone's browser and use
"Add to Home Screen" (iOS Safari share menu, or Chrome's install prompt on
Android) to install it like a native app. It's a PWA, so once it's loaded once
it keeps working with no internet connection.

## Deploying to GitHub Pages (free)

1. Create a new GitHub repo named `budget-ledger` (or update `base` in
   `vite.config.js` and `start_url`/`scope` in the manifest to match your repo name).
2. Push this project to the `main` branch of that repo.
3. In the repo settings → Pages, set the source to "GitHub Actions".
4. The included workflow (`.github/workflows/deploy.yml`) will build and deploy
   automatically on every push to `main`.
5. Your app will be live at `https://<your-username>.github.io/budget-ledger/`.
