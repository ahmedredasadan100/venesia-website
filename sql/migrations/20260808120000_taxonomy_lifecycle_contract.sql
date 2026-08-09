begin;

-- Taxonomy lifecycle remains owned by the existing Content Taxonomy domain.
-- A row in Trash keeps its identity and slug reservation. No lifecycle
-- mutation moves, detaches, or cascades Topic relationships.

alter table public.topic_categories
  add column if not exists deleted_at timestamp with time zone;

create index if not exists topic_categories_deleted_at_idx
  on public.topic_categories using btree (deleted_at);

do $taxonomy_lifecycle_preflight$
begin
  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conname = 'topic_categories_slug_key'
      and constraint_record.conrelid = 'public.topic_categories'::regclass
      and constraint_record.contype = 'u'
  ) then
    raise exception using
      errcode = '42883',
      message = 'taxonomy lifecycle requires topic_categories_slug_key';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conname = 'topic_series_slug_key'
      and constraint_record.conrelid = 'public.topic_series'::regclass
      and constraint_record.contype = 'u'
  ) then
    raise exception using
      errcode = '42883',
      message = 'taxonomy lifecycle requires topic_series_slug_key';
  end if;
end;
$taxonomy_lifecycle_preflight$;

-- Retire the previous hard-delete RPCs so the lifecycle contract has one
-- mutation owner and no callable transfer/detach path remains.
drop function if exists public.admin_delete_topic_category(bigint, bigint, bigint);
drop function if exists public.admin_delete_topic_series(bigint[], bigint);

drop function if exists public.admin_list_categories(
  integer, integer, text, text, text, text
);

