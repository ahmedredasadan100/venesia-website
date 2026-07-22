-- Additive per-topic presentation controls for the public topic detail page.
-- Defaults preserve the current rendering of every existing row.

alter table public.topics
  add column if not exists show_title_on_page boolean not null default true,
  add column if not exists show_image_on_page boolean not null default true,
  add column if not exists show_excerpt_on_page boolean not null default true,
  add column if not exists show_faq_on_page boolean not null default true,
  add column if not exists show_faq_title_on_page boolean not null default true;

comment on column public.topics.show_title_on_page is
  'Controls visible title rendering on the public topic detail page; metadata remains intact.';
comment on column public.topics.show_image_on_page is
  'Controls visible primary image rendering on the public topic detail page.';
comment on column public.topics.show_excerpt_on_page is
  'Controls visible excerpt rendering on the public topic detail page; listing cards remain unchanged.';
comment on column public.topics.show_faq_on_page is
  'Controls FAQ section rendering while preserving the saved questions and their order.';
comment on column public.topics.show_faq_title_on_page is
  'Controls the visible FAQ section heading while preserving the section and its questions.';
