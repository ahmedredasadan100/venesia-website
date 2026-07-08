# Venesia

CMS-backed website for Venesia Real Estate Development.

## Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Supabase

## Required environment variables

Names only — values belong in `.env.local` / hosting secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_FETCH_TIMEOUT_MS` (optional; default `8000`)

## Commands

```bash
npm run lint
npm run typecheck
npm run verify:migrations
npm run build
```

Optional combined check:

```bash
npm run verify
```

## SQL migrations

Migration files live in:

```text
sql/migrations
```

Do **not** run production migrations without explicit approval.
