# Database, Migrations, Audit, and Media Storage

**Status:** Canonical safety and ownership contract
**Architecture authority:** `../AI_ARCHITECTURE_PRINCIPLES.md`

## 1. Data authority

The server and database are authoritative for domain state.

Client caches improve interaction speed. They do not become independent business truth.

Privileged database and storage clients are server-only.

## 2. Migration truth has three separate parts

Never collapse these facts:

1. A migration file exists in `sql/migrations/`.
2. The target schema or behavior exists remotely.
3. The migration registry records the version and provenance correctly.

One does not automatically prove the others.

A remote RPC body matching a file is not, by itself, clean migration provenance.

## 3. Migration rules

- Prefer additive migrations.
- Do not replay all repository migrations against Production.
- Do not assume idempotency.
- Do not replay seed migrations on populated environments.
- Do not infer live RLS, functions, triggers, grants, or Storage state from repository files alone.
- Do not use a green build as permission to mutate Production.
- Do not modify migration history to hide manual application or drift.
- A manual application must be documented and reconciled.

## 4. Migration execution gate

Before any migration application, record:

| Gate | Required evidence |
|---|---|
| Exact claim | The schema or data problem being solved |
| Current state | Repository file, remote metadata, and registry state |
| Classification | Additive, corrective, backfill, destructive, seed, or policy |
| Data impact | Rows, locks, compatibility, downtime, and failure behavior |
| Minimal change | Smallest safe migration |
| Target | Local, isolated, Preview, Staging, or Production |
| Rollback | Rollback or forward-fix plan |
| Approval | Explicit Project Owner approval |
| Verification | Schema behavior, registry truth, application tests |
| Production | Separate approval for live application and deployment |

Do not apply an unexpected or destructive migration during a UI, cleanup, documentation, or architecture-adoption task.

## 5. Fresh environment rule

A new Supabase environment requires a dedicated rebuild plan.

Before applying the migration chain to a fresh environment:

1. obtain or create a reviewed schema-only baseline;
2. verify ordering and dependencies;
3. separate DDL from seeds;
4. classify environment-specific policies;
5. verify RLS, grants, functions, triggers, and Storage;
6. test in isolation;
7. run application validation and closure suites;
8. document rollback and rebuild behavior.

A reconstructed draft is not an authoritative live schema export.

## 6. Atomic domain mutations

A mutation must be atomic when partial success would corrupt domain truth.

Examples:

- taxonomy row plus related Topic relationships;
- transfer/delete flows;
- multi-table configuration changes;
- assignment replacement;
- mutations that must preserve counts and foreign-key integrity.

The shared Runtime owns pending, feedback, optimistic state, and rollback. The Domain service or transaction/RPC owns atomic business truth.

## 7. Foreign keys, soft delete, and counts

For every relation, define:

- `ON DELETE` behavior;
- restore semantics;
- hard-delete guard;
- transfer behavior;
- orphan prevention;
- count semantics.

Active list/count semantics may exclude `deleted_at IS NOT NULL`.

Hard-delete safety may still count linked soft-deleted rows because those rows preserve restore and FK integrity.

Do not unify different count meanings under one vague `count`.

## 8. Read models and RPCs

Read models may aggregate rows, metrics, relationships, and actor labels for one contract.

They must:

- avoid N+1 queries;
- return consistent rows and totals;
- validate result shape;
- remain an optimized view of domain truth, not a hidden second business source.

RPCs are appropriate when they:

- enforce atomic invariants;
- reduce inconsistent multi-call mutations;
- return a stable validated result;
- are versioned and tested.

Do not use RPCs to hide arbitrary logic without a contract.

## 9. Audit contract

Critical successful Admin mutations should use the canonical audit boundary.

Audit is non-blocking by default:

- audit failure does not roll back the primary mutation;
- failures are caught and logged server-side;
- action names are stable;
- actor context is server-resolved;
- metadata is small and sanitized;
- secrets, passwords, tokens, and oversized payloads are prohibited.

Changing audit from non-blocking to blocking requires a dedicated architecture decision.

## 10. Media storage provider policy

Runtime uploads use one durable storage contract.

