# Unified Content Engine

**Status:** Implemented

**Updated:** 2026-07-17

**Scope:** Content administration, taxonomy, actor metadata, and topic views

## Decision

`public.topics` is the canonical administrative content source for:

- `article`
- `news`
- `press`
- `site_update`
- `video`
- `gallery`

The public Media Center remains a presentation surface, but it is not a separate
admin engine. Content type selects the editor and public renderer. Categories
and series provide database-owned organization and never select an editor.

## Canonical admin routes

| Route | Purpose |
|---|---|
| `/admin/content/topics` | Unified list for every supported content type |
| `/admin/content/topics/new` | Type picker followed by the specialized editor |
| `/admin/content/topics/[id]` | Unified edit loader and editor resolver |
| `/admin/content/topics/[id]/preview` | Internal preview; never records a view |
| `/admin/content/categories` | Hierarchical category management |
| `/admin/content/series` | Content-series management |

The former `/admin/topics/**`, `/admin/content/articles`,
`/admin/content/media/**`, and `/admin/media-center/**` route trees were
removed. There is no permanent redirect or compatibility admin engine.

The admin sidebar exposes exactly three entries under **المحتوى**:
**الموضوعات**, **التصنيفات**, and **سلاسل المحتوى**.

## Architecture classification

### Shared core

- `src/lib/admin/content/content-types.ts` — content-type whitelist, labels,
  and editor registry.
- `src/lib/admin/content/load-unified-content.ts` — normalized URL filters,
  title search, descendant-category filtering, server sorting, pagination, and
  global metrics.
- `src/lib/admin/content/category-hierarchy.ts` — arbitrary-depth tree,
  flattening, selectable nodes, and descendant IDs.
- `src/components/admin/content/UnifiedContentList.tsx` — selection, shared
  columns, sorting links, bulk actions, and table-local horizontal overflow.
- `src/components/admin/content/UnifiedContentFilters.tsx` — URL-synchronized
  auto-apply filters and debounced title autocomplete.
- `src/components/admin/content/unified-content-columns.tsx` — one column
  contract for headers and rows.
- `src/components/admin/content/AdminColumnVisibilityMenu.tsx` — optimistic
  visibility with serialized database persistence.
- `src/components/admin/content/AdminCategoryBadge.tsx` and
  `CategoryColorPicker.tsx` — shared semantic category tones.
- `src/components/admin/content/AdminContentActivityPopover.tsx` — actor,
  publication, update, and views metadata.
- `src/components/admin/ui/AdminSelect.tsx` — shared form and bulk select
  styling; filter listboxes retain their URL behavior.

### Configurable/specialized modules

- `ArticleCreateEditor` and `ArticleEditor` retain the article workflow.
- `MediaContentForm` retains text-media, video, and gallery fields.
- `resolveContentEditor(content_type)` maps `article` to the article editor,
  `news`/`press`/`site_update` to text media, `video` to video, and `gallery`
  to gallery.

Specialized editors share the route, session handling, taxonomy loader,
return-path contract, and write metadata. No category slug selects an editor.

### Project-specific systems

Projects Hub, Track Your Project, public Projects, Storage, and environment
configuration were not changed.

## Database contract

Version-controlled migration:

`sql/migrations/20260717070000_unified_content_engine_foundation.sql`

Applied Supabase migration:

`20260717063702_unified_content_engine_foundation`

### Added contracts

| Object | Contract |
|---|---|
| `topic_categories.color_token` | Required semantic token with a check constraint |
| `topics.created_by` | Nullable FK to `admin_users(id)`, `ON DELETE SET NULL` |
| `topics.updated_by` | Nullable FK to `admin_users(id)`, `ON DELETE SET NULL` |
| `topics.published_by` | Nullable FK to `admin_users(id)`, `ON DELETE SET NULL` |
| `topics.views_count` | `bigint not null default 0`, non-negative constraint |
| `admin_user_preferences` | `(admin_user_id, view_key)` primary key and JSON object preferences |
| `admin_content_topics` | Joined admin read model with taxonomy and actor display names |
| `increment_topic_view(bigint)` | Atomic, published/non-deleted-only increment |

The actor FKs and views counter have covering indexes. The view counter RPC is
`SECURITY INVOKER`; execution is revoked from `public`, `anon`, and
`authenticated`, and granted only to `service_role`. The public route handler
is the only browser-facing increment path.

`admin_user_preferences` has RLS enabled and intentionally has no public
policy. Custom CMS authentication is cookie-based rather than Supabase Auth,
so the server service-role action applies user isolation by always deriving
`admin_user_id` from `requireAdminSession()`; clients cannot submit another
user ID.

### Backfill and historical data

- The migration deterministically assigns one of ten semantic tones to every
  category that had no valid token. Current live verification found 10
  categories and zero invalid or null tokens.
