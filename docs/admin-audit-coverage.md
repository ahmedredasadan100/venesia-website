# Admin Audit Log Coverage

**Document status:** Current repository record
**Updated:** 2026-07-17
**Coverage status:** Critical CMS mutation coverage is closed for the current non-project release.

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

## 1. Audit contract

Critical successful CMS mutations write to `admin_audit_logs`.

Audit logging is intentionally **non-blocking**:

- the primary mutation must not fail only because audit insertion fails;
- audit failures must be caught and logged server-side;
- secrets, passwords, tokens, and oversized payloads must not enter metadata.

## 2. Schema

Table: `admin_audit_logs`

| Column | Purpose |
|---|---|
| `actor_admin_user_id` | Admin user identifier from session. |
| `actor_username` | Username snapshot. |
| `action` | Dotted action such as `topic.create`. |
| `entity_type` | Entity key. |
| `entity_id` | Numeric identifier when available. |
| `entity_label` | Human-readable title/name/slug. |
| `metadata` | Small sanitized context. |
| `ip_address`, `user_agent` | Request context when available. |
| `created_at` | Event timestamp. |

## 3. Canonical helpers

Reuse existing helpers; do not add direct inserts in feature actions.

| Module | Role |
|---|---|
| `src/lib/admin/audit/record-admin-audit-event.ts` | Low-level non-blocking insert. |
| `src/lib/admin/audit/resolve-server-action-audit-context.ts` | IP and user-agent resolution. |
| `src/lib/admin/audit/cms-audit-actions.ts` | CMS action naming and labels. |
| `src/lib/admin/audit-log.ts` | `recordCmsAdminAudit()` convenience wrapper. |
| `src/lib/admin/audit/audit-actions.ts` | Auth/admin-user action constants. |
| `src/lib/admin/audit/sanitize-audit-metadata.ts` | Metadata sanitization. |

Action format:

```text
{entity_type}.{verb}
```

Typical verbs:

```text
create
update
delete
restore
publish
unpublish
reorder
duplicate
restore_default
```

## 4. Covered mutation domains

### Auth and security

- Login/logout.
- Admin users and roles.
- Security settings.

### Pages and assignments

Stable action surface:

```text
src/app/admin/pages-blocks/pages/actions.ts
```

Implementation may be split under `page-actions/**`.

Covered:

- page publish/unpublish/delete/duplicate/bulk delete;
- assignment create/update/reorder/show/hide/delete;
- assignment bulk show/hide/delete;
- hero, generic block, media hub, and media sidebar assignment mutations.

### Topics

Stable action surface:

```text
src/app/admin/content/topics/actions.ts
```

Article mutations are split under `article-actions/**`; specialized media
mutations are split under `media-actions/**`.

Covered:

- create/update;
- publish/unpublish;
- soft delete;
- duplicate;
- bulk update.

### Topic categories

Covered:

- create/update;
- publish/unpublish;
- duplicate;
- safe delete flows.

### Topic series

Covered:

- create/update;
- publish/unpublish;
- duplicate;
- delete and bulk flows.

### Specialized content editors

Stable action surface:

```text
src/app/admin/content/topics/media-actions.ts
```

Implementation is split under `src/app/admin/content/topics/media-actions/**`.

Covered:

- create/update;
- publish/unpublish;
- archive/delete;
- duplicate;
- bulk update;
- `content_type` context where available.

### Projects

Audit coverage exists for project mutations and child synchronization. However, the entire Projects and Track Your Project scope is currently **frozen**. Do not change project auditing or project mutations without reopening that scope explicitly.

### Menus

Implementation is split under `menu-actions/**`.

Covered:

- menu create/update/visibility/delete/duplicate;
- bulk show/hide/delete;
- JSON import;
- item create/update/delete/visibility/reorder/duplicate/clear-all.

### Footer

Implementation is split under `footer-actions/**`.

Covered:

- footer builder save;
- restore defaults.

### Site settings

Covered:

- maintenance-mode setting updates.

## 5. Intentionally not covered

| Area | Current reason |
|---|---|
| Block template library CRUD | Intentional exclusion; page assignments are covered. Adding it is a product/behavior change. |
| Activity log viewer reads | Read-only. |
| Legacy Media Admin | Route tree and active CRUD are removed; the unified topics actions are canonical. |
| Public routes and UI | Not admin mutation surfaces. |
| Contact form submission | No submission backend exists; therefore there is no successful lead mutation to audit. |
| New viewer/analytics enhancements | Future product work. |

## 6. Final release evidence

The final non-project closure included:

- authenticated Admin QA across Dashboard, Pages, Page Builder, Blocks, Menus, Footer, Media Center, Media Library, Topics, SEO, Redirects, Settings, Reports, Activity Log, and Users/Roles;
- `40/40` authenticated admin checks passing;
- no 500, console, RSC, or chunk failure;
- successful Quality Gate #83;
- no code change during final Production smoke.

This confirms current release health. It does not expand audit coverage beyond the documented domains.

## 7. Verification

```bash
npm run verify:audit-coverage
```

Guardrail:

```text
scripts/verify-admin-audit-coverage.mjs
```

When action implementations move, update the guardrail in the same commit while keeping stable public action barrels where applicable.

## 8. Future changes requiring approval

- Add audit to block template CRUD.
- Change metadata shape or retention.
- Make audit blocking.
- Add public audit APIs.
- Add per-child project log rows.
- Add export/analytics behavior.
- Modify audit security or actor resolution.

## 9. Current decision

```text
Critical non-project CMS mutations: COVERED
Admin release QA: PASS
Block template CRUD audit: DEFERRED
Contact submission audit: NOT APPLICABLE UNTIL BACKEND EXISTS
Projects audit changes: FROZEN
Current release blocker: NONE
```
