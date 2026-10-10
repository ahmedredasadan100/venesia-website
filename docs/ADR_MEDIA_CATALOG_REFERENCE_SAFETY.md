# ADR: Media Catalog and Reference Safety

**Decision status:** Accepted
**Implementation status:** Implemented and guarded, including canonical read-only legacy Project assets; live destructive readiness remains environment-specific and must be reconciled independently
**Date:** 2026-07-25

## Context

Runtime uploads already have one durable provider boundary, but a storage listing is not an authoritative media model. The previous delete flow could not prove that every supported reference owner had been scanned completely. The product also needs one management surface and one picker without creating another Runtime or a parallel Media system.

## Decision

- Extend the existing Media capability and Storage Adapter owner.
- Persist `media_assets`, `media_folders`, and `media_references`.
- Identify a managed asset by `(provider, bucket, object_key)`, never by a fuzzy URL match.
- Treat Supabase Storage as the object source and Media Catalog as the administrative/reference read model.
- Discover references through a typed provider registry. Domain writes synchronize their provider; reconciliation is the repair and initial-backfill path.
- Delete only when catalog state and provider-registry version are synchronized, a fresh exhaustive provider scan is complete, and the exact managed object exists. Usage is advisory: show its count and locations and require explicit `حذف رغم الاستخدام` confirmation for referenced targets. A reservation retains that decision through finalization and recovery. Query errors, identity drift and unresolved write leases still fail closed. Authored content references are never changed by deletion.
- Replacement uploads a new unique object, then rebinds every supported reference with compensation on partial failure. It never overwrites the existing object path and never deletes the old asset automatically.
- Folder paths are normalized catalog records backed by Storage prefixes. Empty folders may exist only in the catalog; Storage has no physical empty-directory object.
- Legacy `/images/**` and `/files/**` values remain unmanaged and undeletable through the managed Storage endpoint.
- Legacy Project images shipped in `public` are registered in the same Media Catalog with canonical `(filesystem, public, object_key)` identity. Every complete path under `public/images/projects` is lowercase; that Catalog URL is the reference contract consumed by Projects and the shared picker, while the binary remains a read-only deployment asset.
- `MediaLibraryCore` owns both Manage and Select presentation modes. Selection changes a consumer field only after explicit confirmation.

## Consequences

- Repository migration presence does not prove that a remote environment has applied the schema, grants, RLS, functions, or seed state.
- Before authoritative reconciliation in a target environment, destructive catalog operations remain blocked.
- A canceled replacement leaves the newly uploaded asset unused by design.
- Project aggregate writes and Media reference synchronization remain under their current guarded owners; environment-specific destructive readiness must not be inferred from repository closure.
- Project aggregate reference providers discover and synchronize both managed Storage identities and canonical read-only legacy identities through the same provider registry with writes routed through their existing Project aggregate owner. No consumer owns a legacy lookup or case-repair path.
- Project media paths fail closed when any path segment, including the filename, is not lowercase. Repository and database guards enforce the convention; no runtime performs uppercase/lowercase fallback resolution.
- Single managed-asset physical rename/move is coordinated through Storage move, catalog identity update, provider rebind, and compensation. Physical folder rename/move and multi-asset move are not claimed by this foundation.

## Required proof

- `npm run verify:production-media-storage`
- `npm run verify:media-library-system`
- `npm run ci:check`
- authenticated RTL/keyboard/390px Browser QA when a trusted Admin session exists
- separate, environment-proven migration application and reconciliation before any remote destructive use

## Shared target runtime identity

Catalog readiness belongs to the actual Supabase database/Storage endpoint used by
`getSupabaseAdmin` and `getSupabaseStorageAdmin` (`NEXT_PUBLIC_SUPABASE_URL`).
Local development connected to that same hosted target uses its existing hosted
baseline, even though Next.js runs in development mode. `production` in the
persisted hosted namespace is retained for compatibility; it identifies the hosted
data target, not the application process. Preview execution against a different
project remains isolated by project identity. Loopback targets include host and
port and never adopt a hosted baseline. Execution environment still controls the
read-only local filesystem inventory independently.

Startup performs its existing read-only development preflight. It does not mutate
or reconcile Catalog state. An existing synced baseline, matching registry version,
exact target identity, live inventory and Catalog proof remain mandatory. Missing,
uncertain or foreign-target baselines still fail closed; no execution environment
label or explicit project-ref label can override the actual client endpoint.

## Managed deletion usage confirmation (2026-10-07)

Single, bulk and recursive folder deletion use the same preview and per-asset Saga.
The preview never deletes assets or changes content; it may settle stale leases through the official fenced recovery contract. Each referenced target requires explicit usage consent;
unused targets do not inherit another asset's consent. Bulk execution records each
success/failure and retries only remaining targets after a new preview. Folder
retirement is atomic and requires no remaining live Catalog assets; a later upload
revives the existing folder identity, including after concurrent retirement.

Confirmed deleted assets remain tombstones for retained reference discovery and
reconciliation, never selectable active assets. Newly acquired write leases still
reject deleted assets. If a successful deletion contracts the reconciled dataset,
the existing full reconciliation owner refreshes the baseline automatically; no
count-only exception or manual user step establishes readiness. A refresh failure
is surfaced separately from a proven Storage/Catalog deletion.

Migration `20261007193823_media_delete_usage_confirmation.sql` adds persisted
consent and folder retirement metadata and updates the existing coordination RPCs.
It does not alter authored content references or Storage objects. Runtime deletion
continues through the existing Storage adapter with audit evidence.


## Delete lease recovery and bounded execution (2026-10-08)

