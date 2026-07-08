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
npm run verify:legacy-media-admin
npm run build
```

Optional combined checks:

```bash
npm run verify
npm run ci:check
```

## CI / Quality Gate

GitHub Actions workflow: `.github/workflows/quality-gate.yml`

Runs on pull requests and pushes to `main`:

- `npm run lint`
- `npm run typecheck`
- `npm run verify:migrations`
- `npm run verify:legacy-media-admin`
- `npm run build`

Required GitHub repository secrets (names only):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

CI does **not** run production SQL migrations.

## Admin media

- Unified Media Admin (official): `/admin/content/media`
- Legacy `/admin/media-center` routes are **redirect-only** compatibility stubs
- Do **not** add new CRUD under `/admin/media-center`

## SQL migrations

Migration files live in:

```text
sql/migrations
```

Do **not** run production migrations without explicit approval.
