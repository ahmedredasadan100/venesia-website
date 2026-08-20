# Systems, Runtimes, Capabilities, and Ownership

**Status:** Canonical ownership map
**Volatility:** Medium
**Architecture authority:** `../AI_ARCHITECTURE_PRINCIPLES.md`

This document is an operational map. It does not override the architecture constitution or declare volatile PR closure.

## 1. Architecture equation

> Entities own domain data and invariants.
> Runtimes own reusable lifecycle and shared state.
> Capabilities own reusable product functions.
> Adapters translate entity or infrastructure boundaries.
> Shared Components render and collect intent.
> Systems organize contracts, adoption, tests, and closure.

Product Surface Identity is a separate classification axis. It records what
the user entered a route or nested surface to do; it does not own execution.
Runtime, Capability, and Adoption remain independent axes and cannot be used to
infer Product Identity.

The executable Product Surface Identity ledger lives inside the existing
`src/lib/admin/interaction-system/adoption-manifest.ts` owner. It registers
Admin routes, public routes, governed nested surfaces, Workflow Owners, Runtime
Owners, and reciprocal parent/child relationships. No Product Runtime, second
manifest, or parallel registry exists.

Identity records contain no Collection/Form Adoption ids and no Capability
registrations. Those axes retain their own ledgers and guards. Runtime Owners
are recorded only as current execution ownership and cannot determine Product
Kind.

## 2. Top-level system map

| System / bounded area | Purpose | Primary owners | Must not become |
|---|---|---|---|
| Admin Interaction System | Umbrella for authenticated Admin experiences | Shell, Runtimes, capabilities, domain consumers | A single God Runtime |
| Design System | Accessible, RTL-ready, responsive presentation primitives | Shared UI components and tokens | Domain or persistence layer |
| Admin Shell System | Navigation, layout, company identity, page context | Shell contracts, navigation registry, shell UI | Form/list/domain lifecycle owner |
| Collection System | Search, filters, sort, page, selection, columns, row/bulk presentation | Collection Runtime and shared list UI | Database query engine |
| Instant Data System | Fetch, cache, cancellation, hydration, optimistic mutation, rollback, invalidation | Data Runtime and entity adapters | Entity-specific business service |
| Form System | Generic create/edit lifecycle | Form Runtime and structured actions | Parallel SaveBars or entity-specific form engines |
| Feedback System | Action feedback channels and lifecycle | Feedback Runtime | Mutation executor |
| Confirmation System | Accessible dangerous-action confirmation | Confirmation Runtime | Deletion policy owner |
| Media System | Durable upload/list/delete provider contract | Media Storage Adapter and secured boundaries | Form or entity workflow owner |
| Unified Content Domain | Topics and specialized content types in one Admin content source | Topic entity, content registry, specialized editors | Parallel Media or Article Admin engine |
| Public Content Read | Entity-neutral public Topic/media collection and detail reads, search, filters, and pagination | `src/lib/content/public-content-read/` owner and contract | Entity-specific public search/read Runtime |
| Public Navigation and Redirects | Active menu/published-target navigation snapshots and exact active redirect resolution | Current navigation and redirect read owners | API-local Supabase read path or full redirect collection load |
| Taxonomy Domain | Categories, hierarchy, series, relation-safe mutations | Category/Series domain services and RPCs | Generic Runtime |
| Page Composition Domain | Pages, blocks, assignments, menus, footer | Specialized composition workflows | Forced generic form without analysis |
| Projects Domain | Project entity family and project-specific children | Project domain services and adapters | Duplicate systems per residential/commercial variant |
| Auth / Users / Security | Identity, sessions, users, roles, security settings | Server authorization and specialized workflows | UI-only permission system |
| Audit Domain | Non-blocking critical Admin mutation evidence | Audit helpers, action names, verification guard | Blocking primary transaction |

## 3. Runtime ledger

### Collection Runtime

Owns:

- search, filter, sort, pagination, and page-size intent;
- selection;
- visible-column interaction;
- row/bulk action presentation;
- URL-state integration;
- empty/loading/error presentation contract;
- floating-layer behavior for list controls.

Does not own SQL, cache implementation, domain eligibility, storage, or form state.

### Data Runtime

Owns:

- canonical collection query contract;
- strict external parsing and internal normalization;
- stable query keys;
- RSC initial-data hydration;
- client fetch, cancellation, retry, stale time, and previous-data behavior;
- normalized page reconciliation;
- exact cache snapshots;
- dataset-scoped optimistic patches;
- rollback and targeted invalidation;
- row and bulk pending state;
- adapter registry execution and output validation.

Does not own visual layout or domain rules.

Dataset scope for generic optimistic operations is:

```text
entity + search + filters + mode
```

Page, sort, and page size are view parameters, not dataset identity.

### Form Runtime

Owns:

- create/edit mode;
- pending and complete form lock;
- clean baseline and dirty detection;
- Save and Close;
- unsaved-change interception;
- structured action state;
- field error mapping;
- tab reveal and visible-field focus;
- success/error feedback publication;
- clean-baseline update after success;
- safe Create → Edit handoff.

