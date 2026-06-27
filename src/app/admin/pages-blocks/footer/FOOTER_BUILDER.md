# Footer Builder — internal notes

## Scope

Admin UI at `/admin/pages-blocks/footer` for the four public footer columns plus social/legal bar settings.

**Public footer** (`SiteFooter`, slot renderers) is not edited from here — only `site_settings` values consumed at runtime.

## Column model

- Four fixed **positions** (`index` 1–4). Order in the public grid follows `index` ascending (RTL: position 1 is the first column from the right).
- Each position can be any block type: `text`, `menu`, `contact`, `media`, `custom_links` (Links).
- Block type controls **content and inner markup style** only (menu line vs media diamond, etc.). Grid, spacing, and responsive layout stay in `SiteFooter`.

## Menus vs Links

| Source | Storage | Footer Builder |
|--------|---------|----------------|
| **Menu** block | Reads `menus` / `menu_items` via navigation | Select source (`location`, `menu_id`, fallback). **Read-only** preview of footer menu items. **Never writes** `menu_items`. |
| **Links** block (`custom_links`) | `site_settings` → `footer.slots` | Manual Label + URL rows saved with slots. |
| **Media** manual links | `site_settings` → slot config | Same as Links but rendered with media column style. |

Create and edit all real menus in **Menus Admin** (`/admin/pages-blocks/menus`).

## Restore Default

`restoreDefaultFooterAction` resets `footer.slots` to `DEFAULT_FOOTER_SLOTS` (Text | Contact | Menu | Media) and syncs `footer.brand` headings from the text/contact/media slots. Does not delete `menu_items` or other legacy keys.

## Fallback behavior

`loadFooterSettings()` (`src/lib/footer/load-footer-settings.ts`):

1. If `footer.slots` is missing → build slots from `footer.brand` (legacy).
2. If `footer.slots` is invalid → log error, same legacy build.
3. Legacy keys (`footer.brand`, `footer.contact_items`, `footer.social_links`, `footer.legal`) remain required for social bar and global contact pool.

## Seed / migration scripts

- `node scripts/apply-footer-settings-seed.mjs` — legacy keys + footer menu in Menus Admin + `footer.slots` **only if missing**.
- `node scripts/apply-footer-slots-migration.mjs` — `footer.slots` only, idempotent insert.
- Shared default layout: `scripts/lib/footer-default-slots.mjs` (mirror `src/lib/footer/build-slots-from-legacy.ts`).

## Smoke tests

- `node scripts/footer-settings-test.mjs [port]`
- `node scripts/footer-slots-fallback-test.mjs [port]` (requires running app; temporarily mutates `footer.slots`)
