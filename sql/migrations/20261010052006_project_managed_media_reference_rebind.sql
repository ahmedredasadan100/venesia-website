begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Additive operation on the existing Project RPC; no table grants, new
-- overloads, authored data writes or historical migration replay.
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
  v_saved record;
  v_root jsonb := coalesce(p_payload->'project', '{}'::jsonb);
  v_location_section_presentation jsonb :=
    coalesce(p_payload->'location_section_presentation', '{}'::jsonb);
  v_forward_payload jsonb;
  v_forward_root jsonb;
  v_optional_title_sentinel constant text := '__optional_project_section_title__';
  v_has_seo_tuple boolean := v_root ?| array['seo_score', 'seo_score_version', 'seo_score_input_hash'];
  v_rebind jsonb := p_payload->'media_rebind';
  v_table text;
  v_field text;
  v_entity_id bigint;
  v_parent public.projects%rowtype;
  v_current jsonb;
  v_score jsonb;
  v_now timestamptz := clock_timestamp();

begin

  -- Media relocation/replace is a narrow CAS operation of this aggregate owner.
  -- Ordinary editor payloads continue through the unchanged path below.
  if p_payload ? 'media_rebind' then
    if p_project_id is null or jsonb_typeof(v_rebind) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(p_payload)) <> 1 then
      raise exception using errcode = '22023', message = 'PROJECT_MEDIA_REBIND_INVALID';
    end if;
    v_table := v_rebind->>'table';
    v_field := v_rebind->>'field';
    if not coalesce((v_table = 'projects' and v_field = any(array['image','hero_image','small_box_image','overview_main_image','og_image','brochure_url']))
       or (v_table = 'project_media' and v_field = 'image')
       or (v_table = 'project_floor_plans' and v_field = any(array['architectural_image','furnishing_image']))
       or (v_table = 'project_videos' and v_field = any(array['poster_image','video_url'])), false)
       or jsonb_typeof(v_rebind->'expected_value') is distinct from 'string'
       or jsonb_typeof(v_rebind->'next_value') is distinct from 'string'
       or nullif(v_rebind->>'expected_updated_at','') is null
       or v_rebind->>'expected_value' = v_rebind->>'next_value' then
      raise exception using errcode = '22023', message = 'PROJECT_MEDIA_REBIND_INVALID';
    end if;
    v_entity_id := (v_rebind->>'id')::bigint;
    select p.* into v_parent from public.projects p where p.id = p_project_id for update;
    if not found or v_entity_id is null then
      raise exception using errcode = 'P0002', message = 'PROJECT_MEDIA_REBIND_ENTITY_MISSING';
    end if;
    if v_table = 'projects' then
      if v_entity_id <> p_project_id then
        raise exception using errcode = '22023', message = 'PROJECT_MEDIA_REBIND_PARENT_MISMATCH';
      end if;
      v_current := to_jsonb(v_parent);
    else
      execute format('select to_jsonb(r) from public.%I r where r.id = $1 and r.project_id = $2 for update', v_table)
        into v_current using v_entity_id, p_project_id;
    end if;
    if v_current is null or v_current->>v_field is distinct from v_rebind->>'expected_value'
       or (v_current->>'updated_at')::timestamptz is distinct from (v_rebind->>'expected_updated_at')::timestamptz then
      raise exception using errcode = '40001', message = 'PROJECT_MEDIA_REBIND_CONFLICT';
    end if;
    -- The target must already belong to the managed Catalog. A relocation may
    -- still be uncertain until old-object retirement completes.
    if not exists(select 1 from public.media_assets a where a.provider = 'supabase'
       and a.public_url = v_rebind->>'next_value' and a.status = 'active' and not a.missing_object)
       and not exists (
         -- Compensation may target the retained old object while Catalog still
         -- names the staged copy. Only the existing exact lease journal admits it.
         select 1 from public.media_reference_write_leases l
         join public.media_assets a on a.id=l.asset_id
         where l.resolved_at is null and (l.status='active' or
           (l.status='failed' and l.failure_code='media_relocation_repair_running'))
           and l.failure_metadata->>'operation'='physical_move'
           and l.failure_metadata->>'copyConfirmed'='true'
           and l.failure_metadata->'previousAsset'->>'publicUrl'=v_rebind->>'next_value'
           and l.failure_metadata->'nextIdentity'->>'publicUrl'=v_rebind->>'expected_value'
           and a.public_url=v_rebind->>'expected_value' and a.status='active'
           and l.failure_metadata->'referenceKeys' @> jsonb_build_array(jsonb_build_array(v_table,v_entity_id::text,v_field))
           and exists(select 1 from storage.objects o where o.bucket_id=l.failure_metadata->'previousAsset'->>'bucket'
             and o.name=l.failure_metadata->'previousAsset'->>'objectKey')
       ) then
      raise exception using errcode = '22023', message = 'PROJECT_MEDIA_REBIND_TARGET_UNMANAGED';
    end if;
    if v_table = 'projects' then
      v_score := to_jsonb(v_parent);
      if v_field = any(array['hero_image','og_image']) then
        if jsonb_typeof(v_rebind->'score') is distinct from 'object'
           or public.entity_seo_score_source('projects', to_jsonb(v_parent))
              is distinct from public.entity_seo_score_source('projects', v_rebind->'expected_source') then
          raise exception using errcode = '40001', message = 'PROJECT_MEDIA_REBIND_SOURCE_CONFLICT';
        end if;
        v_score := v_rebind->'score';
      end if;
      execute format('update public.projects set %I=$1, updated_at=$2, seo_score=$3, seo_score_version=$4, seo_score_input_hash=$5 where id=$6',v_field)
        using v_rebind->>'next_value',v_now,(v_score->>'seo_score')::integer,
          (v_score->>'seo_score_version')::integer,v_score->>'seo_score_input_hash',p_project_id;
    else
      execute format('update public.%I set %I=$1, updated_at=$2 where id=$3 and project_id=$4',v_table,v_field)
        using v_rebind->>'next_value',v_now,v_entity_id,p_project_id;
      update public.projects p set updated_at=v_now where p.id=p_project_id;
    end if;
    return query select p.id,p.slug,p.updated_at from public.projects p where p.id=p_project_id;
    return;
  end if;

  v_forward_root := v_root || jsonb_build_object(
    'overview_title', coalesce(nullif(btrim(v_root->>'overview_title'), ''), v_optional_title_sentinel),
    'delivery_title', coalesce(nullif(btrim(v_root->>'delivery_title'), ''), v_optional_title_sentinel)
  );
  v_forward_payload := jsonb_set(
    coalesce(p_payload, '{}'::jsonb), '{project}', v_forward_root, true
  );

  select * into strict v_saved
  from public.save_project_admin_entry_before_section_titles(p_project_id, v_forward_payload);

  update public.projects project set
    location_title = nullif(btrim(v_root->>'location_title'), ''),
    overview_title = nullif(btrim(v_root->>'overview_title'), ''),
    plans_title = nullif(btrim(v_root->>'plans_title'), ''),
    delivery_title = nullif(btrim(v_root->>'delivery_title'), ''),
    gallery_title = nullif(btrim(v_root->>'gallery_title'), ''),
    show_location_label = case
      when v_location_section_presentation ? 'show_location_label'
        then coalesce((v_location_section_presentation->>'show_location_label')::boolean, true)
      else project.show_location_label
    end,
    show_location_tags = case
      when v_location_section_presentation ? 'show_location_tags'
        then coalesce((v_location_section_presentation->>'show_location_tags')::boolean, true)
      else project.show_location_tags
    end,
    -- The core update already invalidates any changed legacy inputs. When the
    -- legacy payload has no tuple keys, preserve that final core state, including
    -- an unchanged valid tuple. Partial supplied tuples are still rejected.
    seo_score = case when v_has_seo_tuple then (v_root->>'seo_score')::integer else project.seo_score end,
    seo_score_version = case when v_has_seo_tuple then (v_root->>'seo_score_version')::integer else project.seo_score_version end,
    seo_score_input_hash = case when v_has_seo_tuple then v_root->>'seo_score_input_hash' else project.seo_score_input_hash end,
    updated_at = v_saved.updated_at
  where project.id = v_saved.project_id;

  return query select v_saved.project_id, v_saved.slug, v_saved.updated_at;
