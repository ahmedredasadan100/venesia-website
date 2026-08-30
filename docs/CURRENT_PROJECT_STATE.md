# Current Project State

**Status:** Official volatile state record
**Updated:** 2026-08-29
**Repository:** `ahmedredasadan100/venesia-website`
**Default branch:** `main`

This file records the minimum current facts needed to begin work safely. Architecture authority remains `../AI_ARCHITECTURE_PRINCIPLES.md`; executable manifests and guards remain the authority for adopter details.

## Current official baseline

The official baseline is the commit currently referenced by GitHub `main`; it must be resolved live before every phase. The current verified GitHub `main` baseline is:

```text
84d8356b7544f40d362a1674c4670930759c4e8d
```

Verified before the final Product Surface Identity re-alignment on 2026-08-21:

| Surface                       | SHA / state                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current official baseline     | `84d8356b7544f40d362a1674c4670930759c4e8d`                                                                                                                              |
| `origin/main` / GitHub `main` | `84d8356b7544f40d362a1674c4670930759c4e8d`                                                                                                                              |
| Delivery state                | Platform Governance, Presentation, and Executable Governance are merged; Product Surface Identity remains a PR #118 candidate until its merge and Production gates pass |

Live Git, GitHub, and deployment evidence supersede this snapshot when they change.

## Current delivery state

Current `main` remains the only official entering baseline. Product Surface Identity is a candidate delta from that exact baseline; its branch or PR is not architecture authority unless merged. This snapshot does not reopen closed Architecture, historical Technical Debt, or completed phases.

## Active phase

- **Title:** Product Surface Identity
- **Baseline:** live GitHub `main` at `84d8356b7544f40d362a1674c4670930759c4e8d`
- **Status:** implementation, final consistency correction, and local verification are complete on PR #118; Ready for Review, not merged, and not production authority.
- **Scope:** classify every Admin/public route and governed nested surface without changing Runtime, Capability, Adoption, Product Behavior, or domain rules.
- **Boundaries:** do not reopen Architecture, historical PRs, or old Technical Debt without current-`main` regression evidence and an explicit scoped request.
- **Delivery:** every future phase must independently prove local `main` = `origin/main` = GitHub `main` before implementation.

## Current architecture truth

