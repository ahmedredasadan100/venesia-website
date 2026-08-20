# Current Project State

**Status:** Official volatile state record
**Updated:** 2026-08-20
**Repository:** `ahmedredasadan100/venesia-website`
**Default branch:** `main`

This file records the minimum current facts needed to begin work safely. Architecture authority remains `../AI_ARCHITECTURE_PRINCIPLES.md`; executable manifests and guards remain the authority for adopter details.

## Current official baseline

The official baseline is the commit currently referenced by GitHub `main`; it must be resolved live before every phase. The current verified GitHub `main` baseline is:

```text
30995731dc10a82216f170ffe33000cbcda807f3
```

Verified at Product Surface Identity phase start on 2026-08-20:

| Surface | SHA / state |
|---|---|
| Current official baseline | `30995731dc10a82216f170ffe33000cbcda807f3` |
| Local `main` / `origin/main` / GitHub `main` | `30995731dc10a82216f170ffe33000cbcda807f3` |
| Delivery state | Product Surface Identity is implemented only on its independent Draft PR branch until review and merge |

Live Git, GitHub, and deployment evidence supersede this snapshot when they change.

## Current delivery state

The Platform Health implementation and `DEBT-TYPE-01` closure were delivered through PR #98, and Platform Performance Optimization was delivered through PR #100. Current `main` is the only official baseline. This snapshot does not reopen closed Architecture, historical Technical Debt, or completed Performance work.

## Active phase

- **Title:** Product Surface Identity
- **Baseline:** live GitHub `main` at `30995731dc10a82216f170ffe33000cbcda807f3`
- **Status:** implementation and local verification complete on an independent branch; not merged and not production authority.
- **Scope:** classify every Admin/public route and governed nested surface without changing Runtime, Capability, Adoption, Product Behavior, or domain rules.
- **Boundaries:** do not reopen Architecture, historical PRs, or old Technical Debt without current-`main` regression evidence and an explicit scoped request.
- **Delivery:** every future phase must independently prove local `main` = `origin/main` = GitHub `main` before implementation.

## Current architecture truth

- Unified Content owns administrative article, news, press, site-update, video, and gallery records through `public.topics`.
- The public content read owner under `src/lib/content/public-content-read/` owns current public Topic/media listing and detail query contracts. Public search consumers adopt it and do not create entity-specific public search runtimes.
- The same public content read owner owns Featured selection. `automatic` means published content of the requested `content_type` with `is_featured = true`; it has no Latest fallback, so absence returns no Hero. All Media Center listing pages and the hub Featured section adopt that contract, while the CMS declares the same behavior.
- Projects use the database as their only project truth and persist the aggregate through the Project domain RPC owners.
- Project create/edit delegates generic lifecycle, dirty protection, feedback, validation focus, and Create-to-Edit handoff to the current Form Runtime; Project validation and aggregate persistence remain domain-owned.
- Media writes use the Media coordination contract; the global writer-adoption manifest is closed and contains no unadopted tooling owner.
- Menu ordering and Page Composition assignment ordering use their aggregate atomic mutation RPCs; direct parallel ordering writes are guarded.
- Page deletion remains a hard delete in `mutate_page_composition`; its `delete_page` branch removes only page-target Hero assignments before deleting the Page and never deletes Hero templates.
- The official Pages Collection read model is the only Pages list path and exposes its existing assignment aggregate as `moduleCount` through the shared output contract.
- Global SEO, Dashboard Truth, and Reports & Analytics have one read-model owner each. Reports consume the Analytics adapter registry and do not integrate directly with external providers.
- Admin Form, Collection, Data, Feedback, and Confirmation remain separate lifecycle owners under the Admin Interaction governance umbrella; the umbrella is not a super-runtime.
- Product Identity, Runtime, Capability, and Adoption are four independent governance axes. The existing interaction adoption manifest contains the typed Product Surface Identity ledger; Product Kind is never inferred from `workflowClassification`, Collection adoption, Form adoption, or capability applicability.
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
- Existing Supabase admin clients adopt the generated `Database` contract. Compiler-visible table, relation, RPC, and JSON-boundary guards prevent consumers from restoring local result generics or broad database-result assertions; this is contract adoption, not a new Runtime or source of truth.

