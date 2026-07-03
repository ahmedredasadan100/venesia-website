-- Projects CMS Core (Phase 1)
-- Relational model for project entities. Execution journey intentionally excluded.

begin;

-- ---------------------------------------------------------------------------
-- Core projects table
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id                      bigserial primary key,
  slug                    text not null,
  code                    text not null,
  type                    text not null
                          check (type in ('residential', 'commercial')),
  arabic_name             text not null,
  english_name            text not null,
  category_label          text not null default '',
  status                  text not null default 'under-construction'
                          check (status in ('under-construction', 'excavation', 'near-delivery', 'delivered')),
  status_label            text not null default '',
  image                   text not null default '',
  hero_image              text not null default '',
  location_label          text not null default '',
  map_area                text not null default '',
  short_description       text not null default '',
  description             jsonb not null default '[]'::jsonb,
  core_specs              jsonb,
  delivery_label          text not null default '',
  area_label              text not null default '',
  progress                integer not null default 0
                          check (progress >= 0 and progress <= 100),
  units_label             text not null default '',
  featured                boolean not null default false,
  show_on_homepage        boolean not null default true,
  homepage_order          integer not null default 0,
  floors_label            text,
  brochure_url            text,
  publication_status      text not null default 'published'
                          check (publication_status in ('draft', 'published', 'unpublished', 'archived')),
  overview_title          text,
  overview_body           text,
  overview_bullets        jsonb not null default '[]'::jsonb,
  overview_video_image    text,
  district_title          text,
  district_subtitle       text,
  district_body           text,
  district_bullets        jsonb not null default '[]'::jsonb,
  district_image          text,
  delivery_specs_title    text,
  delivery_specs_subtitle text,
  contact_cta             jsonb,
  quick_facts             jsonb not null default '[]'::jsonb,
  location_data           jsonb,
  cta                     jsonb,
  detail_tabs             jsonb not null default '[]'::jsonb,
  seo_title               text,
  seo_description         text,
  seo_keywords            text[] not null default '{}',
  focus_keyword           text,
  og_image                text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint projects_slug_unique unique (slug)
);

create index if not exists projects_type_idx
  on public.projects (type);

create index if not exists projects_publication_status_idx
  on public.projects (publication_status);

create index if not exists projects_homepage_order_idx
  on public.projects (homepage_order);

create index if not exists projects_featured_idx
  on public.projects (featured);

-- ---------------------------------------------------------------------------
-- Floor plans (available areas)
-- ---------------------------------------------------------------------------
create table if not exists public.project_floor_plans (
  id          bigserial primary key,
  project_id  bigint not null references public.projects (id) on delete cascade,
  area        text not null,
  label       text,
  plan_image  text not null default '',
  specs       jsonb not null default '[]'::jsonb,
  featured    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint project_floor_plans_project_sort_unique unique (project_id, sort_order)
);

create index if not exists project_floor_plans_project_idx
  on public.project_floor_plans (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- Delivery specification items
-- ---------------------------------------------------------------------------
create table if not exists public.project_delivery_spec_items (
  id          bigserial primary key,
  project_id  bigint not null references public.projects (id) on delete cascade,
  body        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint project_delivery_spec_items_project_sort_unique unique (project_id, sort_order)
);

create index if not exists project_delivery_spec_items_project_idx
  on public.project_delivery_spec_items (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- Media collections (overview, delivery specs, gallery)
-- Execution journey media is intentionally excluded from this phase.
-- ---------------------------------------------------------------------------
create table if not exists public.project_media (
  id          bigserial primary key,
  project_id  bigint not null references public.projects (id) on delete cascade,
  collection  text not null
              check (collection in ('overview', 'delivery_specs', 'gallery')),
  image       text not null default '',
  label       text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists project_media_project_collection_idx
  on public.project_media (project_id, collection, sort_order);

commit;
