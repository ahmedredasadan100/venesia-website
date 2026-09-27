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
const db = new PGlite();
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
const checks: string[] = [];
async function test(name: string, callback: () => Promise<void>) { await callback(); checks.push(name); }
async function rejectedBeforeSql(value: unknown) {
  const before = sqlReads; await assert.rejects(owner.verifyCoreDomainWrites(handle, browser([value]))); assert.equal(sqlReads, before);
}
try {
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
