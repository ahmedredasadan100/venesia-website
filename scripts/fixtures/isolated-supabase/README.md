# Canonical Isolated Supabase / Public QA Bootstrap

Owner: repository QA / Verification. This is test infrastructure, not an Admin,
Media, Data Runtime or Production migration owner.

## Authority

`scripts/lib/isolated-supabase.mts` owns environment lifecycle, isolation,
identity/readiness checks, application handoff and exact-resource cleanup.
`scripts/qa-isolated-supabase.mts` is its thin caller.
`scripts/lib/isolated-public-application.mts` is the application-corpus adapter.
`scripts/verify-isolated-supabase.mts` owns focused verification and the guard
against executable historical bootstrap dependencies.

PostgreSQL initialization, Storage migration algorithms and platform ACL/RLS
remain owned by the official images and upstream initialization files. The
application schema remains owned by `sql/migrations/`. No copied platform SQL,
permission repair, registry repair or alternative schema is supplied here.

## Locked stack

The authoritative configuration is `stack.lock.json`, with `compose.test.yml`
bound by SHA256. It selects Linux/amd64 images from Supabase
`self-hosted/v0.8.1`, commit
`8c7a4d9dbbaf8b552893822e89d7bf06f33f9220`:

- PostgreSQL `17.6.1.136`;
- Storage API `v1.74.0`, including its complete bundled migrator;
- PostgREST `v14.17`;
- imgproxy `v3.31.4`, the Storage image-transformation dependency.
- Envoy `v1.39.1`, the same release's official API gateway and unchanged routing.

Execution uses manifest digests, never tags. Config/image IDs are verified as a
separate identity. The old local PostgreSQL and PostgREST images, containers,
volumes and networks are neither reused nor modified.

The application handoff separately pins the repository CI's official Supabase
CLI `2.116.0`. Its Windows executable is bound to the official npm package
integrity and executable SHA256 in the lock. It is an application migration
tool, not an additional platform service or a replacement Storage migrator.

The upstream source files are fetched from the exact commit, hashed, and
mounted unchanged from a new owned run directory. They are not imported from
historical QA artifacts and are not maintained as a project SQL fork.

## Order and roles

1. Validate source/lock/Compose identity and pre-existing Docker inventory.
2. Prepare fresh owned resources and generated local credentials.
3. Start only the dedicated unprivileged QA transport process using the already
   locked Storage image's Node executable. Prove absent external default routes
   and reserved-address denial before starting PostgreSQL or Storage.
4. Run the official PostgreSQL entrypoint and the release's mounted init files
   on the physical database `postgres`; preserve official role initialization.
   The host lifecycle binds only four exact
   `127.0.0.1` ports. Binary Docker exec stdio forwards to fixed internal targets;
   it does not implement SQL, HTTP, routing, authentication or Storage semantics.
   Verify the actual host PostgreSQL protocol before continuing.
5. Start official REST/imgproxy dependencies and Storage. Storage connects as
   `supabase_storage_admin` and executes its complete official migration chain.
6. Verify health, Storage history against the image's bundled migration loader,
   ownership and relevant ACL/RLS. `DB_INSTALL_ROLES=false` preserves the image's
   roles; `DB_ALLOW_MIGRATION_REFRESH=false` prevents hash-mismatch repair.
7. Verify REST and official gateway `/rest/v1/` readiness. REST's connection role
   remains `authenticator`; the gateway configuration and entrypoint are the
   pinned upstream files. Docker log retention for the gateway is disabled;
   credentials go in headers, never request URLs or retained logs.
8. Verify all container attachments and empty configured/operational Docker
   port bindings, absent transport default routes, internal alias identities and
   the reserved TEST-NET denial. No real Production endpoint is contacted.
9. Hand off to the application adapter through a live owner-issued local handle,
   with application SQL executed as `postgres` and exact corpus provenance.
10. Synthetic fixtures and application readiness may follow only after the
   reviewed application handoff succeeds. Bootstrap readiness alone does not
   prove application readiness or any Public gate.
11. Close owned host listeners and exec sessions before removing owned Docker
    resources. Verify all four host ports are released and old resources match.

## Application handoff boundary

