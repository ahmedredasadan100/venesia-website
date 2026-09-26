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
function fixture() {
  let clock = Date.now(), nextTimer = 0, active = true, liveConnections = 0, rollbacks = 0, cancels = 0, connectionOrdinal = 0;
  let rejectHolder!: (error: Error) => void;
  const holderEnded = new Promise<never>((_resolve, reject) => { rejectHolder = reject; });
  const timers = new Map<number, () => void>(), signatures: string[] = [], statements: string[] = [];
  const faults = { rows: [candidate()] as Array<Record<string, unknown>>, cancelRows: [{ cancelled: true }] as Array<Record<string, unknown>>, targetMissing: false, identityRole: 'postgres', connectionFailure: false, rollbackFailure: false };
  const handle = { withDatabaseConnection: async <T,>(work: (connection: { query: (sql: string, params?: unknown[]) => Promise<{rows: Record<string, unknown>[];rowCount:number}> }) => Promise<T>) => {
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
        if (sql.includes('for update')) return faults.targetMissing ? [] : [{ id: params[0], level: ['governorate', 'city', 'main_area', 'sub_area'][Number(params[0]) - 11] }];
        if (sql.startsWith('select pid,backend_start')) { signatures.push(String(params[1])); return faults.rows; }
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
    assert.equal(specifier, 'node:assert/strict'); return require(specifier);
  }, loaded, loaded.exports, Clock, (callback: () => void, delay: number) => {
    const id = ++nextTimer;
    if (delay === 100) { clock += delay; queueMicrotask(callback); } else timers.set(id, callback);
    return id;
  }, (id: number) => timers.delete(id));
  const owner = loaded.exports as Owner, broker = owner.createOwnedCoreDomainWriteFaults(handle, fixtures);
  const token = randomUUID();
  const request = (kind: string, entity = 'categories', override: Record<string, unknown> = {}) => broker.handleRequest({ id: randomUUID(), kind: 'domain-write-fault-' + kind, token, entity, ...override });
  return { owner, handle, broker, request, faults, signatures, statements, counts: () => ({ liveConnections, rollbacks, cancels }),
    disconnectHolder: () => rejectHolder(new Error('Offline owned holder disconnected')),
    expire: () => { clock += 45_000; for (const callback of [...timers.values()]) callback(); }, end: () => { active = false; } };
}
const checks: string[] = [];
const test = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); };
try {
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
  assert.equal(checks.length, 13);
  console.log(JSON.stringify({ status: 'pass', cases: checks.length, checks, scope: 'Actual producer control flow with bounded connection ports, plus PostgreSQL signature matching. Live PostgreSQL locking/cancellation and Browser outcomes remain pending.' }, null, 2));
} finally { await db.close(); }
