-- Breadcrumb module: independent reusable block + page assignments

begin;

create table if not exists public.breadcrumb_block_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  variant       text not null default 'hero-inline',
  style_preset  text not null default 'premium-dark',
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint breadcrumb_block_templates_slug_unique unique (slug)
);

create index if not exists breadcrumb_block_templates_status_idx
  on public.breadcrumb_block_templates (status);

create table if not exists public.page_breadcrumb_block_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.breadcrumb_block_templates (id) on delete cascade,
  slot          text not null default 'top',
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_breadcrumb_block_assignments_unique unique (page_id, template_id)
);

create index if not exists page_breadcrumb_block_assignments_page_idx
  on public.page_breadcrumb_block_assignments (page_id, slot, sort_order);

commit;
