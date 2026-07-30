-- Project Admin Entry aggregate contract tests.
--
-- Run only against a disposable PostgreSQL/Supabase database after applying
-- 20260728090000_rebuild_project_admin_data_entry.sql. The fixture owns one
-- transaction and always rolls it back; it must never target Remote/Production.
-- Execute it as the migration owner: the fixture inspects service_role ACLs,
-- while its direct setup/trigger probes deliberately require owner privileges.

begin;

do $tests$
declare
  v_governorate_id bigint;
  v_other_governorate_id bigint;
  v_city_id bigint;
  v_main_area_id bigint;
  v_sub_area_id bigint;
  v_project_id bigint;
  v_point_a_id bigint;
  v_point_b_id bigint;
  v_feature_a_id bigint;
  v_feature_b_id bigint;
  v_plan_a_id bigint;
  v_plan_b_id bigint;
  v_detail_a1_id bigint;
  v_detail_a2_id bigint;
  v_detail_b1_id bigint;
  v_delivery_a_id bigint;
  v_delivery_b_id bigint;
  v_media_a_id bigint;
  v_media_b_id bigint;
  v_old_video_id bigint;
  v_new_video_id bigint;
  v_other_project_id bigint;
  v_other_feature_id bigint;
  v_root jsonb;
  v_failed boolean;
  v_relation regclass;
  v_sequence regclass;
  v_function regprocedure;
  v_function_is_rpc boolean;
  v_role text;
  v_privilege text;
  v_actual boolean;
  v_expected boolean;
  v_rls_enabled boolean;
  v_acl record;
  v_acl_violations text[] := array[]::text[];

  v_feature_a_key uuid := '10000000-0000-4000-8000-000000000001';
  v_feature_b_key uuid := '10000000-0000-4000-8000-000000000002';
  v_point_a_key uuid := '11000000-0000-4000-8000-000000000001';
  v_point_b_key uuid := '11000000-0000-4000-8000-000000000002';
  v_plan_a_key uuid := '20000000-0000-4000-8000-000000000001';
  v_plan_b_key uuid := '20000000-0000-4000-8000-000000000002';
  v_detail_a1_key uuid := '21000000-0000-4000-8000-000000000001';
  v_detail_a2_key uuid := '21000000-0000-4000-8000-000000000002';
  v_detail_b1_key uuid := '21000000-0000-4000-8000-000000000003';
  v_delivery_a_key uuid := '30000000-0000-4000-8000-000000000001';
  v_delivery_b_key uuid := '30000000-0000-4000-8000-000000000002';
  v_media_a_key uuid := '40000000-0000-4000-8000-000000000001';
  v_media_b_key uuid := '40000000-0000-4000-8000-000000000002';
  v_old_video_key uuid := '50000000-0000-4000-8000-000000000001';
  v_new_video_key uuid := '50000000-0000-4000-8000-000000000002';
  v_rollback_point_key uuid := '60000000-0000-4000-8000-000000000001';
  v_other_feature_key uuid := '70000000-0000-4000-8000-000000000001';
