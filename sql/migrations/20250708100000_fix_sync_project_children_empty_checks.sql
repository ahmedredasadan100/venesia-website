-- Fix empty-value skip checks in sync_project_children (coalesce(..., '') is null was never true).
-- Replaces function in place; same contract as 20250621000000_sync_project_children_rpc.sql.

begin;

create or replace function public.sync_project_children(
  p_project_id bigint,
  p_floor_plans jsonb default null,
  p_delivery_items jsonb default null,
  p_overview_media jsonb default null,
  p_delivery_media jsonb default null,
  p_gallery_media jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_ord integer;
begin
  if p_project_id is null or p_project_id <= 0 then
    raise exception 'Invalid project id: %', p_project_id;
  end if;

  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project % not found', p_project_id;
  end if;

  if p_floor_plans is not null then
    if jsonb_typeof(p_floor_plans) <> 'array' then
      raise exception 'p_floor_plans must be a JSON array';
    end if;

    delete from public.project_floor_plans where project_id = p_project_id;

    v_ord := 0;
    for v_item in select value from jsonb_array_elements(p_floor_plans) loop
      if nullif(btrim(v_item->>'area'), '') is null
         and nullif(btrim(v_item->>'label'), '') is null
         and nullif(btrim(v_item->>'plan_image'), '') is null then
        continue;
      end if;

      insert into public.project_floor_plans (
        project_id,
        area,
        label,
        plan_image,
        specs,
        featured,
        sort_order,
        updated_at
      ) values (
        p_project_id,
        coalesce(nullif(btrim(v_item->>'area'), ''), ''),
        nullif(btrim(v_item->>'label'), ''),
        coalesce(nullif(btrim(v_item->>'plan_image'), ''), ''),
        coalesce(v_item->'specs', '[]'::jsonb),
        coalesce((v_item->>'featured')::boolean, false),
        coalesce((v_item->>'sort_order')::integer, v_ord),
        now()
      );

      v_ord := v_ord + 1;
    end loop;
  end if;

  if p_delivery_items is not null then
    if jsonb_typeof(p_delivery_items) <> 'array' then
      raise exception 'p_delivery_items must be a JSON array';
    end if;

    delete from public.project_delivery_spec_items where project_id = p_project_id;

    v_ord := 0;
    for v_item in select value from jsonb_array_elements(p_delivery_items) loop
      if nullif(btrim(v_item->>'body'), '') is null then
        continue;
      end if;

      insert into public.project_delivery_spec_items (
        project_id,
        body,
        sort_order,
        updated_at
      ) values (
        p_project_id,
        btrim(v_item->>'body'),
        coalesce((v_item->>'sort_order')::integer, v_ord),
        now()
      );

      v_ord := v_ord + 1;
    end loop;
  end if;

  if p_overview_media is not null then
    if jsonb_typeof(p_overview_media) <> 'array' then
      raise exception 'p_overview_media must be a JSON array';
    end if;

    delete from public.project_media
    where project_id = p_project_id
      and collection = 'overview';

    v_ord := 0;
    for v_item in select value from jsonb_array_elements(p_overview_media) loop
      if nullif(btrim(v_item->>'image'), '') is null then
        continue;
      end if;

      insert into public.project_media (
        project_id,
        collection,
        image,
        label,
        sort_order,
        updated_at
      ) values (
        p_project_id,
        'overview',
        btrim(v_item->>'image'),
        coalesce(btrim(v_item->>'label'), ''),
        coalesce((v_item->>'sort_order')::integer, v_ord),
        now()
      );

      v_ord := v_ord + 1;
    end loop;
  end if;

  if p_delivery_media is not null then
    if jsonb_typeof(p_delivery_media) <> 'array' then
      raise exception 'p_delivery_media must be a JSON array';
    end if;

    delete from public.project_media
    where project_id = p_project_id
      and collection = 'delivery_specs';

    v_ord := 0;
    for v_item in select value from jsonb_array_elements(p_delivery_media) loop
      if nullif(btrim(v_item->>'image'), '') is null then
        continue;
      end if;

      insert into public.project_media (
        project_id,
        collection,
        image,
        label,
        sort_order,
        updated_at
      ) values (
        p_project_id,
        'delivery_specs',
        btrim(v_item->>'image'),
        coalesce(btrim(v_item->>'label'), ''),
        coalesce((v_item->>'sort_order')::integer, v_ord),
        now()
      );

      v_ord := v_ord + 1;
    end loop;
  end if;

  if p_gallery_media is not null then
    if jsonb_typeof(p_gallery_media) <> 'array' then
      raise exception 'p_gallery_media must be a JSON array';
    end if;

    delete from public.project_media
    where project_id = p_project_id
      and collection = 'gallery';

    v_ord := 0;
    for v_item in select value from jsonb_array_elements(p_gallery_media) loop
      if nullif(btrim(v_item->>'image'), '') is null then
        continue;
      end if;

      insert into public.project_media (
        project_id,
        collection,
        image,
        label,
        sort_order,
        updated_at
      ) values (
        p_project_id,
        'gallery',
        btrim(v_item->>'image'),
        coalesce(btrim(v_item->>'label'), ''),
        coalesce((v_item->>'sort_order')::integer, v_ord),
        now()
      );

      v_ord := v_ord + 1;
    end loop;
  end if;
end;
$$;

revoke all on function public.sync_project_children(bigint, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.sync_project_children(bigint, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

commit;
