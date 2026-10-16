-- Project Tracking Copy/Move: existing domain, Media functions and audit receipts.
-- Apply only through the approved migration lifecycle. No data backfill.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function public.read_project_tracking_transfer_snapshot(
  p_project_id bigint, p_source_stage_id bigint, p_target_stage_id bigint, p_item_ids bigint[]
) returns jsonb language sql stable security definer
set search_path = pg_catalog, pg_temp as $snapshot$
  with graph as (
    select jsonb_build_object(
      'source', (select to_jsonb(s) from public.project_tracking_stages s where s.id=p_source_stage_id and s.project_id=p_project_id),
      'target', (select to_jsonb(s) from public.project_tracking_stages s where s.id=p_target_stage_id and s.project_id=p_project_id),
      'items', coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('updates',
        coalesce((select jsonb_agg(to_jsonb(u) || jsonb_build_object('media',
          coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order,m.id)
            from public.project_tracking_update_media m where m.update_id=u.id),'[]'::jsonb)) order by u.id)
          from public.project_tracking_updates u where u.item_id=i.id),'[]'::jsonb)) order by i.sort_order,i.id)
        from public.project_tracking_items i where i.stage_id=p_source_stage_id and i.id=any(p_item_ids)), '[]'::jsonb)
    ) as state
  ) select jsonb_build_object('state',state,'revision',md5(state::text)) from graph;
$snapshot$;

