# Media Upload — Current State and Supabase Storage Migration Plan

**Document status:** Updated documentation proposal
**Updated:** 2026-07-17
**Operational status:** Storage hardening remains post-launch backlog; it is not a release blocker.

## Canonical project status — 2026-07-17

This document was reviewed against the final project handoff and the final Cursor production verification.

```text
HEAD = origin/main = Production
e40245c80f7997e1759efc2456a0bf4cedf2ce48

GitHub Quality Gate #83: success
Production deployment 5483173237: success
Production alias SHA match: yes
ISR Cache HIT verification: pass
Final hydration smoke: pass
NON-PROJECT SCOPE: OFFICIALLY CLOSED
PROJECTS / TRACK YOUR PROJECT: FROZEN
```

This file is a **proposed documentation update only**. It does not represent a repository commit, code change, database change, environment change, deployment, or push.


## 1. Current verified posture

| Area | Current behavior / boundary |
|---|---|
| Admin media picker API | `POST /api/admin/media-library`; the storage adapter is `src/lib/storage/upload-cms-asset.ts`. |
| Default upload mode | Filesystem-backed upload under `public/images/**` or `public/files/**` unless Storage is explicitly enabled. |
| Supabase Storage mode | Opt-in only through `CMS_STORAGE_UPLOADS=supabase`; do not assume Production enables it automatically. |
| Unified content admin | Stable action surface is `src/app/admin/content/topics/actions.ts`; specialized mutations live under `article-actions/**` and `media-actions/**`. |
| Canonical routes | All article, news, press, site-update, video, and gallery administration uses `/admin/content/topics/**`. |
| Legacy admin | The `/admin/topics`, `/admin/content/media`, and `/admin/media-center` route trees and active CRUD actions are removed. |
| Path validation | Folder normalization must reject traversal such as `..`; uploaded assets stay within the configured filesystem or Storage boundary. |
| Production verification | Final production smoke proved runtime stability, not persistent upload cutover. No claim is made that Storage migration is complete. |

## 2. Confirmed storage decision

The long-term production target is Supabase Storage, but the project is **not cut over yet**.

Current rule:

```text
CMS_STORAGE_UPLOADS=supabase
→ use the Storage adapter

anything else / unset
→ filesystem behavior remains the fallback
```

Do not describe filesystem upload as a durable serverless production strategy. Vercel filesystem writes are not a reliable cross-deployment asset store.

## 3. Current risks

1. **Persistence risk:** filesystem writes can disappear across serverless instances or deployments.
2. **Validation gap:** extension checks alone are not sufficient MIME/content hardening.
3. **Public exposure:** assets written under `public/` become directly addressable.
4. **Case sensitivity:** Linux deployment paths must match exact casing.
5. **Mixed-source drift:** filesystem and Storage URLs can diverge if dual behavior is introduced without a controlled migration ledger.
6. **Database URL drift:** templates and content JSON may contain asset references outside the main media tables.
7. **Project scope risk:** project asset migration is frozen with the Projects scope and must not be included automatically.

## 4. Explicitly not completed

- No full Storage migration.
- No verified backfill of `public/images/**` or `public/files/**`.
- No verified rewrite of all database asset URLs.
- No verified removal of filesystem writes.
- No verified Storage bucket/RLS policy baseline in repository history.
- No approved project-assets migration.
- No approved environment change.
- No approved Production rollout.

The final non-project closure does **not** convert this backlog into completed work.

## 5. Approved governance boundary

Before any implementation, stop for explicit approval if work requires:

- Supabase bucket creation or policy changes.
- Environment-variable changes.
- Database URL mutation.
- Production data backfill.
- Project asset migration.
- Vercel configuration changes.
- Production deployment or redeploy.
- Push.

Execution must follow:

```text
Claim → Evidence → Risk → Minimal fix → Approval
```

## 6. Recommended future migration

### Phase A — inventory and proof

1. Enumerate every upload entry point and every asset reader.
2. Export a deduplicated inventory of filesystem assets and database references.
3. Classify assets into:
   - static brand assets that remain in `public/`;
   - CMS images;
   - CMS documents;
   - project assets, which remain frozen.
4. Verify current bucket and RLS state from live metadata without exposing secrets.
5. Define canonical URL ownership and rollback rules.

**Exit criterion:** no code or data change; approved inventory and mapping only.

### Phase B — Storage foundation

1. Create or verify `cms-images` and `cms-documents`.
2. Keep service-role access server-side only.
3. Add MIME, extension, size, filename, and path validation.
4. Decide public URL versus signed URL by asset class.
5. Add structured upload errors and audit-safe metadata.

**Exit criterion:** isolated adapter tests pass; no reader cutover yet.

### Phase C — controlled backfill

1. Copy approved non-project assets to Storage.
2. Record source path, destination key, checksum, and migration status.
3. Do not overwrite database URLs until copy verification passes.
4. Exclude frozen project tables and project JSON.
5. Produce a rollback map.

**Exit criterion:** copied assets are checksum-verified and reversible.

### Phase D — database and reader cutover

1. Update only approved non-project URL fields.
2. Switch readers to Storage-backed URLs.
3. Verify admin media picker, Topics, Unified Media, Page Builder, public pages, sitemap/OG images, and exports.
4. Run cache invalidation only through existing approved helpers.
5. Keep filesystem fallback temporarily until production verification succeeds.

### Phase E — close filesystem writes

1. Disable filesystem upload writes.
2. Remove fallback only after a production observation window.
3. Keep static brand assets in `public/`.
4. Document the final environment contract and incident rollback.

## 7. Required QA for any future rollout

- Upload image and document through each approved admin surface.
- Reject traversal, disguised MIME, oversized payload, unsupported extension, empty file, and duplicate-name collision.
- Verify URLs after a fresh deployment.
- Verify no service-role secret reaches client code.
- Verify admin authorization remains enforced.
- Verify existing public content does not show broken assets.
- Verify cache invalidation and Next/Image host configuration.
- Verify no project asset or project database row changed.
- Verify rollback restores previous URLs.

## 8. Current decision

```text
Storage migration: NOT COMPLETE
Release blocker: NO
Backlog owner: post-launch security/architecture workstream
Projects assets: FROZEN
Implementation approval: REQUIRED
```
