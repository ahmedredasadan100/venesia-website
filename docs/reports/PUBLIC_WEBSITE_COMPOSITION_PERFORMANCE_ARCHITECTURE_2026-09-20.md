# Public Website Composition & Performance Architecture — Global Closure

**State:** Draft PR evidence, 2026-09-20. This report distinguishes implemented guards, source proof, a read-only current-data snapshot, and local browser observations. It does not claim Production behavior for the draft head.

## A. Executive Result

- **PUBLIC WEBSITE PERFORMANCE CLOSURE — PARTIAL.** The published Topics page has a structural Feed taxonomy fan-out on a cold owner-cache resolution: the Category feed performs one exact-count read per selected category, and the Series feed performs one representative-content read per selected series. The published assignment config requests limits of 94 and 20; the public taxonomy owner caps the Category limit at 60. The read-only data snapshot has 10 published categories and 21 published series. This is a source-derived query count, not an observed latency distribution. A read-only PostgREST probe rejected direct grouped aggregates (`Use of aggregate functions is not allowed`); a relationship count uses category ID instead of the current slug contract. Exact grouped semantics therefore need a reviewed database read contract; a Migration is a phase stop condition.
- **FUTURE TEMPLATE PERFORMANCE ADOPTION — PARTIAL.** Current module reads are independent of Position names and current assignments can move among the five defined Positions. Assignment `slot` columns are text, but the public/Admin Position inventory and Venisia Theme region map are fixed; an unknown Region is normalized to `main`. The Product direction is now settled: Template/Layout owns extensible Region definitions and Assignment references one of them. Persisting and enforcing that ownership requires a database Migration, not another Product decision or Runtime.
- The initial pass extended the existing Architecture Boundary Guard. It rejects direct Supabase clients, transport, or `next/cache` imports from public route/presentation sources and has positive and negative fixture proof. This two-gap follow-up changes the report only; no speculative Product optimization was made.

## B. Baseline / Final HEAD / PR

