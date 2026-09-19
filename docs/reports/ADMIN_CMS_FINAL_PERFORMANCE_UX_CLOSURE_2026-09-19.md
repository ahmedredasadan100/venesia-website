# ADMIN CMS FINAL PERFORMANCE & UX CLOSURE

Date: 2026-09-19
Claim: **ADMIN CMS PERFORMANCE CLOSURE — PARTIAL**

## A. Baseline / Final HEAD / PR

- Entry: local `main`, `origin/main`, and GitHub `main` all equalled `0954cdcaddd9ddbbf232feecf7579d2e6d16947f`; GitHub had no open PR. Tracked files and index were clean. The protected `debug.log` was untracked and was not opened, staged, or changed.
- Work branch: `codex/admin-cms-final-performance-ux-closure`. The exact final commit and Draft PR are recorded in the PR metadata because a committed report cannot contain its own commit hash.
- #166–#171 performance receipts and #172 Test & Verification Infrastructure Hardening are accepted baselines. Their measurement studies, Heavy Saves, Public E2E, and infrastructure work were not repeated.
- This report distinguishes verified behavior, structural request cost, sampled remote read time, and unproven global latency. A single read pair is not a Production latency distribution.

## B. Final Admin Coverage Matrix

`J01`–`J27` refer to the accepted [system-wide interaction report](ADMIN_NEAR_INSTANT_SYSTEM_WIDE_PERFORMANCE_FINAL_2026-09-17.md), with its exact fixture and evidence limits. `R` means the same accepted before/after receipt is reused; no fresh timing comparison or code change occurred for that row. Each route below is a current page route or a route family with its dynamic `new`/`[id]`/preview children named explicitly. Correctness means the scope of the cited journey, not every possible optional branch. The closure labels describe the stated bounded contract, not a universal speed SLO.

