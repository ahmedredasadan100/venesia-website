# Block Template Actions — Architecture Reference

**Baseline:** `origin/main` @ `3d56bf2` (Batch 6 menus split complete).

**Review status:** Block Template Actions Review Planning Gate — **completed**.  
**Decision:** **Defer splitting.** Keep the current per-module `actions.ts` structure unchanged.

This document records the architecture of admin server actions for **block template libraries** under `src/app/admin/pages-blocks/blocks/*/actions.ts`. These are separate from **page block assignments** (`page-actions/`), which manage which templates are placed on which pages.

---

## Why no split is required

Prior action splits (`project-actions/`, `topic-actions/`, `media-actions/`, `page-actions/`, `footer-actions/`, `menu-actions/`) targeted **single monolithic files** (~500–850 lines, 15–17 exports).

Block template actions are **already separated by domain** across eight module-specific files. The largest is `content/actions.ts` at ~372 lines. None match the oversized monolith pattern that justified those splits.

See also: [Oversized Admin Actions Split Plan](oversized-actions-split-plan.md) — Block Template Actions Review closure.

---

## The eight block template action files

| Module | File | Lines (approx.) | DB table |
|--------|------|----------------:|----------|
| Content | `blocks/content/actions.ts` | 372 | `content_block_templates` |
| Hero | `blocks/hero/actions.ts` | 232 | `hero_templates`, `hero_assignments` |
| Cards | `blocks/cards/actions.ts` | 188 | `cards_block_templates` |
| Breadcrumb | `blocks/breadcrumb/actions.ts` | 163 | `breadcrumb_block_templates` |
| CTA | `blocks/cta/actions.ts` | 171 | `cta_block_templates` |
| Feed | `blocks/feed/actions.ts` | 159 | `feed_module_templates` |
| Media Hub | `blocks/media-hub/actions.ts` | 44 | `media_hub_module_templates` |
| Media Sidebar | `blocks/media-sidebar/actions.ts` | 41 | `media_sidebar_module_templates` |

**Total:** 8 files, ~1,370 lines combined. No shared `blocks/actions.ts` barrel.

**Related lib (not action files):**

| Module | Role |
|--------|------|
| `src/lib/page-blocks/admin-revalidate.ts` | `revalidateBlockModulePaths`, `revalidatePublicPagesWithBlockAssignments` |
| `src/lib/page-blocks/sync-module-page-assignments.ts` | Page assignment sync for standard block modules |
| `src/lib/page-blocks/admin-utils.ts` | Form parsing helpers (`cleanText`, `getStatus`, `slugify`, etc.) |
| `src/lib/cache/revalidate-public-cache-tags.ts` | `revalidateBlockModuleCache`, tag groups |

---

## Export counts per module

| Module | Functions | Types | Total exports |
|--------|----------:|------:|--------------:|
| content | 7 | 1 | **9** |
| hero | 6 | 0 | **6** |
| breadcrumb | 6 | 0 | **6** |
| cards | 7 | 1 | **8** |
| cta | 7 | 1 | **8** |
| feed | 6 | 0 | **6** |
| media-hub | 1 | 0 | **1** |
| media-sidebar | 1 | 0 | **1** |
| **Grand total** | **41** | **3** | **44** |

### Export inventory

**content:** `createContentBlock`, `updateContentBlock`, `toggleContentBlockStatus`, `deleteContentBlock`, `duplicateContentBlock`, `bulkContentBlocks`, `getContentBlockRows`, `ContentBlockRow`

**hero:** `createHeroTemplate`, `toggleHeroTemplate`, `deleteHeroTemplate`, `duplicateHeroTemplate`, `bulkHeroTemplates`, `updateHeroTemplateDetails`

**breadcrumb:** `createBreadcrumbBlock`, `updateBreadcrumbBlock`, `toggleBreadcrumbBlockStatus`, `deleteBreadcrumbBlock`, `duplicateBreadcrumbBlock`, `bulkBreadcrumbBlocks`

**cards:** `createCardsBlock`, `updateCardsBlock`, `toggleCardsBlockStatus`, `deleteCardsBlock`, `duplicateCardsBlock`, `bulkCardsBlocks`, `getCardsBlockRows`, `CardsBlockRow`

**cta:** `createCtaBlock`, `updateCtaBlock`, `toggleCtaBlockStatus`, `deleteCtaBlock`, `duplicateCtaBlock`, `bulkCtaBlocks`, `getCtaBlockRows`, `CtaBlockRow`

