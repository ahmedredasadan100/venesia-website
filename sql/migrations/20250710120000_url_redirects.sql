-- URL redirects for public path management (admin SEO Redirect Manager).
-- Fresh-environment only; do not blindly re-apply against an existing database.

create table if not exists public.url_redirects (
  id bigint generated always as identity primary key,
  source_path text not null,
  destination_path text not null,
  redirect_type text not null
    check (redirect_type in ('301', '302')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint url_redirects_source_path_unique unique (source_path)
);

create index if not exists url_redirects_status_idx
  on public.url_redirects (status);

create index if not exists url_redirects_updated_at_idx
  on public.url_redirects (updated_at desc);