- Production and Vercel Preview must use Supabase Storage.
- Production and Preview must not fall back to deployment filesystem or `/tmp`.
- Local development may use the filesystem adapter when explicitly allowed by configuration.
- Static bundled brand/project assets may remain in `public/`; they are not runtime uploads.
- Service Role credentials stay server-only.

Adding another persistent provider requires a product requirement and architecture decision.

## 11. Media operation contract

The Media Storage Adapter may own:

- folder and object listing;
- image and document upload;
- stable public URLs;
- managed-object detection;
- metadata such as MIME, size, provider, key, and timestamp;
- safe managed deletion.

The secured API/action boundary owns:

- Admin authentication;
- MIME and extension validation;
- size limits;
- safe names;
- traversal rejection;
- bucket/folder allowlists;
- reference checks before deletion;
- stable safe errors.

## 12. Legacy media compatibility

Legacy `/images/**` and `/files/**` values may remain readable.

They are compatibility inputs, not permission for new Production filesystem writes.

Legacy unmanaged assets must not be deleted through the managed runtime endpoint.

No destructive media backfill is implied merely because the storage provider changed.

## 13. Explicit empty versus omitted

These states are different:

- new file supplied;
- explicit empty value;
- field omitted;
- existing value preserved.

An explicit empty field may mean intentional removal.

An omitted legacy field may mean preserve the existing association.

Do not collapse these semantics through truthy fallback such as `next || current`.

## 14. Media deletion and replacement

Before deletion:

1. authenticate Admin;
2. verify the path is a managed asset;
3. validate provider and bucket;
4. require synchronized catalog state and the exact provider-registry version;
5. check persisted references;
6. complete a fresh exhaustive provider scan and reject every query error, drift, or matching reference;
7. verify that the exact managed Storage object exists;
8. reject unsafe, external, unmanaged, missing, or uncertain assets;
9. delete through the adapter;
10. update catalog state and record audit.

Replacement always creates a new `(provider, bucket, object_key)`. Rebind supported references only after the new catalog row exists, compensate partial failures, and retain the old object. Same-path overwrite and automatic old-object deletion are prohibited.

## 14.1 Media Catalog migration boundary

`20260725090000_media_catalog_reference_foundation.sql` adds the catalog tables, service-role-only grants under RLS, read views, synchronization functions, root folders, and runtime settings keys. File presence is repository evidence only. Remote schema/grants/policies/function behavior and initial reconciliation require separate environment proof; no remote application is implied by this document.

## 15. Security boundaries

- Navigation visibility is not authorization.
- Server actions, APIs, RPCs, and storage operations enforce access server-side.
- Validate route params, query params, FormData, IDs, enums, URLs, file metadata, RPC inputs, and RPC outputs.
- Authenticated Admin responses must not use public shared caching.
- Safe internal URLs begin with one `/`, not `//`, and resolve to the same origin.
- No private stack trace, SQL, service key, or unnecessary personal data reaches the client.

## 16. Required proof for data closure

A data or migration phase cannot close until the declared scope proves:

- repository migration state;
- target schema behavior;
- registry provenance or explicit debt;
- atomicity;
- authorization;
- failure non-mutation where required;
- integration behavior;
- disposable fixture cleanup;
- rollback or forward-fix understanding;
- exact-head Quality Gate.

## 17. Current-state boundary

Specific applied migration versions, remote registry facts, schema drift, and open data debt belong in:

- `CURRENT_PROJECT_STATE.md`;
- `ROADMAP_AND_DEBT_REGISTER.md`;
- current migration verification;
- the relevant PR evidence.

Do not freeze volatile counts or remote facts inside this safety contract.

## 18. Current reconciliation owner

The repository uses one executable reconciliation guard:

```bash
npm run verify:database-reconciliation
npm run verify:database-reconciliation-live
```

Structural mode verifies the canonical migration corpus and retired-owner guards without requiring Production credentials. Live mode opens a read-only transaction and proves:

- exact repository/registry version order;
- exact SQL provenance for every registered migration;
- repository provenance for application-owned public relations, functions, explicit indexes, triggers, and policies;
- explicit RLS, policy, and privilege classifications for every public application table at the verified migration boundary;
- valid/ready/live indexes;
- validated constraints;
- no parallel public function overload names;
- valid current views;
- the migration-registry reconciliation audit record.

