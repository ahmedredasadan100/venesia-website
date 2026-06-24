-- DRAFT: Home story CMS module seed (FROM VISION TO EXECUTION)
-- Pilot: reuses about-intro config schema via slug home-story + variant about-intro.
-- Idempotent: safe to re-run (upserts template by slug, upserts assignment by page+template).
-- Requires pages.slug = 'home' (Hero Manager / pages table).

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Home — Story',
    'home-story',
    'FROM VISION TO EXECUTION — الرئيسية',
    'about-intro',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "FROM VISION TO EXECUTION",
      "title": "من المخطط إلى التنفيذ",
      "body": "كل مشروع يبدأ بفكرة، لكن القيمة الحقيقية تظهر عندما تتحول الفكرة إلى تنفيذ يمكن متابعته خطوة بخطوة.\n\nلهذا نوثق مراحل التنفيذ، ونشارك التقدم الفعلي على الأرض، لأن الثقة تُبنى بما يمكن رؤيته لا بما يمكن قوله.",
      "alignment": "start",
      "images": {
        "main": "/images/home/story-main.jpg",
        "secondary": "/images/home/story-secondary.jpg"
      },
      "button": {
        "label": "شاهد مراحل التنفيذ",
        "href": "/track-your-project"
      }
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

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, true
from public.pages p
join public.content_block_templates t on t.slug = 'home-story'
where p.slug = 'home'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
