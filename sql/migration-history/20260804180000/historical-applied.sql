-- PUBLIC MEDIA TRUTH CLOSURE
--
-- Purpose:
--   Move the legacy public editorial media records into the existing Unified
--   Content owner (public.topics), migrate dependent configuration/references,
--   and remove the parallel public.media_items/public.media_categories owners.
--
-- Data impact:
--   * Preserves every legacy media item as one topics row with the same slug,
--     publication state, dates, presentation fields, SEO fields, and media paths.
--   * Preserves legacy fine-grained media categories under the existing
--     media-center topic category root.
--   * Preserves the legacy project badge in topics.media_project.
--   * Normalizes exactly fourteen over-limit SEO titles by removing only the
--     repeated brand suffix, with before/after evidence in admin_audit_logs.
--   * Rebinds typed menu/media-reference identities to the migrated topic IDs.
--   * Converts Media Hub/Sidebar source contracts to topics.
--   * Drops public.media_items and public.media_categories only after parity
--     assertions pass inside the same transaction.
--
-- Safety / forward-fix:
--   The migration aborts before any commit on slug collision, missing category,
--   serialized legacy link ownership, or row-count mismatch. After commit, the
--   canonical topics rows are the forward-fix source; the dropped tables must not
--   be recreated because that would restore a parallel public truth.
--
-- Dependencies:
--   20250705000000_topics_content_type.sql
--   20250705120000_topics_media_payload.sql
--   20260717070000_unified_content_engine_foundation.sql
--   20260804120000_global_seo_capability_closure.sql

begin;

alter table public.topics
  add column if not exists media_project text;

comment on column public.topics.media_project is
  'Optional public media project badge; owned by Unified Content for non-article media entries.';

create temporary table public_media_migration_map (
  legacy_id bigint primary key,
  topic_id bigint not null unique
) on commit drop;

create temporary table public_media_seo_normalization_evidence (
  legacy_id bigint primary key,
  slug text not null,
  original_seo_title text not null,
  normalized_seo_title text not null,
  original_length integer not null,
  normalized_length integer not null
) on commit drop;

do $$
declare
  collision_count integer;
  missing_category_count integer;
  media_root_count integer;
  seo_overflow_count integer;
  seo_unnormalizable_count integer;
  seo_normalized_overflow_count integer;
  serialized_link_count integer;
  brand_suffix constant text := convert_from(
    decode('207c20d981d98ad986d98ad8b3d98ad8a720d984d984d8aad8b7d988d98ad8b120d8a7d984d8b9d982d8a7d8b1d98a', 'hex'),
    'UTF8'
  );
begin
  if to_regclass('public.media_items') is null then
    raise exception 'public.media_items is missing before Public Media Truth backfill';
  end if;

  if to_regclass('public.media_categories') is null then
    raise exception 'public.media_categories is missing before Public Media Truth backfill';
  end if;

  select count(*) into collision_count
  from public.media_items legacy
  join public.topics topic on topic.slug = legacy.slug;

  if collision_count > 0 then
    raise exception 'Public Media Truth backfill refused: % topic slug collision(s)', collision_count;
  end if;

  select count(*) into missing_category_count
  from public.media_items legacy
  left join public.media_categories category on category.slug = legacy.category_slug
  where legacy.category_slug is not null
    and category.id is null;

  if missing_category_count > 0 then
    raise exception 'Public Media Truth backfill refused: % legacy media category reference(s) are unresolved', missing_category_count;
  end if;

  select count(*) into media_root_count
  from public.topic_categories
  where slug = 'media-center';

  if media_root_count <> 1 then
    raise exception 'Public Media Truth backfill refused: expected exactly one media-center topic category root, found %', media_root_count;
  end if;

  select count(*) into seo_overflow_count
  from public.media_items
  where char_length(seo_title) > 60;

  if seo_overflow_count <> 14 then
    raise exception 'Public Media Truth SEO normalization refused: expected 14 over-limit titles, found %', seo_overflow_count;
  end if;

  select count(*) into seo_unnormalizable_count
  from public.media_items
  where char_length(seo_title) > 60
    and right(seo_title, char_length(brand_suffix)) <> brand_suffix;

  if seo_unnormalizable_count > 0 then
    raise exception 'Public Media Truth SEO normalization refused: % over-limit title(s) do not end with the approved brand suffix', seo_unnormalizable_count;
  end if;

  select count(*) into seo_normalized_overflow_count
  from public.media_items
  where char_length(seo_title) > 60
    and char_length(left(seo_title, char_length(seo_title) - char_length(brand_suffix))) > 60;

  if seo_normalized_overflow_count > 0 then
    raise exception 'Public Media Truth SEO normalization refused: % normalized title(s) still exceed 60 characters', seo_normalized_overflow_count;
  end if;

  select
    (select count(*) from public.hero_templates where config::text like '%media_items%')
    + (select count(*) from public.page_sections where config::text like '%media_items%')
    + (select count(*) from public.cta_block_templates where config::text like '%media_items%')
    + (select count(*) from public.content_block_templates where config::text like '%media_items%')
    + (select count(*) from public.cards_block_templates where config::text like '%media_items%')
    + (select count(*) from public.breadcrumb_block_templates where config::text like '%media_items%')
    + (select count(*) from public.site_settings where value::text like '%media_items%')
  into serialized_link_count;

  if serialized_link_count > 0 then
    raise exception 'Public Media Truth backfill refused: % serialized legacy media link owner(s) require explicit migration', serialized_link_count;
  end if;
