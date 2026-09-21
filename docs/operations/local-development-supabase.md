# Persistent Local Development Supabase

Owner: Developer Environment tooling. The application schema continues to be
owned only by `sql/migrations`. This workflow never links a remote Supabase
project and never accepts a database URL from the shell or `.env.local`.

## First setup or deliberate rebuild

1. Start Docker Desktop.
2. Install repository dependencies with the locked package versions.
3. Run `npm run dev:db:reset`.
4. Run `npm run dev`.

Reset deletes only the Docker resources identified by the committed local
project id `venisia-local-development`. It then creates a fresh official
Supabase CLI stack on loopback, applies the current repository migrations in
order, runs the existing Entity SEO backfill between EXPAND and ENFORCE, and
installs synthetic development fixtures. It does not read or copy Production.
The daily website stack keeps Database, API gateway, PostgREST, Auth, Storage,
Realtime, Mailpit, metadata and Studio. Edge Functions, Analytics/Logflare,
Vector and the disabled pooler are excluded because this application does not
use them in its localhost public or Admin paths.

## Daily workflow

- `npm run dev:db:start` starts or reuses the persistent stack, verifies its
  recorded migration prefix, applies a valid forward suffix, and updates the
  ignored `.env.local` with keys emitted by that local stack.
- `npm run dev` first runs the read only database and environment preflight,
  then starts Next.js.
- `npm run dev:db:stop` stops the local services and keeps development data.

Build and CI do not start or require the local stack. Ephemeral QA continues to
use `runIsolatedSupabase` and its separate resources and cleanup lifecycle.

## Migration behavior

`supabase/migrations` is an ignored generated projection. Every generated file
is recreated from `sql/migrations` with normalized line endings and verified by
SHA256. The local state stores the exact source hash for every applied entry.

On start, the workflow fails closed when it sees a missing historical entry,
an unexpected entry, a renamed migration, a changed applied source, a partial
Entity SEO cutover, a missing local provenance record, or a linked remote
project. It does not repair history, replay SQL, relabel receipts, or reset
automatically. Run `npm run dev:db:reset` only after deciding that the local
development data may be discarded.

## Environment separation

The only accepted runtime identities are:

- project id: `venisia-local-development`
- API: `http://127.0.0.1:54321`
- database: `127.0.0.1:54322/postgres`
- database role: `postgres`

`.env.local` remains ignored. The workflow changes only the three Supabase
application values and the `VENISIA_SUPABASE_TARGET` marker in that local file.
It does not modify Vercel environment values, GitHub secrets, Preview, or
Production.

## Troubleshooting

- `LOCAL_DATABASE_BEHIND_REPOSITORY`: run `npm run dev:db:start` to apply the
  verified forward suffix.
- `LOCAL_HISTORY_DIVERGED`, `LOCAL_APPLIED_SOURCE_DRIFT`, or
  `LOCAL_PROVENANCE_STATE_MISSING`: inspect the repository state, then use the
  explicit reset command if discarding local data is acceptable.
- `REMOTE_PROJECT_LINK_PRESENT`: remove the local CLI link through the official
  Supabase unlink workflow before using these commands.
- `LOCAL_ENVIRONMENT_TARGET_MISMATCH`: run `npm run dev:db:start` to rewrite
  only the local Supabase values from the running stack.