end
$function$;

revoke all on function public.save_project_admin_entry(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.save_project_admin_entry(bigint,jsonb) to service_role;

-- Page duplication adopts the same Media lease snapshot. Preserve the existing
-- composition owner and ACL; reject stale snapshots before copying the row.
do $media_clone$
declare
  v_definition text;
  v_old text := $old$  elsif p_operation = 'duplicate_page' then
    select to_jsonb(page) into v_page_source from public.pages page where id = p_page_id for update;$old$;
  v_new text := $new$  elsif p_operation = 'duplicate_page' then
    select to_jsonb(page) into v_page_source from public.pages page where id = p_page_id for update;
    if p_payload ? 'expected_media' and (
      jsonb_typeof(p_payload->'expected_media') is distinct from 'object'
      or v_page_source->'og_image' is distinct from p_payload->'expected_media'->'og_image'
      or (v_page_source->>'updated_at')::timestamptz is distinct from (p_payload->'expected_media'->>'updated_at')::timestamptz
    ) then
      raise exception using errcode = '40001', message = 'PAGE_MEDIA_CLONE_CONFLICT';
    end if;$new$;
begin
  select replace(pg_get_functiondef(oid), E'\r\n', E'\n') into strict v_definition
    from pg_proc where oid='public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
    raise exception 'Page media clone owner source mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$media_clone$;

notify pgrst, 'reload schema';
commit;
