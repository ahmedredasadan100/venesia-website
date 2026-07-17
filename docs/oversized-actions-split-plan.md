# Oversized Admin Actions — Current Architecture Status

**Document status:** Rewritten as a closed-workstream record
**Updated:** 2026-07-17
**Active split status:** No oversized server-action split remains open.

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


## 1. Current summary

The original oversized server-action workstream is complete.

Stable public action barrels were preserved while implementations were split by responsibility.

| Surface | Current module structure | Status |
|---|---|---|
| Projects | `project-actions/**` behind `projects/actions.ts` | Done; Projects now frozen. |
| Topics | `topic-actions/**` behind `topics/actions.ts` | Done. |
| Unified Media | `media-actions/**` behind `content/media/actions.ts` | Done. |
| Pages/Page Assignments | `page-actions/**` behind `pages-blocks/pages/actions.ts` | Done. |
| Footer | `footer-actions/**` behind `pages-blocks/footer/actions.ts` | Done. |
| Menus | `menu-actions/**` behind `pages-blocks/menus/actions.ts` | Done. |
| Block template libraries | Already module-separated under `blocks/*/actions.ts` | Reviewed; no split required. |

## 2. Historical commit milestones

The workstream records include:

```text
157959f — server-action split baseline after page actions work
7cc2221 — footer actions split
3d56bf2 — menu actions split
```

These are historical milestones. Current Production is `e40245c`.

## 3. Preserved architecture rules

### Stable barrels

Callers should continue using stable `actions.ts` surfaces unless a dedicated change updates all consumers safely.

### Server action boundary

- Mutation-exporting modules keep `"use server"`.
- Pure helpers should not become server actions accidentally.
- Types and shared pure helpers remain in appropriate non-action modules.
- Cross-surface imports must not bypass intended barrels without evidence.

### Behavior-neutral split rule

A split commit must not quietly change:

- validation;
- audit action names;
- redirect behavior;
- revalidation/cache behavior;
- form field names;
- database payloads;
- bulk semantics;
- optimistic UI contracts;
- error messages;
- authorization.

## 4. Current client-component status

The earlier document identified:

- `PageBlocksClient.tsx`;
- `ProjectEditForm.tsx`.

They are no longer an automatic continuation of this workstream.

### PageBlocksClient

Later PageBlocksClient work was handled in dedicated phases and is treated as closed. Final Page Builder/Admin QA passed.

Do not resume the historical split recipe without a fresh repository audit.

### ProjectEditForm

The Projects scope is frozen. `ProjectEditForm.tsx` and its server-action field contract must not be changed until Projects are manually reviewed and explicitly reopened.

## 5. Block template decision

Block template actions remain separated by module:

```text
content
hero
cards
breadcrumb
cta
feed
media-hub
media-sidebar
```

No shared monolith exists that justifies a move-only split.

Future behavior changes such as adding template audit logging, aligning Hero revalidation, or removing orphan exports require separate approval.

## 6. Why the workstream is closed

- All identified oversized server-action monoliths were split.
- Stable import surfaces were preserved.
- Audit verification was updated with the moved mutation files.
- Footer and Menus were subsequently split.
- Block template actions were reviewed and intentionally left as-is.
- Final non-project Admin QA passed.
- The non-project release is officially closed.

## 7. No active “next split”

The former recommendation to continue directly into client components is retired.

A large file is not sufficient evidence for refactoring.

A future refactor must start from:

```text
Current problem
Current file and caller map
Measured maintenance or defect impact
Behavior contract
Smallest safe extraction
QA matrix
Approval
```

## 8. Reopening criteria

Reopen only when one of these is proven:

- recurring defects caused by mixed responsibilities;
- blocked product development;
- inability to test critical behavior;
- measurable performance impact;
- current file growth beyond manageable ownership;
- security or authorization risk from coupling.

## 9. Required QA for any future split

```bash
git diff --check
npm run lint
npm run typecheck
npm run verify:migrations
npm run verify:legacy-media-admin
npm run verify:audit-coverage
npm run build
npm run ci:check
```

Also run domain-specific manual/E2E tests for the affected surface.

## 10. Current protected scope

- No project refactor.
- No PageBlocksClient refactor without fresh evidence.
- No block-template action split.
- No audit behavior change in move-only work.
- No public route or public query change.
- No SQL, migration, environment, auth, Supabase, or Vercel change.
- No push or deployment without approval.

## 11. Current decision

```text
Oversized server actions workstream: CLOSED
Projects actions split: DONE / PROJECTS FROZEN
Topics actions split: DONE
Unified Media actions split: DONE
Page assignment actions split: DONE
Footer actions split: DONE
Menus actions split: DONE
Block template actions split: NOT REQUIRED
Client component continuation: NOT ACTIVE
Current release blocker: NONE
```
