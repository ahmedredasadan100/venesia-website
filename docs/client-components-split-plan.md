# Client Components Split Plan

**Created:** Batch 5  
**Baseline:** Server-actions split workstream closed (Batches 1–4 on `origin/main` @ `157959f`)

Target files for future dedicated batches — **no refactor in Batch 5**.

---

## 1. `PageBlocksClient.tsx`

**Path:** `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx`  
**Lines:** ~767 (~700 LOC excluding blanks)  
**Risk:** **High**

### Responsibilities

| Area | Description |
|------|-------------|
| Page header | Title, path, slug, module count, back link |
| Visual slot map | `PageVisualSlotMap` — read-only layout preview |
| Assign modal | Module kind picker, template select, slot, visibility, four assign paths |
| Data grid | Sortable table of assignments, row selection, bulk bar |
| Row actions | Visibility toggle, up/down reorder, delete confirm |
| Bulk actions | Show / hide / delete selected assignments |
| Delete confirm | Modal for single assignment delete |

### State hooks

| Hook | Count / usage |
|------|----------------|
| `useState` | 12+ (modal, delete target, assign form, messages, assign session tracking) |
| `useActionState` | **4** — `assignPageBlock`, `assignHeroModule`, `assignMediaSidebarModule`, `assignMediaHubModule` |
| `useTransition` | 1 — wraps toggle, reorder, delete, bulk |
| `useMemo` | 8+ (sort accessors, manageable rows, template options, reorder adjacency, slots) |
| `useEffect` | 2 — sync rows from props; refresh after successful assign |
| `useAdminTable` | Table sort + row state (includes optimistic row set) |
| `useAdminGridSelection` | Checkbox selection for bulk |

### useActionState / assign flow (must not move casually)

Four parallel `useActionState` bindings share one modal. Session counters (`assignModalSession`, `assignDismissSession`, `assignSubmitSession`) coordinate:

- Which modal open cycle completed assign
- Dismiss on success vs show error on failure
- `assignRefreshNonce` triggers `router.refresh()` after success

**Do not split assign modal state machine without reproducing session semantics.**

### Optimistic update areas

| Feature | Location | Behavior |
|---------|----------|----------|
| **Reorder** | `handleReorder` | Swaps `sort_order` in `table.setRows` before server call; **rolls back** via `table.setRows(previousRows)` on failure |
| Assign | No optimistic row insert — waits for refresh |
| Toggle visibility | No optimistic — `router.refresh()` on success |
| Delete | No optimistic — refresh on success |
| Bulk | No optimistic — refresh after `bulkPageBlockAssignments` |

### Rollback logic

Only reorder implements client rollback today:

```typescript
const previousRows = table.rawRows;
table.setRows(nextRows); // optimistic
// ...
if (!result.ok) table.setRows(previousRows);
```

Server counterpart: `movePageBlockAssignment` (swap sort_order / priority).

### Pure helpers (safe to extract later)

| Function | Notes |
|----------|-------|
| `assignmentRowId` | `module_kind:id` key |
| `isManageableAssignment` | Filters hero/breadcrumb read-only rows |
| `compareAssignments` | Sort order — **must stay aligned** with server `getPageModuleAssignmentsForAdmin` |
| `getSlotOptions` | Slot options per module kind |
| `CloseButton` | Trivial UI |

**Suggested file:** `page-blocks/page-blocks-utils.ts` (no React hooks)

### Child UI sections (extract later)

| Candidate component | Contents | Risk |
|--------------------|----------|------|
| `PageBlocksAssignModal` | Modal + 4 form actions + session state | **High** |
| `PageBlocksDataGrid` | Grid, bulk bar, row actions, reorder buttons | **High** |
| `PageBlocksDeleteConfirm` | Delete confirmation dialog | Low |
| `PageBlocksHeader` | `AdminPageHeader` block | Low |

### Hooks (extract later)

| Candidate hook | Responsibility | Risk |
|----------------|----------------|------|
| `usePageBlocksAssignModal` | Modal open/close, module kind, template, 4× useActionState, session machine | **High** |

### Recommended execution order

1. Extract pure utils (`compareAssignments`, `getSlotOptions`, `assignmentRowId`, `isManageableAssignment`)
2. Extract delete confirm + header (low risk)
3. Extract data grid shell (keep handlers passed as props)
4. Extract assign modal + hook (last — highest regression risk)

---

## 2. `ProjectEditForm.tsx`

**Path:** `src/app/admin/projects/ProjectEditForm.tsx`  
**Lines:** ~533  
**Risk:** **Medium**

