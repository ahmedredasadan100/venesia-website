-- Rollback-only PostgreSQL contract test for
-- 20260731100000_project_row_actions_capability.sql.
-- Run only against a disposable local database after the Project migrations.
-- This fixture must never target Remote/Production and always rolls it back.

begin;

create temporary table project_row_actions_fixture_context (
  source_project_id bigint not null
) on commit drop;

do $fixture_source$
declare
  v_project_id bigint;
  v_plan_id bigint;
  v_governorate_id bigint;
  v_city_id bigint;
  v_main_area_id bigint;
begin
  select id into strict v_governorate_id
    from public.project_locations
   where client_key = 'ca100000-0000-4000-8000-000000000001';
  select id into strict v_city_id
    from public.project_locations
   where client_key = 'ca100000-0000-4000-8000-000000000002';
  select id into strict v_main_area_id
    from public.project_locations
   where client_key = 'ca100000-0000-4000-8000-000000000003';

  insert into public.projects (
    type, arabic_name, english_name, slug,
    general_description, short_description,
    image, image_alt, hero_image, hero_image_alt,
    small_box_image, small_box_image_alt,
    governorate_id, city_id, main_area_id,
    location_label, google_maps_url, latitude, longitude, map_zoom,
    overview_title, overview_body, overview_media_type,
    overview_main_image, overview_main_image_alt,
    delivery_title, delivery_body,
    canonical_url, featured
  ) values (
    'residential', 'مشروع اختبار إجراءات الصف', 'Row Actions Fixture',
    'project-row-actions-fixture',
    'وصف عام كامل لاختبار النسخ الذري.', 'وصف مختصر للاختبار.',
    '/images/project-fixture-card.jpg', 'صورة البطاقة',
    '/images/project-fixture-hero.jpg', 'صورة الغلاف',
    '/images/project-fixture-box.jpg', 'صورة المربع',
    v_governorate_id, v_city_id, v_main_area_id,
    'القاهرة الجديدة', 'https://maps.example.test/project', 30.0, 31.0, 12,
    'نظرة عامة', '<p>تفاصيل النظرة العامة</p>', 'image',
    '/images/project-fixture-overview.jpg', 'صورة النظرة العامة',
    'التسليم', '<p>تفاصيل التسليم</p>',
    'https://example.test/projects/project-row-actions-fixture', true
  ) returning id into v_project_id;

  insert into project_row_actions_fixture_context values (v_project_id);

  insert into public.project_location_points (
    project_id, kind, label, distance_text, sort_order
  ) values (v_project_id, 'road', 'محور الاختبار', '5 دقائق', 0);

  insert into public.project_features (project_id, body, sort_order)
  values (v_project_id, '__qa_duplicate_failure__', 0);

  insert into public.project_floor_plans (
    project_id, name, area_text, featured,
    architectural_image, architectural_image_alt, sort_order
  ) values (
    v_project_id, 'خطة الاختبار', '120 م²', true,
    '/images/project-fixture-plan.jpg', 'المخطط المعماري', 0
  ) returning id into v_plan_id;

  insert into public.project_floor_plan_details (
    floor_plan_id, label, value, sort_order
  ) values (v_plan_id, 'غرف النوم', '3', 0);

  insert into public.project_delivery_items (project_id, body, sort_order)
  values (v_project_id, 'بند تسليم اختباري', 0);

  insert into public.project_media (
    project_id, section, image, alt_text, sort_order
  ) values (
    v_project_id, 'gallery', '/images/project-fixture-gallery.jpg',
    'صورة المعرض', 0
  );

  insert into public.project_videos (
    project_id, section, video_url, poster_image, poster_alt, sort_order
  ) values (
    v_project_id, 'gallery', 'https://video.example.test/project',
    '/images/project-fixture-poster.jpg', 'غلاف الفيديو', 0
  );
end
$fixture_source$;

create or replace function pg_temp.reject_partial_project_duplicate()
returns trigger
language plpgsql
as $function$
declare
  v_source_project_id bigint;
begin
  select source_project_id into strict v_source_project_id
    from pg_temp.project_row_actions_fixture_context;
  if new.project_id <> v_source_project_id
     and new.body = '__qa_duplicate_failure__' then
    raise exception 'forced_project_duplicate_child_failure';
  end if;
  return new;
end
$function$;

create trigger project_features_reject_partial_duplicate_fixture
before insert on public.project_features
for each row execute function pg_temp.reject_partial_project_duplicate();

do $forced_failure$
declare
  v_source_project_id bigint;
  v_before_count bigint;
  v_after_count bigint;
  v_failed boolean := false;
begin
  select source_project_id into strict v_source_project_id
    from pg_temp.project_row_actions_fixture_context;
  select count(*) into v_before_count from public.projects;

  begin
    perform * from public.duplicate_project_admin_entry(v_source_project_id);
  exception
    when others then
      if sqlerrm <> 'forced_project_duplicate_child_failure' then
        raise;
      end if;
      v_failed := true;
  end;

  select count(*) into v_after_count from public.projects;
  if not v_failed or v_after_count <> v_before_count then
    raise exception 'forced duplicate child failure left a partial Project root';
  end if;
