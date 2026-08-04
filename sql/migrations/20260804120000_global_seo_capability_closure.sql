-- Global SEO capability closure.
-- Keeps canonical overrides untouched; in particular this migration never updates projects.canonical_url.

begin;

create or replace function public.is_valid_global_seo_settings(payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key_name text;
  item jsonb;
  string_keys constant text[] := array[
    'siteName','defaultTitle','defaultDescription','defaultOgImage','defaultOgImageAlt',
    'defaultTwitterImage','siteUrl','canonicalBaseUrl','organizationName',
    'organizationAlternateName','organizationLegalName','organizationTagline',
    'organizationDescription','organizationLogo','organizationPhone','organizationEmail',
    'organizationAddress','organizationAddressLocality','organizationAddressRegion',
    'organizationPostalCode','organizationAddressCountry','organizationAreaServed',
    'twitterHandle','googleSiteVerification','bingSiteVerification'
  ];
  boolean_keys constant text[] := array['defaultRobotsIndex','defaultRobotsFollow'];
  array_keys constant text[] := array[
    'organizationKnowsAbout','organizationSocialLinks','robotsTxtAllow','robotsTxtDisallow'
  ];
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    return false;
  end if;

  for key_name in select jsonb_object_keys(payload)
  loop
    if not (key_name = any(string_keys || boolean_keys || array_keys)) then
      return false;
    end if;
  end loop;

  foreach key_name in array string_keys
  loop
    if payload ? key_name and jsonb_typeof(payload -> key_name) <> 'string' then
      return false;
    end if;
  end loop;

  foreach key_name in array boolean_keys
  loop
    if payload ? key_name and jsonb_typeof(payload -> key_name) <> 'boolean' then
      return false;
    end if;
  end loop;

  foreach key_name in array array_keys
  loop
    if payload ? key_name and jsonb_typeof(payload -> key_name) <> 'array' then
      return false;
    end if;
  end loop;

  if payload ? 'siteUrl' and payload ->> 'siteUrl' !~ '^https?://[^[:space:]]+$' then return false; end if;
  if payload ? 'canonicalBaseUrl' and payload ->> 'canonicalBaseUrl' !~ '^https?://[^[:space:]]+$' then return false; end if;
  if payload ? 'organizationEmail' and payload ->> 'organizationEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false; end if;
  if payload ? 'defaultTitle' and length(payload ->> 'defaultTitle') > 65 then return false; end if;
  if payload ? 'defaultDescription' and length(payload ->> 'defaultDescription') > 165 then return false; end if;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'organizationSocialLinks', '[]'::jsonb))
  loop
    if jsonb_typeof(item) <> 'object'
      or nullif(btrim(item ->> 'label'), '') is null
      or coalesce(item ->> 'href', '') !~ '^https?://[^[:space:]]+$'
    then
      return false;
    end if;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'robotsTxtAllow', '[]'::jsonb))
    union all
    select value from jsonb_array_elements(coalesce(payload -> 'robotsTxtDisallow', '[]'::jsonb))
  loop
    if jsonb_typeof(item) <> 'string' or item #>> '{}' !~ '^/' then
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

alter table public.site_settings
  drop constraint if exists site_settings_seo_global_shape_check;
alter table public.site_settings
  add constraint site_settings_seo_global_shape_check
  check (key <> 'seo.global' or public.is_valid_global_seo_settings(value));

