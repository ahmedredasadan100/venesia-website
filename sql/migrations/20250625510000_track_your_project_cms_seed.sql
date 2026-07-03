-- Track Your Project CMS — page row + hero/breadcrumb/content/cta templates and assignments.
-- Idempotent: safe to re-run.

begin;

insert into public.pages (title, slug, path, page_type, status)
values ('تابع مشروعك', 'track-your-project', '/track-your-project', 'static', 'published')
on conflict (slug) do update set
  title = excluded.title,
  path = excluded.path,
  page_type = excluded.page_type,
  status = excluded.status,
  updated_at = now();

insert into public.hero_templates (name, slug, description, section_key, variant, style_preset, source_type, limit_count, is_visible, sort_order, config)
values (
  'Hero — Track Your Project',
  'hero-track-your-project',
  'Hero لصفحة تابع مشروعك',
  'hero',
  'internal-page',
  'cinematic-gold',
  'manual',
  1,
  true,
  55,
  '{
    "title": "تابع مشروعك",
    "images": ["/images/venesia-1.png"],
    "eyebrow": "Project Tracking",
    "showCta": false,
    "subtitle": "تابع مراحل التنفيذ أولًا بأول عبر تحديثات واضحة تعكس الواقع على الأرض.",
    "highlight": "",
    "description": "",
    "showBreadcrumb": true,
    "heroLayout": "compact",
    "imagePositionClassName": "object-[42%_36%]"
  }'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.breadcrumb_block_templates (name, slug, description, variant, status, config, sort_order)
values (
  'Breadcrumb — Track Your Project',
  'breadcrumb-track-your-project',
  'مسار التنقل لصفحة تابع مشروعك',
  'hero-inline',
  'published',
  '{"source":"navigation","showHome":true}'::jsonb,
  55
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values (
  'Track — Intro',
  'track-intro',
  'مقدمة صفحة تابع مشروعك',
  'default',
  'premium-dark',
  'published',
  '{
    "eyebrow": "Project Tracking",
    "title": "تابع مشروعك",
    "subtitle": "تابع مراحل التنفيذ أولًا بأول عبر تحديثات واضحة تعكس الواقع على الأرض.",
    "body": "بوابة متابعة المشروع تتيح لك الاطلاع على مراحل التنفيذ والتحديثات الميدانية ونسب الإنجاز، بشكل واضح يعكس ما يحدث على أرض الواقع. تواصل مع فريق فينيسيا للحصول على آخر المستجدات حول وحدتك.",
    "alignment": "start"
  }'::jsonb,
  55
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.cta_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values (
  'Track — Contact CTA',
  'track-contact-cta',
  'دعوة للتواصل بخصوص متابعة المشروع',
  'band',
  'premium-dark',
  'published',
  '{
    "eyebrow": "Venesia Developments",
    "title": "هل تحتاج مساعدة في متابعة مشروعك؟",
    "description": "تواصل مع فريق فينيسيا للاستفسار عن مراحل التنفيذ والتحديثات.",
    "primaryCta": { "label": "تواصل معنا ↗", "href": "/contact" },
    "backgroundImage": "/images/venesia-1.png",
    "backgroundStyle": "dark"
  }'::jsonb,
  55
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
cross join public.hero_templates h
where p.slug = 'track-your-project'
  and h.slug = 'hero-track-your-project'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

update public.hero_assignments ha
set hero_id = h.id, target_slug = p.slug, path = p.path, priority = 100
from public.pages p, public.hero_templates h
where ha.target_type = 'page'
  and ha.target_id = p.id
  and p.slug = 'track-your-project'
  and h.slug = 'hero-track-your-project'
  and ha.is_active = true;

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-track-your-project'
where p.slug = 'track-your-project'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, true
from public.pages p
join public.content_block_templates t on t.slug = 'track-intro'
where p.slug = 'track-your-project'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cta_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'before-footer', 20, true
from public.pages p
join public.cta_block_templates t on t.slug = 'track-contact-cta'
where p.slug = 'track-your-project'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
