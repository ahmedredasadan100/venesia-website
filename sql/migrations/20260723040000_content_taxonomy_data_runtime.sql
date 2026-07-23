-- Content Taxonomy System: database-owned list snapshots and atomic taxonomy writes.
-- Additive only. This migration must not be applied to Production without the
-- migration-specific approval and verification gate documented by the project.

begin;

create or replace function public.admin_list_categories(
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_field text default 'tree',
  p_sort_direction text default 'asc',
  p_search text default '',
  p_status text default 'all'
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
    'created_at', 'updated_at'
  ) then
    raise exception using errcode = '22023', message = 'p_sort_field is not supported';
  end if;
  if p_sort_direction is null or p_sort_direction not in ('asc', 'desc') then
    raise exception using errcode = '22023', message = 'p_sort_direction must be asc or desc';
  end if;
  if p_status is null or p_status not in ('all', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'p_status is not supported';
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
      group by children.parent_id
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
        categories.created_at,
        categories.updated_at,
        coalesce(topic_counts.own_count, 0)::bigint as own_count,
        coalesce(child_counts.child_count, 0)::bigint as child_count
      from public.topic_categories categories
      left join public.topic_categories parent on parent.id = categories.parent_id
      left join topic_counts on topic_counts.category_id = categories.id
      left join child_counts on child_counts.parent_id = categories.id
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

      -- Keep corrupt legacy cycles visible as independent roots. New cycles are
      -- rejected by admin_update_topic_category below.
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
        tree.created_at,
        tree.updated_at,
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
          or (p_status = 'published' and listed.is_active is true)
          or (p_status = 'hidden' and listed.is_active is not true)
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
    metrics as (
      select
        count(*)::bigint as total,
        count(*) filter (where category_base.is_active is true)::bigint as published,
        coalesce(sum(category_base.own_count), 0)::bigint as topics
      from category_base
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
            filtered.created_at,
            filtered.updated_at,
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
            case when p_sort_field = 'status' and p_sort_direction = 'asc' then coalesce(filtered.is_active, false) end asc,
            case when p_sort_field = 'status' and p_sort_direction = 'desc' then coalesce(filtered.is_active, false) end desc,
            case when p_sort_field = 'id' and p_sort_direction = 'asc' then filtered.id end asc,
            case when p_sort_field = 'id' and p_sort_direction = 'desc' then filtered.id end desc,
            case when p_sort_field = 'parent' and p_sort_direction = 'asc' then coalesce(filtered.parent_name, '') end asc,
            case when p_sort_field = 'parent' and p_sort_direction = 'desc' then coalesce(filtered.parent_name, '') end desc,
            case when p_sort_field = 'sort_order' and p_sort_direction = 'asc' then coalesce(filtered.sort_order, 0) end asc,
            case when p_sort_field = 'sort_order' and p_sort_direction = 'desc' then coalesce(filtered.sort_order, 0) end desc,
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
              'id', category_tree_complete.id,
              'name', category_tree_complete.name,
              'level', category_tree_complete.depth
            )
            order by category_tree_complete.ascending_path
          )
          from category_tree_complete
        ), '[]'::jsonb),
        'total', (select total from metrics),
        'published', (select published from metrics),
        'topics', (select topics from metrics)
      )
    )
  );
end;
$$;

