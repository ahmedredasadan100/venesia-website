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

## 13. Accepted audit maturity and priority state

The Full Repository Audit completed on baseline `9e420620f4a802dc8f070334c7d8d210a4a693f8`. It mapped current ownership and gaps; it did not close a System, Runtime, or Capability.

| Area | Accepted maturity | Active blocker or gap | Product state |
|---|---|---|---|
| Admin Interaction System | Real governance umbrella; not a super-runtime | Global closure remains false while generic adoption gaps and declared debt exist | Active by bounded tranches |
| Collection and Data Runtimes | Strong shared foundations with registered entity adapters | Performance and consumer parity still require scoped evidence | Active where a consumer fits the contract |
| Form Runtime | Reference consumers and Redirect adoption are established | Media Topic, Projects, and Page quick-create generic gaps | Active except Projects, which is **Deferred by Product Priority** |
| Feedback Runtime | Shared owner is established | Browser placement/focus proof remains part of UX closure | Active supporting owner |
| Confirmation Runtime | Shared accessible owner is established | Four declared native-confirm calls remain in three consumers | Active adoption gap |
| Media System | Durable provider boundary is established | Reference scanning can fail open or miss stored references before deletion | First active implementation priority |
| Taxonomy Domain | Atomic reference-consumer tranche is comparatively mature | No global content/capability closure follows from that tranche | Maintain scoped claims |
| Page Composition and Menus | Valid specialized workflows | Delete and reorder operations require domain-level atomicity | Second active implementation priority |
| Projects Domain | Valid project aggregate domain | Root/children save and duplicate atomicity, plus form adoption | **Deferred by Product Priority** until the final product stage |
| Auth / Users / Security | Authentication foundation exists | RLS/Grants proof, Permissions/Roles, login rate limiting, and Server Action hardening | **Deferred by Product Priority** until before final launch or multi-user operation |
| Publishing, SEO, Preview, Slug, and Visibility | Capability foundations or partial adoption | Adopter inventory and semantics are not globally closed | Active capability tranches after safety work |
| Revision History, Localization, and Scheduling | Proposed areas only | No approved full capability contract/product need | Do not create without evidence and ADR where required |

### Accepted ownership consequences

- Media deletion safety belongs to the Media reference/deletion capability, not to a form or list component.
- Page/Menu transaction correctness belongs to their domains, not to the shared Form or Data Runtime.
- Projects findings remain recorded even while their execution is deferred.
- Security/Users deferral does not convert navigation visibility into authorization or close any security boundary.
- Performance work begins with measurement owned by the relevant read model; it does not justify a new global performance Runtime.
- UI/UX, RTL, responsive, focus, and accessibility closure require Browser QA after the relevant implementation tranche.