- Unified Content owns administrative article, news, press, site-update, video, and gallery records through `public.topics`.
- The public content read owner under `src/lib/content/public-content-read/` owns current public Topic/media listing and detail query contracts. Public search consumers adopt it and do not create entity-specific public search runtimes.
- The Public Pagination Platform Owner under `src/components/Pagination.tsx` and `src/components/pagination-model.ts` owns only page-navigation UI, the bounded page-window model, and URL page destinations. Topics Listing, Media Listing, and Project Tracking adopt the complete owner; Projects Listing adopts its presentation contract only while retaining local state and smooth-scroll behavior. Public Content and Project Tracking read owners retain page data truth, Listing retains content presentation, and all public pagination surfaces now share one visual contract.
- Public Content Read owns Featured data eligibility and reads. The independent Featured Page Module owns source scope, automatic featured-only or ordered manual selection, and its Hero, Editorial, Large Card, 3 Cards, and Carousel presentations. Page Composition owns only assignment, position, and order. Media Hub no longer authors or resolves non-listing Featured content, and Topics Listing no longer owns the visual between Intro and Listing.
- Projects use the database as their only project truth and persist the aggregate through the Project domain RPC owners.
- Project create/edit delegates generic lifecycle, dirty protection, feedback, validation focus, and Create-to-Edit handoff to the current Form Runtime; Project validation and aggregate persistence remain domain-owned.
- Media writes use the Media coordination contract; the global writer-adoption manifest is closed and contains no unadopted tooling owner.
- Menu ordering and Page Composition assignment ordering use their aggregate atomic mutation RPCs; direct parallel ordering writes are guarded.
- Page deletion remains a hard delete in `mutate_page_composition`; its `delete_page` branch removes only page-target Hero assignments before deleting the Page and never deletes Hero templates.
- The official Pages Collection read model is the only Pages list path and exposes its existing assignment aggregate as `moduleCount` through the shared output contract.
- Global SEO, Dashboard Truth, and Reports & Analytics have one read-model owner each. Reports consume the Analytics adapter registry and do not integrate directly with external providers.
- Admin Form, Collection, Data, Feedback, and Confirmation remain separate lifecycle owners under the Admin Interaction governance umbrella; the umbrella is not a super-runtime.
- Product Identity, Runtime, Capability, and Adoption are four independent governance axes. The existing interaction adoption manifest contains the typed Product Surface Identity ledger; its records contain no Adoption or Capability registration ids, and Product Kind is never inferred from Runtime ownership, `workflowClassification`, Collection/Form adoption, or capability applicability.
- Generic Bulk selection, presentation, intent, and confirmation requests remain with the Collection owner. Bulk pending, blocking, optimistic state, snapshot, rollback, reconciliation, and invalidation are owned only by the existing Data Runtime; domain actions retain business operation, eligibility, atomicity, and persistence.
- Full Management Collection claims are sourced from the adoption manifest and fail closed through executable contract/provenance evidence. The current matrix has 11 Full Adoption claims and 0 Partial Adoption entries; local Bulk owners, direct Bulk lifecycle bypasses, local column-preference owners, local Collection query runtimes, missing axes, and false Full claims are negative fixtures.
- The Consumer Capability Adoption Audit derives 18 axes from the Current Shared Capability Set and covers 61 registered Collection/Form consumer records. Every `src/app/admin/**/page.tsx` source has executable inventory coverage; nested consumer graphs stop at separately registered presentation boundaries.
- Shared Listbox behavior is owned by `AdminListboxSelect` and `AdminFormListboxSelect`; the retired native `AdminSelect` owner has no remaining consumer. Boolean switches and selection checkboxes use `AdminFormSwitch` and `AdminCheckbox`; raw primitives remain internal to those owners.
- Every specialized or explicit Form exception records its lower-level shared capabilities, known debt, review trigger, and closure impact. Capability exceptions require explicit per-axis Scope, Approving Owner, Evidence, and Rationale; classification alone cannot auto-approve a local implementation.
- Shared column preferences apply optimistic visibility locally, serialize writes, commit only verified success, roll back the latest failed request to the last committed state, and never use route refresh as preference reconciliation.
- Dashboard recent content and Sitemap Effective Source tables adopt the shared Data Grid presentation owner; Dashboard edit/information interactions adopt Shared Row Actions.
- Governorates, Cities, Districts, and Sub-districts share the Location Collection/Data contracts. Their optional columns, preferences, primary Name preset, sorting, pagination, and Row Actions are shared; Bulk is explicitly `not_required`, and delete eligibility is projected by the Location contract/adapter while the guarded RPC remains final enforcement.
- Existing `/images/**` and `/files/**` values are an explicit read-compatibility boundary for live content, not a write owner and not permission for filesystem uploads in Production.
- Public navigation API/layout consumers share the current public navigation owner, which applies active-menu and published linked-target truth. Redirect resolution uses the current exact capped lookup; neither path may restore the superseded PR #82 read owners.
- The existing Sitemap capability preserves valid entries when one source fails, reports the source failure through the current logging owner, and exposes one route output contract.
- Public Topic pages have one page-level `h1`; Article Markdown headings are rendered under that page heading without changing stored Markdown or approved visual typography.
- Browser verification uses the existing Playwright dependency through one formal configuration on port 3000. `verify:platform-contracts` compares all 22 Public and 67 Admin compiled page routes bidirectionally with the existing Public Route and Admin consumer registries; new unregistered routes and registrations without a compiled owner fail closed. `verify:platform` adds HTTP/auth-boundary evidence; authenticated state is supplied externally and absent state is reported as `SKIPPED / UNPROVEN`.
- Consumer Capability Governance derives all 17 current axes from the existing Current Shared Capability Set across 61 registered Collection/Form consumers. Applicability is typed, every decision/override argument is explicit, and Source Proof resolves canonical executable bindings through an AST runtime import graph. Proof tokens, regex discovery, unused imports, filenames, comment markers, and absence-based applicability are not accepted by the governance gate.
- The same executable-proof boundary now covers Media writer classification, all registered Global SEO route/source consumers, the three Admin Content Editor consumers and six Public content contracts, the five specialized Form consumers, all eleven Page Composition column-preference consumers, Admin Users, and Platform Performance ownership. Their guards consume typed registrations or AST execution graphs rather than raw source strings.
- Operational failures use the existing structured logger with context redaction, the Next.js server `onRequestError` hook, and public/Admin error boundaries. Vercel remains the current server-log sink; no external monitoring vendor has been selected.
- GitHub CI uses PostgreSQL 17 for the Media Coordination, Dashboard Truth, and Reports Analytics service jobs. This alignment changes CI infrastructure only and does not change application behavior, schema, Supabase, or Vercel.
- Existing Supabase admin clients adopt the generated `Database` contract. Compiler-visible table, relation, RPC, and JSON-boundary guards prevent consumers from restoring local result generics or broad database-result assertions; this is contract adoption, not a new Runtime or source of truth.

