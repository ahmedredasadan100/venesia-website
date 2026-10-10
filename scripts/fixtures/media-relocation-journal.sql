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