### Responsibilities

| Area | Description |
|------|-------------|
| Single form | One `<form action={updateProject}>` wrapping all tabs |
| Tabbed sections | `AdminModuleTabs` with multiple tab panels |
| Basic tab | Identity, images, brochure, progress, visibility toggles |
| Content tabs | Rich text sections (overview, amenities, location, etc.) |
| Media tabs | Floor plans, gallery lists, video fields |
| Side panels | Publish checklist, track readiness, intelligence card |
| Hidden fields | Legacy `map_area`, section visibility booleans |

### State hooks

| Hook | Usage |
|------|-------|
| `useState` | 2 — slug editor in `CompactSlugField` only |
| `useActionState` | **None** — classic form POST to `updateProject` |
| `useTransition` | **None** |

### Optimistic / rollback

**None.** Full page navigation / server response drives updates.

### Pure helpers (safe to extract)

| Function | Notes |
|----------|-------|
| `HiddenBoolean` | Hidden input + checkbox sync |
| `SectionIntro`, `BasicTabSection`, `BasicFieldLabel` | Layout primitives |
| `VisibilityToggle` | Section visibility checkbox |
| `PreservedLegacyFields` | Hidden legacy fields |
| `CompactSlugField` | Slug display/edit mini-state |

### Child UI sections (extract later)

| Candidate | Tab / section |
|-----------|---------------|
| `ProjectBasicTab` | Already a function — move to `ProjectBasicTab.tsx` |
| `ProjectOverviewTab`, etc. | One file per tab content block |
| `ProjectVisibilitySection` | Visibility toggles group |
| `ProjectMediaTab` | Floor plans + gallery |

### Recommended execution order

1. Extract shared field primitives (`BasicTabSection`, `VisibilityToggle`)
2. Extract `ProjectBasicTab` to own file
3. Extract remaining tab panels one at a time
4. Keep single form wrapper + `updateProject` action until all tabs moved

---

## Risk summary

| File | Level | Primary risk |
|------|-------|--------------|
| `PageBlocksClient.tsx` | **High** | 4× useActionState, assign session machine, optimistic reorder rollback |
| `ProjectEditForm.tsx` | **Medium** | Form field name contract with `updateProject` / child sync flags |

---

## PageBlocksClient — Batch 6 preparation (documentation only)

**Batch 5 did not edit `PageBlocksClient.tsx`.**

### Must not touch (without dedicated batch + QA)

- Four `useActionState` assign bindings and shared modal
- `assignModalSession` / `assignDismissSession` / `assignSubmitSession` state machine
- `handleReorder` optimistic swap + rollback
- `compareAssignments` ordering (must match server)
- Bulk action FormData shape (`ids` as `kind:id`)
- Imports from `../actions` (stable barrel)

### Safe future extractions (Batch 6+)

1. `page-blocks-utils.ts` — pure functions only
2. `PageBlocksDeleteConfirm.tsx` — presentational
3. `PageBlocksHeader.tsx` — presentational

### Manual QA checklist (before/after any PageBlocksClient split)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Assign content block | Modal closes, row appears after refresh, no error |
| 2 | Assign hero (page without hero) | Success; second hero blocked by server message |
| 3 | Assign media-sidebar / media-hub | Correct slot enforced |
| 4 | Toggle row visibility | Status pill updates after refresh |
| 5 | Reorder up/down | Order changes immediately; persists after refresh |
| 6 | Reorder failure (simulate) | Order rolls back; error message shown |
| 7 | Delete single assignment | Row removed after refresh |
| 8 | Bulk show / hide / delete | Selection clears; grid matches server |
| 9 | Assign failure (duplicate template) | Modal stays open; Arabic error in info bar |
| 10 | Sort columns | Local sort only; no server mutation |

### Tiny cleanup recommendation (not applied)

None required. Lint/typecheck clean; no unused imports detected in Batch 5.

---

## Menus actions — deferred split note

**File:** `src/app/admin/pages-blocks/menus/actions.ts` (~583 lines, 15 exports)

**Deferred in Batch 5** because:

- JSON import rebuilds parent/child tree with runtime id remapping
- Menu duplicate copies nested items with `idMap`
- Bulk delete cascades menu_items then menus
- Shared `revalidateNavigation()` touches many public paths
- 15 exports across menu + menu_item surfaces

**When ready:** follow `menu-actions/` layout in oversized-actions-split-plan; treat reorder + import as high-care modules.

---

## Footer actions — Batch 5 split

**Completed:** `footer-actions/` (2 mutations + 3 types). See commit in Batch 5 report.
