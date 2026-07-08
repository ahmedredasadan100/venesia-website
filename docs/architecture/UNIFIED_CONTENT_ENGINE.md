# ADR: Unified Content Engine

**Status:** Accepted (architecture)  
**Date:** 2026-07-05  
**Scope:** Topics + Media Center convergence — documentation only at Phase 0  
**Related:** `docs/database/migration-metadata.md`, prior audit reports (Topics / Media / Series)

---

## 1. القرار المعتمد

نعتمد **Unified Content Engine** كمسار تدريجي — وليس دمجًا فوريًا — بحيث يصبح Venesia CMS يدير كل المحتوى النصي/الإعلامي من **نظام واحد**:

| Layer | Decision |
|---|---|
| **Content items (interim)** | `topics` becomes the temporary unified content table |
| **Categories** | `topic_categories` becomes the single hierarchical taxonomy tree |
| **Series** | `topic_series` remains **optional** — used when needed, never required for Media Center content |
| **Media Center (future)** | Becomes a **branch** inside the same category tree — not a separate CMS domain |
| **Legacy (now)** | `media_items` + `media_categories` stay **frozen** — no migration, no admin changes, no drops until later phases |

**What we are NOT doing now:** schema changes, DB seeds, UI changes, public route changes, or media data migration.

---

## 2. الوضع الحالي

### 2.1 Topics domain (production)

| Table | Role |
|---|---|
| `topics` | Articles / editorial content — markdown `content`, global unique `slug`, optional `series_id` |
| `topic_categories` | Tree via `parent_id` — currently: `topics` → `bait-al-watan`, `know-the-market` |
| `topic_series` | Optional grouping — FK to `topic_categories`, linked from `topics.series_id` |

**Admin:** `/admin/topics`, `/admin/topics/categories`, `/admin/content/series`  
**Public:** `/topics`, `/topics/[slug]`  
**Modules:** Feed modules query `topics` only.

### 2.2 Media domain (legacy / frozen)

| Table | Role |
|---|---|
| `media_items` | All media types in one table — `type` CHECK: `news \| video \| gallery \| press \| site-update`; `(type, slug)` unique; `content text[]` |
| `media_categories` | Flat editorial tags (13 rows) — **not** the same as media `type` buckets |

**Admin (legacy):** `/admin/media-center` — **redirect-only** since `850534b` (no CRUD, no forms, no uploads)  
**Admin (official):** `/admin/content/media` — Unified Media Admin on `topics`  
**Public:** `/media-center/{type}`, `/media-center/{type}/[slug]` — see §12 for current runtime note; not re-verified in this doc pass  
**Modules:** Media hub, media sidebar, hero sources (`latest_media`, `featured_media`, `media_category`) may still reference `media_items` depending on module config and env.

### 2.3 Parallel systems — the conflict

- Two content tables, two category systems, two admin surfaces, two public URL namespaces.
- `media_items.type` ≈ future `content_type`; `media_categories` ≈ editorial tags, not structural navigation.
- Recent cleanup removed misplaced `media-center` rows from `topic_categories` because they were seeded **without** `content_type` or form UX guards — causing Media categories to appear in normal article forms.

**Current DB snapshot (2026-07-05):** ~68 active topics, ~28 active media_items, 3 production `topic_categories`, 13 `media_categories`.

---

## 3. التصميم المستهدف

### 3.1 Interim content model

**`topics` = temporary `content_items` kernel** until a dedicated table is justified.

Future column (Phase 1 — not now):

```
content_type:
  article      — default for all existing topics (موضوعات تهمك)
  news
  video
  gallery
  press
  site_update  — maps from media type site-update
```

Additional columns deferred to Phase 1+ / migration planning: `content_blocks`, `project`, `duration`, `sort_order`, `og_image`, `schema_type`, `legacy_media_id`.

### 3.2 Target category tree (`topic_categories`)