A generic create/edit surface must have one real `<form>` owner and one save owner.

### Feedback Runtime

Owns:

- feedback entries and channels;
- lifecycle, dismissal, persistence, and deduplication;
- critical focus behavior;
- viewport placement and stacking;
- interactive repair/action links.

It does not execute the mutation.

### Confirmation Runtime

Owns:

- portal rendering;
- accessible dialog semantics;
- initial focus and focus trap;
- Escape/backdrop behavior;
- scroll lock;
- pending lock;
- focus return;
- duplicate invocation protection.

New `window.confirm` is prohibited.

### Media Storage Adapter

Owns:

- environment-safe provider selection;
- folder and object listing;
- upload and stable result shape;
- managed-asset detection;
- safe deletion;
- provider path translation.

It does not own Topic, Project, Page, or form lifecycle.

### Media Catalog and reference safety

This is an extension of the existing Media capability, not a new Runtime or System. It owns canonical asset identity, catalog metadata, safe folder records, typed reference providers, reconciliation state, fail-closed deletion eligibility, and coordinated replace-all behavior. Domain owners remain responsible for their own writes and call the reference synchronization boundary afterward.

The shared `MediaLibraryCore` is a UI capability surface with Manage and Select modes. It does not become a form, page-composition, or project lifecycle owner.

## 4. Capability model

A Capability answers:

> What reusable product function can this entity perform?

A Runtime answers:

> What reusable lifecycle coordinates state and behavior while it happens?

Every official Capability requires:

- stable key;
- owner;
- typed contract;
- eligibility;
- failure semantics;
- security and audit rules;
- adopter inventory;
- exceptions;
- tests;
- truthful maturity status.

Candidate and existing capability areas include:

| Capability | Required owner concern |
|---|---|
| Publishing | eligibility, status transition, first-publish semantics, audit |
| SEO | fallback, override, validation, canonical/robots semantics |
| Preview / Public View | route resolution, draft/public eligibility, safe navigation |
| Slug | generated/manual/locked states, collision and redirect policy |
| Media | upload/selection/clear/reference semantics |
| Taxonomy | category/series declarations and domain relation rules |
| Revision History | retention, restore, permissions, audit |
| Visibility / Archive / Restore | state semantics shared across eligible entities |
| Permissions | server authorization and UI projection |
| Audit | action naming, actor context, sanitized metadata |

Exact adopter and closure status must come from current code, adoption manifests, guards, and `CURRENT_PROJECT_STATE.md`. This ownership document must not freeze a stale PR snapshot.

## 5. Unified content domain

`public.topics` is the canonical administrative content source for supported content types such as:

- article;
- news;
- press;
- site update;
- video;
- gallery.

Canonical Admin surfaces:

```text
/admin/content/topics
/admin/content/topics/new
/admin/content/topics/[id]
/admin/content/topics/[id]/preview
/admin/content/categories
/admin/content/series
```

Content type selects the editor and public renderer. Category and Series organize content; they must not secretly select an editor.

A specialized editor may own content-type-specific fields. It must still reuse shared lower-level runtimes and contracts.

Do not recreate parallel legacy Admin CRUD engines for Articles or Media.

## 6. Taxonomy domain

- Category is the structural hierarchy source.
- Series is the editorial grouping source.
- Existing inactive relations may remain editable when the domain contract permits it.
- New choices should follow current eligibility rules.
- Relation-changing mutations that touch taxonomy and Topics must be atomic.
- Active-content counts may exclude soft-deleted Topics while hard-delete guards may include linked soft-deleted rows. These are different semantics.
- The generic Runtime must not reproduce taxonomy transactions.

## 7. Page composition and block templates

Pages, block templates, assignments, menus, and footer are specialized composition workflows.

Specialized status does not permit lower-level duplication. These workflows must reuse, where applicable:

- Design System;
- Feedback Runtime;
- Confirmation Runtime;
- Media Storage Adapter;
- shared Slug/SEO/Permissions/Audit capabilities;
- Data Runtime for collection surfaces fitting the contract.

A large file is not proof that a new Runtime or refactor is required.

Template-library CRUD, page assignments, Hero behavior, and cache revalidation may have different domain semantics. Do not merge them casually.

## 8. Audit ownership

Critical successful Admin mutations should use canonical audit helpers rather than direct local inserts.

Audit is intentionally non-blocking unless a future approved ADR changes that policy:

- primary mutation success must not depend on audit insertion;
- failures are logged server-side;
- metadata is small and sanitized;
- secrets and oversized payloads are prohibited.

Read-only viewers are not mutation audit surfaces.

## 9. Adapter rules

An Adapter may translate:

- entity query params into a generic query contract;
- database/RPC rows into runtime results;
- entity fields into shared component options;
- domain actions into mutation result contracts;
- provider operations into media results.

An Adapter must not own:

- pending lifecycle;
- cache lifecycle;
- feedback policy;
- confirmation;
- navigation;
- dirty state;
- retries.

If an Adapter starts orchestrating the lifecycle, it has become a duplicate Runtime.

## 10. Shared Component rules

Shared Components may own:

