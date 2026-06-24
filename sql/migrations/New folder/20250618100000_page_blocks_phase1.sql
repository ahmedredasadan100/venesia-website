-- Pages & Blocks Phase 1
-- Content, CTA, Cards templates + page assignment tables
-- Hero tables are intentionally unchanged.

begin;

-- ---------------------------------------------------------------------------
-- Content block templates
-- ---------------------------------------------------------------------------
create table if not exists public.content_block_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  variant       text not null default 'default',
  style_preset  text not null default 'premium-dark',
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint content_block_templates_slug_unique unique (slug)
);

create index if not exists content_block_templates_status_idx
  on public.content_block_templates (status);

-- ---------------------------------------------------------------------------
-- CTA block templates
-- ---------------------------------------------------------------------------
create table if not exists public.cta_block_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  variant       text not null default 'band',
  style_preset  text not null default 'premium-dark',
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cta_block_templates_slug_unique unique (slug)
);

create index if not exists cta_block_templates_status_idx
  on public.cta_block_templates (status);

-- ---------------------------------------------------------------------------
-- Cards block templates
-- ---------------------------------------------------------------------------
create table if not exists public.cards_block_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  variant       text not null default 'glass',
  style_preset  text not null default 'premium-dark',
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cards_block_templates_slug_unique unique (slug)
);

create index if not exists cards_block_templates_status_idx
  on public.cards_block_templates (status);

-- ---------------------------------------------------------------------------
-- Page assignments (one row = one template linked to one page)
-- ---------------------------------------------------------------------------
create table if not exists public.page_content_block_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.content_block_templates (id) on delete cascade,
  slot          text not null default 'main',
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_content_block_assignments_unique unique (page_id, template_id)
);

create index if not exists page_content_block_assignments_page_idx
  on public.page_content_block_assignments (page_id, slot, sort_order);

create table if not exists public.page_cta_block_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.cta_block_templates (id) on delete cascade,
  slot          text not null default 'main',
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_cta_block_assignments_unique unique (page_id, template_id)
);

create index if not exists page_cta_block_assignments_page_idx
  on public.page_cta_block_assignments (page_id, slot, sort_order);

create table if not exists public.page_cards_block_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.cards_block_templates (id) on delete cascade,
  slot          text not null default 'main',
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_cards_block_assignments_unique unique (page_id, template_id)
);

create index if not exists page_cards_block_assignments_page_idx
  on public.page_cards_block_assignments (page_id, slot, sort_order);

commit;