begin
  -- This complete ACL diagnostic intentionally precedes the first fixture
  -- write. It accumulates every violation instead of stopping at the first
  -- relation, so one failed run identifies the full correction scope.
  --
  -- Runtime DML is RPC-only. service_role may read every aggregate table but
  -- must not mutate a table or consume an identity sequence directly. Direct
  -- grants to an object owner are excluded because ownership is intrinsic;
  -- every non-owner relation/column grant must match the runtime contract.
  foreach v_relation in array array[
    'public.project_locations'::regclass,
    'public.projects'::regclass,
    'public.project_location_points'::regclass,
    'public.project_features'::regclass,
    'public.project_floor_plans'::regclass,
    'public.project_floor_plan_details'::regclass,
    'public.project_delivery_items'::regclass,
    'public.project_media'::regclass,
    'public.project_videos'::regclass
  ] loop
    select relation.relrowsecurity
      into v_rls_enabled
      from pg_catalog.pg_class relation
     where relation.oid = v_relation;

    if not coalesce(v_rls_enabled, false) then
      v_acl_violations := array_append(
        v_acl_violations,
        format(
          'source=rls object=%s role=PUBLIC privilege=ROW_LEVEL_SECURITY expected=enabled actual=disabled',
          v_relation
        )
      );
    end if;

    for v_acl in
      select
        case
          when acl.grantee = 0 then 'PUBLIC'
          else coalesce(grantee.rolname, format('oid:%s', acl.grantee))
        end as role_name,
        acl.privilege_type,
        acl.is_grantable
      from pg_catalog.pg_class relation
      cross join lateral pg_catalog.aclexplode(
        case
          when relation.relacl is null then
            pg_catalog.acldefault('r'::"char", relation.relowner)
          when cardinality(relation.relacl) > 0 then relation.relacl
          else null::aclitem[]
        end
      ) acl
      left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where relation.oid = v_relation
        and acl.grantee <> relation.relowner
    loop
      if not (
        v_acl.role_name = 'service_role'
        and v_acl.privilege_type = 'SELECT'
        and not v_acl.is_grantable
      ) then
        v_acl_violations := array_append(
          v_acl_violations,
          format(
            'source=direct_relation_acl object=%s role=%s privilege=%s grantable=%s expected=denied',
            v_relation,
            v_acl.role_name,
            v_acl.privilege_type,
            v_acl.is_grantable
          )
        );
      end if;
    end loop;

    if not exists (
      select 1
        from pg_catalog.pg_class relation
        cross join lateral pg_catalog.aclexplode(
          case
            when relation.relacl is null then
              pg_catalog.acldefault('r'::"char", relation.relowner)
            when cardinality(relation.relacl) > 0 then relation.relacl
            else null::aclitem[]
          end
        ) acl
       where relation.oid = v_relation
         and acl.grantee = 'service_role'::regrole
         and acl.privilege_type = 'SELECT'
         and not acl.is_grantable
    ) then
      v_acl_violations := array_append(
        v_acl_violations,
        format(
          'source=direct_relation_acl object=%s role=service_role privilege=SELECT expected=granted actual=missing',
          v_relation
        )
      );
    end if;

    -- Column ACLs can authorize INSERT/UPDATE/REFERENCES even when the table
    -- ACL looks safe. The aggregate contract uses one relation-level SELECT
    -- grant, so every materialized non-owner column grant is unexpected.
    for v_acl in
      select
        case
          when acl.grantee = 0 then 'PUBLIC'
          else coalesce(grantee.rolname, format('oid:%s', acl.grantee))
        end as role_name,
        attribute.attname as column_name,
        acl.privilege_type,
        acl.is_grantable
      from pg_catalog.pg_attribute attribute
      join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
      cross join lateral pg_catalog.aclexplode(
        case
          when cardinality(attribute.attacl) > 0 then attribute.attacl
          else null::aclitem[]
        end
      ) acl
      left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where attribute.attrelid = v_relation
        and attribute.attnum > 0
        and not attribute.attisdropped
        and acl.grantee <> relation.relowner
    loop
      v_acl_violations := array_append(
        v_acl_violations,
        format(
          'source=direct_column_acl object=%s.%I role=%s privilege=%s grantable=%s expected=denied',
          v_relation,
          v_acl.column_name,
          v_acl.role_name,
          v_acl.privilege_type,
          v_acl.is_grantable
        )
      );
    end loop;

    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      foreach v_privilege in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
        'MAINTAIN'
      ] loop
        v_actual := pg_catalog.has_table_privilege(
          v_role,
          v_relation,
          v_privilege
        );
        v_expected := v_role = 'service_role' and v_privilege = 'SELECT';

        if v_actual is distinct from v_expected then
          v_acl_violations := array_append(
            v_acl_violations,
            format(
              'source=effective_table_privilege object=%s role=%s privilege=%s expected=%s actual=%s',
              v_relation,
              v_role,
              v_privilege,
              v_expected,
              v_actual
            )
          );
        end if;
      end loop;
    end loop;
  end loop;

  foreach v_sequence in array array[
    'public.project_locations_id_seq'::regclass,
    'public.projects_id_seq'::regclass,
    'public.project_location_points_id_seq'::regclass,
    'public.project_features_id_seq'::regclass,
    'public.project_floor_plans_id_seq'::regclass,
    'public.project_floor_plan_details_id_seq'::regclass,
    'public.project_delivery_items_id_seq'::regclass,
    'public.project_media_id_seq'::regclass,
    'public.project_videos_id_seq'::regclass
  ] loop
    for v_acl in
      select
        case
          when acl.grantee = 0 then 'PUBLIC'
          else coalesce(grantee.rolname, format('oid:%s', acl.grantee))
        end as role_name,
        acl.privilege_type,
        acl.is_grantable
      from pg_catalog.pg_class seq
      cross join lateral pg_catalog.aclexplode(
        case
          when seq.relacl is null then
            pg_catalog.acldefault('S'::"char", seq.relowner)
          when cardinality(seq.relacl) > 0 then seq.relacl
          else null::aclitem[]
        end
      ) acl
      left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where seq.oid = v_sequence
        and acl.grantee <> seq.relowner
    loop
      v_acl_violations := array_append(
        v_acl_violations,
        format(
          'source=direct_sequence_acl object=%s role=%s privilege=%s grantable=%s expected=denied',
          v_sequence,
          v_acl.role_name,
          v_acl.privilege_type,
          v_acl.is_grantable
        )
      );
    end loop;

    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      foreach v_privilege in array array['USAGE', 'SELECT', 'UPDATE'] loop
        v_actual := pg_catalog.has_sequence_privilege(
          v_role,
          v_sequence,
          v_privilege
        );

        if v_actual then
          v_acl_violations := array_append(
            v_acl_violations,
            format(
              'source=effective_sequence_privilege object=%s role=%s privilege=%s expected=false actual=true',
              v_sequence,
              v_role,
              v_privilege
            )
          );
        end if;
      end loop;
    end loop;
  end loop;

  -- SECURITY DEFINER aggregate RPCs are executable by service_role only. The
  -- trigger helpers remain non-callable to every runtime role.
  foreach v_function in array array[
    'public.save_project_admin_entry(bigint,jsonb)'::regprocedure,
    'public.delete_project_admin_entry(bigint)'::regprocedure,
    'public.validate_project_location_parent()'::regprocedure,
    'public.prevent_project_type_change()'::regprocedure,
    'public.validate_project_location_selection()'::regprocedure,
    'public.prevent_project_location_reparent()'::regprocedure
  ] loop
    v_function_is_rpc := v_function = 'public.save_project_admin_entry(bigint,jsonb)'::regprocedure
      or v_function = 'public.delete_project_admin_entry(bigint)'::regprocedure;

    for v_acl in
      select
        case
          when acl.grantee = 0 then 'PUBLIC'
          else coalesce(grantee.rolname, format('oid:%s', acl.grantee))
        end as role_name,
        acl.privilege_type,
        acl.is_grantable
      from pg_catalog.pg_proc proc
      cross join lateral pg_catalog.aclexplode(
        case
          when proc.proacl is null then
            pg_catalog.acldefault('f'::"char", proc.proowner)
          when cardinality(proc.proacl) > 0 then proc.proacl
          else null::aclitem[]
        end
      ) acl
      left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where proc.oid = v_function
        and acl.grantee <> proc.proowner
    loop
      if not (
        v_function_is_rpc
        and v_acl.role_name = 'service_role'
        and v_acl.privilege_type = 'EXECUTE'
        and not v_acl.is_grantable
      ) then
        v_acl_violations := array_append(
          v_acl_violations,
          format(
            'source=direct_function_acl object=%s role=%s privilege=%s grantable=%s expected=denied',
            v_function,
            v_acl.role_name,
            v_acl.privilege_type,
            v_acl.is_grantable
          )
        );
      end if;
    end loop;

    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      v_actual := pg_catalog.has_function_privilege(
        v_role,
        v_function,
        'EXECUTE'
      );
      v_expected := v_function_is_rpc and v_role = 'service_role';

      if v_actual is distinct from v_expected then
        v_acl_violations := array_append(
          v_acl_violations,
          format(
            'source=effective_function_privilege object=%s role=%s privilege=EXECUTE expected=%s actual=%s',
            v_function,
            v_role,
            v_expected,
            v_actual
          )
        );
      end if;
    end loop;
  end loop;

  if cardinality(v_acl_violations) > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'aggregate ACL diagnostics found %s violation(s) before fixture writes:%s%s',
        cardinality(v_acl_violations),
        E'\n',
        array_to_string(v_acl_violations, E'\n')
      );
  end if;

  if not exists (
    select 1
      from public.project_locations governorate
      join public.project_locations city
        on city.parent_id = governorate.id
       and city.level = 'city'
       and city.name_ar = 'القاهرة الجديدة'
       and city.is_active
      join public.project_locations main_area
        on main_area.parent_id = city.id
       and main_area.level = 'main_area'
       and main_area.name_ar = 'التجمع الخامس'
       and main_area.is_active
      join public.project_locations sub_area
        on sub_area.parent_id = main_area.id
       and sub_area.level = 'sub_area'
       and sub_area.name_ar = 'الحي الثاني'
       and sub_area.is_active
     where governorate.level = 'governorate'
       and governorate.name_ar = 'القاهرة'
       and governorate.is_active
  ) then
    raise exception 'the minimal active Cairo location seed is missing';
  end if;

  insert into public.project_locations (level, name_ar, name_en, sort_order)
  values ('governorate', 'محافظة اختبار Project Entry', 'Project Entry Test Governorate', 0)
  returning id into v_governorate_id;

  insert into public.project_locations (level, name_ar, name_en, sort_order)
  values ('governorate', 'محافظة اختبار أخرى', 'Other Test Governorate', 1)
  returning id into v_other_governorate_id;

  insert into public.project_locations (level, parent_id, name_ar, name_en, sort_order)
  values ('city', v_governorate_id, 'مدينة اختبار', 'Test City', 0)
  returning id into v_city_id;

  insert into public.project_locations (level, parent_id, name_ar, name_en, sort_order)
  values ('main_area', v_city_id, 'منطقة اختبار رئيسية', 'Test Main Area', 0)
  returning id into v_main_area_id;

  insert into public.project_locations (level, parent_id, name_ar, name_en, sort_order)
  values ('sub_area', v_main_area_id, 'منطقة اختبار فرعية', 'Test Sub Area', 0)
  returning id into v_sub_area_id;

  v_root := jsonb_build_object(
    'type', 'residential',
    'arabic_name', 'مشروع اختبار ذري',
    'english_name', 'Atomic Project Test',
    'slug', 'atomic-project-entry-test',
    'governorate_id', v_governorate_id,
    'city_id', v_city_id,
    'main_area_id', v_main_area_id,
    'sub_area_id', v_sub_area_id,
    'general_description', 'وصف اختباري',
    'short_description', 'وصف هيرو اختباري',
    'image', '/images/test-card.jpg',
    'image_alt', 'صورة كارت اختبارية',
    'hero_image', '/images/test-hero.jpg',
    'hero_image_alt', 'صورة هيرو اختبارية',
    'small_box_image', '/images/test-small-box.jpg',
    'small_box_image_alt', 'صورة بوكس اختبارية',
    'location_label', 'عنوان مشروع اختباري',
    'overview_title', 'نظرة عامة اختبارية',
    'overview_body', '<p>نص نظرة عامة اختباري</p>',
    'overview_media_type', 'video',
    'overview_main_image', '/images/test-overview.jpg',
    'overview_main_image_alt', 'صورة نظرة عامة اختبارية',
    'delivery_title', 'مواصفات وتسليم اختبارية',
    'delivery_body', '<p>نص مواصفات وتسليم اختباري</p>'
  );

  -- Required root fields are independently enforced by the database/RPC.
  v_failed := false;
  begin
    perform * from public.save_project_admin_entry(
      null,
      jsonb_build_object(
        'project', jsonb_set(v_root, '{general_description}', '""'::jsonb),
        'videos', jsonb_build_array(
          jsonb_build_object('client_key', v_old_video_key::text, 'section', 'overview', 'video_url', 'https://example.com/invalid-root-probe')
        )
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed
     or exists (select 1 from public.projects where slug = 'atomic-project-entry-test') then
    raise exception 'empty required Project root field was not rejected atomically';
  end if;

  -- An otherwise valid chain cannot select an inactive leaf. Reactivation is
  -- fixture-local and the outer transaction still rolls back.
  update public.project_locations set is_active = false where id = v_sub_area_id;
  v_failed := false;
  begin
    perform * from public.save_project_admin_entry(
      null,
      jsonb_build_object(
        'project', v_root,
        'videos', jsonb_build_array(
          jsonb_build_object('client_key', v_old_video_key::text, 'section', 'overview', 'video_url', 'https://example.com/inactive-location-probe')
        )
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed
     or exists (select 1 from public.projects where slug = 'atomic-project-entry-test') then
    raise exception 'inactive Project location was not rejected atomically';
  end if;
  update public.project_locations set is_active = true where id = v_sub_area_id;

  select saved.project_id
    into v_project_id
    from public.save_project_admin_entry(
      null,
      jsonb_build_object(
        'project', v_root,
        'location_points', jsonb_build_array(
          jsonb_build_object('client_key', v_point_a_key::text, 'kind', 'road', 'label', 'محور أ', 'distance_text', '3 دقائق'),
          jsonb_build_object('client_key', v_point_b_key::text, 'kind', 'road', 'label', 'محور ب', 'distance_text', '5 دقائق')
        ),
        'features', jsonb_build_array(
          jsonb_build_object('client_key', v_feature_a_key::text, 'body', 'ميزة أ'),
          jsonb_build_object('client_key', v_feature_b_key::text, 'body', 'ميزة ب')
        ),
        'floor_plans', jsonb_build_array(
          jsonb_build_object(
            'client_key', v_plan_a_key::text,
            'name', 'مخطط أ',
            'area_text', '100 م2',
            'featured', true,
            'details', jsonb_build_array(
              jsonb_build_object('client_key', v_detail_a1_key::text, 'label', 'غرف النوم', 'value', '3'),
              jsonb_build_object('client_key', v_detail_a2_key::text, 'label', 'الحمامات', 'value', '2')
            )
          ),
          jsonb_build_object(
            'client_key', v_plan_b_key::text,
            'name', 'مخطط ب',
            'area_text', '120 م2',
            'featured', false,
            'details', jsonb_build_array(
              jsonb_build_object('client_key', v_detail_b1_key::text, 'label', 'غرف النوم', 'value', '4')
            )
          )
        ),
        'delivery_items', jsonb_build_array(
          jsonb_build_object('client_key', v_delivery_a_key::text, 'body', 'بند أ'),
          jsonb_build_object('client_key', v_delivery_b_key::text, 'body', 'بند ب')
        ),
        'media', jsonb_build_array(
          jsonb_build_object('client_key', v_media_a_key::text, 'section', 'gallery', 'image', '/images/test-a.jpg', 'alt_text', 'صورة أ'),
          jsonb_build_object('client_key', v_media_b_key::text, 'section', 'gallery', 'image', '/images/test-b.jpg', 'alt_text', 'صورة ب')
        ),
        'videos', jsonb_build_array(
          jsonb_build_object('client_key', v_old_video_key::text, 'section', 'overview', 'video_url', 'https://example.com/old-video', 'poster_alt', '')
        )
      )
    ) saved;

  select id into strict v_point_a_id from public.project_location_points where project_id = v_project_id and client_key = v_point_a_key;
  select id into strict v_point_b_id from public.project_location_points where project_id = v_project_id and client_key = v_point_b_key;
  select id into strict v_feature_a_id from public.project_features where project_id = v_project_id and client_key = v_feature_a_key;
  select id into strict v_feature_b_id from public.project_features where project_id = v_project_id and client_key = v_feature_b_key;
  select id into strict v_plan_a_id from public.project_floor_plans where project_id = v_project_id and client_key = v_plan_a_key;
  select id into strict v_plan_b_id from public.project_floor_plans where project_id = v_project_id and client_key = v_plan_b_key;
  select id into strict v_detail_a1_id from public.project_floor_plan_details where floor_plan_id = v_plan_a_id and client_key = v_detail_a1_key;
  select id into strict v_detail_a2_id from public.project_floor_plan_details where floor_plan_id = v_plan_a_id and client_key = v_detail_a2_key;
  select id into strict v_detail_b1_id from public.project_floor_plan_details where floor_plan_id = v_plan_b_id and client_key = v_detail_b1_key;
  select id into strict v_delivery_a_id from public.project_delivery_items where project_id = v_project_id and client_key = v_delivery_a_key;
  select id into strict v_delivery_b_id from public.project_delivery_items where project_id = v_project_id and client_key = v_delivery_b_key;
  select id into strict v_media_a_id from public.project_media where project_id = v_project_id and client_key = v_media_a_key;
  select id into strict v_media_b_id from public.project_media where project_id = v_project_id and client_key = v_media_b_key;
  select id into strict v_old_video_id from public.project_videos where project_id = v_project_id and client_key = v_old_video_key;

  -- Reorder and edit every ordered collection. Existing database IDs must stay
  -- unchanged; only sort_order and edited values may change.
  perform * from public.save_project_admin_entry(
    v_project_id,
    jsonb_build_object(
      'project', v_root,
      'location_points', jsonb_build_array(
        jsonb_build_object('id', v_point_b_id, 'client_key', v_point_b_key::text, 'kind', 'road', 'label', 'محور ب محدث', 'distance_text', '5 دقائق'),
        jsonb_build_object('id', v_point_a_id, 'client_key', v_point_a_key::text, 'kind', 'road', 'label', 'محور أ محدث', 'distance_text', '3 دقائق')
      ),
      'features', jsonb_build_array(
        jsonb_build_object('id', v_feature_b_id, 'client_key', v_feature_b_key::text, 'body', 'ميزة ب محدثة'),
        jsonb_build_object('id', v_feature_a_id, 'client_key', v_feature_a_key::text, 'body', 'ميزة أ محدثة')
      ),
      'floor_plans', jsonb_build_array(
        jsonb_build_object(
          'id', v_plan_b_id,
          'client_key', v_plan_b_key::text,
          'name', 'مخطط ب محدث',
          'area_text', '120 م2',
          'featured', false,
          'details', jsonb_build_array(
            jsonb_build_object('id', v_detail_b1_id, 'client_key', v_detail_b1_key::text, 'label', 'غرف النوم', 'value', '4')
          )
        ),
        jsonb_build_object(
          'id', v_plan_a_id,
          'client_key', v_plan_a_key::text,
          'name', 'مخطط أ محدث',
          'area_text', '100 م2',
          'featured', true,
          'details', jsonb_build_array(
            jsonb_build_object('id', v_detail_a2_id, 'client_key', v_detail_a2_key::text, 'label', 'الحمامات', 'value', '2'),
            jsonb_build_object('id', v_detail_a1_id, 'client_key', v_detail_a1_key::text, 'label', 'غرف النوم', 'value', '3')
          )
        )
      ),
      'delivery_items', jsonb_build_array(
        jsonb_build_object('id', v_delivery_b_id, 'client_key', v_delivery_b_key::text, 'body', 'بند ب محدث'),
        jsonb_build_object('id', v_delivery_a_id, 'client_key', v_delivery_a_key::text, 'body', 'بند أ محدث')
      ),
      'media', jsonb_build_array(
        jsonb_build_object('id', v_media_b_id, 'client_key', v_media_b_key::text, 'section', 'gallery', 'image', '/images/test-b.jpg', 'alt_text', 'صورة ب'),
        jsonb_build_object('id', v_media_a_id, 'client_key', v_media_a_key::text, 'section', 'gallery', 'image', '/images/test-a.jpg', 'alt_text', 'صورة أ')
      ),
      'videos', jsonb_build_array(
        jsonb_build_object('id', v_old_video_id, 'client_key', v_old_video_key::text, 'section', 'overview', 'video_url', 'https://example.com/old-video', 'poster_alt', '')
      )
    )
  );

  set constraints
    public.project_location_points_sort_unique,
    public.project_features_sort_unique,
    public.project_floor_plans_sort_unique,
    public.project_floor_plan_details_sort_unique,
    public.project_delivery_items_sort_unique,
    public.project_media_sort_unique,
    public.project_videos_sort_unique
  immediate;

  if not exists (select 1 from public.project_location_points where id = v_point_b_id and sort_order = 0 and label = 'محور ب محدث')
     or not exists (select 1 from public.project_location_points where id = v_point_a_id and sort_order = 1 and label = 'محور أ محدث') then
    raise exception 'stable location-point IDs or reorder failed';
  end if;
  if not exists (select 1 from public.project_features where id = v_feature_b_id and sort_order = 0 and body = 'ميزة ب محدثة')
     or not exists (select 1 from public.project_features where id = v_feature_a_id and sort_order = 1 and body = 'ميزة أ محدثة') then
    raise exception 'stable feature IDs or reorder failed';
  end if;
  if not exists (select 1 from public.project_floor_plans where id = v_plan_b_id and sort_order = 0 and name = 'مخطط ب محدث')
     or not exists (select 1 from public.project_floor_plans where id = v_plan_a_id and sort_order = 1 and name = 'مخطط أ محدث') then
    raise exception 'stable floor-plan IDs or reorder failed';
  end if;
  if not exists (select 1 from public.project_floor_plan_details where id = v_detail_a2_id and sort_order = 0)
     or not exists (select 1 from public.project_floor_plan_details where id = v_detail_a1_id and sort_order = 1) then
    raise exception 'stable floor-plan detail IDs or reorder failed';
  end if;
  if not exists (select 1 from public.project_delivery_items where id = v_delivery_b_id and sort_order = 0)
     or not exists (select 1 from public.project_delivery_items where id = v_delivery_a_id and sort_order = 1) then
    raise exception 'stable delivery-item IDs or reorder failed';
  end if;
  if not exists (select 1 from public.project_media where id = v_media_b_id and sort_order = 0)
     or not exists (select 1 from public.project_media where id = v_media_a_id and sort_order = 1) then
    raise exception 'stable media IDs or reorder failed';
  end if;
  if not exists (
    select 1 from public.project_videos
     where id = v_old_video_id
       and project_id = v_project_id
       and section = 'overview'
  ) then
    raise exception 'stable video ID failed';
  end if;

  -- A tombstone must never cross aggregate ownership, even when the forged ID
  -- exists and is otherwise a valid child identifier.
  select saved.project_id
    into v_other_project_id
    from public.save_project_admin_entry(
      null,
      jsonb_build_object(
        'project', v_root || jsonb_build_object(
          'arabic_name', 'مشروع اختبار ملكية آخر',
          'english_name', 'Other Ownership Project Test',
          'slug', 'other-ownership-project-test',
          'overview_media_type', 'image'
        ),
        'features', jsonb_build_array(
          jsonb_build_object('client_key', v_other_feature_key::text, 'body', 'ميزة مشروع آخر')
        )
      )
    ) saved;
  select id
    into strict v_other_feature_id
    from public.project_features
   where project_id = v_other_project_id
     and client_key = v_other_feature_key;

  v_failed := false;
  begin
    perform * from public.save_project_admin_entry(
      v_project_id,
      jsonb_build_object(
        'project', v_root,
        'deleted', jsonb_build_object('feature_ids', jsonb_build_array(v_other_feature_id)),
        'features', jsonb_build_array(
          jsonb_build_object('id', v_feature_b_id, 'client_key', v_feature_b_key::text, 'body', 'ميزة ب محدثة'),
          jsonb_build_object('id', v_feature_a_id, 'client_key', v_feature_a_key::text, 'body', 'ميزة أ محدثة')
        )
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed
     or not exists (
       select 1 from public.project_features
        where id = v_other_feature_id
          and project_id = v_other_project_id
     ) then
    raise exception 'foreign aggregate tombstone was not rejected safely';
  end if;

  -- A persisted client_key cannot be presented as a new row with id = null.
  -- This guards stable IDs against accidental or forged identity loss.
  v_failed := false;
  begin
    perform * from public.save_project_admin_entry(
      v_project_id,
      jsonb_build_object(
        'project', v_root,
        'features', jsonb_build_array(
          jsonb_build_object('id', v_feature_b_id, 'client_key', v_feature_b_key::text, 'body', 'ميزة ب محدثة'),
          jsonb_build_object('client_key', v_feature_a_key::text, 'body', 'هوية جديدة مزيفة')
        )
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed
     or not exists (select 1 from public.project_features where id = v_feature_a_id and body = 'ميزة أ محدثة') then
    raise exception 'id-null with an existing client_key was not rejected safely';
  end if;

  -- Omitting an existing row is rejected and rolls back; deletion requires the
  -- matching explicit tombstone.
  v_failed := false;
  begin
    perform * from public.save_project_admin_entry(
      v_project_id,
      jsonb_build_object(
        'project', v_root,
        'features', jsonb_build_array(
          jsonb_build_object('id', v_feature_a_id, 'client_key', v_feature_a_key::text, 'body', 'ميزة أ محدثة')
        )
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed or not exists (select 1 from public.project_features where id = v_feature_b_id) then
    raise exception 'implicit child omission was not rejected safely';
  end if;

  perform * from public.save_project_admin_entry(
    v_project_id,
    jsonb_build_object(
      'project', v_root,
      'deleted', jsonb_build_object('feature_ids', jsonb_build_array(v_feature_b_id)),
      'features', jsonb_build_array(
        jsonb_build_object('id', v_feature_a_id, 'client_key', v_feature_a_key::text, 'body', 'ميزة أ محدثة')
      )
    )
  );
  if exists (select 1 from public.project_features where id = v_feature_b_id) then
    raise exception 'explicit feature deletion tombstone failed';
  end if;

  -- Delete the old overview video before inserting its replacement. This must
  -- not trip the single-overview partial unique index.
  perform * from public.save_project_admin_entry(
    v_project_id,
    jsonb_build_object(
      'project', v_root,
      'deleted', jsonb_build_object('video_ids', jsonb_build_array(v_old_video_id)),
      'videos', jsonb_build_array(
        jsonb_build_object('client_key', v_new_video_key::text, 'section', 'overview', 'video_url', 'https://example.com/new-video', 'poster_alt', '')
      )
    )
  );
  select id into strict v_new_video_id from public.project_videos where project_id = v_project_id and client_key = v_new_video_key;
  if exists (select 1 from public.project_videos where id = v_old_video_id)
     or v_new_video_id = v_old_video_id then
    raise exception 'overview-video explicit replacement failed';
  end if;

  -- Direct writes cannot bypass type immutability or the location hierarchy.
  v_failed := false;
  begin
    update public.projects set type = 'commercial' where id = v_project_id;
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'project type immutability trigger failed';
  end if;

  v_failed := false;
  begin
    update public.project_locations set parent_id = v_other_governorate_id where id = v_city_id;
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'referenced location reparent guard failed';
  end if;

  v_failed := false;
  begin
    update public.project_locations set is_active = false where id = v_sub_area_id;
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'referenced location deactivation guard failed';
  end if;

  -- Forced failure occurs after the root, a new location point, features and a
  -- floor-plan row have been touched. The failing empty detail must roll every
  -- part of the aggregate back to its exact previous state.
  v_failed := false;
  begin
    perform * from public.save_project_admin_entry(
      v_project_id,
      jsonb_build_object(
        'project', jsonb_set(v_root, '{arabic_name}', to_jsonb('يجب التراجع عن هذا الاسم'::text)),
        'location_points', jsonb_build_array(
          jsonb_build_object('id', v_point_b_id, 'client_key', v_point_b_key::text, 'kind', 'road', 'label', 'محور ب يجب التراجع عنه', 'distance_text', '5 دقائق'),
          jsonb_build_object('id', v_point_a_id, 'client_key', v_point_a_key::text, 'kind', 'road', 'label', 'محور أ محدث', 'distance_text', '3 دقائق'),
          jsonb_build_object('client_key', v_rollback_point_key::text, 'kind', 'road', 'label', 'عنصر يجب التراجع عنه', 'distance_text', '1 دقيقة')
        ),
        'features', jsonb_build_array(
          jsonb_build_object('id', v_feature_a_id, 'client_key', v_feature_a_key::text, 'body', 'قيمة يجب التراجع عنها')
        ),
        'floor_plans', jsonb_build_array(
          jsonb_build_object(
            'id', v_plan_b_id,
            'client_key', v_plan_b_key::text,
            'name', 'اسم يجب التراجع عنه',
            'area_text', '120 م2',
            'featured', false,
            'details', jsonb_build_array(
              jsonb_build_object('id', v_detail_b1_id, 'client_key', v_detail_b1_key::text, 'label', 'غرف النوم', 'value', '4')
            )
          ),
          jsonb_build_object(
            'id', v_plan_a_id,
            'client_key', v_plan_a_key::text,
            'name', 'مخطط أ محدث',
            'area_text', '100 م2',
            'featured', true,
            'details', jsonb_build_array(
              jsonb_build_object('id', v_detail_a2_id, 'client_key', v_detail_a2_key::text, 'label', '', 'value', '2'),
              jsonb_build_object('id', v_detail_a1_id, 'client_key', v_detail_a1_key::text, 'label', 'غرف النوم', 'value', '3')
            )
          )
        )
      )
    );
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'forced aggregate failure did not fail';
  end if;
  if not exists (select 1 from public.projects where id = v_project_id and arabic_name = 'مشروع اختبار ذري')
     or not exists (select 1 from public.project_location_points where id = v_point_b_id and label = 'محور ب محدث' and sort_order = 0)
     or not exists (select 1 from public.project_features where id = v_feature_a_id and body = 'ميزة أ محدثة' and sort_order = 0)
     or not exists (select 1 from public.project_floor_plans where id = v_plan_b_id and name = 'مخطط ب محدث' and sort_order = 0)
     or exists (select 1 from public.project_location_points where project_id = v_project_id and client_key = v_rollback_point_key) then
    raise exception 'forced failure left a partial Project aggregate';
  end if;

  -- Explicit root deletion is RPC-owned and cascades the complete disposable
  -- aggregate inside one database transaction.
  perform * from public.delete_project_admin_entry(v_other_project_id);
  if exists (select 1 from public.projects where id = v_other_project_id)
     or exists (select 1 from public.project_features where project_id = v_other_project_id) then
    raise exception 'explicit aggregate delete RPC did not cascade atomically';
  end if;
end
$tests$;

rollback;
