# Oversized Admin Actions — Architecture Split Plan

Baseline: `origin/main` @ `f2b2519` (split plan pushed; CI green).

This document plans and tracks admin action file splits.

## Batch status

| Batch | Target | Status |
|-------|--------|--------|
| **1** | `src/app/admin/projects/actions.ts` | **Completed** — see below |
| 2+ | topics, media, pages, clients | Planned |

## Purpose

Several admin mutation surfaces grew large while audit logging, validation, AJAX/table flows, and multi-table page-block logic were added incrementally. Before refactoring, we need explicit boundaries, risk levels, and a safe commit order so splits stay reviewable and do not break:

- Server action imports (`"use server"` boundaries)
- `verify:audit-coverage` guardrails
- Cross-app imports (`TopicBulkPublishGate`, `MediaBulkPublishGate`)
- Form field contracts between client forms and `updateProject`

---

## Current file inventory

| File | Lines | Exports | Risk |
|------|------:|---------|------|
| `src/app/admin/pages-blocks/pages/actions.ts` | ~850 | 17 functions + 2 types | **High** |
| `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx` | ~766 | 1 default component | **High** |
| `src/app/admin/topics/actions.ts` | ~837 | 12 functions + 2 types | **Medium** |
| `src/app/admin/content/media/actions.ts` | ~829 | 9 functions + 2 types | **Medium** |
| `src/app/admin/projects/actions.ts` | ~15 (barrel) | 10 re-exports | **Medium** — **split done** |
| `src/app/admin/projects/ProjectEditForm.tsx` | ~533 | 1 default component | **Medium** |

Note: There is no `src/app/admin/pages/actions.ts`. Pages live under `pages-blocks/pages/`.

---

## 1. `pages-blocks/pages/actions.ts`

### Responsibilities

| Group | Functions | Notes |
|-------|-----------|-------|
| **Page lifecycle** | `togglePageStatus`, `deletePage`, `duplicatePage`, `bulkDeletePagesAjax`, `getPagesTableRows` | Redirect-based; uses `pagesListPath`, page policy helpers |
| **Page block assign** | `assignPageBlock`, `assignMediaSidebarModule`, `assignMediaHubModule`, `assignHeroModule` | Four parallel create paths |
| **Page block mutate** | `updatePageBlockAssignment`, `updateHeroPageAssignment`, `movePageBlockAssignment`, `togglePageBlockAssignment`, `deletePageBlockAssignment`, `bulkPageBlockAssignments` | Returns `PageBlockActionResult` for client |
| **Copy helpers** | `copyPageModuleAssignments`, `copyPageHeroAssignments` | Used by `duplicatePage` |
| **Block infra** | `assignmentTable`, `templateTable`, `nextSortOrder`, `nextMediaSidebarSortOrder`, `nextMediaHubSortOrder`, `parseAssignmentKeys` | Registry-driven table routing |
| **Audit** | `auditPageBlockAssignment` + 6 direct `recordCmsAdminAudit` (page entity) | 20+ assignment audit call sites |
| **Revalidation** | `revalidatePageBlocksPath`, `revalidatePublicPagesWithBlockAssignments`, `revalidatePath` | Mixed redirect vs JSON result |

### Repeated patterns

- **Module-kind branching**: hero / media-sidebar / media-hub / generic `PageBlockType` duplicated in assign, update, reorder, toggle, delete, bulk.
- **Success path**: mutate → audit → `revalidatePageBlocksPath`.
- **Duplicate page**: insert page → copy all assignment tables + hero assignments.

### Safe split boundaries

```
src/app/admin/pages-blocks/pages/
  actions.ts                    # barrel re-export (keep stable import path)
  actions/
    page-lifecycle.ts           # toggle, delete, duplicate, bulk delete, table rows
    page-block-shared.ts        # auditPageBlockAssignment, table/sort helpers, parseAssignmentKeys
    page-block-assign.ts        # assign* (4 create entry points)
    page-block-mutations.ts     # update, move, toggle, delete, bulk
    page-duplicate-copy.ts      # copyPageModuleAssignments, copyPageHeroAssignments
```

### Consumers (must keep import path stable)

- `PagesTableClient.tsx` — lifecycle + table
- `PageBlocksClient.tsx` — all block assignment actions

### Risk: **High**

Multi-table routing, four module kinds, duplicate-page copy logic, and tight coupling to `PageBlocksClient` optimistic reorder. Any split must preserve exported names from `actions.ts` (barrel) in the same commit as file moves.

