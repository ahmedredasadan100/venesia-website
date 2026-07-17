# Migration Metadata Reference

**Document status:** Updated documentation proposal
**Updated:** 2026-07-17
**Purpose:** Repository migration history and execution safety

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


## 1. Canonical rule

Files under `sql/migrations/` are version-controlled migration history and fresh-environment rebuild inputs. They are **not** an instruction to replay all SQL against the live Production Supabase database.

```text
Do not run migrations or seeds against Production
without explicit approval, live schema evidence,
a migration-specific plan, and rollback.
```

## 2. Current verified status

- `sql/migrations/` is an official repository directory.
- `npm run verify:migrations` is part of the validation/CI baseline.
- GitHub Quality Gate #83 succeeded at `e40245c`.
- No migration or seed was required for the final hydration fix or production closure.
- No database write was performed by the final production smoke.
- Projects SQL/migrations remain frozen with the Projects scope.

## 3. Migration-count accuracy

The earlier documented count of **35 SQL files** was last verified on 2026-07-08.

It is now a **historical snapshot**, not a permanent invariant. Before quoting a current count:

```bash
find sql/migrations -maxdepth 1 -type f -name '*.sql' | sort
```

or use the repository's existing verification script.

Do not edit this document merely to preserve an old count if the repository has changed.

## 4. Historical migration inventory

The repository history includes:

- previously tracked maintenance, admin-user, and audit-log migrations;
- recovered CMS migration history;
- page/block and module tables;
- project CMS and child-sync history;
- feed, media hub, and media sidebar history;
- site settings and content seeds;
- filename/timestamp collision corrections.

These descriptions are historical. The actual repository tree and verification script are the source for the current file inventory.

## 5. Production safety posture

The current live database already contains the working schema used by Production. Therefore:

- do not replay recovered migrations blindly;
- do not replay seed migrations on populated environments;
- do not assume idempotency;
- do not infer live RLS, functions, triggers, policies, or Storage state only from repository SQL;
- do not treat a green build as permission to mutate Production.

Potential consequences of blind replay include duplicate CMS rows, overwritten content, conflicting constraints, broken foreign keys, or inconsistent seeds.

## 6. Foundational baseline status

`docs/database/foundational_schema_baseline_draft.sql` remains a **draft** unless a later repository audit proves otherwise.

Current safe interpretation:

- reconstructed from application references;
- not a trusted live schema export;
- not an executable Production migration;
- incomplete as evidence for RLS, Storage policies, functions, triggers, and grants.

Before it can become authoritative, compare it against a real schema-only export and document every difference.

## 7. Fresh-environment rebuild warning

A brand-new Supabase environment requires a dedicated rebuild plan because foundational tables may not be fully represented by an approved executable baseline.

Before applying migrations to a fresh environment:

1. Obtain or produce a reviewed schema-only baseline.
2. Verify migration order and dependencies.
3. Separate DDL from seeds.
4. Classify environment-specific settings and policies.
5. Verify RLS, grants, functions, triggers, and Storage.
6. Apply against an isolated environment first.
7. Run application validation and closure suites.
8. Document rollback/rebuild behavior.

## 8. Execution gate

Any new SQL or migration task must include:

| Gate | Requirement |
|---|---|
| Claim | Exact schema/data problem. |
| Evidence | Current repository and live metadata evidence. |
| Risk | Data loss, lock, compatibility, seed, and rollback risks. |
| Minimal fix | Smallest scoped migration. |
| Approval | Explicit approval before execution. |
| QA | Fresh/local/staging validation plus repository verification. |
| Production | Separate approval for live execution and deployment. |

## 9. Frozen and protected areas

- Project tables, RPCs, seeds, project child tables, and project migrations are frozen.
- No Production data mutation.
- No Supabase configuration change.
- No Storage bucket/policy change.
- No auth/session migration.
- No environment change.
- No seed execution.
- No destructive cleanup.

## 10. Required repository checks

```bash
npm run verify:migrations
npm run lint
npm run typecheck
npm run build
npm run ci:check
```

A documentation-only change should not alter migration output.

## 11. Current decision

```text
Repository migration history: ACTIVE AND VERIFIED BY CI
Historical count 35: SNAPSHOT ONLY
Blind Production replay: FORBIDDEN
Foundational baseline: UNVERIFIED DRAFT
Fresh environment rebuild: REQUIRES DEDICATED PLAN
Projects migrations: FROZEN
Current release blocker: NONE
```