- rendering;
- generic variants;
- accessibility;
- keyboard interaction;
- RTL;
- responsive behavior;
- presentation-local open/focus/search state.

They must not:

- query entity tables;
- decide publishing or deletion eligibility;
- perform multi-table mutations;
- choose storage providers;
- know private credentials;
- hard-code unrelated entity routes.

## 11. Closure truth

Use only scoped closure language:

- foundation;
- reference consumer;
- adoption tranche;
- capability;
- global Runtime;
- System;
- implementation;
- merged;
- Production.

A screen working does not close its Runtime globally.

A current ownership or adoption claim is invalid without:

- an inventory;
- one owner;
- duplicate removal;
- architecture guard;
- failure-path proof;
- exact-head verification;
- explicit exceptions.

## 12. Review questions

1. Who owns this behavior now?
2. Is there a second owner?
3. Is this a Runtime, Capability, Adapter, domain service, or component concern?
4. What is the single source of truth?
5. Does shared core know an Entity it should not know?
6. Does failure restore exact state?
7. Is the operation atomic when it must be?
8. Is authorization server-side?
9. Is the old owner removed?
10. Does the closure claim match the full inventory?

## 13. Current maturity and decision boundaries

Current closure and adoption details come from executable manifests and guards. This table records ownership only.

| Area | Current owner state | Remaining boundary |
|---|---|---|
| Admin Interaction System | Governance umbrella over separate Form, Collection, Data, Feedback, Confirmation, and shared-capability owners | It never becomes a super-runtime; adopter claims remain manifest-owned |
| Collection and Data Runtimes | Shared collection query, cache, optimistic mutation, rollback, and adapter contracts are established | Entity read models and business invariants remain domain-owned |
| Form Runtime | One shared long-lived create/edit lifecycle owner with registered adopters and explicit specialized exceptions | Specialized composition workflows are not forced into a generic form |
| Feedback and Confirmation | Shared accessible owners are established; new native confirmation is forbidden | Product-specific input prompts are not destructive confirmation policy |
| Media System | Durable provider, catalog, reference coordination, delete saga, recovery, and global writer-adoption owners are established | Live legacy paths remain read-only compatibility inputs until their data retirement gate |
| Taxonomy and Unified Content | One Topics truth with atomic taxonomy domain mutations and specialized editors | Content-type-specific fields remain specialized, not parallel engines |
| Page Composition and Menus | Specialized domain owners with aggregate atomic mutation RPCs | Shared UI/Data owners may be reused without owning composition truth |
| Projects Domain | Database-only project truth with atomic aggregate persistence, publication, row actions, and public read contracts | Project-specific invariants remain in the Project domain |
| Dashboard | `admin_dashboard_truth_v1()` is the request-time KPI/diagnostics read-model owner | Dashboard presentation must not create another KPI source |
| Reports and Analytics | `admin_reports_truth_v1()` plus the Analytics adapter registry and normalized `analytics_provider_read_models` are the reporting/analytics owners | Reports never call providers or infer connection state |
| External Integrations | `src/lib/admin/integrations` plus `integration_connections` own OAuth, Vault references, asset binding, provider adapters, connection diagnostics, sync leases/retry/backoff, and watermarks | Vercel Cron is a thin trigger; provider metrics cross only through the Analytics ingestion adapter |
| Public Content Read | `src/lib/content/public-content-read/` owns current public collection/detail query input and output contracts across Topics and media consumers | Public pages compose this owner; they do not branch into entity-specific search runtimes or restore superseded direct read helpers |
| Public Navigation and Redirects | Navigation API/layout share the current navigation owner; redirect resolution uses exact capped active lookup | Menu activity and published-target truth remain owner-side; consumers do not create duplicate Supabase read paths |
| Auth / Users / Security | Server session and user-management foundations exist; all public application tables have live RLS enabled | Role semantics and rate limiting require explicit Product/Security decisions |
| Database reconciliation | Repository corpus, registry provenance, catalog ownership, validity, and drift are guarded structurally and live | Supabase platform objects remain platform-owned exceptions, not application legacy |

### Accepted ownership consequences

- Media deletion safety belongs to the Media reference/deletion capability, not to a form or list component.
- Page/Menu transaction correctness belongs to their domains, not to the shared Form or Data Runtime.
- Project aggregate correctness belongs to the Project domain RPCs, not a resurrected child-sync compatibility owner.
- Navigation visibility never substitutes for server authorization.
- Dashboard and Reports may share lower read models, diagnostics, and audit without duplicating their Sources of Truth.
- Provider-specific Analytics code belongs behind the existing adapter registry, never inside a report.
- Integrations owns connection management and provider synchronization, but Analytics owns normalized report projections; neither side may infer the other's truth or expose provider secrets to clients, logs, or audit.
- Performance work begins with measurement owned by the relevant read model; it does not justify a new global performance Runtime.
- UI/UX, RTL, responsive, focus, and accessibility closure require Browser QA after the relevant implementation tranche.
- Architecture reviews use the eight-axis matrix and Contract Drift policy defined in Constitution Sections 13.8, 27.2, and 29.4.1; this ownership map does not redefine that process.