create function public.admin_list_categories(
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_field text default 'tree',
  p_sort_direction text default 'asc',
  p_search text default '',
  p_status text default 'all',
  p_view text default 'active'
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
  if p_page_size is null or p_page_size not in (10, 20, 30, 50) then
    raise exception using errcode = '22023', message = 'p_page_size must be one of 10, 20, 30, 50';
  end if;
  if p_sort_field is null or p_sort_field not in (
    'tree', 'name', 'count', 'status', 'id', 'parent', 'sort_order',
    'published_at', 'created_at', 'updated_at'
  ) then
    raise exception using errcode = '22023', message = 'p_sort_field is not supported';
  end if;
  if p_sort_direction is null or p_sort_direction not in ('asc', 'desc') then
    raise exception using errcode = '22023', message = 'p_sort_direction must be asc or desc';
  end if;
  if p_status is null or p_status not in ('all', 'published', 'unpublished') then
    raise exception using errcode = '22023', message = 'p_status is not supported';
  end if;
  if p_view is null or p_view not in ('active', 'trash') then
    raise exception using errcode = '22023', message = 'p_view must be active or trash';
  end if;

  return (
    with recursive
    topic_counts as (
      select topics.category_id, count(*)::bigint as own_count
      from public.topics topics
      where topics.category_id is not null
        and topics.deleted_at is null
      group by topics.category_id
    ),
    child_counts as (
      select children.parent_id, count(*)::bigint as child_count
      from public.topic_categories children
      where children.parent_id is not null
        and (
          (p_view = 'active' and children.deleted_at is null)
          or (p_view = 'trash' and children.deleted_at is not null)
        )
      group by children.parent_id
    ),
    active_parent_base as (
      select
        categories.id,
        categories.name,
        categories.parent_id,
        categories.sort_order
      from public.topic_categories categories
      where categories.deleted_at is null
    ),
    active_parent_tree as (
      select
        active_parent_base.*,
        0::integer as depth,
        array[active_parent_base.id]::bigint[] as ancestry,
        array[
          coalesce(active_parent_base.sort_order, 0)::bigint,
          active_parent_base.id
        ]::bigint[] as ascending_path
      from active_parent_base
      where active_parent_base.parent_id is null
         or not exists (
           select 1
           from active_parent_base parent
           where parent.id = active_parent_base.parent_id
         )

      union all

      select
        child.*,
        parent.depth + 1,
        parent.ancestry || child.id,
        parent.ascending_path || array[
          coalesce(child.sort_order, 0)::bigint,
          child.id
        ]::bigint[]
      from active_parent_tree parent
      join active_parent_base child on child.parent_id = parent.id
      where not child.id = any(parent.ancestry)
    ),
    active_parent_tree_complete as (
      select * from active_parent_tree

      union all

      select
        active_parent_base.*,
        0::integer as depth,
        array[active_parent_base.id]::bigint[] as ancestry,
        array[
          coalesce(active_parent_base.sort_order, 0)::bigint,
          active_parent_base.id
        ]::bigint[] as ascending_path
      from active_parent_base
      where not exists (
        select 1
        from active_parent_tree
        where active_parent_tree.id = active_parent_base.id
      )
    ),
    category_base as (
      select
        categories.id,
        categories.name,
        categories.slug,
        categories.description,
        categories.sort_order,
        categories.is_active,
        categories.parent_id,
        parent.name as parent_name,
        categories.status,
        categories.color_token,
        categories.published_at,
        categories.created_at,
        categories.updated_at,
        categories.deleted_at,
        coalesce(topic_counts.own_count, 0)::bigint as own_count,
        coalesce(child_counts.child_count, 0)::bigint as child_count
      from public.topic_categories categories
      left join public.topic_categories parent on parent.id = categories.parent_id
      left join topic_counts on topic_counts.category_id = categories.id
      left join child_counts on child_counts.parent_id = categories.id
      where (
        (p_view = 'active' and categories.deleted_at is null)
        or (p_view = 'trash' and categories.deleted_at is not null)
      )
    ),
    category_tree as (
      select
        category_base.*,
        0::integer as depth,
        array[category_base.id]::bigint[] as ancestry,
        array[
          coalesce(category_base.sort_order, 0)::bigint,
          category_base.id
        ]::bigint[] as ascending_path,
        array[
          -coalesce(category_base.sort_order, 0)::bigint,
          -category_base.id
        ]::bigint[] as descending_path
      from category_base
      where category_base.parent_id is null
         or not exists (
           select 1 from category_base parent where parent.id = category_base.parent_id
         )

      union all

      select
        child.*,
        parent.depth + 1,
        parent.ancestry || child.id,
        parent.ascending_path || array[
          coalesce(child.sort_order, 0)::bigint,
          child.id
        ]::bigint[],
        parent.descending_path || array[
          -coalesce(child.sort_order, 0)::bigint,
          -child.id
        ]::bigint[]
      from category_tree parent
      join category_base child on child.parent_id = parent.id
      where not child.id = any(parent.ancestry)
    ),
    category_tree_complete as (
      select * from category_tree

      union all

      select
        category_base.*,
        0::integer as depth,
        array[category_base.id]::bigint[] as ancestry,
        array[
          coalesce(category_base.sort_order, 0)::bigint,
          category_base.id
        ]::bigint[] as ascending_path,
        array[
          -coalesce(category_base.sort_order, 0)::bigint,
          -category_base.id
        ]::bigint[] as descending_path
      from category_base
      where not exists (
        select 1 from category_tree where category_tree.id = category_base.id
      )
    ),
    category_closure as (
      select
        category_base.id as ancestor_id,
        category_base.id as descendant_id,
        array[category_base.id]::bigint[] as ancestry
      from category_base

      union all

      select
        category_closure.ancestor_id,
        child.id,
        category_closure.ancestry || child.id
      from category_closure
      join category_base child on child.parent_id = category_closure.descendant_id
      where not child.id = any(category_closure.ancestry)
    ),
    category_totals as (
      select
        category_closure.ancestor_id,
        coalesce(sum(descendants.own_count), 0)::bigint as total_count
      from category_closure
      join category_base descendants on descendants.id = category_closure.descendant_id
      group by category_closure.ancestor_id
    ),
    listed as (
      select
        tree.id,
        tree.name,
        tree.slug,
        tree.description,
        tree.sort_order,
        tree.is_active,
        tree.parent_id,
        tree.parent_name,
        tree.status,
        tree.color_token,
        tree.published_at,
        tree.created_at,
        tree.updated_at,
        tree.deleted_at,
        tree.own_count as "ownCount",
        coalesce(category_totals.total_count, tree.own_count)::bigint as "totalCount",
        tree.depth,
        tree.child_count as "childCount",
        tree.ascending_path,
        tree.descending_path
      from category_tree_complete tree
      left join category_totals on category_totals.ancestor_id = tree.id
    ),
    matching_ids(id, parent_id) as (
      select listed.id, listed.parent_id
      from listed
      where (
          p_status = 'all'
          or (p_status = 'published' and listed.status = 'published')
          or (p_status = 'unpublished' and listed.status = 'unpublished')
        )
        and (
          nullif(btrim(coalesce(p_search, '')), '') is null
          or position(lower(btrim(p_search)) in lower(listed.name)) > 0
        )

      union

      select parent.id, parent.parent_id
      from listed parent
      join matching_ids child on child.parent_id = parent.id
    ),
    filtered as (
      select listed.*
      from listed
      join matching_ids on matching_ids.id = listed.id
    ),
    active_metrics as (
      select
        count(*)::bigint as total,
        count(*) filter (where categories.status = 'published')::bigint as published,
        coalesce(sum(coalesce(topic_counts.own_count, 0)), 0)::bigint as topics
      from public.topic_categories categories
      left join topic_counts on topic_counts.category_id = categories.id
      where categories.deleted_at is null
    ),
    page_state as (
      select count(*)::bigint as total_count, p_page_size as page_size
      from filtered
    ),
    normalized_state as (
      select
        total_count,
        page_size,
        least(
          p_page,
          greatest(1, ceil(total_count::numeric / page_size)::integer)
        ) as page
      from page_state
    )
    select jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(to_jsonb(category_slice))
        from (
          select
            filtered.id,
            filtered.name,
            filtered.slug,
            filtered.description,
            filtered.sort_order,
            filtered.is_active,
            filtered.parent_id,
            filtered.parent_name,
            filtered.status,
            filtered.color_token,
            filtered.published_at,
            filtered.created_at,
            filtered.updated_at,
            filtered.deleted_at,
            filtered."ownCount",
            filtered."totalCount",
            filtered.depth,
            filtered."childCount"
          from filtered
          cross join normalized_state
          order by
            case when p_sort_field = 'tree' and p_sort_direction = 'asc' then filtered.ascending_path end asc,
            case when p_sort_field = 'tree' and p_sort_direction = 'desc' then filtered.descending_path end asc,
            case when p_sort_field = 'name' and p_sort_direction = 'asc' then filtered.name end asc,
            case when p_sort_field = 'name' and p_sort_direction = 'desc' then filtered.name end desc,
            case when p_sort_field = 'count' and p_sort_direction = 'asc' then filtered."totalCount" end asc,
            case when p_sort_field = 'count' and p_sort_direction = 'desc' then filtered."totalCount" end desc,
            case when p_sort_field = 'status' and p_sort_direction = 'asc' then filtered.status end asc,
            case when p_sort_field = 'status' and p_sort_direction = 'desc' then filtered.status end desc,
            case when p_sort_field = 'id' and p_sort_direction = 'asc' then filtered.id end asc,
            case when p_sort_field = 'id' and p_sort_direction = 'desc' then filtered.id end desc,
            case when p_sort_field = 'parent' and p_sort_direction = 'asc' then coalesce(filtered.parent_name, '') end asc,
            case when p_sort_field = 'parent' and p_sort_direction = 'desc' then coalesce(filtered.parent_name, '') end desc,
            case when p_sort_field = 'sort_order' and p_sort_direction = 'asc' then coalesce(filtered.sort_order, 0) end asc,
            case when p_sort_field = 'sort_order' and p_sort_direction = 'desc' then coalesce(filtered.sort_order, 0) end desc,
            case when p_sort_field = 'published_at' and p_sort_direction = 'asc' then filtered.published_at end asc nulls last,
            case when p_sort_field = 'published_at' and p_sort_direction = 'desc' then filtered.published_at end desc nulls last,
            case when p_sort_field = 'created_at' and p_sort_direction = 'asc' then filtered.created_at end asc,
            case when p_sort_field = 'created_at' and p_sort_direction = 'desc' then filtered.created_at end desc,
            case when p_sort_field = 'updated_at' and p_sort_direction = 'asc' then filtered.updated_at end asc,
            case when p_sort_field = 'updated_at' and p_sort_direction = 'desc' then filtered.updated_at end desc,
            filtered.ascending_path asc
          limit (select page_size from normalized_state)
          offset ((select (page - 1) * page_size from normalized_state))
        ) category_slice
      ), '[]'::jsonb),
      'total_count', (select total_count from normalized_state),
      'page', (select page from normalized_state),
      'metrics', jsonb_build_object(
        'parentOptions', coalesce((
          select jsonb_agg(
            jsonb_build_object(
               'id', categories.id,
               'name', categories.name,
               'level', categories.depth
             )
             order by categories.ascending_path
           )
           from active_parent_tree_complete categories
         ), '[]'::jsonb),
        'total', (select total from active_metrics),
        'published', (select published from active_metrics),
        'unpublished', (select total - published from active_metrics),
        'topics', (select topics from active_metrics),
        'series', (select count(*)::bigint from public.topic_series where deleted_at is null),
        'trashed', (select count(*)::bigint from public.topic_categories where deleted_at is not null)
      )
    )
  );