The adapter reads the current canonical SQL files and validates their names,
ordering and normalized source hashes. The official CLI owns SQL application,
registry creation and parsed-statement recording. The lifecycle supplies its
owner-bound loopback URL and generated password privately. It does not accept
arbitrary commands, destinations or inherited credentials. Updates and telemetry
are disabled, and CLI home/state use fresh run-owned directories.
The CLI's private child environment explicitly uses `PGSSLMODE=disable` only
for the ownership-checked `127.0.0.1` target, matching this official image's
`ssl=off` and the lifecycle's existing local connection. No inherited SSL or
connection settings are accepted, and remote targets remain rejected.

Registry absence is handled by the official CLI. An actual CLI provenance
receipt is distinct from the repository's whole-file registry convention; do
not claim they are equal or bypass the existing registry-reconciliation target
guard. A migration failure stops without retry or permission repair. Historical
migrations can have data-dependent prerequisites. No fake historical row counts,
constraint renames, platform-function copies, skipped migrations or automatic
registry repair may be used to pass them. Cleanup disposes the owned fixture;
it does not claim to roll back every earlier SQL file.

Synthetic fixtures must be source-controlled callers of canonical domain tools;
they must not be copied from Production. Where the application needs the SEO
EXPAND/backfill/ENFORCE sequence, its existing official isolated tool and zero
failure verification remain authoritative. This capability does not implement
another backfill algorithm or waive those checks.

## Public fixture and the four retained closure gates

After the complete current corpus, `handle.preparePublicVerification()` calls
`scripts/lib/isolated-public-verification.mts`. It first looks for a published,
searchable article that satisfies the current publication and persisted SEO
owners. Only missing coverage creates an explicitly synthetic article and, if
needed, an isolated article category. It never repairs an incompatible fixture,
seeds an Admin account, performs Login, or copies Production data. Search modules
must already exist through their canonical application migration.

The approved fresh state has no Topics CMS page (`slug=topics` or `path=/topics`).
Preparation proves that absence and preserves it; it does not create a page or
assignment to satisfy a test. Central `/search` and the Media News launcher must
retain their complete existing composition. Topics Admin manageability remains
an explicit gap because its reserved route cannot be created through ordinary
Page Create. This gap is not claimed closed by the Public fixture.
It belongs to the existing Pages system-page bootstrap contract. A future
approved Topics identity starts `unpublished` with empty assignments; it must
not auto-publish or attach Search. Its title, `is_system` and remaining payload
require that Pages contract decision, not inference inside this Search migration.

After that DB readback, only the owned loopback Playwright job receives
`E2E_TOPICS_CMS_STATE=absent`. The existing Public test then proves HTTP success,
one H1, no Topics launcher, and the actual fallback listing with published article
links and sort controls. It still runs Media News launcher, central Search,
article-detail and all other Public assertions. Other configured environments
keep the existing expectations; unknown states and non-loopback overrides fail.

`handle.runPublicVerification({ additionalSourceFiles })` is the only fixed
Public gate entrypoint. Review the explicit new-source list before invoking it.
Tracked source plus that list is hashed into a new run-owned build workspace;
`.env*`, Git internals, debug output, private files, and ignored evidence are
excluded. No historical bootstrap or frozen source is imported. Generated local
API credentials remain inside the lifecycle and are provided only to Next's
build/server processes. The runner uses the normal Next build/start and the
existing product-surface, platform-contracts and Public Playwright commands;
it does not run the retained Admin or navigation checks.

The application control connection receives a bounded `SELECT 1` heartbeat only
while this fixed gate job is active. Failure aborts the job and its owned children;
there is no reconnect, retry, open-ended keepalive or transport-timeout change.
The timer is stopped in `finally`. Owned app processes and their loopback port
are closed, and the generated build workspace is removed before Docker cleanup.
Only sanitized logs, source identities and gate results remain.

Run A may prepare and capture its structural contract, then clean up. Run B may
prepare, compare that same structural contract, execute the four gates once,
then clean up. Successful bootstrap, preparation and source inspection are not
substitutes for actual four-gate results or the separate A/B/cleanup evidence.
The existing `qa-isolated-supabase.mts --final-public-proof` command orchestrates
these two independent runs and a bounded pre-handoff failure case. It requires
an explicit reviewed new-source manifest through
`VENISIA_PUBLIC_ADDITIONAL_SOURCE_MANIFEST`; this contains source paths only.
Its structural comparison covers schemas, relations, columns, constraints,
indexes, views, functions, triggers, policies, enum values, sequence configuration,
Storage history and application receipts. This is the declared test contract,
not an exhaustive PostgreSQL dump comparison. The current post-SEO security
declaration classifies the five later server-only tables without changing ACL/RLS.

