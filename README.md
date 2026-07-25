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
npm run verify:media-library-system
npm run verify:audit-coverage
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
- `npm run verify:media-library-system`
- `npm run verify:unified-content`
- `npm run verify:audit-coverage`
- `npm run build`

Required GitHub repository secrets (names only):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

CI does **not** run production SQL migrations.

## Admin audit logging

Critical CMS write actions (pages, topics, media, projects, menus, footer, site settings) are recorded in `admin_audit_logs`. Logging is **non-blocking** — a failed audit insert does not roll back the primary mutation.

```bash
npm run verify:audit-coverage
```

## Unified content administration

- Topics, news, press, site updates, video, and galleries share
  `/admin/content/topics`.
- Categories are managed at `/admin/content/categories`.
- Content series are managed at `/admin/content/series`.
- Media assets are managed at `/admin/media-library`.
- Media policies are managed at `/admin/settings/media`.
- `/admin/media-library` manages storage assets and usage; it does not recreate
  the removed `/admin/content/media` content CRUD engine.
- The former `/admin/topics`, `/admin/content/media`, and
  `/admin/media-center` admin engines were removed; do not recreate parallel
  CRUD surfaces.
- Run `npm run verify:unified-content-db` locally when live schema credentials
  are available. This is a read-only pre-deploy contract check and is not part
  of secretless CI.

## Documentation

- [Systems, Runtimes, Capabilities, and Unified Content](docs/SYSTEMS_RUNTIMES_CAPABILITIES.md)
- [QA, Release, Closure, and Audit Coverage](docs/QA_RELEASE_CLOSURE.md)
- [Roadmap and Debt Register](docs/ROADMAP_AND_DEBT_REGISTER.md)
- [Database and Migration Provenance](docs/DATABASE_MIGRATIONS_STORAGE.md)
- [Media Storage and Migration Safety](docs/DATABASE_MIGRATIONS_STORAGE.md)

## SQL migrations

Migration files live in:

```text
sql/migrations
```

Do **not** run production migrations without explicit approval.