**feed:** `createFeedModule`, `updateFeedModule`, `toggleFeedModuleStatus`, `deleteFeedModule`, `duplicateFeedModule`, `bulkFeedModules`

**media-hub:** `updateMediaHubModule`

**media-sidebar:** `updateMediaSidebarModule`

---

## Caller / import map

All callers import from `./actions` or `../actions` within the same module folder. **No cross-module imports** of block template actions were found.

| Module | Caller | Imports |
|--------|--------|---------|
| **content** | `ContentBlocksTableClient.tsx` | `bulkContentBlocks`, `createContentBlock`, `deleteContentBlock`, `duplicateContentBlock`, `getContentBlockRows`, `toggleContentBlockStatus`, `ContentBlockRow` |
| | `content/page.tsx` | `ContentBlockRow` (type only) |
| | `content/[id]/page.tsx` | `updateContentBlock` |
| **hero** | `HeroManagerClient.tsx` | `bulkHeroTemplates`, `createHeroTemplate`, `deleteHeroTemplate`, `duplicateHeroTemplate`, `toggleHeroTemplate` |
| | `hero/[id]/HeroEditClient.tsx` | `updateHeroTemplateDetails` |
| | `hero/page.tsx` | *(none — server component loads data directly)* |
| **breadcrumb** | `breadcrumb/page.tsx` | bulk, create, delete, duplicate, toggle |
| | `breadcrumb/[id]/page.tsx` | `updateBreadcrumbBlock` |
| **cards** | `cards/page.tsx` → `BlockModuleManagerClient` | bulk, create, delete, duplicate, toggle |
| | `cards/[id]/page.tsx` | `updateCardsBlock` |
| **cta** | `cta/page.tsx` → `BlockModuleManagerClient` | bulk, create, delete, duplicate, toggle |
| | `cta/[id]/page.tsx` | `updateCtaBlock` |
| **feed** | `feed/page.tsx` → `BlockModuleManagerClient` | bulk, create, delete, duplicate, toggle |
| | `feed/[id]/page.tsx` | `updateFeedModule` |
| **media-hub** | `media-hub/[id]/page.tsx` | `updateMediaHubModule` |
| | `media-hub/page.tsx` | *(list only)* |
| **media-sidebar** | `media-sidebar/[id]/page.tsx` | `updateMediaSidebarModule` |
| | `media-sidebar/page.tsx` | *(list only)* |

**Not in scope here:** `PageBlocksClient.tsx` uses `pages/actions` (page assignments), not block template libraries.

---

## Pattern A — standard revalidation (`revalidateBlockModulePaths`)

Used by: **content**, **breadcrumb**, **cards**, **cta**, **feed**, **media-hub**, **media-sidebar**.

```
revalidateBlockModulePaths(modulePath)
  → revalidatePath("/admin/pages-blocks/pages", "layout")
  → revalidateBlockModuleCache(modulePath)
  → revalidatePublicPagesWithBlockAssignments()
       → revalidatePageCompositionCache()
       → collectAssignedPublicPaths()   // scans ALL_ASSIGNMENT_TABLES
       → revalidatePath(each assigned public path, "page")
```

**Cache tag routing** (`revalidateBlockModuleCache` in `lib/cache/revalidate-public-cache-tags.ts`):

| `modulePath` | Cache behavior |
|--------------|----------------|
| `feed` | `revalidateFeedModulesCache()` |
| `media-sidebar` | page-composition + media-center + media-sidebar tags |
| `hero` | hero cache *(available but hero actions do not use Pattern A)* |
| default | `revalidatePageBlocksCache()` |

**Extra admin path revalidation** on some update actions:

`revalidatePath(/admin/pages-blocks/blocks/{module}/{id}, "page")` — breadcrumb, feed, media-hub, media-sidebar.

---

## Pattern B — hero-specific revalidation divergence

Hero actions use a **local** `revalidateHeroAdmin()` helper instead of `revalidateBlockModulePaths`:

```
revalidateHeroCache()
revalidatePath("/admin/pages-blocks/blocks/hero")
revalidatePath("/") /about /topics /contact /track-your-project
revalidateMediaCenterPublicPaths()
```

`updateHeroTemplateDetails` also calls `revalidatePath(/admin/pages-blocks/blocks/hero/{id})`.

**Implication:** Hero public cache invalidation follows a **hardcoded path list**, not assignment-table-driven path collection. Aligning hero with Pattern A would be a **behavior change** and requires a separate planning gate.

---

## Assignment sync flow

