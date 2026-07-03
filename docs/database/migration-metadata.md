# Migration Metadata Reference

Documentation only. This file contains **no executable SQL**, no secrets, no
environment values, and no database rows. It explains the state and intent of
the SQL files under `sql/migrations/`.

## 1. Purpose

- The recovered migrations under `sql/migrations/` are committed for
  **repository history and fresh-environment rebuilds only**.
- All of these migrations are **already represented/applied in the current
  Supabase database**.
- They **must not be blindly run against the current production Supabase
  database**, because the schema already exists there. Re-running seed-type
  migrations in particular could overwrite or duplicate CMS content.

## 2. Migration history summary

- **3 previously tracked migrations** (already in git history before this work):
  - `sql/migrations/20250625500000_site_settings_maintenance_mode.sql`
  - `sql/migrations/20250625600000_admin_users.sql`
  - `sql/migrations/20250625700000_admin_audit_logs.sql`
- **26 recovered historical migrations** committed in `d6853b7`
  (`chore(sql): recover historical CMS migrations`). These cover page/block
  tables, breadcrumb module, projects CMS core, `sync_project_children` RPC,
  feed modules, media hub/sidebar modules, `site_settings` DDL, home module
  seeds, media center seeds, track-your-project seed, and related data-fixes.
- **Timestamp collision fix:** the track-your-project seed was renamed to avoid
  sharing a timestamp prefix with the maintenance-mode migration:
  - `20250625500000_track_your_project_cms_seed.sql`
    →
    `20250625510000_track_your_project_cms_seed.sql`

## 3. Current safety status

- No migrations were run.
- No seeds were run.
- No database writes were performed.
- The current Supabase database is already working and **should not receive
  these migrations again** unless rebuilding a brand-new (fresh) environment.

## 4. Baseline status

- `docs/database/foundational_schema_baseline_draft.sql` is a **draft only**.
- It was **reconstructed from application code + foreign-key references**, and
  was **not verified from live schema metadata** (the local environment could
  not read `information_schema` / `pg_catalog` / `pg_policies` / `pg_proc`).
- It **must not be used as a trusted executable migration** until it has been
  reviewed against a real schema-only export (e.g. `pg_dump --schema-only`).
- **RLS policies and Storage buckets/policies still require manual review** —
  none exist in git history and none were verified from metadata.

## 5. Fresh environment warning

- For a **brand-new Supabase project**, review migration **order** and the
  **missing foundational baseline** (the foundational tables such as `pages`,
  `hero_templates`, `hero_assignments`, `topics`, `topic_categories`,
  `topic_series`, `media_items`, `media_categories`, `menus`, `menu_items`,
  `page_sections`) **before applying anything**. Those foundational tables are
  not represented by any executable migration yet — only by the unverified
  draft referenced in section 4.
- **Do not apply seeds to production without approval**, because some seeds may
  overwrite or duplicate existing CMS content.

## Excluded by design

This document intentionally excludes secrets, environment values, customer
data, admin passwords, production table rows, and data dumps.
