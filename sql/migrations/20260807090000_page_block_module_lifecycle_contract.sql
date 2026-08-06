-- Page Block module lifecycle contract.
-- Draft is the editable/new-copy state, unpublished is the explicit withdrawn
-- state, and published is the only publicly rendered state. Archived had no
-- Page Block workflow or live usage, so normalize it before narrowing the
-- database contract.

begin;

update public.content_block_templates set status = 'unpublished' where status = 'archived';
update public.cta_block_templates set status = 'unpublished' where status = 'archived';
update public.cards_block_templates set status = 'unpublished' where status = 'archived';
update public.breadcrumb_block_templates set status = 'unpublished' where status = 'archived';
update public.feed_module_templates set status = 'unpublished' where status = 'archived';
update public.media_sidebar_module_templates set status = 'unpublished' where status = 'archived';
update public.media_hub_module_templates set status = 'unpublished' where status = 'archived';

alter table public.content_block_templates
  drop constraint if exists content_block_templates_status_check,
  add constraint content_block_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

alter table public.cta_block_templates
  drop constraint if exists cta_block_templates_status_check,
  add constraint cta_block_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

alter table public.cards_block_templates
  drop constraint if exists cards_block_templates_status_check,
  add constraint cards_block_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

alter table public.breadcrumb_block_templates
  drop constraint if exists breadcrumb_block_templates_status_check,
  add constraint breadcrumb_block_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

alter table public.feed_module_templates
  drop constraint if exists feed_module_templates_status_check,
  add constraint feed_module_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

alter table public.media_sidebar_module_templates
  drop constraint if exists media_sidebar_module_templates_status_check,
  add constraint media_sidebar_module_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

alter table public.media_hub_module_templates
  drop constraint if exists media_hub_module_templates_status_check,
  add constraint media_hub_module_templates_status_check
    check (status in ('draft', 'published', 'unpublished'));

commit;