end;
$$;

drop function if exists public.admin_list_series(
  integer, integer, text, text, text, text, bigint
);

create function public.admin_list_series(
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_field text default 'name',
  p_sort_direction text default 'asc',
  p_search text default '',
  p_status text default 'all',
  p_category_id bigint default null,
  p_view text default 'active'
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
  if p_page_size is null or p_page_size not in (10, 20, 30, 50) then
    raise exception using errcode = '22023', message = 'p_page_size must be one of 10, 20, 30, 50';
  end if;
  if p_sort_field is null or p_sort_field not in (
    'name', 'topics_count', 'status', 'id', 'slug', 'category',
    'sort_order', 'created_at', 'updated_at'
  ) then
    raise exception using errcode = '22023', message = 'p_sort_field is not supported';
  end if;
  if p_sort_direction is null or p_sort_direction not in ('asc', 'desc') then
    raise exception using errcode = '22023', message = 'p_sort_direction must be asc or desc';
  end if;
  if p_status is null or p_status not in ('all', 'published', 'unpublished') then
    raise exception using errcode = '22023', message = 'p_status is not supported';
  end if;
  if p_category_id is not null and p_category_id <= 0 then
    raise exception using errcode = '22023', message = 'p_category_id must be a positive integer or null';
  end if;
  if p_view is null or p_view not in ('active', 'trash') then
    raise exception using errcode = '22023', message = 'p_view must be active or trash';
  end if;

  return (
    with recursive
    category_base as (
      select
        categories.id,
        categories.name,
        categories.parent_id,
        categories.sort_order
      from public.topic_categories categories
      where categories.deleted_at is null
    ),
    category_tree as (
      select
        category_base.*,
        0::integer as depth,
        array[category_base.id]::bigint[] as ancestry,
        array[
          coalesce(category_base.sort_order, 0)::bigint,
          category_base.id
        ]::bigint[] as ascending_path
      from category_base
      where category_base.parent_id is null
         or not exists (
           select 1 from category_base parent where parent.id = category_base.parent_id
         )

      union all

      select
        child.*,
        parent.depth + 1,
        parent.ancestry || child.id,
        parent.ascending_path || array[
          coalesce(child.sort_order, 0)::bigint,
          child.id
        ]::bigint[]
      from category_tree parent
      join category_base child on child.parent_id = parent.id
      where not child.id = any(parent.ancestry)
    ),
    category_tree_complete as (
      select * from category_tree

      union all

      select
        category_base.*,
        0::integer as depth,
        array[category_base.id]::bigint[] as ancestry,
        array[
          coalesce(category_base.sort_order, 0)::bigint,
          category_base.id
        ]::bigint[] as ascending_path
      from category_base
      where not exists (
        select 1 from category_tree where category_tree.id = category_base.id
      )
    ),
    category_descendants as (
      select
        category_base.id as ancestor_id,
        category_base.id as descendant_id,
        array[category_base.id]::bigint[] as ancestry
      from category_base

      union all

      select
        category_descendants.ancestor_id,
        child.id,
        category_descendants.ancestry || child.id
      from category_descendants
      join category_base child on child.parent_id = category_descendants.descendant_id
      where not child.id = any(category_descendants.ancestry)
    ),
    topic_counts as (
      select topics.series_id, count(*)::bigint as topics_count
      from public.topics topics
      where topics.series_id is not null
        and topics.deleted_at is null
      group by topics.series_id
    ),
    series_base as (
      select
        series.id,
        series.name,
        series.slug,
        series.status,
        series.sort_order,
        series.category_id,
        categories.name as category_name,
        series.created_at,
        series.updated_at,
        series.deleted_at,
        coalesce(topic_counts.topics_count, 0)::bigint as topics_count
      from public.topic_series series
      left join public.topic_categories categories on categories.id = series.category_id
      left join topic_counts on topic_counts.series_id = series.id
      where (
        (p_view = 'active' and series.deleted_at is null)
        or (p_view = 'trash' and series.deleted_at is not null)
      )
    ),
    filtered as (
      select series_base.*
      from series_base
      where (
          p_status = 'all'
          or series_base.status = p_status
        )
        and (
          p_category_id is null
          or exists (
            select 1
            from category_descendants
            where category_descendants.ancestor_id = p_category_id
              and category_descendants.descendant_id = series_base.category_id
          )
        )
        and (
          nullif(btrim(coalesce(p_search, '')), '') is null
          or position(lower(btrim(p_search)) in lower(series_base.name)) > 0
          or position(lower(btrim(p_search)) in lower(series_base.slug)) > 0
        )
    ),
    active_metrics as (
      select
        count(*)::bigint as total,
        count(*) filter (where series.status = 'published')::bigint as published,
        coalesce(sum(coalesce(topic_counts.topics_count, 0)), 0)::bigint as topics
      from public.topic_series series
      left join topic_counts on topic_counts.series_id = series.id
      where series.deleted_at is null
    ),
    page_state as (
      select count(*)::bigint as total_count, p_page_size as page_size
      from filtered
    ),
    normalized_state as (
      select
        total_count,
        page_size,
        least(
          p_page,
          greatest(1, ceil(total_count::numeric / page_size)::integer)
        ) as page
      from page_state
    )
    select jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(to_jsonb(series_slice))
        from (
          select
            filtered.id,
            filtered.name,
            filtered.slug,
            filtered.status,
            filtered.sort_order,
            filtered.category_id,
            filtered.category_name,
            filtered.created_at,
            filtered.updated_at,
            filtered.deleted_at,
            filtered.topics_count
          from filtered
          cross join normalized_state
          order by
            case when p_sort_field = 'name' and p_sort_direction = 'asc' then filtered.name end asc,
            case when p_sort_field = 'name' and p_sort_direction = 'desc' then filtered.name end desc,
            case when p_sort_field = 'topics_count' and p_sort_direction = 'asc' then filtered.topics_count end asc,
            case when p_sort_field = 'topics_count' and p_sort_direction = 'desc' then filtered.topics_count end desc,
            case when p_sort_field = 'status' and p_sort_direction = 'asc' then filtered.status end asc,
            case when p_sort_field = 'status' and p_sort_direction = 'desc' then filtered.status end desc,
            case when p_sort_field = 'id' and p_sort_direction = 'asc' then filtered.id end asc,
            case when p_sort_field = 'id' and p_sort_direction = 'desc' then filtered.id end desc,
            case when p_sort_field = 'slug' and p_sort_direction = 'asc' then filtered.slug end asc,
            case when p_sort_field = 'slug' and p_sort_direction = 'desc' then filtered.slug end desc,
            case when p_sort_field = 'category' and p_sort_direction = 'asc' then coalesce(filtered.category_name, '') end asc,
            case when p_sort_field = 'category' and p_sort_direction = 'desc' then coalesce(filtered.category_name, '') end desc,
            case when p_sort_field = 'sort_order' and p_sort_direction = 'asc' then coalesce(filtered.sort_order, 0) end asc,
            case when p_sort_field = 'sort_order' and p_sort_direction = 'desc' then coalesce(filtered.sort_order, 0) end desc,
            case when p_sort_field = 'created_at' and p_sort_direction = 'asc' then filtered.created_at end asc,
            case when p_sort_field = 'created_at' and p_sort_direction = 'desc' then filtered.created_at end desc,
            case when p_sort_field = 'updated_at' and p_sort_direction = 'asc' then filtered.updated_at end asc,
            case when p_sort_field = 'updated_at' and p_sort_direction = 'desc' then filtered.updated_at end desc,
            filtered.id asc
          limit (select page_size from normalized_state)
          offset ((select (page - 1) * page_size from normalized_state))
        ) series_slice
      ), '[]'::jsonb),
      'total_count', (select total_count from normalized_state),
      'page', (select page from normalized_state),
      'metrics', jsonb_build_object(
        'total', (select total from active_metrics),
        'published', (select published from active_metrics),
        'unpublished', (select total - published from active_metrics),
        'topics', (select topics from active_metrics),
        'averageTopics', (select case when total = 0 then 0 else round(topics::numeric / total, 1) end from active_metrics),
        'trashed', (select count(*)::bigint from public.topic_series where deleted_at is not null),
        'categoryOptions', coalesce((
          select jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'value', category_tree_complete.id::text,
              'label', category_tree_complete.name,
              'depth', category_tree_complete.depth,
              'parentValue', category_tree_complete.parent_id::text
            ))
            order by category_tree_complete.ascending_path
          )
          from category_tree_complete
        ), '[]'::jsonb),
        'categoryDescendantIdsByValue', coalesce((
          select jsonb_object_agg(
            descendants.ancestor_id::text,
            descendants.descendant_ids
          )
          from (
            select
              category_descendants.ancestor_id,
              jsonb_agg(
                category_descendants.descendant_id
                order by
                  case
                    when category_descendants.descendant_id = category_descendants.ancestor_id then 0
                    else 1
                  end,
                  category_descendants.descendant_id
              ) as descendant_ids
            from category_descendants
            group by category_descendants.ancestor_id
          ) descendants
        ), '{}'::jsonb)
      )
    )
  );
