# Current Project State

**Status:** Official volatile state record
**Updated:** 2026-08-14
**Repository:** `ahmedredasadan100/venesia-website`
**Default branch:** `main`

This file records the minimum current facts needed to begin work safely. Architecture authority remains `../AI_ARCHITECTURE_PRINCIPLES.md`; executable manifests and guards remain the authority for adopter details.

## Current official baseline

```text
3b548f5b4bfd1122c4c0a35b1966cfe132b72363
```

Verified as the current delivery baseline for the local 2026-08-14 architecture pass:

| Surface | SHA / state |
|---|---|
| Local phase branch base HEAD | `756734128d0b32cf0dd2766328f26da94ccd2d4b` before the uncommitted pass |
| Local `main` / `origin/main` / GitHub `main` | `3b548f5b4bfd1122c4c0a35b1966cfe132b72363` |
| GitHub / Vercel | Quality Gate and automatic Vercel deployment passed on `3b548f5b4bfd1122c4c0a35b1966cfe132b72363` |

Live Git, GitHub, and deployment evidence supersede this snapshot when they change.

## Current delivery state

The active Platform Governance & Architecture Closure pass is pending delivery from its dedicated phase branch. GitHub remains the authority for its eventual PR, merge, checks, and deployment state; authenticated Admin Browser proof remains environment-dependent.

## Active phase

- **Title:** Platform Governance & Architecture Closure
- **Baseline:** `756734128d0b32cf0dd2766328f26da94ccd2d4b`
- **Branch:** `codex/locations-shared-collection-adoption`
- **Scope:** existing Admin Collection/Data/Domain owners, fail-closed adoption evidence, Location eligibility projection, and local route/page health verification.
- **Delivery:** pending dedicated PR at the time of this state snapshot; live GitHub evidence supersedes this line after delivery.

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
- Generic Bulk selection, presentation, intent, and confirmation requests remain with the Collection owner. Bulk pending, blocking, optimistic state, snapshot, rollback, reconciliation, and invalidation are owned only by the existing Data Runtime; domain actions retain business operation, eligibility, atomicity, and persistence.
- Full Management Collection claims are sourced from the adoption manifest and fail closed through executable contract/provenance evidence. The current matrix has 10 Full Adoption claims and 0 Partial Adoption entries; local Bulk owners, direct Bulk lifecycle bypasses, local column-preference owners, local Collection query runtimes, missing axes, and false Full claims are negative fixtures.
- Governorates, Cities, Districts, and Sub-districts share the Location Collection/Data contracts. Their optional columns, preferences, primary Name preset, sorting, pagination, and Row Actions are shared; Bulk is explicitly `not_required`, and delete eligibility is projected by the Location contract/adapter while the guarded RPC remains final enforcement.
- Existing `/images/**` and `/files/**` values are an explicit read-compatibility boundary for live content, not a write owner and not permission for filesystem uploads in Production.
- Public navigation API/layout consumers share the current public navigation owner, which applies active-menu and published linked-target truth. Redirect resolution uses the current exact capped lookup; neither path may restore the superseded PR #82 read owners.
- The existing Sitemap capability preserves valid entries when one source fails, reports the source failure through the current logging owner, and exposes one route output contract.
- Public Topic pages have one page-level `h1`; Article Markdown headings are rendered under that page heading without changing stored Markdown or approved visual typography.
- Browser verification uses the existing Playwright dependency through one formal configuration on port 3000. `verify:platform` derives route/page health from Next build manifests plus the existing public-route and Admin-navigation registries; authenticated state is supplied externally and absent state is reported as `SKIPPED / UNPROVEN`.
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
| Repository migration files | 78 |
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