## Isolation and failure behavior

- Credentials are generated for each run. Do not load `.env.local`, an existing
  session or Production settings; do not accept an arbitrary database URL.
- Runtime resources have a unique run identity and one internal Docker network.
  No container publishes Docker ports or joins a second network. Host access is
  the owned, bounded exec-stdio transport; its listeners bind only to loopback.
  No old Docker resource is attached. No daemon, route or Windows firewall
  configuration is changed.
- The transport accepts only `db:5432`, `rest:3000`, `storage:5000` and
  `api-gw:8000`, verifies ownership for each connection, and never accepts a
  caller-supplied destination. Its container receives no generated service
  credentials through configuration or environment. It forwards opaque protocol
  bytes, which may carry authentication, without interpreting or logging them.
  It has no Docker socket mount, privileged mode or network-administration capability.
- Network proof combines actual internal attachments and absent routes with a
  reserved documentation-address rejection. This establishes the external
  deny boundary without connecting to a Production endpoint. Loopback binding
  evidence and negative own-host NIC probes are distinct from a test performed
  from another LAN machine.
- Desktop engine readiness is stabilized before the original-resource snapshot,
  which remains retained unchanged. After owned resources are created, but before
  any service starts, a new baseline may accept only an empty default bridge with
  identical properties except its ID and creation time. The new creation time
  must be strictly between engine wake and the earliest owned-resource creation;
  the previous bridge must predate that wake. Every other original resource must
  still match exactly. The transition and both identities are recorded; final
  cleanup requires exact parity with the accepted operational baseline and has
  no bridge exception.
- Platform source downloads and image pulls use exact approved identities before
  runtime execution. Database/runtime access is limited to the owned environment.
- Do not print interpolated Compose, connection strings, generated tokens,
  passwords, raw Docker environment or unfiltered service errors/logs.
- Any identity, destination, history, ACL or readiness mismatch fails closed.
  There is no historical, Production, partially prepared database or SQL fallback.
- Cleanup validates resource ownership and captured identities before deletion;
  no Docker prune, broad filesystem deletion, old-volume removal or image deletion.
- Historical `.tmp-qa` recipes remain evidence only. The canonical owner must
  work without their presence; active imports or local Storage DDL fail the guard.

## Verification and closure

Run the focused verifier with `npm run verify:isolated-supabase`. The executable
QA command is `npm run qa:isolated-supabase -- <explicit owned output options>`;
consult its argument validation for required options. Successful platform-only
diagnostics cannot be credited as full application bootstrap.

Application handoff requires `--cli-binary` pointing to the installed official
Windows CLI executable whose bytes match the lock. The lifecycle checks it
before resource creation and the helper executes an independently verified copy.
`--cleanup-only` is limited to the recorded, ownership-checked failed creation;
it does not start services or apply SQL.

Acceptance requires two independent fresh successful environments, comparing
normalized platform/Storage and application migration/catalog/ownership/ACL/RLS
results, plus a safe failure-injection/cleanup proof. No successful run is inferred
from a historical fixture, a clone, a unit test or mere container health.

Only after full fixture acceptance may the caller run normal Next build,
product-surface `--build`, platform `--contracts-only`, and Public E2E against
the same final source, built artifact and isolated backend. Existing Navigation
benchmarks and successful unrelated gates are not rerun by this capability.

This infrastructure must never authorize Commit, Push, PR, deployment or
Production access. Runtime acceptance status is recorded in sanitized receipts,
not asserted by the existence of these source files.

Host PostgreSQL readiness must be proved through the owned loopback exec-stdio
transport; container health and an internal read-only query do not establish host
access. Do not disable isolation or change daemon/firewall settings to pass this
gate. The application adapter implements the canonical baseline, EXPAND, official
backfill verification and idempotency, then ENFORCE, and stops on any actual
failure. It never reports the pre-SEO baseline as the complete corpus. Runtime
success is established only by the current run's sanitized platform, application
and cleanup receipts. Source implementation or a partial successful attempt does
not prove full bootstrap, fresh A/B reproduction or Public gate completion.