end;
$$;

create or replace function public.admin_move_topic_categories_to_trash(
  p_category_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_found_count integer := 0;
  v_affected_ids bigint[];
begin
  if p_category_ids is null
     or cardinality(p_category_ids) = 0
     or exists (
       select 1 from unnest(p_category_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'category ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_ids
  from unnest(p_category_ids) requested(id);

  lock table public.topic_categories in share row exclusive mode;

  perform 1
  from public.topic_categories categories
  where categories.id = any(v_ids)
    and categories.deleted_at is null
  order by categories.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_ids) then
    raise exception using errcode = 'P0002', message = 'one or more categories are not active';
  end if;

  if exists (
    select 1
    from public.topics topics
    join public.topic_categories categories
      on categories.id = any(v_ids)
     and (
       topics.category_id = categories.id
       or (topics.category_id is null and topics.category_slug = categories.slug)
     )
  ) then
    raise exception using errcode = '23503', message = 'categories still have linked topics';
  end if;
  if exists (
    select 1 from public.topic_series series where series.category_id = any(v_ids)
  ) then
    raise exception using errcode = '23503', message = 'categories still have linked series';
  end if;
  if exists (
    select 1
    from public.topic_categories child
    where child.parent_id = any(v_ids)
      and not child.id = any(v_ids)
  ) then
    raise exception using errcode = '23503', message = 'categories still have child categories';
  end if;

  with updated as (
    update public.topic_categories categories
    set
      status = 'unpublished',
      is_active = false,
      deleted_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where categories.id = any(v_ids)
      and categories.deleted_at is null
    returning categories.id
  )
  select array_agg(updated.id order by updated.id) into v_affected_ids from updated;

  return jsonb_build_object(
    'affected_ids', to_jsonb(coalesce(v_affected_ids, array[]::bigint[])),
    'affected_count', coalesce(cardinality(v_affected_ids), 0)
  );
end;
$$;

create or replace function public.admin_restore_topic_categories(
  p_category_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_found_count integer := 0;
  v_affected_ids bigint[];
begin
  if p_category_ids is null
     or cardinality(p_category_ids) = 0
     or exists (
       select 1 from unnest(p_category_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'category ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_ids
  from unnest(p_category_ids) requested(id);

  lock table public.topic_categories in share row exclusive mode;

  perform 1
  from public.topic_categories categories
  where categories.id = any(v_ids)
    and categories.deleted_at is not null
  order by categories.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_ids) then
    raise exception using errcode = 'P0002', message = 'one or more categories are not in trash';
  end if;

  if exists (
    select 1
    from public.topic_categories deleted_category
    join public.topic_categories active_category
      on active_category.slug = deleted_category.slug
     and active_category.id <> deleted_category.id
     and active_category.deleted_at is null
    where deleted_category.id = any(v_ids)
  ) then
    raise exception using errcode = '23505', message = 'category restore slug conflict';
  end if;

  if exists (
    select 1
    from public.topic_categories category
    left join public.topic_categories parent on parent.id = category.parent_id
    where category.id = any(v_ids)
      and category.parent_id is not null
      and (
        parent.id is null
        or (parent.deleted_at is not null and not parent.id = any(v_ids))
      )
  ) then
    raise exception using errcode = '23503', message = 'category restore parent is unavailable';
  end if;

  with updated as (
    update public.topic_categories categories
    set
      status = 'unpublished',
      is_active = false,
      deleted_at = null,
      updated_at = statement_timestamp()
    where categories.id = any(v_ids)
      and categories.deleted_at is not null
    returning categories.id
  )
  select array_agg(updated.id order by updated.id) into v_affected_ids from updated;

  return jsonb_build_object(
    'affected_ids', to_jsonb(coalesce(v_affected_ids, array[]::bigint[])),
    'affected_count', coalesce(cardinality(v_affected_ids), 0)
  );
end;
$$;

create or replace function public.admin_permanently_delete_topic_categories(
  p_category_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_found_count integer := 0;
  v_affected_ids bigint[];
begin
  if p_category_ids is null
     or cardinality(p_category_ids) = 0
     or exists (
       select 1 from unnest(p_category_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'category ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_ids
  from unnest(p_category_ids) requested(id);

  lock table public.topic_categories in share row exclusive mode;

  perform 1
  from public.topic_categories categories
  where categories.id = any(v_ids)
    and categories.deleted_at is not null
  order by categories.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_ids) then
    raise exception using errcode = 'P0002', message = 'one or more categories are not in trash';
  end if;

  if exists (
    select 1
    from public.topics topics
    join public.topic_categories categories
      on categories.id = any(v_ids)
     and (
       topics.category_id = categories.id
       or (topics.category_id is null and topics.category_slug = categories.slug)
     )
  ) then
    raise exception using errcode = '23503', message = 'categories still have linked topics';
  end if;
  if exists (
    select 1 from public.topic_series series where series.category_id = any(v_ids)
  ) then
    raise exception using errcode = '23503', message = 'categories still have linked series';
  end if;
  if exists (
    select 1
    from public.topic_categories child
    where child.parent_id = any(v_ids)
      and not child.id = any(v_ids)
  ) then
    raise exception using errcode = '23503', message = 'categories still have child categories';
  end if;

  with deleted as (
    delete from public.topic_categories categories
    where categories.id = any(v_ids)
      and categories.deleted_at is not null
    returning categories.id
  )
  select array_agg(deleted.id order by deleted.id) into v_affected_ids from deleted;

  return jsonb_build_object(
    'affected_ids', to_jsonb(coalesce(v_affected_ids, array[]::bigint[])),
    'affected_count', coalesce(cardinality(v_affected_ids), 0)
  );
end;
$$;

create or replace function public.admin_move_topic_series_to_trash(
  p_series_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_found_count integer := 0;
  v_affected_ids bigint[];
begin
  if p_series_ids is null
     or cardinality(p_series_ids) = 0
     or exists (
       select 1 from unnest(p_series_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'series ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_ids
  from unnest(p_series_ids) requested(id);

  perform 1
  from public.topic_series series
  where series.id = any(v_ids)
    and series.deleted_at is null
  order by series.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_ids) then
    raise exception using errcode = 'P0002', message = 'one or more series are not active';
  end if;

  if exists (
    select 1
    from public.topics topics
    join public.topic_series series
      on series.id = any(v_ids)
     and (
       topics.series_id = series.id
       or (topics.series_id is null and topics.series_slug = series.slug)
     )
  ) then
    raise exception using errcode = '23503', message = 'series still have linked topics';
  end if;

  with updated as (
    update public.topic_series series
    set
      status = 'unpublished',
      deleted_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where series.id = any(v_ids)
      and series.deleted_at is null
    returning series.id
  )
  select array_agg(updated.id order by updated.id) into v_affected_ids from updated;

  return jsonb_build_object(
    'affected_ids', to_jsonb(coalesce(v_affected_ids, array[]::bigint[])),
    'affected_count', coalesce(cardinality(v_affected_ids), 0)
  );
end;
$$;

create or replace function public.admin_restore_topic_series(
  p_series_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_found_count integer := 0;
  v_affected_ids bigint[];
begin
  if p_series_ids is null
     or cardinality(p_series_ids) = 0
     or exists (
       select 1 from unnest(p_series_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'series ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_ids
  from unnest(p_series_ids) requested(id);

  perform 1
  from public.topic_series series
  where series.id = any(v_ids)
    and series.deleted_at is not null
  order by series.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_ids) then
    raise exception using errcode = 'P0002', message = 'one or more series are not in trash';
  end if;

  if exists (
    select 1
    from public.topic_series deleted_series
    join public.topic_series active_series
      on active_series.slug = deleted_series.slug
     and active_series.id <> deleted_series.id
     and active_series.deleted_at is null
    where deleted_series.id = any(v_ids)
  ) then
    raise exception using errcode = '23505', message = 'series restore slug conflict';
  end if;

  if exists (
    select 1
    from public.topic_series series
    left join public.topic_categories categories on categories.id = series.category_id
    where series.id = any(v_ids)
      and (categories.id is null or categories.deleted_at is not null)
  ) then
    raise exception using errcode = '23503', message = 'series restore category is unavailable';
  end if;

  with updated as (
    update public.topic_series series
    set
      status = 'unpublished',
      deleted_at = null,
      updated_at = statement_timestamp()
    where series.id = any(v_ids)
      and series.deleted_at is not null
    returning series.id
  )
  select array_agg(updated.id order by updated.id) into v_affected_ids from updated;

  return jsonb_build_object(
    'affected_ids', to_jsonb(coalesce(v_affected_ids, array[]::bigint[])),
    'affected_count', coalesce(cardinality(v_affected_ids), 0)
  );
end;
$$;

create or replace function public.admin_permanently_delete_topic_series(
  p_series_ids bigint[],
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_found_count integer := 0;
  v_affected_ids bigint[];
begin
  if p_series_ids is null
     or cardinality(p_series_ids) = 0
     or exists (
       select 1 from unnest(p_series_ids) requested(id)
       where requested.id is null or requested.id <= 0
     ) then
    raise exception using errcode = '22023', message = 'series ids are invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select array_agg(distinct requested.id order by requested.id)
  into v_ids
  from unnest(p_series_ids) requested(id);

  perform 1
  from public.topic_series series
  where series.id = any(v_ids)
    and series.deleted_at is not null
  order by series.id
  for update;
  get diagnostics v_found_count = row_count;

  if v_found_count <> cardinality(v_ids) then
    raise exception using errcode = 'P0002', message = 'one or more series are not in trash';
  end if;

  if exists (
    select 1
    from public.topics topics
    join public.topic_series series
      on series.id = any(v_ids)
     and (
       topics.series_id = series.id
       or (topics.series_id is null and topics.series_slug = series.slug)
     )
  ) then
    raise exception using errcode = '23503', message = 'series still have linked topics';
  end if;

  with deleted as (
    delete from public.topic_series series
    where series.id = any(v_ids)
      and series.deleted_at is not null
    returning series.id
  )
  select array_agg(deleted.id order by deleted.id) into v_affected_ids from deleted;

  return jsonb_build_object(
    'affected_ids', to_jsonb(coalesce(v_affected_ids, array[]::bigint[])),
    'affected_count', coalesce(cardinality(v_affected_ids), 0)
  );
end;
$$;

revoke all on function public.admin_list_categories(
  integer, integer, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_list_categories(
  integer, integer, text, text, text, text, text
) to service_role;

revoke all on function public.admin_list_series(
  integer, integer, text, text, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.admin_list_series(
  integer, integer, text, text, text, text, bigint, text
) to service_role;

revoke all on function public.admin_move_topic_categories_to_trash(bigint[], bigint)
  from public, anon, authenticated;
grant execute on function public.admin_move_topic_categories_to_trash(bigint[], bigint)
  to service_role;
revoke all on function public.admin_restore_topic_categories(bigint[], bigint)
  from public, anon, authenticated;
grant execute on function public.admin_restore_topic_categories(bigint[], bigint)
  to service_role;
revoke all on function public.admin_permanently_delete_topic_categories(bigint[], bigint)
  from public, anon, authenticated;
grant execute on function public.admin_permanently_delete_topic_categories(bigint[], bigint)
  to service_role;
revoke all on function public.admin_move_topic_series_to_trash(bigint[], bigint)
  from public, anon, authenticated;
grant execute on function public.admin_move_topic_series_to_trash(bigint[], bigint)
  to service_role;
revoke all on function public.admin_restore_topic_series(bigint[], bigint)
  from public, anon, authenticated;
grant execute on function public.admin_restore_topic_series(bigint[], bigint)
  to service_role;
revoke all on function public.admin_permanently_delete_topic_series(bigint[], bigint)
  from public, anon, authenticated;
grant execute on function public.admin_permanently_delete_topic_series(bigint[], bigint)
  to service_role;

comment on column public.topic_categories.deleted_at is
  'Taxonomy lifecycle tombstone. The canonical slug remains reserved until permanent deletion.';
comment on function public.admin_move_topic_categories_to_trash(bigint[], bigint) is
  'Atomic Category soft delete. Linked Topics, Series, and unselected child Categories block the mutation.';
comment on function public.admin_restore_topic_categories(bigint[], bigint) is
  'Atomic Category restore to unpublished after slug and parent validation.';
comment on function public.admin_permanently_delete_topic_categories(bigint[], bigint) is
  'Atomic Category permanent delete restricted to Trash and blocked by live domain relationships.';
comment on function public.admin_move_topic_series_to_trash(bigint[], bigint) is
  'Atomic Series soft delete. Any linked Topic blocks the mutation.';
comment on function public.admin_restore_topic_series(bigint[], bigint) is
  'Atomic Series restore to unpublished after slug and Category validation.';
comment on function public.admin_permanently_delete_topic_series(bigint[], bigint) is
  'Atomic Series permanent delete restricted to Trash and blocked by linked Topics.';

commit;
