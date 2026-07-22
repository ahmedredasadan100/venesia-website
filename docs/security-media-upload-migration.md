# Media Upload — Durable Storage Contract

**Status:** Implemented for new Production and Vercel Preview uploads
**Updated:** 2026-07-22

## Provider decision

Supabase Storage is the single durable runtime provider for CMS media. The
project already uses Supabase, keeps its Service Role client server-only, and
has `next/image` support for public Supabase object URLs. Adding Vercel Blob
would create a second persistent provider without a product requirement.

Production and Vercel Preview always resolve to Supabase Storage. The
`CMS_STORAGE_UPLOADS=filesystem` value cannot force a Production fallback.
Local development may retain the filesystem adapter for backwards-compatible
testing of bundled assets.

## Buckets

Migration `20260722160000_cms_media_storage_buckets.sql` provisions:

- `cms-images`: public read, 5 MB, JPEG/PNG/WEBP/GIF/AVIF.
- `cms-documents`: public read, 12 MB, PDF.

Writes and deletes use the server-side Supabase Service Role client. No storage
credential is sent to Client Components.

## Adapter contract

The Media Storage Adapter owns:

- folder listing and stable public URLs;
- image and PDF upload;
- in-place replacement only for a managed object with the same extension;
- managed-object deletion;
- filename, MIME, size, upload timestamp, provider, and storage-key metadata.

Admin authentication remains at the API boundary. Upload validation keeps the
existing extension/MIME allowlist and size limits. Folder and object parsing
reject traversal. Delete accepts only URLs produced by the configured managed
buckets and is blocked while the usage scanner finds a database reference.

## Legacy compatibility

Existing `/images/**` and `/files/**` values are not migrated or rewritten.
They continue to render from the deployed static `public/` tree and remain
valid in topic/project/page fields. They are intentionally classified as
unmanaged, so the runtime delete endpoint cannot remove them.

New managed uploads use public Supabase Storage URLs. Topic image fields,
previews, public pages, and publish validation store and consume those URLs as
ordinary text, so no database schema migration or media backfill is required.

## Operational rules

- Never write runtime uploads to `public/` or `/tmp` in Production.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to Client Components.
- Keep bucket creation reproducible through the committed migration.
- Remove a database reference before deleting its managed asset.
- Static brand/project assets can remain in `public/`; they are not runtime
  uploads and are outside this storage cutover.
