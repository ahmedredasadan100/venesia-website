import {coreTopicControlFixtureSlug} from "./fixtures/admin-core-topic-controls-contract.mjs";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import type { OwnedLocalHandle } from './lib/isolated-supabase.mts';

type Owner = typeof import('./verify-admin-core-domain-write-fault-isolated.mts');
const require = createRequire(import.meta.url), db = new PGlite();
const filename = resolve(import.meta.dirname, 'verify-admin-core-domain-write-fault-isolated.mts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename.replace(/\.mts$/, '.ts'), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const fixtures = { topic: { id: 1 }, category: { id: 2 }, series: { id: 3 }, pages: { pageId: 4 }, project: { id: 5 }, commandClosure: {
  tracking: { stage: { id: 6 }, item: { id: 7 }, update: { id: 8 } }, redirect: { id: 9 }, adminUser: { id: 10 },
  locations: ['governorate', 'city', 'main_area', 'sub_area'].map((level, index) => ({ entity: 'project_locations_' + level, level, id: 11 + index })),
} };
const candidate = () => ({ pid: 200, backend_start: '2026-01-01T00:00:00Z', query_start: '2026-01-01T01:00:00Z', application_name: 'PostgREST', usename: 'authenticator', datname: 'postgres', state: 'active', backend_type: 'client backend', wait_event_type: 'Lock', blockers: [100], query_fingerprint: 'a'.repeat(32), signature_matches: true });
function fixture(templateControls?: {templates:Array<{id:number;kind:string;slug:string}>}, topicControls?: {topics:Array<{id:number;kind:string;slug:string}>}, projectControls?: {projects:Array<{id:number;kind:string;slug:string}>}, presentationControls?: {templates:Array<{id:number;kind:string;slug:string}>}) {
  let clock = Date.now(), nextTimer = 0, active = true, liveConnections = 0, rollbacks = 0, cancels = 0, connectionOrdinal = 0;
  let rejectHolder!: (error: Error) => void;
  const holderEnded = new Promise<never>((_resolve, reject) => { rejectHolder = reject; });
  const timers = new Map<number, () => void>(), signatures: string[] = [], statements: string[] = [];
  const faults = { rows: [candidate()] as Array<Record<string, unknown>>, cancelRows: [{ cancelled: true }] as Array<Record<string, unknown>>, targetMissing: false, identityRole: 'postgres', connectionFailure: false, rollbackFailure: false };
  const diagnostics: Array<{stage:string;metadata:Record<string,unknown>}> = [];
  const handle = { record:(stage:string,metadata:Record<string,unknown>)=>{diagnostics.push({stage,metadata});}, withDatabaseConnection: async <T,>(work: (connection: { query: (sql: string, params?: unknown[]) => Promise<{rows: Record<string, unknown>[];rowCount:number}> }) => Promise<T>) => {
    if (faults.connectionFailure) throw new Error('Offline connect failure');
    liveConnections++; const ordinal = ++connectionOrdinal;
    try { const execution = work({ query: async (sql, params = []) => {
      assert.ok(active); statements.push(sql);
      const placeholders = Array.from(sql.matchAll(/\$(\d+)/g), match => Number(match[1]));
      assert.equal(params.length, Math.max(0, ...placeholders), 'Every actual SQL statement must bind exactly its declared parameters.');
      const rows = (() => {
        if (sql === 'rollback') { rollbacks++; if (faults.rollbackFailure) throw new Error('Offline rollback failure'); return []; }
        if (sql.startsWith('begin') || sql.startsWith('set local') || sql.includes('pg_stat_clear_snapshot')) return [];
        if (sql.startsWith('select pg_backend_pid()')) return [{ pid: 100, database: 'postgres', role: faults.identityRole, backend_start: '2026-01-01T00:00:00Z' }];
        if (sql.includes('for update')) return faults.targetMissing ? [] : [{ id: params[0], slug: templateControls?.templates.find(row=>row.id===Number(params[0]))?.slug ?? topicControls?.topics.find(row=>row.id===Number(params[0]))?.slug ?? projectControls?.projects.find(row=>row.id===Number(params[0]))?.slug ?? presentationControls?.templates.find(row=>row.id===Number(params[0]))?.slug, level: ['governorate', 'city', 'main_area', 'sub_area'][Number(params[0]) - 11] }];
        if (sql.startsWith('select pid,backend_start')) { signatures.push(String(params[1])); return faults.rows; }
        if (sql.startsWith('select a.pid observed_pid')) return faults.cancelRows.length ? [{ observed_pid: faults.rows[0]?.pid }] : [];
        if (sql.startsWith('select pg_cancel_backend')) {
          cancels++; assert.equal(params[0], 200); assert.equal(params[4], 100); assert.equal(params[3], 'a'.repeat(32));
          assert.ok(sql.includes('a.backend_start=$2::timestamptz') && sql.includes('a.query_start=$3::timestamptz') && sql.includes('md5(a.query)=$4'));
          assert.equal(params[6], '2026-01-01T00:00:00Z'); assert.ok(sql.includes('h.backend_start=$7::timestamptz') && sql.includes("h.state='idle in transaction'"));
          assert.ok(sql.includes('pg_blocking_pids(a.pid)=array[$5::integer]') && sql.includes("a.usename='authenticator'") && sql.includes(')=1'));
          return faults.cancelRows;
        }
        throw new Error('Unexpected offline fixture statement');
      })();
      return { rows, rowCount: rows.length };
    } }); return await (ordinal === 1 ? Promise.race([execution, holderEnded]) : execution); } finally { liveConnections--; }
  } } as unknown as OwnedLocalHandle;
  class Clock extends Date { static now() { return clock; } }
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'Date', 'setTimeout', 'clearTimeout', compiled)((specifier: string) => {
    if (specifier === './lib/isolated-supabase.mts') return { assertOwnedLocalHandle: (input: unknown) => { assert.ok(active); assert.equal(input, handle); } };
    if (specifier === './fixtures/admin-core-topic-controls-contract.mjs') return require(resolve(process.cwd(),'scripts/fixtures/admin-core-topic-controls-contract.mjs'));
    if (specifier === './fixtures/admin-core-presentation-controls-contract.mjs') return require(resolve(process.cwd(),'scripts/fixtures/admin-core-presentation-controls-contract.mjs'));
    if (specifier === './fixtures/admin-core-project-controls-contract.mjs') return require(resolve(process.cwd(),'scripts/fixtures/admin-core-project-controls-contract.mjs'));
    if (specifier === './fixtures/admin-core-template-controls-contract.mjs') return require(resolve(process.cwd(),'scripts/fixtures/admin-core-template-controls-contract.mjs'));
    assert.equal(specifier, 'node:assert/strict'); return require(specifier);
  }, loaded, loaded.exports, Clock, (callback: () => void, delay: number) => {
    const id = ++nextTimer;
    if (delay === 100) { clock += delay; queueMicrotask(callback); } else timers.set(id, callback);
    return id;
  }, (id: number) => timers.delete(id));
  const owner = loaded.exports as Owner, broker = owner.createOwnedCoreDomainWriteFaults(handle, {...fixtures,...(templateControls?{templateControls}:{}),...(topicControls?{topicControls}:{}),...(projectControls?{projectControls,commercialProject:{id:401}}:{}),...(presentationControls?{presentationControls}:{})});
  const token = randomUUID();
  const request = (kind: string, entity = 'categories', override: Record<string, unknown> = {}) => broker.handleRequest({ id: randomUUID(), kind: 'domain-write-fault-' + kind, token, entity, ...override });
  return { owner, handle, broker, request, faults, signatures, statements, diagnostics, counts: () => ({ liveConnections, rollbacks, cancels }),
    disconnectHolder: () => rejectHolder(new Error('Offline owned holder disconnected')),
    expire: () => { clock += 45_000; for (const callback of [...timers.values()]) callback(); }, end: () => { active = false; } };
}
const checks: string[] = [];
const test = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); };
try {

  await test('Inspection failure preserves strict rejection and records bounded atomic identity diagnostic',async()=>{
    const f=fixture();await f.request('arm');f.faults.cancelRows=[];
    await assert.rejects(f.request('cancel'),/exact observed backend/);
    assert.equal(f.diagnostics.length,1);const entry=f.diagnostics[0];
    assert.equal(entry.stage,'core-domain-fault-inspection-failed');
    assert.deepEqual(Object.keys(entry.metadata).sort(),['requestId','operation','phase','candidateCount','connectionElapsedMs','elapsedMs','previouslyObserved','holderFinished','holderFailed','deadlineExpired'].sort());
    assert.equal(entry.metadata.phase,'atomic-identity');assert.equal(entry.metadata.candidateCount,1);assert.equal(entry.metadata.operation,'cancel');
    assert.equal(f.counts().liveConnections,0);await f.broker.close();
  });
  await test('Diagnostics distinguish no matching statement timeout from identity rejection',async()=>{
    const f=fixture();await f.request('arm');f.faults.rows=[];
    await assert.rejects(f.request('cancel'),/No uniquely attributable/);
    assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].metadata.phase,'deadline');assert.equal(f.diagnostics[0].metadata.candidateCount,0);
    assert.equal(f.counts().cancels,0);assert.equal(f.counts().liveConnections,0);await f.broker.close();
  });

  await test('Removed Footer Restore fault target rejects before any lock',async()=>{
    const f=fixture();await assert.rejects(f.request('arm','footer_restore'));assert.equal(f.statements.length,0);await f.broker.close();
  });
  await test('Read-only observation retains one exact query, never cancels, and releases with normal success', async () => {
    const f = fixture(); await f.request('arm');
    const first = await f.request('observe-blocked'), second = await f.request('observe-blocked');
    assert.equal(first.observedOneStatement, true); assert.equal(first.cancelledOneStatement, false); assert.equal(first.state, 'armed');
    assert.equal(first.queryFingerprint, second.queryFingerprint); assert.equal(f.counts().cancels, 0);
    const released = await f.request('release'); assert.equal(released.cancellationObserved, false); assert.equal(f.counts().liveConnections, 0); await f.broker.close();
  });
  await test('Observed query identity cannot be replaced by a second save under the same token', async () => {
    const f = fixture(); await f.request('arm'); await f.request('observe-blocked');
    f.faults.rows[0].query_start = '2026-01-01T01:00:01Z';
    await assert.rejects(f.request('observe-blocked')); assert.equal(f.counts().cancels,0); assert.equal(f.counts().liveConnections,0); await f.broker.close();
  });
  await test('Observation rejects multiple statements, foreign role and changed signature without cancelling', async () => {
    for(const rows of [[candidate(),{...candidate(),pid:201}],[{...candidate(),usename:'postgres'}],[{...candidate(),signature_matches:false}]]){
      const f=fixture();await f.request('arm');f.faults.rows=rows;await assert.rejects(f.request('observe-blocked'));assert.equal(f.counts().cancels,0);assert.equal(f.counts().liveConnections,0);await f.broker.close();
    }
  });
  await test('Observation atomic recheck rejects expired captured backend identity', async () => {
    const f=fixture();await f.request('arm');f.faults.cancelRows=[];await assert.rejects(f.request('observe-blocked'));assert.equal(f.counts().cancels,0);assert.equal(f.counts().liveConnections,0);await f.broker.close();
  });
  await test('Arm returns promptly with one owned connection; exactly matched cancel remains held until explicit rollback release', async () => {
    const f = fixture(); const armed = await f.request('arm'); assert.equal(armed.state, 'armed'); assert.equal(f.counts().liveConnections, 1);
    const cancelled = await f.request('cancel'); assert.equal(cancelled.cancelledOneStatement, true); assert.equal(f.counts().liveConnections, 1);
    const released = await f.request('release'); assert.equal(released.ownedLockRolledBack, true); assert.equal(released.cancellationObserved, true);
    assert.deepEqual(f.counts(), { liveConnections: 0, rollbacks: 1, cancels: 1 }); await f.broker.close();
  });
  await test('Browser cannot choose SQL, table, row ID, PID, unknown entity, malformed UUID or operation', async () => {
    for (const extra of [{ sql: 'select 1' }, { table: 'admin_users' }, { fixtureId: 1 }, { pid: 200 }, { entity: 'admin_audit_logs' }, { token: 'bad' }, { kind: 'anything' }]) {
      const f = fixture(); await assert.rejects(f.request('arm', 'categories', extra)); assert.equal(f.statements.length, 0); await f.broker.close();
    }
  });
  await test('Only the current exact token can operate a held fault', async () => {
    const f = fixture(); await f.request('arm');
    await assert.rejects(f.request('cancel', 'categories', { token: randomUUID() })); assert.equal(f.counts().cancels, 0); assert.equal(f.counts().liveConnections, 1);
    await f.request('release'); await assert.rejects(f.request('arm')); await f.broker.close();
  });
  await test('No second statement cancellation or simultaneous armed fault is admitted', async () => {
    const f = fixture(); await f.request('arm'); await assert.rejects(f.request('arm', 'series', { token: randomUUID() }));
    await f.request('cancel'); await assert.rejects(f.request('cancel')); assert.equal(f.counts().cancels, 1); assert.equal(f.counts().liveConnections, 0); await f.broker.close();
  });
  await test('No candidate, multiple candidates, changed role/database/backend kind/blockers/signature reject without cancelling another statement', async () => {
    const cases = [[], [candidate(), { ...candidate(), pid: 201 }], ...[
      { usename: 'postgres' }, { datname: 'production' }, { backend_type: 'parallel worker' }, { blockers: [100, 101] }, { signature_matches: false },
      { backend_start: 'bad' }, { application_name: 'unsafe\nvalue' }, { query_fingerprint: 'bad' }, { state: 'idle' }, { wait_event_type: 'IO' },
    ].map(change => [{ ...candidate(), ...change }])];
    for (const rows of cases) { const f = fixture(); f.faults.rows = rows; await f.request('arm'); await assert.rejects(f.request('cancel')); assert.equal(f.counts().cancels, 0); assert.equal(f.counts().liveConnections, 0); await f.broker.close(); }
  });
  await test('Backend identity change at the atomic cancellation query remains failure and releases the lock', async () => {
    for (const rows of [[], [{ cancelled: false }]]) { const f = fixture(); f.faults.cancelRows = rows; await f.request('arm'); await assert.rejects(f.request('cancel')); assert.equal(f.counts().liveConnections, 0); await f.broker.close(); }
  });
  await test('Missing target, wrong owner role and connection failure never leave an armed connection', async () => {
    for (const fault of [{ targetMissing: true }, { identityRole: 'service_role' }, { connectionFailure: true }]) {
      const f = fixture(); Object.assign(f.faults, fault); await assert.rejects(f.request('arm')); assert.equal(f.counts().liveConnections, 0); await f.broker.close();
    }
  });
  await test('Unexpected owned-holder completion blocks cancellation and retains failed cleanup', async () => {
    const f = fixture(); await f.request('arm'); f.disconnectHolder();
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(f.request('cancel')); assert.equal(f.counts().cancels, 0);
    await assert.rejects(f.broker.close()); assert.equal(f.counts().liveConnections, 0);
  });
  await test('Expiry automatically rolls back and cannot be relabeled passing cleanup', async () => {
    const f = fixture(); await f.request('arm'); f.expire(); await assert.rejects(f.broker.close()); assert.equal(f.counts().liveConnections, 0); assert.equal(f.counts().rollbacks, 1);
  });
  await test('Closing an unused armed fault awaits rollback; rollback failure is retained', async () => {
    const f = fixture(); await f.request('arm'); assert.equal((await f.broker.close()).activeLocks, 0); assert.equal(f.counts().liveConnections, 0);
    const failed = fixture(); await failed.request('arm'); failed.faults.rollbackFailure = true; await assert.rejects(failed.broker.close()); assert.equal(failed.counts().liveConnections, 0);
  });
  await test('Closed broker and ended/unowned handle cannot issue database operations', async () => {
    const f = fixture(); await f.broker.close(); await assert.rejects(f.request('arm'));
    assert.throws(() => f.owner.createOwnedCoreDomainWriteFaults({} as OwnedLocalHandle, fixtures));
    const ended = fixture(); ended.end(); await assert.rejects(ended.request('arm')); assert.equal(ended.statements.length, 0);
  });
  await test('Actual PostgreSQL regex permits fixed mutation signatures and rejects neighboring tables, reads and unrelated RPCs', async () => {
    const samples: Record<string, string> = { categories: 'WITH pgrst_source AS (UPDATE "public"."topic_categories" SET "status" = $1 WHERE id=$2 RETURNING *) SELECT * FROM pgrst_source',
      topics: 'SELECT * FROM "public"."admin_mutate_topics_batch_atomically"($1,$2,$3)', projects: 'SELECT * FROM "public"."set_project_publication_admin_entry"($1,$2,$3)',
      project_locations_city: 'SELECT * FROM "public"."mutate_project_location"($1,$2,$3)', project_tracking_updates: 'SELECT * FROM "public"."mutate_project_tracking_update"($1,$2,$3)' };
    for (const [entity, sample] of Object.entries(samples)) {
      const f = fixture(); await f.request('arm', entity); await f.request('cancel', entity); const pattern = f.signatures[0];
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches', [sample, pattern])).rows[0].matches, true);
      for (const wrong of ['SELECT * FROM "public"."topic_categories"', 'UPDATE "public"."topic_categories_archive" SET "status"=$1', 'SELECT * FROM "public"."unrelated_rpc"($1)']) {
        assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches', [wrong, pattern])).rows[0].matches, false);
      }
      await f.request('release', entity); await f.broker.close();
    }
  });
  await test('Topics row visibility allows only its current status SET fields, retaining the separate atomic RPC paths',async()=>{
   const f=fixture();await f.request('arm','topics');await f.request('observe-blocked','topics');const pattern=f.signatures[0];
   const valid=['WITH pgrst_source AS (UPDATE "public"."topics" SET "status" = "pgrst_body"."status", "updated_at" = "pgrst_body"."updated_at", "updated_by" = "pgrst_body"."updated_by" FROM (SELECT $1) pgrst_body WHERE id=$2 RETURNING *) SELECT * FROM pgrst_source','UPDATE public.topics SET published_at=$1, status=$2, updated_at=$3 WHERE id=$4','SELECT * FROM public.admin_mutate_topics_batch_atomically($1,$2,$3)','SELECT * FROM public.admin_publish_topics_atomically($1,$2)'];
   const invalid=['UPDATE public.topics SET title=$1 WHERE id=$2','UPDATE public.topics SET status=$1,title=$2 WHERE id=$3','UPDATE public.topics SET updated_at=$1 WHERE id=$2','UPDATE public.topics SET status=$1,deleted_at=$2 WHERE id=$3','UPDATE public.topics SET status=$1,category_id=$2 WHERE id=$3','UPDATE public.topics_archive SET status=$1 WHERE id=$2','SELECT * FROM public.topics','SELECT * FROM public.admin_publish_topics_atomically_other($1)'];
   for(const sql of valid)assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',[sql,pattern])).rows[0].matches,true,sql);
   for(const sql of invalid)assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',[sql,pattern])).rows[0].matches,false,sql);
   await f.request('release','topics');assert.deepEqual(f.counts(),{liveConnections:0,rollbacks:1,cancels:0});await f.broker.close();
  });
  await test('Native callback accepts canonical PostgreSQL bigint strings and refuses coercive or unsafe fixture IDs before database work', async () => {
    const path = resolve(import.meta.dirname, 'verify-admin-core-domain-write-fault-postgres.mts');
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path.replace(/\.mts$/, '.ts'), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const requests: unknown[] = [];
    const handle = { query: async () => { requests.push('actor'); return { rows: [{ id: '7' }] }; }, callDataApiRpc: async (name: string, args: { p_topic_ids: number[] }) => {
      assert.equal(name, 'admin_mutate_topics_batch_atomically'); assert.deepEqual(args.p_topic_ids, [51]); requests.push('rpc'); return new Response(JSON.stringify({ code: '57014' }), { status: 500 });
    } } as unknown as OwnedLocalHandle;
    const loaded = { exports: {} };
    new Function('require', 'module', 'exports', source)((name: string) => {
      if (name === './lib/isolated-supabase.mts') return { assertOwnedLocalHandle: (value: unknown) => assert.equal(value, handle) };
      if (name === './verify-admin-core-domain-readback-isolated.mts') return { readCoreDomainCheckpoint: async (_handle: unknown, input: { ids: number[] }) => {
        assert.deepEqual(input.ids, [51]); requests.push('checkpoint'); return { id: randomUUID(), rows: [{ id: 51, is_featured: false }], audit: [] };
      } };
      if (name === './verify-admin-core-domain-write-fault-isolated.mts') return { createOwnedCoreDomainWriteFaults: () => {
        requests.push('factory'); return { handleRequest: async (input: { kind: string }) => {
          requests.push(input.kind); return { fixtureId: 51, cancelledOneStatement: true };
        }, close: async () => { requests.push('closed'); } };
      } };
      assert.ok(['node:assert/strict', 'node:crypto'].includes(name)); return require(name);
    }, loaded, loaded.exports);
    const native = loaded.exports as typeof import('./verify-admin-core-domain-write-fault-postgres.mts');
    for (const id of [51, '51']) {
      requests.length = 0;
      const result = await native.verifyOwnedCoreDomainWriteFaultProducer(handle, { topic: { id } });
      assert.equal(result.topicId, 51); assert.equal(result.status, 'pass'); assert.equal(requests.at(-1), 'closed');
      assert.equal(requests.filter(value => value === 'rpc').length, 1);
    }
    for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '', '0', '-1', '+51', ' 51', '51 ', '05', '5.1', '5e1', '0x33', '9007199254740992', true, null, undefined, {}, [51]]) {
      requests.length = 0;
      await assert.rejects(native.verifyOwnedCoreDomainWriteFaultProducer(handle, { topic: { id } } as { topic: { id: number } }));
      assert.equal(requests.length, 0, 'Invalid fixture identity must not open connections, query, arm or dispatch.');
    }
  });
  await test('Every fixed template target observes only the canonical save RPC and original reserved slug', async()=>{
    const recipes=require(resolve(process.cwd(),'scripts/fixtures/admin-core-template-controls-contract.mjs')).TEMPLATE_CONTROL_RECIPES;
    const templates=Object.keys(recipes).map((kind,index)=>({kind,id:101+index,slug:'qa-admin-page-interaction-'+kind+'-8'}));
    for(const row of templates){const f=fixture({templates});const entity='template_control_'+row.kind.replaceAll('-','_');await f.request('arm',entity);await f.request('observe-blocked',entity);
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['SELECT * FROM public.mutate_page_composition($1,$2,$3)',f.signatures[0]])).rows[0].matches,true);
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['SELECT * FROM public.mutate_page_composition_other($1)',f.signatures[0]])).rows[0].matches,false);
      await f.request('release',entity);await f.broker.close();assert.equal(f.counts().cancels,0);
    }
  });
  await test('Missing, duplicate, unreserved or unsafe template identity rejects before opening a database connection', async()=>{
    const recipes=require(resolve(process.cwd(),'scripts/fixtures/admin-core-template-controls-contract.mjs')).TEMPLATE_CONTROL_RECIPES;
    const templates=Object.keys(recipes).map((kind,index)=>({kind,id:101+index,slug:'qa-admin-page-interaction-'+kind+'-8'}));
    for(const rows of [templates.slice(1),[...templates,templates[0]],templates.map((row,index)=>index?row:{...row,id:0}),templates.map((row,index)=>index?row:{...row,slug:'production-template'})]){
      const f=fixture();assert.throws(()=>f.owner.createOwnedCoreDomainWriteFaults(f.handle,{...fixtures,templateControls:{templates:rows}}));assert.equal(f.statements.length,0);await f.broker.close();
    }
  });
  await test('All six fixed Topic edit targets permit only topics UPDATE, retaining the original row identity', async()=>{
    const kinds=require(resolve(process.cwd(),'scripts/fixtures/admin-core-topic-controls-contract.mjs')).TOPIC_CONTROL_KINDS as string[];
    const topics=kinds.map((kind,index)=>({kind,id:301+index,slug:coreTopicControlFixtureSlug(kind)}));
    for(const row of topics){const f=fixture(undefined,{topics});const entity='topic_control_'+row.kind;await f.request('arm',entity);await f.request('observe-blocked',entity);await f.request('cancel',entity);
      const pattern=f.signatures[0];
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['WITH pgrst_source AS (UPDATE "public"."topics" SET "title"=$1 WHERE id=$2 RETURNING *) SELECT * FROM pgrst_source',pattern])).rows[0].matches,true);
      for(const sql of ['SELECT * FROM public.topics','UPDATE public.topics_archive SET title=$1','SELECT * FROM public.admin_mutate_topics_batch_atomically($1)'])assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',[sql,pattern])).rows[0].matches,false);
      await f.request('release',entity);assert.equal(f.counts().cancels,1);assert.equal(f.counts().liveConnections,0);await f.broker.close();
    }
  });
  await test('Topic optional identities cannot widen the existing native producer',async()=>{
    const kinds=require(resolve(process.cwd(),'scripts/fixtures/admin-core-topic-controls-contract.mjs')).TOPIC_CONTROL_KINDS as string[];
    const topics=kinds.map((kind,index)=>({kind,id:301+index,slug:coreTopicControlFixtureSlug(kind)}));
    for(const rows of [topics.map(row=>row.kind==='site_update'?{...row,slug:'qa-core-topic-controls-site_update'}:row),topics.slice(1),[...topics,topics[0]],topics.map((row,index)=>index?row:{...row,slug:'production-topic'}),topics.map((row,index)=>index?row:{...row,id:0})]){
      const f=fixture();assert.throws(()=>f.owner.createOwnedCoreDomainWriteFaults(f.handle,{...fixtures,topicControls:{topics:rows}}));assert.equal(f.statements.length,0);await f.broker.close();
    }
  });
  await test('No Project opt-in preserves the existing publication-only native signature',async()=>{
    const f=fixture();await f.request('arm','projects');await f.request('observe-blocked','projects');const pattern=f.signatures[0];
    assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['select * from public.save_project_admin_entry($1,$2)',pattern])).rows[0].matches,false);
    await f.request('release','projects');await f.broker.close();
  });
  await test('Project opt-in uses one residential identity and one fixed commercial save target',async()=>{
    const projects=[{kind:'residential',id:5,slug:'qa-admin-complete-project'},{kind:'commercial',id:401,slug:'qa-admin-complete-commercial-project'}];
    for(const entity of ['projects','project_control_commercial']){
      const f=fixture(undefined,undefined,{projects});await f.request('arm',entity);await f.request('observe-blocked',entity);await f.request('cancel',entity);const pattern=f.signatures[0];
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['select * from "public"."save_project_admin_entry"($1,$2)',pattern])).rows[0].matches,true);
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['select * from public.set_project_publication_admin_entry($1,$2)',pattern])).rows[0].matches,entity==='projects');
      for(const sql of ['UPDATE public.projects SET slug=$1','select * from public.save_project_admin_entry_other($1)','select * from public.delete_project_admin_entry($1)'])assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',[sql,pattern])).rows[0].matches,false);
      await f.request('release',entity);assert.equal(f.counts().liveConnections,0);await f.broker.close();
    }
  });
  await test('Project opt-in cannot change fixture identity, add duplicate targets or widen arbitrary SQL',async()=>{
    const projects=[{kind:'residential',id:5,slug:'qa-admin-complete-project'},{kind:'commercial',id:401,slug:'qa-admin-complete-commercial-project'}];
    for(const rows of [projects.slice(1),[...projects,projects[0]],projects.map((row,index)=>index?row:{...row,id:999}),projects.map((row,index)=>index?row:{...row,slug:'production-project'}),projects.map((row,index)=>index?{...row,id:5}:row),projects.map((row,index)=>index?{...row,kind:'constructor'}:row)]){
      const f=fixture();assert.throws(()=>f.owner.createOwnedCoreDomainWriteFaults(f.handle,{...fixtures,commercialProject:{id:401},projectControls:{projects:rows}}));assert.equal(f.statements.length,0);await f.broker.close();
    }
  });
  await test('No presentation opt-in admits no additional native target',async()=>{const f=fixture();await assert.rejects(f.request('arm','presentation_control_hero'));assert.equal(f.statements.length,0);await f.broker.close();});
  await test('Fixed Hero and generic Content targets accept only canonical composition RPC',async()=>{
    const templates=[{kind:'hero',id:501,slug:'qa-admin-page-interaction-hero-8'},{kind:'content',id:502,slug:'qa-admin-page-interaction-content-8'}];
    for(const kind of ['hero','content']){const f=fixture(undefined,undefined,undefined,{templates});const entity='presentation_control_'+kind;await f.request('arm',entity);await f.request('observe-blocked',entity);await f.request('cancel',entity);const pattern=f.signatures[0];
      assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',['select * from "public"."mutate_page_composition"($1,$2,$3)',pattern])).rows[0].matches,true);
      for(const sql of ['UPDATE public.hero_templates SET config=$1','select * from public.mutate_page_composition_other($1)','select * from public.save_project_admin_entry($1)'])assert.equal((await db.query<{matches:boolean}>('select $1::text ~* $2::text as matches',[sql,pattern])).rows[0].matches,false);
      await f.request('release',entity);assert.equal(f.counts().liveConnections,0);await f.broker.close();
    }
  });
  await test('Presentation target opt-in rejects foreign slugs, missing/duplicated kinds, invalid IDs and cross-kind injection',async()=>{
    const templates=[{kind:'hero',id:501,slug:'qa-admin-page-interaction-hero-8'},{kind:'content',id:502,slug:'qa-admin-page-interaction-content-8'}];
    for(const rows of [templates.slice(1),[...templates,templates[0]],templates.map((row,index)=>index?row:{...row,id:0}),templates.map((row,index)=>index?row:{...row,slug:'real-hero'}),templates.map((row,index)=>index?row:{...row,kind:'__proto__'}),templates.map((row,index)=>index?{...templates[0]}:row)]){const f=fixture();assert.throws(()=>f.owner.createOwnedCoreDomainWriteFaults(f.handle,{...fixtures,presentationControls:{templates:rows}}));assert.equal(f.statements.length,0);await f.broker.close();}
    const f=fixture();const {TEMPLATE_CONTROL_RECIPES}=require(resolve(process.cwd(),'scripts/fixtures/admin-core-template-controls-contract.mjs'));const other=Object.keys(TEMPLATE_CONTROL_RECIPES).map((kind,index)=>({kind,id:600+index,slug:'qa-admin-page-interaction-'+kind+'-8'}));
    assert.throws(()=>f.owner.createOwnedCoreDomainWriteFaults(f.handle,{...fixtures,presentationControls:{templates},templateControls:{templates:[...other,{kind:'hero',id:501,slug:templates[0].slug}]}}));assert.equal(f.statements.length,0);await f.broker.close();
  });
  assert.equal(checks.length, 31);
  console.log(JSON.stringify({ status: 'pass', cases: checks.length, checks, scope: 'Actual producer control flow with bounded connection ports, plus PostgreSQL signature matching. Live PostgreSQL locking/cancellation and Browser outcomes remain pending.' }, null, 2));
} finally { await db.close(); }
