begin;

set local search_path = pg_catalog, pg_temp;

lock table
  public.project_location_points,
  public.project_features,
  public.project_floor_plans,
  public.project_delivery_items,
  public.project_media,
  public.project_videos
in share mode;

-- The function returns a column named project_id. In PL/pgSQL that return
-- column is also an implicit variable, so ON CONFLICT (project_id, client_key)
-- is ambiguous on PostgreSQL 17. Rewrite only the six aggregate arbiters to
-- their existing named UNIQUE constraints. No table or row is modified here.
do $project_save_rpc_conflict_arbiter_fix$
declare
  v_function_oid oid := pg_catalog.to_regprocedure(
    'public.save_project_admin_entry(bigint,jsonb)'
  );
  v_definition text;
  v_rewritten text;
  v_old_arbiter constant text := 'on conflict (project_id, client_key)';
  v_constraint_names constant text[] := array[
    'project_location_points_client_unique',
    'project_features_client_unique',
    'project_floor_plans_client_unique',
    'project_delivery_items_client_unique',
    'project_media_client_unique',
    'project_videos_client_unique'
  ]::text[];
  v_table_names constant text[] := array[
    'project_location_points',
    'project_features',
    'project_floor_plans',
    'project_delivery_items',
    'project_media',
    'project_videos'
  ]::text[];
  v_acl_before aclitem[];
  v_identity_before text;
  v_arguments_before text;
  v_result_before text;
  v_owner_before oid;
  v_prosrc_semantic_hash_before text;
  v_old_count integer;
  v_new_count integer := 0;
  v_position integer;
  v_previous_table_position integer := 0;
  v_table_position integer;
  v_index integer;
  v_constraint_name text;
  v_needle text;
  v_final_definition text;
