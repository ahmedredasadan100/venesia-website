import { captureCoreSitemapActionResponse, assertCoreSitemapClosureReceipt, CORE_SITEMAP_CLOSURE_IDS, CORE_SITEMAP_CLOSURE_SELECTION } from './fixtures/admin-core-readonly-journeys.mjs';
import {normalizeCoreTerminalAuditId} from './fixtures/admin-core-domain-terminal-journeys.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createJiti } from 'jiti';
import { buildCoreTemplateCreateReadback } from './fixtures/admin-core-form-journeys.mjs';
import ts from 'typescript';
import type { OwnedLocalHandle, OwnedDatabaseConnection } from './lib/isolated-supabase.mts';

type Readback = typeof import('./verify-admin-core-domain-readback-isolated.mts');
const require = createRequire(import.meta.url);
let active = true, sqlReads = 0, openScopes = 0, activeBrowser = false, renewalAttempts = 0;
let virtualNow: number | null = null, queryAdvance = 0, failRenewal = false;
const renewals: number[] = [], statements: string[] = [];
class ReadbackClock extends Date { static now() { return virtualNow ?? Date.now(); } }
// Execute the unchanged canonical renewal implementation through its actual
// publicJob refusal branch, before any database-control operation is reachable.
const lifecycleFile=ts.createSourceFile('isolated-supabase.mts',readFileSync(resolve(import.meta.dirname,'lib/isolated-supabase.mts'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const renewalNodes: ts.ArrowFunction[]=[];
const visitRenewal=(node: ts.Node)=>{if(ts.isPropertyAssignment(node)&&node.name.getText(lifecycleFile)==='renewDatabaseControlConnection'&&ts.isArrowFunction(node.initializer))renewalNodes.push(node.initializer);ts.forEachChild(node,visitRenewal);};
visitRenewal(lifecycleFile);assert.equal(renewalNodes.length,1);
const renewalCode=ts.transpileModule('const renewal='+renewalNodes[0].getText(lifecycleFile)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const actualRenewalRefusal=(controlQueries=0,pendingScopedConnections=0,publicJob:Promise<void>|null=Promise.resolve(),code=renewalCode) =>
 new Function('cliContext','requireThat','controlMaintenance','controlQueries','pendingScopedConnections','scopedConnections','publicJob',code+'return renewal;')(
  {assertOwned:async()=>assert.ok(active)},(condition:unknown,code:string)=>assert.ok(condition,code),false,controlQueries,pendingScopedConnections,new Set(),publicJob);
const actualPublicJobRefusal=actualRenewalRefusal();
const handle = {
  renewDatabaseControlConnection: async () => {
    renewalAttempts++;if(activeBrowser)await actualPublicJobRefusal();
    assert.ok(active); assert.equal(openScopes, 0, 'Control maintenance requires a closed scoped connection.');
    if (failRenewal) throw new Error('controlled renewal failure');
    renewals.push(ReadbackClock.now());
  },
  withDatabaseConnection: async <T,>(work: (connection: OwnedDatabaseConnection) => Promise<T>) => {
    openScopes++;
    try { return await work({ query: async (sql: string, values?: unknown[]) => {
      assert.ok(active); statements.push(sql); sqlReads++;
      if (virtualNow !== null) {
        virtualNow += queryAdvance;
        assert.ok(virtualNow - renewals.at(-1)! < 60_000, 'The control connection would exceed its unchanged idle limit.');
      }
      const result = await db.query<Record<string, unknown>>(sql, values);
      return { rows: result.rows, rowCount: result.rows.length };
    }}); } finally { openScopes--; }
  },
} as unknown as OwnedLocalHandle;
const filename = resolve(import.meta.dirname, 'verify-admin-core-domain-readback-isolated.mts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  fileName: filename.replace(/\.mts$/, '.ts'), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', 'Date', compiled)((specifier: string) => {
  if (specifier === './lib/isolated-supabase.mts') return { assertOwnedLocalHandle: (candidate: unknown) => { assert.ok(active); assert.equal(candidate, handle); } };
  assert.equal(specifier, 'node:assert/strict'); return require(specifier);
}, loaded, loaded.exports, ReadbackClock);
const owner = loaded.exports as Readback;
const since = '2026-01-01T00:00:00.000Z';
const commandId = 'e0cdc882-15b8-4563-9505-a2ef75a40619';
const browser = (writes: unknown[], status = 'pass') => ({ status, startedAt: since, databaseReadback: writes });
const audit = async (id: number, type: string, entity: number | null, label: string | null, action: string, metadata: unknown = {}, actor: number | null = 7) => {
  await db.query('insert into public.admin_audit_logs values($1,$2,$3,$4,$5,$6,$7,$8)', [id, action, type, entity, label, actor, JSON.stringify(metadata), '2026-01-02T00:00:00Z']);
};
const receipt = () => ({ command: { id: commandId, actorId: 7, intent: { action: 'feature', ids: [1] }, result: { ok: true, commandId } } });
const base = () => ({ table: 'topics', id: 1, expected: { title: 'Owned topic' }, auditEntityType: 'topic', auditActions: ['topic.update'], exactAuditCount: 1, exactCommandReceiptCount: 1 });
const checks: string[] = await verifyCoreCanonicalInventoryPulseControls();
checks.push(...await verifyCoreSitemapResponseCaptureControls());
checks.push(...await verifyCoreSitemapCaptureLifecycleControls());
const db = new PGlite();
async function test(name: string, callback: () => Promise<void>) { await callback(); checks.push(name); }
async function rejectedBeforeSql(value: unknown) {
  const before = sqlReads; await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([value]))); assert.equal(sqlReads, before);
}
try {

  const sitemapCases=[{key:'collection:sitemap-monitor:capability:table',boundary:'collection',consumer:'sitemap-monitor',axis:'table',scenario:'complete_applicable_capability_behavior',status:'open',evidence:null}];
  const sitemapReceipt=()=>{
    const before={id:'122fdeef-40df-41f4-9146-4615552a04ca',kind:'form-permission-fingerprint',phase:'before',status:'pass',correlationId:commandId,ownedRunId:'owned-sitemap-run',publicTableCount:116,publicTableInventorySha256:'1'.repeat(64),publicDataSha256:'2'.repeat(64),adminAuditIncluded:true},after={...before,id:'2b5cdeef-40df-41f4-9146-4615552a04cb',phase:'after'};
    const row={id:CORE_SITEMAP_CLOSURE_IDS[0],status:'pass',consumer:'activity-sitemap-media-commands',surface:'sitemap-check',actualCommandPosts:1,nativeWrites:0,nativeCheckpointIds:[before.id,after.id],effectiveSourceFields:['siteName'],effectiveSourceCells:[['siteName','Database','نعم','NEXT_PUBLIC_SITE_NAME','Owned name']],commandPayloadBound:true,nativeBefore:before,nativeAfter:after,automaticCoverage:[] as string[],globalClosed:false};
    return {journeySelection:CORE_SITEMAP_CLOSURE_SELECTION,cohort:'domain-commands',scope:'core-closure',driverCompleted:true,inventoryOnly:false,status:'pass',errors:[],wholeCohortExecuted:false,globalClosed:false,selectedJourneyIds:[...CORE_SITEMAP_CLOSURE_IDS],executedJourneyIds:[...CORE_SITEMAP_CLOSURE_IDS],requiredCases:structuredClone(sitemapCases),databaseReadback:[],readOnlyReadback:[],evidence:[{...row,id:'existing-auth-login'},row]};
  };
  await test('Sitemap bounded receipt conserves canonical cases and rejects automatic coverage',async()=>{const result=assertCoreSitemapClosureReceipt(sitemapReceipt(),sitemapCases);assert.equal(result.wholeCohortExecuted,false);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);});
  const sitemapMutations:Array<[string,(value:ReturnType<typeof sitemapReceipt>)=>void]>=[
    ['wrong selection',r=>{r.journeySelection='other';}],['failed driver',r=>{r.driverCompleted=false;}],['failed envelope',r=>{r.status='fail';}],['whole cohort promotion',r=>{r.wholeCohortExecuted=true;}],['missing journey',r=>{r.executedJourneyIds=[];}],['wrong order',r=>{r.evidence.reverse();}],['inventory shrink',r=>{r.requiredCases=[];}],['claimed cell pass',r=>{r.requiredCases[0].status='pass';}],['foreign consumer',r=>{r.evidence[1].consumer='other';}],['missing returned table',r=>{r.evidence[1].effectiveSourceFields=[];}],['duplicate field',r=>{r.evidence[1].effectiveSourceFields.push('siteName');}],['missing table cell',r=>{r.evidence[1].effectiveSourceCells[0].pop();}],['unbound payload',r=>{r.evidence[1].commandPayloadBound=false;}],['duplicate action',r=>{r.evidence[1].actualCommandPosts=2;}],['accepted write',r=>{r.evidence[1].nativeWrites=1;}],['duplicate native request',r=>{r.evidence[1].nativeCheckpointIds[1]=r.evidence[1].nativeCheckpointIds[0];}],['changed data',r=>{r.evidence[1].nativeAfter.publicDataSha256='3'.repeat(64);}],['changed table inventory',r=>{r.evidence[1].nativeAfter.publicTableCount++;}],['wrong owned run',r=>{r.evidence[1].nativeAfter.ownedRunId='another';}],['wrong correlation',r=>{r.evidence[1].nativeAfter.correlationId='another';}],['audit exclusion',r=>{r.evidence[1].nativeAfter.adminAuditIncluded=false;}],['wrong native phase',r=>{r.evidence[1].nativeAfter.phase='before';}],['automatic credit',r=>{r.evidence[1].automaticCoverage=['all'];}],['global promotion',r=>{r.globalClosed=true;}],
  ];
  for(const[name,mutate]of sitemapMutations)await test('Sitemap rejects '+name,async()=>{const bad=sitemapReceipt();mutate(bad);assert.throws(()=>assertCoreSitemapClosureReceipt(bad,sitemapCases));});

  await test('Terminal audit producer accepts only positive safe integers and decimal bigint strings',async()=>{
    for(const value of [1,'1',57,'57','64','71',Number.MAX_SAFE_INTEGER,String(Number.MAX_SAFE_INTEGER)])assert.equal(normalizeCoreTerminalAuditId(value),Number(value));
    for(const value of [null,undefined,true,false,{},[],0,'0',-1,'-1',1.5,'1.5',' 57','57 ','+57','5e1','0x39','057','',NaN,Infinity,9007199254740992,'9007199254740992'])assert.throws(()=>normalizeCoreTerminalAuditId(value));
  });
  await db.exec(`
    create table public.admin_users(id bigint primary key,username text,email text,role text,is_active boolean);
    insert into public.admin_users values(7,'qa_admin_interaction','qa-admin-interaction@example.invalid','admin',true);
    create table public.admin_audit_logs(id bigint primary key, action text,entity_type text,entity_id bigint,entity_label text,actor_admin_user_id bigint,metadata jsonb,created_at timestamptz);
    create table public.topics(id bigint primary key,title text,status text,deleted_at timestamptz,is_featured boolean,updated_at timestamptz,media_payload jsonb);
    insert into public.topics values(1,'Owned topic','unpublished',null,true,'2026-01-02T03:04:05Z','{"kind":"video","caption":null}'),(2,'Trash A','unpublished',now(),false,now(),'{}'),(3,'Trash B','unpublished',now(),false,now(),'{}');
    create table public.topic_categories(id bigint primary key,name text,status text,deleted_at timestamptz,is_active boolean,updated_at timestamptz);
    insert into public.topic_categories values(10,'Category','unpublished',null,true,now());
    create table public.project_locations(id bigint primary key,level text,is_active boolean,updated_at timestamptz);
    insert into public.project_locations values(20,'city',true,now());
    create table public.site_settings(key text primary key,value jsonb);
    insert into public.site_settings values('admin.company','{"name":"Saved Company","nested":{"nullable":null}}');
    create table public.hero_templates(id bigint primary key,name text,config jsonb);
    insert into public.hero_templates values(5,'Hero authored','{"items":[{"title":"Saved slide"}]}');
    create table public.project_tracking_profiles(project_id bigint primary key,contractor_name text,project_receipt_date date,license_receipt_date date);
    insert into public.project_tracking_profiles values(30,'Builder','2026-01-03','2026-01-04');
    create table public.project_tracking_updates(id bigint primary key,occurred_at timestamptz);
    insert into public.project_tracking_updates values(31,'2026-01-04 14:00:00+02');
    create table public.projects(id bigint primary key,latitude numeric(9,6),longitude numeric(9,6),map_zoom integer);
    insert into public.projects values(30,30.123456,31.654321,12);
  `);
  await audit(1, 'topic', 1, 'Owned topic', 'topic.update', receipt());
  await audit(2, 'topic_category', 10, null, 'topic_category.unpublish');
  await audit(3, 'site_settings', null, 'admin.company', 'site_settings.update');
  await audit(4, 'content_block_template', 5, 'Hero authored', 'content_block_template.update', { blockType: 'hero' });
  await audit(5, 'project_tracking_profile', 30, 'Project name', 'project_children.update');
  await audit(6, 'project_tracking_update', 31, 'Update name', 'project_children.update');
  await audit(7, 'project', 30, 'Project name', 'project.create');
  await audit(8, 'topic', null, null, 'topic.permanent_delete', { topic_ids: [40, 41] });
  await db.exec(`
    create table public.project_tracking_update_media(id bigint primary key,client_key uuid not null,update_id bigint,media_kind text,public_url text,poster_url text,title text,sort_order integer);
    create table public.media_references(id bigint,domain_key text,entity_type text,entity_identity text);
    create table public.admin_media_assets_catalog(id uuid,object_key text,public_url text,provider text,bucket text,status text,reconciliation_state text);
    insert into public.admin_media_assets_catalog values
    ('ee854cd4-e3b0-4d65-b1aa-96c0f7c94701','images/projects/c35/hero.jpg','/images/projects/c35/hero.jpg','filesystem','public','active','synced'),
    ('ee854cd4-e3b0-4d65-b1aa-96c0f7c94702','images/projects/c35/cover.jpg','/images/projects/c35/cover.jpg','filesystem','public','active','synced'),
    ('ee854cd4-e3b0-4d65-b1aa-96c0f7c94703','images/projects/c35/location-map.jpg','/images/projects/c35/location-map.jpg','filesystem','public','active','synced');
    insert into public.project_tracking_update_media values
    (111,'6d3a9c13-dda8-41ce-9ea9-4597078bc001',31,'image','/images/projects/c35/cover.jpg',null,null,0),
    (112,'6d3a9c13-dda8-41ce-9ea9-4597078bc002',31,'image','/images/projects/c35/hero.jpg',null,null,1),
    (113,'6d3a9c13-dda8-41ce-9ea9-4597078bc003',31,'video','https://example.invalid/core-tracking-video','/images/projects/c35/location-map.jpg','QA Core Tracking video create',2);
  `);
  const mediaRows=()=>[
    {media_kind:'image',public_url:'/images/projects/c35/cover.jpg',poster_url:null,title:null,sort_order:0},
    {media_kind:'image',public_url:'/images/projects/c35/hero.jpg',poster_url:null,title:null,sort_order:1},
    {media_kind:'video',public_url:'https://example.invalid/core-tracking-video',poster_url:'/images/projects/c35/location-map.jpg',title:'QA Core Tracking video create',sort_order:2,client_key:'6d3a9c13-dda8-41ce-9ea9-4597078bc003'},
  ];
  const mediaWrite=()=>({table:'project_tracking_updates',id:31,expected:{occurred_at:'2026-01-04T12:00:00Z'},expectedTrackingMedia:mediaRows(),auditEntityType:'project_tracking_update',auditEntityLabel:'Update name',auditActions:['project_children.update'],exactAuditCount:1});
  await test('Tracking child native SQL binds authored order, video key, catalog identities and zero fabricated managed references',async()=>{
    const result=await owner.verifyCoreDomainWrites(handle,browser([mediaWrite()]));assert.ok(result[0].trackingMedia);assert.equal(result[0].trackingMedia.rows.length,3);assert.equal(result[0].trackingMedia.catalogIdentityCount,3);assert.equal(result[0].trackingMedia.referenceRows,0);assert.deepEqual(result[0].trackingMedia.removedAssociationIds,[]);
  });
  for(const [name,change]of [
    ['foreign table',(w:Record<string,unknown>)=>{w.table='topics';}],['deleted parent',(w:Record<string,unknown>)=>{w.deleted=true;w.expected={};}],
    ['injected child field',(w:Record<string,unknown>)=>{(w.expectedTrackingMedia as Record<string,unknown>[])[0].password_hash='invalid';}],
    ['unowned image',(w:Record<string,unknown>)=>{(w.expectedTrackingMedia as Record<string,unknown>[])[0].public_url='/images/not-owned.jpg';}],
    ['duplicate path',(w:Record<string,unknown>)=>{(w.expectedTrackingMedia as Record<string,unknown>[])[1].public_url='/images/projects/c35/cover.jpg';}],
    ['noncontiguous order',(w:Record<string,unknown>)=>{(w.expectedTrackingMedia as Record<string,unknown>[])[1].sort_order=9;}],
    ['missing video identity',(w:Record<string,unknown>)=>{delete (w.expectedTrackingMedia as Record<string,unknown>[])[2].client_key;}],
    ['foreign external video',(w:Record<string,unknown>)=>{(w.expectedTrackingMedia as Record<string,unknown>[])[2].public_url='https://example.org/foreign';}],
    ['oversized child set',(w:Record<string,unknown>)=>{(w.expectedTrackingMedia as unknown[]).push(...mediaRows());}],
  ] as const)await test('Tracking media rejects '+name+' before SQL',async()=>{const w:Record<string,unknown>=mediaWrite();change(w);await rejectedBeforeSql(w);});
  for(const [name,mutate,restore]of [
    ['lost child','delete from public.project_tracking_update_media where id=112',"insert into public.project_tracking_update_media values(112,'6d3a9c13-dda8-41ce-9ea9-4597078bc002',31,'image','/images/projects/c35/hero.jpg',null,null,1)"],
    ['changed order','update public.project_tracking_update_media set sort_order=8 where id=112','update public.project_tracking_update_media set sort_order=1 where id=112'],
    ['changed video identity',"update public.project_tracking_update_media set client_key='6d3a9c13-dda8-41ce-9ea9-4597078bc099' where id=113","update public.project_tracking_update_media set client_key='6d3a9c13-dda8-41ce-9ea9-4597078bc003' where id=113"],
    ['wrong poster',"update public.project_tracking_update_media set poster_url=null where id=113","update public.project_tracking_update_media set poster_url='/images/projects/c35/location-map.jpg' where id=113"],
    ['fabricated managed reference',"insert into public.media_references values(1,'project_tracking_update_media','project_tracking_update_media','111')",'delete from public.media_references where id=1'],
    ['inactive catalog image',"update public.admin_media_assets_catalog set status='deleted' where object_key='images/projects/c35/cover.jpg'","update public.admin_media_assets_catalog set status='active' where object_key='images/projects/c35/cover.jpg'"],
  ])await test('Tracking native read rejects '+name,async()=>{await db.exec(mutate);await assert.rejects(owner.verifyCoreDomainWrites(handle,browser([mediaWrite()])));assert.equal(statements.at(-1),'rollback');await db.exec(restore);});
  await test('Tracking removal detects moved children and dangling old references before proving actual absence',async()=>{
    const w=mediaWrite();w.expectedTrackingMedia=[w.expectedTrackingMedia[0],{...w.expectedTrackingMedia[2],sort_order:1}];
    await db.exec('update public.project_tracking_update_media set update_id=99 where id=112; update public.project_tracking_update_media set sort_order=1 where id=113');
    await assert.rejects(owner.verifyCoreDomainWrites(handle,browser([w])));
    await db.exec("delete from public.project_tracking_update_media where id=112; insert into public.media_references values(2,'project_tracking_update_media','project_tracking_update_media','112')");await assert.rejects(owner.verifyCoreDomainWrites(handle,browser([w])));await db.exec('delete from public.media_references where id=2');
    const result=await owner.verifyCoreDomainWrites(handle,browser([w]));assert.ok(result[0].trackingMedia);assert.deepEqual(result[0].trackingMedia.removedAssociationIds,[112]);assert.equal(result[0].trackingMedia.rows.length,2);
  });
  await test('Actual SQL projects saved fields and validates one actor-bound immutable receipt', async () => {
    const result = await owner.verifyCoreDomainWrites(handle, browser([base()]));
    assert.equal(result[0].actual?.title, 'Owned topic'); assert.equal(result[0].commandReceiptCount, 1);
    assert.equal(statements[0], 'begin isolation level repeatable read read only'); assert.equal(statements.at(-1), 'commit');
  });
  await test('Native checkpoint includes selected state and actual immutable command', async () => {
    const result = await owner.readCoreDomainCheckpoint(handle, { id: commandId, kind: 'terminal-domain-state', entity: 'topics', ids: [1], startedAt: since });
    assert.ok('rows' in result); assert.equal(result.rows[0].is_featured, true); assert.equal(result.audit.length, 1);
  });
  await test('Trash checkpoint returns the complete global set, without a row ID filter', async () => {
    const result = await owner.readCoreDomainCheckpoint(handle, { id: commandId, kind: 'terminal-trash-set', entity: 'topics' });
    assert.ok('ids' in result); assert.deepEqual(result.ids, [2, 3]);
  });
  await test('Checkpoint rejects extra selector, unknown entity, duplicate IDs, over-limit IDs and invalid dates before SQL', async () => {
    const request = { id: commandId, kind: 'terminal-domain-state', entity: 'topics', ids: [1], startedAt: since };
    for (const patch of [{ sql: 'select 1' }, { entity: 'admin_audit_logs' }, { ids: [1, 1] }, { ids: [1, 2, 3, 4] }, { startedAt: 'invalid' }]) {
      const before = sqlReads; await assert.rejects(owner.readCoreDomainCheckpoint(handle, { ...request, ...patch })); assert.equal(sqlReads, before);
    }
  });
  await test('Checkpoint rejects the wrong concrete location level and rolls back', async () => {
    await assert.rejects(owner.readCoreDomainCheckpoint(handle, { id: commandId, kind: 'terminal-domain-state', entity: 'project_locations_governorate', ids: [20], startedAt: since }));
    assert.equal(statements.at(-1), 'rollback');
  });
  await test('Unknown tables and sensitive fields are rejected before any SQL', async () => {
    await rejectedBeforeSql({ ...base(), table: 'auth.users' }); await rejectedBeforeSql({ ...base(), table: 'admin_users', expected: { password_hash: 'never' } });
  });
  await test('All expectations validate before the first apparently valid read', async () => {
    const before = sqlReads; await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base(), { ...base(), expected: { injected: true } }]))); assert.equal(sqlReads, before);
  });
  await test('Saved field mismatch remains a failure with transaction rollback', async () => {
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...base(), expected: { title: 'Unsaved topic' } }]))); assert.equal(statements.at(-1), 'rollback');
  });
  await test('Explicit null label matches omission, while another label cannot borrow that audit', async () => {
    const write = { table: 'topic_categories', id: 10, expected: { name: 'Category' }, auditEntityLabel: null, exactAuditCount: 1 };
    await owner.verifyCoreDomainWrites(handle, browser([write]));
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...write, auditEntityLabel: 'Category' }])));
  });
  await test('A write cannot borrow an audit from before its Browser session or another domain', async () => {
    await rejectedBeforeSql({ ...base(), auditSince: '2025-12-31T00:00:00Z' }); await rejectedBeforeSql({ ...base(), auditEntityType: 'project' });
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...base(), auditSince: '2026-01-03T00:00:00Z' }])));
  });
  await test('Expected audit counts detect extra actual mutations', async () => {
    await audit(9, 'topic', 1, 'Owned topic', 'topic.update');
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base()]))); await db.exec('delete from public.admin_audit_logs where id=9');
  });
  await test('Missing actors and malformed receipts cannot pass as a command receipt', async () => {
    await db.exec('update public.admin_audit_logs set actor_admin_user_id=null where id=1');
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base()])));
    await db.exec('update public.admin_audit_logs set actor_admin_user_id=7 where id=1');
    for (const metadata of [{ command: null }, { command: { ...receipt().command, actorId: 8 } }, { command: { ...receipt().command, result: { ok: true, commandId: 'different' } } }]) {
      await db.query('update public.admin_audit_logs set metadata=$1 where id=1', [JSON.stringify(metadata)]);
      await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base()])));
    }
    await db.query('update public.admin_audit_logs set metadata=$1 where id=1', [JSON.stringify(receipt())]);
  });
  await test('JSON null is a persisted value, but a missing path is never equivalent to null', async () => {
    await owner.verifyCoreDomainWrites(handle, browser([{ ...base(), expectedJson: [{ column: 'media_payload', path: ['caption'], value: null }] }]));
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...base(), expectedJson: [{ column: 'media_payload', path: ['missing'], value: null }] }])));
  });
  await test('Unsafe JSON paths and wrong JSON columns are rejected before SQL', async () => {
    await rejectedBeforeSql({ ...base(), expectedJson: [{ column: 'media_payload', path: ['__proto__'], value: {} }] });
    await rejectedBeforeSql({ ...base(), expectedJson: [{ column: 'config', path: ['caption'], value: null }] });
  });
  await test('Settings use a fixed permitted namespace and JSON projection with exact audit label', async () => {
    const write = { table: 'site_settings', id: 'admin.company', expected: {}, expectedJson: [{ column: 'value', path: ['name'], value: 'Saved Company' }], auditEntityLabel: 'admin.company' };
    const result = await owner.verifyCoreDomainWrites(handle, browser([write])); assert.deepEqual(result[0].actual, { key: 'admin.company' });
    await rejectedBeforeSql({ ...write, id: 'auth.secret', auditEntityLabel: 'auth.secret' }); await rejectedBeforeSql({ ...write, auditEntityLabel: null });
  });
  await test('Shared template audit attribution requires its real module kind and authored label', async () => {
    const write = { table: 'hero_templates', id: 5, expected: { name: 'Hero authored' }, expectedJson: [{ column: 'config', path: ['items', '0', 'title'], value: 'Saved slide' }], auditMetadata: { blockType: 'hero' } };
    await owner.verifyCoreDomainWrites(handle, browser([write])); await rejectedBeforeSql({ ...write, auditMetadata: { blockType: 'cta' } });
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...write, auditEntityLabel: 'Other hero' }])));
  });
  await test('Null-label template status commands require exact kind/actions and cannot borrow a numeric-ID collision', async () => {
    await db.exec("alter table public.hero_templates add column status text default 'published';create table public.content_block_templates(id bigint primary key,name text,status text);insert into content_block_templates values(5,'Content authored','published');");
    await audit(20, 'content_block_template', 5, null, 'content_block_template.publish', { blockType: 'hero' });
    await audit(21, 'content_block_template', 5, null, 'content_block_template.unpublish', { blockType: 'hero' });
    const write = { table: 'hero_templates', id: 5, expected: { name: 'Hero authored', status: 'published' }, auditEntityLabel: null,
      auditActions: ['content_block_template.publish', 'content_block_template.unpublish'], auditMetadata: { blockType: 'hero' }, exactAuditCount: 2 };
    await owner.verifyCoreDomainWrites(handle, browser([write]));
    await rejectedBeforeSql({ ...write, auditMetadata: {} });
    await rejectedBeforeSql({ ...write, auditActions: ['content_block_template.update'] });
    await rejectedBeforeSql({ ...write, auditActions: [] });
    const content = { ...write, table: 'content_block_templates', expected: { name: 'Content authored', status: 'published' }, auditMetadata: { blockType: 'content' } };
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([content])), /retain actual domain/);
    await audit(22, 'content_block_template', 5, null, 'content_block_template.publish', { blockType: 'content' });
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([content])), /Expected current-domain audit action is absent/);
    await audit(23, 'content_block_template', 5, null, 'content_block_template.unpublish', { blockType: 'content' });
    await owner.verifyCoreDomainWrites(handle, browser([content]));
    await db.exec('delete from admin_audit_logs where id between 20 and 23');
  });
  await test('Existing Content Form audit shape stays valid; Content duplicate still requires its module kind', async () => {
    await audit(24, 'content_block_template', 5, 'Content authored', 'content_block_template.create', { slug: 'content-authored', variant: 'default' });
    const write = { table: 'content_block_templates', id: 5, expected: { name: 'Content authored' }, auditEntityLabel: 'Content authored',
      auditActions: ['content_block_template.create'], auditMetadata: { slug: 'content-authored' }, exactAuditCount: 1 };
    await owner.verifyCoreDomainWrites(handle, browser([write]));
    await rejectedBeforeSql({ ...write, auditActions: ['content_block_template.duplicate'] });
    await rejectedBeforeSql({ ...write, auditMetadata: { blockType: 'hero' } });
    await db.exec('delete from admin_audit_logs where id=24');
  });
  await test('Tracking profiles use fixed project_id and native date values; update timestamps preserve authored instant', async () => {
    await owner.verifyCoreDomainWrites(handle, browser([
      { table: 'project_tracking_profiles', id: 30, expected: { contractor_name: 'Builder', project_receipt_date: '2026-01-03', license_receipt_date: '2026-01-04' }, auditEntityLabel: 'Project name' },
      { table: 'project_tracking_updates', id: 31, expected: { occurred_at: '2026-01-04T12:00:00Z' }, auditEntityLabel: 'Update name' },
    ]));
  });
  await test('Project numeric coordinates are native JSON numbers without lossy string coercion', async () => {
    await owner.verifyCoreDomainWrites(handle, browser([{ table: 'projects', id: 30, expected: { latitude: 30.123456, longitude: 31.654321, map_zoom: 12 }, auditEntityLabel: 'Project name' }]));
  });
  await test('Deleted row proof requires the exact target-containing aggregate audit', async () => {
    const write = { table: 'topics', id: 40, deleted: true, expected: {}, auditEntityLabel: null, auditActions: ['topic.permanent_delete'], exactAuditCount: 1, aggregateAuditIds: [normalizeCoreTerminalAuditId('8')] };
    await owner.verifyCoreDomainWrites(handle, browser([write]));
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...write, id: 42 }])));
    await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([{ ...write, aggregateAuditIds: [99] }])));
    await rejectedBeforeSql({ ...write, aggregateAuditIds: ['8'] });
    await rejectedBeforeSql({ ...write, expected: { title: 'Cannot exist' } });
  });
  await test('Failed Browser cohort is denied full pass; partial projections preserve its failure and all readback invariants', async () => {
    const failed = browser([base()], 'failed'), before = sqlReads;
    await assert.rejects(owner.verifyCoreDomainWrites(handle, failed)); assert.equal(sqlReads, before);
    const partial = await owner.verifyCoreExecutedWriteProjections(handle, failed);
    assert.equal(partial.status, 'partial-not-global-pass'); assert.equal(partial.browserStatus, 'failed'); assert.equal(partial.globalClosed, false); assert.equal(partial.writes.length, 1);
    await assert.rejects(owner.verifyCoreExecutedWriteProjections(handle, browser([{ ...base(), expected: { title: 'Wrong' } }], 'failed')));
  });
  await test('A positive foreign actor cannot pass even when its immutable receipt internally agrees', async () => {
    await db.exec("update public.admin_audit_logs set actor_admin_user_id=8,metadata=jsonb_set(metadata,'{command,actorId}','8') where id=1");
    try {
      await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base()])), /fixed owned QA identity/);
      await assert.rejects(owner.readCoreDomainCheckpoint(handle, { id: commandId, kind: 'terminal-domain-state', entity: 'topics', ids: [1], startedAt: since }), /fixed owned QA identity/);
    } finally { await db.exec("update public.admin_audit_logs set actor_admin_user_id=7,metadata=jsonb_set(metadata,'{command,actorId}','7') where id=1"); }
  });
  await test('Missing, inactive, wrong-role and wrong-email QA actors cannot establish attribution', async () => {
    for (const assignment of ["username='other'", "is_active=false", "role='other'", "email='other@example.invalid'"]) {
      await db.exec('update public.admin_users set ' + assignment + ' where id=7');
      try { await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base()])), /resolve uniquely/); }
      finally { await db.exec("update public.admin_users set username='qa_admin_interaction',email='qa-admin-interaction@example.invalid',role='admin',is_active=true where id=7"); }
    }
  });
  await test('Duplicate fixture identities fail closed and never choose the first positive ID', async () => {
    await db.exec("insert into public.admin_users values(8,'qa_admin_interaction','qa-admin-interaction@example.invalid','admin',true)");
    try { await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([base()])), /resolve uniquely/); }
    finally { await db.exec('delete from public.admin_users where id=8'); }
  });
  await test('Successful native projections expose only the verified fixture actor ID', async () => {
    const result = await owner.verifyCoreDomainWrites(handle, browser([base()]));
    assert.equal(result[0].expectedActorId, 7); assert.ok(result[0].audit.every(row => Number(row.actor_admin_user_id) === result[0].expectedActorId));
  });
  await db.exec("insert into public.hero_templates values(50,'Bulk Hero A','{}'),(51,'Bulk Hero B','{}')");
  const bulkMetadata = { blockType: 'hero', action: 'unpublish', ids: [50, 51], count: 2 };
  const bulkWrite = (id: number) => ({ table: 'hero_templates', id, expected: { name: id === 50 ? 'Bulk Hero A' : 'Bulk Hero B' }, auditEntityLabel: 'hero_templates',
    auditActions: ['content_block_template.unpublish'], auditMetadata: bulkMetadata, exactAuditCount: 1, aggregateAuditIds: [26] });
  await audit(26, 'content_block_template', null, 'hero_templates', 'content_block_template.unpublish', bulkMetadata);
  await test('Actual null-entity template bulk audit covers exactly its two declared targets', async () => {
    const result = await owner.verifyCoreDomainWrites(handle, browser([bulkWrite(50), bulkWrite(51)]));
    assert.equal(result.length, 2); assert.ok(result.every(row => Number(row.audit[0].id) === 26));
  });
  for (const [label, patch] of [['wrong module', { ...bulkMetadata, blockType: 'cards' }], ['wrong target IDs', { ...bulkMetadata, ids: [50, 52] }], ['missing IDs', { blockType: 'hero', action: 'unpublish', count: 2 }]] as const) {
    await test('Template bulk audit rejects ' + label + ' instead of borrowing another event', async () => {
      await db.query('update public.admin_audit_logs set metadata=$1 where id=26', [JSON.stringify(patch)]);
      try { await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([bulkWrite(50), bulkWrite(51)]))); }
      finally { await db.query('update public.admin_audit_logs set metadata=$1 where id=26', [JSON.stringify(bulkMetadata)]); }
    });
  }
  await test('The actual lifecycle renewal implementation refuses an active publicJob before any control query', async () => {
    const before=sqlReads;await assert.rejects(actualPublicJobRefusal(),/CONTROL_CONNECTION_NOT_IDLE/);assert.equal(sqlReads,before);
  });
  for (const [label,queries,scopes] of [['active control query',1,0],['pending scoped connection',0,1]] as const) {
    await test('The actual renewal implementation refuses '+label+' independently of publicJob',async()=>{
      const before=sqlReads;
      await assert.rejects(actualRenewalRefusal(queries,scopes,null)(),/CONTROL_CONNECTION_NOT_IDLE/);
      assert.equal(sqlReads,before);
      const guard=queries?'controlQueries === 0 &&':'pendingScopedConnections === 0 &&';
      assert.ok(renewalCode.includes(guard));
      const missingGuard=actualRenewalRefusal(queries,scopes,null,renewalCode.replace(guard,''));
      await assert.rejects(assert.rejects(missingGuard(),/CONTROL_CONNECTION_NOT_IDLE/),assert.AssertionError);
      assert.equal(sqlReads,before);
    });
  }
  await test('Both post-gate readers still reject an active Browser job before reading', async () => {
    activeBrowser=true;const before=sqlReads;
    try {await assert.rejects(owner.verifyCoreDomainWrites(handle,browser([base()])),/CONTROL_CONNECTION_NOT_IDLE/);await assert.rejects(owner.verifyCoreExecutedWriteProjections(handle,browser([base()],'failed')),/CONTROL_CONNECTION_NOT_IDLE/);}
    finally {activeBrowser=false;}assert.equal(sqlReads,before);assert.equal(openScopes,0);
  });
  await test('Fixed live checkpoint uses only scoped reads and retains exact native fields, actor, receipt and partial status', async () => {
    activeBrowser=true;const before=renewalAttempts;
    try {const result=await owner.readCoreDomainWriteCheckpoint(handle,browser([base(),base()],'in-progress-form-native-checkpoint'));assert.equal(result.status,'partial-not-global-pass');assert.equal(result.browserStatus,'in-progress-form-native-checkpoint');assert.equal(result.globalClosed,false);assert.equal(result.writes.length,2);assert.ok(result.writes.every(row=>row.actual?.title==='Owned topic'&&row.expectedActorId===7&&row.commandReceiptCount===1));}
    finally {activeBrowser=false;}assert.equal(renewalAttempts,before);assert.equal(openScopes,0);
  });
  await test('Live checkpoint rejects missing rows, foreign positive actor and missing audit without control renewal', async () => {
    activeBrowser=true;const before=renewalAttempts;
    try {
      await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,browser([{...base(),id:999}],'in-progress-form-native-checkpoint')),/Native existence/);
      await db.exec('update public.admin_audit_logs set actor_admin_user_id=8 where id=1');
      try {await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,browser([base()],'in-progress-form-native-checkpoint')),/fixed owned QA identity/);}finally {await db.exec('update public.admin_audit_logs set actor_admin_user_id=7 where id=1');}
      await db.exec("update public.admin_audit_logs set entity_type='other' where id=1");
      try {await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,browser([base()],'in-progress-form-native-checkpoint')),/actor-bound audit/);}finally {await db.exec("update public.admin_audit_logs set entity_type='topic' where id=1");}
      assert.equal(statements.at(-1),'rollback');
    }finally {activeBrowser=false;}assert.equal(renewalAttempts,before);assert.equal(openScopes,0);
  });
  await test('Live checkpoint denies caller pass status, empty or oversized descriptors and invalid fields before SQL', async () => {
    const before=sqlReads;
    for(const input of [browser([base()]),browser([],'in-progress-form-native-checkpoint'),browser(Array.from({length:5},base),'in-progress-form-native-checkpoint'),browser([{...base(),expected:{secret:'x'}}],'in-progress-form-native-checkpoint')])await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,input));
    assert.equal(sqlReads,before);
  });
  await test('Live checkpoint cannot use an unowned or ended handle', async () => {
    const input=browser([base()],'in-progress-form-native-checkpoint'),before=sqlReads;
    await assert.rejects(owner.readCoreDomainWriteCheckpoint({} as OwnedLocalHandle,input));active=false;
    try{await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,input));}finally{active=true;}assert.equal(sqlReads,before);
  });
  await test('A long sequence renews only healthy closed scopes before the unchanged idle deadline', async () => {
    virtualNow = 1_000_000; queryAdvance = 3_000; renewals.length = 0;
    try {
      const result = await owner.verifyCoreDomainWrites(handle, browser(Array.from({ length: 8 }, base)));
      assert.equal(result.length, 8); assert.ok(virtualNow > 1_060_000); assert.ok(renewals.length >= 3);
      assert.equal(openScopes, 0); assert.ok(renewals.slice(1).every((value, index) => value - renewals[index] < 60_000));
    } finally { virtualNow = null; queryAdvance = 0; }
  });
  await test('A failed renewal propagates before the first projection and is never retried', async () => {
    failRenewal = true; const before = sqlReads, previous = renewals.length;
    try { await assert.rejects(owner.verifyCoreExecutedWriteProjections(handle, browser([base()], 'failed')), /controlled renewal failure/); }
    finally { failRenewal = false; }
    assert.equal(sqlReads, before); assert.equal(renewals.length, previous); assert.equal(openScopes, 0);
  });
  await test('An already-open scope cannot borrow control maintenance', async () => {
    const before = sqlReads;
    await assert.rejects(handle.withDatabaseConnection(async () => owner.verifyCoreDomainWrites(handle, browser([base()]))), /closed scoped connection/);
    assert.equal(sqlReads, before); assert.equal(openScopes, 0);
  });
  await test('Both exports reject an unowned or ended fixture handle', async () => {
    await assert.rejects(owner.verifyCoreDomainWrites({} as OwnedLocalHandle, browser([base()])));
    active = false;
    await assert.rejects(owner.readCoreDomainCheckpoint(handle, { id: commandId, kind: 'terminal-trash-set', entity: 'topics' }));
    await assert.rejects(owner.verifyCoreExecutedWriteProjections(handle, browser([base()], 'failed')));
    active = true;
  });
  // Canonical create builders produce the controlled persisted documents; the
  // real readback owner must independently project the Browser's authored paths.
  const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
  const formManifest=await jiti.import(resolve('src/lib/admin/form-system/adoption-manifest.ts')) as {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:Array<{id:string;surfaces:string[]}>};
  const createEntry=formManifest.ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.find(row=>row.id==='block-template-create-modals');assert.ok(createEntry);
  const feedModule=await jiti.import(resolve('src/lib/feed-modules/parse-feed-config.ts')) as {buildFeedModuleConfig:(form:FormData,kind:string)=>unknown};
  const formatModule=await jiti.import(resolve('src/lib/page-blocks/configs.ts')) as {buildPageBlockTextFormattingPatch:unknown};
  const utils=await jiti.import(resolve('src/lib/page-blocks/admin-utils.ts')) as {cleanText:unknown;parseNumber:unknown};
  const links=await jiti.import(resolve('src/lib/admin/links/block-save.ts')) as {linkFieldFromFormData:unknown;hasSavedLinkField:unknown};
  const cardsText=readFileSync(resolve('src/app/admin/pages-blocks/blocks/cards/actions.ts'),'utf8'),cardsAst=ts.createSourceFile('cards.ts',cardsText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const cardsFunctions=['buildCardsItems','assertValidCardsItems','buildCardsConfig'].map(name=>{const entries=cardsAst.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);assert.equal(entries.length,1);return entries[0].getText(cardsAst);}).join('\n');
  const cardsCode=ts.transpileModule(cardsFunctions,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const buildCards=new Function('cleanText','parseNumber','linkFieldFromFormData','hasSavedLinkField','buildPageBlockTextFormattingPatch',cardsCode+';return buildCardsConfig;')(utils.cleanText,utils.parseNumber,links.linkFieldFromFormData,links.hasSavedLinkField,formatModule.buildPageBlockTextFormattingPatch) as (form:FormData)=>Record<string,unknown>;
  const feedForm=new FormData();feedForm.set('widget_title','Authored create Feed');feedForm.set('limit','3');
  const cardsForm=new FormData();cardsForm.set('item_0_title','Authored create Card');cardsForm.set('item_0_body','Authored create Card body');
  const canonicalFeed=feedModule.buildFeedModuleConfig(feedForm,'latest'),canonicalCards=buildCards(cardsForm);
  await db.exec('alter table public.hero_templates add column slug text;alter table public.content_block_templates add column slug text;alter table public.content_block_templates add column config jsonb;');
  for(const [index,surface]of createEntry.surfaces.entries()){
    const [kind,operation]=surface.split(':');assert.equal(operation,'create');const id=200+index,name='Authored '+kind,slug='authored-'+kind;
    const authored=kind==='feed'?[{name:'widget_title',path:['presentation','title'],value:'Authored create Feed'}]:kind==='cards'?[{name:'item_0_title',path:['items','0','title'],value:'Authored create Card'},{name:'item_0_body',path:['items','0','body'],value:'Authored create Card body'}]:[];
    const descriptor=buildCoreTemplateCreateReadback(kind,id,name,slug,authored),config=kind==='feed'?canonicalFeed:kind==='cards'?canonicalCards:{unclaimedDefault:'not authored'};
    assert.match(descriptor.table,/^[a-z][a-z0-9_]*$/);
    await db.exec('create table if not exists public.'+descriptor.table+'(id bigint primary key,name text,slug text,config jsonb)');
    await db.query('insert into public.'+descriptor.table+'(id,name,slug,config) values($1,$2,$3,$4)',[id,name,kind==='breadcrumb'?'generated-by-domain':slug,JSON.stringify(config)]);
    await audit(1000+index,'content_block_template',id,name,'content_block_template.create',descriptor.auditMetadata);

    if(kind==='featured'){
      const selected='hero',projection={column:'config',path:['presentation','variant'],value:selected},projected={...descriptor,expectedJson:[projection]};
      await db.query('update public.featured_module_templates set config=$1 where id=$2',[JSON.stringify({presentation:{variant:selected}}),id]);
      const readFeatured=()=>owner.readCoreDomainWriteCheckpoint(handle,browser([projected],'in-progress-form-native-checkpoint'));
      await test('Featured create reads its actual config presentation variant without a scalar column',async()=>{const result=await readFeatured();assert.deepEqual(result.writes[0].json,[{column:'config',path:['presentation','variant'],actual:selected}]);});
      for(const invalid of [{},{presentation:{variant:'wrong'}}])await test('Featured create rejects missing or wrong persisted presentation variant '+JSON.stringify(invalid),async()=>{await db.query('update public.featured_module_templates set config=$1 where id=$2',[JSON.stringify(invalid),id]);try{await assert.rejects(readFeatured());}finally{await db.query('update public.featured_module_templates set config=$1 where id=$2',[JSON.stringify({presentation:{variant:selected}}),id]);}});
      for(const field of ['variant','feed_type'])await test('Featured rejects nonexistent scalar '+field+' before SQL',async()=>{const before=sqlReads;await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,browser([{...descriptor,expected:{...descriptor.expected,[field]:selected}}],'in-progress-form-native-checkpoint')));assert.equal(sqlReads,before);});
      await db.query('update public.featured_module_templates set config=$1 where id=$2',[JSON.stringify(config),id]);
    }else{
    const scalarField=kind==='feed'?'feed_type':'variant',foreignField=kind==='feed'?'variant':'feed_type',scalarValue=kind==='feed'?'latest':'owned-variant';
    await db.exec('alter table public.'+descriptor.table+' add column if not exists '+scalarField+' text');
    await db.query('update public.'+descriptor.table+' set '+scalarField+'=$1 where id=$2',[scalarValue,id]);
    const scalarDescriptor={...descriptor,expected:{...descriptor.expected,[scalarField]:scalarValue}};
    const readScalar=()=>owner.readCoreDomainWriteCheckpoint(handle,browser([scalarDescriptor],'in-progress-form-native-checkpoint'));
    await test('Template '+kind+' permits only its canonical '+scalarField+' native projection',async()=>{const result=await readScalar();assert.ok(result.writes[0].actual);assert.equal(result.writes[0].actual[scalarField],scalarValue);});
    await test('Template '+kind+' rejects a different persisted '+scalarField,async()=>{await db.query('update public.'+descriptor.table+' set '+scalarField+'=$1 where id=$2',['wrong-persisted-value',id]);try{await assert.rejects(readScalar());}finally{await db.query('update public.'+descriptor.table+' set '+scalarField+'=$1 where id=$2',[scalarValue,id]);}});
    await test('Template '+kind+' rejects a false expected '+scalarField,async()=>{await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,browser([{...scalarDescriptor,expected:{...scalarDescriptor.expected,[scalarField]:'wrong-expectation'}}],'in-progress-form-native-checkpoint')));});
    await test('Template '+kind+' rejects cross-kind '+foreignField+' before SQL',async()=>{const before=sqlReads;await assert.rejects(owner.readCoreDomainWriteCheckpoint(handle,browser([{...descriptor,expected:{...descriptor.expected,[foreignField]:scalarValue}}],'in-progress-form-native-checkpoint')));assert.equal(sqlReads,before);});
    }

    const read=()=>owner.readCoreDomainWriteCheckpoint(handle,browser([descriptor],'in-progress-form-native-checkpoint'));
    await test('Template create '+kind+' actual native authored fields/config and actor-bound creation audit',async()=>{const result=await read();assert.equal(result.writes.length,1);assert.deepEqual(result.writes[0].actual,descriptor.expected);assert.deepEqual(result.writes[0].json,descriptor.expectedJson.map((row:{column:string;path:string[];value:string})=>({column:row.column,path:row.path,actual:row.value})));assert.equal(result.writes[0].expectedActorId,7);});
    if(kind==='breadcrumb'){await test('Breadcrumb generated slug is not an authored identity claim',async()=>{assert.equal(Object.hasOwn(descriptor.expected,'slug'),false);assert.deepEqual(descriptor.expectedJson,[]);await read();});}
    else await test('Template create '+kind+' rejects a different persisted authored slug',async()=>{await db.query('update public.'+descriptor.table+' set slug=$1 where id=$2',['different-authored-slug',id]);try{await assert.rejects(read());assert.equal(statements.at(-1),'rollback');}finally{await db.query('update public.'+descriptor.table+' set slug=$1 where id=$2',[slug,id]);}});
    for(const projection of authored){
      for(const missing of [false,true])await test('Template create '+kind+' rejects '+(missing?'missing ':'changed ')+projection.name,async()=>{const changed=JSON.parse(JSON.stringify(config)) as Record<string,unknown>;let cursor=changed;for(const key of projection.path.slice(0,-1))cursor=cursor[key] as Record<string,unknown>;const last=projection.path.at(-1)!;if(missing)delete cursor[last];else cursor[last]='Different persisted value';await db.query('update public.'+descriptor.table+' set config=$1 where id=$2',[JSON.stringify(changed),id]);try{await assert.rejects(read());assert.equal(statements.at(-1),'rollback');}finally{await db.query('update public.'+descriptor.table+' set config=$1 where id=$2',[JSON.stringify(config),id]);}});
    }
    await test('Template create '+kind+' still rejects a missing creation audit',async()=>{await db.query('update public.admin_audit_logs set entity_type=$1 where id=$2',['wrong-domain',1000+index]);try{await assert.rejects(read());}finally{await db.query('update public.admin_audit_logs set entity_type=$1 where id=$2',['content_block_template',1000+index]);}});
  }
  await test('Authored create descriptor rejects missing, reordered and invented config projections',async()=>{
    assert.throws(()=>buildCoreTemplateCreateReadback('feed',999,'Authored','authored',[]));
    assert.throws(()=>buildCoreTemplateCreateReadback('feed',999,'Authored','authored',[{name:'widget_title',path:['title'],value:'Authored'}]));
    assert.throws(()=>buildCoreTemplateCreateReadback('cards',999,'Authored','authored',[{name:'item_0_body',path:['items','0','body'],value:'Body'},{name:'item_0_title',path:['items','0','title'],value:'Title'}]));
    assert.throws(()=>buildCoreTemplateCreateReadback('breadcrumb',999,'Authored','unclaimed',[{name:'title',path:['title'],value:'Unrendered'}]));
  });
  assert.ok(statements.every(sql => /^(?:select |begin isolation level repeatable read read only$|commit$|rollback$)/i.test(sql)), 'The actual helper emitted a non-read-only statement.');
  console.log(JSON.stringify({ status: 'pass', cases: checks.length, checks, scope: 'Actual helper and PostgreSQL SQL through PGlite; owner-port identity is an offline fixture. No live owner, Browser or hosted database claim.' }, null, 2));
} finally { await db.close(); }

