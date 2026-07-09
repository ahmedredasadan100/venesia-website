# Dead Code Cleanup Report (Post Server-Actions Split)

**Date:** Batch 5  
**Baseline:** `origin/main` @ `157959f` (Batch 4 pushed, Quality Gate green)

## Scope

Admin-only scan after Batches 1–4 action splits. No public routes, legacy redirect stubs, or compatibility barrels removed.

## Searches performed

| Search | Purpose |
|--------|---------|
| `from .*project-actions` | Confirm split modules only reached via barrels |
| `from .*topic-actions` | Same |
| `from .*media-actions` | Same |
| `from .*page-actions` | Same |
| `legacy media` / `media-center/actions` | Legacy media admin boundary |
| `TODO\|FIXME\|deprecated` in `src/app/admin`, `src/components/admin`, `src/lib/admin` | Stale markers |

## Files inspected

- All `project-actions/`, `topic-actions/`, `media-actions/`, `page-actions/` modules (14 + 11 + 10 + 12 files)
- Public barrels: `projects/actions.ts`, `topics/actions.ts`, `content/media/actions.ts`, `pages-blocks/pages/actions.ts`
- Legacy media stubs under `src/app/admin/media-center/`
- `src/lib/admin/legacy-media-admin-routes.ts`, `src/lib/media-center/legacy-provider.ts`
- Admin callers: `PagesTableClient`, `PageBlocksClient`, `MediaContentForm`, `ProjectEditForm`, menu/footer clients

## Files removed

**None.** No provably unused admin files found.

## Intentionally kept

| Area | Reason |
|------|--------|
| All `*-actions/` folders | Active mutation modules; barrels are the only import surface |
| `actions.ts` barrels (projects, topics, media, pages) | Stable public API for callers |
| Legacy `media-center/*` redirect stubs | Required by `verify:legacy-media-admin` |
| `updatePageBlockAssignment`, `updateHeroPageAssignment` | Exported from pages barrel; no current callers but part of public API |
| `@deprecated` in `media-content-config.ts` | Back-compat aliases still referenced |
| `@deprecated` `AdminPagination.tsx` | Documented legacy component; may still be referenced |
| `DEPRECATED_BLOCK_MODULE_CATALOG` usage in blocks admin | Intentional deprecated module listing |

## Risky areas deferred

- **Menus actions monolith** (~583 lines): JSON import with parent/child id remapping, menu tree duplicate, bulk delete cascade — defer split to dedicated batch
- **Client components** (`PageBlocksClient`, `ProjectEditForm`): not dead code; planned refactor only
- **Block template `actions.ts` files** under `pages-blocks/blocks/*`: out of scope; separate libraries

## Conclusion

Post-split codebase has no safe dead-file deletions. Cleanup value was verification that split modules are wired correctly through barrels only.
