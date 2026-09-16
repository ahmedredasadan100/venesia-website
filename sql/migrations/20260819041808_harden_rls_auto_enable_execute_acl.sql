-- Migration-history compatibility, authored 2026-09-16 with Project Owner approval.
-- Historical databases retain the original recorded revision without replay or
-- registry rewrite. The original hardening below is preserved byte-for-byte.
-- A proven canonical fresh lineage without the historical pair
-- verifies the existing migration-owned security contract instead; it creates
-- no platform object, policy, permission, persistent marker, or second owner.
-- The fresh branch is read-only. Existing/Production execution is not authorized.

begin;

do $migration86_compatibility$
declare
  v_function_oid oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
  v_function_count integer;
  v_event_count integer;
  v_registry_expected constant jsonb := $reviewed_prefix85$[{"version":"20250618000000","name":"foundational_schema_baseline","statement_count":60,"statements_sha256":"9834464897ccfc7d9f14ef0b8e4e140ce54b5e29b65846f923971f081937c074"},{"version":"20250618100000","name":"page_blocks_phase1","statement_count":14,"statements_sha256":"bb80dee21136e4f749100b107cc334aeb25d624521963f65ca9a019f4f53fcac"},{"version":"20250618200000","name":"about_page_blocks_seed","statement_count":11,"statements_sha256":"48a6574e7d3624ed70ec52f20ecfa97cc3a64e4c5a0c391de570cf8c82cdabf6"},{"version":"20250618300000","name":"contact_page_blocks_seed","statement_count":13,"statements_sha256":"b1919f6976a411a0aa1507afb09fef95187fdae1bcf48513594d8576484235c5"},{"version":"20250618400000","name":"topics_page_blocks_seed","statement_count":6,"statements_sha256":"7cd0088ccaaf1c019c2522e70ea728479faeffc5720176c27365f16824710701"},{"version":"20250618500000","name":"breadcrumb_module","statement_count":6,"statements_sha256":"28d90a41fc94725003f8fa7be5218b7fafcc2805aa5de1fc20a7e4e94391d46c"},{"version":"20250618510000","name":"breadcrumb_page_seeds","statement_count":6,"statements_sha256":"56e2381ba633a63a218aa245d7ed5f940fd953e2d8b44c928e0f0d3e04cb061d"},{"version":"20250618600000","name":"layout_slots_migration","statement_count":12,"statements_sha256":"0a8953b5db16cdcce4cb3d524c2b0efa71e76dc6252887b85ff61363e24e70fe"},{"version":"20250618700000","name":"about_intro_module_config","statement_count":4,"statements_sha256":"15418de658aec011a70ae06ba845941ebd7c8944785e0d9e53962bc3bb5e223c"},{"version":"20250618800000","name":"vision_goals_module","statement_count":5,"statements_sha256":"9a74dfa8623df94fe459ac65b8f57e54fec95e4e15ae25a42f6e84fb7f3df678"},{"version":"20250618900000","name":"about_cta_module","statement_count":5,"statements_sha256":"c78fcdd37b016217fddcfca0938f428f8c48081600e70c86bcce7638484c9348"},{"version":"20250619000000","name":"about_principles_approach_modules","statement_count":6,"statements_sha256":"c0db4134fb03c80ba02e461bbb6cc729ddd81a07847d57c59f144e55252291f6"},{"version":"20250620000000","name":"projects_cms_core","statement_count":13,"statements_sha256":"cb70d91727d4aa1af64f26c220f0e6d416c3033811f6adde3ff83877325ca6c1"},{"version":"20250621000000","name":"sync_project_children_rpc","statement_count":5,"statements_sha256":"0646d8c7e65a69a7bb089451d545550916eb6cea9693ed5e51a0ecac9a40fe06"},{"version":"20250622000000","name":"feed_modules_topics","statement_count":9,"statements_sha256":"60a7de6d0fc8da8666dba24b669efe0e7bed29868134c1b0d4f5eaa25e2b5674"},{"version":"20250623000000","name":"topic_series_category_id","statement_count":5,"statements_sha256":"50f3c0b30e1c9d45dbd20ebc5489a13bcf1409d82417e42e199389b6a8659fbc"},{"version":"20250624000000","name":"home_story_module_seed","statement_count":4,"statements_sha256":"e8815d28c3c4a67b421bd895ef15a152bc90ea544b4c162d41639326ec6c43a1"},{"version":"20250624100000","name":"home_trust_module_seed","statement_count":4,"statements_sha256":"d0a5c01f98f235a42273ab49b7ca0fe5178e7ef30859ac928be26c352afb4581"},{"version":"20250624200000","name":"home_contact_module_seed","statement_count":4,"statements_sha256":"3534413bc7dc877ed9d653af084bbb799777f3be4607fc169eac49cad91dcaa0"},{"version":"20250624300000","name":"home_projects_module_seed","statement_count":4,"statements_sha256":"054b97f5b79df598b0d1ca5ffef118b4d0c236e9ee7ee6514df5c80945ac3974"},{"version":"20250624400000","name":"home_main_slot_sort_order","statement_count":3,"statements_sha256":"882999f62407deb54f154788776ac852705ce9e0faeae9de3d52e2455d6fd0a7"},{"version":"20250625000000","name":"media_center_cms_pages_seed","statement_count":3,"statements_sha256":"3760e700839a60b2e639899e6c1c0502a9e767b34c79e5576adec1ed00d86e0b"},{"version":"20250625100000","name":"media_center_listing_modules_seed","statement_count":20,"statements_sha256":"11bd3888be16e2df9788bc549b8a5684821edec4f3a47308b5bb3c8146455aa8"},{"version":"20250625200000","name":"media_sidebar_modules","statement_count":11,"statements_sha256":"4db8bb33fc1739b201903bab32fceced01f072afb0d8f1f352536c0a710462bb"},{"version":"20250625300000","name":"media_hub_modules","statement_count":14,"statements_sha256":"68cdd9f15cf6155be847b5e0a5909b942e5994134d31ae57e5e7192838a92ec0"},{"version":"20250625400000","name":"site_settings_footer","statement_count":5,"statements_sha256":"3d4912ead4f8e5ff21e7b21d8a4f215d061813649f48003a2892011a6dafcce2"},{"version":"20250625500000","name":"site_settings_maintenance_mode","statement_count":1,"statements_sha256":"4b4d37ee44a739e81c2cda8d74a270c7653d028b6a8cf15f1ae33d312decd5f9"},{"version":"20250625510000","name":"track_your_project_cms_seed","statement_count":12,"statements_sha256":"69562b30d125df8a1382cabd46d80b6da675eec58af3459268e0bbfcd2cab779"},{"version":"20250625600000","name":"admin_users","statement_count":4,"statements_sha256":"9ebe2c3cb2d1188b680c45a0ecf20ecf4ba1d5d0ec06b8a63f959dc770c0c4eb"},{"version":"20250625700000","name":"admin_audit_logs","statement_count":5,"statements_sha256":"afcc5cec7c3a9ad4d42d70cc65cc0f4460297093915041ee5b179c3b26117f56"},{"version":"20250705000000","name":"topics_content_type","statement_count":9,"statements_sha256":"dc4f555291c59c5f37577bc22cd3caa7ef0a8bb4ddb0354fc98ff309520fa56e"},{"version":"20250705100000","name":"topic_categories_media_branch_seed","statement_count":4,"statements_sha256":"e745960f6ba56e849bb1f6b153741828c2fab5739faa2719926af7c96840c395"},{"version":"20250705120000","name":"topics_media_payload","statement_count":4,"statements_sha256":"646a9b60659dcb2999f9de3d1ca77b19089ba7fcd32cc384ec2207c38205b265"},{"version":"20250705130000","name":"unified_media_topics_seed","statement_count":7,"statements_sha256":"1e8168a0a7e88ebc56fb88e6d7a113d88a7f34902de52a283b31a25324df3c07"},{"version":"20250708100000","name":"fix_sync_project_children_empty_checks","statement_count":5,"statements_sha256":"25f911d0e0cc32916d77a59f7956f84be6418161380744de1fa7feff51f8e6d7"},{"version":"20250710120000","name":"url_redirects","statement_count":3,"statements_sha256":"414a424c8f528aa34a3c917a50df21c840f84f647eaab9645106cbc9ed1dcc3d"},{"version":"20250712120000","name":"projects_hub_cms_foundation","statement_count":8,"statements_sha256":"f07e913ea867b85b1c2f59bec808f676767c1865f204edffe08416398c622a36"},{"version":"20250715120000","name":"about_intro_single_image_module","statement_count":4,"statements_sha256":"22c651c98d29009757578697bc96f1115a84a06e4df7c069e4174b4f362d58df"},{"version":"20260717070000","name":"unified_content_engine_foundation","statement_count":29,"statements_sha256":"56285d3c1bbc2cc048f692bde29a7af6be4f92290adf50e40027ee09e6bcceee"},{"version":"20260720060000","name":"admin_pages_list_read_model","statement_count":3,"statements_sha256":"709603c0f0f71db19616ff7bc0d75a1715ce4ab1b457b7a87a4f1bce9358e2b7"},{"version":"20260720100000","name":"admin_pages_list_read_model_page_normalization","statement_count":1,"statements_sha256":"654d8778265728372a1ec95eb6f669556ca1bd2ecf5b5588fa5308763f1375cd"},{"version":"20260721030000","name":"admin_projects_list_read_model","statement_count":3,"statements_sha256":"c23c5ab559eab717f5cd89c8cf3b73b63e641ed689b253e4bec5280bba376eef"},{"version":"20260721143000","name":"topics_page_display_settings","statement_count":6,"statements_sha256":"9d96868d3b93ef962c0c9496ba905414d413477240e23a2e6158dc5589306612"},{"version":"20260722120000","name":"topics_seo_overrides","statement_count":4,"statements_sha256":"e2aaefeb0400f41a0a763f2c5157c193646605bb0b3131777682589254dddb20"},{"version":"20260722160000","name":"cms_media_storage_buckets","statement_count":2,"statements_sha256":"6343bf461689f5c92482496f315bd683599380756ee35f3c619c54f8b993dd2a"},{"version":"20260723040000","name":"content_taxonomy_data_runtime","statement_count":18,"statements_sha256":"36b48fb81966683684e52c7566dd9e07512fdc58845c85f3bd93c107ffef2048"},{"version":"20260725090000","name":"media_catalog_reference_foundation","statement_count":40,"statements_sha256":"adb6589af2f110fa469b8ecf8ddcd04d3ece1f178f3eaa9b44107839b33170f8"},{"version":"20260725180000","name":"media_delete_reservation_saga","statement_count":95,"statements_sha256":"f055739476e66113c4614cab69579994f61048c67bd8d9bd0765d3d12dc252c1"},{"version":"20260726070000","name":"media_coordination_rpc_acl_hardening","statement_count":34,"statements_sha256":"e7bd7c73971f00a9977179875038b881d2b58383c3596f37f1444e5382af16b2"},{"version":"20260728090000","name":"rebuild_project_admin_data_entry","statement_count":66,"statements_sha256":"f3e8ed6c8b7697c5253b9e3857277b8d60668075a34ca0ea7c974ed68b8ca226"},{"version":"20260729090000","name":"project_admin_entry_acl_correction","statement_count":17,"statements_sha256":"d02606c88aff7cda95f7564d841007dd68acdba2a307b6ade862d4a71149653f"},{"version":"20260729150000","name":"project_admin_schema_parity_forward_fix","statement_count":19,"statements_sha256":"a0acbd4a1a83c29abe184a781ee9b47e601da152f0f917e6a3b5b0d5c0c9b4b9"},{"version":"20260730100000","name":"project_admin_save_rpc_conflict_arbiter_fix","statement_count":5,"statements_sha256":"1044d58001d1ff45fc2fbcefd3904886377c791e4b362a1bf1f6547e436f14fa"},{"version":"20260731100000","name":"project_row_actions_capability","statement_count":19,"statements_sha256":"8e178803c05eaf5eb588da3c9440c5dbb02170e33d7390c4bddeccd5a087ed7b"},{"version":"20260803120000","name":"project_publishing_visibility_capability","statement_count":27,"statements_sha256":"e23697708a0c27019500f1289ff35d94e59dbb32e511cadd5a426117cb2ac88c"},{"version":"20260803153000","name":"shared_entity_seo_capability","statement_count":28,"statements_sha256":"d73f2261562e657b318ed448983b289ebc2554c48796d3d9f91512ecd36b7bba"},{"version":"20260803190000","name":"content_review_publishing_reconciliation","statement_count":5,"statements_sha256":"9ba4d96969cf75918a3eb8b4a33d4f27d91ed91395827dccb96c46e1976fcee7"},{"version":"20260804120000","name":"global_seo_capability_closure","statement_count":38,"statements_sha256":"5c51c98bcbd4ed212d19c4e8122a9b89fed1356b375165a07206dbab7ea36918"},{"version":"20260804180000","name":"public_media_truth_closure","statement_count":43,"statements_sha256":"84eb7d29186a99b243fafbca3364a55b66a4c51967ec55461132ad8503480af2"},{"version":"20260805090000","name":"footer_public_composition_truth_closure","statement_count":24,"statements_sha256":"cef220f40d9dc0d5344a3985318652c1dfa8a1afbefecd859c77a61817ef3e78"},{"version":"20260805120000","name":"admin_pages_search_read_model","statement_count":9,"statements_sha256":"6db355c3d737a9681dc113fca8cd6548a41fe985d415deab160f2caca1573fae"},{"version":"20260805180000","name":"global_truth_atomic_operations_closure","statement_count":53,"statements_sha256":"cb3081a6f3fc34982f6bf038b288df88d880de6cb67274984bd2aa9517f1065e"},{"version":"20260805210000","name":"dashboard_truth_closure","statement_count":9,"statements_sha256":"51831c339666950d05a658f8ff8bea449e744464e7636e444dae512788f95368"},{"version":"20260805230000","name":"reports_analytics_capability_closure","statement_count":9,"statements_sha256":"c7f4cd2c136ea55f56bf9ac918b778c44aea285c61c40b93f89cb04d5c0090bb"},{"version":"20260805234500","name":"external_integrations_capability","statement_count":86,"statements_sha256":"fe6a76bade99f5fb6b45c07f9c27b9a0139545be36e02bd8d5deab21e7e13814"},{"version":"20260806010000","name":"external_integrations_asset_reselection_recovery","statement_count":6,"statements_sha256":"41884fe0c1e8d72d47acd9d41e46110f978bac25b6f47c54b27dcf993e4839ac"},{"version":"20260806140000","name":"integrations_server_configuration_capability","statement_count":38,"statements_sha256":"82086933108b67e38fc80f13977ac6e80b90f0f6abfc6fc8e17a70e666d27b28"},{"version":"20260807090000","name":"page_block_module_lifecycle_contract","statement_count":16,"statements_sha256":"a05b54469b60802533fa5661f2ddf7689806514e47baf5cf929e41229c043a92"},{"version":"20260807120000","name":"system_publication_summary_cards_closure","statement_count":90,"statements_sha256":"567665a6410f3f7aecd4fe597865ab6b3f88073b347b218ba885cc98e45a0370"},{"version":"20260807130000","name":"taxonomy_delete_guard_truth_closure","statement_count":12,"statements_sha256":"2b3f690766682ba71d482f9bc3be37b38b5fb37e1de3a31180b84f91bfaf28cf"},{"version":"20260807140000","name":"topic_categories_first_publish_date","statement_count":20,"statements_sha256":"9755337a665e7384a9fa51a3a001ac5fb1e9e316adfd52efe56d5dfb585af4cd"},{"version":"20260808120000","name":"taxonomy_lifecycle_contract","statement_count":40,"statements_sha256":"89a96cac52adb11945605127f43b84c54e9b878afe339cd58ba5c848aca1ec6c"},{"version":"20260809120000","name":"topic_display_controls_navigation","statement_count":5,"statements_sha256":"33e0b31c09bb95ee21f3ea8888243633370e5da68e1e4493e3c3cf24058d79e9"},{"version":"20260810010000","name":"page_delete_hero_assignment_integrity","statement_count":5,"statements_sha256":"cba0f1f985d72c939f1317484e2fdf73b38a3c80ed1cadbc9212dd9c4437595a"},{"version":"20260810020000","name":"admin_pages_sort_adoption","statement_count":8,"statements_sha256":"b74ea9e310915cb391eb2ae43db377bd1f4c7fff995a753e4c4bc21e61093493"},{"version":"20260813220634","name":"legacy_project_media_canonicalization","statement_count":28,"statements_sha256":"4542373bacc85f76c9e95473b2478d6788f4927aa07432f5919e76aadad597b5"},{"version":"20260814020742","name":"projects_domain_hardening","statement_count":8,"statements_sha256":"c515b2f532f836ea43624a1335ad24fd98f070c4db9aff7eeb042ac4bf911ef9"},{"version":"20260814020750","name":"location_management_foundation","statement_count":10,"statements_sha256":"74366e764da75aa0c92f96672d4de2616c85a0986d7ae8cbad8dbbc108edafd8"},{"version":"20260814174238","name":"admin_users_active_invariant","statement_count":8,"statements_sha256":"5db767d398eb01f7e1adef628b5169c641979506924cb632b9b235e4cc580cee"},{"version":"20260815092555","name":"media_center_listing_presentation","statement_count":4,"statements_sha256":"696a1f6442102cfc5f6643cf49b53bd6bc8fc6f86a5ff21c6ae7ba92d2a9c64a"},{"version":"20260816090000","name":"media_center_hero_owner_closure","statement_count":11,"statements_sha256":"47979887ab185828478c4bed9a70238211e9a4ee4aeffccfb2adde4804bcac5e"},{"version":"20260817100000","name":"project_section_title_contract","statement_count":23,"statements_sha256":"20a23b5f163bd510feb554a0295cfa583579af7efb1ee5a0bcb095e8e08072c5"},{"version":"20260817101000","name":"media_ordinary_attachment_scope","statement_count":7,"statements_sha256":"f14a2d0f5d91073a3734f09ea408de36f28ce7bdd738c3cf6510de229eebbcf9"},{"version":"20260817170332","name":"project_construction_tracking_detail","statement_count":54,"statements_sha256":"9f1f8f0f169278e84ac1eef9c1b2f394792873acdced2e9a9636347f58a7db39"},{"version":"20260818010000","name":"project_tracking_public_pagination","statement_count":6,"statements_sha256":"4656e7b979c52fad0abd829f7475b62b94a8b10916258495c096188c2130df7a"}]$reviewed_prefix85$::jsonb;
  v_registry_actual jsonb;
  v_security_record record;
  v_tag text := chr(36) || 'venisia_security_contract' || chr(36);
  v_parts text[];
  v_contract jsonb;
  v_snapshot jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_table jsonb;
  v_observed_table jsonb;
  v_sequence jsonb;
  v_marker record;
  v_marker_oid oid;
  v_marker_proof jsonb;
  v_marker_literals jsonb;
  v_attestation_pattern constant text := $frozen_attestation_pattern$select[[:space:]]+'((?:[^']|'')*)'::(?:pg_catalog\.)?jsonb[[:space:]]*\|\|$frozen_attestation_pattern$;
  v_field text;
  v_role text;
  v_access_roles text[];
  v_client_roles text[];
  v_ddl_roles text[];
  v_table_privileges constant text[] := array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
  v_column_privileges constant text[] := array['SELECT','INSERT','UPDATE','REFERENCES'];
  -- Verbatim read-only projection from captureDatabaseSecurityCatalog in
  -- scripts/lib/database-rls-security-contract.mts; source guard prevents drift.
  v_catalog_projection constant text := $security_catalog_projection$
    with roles as (select oid,rolname from pg_catalog.pg_roles),
    relations as (select c.* from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname=$1 and c.relkind in ('r','p','S')),
    table_acl as (select c.oid,c.relowner,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,
      a.privilege_type,a.is_grantable from relations c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a),
    acl_group as (select oid,role,jsonb_agg(privilege_type order by privilege_type) as privileges,
      coalesce(jsonb_agg(privilege_type order by privilege_type) filter(where is_grantable),'[]'::jsonb) as grantable
      from table_acl group by oid,role),
    acl_maps as (select oid,jsonb_object_agg(role,privileges) as grants,jsonb_object_agg(role,grantable) as grant_options from acl_group group by oid),
    policy_rows as (select p.polrelid,jsonb_build_object('name',p.polname,'command',case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' end,
      'roles',(select jsonb_agg(case when role_oid=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end order by role_oid) from unnest(p.polroles) role_oid),
      'permissive',p.polpermissive,'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'withCheck',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) as policy
      from pg_catalog.pg_policy p),
    column_acl as (select c.relname,a.attname,case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end as role,
      x.privilege_type,x.is_grantable from relations c join pg_catalog.pg_attribute a on a.attrelid=c.oid
      cross join lateral pg_catalog.aclexplode(a.attacl) x where a.attnum>0 and not a.attisdropped),
    column_group as (select relname,attname,role,jsonb_agg(privilege_type order by privilege_type) as privileges,
      coalesce(jsonb_agg(privilege_type order by privilege_type) filter(where is_grantable),'[]'::jsonb) as grantable from column_acl group by relname,attname,role),
    default_acl as (select d.oid,pg_catalog.pg_get_userbyid(d.defaclrole) as owner,n.nspname as schema,d.defaclobjtype::text as object_type,
      case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,a.privilege_type
      from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
      cross join lateral pg_catalog.aclexplode(d.defaclacl) a
      where pg_catalog.pg_get_userbyid(d.defaclrole)=any($2::text[]) and d.defaclobjtype in ('r','S') and (d.defaclnamespace=0 or n.nspname=$1)),
    default_group as (select oid,owner,schema,object_type,role,jsonb_agg(privilege_type order by privilege_type) as privileges from default_acl group by oid,owner,schema,object_type,role),
    default_maps as (select oid,owner,schema,object_type,jsonb_object_agg(role,privileges) as grants from default_group group by oid,owner,schema,object_type),
    schema_acl as (select n.oid,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,a.privilege_type
      from pg_catalog.pg_namespace n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where n.nspname=$1)
    select jsonb_build_object('schema',$1::text,
      'tables',coalesce((select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
        'rlsEnabled',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'grants',coalesce(a.grants,'{}'::jsonb),'grantOptions',coalesce(a.grant_options,'{}'::jsonb),
        'policies',coalesce((select jsonb_agg(policy order by policy->>'name') from policy_rows where polrelid=c.oid),'[]'::jsonb),
        'effectivePrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest($3::text[]) privilege where pg_catalog.has_table_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($5::text[])),
        'effectiveColumnPrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest($4::text[]) privilege where pg_catalog.has_any_column_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($5::text[]))) order by c.relname)
        from relations c left join acl_maps a on a.oid=c.oid where c.relkind in ('r','p')),'[]'::jsonb),
      'roles',(select coalesce(jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls,'inherit',rolinherit,'canLogin',rolcanlogin,
        'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication) order by rolname),'[]'::jsonb) from pg_catalog.pg_roles),
      'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',pg_catalog.pg_get_userbyid(roleid),'member',pg_catalog.pg_get_userbyid(member),'inheritOption',inherit_option,'setOption',set_option,'adminOption',admin_option) order by roleid,member),'[]'::jsonb) from pg_catalog.pg_auth_members),
      'schemaPrivileges',(select jsonb_agg(jsonb_build_object('role',role,'privileges',privileges) order by role) from (
        select r.rolname as role,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest(array['CREATE','USAGE']) privilege where pg_catalog.has_schema_privilege(r.oid,$1,privilege)) as privileges from roles r where r.rolname=any($5::text[])
        union all select 'PUBLIC',coalesce((select jsonb_agg(privilege_type order by privilege_type) from schema_acl where role='PUBLIC'),'[]'::jsonb)) all_schema_roles),
      'defaultPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('owner',owner,'schema',schema,'objectType',object_type,'grants',grants) order by owner,schema,object_type),'[]'::jsonb) from default_maps),
      'columnPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('table',relname,'column',attname,'role',role,'privileges',privileges,'grantable',grantable) order by relname,attname,role),'[]'::jsonb) from column_group),
      'sequencePrivileges',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),'grants',coalesce(a.grants,'{}'::jsonb),
        'effectivePrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest(array['SELECT','UPDATE','USAGE']) privilege where pg_catalog.has_sequence_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($6::text[]))) order by c.relname),'[]'::jsonb) from relations c left join acl_maps a on a.oid=c.oid where c.relkind='S')
    ) as document
  $security_catalog_projection$;