## Closed architecture phases since the previous state snapshot

| Phase       | Durable outcome                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRs #74–#81 | Medium hardening and Pages/Page Block shell, editor, assignment, feed-module, and presentation contracts merged on current owners.                |
| PR #83      | Unified public content search adopted the current entity-neutral public content read owner.                                                       |
| PR #84      | The remaining valid PR #82 delta was reimplemented on the then-current `main` inside current owners and guarded by `verify:pr-82-delta-recovery`. |
| PR #82      | Closed unmerged as superseded by PR #84; its old baseline, owners, contracts, and superseded implementations are not architecture authority.      |
| PR #85      | GitHub Actions PostgreSQL service jobs aligned with Production PostgreSQL 17; no product or schema change.                                        |

## Closed Platform Health phase

PR #98 closed the evidence-backed Platform Health findings and `DEBT-TYPE-01` within current owners. Generated Database types were adopted without a new Runtime, Provider, Adapter, Product rule, or parallel implementation. This records implementation and merge closure only; it is not a Platform Global Closure or an Architecture reopening.

## Production database reconciliation

The 2026-08-23 authorized Project Location Presentation migration closure established the following facts against the configured Supabase Production project.

| Proof                                             |                                  Reconciled state |
| ------------------------------------------------- | ------------------------------------------------: |
| Repository migration files                        |                                                97 |
| Production registry versions                      |                                                97 |
| Registry SQL provenance                           | Exact repository SQL for all 97 deployed versions |
| Public tables                                     |                                                58 |
| Public tables with RLS enabled                    |                                                58 |
| Public catalog objects with repository provenance |                                               297 |
| Invalid, unready, or non-live indexes             |                                                 0 |
| Unvalidated public constraints                    |                                                 0 |
| Parallel public function overload names           |                                                 0 |
| Public RLS policies                               |                                                 3 |

| Anonymous-callable application data functions     |                                                 0 |
| Registry reconciliation audit records             |                                                21 |

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

The authorized Hero Platform Product closure applied `20260822090000_hero_platform_product_preset_closure.sql` as migration 87. The Project Detail Hero adoption then applied `20260823100000_project_detail_hero_configuration_adoption.sql` as migration 88 with exact repository SQL provenance. Migration 88 adds one `domain-backed` Project Detail presentation template and its singleton invariant inside the existing Hero System; it does not copy Project Domain content or modify the shared Hero status-persistence contract.

The authorized Project Location Presentation Phase 1 closure then applied `20260823114743_project_location_presentation_contract.sql` as migration 89 with exact repository SQL provenance. It adds two visible-by-default Boolean presentation decisions to the existing Project Aggregate, extends the canonical atomic save and duplicate owners in place, preserves all location data, and deliberately leaves Hero and every Public Consumer outside this phase.

The authorized Project Location Presentation Phase 2 closure then applied `20260823123750_project_location_presentation_consumer_adoption.sql` as migration 90 with exact repository SQL provenance. Every visual Project-location Consumer now composes its existing local presentation decision with the Project-owned flags through one semantic selector owner. The existing bounded Project Tracking RPC is replaced in place only to carry those same decisions; no Project data, table, Runtime, Capability, function name, or second source of truth is introduced.

