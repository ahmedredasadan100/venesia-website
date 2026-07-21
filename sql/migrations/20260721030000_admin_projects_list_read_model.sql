-- Additive Projects admin list read model.
-- Rollback: DROP FUNCTION public.admin_list_projects(integer, integer, text, text, text, text, text, text, text, text);
create or replace function public.admin_list_projects(
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_field text default 'homepage_order',
  p_sort_direction text default 'asc',
  p_project_type text default 'residential',
  p_search text default '',
  p_publication_status text default 'all',
  p_implementation_status text default 'all',
  p_featured text default 'all',
  p_list_mode text default 'all'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_page is null or p_page < 1 then
    raise exception using errcode = '22023', message = 'p_page must be a positive integer';
  end if;
  if p_page_size is null or p_page_size not in (10, 20, 30) then
    raise exception using errcode = '22023', message = 'p_page_size must be one of 10, 20, 30';
  end if;
  if p_sort_field is null or p_sort_field not in (
    'homepage_order', 'arabic_name', 'code', 'featured',
    'publication_status', 'location', 'updated_at'
  ) then
    raise exception using errcode = '22023', message = 'p_sort_field is not supported';
  end if;
  if p_sort_direction is null or p_sort_direction not in ('asc', 'desc') then
    raise exception using errcode = '22023', message = 'p_sort_direction must be asc or desc';
  end if;
  if p_project_type is null or p_project_type not in ('residential', 'commercial') then
    raise exception using errcode = '22023', message = 'p_project_type is not supported';
  end if;
  if p_publication_status is null or p_publication_status not in (
    'all', 'draft', 'published', 'unpublished', 'archived'
  ) then
    raise exception using errcode = '22023', message = 'p_publication_status is not supported';
  end if;
  if p_implementation_status is null or p_implementation_status not in (
    'all', 'under-construction', 'excavation', 'near-delivery', 'delivered'
  ) then
    raise exception using errcode = '22023', message = 'p_implementation_status is not supported';
  end if;
  if p_featured is null or p_featured not in ('all', 'yes', 'no') then
    raise exception using errcode = '22023', message = 'p_featured is not supported';
  end if;
  if p_list_mode is null or p_list_mode not in ('all', 'active', 'archived') then
    raise exception using errcode = '22023', message = 'p_list_mode is not supported';
  end if;

  return (
  with scoped as (
    select
      p.id,
      p.code,
      p.slug,
      p.arabic_name,
      p.location_label,
      p.map_area,
      p.featured,
      p.publication_status,
      p.status,
      p.homepage_order,
      p.updated_at
    from public.projects p
    where p.type = p_project_type
      and (
        p_list_mode = 'all'
        or (p_list_mode = 'active' and p.publication_status is distinct from 'archived')
        or (p_list_mode = 'archived' and p.publication_status = 'archived')
      )
  ), metrics as (
    select
      count(*) filter (where publication_status = 'published')::bigint as published,
      count(*) filter (where featured is true)::bigint as featured
    from scoped
  ), filtered as (
    select scoped.*
    from scoped
    where (
        nullif(btrim(p_search), '') is null
        or scoped.arabic_name ilike '%' || btrim(p_search) || '%'
        or scoped.code ilike '%' || btrim(p_search) || '%'
        or coalesce(scoped.location_label, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(scoped.map_area, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(scoped.slug, '') ilike '%' || btrim(p_search) || '%'
      )
      and (
        p_publication_status = 'all'
        or scoped.publication_status = p_publication_status
      )
      and (
        p_implementation_status = 'all'
        or scoped.status = p_implementation_status
      )
      and (
        p_featured = 'all'
        or (p_featured = 'yes' and scoped.featured is true)
        or (p_featured = 'no' and scoped.featured is not true)
      )
  ), page_state as (
    select
      count(*)::bigint as total_count,
      greatest(1, least(p_page_size, 30)) as page_size
    from filtered
  ), normalized_state as (
    select
      total_count,
      page_size,
      least(
        greatest(p_page, 1),
        greatest(1, ceil(total_count::numeric / page_size)::integer)
      ) as page
    from page_state
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(project_slice)) from (
        select
          filtered.id,
          filtered.code,
          filtered.slug,
          filtered.arabic_name,
          filtered.location_label,
          filtered.map_area,
          filtered.featured,
          filtered.publication_status,
          filtered.status,
          filtered.updated_at
        from filtered
        cross join normalized_state
        order by
          case when p_sort_field = 'arabic_name' and p_sort_direction = 'asc' then filtered.arabic_name end asc,
          case when p_sort_field = 'arabic_name' and p_sort_direction = 'desc' then filtered.arabic_name end desc,
          case when p_sort_field = 'code' and p_sort_direction = 'asc' then filtered.code end asc,
          case when p_sort_field = 'code' and p_sort_direction = 'desc' then filtered.code end desc,
          case when p_sort_field = 'featured' and p_sort_direction = 'asc' then filtered.featured::text end asc,
          case when p_sort_field = 'featured' and p_sort_direction = 'desc' then filtered.featured::text end desc,
          case when p_sort_field = 'publication_status' and p_sort_direction = 'asc' then filtered.publication_status end asc,
          case when p_sort_field = 'publication_status' and p_sort_direction = 'desc' then filtered.publication_status end desc,
          case when p_sort_field = 'location' and p_sort_direction = 'asc' then coalesce(filtered.location_label, filtered.map_area) end asc,
          case when p_sort_field = 'location' and p_sort_direction = 'desc' then coalesce(filtered.location_label, filtered.map_area) end desc,
          case when p_sort_field = 'updated_at' and p_sort_direction = 'asc' then filtered.updated_at end asc,
          case when p_sort_field = 'updated_at' and p_sort_direction = 'desc' then filtered.updated_at end desc,
          case when p_sort_field = 'homepage_order' and p_sort_direction = 'asc' then filtered.homepage_order end asc,
          case when p_sort_field = 'homepage_order' and p_sort_direction = 'desc' then filtered.homepage_order end desc,
          filtered.id asc
        limit (select page_size from normalized_state)
        offset ((select (page - 1) * page_size from normalized_state))
      ) project_slice
    ), '[]'::jsonb),
    'total_count', (select total_count from normalized_state),
    'page', (select page from normalized_state),
    'metrics', jsonb_build_object(
      'published', (select published from metrics),
      'featured', (select featured from metrics)
    )
  ));
end;
$$;

revoke all on function public.admin_list_projects(
  integer, integer, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_list_projects(
  integer, integer, text, text, text, text, text, text, text, text
) to service_role;