| Surface / journey | Owner | Existing evidence reused | New proof | Before | After | Correctness | Performance status | Closure status |
|---|---|---|---|---|---|---|---|---|
| `/admin` Dashboard and diagnostics | Dashboard read owners, Admin Shell | J25 | Shell guard 31/31 | R | R | Four diagnostics usable after scan | Bounded existing journey; no new latency claim | PROVEN |
| Admin Sidebar, sections, active state, client route, pending, back/forward | Admin Shell and Navigation registry | J25; prior Shell browser journey | Shell source and 31/31 guard, 67 inherited authenticated pages | R | R | Client Link, persistent shell, pending settlement, route identity | No new first/warm or rerender time asserted | PROVEN BY SHARED OWNER |
| `/admin/content/topics`, `/new`, `/[id]`, `/[id]/preview` | Content Editor and Collection owners | J01, J26–J27 | Registered route/adoption reconciliation | R | R | Six topic types, save/reopen, selected preview and branches | Accepted bounded journey | PROVEN BY SHARED OWNER |
| `/admin/content/categories`, `/new`, `/[id]` | Taxonomy domain, Collection/Form | J02, J27 | Adoption reconciliation | R | R | Create/edit/parent/color/close/reopen | Accepted bounded journey | PROVEN BY SHARED OWNER |
| `/admin/content/series`, `/new`, `/[id]` | Taxonomy domain, Collection/Form | J03, J27 | Adoption reconciliation | R | R | Create/edit/reference/close/reopen | Accepted bounded journey | PROVEN BY SHARED OWNER |
| `/admin/media-library` and shared media picker/usage | Media Catalog and shared Media owner | J11, J26 | Source owner reconciliation | R | R | Selected scan, picker, metadata, safe operations | Local image-host preview exception remains separate | PROVEN BY SHARED OWNER |
| `/admin/projects`, `/residential`, `/commercial`, `/new`, `/[id]`, `/[id]/preview` open/edit | Project domain, Form/Collection | J04; #166–#171 | No heavy rerun | R | R | Eight panels, normal/heavy identities and selected save/reopen | Heavy open can take seconds; no universal instant claim | PROVEN BY SHARED OWNER |
| Project Normal/Heavy Save → correct persisted UI | Project save/read, remote Supabase/PostgREST boundary | #168 eight-axis report; #166–#171 | No new mutation | 39/49 diagnostic reads; quiet medians 301.0/1324.1 ms | 36/46 reads; quiet medians 421.8/1723.6 ms in accepted cohort | Request reduction and save integrity proven | Stable latency and remote pre-header attribution unresolved | BLOCKED — service/DB/pool/transport attribution and stable latency absent |
| `/admin/projects/[id]/tracking`, `/stages/[stageId]`, `/items/[itemId]`, `/construction-updates` | Tracking domain, Form/Collection | J06 | Route/adoption reconciliation | R | R | Profile/stage/item/update save, ordering and reopen | Accepted bounded journey | PROVEN BY SHARED OWNER |
| `/admin/projects/locations`, `/governorates`, `/districts`, `/cities`, `/sub-districts` | Location domain, shared Form/Collection | J05 | Route/adoption reconciliation | R | R | Four levels and persistence | Timing for one representative save; no copied per-level ms | PROVEN BY SHARED OWNER |
| `/admin/pages-blocks/pages` list/quick create/search | Page list read, Collection/Form | J07; Pages read-shape receipts | Page Composition contract pass | R | R | Query, page identity, negative-cache correction | Existing bounded journey | PROVEN BY SHARED OWNER |
| `/admin/pages-blocks/pages/[id]` editor, SEO and modules | Page read and Composition owners | J07–J08; #166–#171 | Source: four initial reads in parallel | Warm editor 166.3 ms | Warm editor 97.3 ms in accepted cohort | Correct Page/SEO/assignment/controls | Cold proxy 1255.2→1559.0 ms; no cold improvement claimed | PROVEN |
| Page assignment open/immediate/confirm, placement and return | Page Composition/Assignment owner | J07–J08 | Contract guard pass | Two current-page requests in accepted before | One current-page request in accepted after | Correct target and return | Request-shape improvement; no universal latency claim | PROVEN BY SHARED OWNER |
| `/admin/pages-blocks/blocks` library → managers | Static library and Next Link | J08 | Source: static card inventory, no library DB read | R | R | Active entries link; planned/deprecated entries do not masquerade as editors | No independent library bottleneck established | PROVEN |
| Hero manager/editor | Hero domain, Block editor shared owners | J08; Form adoption | Registry/source reconciliation | R | R | Template, tabs, save/return | Existing bounded journey | PROVEN BY SHARED OWNER |
| Content manager/editor, including Search, Topics Listing and structural variants | Content module editor registry, shared Block editor owners | J08; 16 specialized configurations | Registry/source reconciliation | R | R | Template config, selected save/return and identity | Shared owner coverage; no per-variant benchmark inferred | PROVEN BY SHARED OWNER |
| CTA and Cards managers/editors | Block module owners, shared editor chrome/feedback | J08 | Registry/source reconciliation | R | R | Selected template/save/return | Shared owner coverage | PROVEN BY SHARED OWNER |
| Breadcrumb and Feed managers/editors | Module owners, shared editor chrome/feedback | J08 | Registry/source reconciliation | R | R | Selected template/save/return | Shared owner coverage | PROVEN BY SHARED OWNER |
| Featured, Media Hub and Media Sidebar managers/editors | Their existing module owners and shared editor controls | J08; media catalog reuse receipts | Registry/source reconciliation | R | R | Selected template/media/save/return | No fresh media benchmark | PROVEN BY SHARED OWNER |
| `/admin/pages-blocks/menus` list → editor | Menu list read and shared Collection | J09, J27 | Exact read-only count parity; 3→1 requests for 2 current menus; isolated success/failure guard | `1 + N` menu requests; one per-menu count | One menus request with embedded exact count | IDs, status and counts agree; read failure stays visible | Structural fanout removed; 558.7→219.2 ms is one remote pair, not a latency claim | PROVEN |
| `/admin/pages-blocks/menus/[id]` items, ordering, Save, back/reopen | Menu aggregate and shared Form/Collection | J09; prior Save/reopen | Source: menu/items/preferences parallel; menu failure paths verified | R | R | Ordering, nesting, identity, visible state, committed warning/failure | Existing bounded journey, no new latency claim | PROVEN BY SHARED OWNER |
| `/admin/pages-blocks/footer` builder/preview | Footer aggregate and shared Form | J10 | Source/adoption reconciliation | R | R | Save and preview to real menu | Existing bounded journey | PROVEN BY SHARED OWNER |
| `/admin/seo/redirects` | Redirect domain, shared Form/Collection | J12 | Adoption reconciliation | R | R | Create/edit persistence | Existing bounded journey | PROVEN BY SHARED OWNER |
| `/admin/seo/meta-manager` | Global SEO owner, shared Form | J13 | Adoption reconciliation | R | R | Four tabs, hidden values and save | Existing bounded journey | PROVEN BY SHARED OWNER |
| `/admin/seo/sitemap` | SEO health diagnostics | J14 | Route reconciliation | R | R | Diagnostic result | Diagnostic action only | PROVEN |
| `/admin/users-roles` | Users domain, shared Form/Collection | J15 | Adoption reconciliation | R | R | Selected create/edit/reopen | Existing isolated-fixture journey | PROVEN BY SHARED OWNER |
| `/admin/activity-log` | Audit read owner, shared Collection | J16 | Route reconciliation | R | R | Selected list/search/actor | Existing bounded journey | PROVEN BY SHARED OWNER |
| `/admin/reports`, `/[report]`, `/topics-without-image` | Report read owners | J17 | Route reconciliation | R | R | Selected filter/detail/back/image report | Native CSV/print output remains outside proven branch | PROVEN |
| `/admin/settings/integrations`, `/[integration]`, `/server-configuration` | Integration configuration owners | J18–J19 | Route reconciliation | R | R | Unconfigured/config UI truthful | External connection requires missing credentials; no performance claim | NOT PERFORMANCE-APPLICABLE |
| `/admin/settings/general` | Company/Maintenance owners, shared Form | J20 | Adoption reconciliation | R | R | Company fields and reversible maintenance receipt | Existing isolated-fixture journey | PROVEN BY SHARED OWNER |
| `/admin/settings/media` | Media settings owner, shared Form | J21 | Adoption reconciliation | R | R | Policy save/reload/recovery | Existing isolated-fixture journey | PROVEN BY SHARED OWNER |
| `/admin/settings/security` | Existing Security/Auth owner | J22 | Route reconciliation; no Auth change | R | R | Isolated account/session journey | Existing bounded journey | PROVEN |
| `/admin/settings/theme`, `/appearance` | Existing guidance routes | J23 | Route reconciliation | R | R | Correct destinations; no editor promised | No interactive editor to time | NOT PERFORMANCE-APPLICABLE |
| `/admin/login`, `/forgot-password` | Auth route exception | J24; Shell guard | Auth routes excluded from Shell | R | R | Login/guidance scope only | Guidance does not send reset mutation | NOT PERFORMANCE-APPLICABLE |
| Shared Link picker, grids, tabs, feedback, modal, pending | Existing shared UI/Runtime owners | J26–J27 | Menus Collection source proof | R | R | Selected stale result, query, close and pending branches | Evidence applies only to adopted callers | PROVEN BY SHARED OWNER |

