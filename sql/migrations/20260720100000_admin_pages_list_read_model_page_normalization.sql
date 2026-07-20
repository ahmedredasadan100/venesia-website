-- Corrective additive migration for deployments that already applied
-- 20260720060000_admin_pages_list_read_model.sql. SQL function bodies are
-- replaced atomically; no table, column, row, or existing assignment changes.
create or replace function public.admin_list_pages(
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_field text default 'id',
  p_sort_direction text default 'asc'
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with assignment_counts as (
    select page_id, count(*)::bigint as block_count
    from (
      select page_id from public.page_content_block_assignments
      union all select page_id from public.page_cta_block_assignments
      union all select page_id from public.page_cards_block_assignments
      union all select page_id from public.page_breadcrumb_block_assignments
      union all select page_id from public.page_feed_module_assignments
      union all select page_id from public.page_media_sidebar_module_assignments
      union all select page_id from public.page_media_hub_module_assignments
      union all
      select target_id as page_id from public.hero_assignments
      where target_type = 'page' and is_active = true
    ) assignments
    group by page_id
  ), listed as (
    select p.id, p.title, p.slug, p.path, p.page_type, p.status,
      coalesce(ac.block_count, 0)::bigint as block_count
    from public.pages p
    left join assignment_counts ac on ac.page_id = p.id
  ), page_state as (
    select
      count(*)::bigint as total_count,
      greatest(1, least(p_page_size, 30)) as page_size
    from listed
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
      select jsonb_agg(to_jsonb(page_slice)) from (
        select listed.* from listed cross join normalized_state
        order by
          case when p_sort_field = 'title' and p_sort_direction = 'asc' then title end asc,
          case when p_sort_field = 'title' and p_sort_direction = 'desc' then title end desc,
          case when p_sort_field = 'status' and p_sort_direction = 'asc' then status end asc,
          case when p_sort_field = 'status' and p_sort_direction = 'desc' then status end desc,
          id asc
        limit (select page_size from normalized_state)
        offset ((select (page - 1) * page_size from normalized_state))
      ) page_slice
    ), '[]'::jsonb),
    'total_count', (select total_count from normalized_state),
    'page', (select page from normalized_state)
  );
$$;
