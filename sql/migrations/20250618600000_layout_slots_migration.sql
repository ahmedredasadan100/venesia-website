-- Normalize layout slot names to hero / main / sidebar / bottom / footer

begin;

update public.page_content_block_assignments
set slot = 'hero', updated_at = now()
where slot = 'top';

update public.page_content_block_assignments
set slot = 'main', updated_at = now()
where slot = 'before-content';

update public.page_content_block_assignments
set slot = 'bottom', updated_at = now()
where slot in ('after-content', 'before-footer');

update public.page_cta_block_assignments
set slot = 'hero', updated_at = now()
where slot = 'top';

update public.page_cta_block_assignments
set slot = 'main', updated_at = now()
where slot = 'before-content';

update public.page_cta_block_assignments
set slot = 'bottom', updated_at = now()
where slot in ('after-content', 'before-footer');

update public.page_cards_block_assignments
set slot = 'hero', updated_at = now()
where slot = 'top';

update public.page_cards_block_assignments
set slot = 'main', updated_at = now()
where slot = 'before-content';

update public.page_cards_block_assignments
set slot = 'bottom', updated_at = now()
where slot in ('after-content', 'before-footer');

update public.page_breadcrumb_block_assignments
set slot = 'hero', updated_at = now()
where slot in ('top', 'hero');

commit;
