# Admin Audit Log Coverage

Critical CMS write operations are recorded in `admin_audit_logs` after successful mutations. Audit logging is **non-blocking**: failures are caught server-side and do not fail the primary admin action.

## Schema

Table: `admin_audit_logs` (`sql/migrations/20250625700000_admin_audit_logs.sql`)

| Column | Purpose |
|--------|---------|
| `actor_admin_user_id` | Admin user id from session |
| `actor_username` | Username snapshot |
| `action` | Dotted verb, e.g. `topic.create` |
| `entity_type` | Entity key, e.g. `topic` |
| `entity_id` | Numeric id when available |
| `entity_label` | Human label (name/title/slug) |
| `metadata` | Short JSON context (status, bulk ids, `content_type`, etc.) |
| `ip_address`, `user_agent` | Request context when available |
| `created_at` | Event timestamp |

## Helpers (reuse — do not duplicate inserts)

| Module | Role |
|--------|------|
| `src/lib/admin/audit/record-admin-audit-event.ts` | Low-level insert; catches/logs errors |
| `src/lib/admin/audit/resolve-server-action-audit-context.ts` | IP / user-agent for server actions |
| `src/lib/admin/audit/cms-audit-actions.ts` | `buildCmsAuditAction()`, entity/verb types, labels |
| `src/lib/admin/audit-log.ts` | **`recordCmsAdminAudit()`** — CMS convenience wrapper |
| `src/lib/admin/audit/audit-actions.ts` | Auth / admin-user actions |
| `src/lib/admin/audit/sanitize-audit-metadata.ts` | Metadata sanitization |

### CMS action naming

Format: `{entity_type}.{verb}`

Verbs: `create`, `update`, `delete`, `restore`, `publish`, `unpublish`, `reorder`, `duplicate`, `restore_default`

## Covered actions

### Pre-existing (auth / security)

- Login / logout (`src/app/api/admin/auth/*`)
- Admin users & roles (`src/app/admin/users-roles/actions.ts`)
- Security settings (`src/app/admin/settings/security/actions.ts`)

### Pages & page block assignments

`src/app/admin/pages-blocks/pages/actions.ts`

- Page: publish, unpublish, delete, bulk delete, duplicate
- Page block assignment: create, update, reorder, publish/unpublish, delete (hero, media-sidebar, media-hub, generic blocks)
- Bulk page block assignment show/hide/delete

### Topics

`src/app/admin/topics/actions.ts`

- create, update, publish/unpublish, soft delete, duplicate, bulk update

### Topic categories

`src/app/admin/topics/categories/actions.ts`

- create, update, publish/unpublish, duplicate, delete (form + AJAX safe delete)

### Topic series

`src/app/admin/content/series/actions.ts`

- create, update, publish/unpublish, duplicate, delete (form + AJAX + bulk)

### Unified media

`src/app/admin/content/media/actions.ts`

- create, update, publish, unpublish, archive/delete, duplicate, bulk update
- `content_type` included in metadata when available

### Projects

`src/app/admin/projects/actions.ts`

- create, update (including synced floor plans / delivery specs / media as `project_children`), publish/unpublish, bulk, archive, restore, permanent delete, duplicate

### Menus

`src/app/admin/pages-blocks/menus/actions.ts`

- Menu: create, update, visibility, delete, duplicate, bulk show/hide/delete, JSON import
- Menu item: create, update, delete, visibility, reorder, duplicate, clear-all

### Footer

`src/app/admin/pages-blocks/footer/actions.ts`

- save builder (`footer_settings.update`)
- restore defaults (`footer_settings.restore_default`)

### Site settings

`src/app/admin/settings/general/actions.ts`

- maintenance mode toggle (`site_settings.update`)

## Intentionally not covered (this phase)

| Area | Reason |
|------|--------|
| Block template libraries (`pages-blocks/blocks/*/actions.ts`) | Template CRUD is secondary to page assignments; out of critical-path scope |
| Activity log viewer (`activity-log/actions.ts`) | Read-only queries |
| Legacy Media Admin (`media-center/*`) | Closed; redirect stubs only |
| Public routes / UI | Out of scope |
| New audit viewer UI | Not requested |

## Verification

```bash
npm run verify:audit-coverage
```

Guardrail script: `scripts/verify-admin-audit-coverage.mjs` — checks known mutation action files import/call a CMS audit helper.

## Recommended status

| Priority | Status |
|----------|--------|
| Critical CMS mutations (pages, topics, media, projects, menus, footer, settings) | **Covered** |
| Block template libraries | Deferred |
| Granular per-row audit for nested project child sync | Covered via `project_children.update` on parent save |
| Public audit API / viewer enhancements | Future work |
