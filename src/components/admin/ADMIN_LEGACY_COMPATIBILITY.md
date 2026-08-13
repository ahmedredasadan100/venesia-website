# Admin Legacy Compatibility

This folder still contains a legacy component entry point because some existing
admin pages import it directly.

## Active rule

The visual source of truth is now:

`components/admin/ui`

## Compatibility wrappers

These files are wrappers or legacy shims only:

- `components/admin/AdminRowActions.tsx` keeps old page imports working, but its action buttons now use the unified 44x44 cursor-pointer action button sizing.

## Migration rule

Any new CRUD work must import directly from `components/admin/ui` and must not
create page-local action buttons, status pills, pagination, toolbar, or bulk bars.

The `/admin` dashboard page is intentionally excluded from CRUD normalization.

## Latest Compatibility Fix

`AdminRowActions` now sorts legacy action arrays automatically using the canonical order:

`edit → visibility → duplicate → delete`

Use `actionKey` explicitly when passing legacy actions to avoid accidental order drift.