begin
  if v_function_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'save_project_admin_entry(bigint,jsonb) is missing.';
  end if;

  select
    procedure_record.proacl,
    pg_catalog.pg_get_function_identity_arguments(procedure_record.oid),
    pg_catalog.pg_get_function_arguments(procedure_record.oid),
    pg_catalog.pg_get_function_result(procedure_record.oid),
    procedure_record.proowner,
    pg_catalog.md5(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(
          pg_catalog.replace(
            pg_catalog.replace(
              procedure_record.prosrc,
              pg_catalog.chr(13) || pg_catalog.chr(10),
              pg_catalog.chr(10)
            ),
            pg_catalog.chr(13),
            pg_catalog.chr(10)
          ),
          E'[ \t]+\n',
          E'\n',
          'g'
        )
      )
    ),
    pg_catalog.pg_get_functiondef(procedure_record.oid)
  into
    v_acl_before,
    v_identity_before,
    v_arguments_before,
    v_result_before,
    v_owner_before,
    v_prosrc_semantic_hash_before,
    v_definition
  from pg_catalog.pg_proc procedure_record
  where procedure_record.oid = v_function_oid
    and procedure_record.prokind = 'f'
    and procedure_record.prosecdef
    and procedure_record.provolatile = 'v'
    and not procedure_record.proleakproof
    and procedure_record.proparallel = 'u'
    and procedure_record.procost = 100
    and procedure_record.prorows = 1000
    and 'search_path=pg_catalog, pg_temp' = any(
      coalesce(procedure_record.proconfig, '{}'::text[])
    );

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'save_project_admin_entry does not match the approved SECURITY DEFINER, VOLATILE, fixed-search_path contract.';
  end if;

  if v_prosrc_semantic_hash_before not in (
    'aa3258d57ab320cd0fa46eeb2595ae7c',
    'bc79445ae958779ed889651cd980c236'
  ) then
    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'save_project_admin_entry semantic body hash %s is outside the audited old/corrected allowlist.',
        v_prosrc_semantic_hash_before
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        (
          select procedure_record.proacl
          from pg_catalog.pg_proc procedure_record
          where procedure_record.oid = v_function_oid
        ),
        pg_catalog.acldefault('f', v_owner_before)
      )
    ) acl
    where acl.grantee = 'service_role'::regrole
      and acl.privilege_type = 'EXECUTE'
  ) or exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        (
          select procedure_record.proacl
          from pg_catalog.pg_proc procedure_record
          where procedure_record.oid = v_function_oid
        ),
        pg_catalog.acldefault('f', v_owner_before)
      )
    ) acl
    where acl.privilege_type = 'EXECUTE'
      and acl.grantee not in (v_owner_before, 'service_role'::regrole)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'save_project_admin_entry EXECUTE ACL is not owner plus service_role only.';
  end if;

  for v_index in 1..pg_catalog.array_length(v_table_names, 1) loop
    if not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_table_names[v_index])
      )
        and constraint_record.conname = v_constraint_names[v_index]
        and constraint_record.contype = 'u'
        and constraint_record.convalidated
        and not constraint_record.condeferrable
        and not constraint_record.condeferred
        and constraint_record.coninhcount = 0
        and constraint_record.conislocal
        and constraint_record.connoinherit
        and pg_catalog.pg_get_constraintdef(constraint_record.oid, false) =
          'UNIQUE (project_id, client_key)'
    ) then
      raise exception using
        errcode = 'P0001',
        message = pg_catalog.format(
          'Expected non-deferrable UNIQUE constraint %I on public.%I(project_id, client_key) is missing.',
          v_constraint_names[v_index],
          v_table_names[v_index]
        );
    end if;

    v_table_position := pg_catalog.strpos(
      pg_catalog.lower(v_definition),
      'insert into public.' || v_table_names[v_index]
    );
    if v_table_position <= v_previous_table_position then
      raise exception using
        errcode = 'P0001',
        message = 'save_project_admin_entry aggregate upsert order is not the audited order.';
    end if;
    v_previous_table_position := v_table_position;
  end loop;

  v_old_count := (
    pg_catalog.length(pg_catalog.lower(v_definition)) -
    pg_catalog.length(
      pg_catalog.replace(pg_catalog.lower(v_definition), v_old_arbiter, '')
    )
  ) / pg_catalog.length(v_old_arbiter);

  foreach v_constraint_name in array v_constraint_names loop
    v_needle := 'on conflict on constraint ' || v_constraint_name;
    v_new_count := v_new_count + (
      pg_catalog.length(pg_catalog.lower(v_definition)) -
      pg_catalog.length(
        pg_catalog.replace(pg_catalog.lower(v_definition), v_needle, '')
      )
    ) / pg_catalog.length(v_needle);
  end loop;

  if v_old_count = 6 and v_new_count = 0 then
    v_rewritten := v_definition;
    foreach v_constraint_name in array v_constraint_names loop
      v_position := pg_catalog.strpos(
        pg_catalog.lower(v_rewritten),
        v_old_arbiter
      );
      if v_position = 0 then
        raise exception using
          errcode = 'P0001',
          message = 'An expected ambiguous conflict arbiter disappeared during the rewrite.';
      end if;
      v_rewritten := overlay(
        v_rewritten placing
          'on conflict on constraint ' || v_constraint_name
        from v_position for pg_catalog.length(v_old_arbiter)
      );
    end loop;

    execute v_rewritten;
  elsif not (v_old_count = 0 and v_new_count = 6) then
    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'save_project_admin_entry conflict-arbiter state is unsafe (old=%s, named=%s).',
        v_old_count,
        v_new_count
      );
  end if;

  select pg_catalog.pg_get_functiondef(procedure_record.oid)
  into v_final_definition
  from pg_catalog.pg_proc procedure_record
  where procedure_record.oid = pg_catalog.to_regprocedure(
    'public.save_project_admin_entry(bigint,jsonb)'
  )
    and procedure_record.prokind = 'f'
    and procedure_record.prosecdef
    and procedure_record.provolatile = 'v'
    and procedure_record.proowner = v_owner_before
    and procedure_record.proacl is not distinct from v_acl_before
    and pg_catalog.md5(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(
          pg_catalog.replace(
            pg_catalog.replace(
              procedure_record.prosrc,
              pg_catalog.chr(13) || pg_catalog.chr(10),
              pg_catalog.chr(10)
            ),
            pg_catalog.chr(13),
            pg_catalog.chr(10)
          ),
          E'[ \t]+\n',
          E'\n',
          'g'
        )
      )
    ) = 'bc79445ae958779ed889651cd980c236'
    and pg_catalog.pg_get_function_identity_arguments(procedure_record.oid) =
      v_identity_before
    and pg_catalog.pg_get_function_arguments(procedure_record.oid) =
      v_arguments_before
    and pg_catalog.pg_get_function_result(procedure_record.oid) = v_result_before
    and not procedure_record.proleakproof
    and procedure_record.proparallel = 'u'
    and procedure_record.procost = 100
    and procedure_record.prorows = 1000
    and 'search_path=pg_catalog, pg_temp' = any(
      coalesce(procedure_record.proconfig, '{}'::text[])
    );

  if v_final_definition is null or (
    pg_catalog.length(pg_catalog.lower(v_final_definition)) -
    pg_catalog.length(
      pg_catalog.replace(
        pg_catalog.lower(v_final_definition),
        v_old_arbiter,
        ''
      )
    )
  ) / pg_catalog.length(v_old_arbiter) <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'save_project_admin_entry final function contract or ACL changed unexpectedly.';
  end if;

  foreach v_constraint_name in array v_constraint_names loop
    v_needle := 'on conflict on constraint ' || v_constraint_name;
    if (
      pg_catalog.length(pg_catalog.lower(v_final_definition)) -
      pg_catalog.length(
        pg_catalog.replace(pg_catalog.lower(v_final_definition), v_needle, '')
      )
    ) / pg_catalog.length(v_needle) <> 1 then
      raise exception using
        errcode = 'P0001',
        message = pg_catalog.format(
          'Final save_project_admin_entry definition does not contain exactly one %s arbiter.',
          v_constraint_name
        );
    end if;
  end loop;
end
$project_save_rpc_conflict_arbiter_fix$;

commit;