---

## 2. `topics/actions.ts`

### Responsibilities

| Group | Functions / symbols | Lines (approx) |
|-------|---------------------|----------------|
| **Form parsing** | `getString`, `getPayload`, `getFaq`, `getKeywords`, slug/image helpers | ~230 |
| **Validation** | `getValidationError`, publish/draft paths, category/series lookups | ~120 |
| **DB reads** | `getTopicById`, `ensureUniqueSlug`, `loadActiveTopicCategoriesForValidation` | ~80 |
| **Bulk validation (exported)** | `validateBulkTopicPublish`, types | ~90 |
| **Core write** | `updateTopicWithStatus` (internal), `createTopic` | ~160 |
| **Thin wrappers** | `saveTopic`, `saveTopicAndClose`, `saveDraftTopic`, `publishTopic`, `unpublishTopic` | ~40 |
| **Status / delete / duplicate** | `setTopicStatusFromList`, `softDeleteTopic`, `duplicateTopic` | ~100 |
| **Bulk mutate** | `bulkUpdateTopics` | ~90 |
| **Revalidation** | `revalidateTopicPaths` | ~20 |
| **Audit** | 8× `recordCmsAdminAudit` | — |

### Existing shared lib (do not duplicate)

- `lib/admin/content-workflow/topic-publish-validation.ts` — publish rules
- `lib/admin/article-topic-categories.ts` — category resolution

### Repeated patterns (overlap with media)

- Arabic slug normalization (~50 lines, duplicated in media)
- Image upload to local `public/uploads`
- Redirect error helpers, `appendNotice`, bulk partial publish flow

### Proposed split

```
src/app/admin/topics/
  actions.ts                      # barrel
  actions/
    form-helpers.ts               # getString, slug, upload, getPayload (no mutations)
    reads.ts                      # getTopicById, ensureUniqueSlug, category/series
    revalidate.ts                 # revalidateTopicPaths
    bulk.ts                       # validateBulkTopicPublish, bulkUpdateTopics
    create.ts                     # createTopic
    update.ts                     # updateTopicWithStatus + save* wrappers
    status.ts                     # publish/unpublish/soft delete via setTopicStatusFromList
    duplicate.ts                  # duplicateTopic
```

### Cross-boundary export

- `validateBulkTopicPublish` + types → imported by `src/components/admin/content-workflow/TopicBulkPublishGate.tsx`  
  **Move only with barrel re-export or simultaneous import path update.**

### Risk: **Medium**

Single `updateTopicWithStatus` hub reduces duplication but must stay coherent. Bulk validation is an external contract.

---

## 3. `content/media/actions.ts`

### Responsibilities

Mirror of topics, adapted for unified media (`topics` table + `content_type`):

| Group | Functions |
|-------|-----------|
| **Form / validation** | Same shape as topics: slug, upload, `getPayload`, section resolution, `content_type` guards |
| **Bulk validation (exported)** | `validateBulkMediaPublish`, types |
| **CRUD** | `createMediaContent`, `updateMediaContent` |
| **Status** | `publishMediaContent`, `unpublishMediaContent`, `archiveMediaContent` |
| **Duplicate / bulk** | `duplicateMediaContent`, `bulkUpdateMediaContent` |
| **Revalidation** | `revalidateMediaContentPaths` |
| **Audit** | 8× `recordCmsAdminAudit` (includes `content_type` metadata) |

### Proposed split

Same layout as topics (replace entity names):

```
src/app/admin/content/media/
  actions.ts
  actions/
    form-helpers.ts
    reads.ts
    revalidate.ts
    bulk.ts
    create.ts
    update.ts
    status.ts
    duplicate.ts
```

### Cross-boundary export

- `validateBulkMediaPublish` → `MediaBulkPublishGate.tsx`

### Future shared extraction (optional, after both splits)

Consider `lib/admin/content-write/form-helpers.ts` for duplicated slug/upload/redirect helpers shared by topics + media. **Not in first split commit.**

### Risk: **Medium**

Same as topics; plus `content_type` / media section resolution must stay with write paths.

---

## 4. `projects/actions.ts` — Batch 1 completed

### Implemented structure (Batch 1)