## Closed architecture phases since the previous state snapshot

| Phase | Durable outcome |
|---|---|
| PRs #74–#81 | Medium hardening and Pages/Page Block shell, editor, assignment, feed-module, and presentation contracts merged on current owners. |
| PR #83 | Unified public content search adopted the current entity-neutral public content read owner. |
| PR #84 | The remaining valid PR #82 delta was reimplemented on the then-current `main` inside current owners and guarded by `verify:pr-82-delta-recovery`. |
| PR #82 | Closed unmerged as superseded by PR #84; its old baseline, owners, contracts, and superseded implementations are not architecture authority. |
| PR #85 | GitHub Actions PostgreSQL service jobs aligned with Production PostgreSQL 17; no product or schema change. |

## Closed Platform Health phase

PR #98 closed the evidence-backed Platform Health findings and `DEBT-TYPE-01` within current owners. Generated Database types were adopted without a new Runtime, Provider, Adapter, Product rule, or parallel implementation. This records implementation and merge closure only; it is not a Platform Global Closure or an Architecture reopening.

## Production database reconciliation

The 2026-08-19 authorized Production migration closure established the following facts against the configured Supabase Production project.

| Proof | Reconciled state |
|---|---:|
| Repository migration files | 86 |
| Production registry versions | 86 |
| Registry SQL provenance | Exact repository SQL for all 86 deployed versions |
| Public tables | 56 |
| Public tables with RLS enabled | 56 |
| Public catalog objects with repository provenance | 291 |
| Invalid, unready, or non-live indexes | 0 |
| Unvalidated public constraints | 0 |
| Parallel public function overload names | 0 |
| Public RLS policies | 3 |
| Anonymous-callable application data functions | 0 |
| Registry reconciliation audit records | 12 |

`public.rls_auto_enable()` is owned by the Supabase platform event-trigger boundary. It is deliberately excluded from application-object provenance and must not be removed as application legacy.

The executable owners are:

```text
scripts/verify-database-reconciliation.mts
scripts/reconcile-migration-registry.mts
```

The structural guard is part of `ci:check`. The authorized closures applied `20260814174238_admin_users_active_invariant.sql`, `20260815092555_media_center_listing_presentation.sql`, and `20260816090000_media_center_hero_owner_closure.sql` in repository order. The Media Center migrations adopt the existing `mutate_page_composition` / `sync_template_pages` write owner, retire Listing Shell, and establish independent Hero, Featured Content, and Listing contracts. The canonical registry reconciler then restored exact repository SQL provenance without replaying these migrations.

The authorized Projects Vertical Slice closure then applied `20260817100000_project_section_title_contract.sql` followed by `20260817101000_media_ordinary_attachment_scope.sql`. The registry now records both migrations with exact repository SQL provenance: Project section headings are explicit nullable fields with the approved three-value backfill, and ordinary media attachment uses target-local safety while global reconciliation readiness remains required by safe delete/reservation flows.

The authorized Construction Tracking closure then applied `20260817170332_project_construction_tracking_detail.sql` as migration 84 with exact repository SQL provenance. It adds the independent Tracking profile/stage/item/update/media-reference graph only: `projects` remains unchanged, no project facts are duplicated, and every Tracking write RPC remains service-role-only behind RLS.

The authorized Tracking and Governance completion then applied `20260818010000_project_tracking_public_pagination.sql` as migration 85 with exact repository SQL provenance. It replaces the existing public Tracking detail function in place so child Stages, Items, Updates, Media, and history remain bounded by the canonical application Read Model; it creates no table, view, Runtime, or second read owner, and the function remains service-role-only.

The authorized security hardening applied `20260819041808_harden_rls_auto_enable_execute_acl.sql` as migration 86 with exact repository SQL provenance. It only revokes `EXECUTE` on the Supabase platform-owned `public.rls_auto_enable()` event-trigger function from `PUBLIC`, `anon`, and `authenticated`; the function body, owner, search path, event trigger, `service_role`, and `postgres` owner access remain unchanged.

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