No registered Block Editor type was omitted: Hero, Content, CTA, Cards, Breadcrumb, Feed, Featured, Media Hub, and Media Sidebar are the nine current template/editor families. Search and Topics Listing are Content editor variants, not independent runtimes. Gallery and FAQ cards are planned; deprecated entries have no active editor route.

## C. Sidebar & Shell Findings

The root Admin layout loads company identity through the existing tagged cache and resolves navigation from the static registry. The client Shell uses Next `Link`, intent prefetch, path-based active state, persisted collapse state and route-scoped pending. The existing Shell verifier passed **31/31**, including inheritance by **67 authenticated pages**. The prior J25 browser receipt establishes correct destination/usable dashboard scope. No fresh first/warm click timing or React commit count is claimed. No repeated company read, full document refresh, permissions rebuild defect, or provider fanout was proven in the reviewed owner. No Shell code changed.

## D. Pages / Blocks Findings

The existing Pages read-shape and assignment corrections are reused. The Page editor starts Page, column preferences, assignments and global SEO reads in parallel. The static Blocks library issues no own database read and links active managers. Existing J07–J08 receipts cover Page → Modules, assignment, immediate/open/confirm, return and selected save/reopen. No new Page bottleneck was established; no Page code changed.

## E. Block Editors Findings

The Form adoption manifest derives the nine Block Editor families from its current module contract. Shared editor chrome, Feedback, Form Runtime where applicable, column preferences and media/reference owners are adopted by their declared consumers. Prior J08 proof covers all nine types and 16 Content configurations without assigning one type's milliseconds to another. The previous duplicate reads, eager projections, waterfalls, reference reuse and return-state corrections are retained. No new defect was proven; no editor code changed.

## F. Menus Findings

The Menu editor starts menu, ordered items and preferences concurrently. The nested table uses the existing flattened hierarchy and shared Collection controls; Save/reorder remain with the Menu domain and existing cache/audit contracts. The Menu list alone had a proven request-amplification defect: the initial menu read was followed by one exact-count request per menu. With two current menus the read-only paired probe made **3 requests before, 1 after** and returned identical IDs/counts. Measured durations were **558.7 ms before and 219.2 ms after**, one remote pair only. No UI latency improvement is inferred. The embedded count keeps zero-count rows and returns the list error visibly if the aggregate read fails. The prior J09 Save/back/reopen receipt remains valid because those paths did not change.

## G. Remaining Admin Findings