```
src/app/admin/projects/
  actions.ts                 # stable public import path (re-exports from project-actions/)
  project-actions/
    index.ts                 # re-exports all public actions
    types.ts                 # PublicationStatus
    helpers.ts               # form parsing, redirects, preserve* helpers
    revalidate.ts            # revalidateProjectPaths, revalidateProjectPathsById
    validation.ts            # loadProjectPublishInput, validateProjectsCanPublish, checkProjectFieldsAvailable
    create.ts                # createProject
    update.ts                # updateProject
    status.ts                # getProjectsTableRows, toggle, archive, restore
    delete.ts                # deleteProjectAjax
    duplicate.ts             # duplicateProjectAjax
    bulk.ts                  # bulkProjectsActionAjax
```

Caller imports unchanged: `./actions` from `ProjectEditForm`, `ProjectsTableClient`, `AddProjectPanelClient`.

### Original responsibilities (pre-split reference)

| Group | Functions |
|-------|-----------|
| **Availability check** | `checkProjectFieldsAvailable` |
| **Create** | `createProject` |
| **Update (large)** | `updateProject` — full row payload + `syncProjectChildren` + dual audit |
| **Table / AJAX** | `getProjectsTableRows`, `toggleProjectPublicationAjax`, `bulkProjectsActionAjax`, `archiveProjectAjax`, `restoreProjectAjax`, `deleteProjectAjax`, `duplicateProjectAjax` |
| **Validation** | `validateProjectsCanPublish`, `loadProjectPublishInput` |
| **Helpers** | `revalidateProjectPaths`, redirect helpers, `parseQuickFacts`, slug/code uniqueness |
| **Audit** | 10× `recordCmsAdminAudit` (including `project_children`) |

### Internal complexity

- `updateProject` (~140 lines): publication validation, 40+ column payload, conditional child sync via `syncProjectChildren` RPC/form sections.
- `duplicateProjectAjax`: copies floor plans, delivery specs, media collections.

### Proposed split

```
src/app/admin/projects/
  actions.ts
  actions/
    form-helpers.ts             # getString, redirects, revalidateProjectPaths, preserve* helpers
    validation.ts               # checkProjectFieldsAvailable, validateProjectsCanPublish
    create.ts                   # createProject
    update.ts                   # updateProject (+ syncProjectChildren call)
    children-sync.ts            # syncProjectChildren (extract from update/duplicate if pure enough)
    table-ajax.ts               # getProjectsTableRows, toggle, bulk, archive, restore, delete, duplicate
```

### Consumers

- `ProjectEditForm.tsx` — `updateProject` only
- `ProjectsTableClient.tsx` — table + ajax mutations
- `AddProjectPanelClient.tsx` — create + field check

### Risk: **Medium**

`updateProject` ↔ `ProjectEditForm` field names are a silent contract. Child sync errors surface as edit redirect errors.

---

## 5. `projects/ProjectEditForm.tsx`

### Structure

| Section | Content |
|---------|---------|
| **Inline UI primitives** | `HiddenBoolean`, `SectionIntro`, `BasicTabSection`, `BasicFieldLabel`, `VisibilityToggle`, `CompactSlugField` (~150 lines) |
| **Basic tab** | `ProjectBasicTopSection`, `ProjectBasicTab` (~150 lines) |
| **Main component** | Tab array: basic, district, overview, delivery, gallery, SEO, intelligence panels (~230 lines) |
| **Form action** | Single `updateProject` server action |

### Proposed split

```
src/app/admin/projects/
  ProjectEditForm.tsx             # shell: tabs, submit bar, publish checklist
  project-edit/
    ProjectEditFormPrimitives.tsx # HiddenBoolean, SectionIntro, BasicTabSection, etc.
    ProjectEditBasicTab.tsx
    ProjectEditDistrictTab.tsx
    ProjectEditOverviewTab.tsx
    ProjectEditDeliveryTab.tsx
    ProjectEditGalleryTab.tsx
    ProjectEditSeoTab.tsx
```

### Risk: **Medium**

Client-only; no audit impact. Risk is **form field name drift** vs `updateProject` / `syncProjectChildren` section flags (`floor_plans_section`, etc.).

---

## 6. `pages-blocks/pages/[id]/PageBlocksClient.tsx`

### Structure

| Section | Content |
|---------|---------|
| **Pure utils** | `assignmentRowId`, `compareAssignments`, `getSlotOptions`, `isManageableAssignment` |
| **State / hooks** | 10+ `useState`, `useActionState` ×4 assign paths, `useAdminTable`, selection, optimistic reorder |
| **Handlers** | reorder (optimistic rollback), delete, bulk |
| **UI** | Header, slot map, data grid, assign modal, delete confirm |

### Proposed split

