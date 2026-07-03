-- Media Center listing pages — default CMS modules (Hero + Breadcrumb + Content shell).
-- Matches topics/about seed philosophy: templates by slug + page assignments.
-- Content shell assignments use is_visible=false so listing UI stays code-driven on public.
-- Idempotent: safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Hero templates (one per listing page — config mirrors static shell fallback)
-- ---------------------------------------------------------------------------
insert into public.hero_templates (
  name, slug, description, section_key, variant, style_preset, source_type, limit_count, is_visible, sort_order, config
)
values
  (
    'Hero — Media Center News',
    'hero-media-center-news',
    'Hero for /media-center/news',
    'hero',
    'internal-page',
    'cinematic-gold',
    'manual',
    1,
    true,
    31,
    $json${"title":"الأخبار","images":["/images/venesia-5.png"],"eyebrow":"News","showCta":false,"subtitle":"آخر أخبار وتحديثات فينيسيا.","highlight":"","description":"آخر أخبار وتحديثات فينيسيا.","showBreadcrumb":true,"imagePositionClassName":"object-[42%_36%]"}$json$::jsonb
  ),
  (
    'Hero — Media Center Videos',
    'hero-media-center-videos',
    'Hero for /media-center/videos',
    'hero',
    'internal-page',
    'cinematic-gold',
    'manual',
    1,
    true,
    32,
    $json${"title":"الفيديوهات","images":["/images/venesia-5.png"],"eyebrow":"Videos","showCta":false,"subtitle":"لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.","highlight":"","description":"لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.","showBreadcrumb":true,"imagePositionClassName":"object-[42%_36%]"}$json$::jsonb
  ),
  (
    'Hero — Media Center Gallery',
    'hero-media-center-gallery',
    'Hero for /media-center/gallery',
    'hero',
    'internal-page',
    'cinematic-gold',
    'manual',
    1,
    true,
    33,
    $json${"title":"معرض الصور","images":["/images/venesia-5.png"],"eyebrow":"Gallery","showCta":false,"subtitle":"صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.","highlight":"","description":"صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.","showBreadcrumb":true,"imagePositionClassName":"object-[42%_36%]"}$json$::jsonb
  ),
  (
    'Hero — Media Center Press',
    'hero-media-center-press',
    'Hero for /media-center/press',
    'hero',
    'internal-page',
    'cinematic-gold',
    'manual',
    1,
    true,
    34,
    $json${"title":"البيانات الصحفية","images":["/images/venesia-5.png"],"eyebrow":"Press","showCta":false,"subtitle":"بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.","highlight":"","description":"بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.","showBreadcrumb":true,"imagePositionClassName":"object-[42%_36%]"}$json$::jsonb
  ),
  (
    'Hero — Media Center Site Updates',
    'hero-media-center-site-updates',
    'Hero for /media-center/site-updates',
    'hero',
    'internal-page',
    'cinematic-gold',
    'manual',
    1,
    true,
    35,
    $json${"title":"تحديثات المواقع","images":["/images/venesia-5.png"],"eyebrow":"Site Updates","showCta":false,"subtitle":"متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.","highlight":"","description":"متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.","showBreadcrumb":true,"imagePositionClassName":"object-[42%_36%]"}$json$::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  source_type = excluded.source_type,
  limit_count = excluded.limit_count,
  is_visible = excluded.is_visible,
  sort_order = excluded.sort_order,
  config = excluded.config,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Breadcrumb templates
-- ---------------------------------------------------------------------------
insert into public.breadcrumb_block_templates (name, slug, description, variant, status, config, sort_order)
values
  ('Breadcrumb — Media Center News', 'breadcrumb-media-center-news', 'Breadcrumb for media center news listing', 'hero-inline', 'published', '{"source":"navigation","showHome":true}'::jsonb, 31),
  ('Breadcrumb — Media Center Videos', 'breadcrumb-media-center-videos', 'Breadcrumb for media center videos listing', 'hero-inline', 'published', '{"source":"navigation","showHome":true}'::jsonb, 32),
  ('Breadcrumb — Media Center Gallery', 'breadcrumb-media-center-gallery', 'Breadcrumb for media center gallery listing', 'hero-inline', 'published', '{"source":"navigation","showHome":true}'::jsonb, 33),
  ('Breadcrumb — Media Center Press', 'breadcrumb-media-center-press', 'Breadcrumb for media center press listing', 'hero-inline', 'published', '{"source":"navigation","showHome":true}'::jsonb, 34),
  ('Breadcrumb — Media Center Site Updates', 'breadcrumb-media-center-site-updates', 'Breadcrumb for media center site updates listing', 'hero-inline', 'published', '{"source":"navigation","showHome":true}'::jsonb, 35)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Content shell templates (admin placeholder — assignment hidden on public)
-- ---------------------------------------------------------------------------
insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Media Center — News Listing Shell',
    'media-center-news-listing-shell',
    'Optional CMS blocks slot above/below news listing',
    'default',
    'premium-dark',
    'published',
    $json${"eyebrow":"","title":"Listing shell","subtitle":"Publish or replace to show CMS content above the news listing.","body":"","alignment":"start"}$json$::jsonb,
    31
  ),
  (
    'Media Center — Videos Listing Shell',
    'media-center-videos-listing-shell',
    'Optional CMS blocks slot above/below videos listing',
    'default',
    'premium-dark',
    'published',
    $json${"eyebrow":"","title":"Listing shell","subtitle":"Publish or replace to show CMS content above the videos listing.","body":"","alignment":"start"}$json$::jsonb,
    32
  ),
  (
    'Media Center — Gallery Listing Shell',
    'media-center-gallery-listing-shell',
    'Optional CMS blocks slot above/below gallery listing',
    'default',
    'premium-dark',
    'published',
    $json${"eyebrow":"","title":"Listing shell","subtitle":"Publish or replace to show CMS content above the gallery listing.","body":"","alignment":"start"}$json$::jsonb,
    33
  ),
  (
    'Media Center — Press Listing Shell',
    'media-center-press-listing-shell',
    'Optional CMS blocks slot above/below press listing',
    'default',
    'premium-dark',
    'published',
    $json${"eyebrow":"","title":"Listing shell","subtitle":"Publish or replace to show CMS content above the press listing.","body":"","alignment":"start"}$json$::jsonb,
    34
  ),
  (
    'Media Center — Site Updates Listing Shell',
    'media-center-site-updates-listing-shell',
    'Optional CMS blocks slot above/below site updates listing',
    'default',
    'premium-dark',
    'published',
    $json${"eyebrow":"","title":"Listing shell","subtitle":"Publish or replace to show CMS content above the site updates listing.","body":"","alignment":"start"}$json$::jsonb,
    35
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
-- Hero assignments
-- ---------------------------------------------------------------------------
insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
join public.hero_templates h on h.slug = 'hero-media-center-news'
where p.slug = 'media-center-news'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
join public.hero_templates h on h.slug = 'hero-media-center-videos'
where p.slug = 'media-center-videos'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
join public.hero_templates h on h.slug = 'hero-media-center-gallery'
where p.slug = 'media-center-gallery'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
join public.hero_templates h on h.slug = 'hero-media-center-press'
where p.slug = 'media-center-press'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
join public.hero_templates h on h.slug = 'hero-media-center-site-updates'
where p.slug = 'media-center-site-updates'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

-- ---------------------------------------------------------------------------
-- Breadcrumb + content assignments
-- ---------------------------------------------------------------------------
insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-media-center-news'
where p.slug = 'media-center-news'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-media-center-videos'
where p.slug = 'media-center-videos'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-media-center-gallery'
where p.slug = 'media-center-gallery'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-media-center-press'
where p.slug = 'media-center-press'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-media-center-site-updates'
where p.slug = 'media-center-site-updates'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, false
from public.pages p
join public.content_block_templates t on t.slug = 'media-center-news-listing-shell'
where p.slug = 'media-center-news'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = false,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, false
from public.pages p
join public.content_block_templates t on t.slug = 'media-center-videos-listing-shell'
where p.slug = 'media-center-videos'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = false,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, false
from public.pages p
join public.content_block_templates t on t.slug = 'media-center-gallery-listing-shell'
where p.slug = 'media-center-gallery'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = false,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, false
from public.pages p
join public.content_block_templates t on t.slug = 'media-center-press-listing-shell'
where p.slug = 'media-center-press'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = false,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, false
from public.pages p
join public.content_block_templates t on t.slug = 'media-center-site-updates-listing-shell'
where p.slug = 'media-center-site-updates'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = false,
  updated_at = now();

commit;
