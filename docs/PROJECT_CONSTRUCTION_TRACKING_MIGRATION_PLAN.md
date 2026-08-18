# Project Construction Tracking — Applied Production Migration Record

Status: authorized migration applied to Production on 2026-08-18. Production and the repository both contain 84 migrations with no pending version. The applied file is `20260817170332_project_construction_tracking_detail.sql`; its approved and verified SHA-256 is `68298E33131C5EE1ECBB069C0C69ED6D52CA2FA03F2EF5652D8B400221F368CA`. It performed no seed or backfill.

## Architecture boundary

- The migration does not alter, create, update, backfill, or delete from `public.projects`.
- `projects.id` is referenced only as the parent identity. Existing Project facts continue to be read from the Project owner.
- All new facts belong to the independent Tracking domain. There is no duplicate Project data and no second Project source of truth.
- The migration is additive and performs no seed or backfill.

## Exact tables and columns

### `public.project_tracking_profiles`

| Column | Type | Null | Default / key |
| --- | --- | --- | --- |
| `project_id` | `bigint` | no | PK, FK `projects(id) ON DELETE RESTRICT` |
| `project_receipt_date` | `date` | yes | none |
| `license_receipt_date` | `date` | yes | none |
| `contractor_name` | `text` | yes | none; blank forbidden when present |
| `created_by` | `bigint` | yes | FK `admin_users(id) ON DELETE SET NULL` |
| `updated_by` | `bigint` | yes | FK `admin_users(id) ON DELETE SET NULL` |
| `created_at` | `timestamptz` | no | `now()` |
| `updated_at` | `timestamptz` | no | `now()` |

### `public.project_tracking_stages`

| Column | Type | Null | Default / key |
| --- | --- | --- | --- |
| `id` | `bigint` | no | identity PK |
| `project_id` | `bigint` | no | FK `projects(id) ON DELETE RESTRICT` |
| `name` | `text` | no | blank forbidden |
| `description` | `text` | yes | blank forbidden when present |
| `sort_order` | `integer` | no | nonnegative; deferred unique per Project |
| `start_date` | `date` | yes | none |
| `planned_duration_value` | `integer` | yes | positive only; paired with unit |
| `planned_duration_unit` | `text` | yes | `day|week|month`; paired with value |
| `is_visible` | `boolean` | no | `true` |
| `created_by`, `updated_by` | `bigint` | yes | FK `admin_users(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` |

There is deliberately no Stage status or percentage column. Stage status is derived from Item statuses.

### `public.project_tracking_items`

| Column | Type | Null | Default / key |
| --- | --- | --- | --- |
| `id` | `bigint` | no | identity PK |
| `stage_id` | `bigint` | no | FK `project_tracking_stages(id) ON DELETE RESTRICT` |
| `name` | `text` | no | blank forbidden |
| `description` | `text` | yes | blank forbidden when present |
| `sort_order` | `integer` | no | nonnegative; deferred unique per Stage |
| `status` | `text` | no | `not_started`; constrained to `not_started|in_progress|completed` |
| `start_date` | `date` | yes | none |
| `completion_date` | `date` | yes | required only for `completed`; cannot precede start |
| `is_visible` | `boolean` | no | `true` |
| `created_by`, `updated_by` | `bigint` | yes | FK `admin_users(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` |

### `public.project_tracking_updates`

| Column | Type | Null | Default / key |
| --- | --- | --- | --- |
| `id` | `bigint` | no | identity PK |
| `item_id` | `bigint` | no | FK `project_tracking_items(id) ON DELETE RESTRICT` |
| `occurred_at` | `timestamptz` | no | none; backdating allowed |
| `title` | `text` | no | blank forbidden |
| `body` | `text` | no | blank forbidden |
| `publication_status` | `text` | no | `draft`; `draft|published|unpublished|archived` |
| `published_at` | `timestamptz` | yes | set/cleared by mutation RPC |
| `published_by`, `created_by`, `updated_by` | `bigint` | yes | FK `admin_users(id) ON DELETE SET NULL` |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` |

### `public.project_tracking_update_media`

| Column | Type | Null | Default / key |
| --- | --- | --- | --- |
| `id` | `bigint` | no | identity PK |
| `client_key` | `uuid` | no | `gen_random_uuid()`; unique per Update |
| `update_id` | `bigint` | no | FK `project_tracking_updates(id) ON DELETE CASCADE` |
| `media_kind` | `text` | no | `image|video` |
| `public_url` | `text` | no | blank forbidden |
| `poster_url` | `text` | yes | blank forbidden when present |
| `title` | `text` | yes | blank forbidden when present |
| `sort_order` | `integer` | no | nonnegative; deferred unique per Update |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` |

