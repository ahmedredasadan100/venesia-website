# Current Project State

**Status:** Official volatile state record
**Updated:** 2026-08-12
**Repository:** `ahmedredasadan100/venesia-website`
**Default branch:** `main`

This file records the minimum current facts needed to begin work safely. Architecture authority remains `../AI_ARCHITECTURE_PRINCIPLES.md`; executable manifests and guards remain the authority for adopter details.

## Current official baseline

```text
5948620314083008a73c668835f1ec789e36dab2
```

Verified on 2026-08-12:

| Surface | SHA / state |
|---|---|
| Local `main` | `5948620314083008a73c668835f1ec789e36dab2` |
| `origin/main` | `5948620314083008a73c668835f1ec789e36dab2` |
| GitHub `main` | `5948620314083008a73c668835f1ec789e36dab2` |
| Vercel Production deployment | `success` on `5948620314083008a73c668835f1ec789e36dab2` |
| GitHub exact-head checks | Application Quality Gate plus Media Coordination, Dashboard Truth, and Reports Analytics on PostgreSQL 17 passed |

Live Git, GitHub, and deployment evidence supersede this snapshot when they change.

## Current open PRs

| PR | State | Architecture status |
|---|---|---|
| #86 — `AI Architecture Constitution Refresh (Version 3)` | Draft; opened 2026-08-12 | Documentation-only Version 3.1.0 proposal from current baseline; Architecture PASS with zero blocking issues. Not Ready, merged, deployed, or Production-authoritative. |
| #1 — `chore: set up Cursor Cloud dev environment` | Draft; last updated 2026-07-17 | Historical environment proposal on an old head. It is not current architecture or current-main evidence and requires a fresh delta/architecture review before use. |

This inventory records GitHub state at the Constitution Refresh delivery gate. Closed and merged history belongs in GitHub and the durable phase summary below.

## Active phase

- **Title:** AI Architecture Constitution Refresh (Version 3)
- **Baseline:** `5948620314083008a73c668835f1ec789e36dab2`
- **Branch:** `codex/ai-architecture-constitution-v3-refresh`
- **Scope:** canonical documentation only; no application, database, Supabase, GitHub-setting, Vercel, deployment, or Production mutation.
- **PR:** Draft #86; the PR body and GitHub are the delivery-state authority.

## Current architecture truth

- Unified Content owns administrative article, news, press, site-update, video, and gallery records through `public.topics`.
- The public content read owner under `src/lib/content/public-content-read/` owns current public Topic/media listing and detail query contracts. Public search consumers adopt it and do not create entity-specific public search runtimes.
- Projects use the database as their only project truth and persist the aggregate through the Project domain RPC owners.
- Project create/edit delegates generic lifecycle, dirty protection, feedback, validation focus, and Create-to-Edit handoff to the current Form Runtime; Project validation and aggregate persistence remain domain-owned.
- Media writes use the Media coordination contract; the global writer-adoption manifest is closed and contains no unadopted tooling owner.
- Menu ordering and Page Composition assignment ordering use their aggregate atomic mutation RPCs; direct parallel ordering writes are guarded.
- Page deletion remains a hard delete in `mutate_page_composition`; its `delete_page` branch removes only page-target Hero assignments before deleting the Page and never deletes Hero templates.
- The official Pages Collection read model is the only Pages list path and exposes its existing assignment aggregate as `moduleCount` through the shared output contract.
- Global SEO, Dashboard Truth, and Reports & Analytics have one read-model owner each. Reports consume the Analytics adapter registry and do not integrate directly with external providers.
- Admin Form, Collection, Data, Feedback, and Confirmation remain separate lifecycle owners under the Admin Interaction governance umbrella; the umbrella is not a super-runtime.
- Existing `/images/**` and `/files/**` values are an explicit read-compatibility boundary for live content, not a write owner and not permission for filesystem uploads in Production.
- Public navigation API/layout consumers share the current public navigation owner, which applies active-menu and published linked-target truth. Redirect resolution uses the current exact capped lookup; neither path may restore the superseded PR #82 read owners.
- The existing Sitemap capability preserves valid entries when one source fails, reports the source failure through the current logging owner, and exposes one route output contract.
- Public Topic pages have one page-level `h1`; Article Markdown headings are rendered under that page heading without changing stored Markdown or approved visual typography.
- Browser verification uses the existing Playwright dependency through one formal configuration. Public and unauthenticated checks run in CI; authenticated state is supplied externally and mutable Admin proof requires an isolated disposable environment.
- Operational failures use the existing structured logger with context redaction, the Next.js server `onRequestError` hook, and public/Admin error boundaries. Vercel remains the current server-log sink; no external monitoring vendor has been selected.
- GitHub CI uses PostgreSQL 17 for the Media Coordination, Dashboard Truth, and Reports Analytics service jobs. This alignment changes CI infrastructure only and does not change application behavior, schema, Supabase, or Vercel.

