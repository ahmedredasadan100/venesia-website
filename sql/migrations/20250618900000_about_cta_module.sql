-- About CTA reusable content module (contacts + copy + button + image).
-- Replaces legacy about-projects-cta assignment on /about with structured content block.
-- Idempotent.

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'About — CTA',
    'about-cta',
    'بانر CTA مع بيانات التواصل والصورة',
    'about-cta',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Venesia Developments",
      "title": "استكشف مشاريعنا",
      "description": "انتقل إلى صفحة المشاريع لمتابعة التنفيذ والتفاصيل.",
      "button": {
        "label": "استكشف المشاريع ↗",
        "href": "/projects"
      },
      "note": "احجز استشارتك العقارية المجانية",
      "image": "/images/about/who-we-are.png",
      "imageAlt": "استكشف مشاريع فينيسيا",
      "contacts": [
        {
          "label": "تواصل عبر واتساب",
          "value": "01033766876",
          "href": "https://wa.me/201033766876"
        },
        {
          "label": "الخط الساخن",
          "value": "15875",
          "href": "tel:15875"
        },
        {
          "label": "البريد الإلكتروني",
          "value": "info@venesia-developments.com",
          "href": "mailto:info@venesia-developments.com"
        }
      ]
    }$json$::jsonb,
    55
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

delete from public.page_cta_block_assignments a
using public.pages p, public.cta_block_templates t
where a.page_id = p.id
  and a.template_id = t.id
  and p.slug = 'about'
  and t.slug = 'about-projects-cta';

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'before-footer', 60, true
from public.pages p
join public.content_block_templates t on t.slug = 'about-cta'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