The only cascade is Update → owned association rows. It never deletes a Media Catalog or Storage asset.

## Exact function contracts

- `save_project_tracking_profile(bigint,bigint,jsonb) returns jsonb`
- `mutate_project_tracking_stage(bigint,bigint,text,bigint,jsonb) returns jsonb`
- `reorder_project_tracking_stages(bigint,bigint,bigint[]) returns integer`
- `mutate_project_tracking_item(bigint,bigint,bigint,text,bigint,jsonb) returns jsonb`
- `reorder_project_tracking_items(bigint,bigint,bigint,bigint[]) returns integer`
- `mutate_project_tracking_update(bigint,bigint,bigint,text,bigint,jsonb) returns jsonb`
- `project_tracking_public_detail_v1(text) returns jsonb`

All seven callable contracts revoke execution from `public`, `anon`, and `authenticated`, and grant it only to `service_role`. All five tables enable RLS; table CRUD is granted only to `service_role`. Identity sequences are likewise service-role only. The public Next.js read remains server-side and calls the single aggregate RPC through the service role.

## Behavior, preservation, and blast radius

- Existing rows in every current table are untouched. The five new tables start empty.
- A published Project with no visible Tracking stages receives the designed empty state; an unpublished Project receives no aggregate and the route returns 404.
- Production now resolves `public.project_tracking_public_detail_v1(p_slug)` successfully and no longer returns `PGRST202`. The application still classifies only that exact function/schema dependency for mismatched environments: a published Project receives a controlled temporarily-unavailable state that is never retained in the shared cross-request cache, while an unpublished or missing Project remains 404.
- Any other Supabase/PostgREST or aggregate-validation error remains an unexpected error and is rethrown after the existing logger records `name`, `message`, `code`, `details`, `hint`, and request context. It is never converted to 404 or an empty Tracking result.
- Public output excludes draft/unpublished/archived Updates and hidden Stages/Items.
- Stage/Item delete is blocked while protected children exist. Exact-set reorder RPCs lock the sibling set and reject partial or foreign IDs.
- The provider registry version changes because `project_tracking_update_media` becomes a new authoritative reference provider. Global reconciliation must be run after deployment before authoritative Safe Delete/Rebind/Move claims resume. Ordinary attachment uses the existing target-local lease path.
- Page Composition is intentionally unchanged. Making arbitrary per-Project Tracking sections composable would redefine its owner and remains a separately gated architecture decision.

## Applied order and rollback

1. Preflight proved Production had exactly migrations 1–83, the approved file hash matched, and the `projects` schema/data fingerprint contained no Tracking field.
2. Only `20260817170332_project_construction_tracking_detail.sql` was applied, then recorded by the canonical migration registry reconciler.
3. Migration 84 provenance, all five tables, columns/defaults/nullability, constraints, indexes, triggers, RLS, ACLs, sequences, and all seven callable signatures were verified live.
4. Schema parity passed at 84/84 and Media provider 17 passed the existing Catalog/write-coordination guards.
5. The aggregate RPC returned HTTP 200 for a published Project with no Tracking records, proving the Production empty path and the disappearance of `PGRST202`.
6. Authenticated Admin and public desktop/mobile Browser regression ran without mutating real Project or Tracking data. The matching application revision follows the repository's standard PR merge and Vercel Git-integration path.

Rollback before any Tracking write is additive and lossless for existing domains: drop the seven RPCs, triggers/function, five tables, and indexes introduced by this migration. After any Tracking records exist, dropping these tables destroys Tracking history and associations; export/backup and explicit data-loss approval are mandatory. Rollback never requires changing `projects`, but the application must be rolled back before removing the RPCs/tables.
