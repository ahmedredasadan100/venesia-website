-- Shared Corrections & Adoption: FSTA-01/02. Additive operations on existing RPC owners.
-- No new function signatures, table grants, historical replay or data backfill.
-- Existing SQL assignment/delete audit policy remains intact; CMS audit remains
-- best-effort. Install DB first; new code refuses missing operations without a
-- legacy multi-commit fallback. Old calls remain compatible.
begin;
do $preflight$
begin
  if not exists(select 1 from pg_proc where oid='public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure
    and pg_get_functiondef(oid) like '%page_featured_module_assignments%'
    and pg_get_functiondef(oid) like '%delete from public.hero_assignments%') then
    raise exception 'Atomic completion requires current Featured and page-delete Hero dependencies';
  end if;
end;
$preflight$;
do $migration$
declare
  v_definition text;
  v_before text;
  v_patch record;
  v_acl aclitem[];
begin
  select pg_get_functiondef(oid),proacl into v_definition,v_acl from pg_proc where oid='public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure;
  v_definition := replace(v_definition,E'\r\n',E'\n');
  for v_patch in select * from (values
    ($old0$  v_result jsonb := '{}'::jsonb;
begin$old0$, $new0$  v_result jsonb := '{}'::jsonb;
  v_saved_template jsonb;
  v_template_columns text[];
  v_update_columns text;
  v_deleted_pages jsonb := '[]'::jsonb;
  v_blocked_ids bigint[] := '{}'::bigint[];
  v_protected_path text;
  -- ECMAScript String.trim whitespace: parity with the existing Page policy.
  v_identity_trim text := (select string_agg(chr(code),'') from unnest(array[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279]) code);
begin
  -- Acquired before row locks. Multi-page operations exclude legacy single-page
  -- operations; unrelated single-page operations retain shared admission.
  if p_operation in ('save_template', 'sync_template_pages', 'delete_pages') then
    perform pg_advisory_xact_lock(hashtext('public.page_composition:aggregate'));
  else
    perform pg_advisory_xact_lock_shared(hashtext('public.page_composition:aggregate'));
  end if;
  if p_operation in ('save_template', 'delete_pages') then
    v_now := clock_timestamp();
    if jsonb_typeof(p_payload) is distinct from 'object' then
      raise exception using errcode='22023', message='page_composition_payload_invalid';
    end if;
    -- The authenticated Server Action resolves this actor; only service_role
    -- retains EXECUTE. No client actor, new role grant or auth policy is added.
    if not exists (select 1 from public.admin_users where id=p_actor_admin_user_id
      and username=p_actor_username and is_active) then
      raise exception using errcode='42501', message='page_composition_actor_invalid';
    end if;
  end if;
  if p_operation = 'delete_pages' then
    if jsonb_typeof(p_payload->'page_ids') is distinct from 'array'
       or jsonb_array_length(p_payload->'page_ids') = 0 then
      raise exception using errcode='22023', message='page_ids_required';
    end if;
    select array_agg(distinct value::bigint order by value::bigint) into v_page_ids
      from jsonb_array_elements_text(p_payload->'page_ids');
    if cardinality(v_page_ids) <> jsonb_array_length(p_payload->'page_ids')
       or exists(select 1 from unnest(v_page_ids) id where id is null or id <= 0) then
      raise exception using errcode='22023', message='page_ids_invalid';
    end if;
    foreach v_new_page_id in array v_page_ids loop
      perform pg_advisory_xact_lock(hashtext('public.page_composition:' || v_new_page_id::text));
      perform 1 from public.pages where id=v_new_page_id for update;
    end loop;
    -- The existing Home/Projects exclusions are evaluated on locked identity.
    for v_row in select id,slug,path,title from public.pages where id=any(v_page_ids) order by id loop
      v_protected_path := btrim(v_row.path,v_identity_trim);
      if v_protected_path <> '' then v_protected_path := '/' || trim(both '/' from v_protected_path); end if;
      if lower(btrim(v_row.slug,v_identity_trim)) in ('home','projects')
         or v_protected_path in ('/','/projects') then
        v_blocked_ids := array_append(v_blocked_ids,v_row.id);
      else
        -- Reuses the existing delete audit and page-target Hero cleanup.
        perform public.mutate_page_composition(v_row.id,'delete_page','{}',p_actor_admin_user_id,p_actor_username);
        v_deleted_pages := v_deleted_pages || jsonb_build_array(to_jsonb(v_row));
      end if;
    end loop;
    return jsonb_build_object('deleted_pages',v_deleted_pages,'blocked_ids',v_blocked_ids,'updated_at',v_now);
  end if;$new0$),
    ($old1$  if p_page_id is null or p_page_id <= 0 then$old1$, $new1$  if p_operation <> 'save_template' and (p_page_id is null or p_page_id <= 0) then$new1$),
    ($old2$  perform pg_advisory_xact_lock(hashtext('public.page_composition:' || p_page_id::text));$old2$, $new2$  if p_operation <> 'save_template' then
  perform pg_advisory_xact_lock(hashtext('public.page_composition:' || p_page_id::text));$new2$),
    ($old3$  create temporary table if not exists page_composition_order_plan ($old3$, $new3$  end if;
  perform set_config('app.page_composition_write', 'on', true);

  create temporary table if not exists page_composition_order_plan ($new3$),
    ($old4$  elsif p_operation = 'sync_template_pages' then$old4$, $new4$  elsif p_operation in ('sync_template_pages','save_template') then$new4$),
    ($old5$    v_template_id := nullif(p_payload->>'template_id', '')::bigint;
    v_slot := nullif(btrim(p_payload->>'default_slot'), '');$old5$, $new5$    v_template_id := nullif(p_payload->>'template_id', '')::bigint;
    if p_operation = 'save_template' then
      v_template_table := case v_kind
        when 'content' then 'content_block_templates'
        when 'cta' then 'cta_block_templates'
        when 'cards' then 'cards_block_templates'
        when 'breadcrumb' then 'breadcrumb_block_templates'
        when 'feed' then 'feed_module_templates'
        when 'featured' then 'featured_module_templates'
        when 'media_sidebar' then 'media_sidebar_module_templates'
        when 'media_hub' then 'media_hub_module_templates' end;
      v_change := p_payload->'template';
      if v_template_table is null or v_template_id is null or v_template_id <= 0
        or jsonb_typeof(v_change) is distinct from 'object'
        or nullif(btrim(v_change->>'name'),'') is null
        or jsonb_typeof(v_change->'config') is distinct from 'object'
        or coalesce(v_change->>'status','') not in ('published','unpublished') then
        raise exception using errcode='22023',message='template_save_payload_invalid';
      end if;
      v_template_columns := array['name','description','status','config','updated_at'] ||
        case when v_kind in ('content','cta','cards','breadcrumb') then array['slug','variant','style_preset']
          when v_kind='feed' then array['slug','feed_type']
          when v_kind='featured' then array['slug']
          when v_kind='media_sidebar' then array['widget_key']
          else array['section_key'] end;
      if exists(select 1 from jsonb_object_keys(v_change) key where not(key=any(v_template_columns))) then
        raise exception using errcode='22023',message='template_save_field_forbidden';
      end if;
      execute format('select to_jsonb(t) from public.%I t where id=$1 for update',v_template_table)
        into v_source using v_template_id;
      if v_source is null then raise exception using errcode='P0002',message='assignment_template_not_found'; end if;
      v_change := v_source || v_change || jsonb_build_object('updated_at',v_now);
      if v_change ? 'slug' and nullif(btrim(v_change->>'slug'),'') is null then
        raise exception using errcode='22023',message='template_slug_required';
      end if;
    end if;
    v_slot := nullif(btrim(p_payload->>'default_slot'), '');$new5$),
    ($old6$    if cardinality(v_affected_page_ids) = 0 or p_page_id <> v_affected_page_ids[1] then$old6$, $new6$    if p_operation = 'sync_template_pages' and (cardinality(v_affected_page_ids) = 0 or p_page_id <> v_affected_page_ids[1]) then$new6$),
    ($old7$    execute format('delete from public.%I where template_id=$1 and not (page_id=any($2))', v_table)$old7$, $new7$    if p_operation = 'save_template' then
      select string_agg(format('%I = saved.%I',col,col),', ' order by ordinal)
        into v_update_columns from unnest(v_template_columns) with ordinality columns(col,ordinal);
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) saved where t.id=$2 returning to_jsonb(t)',
        v_template_table,v_update_columns,v_template_table) into v_saved_template using v_change,v_template_id;
      -- Read the persisted config inside the same transaction, including any
      -- trigger normalization; a mismatch cannot become a committed failure.
      execute format('select to_jsonb(t) from public.%I t where id=$1',v_template_table)
        into v_saved_template using v_template_id;
      if v_saved_template->'config' is distinct from p_payload->'template'->'config' then
        raise exception using errcode='23514',message='template_saved_config_mismatch';
      end if;
    end if;
    execute format('delete from public.%I where template_id=$1 and not (page_id=any($2))', v_table)$new7$),
    ($old8$  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values ($old8$, $new8$  if p_operation <> 'save_template' or cardinality(v_affected_page_ids) > 0 then
  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values ($new8$),
    ($old9$    'page_composition.' || p_operation, 'page_composition', coalesce(v_new_page_id,p_page_id), null,$old9$, $new9$    'page_composition.' || case when p_operation='save_template' then 'sync_template_pages' else p_operation end,
    'page_composition', coalesce(v_new_page_id,p_page_id,v_affected_page_ids[1]), null,$new9$),
    ($old10$  return v_result || jsonb_build_object('updated_at',v_now);$old10$, $new10$  end if;
  return v_result || jsonb_build_object('updated_at',v_now) ||
    case when p_operation='save_template' then jsonb_build_object('template',v_saved_template) else '{}'::jsonb end;$new10$)
  ) patches(old_text,new_text) loop
    if (length(v_definition)-length(replace(v_definition,v_patch.old_text,'')))/length(v_patch.old_text) <> 1 then
      raise exception 'mutate_page_composition atomic extension refused: owner marker missing or ambiguous: %',left(v_patch.old_text,100);
    end if;
    v_before := v_definition;
    v_definition := replace(v_definition,v_patch.old_text,v_patch.new_text);
    if v_before=v_definition then raise exception 'Atomic owner extension did not change expected marker'; end if;
  end loop;
  execute v_definition;
  if (select proacl from pg_proc where oid='public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure) is distinct from v_acl then
    raise exception 'Atomic owner ACL changed';
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_before text;
  v_patch record;
  v_acl aclitem[];
begin
  select pg_get_functiondef(oid),proacl into v_definition,v_acl from pg_proc where oid='public.mutate_menu_tree(bigint,text,jsonb,bigint,text)'::regprocedure;
  v_definition := replace(v_definition,E'\r\n',E'\n');
  for v_patch in select * from (values
    ($old0$  v_result jsonb := '{}'::jsonb;
begin$old0$, $new0$  v_result jsonb := '{}'::jsonb;
  v_menu_ids bigint[];
  v_deleted_menu_ids bigint[] := '{}'::bigint[];
  v_deleted_item_ids bigint[];
  v_menu_id bigint;
begin
  if p_operation = 'delete_menus' then
    if jsonb_typeof(p_payload) is distinct from 'object'
       or jsonb_typeof(p_payload->'menu_ids') is distinct from 'array'
       or jsonb_array_length(p_payload->'menu_ids') = 0 then
      raise exception using errcode='22023',message='menu_ids_required';
    end if;
    if not exists(select 1 from public.admin_users where id=p_actor_admin_user_id
      and username=p_actor_username and is_active) then
      raise exception using errcode='42501',message='menu_actor_invalid';
    end if;
    select array_agg(distinct value::bigint order by value::bigint) into v_menu_ids
      from jsonb_array_elements_text(p_payload->'menu_ids');
    if cardinality(v_menu_ids) <> jsonb_array_length(p_payload->'menu_ids')
       or exists(select 1 from unnest(v_menu_ids) id where id is null or id <= 0) then
      raise exception using errcode='22023',message='menu_ids_invalid';
    end if;
    -- Same lock keys as the legacy single-menu owner, acquired in sorted order.
    foreach v_menu_id in array v_menu_ids loop
      perform pg_advisory_xact_lock(hashtext('public.menu_tree:' || v_menu_id::text));
      perform 1 from public.menus where id=v_menu_id for update;
      if not found then raise exception using errcode='P0002',message='menu_not_found'; end if;
    end loop;
    perform 1 from public.menu_items where menu_id=any(v_menu_ids) order by menu_id,id for update;
    select coalesce(array_agg(id order by id),'{}'::bigint[]) into v_deleted_item_ids
      from public.menu_items where menu_id=any(v_menu_ids);
    foreach v_menu_id in array v_menu_ids loop
      perform public.mutate_menu_tree(v_menu_id,'delete_menu','{}',p_actor_admin_user_id,p_actor_username);
      v_deleted_menu_ids := array_append(v_deleted_menu_ids,v_menu_id);
    end loop;
    return jsonb_build_object('deleted_menu_ids',v_deleted_menu_ids,'deleted_item_ids',v_deleted_item_ids,'updated_at',v_now);
  end if;$new0$)
  ) patches(old_text,new_text) loop
    if (length(v_definition)-length(replace(v_definition,v_patch.old_text,'')))/length(v_patch.old_text) <> 1 then
      raise exception 'mutate_menu_tree atomic extension refused: owner marker missing or ambiguous: %',left(v_patch.old_text,100);
    end if;
    v_before := v_definition;
    v_definition := replace(v_definition,v_patch.old_text,v_patch.new_text);
    if v_before=v_definition then raise exception 'Atomic owner extension did not change expected marker'; end if;
  end loop;
  execute v_definition;
  if (select proacl from pg_proc where oid='public.mutate_menu_tree(bigint,text,jsonb,bigint,text)'::regprocedure) is distinct from v_acl then
    raise exception 'Atomic owner ACL changed';
  end if;
end;
$migration$;

select pg_catalog.pg_notify('pgrst','reload schema');
commit;
