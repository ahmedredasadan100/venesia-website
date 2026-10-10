begin;
do $$
declare a public.media_assets%rowtype; token uuid := gen_random_uuid(); plan jsonb; observed timestamptz; n integer;
begin
  select * into strict a from public.media_assets where provider='supabase' and status='active' limit 1;
  insert into public.media_reference_write_leases(lease_token,asset_id,domain_key,entity_type,entity_identity,write_targets,provider,environment,environment_key,provider_registry_version,expires_at)
  values(token,a.id,'media_catalog_physical_move','media_asset',a.id::text,jsonb_build_array(jsonb_build_object('domainKey','media_catalog_physical_move','entityType','media_asset','entityIdentity',a.id::text)),'supabase','local','qa-local','qa',clock_timestamp()+interval '10 minutes');
  plan:=jsonb_build_object('operation','physical_move','copyConfirmed',false,'previousAsset',jsonb_build_object('id',a.id,'objectKey',a.object_key,'publicUrl',a.public_url),'nextIdentity','{}'::jsonb,'referenceKeys','[]'::jsonb);
  if has_function_privilege('anon','public.record_media_relocation_journal(uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.transition_media_relocation_repair(uuid,text,timestamptz)','EXECUTE') then raise exception 'relocation_rpc_acl_broadened'; end if;
  set local role service_role;
  begin update public.media_reference_write_leases set failure_metadata=plan where lease_token=token; raise exception 'direct_write_was_allowed'; exception when insufficient_privilege then null; end;
  n:=public.record_media_relocation_journal(token,plan); if n<>1 then raise exception 'journal_count'; end if;
  n:=public.record_media_relocation_journal(token,plan||'{"copyConfirmed":true}'::jsonb);
  begin perform public.record_media_relocation_journal(token,plan); raise exception 'receipt_regressed'; exception when raise_exception then if sqlerrm='receipt_regressed' then raise; end if; end;
  n:=public.fail_media_reference_write_lease(token,a.id::text,'qa_failure',plan||'{"copyConfirmed":true}'::jsonb,true);
  select updated_at into observed from public.media_reference_write_leases where lease_token=token;
  n:=public.transition_media_relocation_repair(token,'claim',observed); if n<>1 then raise exception 'claim_count'; end if;
  begin perform public.transition_media_relocation_repair(token,'claim',observed); raise exception 'double_claim'; exception when raise_exception then if sqlerrm='double_claim' then raise; end if; end;
  n:=public.transition_media_relocation_repair(token,'complete',observed);
  if not exists(select 1 from public.media_reference_write_leases where lease_token=token and failure_metadata->>'relocationRepaired'='true') then raise exception 'repair_receipt_missing'; end if;
  reset role;
end $$;
rollback;

-- Project aggregate adapter: real service-role permissions and row CAS.
begin;
do $test$
declare
  p public.projects%rowtype;
  a public.media_assets%rowtype;
  target public.media_assets%rowtype;
  before_row jsonb; after_row jsonb; payload jsonb; r record;
  token uuid := gen_random_uuid();
begin
  select * into strict p from public.projects where slug='qa-admin-complete-project';
  select * into strict a from public.media_assets where public_url=p.image and status='active';
  target:=a; target.id:=gen_random_uuid(); target.object_key:='images/qa-rebind-native.jpg';
  target.public_url:=replace(a.public_url,a.object_key,target.object_key);
  insert into public.media_assets select target.*;
  if has_table_privilege('service_role','public.projects','UPDATE') or has_table_privilege('service_role','public.project_media','UPDATE') then raise exception 'project_table_acl_widened'; end if;
  if has_function_privilege('anon','public.save_project_admin_entry(bigint,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.save_project_admin_entry(bigint,jsonb)','EXECUTE') then raise exception 'project_rpc_acl_widened'; end if;
  for r in select 'projects' as tbl, p.id as id, 'image' as field
    union all select 'project_media',id,'image' from public.project_media where project_id=p.id
    union all select 'project_floor_plans',id,'architectural_image' from public.project_floor_plans where project_id=p.id
    union all select 'project_floor_plans',id,'furnishing_image' from public.project_floor_plans where project_id=p.id
  loop
    execute format('select to_jsonb(t) from public.%I t where id=$1',r.tbl) into before_row using r.id;
    payload:=jsonb_build_object('media_rebind',jsonb_build_object('table',r.tbl,'id',r.id::text,'field',r.field,'expected_value',before_row->r.field,'expected_updated_at',before_row->'updated_at','next_value',target.public_url));
    set local role service_role;
    begin
      perform public.save_project_admin_entry(p.id,jsonb_set(payload,'{media_rebind,next_value}','"https://example.invalid/unmanaged.png"'::jsonb));
      raise exception 'unmanaged_target_accepted';
    exception when invalid_parameter_value then null; end;
    perform public.save_project_admin_entry(p.id,payload);
    begin
      perform public.save_project_admin_entry(p.id,payload);
      raise exception 'stale_rebind_accepted';
    exception when serialization_failure then null; end;
    reset role;
    execute format('select to_jsonb(t) from public.%I t where id=$1',r.tbl) into after_row using r.id;
    if after_row->>r.field is distinct from target.public_url or (before_row-r.field-'updated_at') is distinct from (after_row-r.field-'updated_at') then raise exception 'rebind_changed_unrelated_fields'; end if;
  end loop;
  -- Compensation of an identity-transitioned asset is admitted by its journal,
  -- not by widening the Project table grant or accepting an arbitrary URL.
  update public.projects set image=a.public_url where id=p.id;
  update public.media_assets set public_url=target.public_url||'-staged',object_key=target.object_key||'-staged' where id=a.id;
  update public.projects set image=target.public_url||'-staged' where id=p.id;
  insert into public.media_reference_write_leases(lease_token,asset_id,domain_key,entity_type,entity_identity,write_targets,provider,environment,environment_key,provider_registry_version,expires_at,failure_metadata)
  values(token,a.id,'media_catalog_physical_move','media_asset',a.id::text,jsonb_build_array(jsonb_build_object('domainKey','media_catalog_physical_move','entityType','media_asset','entityIdentity',a.id::text)),'supabase','local','qa-local','qa',clock_timestamp()+interval '10 minutes',jsonb_build_object('operation','physical_move','copyConfirmed',true,'previousAsset',jsonb_build_object('publicUrl',a.public_url,'bucket',a.bucket,'objectKey',a.object_key),'nextIdentity',jsonb_build_object('publicUrl',target.public_url||'-staged'),'referenceKeys',jsonb_build_array(jsonb_build_array('projects',p.id::text,'image'))));
  select to_jsonb(t) into before_row from public.projects t where id=p.id;
  payload:=jsonb_build_object('media_rebind',jsonb_build_object('table','projects','id',p.id::text,'field','image','expected_value',before_row->'image','expected_updated_at',before_row->'updated_at','next_value',a.public_url));
  set local role service_role;
  perform public.save_project_admin_entry(p.id,payload);
  reset role;
  if (select image from public.projects where id=p.id) is distinct from a.public_url then raise exception 'compensation_failed'; end if;
end $test$;
rollback;
