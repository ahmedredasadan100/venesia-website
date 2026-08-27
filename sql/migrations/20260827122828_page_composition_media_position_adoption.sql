begin;

-- Media Hub and Media Sidebar are module families, not visual Regions.
-- Their Page Assignments must be able to select any semantic Region exposed by
-- the platform Page Composition contract. Existing rows keep their Positions.
alter table public.page_media_hub_module_assignments
  drop constraint if exists page_media_hub_module_assignments_slot_check,
  alter column slot drop default;

alter table public.page_media_sidebar_module_assignments
  drop constraint if exists page_media_sidebar_module_assignments_slot_check,
  alter column slot drop default;

comment on column public.page_media_hub_module_assignments.slot is
  'Semantic Page Composition Region selected by this Assignment.';

comment on column public.page_media_sidebar_module_assignments.slot is
  'Semantic Page Composition Region selected by this Assignment.';

commit;