## Closed architecture phases since the previous state snapshot

| Phase | Durable outcome |
|---|---|
| PRs #74–#81 | Medium hardening and Pages/Page Block shell, editor, assignment, feed-module, and presentation contracts merged on current owners. |
| PR #83 | Unified public content search adopted the current entity-neutral public content read owner. |
| PR #84 | The remaining valid PR #82 delta was reimplemented on the then-current `main` inside current owners and guarded by `verify:pr-82-delta-recovery`. |
| PR #82 | Closed unmerged as superseded by PR #84; its old baseline, owners, contracts, and superseded implementations are not architecture authority. |
| PR #85 | GitHub Actions PostgreSQL service jobs aligned with Production PostgreSQL 17; no product or schema change. |

## Production database reconciliation

The 2026-08-12 read-only reconciliation established the following live facts against the repository migration corpus:

| Proof | Reconciled state |
|---|---:|
| Repository migration files | 75 |
| Production registry versions | 75 |
| Registry SQL provenance | Exact repository SQL for all 75 deployed repository versions |
| Public tables | 51 |
| Public tables with RLS enabled | 51 |
| Public catalog objects with repository provenance | 265 |
| Invalid, unready, or non-live indexes | 0 |
| Unvalidated public constraints | 0 |
| Parallel public function overload names | 0 |
| Public RLS policies | 3 |
| Anonymous-callable application data functions | 0 |
| Registry reconciliation audit records | At least 7 |

`public.rls_auto_enable()` is owned by the Supabase platform event-trigger boundary. It is deliberately excluded from application-object provenance and must not be removed as application legacy.

The executable owners are:

```text
scripts/verify-database-reconciliation.mts
scripts/reconcile-migration-registry.mts
```

The structural guard is part of `ci:check`. On 2026-08-12, a read-only live run exposed the stale documented registry count (`74` versus live `75`); an independent `BEGIN READ ONLY` inventory then reverified all table, RLS, catalog, index, constraint, overload, policy, callable-function, platform-function, and audit counts above. No database write was performed.

## Removed final-cleanup legacy

- the zero-consumer `project-children-sync.ts` owner that still called the retired `sync_project_children` RPC;
- one-off migration apply scripts superseded by the canonical migration corpus and registry reconciler;
- obsolete Production readiness/final-probe scripts that asserted removed owners or historical fixture values;
- the unsafe one-off session-guard rewrite helper;
- tracked QA screenshots and their one-off capture helpers;
- the heuristic dead-code scanner whose import model produced false architecture claims.

Operational recovery, authentication, and focused current QA tools remain because lack of package registration alone is not evidence that an operations tool is dead.

## Current explicit boundaries and non-claims

- Role semantics, rate limiting, compliance-grade blocking audit, and external Analytics provider activation require separate Product/Auth decisions. Current architecture does not invent those policies.
- No direct Production filesystem upload owner exists; static bundled assets and live legacy read values are not runtime writers.
- A provider reported as unavailable must remain unavailable/partial; no report may synthesize zeroes, mock analytics, or fake success.
- A green structural build alone does not prove live database state, authenticated Browser behavior, GitHub checks, Vercel deployment, or Production smoke. Those are separate release proofs.
- No isolated authenticated mutation fixture environment is currently established for reusable save, pending, or optimistic-rollback Browser tests; Production content is never a substitute.
- External alerting, retention, and monitoring-vendor selection remain a Product/Platform decision. Console visibility and platform telemetry do not claim paging or incident-management closure.
- Documentation, exact-head code, manifests, guards, GitHub, database, and deployment evidence can drift independently. Material drift is blocking until classified and corrected at the authoritative owner; a SHA difference alone is never evidence that behavior is missing.

## Update protocol

After a relevant merge or architecture decision, update only:

1. the official entering/current baseline;
2. current owners and explicit compatibility boundaries;
3. live database or deployment facts that were actually re-verified;
4. accepted Product/Auth decisions;
5. newly opened or closed evidence-backed debt.

Do not restore historical PR narratives, generated QA evidence, or duplicate status owners to this file.
