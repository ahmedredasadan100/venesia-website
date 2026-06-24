-- Topics listing page CMS blocks seed (Phase 1 — static shell only)
-- Migrates hardcoded Topics listing intro + sidebar CTA into Content / CTA templates + assignments.
-- Hero, featured card, topic grid, and sidebar feeds remain code-driven — not included here.
-- Idempotent: safe to re-run (upserts templates by slug, upserts assignments by page+template).

begin;

-- ---------------------------------------------------------------------------
-- Content template — listing intro
-- ---------------------------------------------------------------------------
insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Topics — Intro',
    'topics-intro',
    'مقدمة صفحة مركز المعرفة',
    'default',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Knowledge Hub",
      "title": "جميع الموضوعات",
      "subtitle": "محتوى يجيب على أسئلتك ويوضح لك كل خطوة في رحلتك العقارية.",
      "alignment": "start"
    }$json$::jsonb,
    10
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

-- ---------------------------------------------------------------------------
-- CTA template — sidebar insight panel
-- ---------------------------------------------------------------------------
insert into public.cta_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Topics — Insight CTA',
    'topics-insight-cta',
    'دعوة التواصل في الشريط الجانبي',
    'band',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Venesia Insight",
      "title": "محتوى موثوق من مطور عقاري يعمل على الأرض.",
      "description": "اسأل، افهم، وقارن قبل أي قرار.",
      "primaryCta": { "label": "تواصل معنا", "href": "/contact" },
      "backgroundStyle": "gold"
    }$json$::jsonb,
    20
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

-- ---------------------------------------------------------------------------
-- Page assignments (Topics listing page only)
-- Requires pages.slug = 'topics'
-- ---------------------------------------------------------------------------
insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, true
from public.pages p
join public.content_block_templates t on t.slug = 'topics-intro'
where p.slug = 'topics'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cta_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'sidebar', 20, true
from public.pages p
join public.cta_block_templates t on t.slug = 'topics-insight-cta'
where p.slug = 'topics'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