create function public.transfer_project_tracking_items(
  p_actor_id bigint, p_command_id uuid, p_operation text,
  p_project_id bigint, p_source_stage_id bigint, p_target_stage_id bigint,
  p_item_ids bigint[], p_expected_revision text, p_media_plan jsonb,
  p_media_context jsonb
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp as $transfer$
declare
  v_ids bigint[];
  v_intent jsonb;
  v_receipt jsonb;
  v_snapshot jsonb;
  v_result jsonb;
  v_targets jsonb;
  v_refs jsonb;
  v_plan jsonb;
  v_item jsonb;
  v_update jsonb;
  v_media jsonb;
  v_lease record;
  v_token uuid;
  v_lease_count integer;
  v_item_id bigint;
  v_update_id bigint;
  v_media_id bigint;
  v_order integer;
  v_changed_ids bigint[] := '{}';
  v_media_ids bigint[];
  v_plan_ids bigint[];
  v_update_count integer := 0;
  v_image_count integer := 0;
  v_alias text;
  v_primary_alias text;
  v_slug text;
begin
  if p_command_id is null or p_operation is null or p_operation not in ('copy','move')
     or p_item_ids is null or cardinality(p_item_ids) not between 1 and 100
     or array_position(p_item_ids,null) is not null
     or exists(select 1 from unnest(p_item_ids) id where id<=0)
     or p_project_id is null or p_source_stage_id is null or p_target_stage_id is null
     or p_source_stage_id=p_target_stage_id or nullif(p_expected_revision,'') is null then
    raise exception using errcode='22023',message='tracking_transfer_invalid_input';
  end if;
  select array_agg(id order by id) into v_ids from (select distinct id from unnest(p_item_ids) id) ids;
  if cardinality(v_ids)<>cardinality(p_item_ids) then
    raise exception using errcode='22023',message='tracking_transfer_duplicate_ids';
  end if;
  perform id from public.admin_users where id=p_actor_id and is_active for key share;
  if not found then raise exception using errcode='42501',message='tracking_transfer_unauthorized'; end if;
  v_intent := jsonb_build_object('domain','project_tracking','action',p_operation,'projectId',p_project_id,
    'sourceStageId',p_source_stage_id,'targetStageId',p_target_stage_id,'ids',v_ids,'revision',p_expected_revision);
  -- Same serialization and immutable receipt owner as existing Admin commands.
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text || ':' || p_command_id::text,0));
  select metadata->'command' into v_receipt from public.admin_audit_logs
    where actor_admin_user_id=p_actor_id and metadata->'command'->>'id'=p_command_id::text;
  if found then
    if v_receipt->'intent' is distinct from v_intent then
      raise exception using errcode='22023',message='command_conflict';
    end if;
    return v_receipt->'result';
  end if;

  if jsonb_typeof(p_media_plan) is distinct from 'array' then
    raise exception using errcode='22023',message='tracking_transfer_media_plan_invalid';
  end if;
  -- Match Media's revision -> asset lock order before any aggregate row locks.
  insert into public.media_reference_provider_revisions(domain_key,revision)
    values('project_tracking_update_media',0) on conflict(domain_key) do nothing;
  perform revision from public.media_reference_provider_revisions
    where domain_key='project_tracking_update_media' for update;
  perform a.id from public.media_assets a where a.id in (
    select (r->>'assetId')::uuid from jsonb_array_elements(p_media_plan) p,
      lateral jsonb_array_elements(p->'references') r
  ) order by a.id for update;
  perform s.id from public.project_tracking_stages s
    where s.id in (p_source_stage_id,p_target_stage_id) order by s.id for update;
  perform i.id from public.project_tracking_items i where i.id=any(v_ids) order by i.id for update;
  perform u.id from public.project_tracking_updates u where u.item_id=any(v_ids) order by u.id for update;
  perform m.id from public.project_tracking_update_media m join public.project_tracking_updates u on u.id=m.update_id
    where u.item_id=any(v_ids) order by m.id for update of m;
  -- Parent locks prevent new child inserts; child locks prevent edits/deletes.
  v_snapshot := public.read_project_tracking_transfer_snapshot(p_project_id,p_source_stage_id,p_target_stage_id,v_ids);
  if v_snapshot->'state'->'source'='null'::jsonb or v_snapshot->'state'->'target'='null'::jsonb
     or jsonb_array_length(v_snapshot->'state'->'items')<>cardinality(v_ids) then
    raise exception using errcode='22023',message='tracking_transfer_scope_changed';
  end if;
  if v_snapshot->>'revision' is distinct from p_expected_revision then
    raise exception using errcode='40001',message='tracking_transfer_revision_conflict';
  end if;
  select coalesce(array_agg((m->>'id')::bigint order by (m->>'id')::bigint),'{}'::bigint[]) into v_media_ids
    from jsonb_array_elements(v_snapshot->'state'->'items') i,
      lateral jsonb_array_elements(i->'updates') u,lateral jsonb_array_elements(u->'media') m;
  select coalesce(array_agg((p->>'sourceId')::bigint order by (p->>'sourceId')::bigint),'{}'::bigint[]) into v_plan_ids
    from jsonb_array_elements(p_media_plan) p;
  if v_media_ids is distinct from v_plan_ids then
    raise exception using errcode='22023',message='tracking_transfer_media_plan_incomplete';
  end if;
  -- The existing provider prepares identities. Verify its exact source values
  -- against the locked aggregate and identities against the locked Catalog.
  for v_plan in select value from jsonb_array_elements(p_media_plan) loop
    if jsonb_typeof(v_plan->'references') is distinct from 'array' then
      raise exception using errcode='22023',message='tracking_transfer_media_plan_invalid';
    end if;
    select to_jsonb(m) into v_media from public.project_tracking_update_media m where m.id=(v_plan->>'sourceId')::bigint;
    if exists(select 1 from jsonb_array_elements(v_plan->'references') r
      left join public.media_assets a on a.id=(r->>'assetId')::uuid
      where r->>'fieldKey' not in ('public_url','poster_url')
        or v_media->>(r->>'fieldKey') is distinct from r->>'publicValue'
        or a.id is null or a.provider is distinct from r->>'provider'
        or a.bucket is distinct from r->>'bucket' or a.object_key is distinct from r->>'objectKey'
        or (p_operation='copy' and (a.status<>'active' or a.missing_object))) then
      raise exception using errcode='P0001',message='tracking_transfer_media_unavailable';
    end if;
  end loop;
  select coalesce(jsonb_agg(distinct jsonb_build_object('provider',r->>'provider','bucket',r->>'bucket','objectKey',r->>'objectKey',
    'domainKey','project_tracking_update_media','entityType','project_tracking_update_media',
    'entityIdentity','tracking-transfer:' || p_command_id::text || ':' || (p->>'sourceId'))),'[]'::jsonb) into v_targets
    from jsonb_array_elements(p_media_plan) p,lateral jsonb_array_elements(p->'references') r
    join public.media_assets a on a.id=(r->>'assetId')::uuid where a.provider='supabase' and a.status<>'deleted';
  if jsonb_array_length(v_targets)>0 then
    select * into strict v_lease from public.acquire_media_reference_write_lease(v_targets,p_actor_id,
      'tracking-transfer:' || p_command_id::text,180,p_media_context->>'provider',p_media_context->>'environment',
      p_media_context->>'identity',p_media_context->>'registryVersion');
    v_token:=v_lease.lease_token; v_lease_count:=v_lease.leased_asset_count;
    v_primary_alias:=v_targets->0->>'entityIdentity';
  end if;
  select coalesce(max(sort_order),-1)+1 into v_order from public.project_tracking_items where stage_id=p_target_stage_id;
  for v_item in select value from jsonb_array_elements(v_snapshot->'state'->'items') loop
    if p_operation='move' then
      v_item_id:=(v_item->>'id')::bigint;
      update public.project_tracking_items set stage_id=p_target_stage_id,sort_order=v_order,updated_by=p_actor_id where id=v_item_id;
    else
      insert into public.project_tracking_items(stage_id,name,description,sort_order,status,start_date,completion_date,is_visible,created_by,updated_by,created_at,updated_at)
        select p_target_stage_id,i.name,i.description,v_order,i.status,i.start_date,i.completion_date,i.is_visible,i.created_by,i.updated_by,i.created_at,i.updated_at
        from public.project_tracking_items i where i.id=(v_item->>'id')::bigint returning id into v_item_id;
    end if;
    v_changed_ids:=array_append(v_changed_ids,v_item_id); v_order:=v_order+1;
    for v_update in select value from jsonb_array_elements(v_item->'updates') loop
      v_update_count:=v_update_count+1;
      if p_operation='move' then v_update_id:=(v_update->>'id')::bigint;
      else
        insert into public.project_tracking_updates(item_id,occurred_at,title,body,publication_status,published_at,published_by,created_by,updated_by,created_at,updated_at)
          select v_item_id,u.occurred_at,u.title,u.body,u.publication_status,u.published_at,u.published_by,u.created_by,u.updated_by,u.created_at,u.updated_at
          from public.project_tracking_updates u where u.id=(v_update->>'id')::bigint returning id into v_update_id;
      end if;
      for v_media in select value from jsonb_array_elements(v_update->'media') loop
        if v_media->>'media_kind'='image' then v_image_count:=v_image_count+1; end if;
        if p_operation='move' then v_media_id:=(v_media->>'id')::bigint;
        else
          insert into public.project_tracking_update_media(update_id,media_kind,public_url,poster_url,title,sort_order,created_at,updated_at)
            select v_update_id,m.media_kind,m.public_url,m.poster_url,m.title,m.sort_order,m.created_at,m.updated_at
            from public.project_tracking_update_media m where m.id=(v_media->>'id')::bigint returning id into v_media_id;
        end if;
        select p->'references' into v_refs from jsonb_array_elements(p_media_plan) p where p->>'sourceId'=v_media->>'id';
        select coalesce(jsonb_agg(r || jsonb_build_object('editHref','/admin/projects/construction-updates?update=' || v_update_id::text)),'[]'::jsonb)
          into v_refs from jsonb_array_elements(v_refs) r;
        v_alias:='tracking-transfer:' || p_command_id::text || ':' || (v_media->>'id');
        perform public.replace_media_references_for_entity('project_tracking_update_media','project_tracking_update_media',v_media_id::text,v_refs,v_token,v_alias);
      end loop;
    end loop;
  end loop;
  if v_token is not null and public.complete_media_reference_write_lease(v_token,v_primary_alias)<>v_lease_count then
    raise exception using errcode='P0001',message='media_write_lease_completion_incomplete';
  end if;
  select slug into strict v_slug from public.projects where id=p_project_id;
  v_result:=jsonb_build_object('ok',true,'commandId',p_command_id,'completion','committed','operation',p_operation,
    'projectId',p_project_id,'projectSlug',v_slug,'sourceStageId',p_source_stage_id,'targetStageId',p_target_stage_id,
    'changedIds',v_changed_ids,'itemCount',cardinality(v_ids),'updateCount',v_update_count,'imageCount',v_image_count);
  insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
    select p_actor_id,username,'project_children.' || case when p_operation='copy' then 'duplicate' else 'update' end,
      'project_tracking_item',case when cardinality(v_changed_ids)=1 then v_changed_ids[1] else null end,
      v_snapshot->'state'->'source'->>'name',jsonb_build_object('atomic',true,'project_id',p_project_id,
        'command',jsonb_build_object('id',p_command_id,'actorId',p_actor_id,'intent',v_intent,'result',v_result))
      from public.admin_users where id=p_actor_id;
  if not found then raise exception using errcode='P0001',message='tracking_transfer_receipt_missing'; end if;
  return v_result;
end;
$transfer$;

revoke all on function public.read_project_tracking_transfer_snapshot(bigint,bigint,bigint,bigint[]) from public,anon,authenticated;
grant execute on function public.read_project_tracking_transfer_snapshot(bigint,bigint,bigint,bigint[]) to service_role;
revoke all on function public.transfer_project_tracking_items(bigint,uuid,text,bigint,bigint,bigint,bigint[],text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.transfer_project_tracking_items(bigint,uuid,text,bigint,bigint,bigint,bigint[],text,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;