/** Actual inventory child/pulse owner with local unit ports; no database or Browser execution. */
export async function verifyCoreCanonicalInventoryPulseControls(){
 const {execFile,execFileSync}=await import('node:child_process'),sourceFile=resolve(import.meta.dirname,'verify-admin-adoption-readback-isolated.mts'),source=readFileSync(sourceFile,'utf8'),ast=ts.createSourceFile(sourceFile,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),one=<T,>(values:T[])=>{assert.equal(values.length,1);return values[0];},declaration=one(ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='runCoreCanonicalInventoryProducer'));
 const code=ts.transpileModule(declaration.getText(ast).replaceAll('import.meta.dirname',JSON.stringify(import.meta.dirname)),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,checks:string[]=[];
 type Options={execThrow?:Error;clock?:()=>number;finishAfterQueries?:number;idleMs?:number;delay?:number;timeout?:number;exit?:number;query?:(count:number)=>Promise<void>;identity?:(count:number)=>Record<string,unknown>};
 const make=(options:Options={})=>{const clock=options.clock??Date.now;let lastQuery=clock(),completeChild:(()=>void)|undefined;const jobs=new WeakSet();let queries=0,concurrent=0,maxConcurrent=0,children=0,closed=0,intervals=0;let closeResolve!:()=>void;const childClosed=new Promise<void>(resolve=>{closeResolve=resolve;});const owned={query:async(sql:string)=>{assert.equal(sql,'select current_database() as database,current_user as role,pg_backend_pid() as backend_pid');if(options.idleMs!==undefined)assert.ok(clock()-lastQuery<options.idleMs,'controlled idle deadline exceeded');lastQuery=clock();queries++;if(queries===options.finishAfterQueries)completeChild?.();concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);try{await options.query?.(queries);return{rows:[options.identity?.(queries)??{database:'postgres',role:'postgres',backend_pid:73}]};}finally{concurrent--;}}};
  const actual=new Function('assert','assertOwnedLocalHandle','coreCanonicalInventoryJobs','AbortController','setInterval','clearInterval','execFile','process','resolve',code+';return runCoreCanonicalInventoryProducer;')(assert,(handle:unknown)=>assert.equal(handle,owned),jobs,AbortController,(fn:()=>void,delay:number)=>{assert.equal(delay,20_000);intervals++;return setInterval(fn,10);},(timer:ReturnType<typeof setInterval>)=>{intervals--;clearInterval(timer);},(binary:string,args:string[],input:Record<string,unknown>,callback:(error:unknown)=>void)=>{assert.equal(binary,process.execPath);assert.deepEqual(args,[resolve(import.meta.dirname,'qa-admin-adoption-journeys.mjs'),'--inventory-only','--core-closure']);assert.equal(input.timeout,180_000);assert.equal(input.maxBuffer,4_000_000);assert.equal(input.windowsHide,true);assert.equal(input.encoding,'utf8');assert.equal(input.cwd,resolve(import.meta.dirname,'..'));const env=input.env as Record<string,string>;for(const key of['QA_ADMIN_USERNAME','QA_ADMIN_PASSWORD','QA_ADMIN_FIXTURES','QA_ADMIN_SOURCE_SHA256'])assert.equal(env[key],'');assert.equal(env.QA_ADMIN_OUTPUT,'controlled-inventory-only');assert.ok(input.signal instanceof AbortSignal);if(options.execThrow)throw options.execThrow;children++;const childCode=options.finishAfterQueries?`process.stdin.once('data',()=>process.exit(${options.exit??0}));`:`setTimeout(()=>process.exit(${options.exit??0}),${options.delay??90})`;const child=execFile(binary,['-e',childCode],{...input,timeout:options.timeout??2000},callback);completeChild=()=>{child.stdin?.end('complete');};child.once('close',()=>{closed++;closeResolve();});return child;},process,resolve);
  return{owned,jobActive:()=>jobs.has(owned),run:()=>actual(owned,'controlled-inventory-only') as Promise<void>,childClosed,state:()=>({queries,concurrent,maxConcurrent,children,closed,intervals})};};
 let normalClock=0;const normal=make({idleMs:60,clock:()=>normalClock,finishAfterQueries:3,query:async()=>{normalClock+=10;}});await normal.run();assert.ok(normal.state().queries>2);assert.deepEqual({...normal.state(),queries:0},{queries:0,concurrent:0,maxConcurrent:1,children:1,closed:1,intervals:0});checks.push('actual async child retains fixed arguments limits private env and serialized healthy backend pulses');
 let jumpClock=0;const jumped=make({idleMs:60,clock:()=>jumpClock,delay:500,query:async count=>{if(count===1)jumpClock=61;}});await assert.rejects(jumped.run(),/controlled idle deadline exceeded/);assert.equal(jumped.state().queries,1);assert.equal(jumped.state().children,1);assert.equal(jumped.state().closed,1);assert.equal(jumped.state().intervals,0);assert.equal(jumped.state().concurrent,0);assert.equal(jumped.jobActive(),false);checks.push('unchanged60ms deadline rejects explicit61ms clock jump and drains exact child without retry');
 let ticks=0;const timer=setInterval(()=>ticks++,10),started=Date.now();execFileSync(process.execPath,['-e','setTimeout(()=>{},100)'],{timeout:2000,windowsHide:true});clearInterval(timer);assert.equal(ticks,0);assert.ok(Date.now()-started>=100);assert.throws(()=>assert.ok(Date.now()-started<60,'controlled idle deadline exceeded'),/controlled idle deadline exceeded/);checks.push('original synchronous child blocks every scheduled keepalive beyond scaled60ms idle threshold');
 for(const [name,options,check]of[['child failure',{exit:7},(error:unknown)=>assert.equal((error as {code:number}).code,7)],['child timeout',{delay:500,timeout:35},(error:unknown)=>assert.equal((error as {killed:boolean}).killed,true)]] as Array<[string,Options,(error:unknown)=>void]>){const c=make(options);await assert.rejects(c.run(),error=>{check(error);return true;});assert.equal(c.state().closed,1);assert.equal(c.state().intervals,0);assert.equal(c.state().concurrent,0);checks.push('propagate '+name+' only after child closes and pulse drains');}
 const failure=new Error('controlled heartbeat failure'),failed=make({delay:500,query:async count=>{if(count===2)throw failure;}});await assert.rejects(failed.run(),error=>error===failure);assert.equal(failed.state().closed,1);assert.equal(failed.state().children,1);assert.equal(failed.state().intervals,0);assert.equal(failed.state().queries,2);checks.push('first heartbeat failure aborts exact child and propagates original error without retry or renewal');
 const initialFailure=new Error('controlled initial query failure'),initial=make({query:async()=>{throw initialFailure;}});await assert.rejects(initial.run(),error=>error===initialFailure);assert.equal(initial.state().children,0);assert.equal(initial.state().intervals,0);checks.push('initial failed owned query refuses child start');
 for(const [name,identity]of[['wrong database',()=>({database:'foreign',role:'postgres',backend_pid:73})],['wrong role',()=>({database:'postgres',role:'other',backend_pid:73})],['backend replaced',(count:number)=>({database:'postgres',role:'postgres',backend_pid:count===1?73:74})]] as Array<[string,(count:number)=>Record<string,unknown>]>){const c=make({identity});await assert.rejects(c.run());assert.equal(c.state().intervals,0);assert.equal(c.state().concurrent,0);checks.push('reject '+name+' without reopening the owned client');}
 let release!:()=>void,entered!:()=>void;const held=new Promise<void>(r=>{release=r;}),enteredPulse=new Promise<void>(r=>{entered=r;}),drain=make({query:async count=>{if(count===2){entered();await held;}}});let settled=false;const pending=drain.run().finally(()=>{settled=true;});await enteredPulse;await drain.childClosed;assert.equal(settled,false);assert.equal(drain.state().concurrent,1);release();await pending;assert.equal(drain.state().concurrent,0);assert.equal(drain.state().maxConcurrent,1);assert.equal(drain.state().queries,2);checks.push('child close drains existing query before return and overlapping timer ticks cannot enqueue another query');
 const overlap=make({delay:80});const first=overlap.run();await assert.rejects(overlap.run(),/cannot overlap/);await first;assert.equal(overlap.state().children,1);checks.push('same owned handle refuses concurrent inventory child scopes');
 const spawnError=new Error('controlled synchronous child creation error'),spawnFailure=make({execThrow:spawnError});await assert.rejects(spawnFailure.run(),error=>error===spawnError);assert.equal(spawnFailure.state().children,0);assert.equal(spawnFailure.state().intervals,0);assert.equal(spawnFailure.jobActive(),false);checks.push('synchronous child creation failure releases exact scope and interval with original error');
 let failRelease!:(error:Error)=>void,failEntered!:()=>void;const failingHeld=new Promise<void>((_,reject)=>{failRelease=reject;}),failingEntered=new Promise<void>(resolve=>{failEntered=resolve;}),lateError=new Error('controlled pulse fails after child close'),late=make({query:async count=>{if(count===2){failEntered();await failingHeld;}}});const lateRun=late.run(),lateRejected=assert.rejects(lateRun,error=>error===lateError);await failingEntered;await late.childClosed;assert.equal(late.state().concurrent,1);failRelease(lateError);await lateRejected;assert.equal(late.state().intervals,0);assert.equal(late.state().concurrent,0);assert.equal(late.jobActive(),false);checks.push('pending heartbeat failure after successful child close propagates original failure after drain');
 const callText=one(ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='verifyAdminAdoptionReadback')).getText(ast);assert.ok(callText.includes('await runCoreCanonicalInventoryProducer(handle,canonicalDirectory);'));assert.equal(callText.includes('execFileSync('),false);assert.ok(callText.indexOf('await runCoreCanonicalInventoryProducer(handle,canonicalDirectory);')<callText.indexOf('const canonical ='));assert.ok(!declaration.getText(ast).includes('renewDatabaseControlConnection'));checks.push('actual collector awaits exact same owner before consuming inventory with no retry reconnect or lifetime change');
 return checks;
}

