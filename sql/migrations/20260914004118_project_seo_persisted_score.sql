begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- EXPAND the current aggregate boundary for legacy and adopted callers.
-- Entity SEO analysis remains in TypeScript. Legacy writes leave unresolved
-- inputs for backfill; adopted writes bind their tuple to the final Project.
do $preflight$
begin
  if to_regprocedure('public.entity_seo_score_source(text,jsonb)') is null
     or to_regprocedure('public.save_project_admin_entry_before_section_titles(bigint,jsonb)') is null
     or to_regprocedure('public.duplicate_project_admin_entry_before_section_titles(bigint)') is null
     or to_regprocedure('public.duplicate_project_admin_entry(bigint)') is null then
    raise exception 'Project persisted Entity SEO requires the existing aggregate writers and shared source projection.';
  end if;
end
$preflight$;

-- Existing aggregate wrappers assign code after calling their core INSERT.
-- The deployed NOT NULL column prevents those INSERTs from completing first.
-- Supply the same existing value at INSERT; retain all wrapper validation and
-- the duplicate wrapper's final COPY-id label. Exact catalog fingerprints
-- (normalizing CRLF only for checkout portability)
-- and unique structural matches prohibit silently patching an unknown owner.
do $core_insert_code$
declare
  v_patch record;
  v_definition text;
begin
  for v_patch in select * from (values
    ('public.save_project_admin_entry_core(bigint,jsonb)',
     'ce0e3a9507d7e69454cb765988bdaa6b2e3722a0acd1b0fa0f691ad7962d19cf',
     E'insert into public.projects (\n      type, arabic_name, english_name, slug,',
     E'insert into public.projects (\n      type, code, arabic_name, english_name, slug,',
     E') values (\n      v_root ->> ''type'',',
     E') values (\n      v_root ->> ''type'', upper(btrim(coalesce(v_root->>''code'', v_root->>''slug''))),'),
    ('public.duplicate_project_admin_entry_core(bigint)',
     'b058cf8294b7c4712c5b9b696701c23095c73f4ce92c0d3253a5f660bf13084d',
     E'insert into public.projects (\n        type, arabic_name, english_name, slug,',
     E'insert into public.projects (\n        type, code, arabic_name, english_name, slug,',
     E') values (\n        v_source.type,',
     E') values (\n        v_source.type, v_source.code,')
  ) as patches(signature, expected_sha256, old_columns, new_columns, old_values, new_values)
  loop
    if to_regprocedure(v_patch.signature) is null then
      raise exception 'Project core INSERT owner missing: %', v_patch.signature;
    end if;
    v_definition := replace(pg_get_functiondef(to_regprocedure(v_patch.signature)), E'\r\n', E'\n');
    if encode(sha256(convert_to(v_definition, 'UTF8')), 'hex') <> v_patch.expected_sha256 then
      raise exception 'Project core INSERT provenance mismatch: %', v_patch.signature;
    end if;
    if length(v_definition) - length(replace(v_definition, v_patch.old_columns, '')) <> length(v_patch.old_columns)
       or length(v_definition) - length(replace(v_definition, v_patch.old_values, '')) <> length(v_patch.old_values) then
      raise exception 'Project core INSERT structural match is not unique: %', v_patch.signature;
    end if;
    execute replace(replace(v_definition, v_patch.old_columns, v_patch.new_columns), v_patch.old_values, v_patch.new_values);
  end loop;
end
$core_insert_code$;

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
begin
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

-- One callable signature keeps the old one-argument request working during
-- EXPAND. Without proof its new row stays unresolved; after ENFORCE the deferred
-- required-proof trigger rejects that same transaction. No parallel overload.
drop function public.duplicate_project_admin_entry(bigint);
create function public.duplicate_project_admin_entry(
  p_project_id bigint,
  p_seo_proof jsonb default null
)
returns table (
  project_id bigint, project_type text, project_slug text, featured boolean,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_copy record;
  v_source public.projects%rowtype;
  v_result jsonb;
  v_score jsonb := p_seo_proof->'score';
begin
  if p_seo_proof is not null and (
     jsonb_typeof(p_seo_proof->'expected_source') is distinct from 'object'
     or jsonb_typeof(p_seo_proof->'expected_result') is distinct from 'object'
     or jsonb_typeof(v_score) is distinct from 'object'
     or nullif(p_seo_proof->>'expected_updated_at', '') is null) then
    raise exception using errcode = '22023', message = 'PROJECT_DUPLICATE_SEO_PROOF_REQUIRED';
  end if;

  select project.* into v_source
  from public.projects project
  where project.id = p_project_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  if p_seo_proof is not null and (
     v_source.updated_at is distinct from (p_seo_proof->>'expected_updated_at')::timestamptz
      or public.entity_seo_score_source('projects', to_jsonb(v_source))
         is distinct from public.entity_seo_score_source('projects', p_seo_proof->'expected_source')) then
    raise exception using errcode = 'VSE01', message = 'PROJECT_DUPLICATE_SEO_SOURCE_CONFLICT';
  end if;

  -- The existing aggregate owns identity allocation and all child copies.
  select * into strict v_copy
  from public.duplicate_project_admin_entry_before_section_titles(p_project_id);

  update public.projects project set
    location_title = v_source.location_title,
    plans_title = v_source.plans_title,
    gallery_title = v_source.gallery_title,
    show_location_label = v_source.show_location_label,
    show_location_tags = v_source.show_location_tags
  where project.id = v_copy.project_id
  returning to_jsonb(project.*) into v_result;

  if p_seo_proof is not null and (public.entity_seo_score_source('projects', v_result)
      is distinct from public.entity_seo_score_source('projects', p_seo_proof->'expected_result')) then
    -- Includes concurrent slug allocation: throwing here rolls back the root
    -- and every child, so the action may safely obtain a fresh bounded proof.
    raise exception using errcode = 'VSE01', message = 'PROJECT_DUPLICATE_SEO_RESULT_CONFLICT';
  end if;

  if p_seo_proof is not null then
    update public.projects project set
      seo_score = (v_score->>'seo_score')::integer,
      seo_score_version = (v_score->>'seo_score_version')::integer,
      seo_score_input_hash = v_score->>'seo_score_input_hash'
    where project.id = v_copy.project_id;
  end if;

  return query select
    v_copy.project_id, v_copy.project_type, v_copy.project_slug, v_copy.featured,
    v_copy.created_at, v_copy.updated_at;
end
$function$;

revoke all on function public.save_project_admin_entry(bigint, jsonb)
from public, anon, authenticated;
revoke all on function public.duplicate_project_admin_entry(bigint, jsonb)
from public, anon, authenticated;
grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role;
grant execute on function public.duplicate_project_admin_entry(bigint, jsonb) to service_role;

comment on function public.save_project_admin_entry(bigint, jsonb) is
  'Single atomic Project Admin writer, including derived Entity SEO score and existing Location Section presentation.';
comment on function public.duplicate_project_admin_entry(bigint, jsonb) is
  'Single atomic Project duplicate writer. Locked source and final allocated SEO inputs must match the server proof before score persistence.';

notify pgrst, 'reload schema';

commit;

-- No existing Project data is changed by this migration. Shared Entity SEO
-- backfill owns existing rows. ENFORCE is a separate post-deployment migration;
-- do not activate it while the Production application still has legacy writers.
