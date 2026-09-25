-- Extend the existing Page Composition mutation owner with atomic Layout
-- administration, and adopt Pages into the existing Entity SEO persisted-score
-- tuple. This migration contains no SEO calculator and creates no parallel
-- Composition writer or semantic-content store.
begin;

do $preflight$
begin
  if to_regprocedure('public.mutate_page_composition(bigint,text,jsonb,bigint,text)') is null
     or to_regclass('public.page_composition_layouts') is null
     or to_regclass('public.page_composition_regions') is null then
    raise exception 'F03/F07 requires the current Page Composition owner and Layout contract';
  end if;
  if to_regprocedure('public.admin_list_pages(integer,integer,text,text,text)') is null then
    raise exception 'F07 requires the current Admin Pages read owner';
  end if;
end;
$preflight$;

-- Full-snapshot Region saves need order swaps to be checked at transaction end.
alter table public.page_composition_regions drop constraint page_composition_regions_order_unique;
alter table public.page_composition_regions add constraint page_composition_regions_order_unique
  unique (layout_id, sort_order) deferrable initially immediate;

alter table public.pages
  add column if not exists seo_score smallint,
  add column if not exists seo_score_version integer,
  add column if not exists seo_score_input_hash text;
alter table public.pages drop constraint if exists pages_entity_seo_score_tuple_check;
alter table public.pages add constraint pages_entity_seo_score_tuple_check check (
  num_nonnulls(seo_score, seo_score_version, seo_score_input_hash) in (0, 3)
  and (seo_score is null or seo_score between 0 and 100)
  and (seo_score_version is null or seo_score_version > 0)
  and (seo_score_input_hash is null or seo_score_input_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists pages_seo_score_order_idx on public.pages (seo_score, id);

comment on column public.pages.seo_score is
  'Derived Entity SEO score. Page fields and visible published Page Composition configs remain authoritative.';
comment on column public.pages.seo_score_version is
  'Version of the shared application SEO algorithm used for seo_score.';
comment on column public.pages.seo_score_input_hash is
  'SHA-256 fingerprint of the canonical resolved Page SEO input.';

create or replace function public.invalidate_page_seo_score_write()
returns trigger language plpgsql set search_path = '' as $function$
declare v_source_changed boolean; v_tuple_changed boolean;
begin
  v_source_changed := row(
    new.title, new.slug, new.path, new.layout_id, new.seo_title, new.seo_description,
    new.seo_keywords, new.focus_keyword, new.og_image, new.og_image_alt
  ) is distinct from row(
    old.title, old.slug, old.path, old.layout_id, old.seo_title, old.seo_description,
    old.seo_keywords, old.focus_keyword, old.og_image, old.og_image_alt
  );
  v_tuple_changed := row(new.seo_score, new.seo_score_version, new.seo_score_input_hash)
    is distinct from row(old.seo_score, old.seo_score_version, old.seo_score_input_hash);
  if v_source_changed and not v_tuple_changed then
    new.seo_score := null; new.seo_score_version := null; new.seo_score_input_hash := null;
  end if;
  return new;
end;
$function$;
revoke all on function public.invalidate_page_seo_score_write() from public, anon, authenticated;
grant execute on function public.invalidate_page_seo_score_write() to service_role;
drop trigger if exists pages_entity_seo_score_transition on public.pages;
create trigger pages_entity_seo_score_transition
before update of title, slug, path, layout_id, seo_title, seo_description, seo_keywords,
  focus_keyword, og_image, og_image_alt, seo_score, seo_score_version,
  seo_score_input_hash on public.pages
for each row execute function public.invalidate_page_seo_score_write();

-- Composition changes invalidate the Page tuple, but never calculate it.
create or replace function public.invalidate_page_seo_score_from_assignment()
returns trigger language plpgsql set search_path = '' as $function$
declare v_old_page_id bigint; v_new_page_id bigint;
begin
  if tg_table_name = 'hero_assignments' then
    if tg_op <> 'INSERT' and old.target_type = 'page' then v_old_page_id := old.target_id; end if;
    if tg_op <> 'DELETE' and new.target_type = 'page' then v_new_page_id := new.target_id; end if;
  else
    if tg_op <> 'INSERT' then v_old_page_id := old.page_id; end if;
    if tg_op <> 'DELETE' then v_new_page_id := new.page_id; end if;
  end if;
  update public.pages set seo_score=null,seo_score_version=null,seo_score_input_hash=null
  where id in (v_old_page_id,v_new_page_id)
    and num_nonnulls(seo_score,seo_score_version,seo_score_input_hash)>0;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function public.invalidate_page_seo_score_from_template()
returns trigger language plpgsql set search_path = '' as $function$
declare v_assignment_table text;
begin
  if tg_table_name = 'hero_templates' then
    update public.pages set seo_score=null,seo_score_version=null,seo_score_input_hash=null
    where id in (select a.target_id from public.hero_assignments a
      where a.hero_id=new.id and a.target_type='page')
      and num_nonnulls(seo_score,seo_score_version,seo_score_input_hash)>0;
    return new;
  end if;
  v_assignment_table := case tg_table_name
    when 'content_block_templates' then 'page_content_block_assignments'
    when 'cta_block_templates' then 'page_cta_block_assignments'
    when 'cards_block_templates' then 'page_cards_block_assignments'
    when 'breadcrumb_block_templates' then 'page_breadcrumb_block_assignments'
    when 'feed_module_templates' then 'page_feed_module_assignments'
    when 'featured_module_templates' then 'page_featured_module_assignments'
    when 'media_sidebar_module_templates' then 'page_media_sidebar_module_assignments'
    when 'media_hub_module_templates' then 'page_media_hub_module_assignments'
    else null end;
  if v_assignment_table is null then
    raise exception using errcode='22023',message='page_seo_template_owner_unknown';
  end if;
  execute format('update public.pages set seo_score=null,seo_score_version=null,seo_score_input_hash=null
    where id in (select page_id from public.%I where template_id=$1)
      and num_nonnulls(seo_score,seo_score_version,seo_score_input_hash)>0',v_assignment_table)
  using new.id;
  return new;
end;
$function$;
create or replace function public.invalidate_page_seo_score_from_region()
returns trigger language plpgsql set search_path = '' as $function$
declare v_old_layout_id bigint; v_new_layout_id bigint;
begin
  if tg_op <> 'INSERT' then v_old_layout_id := old.layout_id; end if;
  if tg_op <> 'DELETE' then v_new_layout_id := new.layout_id; end if;
  update public.pages set seo_score=null,seo_score_version=null,seo_score_input_hash=null
  where layout_id in (v_old_layout_id,v_new_layout_id)
    and num_nonnulls(seo_score,seo_score_version,seo_score_input_hash)>0;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.invalidate_page_seo_score_from_assignment() from public,anon,authenticated;
revoke all on function public.invalidate_page_seo_score_from_template() from public,anon,authenticated;
revoke all on function public.invalidate_page_seo_score_from_region() from public,anon,authenticated;
grant execute on function public.invalidate_page_seo_score_from_assignment() to service_role;
grant execute on function public.invalidate_page_seo_score_from_template() to service_role;
grant execute on function public.invalidate_page_seo_score_from_region() to service_role;

drop trigger if exists page_seo_score_invalidation on public.page_composition_regions;
create trigger page_seo_score_invalidation
after insert or update or delete on public.page_composition_regions
for each row execute function public.invalidate_page_seo_score_from_region();

do $install_page_seo_invalidation$
declare v_table text;
begin
  foreach v_table in array array[
    'page_content_block_assignments','page_cta_block_assignments','page_cards_block_assignments',
    'page_breadcrumb_block_assignments','page_feed_module_assignments','page_featured_module_assignments',
    'page_media_sidebar_module_assignments','page_media_hub_module_assignments','hero_assignments'
  ] loop
    execute format('drop trigger if exists page_seo_score_invalidation on public.%I',v_table);
    execute format('create trigger page_seo_score_invalidation after insert or update or delete on public.%I
      for each row execute function public.invalidate_page_seo_score_from_assignment()',v_table);
  end loop;
  foreach v_table in array array[
    'content_block_templates','cta_block_templates','cards_block_templates','breadcrumb_block_templates',
    'feed_module_templates','featured_module_templates','media_sidebar_module_templates','media_hub_module_templates'
  ] loop
    execute format('drop trigger if exists page_seo_score_invalidation on public.%I',v_table);
    execute format('create trigger page_seo_score_invalidation after update of config,status on public.%I
      for each row when (old.config is distinct from new.config or old.status is distinct from new.status)
      execute function public.invalidate_page_seo_score_from_template()',v_table);
  end loop;
  drop trigger if exists page_seo_score_invalidation on public.hero_templates;
  create trigger page_seo_score_invalidation after update of config,status,is_visible on public.hero_templates
  for each row when (old.config is distinct from new.config or old.status is distinct from new.status
    or old.is_visible is distinct from new.is_visible)
  execute function public.invalidate_page_seo_score_from_template();
end;
$install_page_seo_invalidation$;

-- Extend the existing RPC signature; venisia-legacy stays protected.
do $extend_page_composition_owner$
declare v_definition text; v_before text; v_patch record; v_acl aclitem[];
begin
  select pg_get_functiondef(oid),proacl into strict v_definition,v_acl from pg_proc
  where oid='public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure;
  v_definition := replace(v_definition,E'\r\n',E'\n');
  if position('page_layout_key_immutable' in v_definition)>0 then return; end if;
  for v_patch in select * from (values
    ($old0$  v_deleted_pages jsonb := '[]'::jsonb;$old0$,$new0$  v_deleted_pages jsonb := '[]'::jsonb;
  v_layout_id bigint;
  v_layout_key text;
  v_layout_label text;
  v_regions jsonb;
  v_assign_page boolean;$new0$),
    ($old1$  if p_operation in ('save_template', 'sync_template_pages', 'delete_pages') then$old1$,
     $new1$  if p_operation in ('save_template', 'sync_template_pages', 'delete_pages', 'save_layout') then$new1$),
    ($old2$  if p_operation in ('save_template', 'delete_pages') then$old2$,
     $new2$  if p_operation in ('save_template', 'delete_pages', 'save_layout', 'select_layout') then$new2$),
    ($old3$  create temporary table if not exists page_composition_order_plan ($old3$,$new3$  if p_operation = 'select_layout' then
    v_layout_id := nullif(p_payload->>'layout_id','')::bigint;
    if v_layout_id is null or v_layout_id<=0 then
      raise exception using errcode='22023',message='page_layout_id_invalid';
    end if;
    perform 1 from public.page_composition_layouts where id=v_layout_id;
    if not found then raise exception using errcode='P0002',message='page_layout_not_found'; end if;
    update public.pages set layout_id=v_layout_id,updated_at=v_now where id=p_page_id;
    insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
    values(p_actor_admin_user_id,p_actor_username,'page_composition.select_layout','page_composition',p_page_id,null,
      jsonb_build_object('operation',p_operation,'page_id',p_page_id,'layout_id',v_layout_id,
        'persistence_owner','mutate_page_composition','atomic',true));
    return jsonb_build_object('page_id',p_page_id,'layout_id',v_layout_id,'updated_at',v_now);
  elsif p_operation = 'save_layout' then
    v_layout_id := nullif(p_payload->>'layout_id','')::bigint;
    v_layout_key := nullif(btrim(p_payload->>'key'),'');
    v_layout_label := nullif(btrim(p_payload->>'admin_label'),'');
    v_regions := p_payload->'regions';
    v_assign_page := coalesce((p_payload->>'assign_page')::boolean,false);
    if v_layout_key is null or v_layout_key !~ '^[a-z][a-z0-9-]{0,63}$'
      or v_layout_label is null or jsonb_typeof(v_regions) is distinct from 'array'
      or jsonb_array_length(v_regions)<1 or jsonb_array_length(v_regions)>32
      or exists(select 1 from jsonb_array_elements(v_regions) region
        where nullif(btrim(region->>'key'),'') is null or region->>'key' !~ '^[a-z][a-z0-9-]{0,63}$'
          or nullif(btrim(region->>'admin_label'),'') is null
          or nullif(region->>'sort_order','')::integer not between 0 and 1000000)
      or (select count(distinct region->>'key') from jsonb_array_elements(v_regions) region)<>jsonb_array_length(v_regions)
      or (select count(distinct (region->>'sort_order')::integer) from jsonb_array_elements(v_regions) region)<>jsonb_array_length(v_regions) then
      raise exception using errcode='22023',message='page_layout_payload_invalid';
    end if;
    if v_layout_id is null then
      if v_layout_key='venisia-legacy' then raise exception using errcode='23514',message='page_layout_legacy_protected'; end if;
      insert into public.page_composition_layouts(key,admin_label) values(v_layout_key,v_layout_label)
      returning id into v_layout_id;
    else
      select key into v_slot from public.page_composition_layouts where id=v_layout_id for update;
      if v_slot is null then raise exception using errcode='P0002',message='page_layout_not_found'; end if;
      if v_slot='venisia-legacy' then raise exception using errcode='23514',message='page_layout_legacy_protected'; end if;
      if v_slot is distinct from v_layout_key then raise exception using errcode='23514',message='page_layout_key_immutable'; end if;
      update public.page_composition_layouts set admin_label=v_layout_label where id=v_layout_id;
    end if;
    set constraints public.page_composition_regions_order_unique deferred;
    insert into public.page_composition_regions(layout_id,key,admin_label,sort_order)
    select v_layout_id,btrim(region->>'key'),btrim(region->>'admin_label'),(region->>'sort_order')::integer
    from jsonb_array_elements(v_regions) region
    on conflict(layout_id,key) do update set admin_label=excluded.admin_label,sort_order=excluded.sort_order;
    delete from public.page_composition_regions existing where existing.layout_id=v_layout_id
      and not exists(select 1 from jsonb_array_elements(v_regions) region where region->>'key'=existing.key);
    if v_assign_page then update public.pages set layout_id=v_layout_id,updated_at=v_now where id=p_page_id; end if;
    insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
    values(p_actor_admin_user_id,p_actor_username,'page_composition.save_layout','page_composition',p_page_id,v_layout_key,
      jsonb_build_object('operation',p_operation,'page_id',p_page_id,'layout_id',v_layout_id,'assign_page',v_assign_page,
        'persistence_owner','mutate_page_composition','atomic',true));
    return jsonb_build_object('page_id',p_page_id,'layout_id',v_layout_id,'layout_key',v_layout_key,
      'assigned',v_assign_page,'regions',(select jsonb_agg(jsonb_build_object('key',region.key,
        'admin_label',region.admin_label,'sort_order',region.sort_order) order by region.sort_order)
        from public.page_composition_regions region where region.layout_id=v_layout_id),'updated_at',v_now);
  end if;

  create temporary table if not exists page_composition_order_plan ($new3$)
  ) patches(old_text,new_text) loop
    if (length(v_definition)-length(replace(v_definition,v_patch.old_text,'')))/length(v_patch.old_text)<>1 then
      raise exception 'F03 owner extension refused: marker missing or ambiguous: %',left(v_patch.old_text,100);
    end if;
    v_before:=v_definition; v_definition:=replace(v_definition,v_patch.old_text,v_patch.new_text);
    if v_before=v_definition then raise exception 'F03 owner extension did not change marker'; end if;
  end loop;
  execute v_definition;
  if (select proacl from pg_proc where oid='public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure)
    is distinct from v_acl then raise exception 'F03 owner ACL changed'; end if;
end;
$extend_page_composition_owner$;

-- Persisted Page SEO is projected and sorted before pagination; no row analysis.
create or replace function public.admin_list_pages(
  p_page integer default 1,p_page_size integer default 10,p_sort_field text default 'id',
  p_sort_direction text default 'asc',p_search text default ''
) returns jsonb language sql stable security invoker set search_path=public as $$
  with assignment_counts as (
    select page_id,count(*)::bigint block_count from (
      select page_id from public.page_content_block_assignments
      union all select page_id from public.page_cta_block_assignments
      union all select page_id from public.page_cards_block_assignments
      union all select page_id from public.page_breadcrumb_block_assignments
      union all select page_id from public.page_feed_module_assignments
      union all select page_id from public.page_featured_module_assignments
      union all select page_id from public.page_media_sidebar_module_assignments
      union all select page_id from public.page_media_hub_module_assignments
      union all select target_id from public.hero_assignments where target_type='page' and is_active=true
    ) assignments group by page_id
  ), listed as (
    select p.id,p.title,p.slug,p.path,p.page_type,p.status,p.updated_at,p.seo_score,p.seo_score_version,
      p.seo_score_input_hash,coalesce(ac.block_count,0)::bigint block_count
    from public.pages p left join assignment_counts ac on ac.page_id=p.id
    where nullif(btrim(p_search),'') is null
      or strpos(lower(coalesce(p.title,'')),lower(btrim(p_search)))>0
      or strpos(lower(coalesce(p.slug,'')),lower(btrim(p_search)))>0
      or strpos(lower(coalesce(p.path,'')),lower(btrim(p_search)))>0
      or strpos(lower(coalesce(p.page_type,'')),lower(btrim(p_search)))>0
      or strpos(lower(coalesce(p.status,'')),lower(btrim(p_search)))>0
  ), page_state as (
    select count(*)::bigint total_count,greatest(1,least(p_page_size,30)) page_size from listed
  ), normalized_state as (
    select total_count,page_size,least(greatest(p_page,1),greatest(1,ceil(total_count::numeric/page_size)::integer)) page
    from page_state
  ) select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(page_slice)) from (
      select listed.* from listed cross join normalized_state order by
        case when p_sort_field='title' and p_sort_direction='asc' then title end asc,
        case when p_sort_field='title' and p_sort_direction='desc' then title end desc,
        case when p_sort_field='path' and p_sort_direction='asc' then path end asc,
        case when p_sort_field='path' and p_sort_direction='desc' then path end desc,
        case when p_sort_field='slug' and p_sort_direction='asc' then slug end asc,
        case when p_sort_field='slug' and p_sort_direction='desc' then slug end desc,
        case when p_sort_field='moduleCount' and p_sort_direction='asc' then block_count end asc,
        case when p_sort_field='moduleCount' and p_sort_direction='desc' then block_count end desc,
        case when p_sort_field='seo' and p_sort_direction='asc' then seo_score end asc nulls last,
        case when p_sort_field='seo' and p_sort_direction='desc' then seo_score end desc nulls last,
        case when p_sort_field='updatedAt' and p_sort_direction='asc' then updated_at end asc,
        case when p_sort_field='updatedAt' and p_sort_direction='desc' then updated_at end desc,
        case when p_sort_field='status' and p_sort_direction='asc' then status end asc,
        case when p_sort_field='status' and p_sort_direction='desc' then status end desc,id asc
      limit (select page_size from normalized_state)
      offset ((select (page-1)*page_size from normalized_state))
    ) page_slice),'[]'::jsonb),'total_count',(select total_count from normalized_state),
    'page',(select page from normalized_state),'contract_version',3);
$$;
comment on function public.admin_list_pages(integer,integer,text,text,text) is
  'Service-role Admin Pages read model with persisted SEO projection and full-set database sorting before pagination.';
revoke all on function public.admin_list_pages(integer,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_list_pages(integer,integer,text,text,text) to service_role;

notify pgrst,'reload schema';
commit;
