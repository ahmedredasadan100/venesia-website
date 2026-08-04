-- FOOTER & PUBLIC COMPOSITION TRUTH CLOSURE
-- Removes the duplicate footer.brand row only after exact parity with the
-- canonical footer.slots projection, preserves the removed value in Audit,
-- and proves that Home and Media Center can retire code-owned composition.

begin;

do $$
declare
  slots_value jsonb;
  brand_value jsonb;
  canonical_brand jsonb;
  canonical_key_count integer;
begin
  select value into slots_value from public.site_settings where key = 'footer.slots';
  select value into brand_value from public.site_settings where key = 'footer.brand';

  if slots_value is null or jsonb_typeof(slots_value->'slots') <> 'array'
     or jsonb_array_length(slots_value->'slots') <> 4 then
    raise exception 'Footer closure refused: footer.slots is missing or does not contain exactly four slots';
  end if;
  if brand_value is null then
    raise exception 'Footer closure refused: footer.brand legacy evidence is missing';
  end if;

  select count(*) into canonical_key_count
  from public.site_settings
  where key in ('footer.slots', 'footer.contact_items', 'footer.social_links', 'footer.legal');
  if canonical_key_count <> 4 then
    raise exception 'Footer closure refused: expected four canonical footer settings, found %', canonical_key_count;
  end if;

  select jsonb_build_object(
    'title', coalesce(text_slot->'config'->>'title', ''),
    'tagline', coalesce(text_slot->'config'->>'body', ''),
    'contactHeading', coalesce(contact_slot->>'heading', ''),
    'mediaHeading', coalesce(media_slot->>'heading', '')
  ) into canonical_brand
  from
    (select slot from jsonb_array_elements(slots_value->'slots') slot where slot->>'type' = 'text' limit 1) text_row,
    (select slot from jsonb_array_elements(slots_value->'slots') slot where slot->>'type' = 'contact' limit 1) contact_row,
    (select slot from jsonb_array_elements(slots_value->'slots') slot where slot->>'type' = 'media' limit 1) media_row,
    lateral (select text_row.slot as text_slot) text_value,
    lateral (select contact_row.slot as contact_slot) contact_value,
    lateral (select media_row.slot as media_slot) media_value;

  if canonical_brand is null or brand_value <> canonical_brand then
    raise exception 'Footer closure refused: footer.brand does not match the canonical footer.slots projection';
  end if;

  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values (
    null,
    'system:migration',
    'footer.legacy_brand_removed',
    'site_settings',
    null,
    'footer.brand',
    jsonb_build_object(
      'migration', '20260805090000_footer_public_composition_truth_closure',
      'removed_key', 'footer.brand',
      'legacy_value', brand_value,
      'canonical_projection', canonical_brand,
      'canonical_owner', 'footer.slots'
    )
  );

  delete from public.site_settings where key = 'footer.brand';
end;
$$;

do $$
declare
  home_assignment_count integer;
  media_hub_assignment_count integer;
  media_sidebar_assignment_count integer;
  media_hero_assignment_count integer;
begin
  select count(*) into home_assignment_count
  from public.page_content_block_assignments assignment
  join public.pages page on page.id = assignment.page_id
  join public.content_block_templates template on template.id = assignment.template_id
  where page.slug = 'home'
    and page.status = 'published'
    and template.slug in ('home-story', 'home-projects', 'home-trust', 'home-contact')
    and template.status = 'published'
    and assignment.slot = 'main'
    and assignment.is_visible;
  if home_assignment_count <> 4 then
    raise exception 'Public composition closure refused: expected four published visible Home assignments, found %', home_assignment_count;
  end if;

  select count(*) into media_hub_assignment_count
  from public.page_media_hub_module_assignments assignment
  join public.pages page on page.id = assignment.page_id
  join public.media_hub_module_templates template on template.id = assignment.template_id
  where page.slug = 'media-center' and page.status = 'published'
    and assignment.slot = 'main' and assignment.is_visible
    and template.status = 'published' and template.config->>'source' = 'topics';
  if media_hub_assignment_count <> 5 then
    raise exception 'Public composition closure refused: expected five Media Hub assignments, found %', media_hub_assignment_count;
  end if;

  select count(*) into media_sidebar_assignment_count
  from public.page_media_sidebar_module_assignments assignment
  join public.pages page on page.id = assignment.page_id
  join public.media_sidebar_module_templates template on template.id = assignment.template_id
  where page.slug in (
    'media-center', 'media-center-news', 'media-center-videos',
    'media-center-gallery', 'media-center-press', 'media-center-site-updates'
  ) and page.status = 'published'
    and assignment.slot = 'sidebar' and assignment.is_visible
    and template.status = 'published'
    and (template.widget_key = 'sections' or template.config->>'source' = 'topics');
  if media_sidebar_assignment_count <> 18 then
    raise exception 'Public composition closure refused: expected eighteen Media Sidebar assignments, found %', media_sidebar_assignment_count;
  end if;

  select count(*) into media_hero_assignment_count
  from public.hero_assignments assignment
  join public.pages page on page.id = assignment.target_id and assignment.target_type = 'page'
  join public.hero_templates template on template.id = assignment.hero_id
  where page.slug in (
    'media-center', 'media-center-news', 'media-center-videos',
    'media-center-gallery', 'media-center-press', 'media-center-site-updates'
  ) and page.status = 'published' and assignment.is_active and template.is_visible;
  if media_hero_assignment_count <> 6 then
    raise exception 'Public composition closure refused: expected six active Media Center heroes, found %', media_hero_assignment_count;
  end if;

  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values (
    null,
    'system:migration',
    'public_composition.code_fallback_retired',
    'page_composition',
    null,
    'home-and-media-center',
    jsonb_build_object(
      'migration', '20260805090000_footer_public_composition_truth_closure',
      'home_assignments', home_assignment_count,
      'media_hub_assignments', media_hub_assignment_count,
      'media_sidebar_assignments', media_sidebar_assignment_count,
      'media_hero_assignments', media_hero_assignment_count,
      'public_failure_mode', 'empty_fail_safe',
      'compatibility_owner', null
    )
  );