| Fact | Evidence |
| --- | --- |
| Entry baseline | `e36dde5abef7fd62dd9ff6033c37ca09167aaee4` = local `main` = `origin/main` = GitHub `main`. |
| Gate | PR #173 was merged into that SHA on 2026-09-19; GitHub reported zero open PRs at phase entry. |
| Working tree | Tracked/index clean at entry. `debug.log` was untracked and protected. |
| Phase branch | `codex/public-composition-performance-closure`. |
| Previous checked HEAD | `ac998ae5ec2185dee92096b9f8860758c0e22d1b`: local `ci:check` passed on the full serial-CI rerun (Public E2E 11/11), GitHub Quality Gate succeeded, and Vercel Preview was READY. |
| Final HEAD and Draft PR | [Draft PR #174](https://github.com/ahmedredasadan100/venesia-website/pull/174); its head ref supplies the exact final SHA without a self-referential commit hash in this file. No Ready, Merge, Deploy, Migration, or Production mutation is authorized. |

The previous Admin CMS Performance, verification infrastructure, and shared capability closures are baselines. Their scoped results are not remeasured or broadened here.

## C. Current Public Surface Inventory

The executable inventory is `PUBLIC_PAGE_ROUTE_REGISTRY` in `src/lib/admin/links/static-routes.ts`, reconciled by `verify:platform-contracts` with the compiled Next route manifest. It contains 12 CMS-backed fixed routes, `/maintenance`, and 9 dynamic patterns: catch-all CMS Page, Project, Topic, Tracking, News, Press, Site Update, Video, and Gallery details. Search is the ordinary catch-all CMS Page `/search`. There are 9 registered Page Module kinds in `PAGE_MODULE_KINDS`: Hero, Content, CTA, Cards, Breadcrumb, Feed, Featured, Media Sidebar, and Media Hub. The read-only assignment-row snapshot was Hero 12, Content 30, CTA 3, Cards 4, Breadcrumb 11, Feed 4, Featured 7, Media Sidebar 18, and Media Hub 9. Rows include hidden or unpublished assignments; these counts do not assert render coverage.

## D. Public Performance Coverage Matrix

| Surface / journey | Composition and owner | Status / precise limit |
| --- | --- | --- |
| Home, About, Contact, CMS catch-all | `loadPageCompositionBySlug`, Page Blocks and registered renderers | PROVEN BY SHARED OWNER for source adoption; not a latency claim. |
| Topics listing, Category and Series Feeds | Page Composition → Feed → Public Content Read | **BLOCKED** by exact-count and representative N+1 on cold cache; see I/K/AD. |
| Topic detail | Public Content Read detail, Page Composition | PROVEN BY SHARED OWNER for public projection and composition; representative browser detail proof remains targeted. |
| Media Center hub/listings/details | Media adapter → Public Content Read; Media Hub/Sidebar modules | PROVEN BY SHARED OWNER for data path; local mobile and desktop hub proof in Z. |
| Projects listing/detail | Project domain public owners; Projects Hub composition | PROVEN BY SHARED OWNER for source adoption; no new benchmark was warranted by this audit. |
| Tracking listing/detail | Existing Tracking read model and Public Pagination | PROVEN BY SHARED OWNER for bounded read/pagination contracts. |
| Search, result, pagination | CMS Search Module → Public Content Read → Public Pagination | PROVEN BY SHARED OWNER for source path; local mobile search route proof in Z. |
| Header, navigation, footer | Site layout → Navigation owner and Footer composition | PROVEN BY SHARED OWNER for source, shared cache and render path. |
| Breadcrumb, Hero, CTA, Cards, Content, Featured, Gallery/Media modules | Registered Page Composition assignments and corresponding owners | PROVEN BY SHARED OWNER for registration/dispatch. Individual presentation timings are not claimed. |
| Maintenance | Static fallback route | NOT PERFORMANCE-APPLICABLE to CMS Composition. |

## E. Template / Layout Architecture

`src/lib/page-composition/page-assignment-contract.ts` owns semantic Position and module eligibility. `src/lib/page-blocks/load-page-composition.ts` loads assignment families and coordinates data. `src/components/page-composition/PageSlotLayout.tsx` and `venisia-theme-regions.ts` place resolved entries. `SLOT_MODULE_REGISTRY` derives kinds from `PAGE_MODULE_KINDS`; the Theme maps renderer keys. Position, assignment identity, module kind, and presentation remain distinct. Current positions are `main`, `sidebar`, `bottom`, `footer`, and `hero`. Current Placement works among these defined Positions: Hero is Product-fixed; other registered kinds are flexible within the current official inventory. The Module `*_templates` tables are module definitions, not Layout/Template Region owners.

## F. Slot / Placement Independence

Current assignment loaders determine queries from page identity, template/config, and module capability before entries are pushed into `slots[position]`. The Position itself does not choose Public Content Read, Media, or cache owner. `PageSlotLayout` renders one of its stack or main/sidebar branches per request; CSS width changes do not invoke a second loader. This is source proof for current Regions. The future arbitrary-Region contract is **not** proved: `normalizeLayoutSlot` maps unknown values to `main`, `emptySlots` derives only the fixed inventory, and the Theme enumerates those Regions.

## G. Module Architecture

Module definition comes from the typed registry; persisted assignment ID identifies an instance; Position is a field on that assignment. Feed configurations declare type, filters, limit, and presentation; Featured declares source/selection; Media Hub and Sidebar declare section/source and display. Their loaders invoke the canonical Public Content Read or Media adapter. Changing a presentation variant does not itself create a new Public Content owner. Specialized modules remain domain-specific where their contract requires it.

## H. Data Capability / Shared Owner Map

| Public need | Owner / contract | Consumers |
| --- | --- | --- |
| Published Page identity and Composition | `get-published-page-by-slug.ts`, `get-published-page-by-path.ts`, `load-page-composition.ts` | Static and dynamic CMS pages, module loaders |
| Article/News/Press/Update/Video/Gallery content, Feed, Search | `src/lib/content/public-content-read/owner.ts` and `contract.ts` | Topics, Feed, Featured, Search, Media adapter |
| Media projection | `src/lib/media-center/unified-provider.ts` over Public Content Read | Media Hub, listings, details, related |
| Projects and Tracking | Existing Project public read/composition and Tracking read model | Project and Tracking routes |
| Navigation and Footer | `get-public-navigation.ts`, `resolve-footer-composition.ts` | Site shell |
| SEO | `generate-public-metadata.ts`, `load-global-seo-settings.ts`, entity SEO owners | Root/site metadata and details |
| Cache invalidation | `revalidate-public-cache-tags.ts` and owner-specific tags | CMS mutations and public reads |

## I. Composition-Level Performance

`loadPageCompositionBySlug` starts Page, Hero, Page Block, Featured, Media Hub, and Media Sidebar work concurrently. Feed waits for Featured IDs because its exclusion contract depends on Featured truth; that dependency is intentional. Page identity by slug uses React `cache()` and a 300-second tagged Next cache, so the six composition loaders share the request result. Media Hub merges same-type demand at its existing resolver. The Topics Feed taxonomy branch remains an exception: `queryPublicContentFeedCategories` maps selected categories to individual exact-count requests, and `queryPublicContentFeedSeries` maps selected series to individual Public Content Collection requests. The assignment is published and visible on `topics`. These queries are bounded by configured limits but scale with Category/Series count and are not deduplicated across distinct keys.

## J. Request-Scoped Reuse

React `cache()` is already used at published Page by slug, Public Content detail, Global SEO, Navigation, and several module loaders. Next's installed documentation confirms that this scope lasts one render request. Tagged `unstable_cache` is the across-request read cache, not a replacement source of truth. Path and slug Page queries use different projections/identities; the dynamic CMS route can call both on a cold render. One extra read is source-visible but material effect is unmeasured, so no unsafe cross-contract reuse was added.

## K. Query / Projection Findings

Public Content Read has explicit collection, detail, and sitemap projections and bounded collection pagination. Feed Category exact counts and Series newest representatives are the confirmed N+1. Current data has 10 published categories, 21 published series, and 261 published Articles; the visible Topics configuration requests Category limit 94 and Series limit 20, while `normalizeFeedTaxonomyInput` caps the effective Category limit at 60. Source therefore permits up to 10 Category count calls and 20 Series representative calls on a cold resolution today, in addition to base reads. Direct grouped PostgREST aggregate was rejected by the live API. An embedded relationship count returned data but joins by `category_id`, whereas the current exact count filters `category_slug`; repository taxonomy contracts include null-ID/slug compatibility. The current 261 published Articles show zero ID/slug mismatch, which is only a snapshot, not a lasting equivalence guarantee. Replacing exact semantics with an unbounded `topics` scan, an arbitrary first-N window, or an Admin-only count would change correctness. A grouped, bounded read contract needs database design/migration or another equivalent proven existing owner contract; neither is authorized here.

## L. Cache / Revalidation Findings

Public Content Read and Feed taxonomy use `public-content` tags; `revalidateTopicsCache` invalidates that group and `feed-modules`. Page Composition, Hero, Feed, Featured, Navigation, Footer, Project, and SEO reads retain their existing owner tags. No Template-owned cache was found. The new guard prevents a direct `next/cache` import in public Template/presentation sources. Cache hit behavior can hide the Feed fan-out on warm requests; it does not erase the cold-path structure.

## M. Server / Client / Hydration Findings

Composition loading and the primary module render plan are server-side. Interactive Search, Pagination, carousel, and motion components keep client boundaries where behavior requires them. The audited `PageSlotLayout` chooses one responsive render branch, rather than rendering separate desktop/mobile data instances. No material hydration regression was demonstrated by the representative browser checks. This is not a bundle-size proof for every module.

## N. JavaScript Delivery Findings

No measured chunk or main-thread bottleneck justified a dependency, lazy-loading, or splitting change. The public renderer imports current registered module presenters; a future Template must reuse the official dispatch path. No blanket eager/lazy policy was introduced.

## O. Media Performance Findings

The shared Hero and Media components use `next/image` with explicit `sizes` for the inspected Hero, Media cards, sidebar, and related rail. A first mobile probe counted images still lazy-loading as incomplete; a corrected settled check showed zero genuinely broken images on Topics and Media Center at 390 and 1365 pixels. No Media delivery change has a proved root cause here. Media data remains behind the Media adapter and Public Content Read.

## P. Fonts / CSS / Layout Findings

Root layout uses local IBM Plex Sans Arabic weights and Inter variable font through `next/font/local`; its RTL declaration and Venesia visual identity remain unchanged. Representative 390 and 1365 pixel Topics/Media Center renders showed no horizontal overflow. There is no measured font or CSS delta to justify visual-contract changes.

## Q. Header / Navigation / Footer Findings

The site layout starts main/footer Navigation, Footer settings, and Global SEO in parallel. Navigation owner batches published target-path lookups by entity type, uses request-scoped memoization, and owns a tagged 300-second public snapshot. Footer Composition consumes those results. Global SEO is request-memoized between root metadata/site shell paths. No duplicate shell read was proved.

## R. Search / Feed / Pagination Findings

Search remains a CMS Page and a registered Content Module, with Public Content Read as search truth and Public Pagination as URL/presentation owner. Media uses the same public read owner through its adapter. Feed Latest/Popular use bounded Public Content Collection. Category/Series Feed is the blocker in I/K; prior Search and Pagination work is not reopened.

## S. Metadata / SEO Findings

Global SEO settings use React request memoization plus owner cache. Dynamic CMS metadata reads published Page by path and passes its SEO persistence fields to `generatePublicMetadata` with `includePageSeo: false`, avoiding a second SEO-only query. Rendering then loads Page Composition by slug; the path/slug identity duplication is a cold-path candidate, but neither a material latency contribution nor a safe identity-preserving unification is proved. SEO semantics were unchanged.

## T. Real Deltas Implemented

**Product performance deltas: none.** The confirmed Feed N+1 crosses a forbidden Migration/design gate. Other candidates lack material before evidence.

**Architecture guard delta:** Before: `architecture-boundary-guard.mts` protected Admin owners but did not reject direct Supabase client/transport or `next/cache` imports from public Templates and presenters. Root cause: absent public boundary coverage in the existing guard. Owner: the existing Architecture Boundary Guard. After: dynamically discovered tracked public route and non-Admin component files are checked with TypeScript module resolution. A canonical Public Content Read import passes; direct Supabase, package client, and `next/cache` imports fail. The current tree passes; negative fixtures fail with the public-owner contract message. No new Runtime, registry, data owner, or cache was created.

## U. Current Template Adoption

Fixed CMS routes and the catch-all render through `loadPageCompositionBySlug` and the registered slot renderer; Projects Hub, Tracking, and detail routes have specialized domain shells/read owners. Module data loading is not selected by current Position. Current assignment kinds are ADOPTED for registration and dispatch. The Topics Category/Series Feed is **MUST ADOPT a bounded grouped read contract**, but the migration stop prevents completing that adoption here. Specialized domain routes are LEGACY BUT SAFE where their distinct read model is intentional; `maintenance` is NOT APPLICABLE.

## V. Future Template Adoption Contract

A future Template must register its public route with the existing route registry, obtain published Page/assignment truth through the official Page Composition loader, use approved semantic Regions in the official Position contract, and render registered module instances through the Theme's slot dispatch. It must consume the existing Public Content, Project, Media, Navigation, SEO, and cache owners as applicable. A new arbitrary Region cannot be declared solely inside a Template today; the official Position/persistence/Theme contract must first be designed and extended.

## W. Future Module Adoption Contract

Add a module kind to the existing typed module inventory and registry, a typed configuration describing data need and presentation, a loader/adapter that calls an existing domain public read owner, an assignment/visibility path in the official Composition owner, and a renderer dispatched by the Theme. Apply existing cache tags, media components, pagination bounds, failure behavior, and source proof. Distinct entity truth remains with its domain owner; a new presentation variant does not authorize a new data owner.

## X. Architecture / Bypass Guards

`verify:platform-contracts` checks public route registration against compiled routes; `verify:position-driven-composition` checks registered module/renderer and assignment paths; existing Public Content/Feed/Media verification checks read contracts. This pass extends the existing `verify:verification-infrastructure` Architecture Boundary Guard to dynamically inspect public route and non-Admin component sources. Positive/negative meta-proof covers canonical read import versus direct Supabase/cache bypass. The guard is a direct import boundary, not a proof that arbitrary transitive helpers or future Product Regions are behaviorally correct.

## Y. Future Template Adoption Matrix

| Requirement | Current owner / proof / guard | Status |
| --- | --- | --- |
| Unknown Region names | Fixed `PAGE_COMPOSITION_POSITIONS`, `normalizeLayoutSlot`, Theme map | **BLOCKED — technical foundation**; unknown names collapse to `main`. |
| Module relocation across current Regions | Assignment Position field, Composition loader, renderer registry; position guard | PROVEN WITH EXISTING CONTRACT. |
| Responsive relocation | One server branch in `PageSlotLayout`; mobile/desktop smoke | PROVEN WITH EXISTING CONTRACT for current Theme. |
| Data-type change | Public Content Read accepts supported content types; Media adapter | PROVEN WITH EXISTING CONTRACT for current supported types; future domain adoption is a Product/owner decision. |
| Presentation variant | Module config/presenter, shared read owner | PROVEN WITH EXISTING CONTRACT. |
| Shared data reuse | React `cache()`, owner tagged caches | PROVEN WITH EXISTING CONTRACT for identical published Page/SEO/navigation calls; Feed taxonomy exception remains. |
| Cache/revalidation | Existing tag owner, new direct-import guard | PROVEN WITH EXISTING CONTRACT for current modules. |
| Media delivery | Shared `next/image` presenters; mobile/desktop smoke | PROVEN WITH EXISTING CONTRACT for inspected modules. |
| Server/client boundary | Server composition, interactive clients | PROVEN WITH EXISTING CONTRACT for current modules. |
| Pagination/fan-out | Public Pagination and bounded collections; Feed taxonomy gap | **BLOCKED — technical read contract**. |
| Navigation and metadata/SEO | Shared site layout/SEO owners and memoized reads | PROVEN WITH EXISTING CONTRACT. |
| Failure behavior | Existing owner error semantics; public read verification | PROVEN WITH EXISTING CONTRACT for tested owners; future module must adopt. |

## Z. Performance Evidence Matrix

| Representative journey | Existing owner evidence | New read-only observation | Result |
| --- | --- | --- | --- |
| Home | Page Composition and shared shell source | Local 390px: HTTP 200, one H1, no JS page error | PROVEN BY SHARED OWNER for source/route, not timed closure. |
| Topics listing/Feed | Public Content Read and Feed contract verification | Local 390/1365px: HTTP 200, one H1, no overflow, zero settled broken images; live assignment and counts establish cold fan-out | BLOCKED. |
| Media Center hub | Media adapter and Composition source | Local 390/1365px: HTTP 200, one H1, no overflow, zero settled broken images | PROVEN BY SHARED OWNER for inspected journey. |
| Projects listing | Project read/composition source | Local 390px: HTTP 200, one H1, no JS page error | PROVEN BY SHARED OWNER for source/route. |
| Search CMS Page | Search → Public Content Read | Local 390px `/search?types=site_update&sort=newest`: HTTP 200, one H1, no JS page error | PROVEN BY SHARED OWNER for inspected journey. |
| Detail and Tracking | Current domain owners and existing verification | No new timing/Browser run in this pass | NEEDS TARGETED PROOF before a global measured claim. |

Local development navigation times were observed but are not a stable baseline or evidence of an after improvement. No Product performance delta has a before/after timing pair.

## AA. Instrumentation Decision

No new telemetry was retained. Existing owner and browser evidence identify a structural issue without logging payloads, auth, or sensitive headers. A later database-contract decision should measure exact cold request count and user-visible timing before and after its own authorized change.

## AB. Architecture Alert

New Owner: **No**. New Runtime/System: **No**. New Capability: **No**. New Provider: **No**. New Source of Truth: **No**. Parallel implementation: **No**. Contract drift: **Yes, documented** — future arbitrary Regions are not represented by current fixed Position/persistence/Theme contracts; Feed taxonomy has bounded configuration but per-item reads.

## AC. Tests / Checks

- `verify:verification-infrastructure` passed with positive and negative public boundary fixtures.
- `verify:public-content-delivery` passed (183 assertions); `verify:feed-module-contract-integrity`, `verify:position-driven-composition`, and `verify:page-composition-platform-contract` passed. Typecheck, scoped ESLint, and `git diff --check` passed.
- Local Playwright read-only smoke passed for Home, Topics, Media Center, Projects, and Search at 390px; Topics and Media Center also at 1365px. The settled image check found zero broken images and no horizontal overflow.
- The previous checked HEAD `ac998ae5ec2185dee92096b9f8860758c0e22d1b` passed the full `ci:check` rerun (Public E2E 11/11), GitHub Quality Gate and Vercel Preview. The local first run had one parallel-browser `networkidle` timeout; the individual case and full serial-CI rerun passed. For this documentation-only follow-up, any new exact-head GitHub/Vercel outcome is reported in PR check metadata and final handoff. A failed or skipped gate is never reported as passed.

## AD. Remaining Gaps

1. **Migration stop — Gap A:** Public Content Read's exact Category counts and per-Series newest representatives produce per-item cold reads for the published Topics Feed. The current contracts and live assignment/data snapshot establish the fan-out. The live API rejects grouped aggregates; a relationship shortcut changes the slug filter into an ID join, and no grouped public database function exists. A tailored database read contract is required to preserve the current truth. This prevents Current Public closure.
2. **Migration stop — Gap B:** Current Placement works among predefined Positions, but no persisted Layout/Template owns Region definitions or is referenced by `pages`; public/Admin inventories and the Theme are fixed, and the atomic write path has a literal Slot restriction. The approved Product direction is sufficient; its durable Region ownership and assignment validation require a Migration. This prevents Future Template Adoption closure. No Template Builder was created.
3. **Evidence limit:** The representative browser sample does not prove every detail/Tracking journey or a Production latency distribution. This does not by itself invent a Product bottleneck.

## AE. Deferred Product Decisions

Future Template Builder UX, visual grid, drag/drop, responsive editor, and a maximum Module count are deferred and non-blocking for the Region foundation. Region keys are Template-defined, not a future global enum. The two database contracts in **FINAL TWO-GAP CLOSURE** have design decisions but no Migration authorization; neither blocker is silently deferred as harmless.

## AF. Exact Closure Claims

**PUBLIC WEBSITE PERFORMANCE CLOSURE — PARTIAL.**

**FUTURE TEMPLATE PERFORMANCE ADOPTION — PARTIAL.**

The partial claims are based on the blockers in AD, not on speculative timing thresholds. Production proof of a future Product delta is pending after its own controlled merge; this Draft PR does not merge or deploy.

## Future Handoff

1. **New Template tomorrow:** register its route, use published Page Composition, official Regions/Assignments, registered modules, existing domain read owners, Theme dispatch, and current cache/media/SEO owners.
2. **Unknown new Region:** after the approved Migration, define it in the owning Layout/Template and reference its stable key from the existing Assignment `slot`; data owner, query identity, cache, revalidation, and module instance identity stay independent of the Region name.
3. **Move a Module:** keep assignment/module identity, data requirement, public read owner, query/freshness contract, cache tags, and media lifecycle constant unless the instance or data contract actually changes.
4. **New entity type in the same Module:** adopt it through the appropriate existing domain read owner and adapter/typed module config. Do not make the Theme or Position query the entity.
5. **Forbidden local work:** Template/module-owned Supabase client, query engine, cache, revalidation, parallel source of truth, responsive duplicate data instance, or placement-specific performance workaround.
6. **Guards:** route-manifest reconciliation, Position/registered-module verification, Public Content/Feed/Media owner verification, and the extended Architecture Boundary Guard. These prove their named boundaries, not arbitrary behavioral correctness.
7. **Reopen performance only:** for a genuine new requirement, regression, or measured material bottleneck, not merely a new Template or changed Placement.

## FINAL TWO-GAP CLOSURE — Design / Decision Pass

**Decision on 2026-09-20:** Gap A, **READY FOR IMPLEMENTATION — MIGRATION REQUIRED**. Gap B, **READY FOR IMPLEMENTATION — MIGRATION REQUIRED**. These are design-ready within existing Public Content Read and Page Composition owners, respectively. This pass stops before either Migration and before dependent source changes. No further Product decision is needed to establish the Region foundation; future Builder UX is separate.

### A. Corrected Current Position Reality

Current Admin Placement is real. An Assignment can move among the Positions currently exposed by Page Composition, and the existing Theme renders those positions on Home, About, Topics, Media Center, and other applicable pages. `slot` is a text value in the assignment tables, not a database enum. The limitation is the **global predefined interpretation** of that text, not an absent Placement feature. The present Region names are examples of the current Venisia contract, not a final vocabulary for future Templates.

### B. Current Position Owner / Contract

`positions.ts` declares the five current keys; `page-assignment-contract.ts` gives flexible Module kinds every declared key and preserves the explicit Product-fixed Hero rule. `layout-slots.ts` maps legacy names and otherwise converts unknown keys to `main`. Assignment rows in separate `page_*_assignments` tables own `page_id`, `template_id` (the **Module** template), `slot`, visibility and `sort_order`. The `pages` row has `page_type`, but no Layout/Template reference or Region definition. `load-page-composition.ts` creates buckets from the fixed list, and `PageSlotLayout`/`venisia-theme-regions.ts` renders the fixed Theme order. The Admin Position picker and visual map use the same inventory. The database's `mutate_page_composition` `sync_template_pages` branch also restricts `default_slot` to `main`, `hero`, or `sidebar`. A read-only live schema inspection found no Layout/Region table, no Layout reference on `pages`, and text `slot` columns. Module template tables cannot serve as page Layout ownership.

### C. Extensibility Root Cause

There is no persisted entity that can say, “this Layout owns these Region keys,” and no page-to-Layout reference against which an Assignment can be validated. A new arbitrary key would be rejected by source guards or silently collapsed to `main`; merely allowing any text would permit invalid assignments and invisible content. A route/slug whitelist or second Region registry would create parallel truth. A code-only adapter cannot make Template ownership durable and correct for CMS-created pages. **Migration is necessary** for the smallest correct evolution; unknown names themselves are not a Product blocker.

### D. Proposed Region Contract — not implemented

Extend **Page Composition**, with a persisted Layout/Template identity and its ordered Region definitions. Minimum records: Layout stable key/identity; Region stable key, Admin label, explicit order, and owning Layout identity; Page reference to its Layout. Existing Assignment `slot` remains the Region key and existing within-Region `sort_order` remains the order of Modules. The canonical Page Composition read resolves the Page's Layout Regions once, then validates and groups its existing assignments by those keys. The canonical write owner validates against the same persisted definitions, including its atomic RPC path; invalid or unknown keys fail closed instead of becoming `main`. No Region data query, cache policy, score, width, breakpoint, arbitrary Module limit, or allowed-Module whitelist is introduced. Existing explicit Product-fixed Module constraints remain separate from Region identity. The Theme consumes ordered Regions for a future Layout's basic render path; presentation may later specialize geometry without changing Module data loading. A flexible existing Module in a newly named Region keeps its Module identity, read owner, projection, request reuse, tags, media lifecycle and server/client boundary.

### E. Backward Compatibility

**CURRENT:** one global five-key inventory with text Assignment slots and existing legacy aliases. **COMPATIBILITY:** the Migration creates one canonical legacy Layout with those five ordered Region rows and binds every existing Page to it; existing Assignment `slot` values and Module templates remain in place. A bounded adapter accepts the current legacy aliases only while existing rows/callers are reconciled and rejects any other unknown key. Existing Venisia Theme geometry remains the renderer for this legacy Layout, including current main/sidebar behavior and Hero treatment. **TARGET:** Layout-owned Region rows are the only Region inventory for persisted pages, with Page Composition and Admin deriving options from them; the fixed list becomes only a legacy seed/fixture and is removed as an active global truth. The Migration must reconcile stored aliases and validate all existing assignments before enforcing membership. Rollback restores the previous code and legacy Layout mapping only after proving no Page or Assignment uses a new Region; otherwise rollback is data-loss unsafe. There is no permanent dual Source of Truth.

### F. Current Template Adoption

Existing routes keep the same Page identity, Module assignments, visibility, within-Region order, Product-fixed Hero eligibility, URLs, and current Theme placement. Adoption is staged at the **Layout resolution** boundary rather than rewriting every assignment. Pre-Migration source proof covers current Position choices, Composition dispatch and one responsive render branch. Post-Migration proof must compare each current Page's ordered visible Assignment identities and rendered Region against its pre-Migration snapshot, including Home, About, Topics and Media Center, plus atomic Admin move/save/reload and public read. No current Template is force-converted to a new visual grid.

### G. Future Template Proof

After the Migration, a fixture Layout defines a novel key such as `future-region-fixture` with label/order, and a fixture Page references that Layout. Assign an unchanged flexible Content or Feed Module to it; verify one rendered Module, unchanged Public Content Read calls and cache tags, no new per-Region fetch, and no change to Module/Performance source. Changing the fixture key should require only Layout data and Assignment value, not a Performance whitelist. A key absent from that Layout, even if present in another Layout, must fail write validation and must not render as `main`. This is a test fixture, not a Production Template or Builder.

### H. Region / Placement Guards

Extend the **existing** Position/Composition source proof and Architecture Boundary Guard after the persisted contract exists: Layout Region keys are unique and ordered; Assignment belongs to its Page's Layout; unknown keys reject safely; the Theme receives ordered Regions without a global future-name whitelist; a flexible Module moved across Regions retains its data/cache owner. Keep the current public direct-DB/cache import guard. Add negative fixtures for direct Placement DB access, Region-named Module query/cache branches, cross-Layout assignment, and duplicate responsive data lifecycle; add positive current-Layout and novel-Region fixtures. Source checks do not substitute for mounted render and transactional database proof. The current `PageSlotLayout` selects one responsive render branch, so no duplicate data lifecycle was found to fix in this pass.

### I. Feed Category / Series Root Cause

The existing Public Content Read owner selects published, non-deleted Categories, flattens their hierarchy, filters requested slugs and optional published Series category scope, then takes the configured Category limit. It calls an exact `topics` count for **each** selected Category over that Category's descendant **slugs**, with `content_type='article'`, published status, non-deleted rows, exclusion of `e2e-test%` slugs and optional `series_slug IN (...)`. Zero remains zero; a read or malformed count fails with `PublicContentReadError`. Series selection filters published, non-deleted Series, optional descendant Category IDs and requested Series slugs, orders by `sort_order ASC, name ASC`, then takes the configured limit. For each selected Series, `loadPublicContentCollection` fetches the newest published Article by **series slug** (`published_at DESC, id DESC`, page 1, size 1), or yields `representative: null`. The Article projection maps the canonical identity, URL, image and display contract; `/topics?category=<slug>` and `/topics?series=<slug>` links stay unchanged. The current shared owner is correct but invokes one extra count/collection read per selected item on a cold cache resolution: with the current published data/configuration, up to 10 Category counts and 20 Series representative reads beyond base reads. Cache warmth hides, but does not remove, this structure.

### J. Aggregated Read Contract — not implemented

Keep taxonomy selection, order, hierarchy, page/limit semantics, mapping, links, `public-content` tag and failure classification in **Public Content Read**. Add two narrow database reads called only by that owner: (1) selected Category IDs with their owner-computed descendant slug sets plus optional Series slugs → exactly one nonnegative count per requested Category, including zero; (2) selected Series slugs → newest **public Article** per slug, or no representative, using the same publication/deletion/test-slug predicates and `published_at DESC, id DESC`, returning the existing `PUBLIC_CONTENT_COLLECTION_SELECT` projection plus Series key. The owner restores the already-selected Category/Series order; neither database read chooses taxonomy order or invents pagination. Inputs are bounded by existing normalized Feed limit and selected identities; output keys must match exactly, without duplicates or extras. Empty input avoids a database call. RPC/query error, null/malformed result, missing requested count, or invalid projected row fails closed through `PublicContentReadError`; absent Series Article alone maps to `null`. Do not hydrate all Articles, take an arbitrary first-N window, switch slug matching to ID matching, or broaden this into a generic read model. Candidate implementation is two tailored read-only SQL functions (or equivalent scoped database read objects) invoked by the **existing** Public Content Read owner; the series function needs the collection projection in one snapshot so a two-step ID lookup cannot change newest/public truth between reads. Expected consumers are the existing Category and Series Feed variants only. Existing `topics_category_slug_idx`, `topics_series_slug_idx`, `topics_status_idx`, `topics_deleted_at_idx`, `topics_published_at_idx`, and `topic_series` slug/status/deletion/category/order indexes are the starting point; the Migration review must inspect query plans before deciding whether a compound/partial index is justified. Public execution permissions must not expand beyond the current server read boundary.

### K. Migration Decision

**Gap A — MIGRATION REQUIRED:** PostgREST grouped aggregate was rejected in the read-only live probe; an embedded relationship count joins category ID rather than the existing slug semantics; current public database functions have no tailored Feed read. A client batch of complete Articles would be unbounded by content volume, and per-Series `limit(1)` cannot return one latest Article per slug in one ordinary global-limited REST query. SQL grouping/windowing is the smallest correct bounded network read. **Gap B — MIGRATION REQUIRED:** text `slot` storage is already flexible, but `pages` lacks a Layout reference, no persisted Region owner exists, and the atomic write contract includes a literal Slot restriction. The proposed Layout/Region records and membership enforcement require schema and database write-contract changes. Neither Migration was created, applied, or authorized in this pass. No Production data, Auth, Cron, or Permissions mutation occurred.

### L. Verification / Adoption / Rollback

Current source proof: the existing Feed, Public Content Delivery, Position-driven Composition, Page Composition Platform Contract, and verification-infrastructure checks passed on the prior Draft head `ac998ae5ec2185dee92096b9f8860758c0e22d1b`; its GitHub Quality Gate succeeded and Vercel Preview was READY. This design-only follow-up changes no executable code. Before Gap A adoption, require fixture parity for Category counts (including hierarchy, Series scope and zero), Series newest row and null, ordering/limits, publication, slug identity, URLs, projection, failures, and stable bounded request count; compare old and new outputs on a read-only data snapshot and test transactionally without touching Production. Adopt only the two existing Feed variants, retain their owner cache tags, and roll back source to the old correct per-item reads if the new read contract fails **before** retiring old functions; do not silently fall back per request and hide a broken contract. Before Gap B adoption, verify legacy-layout render and Admin move/save/reload, novel-Region fixture, cross-Layout rejection, atomic write and direct-write enforcement, one responsive lifecycle, current Module owner identity and cache tags. Review the Migration's reversible data path before rollout. The later authorized implementation needs its own final-head local gate, GitHub required checks and Vercel Preview.

### M. Remaining Gaps

Only two implementation blockers remain: the tailored grouped Feed database read, and durable Layout-owned Region membership. Both are **Migration stop conditions**, with contracts above and no unresolved Product direction for the foundation. Future Builder UX is non-blocking and out of scope. Current local/browser evidence cannot be promoted into a Production latency claim.

### N. Updated Exact Closure Claims

**PUBLIC WEBSITE PERFORMANCE CLOSURE — PARTIAL:** the Category/Series cold read fan-out remains until Gap A's database contract is authorized, implemented, adopted and verified. **FUTURE TEMPLATE PERFORMANCE ADOPTION — PARTIAL:** current Placement works among defined Positions, but novel Template-defined Regions cannot pass official persistence, validation and render paths until Gap B's Migration and adoption. Do not call either PROVEN from this design or from a green CI run alone.

**Delivery stop:** Draft PR after checks and Preview; stop before Ready. No Merge, auto-merge, manual Deploy, Production mutation, Migration, or Auth/Cron/Permissions change.