create or replace function public.admin_list_series(
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_field text default 'name',
  p_sort_direction text default 'asc',
  p_search text default '',
  p_status text default 'all',
  p_category_id bigint default null
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
  if p_status is null or p_status not in (
    'all', 'published', 'unpublished', 'draft', 'archived'
  ) then
    raise exception using errcode = '22023', message = 'p_status is not supported';
  end if;
  if p_category_id is not null and p_category_id <= 0 then
    raise exception using errcode = '22023', message = 'p_category_id must be a positive integer or null';
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
        coalesce(topic_counts.topics_count, 0)::bigint as topics_count
      from public.topic_series series
      left join public.topic_categories categories on categories.id = series.category_id
      left join topic_counts on topic_counts.series_id = series.id
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
    metrics as (
      select
        count(*)::bigint as total,
        count(*) filter (where series_base.status = 'published')::bigint as published,
        coalesce(sum(series_base.topics_count), 0)::bigint as topics
      from series_base
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
        'total', (select total from metrics),
        'published', (select published from metrics),
        'topics', (select topics from metrics),
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

create or replace function public.admin_update_topic_category(
  p_category_id bigint,
  p_name text,
  p_parent_id bigint,
  p_is_active boolean,
  p_color_token text,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category record;
  v_topics_updated integer := 0;
begin
  if p_category_id is null or p_category_id <= 0 then
    raise exception using errcode = '22023', message = 'category id is invalid';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '22023', message = 'category name is required';
  end if;
  if p_is_active is null then
    raise exception using errcode = '22023', message = 'category active state is required';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  -- Hierarchy mutations are rare and short. Serializing category writes makes
  -- cycle validation and delete dependency checks race-safe.
  lock table public.topic_categories in share row exclusive mode;

  select
    categories.id,
    categories.name,
    categories.slug,
    categories.parent_id,
    categories.is_active,
    categories.status,
    categories.color_token,
    categories.updated_at
  into v_category
  from public.topic_categories categories
  where categories.id = p_category_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'category was not found';
  end if;

  if p_parent_id is not null then
    if p_parent_id <= 0 or p_parent_id = p_category_id then
      raise exception using errcode = '22023', message = 'category parent is invalid';
    end if;
    if not exists (
      select 1 from public.topic_categories where id = p_parent_id
    ) then
      raise exception using errcode = '23503', message = 'category parent was not found';
    end if;
    if exists (
      with recursive descendants as (
        select
          child.id,
          array[p_category_id, child.id]::bigint[] as ancestry
        from public.topic_categories child
        where child.parent_id = p_category_id

        union all

        select
          child.id,
          descendants.ancestry || child.id
        from descendants
        join public.topic_categories child on child.parent_id = descendants.id
        where not child.id = any(descendants.ancestry)
      )
      select 1 from descendants where descendants.id = p_parent_id
    ) then
      raise exception using errcode = '22023', message = 'category parent would create a hierarchy cycle';
    end if;
  end if;

  update public.topic_categories categories
  set
    name = btrim(p_name),
    parent_id = p_parent_id,
    is_active = p_is_active,
    status = case when p_is_active then 'published' else 'draft' end,
    color_token = coalesce(nullif(btrim(p_color_token), ''), categories.color_token),
    updated_at = now()
  where categories.id = p_category_id
  returning
    categories.id,
    categories.name,
    categories.slug,
    categories.parent_id,
    categories.is_active,
    categories.status,
    categories.color_token,
    categories.updated_at
  into v_category;

  update public.topics topics
  set
    category_id = v_category.id,
    category = v_category.name,
    category_slug = v_category.slug,
    updated_at = v_category.updated_at,
    updated_by = p_actor_id
  where topics.category_id = v_category.id
     or (
       topics.category_id is null
       and topics.category_slug = v_category.slug
     );
  get diagnostics v_topics_updated = row_count;

  return jsonb_build_object(
    'category', to_jsonb(v_category),
    'topics_updated', v_topics_updated
  );
end;
$$;

create or replace function public.admin_delete_topic_category(
  p_category_id bigint,
  p_transfer_to_id bigint,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source record;
  v_target record;
  v_topic_count bigint := 0;
  v_topics_updated integer := 0;
  v_applied_transfer_id bigint := null;
begin
  if p_category_id is null or p_category_id <= 0 then
    raise exception using errcode = '22023', message = 'category id is invalid';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  lock table public.topic_categories in share row exclusive mode;

  select categories.id, categories.name, categories.slug
  into v_source
  from public.topic_categories categories
  where categories.id = p_category_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'category was not found';
  end if;

  if exists (
    select 1 from public.topic_series series where series.category_id = v_source.id
  ) then
    raise exception using errcode = '23503', message = 'category still has linked series';
  end if;
  if exists (
    select 1 from public.topic_categories child where child.parent_id = v_source.id
  ) then
    raise exception using errcode = '23503', message = 'category still has child categories';
  end if;

  select count(*)::bigint
  into v_topic_count
  from public.topics topics
  where topics.category_id = v_source.id
     or (
       topics.category_id is null
       and topics.category_slug = v_source.slug
     );

  if v_topic_count > 0 then
    if p_transfer_to_id is null or p_transfer_to_id <= 0 or p_transfer_to_id = v_source.id then
      raise exception using errcode = '22023', message = 'a valid transfer category is required';
    end if;

    select categories.id, categories.name, categories.slug
    into v_target
    from public.topic_categories categories
    where categories.id = p_transfer_to_id
    for update;

    if not found then
      raise exception using errcode = '23503', message = 'transfer category was not found';
    end if;

    update public.topics topics
    set
      category_id = v_target.id,
      category = v_target.name,
      category_slug = v_target.slug,
      updated_at = now(),
      updated_by = p_actor_id
    where topics.category_id = v_source.id
       or (
         topics.category_id is null
         and topics.category_slug = v_source.slug
       );
    get diagnostics v_topics_updated = row_count;
    v_applied_transfer_id := v_target.id;
  end if;

  delete from public.topic_categories categories
  where categories.id = v_source.id;

  return jsonb_build_object(
    'deleted_category_id', v_source.id,
    'transfer_to_id', v_applied_transfer_id,
    'topics_updated', v_topics_updated
  );
end;
$$;

create or replace function public.admin_update_topic_series(
  p_series_id bigint,
  p_name text,
  p_category_id bigint,
  p_status text,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_series record;
  v_topics_updated integer := 0;
begin
  if p_series_id is null or p_series_id <= 0 then
    raise exception using errcode = '22023', message = 'series id is invalid';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '22023', message = 'series name is required';
  end if;
  if p_category_id is null or p_category_id <= 0 then
    raise exception using errcode = '22023', message = 'series category is required';
  end if;
  if p_status is null or p_status not in ('draft', 'published', 'unpublished', 'archived') then
    raise exception using errcode = '22023', message = 'series status is not supported';
  end if;
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.admin_users where id = p_actor_id
  ) then
    raise exception using errcode = '23503', message = 'admin actor is invalid';
  end if;

  select
    series.id,
    series.name,
    series.slug,
    series.category_id,
    series.status,
    series.deleted_at,
    series.updated_at
  into v_series
  from public.topic_series series
  where series.id = p_series_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'series was not found';
  end if;

  perform 1
  from public.topic_categories categories
  where categories.id = p_category_id
    and (
      categories.is_active is not false
      or categories.id = v_series.category_id
    )
  for key share;

  if not found then
    raise exception using errcode = '23503', message = 'active series category was not found';
  end if;

  update public.topic_series series
  set
    name = btrim(p_name),
    category_id = p_category_id,
    status = p_status,
    deleted_at = case
      when p_status = 'archived' then coalesce(series.deleted_at, now())
      else null
    end,
    updated_at = now()
  where series.id = p_series_id
  returning
    series.id,
    series.name,
    series.slug,
    series.category_id,
    series.status,
    series.deleted_at,
    series.updated_at
  into v_series;

  update public.topics topics
  set
    series = v_series.name,
    series_slug = v_series.slug,
    updated_at = v_series.updated_at,
    updated_by = p_actor_id
  where topics.series_id = v_series.id;
  get diagnostics v_topics_updated = row_count;

  return jsonb_build_object(
    'series', to_jsonb(v_series),
    'topics_updated', v_topics_updated
  );
end;
$$;

revoke all on function public.admin_list_categories(
  integer, integer, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_list_categories(
  integer, integer, text, text, text, text
) to service_role;

revoke all on function public.admin_list_series(
  integer, integer, text, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.admin_list_series(
  integer, integer, text, text, text, text, bigint
) to service_role;

revoke all on function public.admin_update_topic_category(
  bigint, text, bigint, boolean, text, bigint
) from public, anon, authenticated;
grant execute on function public.admin_update_topic_category(
  bigint, text, bigint, boolean, text, bigint
) to service_role;

revoke all on function public.admin_delete_topic_category(
  bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.admin_delete_topic_category(
  bigint, bigint, bigint
) to service_role;

revoke all on function public.admin_update_topic_series(
  bigint, text, bigint, text, bigint
) from public, anon, authenticated;
grant execute on function public.admin_update_topic_series(
  bigint, text, bigint, text, bigint
) to service_role;

commit;

-- Manual rollback, only after confirming no deployed application depends on
-- these contracts:
-- drop function if exists public.admin_update_topic_series(bigint, text, bigint, text, bigint);
-- drop function if exists public.admin_delete_topic_category(bigint, bigint, bigint);
-- drop function if exists public.admin_update_topic_category(bigint, text, bigint, boolean, text, bigint);
-- drop function if exists public.admin_list_series(integer, integer, text, text, text, text, bigint);
-- drop function if exists public.admin_list_categories(integer, integer, text, text, text, text);
