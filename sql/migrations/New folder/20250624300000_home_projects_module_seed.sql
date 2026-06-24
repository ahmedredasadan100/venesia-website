-- DRAFT: Home projects CMS placement module (carousel section)
-- Placement only — project cards load from projects table via loadHomepageProjects().
-- Idempotent: safe to re-run (upserts template by slug, upserts assignment by page+template).
-- Requires pages.slug = 'home' (Hero Manager / pages table).

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Home — Projects',
    'home-projects',
    'سكشن مشاريع فينيسيا — placement فقط',
    'home-projects',
    'premium-dark',
    'published',
    '{}'::jsonb,
    40
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 20, true
from public.pages p
join public.content_block_templates t on t.slug = 'home-projects'
where p.slug = 'home'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