Template **updates** can sync which pages use a template. Create/duplicate/delete/bulk actions do not copy assignments (duplicate creates a draft template only).

### Standard block modules

`updateContentBlock`, `updateBreadcrumbBlock`, `updateCardsBlock`, `updateCtaBlock`, `updateFeedModule` call:

```
syncBlockModulePageAssignments(blockType, templateId, parsePageIdsFromForm(formData))
```

Flow (`lib/page-blocks/sync-module-page-assignments.ts`):

1. Load current assignment rows for `template_id`.
2. Diff against `page_ids` from form.
3. Delete removed assignments; insert new ones with default slot + sort order.
4. Call `revalidatePageBlocksPath(pageId)` per affected page.

### Media hub / sidebar

- `updateMediaHubModule` → `syncMediaHubModulePageAssignments`
- `updateMediaSidebarModule` → `syncMediaSidebarModulePageAssignments`

### Hero (inline, not shared sync helper)

`updateHeroTemplateDetails`:

1. `delete` from `hero_assignments` where `hero_id` + `target_type = 'page'`.
2. `insert` new rows from resolved `pages` rows (`page_ids` from form).

---

## Intentional audit exclusion for template CRUD

Block template `actions.ts` files **do not** call `recordCmsAdminAudit` or any CMS audit helper.

| Item | Status |
|------|--------|
| `scripts/verify-admin-audit-coverage.mjs` | Block template files **not listed** |
| `docs/admin-audit-coverage.md` | Explicitly excluded: *"Template CRUD is secondary to page assignments; out of critical-path scope"* |

**Page block assignments** (`page-actions/`) are audited. **Template library CRUD** is not.

Adding audit logging to template mutations would be a **new behavior** and requires explicit product approval plus a separate implementation gate. Do not add audit in a documentation-only or move-only batch.

---

## Orphan exports

These exports exist but have **no current callers**:

| Export | File | Notes |
|--------|------|-------|
| `getCardsBlockRows` | `blocks/cards/actions.ts` | `cards/page.tsx` loads rows via Supabase in the server component |
| `getCtaBlockRows` | `blocks/cta/actions.ts` | `cta/page.tsx` loads rows via Supabase in the server component |

By contrast, `getContentBlockRows` **is wired** in `ContentBlocksTableClient.tsx` for table refresh.

**Do not remove** orphan exports without a dedicated cleanup gate and caller audit. Removal could break future or external consumers.

---

## High-risk areas — do not change without a separate planning gate

| Area | Module | Risk |
|------|--------|------|
| `buildContentConfig` and config builders | content | Multi-schema JSON (`about-intro`, `vision-goals`, `about-cta`, etc.) |
| `updateContentBlock` | content | Assignment sync + Pattern A revalidation |
| `buildCardsItems` (`items_json` parse) | cards | Silent JSON parse fallback |
| `updateHeroTemplateDetails` | hero | Wipes and rebuilds `hero_assignments` |
| `revalidateHeroAdmin` | hero | Pattern B divergence from assignment-driven revalidation |
| `sanitizeFeedModuleConfig` | feed | Async category/series validation |
| `bulk*` actions | all full-CRUD modules | Bulk delete; empty `ids` → silent no-op |
| `syncBlockModulePageAssignments` | lib | Cross-table diff affecting multiple pages |
| `revalidateBlockModulePaths` | lib | Scans all assignment tables on every mutation |
| `updateMediaHubModule` / `updateMediaSidebarModule` | media-* | Update-only; seeded templates; specialized sync |

---

## Future options (not approved)

These are recorded for planning only. **None are approved for implementation.**

| Option | When to reconsider |
|--------|-------------------|
| `content-actions/` split | If `content/actions.ts` grows past ~500 lines |
| `hero-actions/` split | If hero assignment/revalidation is redesigned |
| Shared lib helpers (`ensureUniqueSlug`, bulk patterns) | Refactor gate; must stay behavior-identical |
| Add CMS audit to template CRUD | Product decision + behavior change gate |
| Align hero revalidation with Pattern A | Behavior change gate |
| Remove orphan `get*Rows` exports | Cleanup gate after caller confirmation |

---

## Related docs

- [Oversized Admin Actions Split Plan](oversized-actions-split-plan.md) — server action split history and block review closure
- [Admin Audit Coverage](admin-audit-coverage.md) — intentional template exclusion
- [Client Components Split Plan](client-components-split-plan.md) — `PageBlocksClient.tsx` remains highest client risk
