-- Project Details adopts the existing Content Module presentation owner.
-- Project rows remain data-only; Hero and every other Project consumer are excluded.

begin;

do $project_details_presentation_preflight$
begin
  if to_regclass('public.content_block_templates') is null then
    raise exception 'Project Details presentation adoption requires public.content_block_templates.';
  end if;

  if to_regclass('public.page_content_block_assignments') is null then
    raise exception 'Project Details presentation adoption requires public.page_content_block_assignments.';
  end if;
end;
$project_details_presentation_preflight$;

insert into public.content_block_templates (
  name,
  slug,
  description,
  variant,
  style_preset,
  status,
  config,
  sort_order
)
values (
  'عرض بيانات الموقع — تفاصيل المشروع',
  'project-details-presentation',
  'Presentation خاصة بقسم «عن الموقع» داخل Project Details فقط؛ بيانات الموقع تبقى في Projects Domain.',
  'project-details-presentation',
  'premium-dark',
  'published',
  jsonb_build_object(
    'showLocationLabel', true,
    'showLocationTags', true
  ),
  coalesce((select max(sort_order) from public.content_block_templates), 0) + 10
)
on conflict (slug) do nothing;

update public.content_block_templates
set
  config = jsonb_build_object(
    'showLocationLabel', true,
    'showLocationTags', true
  ) || config,
  updated_at = now()
where slug = 'project-details-presentation';

do $project_details_presentation_contract$
declare
  v_template public.content_block_templates%rowtype;
begin
  select * into strict v_template
  from public.content_block_templates
  where slug = 'project-details-presentation';

  if v_template.variant <> 'project-details-presentation' then
    raise exception 'Project Details presentation slug is owned by an incompatible variant: %', v_template.variant;
  end if;

  if jsonb_typeof(v_template.config -> 'showLocationLabel') <> 'boolean'
     or jsonb_typeof(v_template.config -> 'showLocationTags') <> 'boolean' then
    raise exception 'Project Details presentation requires Boolean showLocationLabel and showLocationTags values.';
  end if;

  if exists (
    select 1
    from public.page_content_block_assignments assignment
    where assignment.template_id = v_template.id
  ) then
    raise exception 'Project Details presentation is Consumer-owned and cannot have Page Composition assignments.';
  end if;
end;
$project_details_presentation_contract$;

commit;
