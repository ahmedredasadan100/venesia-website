# Managed Media Picker — Folder-Aware Browse, Select & Upload

## Reality and root cause

Baseline: PR #203, main bdaee250b801f362bb64e85738e17aec79183be0. PR #202 already correctly excludes document folders from image consumers and preserves compatible upload destinations. Production inspection found `files/about`, `files/home`, `files/project`, and the roots `files` / `images`; there were no image subfolders. Folder names alone do not make document folders image-compatible.

The shared Catalog folder read previously included all descendant assets. This flattened nested browsing. The shared picker already had dynamic folder navigation, but it did not explicitly label the current upload destination or explain why document-only folders are absent.

## Shared change

- MediaLibraryCore requests direct-level files for a selected folder; smart views remain whole-library views.
- The existing Media API and Catalog read owner support `folderScope=direct`, preserving recursive behavior for existing API callers that omit it.
- Current path and upload destination are explicit; parent navigation and dynamic refresh use the same folder list and read endpoint.
- The compatible child list and sidebar use the existing image/PDF root policy. No folder names, consumer paths, or alternate folder registry are introduced.
- Each upload batch captures the selected destination. Successful uploads reset stale search/pagination and refresh the current folder so the new asset can be selected.

## Ownership and adoption

`media_folders` / `admin_media_folders_catalog` plus Storage inventory feed the existing Catalog read model. Compatibility remains `images` and descendants for images, `files` and descendants for PDF. MIME and server destination checks are unchanged.

All AdminMediaPickerModal consumers adopt MediaLibraryCore: AdminMediaGalleryField (including AdminImagePathListField / Hero), AdminMediaImageField, AdminMediaFileField, and AdminLinkPicker's document selection. AdminMediaFileField is wired to the shared picker but has no current JSX call sites in this inventory; document selection is active through AdminLinkPicker. Their downstream page blocks, projects, content editors, and other managed media fields inherit this shared change. No per-screen patches.

Existing Form adoption entry: activity-sitemap-media-commands. Applicability and source-proof audits use the current shared capability manifest.

## Verification owner

`verify:media-library-system` exercises direct versus recursive folder reads, preserves complete dynamic folder navigation, and retains PR #202 kind scoping / MIME checks. `media-picker-upload-journey.mjs`, run by the existing isolated Supabase upload proof, covers nested folder JPG/PNG/WebP upload, dynamic folder discovery, parent navigation, selecting an existing nested asset, save/reload for cinematic and internal Hero consumers, and Media Library control / rejection paths.

Production closure evidence is reported separately after exact-head CI, standard merge, automatic deployment, native consumer journeys and owned QA cleanup. No SEO, core page content, Schema, existing media references, or migration changes are part of this change.

## Local result

PASS: 101 Media Library owner checks, Form applicability/source proof, Admin Runtime, lint, typecheck, isolated normal build and native browser journey. The successful isolated run also verifies Catalog/Storage object destinations, upload audit rows, persisted desktop/mobile references and complete cleanup of its ten owned resources. Canonical reference discovery deduplicates repeated use of the same asset within the same config field; the cinematic fixture has three distinct asset references, including its reused mobile image.