/** Actual one-send capture helper; no Browser or database execution. */
export async function verifyCoreSitemapResponseCaptureControls(){
 const checks:string[]=[];
 const make=(change:Record<string,unknown>={})=>{
  const state={fetches:0,fulfilled:0,aborted:0,disposed:0},bytes=Buffer.from('0:{"a":"$@1","f":[]}\n1:{"checkedAt":"2026-10-05T00:00:00Z","effectiveSources":[],"checks":[]}\n');
  const failure=new Error('controlled-capture-failure'),disposeError=new Error('controlled-dispose-failure'),request={url:()=>String(change.url??'http://127.0.0.1:57749/admin/seo/sitemap'),method:()=>String(change.method??'POST'),headers:()=>({'next-action':change.action===false?'':'owned-action',cookie:'NEVER_EXPORT_COOKIE',authorization:'NEVER_EXPORT_AUTH'})};
  const response={url:()=>String(change.responseUrl??request.url()),status:()=>Number(change.status??200),headers:()=>({'content-type':String(change.type??'text/x-component'),'cache-control':'private, no-store','set-cookie':'NEVER_EXPORT_COOKIE',...(change.redirect?{'x-action-redirect':'/foreign'}:{})}),body:async()=>{if(change.bodyFailure)throw failure;return change.empty?Buffer.alloc(0):bytes;},dispose:async()=>{state.disposed++;if(change.disposeFailure)throw disposeError;}};
  const route={request:()=>request,fetch:async(options:unknown)=>{state.fetches++;assert.deepEqual(options,{maxRetries:0,maxRedirects:0});if(change.fetchFailure)throw failure;return response;},fulfill:async(options:{response:unknown;body:Buffer})=>{state.fulfilled++;assert.equal(options.response,response);assert.equal(options.body,bytes);assert.deepEqual(Object.keys(options).sort(),['body','response']);if(change.fulfillFailure)throw failure;},abort:async(reason:string)=>{assert.equal(reason,'failed');state.aborted++;}};
  return {state,bytes,failure,disposeError,route};
 };
 const good=make(),proof=await captureCoreSitemapActionResponse(good.route,'http://127.0.0.1:57749');assert.deepEqual(good.state,{fetches:1,fulfilled:1,aborted:0,disposed:1});assert.deepEqual(Buffer.from(proof.bodyBase64,'base64'),good.bytes);assert.equal(proof.byteLength,good.bytes.length);assert.equal(proof.bodySha256,require('node:crypto').createHash('sha256').update(good.bytes).digest('hex'));assert.equal(proof.httpStatus,200);assert.equal(proof.contentType,'text/x-component');assert.equal(proof.fulfilledUnchanged,true);assert.ok(!JSON.stringify(proof).includes('NEVER_EXPORT'));checks.push('single request, zero retry/redirect, unchanged response/body, no credentials');
 for(const[name,change]of [['foreign origin',{url:'http://127.0.0.1:57750/admin/seo/sitemap'}],['foreign path',{url:'http://127.0.0.1:57749/admin/other'}],['wrong method',{method:'GET'}],['missing action',{action:false}],['redirect status',{status:303}],['failed status',{status:500}],['foreign response',{responseUrl:'http://127.0.0.1:57750/admin/seo/sitemap'}],['wrong type',{type:'text/html'}],['action redirect',{redirect:true}],['empty body',{empty:true}]] as Array<[string,Record<string,unknown>]>) {const c=make(change);await assert.rejects(captureCoreSitemapActionResponse(c.route,'http://127.0.0.1:57749'));assert.equal(c.state.fulfilled,0);assert.equal(c.state.aborted,1);assert.ok(c.state.fetches<=1);checks.push('reject '+name+' without fulfillment or resend');}
 for(const stage of ['fetchFailure','bodyFailure','fulfillFailure']){const c=make({[stage]:true});await assert.rejects(captureCoreSitemapActionResponse(c.route,'http://127.0.0.1:57749'),error=>error===c.failure);assert.equal(c.state.fetches,1);assert.equal(c.state.aborted,1);assert.equal(c.state.disposed,stage==='fetchFailure'?0:1);checks.push('original '+stage+' propagated, abort, no retry');}
 const disposal=make({disposeFailure:true});await assert.rejects(captureCoreSitemapActionResponse(disposal.route,'http://127.0.0.1:57749'),error=>error===disposal.disposeError);assert.equal(disposal.state.disposed,1);assert.equal(disposal.state.fetches,1);checks.push('dispose failure remains a failure after one fulfillment');
 const original=make({bodyFailure:true,disposeFailure:true});await assert.rejects(captureCoreSitemapActionResponse(original.route,'http://127.0.0.1:57749'),error=>error===original.failure);assert.equal(original.state.disposed,1);checks.push('dispose cannot mask original capture error');
 return checks;
}

