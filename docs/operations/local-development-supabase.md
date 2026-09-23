# Development Supabase Start Contract

Owner: Developer Environment tooling. The application schema continues to be
owned only by `sql/migrations`.

## Daily workflow: Online Supabase

The approved daily CMS workflow is local application code against the reviewed
Online Supabase project. `.env.local` remains ignored and supplies that target.

`npm run dev` runs a fail closed, read only preflight before Next.js starts. The
preflight accepts only the repository reviewed Online project reference, proves
that the API URL and database connection identify the same project, opens a
read only transaction, and compares the complete ordered migration registry to
`sql/migrations`. A missing, renamed, extra, reordered, or pending migration
stops startup. The preflight never applies SQL or repairs migration history.

## Optional persistent Local Supabase

Persistent Local Supabase remains an explicit QA, migration rehearsal, and
isolated schema verification capability. It is not the default CMS content
source.

- `npm run dev:db:start` starts or reuses the persistent stack, verifies its
  recorded migration prefix, applies a valid forward suffix, and deliberately
  updates the ignored `.env.local` to the local target.
- `npm run dev:db:stop` stops local services and preserves local data.
- `npm run dev:db:reset` deliberately rebuilds only the local stack.
- When `.env.local` selects the local stack, the same `npm run dev` preflight
  delegates to the local compatibility contract before Next.js starts.

Build and CI do not start or require the local stack. Ephemeral QA continues to
use `runIsolatedSupabase` and its separate resources and cleanup lifecycle.

## Local migration behavior

`supabase/migrations` is an ignored generated projection. Every generated file
is recreated from `sql/migrations` with normalized line endings and verified by
SHA256. The local state stores the exact source hash for every applied entry.

The local lifecycle fails closed when it sees a missing historical entry, an
unexpected entry, a renamed migration, a changed applied source, a partial
Entity SEO cutover, a missing local provenance record, or a linked remote
project. It does not repair history, replay SQL, relabel receipts, or reset
automatically.

## Environment separation

The optional local identity remains:

- project id: `venisia-local-development`
- API: `http://127.0.0.1:54321`
- database: `127.0.0.1:54322/postgres`
- database role: `postgres`

The daily Online target must use HTTPS, the reviewed project reference, and a
matching direct or Supavisor database identity. The Online preflight never logs
credentials and never changes `.env.local`, Vercel environment values, GitHub
secrets, Preview, or Production.

## Troubleshooting

- `ONLINE_DATABASE_BEHIND_REPOSITORY`: the selected Online database is missing
  a repository migration; do not bypass the preflight.
- `ONLINE_HISTORY_DIVERGED` or `ONLINE_HISTORY_HAS_UNEXPECTED_MIGRATION`:
  reconcile the migration decision separately before development continues.
- `ONLINE_PROJECT_NOT_APPROVED` or `ONLINE_DATABASE_IDENTITY_MISMATCH`: restore
  the officially saved project values; do not weaken the target check.
- `LOCAL_DATABASE_BEHIND_REPOSITORY`: run `npm run dev:db:start` to apply the
  verified local forward suffix.
- `LOCAL_HISTORY_DIVERGED`, `LOCAL_APPLIED_SOURCE_DRIFT`, or
  `LOCAL_PROVENANCE_STATE_MISSING`: inspect local state, then use the explicit
  reset command only if discarding local data is acceptable.
- `REMOTE_PROJECT_LINK_PRESENT`: unlink the local CLI project through the
  official Supabase workflow before using Local DB commands.