The subsequent Product Review rejected that ownership decision: location values remain Project data, but visibility belongs to each existing Consumer presentation owner. The authorized corrective forward migration `20260823184826_retire_project_location_global_presentation.sql` was applied as migration 91 with exact repository SQL provenance. It retires both Project-level flags from the Admin writer, public read models, and Tracking response while retaining the legacy columns as inert compatibility storage.

The Project Location Section then adopted the existing Content Module presentation owner through the authorized `20260823184832_project_details_location_presentation_adoption.sql`, applied as migration 92 with exact repository SQL provenance. It seeds one published, non-assigned template under the stable deployed slug `project-details-presentation`; the typed contract and only renderer adopter are scoped to the Project Location Section, where its config controls the detailed location label and hierarchy tags. Project rows, Hero, Featured, Listing, Home, Map, Tracking, Search, and JSON-LD remain outside that decision and keep their own presentation behavior. Admin Save, direct Admin Read, and bidirectional Public Rendering were verified on localhost against project I87 before restoring the template to its visible-by-default `true/true` state.

The final Product clarification supersedes migration 92 as the active presentation source without rewriting its deployed history: the switches stay in each Project editor's Location tab and control that Project page's Location Section only. The authorized `20260824012105_project_location_section_presentation_scope.sql` was applied as migration 93 and now has exact repository SQL provenance. It reuses the two existing preserved Boolean columns through a sibling `location_section_presentation` payload on the canonical atomic Project writer; Project location values remain in the Project data payload, and no shared public Project model or other Consumer reads the switches. The canonical Project Admin save now uses immediate tag expiry for its existing shared Project cache group, so the first public read after a successful save observes the stored decision rather than one stale-while-revalidate response. Authenticated Admin Save/Read and the first public read after each bidirectional toggle were proved on project I87; the final stored state is visible-by-default `true/true`. Hero, Featured, Listing, Home, Tracking, Admin Search, and JSON-LD stayed outside the Location Section decision. The historical `project-details-presentation` Content template is classified as retired migration provenance with no active editor, assignment loader, renderer, or mutation path.

The verification failure path exposed an existing mixed-provider Media coordination mismatch: Project reference scans retained both Supabase and filesystem Catalog assets, while the Supabase write-lease owner correctly leased only managed Supabase assets, but the database synchronizer compared that lease against every provider asset. The forward owner fix `20260824022000_media_reference_mixed_provider_lease_scope.sql` was applied as migration 94 with exact repository SQL provenance. It continues locking and persisting every Catalog reference while requiring matching write-lease coverage only for Supabase-managed assets; it creates no table, Runtime, provider, or parallel synchronization path. The two QA-created failed leases were resolved through the existing non-destructive Media Recovery workflow after a complete 17/17-provider reconciliation; no files were deleted or replaced, and subsequent Project saves completed without a media warning.

The authorized Page Composition adoption correction then applied `20260827122828_page_composition_media_position_adoption.sql` as migration 95 with exact repository SQL provenance. It removes only the legacy `main` / `sidebar` database constraints and defaults from Media Hub and Media Sidebar Assignments, preserves every existing row and Position, and lets those two module families use the same semantic Platform Regions as every flexible Page Assignment. It introduces no Capability, Runtime, persistence field, data rebuild, or Assignment model change; Hero remains the only Product-fixed Position exception.

The authorized Topics Listing Presentation Phase 1 closure applied `20260828114621_topics_listing_presentation_phase_1.sql` as migration 96 with exact repository SQL provenance. It seeds one presentation-only Topics Listing template and its Topics page assignment through the existing `mutate_page_composition` write owner; it creates no table, field, Runtime, Capability, read owner, or source of truth.

The authorized Featured Page Module closure applied `20260828233733_featured_page_composition_module.sql` as migration 97 and registered that version once with exact repository SQL provenance. It creates the independent Featured template and Assignment stores under RLS, adopts the existing atomic Page Composition owner, transfers non-listing Media Featured assignments, and seeds the Topics Featured assignment without moving Public Content Read or Placement ownership.

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