insert into public.site_settings (key, value, updated_at)
values (
  'seo.global',
  jsonb_build_object(
    'siteName', 'Venesia Developments',
    'defaultTitle', 'فينيسيا للتطوير العقاري | Venesia Developments',
    'defaultDescription', 'فينيسيا للتطوير العقاري شركة تطوير عقاري مصرية توثق تنفيذ مشروعاتها خطوة بخطوة، من الأرض إلى التسليم، بثقة قائمة على الفعل لا الوعود.',
    'defaultOgImage', '/images/venesia-5.png',
    'defaultOgImageAlt', 'فينيسيا للتطوير العقاري',
    'defaultTwitterImage', '/images/venesia-5.png',
    'defaultRobotsIndex', true,
    'defaultRobotsFollow', true,
    'siteUrl', 'https://www.venesia-developments.net',
    'canonicalBaseUrl', 'https://www.venesia-developments.net',
    'organizationName', 'Venesia Developments',
    'organizationAlternateName', 'فينيسيا للتطوير العقاري',
    'organizationLegalName', 'Venesia Developments',
    'organizationTagline', 'الثقة مش وعد… الثقة فعل.',
    'organizationDescription', 'فينيسيا للتطوير العقاري شركة تطوير عقاري مصرية توثق تنفيذ مشروعاتها خطوة بخطوة، من الأرض إلى التسليم، بثقة قائمة على الفعل لا الوعود.',
    'organizationLogo', '/logo.png',
    'organizationPhone', '15875',
    'organizationEmail', 'info@venesia-developments.com',
    'organizationAddress', 'Street 12, New Cairo 1, Cairo Governorate',
    'organizationAddressLocality', 'New Cairo',
    'organizationAddressRegion', 'Cairo Governorate',
    'organizationPostalCode', '',
    'organizationAddressCountry', 'EG',
    'organizationAreaServed', 'Egypt',
    'organizationKnowsAbout', jsonb_build_array(
      'Real estate development company in Egypt',
      'New Cairo real estate developer',
      'Residential and commercial projects',
      'Construction progress documentation',
      'Owned land and execution transparency',
      'Project updates from construction sites'
    ),
    'organizationSocialLinks', '[]'::jsonb,
    'twitterHandle', '',
    'googleSiteVerification', '',
    'bingSiteVerification', '',
    'robotsTxtAllow', jsonb_build_array('/'),
    'robotsTxtDisallow', jsonb_build_array('/api/','/_next/','/admin/','/maintenance/','/dashboard/','/private/')
  ),
  now()
)
on conflict (key) do nothing;

create or replace function public.enforce_url_redirect_contract()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  protected_prefix text;
  destination_internal text;
  loop_found boolean;
begin
  perform pg_advisory_xact_lock(hashtext('public.url_redirects:write'));

  new.source_path := regexp_replace(btrim(new.source_path), '/+$', '');
  if new.source_path = '' then new.source_path := '/'; end if;
  new.destination_path := btrim(new.destination_path);

  if new.source_path !~ '^/' or new.source_path ~ '^//' or new.source_path ~ '[?#]' or new.source_path ~ '\.\.' then
    raise exception using errcode = '23514', message = 'Invalid redirect source path';
  end if;
  if new.destination_path !~ '^/' and new.destination_path !~ '^https?://[^[:space:]]+$' then
    raise exception using errcode = '23514', message = 'Invalid redirect destination';
  end if;

  foreach protected_prefix in array array['/admin','/api','/_next','/sitemap.xml','/robots.txt']
  loop
    if lower(new.source_path) = protected_prefix or lower(new.source_path) like protected_prefix || '/%' then
      raise exception using errcode = '23514', message = 'Protected redirect source path';
    end if;
    if new.destination_path like '/%'
      and (lower(new.destination_path) = protected_prefix or lower(new.destination_path) like protected_prefix || '/%')
    then
      raise exception using errcode = '23514', message = 'Protected redirect destination path';
    end if;
  end loop;

  destination_internal := case when new.destination_path like '/%' then regexp_replace(new.destination_path, '/+$', '') else null end;
  if destination_internal = '' then destination_internal := '/'; end if;
  if destination_internal = new.source_path then
    raise exception using errcode = '23514', message = 'Redirect source and destination must differ';
  end if;

  if new.status = 'active' and destination_internal is not null then
    with recursive redirect_chain(path, depth) as (
      select destination_internal, 0
      union all
      select regexp_replace(r.destination_path, '/+$', ''), chain.depth + 1
      from redirect_chain chain
      join public.url_redirects r on r.source_path = chain.path
      where r.status = 'active'
        and r.id is distinct from new.id
        and r.destination_path like '/%'
        and chain.depth < 32
    )
    select exists(select 1 from redirect_chain where path = new.source_path)
    into loop_found;
    if loop_found then
      raise exception using errcode = '23514', message = 'Redirect loop detected';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists url_redirects_contract_guard on public.url_redirects;