`scripts/reconcile-migration-registry.mts` is the only registry-repair tool. It requires an explicit `--apply`, takes a transaction-scoped advisory lock plus an exclusive registry lock, validates known aliases before mutation, writes canonical repository SQL, verifies the result before commit, and records one sanitized audit event. It never replays repository migrations or seeds.

Historically present `public.rls_auto_enable()` and its event trigger require their own catalog and provenance evidence. Application cleanup must not drop them. Their historical presence does not prove that the pinned fresh Supabase image installs them, or that their absence has an equivalent automatic replacement.

### 18.1 Approved public-table security contract (Hybrid D)

The existing Database/Migration Security Contract owns explicit table security. The migration applies the reviewed RLS and least-privilege declarations; the reconciliation verifier reads the same declaration and rejects catalog drift. Verification never installs, repairs, or grants permissions.

The executable `v_contract` JSON literal in [`20260819040000_database_rls_security_contract.sql`](../sql/migrations/20260819040000_database_rls_security_contract.sql) is the single classification source. [`database-rls-security-contract.mts`](../scripts/lib/database-rls-security-contract.mts) consumes that literal for the existing reconciliation owner. There is no second policy manifest, database metadata table, or replacement platform event trigger.

| Classification | Required contract |
|---|---|
| A | RLS enabled; explicitly scoped client read grants and the declared SELECT policies. |
| B | RLS enabled; no client grants or client policies; privileged server/RPC access remains explicitly bounded. |
| C | A separately approved RLS-off exception with its reason and approval recorded in the migration declaration. |

Missing, ambiguous, or unclassified tables fail closed. An unclassified table still fails when RLS is enabled: RLS alone does not establish its intended access contract. Owner, FORCE RLS, policy predicates/roles, effective grants, column privileges, role memberships, schema privileges, creator defaults, and sequence privileges must match the declared boundary. No blanket `FORCE ROW LEVEL SECURITY` is implied; owner and privileged-role bypass must be accounted for in the approved server/RPC contract.

Application DDL must use the approved migration handoff. Restricted client defaults and the verification guard do not constitute automatic RLS enforcement for out-of-band DDL. Manual grants, permission-repair SQL, and manual table creation are not an installation path. An explicitly approved, rolled-back QA negative fixture may test guard rejection without joining the application migration corpus.

Revision 1 is scoped to the captured **56-table isolated checkpoint before historical Migration 86**, with no C exception. That is a fixed verification boundary, not a Production inventory or a claim about later migrations. A future schema change must introduce an approved migration declaration revision that explicitly supersedes the previous revision, migration version, and source hash; the verifier selects the applicable declaration through the requested migration boundary. A later unclassified table is a blocked contract change, not permission to extend a copied allowlist.

This migration was authored on **2026-09-16**. Its `20260819040000` filename is an explicit dependency-order version before historical Migration 86, not a backdated execution claim. Existing-database and Production application require separate authorization and target-state/provenance review. Historical Migration 86 remains unchanged; this declaration neither replays it nor satisfies an unproven prerequisite on its behalf.

Source verification and isolated behavioral evidence remain separate. Role tests, policy visibility, canonical server/RPC writes, rollback, and cleanup must pass on the owned isolated fixture before that boundary can close. Neither the declaration nor its documentation claims that runtime verification, the later application chain, or the remaining Public gates have passed.

### Remaining decision boundaries

- Migration-file presence, live behavior, registry provenance, Git deployment, and Production smoke remain separate facts even when all are green.
- Role semantics and login-abuse policy require Product/Security authority; RLS presence does not invent those policies.
- No index, RPC, cache, or read-model migration is justified solely by source size or query-shape suspicion without measurement.

### Historical migration references

Published migrations are immutable historical records. A comment in an already published migration may reference documentation that no longer exists in the active tree. Such a comment is historical provenance, not a Runtime dependency, and must not be rewritten solely for Documentation Reset link cleanup.

Any future migration or data work requires its own authorization, remote-state proof, failure plan, and cleanup contract.