end;
$$;

insert into public_media_seo_normalization_evidence (
  legacy_id,
  slug,
  original_seo_title,
  normalized_seo_title,
  original_length,
  normalized_length
)
select
  legacy.id,
  legacy.slug,
  legacy.seo_title,
  left(legacy.seo_title, char_length(legacy.seo_title) - char_length(suffix.value)),
  char_length(legacy.seo_title),
  char_length(left(legacy.seo_title, char_length(legacy.seo_title) - char_length(suffix.value)))
from public.media_items legacy
cross join lateral (
  select convert_from(
    decode('207c20d981d98ad986d98ad8b3d98ad8a720d984d984d8aad8b7d988d98ad8b120d8a7d984d8b9d982d8a7d8b1d98a', 'hex'),
    'UTF8'
  ) as value
) suffix
where char_length(legacy.seo_title) > 60;

do $$
declare
  category_slug_collision_count integer;
begin
  select count(*) into category_slug_collision_count
  from public.media_categories legacy
  join public.topic_categories current on current.slug = legacy.slug;

  if category_slug_collision_count > 0 then
    raise exception 'Public Media Truth category migration refused: % topic category slug collision(s)', category_slug_collision_count;
  end if;
end;
$$;

insert into public.topic_categories (
  name,
  slug,
  description,
  parent_id,
  sort_order,
  is_active,
  status,
  show_in_menu,
  is_featured,
  created_at,
  updated_at
)
select
  legacy.name,
  legacy.slug,
  legacy.description,
  root.id,
  100 + legacy.sort_order,
  legacy.is_active,
  case when legacy.is_active then 'published' else 'draft' end,
  false,
  false,
  legacy.created_at,
  legacy.updated_at
from public.media_categories legacy
cross join public.topic_categories root
where root.slug = 'media-center';

do $$
declare
  legacy_category_count integer;
  migrated_category_count integer;
begin
  select count(*) into legacy_category_count from public.media_categories;
  select count(*) into migrated_category_count
  from public.media_categories legacy
  join public.topic_categories category on category.slug = legacy.slug
  join public.topic_categories root on root.id = category.parent_id and root.slug = 'media-center';

  if legacy_category_count <> migrated_category_count then
    raise exception 'Public Media Truth category parity failed: legacy %, migrated %', legacy_category_count, migrated_category_count;
  end if;
end;
$$;

insert into public.admin_audit_logs (
  actor_admin_user_id,
  actor_username,
  action,
  entity_type,
  entity_id,
  entity_label,
  metadata
)
select
  null,
  'system:migration',
  'public_media.legacy_category_migrated',
  'topic_category',
  category.id,
  legacy.slug,
  jsonb_build_object(
    'migration', '20260804180000_public_media_truth_closure',
    'legacy_media_category_id', legacy.id,
    'legacy_sort_order', legacy.sort_order,
    'legacy_is_active', legacy.is_active,
    'source', 'media_categories',
    'destination', 'topic_categories',
    'parent_slug', 'media-center'
  )
from public.media_categories legacy
join public.topic_categories category on category.slug = legacy.slug;

