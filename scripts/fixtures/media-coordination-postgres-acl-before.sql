\set ON_ERROR_STOP on

-- Supabase can carry explicit EXECUTE grants for its browser roles even when
-- PUBLIC was revoked by a migration. Reproduce that remote ACL state before
-- applying the forward-only ACL hardening migration, and retain an exact
-- definition snapshot so the follow-up proof can show that only privileges
-- changed.
drop schema if exists media_coordination_acl_test cascade;
create schema media_coordination_acl_test authorization current_user;

create table media_coordination_acl_test.expected_functions (
  identity text primary key
);

insert into media_coordination_acl_test.expected_functions (identity)
values
  ('public.assert_media_catalog_coordination_ready(text,text,text,text)'),
  ('public.acquire_media_reference_write_lease(jsonb,bigint,text,integer,text,text,text,text)'),
  ('public.complete_media_reference_write_lease(uuid,text)'),
  ('public.fail_media_reference_write_lease(uuid,text,text,jsonb,boolean)'),
  ('public.resolve_media_reference_write_lease(uuid,uuid,text,text)'),
  ('public.transition_media_asset_identity_for_move(uuid,uuid,text,text,text,text,text,text,text,text)'),
  ('public.rollback_media_asset_identity_move(uuid,uuid,text,text,text,text,text,text,text,text,text,boolean)'),
  ('public.finalize_media_asset_identity_move(uuid,uuid,text,text,text,text)'),
  ('public.reserve_media_asset_deletion(uuid,bigint,text,text,text,text,text,text,text,text)'),
  ('public.cancel_media_asset_deletion(uuid,uuid,text,jsonb,text,timestamptz)'),
  ('public.finalize_media_asset_deletion(uuid,uuid,text,timestamptz)'),
  ('public.mark_media_asset_delete_recovery(uuid,uuid,text,jsonb,text,timestamptz)'),
  ('public.repair_media_delete_reservation(uuid,uuid,text,text,timestamptz,jsonb)'),
  ('public.get_media_reference_provider_revision(text)'),
  ('public.replace_media_references_for_entity(text,text,text,jsonb,uuid,text)'),
  ('public.replace_media_references_for_provider(text,jsonb,uuid,bigint)');

create table media_coordination_acl_test.function_definition_before (
  identity text primary key references media_coordination_acl_test.expected_functions (identity),
  function_oid oid not null,
  body text not null,
  security_definer boolean not null,
  configuration text[] not null
);

do $$
declare
  expected_function record;
  target_oid oid;
begin
  if (select count(*) from media_coordination_acl_test.expected_functions) <> 16 then
    raise exception 'media_coordination_acl_expected_function_count_invalid';
  end if;

  for expected_function in
    select identity
    from media_coordination_acl_test.expected_functions
    order by identity
  loop
    target_oid := to_regprocedure(expected_function.identity);
    if target_oid is null then
      raise exception 'media_coordination_acl_function_missing_before:%', expected_function.identity;
    end if;

    insert into media_coordination_acl_test.function_definition_before (
      identity,
      function_oid,
      body,
      security_definer,
      configuration
    )
    select
      expected_function.identity,
      procedure.oid,
      procedure.prosrc,
      procedure.prosecdef,
      coalesce(procedure.proconfig, array[]::text[])
    from pg_proc procedure
    where procedure.oid = target_oid;

    execute format(
      'grant execute on function %s to anon, authenticated',
      expected_function.identity
    );
  end loop;
end;
$$;

do $$
declare
  missing_grants text;
  expected_function record;
  target_oid oid;
  anon_oid oid := (select oid from pg_roles where rolname = 'anon');
  authenticated_oid oid := (select oid from pg_roles where rolname = 'authenticated');
begin
  select string_agg(target.identity, ', ' order by target.identity)
  into missing_grants
  from media_coordination_acl_test.expected_functions target
  where not has_function_privilege('anon', target.identity, 'EXECUTE')
     or not has_function_privilege('authenticated', target.identity, 'EXECUTE');

  if missing_grants is not null then
    raise exception 'media_coordination_acl_browser_grant_simulation_failed:%', missing_grants;
  end if;

  for expected_function in
    select identity
    from media_coordination_acl_test.expected_functions
    order by identity
  loop
    target_oid := to_regprocedure(expected_function.identity);
    if not exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) acl_entry
      where procedure.oid = target_oid
        and acl_entry.privilege_type = 'EXECUTE'
        and acl_entry.grantee = anon_oid
    ) or not exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) acl_entry
      where procedure.oid = target_oid
        and acl_entry.privilege_type = 'EXECUTE'
        and acl_entry.grantee = authenticated_oid
    ) then
      raise exception 'media_coordination_acl_explicit_browser_grant_missing:%', expected_function.identity;
    end if;
  end loop;

  if (select count(*) from media_coordination_acl_test.function_definition_before) <> 16 then
    raise exception 'media_coordination_acl_snapshot_incomplete';
  end if;
end;
$$;
