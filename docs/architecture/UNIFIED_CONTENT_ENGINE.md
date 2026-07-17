# ADR: Unified Content Engine

**Architecture status:** Accepted
**Implementation status:** Partial convergence; transition closure remains post-launch backlog
**Updated:** 2026-07-17
**Scope:** Topics and Media Center architecture

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


## 1. Current decision

Venesia CMS continues toward a Unified Content Engine, but the project must distinguish between:

- **admin convergence**, which is implemented;
- **runtime availability**, which is verified;
- **data and module convergence**, which is not fully certified;
- **legacy table retirement**, which has not started.

The accepted direction remains:

| Layer | Current decision |
|---|---|
| Unified content kernel | `topics` is the interim content table. |
| Content discriminator | `topics.content_type` separates `article`, `news`, `video`, `gallery`, `press`, and `site_update`. |
| Taxonomy | `topic_categories` is the structural category tree. |
| Series | `topic_series` is optional. |
| Official media admin | `/admin/content/media`. |
| Legacy media admin | Redirect-only compatibility under `/admin/media-center/**`. |
| Legacy data tables | `media_items` and `media_categories` remain present until a separately approved migration/archive phase. |
| Public Media Center | Operational in final QA; exact provider/module cutover must still be certified before legacy retirement. |

## 2. Verified current state

### Admin

- `/admin/content/media` is the official media CRUD surface.
- It reads/writes media-shaped rows in `topics` using `content_type`.
- Legacy `/admin/media-center/**` routes redirect to the official admin or category manager.
- Active legacy admin CRUD, forms, tables, components, and upload actions were removed.
- Final authenticated admin QA included Media Center, Media Library, Topics, Categories, and Series with no page-load, console, RSC, or chunk failure.

### Public runtime

Final closure testing verified that:

- `/media-center` and its relevant public flows were operational.
- Media Center admin/public E2E tests passed.
- Regression routes returned HTTP 200 with no hydration or console error.

This proves runtime health. It does **not** by itself prove that:

- every legacy `media_items` row was migrated;
- every media module now reads only `topics`;
- all legacy environment overrides are unused;
- `media_items` and `media_categories` can be safely dropped.

## 3. Current data model

### Topics / unified content

| Table | Role |
|---|---|
| `topics` | Interim unified content items, including articles and media content through `content_type`. |
| `topic_categories` | Hierarchical structural taxonomy. |
| `topic_series` | Optional editorial series. |

Supported `content_type` contract:

```text
article
news
video
gallery
press
site_update
```

### Legacy media

| Table | Current posture |
|---|---|
| `media_items` | Frozen legacy content source until migration and reader audit are proven complete. |
| `media_categories` | Legacy editorial labels/tags; not assumed to map 1:1 to the unified category tree. |

Historical row counts from earlier audits are not canonical and must not be used for migration decisions without a fresh live inventory.

## 4. Category architecture

The intended structural tree remains:

```text
موضوعات تهمك
├── بيت الوطن
└── اعرف السوق

المركز الإعلامي
├── الأخبار
├── من أرض التنفيذ
├── الفيديوهات
├── البيانات الصحفية
└── معرض الصور
```

Rules:

- `content_type` controls form variant, renderer, schema, and type-level filtering.
- Category leaf controls structural grouping.
- Series stays optional.
- Legacy `media_categories` are not automatically structural nodes.
- Article forms must not expose incompatible Media Center leaves.
- Media forms must be restricted to the relevant media branch.

## 5. Phase status — current

| Phase | Status | Current interpretation |
|---|---|---|
| 0 — ADR | Done | Architecture accepted. |
| 1 — `content_type` | Done | `topics.content_type` implemented. |
| 2 — category tree and guards | Done | Media taxonomy and article/media form guards implemented. |
| 3 — Unified Media Admin | Done | `/admin/content/media` is official. |
| Legacy admin closure | Done | Redirect-only compatibility; CRUD removed. |
| 4 — legacy data migration | **Not certified complete** | Requires fresh data inventory, mapping, deduplication, and rollback. |
| 5 — public/modules cutover | **Operational but not architecturally certified complete** | Public QA passed; reader-by-reader audit still required before legacy retirement. |
| 6 — legacy archive/drop | Not started | No table drop is approved. |

## 6. Remaining transition backlog

### A. Data migration proof

Before claiming `media_items → topics` complete:

1. Inventory all active and archived legacy rows.
2. Define deterministic mapping for type, slug, category/tag, content array, media payload, status, dates, featured state, and SEO.
3. Resolve global `topics.slug` collisions.
4. Keep a legacy-to-unified ID map.
5. Verify row counts and content equivalence.
6. Prove rollback.

### B. Reader and module audit

Audit each reader individually:

- Public `/media-center/**`.
- Media hub modules.
- Media sidebar modules.
- Hero sources such as latest/featured/category media.
- Feed modules.
- Admin link picker.
- Sitemap, canonical, Open Graph, and structured data.
- CMS backup/export.
- Cache tags and mutation invalidation.

A route returning HTTP 200 is not enough to certify source convergence.

### C. Legacy retirement

Only after A and B pass:

1. Disable legacy fallback through an approved environment change.
2. Observe production.
3. Convert legacy tables to read-only/archive posture.
4. Remove unused code and compatibility only after caller verification.
5. Drop tables only through an explicit SQL/migration approval gate.

## 7. Current prohibitions

- No blind migration of `media_items`.
- No drop/truncate of `media_items` or `media_categories`.
- No environment switch without approval.
- No public redirect or canonical change without SEO mapping.
- No broad module rewiring in one commit.
- No project content or project-media changes; Projects scope is frozen.
- No server-side media search rewrite; Media optimization Batch B is closed.
- No claim that Unified/Legacy transition is complete without evidence.

## 8. Acceptance criteria for final convergence

The transition can be marked complete only when:

- all legacy rows are accounted for;
- all active public/admin readers have an explicit source;
- public output is equivalent or intentionally redirected;
- slugs and SEO are mapped;
- legacy fallback is disabled and production remains healthy;
- cache invalidation works after mutations;
- backup/export contains the canonical source;
- zero callers depend on legacy tables;
- rollback evidence exists;
- table retirement is separately approved.

## 9. Current decision

```text
Unified Media Admin: COMPLETE
Legacy Media Admin closure: COMPLETE
Public Media Center runtime health: VERIFIED
Legacy data migration: NOT CERTIFIED COMPLETE
Public/module source convergence: NOT CERTIFIED COMPLETE
Legacy table retirement: NOT STARTED
Release blocker: NO
Backlog: POST-LAUNCH ARCHITECTURE
```