insert into public.topics (
  slug,
  title,
  excerpt,
  content,
  image,
  image_alt,
  category,
  category_slug,
  category_id,
  content_type,
  media_payload,
  media_project,
  date_label,
  published_at,
  status,
  is_featured,
  is_popular,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  og_image,
  og_image_alt,
  faq,
  show_title_on_page,
  show_image_on_page,
  show_excerpt_on_page,
  deleted_at,
  created_at,
  updated_at
)
select
  legacy.slug,
  legacy.title,
  legacy.excerpt,
  array_to_string(legacy.content, E'\n\n'),
  legacy.image,
  legacy.image_alt,
  legacy.category,
  legacy.category_slug,
  category.id,
  case legacy.type
    when 'site-update' then 'site_update'
    else legacy.type
  end,
  case legacy.type
    when 'video' then jsonb_build_object(
      'kind', 'video',
      'provider', 'youtube',
      'video_url', '',
      'thumbnail', nullif(legacy.image, ''),
      'duration', legacy.duration
    )
    when 'gallery' then jsonb_build_object(
      'kind', 'gallery',
      'images', case
        when nullif(legacy.image, '') is null then '[]'::jsonb
        else jsonb_build_array(jsonb_build_object(
          'url', legacy.image,
          'alt', legacy.image_alt,
          'caption', null
        ))
      end
    )
    else null
  end,
  legacy.project,
  legacy.date_label,
  legacy.published_at::timestamp at time zone 'UTC',
  legacy.status,
  legacy.is_featured,
  legacy.is_popular,
  coalesce(seo_evidence.normalized_seo_title, legacy.seo_title),
  legacy.seo_description,
  legacy.seo_keywords,
  coalesce(legacy.focus_keyword, ''),
  legacy.og_image,
  coalesce(nullif(btrim(legacy.image_alt), ''), legacy.title),
  '[]'::jsonb,
  true,
  true,
  true,
  legacy.deleted_at,
  legacy.created_at,
  legacy.updated_at
from public.media_items legacy
left join public.topic_categories category on category.slug = legacy.category_slug
left join public_media_seo_normalization_evidence seo_evidence on seo_evidence.legacy_id = legacy.id;

insert into public_media_migration_map (legacy_id, topic_id)
select legacy.id, topic.id
from public.media_items legacy
join public.topics topic
  on topic.slug = legacy.slug
 and topic.content_type = case legacy.type
   when 'site-update' then 'site_update'
   else legacy.type
 end;

do $$
declare
  legacy_count integer;
  migrated_count integer;
begin
  select count(*) into legacy_count from public.media_items;
  select count(*) into migrated_count from public_media_migration_map;
  if legacy_count <> migrated_count then
    raise exception 'Public Media Truth row parity failed: legacy %, migrated %', legacy_count, migrated_count;
  end if;
end;
$$;

insert into public.admin_audit_logs (
  actor_admin_user_id,
  actor_username,
  action,
  entity_type,
  entity_id,
  entity_label,
  metadata
)
select
  null,
  'system:migration',
  'public_media.legacy_item_migrated',
  'topic',
  migration.topic_id,
  legacy.slug,
  jsonb_build_object(
    'migration', '20260804180000_public_media_truth_closure',
    'legacy_media_item_id', legacy.id,
    'legacy_type', legacy.type,
    'content_type', case legacy.type when 'site-update' then 'site_update' else legacy.type end,
    'legacy_schema_type', legacy.schema_type,
    'legacy_sort_order', legacy.sort_order,
    'status', legacy.status,
    'source', 'media_items',
    'destination', 'topics'
  )
from public.media_items legacy
join public_media_migration_map migration on migration.legacy_id = legacy.id;

insert into public.admin_audit_logs (
  actor_admin_user_id,
  actor_username,
  action,
  entity_type,
  entity_id,
  entity_label,
  metadata
)
select
  null,
  'system:migration',
  'public_media.seo_title_normalized',
  'topic',
  migration.topic_id,
  evidence.slug,
  jsonb_build_object(
    'migration', '20260804180000_public_media_truth_closure',
    'legacy_media_item_id', evidence.legacy_id,
    'original_seo_title', evidence.original_seo_title,
    'normalized_seo_title', evidence.normalized_seo_title,
    'original_length', evidence.original_length,
    'normalized_length', evidence.normalized_length,
    'transformation', 'removed_approved_brand_suffix_only'
  )
from public_media_seo_normalization_evidence evidence
join public_media_migration_map migration on migration.legacy_id = evidence.legacy_id;

do $$
declare
  evidence_count integer;
  category_audit_count integer;
  migrated_audit_count integer;