create trigger url_redirects_contract_guard
before insert or update on public.url_redirects
for each row execute function public.enforce_url_redirect_contract();

alter table public.site_settings enable row level security;
alter table public.url_redirects enable row level security;
alter table public.topics enable row level security;

revoke all on table public.site_settings from anon, authenticated;
revoke all on table public.url_redirects from anon, authenticated;
grant select, insert, update, delete on table public.site_settings to service_role;
grant select, insert, update, delete on table public.url_redirects to service_role;

revoke all on table public.topics from anon, authenticated;
grant select on table public.topics to anon;
grant all on table public.topics to service_role;
drop policy if exists "Allow public read topics" on public.topics;
drop policy if exists topics_anon_published_read on public.topics;
create policy topics_anon_published_read
on public.topics
for select
to anon
using (status = 'published' and deleted_at is null);

revoke all on table public.admin_content_topics from anon, authenticated, service_role;
revoke all on table public.admin_media_assets_catalog from anon, authenticated, service_role;
revoke all on table public.admin_media_folders_catalog from anon, authenticated, service_role;
grant select on table public.admin_content_topics to service_role;
grant select on table public.admin_media_assets_catalog to service_role;
grant select on table public.admin_media_folders_catalog to service_role;

revoke all on sequence public.url_redirects_id_seq from anon, authenticated;
revoke all on sequence public.topics_id_seq from anon, authenticated;
grant usage, select on sequence public.url_redirects_id_seq to service_role;

create or replace function public.global_seo_infrastructure_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'site_settings_service_only',
      not has_table_privilege('anon', 'public.site_settings', 'select')
      and not has_table_privilege('authenticated', 'public.site_settings', 'select')
      and has_table_privilege('service_role', 'public.site_settings', 'select'),
    'url_redirects_service_only',
      not has_table_privilege('anon', 'public.url_redirects', 'select')
      and not has_table_privilege('authenticated', 'public.url_redirects', 'select')
      and has_table_privilege('service_role', 'public.url_redirects', 'select'),
    'admin_views_service_only',
      not has_table_privilege('anon', 'public.admin_content_topics', 'select')
      and not has_table_privilege('authenticated', 'public.admin_content_topics', 'select')
      and not has_table_privilege('anon', 'public.admin_media_assets_catalog', 'select')
      and not has_table_privilege('authenticated', 'public.admin_media_assets_catalog', 'select')
      and not has_table_privilege('anon', 'public.admin_media_folders_catalog', 'select')
      and not has_table_privilege('authenticated', 'public.admin_media_folders_catalog', 'select')
      and has_table_privilege('service_role', 'public.admin_content_topics', 'select')
      and has_table_privilege('service_role', 'public.admin_media_assets_catalog', 'select')
      and has_table_privilege('service_role', 'public.admin_media_folders_catalog', 'select'),
    'topics_publication_policy',
      exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'topics'
          and policyname = 'topics_anon_published_read'
          and roles = array['anon']::name[]
          and qual ilike '%status%published%'
          and qual ilike '%deleted_at%IS NULL%'
      ),
    'topics_no_public_writes',
      not has_table_privilege('anon', 'public.topics', 'insert')
      and not has_table_privilege('anon', 'public.topics', 'update')
      and not has_table_privilege('anon', 'public.topics', 'delete')
      and not has_table_privilege('authenticated', 'public.topics', 'insert')
      and not has_table_privilege('authenticated', 'public.topics', 'update')
      and not has_table_privilege('authenticated', 'public.topics', 'delete')
  );
$$;

revoke all on function public.is_valid_global_seo_settings(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_global_seo_settings(jsonb) to service_role;
revoke all on function public.enforce_url_redirect_contract() from public, anon, authenticated;
revoke all on function public.global_seo_infrastructure_health() from public, anon, authenticated;
grant execute on function public.global_seo_infrastructure_health() to service_role;

comment on function public.global_seo_infrastructure_health() is
  'Read-only proof for the bounded Global SEO grants and Topics anon publication policy.';

commit;
