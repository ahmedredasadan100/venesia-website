-- Extend the existing per-topic presentation contract for public topic metadata.
-- Defaults preserve every element that was visible before this migration.

alter table public.topics
  add column if not exists show_date_on_page boolean not null default true,
  add column if not exists show_category_on_page boolean not null default true,
  add column if not exists show_series_on_page boolean not null default true,
  add column if not exists show_intro_card_on_page boolean not null default true;

comment on column public.topics.show_date_on_page is
  'Controls visible publication-date metadata across public topic consumers.';
comment on column public.topics.show_category_on_page is
  'Controls visible category metadata and navigation across public topic consumers.';
comment on column public.topics.show_series_on_page is
  'Controls visible series metadata and navigation across public topic consumers.';
comment on column public.topics.show_intro_card_on_page is
  'Controls the complete topic-introduction card on the public topic detail page.';
