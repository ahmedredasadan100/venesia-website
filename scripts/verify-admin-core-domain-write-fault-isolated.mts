import assert from 'node:assert/strict';
import { assertOwnedLocalHandle, type OwnedLocalHandle } from './lib/isolated-supabase.mts';

type Row = Record<string, unknown>;
type Target = { table: string; id: number; signature: string; level?: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const object = (value: unknown): Row => { assert.ok(value && typeof value === 'object' && !Array.isArray(value)); return value as Row; };
const positive = (value: unknown): number => { assert.ok(Number.isSafeInteger(value) && Number(value) > 0); return Number(value); };
const relation = (name: string) => '("public"|public)[[:space:]]*\\.[[:space:]]*("' + name + '"|' + name + ')';
const update = (table: string) => 'UPDATE[[:space:]]+' + relation(table) + '[[:space:]]+SET[[:space:]]';
const rpc = (...names: string[]) => '(' + names.map(name => relation(name) + '[[:space:]]*\\(').join('|') + ')';

/** Fixed fixture identities come from the owner, never from a Browser request. */
function fixedTargets(input: unknown): Record<string, Target> {
  const fixtures = object(input), closure = object(fixtures.commandClosure), tracking = object(closure.tracking);
  const getId = (row: unknown) => positive(Number(object(row).id));
  const targets: Record<string, Target> = {
    topics: { table: 'topics', id: getId(fixtures.topic), signature: rpc('admin_mutate_topics_batch_atomically', 'admin_publish_topics_atomically') },
    categories: { table: 'topic_categories', id: getId(fixtures.category), signature: update('topic_categories') },
    series: { table: 'topic_series', id: getId(fixtures.series), signature: update('topic_series') },
    pages: { table: 'pages', id: positive(Number(object(fixtures.pages).pageId)), signature: update('pages') },
    projects: { table: 'projects', id: getId(fixtures.project), signature: rpc('set_project_publication_admin_entry') },
    project_tracking_stages: { table: 'project_tracking_stages', id: getId(tracking.stage), signature: rpc('mutate_project_tracking_stage') },
    project_tracking_items: { table: 'project_tracking_items', id: getId(tracking.item), signature: rpc('mutate_project_tracking_item') },
    project_tracking_updates: { table: 'project_tracking_updates', id: getId(tracking.update), signature: rpc('mutate_project_tracking_update') },
    redirects: { table: 'url_redirects', id: getId(closure.redirect), signature: update('url_redirects') },
    admin_users: { table: 'admin_users', id: getId(closure.adminUser), signature: update('admin_users') },
  };
  assert.ok(Array.isArray(closure.locations) && closure.locations.length === 4);
  for (const raw of closure.locations) {
    const row = object(raw); assert.ok(['governorate', 'city', 'main_area', 'sub_area'].includes(String(row.level)));
    const entity = 'project_locations_' + row.level; assert.equal(row.entity, entity); assert.ok(!Object.hasOwn(targets, entity));
    targets[entity] = { table: 'project_locations', id: getId(row), signature: rpc('mutate_project_location'), level: String(row.level) };
  }
  const identities = Object.values(targets).map(row => row.table + ':' + row.id);
  assert.equal(new Set(identities).size, identities.length);
  return targets;
}

type Armed = {
  token: string; entity: string; target: Target; state: 'arming' | 'armed' | 'cancelled' | 'released' | 'expired';
  holderPid?: number; holderBackendStart?: string; holderFinished: boolean; releaseRequested: boolean; deadline: number; release: () => void; settled: Promise<void>; failure?: unknown; timer?: ReturnType<typeof setTimeout>;
};

/** One current owned row lock; an exactly attributed PostgREST statement can be cancelled once. */
export function createOwnedCoreDomainWriteFaults(handle: OwnedLocalHandle, fixtures: unknown) {
  assertOwnedLocalHandle(handle);
  const targets = fixedTargets(fixtures), usedTokens = new Set<string>(), records: Row[] = [];
  let live: Armed | undefined, closed = false, cleanupFailure: unknown;
  async function settle(current: Armed) {
    clearTimeout(current.timer); current.release(); await current.settled;
    if (current.failure) throw current.failure;
  }
  function currentFor(request: Row) {
    assert.ok(live && live.token === request.token && live.entity === request.entity, 'Fault operations require the exact currently armed token and entity.');
    assert.ok(!live.holderFinished && !live.failure, 'The owned holder ended before this operation.');
    assert.ok(Date.now() < live.deadline && live.state !== 'expired', 'The fixed owned fault deadline expired.');
    return live;
  }
  async function arm(request: Row) {
    assert.equal(live, undefined, 'Only one fixture fault may own a lock at a time.');
    const token = String(request.token); assert.ok(!usedTokens.has(token), 'A fault token cannot be replayed.'); usedTokens.add(token);
    let release!: () => void, readyResolve!: () => void, readyReject!: (error: unknown) => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const current: Armed = { token, entity: String(request.entity), target: targets[String(request.entity)], state: 'arming', holderFinished: false, releaseRequested: false, deadline: Date.now() + 45_000, release: () => { current.releaseRequested = true; release(); }, settled: Promise.resolve() };
    live = current;
    current.settled = handle.withDatabaseConnection(async connection => {
      let began = false;
      try {
        await connection.query('begin'); began = true;
        await connection.query("set local statement_timeout='5000ms'");
        await connection.query("set local idle_in_transaction_session_timeout='60000ms'");
        const identity = (await connection.query("select pg_backend_pid() pid,current_database() database,current_user role,backend_start::text from pg_stat_activity where pid=pg_backend_pid()")).rows[0];
        assert.equal(identity.database, 'postgres'); assert.equal(identity.role, 'postgres');
        current.holderPid = positive(Number(identity.pid)); current.holderBackendStart = String(identity.backend_start);
        assert.ok(Number.isFinite(Date.parse(current.holderBackendStart)));
        const target = current.target;
        const rows = (await connection.query('select id' + (target.level ? ',level' : '') + ' from public.' + target.table + ' where id=$1 for update', [target.id])).rows;
        assert.equal(rows.length, 1, 'The owned fault target must be one existing fixture row.');
        if (target.level) assert.equal(rows[0].level, target.level);
        current.state = 'armed'; current.deadline = Date.now() + 45_000;
        current.timer = setTimeout(() => {
          current.state = 'expired'; current.failure ??= new Error('The owned fixture fault expired before explicit release.');
          cleanupFailure ??= current.failure; current.release();
        }, 45_000);
        readyResolve(); await released;
      } catch (error) { current.failure ??= error; readyReject(error); }
      finally {
        if (began) try { await connection.query('rollback'); } catch (error) { current.failure ??= error; cleanupFailure ??= error; }
      }
    }).catch(error => { current.failure ??= error; readyReject(error); }).then(() => {
      current.holderFinished = true;
      if (!current.releaseRequested) {
        current.failure ??= new Error('The owned holder ended before an explicit release.');
        cleanupFailure ??= current.failure; clearTimeout(current.timer); readyReject(current.failure);
      }
    });
    try { await ready; }
    catch (error) { await settle(current); live = undefined; throw error; }
    return { status: 'pass', state: 'armed', table: current.target.table, fixtureId: current.target.id, deadline: new Date(current.deadline).toISOString(), holderPid: current.holderPid,
      holderBackendStart: current.holderBackendStart, boundary: 'Only the fixed owned fixture row is locked; no grant, schema, Auth or Product change.' };
  }
  async function cancel(request: Row) {
    const current = currentFor(request); assert.equal(current.state, 'armed', 'Only one cancellation is allowed per armed token.');
    const cancellationStarted = Date.now();
    const result = await handle.withDatabaseConnection(async connection => {
      const deadline = Math.min(current.deadline - 5_000, Date.now() + 20_000);
      while (true) {
        assert.ok(Date.now() < deadline, 'No uniquely attributable PostgREST statement reached the owned row lock.');
        await connection.query('select pg_stat_clear_snapshot()');
        const candidates = (await connection.query(`select pid,backend_start::text,query_start::text,application_name,usename,datname,state,backend_type,wait_event_type,
          pg_blocking_pids(pid) blockers,md5(query) query_fingerprint,(query ~* $2::text) signature_matches
          from pg_stat_activity where $1::integer=any(pg_blocking_pids(pid)) and pid<>pg_backend_pid() order by pid`, [current.holderPid, current.target.signature])).rows;
        assert.ok(candidates.length <= 1, 'Multiple blocked statements cannot be attributed to a single intentional UI command.');
        if (candidates.length === 0) { await wait(100); continue; }
        const candidate = candidates[0], pid = positive(Number(candidate.pid));
        assert.notEqual(pid, current.holderPid);
        assert.equal(candidate.usename, 'authenticator'); assert.equal(candidate.datname, 'postgres'); assert.equal(candidate.state, 'active'); assert.equal(candidate.backend_type, 'client backend'); assert.equal(candidate.wait_event_type, 'Lock');
        assert.deepEqual(candidate.blockers, [current.holderPid]); assert.equal(candidate.signature_matches, true, 'The blocked statement is outside the fixed table/RPC mutation allowlist.');
        assert.ok(typeof candidate.application_name === 'string' && /^[a-zA-Z0-9 ._-]{0,80}$/.test(candidate.application_name));
        assert.ok(Number.isFinite(Date.parse(String(candidate.backend_start))) && Number.isFinite(Date.parse(String(candidate.query_start))));
        assert.match(String(candidate.query_fingerprint), /^[a-f0-9]{32}$/);
        assert.ok(Date.now() < current.deadline && current.state === 'armed' && !current.holderFinished && !current.failure);
        await connection.query('select pg_stat_clear_snapshot()');
        const cancelled = (await connection.query(`select pg_cancel_backend(a.pid) cancelled from pg_stat_activity a
          where a.pid=$1::integer and a.backend_start=$2::timestamptz and a.query_start=$3::timestamptz and md5(a.query)=$4
          and a.usename='authenticator' and a.datname=current_database() and a.state='active' and a.backend_type='client backend' and a.wait_event_type='Lock'
          and pg_blocking_pids(a.pid)=array[$5::integer] and a.query ~* $6::text
          and exists(select 1 from pg_stat_activity h where h.pid=$5::integer and h.backend_start=$7::timestamptz
            and h.usename='postgres' and h.datname=current_database() and h.backend_type='client backend' and h.state='idle in transaction')
          and (select count(*) from pg_stat_activity b where $5::integer=any(pg_blocking_pids(b.pid)))=1`,
        [pid, candidate.backend_start, candidate.query_start, candidate.query_fingerprint, current.holderPid, current.target.signature, current.holderBackendStart])).rows;
        assert.equal(cancelled.length, 1, 'The exact observed backend/query/blocker identity changed before cancellation.');
        assert.equal(cancelled[0].cancelled, true, 'PostgreSQL did not acknowledge cancellation of the one observed statement.');
        current.state = 'cancelled';
        return { backendPid: pid, backendStartedAt: candidate.backend_start, queryStartedAt: candidate.query_start,
          applicationName: candidate.application_name, backendRole: candidate.usename, queryFingerprint: candidate.query_fingerprint,
          exactBlockers: candidate.blockers, fixedMutationSignatureMatched: true, holderLifetimeVerified: true, cancelledOneStatement: true };
      }
    });
    return { status: 'pass', state: current.state, table: current.target.table, fixtureId: current.target.id, holderPid: current.holderPid, cancellationElapsedMs: Date.now() - cancellationStarted, ...result,
      boundary: 'Native query cancellation was acknowledged while the owned lock remains held. The Browser and native before/after proof must independently establish rejection and no commit.' };
  }
  async function handleRequest(input: unknown): Promise<Row> {
    assertOwnedLocalHandle(handle); assert.equal(closed, false);
    const request = object(input); assert.deepEqual(Object.keys(request).sort(), ['entity', 'id', 'kind', 'token']);
    assert.match(String(request.id), uuid); assert.match(String(request.token), uuid);
    assert.equal(typeof request.entity, 'string'); assert.ok(Object.hasOwn(targets, String(request.entity)));
    assert.ok(['domain-write-fault-arm', 'domain-write-fault-cancel', 'domain-write-fault-release'].includes(String(request.kind)));
    let outcome: Row;
    try {
      if (request.kind === 'domain-write-fault-arm') outcome = await arm(request);
      else if (request.kind === 'domain-write-fault-cancel') outcome = await cancel(request);
      else {
        const current = currentFor(request), cancellationObserved = current.state === 'cancelled';
        await settle(current); current.state = 'released'; live = undefined;
        outcome = { status: 'pass', state: 'released', cancellationObserved, ownedLockRolledBack: true };
      }
    } catch (error) {
      if (live && live.token === request.token && live.entity === request.entity) {
        const current = live;
        try { await settle(current); } finally { live = undefined; }
      }
      throw error;
    }
    const result = { id: request.id, kind: request.kind, entity: request.entity, token: request.token, ...outcome };
    records.push(result); return result;
  }
  async function close() {
    assertOwnedLocalHandle(handle); assert.equal(closed, false); closed = true;
    if (live) { const current = live; try { await settle(current); } finally { live = undefined; } }
    if (cleanupFailure) throw cleanupFailure;
    return { status: 'closed', activeLocks: 0, records, boundary: 'Every dedicated connection was awaited and its transaction rolled back inside the existing owner.' };
  }
  return { handleRequest, close };
}
