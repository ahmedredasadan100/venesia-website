# Topics command completion and Menu reference integrity

This change extends the existing Topics Actions, Data mutation owner, atomic RPCs, and canonical Admin audit log. It introduces no command table, queue, reconciliation runtime, or alternate domain registry.

## Database application order

Apply the existing corpus through `20260925200723_topics_batch_atomic_current_state.sql`, then:

1. `20260926013156_menu_resource_reference_integrity.sql`
2. `20260926013216_topics_command_completion.sql`

Production application is a separate reviewed cutover. These files are not applied to Production by this tranche.

The Menu migration adds generated projections of the existing `linked_type`/`linked_id` fields and validated native foreign keys for Pages, Projects, Topics, Categories, and Series. Existing dangling references abort the migration atomically. It does not silently repair data. Static routes and arbitrary URL/JSON references do not share this relational invariant.

The command migration changes the existing two Topics RPC signatures by adding an optional final `p_command_id uuid`. Old callers can omit it. New callers send it explicitly, so PostgREST against an old schema rejects the unresolved signature before any domain write. There is exactly one overload per RPC, with the existing service-role-only execution grants.

## Completion states

- `not_committed`: preflight rejection or an explicit database statement rejection. The Data owner may restore its optimistic snapshot.
- `committed`: a validated atomic result or actor-bound immutable audit receipt proves the command committed. Readback/media/cache failures can warn but do not reverse that fact.
- `unknown`: transport or payload delivery cannot establish completion and the receipt cannot yet be read. Absence of a receipt does not prove rollback: the transaction may still be running.

The server checks command identity before target availability preflight. The database locks actor/UUID identity before reading its receipt and before target writes. An exact retry returns the original immutable result; reuse for a different normalized intent is rejected. A new intent uses a new UUID. A replay of an older committed command does not overwrite a newer opposite intent.

The receipt and canonical audit information commit in the same transaction as the domain write. A receipt insert failure rolls back the domain write. Receipt updates and deletion are rejected; the existing Admin-user foreign key may still null its actor reference when that user is deleted, while immutable metadata retains the original actor identity.

## Recovery adoption

Receipt recovery is opt-in in the existing Data owner for six Topics paths: featured state, move to trash, restore, permanent delete, bulk commands (including publish), and Empty Trash. The client allocates identity before dispatch. While mounted, an unresolved command retains that identity, same-intent retry reads the receipt only, and a conflicting opposite intent is blocked until resolution. The existing Collection toolbar exposes a read-only recovery control.

Recovery reads the receipt for the authenticated actor, retries required media cleanup for purge, and requests the existing cache/path invalidations. It never reissues a domain RPC and never writes another audit receipt. Confirmation of domain commit does not claim remote cache backend delivery; a deferred Next settlement failure can be recovered by another request using the same receipt.

Single status changes retain their existing direct revision-checked update. Duplicate/create paths do not adopt the receipt contract in this change. Retained client identity is not claimed to survive navigation, reload, or another tab. Universal create idempotency and cross-client ordering require separate evidence and, for ordering, a defined product contract.

## Verification owners

- `scripts/verify-menu-resource-integrity-isolated.mts`: actual Menu/Topics RPCs, two PostgreSQL sessions, observed lock waits, single/selected/Empty Trash, both transaction orders, rollback, and five target providers.
- `scripts/verify-topic-command-completion-isolated.mts`: actual action source, installed Supabase SDK, real PostgREST and full schema, commit then dropped acknowledgement, receipt recovery, audit failure rollback, replay/conflict, and unchanged grants.
- `scripts/verify-deferred-next-command-recovery.mts`: installed Next action settlement and cache backend fault, followed by a healthy read-only recovery request. This is local Next evidence, not Vercel adapter equivalence.
- `scripts/qa-admin-settled-result-adoption.mjs`: actual mounted Data/adapters/Feedback and recovery-control interactions.
- `scripts/verify-audit2-root-cause-isolated.mts`: one canonical owned lifecycle for the native matrix, complete enumeration and full public-schema/data/registry restore.

The existing canonical isolated application owner replays the entire migration corpus, performs schema-phase-appropriate SEO backfill and idempotency checks, and owns all connections, API access, credentials, generators, and cleanup. Verification evidence must retain the distinction between source, mounted runtime, native persistence, authenticated browser, CI, and deployment behavior.
