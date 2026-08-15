-- Location Management Foundation.
--
-- Owner: public.project_locations.
-- This migration keeps the existing relational tree as the sole location
-- source of truth and exposes one guarded command contract for Admin CRUD.

begin;

comment on table public.project_locations is
  'Canonical Project Location Domain: Governorate -> City -> District -> Sub District.';
comment on column public.project_locations.level is
  'Canonical hierarchy discriminator: governorate, city, main_area (District), sub_area (Sub District).';
comment on column public.project_locations.parent_id is
  'Canonical parent relation. Null only for Governorates.';

create or replace function public.mutate_project_location(
  p_action text,
  p_location_id bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.project_locations
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_location public.project_locations%rowtype;
  v_level text;
  v_parent_id bigint;
  v_name_ar text;
  v_name_en text;
  v_sort_order integer;
  v_is_active boolean;
  v_reference_count bigint;
begin
  if pg_catalog.jsonb_typeof(v_payload) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Location mutation payload must be a JSON object.';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_object_keys(v_payload) as payload_key(key)
     where payload_key.key not in (
       'level', 'parent_id', 'name_ar', 'name_en', 'sort_order', 'is_active'
     )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Location mutation payload contains unsupported fields.';
  end if;

  if v_action = 'create' then
    if p_location_id is not null then
      raise exception using
        errcode = '22023',
        message = 'A new location must not provide an existing location id.';
    end if;

    v_level := pg_catalog.lower(pg_catalog.btrim(v_payload ->> 'level'));
    v_parent_id := nullif(v_payload ->> 'parent_id', '')::bigint;
    v_name_ar := pg_catalog.btrim(v_payload ->> 'name_ar');
    v_name_en := nullif(pg_catalog.btrim(v_payload ->> 'name_en'), '');
    v_sort_order := coalesce(
      nullif(v_payload ->> 'sort_order', '')::integer,
      0
    );
    v_is_active := coalesce(
      nullif(v_payload ->> 'is_active', '')::boolean,
      true
    );

    if v_level not in ('governorate', 'city', 'main_area', 'sub_area') then
      raise exception using errcode = '22023', message = 'Invalid location level.';
    end if;
    if coalesce(v_name_ar, '') = '' then
      raise exception using errcode = '22023', message = 'Arabic location name is required.';
    end if;
    if v_sort_order < 0 then
      raise exception using errcode = '22023', message = 'Location order cannot be negative.';
    end if;

    insert into public.project_locations (
      level,
      parent_id,
      name_ar,
      name_en,
      sort_order,
      is_active
    ) values (
      v_level,
      v_parent_id,
      v_name_ar,
      v_name_en,
      v_sort_order,
      v_is_active
    )
    returning * into v_location;

    return v_location;
  end if;

  if v_action not in ('update', 'delete') then
    raise exception using
      errcode = '22023',
      message = 'Unsupported location mutation action.';
  end if;

  if p_location_id is null or p_location_id <= 0 then
    raise exception using errcode = '22023', message = 'A valid location id is required.';
  end if;

  select location.*
    into v_location
    from public.project_locations as location
   where location.id = p_location_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project location not found.';
  end if;

  if v_action = 'delete' then
    if v_payload <> '{}'::jsonb then
      raise exception using
        errcode = '22023',
        message = 'Delete location does not accept a mutation payload.';
    end if;

    perform 1
      from public.project_locations as child
     where child.parent_id = p_location_id
     for key share;
    if found then
      raise exception using
        errcode = '23503',
        message = 'A location with child locations cannot be deleted.';
    end if;

    select pg_catalog.count(*)
      into v_reference_count
      from public.projects as project
     where project.governorate_id = p_location_id
        or project.city_id = p_location_id
        or project.main_area_id = p_location_id
        or project.sub_area_id = p_location_id;

    if v_reference_count > 0 then
      raise exception using
        errcode = '23503',
        message = 'A location linked to projects cannot be deleted.';
    end if;

    delete from public.project_locations
     where id = p_location_id
    returning * into v_location;

    return v_location;
  end if;

  if v_payload ? 'level'
     and pg_catalog.lower(pg_catalog.btrim(v_payload ->> 'level'))
       is distinct from v_location.level then
    raise exception using
      errcode = '23514',
      message = 'A Project Location cannot change hierarchy level.';
  end if;

  v_level := case
    when v_payload ? 'level'
      then pg_catalog.lower(pg_catalog.btrim(v_payload ->> 'level'))
    else v_location.level
  end;
  v_parent_id := case
    when v_payload ? 'parent_id'
      then nullif(v_payload ->> 'parent_id', '')::bigint
    else v_location.parent_id
  end;
  v_name_ar := case
    when v_payload ? 'name_ar'
      then pg_catalog.btrim(v_payload ->> 'name_ar')
    else v_location.name_ar
  end;
  v_name_en := case
    when v_payload ? 'name_en'
      then nullif(pg_catalog.btrim(v_payload ->> 'name_en'), '')
    else v_location.name_en
  end;
  v_sort_order := case
    when v_payload ? 'sort_order'
      then nullif(v_payload ->> 'sort_order', '')::integer
    else v_location.sort_order
  end;
  v_is_active := case
    when v_payload ? 'is_active'
      then nullif(v_payload ->> 'is_active', '')::boolean
    else v_location.is_active
  end;

  if v_level not in ('governorate', 'city', 'main_area', 'sub_area') then
    raise exception using errcode = '22023', message = 'Invalid location level.';
  end if;
  if coalesce(v_name_ar, '') = '' then
    raise exception using errcode = '22023', message = 'Arabic location name is required.';
  end if;
  if v_sort_order is null or v_sort_order < 0 then
    raise exception using errcode = '22023', message = 'Location order cannot be negative.';
  end if;
  if v_is_active is null then
    raise exception using errcode = '22023', message = 'Location active state is required.';
  end if;

  update public.project_locations
     set level = v_level,
         parent_id = v_parent_id,
         name_ar = v_name_ar,
         name_en = v_name_en,
         sort_order = v_sort_order,
         is_active = v_is_active,
         updated_at = pg_catalog.now()
   where id = p_location_id
  returning * into v_location;

  return v_location;
end
$function$;

comment on function public.mutate_project_location(text, bigint, jsonb) is
  'Canonical guarded Admin command owner for Project Location CRUD, active state and ordering.';

revoke all privileges on function public.mutate_project_location(text, bigint, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.mutate_project_location(text, bigint, jsonb)
  to service_role;

do $location_management_acl_assert$
begin
  if pg_catalog.has_function_privilege(
    'anon',
    'public.mutate_project_location(text,bigint,jsonb)',
    'execute'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.mutate_project_location(text,bigint,jsonb)',
    'execute'
  ) or not pg_catalog.has_function_privilege(
    'service_role',
    'public.mutate_project_location(text,bigint,jsonb)',
    'execute'
  ) then
    raise exception 'Project Location mutation RPC ACL is invalid.';
  end if;
end
$location_management_acl_assert$;

commit;