- Historical actors remain `NULL` unless a matching `topic.publish` audit row
  identifies a stable existing admin user.
- No actor is inferred from the current operator and no fake actor backfill is
  performed.
- Current live verification found all four topic metadata columns, the joined
  view, the RPC, zero negative views, and one topic with a documented
  publisher.

### Rollback

The migration contains a commented manual rollback. It removes the RPC, view,
preferences table, constraints, metadata columns, and category tone only after
confirming no deployed code depends on them. Rollback is intentionally not
automatic and was not executed.

## Taxonomy and series

`topic_categories` is the only structural category source in active admin
flows. All loaders include `id`, `name`, `slug`, `parent_id`, `sort_order`,
`is_active`, and `color_token`.

- New choices include active categories only.
- An existing item linked to an inactive category remains editable.
- Parent filters include every descendant ID at any depth.
- Category names, order, hierarchy, and badge color update from the database.
- Bulk move choices are database-driven and retain hierarchy indentation.

`topic_series` is the only series source. New choices include published,
non-deleted series; an existing inactive association remains editable. Article
template presets for **من حقك تفهم** and **حكاية بيت** were removed because
they are series, not layouts.

## Unified list behavior

Default visible data columns are title and category; checkbox selection and
actions are fixed outside the hideable preference set. The yellow title icon,
clickable title, and edit action remain present. Slugs are not rendered in the
table or autocomplete.

Optional columns include ID, views, creation date, last update, creator,
content type, series, status, featured state, and publication date.

Sortable server-side fields are ID, title, category, views, creation date,
last update, and creator display name. URL values are normalized through a
strict whitelist. Sorting is applied to the complete matching query before
`.range()` pagination.

Column preferences use view key `content-topics`. Writes are serialized to
prevent rapid visibility changes from racing, and the database is the
authoritative persistence source.

Search:

- starts at two characters;
- debounces for 350 ms;
- applies immediately on Enter;
- uses abortable autocomplete requests;
- applies each search word to `title` only;
- never searches or returns slug, excerpt, or category text.

Filters auto-apply for content type, category, series, status, and featured
state. Every filter change and reset returns pagination to page one.

## Metrics

The existing metric card component and visual contract are unchanged.
Metrics are global over all non-deleted `topics` rows and do not change with
list filters:

| Card | Query meaning |
|---|---|
| إجمالي الموضوعات | Count of all non-deleted topics |
| منشور | Count where `status = published` |
| مسودات | Count where `status = draft` |
| مخفي | Count where `status = unpublished` |
| أرشيف | Count where `status = archived` |
| متوسط SEO | Average score calculated from the complete non-deleted dataset |

On a metric query error the cards show `—` alongside a clear error notice;
zero is not used as a fabricated fallback.

## Actor semantics

- Create sets `created_by` and `updated_by` to the authenticated admin.
- Every edit, status change, featured change, taxonomy propagation, bulk
  mutation, duplicate, and soft delete sets `updated_by`.
- Draft creation does not set `published_by`.
- First publication sets `published_at` and `published_by`.
- Unpublish preserves both publication fields.
- Republish preserves the first `published_at` and updates `published_by` to
  the admin performing the latest publication.
- Saving an item with published status follows the same publisher semantics.
- Missing historical actors display as **غير مسجل**; raw IDs are never shown.

## View definition

A view is one successful browser-session visit to a public, published,
non-deleted topic detail page:

1. A client tracker posts only the numeric topic ID after the public page
   loads.
2. `sessionStorage` deduplicates refreshes for that topic in the same browser
   session.
3. The route handler invokes the atomic RPC using the server service role.
4. Draft, unpublished, archived, deleted, invalid, admin, and preview requests
   do not increment.
5. No personal analytics event or identifier is stored.

Public article and unified Media Center detail readers mount the tracker.
Admin edit and preview routes do not.

## Verification

Repository guardrails:

- `npm run verify:unified-content`
- `npm run verify:unified-content-db`
- `npm run verify:legacy-media-admin`
- `npm run verify:audit-coverage`

Production-mode browser QA is stored under
`.tmp-qa/unified-content-system/`. It uses a temporary admin, taxonomy, series,
and topics, then removes them in `finally`. The final run passed 58/58 checks,
including title-only search, descendant filtering, preferences, sorting,
responsive overflow, actor writes, specialized editors, preview exclusion,
session view deduplication, and concurrent atomic increments.

## Legacy public data

`media_items` and `media_categories` were not dropped. Public compatibility
readers remain because legacy source retirement requires a separately approved
data inventory and migration. This workstream removed the duplicate admin
engine without making an unproven destructive public-data change.

Supabase advisors still report pre-existing project-wide items, including
RLS-without-policy informational notices and unrelated public
`SECURITY DEFINER` functions. The new topic-view RPC is not among those
warnings. See the Supabase database linter documentation:
https://supabase.com/docs/guides/database/database-linter
