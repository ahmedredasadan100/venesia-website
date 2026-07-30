-- Additive Project Admin schema-parity forward fix.
--
-- This migration repairs only the catalog drift proven after the clean rebuild
-- was applied. Removing a legacy column default requires PostgreSQL's
-- ALTER COLUMN DROP DEFAULT metadata operation. No table, constraint, function,
-- sequence, index, policy, trigger, or data set is removed or rebuilt.
-- The only row effect when first applied to the audited empty Remote is four
-- insert-only reference locations. Their identity values are allocated by the
-- existing project_locations_id_seq; this migration never resets, lowers, or
-- otherwise alters any sequence and never changes an existing row or ID.

begin;

set local search_path = pg_catalog, pg_temp;

-- Hold a transaction-scoped lock before the first catalog preflight. This
-- keeps concurrent DDL/DML from changing the audited table state between a
-- fail-closed check and its matching repair. This initial lock permits reads;
-- later ALTER TABLE statements may take stronger locks until the transaction
-- releases every lock automatically at COMMIT or ROLLBACK.
lock table
  public.project_locations,
  public.projects,
  public.project_location_points,
  public.project_features,
  public.project_floor_plans,
  public.project_floor_plan_details,
  public.project_delivery_items,
  public.project_media,
  public.project_videos
in share row exclusive mode;

-- Fail closed unless every touched object is in either the audited pre-fix
-- state or the final rebuild state. Function bodies use the same UTF-8/LF
-- MD5 boundary as pg_proc.prosrc in the read-only parity audit.
do $project_parity_preflight$
declare
  v_table record;
  v_sequence record;
  v_expected_column record;
  v_column record;
  v_default text;
  v_function record;
  v_source_hash text;
  v_check record;
  v_actual_expression text;
  v_expected_expression text;
  v_probe_name text;
  v_trigger record;
  v_level_attnum smallint;
  v_parent_attnum smallint;
  v_active_attnum smallint;
  v_trigger_columns smallint[];