begin
  if current_user <> 'postgres' then
    raise exception using errcode='P0001', message='migration86_requires_declared_migration_role';
  end if;
  select count(*) into v_function_count from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='rls_auto_enable';
  select count(*) into v_event_count from pg_catalog.pg_event_trigger
  where evtname='ensure_rls';

  if v_function_count=1 and v_event_count=1 and v_function_oid is not null then
    -- Exact original preflight, ACL hardening and postconditions, within this
    -- same transaction. No change to the original function or trigger body.
    execute $historical_hardening$do $preflight$
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
$verification$;$historical_hardening$;
    return;
  end if;
  if v_function_count<>0 or v_event_count<>0 or v_function_oid is not null then
    raise exception using errcode='P0001', message='migration86_partial_or_ambiguous_legacy_pair';
  end if;

  -- An absent optional pair alone never qualifies a database as fresh.
  -- The prefix is a frozen official-CLI receipt, not a guessed seed count.
  select coalesce(jsonb_agg(jsonb_build_object(
    'version',version,'name',name,'statement_count',cardinality(statements),
    'statements_sha256',encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex')
  ) order by version collate "C"),'[]'::jsonb) into v_registry_actual
  from supabase_migrations.schema_migrations
  where version<>'20260819040000';
  if v_registry_actual is distinct from v_registry_expected then
    raise exception using errcode='P0001', message='migration86_unrecognized_fresh_registry_prefix';
  end if;
  select * into v_security_record from supabase_migrations.schema_migrations
  where version='20260819040000' and name='database_rls_security_contract';
  if not found then
    raise exception using errcode='P0001', message='migration86_security_migration_receipt_missing';
  end if;
  if not coalesce((
    (cardinality(v_security_record.statements)=1 and
      encode(sha256(convert_to(v_security_record.statements[1],'UTF8')),'hex')=
        '611159e5ad195467d36e37749f691a60807a22d9b6b3c46a4758b959000c8c91')
    or
    (cardinality(v_security_record.statements)=3 and
      encode(sha256(convert_to(array_to_json(v_security_record.statements)::text,'UTF8')),'hex')=
        'c9428c14c0ad42597bff0be604ab06f903d33a3239ec62d10f6b89645735f1d7')
  ),false) then
    raise exception using errcode='P0001', message='migration86_unrecognized_security_migration_receipt';
  end if;
  v_parts := string_to_array(array_to_string(v_security_record.statements,E'\n'),v_tag);
  if cardinality(v_parts) is distinct from 3 then
    raise exception using errcode='P0001', message='migration86_ambiguous_registered_security_declaration';
  end if;
  v_contract := v_parts[2]::jsonb;
  if v_contract->>'formatVersion' is distinct from '1'
    or v_contract->>'contractId' is distinct from 'venisia-public-table-security'
    or v_contract->>'revision' is distinct from '1'
    or v_contract->>'schema' is distinct from 'public' then
    raise exception using errcode='P0001', message='migration86_security_contract_identity_mismatch';
  end if;

  -- These existing attestors freeze the path actually taken by corrected59/60.
  -- Validate their definitions before invocation; a replaced function is not
  -- accepted merely because the earlier migration receipt still exists.
  for v_marker in select * from (values
    ('public_media_closure_provenance','20260804180000','validated-legacy-input-v1',
     'validated-empty-legacy','7fcf827af99ae481567ccbba7b09af15f379f2888da90253877f9364d20c9d5e'),
    ('footer_public_composition_provenance','20260805090000','system-manageable-fresh-v1',
     'proven_fresh','5648addf41da01d8629f05cee3d8c0f7019d029ab3f960437bae51067fdcb1c6')
  ) as markers(name,migration_version,revision,input_state,source_sha256)
  loop
    select p.oid into v_marker_oid from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    join pg_catalog.pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.proname=v_marker.name
      and p.pronargs=0 and p.prokind='f' and not p.proretset
      and p.prorettype='jsonb'::regtype and p.prosecdef and p.provolatile='s'
      and l.lanname='sql' and pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      and p.proconfig=array['search_path=""']::text[]
      and encode(sha256(convert_to(pg_catalog.pg_get_functiondef(p.oid),'UTF8')),'hex')=v_marker.source_sha256;
    if v_marker_oid is null or (
      select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_marker.name
    )<>1 then
      raise exception using errcode='P0001', message='migration86_fresh_attestation_identity_mismatch';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'role',case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end,
      'privilege',a.privilege_type,'grantable',a.is_grantable
    ) order by pg_catalog.pg_get_userbyid(a.grantee)::text collate "C",a.privilege_type collate "C"),'[]'::jsonb)
      into v_actual
    from pg_catalog.pg_proc p cross join lateral
      pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    where p.oid=v_marker_oid;
    if v_actual is distinct from '[{"role":"postgres","privilege":"EXECUTE","grantable":false},{"role":"service_role","privilege":"EXECUTE","grantable":false}]'::jsonb
      or pg_catalog.has_function_privilege('anon',v_marker_oid,'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated',v_marker_oid,'EXECUTE') then
      raise exception using errcode='P0001', message='migration86_fresh_attestation_acl_mismatch';
    end if;
    -- Read the frozen path only after exact source/identity/ACL verification.
    -- The older RPC's live health projection refers to schema retired later in
    -- the corpus. It is not the owner of today's security/catalog guarantee.
    select coalesce(jsonb_agg(to_jsonb(m.parts[1])),'[]'::jsonb) into v_marker_literals
    from pg_catalog.pg_proc p cross join lateral
      pg_catalog.regexp_matches(p.prosrc,v_attestation_pattern,'gi') as m(parts)
    where p.oid=v_marker_oid;
    if jsonb_array_length(v_marker_literals)<>1 then
      raise exception using errcode='P0001', message='migration86_ambiguous_frozen_attestation';
    end if;
    v_marker_proof := replace(v_marker_literals->>0,chr(39)||chr(39),chr(39))::jsonb;
    if v_marker_proof->>'contract_version' is distinct from '1'
      or v_marker_proof->>'migration_version' is distinct from v_marker.migration_version
      or v_marker_proof->>'migration_revision' is distinct from v_marker.revision
      or v_marker_proof->>'input_state' is distinct from v_marker.input_state
      or not exists(select 1 from supabase_migrations.schema_migrations
        where version=v_marker.migration_version and cardinality(statements)>0) then
      raise exception using errcode='P0001', message='migration86_fresh_lineage_not_proven';
    end if;
  end loop;

  select array_agg(value order by value collate "C") into v_client_roles
  from jsonb_array_elements_text(v_contract->'clientRoles');
  select array_agg(value order by value collate "C") into v_ddl_roles
  from jsonb_array_elements_text(v_contract->'ddlRoles');
  select array_agg(role order by role collate "C") into v_access_roles from (
    select unnest(v_client_roles) as role union select unnest(v_ddl_roles)
    union select key from jsonb_array_elements(v_contract->'tables') t
      cross join lateral jsonb_each(t->'grants') where key<>'PUBLIC'
  ) as access;
  execute v_catalog_projection into v_snapshot using v_contract->>'schema',v_ddl_roles,
    v_table_privileges,v_column_privileges,v_access_roles,v_client_roles;
  if v_snapshot->>'schema' is distinct from v_contract->>'schema' then
    raise exception using errcode='P0001', message='migration86_security_catalog_unavailable';
  end if;

  -- Compare arrays as canonically ordered values, never by environment collation.
  -- The pinned declaration already validates unique roles, table and policy
  -- identities; these catalog projections retain all policy/access properties.
  foreach v_field in array array['roles','memberships','schemaPrivileges','defaultPrivileges','columnPrivileges']
  loop
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_actual from jsonb_array_elements(v_snapshot->v_field);
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_expected from jsonb_array_elements(v_contract->v_field);
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='migration86_security_metadata_drift';
    end if;
  end loop;
  select coalesce(jsonb_agg(value->'name' order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_actual from jsonb_array_elements(v_snapshot->'tables');
  select coalesce(jsonb_agg(value->'name' order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_expected from jsonb_array_elements(v_contract->'tables');
  if v_actual is distinct from v_expected then
    raise exception using errcode='P0001', message='migration86_unclassified_or_missing_table';
  end if;

  for v_table in select value from jsonb_array_elements(v_contract->'tables')
  loop
    select value into strict v_observed_table from jsonb_array_elements(v_snapshot->'tables')
    where value->>'name'=v_table->>'name';
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_expected
    from jsonb_each(v_table->'grants') where value<>'[]'::jsonb;
    if v_observed_table->>'owner' is distinct from v_table->>'owner'
      or v_observed_table->'forceRls' is distinct from v_table->'forceRls'
      or v_observed_table->>'rlsEnabled' is distinct from 'true'
      or v_observed_table->'grants' is distinct from v_expected
      or exists (select 1 from jsonb_each(v_observed_table->'grantOptions')
        where key<>v_table->>'owner' and value<>'[]'::jsonb) then
      raise exception using errcode='P0001', message='migration86_table_security_drift';
    end if;
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_actual from jsonb_array_elements(v_observed_table->'policies');
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_expected from jsonb_array_elements(v_table->'policies');
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='migration86_policy_definition_drift';
    end if;
    foreach v_role in array v_access_roles
    loop
      select coalesce(jsonb_agg(privilege order by privilege collate "C"),'[]'::jsonb)
        into v_expected from (
          select jsonb_array_elements_text(coalesce(v_table->'grants'->v_role,'[]'::jsonb)) as privilege
          union select jsonb_array_elements_text(coalesce(v_table->'grants'->'PUBLIC','[]'::jsonb))
        ) as allowed;
      if v_observed_table->'effectivePrivileges'->v_role is distinct from v_expected then
        raise exception using errcode='P0001', message='migration86_effective_table_privilege_drift';
      end if;
      select coalesce(jsonb_agg(value order by value collate "C"),'[]'::jsonb)
        into v_expected from jsonb_array_elements_text(v_expected)
        where value=any(v_column_privileges);
      if v_observed_table->'effectiveColumnPrivileges'->v_role is distinct from v_expected then
        raise exception using errcode='P0001', message='migration86_effective_column_privilege_drift';
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(value-'effectivePrivileges' order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_actual from jsonb_array_elements(v_snapshot->'sequencePrivileges');
  select coalesce(jsonb_agg(value order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_expected from jsonb_array_elements(v_contract->'sequencePrivileges');
  if v_actual is distinct from v_expected then
    raise exception using errcode='P0001', message='migration86_sequence_security_drift';
  end if;
  for v_sequence in select value from jsonb_array_elements(v_snapshot->'sequencePrivileges')
  loop
    foreach v_role in array v_client_roles
    loop
      if v_sequence->'effectivePrivileges'->v_role is distinct from '[]'::jsonb then
        raise exception using errcode='P0001', message='migration86_effective_sequence_privilege_drift';
      end if;
    end loop;
  end loop;
  if exists (select 1 from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) a
    where pg_catalog.pg_get_userbyid(d.defaclrole)=any(v_ddl_roles)
      and d.defaclobjtype in ('r','S')
      and (d.defaclnamespace=0 or d.defaclnamespace='public'::regnamespace::oid)
      and a.is_grantable)
    or exists (select 1 from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('s',c.relowner))) a
      where c.relnamespace='public'::regnamespace::oid and c.relkind='S' and a.is_grantable) then
    raise exception using errcode='P0001', message='migration86_default_or_sequence_grant_option_drift';
  end if;
  -- No DDL/DML follows in this branch. The official CLI records this successful
  -- compatibility execution; no historical registry entry is rewritten.
end;
$migration86_compatibility$;

commit;
