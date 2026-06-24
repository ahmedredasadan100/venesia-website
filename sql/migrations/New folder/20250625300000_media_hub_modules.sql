-- Media Center hub modules — templates + page assignments for /media-center hub sections.
-- Also seeds hub hero + breadcrumb on media-center page.
-- Idempotent: safe to re-run.

begin;

create table if not exists public.media_hub_module_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  section_key   text not null
                check (section_key in ('featured', 'site-updates', 'videos', 'gallery', 'press')),
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint media_hub_module_templates_slug_unique unique (slug)
);

create index if not exists media_hub_module_templates_status_idx
  on public.media_hub_module_templates (status);

create index if not exists media_hub_module_templates_section_key_idx
  on public.media_hub_module_templates (section_key);

create table if not exists public.page_media_hub_module_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.media_hub_module_templates (id) on delete cascade,
  slot          text not null default 'main'
                check (slot = 'main'),
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_media_hub_module_assignments_unique unique (page_id, template_id)
);

create index if not exists page_media_hub_module_assignments_page_idx
  on public.page_media_hub_module_assignments (page_id, slot, sort_order);

-- ---------------------------------------------------------------------------
-- Hub hero + breadcrumb (media-center page shell)
-- ---------------------------------------------------------------------------
insert into public.hero_templates (
  name, slug, description, section_key, variant, style_preset, source_type, limit_count, is_visible, sort_order, config
)
values (
  'Hero — Media Center Hub',
  'hero-media-center',
  'Hero for /media-center hub',
  'hero',
  'internal-page',
  'cinematic-gold',
  'manual',
  1,
  true,
  30,
  $json${"title":"المركز الإعلامي","images":["/images/venesia-5.png"],"eyebrow":"Media Center","showCta":false,"subtitle":"أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.","highlight":"","description":"أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.","showBreadcrumb":true,"imagePositionClassName":"object-[42%_36%]"}$json$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  is_visible = excluded.is_visible,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.breadcrumb_block_templates (name, slug, description, variant, status, config, sort_order)
values (
  'Breadcrumb — Media Center Hub',
  'breadcrumb-media-center',
  'Breadcrumb for /media-center hub',
  'hero-inline',
  'published',
  '{"source":"navigation","showHome":true}'::jsonb,
  30
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.hero_assignments (hero_id, target_type, target_id, target_slug, path, is_active, priority)
select h.id, 'page', p.id, p.slug, p.path, true, 100
from public.pages p
join public.hero_templates h on h.slug = 'hero-media-center'
where p.slug = 'media-center'
  and not exists (
    select 1 from public.hero_assignments ha
    where ha.target_type = 'page' and ha.target_id = p.id and ha.is_active = true
  );

update public.hero_assignments ha
set hero_id = h.id, target_slug = p.slug, path = p.path, is_active = true, priority = 100
from public.pages p, public.hero_templates h
where p.slug = 'media-center'
  and h.slug = 'hero-media-center'
  and ha.target_type = 'page'
  and ha.target_id = p.id;

insert into public.page_breadcrumb_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'hero', 5, true
from public.pages p
join public.breadcrumb_block_templates t on t.slug = 'breadcrumb-media-center'
where p.slug = 'media-center'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = excluded.is_visible,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Hub section templates
-- ---------------------------------------------------------------------------
insert into public.media_hub_module_templates (name, slug, description, section_key, status, config, sort_order)
values
  (
    'Media Featured News Module',
    'media-hub-featured',
    'Featured news + side carousel on Media Center hub',
    'featured',
    'published',
    $json${"source":"media_items","type":"news","featured":true,"sideLimit":3,"listLimit":4}$json$::jsonb,
    10
  ),
  (
    'Media Site Updates Module',
    'media-hub-site-updates',
    'Site updates timeline on Media Center hub',
    'site-updates',
    'published',
    $json${"source":"media_items","type":"site-update","limit":4}$json$::jsonb,
    20
  ),
  (
    'Media Videos Module',
    'media-hub-videos',
    'Videos section on Media Center hub',
    'videos',
    'published',
    $json${"source":"media_items","type":"video","limit":4}$json$::jsonb,
    30
  ),
  (
    'Media Gallery Module',
    'media-hub-gallery',
    'Gallery section on Media Center hub',
    'gallery',
    'published',
    $json${"source":"media_items","type":"gallery","limit":8}$json$::jsonb,
    40
  ),
  (
    'Media Press Module',
    'media-hub-press',
    'Press releases section on Media Center hub',
    'press',
    'published',
    $json${"source":"media_items","type":"press"}$json$::jsonb,
    50
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  section_key = excluded.section_key,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.page_media_hub_module_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', v.sort_order, true
from public.pages p
cross join (
  values
    ('media-hub-featured', 10),
    ('media-hub-site-updates', 20),
    ('media-hub-videos', 30),
    ('media-hub-gallery', 40),
    ('media-hub-press', 50)
) as v(template_slug, sort_order)
join public.media_hub_module_templates t on t.slug = v.template_slug
where p.slug = 'media-center'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = excluded.is_visible,
  updated_at = now();

commit;