end;
$$;

do $$
declare
  footer_brand_count integer;
  audit_count integer;
begin
  select count(*) into footer_brand_count from public.site_settings where key = 'footer.brand';
  if footer_brand_count <> 0 then
    raise exception 'Footer closure failed: footer.brand still exists';
  end if;
  select count(*) into audit_count
  from public.admin_audit_logs
  where metadata->>'migration' = '20260805090000_footer_public_composition_truth_closure';
  if audit_count <> 2 then
    raise exception 'Footer/Public Composition closure failed: expected two Audit rows, found %', audit_count;
  end if;
end;
$$;

create or replace function public.save_footer_settings(
  p_settings jsonb,
  p_actor_admin_user_id bigint,
  p_actor_username text,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  setting_count integer;
  invalid_key_count integer;
  updated_at_value timestamptz := now();
begin
  if jsonb_typeof(p_settings) <> 'array' or jsonb_array_length(p_settings) = 0 then
    raise exception 'Footer persistence requires a non-empty settings array';
  end if;

  select count(*), count(*) filter (
    where element->>'key' not in ('footer.slots', 'footer.contact_items', 'footer.social_links', 'footer.legal')
      or element->'value' is null
  )
  into setting_count, invalid_key_count
  from jsonb_array_elements(p_settings) element;

  if invalid_key_count > 0 then
    raise exception 'Footer persistence rejected % invalid setting entries', invalid_key_count;
  end if;
  if (select count(distinct element->>'key') from jsonb_array_elements(p_settings) element) <> setting_count then
    raise exception 'Footer persistence rejected duplicate setting keys';
  end if;

  insert into public.site_settings (key, value, updated_at)
  select element->>'key', element->'value', updated_at_value
  from jsonb_array_elements(p_settings) element
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values (
    p_actor_admin_user_id,
    p_actor_username,
    p_action,
    'footer_settings',
    null,
    'footer.slots',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'persisted_keys', (select jsonb_agg(element->>'key' order by element->>'key') from jsonb_array_elements(p_settings) element),
      'persistence_owner', 'save_footer_settings'
    )
  );

  return jsonb_build_object('updated_at', updated_at_value, 'settings_count', setting_count);
end;
$$;

revoke all on function public.save_footer_settings(jsonb, bigint, text, text, jsonb) from public;
revoke all on function public.save_footer_settings(jsonb, bigint, text, text, jsonb) from anon;
revoke all on function public.save_footer_settings(jsonb, bigint, text, text, jsonb) from authenticated;
grant execute on function public.save_footer_settings(jsonb, bigint, text, text, jsonb) to service_role;

