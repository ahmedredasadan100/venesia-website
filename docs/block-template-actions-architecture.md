# Block Template Actions — Architecture Reference

**Document status:** Updated documentation proposal
**Updated:** 2026-07-17
**Decision:** Keep module-specific action files; no split is approved.

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


## 1. Current decision

The Block Template Actions review remains closed.

The action surface under:

```text
src/app/admin/pages-blocks/blocks/*/actions.ts
```

is already separated by module domain. The previous monolithic server-action split problem does not apply here.

Do not reopen this workstream merely because a file is large.

## 2. Historical review baseline

The detailed review was originally completed around `origin/main @ 3d56bf2`.

The current Production baseline is `e40245c`, so all historical line counts and export counts in earlier documents are approximations. A future refactor must begin with a fresh repository audit rather than relying on old counts.

## 3. Module boundaries

| Module | Stable action file | Primary table(s) |
|---|---|---|
| Content | `blocks/content/actions.ts` | `content_block_templates` |
| Hero | `blocks/hero/actions.ts` | `hero_templates`, `hero_assignments` |
| Cards | `blocks/cards/actions.ts` | `cards_block_templates` |
| Breadcrumb | `blocks/breadcrumb/actions.ts` | `breadcrumb_block_templates` |
| CTA | `blocks/cta/actions.ts` | `cta_block_templates` |
| Feed | `blocks/feed/actions.ts` | `feed_module_templates` |
| Media Hub | `blocks/media-hub/actions.ts` | `media_hub_module_templates` |
| Media Sidebar | `blocks/media-sidebar/actions.ts` | `media_sidebar_module_templates` |

These are template-library actions, not page-assignment actions.

Page placement and assignment mutations live through:

```text
src/app/admin/pages-blocks/pages/actions.ts
src/app/admin/pages-blocks/pages/page-actions/**
```

## 4. Why no split is approved

- The files are separated by module.
- Callers remain local to each module.
- The largest content action file contains multiple schema/config variants that are safer together until a concrete problem is proven.
- A move-only split would create import and server-action boundary risk without demonstrated product value.
- Final admin QA passed the relevant Page Builder and Block surfaces.
- The non-project release is officially closed.

## 5. Revalidation models

### Standard module pattern

Most template modules use the shared block revalidation flow:

```text
revalidateBlockModulePaths(modulePath)
→ revalidate admin block/page paths
→ invalidate block/module cache tags
→ collect assigned public paths
→ revalidate affected public pages
```

This pattern is assignment-aware and must remain behavior-identical in any move-only change.

### Hero divergence

Hero actions historically use a specialized revalidation path with explicit public route handling and hero cache invalidation.

Do not align Hero to the standard flow as part of a documentation, cleanup, or split task. That would be a behavior change requiring its own evidence and QA gate.

## 6. Assignment synchronization

Template updates may synchronize page assignments.

High-risk flows include:

- content/card/CTA/feed/breadcrumb assignment diff;
- media hub/sidebar specialized assignment sync;
- Hero assignment replacement;
- cache invalidation after affected page changes.

Any refactor must preserve:

- form field names;
- template IDs;
- slot defaults;
- sort order;
- visibility;
- affected-page revalidation;
- error behavior.

## 7. Audit boundary

Template-library CRUD remains intentionally excluded from critical audit coverage.

Current rule:

- page assignment mutations are audited;
- template-library CRUD is not;
- adding audit is a new behavior, not a refactor.

Do not add direct audit inserts or expand the guardrail without explicit product approval.

## 8. Orphan/export caution

Earlier reviews found exports with no known current caller, including row-loading helpers in some modules.

Current rule:

```text
No caller found ≠ safe to delete
```

Before removal:

1. search direct imports and barrels;
2. search dynamic usage and tests;
3. inspect server/client boundaries;
4. verify no external script relies on the export;
5. execute a dedicated cleanup gate.

## 9. High-risk areas

- content config builders and specialized variants;
- assignment synchronization;
- Hero assignment replacement;
- Hero revalidation divergence;
- feed configuration sanitization;
- bulk deletion;
- JSON parsing fallbacks;
- media hub/sidebar seeded update-only behavior;
- cross-page cache invalidation.

## 10. Future reconsideration triggers

Reopen only if one of these is proven:

- a specific file has become materially difficult to maintain;
- a recurring defect is caused by mixed responsibilities;
- test isolation is blocked;
- a new module requires a shared abstraction;
- audit behavior is explicitly approved;
- Hero revalidation is being redesigned;
- an orphan export is proven safe to remove.

A fresh planning gate must include:

```text
Current file inventory
Current callers
Behavior contract
Cache/revalidation map
Audit impact
QA matrix
Minimal commit slices
```

## 11. Current decision

```text
Block template actions split: DEFERRED / NOT REQUIRED
Current workstream: CLOSED
Audit expansion: NOT APPROVED
Hero revalidation alignment: NOT APPROVED
Orphan export removal: NOT APPROVED
Release blocker: NONE
```
