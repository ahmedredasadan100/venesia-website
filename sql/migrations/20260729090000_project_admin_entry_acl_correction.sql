-- Additive ACL correction for Project Admin Data Entry.
--
-- Apply this only after 20260728090000_rebuild_project_admin_data_entry.sql.
-- It intentionally performs no Project row writes and does not drop, truncate,
-- recreate, or reseed any aggregate table. The delete RPC is recreated because
-- an already-applied Remote rebuild can be missing that routine while the
-- current Admin runtime contract requires it.
--
-- If the rebuild was executed outside supabase_migrations, do not use a bulk
-- migration push: that can replay the destructive rebuild. Apply this one file
-- only after review; migration-registry reconciliation is a separate decision.

begin;

do $project_acl_preflight$
declare
  v_table text;
  v_sequence text;
begin
  foreach v_table in array array[
    'project_locations',
    'projects',
    'project_location_points',
    'project_features',
    'project_floor_plans',
    'project_floor_plan_details',
    'project_delivery_items',
    'project_media',
    'project_videos'
  ]
  loop
    if pg_catalog.to_regclass(format('public.%I', v_table)) is null then
      raise exception using
        errcode = '42P01',
        message = format(
          'Project ACL correction requires public.%I from migration 20260728090000.',
          v_table
        );
    end if;
  end loop;

  foreach v_sequence in array array[
    'project_locations_id_seq',
    'projects_id_seq',
    'project_location_points_id_seq',
    'project_features_id_seq',
    'project_floor_plans_id_seq',
    'project_floor_plan_details_id_seq',
    'project_delivery_items_id_seq',
    'project_media_id_seq',
    'project_videos_id_seq'
  ]
  loop
    if pg_catalog.to_regclass(format('public.%I', v_sequence)) is null then
      raise exception using
        errcode = '42P01',
        message = format(
          'Project ACL correction requires public.%I from migration 20260728090000.',
          v_sequence
        );
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.save_project_admin_entry(bigint,jsonb)'
  ) is null then
    raise exception using
      errcode = '42883',
      message = 'Project ACL correction requires public.save_project_admin_entry(bigint,jsonb).';
  end if;

  if pg_catalog.to_regprocedure(
    'public.validate_project_location_parent()'
  ) is null
     or pg_catalog.to_regprocedure(
       'public.prevent_project_type_change()'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.validate_project_location_selection()'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.prevent_project_location_reparent()'
     ) is null then
    raise exception using
      errcode = '42883',
      message = 'Project ACL correction requires all Project trigger helper functions.';
  end if;
end
$project_acl_preflight$;

-- Root deletion remains an explicit SECURITY DEFINER aggregate mutation. This
-- is CREATE OR REPLACE so the forward fix also repairs a Remote database where
-- the applied rebuild did not create the routine.
create or replace function public.delete_project_admin_entry(
  p_project_id bigint
)
returns table (project_type text, project_slug text)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_project_type text;
  v_project_slug text;
begin
  delete from public.projects as project
   where project.id = p_project_id
  returning project.type, project.slug
       into v_project_type, v_project_slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  return query select v_project_type, v_project_slug;
end
$function$;

-- Remove every materialized non-owner grant, including grants introduced by
-- Supabase default privileges and grants stored at individual-column scope.
do $project_acl_cleanup$
declare
  v_grant record;