begin
  for v_table in
    select *
      from (values
        ('project_locations', 10),
        ('projects', 41),
        ('project_location_points', 9),
        ('project_features', 7),
        ('project_floor_plans', 13),
        ('project_floor_plan_details', 8),
        ('project_delivery_items', 7),
        ('project_media', 9),
        ('project_videos', 10)
      ) expected(table_name, column_count)
  loop
    if pg_catalog.to_regclass(format('public.%I', v_table.table_name)) is null then
      raise exception using
        errcode = '42P01',
        message = format('Missing required Project table public.%I.', v_table.table_name);
    end if;

    if not exists (
      select 1
        from pg_catalog.pg_class relation
        join pg_catalog.pg_namespace namespace
          on namespace.oid = relation.relnamespace
        join pg_catalog.pg_am access_method
          on access_method.oid = relation.relam
       where namespace.nspname = 'public'
         and relation.relname = v_table.table_name
         and relation.relkind = 'r'
         and relation.relpersistence = 'p'
         and relation.relowner = 'postgres'::regrole
         and access_method.amname = 'heap'
         and relation.relrowsecurity
         and not relation.relforcerowsecurity
         and not relation.relispartition
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Unexpected storage, owner, or RLS properties on public.%I.',
          v_table.table_name
        );
    end if;

    if (
      select count(*)
        from pg_catalog.pg_attribute attribute
       where attribute.attrelid = format('public.%I', v_table.table_name)::regclass
         and attribute.attnum > 0
         and not attribute.attisdropped
    ) <> v_table.column_count then
      raise exception using
        errcode = 'P0001',
        message = format('Unexpected column shape on public.%I.', v_table.table_name);
    end if;
  end loop;

  -- Exact 114-column final manifest derived from the clean rebuild. Only the
  -- ten audited nullable-to-NOT-NULL columns and eleven audited legacy empty-
  -- text defaults may still be in their proven pre-fix state. Every other
  -- name, ordinal, type, nullability, identity/default expression, collation,
  -- storage, inheritance, statistics, ACL, and comment property must already
  -- equal the clean contract before the first persistent repair.
  for v_expected_column in
    select *
      from (values
        ('project_locations', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_locations', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_locations', 3, 'level', 'text', true, '', '', null::text),
        ('project_locations', 4, 'parent_id', 'bigint', false, '', '', null::text),
        ('project_locations', 5, 'name_ar', 'text', true, '', '', null::text),
        ('project_locations', 6, 'name_en', 'text', false, '', '', null::text),
        ('project_locations', 7, 'sort_order', 'integer', true, '', '', '0'),
        ('project_locations', 8, 'is_active', 'boolean', true, '', '', 'true'),
        ('project_locations', 9, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_locations', 10, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('projects', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('projects', 2, 'type', 'text', true, '', '', null::text),
        ('projects', 3, 'arabic_name', 'text', true, '', '', null::text),
        ('projects', 4, 'english_name', 'text', true, '', '', null::text),
        ('projects', 5, 'slug', 'text', true, '', '', null::text),
        ('projects', 6, 'general_description', 'text', true, '', '', null::text),
        ('projects', 7, 'short_description', 'text', true, '', '', null::text),
        ('projects', 8, 'image', 'text', true, '', '', null::text),
        ('projects', 9, 'image_alt', 'text', true, '', '', null::text),
        ('projects', 10, 'hero_image', 'text', true, '', '', null::text),
        ('projects', 11, 'hero_image_alt', 'text', true, '', '', null::text),
        ('projects', 12, 'small_box_image', 'text', true, '', '', null::text),
        ('projects', 13, 'small_box_image_alt', 'text', true, '', '', null::text),
        ('projects', 14, 'governorate_id', 'bigint', true, '', '', null::text),
        ('projects', 15, 'city_id', 'bigint', true, '', '', null::text),
        ('projects', 16, 'main_area_id', 'bigint', true, '', '', null::text),
        ('projects', 17, 'sub_area_id', 'bigint', false, '', '', null::text),
        ('projects', 18, 'location_label', 'text', true, '', '', null::text),
        ('projects', 19, 'location_description', 'text', true, '', '', $$''::text$$),
        ('projects', 20, 'google_maps_url', 'text', true, '', '', null::text),
        ('projects', 21, 'latitude', 'numeric(9,6)', true, '', '', null::text),
        ('projects', 22, 'longitude', 'numeric(9,6)', true, '', '', null::text),
        ('projects', 23, 'map_zoom', 'smallint', true, '', '', null::text),
        ('projects', 24, 'overview_title', 'text', true, '', '', null::text),
        ('projects', 25, 'overview_body', 'text', true, '', '', null::text),
        ('projects', 26, 'overview_media_type', 'text', true, '', '', $$'image'::text$$),
        ('projects', 27, 'overview_main_image', 'text', false, '', '', null::text),
        ('projects', 28, 'overview_main_image_alt', 'text', true, '', '', $$''::text$$),
        ('projects', 29, 'delivery_title', 'text', true, '', '', null::text),
        ('projects', 30, 'delivery_body', 'text', true, '', '', null::text),
        ('projects', 31, 'seo_title', 'text', true, '', '', $$''::text$$),
        ('projects', 32, 'seo_description', 'text', true, '', '', $$''::text$$),
        ('projects', 33, 'focus_keyword', 'text', true, '', '', $$''::text$$),
        ('projects', 34, 'seo_keywords', 'text[]', true, '', '', $$'{}'::text[]$$),
        ('projects', 35, 'canonical_url', 'text', false, '', '', null::text),
        ('projects', 36, 'robots_index', 'boolean', false, '', '', null::text),
        ('projects', 37, 'robots_follow', 'boolean', false, '', '', null::text),
        ('projects', 38, 'og_image', 'text', false, '', '', null::text),
        ('projects', 39, 'og_image_alt', 'text', true, '', '', $$''::text$$),
        ('projects', 40, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('projects', 41, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_location_points', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_location_points', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_location_points', 3, 'project_id', 'bigint', true, '', '', null::text),
        ('project_location_points', 4, 'kind', 'text', true, '', '', null::text),
        ('project_location_points', 5, 'label', 'text', true, '', '', null::text),
        ('project_location_points', 6, 'distance_text', 'text', true, '', '', $$''::text$$),
        ('project_location_points', 7, 'sort_order', 'integer', true, '', '', null::text),
        ('project_location_points', 8, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_location_points', 9, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_features', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_features', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_features', 3, 'project_id', 'bigint', true, '', '', null::text),
        ('project_features', 4, 'body', 'text', true, '', '', null::text),
        ('project_features', 5, 'sort_order', 'integer', true, '', '', null::text),
        ('project_features', 6, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_features', 7, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_floor_plans', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_floor_plans', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_floor_plans', 3, 'project_id', 'bigint', true, '', '', null::text),
        ('project_floor_plans', 4, 'name', 'text', true, '', '', null::text),
        ('project_floor_plans', 5, 'area_text', 'text', true, '', '', $$''::text$$),
        ('project_floor_plans', 6, 'featured', 'boolean', true, '', '', 'false'),
        ('project_floor_plans', 7, 'architectural_image', 'text', false, '', '', null::text),
        ('project_floor_plans', 8, 'architectural_image_alt', 'text', true, '', '', $$''::text$$),
        ('project_floor_plans', 9, 'furnishing_image', 'text', false, '', '', null::text),
        ('project_floor_plans', 10, 'furnishing_image_alt', 'text', true, '', '', $$''::text$$),
        ('project_floor_plans', 11, 'sort_order', 'integer', true, '', '', null::text),
        ('project_floor_plans', 12, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_floor_plans', 13, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_floor_plan_details', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_floor_plan_details', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_floor_plan_details', 3, 'floor_plan_id', 'bigint', true, '', '', null::text),
        ('project_floor_plan_details', 4, 'label', 'text', true, '', '', null::text),
        ('project_floor_plan_details', 5, 'value', 'text', true, '', '', null::text),
        ('project_floor_plan_details', 6, 'sort_order', 'integer', true, '', '', null::text),
        ('project_floor_plan_details', 7, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_floor_plan_details', 8, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_delivery_items', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_delivery_items', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_delivery_items', 3, 'project_id', 'bigint', true, '', '', null::text),
        ('project_delivery_items', 4, 'body', 'text', true, '', '', null::text),
        ('project_delivery_items', 5, 'sort_order', 'integer', true, '', '', null::text),
        ('project_delivery_items', 6, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_delivery_items', 7, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_media', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_media', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_media', 3, 'project_id', 'bigint', true, '', '', null::text),
        ('project_media', 4, 'section', 'text', true, '', '', null::text),
        ('project_media', 5, 'image', 'text', true, '', '', null::text),
        ('project_media', 6, 'alt_text', 'text', true, '', '', null::text),
        ('project_media', 7, 'sort_order', 'integer', true, '', '', null::text),
        ('project_media', 8, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_media', 9, 'updated_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_videos', 1, 'id', 'bigint', true, 'd', '', null::text),
        ('project_videos', 2, 'client_key', 'uuid', true, '', '', 'gen_random_uuid()'),
        ('project_videos', 3, 'project_id', 'bigint', true, '', '', null::text),
        ('project_videos', 4, 'section', 'text', true, '', '', null::text),
        ('project_videos', 5, 'video_url', 'text', true, '', '', null::text),
        ('project_videos', 6, 'poster_image', 'text', false, '', '', null::text),
        ('project_videos', 7, 'poster_alt', 'text', true, '', '', $$''::text$$),
        ('project_videos', 8, 'sort_order', 'integer', true, '', '', null::text),
        ('project_videos', 9, 'created_at', 'timestamp with time zone', true, '', '', 'now()'),
        ('project_videos', 10, 'updated_at', 'timestamp with time zone', true, '', '', 'now()')
      ) expected(
        table_name,
        ordinal_position,
        column_name,
        data_type,
        not_null,
        identity_kind,
        generated_kind,
        default_expression
      )
  loop
    if not exists (
      select 1
        from pg_catalog.pg_attribute attribute
        join pg_catalog.pg_type type_record
          on type_record.oid = attribute.atttypid
        left join pg_catalog.pg_attrdef default_record
          on default_record.adrelid = attribute.attrelid
         and default_record.adnum = attribute.attnum
       where attribute.attrelid = format(
         'public.%I',
         v_expected_column.table_name
       )::regclass
         and attribute.attnum = v_expected_column.ordinal_position
         and attribute.attname = v_expected_column.column_name
         and not attribute.attisdropped
         and pg_catalog.format_type(
           attribute.atttypid,
           attribute.atttypmod
         ) = v_expected_column.data_type
         and attribute.attidentity::text = v_expected_column.identity_kind
         and attribute.attgenerated::text = v_expected_column.generated_kind
         and (
           attribute.attnotnull = v_expected_column.not_null
           or (
             v_expected_column.table_name = 'projects'
             and v_expected_column.column_name = any (array[
               'image',
               'hero_image',
               'small_box_image',
               'governorate_id',
               'city_id',
               'main_area_id',
               'google_maps_url',
               'latitude',
               'longitude',
               'map_zoom'
             ])
             and v_expected_column.not_null
             and not attribute.attnotnull
           )
         )
         and (
           pg_catalog.pg_get_expr(
             default_record.adbin,
             default_record.adrelid
           ) is not distinct from v_expected_column.default_expression
           or (
             (v_expected_column.table_name, v_expected_column.column_name) in (
               values
                 ('projects', 'general_description'),
                 ('projects', 'short_description'),
                 ('projects', 'image_alt'),
                 ('projects', 'hero_image_alt'),
                 ('projects', 'small_box_image_alt'),
                 ('projects', 'location_label'),
                 ('projects', 'overview_title'),
                 ('projects', 'overview_body'),
                 ('projects', 'delivery_title'),
                 ('projects', 'delivery_body'),
                 ('project_media', 'alt_text')
             )
             and v_expected_column.default_expression is null
             and pg_catalog.pg_get_expr(
               default_record.adbin,
               default_record.adrelid
             ) = $$''::text$$
           )
         )
         and attribute.attcollation = type_record.typcollation
         and attribute.attstorage = type_record.typstorage
         and attribute.attcompression::integer = 0
         -- PostgreSQL 17 exposes the default statistics target semantically as
         -- NULL or -1::smallint; keep the comparison explicit and type-safe.
         and (
           attribute.attstattarget is null
           or attribute.attstattarget = (-1)::smallint
         )
         and attribute.attislocal
         and attribute.attinhcount = 0
         and not attribute.atthasmissing
         -- NULL and an empty ACL array are equivalent only when they expand to
         -- no column grants; the final ACL assertion verifies that separately.
         and (
           attribute.attacl is null
           or pg_catalog.cardinality(attribute.attacl) = 0
         )
         and pg_catalog.col_description(
           attribute.attrelid,
           attribute.attnum
         ) is null
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Column public.%I.%I is outside the audited pre-fix/final manifest.',
          v_expected_column.table_name,
          v_expected_column.column_name
        );
    end if;
  end loop;

  if (
    select count(*)
      from pg_catalog.pg_trigger trigger_record
     where trigger_record.tgrelid = any (array[
       'public.project_locations'::regclass,
       'public.projects'::regclass,
       'public.project_location_points'::regclass,
       'public.project_features'::regclass,
       'public.project_floor_plans'::regclass,
       'public.project_floor_plan_details'::regclass,
       'public.project_delivery_items'::regclass,
       'public.project_media'::regclass,
       'public.project_videos'::regclass
     ])
       and not trigger_record.tgisinternal
  ) <> 4 then
    raise exception using
      errcode = 'P0001',
      message = 'Unexpected pre-fix Project aggregate user-trigger count.';
  end if;

  for v_sequence in
    select *
      from (values
        ('project_locations', 'project_locations_id_seq'),
        ('projects', 'projects_id_seq'),
        ('project_location_points', 'project_location_points_id_seq'),
        ('project_features', 'project_features_id_seq'),
        ('project_floor_plans', 'project_floor_plans_id_seq'),
        ('project_floor_plan_details', 'project_floor_plan_details_id_seq'),
        ('project_delivery_items', 'project_delivery_items_id_seq'),
        ('project_media', 'project_media_id_seq'),
        ('project_videos', 'project_videos_id_seq')
      ) expected(table_name, sequence_name)
  loop
    if not exists (
      select 1
        from pg_catalog.pg_class sequence_relation
        join pg_catalog.pg_namespace sequence_namespace
          on sequence_namespace.oid = sequence_relation.relnamespace
        join pg_catalog.pg_sequence sequence_record
          on sequence_record.seqrelid = sequence_relation.oid
        join pg_catalog.pg_class table_relation
          on table_relation.relnamespace = sequence_relation.relnamespace
         and table_relation.relname = v_sequence.table_name
        join pg_catalog.pg_attribute id_attribute
          on id_attribute.attrelid = table_relation.oid
         and id_attribute.attname = 'id'
         and id_attribute.attidentity = 'd'
         and id_attribute.atttypid = 'bigint'::regtype
        join pg_catalog.pg_depend dependency
          on dependency.classid = 'pg_class'::regclass
         and dependency.objid = sequence_relation.oid
         and dependency.refclassid = 'pg_class'::regclass
         and dependency.refobjid = table_relation.oid
         and dependency.refobjsubid = id_attribute.attnum
         and dependency.deptype = 'i'
       where sequence_namespace.nspname = 'public'
         and sequence_relation.relname = v_sequence.sequence_name
         and sequence_relation.relkind = 'S'
         and sequence_relation.relpersistence = 'p'
         and sequence_relation.relowner = 'postgres'::regrole
         and table_relation.relowner = 'postgres'::regrole
         and sequence_record.seqtypid = 'bigint'::regtype
         and sequence_record.seqstart = 1
         and sequence_record.seqincrement = 1
         and sequence_record.seqmin = 1
         and sequence_record.seqmax = 9223372036854775807
         and sequence_record.seqcache = 1
         and not sequence_record.seqcycle
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Unexpected identity-sequence contract for public.%I.',
          v_sequence.sequence_name
        );
    end if;
  end loop;

  for v_column in
    select *
      from (values
        ('projects', 'general_description', 'text'),
        ('projects', 'short_description', 'text'),
        ('projects', 'image', 'text'),
        ('projects', 'image_alt', 'text'),
        ('projects', 'hero_image', 'text'),
        ('projects', 'hero_image_alt', 'text'),
        ('projects', 'small_box_image', 'text'),
        ('projects', 'small_box_image_alt', 'text'),
        ('projects', 'governorate_id', 'bigint'),
        ('projects', 'city_id', 'bigint'),
        ('projects', 'main_area_id', 'bigint'),
        ('projects', 'location_label', 'text'),
        ('projects', 'google_maps_url', 'text'),
        ('projects', 'latitude', 'numeric(9,6)'),
        ('projects', 'longitude', 'numeric(9,6)'),
        ('projects', 'map_zoom', 'smallint'),
        ('projects', 'overview_title', 'text'),
        ('projects', 'overview_body', 'text'),
        ('projects', 'delivery_title', 'text'),
        ('projects', 'delivery_body', 'text'),
        ('project_media', 'alt_text', 'text')
      ) expected(table_name, column_name, data_type)
  loop
    if not exists (
      select 1
        from pg_catalog.pg_attribute attribute
       where attribute.attrelid = format('public.%I', v_column.table_name)::regclass
         and attribute.attname = v_column.column_name
         and attribute.attnum > 0
         and not attribute.attisdropped
         and pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = v_column.data_type
         and attribute.attidentity = ''
         and attribute.attgenerated = ''
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Unexpected Project column contract for public.%I.%I.',
          v_column.table_name,
          v_column.column_name
        );
    end if;
  end loop;

  if exists (
    select 1
      from (values
        ('projects', 'general_description'),
        ('projects', 'short_description'),
        ('projects', 'image_alt'),
        ('projects', 'hero_image_alt'),
        ('projects', 'small_box_image_alt'),
        ('projects', 'location_label'),
        ('projects', 'overview_title'),
        ('projects', 'overview_body'),
        ('projects', 'delivery_title'),
        ('projects', 'delivery_body'),
        ('project_media', 'alt_text')
      ) expected(table_name, column_name)
     where not exists (
       select 1
         from pg_catalog.pg_attribute attribute
        where attribute.attrelid = format('public.%I', expected.table_name)::regclass
          and attribute.attname = expected.column_name
          and attribute.attnotnull
     )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A non-drifting Project NOT NULL property is outside the proven contract.';
  end if;

  if exists (
    select 1
      from unnest(array[
        'image',
        'hero_image',
        'small_box_image',
        'governorate_id',
        'city_id',
        'main_area_id',
        'google_maps_url',
        'latitude',
        'longitude',
        'map_zoom'
      ]) expected(column_name)
      join pg_catalog.pg_attribute attribute
        on attribute.attrelid = 'public.projects'::regclass
       and attribute.attname = expected.column_name
      join pg_catalog.pg_attrdef default_record
        on default_record.adrelid = attribute.attrelid
       and default_record.adnum = attribute.attnum
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'An unexpected default exists on a Project NOT NULL drift column.';
  end if;

  -- These eleven columns are allowed to have only the audited legacy empty-text
  -- default or the final no-default state.
  for v_column in
    select *
      from (values
        ('projects', 'general_description'),
        ('projects', 'short_description'),
        ('projects', 'image_alt'),
        ('projects', 'hero_image_alt'),
        ('projects', 'small_box_image_alt'),
        ('projects', 'location_label'),
        ('projects', 'overview_title'),
        ('projects', 'overview_body'),
        ('projects', 'delivery_title'),
        ('projects', 'delivery_body'),
        ('project_media', 'alt_text')
      ) expected(table_name, column_name)
  loop
    select pg_catalog.pg_get_expr(default_record.adbin, default_record.adrelid)
      into v_default
      from pg_catalog.pg_attribute attribute
      left join pg_catalog.pg_attrdef default_record
        on default_record.adrelid = attribute.attrelid
       and default_record.adnum = attribute.attnum
     where attribute.attrelid = format('public.%I', v_column.table_name)::regclass
       and attribute.attname = v_column.column_name;

    if v_default is not null
       and v_default <> (pg_catalog.quote_literal('') || '::text') then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Unexpected legacy default on public.%I.%I: %s.',
          v_column.table_name,
          v_column.column_name,
          v_default
        );
    end if;
  end loop;

  -- Every identity column must retain the final BY DEFAULT identity contract.
  if exists (
    select 1
      from unnest(array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ]) expected(table_name)
     where not exists (
       select 1
         from pg_catalog.pg_attribute attribute
        where attribute.attrelid = format('public.%I', expected.table_name)::regclass
          and attribute.attname = 'id'
          and attribute.atttypid = 'bigint'::regtype
          and attribute.attnotnull
          and attribute.attidentity = 'd'
          and attribute.attgenerated = ''
     )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A Project aggregate identity column is outside the proven contract.';
  end if;

  for v_check in
    select *
      from (values
        ('projects', 'projects_general_description_check', $$CHECK (btrim(general_description) <> ''::text AND char_length(general_description) <= 1000)$$),
        ('projects', 'projects_short_description_check', $$CHECK (btrim(short_description) <> ''::text AND char_length(short_description) <= 500)$$),
        ('projects', 'projects_image_check', $$CHECK (btrim(image) <> ''::text)$$),
        ('projects', 'projects_image_alt_check', $$CHECK (btrim(image_alt) <> ''::text)$$),
        ('projects', 'projects_hero_image_check', $$CHECK (btrim(hero_image) <> ''::text)$$),
        ('projects', 'projects_hero_image_alt_check', $$CHECK (btrim(hero_image_alt) <> ''::text)$$),
        ('projects', 'projects_small_box_image_check', $$CHECK (btrim(small_box_image) <> ''::text)$$),
        ('projects', 'projects_small_box_image_alt_check', $$CHECK (btrim(small_box_image_alt) <> ''::text)$$),
        ('projects', 'projects_location_label_check', $$CHECK (btrim(location_label) <> ''::text)$$),
        ('projects', 'projects_google_maps_url_check', $$CHECK (btrim(google_maps_url) <> ''::text AND google_maps_url ~* '^https?://'::text)$$),
        ('projects', 'projects_overview_title_check', $$CHECK (btrim(overview_title) <> ''::text)$$),
        ('projects', 'projects_overview_body_check', $$CHECK (btrim(regexp_replace(replace(overview_body, '&nbsp;'::text, ' '::text), '<[^>]*>'::text, ''::text, 'g'::text)) <> ''::text)$$),
        ('projects', 'projects_delivery_title_check', $$CHECK (btrim(delivery_title) <> ''::text)$$),
        ('projects', 'projects_delivery_body_check', $$CHECK (btrim(regexp_replace(replace(delivery_body, '&nbsp;'::text, ' '::text), '<[^>]*>'::text, ''::text, 'g'::text)) <> ''::text)$$),
        ('projects', 'projects_seo_title_check', $$CHECK (char_length(seo_title) <= 60)$$),
        ('projects', 'projects_seo_description_check', $$CHECK (char_length(seo_description) <= 160)$$),
        ('projects', 'projects_canonical_url_check', $$CHECK (canonical_url IS NULL OR canonical_url ~* '^https?://'::text)$$),
        ('projects', 'projects_overview_image_required_check', $$CHECK (overview_media_type <> 'image'::text OR COALESCE(btrim(overview_main_image), ''::text) <> ''::text AND btrim(overview_main_image_alt) <> ''::text)$$),
        ('projects', 'projects_overview_image_alt_check', $$CHECK (overview_main_image IS NULL OR btrim(overview_main_image_alt) <> ''::text)$$),
        ('projects', 'projects_og_image_alt_check', $$CHECK (og_image IS NULL OR btrim(og_image_alt) <> ''::text)$$),
        ('project_floor_plans', 'project_floor_plans_architectural_image_alt_check', $$CHECK (architectural_image IS NULL OR btrim(architectural_image_alt) <> ''::text)$$),
        ('project_floor_plans', 'project_floor_plans_furnishing_image_alt_check', $$CHECK (furnishing_image IS NULL OR btrim(furnishing_image_alt) <> ''::text)$$),
        ('project_media', 'project_media_alt_text_check', $$CHECK (btrim(alt_text) <> ''::text)$$),
        ('project_videos', 'project_videos_poster_alt_check', $$CHECK (poster_image IS NULL OR btrim(poster_alt) <> ''::text)$$)
      ) expected(table_name, constraint_name, definition)
  loop
    select pg_catalog.pg_get_expr(
             constraint_record.conbin,
             constraint_record.conrelid,
             true
           )
      into v_actual_expression
      from pg_catalog.pg_constraint constraint_record
     where constraint_record.conrelid = format('public.%I', v_check.table_name)::regclass
       and constraint_record.conname = v_check.constraint_name
       and constraint_record.contype = 'c'
       and constraint_record.convalidated
       and not constraint_record.condeferrable
       and not constraint_record.condeferred
       and not constraint_record.connoinherit
       and constraint_record.conislocal
       and constraint_record.coninhcount = 0
       and constraint_record.conparentid = 0;

    if exists (
      select 1
        from pg_catalog.pg_constraint constraint_record
       where constraint_record.conrelid = format('public.%I', v_check.table_name)::regclass
         and constraint_record.conname = v_check.constraint_name
    ) then
      if v_actual_expression is null then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Constraint public.%I.%I has unexpected properties.',
            v_check.table_name,
            v_check.constraint_name
          );
      end if;

      -- Ask PostgreSQL itself to parse and deparse the final expression on the
      -- same table. Comparing pg_get_expr output ignores parser source offsets
      -- without weakening literal or operator equality. The deliberate inner
      -- exception rolls the NOT VALID probe back without any DROP statement;
      -- PL/pgSQL retains v_expected_expression for comparison.
      v_probe_name := '__project_parity_probe_' || pg_catalog.substr(
        pg_catalog.md5(v_check.table_name || '.' || v_check.constraint_name),
        1,
        24
      );
      if exists (
        select 1
          from pg_catalog.pg_constraint constraint_record
         where constraint_record.conrelid = format(
           'public.%I',
           v_check.table_name
         )::regclass
           and constraint_record.conname = v_probe_name
      ) then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Reserved parity probe constraint %I already exists.',
            v_probe_name
          );
      end if;

      begin
        execute format(
          'alter table public.%I add constraint %I %s not valid',
          v_check.table_name,
          v_probe_name,
          v_check.definition
        );
        select pg_catalog.pg_get_expr(
                 constraint_record.conbin,
                 constraint_record.conrelid,
                 true
               )
          into strict v_expected_expression
          from pg_catalog.pg_constraint constraint_record
         where constraint_record.conrelid = format(
           'public.%I',
           v_check.table_name
         )::regclass
           and constraint_record.conname = v_probe_name;
        raise exception using
          errcode = 'PZ001',
          message = 'Rollback the Project parity constraint probe.';
      exception
        when sqlstate 'PZ001' then
          null;
      end;

      if v_actual_expression is distinct from v_expected_expression then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Constraint public.%I.%I is outside the audited absent/final allowlist.',
            v_check.table_name,
            v_check.constraint_name
          );
      end if;
    end if;
  end loop;

  for v_function in
    select *
      from (values
        (
          'public.save_project_admin_entry(bigint,jsonb)',
          true,
          '6aab9cd6da9f3f674f8d969beff4474a',
          'aa3258d57ab320cd0fa46eeb2595ae7c',
          'record',
          true,
          2
        ),
        (
          'public.validate_project_location_parent()',
          false,
          '13ed0967def04f65e20bea7bc5d55b2e',
          'b2952745f6f845a341d55bfcefa9129e',
          'trigger',
          false,
          0
        ),
        (
          'public.validate_project_location_selection()',
          false,
          '91facfd5fccb15f83ab0451fa5b211ad',
          '5e401c75615c4e0d68704ccd593ce0d9',
          'trigger',
          false,
          0
        ),
        (
          'public.prevent_project_location_reparent()',
          false,
          'e2d86fbb475fbe1bcd8980293a143ff9',
          '1e9707b8b31a3050ab2639ea71c1391b',
          'trigger',
          false,
          0
        ),
        (
          'public.prevent_project_type_change()',
          false,
          '70bfd044e16a5325cf65f4b8b4ba16f3',
          '70bfd044e16a5325cf65f4b8b4ba16f3',
          'trigger',
          false,
          0
        ),
        (
          'public.delete_project_admin_entry(bigint)',
          true,
          '0b989a1d6bebfdc8c3b26f722a346f4a',
          '0b989a1d6bebfdc8c3b26f722a346f4a',
          'record',
          true,
          0
        )
      ) expected(
        signature,
        security_definer,
        old_hash,
        final_hash,
        result_type,
        returns_set,
        default_argument_count
      )
  loop
    if pg_catalog.to_regprocedure(v_function.signature) is null then
      raise exception using
        errcode = '42883',
        message = format('Missing required Project function %s.', v_function.signature);
    end if;

    select pg_catalog.md5(
             pg_catalog.replace(
               pg_catalog.replace(procedure_record.prosrc, E'\r\n', E'\n'),
               E'\r',
               E'\n'
             )
           )
      into v_source_hash
      from pg_catalog.pg_proc procedure_record
      join pg_catalog.pg_language language
        on language.oid = procedure_record.prolang
     where procedure_record.oid = v_function.signature::regprocedure
       and language.lanname = 'plpgsql'
       and procedure_record.proowner = 'postgres'::regrole
       and procedure_record.prokind = 'f'
       and procedure_record.prosecdef = v_function.security_definer
       and procedure_record.prorettype = v_function.result_type::regtype
       and procedure_record.proretset = v_function.returns_set
       and procedure_record.pronargdefaults = v_function.default_argument_count
       and procedure_record.provolatile = 'v'
       and not procedure_record.proisstrict
       and not procedure_record.proleakproof
       and procedure_record.proparallel = 'u'
       and procedure_record.proconfig = array['search_path=pg_catalog, pg_temp']::text[];

    if v_source_hash is null
       or v_source_hash not in (v_function.old_hash, v_function.final_hash) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Function %s is outside the audited old/final body allowlist (%s).',
          v_function.signature,
          coalesce(v_source_hash, 'property mismatch')
        );
    end if;
  end loop;

  if (
    select count(*)
      from pg_catalog.pg_proc procedure_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = procedure_record.pronamespace
     where namespace.nspname = 'public'
       and procedure_record.proname = any (array[
         'save_project_admin_entry',
         'delete_project_admin_entry',
         'validate_project_location_parent',
         'prevent_project_type_change',
         'validate_project_location_selection',
         'prevent_project_location_reparent'
       ])
  ) <> 6
     or pg_catalog.to_regprocedure(
       'public.sync_project_children(bigint,jsonb,jsonb,jsonb,jsonb,jsonb)'
     ) is not null
     or pg_catalog.to_regprocedure(
       'public.admin_list_projects(integer,integer,text,text,text,text,text,text,text,text)'
     ) is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Unexpected Project function signature or forbidden legacy function.';
  end if;

  select attribute.attnum
    into v_level_attnum
    from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.project_locations'::regclass
     and attribute.attname = 'level';
  select attribute.attnum
    into v_parent_attnum
    from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.project_locations'::regclass
     and attribute.attname = 'parent_id';
  select attribute.attnum
    into v_active_attnum
    from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.project_locations'::regclass
     and attribute.attname = 'is_active';

  for v_trigger in
    select *
      from (values
        (
          'project_locations_validate_parent',
          23,
          'public.validate_project_location_parent()'
        ),
        (
          'project_locations_prevent_reparent',
          19,
          'public.prevent_project_location_reparent()'
        )
      ) expected(trigger_name, trigger_type, function_signature)
  loop
    select array_agg(attribute.attnum::smallint order by attribute.attnum)
      into v_trigger_columns
      from pg_catalog.pg_trigger trigger_record
      join pg_catalog.pg_attribute attribute
        on attribute.attrelid = trigger_record.tgrelid
       and attribute.attnum = any (trigger_record.tgattr)
     where trigger_record.tgrelid = 'public.project_locations'::regclass
       and trigger_record.tgname = v_trigger.trigger_name
       and not trigger_record.tgisinternal
       and trigger_record.tgenabled = 'O'
       and trigger_record.tgtype = v_trigger.trigger_type
       and trigger_record.tgfoid = v_trigger.function_signature::regprocedure
       and trigger_record.tgqual is null
       and trigger_record.tgnargs = 0
       and trigger_record.tgoldtable is null
       and trigger_record.tgnewtable is null
       and trigger_record.tgparentid = 0
       and trigger_record.tgconstraint = 0
       and trigger_record.tgconstrrelid = 0
       and not trigger_record.tgdeferrable
       and not trigger_record.tginitdeferred;

    if v_trigger_columns is null
       or (
         v_trigger_columns <> array[v_level_attnum, v_parent_attnum]::smallint[]
         and v_trigger_columns <>
           array[v_level_attnum, v_parent_attnum, v_active_attnum]::smallint[]
       ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Trigger %I is outside the audited old/final UPDATE OF contract.',
          v_trigger.trigger_name
        );
    end if;
  end loop;

  if exists (
    with expected(
      client_key,
      level,
      parent_client_key,
      name_ar,
      name_en,
      sort_order,
      is_active
    ) as (
      values
        (
          'ca100000-0000-4000-8000-000000000001'::uuid,
          'governorate',
          null::uuid,
          'القاهرة',
          'Cairo',
          0,
          true
        ),
        (
          'ca100000-0000-4000-8000-000000000002'::uuid,
          'city',
          'ca100000-0000-4000-8000-000000000001'::uuid,
          'القاهرة الجديدة',
          'New Cairo',
          0,
          true
        ),
        (
          'ca100000-0000-4000-8000-000000000003'::uuid,
          'main_area',
          'ca100000-0000-4000-8000-000000000002'::uuid,
          'التجمع الخامس',
          'Fifth Settlement',
          0,
          true
        ),
        (
          'ca100000-0000-4000-8000-000000000004'::uuid,
          'sub_area',
          'ca100000-0000-4000-8000-000000000003'::uuid,
          'الحي الثاني',
          'Second District',
          0,
          true
        )
    )
    select 1
      from expected
      join public.project_locations location
        on location.client_key = expected.client_key
      left join public.project_locations parent
        on parent.id = location.parent_id
     where location.level is distinct from expected.level
        or parent.client_key is distinct from expected.parent_client_key
        or location.name_ar is distinct from expected.name_ar
        or location.name_en is distinct from expected.name_en
        or location.sort_order is distinct from expected.sort_order
        or location.is_active is distinct from expected.is_active
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'An existing final reference-location client key has conflicting data.';
  end if;

  -- Do not adopt, re-key, or overwrite a future natural-key row. If a final
  -- client key is absent while the same canonical node already exists under
  -- its expected parent with another key, stop before the first DDL/DML.
  if exists (
    with expected(
      client_key,
      level,
      parent_client_key,
      name_ar
    ) as (
      values
        (
          'ca100000-0000-4000-8000-000000000001'::uuid,
          'governorate',
          null::uuid,
          'القاهرة'
        ),
        (
          'ca100000-0000-4000-8000-000000000002'::uuid,
          'city',
          'ca100000-0000-4000-8000-000000000001'::uuid,
          'القاهرة الجديدة'
        ),
        (
          'ca100000-0000-4000-8000-000000000003'::uuid,
          'main_area',
          'ca100000-0000-4000-8000-000000000002'::uuid,
          'التجمع الخامس'
        ),
        (
          'ca100000-0000-4000-8000-000000000004'::uuid,
          'sub_area',
          'ca100000-0000-4000-8000-000000000003'::uuid,
          'الحي الثاني'
        )
    )
    select 1
      from expected
      left join public.project_locations target
        on target.client_key = expected.client_key
      left join public.project_locations expected_parent
        on expected_parent.client_key = expected.parent_client_key
      join public.project_locations collision
        on collision.level = expected.level
       and collision.name_ar = expected.name_ar
       and collision.parent_id is not distinct from expected_parent.id
     where target.id is null
       and (
         expected.parent_client_key is null
         or expected_parent.id is not null
       )
       and collision.client_key <> expected.client_key
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A canonical reference location exists under another client key.';
  end if;
end
$project_parity_preflight$;

-- Validate all existing rows before tightening nullability or adding checks.
do $project_parity_data_guard$
begin
  if exists (
    select 1
      from public.projects project
     where project.image is null
        or project.hero_image is null
        or project.small_box_image is null
        or project.governorate_id is null
        or project.city_id is null
        or project.main_area_id is null
        or project.google_maps_url is null
        or project.latitude is null
        or project.longitude is null
        or project.map_zoom is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'Existing Project data cannot satisfy the final NOT NULL contract.';
  end if;

  if exists (
    select 1
      from public.projects project
     where project.general_description is null
        or btrim(project.general_description) = ''
        or char_length(project.general_description) > 1000
        or project.short_description is null
        or btrim(project.short_description) = ''
        or char_length(project.short_description) > 500
        or btrim(project.image) = ''
        or project.image_alt is null
        or btrim(project.image_alt) = ''
        or btrim(project.hero_image) = ''
        or project.hero_image_alt is null
        or btrim(project.hero_image_alt) = ''
        or btrim(project.small_box_image) = ''
        or project.small_box_image_alt is null
        or btrim(project.small_box_image_alt) = ''
        or project.location_label is null
        or btrim(project.location_label) = ''
        or btrim(project.google_maps_url) = ''
        or project.google_maps_url !~* '^https?://'
        or project.overview_title is null
        or btrim(project.overview_title) = ''
        or project.overview_body is null
        or btrim(regexp_replace(replace(project.overview_body, '&nbsp;', ' '), '<[^>]*>', '', 'g')) = ''
        or project.delivery_title is null
        or btrim(project.delivery_title) = ''
        or project.delivery_body is null
        or btrim(regexp_replace(replace(project.delivery_body, '&nbsp;', ' '), '<[^>]*>', '', 'g')) = ''
        or project.seo_title is null
        or char_length(project.seo_title) > 60
        or project.seo_description is null
        or char_length(project.seo_description) > 160
        or (
          project.canonical_url is not null
          and project.canonical_url !~* '^https?://'
        )
        or (
          project.overview_media_type = 'image'
          and (
            coalesce(btrim(project.overview_main_image), '') = ''
            or btrim(project.overview_main_image_alt) = ''
          )
        )
        or (
          project.overview_main_image is not null
          and btrim(project.overview_main_image_alt) = ''
        )
        or (
          project.og_image is not null
          and btrim(project.og_image_alt) = ''
        )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Existing Project data cannot satisfy the final Project checks.';
  end if;

  if exists (
    select 1
      from public.project_floor_plans plan
     where (
       plan.architectural_image is not null
       and btrim(plan.architectural_image_alt) = ''
     )
        or (
          plan.furnishing_image is not null
          and btrim(plan.furnishing_image_alt) = ''
        )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Existing floor-plan data cannot satisfy the final image-alt checks.';
  end if;

  if exists (
    select 1
      from public.project_media media
     where media.alt_text is null or btrim(media.alt_text) = ''
  ) then
    raise exception using
      errcode = '23514',
      message = 'Existing Project media cannot satisfy the final alt-text check.';
  end if;

  if exists (
    select 1
      from public.project_videos video
     where video.poster_image is not null
       and btrim(video.poster_alt) = ''
  ) then
    raise exception using
      errcode = '23514',
      message = 'Existing Project videos cannot satisfy the final poster-alt check.';
  end if;
end
$project_parity_data_guard$;

-- Metadata-only removal of the audited legacy defaults.
alter table public.projects
  alter column general_description drop default,
  alter column short_description drop default,
  alter column image_alt drop default,
  alter column hero_image_alt drop default,
  alter column small_box_image_alt drop default,
  alter column location_label drop default,
  alter column overview_title drop default,
  alter column overview_body drop default,
  alter column delivery_title drop default,
  alter column delivery_body drop default;

alter table public.project_media
  alter column alt_text drop default;

alter table public.projects
  alter column image set not null,
  alter column hero_image set not null,
  alter column small_box_image set not null,
  alter column governorate_id set not null,
  alter column city_id set not null,
  alter column main_area_id set not null,
  alter column google_maps_url set not null,
  alter column latitude set not null,
  alter column longitude set not null,
  alter column map_zoom set not null;

-- Add only absent final checks. A same-name existing check is accepted only if
-- PostgreSQL parses it to the exact final expression on the same locked table.
do $project_parity_checks$
declare
  v_check record;
  v_actual_expression text;
  v_expected_expression text;
  v_probe_name text;
begin
  for v_check in
    select *
      from (values
        ('projects', 'projects_general_description_check', $$check (btrim(general_description) <> '' and char_length(general_description) <= 1000)$$),
        ('projects', 'projects_short_description_check', $$check (btrim(short_description) <> '' and char_length(short_description) <= 500)$$),
        ('projects', 'projects_image_check', $$check (btrim(image) <> '')$$),
        ('projects', 'projects_image_alt_check', $$check (btrim(image_alt) <> '')$$),
        ('projects', 'projects_hero_image_check', $$check (btrim(hero_image) <> '')$$),
        ('projects', 'projects_hero_image_alt_check', $$check (btrim(hero_image_alt) <> '')$$),
        ('projects', 'projects_small_box_image_check', $$check (btrim(small_box_image) <> '')$$),
        ('projects', 'projects_small_box_image_alt_check', $$check (btrim(small_box_image_alt) <> '')$$),
        ('projects', 'projects_location_label_check', $$check (btrim(location_label) <> '')$$),
        ('projects', 'projects_google_maps_url_check', $$check (btrim(google_maps_url) <> '' and google_maps_url ~* '^https?://')$$),
        ('projects', 'projects_overview_title_check', $$check (btrim(overview_title) <> '')$$),
        ('projects', 'projects_overview_body_check', $$check (btrim(regexp_replace(replace(overview_body, '&nbsp;', ' '), '<[^>]*>', '', 'g')) <> '')$$),
        ('projects', 'projects_delivery_title_check', $$check (btrim(delivery_title) <> '')$$),
        ('projects', 'projects_delivery_body_check', $$check (btrim(regexp_replace(replace(delivery_body, '&nbsp;', ' '), '<[^>]*>', '', 'g')) <> '')$$),
        ('projects', 'projects_seo_title_check', $$check (char_length(seo_title) <= 60)$$),
        ('projects', 'projects_seo_description_check', $$check (char_length(seo_description) <= 160)$$),
        ('projects', 'projects_canonical_url_check', $$check (canonical_url is null or canonical_url ~* '^https?://')$$),
        ('projects', 'projects_overview_image_required_check', $$check (overview_media_type <> 'image' or (coalesce(btrim(overview_main_image), '') <> '' and btrim(overview_main_image_alt) <> ''))$$),
        ('projects', 'projects_overview_image_alt_check', $$check (overview_main_image is null or btrim(overview_main_image_alt) <> '')$$),
        ('projects', 'projects_og_image_alt_check', $$check (og_image is null or btrim(og_image_alt) <> '')$$),
        ('project_floor_plans', 'project_floor_plans_architectural_image_alt_check', $$check (architectural_image is null or btrim(architectural_image_alt) <> '')$$),
        ('project_floor_plans', 'project_floor_plans_furnishing_image_alt_check', $$check (furnishing_image is null or btrim(furnishing_image_alt) <> '')$$),
        ('project_media', 'project_media_alt_text_check', $$check (btrim(alt_text) <> '')$$),
        ('project_videos', 'project_videos_poster_alt_check', $$check (poster_image is null or btrim(poster_alt) <> '')$$)
      ) expected(table_name, constraint_name, definition)
  loop
    select pg_catalog.pg_get_expr(
             constraint_record.conbin,
             constraint_record.conrelid,
             true
           )
      into v_actual_expression
      from pg_catalog.pg_constraint constraint_record
     where constraint_record.conrelid = format('public.%I', v_check.table_name)::regclass
       and constraint_record.conname = v_check.constraint_name
       and constraint_record.contype = 'c'
       and constraint_record.convalidated
       and not constraint_record.condeferrable
       and not constraint_record.condeferred
       and not constraint_record.connoinherit
       and constraint_record.conislocal
       and constraint_record.coninhcount = 0
       and constraint_record.conparentid = 0;

    if v_actual_expression is null then
      if exists (
        select 1
          from pg_catalog.pg_constraint constraint_record
         where constraint_record.conrelid = format('public.%I', v_check.table_name)::regclass
           and constraint_record.conname = v_check.constraint_name
      ) then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Existing constraint public.%I.%I has unexpected properties.',
            v_check.table_name,
            v_check.constraint_name
          );
      end if;

      execute format(
        'alter table public.%I add constraint %I %s',
        v_check.table_name,
        v_check.constraint_name,
        v_check.definition
      );
    else
      v_probe_name := '__project_parity_probe_' || pg_catalog.substr(
        pg_catalog.md5(v_check.table_name || '.' || v_check.constraint_name),
        1,
        24
      );

      if exists (
        select 1
          from pg_catalog.pg_constraint constraint_record
         where constraint_record.conrelid = format(
           'public.%I',
           v_check.table_name
         )::regclass
           and constraint_record.conname = v_probe_name
      ) then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Reserved parity probe constraint %I already exists.',
            v_probe_name
          );
      end if;

      begin
        execute format(
          'alter table public.%I add constraint %I %s not valid',
          v_check.table_name,
          v_probe_name,
          v_check.definition
        );
        select pg_catalog.pg_get_expr(
                 constraint_record.conbin,
                 constraint_record.conrelid,
                 true
               )
          into strict v_expected_expression
          from pg_catalog.pg_constraint constraint_record
         where constraint_record.conrelid = format(
           'public.%I',
           v_check.table_name
         )::regclass
           and constraint_record.conname = v_probe_name;
        raise exception using
          errcode = 'PZ001',
          message = 'Rollback the Project parity constraint probe.';
      exception
        when sqlstate 'PZ001' then
          null;
      end;

      if v_actual_expression is distinct from v_expected_expression then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Existing constraint public.%I.%I is outside the final contract.',
            v_check.table_name,
            v_check.constraint_name
          );
      end if;
    end if;
  end loop;
end
$project_parity_checks$;

create or replace function public.validate_project_location_parent()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_parent_level text;
  v_parent_active boolean;
  v_expected_parent_level text;
begin
  if new.level = 'governorate' then
    if new.parent_id is not null then
      raise exception using errcode = '23514', message = 'A governorate cannot have a parent.';
    end if;
    return new;
  end if;

  -- The key-share lock serializes hierarchy creation against concurrent parent
  -- reparent/deactivation updates.
  select location.level, location.is_active
    into v_parent_level, v_parent_active
    from public.project_locations as location
   where location.id = new.parent_id
   for key share;

  if v_parent_level is null then
    raise exception using errcode = '23503', message = 'The selected parent location does not exist.';
  end if;

  if not v_parent_active then
    raise exception using errcode = '23514', message = 'A child location cannot be attached to an inactive parent.';
  end if;

  v_expected_parent_level := case new.level
    when 'city' then 'governorate'
    when 'main_area' then 'city'
    when 'sub_area' then 'main_area'
  end;

  if v_parent_level <> v_expected_parent_level then
    raise exception using
      errcode = '23514',
      message = format('Invalid location hierarchy: %s must belong to %s.', new.level, v_expected_parent_level);
  end if;

  return new;
end
$function$;

create or replace function public.validate_project_location_selection()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $function$
begin
  if new.governorate_id is null
     or new.city_id is null
     or new.main_area_id is null then
    raise exception using
      errcode = '23514',
      message = 'Governorate, city and main area must be selected together.';
  end if;

  -- Lock the selected chain in deterministic ID order. A concurrent location
  -- update must finish before this validation (or wait for this Project write),
  -- closing the check/reparent and check/deactivate races.
  perform 1
    from public.project_locations location
   where location.id = any (
     array[new.governorate_id, new.city_id, new.main_area_id, new.sub_area_id]
   )
   order by location.id
   for key share;

  if not exists (
    select 1
      from public.project_locations governorate
      join public.project_locations city
        on city.id = new.city_id
       and city.level = 'city'
       and city.parent_id = governorate.id
      join public.project_locations main_area
        on main_area.id = new.main_area_id
       and main_area.level = 'main_area'
       and main_area.parent_id = city.id
      left join public.project_locations sub_area
        on sub_area.id = new.sub_area_id
       and sub_area.level = 'sub_area'
       and sub_area.parent_id = main_area.id
       where governorate.id = new.governorate_id
         and governorate.level = 'governorate'
         and governorate.is_active
         and city.is_active
         and main_area.is_active
         and (new.sub_area_id is null or sub_area.is_active)
         and (new.sub_area_id is null or sub_area.id is not null)
  ) then
    raise exception using
      errcode = '23514',
      message = 'The selected location hierarchy is invalid.';
  end if;

  return new;
end
$function$;

create or replace function public.prevent_project_location_reparent()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $function$
begin
  if old.level is distinct from new.level
     and exists (
       select 1
         from public.project_locations child
        where child.parent_id = new.id
     ) then
    raise exception using
      errcode = '23514',
      message = 'A location with children cannot change level.';
  end if;

  if old.is_active
     and not new.is_active
     and exists (
       select 1
         from public.project_locations child
        where child.parent_id = new.id
          and child.is_active
     ) then
    raise exception using
      errcode = '23514',
      message = 'A location with active children cannot be deactivated.';
  end if;

  if old.is_active
     and not new.is_active
     and exists (
       select 1 from public.projects project
       where project.governorate_id = new.id
          or project.city_id = new.id
          or project.main_area_id = new.id
          or project.sub_area_id = new.id
     ) then
    raise exception using
      errcode = '23514',
      message = 'A referenced project location cannot be deactivated.';
  end if;

  if old.level is distinct from new.level
     and exists (
       select 1 from public.projects project
       where project.governorate_id = new.id
          or project.city_id = new.id
          or project.main_area_id = new.id
          or project.sub_area_id = new.id
     ) then
    raise exception using
      errcode = '23514',
      message = 'A referenced project location cannot change level.';
  end if;

  if new.level = 'city'
     and exists (
       select 1 from public.projects project
       where project.city_id = new.id
         and project.governorate_id is distinct from new.parent_id
     ) then
    raise exception using
      errcode = '23514',
      message = 'Reparenting this city would invalidate a project location hierarchy.';
  end if;

  if new.level = 'main_area'
     and exists (
       select 1 from public.projects project
       where project.main_area_id = new.id
         and project.city_id is distinct from new.parent_id
     ) then
    raise exception using
      errcode = '23514',
      message = 'Reparenting this main area would invalidate a project location hierarchy.';
  end if;

  if new.level = 'sub_area'
     and exists (
       select 1 from public.projects project
       where project.sub_area_id = new.id
         and project.main_area_id is distinct from new.parent_id
     ) then
    raise exception using
      errcode = '23514',
      message = 'Reparenting this sub area would invalidate a project location hierarchy.';
  end if;

  return new;
end
$function$;

create or replace trigger project_locations_validate_parent
before insert or update of level, parent_id, is_active
on public.project_locations
for each row execute function public.validate_project_location_parent();

create or replace trigger project_locations_prevent_reparent
before update of level, parent_id, is_active on public.project_locations
for each row execute function public.prevent_project_location_reparent();

create or replace function public.save_project_admin_entry(
  p_project_id bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns table (project_id bigint, slug text, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_project_id bigint;
  v_existing_type text;
  v_now timestamptz := clock_timestamp();
  v_root jsonb := coalesce(p_payload -> 'project', '{}'::jsonb);
  v_deleted jsonb := coalesce(p_payload -> 'deleted', '{}'::jsonb);
  v_item jsonb;
  v_plan jsonb;
  v_plan_id bigint;
  v_index integer;
  v_client_key uuid;
  v_governorate_id bigint;
  v_city_id bigint;
  v_main_area_id bigint;
  v_sub_area_id bigint;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Project payload must be a JSON object.';
  end if;
  if jsonb_typeof(v_root) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Project root must be a JSON object.';
  end if;
  if jsonb_typeof(v_deleted) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Project deleted tombstones must be a JSON object.';
  end if;
  if coalesce(btrim(v_root ->> 'arabic_name'), '') = '' then
    raise exception using errcode = '22023', message = 'Arabic project name is required.';
  end if;
  if coalesce(btrim(v_root ->> 'english_name'), '') = '' then
    raise exception using errcode = '22023', message = 'English project name is required.';
  end if;
  if coalesce(v_root ->> 'type', '') not in ('residential', 'commercial') then
    raise exception using errcode = '22023', message = 'Project type is invalid.';
  end if;
  if coalesce(v_root ->> 'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Project slug is invalid.';
  end if;
  if coalesce(btrim(v_root ->> 'general_description'), '') = ''
     or char_length(v_root ->> 'general_description') > 1000 then
    raise exception using errcode = '22023', message = 'General description is required and must not exceed 1000 characters.';
  end if;
  if coalesce(btrim(v_root ->> 'short_description'), '') = ''
     or char_length(v_root ->> 'short_description') > 500 then
    raise exception using errcode = '22023', message = 'Short description is required and must not exceed 500 characters.';
  end if;
  if coalesce(btrim(v_root ->> 'image'), '') = ''
     or coalesce(btrim(v_root ->> 'image_alt'), '') = '' then
    raise exception using errcode = '22023', message = 'Card image and alt text are required.';
  end if;
  if coalesce(btrim(v_root ->> 'hero_image'), '') = ''
     or coalesce(btrim(v_root ->> 'hero_image_alt'), '') = '' then
    raise exception using errcode = '22023', message = 'Hero image and alt text are required.';
  end if;
  if coalesce(btrim(v_root ->> 'small_box_image'), '') = ''
     or coalesce(btrim(v_root ->> 'small_box_image_alt'), '') = '' then
    raise exception using errcode = '22023', message = 'Small-box image and alt text are required.';
  end if;
  if coalesce(btrim(v_root ->> 'location_label'), '') = '' then
    raise exception using errcode = '22023', message = 'Project location label is required.';
  end if;
  if coalesce(btrim(v_root ->> 'google_maps_url'), '') = ''
     or (v_root ->> 'google_maps_url') !~* '^https?://' then
    raise exception using errcode = '22023', message = 'Google Maps URL is required and must use HTTP or HTTPS.';
  end if;
  if nullif(v_root ->> 'latitude', '') is null
     or (v_root ->> 'latitude')::numeric not between -90 and 90 then
    raise exception using errcode = '22023', message = 'Latitude is required and must be between -90 and 90.';
  end if;
  if nullif(v_root ->> 'longitude', '') is null
     or (v_root ->> 'longitude')::numeric not between -180 and 180 then
    raise exception using errcode = '22023', message = 'Longitude is required and must be between -180 and 180.';
  end if;
  if nullif(v_root ->> 'map_zoom', '') is null
     or (v_root ->> 'map_zoom')::numeric <> trunc((v_root ->> 'map_zoom')::numeric)
     or (v_root ->> 'map_zoom')::numeric not between 1 and 22 then
    raise exception using errcode = '22023', message = 'Map zoom is required and must be an integer between 1 and 22.';
  end if;
  if coalesce(btrim(v_root ->> 'overview_title'), '') = '' then
    raise exception using errcode = '22023', message = 'Overview title is required.';
  end if;
  if coalesce(
       btrim(regexp_replace(
         replace(coalesce(v_root ->> 'overview_body', ''), '&nbsp;', ' '),
         '<[^>]*>', '', 'g'
       )),
       ''
     ) = '' then
    raise exception using errcode = '22023', message = 'Overview body is required.';
  end if;
  if coalesce(v_root ->> 'overview_media_type', '') not in ('image', 'video') then
    raise exception using errcode = '22023', message = 'Overview media type is invalid.';
  end if;
  if v_root ->> 'overview_media_type' = 'image'
     and (
       coalesce(btrim(v_root ->> 'overview_main_image'), '') = ''
       or coalesce(btrim(v_root ->> 'overview_main_image_alt'), '') = ''
     ) then
    raise exception using errcode = '22023', message = 'Overview image and alt text are required in image mode.';
  end if;
  if nullif(v_root ->> 'overview_main_image', '') is not null
     and coalesce(btrim(v_root ->> 'overview_main_image_alt'), '') = '' then
    raise exception using errcode = '22023', message = 'Overview image alt text is required when an image is selected.';
  end if;
  if coalesce(btrim(v_root ->> 'delivery_title'), '') = '' then
    raise exception using errcode = '22023', message = 'Delivery title is required.';
  end if;
  if coalesce(
       btrim(regexp_replace(
         replace(coalesce(v_root ->> 'delivery_body', ''), '&nbsp;', ' '),
         '<[^>]*>', '', 'g'
       )),
       ''
     ) = '' then
    raise exception using errcode = '22023', message = 'Delivery body is required.';
  end if;
  if char_length(coalesce(v_root ->> 'seo_title', '')) > 60 then
    raise exception using errcode = '22023', message = 'SEO title must not exceed 60 characters.';
  end if;
  if char_length(coalesce(v_root ->> 'seo_description', '')) > 160 then
    raise exception using errcode = '22023', message = 'SEO description must not exceed 160 characters.';
  end if;
  if nullif(v_root ->> 'canonical_url', '') is not null
     and (v_root ->> 'canonical_url') !~* '^https?://' then
    raise exception using errcode = '22023', message = 'Canonical URL must use HTTP or HTTPS.';
  end if;
  if nullif(v_root ->> 'og_image', '') is not null
     and coalesce(btrim(v_root ->> 'og_image_alt'), '') = '' then
    raise exception using errcode = '22023', message = 'Open Graph image alt text is required when an image is selected.';
  end if;

  v_governorate_id := nullif(v_root ->> 'governorate_id', '')::bigint;
  v_city_id := nullif(v_root ->> 'city_id', '')::bigint;
  v_main_area_id := nullif(v_root ->> 'main_area_id', '')::bigint;
  v_sub_area_id := nullif(v_root ->> 'sub_area_id', '')::bigint;

  if v_governorate_id is null or v_city_id is null or v_main_area_id is null then
    raise exception using errcode = '23514', message = 'Governorate, city and main area must be selected together.';
  end if;

  perform 1
    from public.project_locations location
   where location.id = any (
     array[v_governorate_id, v_city_id, v_main_area_id, v_sub_area_id]
   )
   order by location.id
   for key share;

  if not exists (
    select 1
      from public.project_locations governorate
      join public.project_locations city
        on city.id = v_city_id
       and city.level = 'city'
       and city.parent_id = governorate.id
      join public.project_locations main_area
        on main_area.id = v_main_area_id
       and main_area.level = 'main_area'
       and main_area.parent_id = city.id
      left join public.project_locations sub_area
        on sub_area.id = v_sub_area_id
       and sub_area.level = 'sub_area'
       and sub_area.parent_id = main_area.id
     where governorate.id = v_governorate_id
       and governorate.level = 'governorate'
       and governorate.is_active
       and city.is_active
       and main_area.is_active
       and (v_sub_area_id is null or sub_area.is_active)
       and (v_sub_area_id is null or sub_area.id is not null)
  ) then
    raise exception using errcode = '23514', message = 'The selected location hierarchy is invalid or inactive.';
  end if;

  if p_project_id is null then
    insert into public.projects (
      type, arabic_name, english_name, slug,
      general_description, short_description,
      image, image_alt, hero_image, hero_image_alt,
      small_box_image, small_box_image_alt,
      governorate_id, city_id, main_area_id, sub_area_id,
      location_label, location_description, google_maps_url,
      latitude, longitude, map_zoom,
      overview_title, overview_body, overview_media_type, overview_main_image, overview_main_image_alt,
      delivery_title, delivery_body,
      seo_title, seo_description, focus_keyword, seo_keywords,
      canonical_url, robots_index, robots_follow, og_image, og_image_alt,
      created_at, updated_at
    ) values (
      v_root ->> 'type', btrim(v_root ->> 'arabic_name'), btrim(v_root ->> 'english_name'), btrim(v_root ->> 'slug'),
      coalesce(v_root ->> 'general_description', ''), coalesce(v_root ->> 'short_description', ''),
      nullif(v_root ->> 'image', ''), coalesce(v_root ->> 'image_alt', ''),
      nullif(v_root ->> 'hero_image', ''), coalesce(v_root ->> 'hero_image_alt', ''),
      nullif(v_root ->> 'small_box_image', ''), coalesce(v_root ->> 'small_box_image_alt', ''),
      v_governorate_id, v_city_id, v_main_area_id, v_sub_area_id,
      coalesce(v_root ->> 'location_label', ''), coalesce(v_root ->> 'location_description', ''),
      nullif(v_root ->> 'google_maps_url', ''),
      nullif(v_root ->> 'latitude', '')::numeric,
      nullif(v_root ->> 'longitude', '')::numeric,
      nullif(v_root ->> 'map_zoom', '')::smallint,
      coalesce(v_root ->> 'overview_title', ''), coalesce(v_root ->> 'overview_body', ''),
      v_root ->> 'overview_media_type',
      nullif(v_root ->> 'overview_main_image', ''), coalesce(v_root ->> 'overview_main_image_alt', ''),
      coalesce(v_root ->> 'delivery_title', ''), coalesce(v_root ->> 'delivery_body', ''),
      coalesce(v_root ->> 'seo_title', ''), coalesce(v_root ->> 'seo_description', ''),
      coalesce(v_root ->> 'focus_keyword', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_root -> 'seo_keywords', '[]'::jsonb))), '{}'::text[]),
      nullif(v_root ->> 'canonical_url', ''),
      case when v_root ? 'robots_index' then (v_root ->> 'robots_index')::boolean else null end,
      case when v_root ? 'robots_follow' then (v_root ->> 'robots_follow')::boolean else null end,
      nullif(v_root ->> 'og_image', ''), coalesce(v_root ->> 'og_image_alt', ''),
      v_now, v_now
    )
    returning id into v_project_id;
  else
    select project.type into v_existing_type
      from public.projects project
     where project.id = p_project_id
     for update;
    if v_existing_type is null then
      raise exception using errcode = 'P0002', message = 'Project not found.';
    end if;
    if v_root ->> 'type' <> v_existing_type then
      raise exception using errcode = '23514', message = 'Project type is immutable after creation.';
    end if;

    update public.projects project set
      arabic_name = btrim(v_root ->> 'arabic_name'),
      english_name = btrim(v_root ->> 'english_name'),
      slug = btrim(v_root ->> 'slug'),
      general_description = case when v_root ? 'general_description' then coalesce(v_root ->> 'general_description', '') else project.general_description end,
      short_description = case when v_root ? 'short_description' then coalesce(v_root ->> 'short_description', '') else project.short_description end,
      image = case when v_root ? 'image' then nullif(v_root ->> 'image', '') else project.image end,
      image_alt = case when v_root ? 'image_alt' then coalesce(v_root ->> 'image_alt', '') else project.image_alt end,
      hero_image = case when v_root ? 'hero_image' then nullif(v_root ->> 'hero_image', '') else project.hero_image end,
      hero_image_alt = case when v_root ? 'hero_image_alt' then coalesce(v_root ->> 'hero_image_alt', '') else project.hero_image_alt end,
      small_box_image = case when v_root ? 'small_box_image' then nullif(v_root ->> 'small_box_image', '') else project.small_box_image end,
      small_box_image_alt = case when v_root ? 'small_box_image_alt' then coalesce(v_root ->> 'small_box_image_alt', '') else project.small_box_image_alt end,
      governorate_id = case when v_root ? 'governorate_id' then v_governorate_id else project.governorate_id end,
      city_id = case when v_root ? 'city_id' then v_city_id else project.city_id end,
      main_area_id = case when v_root ? 'main_area_id' then v_main_area_id else project.main_area_id end,
      sub_area_id = case when v_root ? 'sub_area_id' then v_sub_area_id else project.sub_area_id end,
      location_label = case when v_root ? 'location_label' then coalesce(v_root ->> 'location_label', '') else project.location_label end,
      location_description = case when v_root ? 'location_description' then coalesce(v_root ->> 'location_description', '') else project.location_description end,
      google_maps_url = case when v_root ? 'google_maps_url' then nullif(v_root ->> 'google_maps_url', '') else project.google_maps_url end,
      latitude = case when v_root ? 'latitude' then nullif(v_root ->> 'latitude', '')::numeric else project.latitude end,
      longitude = case when v_root ? 'longitude' then nullif(v_root ->> 'longitude', '')::numeric else project.longitude end,
      map_zoom = case when v_root ? 'map_zoom' then nullif(v_root ->> 'map_zoom', '')::smallint else project.map_zoom end,
      overview_title = case when v_root ? 'overview_title' then coalesce(v_root ->> 'overview_title', '') else project.overview_title end,
      overview_body = case when v_root ? 'overview_body' then coalesce(v_root ->> 'overview_body', '') else project.overview_body end,
      overview_media_type = v_root ->> 'overview_media_type',
      overview_main_image = case when v_root ? 'overview_main_image' then nullif(v_root ->> 'overview_main_image', '') else project.overview_main_image end,
      overview_main_image_alt = case when v_root ? 'overview_main_image_alt' then coalesce(v_root ->> 'overview_main_image_alt', '') else project.overview_main_image_alt end,
      delivery_title = case when v_root ? 'delivery_title' then coalesce(v_root ->> 'delivery_title', '') else project.delivery_title end,
      delivery_body = case when v_root ? 'delivery_body' then coalesce(v_root ->> 'delivery_body', '') else project.delivery_body end,
      seo_title = case when v_root ? 'seo_title' then coalesce(v_root ->> 'seo_title', '') else project.seo_title end,
      seo_description = case when v_root ? 'seo_description' then coalesce(v_root ->> 'seo_description', '') else project.seo_description end,
      focus_keyword = case when v_root ? 'focus_keyword' then coalesce(v_root ->> 'focus_keyword', '') else project.focus_keyword end,
      seo_keywords = case when v_root ? 'seo_keywords' then coalesce(array(select jsonb_array_elements_text(coalesce(v_root -> 'seo_keywords', '[]'::jsonb))), '{}'::text[]) else project.seo_keywords end,
      canonical_url = case when v_root ? 'canonical_url' then nullif(v_root ->> 'canonical_url', '') else project.canonical_url end,
      robots_index = case when v_root ? 'robots_index' then nullif(v_root ->> 'robots_index', '')::boolean else project.robots_index end,
      robots_follow = case when v_root ? 'robots_follow' then nullif(v_root ->> 'robots_follow', '')::boolean else project.robots_follow end,
      og_image = case when v_root ? 'og_image' then nullif(v_root ->> 'og_image', '') else project.og_image end,
      og_image_alt = case when v_root ? 'og_image_alt' then coalesce(v_root ->> 'og_image_alt', '') else project.og_image_alt end,
      updated_at = v_now
    where project.id = p_project_id;
    v_project_id := p_project_id;
  end if;

  -- Deletions are explicit tombstones. Omitting an existing child from an
  -- upsert array never deletes it. Ownership is checked before every delete so
  -- a forged ID cannot cross Project boundaries. Tombstones run before upserts
  -- so replacing the single overview video does not hit its partial unique
  -- index before the old row is removed.
  if v_deleted ? 'location_point_ids' then
    if jsonb_typeof(v_deleted -> 'location_point_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.location_point_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'location_point_ids') requested(id)
      where not exists (
        select 1 from public.project_location_points existing
        where existing.id = requested.id::bigint
          and existing.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted location point does not belong to this project.';
    end if;
    delete from public.project_location_points existing
     where existing.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'location_point_ids') requested(id)
       );
  end if;

  if v_deleted ? 'feature_ids' then
    if jsonb_typeof(v_deleted -> 'feature_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.feature_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'feature_ids') requested(id)
      where not exists (
        select 1 from public.project_features existing
        where existing.id = requested.id::bigint
          and existing.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted feature does not belong to this project.';
    end if;
    delete from public.project_features existing
     where existing.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'feature_ids') requested(id)
       );
  end if;

  if v_deleted ? 'floor_plan_detail_ids' then
    if jsonb_typeof(v_deleted -> 'floor_plan_detail_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.floor_plan_detail_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'floor_plan_detail_ids') requested(id)
      where not exists (
        select 1
        from public.project_floor_plan_details existing
        join public.project_floor_plans plan on plan.id = existing.floor_plan_id
        where existing.id = requested.id::bigint
          and plan.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted floor plan detail does not belong to this project.';
    end if;
    delete from public.project_floor_plan_details existing
     using public.project_floor_plans plan
     where plan.id = existing.floor_plan_id
       and plan.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'floor_plan_detail_ids') requested(id)
       );
  end if;

  if v_deleted ? 'floor_plan_ids' then
    if jsonb_typeof(v_deleted -> 'floor_plan_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.floor_plan_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'floor_plan_ids') requested(id)
      where not exists (
        select 1 from public.project_floor_plans existing
        where existing.id = requested.id::bigint
          and existing.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted floor plan does not belong to this project.';
    end if;
    delete from public.project_floor_plans existing
     where existing.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'floor_plan_ids') requested(id)
       );
  end if;

  if v_deleted ? 'delivery_item_ids' then
    if jsonb_typeof(v_deleted -> 'delivery_item_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.delivery_item_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'delivery_item_ids') requested(id)
      where not exists (
        select 1 from public.project_delivery_items existing
        where existing.id = requested.id::bigint
          and existing.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted delivery item does not belong to this project.';
    end if;
    delete from public.project_delivery_items existing
     where existing.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'delivery_item_ids') requested(id)
       );
  end if;

  if v_deleted ? 'media_ids' then
    if jsonb_typeof(v_deleted -> 'media_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.media_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'media_ids') requested(id)
      where not exists (
        select 1 from public.project_media existing
        where existing.id = requested.id::bigint
          and existing.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted media item does not belong to this project.';
    end if;
    delete from public.project_media existing
     where existing.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'media_ids') requested(id)
       );
  end if;

  if v_deleted ? 'video_ids' then
    if jsonb_typeof(v_deleted -> 'video_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'deleted.video_ids must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_deleted -> 'video_ids') requested(id)
      where not exists (
        select 1 from public.project_videos existing
        where existing.id = requested.id::bigint
          and existing.project_id = v_project_id
      )
    ) then
      raise exception using errcode = '23503', message = 'A deleted video does not belong to this project.';
    end if;
    delete from public.project_videos existing
     where existing.project_id = v_project_id
       and existing.id in (
         select requested.id::bigint
         from jsonb_array_elements_text(v_deleted -> 'video_ids') requested(id)
       );
  end if;

  -- Location points: stable DB IDs are retained through the client_key upsert.
  if p_payload ? 'location_points' then
    if jsonb_typeof(p_payload -> 'location_points') <> 'array' then
      raise exception using errcode = '22023', message = 'location_points must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload -> 'location_points') item
      where (
        nullif(item ->> 'id', '') is not null
        and not exists (
          select 1 from public.project_location_points existing
          where existing.id = (item ->> 'id')::bigint
            and existing.project_id = v_project_id
            and existing.client_key = (item ->> 'client_key')::uuid
        )
      ) or (
        nullif(item ->> 'id', '') is null
        and exists (
          select 1 from public.project_location_points existing
          where existing.client_key = (item ->> 'client_key')::uuid
        )
      )
    ) then
      raise exception using errcode = '23503', message = 'A location point does not belong to this project.';
    end if;
    if exists (
      select 1 from public.project_location_points existing
      where existing.project_id = v_project_id
        and not exists (
          select 1 from jsonb_array_elements(p_payload -> 'location_points') item
          where nullif(item ->> 'id', '')::bigint = existing.id
            and (item ->> 'client_key')::uuid = existing.client_key
        )
    ) then
      raise exception using errcode = '22023', message = 'An existing location point was omitted without an explicit deletion tombstone.';
    end if;

    insert into public.project_location_points (
      client_key, project_id, kind, label, distance_text, sort_order, updated_at
    )
    select
      (item.value ->> 'client_key')::uuid,
      v_project_id,
      item.value ->> 'kind',
      btrim(item.value ->> 'label'),
      coalesce(item.value ->> 'distance_text', ''),
      row_number() over (
        partition by item.value ->> 'kind'
        order by item.ordinality
      ) - 1,
      v_now
    from jsonb_array_elements(p_payload -> 'location_points') with ordinality item(value, ordinality)
    on conflict (project_id, client_key) do update set
      kind = excluded.kind,
      label = excluded.label,
      distance_text = excluded.distance_text,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;

  end if;

  if p_payload ? 'features' then
    if jsonb_typeof(p_payload -> 'features') <> 'array' then
      raise exception using errcode = '22023', message = 'features must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload -> 'features') item
      where (
        nullif(item ->> 'id', '') is not null
        and not exists (
          select 1 from public.project_features existing
          where existing.id = (item ->> 'id')::bigint
            and existing.project_id = v_project_id
            and existing.client_key = (item ->> 'client_key')::uuid
        )
      ) or (
        nullif(item ->> 'id', '') is null
        and exists (
          select 1 from public.project_features existing
          where existing.client_key = (item ->> 'client_key')::uuid
        )
      )
    ) then
      raise exception using errcode = '23503', message = 'A feature identity is invalid for this project.';
    end if;
    if exists (
      select 1 from public.project_features existing
      where existing.project_id = v_project_id
        and not exists (
          select 1 from jsonb_array_elements(p_payload -> 'features') item
          where nullif(item ->> 'id', '')::bigint = existing.id
            and (item ->> 'client_key')::uuid = existing.client_key
        )
    ) then
      raise exception using errcode = '22023', message = 'An existing feature was omitted without an explicit deletion tombstone.';
    end if;
    insert into public.project_features (client_key, project_id, body, sort_order, updated_at)
    select
      (item.value ->> 'client_key')::uuid,
      v_project_id,
      btrim(item.value ->> 'body'),
      item.ordinality - 1,
      v_now
    from jsonb_array_elements(p_payload -> 'features') with ordinality item(value, ordinality)
    on conflict (project_id, client_key) do update set
      body = excluded.body,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;
  end if;

  if p_payload ? 'floor_plans' then
    if jsonb_typeof(p_payload -> 'floor_plans') <> 'array' then
      raise exception using errcode = '22023', message = 'floor_plans must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload -> 'floor_plans') item
      where (
        nullif(item ->> 'id', '') is not null
        and not exists (
          select 1 from public.project_floor_plans existing
          where existing.id = (item ->> 'id')::bigint
            and existing.project_id = v_project_id
            and existing.client_key = (item ->> 'client_key')::uuid
        )
      ) or (
        nullif(item ->> 'id', '') is null
        and exists (
          select 1 from public.project_floor_plans existing
          where existing.client_key = (item ->> 'client_key')::uuid
        )
      )
    ) then
      raise exception using errcode = '23503', message = 'A floor plan identity is invalid for this project.';
    end if;
    if exists (
      select 1 from public.project_floor_plans existing
      where existing.project_id = v_project_id
        and not exists (
          select 1 from jsonb_array_elements(p_payload -> 'floor_plans') item
          where nullif(item ->> 'id', '')::bigint = existing.id
            and (item ->> 'client_key')::uuid = existing.client_key
        )
    ) then
      raise exception using errcode = '22023', message = 'An existing floor plan was omitted without an explicit deletion tombstone.';
    end if;
    v_index := 0;
    for v_plan in select value from jsonb_array_elements(p_payload -> 'floor_plans') loop
      v_client_key := (v_plan ->> 'client_key')::uuid;

      insert into public.project_floor_plans (
        client_key, project_id, name, area_text, featured,
        architectural_image, architectural_image_alt,
        furnishing_image, furnishing_image_alt,
        sort_order, updated_at
      ) values (
        v_client_key, v_project_id, btrim(v_plan ->> 'name'),
        coalesce(v_plan ->> 'area_text', ''), coalesce((v_plan ->> 'featured')::boolean, false),
        nullif(v_plan ->> 'architectural_image', ''), coalesce(v_plan ->> 'architectural_image_alt', ''),
        nullif(v_plan ->> 'furnishing_image', ''), coalesce(v_plan ->> 'furnishing_image_alt', ''),
        v_index, v_now
      )
      on conflict (project_id, client_key) do update set
        name = excluded.name,
        area_text = excluded.area_text,
        featured = excluded.featured,
        architectural_image = excluded.architectural_image,
        architectural_image_alt = excluded.architectural_image_alt,
        furnishing_image = excluded.furnishing_image,
        furnishing_image_alt = excluded.furnishing_image_alt,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
      returning id into v_plan_id;

      if v_plan ? 'details' then
        if jsonb_typeof(v_plan -> 'details') <> 'array' then
          raise exception using errcode = '22023', message = 'floor plan details must be an array.';
        end if;
        if exists (
          select 1
          from jsonb_array_elements(v_plan -> 'details') detail
          where (
            nullif(detail ->> 'id', '') is not null
            and not exists (
              select 1 from public.project_floor_plan_details existing
              where existing.id = (detail ->> 'id')::bigint
                and existing.floor_plan_id = v_plan_id
                and existing.client_key = (detail ->> 'client_key')::uuid
            )
          ) or (
            nullif(detail ->> 'id', '') is null
            and exists (
              select 1 from public.project_floor_plan_details existing
              where existing.client_key = (detail ->> 'client_key')::uuid
            )
          )
        ) then
          raise exception using errcode = '23503', message = 'A floor plan detail identity is invalid for this plan.';
        end if;
        if exists (
          select 1 from public.project_floor_plan_details existing
          where existing.floor_plan_id = v_plan_id
            and not exists (
              select 1 from jsonb_array_elements(v_plan -> 'details') detail
              where nullif(detail ->> 'id', '')::bigint = existing.id
                and (detail ->> 'client_key')::uuid = existing.client_key
            )
        ) then
          raise exception using errcode = '22023', message = 'An existing floor plan detail was omitted without an explicit deletion tombstone.';
        end if;
        insert into public.project_floor_plan_details (
          client_key, floor_plan_id, label, value, sort_order, updated_at
        )
        select
          (detail.value ->> 'client_key')::uuid,
          v_plan_id,
          btrim(detail.value ->> 'label'),
          btrim(detail.value ->> 'value'),
          detail.ordinality - 1,
          v_now
        from jsonb_array_elements(v_plan -> 'details') with ordinality detail(value, ordinality)
        on conflict (floor_plan_id, client_key) do update set
          label = excluded.label,
          value = excluded.value,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at;
      end if;
      v_index := v_index + 1;
    end loop;
  end if;

  if p_payload ? 'delivery_items' then
    if jsonb_typeof(p_payload -> 'delivery_items') <> 'array' then
      raise exception using errcode = '22023', message = 'delivery_items must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload -> 'delivery_items') item
      where (
        nullif(item ->> 'id', '') is not null
        and not exists (
          select 1 from public.project_delivery_items existing
          where existing.id = (item ->> 'id')::bigint
            and existing.project_id = v_project_id
            and existing.client_key = (item ->> 'client_key')::uuid
        )
      ) or (
        nullif(item ->> 'id', '') is null
        and exists (
          select 1 from public.project_delivery_items existing
          where existing.client_key = (item ->> 'client_key')::uuid
        )
      )
    ) then
      raise exception using errcode = '23503', message = 'A delivery item identity is invalid for this project.';
    end if;
    if exists (
      select 1 from public.project_delivery_items existing
      where existing.project_id = v_project_id
        and not exists (
          select 1 from jsonb_array_elements(p_payload -> 'delivery_items') item
          where nullif(item ->> 'id', '')::bigint = existing.id
            and (item ->> 'client_key')::uuid = existing.client_key
        )
    ) then
      raise exception using errcode = '22023', message = 'An existing delivery item was omitted without an explicit deletion tombstone.';
    end if;
    insert into public.project_delivery_items (client_key, project_id, body, sort_order, updated_at)
    select
      (item.value ->> 'client_key')::uuid,
      v_project_id,
      btrim(item.value ->> 'body'),
      item.ordinality - 1,
      v_now
    from jsonb_array_elements(p_payload -> 'delivery_items') with ordinality item(value, ordinality)
    on conflict (project_id, client_key) do update set
      body = excluded.body,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;
  end if;

  if p_payload ? 'media' then
    if jsonb_typeof(p_payload -> 'media') <> 'array' then
      raise exception using errcode = '22023', message = 'media must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload -> 'media') item
      where (
        nullif(item ->> 'id', '') is not null
        and not exists (
          select 1 from public.project_media existing
          where existing.id = (item ->> 'id')::bigint
            and existing.project_id = v_project_id
            and existing.client_key = (item ->> 'client_key')::uuid
        )
      ) or (
        nullif(item ->> 'id', '') is null
        and exists (
          select 1 from public.project_media existing
          where existing.client_key = (item ->> 'client_key')::uuid
        )
      )
    ) then
      raise exception using errcode = '23503', message = 'A media identity is invalid for this project.';
    end if;
    if exists (
      select 1 from public.project_media existing
      where existing.project_id = v_project_id
        and not exists (
          select 1 from jsonb_array_elements(p_payload -> 'media') item
          where nullif(item ->> 'id', '')::bigint = existing.id
            and (item ->> 'client_key')::uuid = existing.client_key
        )
    ) then
      raise exception using errcode = '22023', message = 'An existing media item was omitted without an explicit deletion tombstone.';
    end if;
    insert into public.project_media (
      client_key, project_id, section, image, alt_text, sort_order, updated_at
    )
    select
      (item.value ->> 'client_key')::uuid,
      v_project_id,
      item.value ->> 'section',
      btrim(item.value ->> 'image'),
      coalesce(item.value ->> 'alt_text', ''),
      row_number() over (
        partition by item.value ->> 'section'
        order by item.ordinality
      ) - 1,
      v_now
    from jsonb_array_elements(p_payload -> 'media') with ordinality item(value, ordinality)
    on conflict (project_id, client_key) do update set
      section = excluded.section,
      image = excluded.image,
      alt_text = excluded.alt_text,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;
  end if;

  if p_payload ? 'videos' then
    if jsonb_typeof(p_payload -> 'videos') <> 'array' then
      raise exception using errcode = '22023', message = 'videos must be an array.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload -> 'videos') item
      where (
        nullif(item ->> 'id', '') is not null
        and not exists (
          select 1 from public.project_videos existing
          where existing.id = (item ->> 'id')::bigint
            and existing.project_id = v_project_id
            and existing.client_key = (item ->> 'client_key')::uuid
        )
      ) or (
        nullif(item ->> 'id', '') is null
        and exists (
          select 1 from public.project_videos existing
          where existing.client_key = (item ->> 'client_key')::uuid
        )
      )
    ) then
      raise exception using errcode = '23503', message = 'A video identity is invalid for this project.';
    end if;
    if exists (
      select 1 from public.project_videos existing
      where existing.project_id = v_project_id
        and not exists (
          select 1 from jsonb_array_elements(p_payload -> 'videos') item
          where nullif(item ->> 'id', '')::bigint = existing.id
            and (item ->> 'client_key')::uuid = existing.client_key
        )
    ) then
      raise exception using errcode = '22023', message = 'An existing video was omitted without an explicit deletion tombstone.';
    end if;
    insert into public.project_videos (
      client_key, project_id, section, video_url, poster_image, poster_alt, sort_order, updated_at
    )
    select
      (item.value ->> 'client_key')::uuid,
      v_project_id,
      item.value ->> 'section',
      btrim(item.value ->> 'video_url'),
      nullif(item.value ->> 'poster_image', ''),
      coalesce(item.value ->> 'poster_alt', ''),
      row_number() over (
        partition by item.value ->> 'section'
        order by item.ordinality
      ) - 1,
      v_now
    from jsonb_array_elements(p_payload -> 'videos') with ordinality item(value, ordinality)
    on conflict (project_id, client_key) do update set
      section = excluded.section,
      video_url = excluded.video_url,
      poster_image = excluded.poster_image,
      poster_alt = excluded.poster_alt,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;
  end if;

  if (select project.overview_media_type from public.projects project where project.id = v_project_id) = 'video'
     and (
       select count(*)
         from public.project_videos video
        where video.project_id = v_project_id
          and video.section = 'overview'
     ) <> 1 then
    raise exception using
      errcode = '23514',
      message = 'Video overview mode requires exactly one overview video.';
  end if;

  -- Surface reorder collisions inside this RPC, rather than leaving initially
  -- deferred ordering constraints to fail later at an outer transaction commit.
  set constraints
    public.project_location_points_sort_unique,
    public.project_features_sort_unique,
    public.project_floor_plans_sort_unique,
    public.project_floor_plan_details_sort_unique,
    public.project_delivery_items_sort_unique,
    public.project_media_sort_unique,
    public.project_videos_sort_unique
  immediate;

  return query
  select project.id, project.slug, project.updated_at
    from public.projects project
   where project.id = v_project_id;