comment on function public.save_footer_settings(jsonb, bigint, text, text, jsonb) is
  'Atomic Footer persistence and Audit owner; accepts canonical Footer setting keys only.';

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
        where config->>'source' is distinct from 'topics' or config->>'type' = 'site-update'
      ) and not exists (
        select 1 from public.media_sidebar_module_templates
        where widget_key <> 'sections' and config->>'source' is distinct from 'topics'
      ),
    'public_media_link_contract',
      not exists (select 1 from public.menu_items where linked_type = 'media_items'),
    'public_media_migrated_category_count',
      (select count(*) from public.admin_audit_logs where action = 'public_media.legacy_category_migrated'
        and metadata->>'migration' = '20260804180000_public_media_truth_closure'),
    'public_media_migrated_count',
      (select count(*) from public.admin_audit_logs where action = 'public_media.legacy_item_migrated'
        and metadata->>'migration' = '20260804180000_public_media_truth_closure'),
    'public_media_seo_normalization_count',
      (select count(*) from public.admin_audit_logs where action = 'public_media.seo_title_normalized'
        and metadata->>'migration' = '20260804180000_public_media_truth_closure'
        and (metadata->>'normalized_length')::integer <= 60),
    'public_media_published_count',
      (select count(*) from public.topics
        where content_type in ('news', 'press', 'site_update', 'video', 'gallery')
          and status = 'published' and deleted_at is null),
    'footer_single_source',
      not exists (select 1 from public.site_settings where key = 'footer.brand')
      and (select count(*) from public.site_settings
        where key in ('footer.slots', 'footer.contact_items', 'footer.social_links', 'footer.legal')) = 4,
    'footer_orphan_setting_count',
      (select count(*) from public.site_settings where key = 'footer.brand'),
    'home_composition_assignment_count',
      (select count(*)
       from public.page_content_block_assignments assignment
       join public.pages page on page.id = assignment.page_id
       join public.content_block_templates template on template.id = assignment.template_id
       where page.slug = 'home' and page.status = 'published'
         and template.slug in ('home-story', 'home-projects', 'home-trust', 'home-contact')
         and template.status = 'published' and assignment.slot = 'main' and assignment.is_visible),
    'media_hub_composition_assignment_count',
      (select count(*)
       from public.page_media_hub_module_assignments assignment
       join public.pages page on page.id = assignment.page_id
       join public.media_hub_module_templates template on template.id = assignment.template_id
       where page.slug = 'media-center' and page.status = 'published'
         and assignment.slot = 'main' and assignment.is_visible
         and template.status = 'published' and template.config->>'source' = 'topics'),
    'media_sidebar_composition_assignment_count',
      (select count(*)
       from public.page_media_sidebar_module_assignments assignment
       join public.pages page on page.id = assignment.page_id
       join public.media_sidebar_module_templates template on template.id = assignment.template_id
       where page.slug in ('media-center', 'media-center-news', 'media-center-videos', 'media-center-gallery', 'media-center-press', 'media-center-site-updates')
         and page.status = 'published' and assignment.slot = 'sidebar' and assignment.is_visible
         and template.status = 'published'
         and (template.widget_key = 'sections' or template.config->>'source' = 'topics')),
    'media_hero_composition_assignment_count',
      (select count(*)
       from public.hero_assignments assignment
       join public.pages page on page.id = assignment.target_id and assignment.target_type = 'page'
       join public.hero_templates template on template.id = assignment.hero_id
       where page.slug in ('media-center', 'media-center-news', 'media-center-videos', 'media-center-gallery', 'media-center-press', 'media-center-site-updates')
         and page.status = 'published' and assignment.is_active and template.is_visible),
    'public_composition_unresolved_reference_count',
      (
        (select count(*) from public.page_content_block_assignments a left join public.pages p on p.id = a.page_id left join public.content_block_templates t on t.id = a.template_id where p.id is null or t.id is null)
        + (select count(*) from public.page_cta_block_assignments a left join public.pages p on p.id = a.page_id left join public.cta_block_templates t on t.id = a.template_id where p.id is null or t.id is null)
        + (select count(*) from public.page_cards_block_assignments a left join public.pages p on p.id = a.page_id left join public.cards_block_templates t on t.id = a.template_id where p.id is null or t.id is null)
        + (select count(*) from public.page_breadcrumb_block_assignments a left join public.pages p on p.id = a.page_id left join public.breadcrumb_block_templates t on t.id = a.template_id where p.id is null or t.id is null)
        + (select count(*) from public.page_media_hub_module_assignments a left join public.pages p on p.id = a.page_id left join public.media_hub_module_templates t on t.id = a.template_id where p.id is null or t.id is null)
        + (select count(*) from public.page_media_sidebar_module_assignments a left join public.pages p on p.id = a.page_id left join public.media_sidebar_module_templates t on t.id = a.template_id where p.id is null or t.id is null)
      ),
    'footer_public_composition_audit_count',
      (select count(*) from public.admin_audit_logs
       where metadata->>'migration' = '20260805090000_footer_public_composition_truth_closure')
  );
$$;

revoke all on function public.global_seo_infrastructure_health() from public;
revoke all on function public.global_seo_infrastructure_health() from anon;
revoke all on function public.global_seo_infrastructure_health() from authenticated;
grant execute on function public.global_seo_infrastructure_health() to service_role;

comment on function public.global_seo_infrastructure_health() is
  'Read-only proof for Global SEO, Public Media, Footer, and canonical Public Page Composition ownership.';

commit;