begin
  for v_grant in
    select distinct
      acl.grantee,
      grantee.rolname as grantee_name,
      relation.relname
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where relation.relacl is not null
      and namespace.nspname = 'public'
      and relation.relname = any (array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ])
      and relation.relkind in ('r', 'p')
      and acl.grantee <> relation.relowner
  loop
    if v_grant.grantee = 0 then
      execute format(
        'revoke all privileges on table public.%I from public cascade',
        v_grant.relname
      );
    else
      execute format(
        'revoke all privileges on table public.%I from %I cascade',
        v_grant.relname,
        v_grant.grantee_name
      );
    end if;
  end loop;

  for v_grant in
    select distinct
      acl.grantee,
      grantee.rolname as grantee_name,
      relation.relname,
      attribute.attname
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = relation.oid
     and attribute.attnum > 0
     and not attribute.attisdropped
    cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where attribute.attacl is not null
      and namespace.nspname = 'public'
      and relation.relname = any (array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ])
      and relation.relkind in ('r', 'p')
      and acl.grantee <> relation.relowner
  loop
    if v_grant.grantee = 0 then
      execute format(
        'revoke all privileges (%I) on table public.%I from public cascade',
        v_grant.attname,
        v_grant.relname
      );
    else
      execute format(
        'revoke all privileges (%I) on table public.%I from %I cascade',
        v_grant.attname,
        v_grant.relname,
        v_grant.grantee_name
      );
    end if;
  end loop;

  for v_grant in
    select distinct
      acl.grantee,
      grantee.rolname as grantee_name,
      sequence.relname
    from pg_catalog.pg_class as sequence
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = sequence.relnamespace
    cross join lateral pg_catalog.aclexplode(sequence.relacl) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where sequence.relacl is not null
      and namespace.nspname = 'public'
      and sequence.relname = any (array[
        'project_locations_id_seq',
        'projects_id_seq',
        'project_location_points_id_seq',
        'project_features_id_seq',
        'project_floor_plans_id_seq',
        'project_floor_plan_details_id_seq',
        'project_delivery_items_id_seq',
        'project_media_id_seq',
        'project_videos_id_seq'
      ])
      and sequence.relkind = 'S'
      and acl.grantee <> sequence.relowner
  loop
    if v_grant.grantee = 0 then
      execute format(
        'revoke all privileges on sequence public.%I from public cascade',
        v_grant.relname
      );
    else
      execute format(
        'revoke all privileges on sequence public.%I from %I cascade',
        v_grant.relname,
        v_grant.grantee_name
      );
    end if;
  end loop;

  for v_grant in
    select distinct
      acl.grantee,
      grantee.rolname as grantee_name,
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where procedure.proacl is not null
      and namespace.nspname = 'public'
      and procedure.oid = any (array[
        'public.save_project_admin_entry(bigint,jsonb)'::regprocedure::oid,
        'public.delete_project_admin_entry(bigint)'::regprocedure::oid,
        'public.validate_project_location_parent()'::regprocedure::oid,
        'public.prevent_project_type_change()'::regprocedure::oid,
        'public.validate_project_location_selection()'::regprocedure::oid,
        'public.prevent_project_location_reparent()'::regprocedure::oid
      ])
      and acl.grantee <> procedure.proowner
  loop
    if v_grant.grantee = 0 then
      execute format(
        'revoke all privileges on function public.%I(%s) from public cascade',
        v_grant.proname,
        v_grant.identity_arguments
      );
    else
      execute format(
        'revoke all privileges on function public.%I(%s) from %I cascade',
        v_grant.proname,
        v_grant.identity_arguments,
        v_grant.grantee_name
      );
    end if;
  end loop;
end
$project_acl_cleanup$;

