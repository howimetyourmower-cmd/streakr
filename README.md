# Streakr Starter PLUS (Next.js + Firebase + Vercel)

This starter gives you a working skeleton with:
- Next.js (App Router) + Tailwind (dark theme)
- Firebase Admin via **Base64 env** (single init, Vercel-friendly)
- Firebase Web SDK client helper (auth + Firestore)
- `/api/diag-admin` backend health check (Node runtime)
- Extra: **Leaderboards page**, **Rewards page shell**
- Extra APIs: **Question stats** (`/api/questions/[qid]/stats`) and **Comments** (`/api/comments/[qid]`)
- Clean path alias: `@/* -> src/*`

## Deploy steps
1. Push this folder to a new GitHub repo.
2. In Vercel → Env Vars, add:
   - `FIREBASE_ADMIN_PRIVATE_KEY_BASE64` (Base64 of the full serviceAccountKey.json)
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Redeploy with **Use existing build cache = OFF**.

## Verify
Visit `/api/diag-admin` on your deployment. You should see `{ ok: true, env: ... }`.

## Next steps
- Wire picks, streaks, and leaderboards to Firestore.
- Hook stats API to show YES/NO % after pick/lock.
- Add comment drawer UI to use the comments API.
- Implement Free Kick, badges, and admin panel.
