# Client Components Split Plan — Current Status

**Document status:** Rewritten to remove stale next-step guidance
**Updated:** 2026-07-17
**Active refactor status:** No client-component split is currently approved.

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


## 1. Why this document changed

The earlier plan treated `PageBlocksClient.tsx` and `ProjectEditForm.tsx` as future split targets based on an older repository baseline and historical line counts.

That guidance is no longer safe as an active roadmap:

- the PageBlocksClient workstream progressed through later dedicated phases and is treated as closed;
- final Page Builder/Admin QA passed;
- the Projects scope, including `ProjectEditForm.tsx`, is frozen;
- the non-project release is officially closed;
- no file should be split solely because of line count.

Historical counts such as `~767` and `~533` are not current source-of-truth measurements.

## 2. Current status by target

| Target | Current status | Rule |
|---|---|---|
| `pages/[id]/PageBlocksClient.tsx` | Prior refactor workstream closed; final behavior passed Admin QA. | Do not resume from the old extraction plan. Perform a fresh audit only if a new defect or maintainability problem is proven. |
| `projects/ProjectEditForm.tsx` | Deferred and frozen with Projects. | No refactor, field move, tab split, or action-contract change until Ahmed completes manual Projects review and explicitly reopens scope. |

## 3. PageBlocksClient behavior contract

Even though the old split sequence is not an active task, these behaviors remain protected:

- assignment modal supports generic block, Hero, Media Hub, and Media Sidebar paths;
- assign success/failure preserves the intended modal lifecycle;
- duplicate/invalid assignment errors remain visible;
- visibility mutation refreshes server state;
- reorder remains consistent with server ordering and rollback behavior;
- single delete and bulk show/hide/delete preserve assignment keys;
- selection clears correctly;
- page slots and module-kind restrictions remain enforced;
- stable imports continue through the page actions barrel;
- page composition cache invalidation remains correct.

Do not infer current hook count, file layout, or component boundaries from the historical document.

## 4. PageBlocksClient future gate

A future change is justified only by a concrete claim such as:

- reproducible state-machine defect;
- recurring regression caused by mixed responsibilities;
- testability blocker;
- measurable rendering/performance issue;
- new product requirement that cannot be added safely.

Required preflight:

1. Record current `HEAD`, `origin/main`, branch, and worktree.
2. Measure the current file and dependency graph.
3. Map current child components and hooks.
4. Identify current server action contracts.
5. Capture current QA behavior before changing anything.
6. Propose the smallest extraction.
7. Keep behavior identical.
8. Run dedicated Page Builder QA.

## 5. Protected PageBlocksClient QA

If this scope is ever reopened, test at minimum:

| # | Scenario | Expected |
|---:|---|---|
| 1 | Assign content block | Modal completes correctly and row appears after refresh. |
| 2 | Assign Hero | Valid assignment succeeds; duplicate/invalid assignment is blocked. |
| 3 | Assign Media Hub/Sidebar | Correct module/slot rules apply. |
| 4 | Toggle visibility | Server state and UI remain aligned. |
| 5 | Reorder up/down | Immediate ordering remains consistent after refresh. |
| 6 | Simulated reorder failure | Previous order is restored and error is shown. |
| 7 | Delete one assignment | Correct row is removed. |
| 8 | Bulk show/hide/delete | Keys, selection, and refresh behavior remain correct. |
| 9 | Assign failure | Modal/error lifecycle remains correct. |
| 10 | Sort table | Local display sort does not mutate server order unexpectedly. |

## 6. ProjectEditForm freeze

`ProjectEditForm.tsx` is not an active refactor candidate.

The following are frozen:

- form field names;
- hidden legacy fields;
- section visibility booleans;
- floor-plan/delivery/media child sync flags;
- project tabs;
- slug/code behavior;
- `updateProject` contract;
- project publication logic;
- project database/RPC behavior.

The earlier component extraction ideas are retained only as historical design possibilities. They are not approved work.

## 7. Reopening ProjectEditForm

After the Projects review is completed, a fresh audit must answer:

- Is the current file still oversized?
- Which tabs already moved?
- Which fields are coupled to `updateProject`?
- Which child sync flags are required?
- What project tests exist now?
- What is the smallest behavior-neutral extraction?

No work starts before explicit scope approval.

## 8. Current decision

```text
PageBlocksClient old split roadmap: RETIRED AS ACTIVE GUIDANCE
PageBlocksClient current workstream: CLOSED
Page Builder release QA: PASS
ProjectEditForm refactor: FROZEN
Projects scope: FROZEN
New large-file refactor: REQUIRES FRESH EVIDENCE
Current release blocker: NONE
```
