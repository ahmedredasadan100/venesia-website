-- Keep at least one active CMS admin across direct table writes.

begin;

create or replace function public.enforce_admin_users_active_invariant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_active_admin_count bigint;
begin
  if tg_op = 'DELETE' then
    if old.is_active is not true then
      return null;
    end if;
  elsif old.is_active is not true or new.is_active is true then
    return null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.admin_users:last-active', 0)
  );

  select pg_catalog.count(*)
    into v_active_admin_count
  from (
    select admin_user.id
    from public.admin_users as admin_user
    where admin_user.is_active is true
    order by admin_user.id
    for update skip locked
  ) as locked_active_admins;

  if v_active_admin_count = 0 then
    raise exception using
      errcode = '23514',
      message = 'admin_users_last_active_required',
      constraint = 'admin_users_last_active_required';
  end if;

  return null;
end;
$function$;

revoke all on function public.enforce_admin_users_active_invariant()
  from public, anon, authenticated;

drop trigger if exists admin_users_active_invariant on public.admin_users;
create trigger admin_users_active_invariant
after delete or update of is_active on public.admin_users
for each row
execute function public.enforce_admin_users_active_invariant();

comment on function public.enforce_admin_users_active_invariant() is
  'Fail-closed last-active-admin invariant for direct admin_users UPDATE and DELETE writes.';

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