end
$function$;

-- Insert only absent canonical reference rows. Existing client keys were
-- checked before any schema mutation and are never updated here.
do $project_reference_seed$
declare
  v_governorate_id bigint;
  v_city_id bigint;
  v_main_area_id bigint;
begin
  insert into public.project_locations (
    client_key,
    level,
    name_ar,
    name_en,
    sort_order,
    is_active
  )
  select
    'ca100000-0000-4000-8000-000000000001'::uuid,
    'governorate',
    'القاهرة',
    'Cairo',
    0,
    true
  where not exists (
    select 1
      from public.project_locations location
     where location.client_key = 'ca100000-0000-4000-8000-000000000001'::uuid
  );

  select location.id
    into strict v_governorate_id
    from public.project_locations location
   where location.client_key = 'ca100000-0000-4000-8000-000000000001'::uuid;

  insert into public.project_locations (
    client_key,
    level,
    parent_id,
    name_ar,
    name_en,
    sort_order,
    is_active
  )
  select
    'ca100000-0000-4000-8000-000000000002'::uuid,
    'city',
    v_governorate_id,
    'القاهرة الجديدة',
    'New Cairo',
    0,
    true
  where not exists (
    select 1
      from public.project_locations location
     where location.client_key = 'ca100000-0000-4000-8000-000000000002'::uuid
  );

  select location.id
    into strict v_city_id
    from public.project_locations location
   where location.client_key = 'ca100000-0000-4000-8000-000000000002'::uuid;

  insert into public.project_locations (
    client_key,
    level,
    parent_id,
    name_ar,
    name_en,
    sort_order,
    is_active
  )
  select
    'ca100000-0000-4000-8000-000000000003'::uuid,
    'main_area',
    v_city_id,
    'التجمع الخامس',
    'Fifth Settlement',
    0,
    true
  where not exists (
    select 1
      from public.project_locations location
     where location.client_key = 'ca100000-0000-4000-8000-000000000003'::uuid
  );

  select location.id
    into strict v_main_area_id
    from public.project_locations location
   where location.client_key = 'ca100000-0000-4000-8000-000000000003'::uuid;

  insert into public.project_locations (
    client_key,
    level,
    parent_id,
    name_ar,
    name_en,
    sort_order,
    is_active
  )
  select
    'ca100000-0000-4000-8000-000000000004'::uuid,
    'sub_area',
    v_main_area_id,
    'الحي الثاني',
    'Second District',
    0,
    true
  where not exists (
    select 1
      from public.project_locations location
     where location.client_key = 'ca100000-0000-4000-8000-000000000004'::uuid
  );
