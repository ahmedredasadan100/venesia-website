<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a Next.js 16 (App Router, Turbopack) CMS backed by **Supabase (Postgres + PostgREST + Storage)**. There is no separate backend — Next.js server actions/routes are the backend. The app reads/writes Supabase over REST via `@supabase/supabase-js`, so a running Supabase stack is required for anything beyond static pages. Standard scripts live in `package.json` (`dev`, `build`, `lint`, `typecheck`, `verify:*`) and CI is `.github/workflows/quality-gate.yml`.

### Local Supabase is required to run/test the app
The update script only refreshes npm deps. Docker + the Supabase CLI are pre-installed in the snapshot, but the Docker daemon and Supabase stack are **not auto-started**. Bring them up manually each session:

- Start the Docker daemon (systemd is not running in the container): `sudo dockerd &` — or reuse the `dockerd` tmux session if present. If the socket rejects the `ubuntu` user, run `sudo chmod 666 /var/run/docker.sock`.
- Start Supabase from the repo root: `supabase start`. This serves the REST API at `http://127.0.0.1:54321` (Studio at `:54323`, Postgres at `:54322`). The anon/service-role keys it prints are the shared local defaults and are already written into `.env.local`.
- `.env.local` is gitignored and must exist (points at the local stack + a dev `ADMIN_SESSION_SECRET`). Recreate it if missing using the `supabase start` keys.

### Database bootstrap (one-time per fresh Supabase volume)
The `supabase start` DB is empty. Apply schema + fix grants + seed admin:

- Apply migrations in order: `cd sql/migrations && for f in $(ls *.sql | sort); do docker exec -i supabase_db_workspace psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f"; done`
- **Gotcha:** the migrations create tables as `postgres` but do NOT grant DML to the Supabase roles, so PostgREST returns `42501 permission denied` (even for the service role, which the SSR/public pages use). After migrating, grant privileges and reload the schema cache:
  `docker exec -i supabase_db_workspace psql -U postgres -d postgres -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role; NOTIFY pgrst, 'reload schema';"`
- Seed/reset the admin login: `ADMIN_BOOTSTRAP_PASSWORD='AdminDev123!' node scripts/seed-initial-admin.mjs` then `node scripts/reset-admin-password.mjs admin --password 'AdminDev123!'` (the `admin_users` migration ships a row with an unknown hash, so a reset is needed to get a usable password). Admin login lives at `/admin`; the login API field is `username` (not `identifier`).

### Notes
- `npm run dev` uses Turbopack and reads `.env.local`. Public site is `/`, CMS is `/admin`.
- `npm run lint`, `npm run typecheck`, `npm run build`, and the CI `verify:*` scripts run WITHOUT a database. Only `verify:unified-content-db` / `verify:db-health` need live Supabase creds.
- `supabase/config.toml` is committed so `supabase start` works out of the box; do NOT commit `.env.local` (gitignored, local-dev only).