end
$forced_failure$;

drop trigger project_features_reject_partial_duplicate_fixture
  on public.project_features;

do $success_and_failure_paths$
declare
  v_source_project_id bigint;
  v_duplicate_project_id bigint;
  v_duplicate_slug text;
  v_featured boolean;
  v_before_count bigint;
  v_after_count bigint;
  v_not_found boolean := false;
begin
  select source_project_id into strict v_source_project_id
    from pg_temp.project_row_actions_fixture_context;

  select project_id, project_slug, featured
    into strict v_duplicate_project_id, v_duplicate_slug, v_featured
    from public.duplicate_project_admin_entry(v_source_project_id);

  if v_duplicate_project_id = v_source_project_id
     or v_duplicate_slug = 'project-row-actions-fixture'
     or v_featured then
    raise exception 'duplicate identity or safe curation defaults are invalid';
  end if;

  if (
    select to_jsonb(source_project) - array[
      'id', 'arabic_name', 'english_name', 'slug', 'canonical_url',
      'featured', 'created_at', 'updated_at'
    ]::text[]
    from public.projects as source_project
    where source_project.id = v_source_project_id
  ) is distinct from (
    select to_jsonb(duplicate_project) - array[
      'id', 'arabic_name', 'english_name', 'slug', 'canonical_url',
      'featured', 'created_at', 'updated_at'
    ]::text[]
    from public.projects as duplicate_project
    where duplicate_project.id = v_duplicate_project_id
  ) then
    raise exception 'duplicate Project root content is incomplete';
  end if;

  if exists (
    select 1
    from public.projects
    where id = v_duplicate_project_id
      and canonical_url is not null
  ) then
    raise exception 'duplicate retained the source canonical URL';
  end if;

  if (select count(*) from public.project_location_points where project_id = v_source_project_id)
      <> (select count(*) from public.project_location_points where project_id = v_duplicate_project_id)
     or (select count(*) from public.project_features where project_id = v_source_project_id)
      <> (select count(*) from public.project_features where project_id = v_duplicate_project_id)
     or (select count(*) from public.project_floor_plans where project_id = v_source_project_id)
      <> (select count(*) from public.project_floor_plans where project_id = v_duplicate_project_id)
     or (select count(*) from public.project_delivery_items where project_id = v_source_project_id)
      <> (select count(*) from public.project_delivery_items where project_id = v_duplicate_project_id)
     or (select count(*) from public.project_media where project_id = v_source_project_id)
      <> (select count(*) from public.project_media where project_id = v_duplicate_project_id)
     or (select count(*) from public.project_videos where project_id = v_source_project_id)
      <> (select count(*) from public.project_videos where project_id = v_duplicate_project_id) then
    raise exception 'duplicate Project child counts are incomplete';
  end if;

  if (
    select count(*)
    from public.project_floor_plan_details as detail
    join public.project_floor_plans as plan on plan.id = detail.floor_plan_id
    where plan.project_id = v_source_project_id
  ) <> (
    select count(*)
    from public.project_floor_plan_details as detail
    join public.project_floor_plans as plan on plan.id = detail.floor_plan_id
    where plan.project_id = v_duplicate_project_id
  ) then
    raise exception 'duplicate floor-plan detail count is incomplete';
  end if;

  if exists (
    select 1
    from public.project_features as source_feature
    join public.project_features as duplicate_feature
      on duplicate_feature.client_key = source_feature.client_key
    where source_feature.project_id = v_source_project_id
      and duplicate_feature.project_id = v_duplicate_project_id
  ) then
    raise exception 'duplicate reused a child client identity';
  end if;

  select featured into strict v_featured
    from public.set_project_featured_admin_entry(v_duplicate_project_id, true);
  if not v_featured
     or not (select featured from public.projects where id = v_duplicate_project_id) then
    raise exception 'authoritative featured RPC did not persist true';
  end if;

  select featured into strict v_featured
    from public.set_project_featured_admin_entry(v_duplicate_project_id, false);
  if v_featured
     or (select featured from public.projects where id = v_duplicate_project_id) then
    raise exception 'authoritative featured RPC did not persist false';
  end if;

  select count(*) into v_before_count from public.projects;
  begin
    perform * from public.duplicate_project_admin_entry(9223372036854775807);
  exception
    when no_data_found then
      v_not_found := true;
  end;
  select count(*) into v_after_count from public.projects;
  if not v_not_found or v_before_count <> v_after_count then
    raise exception 'missing-source duplicate failure mutated Project data';
  end if;
end
$success_and_failure_paths$;

do $acl_assert$
begin
  if has_function_privilege(
    'anon',
    'public.duplicate_project_admin_entry(bigint)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.duplicate_project_admin_entry(bigint)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.set_project_featured_admin_entry(bigint,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.set_project_featured_admin_entry(bigint,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Project Row Actions RPC ACL is broader than service_role';
  end if;
end
$acl_assert$;

rollback;