```
موضوعات تهمك (topics)
├── بيت الوطن (bait-al-watan)
└── اعرف السوق (know-the-market)

المركز الإعلامي (media-center)          ← NOT seeded until Phase 2
├── الأخبار (media-news)
├── من أرض التنفيذ (media-site-updates)
├── الفيديوهات (media-videos)
├── البيانات الصحفية (media-press)
└── معرض الصور (media-gallery)
```

**Mapping intent:**

- `content_type` drives renderer, admin form variant, SEO schema, list filters.
- Category **leaf** drives navigation grouping and optional feed filters.
- **Series:** optional on any content; Media Center content does **not** require series.

### 3.3 Legacy media tags

The 13 `media_categories` rows (e.g. «من أرض التنفيذ», «أخبار الشركة») are **editorial tags**, not structural tree nodes. Their migration strategy is deferred to Phase 4 planning — options: sub-categories under leaves, `tags[]` field, or archived denormalized labels.

---

## 4. قرار مهم — لا seed لـ media-center قبل UX guards

**Do not seed the `media-center` branch into `topic_categories` until Phase 2**, and only together with (or after) **`content_type` on `topics` (Phase 1)** and **admin UX guards** so that:

- Media Center category leaves **do not appear** in the normal **article** create/edit category picker in a confusing way.
- Editors creating `content_type = article` see only the «موضوعات تهمك» branch (or equivalent filtered tree).
- Editors creating `content_type = news | video | …` see the appropriate Media branch.

**Rationale:** Phase B0-style seed-only was rejected because it recreates the taxonomy confusion we just cleaned up — Media categories visible inside generic topic forms without type discrimination.

**Phase 2 minimum bar:**

1. `content_type` column exists with default `article`.
2. Category pickers filtered by `content_type` (or by allowed category subtree).
3. Then — and only then — seed `media-center` + five children.

---

## 5. خطة التنفيذ المرحلية (معدّلة)

| Phase | Name | Deliverables | Touch DB? | Touch UI? |
|---|---|---|---|---|
| **0** | **ADR only** | This document | No | No |
| **1** | `content_type` | Add column to `topics`, default `article`, CHECK constraint, backfill implicit | Yes | Minimal (hidden/default) |
| **2** | Category tree + guards | Seed `media-center` branch; filter category pickers by `content_type` | Yes | Yes (forms) |
| **3** | **Admin media (parallel)** | `/admin/content/media` — list/create/edit per `content_type` on `topics` only; **admin-only, no public touch** | Maybe | Yes (admin only) |
| **4** | Data migration | `media_items` → `topics` with mapping table, slug dedup, dual-read adapter | Yes | Admin |
| **5** | Public + modules cutover | Redirects `/media-center/*`, feed/hub/hero/link picker → `topics` | Maybe | Yes (public) |
| **6** | Legacy archive | Deprecate media admin routes; read-only then drop `media_items` / `media_categories` | Yes | Yes |

**Phase 0 exit criteria:** ADR reviewed and accepted — **no other changes**.

---

## 6. ممنوعات حالية (Phase 0 → until Phase 1 kickoff)

The following are **explicitly out of scope** until their phase:

- No media data migration
- No public route changes
- No Media Center admin changes (frozen)
- No drop / truncate of `media_items` or `media_categories`
- **No seed of `media-center` branch in `topic_categories`**
- No changes to TopicsListFilters / filter primitives
- No changes to AdminMetricCardsGrid, pagination, table header systems, or page context header contracts

---

## 7. المخاطر

| Risk | Description | Mitigation |
|---|---|---|
| **Category picker confusion** | Media leaves visible in article forms | Phase 2 blocked on `content_type` + UX guards (§4) |
| **Slug collision** | `topics.slug` global unique vs `media_items (type, slug)` | Pre-migration audit; prefix/suffix strategy in Phase 4 |
| **Public SEO** | Two URL namespaces today | Phase 5: 301 map + `legacy_media_id` |
| **Module regression** | Feed (topics) vs hub/sidebar/hero (media) | Adapter layer in Phase 4 before cutover |
| **media_categories mapping** | 13 editorial tags ≠ 5 structural leaves | Explicit mapping doc in Phase 4; no automatic 1:1 |
| **Delete-guard inconsistency** | List filters vs delete checks (`deleted_at`, `series_id` vs `series_slug`) | Fix in separate maintenance pass; not Phase 0 |
| **Premature seed** | Tree without `content_type` | **Rejected** — this ADR replaces Phase B0 seed-only |

