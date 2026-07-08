# Media Upload — Current State & Supabase Storage Migration Plan

## Current state (2026-07-08)

| Area | Behavior |
|---|---|
| Admin media picker API | `POST /api/admin/media-library` — filesystem under `public/images` or `public/files` (or Supabase Storage when `CMS_STORAGE_UPLOADS=supabase` / production defaults enable it via `lib/storage/upload-cms-asset.ts`) |
| Topics editor | `uploadTopicImage()` in `app/admin/topics/actions.ts` → `public/images/topics/` |
| Unified Media Admin | `uploadMediaImage()` in `app/admin/content/media/actions.ts` → `public/images/topics/` |
| Legacy Media Admin | **Removed** — `app/admin/media-center/actions.ts` and related CRUD/components no longer exist; `/admin/media-center` is redirect-only compatibility (commit `850534b`) |
| Path validation | `normalizeMediaFolder()` blocks `..`; uploads scoped under `public/` or configured Storage buckets |

## Risks

1. **Writable filesystem on server** — works on Vercel only if using ephemeral disk; filesystem uploads do not persist across deploys on serverless.
2. **No virus scanning / MIME hardening** beyond extension checks.
3. **Public by default (filesystem path)** — files written under `public/` are immediately web-accessible.
4. **Case sensitivity** — paths must match Linux disk casing (see `scripts/fix-project-image-paths.mjs`).

## What is NOT completed yet

- **Supabase Storage migration is NOT completed.** Partial server-side upload support exists (`lib/storage/upload-cms-asset.ts`), but a full cutover from filesystem `public/images/**` and `public/files/**` to Storage-backed URLs across all CMS surfaces is **future work only**.
- Do not treat filesystem uploads to `public/images` or `public/files` as a long-term production storage strategy.

## What we did NOT change (this documentation pass)

- No full Storage migration rollout.
- Upload routes remain **admin-auth protected** via proxy + `requireAdminApi()`.

## Recommended migration (future — Phase 2+)

1. Create Supabase Storage buckets: `cms-images`, `cms-documents` (private or public as needed).
2. Extend `lib/storage/upload-cms-asset.ts` so **all** admin upload paths use Storage server-side only (service role).
3. Update `media-library` API and topic/media form uploads to use Storage; return public URL or signed URL.
4. Migration script: copy `public/images/**` → Storage; update DB URLs in `topics`, `media_items`, `projects`, templates JSON.
5. Keep `public/` only for static brand assets (favicon, OG fallbacks).
6. Add RLS policies on buckets; **never expose service role to client**.

## Rollout order (future)

1. Dual-write (local + Storage) in dev
2. Backfill existing assets
3. Switch readers to Storage URLs
4. Remove filesystem writes
5. Document env: `SUPABASE_STORAGE_BUCKET_IMAGES`, `SUPABASE_STORAGE_BUCKET_DOCUMENTS`, `CMS_STORAGE_UPLOADS`
