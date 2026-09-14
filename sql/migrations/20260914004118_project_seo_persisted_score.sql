begin;

-- Extend the current aggregate boundary. Entity SEO analysis is computed by
-- the shared TypeScript owner; this transaction binds its tuple to the final
-- Project inputs before the deferred Entity SEO validation runs at commit.
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
    seo_score = (v_root->>'seo_score')::integer,
    seo_score_version = (v_root->>'seo_score_version')::integer,
    seo_score_input_hash = v_root->>'seo_score_input_hash',
    updated_at = v_saved.updated_at
  where project.id = v_saved.project_id;

  return query select v_saved.project_id, v_saved.slug, v_saved.updated_at;
end
$function$;

-- Replace the signature rather than retaining an unproved one-argument
-- overload. Missing proof fails closed; only the existing service role may call.
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
  if p_seo_proof is null
     or jsonb_typeof(p_seo_proof->'expected_source') is distinct from 'object'
     or jsonb_typeof(p_seo_proof->'expected_result') is distinct from 'object'
     or jsonb_typeof(v_score) is distinct from 'object'
     or nullif(p_seo_proof->>'expected_updated_at', '') is null then
    raise exception using errcode = '22023', message = 'PROJECT_DUPLICATE_SEO_PROOF_REQUIRED';
  end if;

  select project.* into v_source
  from public.projects project
  where project.id = p_project_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  if v_source.updated_at is distinct from (p_seo_proof->>'expected_updated_at')::timestamptz
     or public.entity_seo_score_source('projects', to_jsonb(v_source))
        is distinct from public.entity_seo_score_source('projects', p_seo_proof->'expected_source') then
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

  if public.entity_seo_score_source('projects', v_result)
     is distinct from public.entity_seo_score_source('projects', p_seo_proof->'expected_result') then
    -- Includes concurrent slug allocation: throwing here rolls back the root
    -- and every child, so the action may safely obtain a fresh bounded proof.
    raise exception using errcode = 'VSE01', message = 'PROJECT_DUPLICATE_SEO_RESULT_CONFLICT';
  end if;

  update public.projects project set
    seo_score = (v_score->>'seo_score')::integer,
    seo_score_version = (v_score->>'seo_score_version')::integer,
    seo_score_input_hash = v_score->>'seo_score_input_hash'
  where project.id = v_copy.project_id;

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
-- backfill owns existing rows. Rollback policy: forward-fix writer and schema
-- together; never restore a writer that bypasses the persisted-score contract.
