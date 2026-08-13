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
- Delete only when catalog state and provider-registry version are synchronized, persisted references are zero, a fresh exhaustive provider scan is complete with zero matching references, and the object still exists. Any error or drift fails closed.
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
- Project aggregate reference providers discover and synchronize both managed Storage identities and canonical read-only legacy identities through the same provider registry while retaining their specialized no-rebind mutation boundary. No consumer owns a legacy lookup or case-repair path.
- Project media paths fail closed when any path segment, including the filename, is not lowercase. Repository and database guards enforce the convention; no runtime performs uppercase/lowercase fallback resolution.
- Single managed-asset physical rename/move is coordinated through Storage move, catalog identity update, provider rebind, and compensation. Physical folder rename/move and multi-asset move are not claimed by this foundation.

## Required proof

- `npm run verify:production-media-storage`
- `npm run verify:media-library-system`
- `npm run ci:check`
- authenticated RTL/keyboard/390px Browser QA when a trusted Admin session exists
- separate, environment-proven migration application and reconciliation before any remote destructive use