```
src/app/admin/pages-blocks/pages/[id]/
  PageBlocksClient.tsx            # orchestration, layout
  page-blocks/
    page-blocks-utils.ts          # compareAssignments, getSlotOptions (pure)
    usePageBlocksAssignModal.ts   # assign modal state machine
    PageBlocksAssignModal.tsx
    PageBlocksDataGrid.tsx        # grid + bulk bar + row actions
```

### Risk: **High**

Optimistic reorder rollback, four `useActionState` assign flows, and session/dismiss logic are easy to break. **Split last.**

---

## Risk summary

| Target | Level | Why |
|--------|-------|-----|
| `PageBlocksClient.tsx` | **High** | Optimistic UI, many action bindings, modal state machine |
| `pages-blocks/pages/actions.ts` | **High** | Multi-table module branching; page duplicate copies all assignments |
| `topics/actions.ts` | **Medium** | Large shared write hub; external bulk validation export |
| `content/media/actions.ts` | **Medium** | Same as topics; `content_type` metadata for audit |
| `projects/actions.ts` | **Medium** | Heavy `updateProject` + child sync + ajax surface |
| `ProjectEditForm.tsx` | **Medium** | Form field contract with server action |

**Biggest risk file:** `pages-blocks/pages/[id]/PageBlocksClient.tsx` (client orchestration + optimistic mutations).

**Recommended next split target:** `pages-blocks/pages/[id]/PageBlocksClient.tsx` (client orchestration split — highest remaining risk).

---

## Batch 1: projects actions (completed)

Commit scope: split `src/app/admin/projects/actions.ts` into `project-actions/` modules; keep `actions.ts` as re-export barrel (no `"use server"`). All 10 public exports preserved; caller imports unchanged.

---

## Batch 2: topics actions (completed)

Commit scope: split `src/app/admin/topics/actions.ts` into `topic-actions/` modules; keep `actions.ts` as re-export barrel (no `"use server"`). All 12 public exports preserved (10 functions + 2 types); caller imports unchanged.

Structure:

```
src/app/admin/topics/
  actions.ts
  topic-actions/
    index.ts
    types.ts
    helpers.ts
    validation.ts
    revalidate.ts
    create.ts
    update.ts
    status.ts
    delete.ts
    duplicate.ts
    bulk.ts
```

Audit verify script updated to target mutation modules under `topic-actions/`.

---

## Batch 3: unified media actions (completed)

Commit scope: split `src/app/admin/content/media/actions.ts` into `media-actions/` modules; keep `actions.ts` as re-export barrel (no `"use server"`). All 10 public exports preserved (8 functions + 2 types); caller imports unchanged.

Structure:

```
src/app/admin/content/media/
  actions.ts
  media-actions/
    index.ts
    types.ts
    helpers.ts
    validation.ts
    revalidate.ts
    create.ts
    update.ts
    status.ts
    duplicate.ts
    bulk.ts
```

Audit verify script updated to target mutation modules under `media-actions/`. Unified Media guards (`content_type`, section/category, `media_payload`, slug, status, featured) unchanged.

---

## Batch 4: page block actions (completed)

Commit scope: split `src/app/admin/pages-blocks/pages/actions.ts` into `page-actions/` modules; keep `actions.ts` as re-export barrel (no `"use server"`). All 17 public exports preserved (15 functions + 2 types); caller imports unchanged.

Structure:

```
src/app/admin/pages-blocks/pages/
  actions.ts
  page-actions/
    index.ts
    types.ts
    helpers.ts
    page-status.ts
    page-delete.ts
    page-duplicate.ts
    assignment-create.ts
    assignment-update.ts
    assignment-reorder.ts
    assignment-status.ts
    assignment-delete.ts
    bulk.ts
```

Audit verify script updated to target mutation modules under `page-actions/`. PageBlocksClient.tsx not touched.

---

## Server Actions Split Workstream — Closed

**Baseline:** `origin/main` after Batch 4 (`157959f`), Quality Gate green.

All four oversized server-action targets are split; public `actions.ts` barrels preserved:

| Target | Module folder | Batch |
|--------|---------------|-------|
| `projects/actions.ts` | `project-actions/` | 1 |
| `topics/actions.ts` | `topic-actions/` | 2 |
| `content/media/actions.ts` | `media-actions/` | 3 |
| `pages-blocks/pages/actions.ts` | `page-actions/` | 4 |

**Batch 5:** `pages-blocks/footer/actions.ts` → `footer-actions/` (`7cc2221`).

**Batch 6:** `pages-blocks/menus/actions.ts` → `menu-actions/` (`3d56bf2`).

