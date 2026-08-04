# Footer Builder — canonical ownership

## Public contract

The Footer is persisted only in these non-overlapping `site_settings` keys:

- `footer.slots` — four-column composition and slot-owned content.
- `footer.contact_items` — ordered global contact pool referenced by contact slots.
- `footer.social_links` — ordered social/legal-bar links.
- `footer.legal` — copyright and footer tagline.

`footer.brand` was removed by `20260805090000_footer_public_composition_truth_closure.sql` after exact parity proof. It must not be recreated.

## Read and outage behavior

`loadFooterSettings()` is the only public Footer settings loader. It accepts the four persisted keys only and reports `database`, `missing`, `invalid`, or `error` through `sourceStatus`.

Missing, invalid, or unavailable data produces an explicit empty fail-safe state. Public rendering never turns an Admin reset template or code defaults into published content.

## Persistence and Audit

`save_footer_settings(...)` is the service-role-only atomic persistence owner. It accepts canonical Footer keys only and writes the Audit event in the same database transaction. The Admin save and reset actions both use this owner before cache/path revalidation.

The Admin “Restore default” button uses `DEFAULT_FOOTER_SLOTS` as an intentional write template. That template is never a public read fallback.

## Menus and links

Menu slots consume the current Navigation owner. The Footer Builder does not write `menu_items`. Manual links remain inside the relevant `footer.slots` config.

## Verification

- `npm run verify:footer-public-composition-truth`
- `node --env-file=.env.local scripts/verify-footer-public-composition-truth-db.mjs`