---

## 8. Files and systems — expected impact (future phases)

For planning only — **no changes in Phase 0.**

**Schema:** `topics`, `topic_categories`, optional `legacy_content_map`  
**Admin:** `src/app/admin/topics/**`, `src/app/admin/content/series/**`, `src/app/admin/content/media/**` (official), `src/app/admin/media-center/**` (redirect stubs only)  
**Lib:** `src/lib/media-center.ts`, `src/lib/feed-modules/**`, `src/lib/media-hub-modules/**`, `src/lib/media-sidebar-modules/**`, `src/lib/load-hero-section.ts`, `src/lib/admin/links/**`, `src/lib/export/cms-backup-config.ts`  
**Public:** `src/app/topics/**`, `src/app/media-center/**`

---

## 9. References

- Foundational schema: `sql/migrations/20250618000000_foundational_schema_baseline.sql`
- Legacy media admin redirects: `src/lib/admin/legacy-media-admin-routes.ts`
- Unified media admin: `src/app/admin/content/media/**`
- Feed modules: `src/lib/feed-modules/` (topics-only)
- Media hub: `src/lib/media-hub-modules/` (media_items-only)
- CMS backup tables: `src/lib/export/cms-backup-config.ts`
- Admin UI filter primitives: `src/components/admin/ui/admin-filter-styles.ts` (do not modify in Phase 0)

---

## 10. Approval log

| Role | Decision | Date |
|---|---|---|
| Architecture review | Unified direction approved; Phase B0 seed-only **rejected** | 2026-07-05 |
| Phase 0 | ADR documentation only | 2026-07-05 |

*Historical (2026-07-05): next step was Phase 3 — `/admin/content/media` (admin-only parallel build; guard §11 applied). **Phase 3 is Done** as of 2026-07-08 — see §12.*

---

## 11. Phase 3 execution guard (historical — confirmed 2026-07-05)

> **Historical context only.** This section records the guard accepted before Phase 3 was built. Phase 3 is **Done**; `/admin/content/media` is the official Unified Media Admin route. Current status: §12.

> **No public website impact. Legacy media public rendering remains unchanged.**

Phase 3 builds the **new admin surface only** — in parallel with the legacy stack. Nothing in this phase may change what visitors see or which tables public routes read from.

### 11.1 In scope (Phase 3)

| Deliverable | Notes |
|---|---|
| `/admin/content/media` | New admin hub for media content stored in `topics` + `content_type` |
| List / create / edit | Per media `content_type` (`news`, `video`, `gallery`, `press`, `site_update`) |
| Category pickers | Media branch under `topic_categories` only (guards from Phase 2) |
| Cards / list UI | Admin presentation only — shape and filters for the new surface |

**Data source for Phase 3 admin:** `topics` table with non-`article` `content_type` values (created/edited via new admin only — no import from `media_items` yet).

### 11.2 Explicitly forbidden in Phase 3

| Area | Rule |
|---|---|
| **Public website** | No changes to `/media-center`, `/media-center/*`, or any public page |
| **Public modules** | No changes to media hub modules, media sidebar modules, hero sources, feed blocks, or any block/module that reads `media_items` |
| **Legacy admin** | Do not modify `/admin/media-center` or its components |
| **Legacy tables** | Do not read/write/migrate `media_items` or `media_categories` |
| **Adapters** | No dual-read adapter, no public-facing bridge from `topics` → public media routes |
| **Redirects** | No URL redirects, no canonical changes, no sitemap changes |
| **Cutover** | No switch of public rendering to `topics` — that belongs to a **separate later phase** (Phase 5+) |

