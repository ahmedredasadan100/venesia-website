# Dead Code Cleanup — Current Status and Historical Record

**Document status:** Updated documentation proposal
**Updated:** 2026-07-17
**Active cleanup status:** Closed; no broad purge is approved.

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


## 1. Historical Batch 5 result

The original post-server-actions scan was performed around `origin/main @ 157959f`.

That scan:

- reviewed the split project/topic/media/page action modules;
- verified stable barrels;
- inspected legacy Media Admin redirect stubs;
- searched admin TODO/FIXME/deprecated markers;
- found no provably safe admin file deletion;
- removed no files.

This remains a valid historical result for that baseline only.

## 2. Later project update

A later Dead Code Batch A was completed at:

```text
986c1543a07d8f32cf30dc1611d2e1eb18b315ad
```

The available handoff marks that batch as closed and explicitly says not to start another broad dead-code purge.

This document does not invent or reconstruct the exact file diff of Batch A. The commit diff is the authoritative inventory for what changed in that batch.

## 3. Current protected decisions

Keep unless a fresh caller audit proves otherwise:

- stable `actions.ts` barrels;
- split action folders;
- legacy `/admin/media-center/**` redirect stubs;
- compatibility aliases;
- deprecated-but-documented admin primitives;
- module catalogs needed for compatibility;
- verification scripts;
- public route compatibility;
- untracked protected QA/audit artifacts listed in the handoff.

Do not remove an item because its name contains `legacy`, `deprecated`, `old`, or `unused`.

## 4. Current no-go areas

- No broad repository purge.
- No Projects or Track Your Project cleanup.
- No project DB, RPC, seed, or child-table cleanup.
- No legacy media table/code removal until Unified/Legacy transition is proven complete.
- No public route removal.
- No compatibility-stub deletion.
- No `git clean`.
- No `git reset --hard`.
- No `git add .`.
- No destructive cleanup without explicit approval.

## 5. When dead-code work may reopen

Only with a concrete, scoped claim:

```text
Exact symbol/file
→ current caller search
→ dynamic/import/test check
→ runtime boundary check
→ deletion risk
→ smallest removal
→ dedicated QA
→ approval
```

Good candidates require proof such as:

- zero direct, barrel, dynamic, test, script, or external caller;
- no route/framework convention dependency;
- no migration/seed/history role;
- no compatibility purpose;
- no documentation or operational dependency.

## 6. Required future evidence

Before deleting:

1. Search current repository at the current baseline.
2. Inspect Git history and why the file exists.
3. Inspect Next.js route conventions.
4. Inspect scripts and CI.
5. Inspect stable barrels and exported types.
6. Inspect dynamic table/module registries.
7. Inspect tests and QA tools.
8. Identify rollback.
9. Stage only explicit files.

## 7. Verification for a scoped cleanup

```bash
git diff --check
npm run lint
npm run typecheck
npm run verify:audit-coverage
npm run verify:legacy-media-admin
npm run verify:migrations
npm run build
npm run ci:check
```

Add domain-specific tests for the removed surface.

## 8. Current decision

```text
Historical Batch 5 scan: NO SAFE DELETIONS
Dead Code Batch A: CLOSED at 986c1543
Broad dead-code purge: NOT APPROVED
Projects cleanup: FROZEN
Legacy media cleanup: BLOCKED ON TRANSITION PROOF
Current release blocker: NONE
```
