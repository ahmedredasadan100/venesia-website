-- Schema only. Data is derived by scripts/backfill-entity-seo-scores.mts using
-- the existing TypeScript analyzeEntitySeo owner. No SQL scoring algorithm.
begin;

alter table public.topics
  add column seo_score smallint,
  add column seo_score_version integer,
  add column seo_score_input_hash text,
  add constraint topics_seo_score_derived_tuple check (
    (seo_score is null and seo_score_version is null and seo_score_input_hash is null)
    or (seo_score is not null and seo_score between 0 and 100
      and seo_score_version is not null and seo_score_version > 0
      and seo_score_input_hash is not null and seo_score_input_hash ~ '^[a-f0-9]{64}$')
  );

alter table public.projects
  add column seo_score smallint,
  add column seo_score_version integer,
  add column seo_score_input_hash text,
  add constraint projects_seo_score_derived_tuple check (
    (seo_score is null and seo_score_version is null and seo_score_input_hash is null)
    or (seo_score is not null and seo_score between 0 and 100
      and seo_score_version is not null and seo_score_version > 0
      and seo_score_input_hash is not null and seo_score_input_hash ~ '^[a-f0-9]{64}$')
  );

-- Thin source projection used only to verify write consistency. It mirrors
-- the shared editor's resolved inputs, never SEO rules, weights or scoring.
create function public.entity_seo_score_source(p_entity text, p_row jsonb)
returns jsonb language plpgsql immutable strict security invoker
set search_path = public, pg_temp
as $function$
declare
  v_fields text[];
  v_result jsonb := '{}'::jsonb;
  v_field text;
  v_value jsonb;
  -- Match JavaScript cleanText/trim exactly, independent of database locale.
  v_js_whitespace constant text := U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]';
begin
  if p_entity = 'topics' then
    v_fields := array['content_type','title','excerpt','slug','content','image','image_alt',
      'og_image','og_image_alt','seo_title','seo_description','seo_keywords','focus_keyword','faq'];
  elsif p_entity = 'projects' then
    v_fields := array['arabic_name','general_description','overview_body','slug','hero_image',
      'hero_image_alt','og_image','og_image_alt','seo_title','seo_description','seo_keywords','focus_keyword'];
  else
    raise exception 'Unsupported persisted Entity SEO adopter: %', p_entity;
  end if;
  foreach v_field in array v_fields loop
    if v_field = 'seo_keywords' then
      v_value := coalesce(nullif(p_row -> v_field, 'null'::jsonb), '[]'::jsonb);
    elsif v_field = 'faq' then
      if p_row ->> 'content_type' = 'article' then
        select coalesce(jsonb_agg(jsonb_build_object('question', item -> 'question', 'answer', item -> 'answer') order by ordinal), '[]'::jsonb)
          into v_value
        from jsonb_array_elements(coalesce(nullif(p_row -> v_field, 'null'::jsonb), '[]'::jsonb))
          with ordinality as faq(item, ordinal);
      else
        -- Media editors declare no FAQ input for the entity score profile.
        v_value := '[]'::jsonb;
      end if;
    elsif v_field = 'content_type' then
      v_value := to_jsonb(case when p_row ->> v_field = 'article' then 'article' else 'entity' end);
    elsif p_entity = 'topics' and v_field = 'content' and p_row ->> 'content_type' in ('video', 'gallery') then
      -- Existing ContentEditorAdapter bodies and media saves use no text body.
      v_value := '""'::jsonb;
    elsif v_field = 'seo_title' then
      -- Shared resolveEntitySeoScoreInput composeSeoTitle(preferred, base, '').
      v_value := to_jsonb(coalesce(
        nullif(btrim(regexp_replace(coalesce(p_row ->> v_field, ''), v_js_whitespace || '+', ' ', 'g')), ''),
        btrim(regexp_replace(coalesce(p_row ->> case when p_entity = 'topics' then 'title' else 'arabic_name' end, ''), v_js_whitespace || '+', ' ', 'g'))
      ));
    elsif v_field = 'seo_description' then
      -- Description trims edges only; internal whitespace remains an input.
      v_value := to_jsonb(coalesce(
        nullif(regexp_replace(coalesce(p_row ->> v_field, ''), '^' || v_js_whitespace || '+|' || v_js_whitespace || '+$', '', 'g'), ''),
        regexp_replace(coalesce(p_row ->> case when p_entity = 'topics' then 'excerpt' else 'general_description' end, ''), '^' || v_js_whitespace || '+|' || v_js_whitespace || '+$', '', 'g')
      ));
    elsif v_field in ('image', 'image_alt', 'hero_image', 'hero_image_alt') then
      v_value := to_jsonb(regexp_replace(coalesce(p_row ->> v_field, ''), '^' || v_js_whitespace || '+|' || v_js_whitespace || '+$', '', 'g'));
    else
      v_value := to_jsonb(coalesce(p_row ->> v_field, ''));
    end if;
    v_result := v_result || jsonb_build_object(v_field, v_value);
  end loop;
  return v_result;