begin
  select count(*) into category_audit_count
  from public.admin_audit_logs
  where action = 'public_media.legacy_category_migrated'
    and metadata->>'migration' = '20260804180000_public_media_truth_closure';

  if category_audit_count <> 13 then
    raise exception 'Public Media Truth category audit parity failed: expected 13 rows, found %', category_audit_count;
  end if;

  select count(*) into migrated_audit_count
  from public.admin_audit_logs
  where action = 'public_media.legacy_item_migrated'
    and metadata->>'migration' = '20260804180000_public_media_truth_closure';

  if migrated_audit_count <> 28 then
    raise exception 'Public Media Truth migration audit parity failed: expected 28 rows, found %', migrated_audit_count;
  end if;

  select count(*) into evidence_count
  from public.admin_audit_logs
  where action = 'public_media.seo_title_normalized'
    and metadata->>'migration' = '20260804180000_public_media_truth_closure'
    and (metadata->>'normalized_length')::integer <= 60;

  if evidence_count <> 14 then
    raise exception 'Public Media Truth SEO audit parity failed: expected 14 valid evidence rows, found %', evidence_count;
  end if;
end;
$$;

update public.menu_items menu_item
set
  linked_type = 'topics',
  linked_id = migration.topic_id,
  item_type = 'topic',
  updated_at = now()
from public_media_migration_map migration
where menu_item.linked_type = 'media_items'
  and menu_item.linked_id = migration.legacy_id;

do $$
begin
  if exists (select 1 from public.menu_items where linked_type = 'media_items') then
    raise exception 'Public Media Truth link migration left unresolved media_items references';
  end if;
end;
$$;

update public.media_references reference
set
  domain_key = 'topics',
  entity_type = 'topic',
  entity_identity = migration.topic_id::text,
  edit_href = '/admin/content/topics/' || migration.topic_id::text,
  updated_at = now()
from public_media_migration_map migration
where reference.domain_key = 'legacy_media_items'
  and reference.entity_identity = migration.legacy_id::text;

do $$
begin
  if exists (select 1 from public.media_references where domain_key = 'legacy_media_items') then
    raise exception 'Public Media Truth reference migration left unresolved legacy_media_items rows';
  end if;
end;
$$;

update public.media_hub_module_templates
set
  config = jsonb_set(
    jsonb_set(config, '{source}', '"topics"'::jsonb, true),
    '{type}',
    case when config->>'type' = 'site-update' then '"site_update"'::jsonb else config->'type' end,
    true
  ),
  updated_at = now()
where config->>'source' = 'media_items';

update public.media_sidebar_module_templates
set
  config = jsonb_set(config, '{source}', '"topics"'::jsonb, true),
  updated_at = now()
where config->>'source' = 'media_items';

drop table public.media_items;
drop table public.media_categories;

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
      and not has_table_privilege('authenticated', 'public.topics', 'delete'),
    'public_media_single_source',
      pg_catalog.to_regclass('public.media_items') is null
      and pg_catalog.to_regclass('public.media_categories') is null,
    'public_media_module_contract',
      not exists (
        select 1 from public.media_hub_module_templates
        where config->>'source' is distinct from 'topics'
           or config->>'type' = 'site-update'
      )
      and not exists (
        select 1 from public.media_sidebar_module_templates
        where widget_key <> 'sections'
          and config->>'source' is distinct from 'topics'
      ),
    'public_media_link_contract',
      not exists (select 1 from public.menu_items where linked_type = 'media_items'),
    'public_media_migrated_category_count',
      (
        select count(*)
        from public.admin_audit_logs
        where action = 'public_media.legacy_category_migrated'
          and metadata->>'migration' = '20260804180000_public_media_truth_closure'
      ),
    'public_media_migrated_count',
      (
        select count(*)
        from public.admin_audit_logs
        where action = 'public_media.legacy_item_migrated'
          and metadata->>'migration' = '20260804180000_public_media_truth_closure'
      ),
    'public_media_seo_normalization_count',
      (
        select count(*)
        from public.admin_audit_logs
        where action = 'public_media.seo_title_normalized'
          and metadata->>'migration' = '20260804180000_public_media_truth_closure'
          and (metadata->>'normalized_length')::integer <= 60
      ),
    'public_media_published_count',
      (
        select count(*)
        from public.topics
        where content_type in ('news', 'press', 'site_update', 'video', 'gallery')
          and status = 'published'
          and deleted_at is null
      )
  );
$$;

revoke all on function public.global_seo_infrastructure_health() from public;
revoke all on function public.global_seo_infrastructure_health() from anon;
revoke all on function public.global_seo_infrastructure_health() from authenticated;
grant execute on function public.global_seo_infrastructure_health() to service_role;

comment on function public.global_seo_infrastructure_health() is
  'Read-only proof for bounded Global SEO infrastructure and the single-source Public Media contract.';

commit;