J01–J06 and J10–J27 cover the remaining route families at the stated behavioral scope. The current route inventory was reconciled with the 67-page Shell guard, Collection/Form manifests and owner source. No forgotten route produced a new proven performance root cause. Existing Product limits for external connections, local image-host preview and native report exports remain explicit; this phase does not turn them into performance passes or alter their owners.

## H. Real Delta Implemented

**Menu list count fanout.** Root cause: `countMenuItemsByMenuIds` issued `N` independent `HEAD count=exact` reads after loading `N` menus. Owner: existing Menu list loader. Before: `1+N` requests and a dependent count phase; current data `N=2` gave 3 requests. After: `menus.select(...,menu_items(count))` gives one request and the same per-menu counts. The unused fanout helper was removed. Correctness proof: read-only current-data parity, typecheck, and isolated owner test for nonzero/zero counts, one read and visible failure. Ordering, identity, visibility, tree writes and persistence code were untouched. This is a structural efficiency gain, not a statistically established user-visible latency gain. [Supabase documents embedded related counts](https://supabase.com/docs/reference/javascript/select).

## I. Shared Owner Adoption Proof

`menus-list` was already registered in the current Collection manifest. Its applicability and source-proof audits passed. It still adopts shared Collection, table, toolbar, search, pagination, columns, row actions, listbox, switch, modal, confirmation, feedback and busy-state owners. The nine Block Editor families remain registered in the Form manifest. The Shell guard establishes shared inheritance across all authenticated page routes. No consumer-specific parallel behavior was added.

## J. Instrumentation Decision

**A — KEEP AS BOUNDED DIAGNOSTIC.** Existing RPC correlation and phase timings are activated only inside the Project Save request and live in the current Supabase fetch/Project Save owners. They log allow-listed phase and RPC names, random trace/span IDs, timestamps, status and sanitized error class; no request body, secret, row content or user identifier is emitted. The trace is request-local and uses the current fetch wrapper. Outside that request the fetch wrapper performs a store lookup and returns without a trace or log. Inside it, the work is constant per RPC/phase: two events per correlated RPC, two root events and at most one event for each of the nine named phases. The existing 16-RPC diagnostic shape therefore has an event budget of 43. Payload fields are fixed and no response body is cloned by this instrumentation. This bounds scope, event volume and payload size; it does not claim a measured Production CPU/log latency. Its future value is matching the already localized pre-header tail to service-side evidence if that becomes available. No trace mode or Heavy Save was rerun, and no instrumentation code changed.

## K. Regression Protection

The existing Menu action failure proof now executes the real Menu list loader with isolated transport: embedded counts 3/0, one menu read, zero per-item count reads, and a failed aggregate read that reports failure instead of false success. This protects the bounded request/read-result invariant without a timing threshold. #172's Architecture Boundary Guard and Restore Transition Guard remain in the canonical path; neither was changed.

## L. Architecture

New Owner: **no**. New Runtime: **no**. New Capability: **no**. New Source of Truth: **no**. Parallel Implementation: **no**. Contract Drift: **none found in changed Menu path**. The Menu list remains the read owner; the PostgREST relationship is the existing `menu_items_menu_id_fkey`. No schema, migration, Auth, Cron, Permissions, Production data, or Product behavior changed.

## M. Tests / Checks

- Targeted: Menu actual-action/read-result/failure proof; typecheck; Menu Collection applicability and source proof; Admin Shell **31/31**; Page Composition contract. All passed on the working source.
- Read-only remote Menu parity: **2 menus, 3→1 requests, identical counts**. This is a single sample and does not establish a latency distribution.
- Final canonical Quality Gate, GitHub required checks and Vercel Preview results are recorded against the exact Draft PR HEAD in the PR body. No successful Heavy Save, Public E2E or isolated study was manually repeated before that final gate.

## N. Remaining Gaps

The blocking global-performance gap remains the **Project Normal/Heavy Save remote pre-header interval**. Accepted correlated traces put **97.5–98.7%** of the affected server span between Supabase fetch start and response headers, but cannot split Production PostgreSQL execution/waits from service/pool queueing, transport/bridge or host scheduling. Quiet Save medians did not show a repeatable latency gain despite the earlier `-3` request correction. The owner boundary is Supabase/PostgREST operational telemetry and the Project Save consumer; resolving the attribution requires correlated service/Production operational evidence outside this phase's Production-mutation and infrastructure-change limits. Therefore `PROVEN` would overclaim. No unproven Product-side optimization was made.

## O. Manual Cleanup

A read-only identity query found Project **#112 present**. **Manual cleanup pending by project owner**. It was not measured or deleted. This phase created no persistent measurement fixture or temporary repository artifact. Protected `debug.log` remains untracked and untouched.