end;
$function$;
revoke all on function public.entity_seo_score_source(text, jsonb) from public, anon, authenticated;
grant execute on function public.entity_seo_score_source(text, jsonb) to service_role;

-- Provenance encoding only. Scores are still calculated exclusively in TS.
-- Length framing is identical in entitySeoInputHash, including UTF-8 byte
-- lengths, array counts and ordering; JSON printer differences cannot drift.
create function public.entity_seo_score_input_hash(p_entity text, p_row jsonb)
returns text language plpgsql immutable strict security invoker
set search_path = public, pg_temp
as $function$
declare
  v_source jsonb := public.entity_seo_score_source(p_entity, p_row);
  v_values text[];
  v_keys text[];
  v_key text;
  v_value text;
  v_item jsonb;
  v_frame text := '';
begin
  if p_entity = 'topics' then
    v_values := array[case when v_source ->> 'content_type' = 'article' then 'article' else 'entity' end];
    v_keys := array['title','excerpt','slug','content','image','image_alt'];
  else
    v_values := array['entity'];
    v_keys := array['arabic_name','general_description','slug','overview_body','hero_image','hero_image_alt'];
  end if;
  foreach v_key in array (v_keys || array['og_image','og_image_alt','seo_title','seo_description']) loop
    v_values := array_append(v_values, v_source ->> v_key);
  end loop;
  v_values := array_append(v_values, jsonb_array_length(v_source -> 'seo_keywords')::text);
  for v_item in select value from jsonb_array_elements(v_source -> 'seo_keywords') loop
    if jsonb_typeof(v_item) <> 'string' then raise exception 'Invalid Entity SEO keyword input.'; end if;
    v_values := array_append(v_values, v_item #>> '{}');
  end loop;
  v_values := array_append(v_values, v_source ->> 'focus_keyword');
  v_values := array_append(v_values, case when p_entity = 'topics' then jsonb_array_length(v_source -> 'faq') else 0 end::text);
  if p_entity = 'topics' then
    for v_item in select value from jsonb_array_elements(v_source -> 'faq') loop
      if jsonb_typeof(v_item -> 'question') is distinct from 'string'
        or jsonb_typeof(v_item -> 'answer') is distinct from 'string' then
        raise exception 'Invalid Entity SEO FAQ input.';
      end if;
      v_values := v_values || array[v_item ->> 'question', v_item ->> 'answer'];
    end loop;
  end if;
  foreach v_value in array v_values loop
    v_frame := v_frame || octet_length(convert_to(v_value, 'UTF8'))::text || ':' || v_value;
  end loop;
  return encode(sha256(convert_to(v_frame, 'UTF8')), 'hex');
end;
$function$;
revoke all on function public.entity_seo_score_input_hash(text, jsonb) from public, anon, authenticated;
grant execute on function public.entity_seo_score_input_hash(text, jsonb) to service_role;

-- Deferred so existing aggregate/duplicate RPCs can attach a trusted derived
-- tuple after their insert but before commit. Unknown SEO writers fail closed.
create function public.check_entity_seo_score_write()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $function$
declare
  v_final jsonb;
  v_old_source jsonb;
  v_final_source jsonb;
begin
  execute format('select to_jsonb(entity) from public.%I entity where id = $1', TG_TABLE_NAME)
    into v_final using NEW.id;
  if v_final is null then return null; end if;
  if TG_OP = 'UPDATE' then
    begin
      v_old_source := public.entity_seo_score_source(TG_TABLE_NAME, to_jsonb(OLD));
    exception when invalid_parameter_value then
      -- Legacy non-array JSON must remain repairable. NEW is still projected
      -- strictly below and must carry a changed, valid final-input fingerprint.
      v_old_source := null;
    end;
    v_final_source := public.entity_seo_score_source(TG_TABLE_NAME, v_final);
    -- A non-SEO edit of a pre-backfill row is allowed. Stale provenance remains
    -- detectable; it never causes read-time analysis.
    if v_old_source = v_final_source
      and (v_final -> 'seo_score') is not distinct from (to_jsonb(OLD) -> 'seo_score')
      and (v_final -> 'seo_score_version') is not distinct from (to_jsonb(OLD) -> 'seo_score_version')
      and (v_final -> 'seo_score_input_hash') is not distinct from (to_jsonb(OLD) -> 'seo_score_input_hash')
    then return null; end if;
    if v_old_source is distinct from v_final_source
      and v_final ->> 'seo_score_input_hash' is not distinct from OLD.seo_score_input_hash
    then
      raise exception using errcode = '23514', message = 'SEO input changed without a new derived score proof.';
    end if;
  end if;
  if v_final ->> 'seo_score' is null or v_final ->> 'seo_score_version' is null
    or v_final ->> 'seo_score_input_hash' is null then
    raise exception using errcode = '23514', message = 'Entity SEO derived score is required before commit.';
  end if;
  if v_final ->> 'seo_score_input_hash' is distinct from
    public.entity_seo_score_input_hash(TG_TABLE_NAME, v_final) then
    raise exception using errcode = '23514', message = 'Entity SEO derived score proof does not match the final inputs.';
  end if;
  return null;
end;
$function$;
revoke all on function public.check_entity_seo_score_write() from public, anon, authenticated;
grant execute on function public.check_entity_seo_score_write() to service_role;

create constraint trigger topics_entity_seo_score_write
after insert or update of content_type,title,excerpt,slug,content,image,image_alt,og_image,
  og_image_alt,seo_title,seo_description,seo_keywords,focus_keyword,faq,
  seo_score,seo_score_version,seo_score_input_hash on public.topics
deferrable initially deferred for each row execute function public.check_entity_seo_score_write();

create constraint trigger projects_entity_seo_score_write
after insert or update of arabic_name,general_description,overview_body,slug,hero_image,
  hero_image_alt,og_image,og_image_alt,seo_title,seo_description,seo_keywords,focus_keyword,
  seo_score,seo_score_version,seo_score_input_hash on public.projects
deferrable initially deferred for each row execute function public.check_entity_seo_score_write();

-- Extend the existing canonical view in its established column order. Retain
-- its taxonomy/audit joins, owner and ACLs; read the tuple from the same Topics
-- alias so count and paginated reads do not require a redundant self-join.
create or replace view public.admin_content_topics
with (security_invoker = true)
as
select
  topics.id,
  topics.slug,
  topics.title,
  topics.excerpt,
  topics.content,
  topics.image,
  topics.image_alt,
  topics.category_id,
  categories.name as category_name,
  categories.slug as category_slug,
  categories.color_token as category_color_token,
  topics.series_id,
  series.name as series_name,
  series.slug as series_slug,
  topics.content_type,
  topics.media_payload,
  topics.status,
  topics.is_featured,
  topics.is_popular,
  topics.published_at,
  topics.created_at,
  topics.updated_at,
  topics.created_by,
  coalesce(creator.full_name, creator.email) as created_by_display,
  topics.updated_by,
  coalesce(updater.full_name, updater.email) as updated_by_display,
  topics.published_by,
  coalesce(publisher.full_name, publisher.email) as published_by_display,
  topics.views_count,
  topics.deleted_at,
  topics.seo_title,
  topics.seo_description,
  topics.seo_keywords,
  topics.focus_keyword,
  topics.canonical_url,
  topics.robots_index,
  topics.robots_follow,
  topics.og_image,
  topics.og_image_alt,
  topics.faq,
  topics.date_label,
  topics.show_title_on_page,
  topics.show_image_on_page,
  topics.show_excerpt_on_page,
  topics.seo_score,
  topics.seo_score_version,
  topics.seo_score_input_hash
from public.topics topics
left join public.topic_categories categories on categories.id = topics.category_id
left join public.topic_series series on series.id = topics.series_id
left join public.admin_users creator on creator.id = topics.created_by
left join public.admin_users updater on updater.id = topics.updated_by
left join public.admin_users publisher on publisher.id = topics.published_by;

create index topics_seo_score_order_idx on public.topics (seo_score, id);

create function public.admin_content_topic_metrics(p_seo_score_version integer)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'total', count(*) filter (where deleted_at is null),
    'trashed', count(*) filter (where deleted_at is not null),
    'published', count(*) filter (where deleted_at is null and status = 'published'),
    'unpublished', count(*) filter (where deleted_at is null and status = 'unpublished'),
    'withoutImage', count(*) filter (where deleted_at is null and (image is null or image = '')),
    'withSeries', count(*) filter (where deleted_at is null and series_id is not null),
    'featured', count(*) filter (where deleted_at is null and is_featured is true),
    'seoAverage', coalesce(round(avg(seo_score) filter (where deleted_at is null)), 0),
    'staleScores', count(*) filter (where seo_score is null or seo_score_version is distinct from p_seo_score_version)
  ) from public.topics;
$function$;
revoke all on function public.admin_content_topic_metrics(integer) from public, anon, authenticated;
grant execute on function public.admin_content_topic_metrics(integer) to service_role;

comment on column public.topics.seo_score is 'Derived by analyzeEntitySeo. Original SEO inputs are authoritative; missing/stale versions require controlled TypeScript backfill.';
comment on column public.projects.seo_score is 'Derived by analyzeEntitySeo. Original SEO inputs are authoritative; missing/stale versions require controlled TypeScript backfill.';

notify pgrst, 'reload schema';
commit;