end
$project_reference_seed$;

do $project_parity_assert$
declare
  v_column record;
  v_function record;
  v_source_hash text;
  v_trigger record;
  v_actual_columns text[];
begin
  if (
    select count(*)
      from pg_catalog.pg_proc procedure_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = procedure_record.pronamespace
     where namespace.nspname = 'public'
       and procedure_record.proname = any (array[
         'save_project_admin_entry',
         'delete_project_admin_entry',
         'validate_project_location_parent',
         'prevent_project_type_change',
         'validate_project_location_selection',
         'prevent_project_location_reparent'
       ])
  ) <> 6
     or pg_catalog.to_regprocedure(
       'public.sync_project_children(bigint,jsonb,jsonb,jsonb,jsonb,jsonb)'
     ) is not null
     or pg_catalog.to_regprocedure(
       'public.admin_list_projects(integer,integer,text,text,text,text,text,text,text,text)'
     ) is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Final Project function inventory contains an unexpected signature.';
  end if;

  if (
    select count(*)
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      join pg_catalog.pg_am access_method
        on access_method.oid = relation.relam
     where namespace.nspname = 'public'
       and relation.relname = any (array[
         'project_locations',
         'projects',
         'project_location_points',
         'project_features',
         'project_floor_plans',
         'project_floor_plan_details',
         'project_delivery_items',
         'project_media',
         'project_videos'
       ])
       and relation.relkind = 'r'
       and relation.relpersistence = 'p'
       and relation.relowner = 'postgres'::regrole
       and access_method.amname = 'heap'
       and relation.relrowsecurity
       and not relation.relforcerowsecurity
       and not relation.relispartition
  ) <> 9 then
    raise exception using
      errcode = 'P0001',
      message = 'Final Project table storage/owner/RLS parity failed.';
  end if;

  for v_column in
    select *
      from (values
        ('projects', 'general_description'),
        ('projects', 'short_description'),
        ('projects', 'image_alt'),
        ('projects', 'hero_image_alt'),
        ('projects', 'small_box_image_alt'),
        ('projects', 'location_label'),
        ('projects', 'overview_title'),
        ('projects', 'overview_body'),
        ('projects', 'delivery_title'),
        ('projects', 'delivery_body'),
        ('project_media', 'alt_text')
      ) expected(table_name, column_name)
  loop
    if exists (
      select 1
        from pg_catalog.pg_attribute attribute
        join pg_catalog.pg_attrdef default_record
          on default_record.adrelid = attribute.attrelid
         and default_record.adnum = attribute.attnum
       where attribute.attrelid = format('public.%I', v_column.table_name)::regclass
         and attribute.attname = v_column.column_name
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Legacy default remains on public.%I.%I.',
          v_column.table_name,
          v_column.column_name
        );
    end if;
  end loop;

  if exists (
    select 1
      from unnest(array[
        'image',
        'hero_image',
        'small_box_image',
        'governorate_id',
        'city_id',
        'main_area_id',
        'google_maps_url',
        'latitude',
        'longitude',
        'map_zoom'
      ]) expected(column_name)
     where not exists (
       select 1
         from pg_catalog.pg_attribute attribute
        where attribute.attrelid = 'public.projects'::regclass
          and attribute.attname = expected.column_name
          and attribute.attnotnull
     )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A final Project NOT NULL property is missing.';
  end if;

  if (
    select count(*)
      from pg_catalog.pg_constraint constraint_record
     where (
       constraint_record.conrelid,
       constraint_record.conname
     ) in (
       ('public.projects'::regclass, 'projects_general_description_check'),
       ('public.projects'::regclass, 'projects_short_description_check'),
       ('public.projects'::regclass, 'projects_image_check'),
       ('public.projects'::regclass, 'projects_image_alt_check'),
       ('public.projects'::regclass, 'projects_hero_image_check'),
       ('public.projects'::regclass, 'projects_hero_image_alt_check'),
       ('public.projects'::regclass, 'projects_small_box_image_check'),
       ('public.projects'::regclass, 'projects_small_box_image_alt_check'),
       ('public.projects'::regclass, 'projects_location_label_check'),
       ('public.projects'::regclass, 'projects_google_maps_url_check'),
       ('public.projects'::regclass, 'projects_overview_title_check'),
       ('public.projects'::regclass, 'projects_overview_body_check'),
       ('public.projects'::regclass, 'projects_delivery_title_check'),
       ('public.projects'::regclass, 'projects_delivery_body_check'),
       ('public.projects'::regclass, 'projects_seo_title_check'),
       ('public.projects'::regclass, 'projects_seo_description_check'),
       ('public.projects'::regclass, 'projects_canonical_url_check'),
       ('public.projects'::regclass, 'projects_overview_image_required_check'),
       ('public.projects'::regclass, 'projects_overview_image_alt_check'),
       ('public.projects'::regclass, 'projects_og_image_alt_check'),
       ('public.project_floor_plans'::regclass, 'project_floor_plans_architectural_image_alt_check'),
       ('public.project_floor_plans'::regclass, 'project_floor_plans_furnishing_image_alt_check'),
       ('public.project_media'::regclass, 'project_media_alt_text_check'),
       ('public.project_videos'::regclass, 'project_videos_poster_alt_check')
     )
       and constraint_record.contype = 'c'
       and constraint_record.convalidated
       and not constraint_record.condeferrable
       and not constraint_record.condeferred
       and not constraint_record.connoinherit
       and constraint_record.conislocal
       and constraint_record.coninhcount = 0
       and constraint_record.conparentid = 0
  ) <> 24 then
    raise exception using
      errcode = 'P0001',
      message = 'The complete final Project check-constraint set was not established.';
  end if;

  for v_function in
    select *
      from (values
        ('public.save_project_admin_entry(bigint,jsonb)', true, 'aa3258d57ab320cd0fa46eeb2595ae7c', 'record', true, 2),
        ('public.delete_project_admin_entry(bigint)', true, '0b989a1d6bebfdc8c3b26f722a346f4a', 'record', true, 0),
        ('public.validate_project_location_parent()', false, 'b2952745f6f845a341d55bfcefa9129e', 'trigger', false, 0),
        ('public.prevent_project_type_change()', false, '70bfd044e16a5325cf65f4b8b4ba16f3', 'trigger', false, 0),
        ('public.validate_project_location_selection()', false, '5e401c75615c4e0d68704ccd593ce0d9', 'trigger', false, 0),
        ('public.prevent_project_location_reparent()', false, '1e9707b8b31a3050ab2639ea71c1391b', 'trigger', false, 0)
      ) expected(
        signature,
        security_definer,
        final_hash,
        result_type,
        returns_set,
        default_argument_count
      )
  loop
    select pg_catalog.md5(
             pg_catalog.replace(
               pg_catalog.replace(procedure_record.prosrc, E'\r\n', E'\n'),
               E'\r',
               E'\n'
             )
           )
      into v_source_hash
      from pg_catalog.pg_proc procedure_record
      join pg_catalog.pg_language language
        on language.oid = procedure_record.prolang
     where procedure_record.oid = v_function.signature::regprocedure
       and language.lanname = 'plpgsql'
       and procedure_record.proowner = 'postgres'::regrole
       and procedure_record.prokind = 'f'
       and procedure_record.prosecdef = v_function.security_definer
       and procedure_record.prorettype = v_function.result_type::regtype
       and procedure_record.proretset = v_function.returns_set
       and procedure_record.pronargdefaults = v_function.default_argument_count
       and procedure_record.provolatile = 'v'
       and not procedure_record.proisstrict
       and not procedure_record.proleakproof
       and procedure_record.proparallel = 'u'
       and procedure_record.proconfig = array['search_path=pg_catalog, pg_temp']::text[];

    if v_source_hash is distinct from v_function.final_hash then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Function %s did not reach the final body/property contract.',
          v_function.signature
        );
    end if;
  end loop;

  if not exists (
    select 1
      from pg_catalog.pg_proc procedure_record
     where procedure_record.oid = 'public.save_project_admin_entry(bigint,jsonb)'::regprocedure
       and procedure_record.pronargs = 2
       and procedure_record.pronargdefaults = 2
       and procedure_record.proretset
       and procedure_record.prorettype = 'record'::regtype
       and procedure_record.proargtypes[0] = 'bigint'::regtype
       and procedure_record.proargtypes[1] = 'jsonb'::regtype
  ) or not exists (
    select 1
      from pg_catalog.pg_proc procedure_record
     where procedure_record.oid = 'public.delete_project_admin_entry(bigint)'::regprocedure
       and procedure_record.pronargs = 1
       and procedure_record.pronargdefaults = 0
       and procedure_record.proretset
       and procedure_record.prorettype = 'record'::regtype
       and procedure_record.proargtypes[0] = 'bigint'::regtype
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A Project aggregate RPC signature/result contract drifted.';
  end if;

  if (
    select count(*)
     from pg_catalog.pg_trigger trigger_record
     where trigger_record.tgrelid = any (array[
       'public.project_locations'::regclass,
       'public.projects'::regclass,
       'public.project_location_points'::regclass,
       'public.project_features'::regclass,
       'public.project_floor_plans'::regclass,
       'public.project_floor_plan_details'::regclass,
       'public.project_delivery_items'::regclass,
       'public.project_media'::regclass,
       'public.project_videos'::regclass
     ])
       and not trigger_record.tgisinternal
  ) <> 4 then
    raise exception using
      errcode = 'P0001',
      message = 'Unexpected Project user-trigger count.';
  end if;

  for v_trigger in
    select *
      from (values
        (
          'public.project_locations',
          'project_locations_validate_parent',
          23,
          'public.validate_project_location_parent()',
          array['is_active', 'level', 'parent_id']::text[]
        ),
        (
          'public.project_locations',
          'project_locations_prevent_reparent',
          19,
          'public.prevent_project_location_reparent()',
          array['is_active', 'level', 'parent_id']::text[]
        ),
        (
          'public.projects',
          'projects_type_immutable',
          19,
          'public.prevent_project_type_change()',
          array['type']::text[]
        ),
        (
          'public.projects',
          'projects_validate_location_selection',
          23,
          'public.validate_project_location_selection()',
          array['city_id', 'governorate_id', 'main_area_id', 'sub_area_id']::text[]
        )
      ) expected(table_name, trigger_name, trigger_type, function_signature, update_columns)
  loop
    select array_agg(attribute.attname order by attribute.attname)
      into v_actual_columns
      from pg_catalog.pg_trigger trigger_record
      join pg_catalog.pg_attribute attribute
        on attribute.attrelid = trigger_record.tgrelid
       and attribute.attnum = any (trigger_record.tgattr)
     where trigger_record.tgrelid = v_trigger.table_name::regclass
       and trigger_record.tgname = v_trigger.trigger_name
       and not trigger_record.tgisinternal
       and trigger_record.tgenabled = 'O'
       and trigger_record.tgtype = v_trigger.trigger_type
       and not trigger_record.tgdeferrable
       and not trigger_record.tginitdeferred
       and trigger_record.tgfoid = v_trigger.function_signature::regprocedure
       and trigger_record.tgqual is null
       and trigger_record.tgnargs = 0
       and trigger_record.tgoldtable is null
       and trigger_record.tgnewtable is null
       and trigger_record.tgparentid = 0
       and trigger_record.tgconstraint = 0
       and trigger_record.tgconstrrelid = 0;

    if v_actual_columns is distinct from v_trigger.update_columns then
      raise exception using
        errcode = 'P0001',
        message = format('Trigger %I did not reach the final contract.', v_trigger.trigger_name);
    end if;
  end loop;

  if not exists (
    select 1
      from (
        select
          count(*) filter (where constraint_record.contype = 'p') as primary_count,
          count(*) filter (where constraint_record.contype = 'f') as foreign_count,
          count(*) filter (where constraint_record.contype = 'u') as unique_count,
          count(*) filter (where constraint_record.contype = 'c') as check_count,
          count(*) filter (
            where constraint_record.condeferrable
          ) as deferrable_count,
          count(*) filter (
            where constraint_record.condeferred
          ) as initially_deferred_count,
          bool_and(constraint_record.convalidated) as all_validated,
          bool_and(
            constraint_record.conislocal
            and constraint_record.coninhcount = 0
            and constraint_record.conparentid = 0
            and (
              (
                constraint_record.contype = 'c'
                and not constraint_record.connoinherit
              )
              or (
                constraint_record.contype in ('p', 'f', 'u')
                and constraint_record.connoinherit
              )
            )
          ) as all_local_expected_inheritance
        from pg_catalog.pg_constraint constraint_record
        join pg_catalog.pg_class relation
          on relation.oid = constraint_record.conrelid
        join pg_catalog.pg_namespace namespace
          on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = any (array[
           'project_locations',
           'projects',
           'project_location_points',
           'project_features',
           'project_floor_plans',
           'project_floor_plan_details',
           'project_delivery_items',
           'project_media',
           'project_videos'
         ])
         and constraint_record.contype in ('p', 'f', 'u', 'c')
      ) summary
     where summary.primary_count = 9
       and summary.foreign_count = 12
       and summary.unique_count = 24
       and summary.check_count = 54
       and summary.deferrable_count = 7
       and summary.initially_deferred_count = 7
       and summary.all_validated
       and summary.all_local_expected_inheritance
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Project PK/FK/UNIQUE/CHECK parity was not preserved.';
  end if;

  if not exists (
    select 1
      from (
        select
          count(*) as index_count,
          count(*) filter (where index_record.indisunique) as unique_index_count,
          count(*) filter (where index_record.indisprimary) as primary_index_count,
          count(*) filter (where not index_record.indimmediate) as deferred_index_count,
          bool_and(
            index_record.indisvalid
            and index_record.indisready
            and index_record.indislive
          ) as all_usable
        from pg_catalog.pg_index index_record
        join pg_catalog.pg_class relation
          on relation.oid = index_record.indrelid
        join pg_catalog.pg_namespace namespace
          on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = any (array[
           'project_locations',
           'projects',
           'project_location_points',
           'project_features',
           'project_floor_plans',
           'project_floor_plan_details',
           'project_delivery_items',
           'project_media',
           'project_videos'
         ])
      ) summary
     where summary.index_count = 44
       and summary.unique_index_count = 34
       and summary.primary_index_count = 9
       and summary.deferred_index_count = 7
       and summary.all_usable
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Project index-count/readiness parity was not preserved.';
  end if;

  if exists (
    select 1
      from (values
        ('project_locations', 'project_locations_id_seq'),
        ('projects', 'projects_id_seq'),
        ('project_location_points', 'project_location_points_id_seq'),
        ('project_features', 'project_features_id_seq'),
        ('project_floor_plans', 'project_floor_plans_id_seq'),
        ('project_floor_plan_details', 'project_floor_plan_details_id_seq'),
        ('project_delivery_items', 'project_delivery_items_id_seq'),
        ('project_media', 'project_media_id_seq'),
        ('project_videos', 'project_videos_id_seq')
      ) expected(table_name, sequence_name)
     where not exists (
       select 1
         from pg_catalog.pg_class sequence_relation
         join pg_catalog.pg_namespace sequence_namespace
           on sequence_namespace.oid = sequence_relation.relnamespace
         join pg_catalog.pg_sequence sequence_record
           on sequence_record.seqrelid = sequence_relation.oid
         join pg_catalog.pg_class table_relation
           on table_relation.relnamespace = sequence_relation.relnamespace
          and table_relation.relname = expected.table_name
         join pg_catalog.pg_attribute id_attribute
           on id_attribute.attrelid = table_relation.oid
          and id_attribute.attname = 'id'
         join pg_catalog.pg_depend dependency
           on dependency.classid = 'pg_class'::regclass
          and dependency.objid = sequence_relation.oid
          and dependency.refclassid = 'pg_class'::regclass
          and dependency.refobjid = table_relation.oid
          and dependency.refobjsubid = id_attribute.attnum
          and dependency.deptype = 'i'
        where sequence_namespace.nspname = 'public'
          and sequence_relation.relname = expected.sequence_name
          and sequence_relation.relkind = 'S'
          and sequence_relation.relpersistence = 'p'
          and sequence_relation.relowner = 'postgres'::regrole
          and table_relation.relowner = 'postgres'::regrole
          and id_attribute.attidentity = 'd'
          and id_attribute.atttypid = 'bigint'::regtype
          and sequence_record.seqtypid = 'bigint'::regtype
          and sequence_record.seqstart = 1
          and sequence_record.seqincrement = 1
          and sequence_record.seqmin = 1
          and sequence_record.seqmax = 9223372036854775807
          and sequence_record.seqcache = 1
          and not sequence_record.seqcycle
     )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Project identity-sequence parity was not preserved.';
  end if;

  if (
    select count(*)
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname = any (array[
         'project_locations',
         'projects',
         'project_location_points',
         'project_features',
         'project_floor_plans',
         'project_floor_plan_details',
         'project_delivery_items',
         'project_media',
         'project_videos'
       ])
       and relation.relkind = 'r'
       and relation.relrowsecurity
       and not relation.relforcerowsecurity
  ) <> 9 or exists (
    select 1
      from pg_catalog.pg_policy policy
     where policy.polrelid = any (array[
       'public.project_locations'::regclass,
       'public.projects'::regclass,
       'public.project_location_points'::regclass,
       'public.project_features'::regclass,
       'public.project_floor_plans'::regclass,
       'public.project_floor_plan_details'::regclass,
       'public.project_delivery_items'::regclass,
       'public.project_media'::regclass,
       'public.project_videos'::regclass
     ])
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Project RLS/no-policy parity was not preserved.';
  end if;

  if exists (
    with expected(
      client_key,
      level,
      parent_client_key,
      name_ar,
      name_en,
      sort_order,
      is_active
    ) as (
      values
        ('ca100000-0000-4000-8000-000000000001'::uuid, 'governorate', null::uuid, 'القاهرة', 'Cairo', 0, true),
        ('ca100000-0000-4000-8000-000000000002'::uuid, 'city', 'ca100000-0000-4000-8000-000000000001'::uuid, 'القاهرة الجديدة', 'New Cairo', 0, true),
        ('ca100000-0000-4000-8000-000000000003'::uuid, 'main_area', 'ca100000-0000-4000-8000-000000000002'::uuid, 'التجمع الخامس', 'Fifth Settlement', 0, true),
        ('ca100000-0000-4000-8000-000000000004'::uuid, 'sub_area', 'ca100000-0000-4000-8000-000000000003'::uuid, 'الحي الثاني', 'Second District', 0, true)
    )
    select 1
      from expected
      left join public.project_locations location
        on location.client_key = expected.client_key
      left join public.project_locations parent
        on parent.id = location.parent_id
     where location.id is null
        or location.level is distinct from expected.level
        or parent.client_key is distinct from expected.parent_client_key
        or location.name_ar is distinct from expected.name_ar
        or location.name_en is distinct from expected.name_en
        or location.sort_order is distinct from expected.sort_order
        or location.is_active is distinct from expected.is_active
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Final Project reference-location seed parity failed.';
  end if;
end
$project_parity_assert$;

do $project_acl_assert$
declare
  v_table text;
  v_sequence text;
  v_role text;
begin
  foreach v_table in array array[
    'project_locations',
    'projects',
    'project_location_points',
    'project_features',
    'project_floor_plans',
    'project_floor_plan_details',
    'project_delivery_items',
    'project_media',
    'project_videos'
  ]
  loop
    if not pg_catalog.has_table_privilege(
      'service_role',
      format('public.%I', v_table),
      'SELECT'
    ) or pg_catalog.has_table_privilege(
      'service_role',
      format('public.%I', v_table),
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
    ) then
      raise exception using
        errcode = '42501',
        message = format('Unsafe service_role table ACL remains on public.%I.', v_table);
    end if;

    foreach v_role in array array['anon', 'authenticated']
    loop
      if pg_catalog.has_table_privilege(
        v_role,
        format('public.%I', v_table),
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
      ) then
        raise exception using
          errcode = '42501',
          message = format('Unsafe %I table ACL remains on public.%I.', v_role, v_table);
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
    where relation.relacl is not null
      and namespace.nspname = 'public'
      and relation.relname = any (array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ])
      and relation.relkind in ('r', 'p')
      and acl.grantee <> relation.relowner
      and not (
        acl.grantee = 'service_role'::regrole::oid
        and acl.privilege_type = 'SELECT'
        and not acl.is_grantable
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct table grant remains on the Project aggregate.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = relation.oid
     and attribute.attnum > 0
     and not attribute.attisdropped
    cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
    where attribute.attacl is not null
      and namespace.nspname = 'public'
      and relation.relname = any (array[
        'project_locations',
        'projects',
        'project_location_points',
        'project_features',
        'project_floor_plans',
        'project_floor_plan_details',
        'project_delivery_items',
        'project_media',
        'project_videos'
      ])
      and relation.relkind in ('r', 'p')
      and acl.grantee <> relation.relowner
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct column grant remains on the Project aggregate.';
  end if;

  foreach v_sequence in array array[
    'project_locations_id_seq',
    'projects_id_seq',
    'project_location_points_id_seq',
    'project_features_id_seq',
    'project_floor_plans_id_seq',
    'project_floor_plan_details_id_seq',
    'project_delivery_items_id_seq',
    'project_media_id_seq',
    'project_videos_id_seq'
  ]
  loop
    foreach v_role in array array['anon', 'authenticated', 'service_role']
    loop
      if pg_catalog.has_sequence_privilege(
        v_role,
        format('public.%I', v_sequence),
        'SELECT,USAGE,UPDATE'
      ) then
        raise exception using
          errcode = '42501',
          message = format('Unsafe %I sequence ACL remains on public.%I.', v_role, v_sequence);
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_class as sequence
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = sequence.relnamespace
    cross join lateral pg_catalog.aclexplode(sequence.relacl) as acl
    where sequence.relacl is not null
      and namespace.nspname = 'public'
      and sequence.relname = any (array[
        'project_locations_id_seq',
        'projects_id_seq',
        'project_location_points_id_seq',
        'project_features_id_seq',
        'project_floor_plans_id_seq',
        'project_floor_plan_details_id_seq',
        'project_delivery_items_id_seq',
        'project_media_id_seq',
        'project_videos_id_seq'
      ])
      and sequence.relkind = 'S'
      and acl.grantee <> sequence.relowner
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct sequence grant remains on the Project aggregate.';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.save_project_admin_entry(bigint,jsonb)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role',
    'public.delete_project_admin_entry(bigint)',
    'EXECUTE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'service_role cannot execute both Project aggregate RPCs.';
  end if;

  foreach v_role in array array['anon', 'authenticated']
  loop
    if pg_catalog.has_function_privilege(
      v_role,
      'public.save_project_admin_entry(bigint,jsonb)',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.delete_project_admin_entry(bigint)',
      'EXECUTE'
    ) then
      raise exception using
        errcode = '42501',
        message = format('Unsafe %I Project aggregate RPC ACL remains.', v_role);
    end if;
  end loop;

  foreach v_role in array array['anon', 'authenticated', 'service_role']
  loop
    if pg_catalog.has_function_privilege(
      v_role,
      'public.validate_project_location_parent()',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.prevent_project_type_change()',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.validate_project_location_selection()',
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      v_role,
      'public.prevent_project_location_reparent()',
      'EXECUTE'
    ) then
      raise exception using
        errcode = '42501',
        message = format('Unsafe %I helper-function ACL remains.', v_role);
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    where procedure.proacl is not null
      and namespace.nspname = 'public'
      and procedure.oid = any (array[
        'public.save_project_admin_entry(bigint,jsonb)'::regprocedure::oid,
        'public.delete_project_admin_entry(bigint)'::regprocedure::oid
      ])
      and acl.grantee <> procedure.proowner
      and not (
        acl.grantee = 'service_role'::regrole::oid
        and acl.privilege_type = 'EXECUTE'
        and not acl.is_grantable
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct Project RPC grant remains.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    where procedure.proacl is not null
      and namespace.nspname = 'public'
      and procedure.oid = any (array[
        'public.validate_project_location_parent()'::regprocedure::oid,
        'public.prevent_project_type_change()'::regprocedure::oid,
        'public.validate_project_location_selection()'::regprocedure::oid,
        'public.prevent_project_location_reparent()'::regprocedure::oid
      ])
      and acl.grantee <> procedure.proowner
  ) then
    raise exception using
      errcode = '42501',
      message = 'A non-owner direct helper-function grant remains.';
  end if;
end
$project_acl_assert$;

commit;
