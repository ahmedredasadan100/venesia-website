begin;

-- Hero Template persistence exposes Product presets only. Legacy CSS-valued
-- fields remain readable in application compatibility code until this migration
-- is applied, but they are never written back to CMS JSONB.
with normalized as (
  select
    id,
    variant,
    (
      coalesce(config, '{}'::jsonb)
        - 'imagePositionClassName'
        - 'image_position_class'
        - 'image_composition'
        - 'heroLayout'
        - 'hero_layout'
        - 'showBreadcrumb'
        - 'breadcrumbBold'
        - 'breadcrumbAlignment'
        - 'breadcrumbCurrentLabel'
    ) || jsonb_build_object(
      'imageComposition',
      case coalesce(
        config ->> 'imageComposition',
        config ->> 'image_composition',
        config ->> 'imagePositionClassName',
        config ->> 'image_position_class'
      )
        when 'cover-upper' then 'cover-upper'
        when 'object-[42%_36%]' then 'cover-upper'
        else 'cover-center'
      end
    ) as config
  from public.hero_templates
)
update public.hero_templates as template
set
  config = case
    when normalized.variant = 'internal-page' then
      normalized.config || jsonb_build_object(
        'eyebrowBold', false,
        'eyebrowAlignment', 'right',
        'titleBold', true,
        'titleAlignment', 'right',
        'highlightBold', false,
        'highlightAlignment', 'right',
        'subtitleBold', false,
        'subtitleAlignment', 'right',
        'descriptionAlignment', 'right',
        'ctaAlignment', 'right',
        'heroElementOrder', '["eyebrow","title","highlight","subtitle","description","cta"]'::jsonb
      )
    else normalized.config
  end,
  updated_at = now()
from normalized
where normalized.id = template.id;

-- Restore the canonical I87 Hero asset. The persisted record currently points
-- at a construction-progress placeholder owned by B84, which makes both the
-- Projects Hub and Project Detail Hero render the wrong visual.
update public.projects
set
  hero_image = '/images/projects/i87/hero.jpg',
  updated_at = now()
where code = 'I87'
  and hero_image = '/images/projects/b84/progress-04 - copy (6).jpg';

do $assert_hero_platform_product_preset_closure$
begin
  if exists (
    select 1
    from public.hero_templates
    where config ?| array[
      'imagePositionClassName',
      'image_position_class',
      'image_composition',
      'heroLayout',
      'hero_layout'
    ]
      or config::text ~ '"(object-position|object-fit|objectPosition|objectFit)"'
      or config::text ~ '"object-[^" ]*"'
  ) then
    raise exception 'Hero Platform closure refused: CMS still contains CSS-valued composition or height fields';
  end if;

  if exists (
    select 1
    from public.hero_templates
    where coalesce(config ->> 'imageComposition', '') not in ('cover-center', 'cover-upper')
  ) then
    raise exception 'Hero Platform closure refused: image composition is not a Product preset';
  end if;

  if exists (
    select 1
    from public.hero_templates
    where variant = 'internal-page'
      and (
        config ->> 'eyebrowAlignment' is distinct from 'right'
        or config ->> 'titleAlignment' is distinct from 'right'
        or config ->> 'highlightAlignment' is distinct from 'right'
        or config ->> 'subtitleAlignment' is distinct from 'right'
        or config ->> 'descriptionAlignment' is distinct from 'right'
        or config ->> 'ctaAlignment' is distinct from 'right'
        or config -> 'heroElementOrder' is distinct from
          '["eyebrow","title","highlight","subtitle","description","cta"]'::jsonb
      )
  ) then
    raise exception 'Hero Platform closure refused: Standard Internal composition can still drift per page';
  end if;

  if exists (
    select 1
    from public.projects
    where code = 'I87'
      and publication_status = 'published'
      and hero_image is distinct from '/images/projects/i87/hero.jpg'
  ) then
    raise exception 'Hero Platform closure refused: I87 does not use its canonical Hero asset';
  end if;
end;
$assert_hero_platform_product_preset_closure$;

commit;