Expired active leases first enter the existing failed/unknown-write transition under
asset locks and a database-clock expiry check. They remain blockers until a complete
same-target reconciliation starts after that transition. Resolution requires that
run identity, current registry domain coverage for every original write target, and
matching provider/environment. Active leases cannot be automatically failed or
resolved. Historical registry identities remain unchanged; the resolved registry is
recorded as evidence. No reference is cleared by this transition.

The existing deletion endpoint accepts either one asset or a bounded batch. A batch
shares one complete preflight, executes at most three independent Sagas, streams
settled per-asset results, then refreshes the baseline once after all workers settle.
Each Saga retains database reservation, post-reservation reference/runtime checks,
exact Storage removal/absence proof, finalization and Audit. The complete inventory
already proves pre-delete existence; no duplicate per-file existence query is needed.
The UI removes successful rows immediately and retains failed selections with their
reasons; a truncated stream is a visible failure, never a success. Retry previews only
the failed/unknown targets. The same owner handles folder assets before atomic empty
folder retirement. No consumer bypasses the readiness or usage-confirmation gates.

## Managed image relocation

`physical-move.ts` is the existing owner for single Move, Rename and combined
Move + Rename. The management consumer previews existing compatible Catalog
folders, final paths and reference locations. Bulk Move calls this same owner
sequentially, records independent results and retains failed selection for retry.
There is no bulk rename, folder rename, MIME relaxation or consumer-specific path.

The owner validates the exact filename/extension and destination, scans all
registered providers, proves Catalog/live reference parity, and acquires existing
write leases. It journals intent in the existing recovery ledger, copies without
upsert, changes the Catalog location while retaining the asset UUID, and updates
supported references with their existing compare-and-set providers. Both Storage
locations remain available until reference verification and cache invalidation
finish. Only then is the old object retired and the identity finalized. The API
records the existing Audit entry and refreshes Catalog readiness when required.

Usage is a warning, never a blocker by itself. Every registered managed reference
provider supports rebind. Preview compares the current provider scan with Catalog,
shows current/new paths, usage count and linked locations, and explains automatic
updates. Its confirm label distinguishes Move, Rename and combined operations.
Bulk uses the same per-asset owner and leaves only failed assets selected.
Unknown owners or unproven reference parity remain integrity failures.
No similar URL prefixes are replaced.

### Reference adoption inventory (2026-10-10)

| Owner | Previous capability | Current adapter |
| --- | --- | --- |
| Topics / Media Center (all content types) | Discover + rebind | Existing field/JSON CAS, preserving derived score consistency |
| Topic categories | Discover + rebind | Existing image CAS |
| Projects | Discover only | Narrow CAS operation in existing Project save RPC; includes brochure URL |
| Project gallery/media | Discover only | Same Project RPC, parent and child ownership checked |
| Project floor plans | Discover only | Same RPC for architectural/furnishing images |
| Project videos | Discover only | Same RPC for poster and managed video URL |
| Project tracking update media | Discover only | Existing row CAS with revision |
| Pages managed OG image | Not adopted | Shared field CAS and existing Page derived-state owner; Page save/clone leases and removal synchronization |
| Hero / Slider | Discover + rebind | Existing recursive config CAS |
| Content / CTA / cards / breadcrumb / feed / featured templates | Discover + rebind | Existing recursive config CAS |
| Media Hub / Media Sidebar templates | Discover + rebind | Existing recursive config CAS |
| Menus | Discover + rebind | Existing href CAS |
| Site settings | Discover + rebind | Existing JSON/value CAS |
| Topic series | Not a media owner | No media-bearing field; no invented provider |

The Project tables deliberately deny direct service-role updates. Migration
20261010052006 adds an operation to the existing save_project_admin_entry RPC,
without a new function signature or wider table grants. It locks the parent,
checks child ownership, expected value and revision, and changes only the selected
reference and revision (plus its existing derived score tuple when affected).
The target must be a managed Catalog asset. Compensation can return to a retained
old object only when the existing relocation journal proves the exact asset,
reference tuple, old/new URL and retained Storage object. Ordinary editor payloads
retain their existing RPC path.

Page duplication passes its leased media snapshot to the existing composition
RPC, which compares that snapshot under its existing row lock before cloning.
This is reference safety adoption; no SEO text or scoring policy changes.

On a compensated failure, the original location remains valid. Partial or
unproven outcomes retain an unresolved lease and fail closed. Media Recovery
repairs a failed relocation only from its persisted plan: a proven staged copy
can be rolled back, or a completed retirement can retain its final identity.
Full reconciliation and the existing lease resolver then prove closure. An
ambiguous copy response does not authorize deleting a possibly foreign object;
Storage ownership must be established operationally. Expiry alone never proves
that a worker stopped. Reconciliation refuses unresolved relocation staging so
it cannot register a temporary copy as a second logical asset.

Verification owners: `verify-media-library-system.mjs` includes the executable
relocation owner fixture; the isolated upload/picker journey includes
`media-relocation-journey.mjs` for unused/referenced move, rename, combined move,
partial bulk failure and failed-only retry, negative destinations/names, and
Project/Topic/Hero multi-owner save/reload with actual image loading, and native Project RPC CAS/ACL/compensation tests. Production runs the same browser journey with unpublished QA
consumers and confirms Storage/Catalog/references/Audit before official cleanup.

The relocation journal migration extends the existing lease RPC boundary. Direct
service-role table updates remain denied; the journal is immutable apart from its
copy receipt. Recovery claims lock the complete token group and reject concurrent
claims. The isolated SQL fixture proves those permissions and transitions.