revoke all privileges on function public.save_project_admin_entry(bigint, jsonb)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.delete_project_admin_entry(bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role;
grant execute on function public.delete_project_admin_entry(bigint) to service_role;

revoke all privileges on table
  public.project_locations,
  public.projects,
  public.project_location_points,
  public.project_features,
  public.project_floor_plans,
  public.project_floor_plan_details,
  public.project_delivery_items,
  public.project_media,
  public.project_videos
from public, anon, authenticated, service_role;

grant select on table
  public.project_locations,
  public.projects,
  public.project_location_points,
  public.project_features,
  public.project_floor_plans,
  public.project_floor_plan_details,
  public.project_delivery_items,
  public.project_media,
  public.project_videos
to service_role;

revoke all privileges on sequence
  public.project_locations_id_seq,
  public.projects_id_seq,
  public.project_location_points_id_seq,
  public.project_features_id_seq,
  public.project_floor_plans_id_seq,
  public.project_floor_plan_details_id_seq,
  public.project_delivery_items_id_seq,
  public.project_media_id_seq,
  public.project_videos_id_seq
from public, anon, authenticated, service_role;

revoke all privileges on function public.validate_project_location_parent()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.prevent_project_type_change()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.validate_project_location_selection()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.prevent_project_location_reparent()
  from public, anon, authenticated, service_role;

-- Validate the final effective runtime surface and every materialized direct
-- non-owner ACL before the additive correction can commit.
do $project_acl_assert$
declare
  v_table text;
  v_sequence text;
  v_role text;
begin
  foreach v_table in array array[
    'project_locations',
    'projects',
    'project_location_points',
    'project_features',
    'project_floor_plans',
    'project_floor_plan_details',
    'project_delivery_items',
    'project_media',
    'project_videos'
  ]
  loop
    if not pg_catalog.has_table_privilege(
      'service_role',
      format('public.%I', v_table),
      'SELECT'
    ) or pg_catalog.has_table_privilege(
      'service_role',
      format('public.%I', v_table),
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
    ) then
      raise exception using
        errcode = '42501',
        message = format('Unsafe service_role table ACL remains on public.%I.', v_table);
    end if;

    foreach v_role in array array['anon', 'authenticated']
    loop
      if pg_catalog.has_table_privilege(
        v_role,
        format('public.%I', v_table),
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
      ) then
        raise exception using
          errcode = '42501',
          message = format('Unsafe %I table ACL remains on public.%I.', v_role, v_table);
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
    where relation.relacl is not null
      and namespace.nspname = 'public'
      and relation.relname = any (array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ])
      and relation.relkind in ('r', 'p')
      and acl.grantee <> relation.relowner
      and not (
        acl.grantee = 'service_role'::regrole::oid
        and acl.privilege_type = 'SELECT'
        and not acl.is_grantable
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct table grant remains on the Project aggregate.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = relation.oid
     and attribute.attnum > 0
     and not attribute.attisdropped
    cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
    where attribute.attacl is not null
      and namespace.nspname = 'public'
      and relation.relname = any (array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ])
      and relation.relkind in ('r', 'p')
      and acl.grantee <> relation.relowner
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct column grant remains on the Project aggregate.';
  end if;

  foreach v_sequence in array array[
    'project_locations_id_seq',
    'projects_id_seq',
    'project_location_points_id_seq',
    'project_features_id_seq',
    'project_floor_plans_id_seq',
    'project_floor_plan_details_id_seq',
    'project_delivery_items_id_seq',
    'project_media_id_seq',
    'project_videos_id_seq'
  ]
  loop
    foreach v_role in array array['anon', 'authenticated', 'service_role']
    loop
      if pg_catalog.has_sequence_privilege(
        v_role,
        format('public.%I', v_sequence),
        'SELECT,USAGE,UPDATE'
      ) then
        raise exception using
          errcode = '42501',
          message = format('Unsafe %I sequence ACL remains on public.%I.', v_role, v_sequence);
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_class as sequence
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = sequence.relnamespace
    cross join lateral pg_catalog.aclexplode(sequence.relacl) as acl
    where sequence.relacl is not null
      and namespace.nspname = 'public'
      and sequence.relname = any (array[
        'project_locations_id_seq',
        'projects_id_seq',
        'project_location_points_id_seq',
        'project_features_id_seq',
        'project_floor_plans_id_seq',
        'project_floor_plan_details_id_seq',
        'project_delivery_items_id_seq',
        'project_media_id_seq',
        'project_videos_id_seq'
      ])
      and sequence.relkind = 'S'
      and acl.grantee <> sequence.relowner
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct sequence grant remains on the Project aggregate.';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.save_project_admin_entry(bigint,jsonb)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role',
    'public.delete_project_admin_entry(bigint)',
    'EXECUTE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'service_role cannot execute both Project aggregate RPCs.';
  end if;

  foreach v_role in array array['anon', 'authenticated']
  loop
    if pg_catalog.has_function_privilege(
      v_role,
      'public.save_project_admin_entry(bigint,jsonb)',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.delete_project_admin_entry(bigint)',
      'EXECUTE'
    ) then
      raise exception using
        errcode = '42501',
        message = format('Unsafe %I Project aggregate RPC ACL remains.', v_role);
    end if;
  end loop;

  foreach v_role in array array['anon', 'authenticated', 'service_role']
  loop
    if pg_catalog.has_function_privilege(
      v_role,
      'public.validate_project_location_parent()',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.prevent_project_type_change()',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.validate_project_location_selection()',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.prevent_project_location_reparent()',
      'EXECUTE'
    ) then
      raise exception using
        errcode = '42501',
        message = format('Unsafe %I helper-function ACL remains.', v_role);
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    where procedure.proacl is not null
      and namespace.nspname = 'public'
      and procedure.oid = any (array[
        'public.save_project_admin_entry(bigint,jsonb)'::regprocedure::oid,
        'public.delete_project_admin_entry(bigint)'::regprocedure::oid
      ])
      and acl.grantee <> procedure.proowner
      and not (
        acl.grantee = 'service_role'::regrole::oid
        and acl.privilege_type = 'EXECUTE'
        and not acl.is_grantable
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct Project RPC grant remains.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    where procedure.proacl is not null
      and namespace.nspname = 'public'
      and procedure.oid = any (array[
        'public.validate_project_location_parent()'::regprocedure::oid,
        'public.prevent_project_type_change()'::regprocedure::oid,
        'public.validate_project_location_selection()'::regprocedure::oid,
        'public.prevent_project_location_reparent()'::regprocedure::oid
      ])
      and acl.grantee <> procedure.proowner
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct helper-function grant remains.';
  end if;
end
$project_acl_assert$;

commit;
