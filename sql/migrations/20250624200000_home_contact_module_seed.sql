-- DRAFT: Home contact CMS module seed (Home CTA panel)
-- Reuses about-cta config schema via slug home-contact + variant about-cta.
-- Idempotent: safe to re-run (upserts template by slug, upserts assignment by page+template).
-- Requires pages.slug = 'home' (Hero Manager / pages table).

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Home — Contact',
    'home-contact',
    'CTA الرئيسية — تواصل + صورة',
    'about-cta',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Venesia Developments",
      "title": "تبحث عن وحدة تناسب\nخطتك القادمة؟",
      "description": "فريقنا الاستشاري جاهز لمساعدتك في اختيار المشروع الأنسب حسب موقعك، ميزانيتك، وهدفك الاستثماري.",
      "button": {
        "label": "تحدث مع مستشار الآن",
        "href": "https://wa.me/201033766876"
      },
      "note": "احجز استشارتك المجانية",
      "image": "/images/home-cta-building-night.png",
      "imageAlt": "",
      "contacts": [
        {
          "label": "تواصل عبر واتساب",
          "value": "+20 10 1234 5678",
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
          "href": "mailto:info@venisia-developments.com"
        },
        {
          "label": "ساعات العمل",
          "value": "السبت – الخميس ٩ص – ٦م"
        }
      ]
    }$json$::jsonb,
    30
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
select p.id, t.id, 'main', 30, true
from public.pages p
join public.content_block_templates t on t.slug = 'home-contact'
where p.slug = 'home'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
