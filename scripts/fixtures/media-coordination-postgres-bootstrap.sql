\set ON_ERROR_STOP on

do $$
declare
  server_major integer := current_setting('server_version_num')::integer / 10000;
begin
  if server_major <> 15 then
    raise exception 'media_coordination_requires_postgresql_15 (found %)', version();
  end if;
end;
$$;

-- The harness allows this fixture only on an explicitly acknowledged,
-- loopback-only disposable database whose name is reserved for this test.
drop schema if exists media_coordination_acl_test cascade;
drop schema if exists media_coordination_test cascade;
drop schema if exists public cascade;
create schema public authorization current_user;
grant all on schema public to public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin noinherit nobypassrls';
  else
    execute 'alter role anon nologin noinherit nobypassrls';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin noinherit nobypassrls';
  else
    execute 'alter role authenticated nologin noinherit nobypassrls';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin noinherit bypassrls';
  else
    execute 'alter role service_role nologin noinherit bypassrls';
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
