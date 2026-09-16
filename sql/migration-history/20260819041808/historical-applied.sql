begin;

do $preflight$
declare
  v_function_oid oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
begin
  if v_function_oid is null then
    raise exception 'public.rls_auto_enable() is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc function_row
    where function_row.oid = v_function_oid
      and function_row.prosecdef
      and function_row.prorettype = 'event_trigger'::pg_catalog.regtype
      and function_row.proconfig @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception
      'rls_auto_enable security mode, return type, or search_path changed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_event_trigger event_row
    where event_row.evtname = 'ensure_rls'
      and event_row.evtfoid = v_function_oid
      and event_row.evtenabled = 'O'
  ) then
    raise exception 'ensure_rls event trigger dependency is missing';
  end if;
end
$preflight$;

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

do $verification$
declare
  v_function_oid oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
begin
  if pg_catalog.has_function_privilege(
    'anon',
    v_function_oid,
    'EXECUTE'
  ) then
    raise exception 'anon still has EXECUTE';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    v_function_oid,
    'EXECUTE'
  ) then
    raise exception 'authenticated still has EXECUTE';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    v_function_oid,
    'EXECUTE'
  ) then
    raise exception 'service_role lost EXECUTE';
  end if;

  if not pg_catalog.has_function_privilege(
    'postgres',
    v_function_oid,
    'EXECUTE'
  ) then
    raise exception 'postgres owner lost EXECUTE';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function_row.proacl,
        pg_catalog.acldefault('f', function_row.proowner)
      )
    ) acl
    where function_row.oid = v_function_oid
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC still has EXECUTE';
  end if;
end
$verification$;

commit;