async function verifyCoreSitemapCaptureLifecycleControls(){
 const checks:string[]=[],root=resolve(import.meta.dirname,'fixtures');
 const extract=(path:string,name:string)=>{const tree=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const nodes=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.equal(nodes.length,1);return nodes[0].getText(tree).replace(/^export /u,'');};
 const register=new Function('assert',extract(resolve(root,'admin-core-form-permission-context.mjs'),'registerCorePageRoute')+';return registerCorePageRoute;')(assert);
 const source=extract(resolve(root,'admin-core-readonly-journeys.mjs'),'runCoreSitemapClosureJourney'),dynamic='await import("./admin-core-rendered-adoption.mjs")';assert.equal(source.split(dynamic).length,2);
 for(const mode of ['early-ui-failure','parser-failure','duplicate-before-first-completion']){
  let callback:(route:unknown)=>Promise<void>=async()=>{throw new Error('not registered');},releaseBody:()=>void=()=>{throw new Error('not pending');};const bodyGate=new Promise<void>(resolve=>{releaseBody=resolve;}),uiError=new Error('controlled-ui-failure'),stats={fetches:0,disposed:0,unroutes:0,aborted:0,writes:0,native:0},jobs:Promise<void>[]=[],written:{path:string;text:string;options:unknown}[]=[];
  const bytes=Buffer.from('0:{"a":"not-a-health-snapshot","f":[]}\n'),page:Record<string,unknown>={};
  const request={url:()=> 'http://127.0.0.1:57749/admin/seo/sitemap',method:()=> 'POST',headers:()=>({'next-action':'owned-action'}),serviceWorker:()=>null,frame:()=>({page:()=>page})};
  const response={url:request.url,status:()=>200,headers:()=>({'content-type':'text/x-component'}),body:async()=>{await bodyGate;return bytes;},dispose:async()=>{stats.disposed++;}};
  const route={request:()=>request,fetch:async(options:unknown)=>{assert.deepEqual(options,{maxRetries:0,maxRedirects:0});stats.fetches++;return response;},fulfill:async(value:{response:unknown;body:Buffer})=>{assert.equal(value.response,response);assert.deepEqual(value.body,bytes);},abort:async()=>{stats.aborted++;},fallback:async()=>{throw new Error('unexpected fallback');}};
  const grid={kind:'grid',locator:()=>({count:async()=>1})},button={kind:'button',click:async()=>{jobs.push(callback(route));}},context={route:async(_url:string,handler:typeof callback)=>{callback=handler;},unroute:async()=>{stats.unroutes++;}};
  Object.assign(page,{context:()=>context,goto:async()=>{},getByRole:(role:string,options:{name:string})=>role==='region'?grid:role==='heading'?{kind:'heading'}:options.name==='جارٍ الفحص...'?{kind:'pending'}:button,keyboard:{press:async()=>{if(mode==='duplicate-before-first-completion')jobs.push(callback(route));}}});
  const expectPort=()=>({toBeVisible:async()=>{},toBeEnabled:async()=>{},toBeDisabled:async()=>{if(mode==='early-ui-failure')throw uiError;}});
  const invoke=new Function('assert','expect','randomUUID','registerCorePageRoute','captureCoreSitemapActionResponse','writeFileSync','join','resolve','process','CORE_SITEMAP_CLOSURE_SELECTION','CORE_SITEMAP_CLOSURE_IDS',source.replace(dynamic,'({observeCoreScrollbarAdoption:()=>{throw new Error("unreached scrollbar");}})')+';return runCoreSitemapClosureJourney;')(assert,expectPort,require('node:crypto').randomUUID,register,captureCoreSitemapActionResponse,(path:string,text:string,options:unknown)=>{stats.writes++;written.push({path,text,options});},require('node:path').join,resolve,{env:{QA_ADMIN_OUTPUT:resolve('.tmp-qa/controlled-sitemap-capture'),QA_ADMIN_SOURCE_SHA256:'a'.repeat(64)}},CORE_SITEMAP_CLOSURE_SELECTION,CORE_SITEMAP_CLOSURE_IDS);
  let settled=false;const work=invoke({page,origin:'http://127.0.0.1:57749',journeySelection:CORE_SITEMAP_CLOSURE_SELECTION,requiredCases:[],run:(_id:string,_coverage:unknown,task:()=>Promise<unknown>)=>task(),observe:(_label:string,task:()=>Promise<unknown>)=>task(),nativeCheckpoint:async(input:Record<string,unknown>)=>{stats.native++;return{...input,status:'pass',ownedRunId:'controlled-owned-run'};}}).then(()=>{settled=true;throw new Error('must fail');},(error:unknown)=>{settled=true;throw error;});void work.catch(()=>{});
  await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(stats.fetches,1);if(mode!=='parser-failure')assert.equal(stats.unroutes,1);releaseBody();await assert.rejects(work,(error:unknown)=>mode==='early-ui-failure'?error===uiError:error instanceof Error);await Promise.all(jobs);assert.equal(stats.fetches,1);assert.equal(stats.disposed,1);assert.equal(stats.unroutes,1);assert.equal(stats.native,1);
  if(mode==='parser-failure'){assert.equal(stats.writes,1);assert.equal(require('node:path').basename(written[0].path),'core-sitemap-action-response.json');assert.deepEqual(written[0].options,{flag:'wx'});const artifact=JSON.parse(written[0].text);assert.equal(artifact.sourceSha256,'a'.repeat(64));assert.equal(artifact.ownedRunId,'controlled-owned-run');assert.deepEqual(Buffer.from(artifact.commandResponse.bodyBase64,'base64'),bytes);}
  checks.push(mode+' preserves failure, one upstream request and owned handler drain'+(mode==='parser-failure'?' with actual bytes persisted before parsing':''));
 }
 return checks;
}
