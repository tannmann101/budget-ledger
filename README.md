# Household Ledger

A lightweight, offline-capable budget tracker: income, accounts, debts, bills,
spending categories, net worth trend, and recent activity.

## Running locally

```
npm install
npm run dev
```

## Data & sync

Data lives in a shared Firestore document, synced live between every signed-in
device — no manual export/import needed for day-to-day use. Writes work offline
(they queue locally and sync automatically once you're back online), and both
phones/laptops see each other's changes within a second or two while online.

Access is locked down with Google sign-in: only the two email addresses listed
in `firestore.rules` can read or write the ledger. The **export** button still
exists for taking a manual backup snapshot before something risky (like a reset).

## Installing as an app

Once deployed (see below), open the site in your phone's browser and use
"Add to Home Screen" (iOS Safari share menu, or Chrome's install prompt on
Android) to install it like a native app.

## One-time cloud setup (free, ~10 minutes)

1. Go to <https://console.firebase.google.com>, sign in, and create a new
   project (no credit card needed — the free "Spark" plan is enough).
2. **Enable Firestore**: in the left sidebar, Build → Firestore Database →
   Create database → start in **production mode** → pick any region.
3. **Enable Google sign-in**: Build → Authentication → Get started → Sign-in
   method tab → enable the **Google** provider.
4. **Authorize your domain**: still in Authentication → Settings → Authorized
   domains → add `<your-username>.github.io`.
5. **Register a web app**: Project settings (gear icon) → General → "Your apps"
   → Add app → Web (`</>`). Copy the `firebaseConfig` object it gives you.
6. Paste those values into [src/firebase.js](src/firebase.js), replacing the
   `REPLACE_ME` placeholders.
7. **Deploy the security rules** in [firestore.rules](firestore.rules) — the
   emails are already set to your two accounts, so just run:
   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project <your-project-id>
   ```
   (or paste the contents of `firestore.rules` directly into Firebase Console →
   Firestore Database → Rules → Publish).
8. Commit and push. Once the site redeploys, open it, sign in with Google on
   both your and your wife's phone, and you should see the same live data.

If either of you ever needs to change which accounts are allowed, edit the
email list in `firestore.rules` and redeploy the rules (step 7).

## Local development against a fake project (no real Firebase needed)

`.env.local` already sets `VITE_USE_FIREBASE_EMULATOR=true`, so `npm run dev`
talks to a local emulator instead of your real project — useful for testing
without touching real data. Requires a Java runtime installed once.

```
npm run emulators   # starts local Auth + Firestore emulators
npm run dev          # in another terminal
npm run test:rules   # scripted checks of firestore.rules (allow-list + live sync)
```

## Deploying to GitHub Pages (free)

1. Create a new GitHub repo named `budget-ledger` (or update `base` in
   `vite.config.js` and `start_url`/`scope` in the manifest to match your repo name).
2. Push this project to the `main` branch of that repo.
3. In the repo settings → Pages, set the source to "GitHub Actions".
4. The included workflow (`.github/workflows/deploy.yml`) will build and deploy
   automatically on every push to `main`.
5. Your app will be live at `https://<your-username>.github.io/budget-ledger/`.
