-- About Principles + About Approach reusable content modules.
-- Migrates principles from cards block to structured content block.
-- Updates approach content block variant + structured config.
-- Idempotent.

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'About — Principles',
    'about-principles',
    'مبادئ تُحكى بهدوء',
    'about-principles',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "WHAT DEFINES US",
      "title": "مبادئ تُحكى بهدوء",
      "items": [
        {
          "icon": "land",
          "title": "أراضٍ مملوكة",
          "description": "بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع."
        },
        {
          "icon": "engineering",
          "title": "إدارة هندسية",
          "description": "متابعة تنفيذ — نظام يعمل على الأرض، لا في العروض."
        },
        {
          "icon": "timeline",
          "title": "مراحل موثّقة",
          "description": "كل مرحلة لها معنى… وكل خطوة تثبت أن الوعد يتحول لحقيقة."
        }
      ]
    }$json$::jsonb,
    50
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

update public.content_block_templates
set
  variant = 'about-approach',
  config = $json${
    "eyebrow": "OUR APPROACH",
    "title": "نصوغ تجربة عقارية هادئة — حيث كل تفصيلة تخدم الثقة، لا الضجيج."
  }$json$::jsonb,
  updated_at = now()
where slug = 'about-approach';

delete from public.page_cards_block_assignments a
using public.pages p, public.cards_block_templates t
where a.page_id = p.id
  and a.template_id = t.id
  and p.slug = 'about'
  and t.slug = 'about-principles';

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 50, true
from public.pages p
join public.content_block_templates t on t.slug = 'about-principles'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
