-- Media Center sidebar modules — templates + page assignments.
-- Controls Public sidebar panel visibility/order (Search stays hardcoded).
-- Idempotent: safe to re-run.

begin;

create table if not exists public.media_sidebar_module_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  widget_key    text not null
                check (widget_key in ('sections', 'latest', 'popular')),
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint media_sidebar_module_templates_slug_unique unique (slug)
);

create index if not exists media_sidebar_module_templates_status_idx
  on public.media_sidebar_module_templates (status);

create index if not exists media_sidebar_module_templates_widget_key_idx
  on public.media_sidebar_module_templates (widget_key);

create table if not exists public.page_media_sidebar_module_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.media_sidebar_module_templates (id) on delete cascade,
  slot          text not null default 'sidebar'
                check (slot = 'sidebar'),
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_media_sidebar_module_assignments_unique unique (page_id, template_id)
);

create index if not exists page_media_sidebar_module_assignments_page_idx
  on public.page_media_sidebar_module_assignments (page_id, slot, sort_order);

-- ---------------------------------------------------------------------------
-- Sidebar widget templates
-- ---------------------------------------------------------------------------
insert into public.media_sidebar_module_templates (name, slug, description, widget_key, status, config, sort_order)
values
  (
    'أقسام المركز الإعلامي',
    'media-sidebar-sections',
    'Navigation links for Media Center sections',
    'sections',
    'published',
    $json${"source":"navigation","menuParent":"/media-center"}$json$::jsonb,
    10
  ),
  (
    'أحدث الأخبار',
    'media-sidebar-latest',
    'Latest news items in Media Center sidebar',
    'latest',
    'published',
    $json${"source":"media_items","type":"news","limit":3}$json$::jsonb,
    20
  ),
  (
    'الأكثر قراءة',
    'media-sidebar-popular',
    'Popular media items in Media Center sidebar',
    'popular',
    'published',
    $json${"source":"media_items","isPopular":true,"limit":4}$json$::jsonb,
    30
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  widget_key = excluded.widget_key,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Assignments on Media Center pages (sections=10, latest=20, popular=30)
-- ---------------------------------------------------------------------------
insert into public.page_media_sidebar_module_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'sidebar', 10, true
from public.pages p
cross join public.media_sidebar_module_templates t
where p.slug in (
  'media-center',
  'media-center-news',
  'media-center-videos',
  'media-center-gallery',
  'media-center-press',
  'media-center-site-updates'
)
and t.slug = 'media-sidebar-sections'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = excluded.is_visible,
  updated_at = now();

insert into public.page_media_sidebar_module_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'sidebar', 20, true
from public.pages p
cross join public.media_sidebar_module_templates t
where p.slug in (
  'media-center',
  'media-center-news',
  'media-center-videos',
  'media-center-gallery',
  'media-center-press',
  'media-center-site-updates'
)
and t.slug = 'media-sidebar-latest'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = excluded.is_visible,
  updated_at = now();

insert into public.page_media_sidebar_module_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'sidebar', 30, true
from public.pages p
cross join public.media_sidebar_module_templates t
where p.slug in (
  'media-center',
  'media-center-news',
  'media-center-videos',
  'media-center-gallery',
  'media-center-press',
  'media-center-site-updates'
)
and t.slug = 'media-sidebar-popular'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = excluded.is_visible,
  updated_at = now();

commit;