Remaining oversized work is **client components** (see `docs/client-components-split-plan.md`).

---

## Block Template Actions Review — Completed

**Baseline:** `origin/main` @ `3d56bf2`.

**Review:** `pages-blocks/blocks/*/actions.ts` (8 module-specific files).

**Recommendation:** **No split required.** Block template actions are already domain-separated; no single file matches the prior oversized monolith pattern (~500–850 lines, 15+ exports in one file).

| Module file | Lines (approx.) | Exports | Split? |
|-------------|----------------:|--------:|--------|
| `blocks/content/actions.ts` | 372 | 9 | No — largest file; monitor only |
| `blocks/hero/actions.ts` | 232 | 6 | No — unique revalidation model |
| `blocks/cards/actions.ts` | 188 | 8 | No |
| `blocks/breadcrumb/actions.ts` | 163 | 6 | No |
| `blocks/cta/actions.ts` | 171 | 8 | No |
| `blocks/feed/actions.ts` | 159 | 6 | No |
| `blocks/media-hub/actions.ts` | 44 | 1 | No |
| `blocks/media-sidebar/actions.ts` | 41 | 1 | No |

**Documentation:** [block-template-actions-architecture.md](block-template-actions-architecture.md)

**Deferred (explicit):** `menu-actions/`-style splits for block templates. Future work limited to documentation, optional shared helper extraction, or behavior changes (audit, hero revalidation alignment) — each requires its own planning gate.

---

## Recommended execution order

Safest sequence for future commits (one scoped slice per commit):

| Phase | Work | Risk |
|-------|------|------|
| **0** | This plan (`docs/oversized-actions-split-plan.md`) | None |
| **1** | ~~Split `projects/actions.ts`~~ | **Done** (Batch 1) |
| **2–3** | ~~Split `topics/actions.ts`~~ | **Done** (Batch 2) |
| **4** | ~~Split `media/actions.ts`~~ | **Done** (Batch 3) |
| **5–6** | ~~Split `pages-blocks/pages/actions.ts`~~ | **Done** (Batch 4) |
| **7** | Split `ProjectEditForm.tsx` into tab components | Medium |
| **8** | Split `PageBlocksClient.tsx` (utils → modal → grid → shell) | High |

Preferred ordering principle: **documentation → helper extraction → low-risk action groups → medium action files → client components last.**

---

## Guardrails

1. **Barrel file:** Keep `actions.ts` as re-export hub until all consumers are updated in the same commit slice.
2. **Audit coverage:** After each action split, run `npm run verify:audit-coverage` — guardrail checks file content, not paths.
3. **`"use server"`:** Only mutation-exporting modules need the directive; pure helpers belong in `lib/` or non-server sibling files.
4. **Cross-app imports:** Updating paths for `validateBulkTopicPublish` / `validateBulkMediaPublish` must include `TopicBulkPublishGate` / `MediaBulkPublishGate` in the same commit.
5. **No behavior changes** in split commits — move-only refactors; no validation rule edits.
6. **CI:** Each slice must pass `npm run verify` and `npm run build`.
7. **Do not touch** in split phases unless required by import move:
   - Public UI / routes
   - Supabase schema / SQL migrations
   - GitHub Actions workflow
   - Legacy Media Admin
   - Audit implementation (only move call sites with mutations)

---

## Files not to touch yet

| Area | Reason |
|------|--------|
| `pages-blocks/blocks/*/actions.ts` | **Reviewed — no split required** (see [block-template-actions-architecture.md](block-template-actions-architecture.md)) |
| `pages-blocks/menus/actions.ts` | **Split done** (Batch 6 → `menu-actions/`) |
| `pages-blocks/footer/actions.ts` | **Split done** (Batch 5 → `footer-actions/`) |
| `lib/admin/audit/*` | Audit system complete; only move wrappers with actions if needed |
| Public components / routes | Explicitly out of scope |
| `TopicBulkPublishGate` / `MediaBulkPublishGate` | Touch only when moving bulk validation exports |

---

## Verification (this phase)

After adding this doc only:

```bash
npm run verify
npm run build
```

No change expected to audit coverage script (no action file moves).

---

## Related docs

- [Block Template Actions Architecture](block-template-actions-architecture.md) — block template review closure (no split)
- [Admin Audit Coverage](admin-audit-coverage.md) — audit call sites per action file
- [Unified Content Engine ADR](architecture/UNIFIED_CONTENT_ENGINE.md)
