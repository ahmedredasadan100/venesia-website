-- DRAFT: Home trust CMS module seed (Why Trust Venisia)
-- Reuses about-principles config schema via slug home-trust + variant about-principles.
-- Idempotent: safe to re-run (upserts template by slug, upserts assignment by page+template).
-- Requires pages.slug = 'home' (Hero Manager / pages table).

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Home — Trust',
    'home-trust',
    'لماذا يثق السوق العقاري في فينيسيا؟ — الرئيسية',
    'about-principles',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "لماذا يثق السوق العقارى في فينيسيا؟",
      "title": "مش بنبيع كلام… التنفيذ بيتكلم.",
      "description": "الموقع هنا لازم يشتغل كدليل ثقة بصري، مش بروشور. كل جزء فيه يقول إن الشركة موجودة، شغالة، وبتبني بجد.",
      "items": [
        {
          "icon": "land",
          "title": "أراضي مملوكة",
          "description": "بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع."
        },
        {
          "icon": "engineering",
          "title": "إدارة هندسية",
          "description": "متابعة تنفيذ مش مجرد صور… ده نظام بيشتغل على الأرض."
        },
        {
          "icon": "timeline",
          "title": "مراحل موثقة",
          "description": "كل مرحلة ليها معنى، وكل خطوة بتثبت إن الوعد بيتحول لحقيقة."
        },
        {
          "icon": "land",
          "title": "رسالة طمأنة",
          "description": "العميل مش محتاج يسمع وعود كتير… محتاج يشوف تنفيذ حقيقي."
        }
      ]
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

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 20, true
from public.pages p
join public.content_block_templates t on t.slug = 'home-trust'
where p.slug = 'home'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
