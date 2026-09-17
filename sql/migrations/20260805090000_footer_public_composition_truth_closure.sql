-- FOOTER & PUBLIC COMPOSITION TRUTH CLOSURE
-- Removes the duplicate footer.brand row only after exact parity with the
-- canonical footer.slots projection, preserves the removed value in Audit,
-- and proves that Home and Media Center can retire code-owned composition.

begin;

-- Reviewed history compatibility: original applied SQL remains archived and
-- is never replayed. Fresh means the exact canonical 1..59 seeded input, not
-- merely missing Home/Footer. These fingerprints qualify that input only;
-- they are not an alternate seed or a definition of Business defaults.
create temporary table footer_composition_migration_input (
  input_state text not null check (input_state in ('proven_fresh','historical_configured')),
  expected_historical_audits integer not null
) on commit drop;

do $footer_composition_classify$
declare
  expected_rows jsonb := $seed_state${"admin_audit_logs":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"admin_user_preferences":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"admin_users":{"count":1,"md5":"f954c911f150f7968a0564a8d39ed847"},"breadcrumb_block_templates":{"count":10,"md5":"d76dac42ddd412be06bab2ab03b3ef28"},"cards_block_templates":{"count":6,"md5":"d5dae6b6a8bd20a966ca4e651b293367"},"content_block_templates":{"count":25,"md5":"9c67b73a55f0b86ce977a37230ca896d"},"cta_block_templates":{"count":4,"md5":"7971bcd090d4b6028769e5006341bf22"},"feed_module_templates":{"count":4,"md5":"d89668238b4d7690650142aef1c07716"},"hero_assignments":{"count":7,"md5":"39f22d013e1f83e618edbee30d18d4b6"},"hero_templates":{"count":7,"md5":"95f6182b981ec7a49aba6b3facef7435"},"media_assets":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"media_delete_reservations":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"media_hub_module_templates":{"count":5,"md5":"2880146ace13d8fc95a8e963917d1432"},"media_reference_provider_revisions":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"media_reference_write_leases":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"media_references":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"media_sidebar_module_templates":{"count":3,"md5":"a1ea3dee6ca18c19be7eed776bb3fa0e"},"menu_items":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"menus":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"page_breadcrumb_block_assignments":{"count":7,"md5":"890a65754d19c6f76300558f1e11b1dd"},"page_cards_block_assignments":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"page_content_block_assignments":{"count":10,"md5":"a4cbda1e525240f71853c56acd2cbf28"},"page_cta_block_assignments":{"count":1,"md5":"95003d892424a6f2e230aeb1783c2879"},"page_feed_module_assignments":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"page_media_hub_module_assignments":{"count":5,"md5":"13d44c760d6d0b38c939861e3fa84636"},"page_media_sidebar_module_assignments":{"count":18,"md5":"28a81eab87859d89bd50150f32fef131"},"page_sections":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"pages":{"count":8,"md5":"8c4c2a16ee44d0723d6fa6b5bf5705a3"},"project_delivery_items":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"project_features":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"project_floor_plan_details":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"project_floor_plans":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"project_location_points":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"project_locations":{"count":4,"md5":"2400304df6c4cfd47ef71ace50dad8e4"},"project_media":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"project_videos":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"projects":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"site_settings":{"count":8,"md5":"a5973fb0a6b35c72e92e0e7395298f84"},"topic_categories":{"count":6,"md5":"193cec088e1909272202cf9bc1c5ebdd"},"topic_series":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"},"topics":{"count":50,"md5":"44798be0400990aa47537bed1d6ef148"},"url_redirects":{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}}$seed_state$::jsonb;
  expected_registry jsonb := $registry$[{"version":"20250618000000","name":"foundational_schema_baseline","statement_sha256":"9834464897ccfc7d9f14ef0b8e4e140ce54b5e29b65846f923971f081937c074"},{"version":"20250618100000","name":"page_blocks_phase1","statement_sha256":"bb80dee21136e4f749100b107cc334aeb25d624521963f65ca9a019f4f53fcac"},{"version":"20250618200000","name":"about_page_blocks_seed","statement_sha256":"48a6574e7d3624ed70ec52f20ecfa97cc3a64e4c5a0c391de570cf8c82cdabf6"},{"version":"20250618300000","name":"contact_page_blocks_seed","statement_sha256":"b1919f6976a411a0aa1507afb09fef95187fdae1bcf48513594d8576484235c5"},{"version":"20250618400000","name":"topics_page_blocks_seed","statement_sha256":"7cd0088ccaaf1c019c2522e70ea728479faeffc5720176c27365f16824710701"},{"version":"20250618500000","name":"breadcrumb_module","statement_sha256":"28d90a41fc94725003f8fa7be5218b7fafcc2805aa5de1fc20a7e4e94391d46c"},{"version":"20250618510000","name":"breadcrumb_page_seeds","statement_sha256":"56e2381ba633a63a218aa245d7ed5f940fd953e2d8b44c928e0f0d3e04cb061d"},{"version":"20250618600000","name":"layout_slots_migration","statement_sha256":"0a8953b5db16cdcce4cb3d524c2b0efa71e76dc6252887b85ff61363e24e70fe"},{"version":"20250618700000","name":"about_intro_module_config","statement_sha256":"15418de658aec011a70ae06ba845941ebd7c8944785e0d9e53962bc3bb5e223c"},{"version":"20250618800000","name":"vision_goals_module","statement_sha256":"9a74dfa8623df94fe459ac65b8f57e54fec95e4e15ae25a42f6e84fb7f3df678"},{"version":"20250618900000","name":"about_cta_module","statement_sha256":"c78fcdd37b016217fddcfca0938f428f8c48081600e70c86bcce7638484c9348"},{"version":"20250619000000","name":"about_principles_approach_modules","statement_sha256":"c0db4134fb03c80ba02e461bbb6cc729ddd81a07847d57c59f144e55252291f6"},{"version":"20250620000000","name":"projects_cms_core","statement_sha256":"cb70d91727d4aa1af64f26c220f0e6d416c3033811f6adde3ff83877325ca6c1"},{"version":"20250621000000","name":"sync_project_children_rpc","statement_sha256":"0646d8c7e65a69a7bb089451d545550916eb6cea9693ed5e51a0ecac9a40fe06"},{"version":"20250622000000","name":"feed_modules_topics","statement_sha256":"60a7de6d0fc8da8666dba24b669efe0e7bed29868134c1b0d4f5eaa25e2b5674"},{"version":"20250623000000","name":"topic_series_category_id","statement_sha256":"50f3c0b30e1c9d45dbd20ebc5489a13bcf1409d82417e42e199389b6a8659fbc"},{"version":"20250624000000","name":"home_story_module_seed","statement_sha256":"e8815d28c3c4a67b421bd895ef15a152bc90ea544b4c162d41639326ec6c43a1"},{"version":"20250624100000","name":"home_trust_module_seed","statement_sha256":"d0a5c01f98f235a42273ab49b7ca0fe5178e7ef30859ac928be26c352afb4581"},{"version":"20250624200000","name":"home_contact_module_seed","statement_sha256":"3534413bc7dc877ed9d653af084bbb799777f3be4607fc169eac49cad91dcaa0"},{"version":"20250624300000","name":"home_projects_module_seed","statement_sha256":"054b97f5b79df598b0d1ca5ffef118b4d0c236e9ee7ee6514df5c80945ac3974"},{"version":"20250624400000","name":"home_main_slot_sort_order","statement_sha256":"882999f62407deb54f154788776ac852705ce9e0faeae9de3d52e2455d6fd0a7"},{"version":"20250625000000","name":"media_center_cms_pages_seed","statement_sha256":"3760e700839a60b2e639899e6c1c0502a9e767b34c79e5576adec1ed00d86e0b"},{"version":"20250625100000","name":"media_center_listing_modules_seed","statement_sha256":"11bd3888be16e2df9788bc549b8a5684821edec4f3a47308b5bb3c8146455aa8"},{"version":"20250625200000","name":"media_sidebar_modules","statement_sha256":"4db8bb33fc1739b201903bab32fceced01f072afb0d8f1f352536c0a710462bb"},{"version":"20250625300000","name":"media_hub_modules","statement_sha256":"68cdd9f15cf6155be847b5e0a5909b942e5994134d31ae57e5e7192838a92ec0"},{"version":"20250625400000","name":"site_settings_footer","statement_sha256":"3d4912ead4f8e5ff21e7b21d8a4f215d061813649f48003a2892011a6dafcce2"},{"version":"20250625500000","name":"site_settings_maintenance_mode","statement_sha256":"4b4d37ee44a739e81c2cda8d74a270c7653d028b6a8cf15f1ae33d312decd5f9"},{"version":"20250625510000","name":"track_your_project_cms_seed","statement_sha256":"69562b30d125df8a1382cabd46d80b6da675eec58af3459268e0bbfcd2cab779"},{"version":"20250625600000","name":"admin_users","statement_sha256":"9ebe2c3cb2d1188b680c45a0ecf20ecf4ba1d5d0ec06b8a63f959dc770c0c4eb"},{"version":"20250625700000","name":"admin_audit_logs","statement_sha256":"afcc5cec7c3a9ad4d42d70cc65cc0f4460297093915041ee5b179c3b26117f56"},{"version":"20250705000000","name":"topics_content_type","statement_sha256":"dc4f555291c59c5f37577bc22cd3caa7ef0a8bb4ddb0354fc98ff309520fa56e"},{"version":"20250705100000","name":"topic_categories_media_branch_seed","statement_sha256":"e745960f6ba56e849bb1f6b153741828c2fab5739faa2719926af7c96840c395"},{"version":"20250705120000","name":"topics_media_payload","statement_sha256":"646a9b60659dcb2999f9de3d1ca77b19089ba7fcd32cc384ec2207c38205b265"},{"version":"20250705130000","name":"unified_media_topics_seed","statement_sha256":"1e8168a0a7e88ebc56fb88e6d7a113d88a7f34902de52a283b31a25324df3c07"},{"version":"20250708100000","name":"fix_sync_project_children_empty_checks","statement_sha256":"25f911d0e0cc32916d77a59f7956f84be6418161380744de1fa7feff51f8e6d7"},{"version":"20250710120000","name":"url_redirects","statement_sha256":"414a424c8f528aa34a3c917a50df21c840f84f647eaab9645106cbc9ed1dcc3d"},{"version":"20250712120000","name":"projects_hub_cms_foundation","statement_sha256":"f07e913ea867b85b1c2f59bec808f676767c1865f204edffe08416398c622a36"},{"version":"20250715120000","name":"about_intro_single_image_module","statement_sha256":"22c651c98d29009757578697bc96f1115a84a06e4df7c069e4174b4f362d58df"},{"version":"20260717070000","name":"unified_content_engine_foundation","statement_sha256":"56285d3c1bbc2cc048f692bde29a7af6be4f92290adf50e40027ee09e6bcceee"},{"version":"20260720060000","name":"admin_pages_list_read_model","statement_sha256":"709603c0f0f71db19616ff7bc0d75a1715ce4ab1b457b7a87a4f1bce9358e2b7"},{"version":"20260720100000","name":"admin_pages_list_read_model_page_normalization","statement_sha256":"654d8778265728372a1ec95eb6f669556ca1bd2ecf5b5588fa5308763f1375cd"},{"version":"20260721030000","name":"admin_projects_list_read_model","statement_sha256":"c23c5ab559eab717f5cd89c8cf3b73b63e641ed689b253e4bec5280bba376eef"},{"version":"20260721143000","name":"topics_page_display_settings","statement_sha256":"9d96868d3b93ef962c0c9496ba905414d413477240e23a2e6158dc5589306612"},{"version":"20260722120000","name":"topics_seo_overrides","statement_sha256":"e2aaefeb0400f41a0a763f2c5157c193646605bb0b3131777682589254dddb20"},{"version":"20260722160000","name":"cms_media_storage_buckets","statement_sha256":"6343bf461689f5c92482496f315bd683599380756ee35f3c619c54f8b993dd2a"},{"version":"20260723040000","name":"content_taxonomy_data_runtime","statement_sha256":"36b48fb81966683684e52c7566dd9e07512fdc58845c85f3bd93c107ffef2048"},{"version":"20260725090000","name":"media_catalog_reference_foundation","statement_sha256":"adb6589af2f110fa469b8ecf8ddcd04d3ece1f178f3eaa9b44107839b33170f8"},{"version":"20260725180000","name":"media_delete_reservation_saga","statement_sha256":"f055739476e66113c4614cab69579994f61048c67bd8d9bd0765d3d12dc252c1"},{"version":"20260726070000","name":"media_coordination_rpc_acl_hardening","statement_sha256":"e7bd7c73971f00a9977179875038b881d2b58383c3596f37f1444e5382af16b2"},{"version":"20260728090000","name":"rebuild_project_admin_data_entry","statement_sha256":"f3e8ed6c8b7697c5253b9e3857277b8d60668075a34ca0ea7c974ed68b8ca226"},{"version":"20260729090000","name":"project_admin_entry_acl_correction","statement_sha256":"d02606c88aff7cda95f7564d841007dd68acdba2a307b6ade862d4a71149653f"},{"version":"20260729150000","name":"project_admin_schema_parity_forward_fix","statement_sha256":"a0acbd4a1a83c29abe184a781ee9b47e601da152f0f917e6a3b5b0d5c0c9b4b9"},{"version":"20260730100000","name":"project_admin_save_rpc_conflict_arbiter_fix","statement_sha256":"1044d58001d1ff45fc2fbcefd3904886377c791e4b362a1bf1f6547e436f14fa"},{"version":"20260731100000","name":"project_row_actions_capability","statement_sha256":"8e178803c05eaf5eb588da3c9440c5dbb02170e33d7390c4bddeccd5a087ed7b"},{"version":"20260803120000","name":"project_publishing_visibility_capability","statement_sha256":"e23697708a0c27019500f1289ff35d94e59dbb32e511cadd5a426117cb2ac88c"},{"version":"20260803153000","name":"shared_entity_seo_capability","statement_sha256":"d73f2261562e657b318ed448983b289ebc2554c48796d3d9f91512ecd36b7bba"},{"version":"20260803190000","name":"content_review_publishing_reconciliation","statement_sha256":"9ba4d96969cf75918a3eb8b4a33d4f27d91ed91395827dccb96c46e1976fcee7"},{"version":"20260804120000","name":"global_seo_capability_closure","statement_sha256":"5c51c98bcbd4ed212d19c4e8122a9b89fed1356b375165a07206dbab7ea36918"},{"version":"20260804180000","name":"public_media_truth_closure","statement_sha256":"84eb7d29186a99b243fafbca3364a55b66a4c51967ec55461132ad8503480af2"}]$registry$::jsonb;
  observed_rows jsonb := '{}'::jsonb;
  observed_registry jsonb;
  folder_rows jsonb;
  row_proof jsonb;
  relation record;
  media_proof jsonb;
begin
  if current_user <> 'postgres' then
    raise exception 'Footer initialization requires the canonical postgres migration owner';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='footer_public_composition_provenance') then
    raise exception 'Footer initialization refused: pre-existing provenance is ambiguous';
  end if;
  if exists (
    select 1 from (values ('pages','p',array['id']::text[]),('pages','u',array['slug']::text[]),
      ('pages','u',array['path']::text[]),('site_settings','p',array['key']::text[])) required(table_name,kind,columns)
    where not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid=pg_catalog.to_regclass('public.'||required.table_name)
        and c.contype::text=required.kind and c.convalidated and c.conislocal and c.coninhcount=0
        and not c.condeferrable and not c.condeferred
        and array(select a.attname::text from unnest(c.conkey) with ordinality k(attnum,ordinal)
          join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum order by k.ordinal)=required.columns)
  ) or exists (
    select 1 from (values ('pages','id','bigint'),('pages','title','text'),('pages','slug','text'),('pages','path','text'),
      ('pages','page_type','text'),('pages','status','text'),('pages','is_system','boolean'),
      ('site_settings','key','text'),('site_settings','value','jsonb')) required(table_name,column_name,type_name)
    where not exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass('public.'||required.table_name)
      and a.attname=required.column_name and not a.attisdropped and a.attnotnull
      and pg_catalog.format_type(a.atttypid,a.atttypmod)=required.type_name)
  ) then
    raise exception 'Footer initialization refused: Page or Footer structural contract differs';
  end if;
  lock table public.site_settings, public.pages, public.page_content_block_assignments,
    public.admin_audit_logs in share row exclusive mode;
  if exists (select 1 from public.site_settings where key='footer.slots')
    and exists (select 1 from public.site_settings where key='footer.brand')
    and exists (select 1 from public.pages where slug='home') then
    -- This selects the existing strict assertions, never an exemption from them.
    insert into pg_temp.footer_composition_migration_input values ('historical_configured',2);
    return;
  end if;
  if pg_catalog.to_regprocedure('public.public_media_closure_provenance()') is null then
    raise exception 'Footer initialization refused: fresh input provenance is missing';
  end if;
  select public.public_media_closure_provenance() into media_proof;
  if media_proof->>'input_state' is distinct from 'validated-empty-legacy'
    or media_proof->>'migration_revision' is distinct from 'validated-legacy-input-v1'
    or media_proof->>'migration_registered' is distinct from 'true'
    or media_proof->>'structural_complete' is distinct from 'true' then
    raise exception 'Footer initialization refused: input is not proven canonical fresh state';
  end if;
  select jsonb_agg(jsonb_build_object('version',version,'name',name,
      'statement_sha256',encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex')) order by version)
    into observed_registry from supabase_migrations.schema_migrations;
  if observed_registry is distinct from expected_registry then
    raise exception 'Footer initialization refused: canonical migration prefix differs';
  end if;
  -- The Media catalog owns folder identity through UNIQUE normalized_path;
  -- its two root rows have generated UUIDs. Compare that complete logical
  -- identity and payload, excluding only those UUIDs and creation/update clocks.
  lock table public.media_folders in share row exclusive mode;
  select jsonb_agg(to_jsonb(f)-'id'-'created_at'-'updated_at' order by normalized_path)
    into folder_rows from public.media_folders f;
  if folder_rows is distinct from '[{"normalized_path":"files","parent_path":null,"display_name":"المستندات","created_by":null,"reconciliation_state":"synced"},{"normalized_path":"images","parent_path":null,"display_name":"الصور","created_by":null,"reconciliation_state":"synced"}]'::jsonb then
    raise exception 'Footer initialization refused: canonical Media folder seed differs';
  end if;
  -- Lock then compare remaining application tables. Every value except the
  -- documented creation/update clocks participates, including identities and
  -- Admin/Audit state. Unknown tables, missing tables or any row drift fail.
  for relation in select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname<>'media_folders' order by c.relname loop
    execute pg_catalog.format('lock table public.%I in share row exclusive mode',relation.relname);
    execute pg_catalog.format(
      'select jsonb_build_object(''count'',count(*)::int,''md5'',md5(coalesce(string_agg((to_jsonb(t)-''created_at''-''updated_at'')::text,E''\n'' order by (to_jsonb(t)-''created_at''-''updated_at'')::text),''''))) from public.%I t',relation.relname) into row_proof;
    observed_rows := observed_rows || jsonb_build_object(relation.relname,row_proof);
  end loop;
  if observed_rows is distinct from expected_rows then
    raise exception 'Footer initialization refused: partial or ambiguous seeded input';
  end if;
  insert into pg_temp.footer_composition_migration_input values ('proven_fresh',0);

  -- Footer owner: structural Reset preset without business values or public
  -- activation. Source parity is verified against createFreshFooterSettings().
  insert into public.site_settings(key,value) values
    ('footer.slots',$fresh_footer${"version":1,"slots":[{"index":1,"enabled":false,"type":"text","heading":null,"config":{"title":"","body":"","showBrandIcon":false,"cta":{"enabled":false,"label":"","href":"","target":"_self"}}},{"index":2,"enabled":false,"type":"menu","heading":null,"config":{"source":"location","menuId":null,"location":"footer","fallbackLocation":"footer","maxItems":null,"showOnlyTopLevel":true}},{"index":3,"enabled":false,"type":"media","heading":null,"config":{"source":"main_submenu","parentHref":"/media-center","parentLink":null,"menuId":null,"manualLinks":[],"maxItems":null}},{"index":4,"enabled":false,"type":"contact","heading":null,"config":{"source":"global","items":[]}}]}$fresh_footer$::jsonb);
  update public.site_settings set value='[]'::jsonb,updated_at=now()
    where key in ('footer.contact_items','footer.social_links');
  update public.site_settings set value='{"copyright":"","tagline":""}'::jsonb,updated_at=now()
    where key='footer.legal';
  -- Only the exact historical seed qualified above is removed. No historical
  -- parity/retirement event is fabricated for this system initialization.
  delete from public.site_settings where key='footer.brand';
  -- Page owner identity. The pre60 CHECK calls non-publication draft; the
  -- later publication migration normalizes it to unpublished.
  insert into public.pages(title,slug,path,page_type,status,is_system)
    values ('الرئيسية','home','/','home','draft',true);
end;
$footer_composition_classify$;


do $$
declare
  slots_value jsonb;
  brand_value jsonb;
  canonical_brand jsonb;
  canonical_key_count integer;
begin
  if (select input_state from pg_temp.footer_composition_migration_input)='proven_fresh' then return; end if;
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
  if (select input_state from pg_temp.footer_composition_migration_input)='historical_configured' and home_assignment_count <> 4 then
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

  if (select input_state from pg_temp.footer_composition_migration_input)='historical_configured' then
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
  end if;
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
  if audit_count <> (select expected_historical_audits from pg_temp.footer_composition_migration_input) then
    raise exception 'Footer/Public Composition closure failed: unexpected historical Audit count %', audit_count;
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


-- Execution provenance is a postgres-owned read-only projection, separate
-- from mutable configuration. Its live fields never freeze readiness at init.
do $footer_composition_completed_path$
declare input_record record; frozen jsonb; body text;
begin
  select * into strict input_record from pg_temp.footer_composition_migration_input;
  frozen := jsonb_build_object('contract_version',1,'migration_version','20260805090000',
    'migration_revision','system-manageable-fresh-v1','input_state',input_record.input_state,
    'expected_historical_audits',input_record.expected_historical_audits);
  body := format($body$
    with h as (select public.global_seo_infrastructure_health() as proof),
    home as (select count(*)::int as identity_count,min(id) as id,min(status) as status,
      bool_and(slug='home' and path='/' and page_type='home') as valid_identity
      from public.pages where slug='home' or path='/')
    select %L::jsonb || jsonb_build_object(
      'migration_registered',exists(select 1 from supabase_migrations.schema_migrations
        where version='20260805090000' and name='footer_public_composition_truth_closure'
          and cardinality(statements)>0),
      'structural_complete',coalesce(home.identity_count=1 and home.valid_identity
        and h.proof->>'footer_single_source'='true'
        and h.proof->>'public_composition_unresolved_reference_count'='0',false),
      'historical_audit_total',(h.proof->>'footer_public_composition_audit_count')::int,
      'historical_audit_counts',jsonb_build_object(
        'footer_brand_removed',(select count(*) from public.admin_audit_logs where action='footer.legacy_brand_removed'
          and metadata->>'migration'='20260805090000_footer_public_composition_truth_closure'),
        'composition_fallback_retired',(select count(*) from public.admin_audit_logs where action='public_composition.code_fallback_retired'
          and metadata->>'migration'='20260805090000_footer_public_composition_truth_closure')),
      'home',jsonb_build_object('identity_count',home.identity_count,'id',home.id,'slug','home','path','/',
        'status',home.status,'assignment_count',(select count(*) from public.page_content_block_assignments where page_id=home.id),
        'published_assignment_count',(h.proof->>'home_composition_assignment_count')::int),
      'footer_settings',(select jsonb_object_agg(key,value) from public.site_settings
        where key in ('footer.slots','footer.contact_items','footer.social_links','footer.legal'))
    ) from h cross join home
  $body$,frozen::text);
  execute format('create function public.footer_public_composition_provenance() returns jsonb language sql stable security definer set search_path = '''' as %L',body);
end;
$footer_composition_completed_path$;
revoke all on function public.footer_public_composition_provenance() from public,anon,authenticated;
grant execute on function public.footer_public_composition_provenance() to service_role;
comment on function public.footer_public_composition_provenance() is
  'Migration60 path provenance and live configuration facts; readiness is evaluated by existing Footer/Global SEO owners.';
notify pgrst, 'reload schema';

commit;
