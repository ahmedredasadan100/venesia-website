# Media Upload — Current State & Supabase Storage Migration Plan

## Current state (pre-launch)

| Area | Behavior |
|---|---|
| Admin media picker API | `POST /api/admin/media-library` writes to `public/images` or `public/files` |
| Topics editor | `uploadTopicImage()` in `app/admin/topics/actions.ts` → `public/images/topics/` |
| Media Center | `uploadMediaImage()` in `app/admin/media-center/actions.ts` → `public/images/media-center/` |
| Path validation | `normalizeMediaFolder()` blocks `..`; uploads scoped under `public/` |

## Risks

1. **Writable filesystem on server** — works on Vercel only if using ephemeral disk; uploads do not persist across deploys on serverless.
2. **No virus scanning / MIME hardening** beyond extension checks.
3. **Public by default** — any uploaded file is immediately web-accessible.
4. **Case sensitivity** — paths must match Linux disk casing (see `scripts/fix-project-image-paths.mjs`).

## What we did NOT change (this pass)

- No move to Supabase Storage yet (avoid breaking CMS workflows).
- Upload routes are now **admin-auth protected** via proxy + `requireAdminApi()`.

## Recommended migration (Phase 2)

1. Create Supabase Storage buckets: `cms-images`, `cms-documents` (private or public as needed).
2. Add `lib/storage/upload-cms-asset.ts` using service role server-side only.
3. Update `media-library` API to upload to Storage; return public URL or signed URL.
4. Migration script: copy `public/images/**` → Storage; update DB URLs in `topics`, `media_items`, `projects`, templates JSON.
5. Keep `public/` only for static brand assets (favicon, OG fallbacks).
6. Add RLS policies on buckets; never expose service role to client.

## Rollout order

1. Dual-write (local + Storage) in dev
2. Backfill existing assets
3. Switch readers to Storage URLs
4. Remove filesystem writes
5. Document env: `SUPABASE_STORAGE_BUCKET_CMS`