### 11.3 Parallel-system rule

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC (unchanged)          │  ADMIN (Phase 3 adds)        │
├──────────────────────────────┼──────────────────────────────┤
│  /media-center/*             │  /admin/content/media  (NEW) │
│  reads media_items           │  reads/writes topics         │
│  media hub / sidebar blocks  │  content_type ≠ article      │
│  legacy modules              │                              │
├──────────────────────────────┼──────────────────────────────┤
│  /admin/media-center (frozen, untouched in Phase 3)         │
└─────────────────────────────────────────────────────────────┘
```

**Phase 3 exit criteria (minimum):** create/edit flows work in `/admin/content/media`; list + cards match admin UX goals; article guards from Phase 2 remain intact; **zero diff in public routes and public module query targets.**

**Deferred to later phases:** data migration (`media_items` → `topics`), public adapters, module rewiring, redirects, cutover decision.

### 11.4 Phase completion log (historical snapshot)

At guard acceptance (2026-07-05), Phase 3 was the next build target. **Do not use this table as current status** — see §12.

---

## 12. 2026-07-08 Production Update

**Baseline commits on `origin/main`:** `24731a7`, `850534b`, `f0ae7ca`

| Area | Current production state |
|---|---|
| **Official Unified Media Admin** | `/admin/content/media` — list/create/edit on `topics` with media `content_type` values |
| **Legacy Media Admin** | `/admin/media-center` and child routes are **redirect-only** compatibility stubs; CRUD, forms, tables, upload actions, and `_components` were **removed** (`850534b`) |
| **Redirect mapping** | Centralized in `src/lib/admin/legacy-media-admin-routes.ts` |
| **Category management** | `/admin/topics/categories` (legacy `/admin/media-center/categories` redirects here) |
| **CI quality gate** | GitHub Actions Quality Gate active and green (`f0ae7ca`) — lint, typecheck, migration verify, legacy-media-admin verify, build |
| **SQL migrations** | `sql/migrations/` official in repo (35 `.sql` files); `npm run verify:migrations` (`24731a7`) |

### Redirect compatibility (legacy admin URLs)

| Legacy URL | Redirect target |
|---|---|
| `/admin/media-center` | `/admin/content/media` |
| `/admin/media-center/new` | `/admin/content/media/new` |
| `/admin/media-center/items/[id]` | `/admin/content/media` |
| `/admin/media-center/categories` | `/admin/topics/categories` |
| `/admin/media-center/news` etc. | `/admin/content/media?content_type=…` |

### Public `/media-center` (not re-verified in this doc pass)

This documentation sync does **not** assert full public cutover status. Code includes `src/lib/media-center/source.ts` with a default unified topics provider and optional legacy env overrides (`PUBLIC_MEDIA_CONTENT_SOURCE`, `PUBLIC_MEDIA_LEGACY_FALLBACK`). Module-level rewiring and SEO redirects remain **future phases** unless separately verified and documented.

### Remaining future work (unchanged intent)

- **`media_items` → `topics` data migration** — if not fully complete, remains Phase 4 planning; do not assume all legacy rows are migrated.
- **Public/module cutover** — Phase 5+; not claimed done here.
- **Legacy table archive/drop** — Phase 6; `media_items` and `media_categories` are **not** dropped.

### Phase completion log (current)

| Phase | Status | Commit / note |
|---|---|---|
| 0 | Done | ADR `db35ab1` |
| 1 | Done | `content_type` on `topics` — `059b858` |
| 2 | Done | Media branch seed + article guards — `0a0be6e` |
| 2.5 | Verified | Migration applied; guards + build OK |
| **3** | **Done** | Admin-only `/admin/content/media` — official Unified Media Admin route |
| **Legacy admin closure** | **Done** | Redirect-only `/admin/media-center`; active CRUD removed — `850534b` |
| **CI quality gate** | **Done** | `.github/workflows/quality-gate.yml` — `f0ae7ca` |
| 4 | Future | `media_items` → `topics` data migration |
| 5 | Future | Public + modules cutover |
| 6 | Future | Legacy archive / table drop (not started) |
