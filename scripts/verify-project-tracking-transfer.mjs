import assert from 'node:assert/strict';
import { verifyTrackingTransferActions } from './fixtures/tracking-transfer-actions.mjs';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const container = `venisia-tracking-transfer-${randomUUID().slice(0,8)}`;
let ownedId;
const evidence = '.tmp-qa/tracking-transfer';
mkdirSync(evidence,{recursive:true});
const records=[];
function docker(args,input='') {
 const child=spawn('docker',args,{windowsHide:true,stdio:['pipe','pipe','pipe']}); let stdout='',stderr='';
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('close',code=>resolve({code,stdout,stderr}));});
 child.stdin.on('error',()=>{}); child.stdin.end(input); return {child,done};
}
const query=sql=>docker(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h','/fixture','-U','postgres','-d','postgres'],sql);
async function ok(sql) {const r=await query(sql).done; assert.equal(r.code,0,r.stderr);return r.stdout.trim();}
async function bad(sql,re) {const r=await query(sql).done;assert.notEqual(r.code,0);assert.match(r.stderr,re);}
const literal=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const check=(label)=>{records.push(label);console.log('PASS '+label);};
async function race(a,b,pattern) {
 const first=query(`begin; ${a}; select 'HELD'; select pg_sleep(1); commit;`);
 await new Promise((resolve,reject)=>{let s='';const t=setTimeout(()=>reject(Error('lock timeout')),10000);first.child.stdout.on('data',bytes=>{s+=bytes;if(s.includes('HELD')){clearTimeout(t);resolve();}});first.done.then(r=>{if(r.code){clearTimeout(t);reject(Error(r.stderr));}});});
 const second=query(b); const [ra,rb]=await Promise.all([first.done,second.done]);assert.equal(ra.code,0,ra.stderr);
 if(pattern){assert.notEqual(rb.code,0);assert.match(rb.stderr,pattern);}else assert.equal(rb.code,0,rb.stderr);
 return [ra.stdout,rb.stdout];
}
try {
 const start=await docker(['run','--pull=never','--rm','--detach','--network','none','--name',container,'--user','postgres','--tmpfs','/fixture:rw,mode=1777','--entrypoint','/bin/sh','public.ecr.aws/supabase/postgres:17.6.1.165','-c','initdb -D /fixture/data --auth=trust >/fixture/init.log 2>&1 && exec postgres -D /fixture/data -c listen_addresses= -c unix_socket_directories=/fixture']).done;
 assert.equal(start.code,0,start.stderr);ownedId=start.stdout.trim();
 const inspection=JSON.parse((await docker(['inspect',container]).done).stdout)[0];
 assert.equal(inspection.Id,ownedId);assert.equal(inspection.HostConfig.NetworkMode,'none');assert.deepEqual(inspection.HostConfig.Binds,null);assert.deepEqual(inspection.HostConfig.PortBindings,{});
 for(let n=0;n<40;n++){const r=await query('select 1').done;if(r.code===0)break;if(n===39)throw Error(r.stderr);await new Promise(r=>setTimeout(r,250));}
 const source=readFileSync('scripts/verify-project-tracking-detail-postgres.mts','utf8');
 const bootstrap=source.match(/await db\.exec\(\x60([\s\S]*?)\x60\);/)[1];
 await ok("create extension pgcrypto; create table public.site_settings(key text primary key,value jsonb,updated_at timestamptz default now());"+bootstrap+"alter table public.admin_users add column username text not null default 'isolated';");
 for(const file of ['20250625700000_admin_audit_logs.sql','20260725090000_media_catalog_reference_foundation.sql','20260725180000_media_delete_reservation_saga.sql','20260817101000_media_ordinary_attachment_scope.sql','20260817170332_project_construction_tracking_detail.sql','20260818010000_project_tracking_public_pagination.sql','20260824022000_media_reference_mixed_provider_lease_scope.sql','20261007193823_media_delete_usage_confirmation.sql','20261008084745_media_delete_lease_resolution.sql']) await ok(readFileSync('sql/migrations/'+file,'utf8'));
 // Load the actual shared receipt index/immutability owner, excluding unrelated Topics RPCs.
 const receipt=readFileSync('sql/migrations/20260926013216_topics_command_completion.sql','utf8');
 await ok(receipt.slice(0,receipt.indexOf('drop function public.admin_mutate_topics_batch_atomically'))+'commit;');
 await ok(readFileSync('sql/migrations/20261016120000_project_tracking_copy_move.sql','utf8'));
 check('actual additive migration applied to owned temporary native PostgreSQL only');
 await ok(`insert into project_tracking_stages(project_id,name,sort_order) values(1,'Source',0),(1,'Target',1),(2,'Other project',0);
 insert into project_tracking_items(stage_id,name,description,sort_order,status,start_date,completion_date) values(1,'Duplicate allowed','Original',0,'completed','2026-01-01','2026-02-01'),(1,'Duplicate allowed','Second',1,'completed','2026-01-01','2026-03-01'),(2,'Existing',0::text,0,'not_started',null,null);
 insert into project_tracking_updates(item_id,occurred_at,title,body,publication_status,published_at) values(1,'2026-01-12','Published','Historical','published','2026-01-13'),(1,'2026-01-14','Draft','Hidden','draft',null),(2,'2026-02-01','Second','History','published','2026-02-02');
 insert into media_assets(provider,bucket,object_key,public_url,original_filename,display_name,media_kind,extension,folder_path,status,reconciliation_state) values('supabase','images','images/transfer.png','https://fixture.invalid/storage/v1/object/public/images/images/transfer.png','images/transfer.png','transfer','image','.png','images','active','synced');
 insert into project_tracking_update_media(update_id,media_kind,public_url,sort_order) values(1,'image','https://fixture.invalid/storage/v1/object/public/images/images/transfer.png',0),(2,'image','https://fixture.invalid/storage/v1/object/public/images/images/transfer.png',0),(3,'video','https://www.youtube.com/watch?v=fixture',0);`);
 const asset=await ok("select id from media_assets where object_key='images/transfer.png'");
 const plan=[1,2,3].map(id=>({sourceId:id,references:id===3?[]:[{assetId:asset,provider:'supabase',bucket:'images',objectKey:'images/transfer.png',publicValue:'https://fixture.invalid/storage/v1/object/public/images/images/transfer.png',fieldKey:'public_url',referenceState:'active'}]}));
 const snapshot=async(sourceStage=1,targetStage=2,ids=[1,2])=>JSON.parse(await ok(`select read_project_tracking_transfer_snapshot(1,${sourceStage},${targetStage},ARRAY[${ids}])`));
 const initial=await snapshot();
 const context={provider:'supabase',environment:'isolated',identity:'isolated',registryVersion:'fixture'};
 const command=(id,operation='copy',revision=initial.revision,mediaPlan=plan,sourceStage=1,targetStage=2,ids=[1,2])=>`select transfer_project_tracking_items(1,'${id}','${operation}',1,${sourceStage},${targetStage},ARRAY[${ids}],'${revision}',${literal(mediaPlan)},${literal(context)})`;
 const state=()=>ok(`select jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by id) from project_tracking_items i),'updates',(select jsonb_agg(to_jsonb(u) order by id) from project_tracking_updates u),'media',(select jsonb_agg(to_jsonb(m) order by id) from project_tracking_update_media m),'refs',(select jsonb_agg(to_jsonb(r) order by id) from media_references r),'leases',(select jsonb_agg(to_jsonb(l) order by id) from media_reference_write_leases l),'receipts',(select jsonb_agg(to_jsonb(a) order by id) from admin_audit_logs a),'revisions',(select jsonb_agg(to_jsonb(r) order by domain_key) from media_reference_provider_revisions r))`);
 if(process.env.TRACKING_TRANSFER_ACTIONS_ONLY!=="1" && process.env.TRACKING_TRANSFER_CASES!=="additional") {
 const before=await state();
 for(const [label,sql,re] of [
  ['same stage',command(randomUUID(),'copy',initial.revision,plan,1,1),/invalid_input/],
  ['cross project',command(randomUUID(),'copy',initial.revision,plan,1,3),/scope_changed/],
  ['duplicate IDs',command(randomUUID(),'copy',initial.revision,plan,1,2,[1,1]),/duplicate_ids/],
  ['stale confirmation',command(randomUUID(),'copy','stale'),/revision_conflict/],
  ['missing media plan',command(randomUUID(),'copy',initial.revision,plan.slice(1)),/media_plan_incomplete/],
  ['wrong canonical identity',command(randomUUID(),'copy',initial.revision,plan.map(p=>({...p,references:p.references.map(r=>({...r,objectKey:'wrong.png'}))}))),/media_unavailable/]
 ]){await bad(sql,re);assert.equal(await state(),before);check(label+' rejects with zero mutations');}
 for(const table of ['media_references','admin_audit_logs','media_reference_write_leases']){
  const event=table==='media_reference_write_leases'?'before update':'before insert';
  const guard=table==='media_reference_write_leases'?"if new.status='completed' then raise exception 'injected_atomic_failure'; end if;":"raise exception 'injected_atomic_failure';";
  await ok(`create function public.transfer_fail() returns trigger language plpgsql as $f$ begin ${guard} return new; end $f$; create trigger transfer_fail ${event} on ${table} for each row execute function public.transfer_fail();`);
  await bad(command(randomUUID()),/injected_atomic_failure/);assert.equal(await state(),before);
  await ok(`drop trigger transfer_fail on ${table}; drop function public.transfer_fail();`);check(table+' failure rolls back graph, references, leases, revision and receipt');
 }
 const id=randomUUID();const first=JSON.parse(await ok(command(id)));assert.equal(first.itemCount,2);assert.equal(first.updateCount,3);assert.equal(first.imageCount,2);
 assert.deepEqual((await snapshot()).state,initial.state);assert.equal(await ok('select count(*) from media_assets'),'1');
 const newIds=first.changedIds;
 assert.equal(await ok(`select count(*) from project_tracking_updates where item_id=any(ARRAY[${newIds}])`),'3');
 assert.equal(await ok(`select count(*) from media_references where asset_id='${asset}'`),'2');
 assert.equal(await ok("select count(*) from media_reference_write_leases where status<>'completed'"),'0');
 const copied=JSON.parse(await ok(`select json_agg(to_jsonb(i) order by sort_order) from project_tracking_items i where id=any(ARRAY[${newIds}])`));
 assert.deepEqual(copied.map(i=>i.sort_order),[1,2]);for(let n=0;n<2;n++)for(const key of ['name','description','status','start_date','completion_date','created_at'])assert.equal(copied[n][key],initial.state.items[n][key]);
 check('Copy preserves originals, order, duplicate names, dates/status/history/drafts; new identities share one Storage asset');
 const after=await state();assert.deepEqual(JSON.parse(await ok(command(id))),first);assert.equal(await state(),after);
 await bad(command(id,'move'),/command_conflict/);assert.equal(await state(),after);check('same commandId replay returns receipt; changed intent rejects without duplication');
 const concurrent=randomUUID();await race(command(concurrent),command(concurrent));assert.equal(await ok(`select count(*) from admin_audit_logs where metadata->'command'->>'id'='${concurrent}'`),'1');check('concurrent same commandId commits once');
 const moveId=randomUUID();const moved=JSON.parse(await ok(command(moveId,'move')));assert.deepEqual(moved.changedIds,[1,2]);
 assert.equal(await ok('select count(*) from project_tracking_items where stage_id=1'),'0');
 assert.equal(await ok('select item_id from project_tracking_updates where id=1'),'1');assert.equal(await ok('select update_id from project_tracking_update_media where id=1'),'1');
 assert.equal(await ok(`select count(*) from media_references where asset_id='${asset}'`),'6');
 assert.deepEqual(JSON.parse(await ok(command(moveId,'move'))),moved);check('Move preserves item/update/media identities and receipt replay after source removal');
 await bad('select mutate_project_tracking_item(1,2,1,\'delete\',1,\'{}\')',/historical Updates/);check('existing historical deletion guard remains effective after Move');
 } else { await ok('update project_tracking_items set stage_id=2,sort_order=sort_order+1 where id in(1,2)'); }
 if(process.env.TRACKING_TRANSFER_CASES!=="additional") {
 await verifyTrackingTransferActions({ok,query,check});
 const current=await snapshot(2,1);
 const currentCommand=(id=randomUUID())=>command(id,'copy',current.revision,plan,2,1);
 await ok(`insert into site_settings(key,value) values('media.catalog_state','{"state":"synced","provider":"supabase","environment":"isolated","environmentKey":"isolated","providerRegistryVersion":"fixture"}') on conflict(key) do update set value=excluded.value`);
 const reserve=(confirmed=false)=>`select * from reserve_media_asset_deletion('${asset}',1,'isolated','supabase','images','images/transfer.png','supabase','isolated','isolated','fixture',${confirmed})`;
 await bad(reserve(),/media_delete_asset_in_use/);check('copied references participate in the existing safe-delete in-use guard');
 await race(currentCommand(),reserve(),/media_delete_asset_in_use/);check('concurrent copy then safe delete sees committed references and refuses deletion');
 const countBefore=await ok('select count(*) from project_tracking_items');
 await race(reserve(true),currentCommand(),/media_unavailable|delete_reserved|asset_not_active/);
 assert.equal(await ok('select count(*) from project_tracking_items'),countBefore);check('existing explicitly confirmed deletion reservation wins before Copy; no partial copy');
 const reservation=await ok(`select id from media_delete_reservations where asset_id='${asset}' and status='reserved'`);
 await ok(`select cancel_media_asset_deletion('${asset}','${reservation}','isolated_cancel','{}','exists',clock_timestamp())`);
 const lease=await ok(`select lease_token from acquire_media_reference_write_lease('[{"provider":"supabase","bucket":"images","objectKey":"images/transfer.png","domainKey":"project_tracking_update_media","entityType":"project_tracking_update_media","entityIdentity":"fixture-conflict"}]',1,'isolated',180,'supabase','isolated','isolated','fixture')`);
 const leasedState=await state();await bad(currentCommand(),/media_write_lease_conflict/);assert.equal(await state(),leasedState);
 await ok(`select fail_media_reference_write_lease('${lease}','fixture-conflict','isolated','{}',false)`);check('active Media lease blocks Copy without changing graph/references/receipt');
 for(const operation of ['copy','move']) {
  await ok("create function transfer_receipt_fail() returns trigger language plpgsql as $f$ begin raise exception 'injected_receipt_failure'; end $f$; create trigger transfer_receipt_fail before insert on admin_audit_logs for each row execute function transfer_receipt_fail()");
  const unchanged=await state();await bad(command(randomUUID(),operation,current.revision,plan,2,1),/injected_receipt_failure/);assert.equal(await state(),unchanged);
  await ok('drop trigger transfer_receipt_fail on admin_audit_logs;drop function transfer_receipt_fail()');check(operation+' receipt failure rolls back after complete graph/reference work');
 }
 await bad("set role authenticated; select read_project_tracking_transfer_snapshot(1,2,1,ARRAY[1,2])",/permission denied/);check('authenticated role cannot bypass Actions to invoke private transfer preflight');
 }
 if(process.env.TRACKING_TRANSFER_CASES==='additional' || process.env.TRACKING_TRANSFER_CASES==='all') {
  const makeStage=async()=>Number(await ok("select (mutate_project_tracking_stage(1,1,'create',null,'{\"name\":\"Isolated stage\",\"is_visible\":true}')->>'id')::bigint"));
  const sourceStage=await makeStage(),targetStage=await makeStage();
  const item=Number(await ok(`insert into project_tracking_items(stage_id,name,sort_order,status) values(${sourceStage},'Empty item',0,'not_started') returning id`));
  const snap=async(t=targetStage)=>snapshot(sourceStage,t,[item]);
  const revision=(await snap()).revision;
  const emptyCommand=(id=randomUUID(),operation='copy',rev=revision,t=targetStage)=>command(id,operation,rev,[],sourceStage,t,[item]);
  const empty=JSON.parse(await ok(emptyCommand()));assert.equal(empty.updateCount,0);assert.equal(empty.imageCount,0);
  const leasesBefore=await ok('select count(*) from media_reference_write_leases');
  await race(emptyCommand(),emptyCommand());assert.equal(await ok(`select count(distinct sort_order) from project_tracking_items where stage_id=${targetStage}`),'3');
  assert.equal(await ok('select count(*) from media_reference_write_leases'),leasesBefore);check('single item without history/media copies without lease; distinct concurrent commands append without overwriting');
  const staleBefore=await ok(`select count(*) from project_tracking_items where stage_id=${targetStage}`);
  await race(`update project_tracking_items set description='Concurrent edit' where id=${item}`,emptyCommand(),/revision_conflict/);
  assert.equal(await ok(`select count(*) from project_tracking_items where stage_id=${targetStage}`),staleBefore);check('concurrent source edit invalidates preview; zero partial copy');
  const deletingTarget=await makeStage(),deletingRevision=(await snap(deletingTarget)).revision;
  await race(`select mutate_project_tracking_stage(1,1,'delete',${deletingTarget},'{}')`,emptyCommand(randomUUID(),'copy',deletingRevision,deletingTarget),/scope_changed/);check('concurrent target Stage deletion wins; Copy rejects without orphans');
  const liveTarget=await makeStage(),liveRevision=(await snap(liveTarget)).revision;
  await race(emptyCommand(randomUUID(),'copy',liveRevision,liveTarget),`select mutate_project_tracking_stage(1,1,'delete',${liveTarget},'{}')`,/with Items cannot be deleted/);check('Copy commits before concurrent target deletion; existing child guard retains Stage');
  const move=JSON.parse(await ok(emptyCommand(randomUUID(),'move',(await snap()).revision)));assert.equal(move.changedIds[0],item);check('single empty Item Move retains identity');
  await ok(`insert into media_assets(provider,bucket,object_key,public_url,original_filename,display_name,media_kind,extension,folder_path,status,reconciliation_state) values('supabase','images','images/poster.png','https://fixture.invalid/storage/v1/object/public/images/images/poster.png','poster.png','poster','image','.png','images','active','synced'); update project_tracking_update_media set poster_url='https://fixture.invalid/storage/v1/object/public/images/images/poster.png' where id=3`);
  const poster=await ok("select id from media_assets where object_key='images/poster.png'");
  const multiPlan=structuredClone(plan);multiPlan[2].references=[{assetId:poster,provider:'supabase',bucket:'images',objectKey:'images/poster.png',publicValue:'https://fixture.invalid/storage/v1/object/public/images/images/poster.png',fieldKey:'poster_url',referenceState:'active'}];
  const multiSnapshot=await snapshot(2,1),multiId=randomUUID();
  const multiple=JSON.parse(await ok(command(multiId,'copy',multiSnapshot.revision,multiPlan,2,1)));
  assert.equal(await ok(`select count(*) from media_reference_write_leases where request_identity='tracking-transfer:${multiId}' and status='completed'`),'2');
  assert.equal(await ok(`select count(*) from project_tracking_update_media m join project_tracking_updates u on u.id=m.update_id where u.item_id=any(ARRAY[${multiple.changedIds}]) and m.client_key in (select client_key from project_tracking_update_media where id in(1,2,3))`),'0');
  const fields=JSON.parse(await ok(`select jsonb_agg(jsonb_build_object('update',to_jsonb(u)-ARRAY['id','item_id'],'media',(select jsonb_agg(to_jsonb(m)-ARRAY['id','update_id','client_key'] order by m.sort_order) from project_tracking_update_media m where m.update_id=u.id)) order by u.id) from project_tracking_updates u where u.item_id=any(ARRAY[${multiple.changedIds}])`));
  const originals=multiSnapshot.state.items.flatMap(i=>i.updates).map(u=>{const {id,item_id,media,...update}=u;void id;void item_id;return {update,media:media.map(m=>{const {id,update_id,client_key,...rest}=m;void id;void update_id;void client_key;return rest;})};});assert.deepEqual(fields,originals);
  assert.equal(await ok('select count(*) from media_assets'),'2');check('multiple assets and video poster: every lease completed, new client keys, exact original dates/publication/media data, zero Storage copies');
 }
 console.log('PASS records='+records.length);
} finally {
 if(ownedId){const inspect=await docker(['inspect',container,'--format','{{.Id}}']).done;assert.equal(inspect.stdout.trim(),ownedId);const stopped=await docker(['stop','--time','5',container]).done;assert.equal(stopped.code,0,stopped.stderr);assert.notEqual((await docker(['inspect',container]).done).code,0);console.log('CLEANUP exact owned container removed; tmpfs destroyed; no ports/network/host volumes');}
 writeFileSync(evidence+'/native-results-'+ownedId?.slice(0,8)+'.json',JSON.stringify({container,ownedId,isolated:true,cleanup:!!ownedId,records},null,2));
}