\set ON_ERROR_STOP on

-- The corrective migration is privilege-only. Prove effective and explicit
-- ACLs for every exact signature, then compare the underlying implementation
-- metadata with the pre-migration snapshot.
do $$
declare
  expected record;
  target_oid oid;
  current_body text;
  current_security_definer boolean;
  current_configuration text[];
  snapshot media_coordination_acl_test.function_definition_before%rowtype;
  anon_oid oid := (select oid from pg_roles where rolname = 'anon');
  authenticated_oid oid := (select oid from pg_roles where rolname = 'authenticated');
  service_role_oid oid := (select oid from pg_roles where rolname = 'service_role');
begin
  if anon_oid is null or authenticated_oid is null or service_role_oid is null then
    raise exception 'media_coordination_acl_roles_missing';
  end if;

  if (select count(*) from media_coordination_acl_test.expected_functions) <> 16
     or (select count(*) from media_coordination_acl_test.function_definition_before) <> 16 then
    raise exception 'media_coordination_acl_fixture_incomplete';
  end if;

  for expected in
    select identity
    from media_coordination_acl_test.expected_functions
    order by identity
  loop
    target_oid := to_regprocedure(expected.identity);
    if target_oid is null then
      raise exception 'media_coordination_acl_function_missing_after:%', expected.identity;
    end if;

    select *
    into strict snapshot
    from media_coordination_acl_test.function_definition_before before_definition
    where before_definition.identity = expected.identity;

    if target_oid is distinct from snapshot.function_oid then
      raise exception 'media_coordination_acl_function_identity_changed:%', expected.identity;
    end if;

    select
      procedure.prosrc,
      procedure.prosecdef,
      coalesce(procedure.proconfig, array[]::text[])
    into strict
      current_body,
      current_security_definer,
      current_configuration
    from pg_proc procedure
    where procedure.oid = target_oid;

    if current_body is distinct from snapshot.body then
      raise exception 'media_coordination_acl_function_body_changed:%', expected.identity;
    end if;
    if current_security_definer is distinct from snapshot.security_definer then
      raise exception 'media_coordination_acl_security_definer_changed:%', expected.identity;
    end if;
    if current_configuration is distinct from snapshot.configuration then
      raise exception 'media_coordination_acl_search_path_changed:%', expected.identity;
    end if;
    if not current_security_definer then
      raise exception 'media_coordination_acl_security_definer_missing:%', expected.identity;
    end if;
    if has_function_privilege('anon', expected.identity, 'EXECUTE') then
      raise exception 'media_coordination_acl_anon_execute_remains:%', expected.identity;
    end if;
    if has_function_privilege('authenticated', expected.identity, 'EXECUTE') then
      raise exception 'media_coordination_acl_authenticated_execute_remains:%', expected.identity;
    end if;
    if not has_function_privilege('service_role', expected.identity, 'EXECUTE') then
      raise exception 'media_coordination_acl_service_role_execute_missing:%', expected.identity;
    end if;

    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) acl_entry
      where procedure.oid = target_oid
        and acl_entry.privilege_type = 'EXECUTE'
        and acl_entry.grantee in (0::oid, anon_oid, authenticated_oid)
    ) then
      raise exception 'media_coordination_acl_public_or_browser_execute_acl_remains:%', expected.identity;
    end if;

    if not exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) acl_entry
      where procedure.oid = target_oid
        and acl_entry.privilege_type = 'EXECUTE'
        and acl_entry.grantee = service_role_oid
    ) then
      raise exception 'media_coordination_acl_service_role_explicit_acl_missing:%', expected.identity;
    end if;
  end loop;
end;
$$;

select 'PASS corrective Media coordination RPC ACL hardening denied PUBLIC/anon/authenticated, retained service_role, and preserved all 16 function bodies/security-definer/search_path settings.';
