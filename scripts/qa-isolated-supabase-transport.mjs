import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import net from 'node:net';
import { getEventListeners, once } from 'node:events';
import { PassThrough } from 'node:stream';
import { inspect } from 'node:util';
import { runContainerPipe, startHostAccessBridge, validateTransportOptions, waitForOwnedDatabaseCapacity } from './lib/isolated-supabase-transport.mjs';

const cases = [];
const hash = value => createHash('sha256').update(value).digest('hex');
const ports = { db: 56165, rest: 56166, storage: 56167, 'api-gw': 56168 };
const options = { dockerBinary: 'docker', dockerHost: 'npipe:////./pipe/dockerDesktopLinuxEngine', ports, env: {}, assertOwnedTransport: async () => 'a'.repeat(64) };
function check(name, run) { run(); cases.push(name); }
check('remote Engine rejected before spawn/listen', () => assert.throws(() => validateTransportOptions({ ...options, dockerHost: 'tcp://remote.invalid:2375' })));
check('extra destinations rejected', () => assert.throws(() => validateTransportOptions({ ...options, ports: { ...ports, extra: 56169 } })));
check('overlapping ports rejected', () => assert.throws(() => validateTransportOptions({ ...options, ports: { ...ports, rest: ports.db } })));
check('arbitrary pipe destination rejected before TCP connection', () => assert.throws(() => runContainerPipe('https://external.invalid')));

async function protocolCase(name, size) {
  const request = randomBytes(size), reply = randomBytes(size + 31);
  let requestDigest;
  const server = net.createServer({ allowHalfOpen: true }, socket => {
    const chunks = [];
    socket.on('data', chunk => chunks.push(chunk));
    socket.on('end', () => { requestDigest = hash(Buffer.concat(chunks)); socket.end(reply); });
    socket.on('error', () => undefined);
  });
  server.listen({ host: '127.0.0.1', port: 0, exclusive: true });
  await once(server, 'listening');
  const address = server.address();
  const input = new PassThrough({ highWaterMark: 4096 });
  const output = new PassThrough({ highWaterMark: 4096 });
  const chunks = [];
  const createConnection = net.createConnection;
  let socket;
  try {
    net.createConnection = target => {
      assert.deepEqual(target, { host: 'db', port: 5432, allowHalfOpen: true });
      return createConnection({ host: '127.0.0.1', port: address.port, allowHalfOpen: true });
    };
    socket = runContainerPipe('db', input, output);
  } finally { net.createConnection = createConnection; }
  const done = once(output, 'end');
  output.on('data', chunk => chunks.push(chunk));
  input.end(request);
  await done;
  assert.equal(requestDigest, hash(request));
  assert.equal(hash(Buffer.concat(chunks)), hash(reply));
  socket.destroy();
  await new Promise(resolve => server.close(resolve));
  cases.push(name);
}

await protocolCase('binary duplex and client half-close preserve complete reply', 8192);
await protocolCase('backpressure preserves multi-megabyte payload without text conversion', 2 * 1024 * 1024);

let capacityActive = 32, capacityDispatches = 0;
const capacityBridge = { snapshot: () => ({ active: capacityActive, stopping: false }) };
const waiting = waitForOwnedDatabaseCapacity(capacityBridge).then(remaining => { capacityDispatches++; return remaining; });
await new Promise(done => setTimeout(done, 40));
assert.equal(capacityDispatches, 0, 'No new PG connection is dispatched while the unchanged32 limit is full');
capacityActive = 31;
const remainingBudget = await waiting;
assert.equal(capacityDispatches, 1);assert.ok(remainingBudget > 0 && remainingBudget < 5000);
cases.push('capacity wait precedes dispatch and consumes original connection budget');
await assert.rejects(() => waitForOwnedDatabaseCapacity({ snapshot: () => ({ active: 32, stopping: false }) }, 30), { code: 'QA_TRANSPORT_CAPACITY_TIMEOUT' });
assert.equal(capacityDispatches, 1);
cases.push('full bridge times out without a socket attempt or retry');
await assert.rejects(() => waitForOwnedDatabaseCapacity({ snapshot: () => ({ active: 0, stopping: true }) }), { code: 'QA_TRANSPORT_STOPPING' });
cases.push('stopping bridge cannot admit a waiting database request');
for (const budget of [0, -1, 5001, 1.5]) await assert.rejects(() => waitForOwnedDatabaseCapacity(capacityBridge, budget));
cases.push('capacity wait cannot increase the existing5000ms connection budget');
assert.ok(await waitForOwnedDatabaseCapacity({snapshot:()=>({active:0,stopping:false})}) <= 5000);
cases.push('available bridge keeps ordinary immediate connection admission');

let ownershipCalls = 0;
const bridge = await startHostAccessBridge({ ...options, assertOwnedTransport: async () => { ownershipCalls++; return 'not-an-owned-container'; } });
assert.equal(bridge.snapshot().listeners.length, 4);
assert.ok(bridge.snapshot().listeners.every(listener => listener.host === '127.0.0.1'));
cases.push('all host listeners bind numeric loopback only');
const rejected = net.createConnection({ host: '127.0.0.1', port: ports.db });
rejected.on('error', () => undefined);
await once(rejected, 'close');
assert.equal(ownershipCalls, 1);
assert.equal(bridge.snapshot().failed, 1);
assert.equal(bridge.snapshot().closeReasons.ownership_rejected, 1);
assert.equal(bridge.snapshot().closeReasonBoundary, 'first_observed_host_boundary');
assert.equal(bridge.snapshot().active, 0);
cases.push('invalid owner identity closes connection before Docker execution');
await bridge.close();
assert.equal(bridge.snapshot().listeners.length, 0);
cases.push('cleanup releases every owned listener');
for (const reason of ['idle_timeout', 'session_lifetime_timeout', 'owner_shutdown', 'peer_closed']) {
  const createServer = net.createServer, schedule = globalThis.setTimeout;
  let observed, hostClosed, releaseOwnership, trigger;
  const accepted = new Promise(done => { observed = done; });
  const hostClosure = new Promise(done => { hostClosed = done; });
  const owner = new Promise(done => { releaseOwnership = done; });
  let controlledBridge, client;
  try {
    net.createServer = (config, callback) => createServer.call(net, config, socket => {
      socket.once('close', hostClosed);
      const setIdle = socket.setTimeout;
      socket.setTimeout = function (duration, callback) {
        if (reason === 'idle_timeout' && duration === 60_000) trigger = callback;
        return setIdle.call(this, duration, callback);
      };
      callback(socket); observed();
    });
    globalThis.setTimeout = (callback, duration, ...args) => {
      if (reason === 'session_lifetime_timeout' && duration === 600_000) trigger = () => callback(...args);
      return schedule(callback, duration, ...args);
    };
    controlledBridge = await startHostAccessBridge({ ...options, assertOwnedTransport: () => owner });
    client = net.createConnection({ host: '127.0.0.1', port: ports.db }); client.on('error', () => undefined);
    const closed = new Promise(done => client.once('close', done));
    await accepted;
    if (reason === 'owner_shutdown') await controlledBridge.close();
    else if (reason === 'peer_closed') client.resetAndDestroy();
    else { assert.equal(typeof trigger, 'function'); trigger(); }
    await closed; await hostClosure; releaseOwnership('not-an-owned-container'); await controlledBridge.close();
    const snapshot = controlledBridge.snapshot();
    assert.equal(snapshot.closeReasons[reason], 1, `The observed ${reason} boundary must be retained.`);
    assert.equal(snapshot.closed, 1); assert.equal(snapshot.active, 0); assert.equal(snapshot.localProcesses, 0);
    assert.equal(snapshot.failed, reason.endsWith('timeout') ? 1 : 0);
    assert.equal(Object.values(snapshot.closeReasons).reduce((sum, count) => sum + count, 0), snapshot.closed);
    snapshot.closeReasons[reason] = 999;
    assert.equal(controlledBridge.snapshot().closeReasons[reason], 1, 'A returned snapshot cannot rewrite the retained close evidence.');
    cases.push(`actual host bridge records ${reason} once without raw details or a Docker dispatch`);
  } finally {
    net.createServer = createServer; globalThis.setTimeout = schedule;
    client?.destroy(); releaseOwnership?.('not-an-owned-container'); await controlledBridge?.close();
  }
}
for (const port of Object.values(ports)) {
  const server = net.createServer();
  server.listen({ host: '127.0.0.1', port, exclusive: true });
  await once(server, 'listening');
  await new Promise(resolve => server.close(resolve));
}
cases.push('all four ports can be bound after cleanup');

// These extend the same transport leaf. They never dispatch Docker or alter a
// foreign listener; occupied ports below belong to a finite server in this leaf.
const setupProofs = [];
const setupOptions = { ...options, assertOwnedTransport: async () => 'not-an-owned-container' };
async function transportSetupCase(name, run) { await run(); cases.push(name); }
async function releasedSetupPorts() {
  for (const port of Object.values(ports)) {
    const server = net.createServer();
    try {
      server.listen({ host: '127.0.0.1', port, exclusive: true });
      await once(server, 'listening');
    } finally { if (server.listening) await new Promise(done => server.close(done)); }
  }
}
function setupCleanup(error, expected = 'PASS') {
  assert.equal(error.diagnostic.cleanup.status, expected);
  assert.equal(error.diagnostic.cleanup.listeners, 0);
  assert.equal(error.diagnostic.cleanup.active, 0);
  assert.equal(error.diagnostic.cleanup.localProcesses, 0);
  assert.equal(error.diagnostic.cleanup.pendingSocketCloses, 0);
  assert.equal(error.diagnostic.cleanup.setupTimerActive, false);
  if (expected === 'PASS') assert.equal(error.diagnostic.cleanup.pendingListenerCloses, 0);
}

await transportSetupCase('successful setup uses one bounded deadline and shared awaited idempotent cleanup', async () => {
  const schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout, timers = new Set();
  let setupTimers = 0, actual;
  try {
    globalThis.setTimeout = (run, duration, ...args) => {
      if (duration === 15000) setupTimers++;
      let timer; timer = schedule(() => { timers.delete(timer); run(...args); }, duration); timers.add(timer); return timer;
    };
    globalThis.clearTimeout = timer => { timers.delete(timer); return cancel(timer); };
    actual = await startHostAccessBridge({ ...options, assertOwnedTransport: async () => 'not-an-owned-container' });
    assert.equal(setupTimers, 1); assert.equal(actual.snapshot().listeners.length, 4); assert.equal(actual.snapshot().cleanup.setupTimerActive, false);
    const first = actual.close(), second = actual.close(); assert.equal(first, second); await first; await second; assert.equal(actual.close(), first);
    assert.deepEqual(actual.snapshot().cleanup, { status: 'PASS', listeners: 0, pendingListenerCloses: 0, active: 0, localProcesses: 0, pendingSocketCloses: 0, setupTimerActive: false });
    assert.equal(timers.size, 0); assert.equal(actual.snapshot().failure, null);
  } finally { await actual?.close(); globalThis.setTimeout = schedule; globalThis.clearTimeout = cancel; }
  await releasedSetupPorts();
});

await transportSetupCase('actual owned occupied first port preserves native errno and does not touch its holder', async () => {
  const holder = net.createServer(socket => socket.end('owned-holder')), createServer = net.createServer;
  let original, attempted = 0, failure;
  try {
    holder.listen({ host: '127.0.0.1', port: ports.db, exclusive: true }); await once(holder, 'listening');
    net.createServer = (...args) => { attempted++; const server = createServer(...args); server.once('error', error => { original ??= error; }); return server; };
    try { await startHostAccessBridge(setupOptions); assert.fail('The owned occupied port must reject setup'); } catch (error) { failure = error; }
    assert.equal(attempted, 1); assert.ok(original); assert.equal(failure.code, 'QA_TRANSPORT_LISTEN_FAILED');
    assert.equal(failure.diagnostic.phase, 'listen'); assert.equal(failure.diagnostic.service, 'db'); assert.equal(failure.diagnostic.listenerIndex, 0);
    assert.equal(failure.diagnostic.address, '127.0.0.1'); assert.equal(failure.diagnostic.port, ports.db);
    assert.ok(['EADDRINUSE', 'EACCES'].includes(original.code)); assert.equal(failure.cause.code, original.code); assert.equal(failure.cause.errno, original.errno);
    assert.equal(failure.cause.syscall, original.syscall); assert.equal(failure.cause.address, original.address); assert.equal(failure.cause.port, original.port);
    assert.equal(failure.diagnostic.originalMetadataComplete, true); assert.ok(Object.getOwnPropertySymbols(failure).some(key => failure[key] === original));
    setupCleanup(failure); assert.equal(holder.listening, true);
    setupProofs.push({ kind: 'actual_owned_occupied', service: 'db', observedCode: failure.cause.code, phase: failure.diagnostic.phase, cleanup: failure.diagnostic.cleanup });
  } finally { net.createServer = createServer; if (holder.listening) await new Promise(done => holder.close(done)); }
  await releasedSetupPorts();
});

await transportSetupCase('actual owned occupied later port closes earlier listeners and retains the first failed service', async () => {
  const holder = net.createServer(), createServer = net.createServer;
  let original, attempted = 0, failure;
  try {
    holder.listen({ host: '127.0.0.1', port: ports.storage, exclusive: true }); await once(holder, 'listening');
    net.createServer = (...args) => { attempted++; const server = createServer(...args); server.once('error', error => { original ??= error; }); return server; };
    try { await startHostAccessBridge(setupOptions); assert.fail('Partial occupied setup must reject'); } catch (error) { failure = error; }
    assert.equal(attempted, 3); assert.ok(original); assert.equal(failure.diagnostic.service, 'storage'); assert.equal(failure.diagnostic.listenerIndex, 2);
    assert.equal(failure.diagnostic.port, ports.storage); assert.equal(failure.cause.code, original.code); assert.equal(failure.diagnostic.originalMetadataComplete, true);
    setupCleanup(failure); assert.equal(holder.listening, true);
    setupProofs.push({ kind: 'actual_owned_partial_occupied', service: 'storage', observedCode: failure.cause.code, cleanup: failure.diagnostic.cleanup });
  } finally { net.createServer = createServer; if (holder.listening) await new Promise(done => holder.close(done)); }
  await releasedSetupPorts();
});

await transportSetupCase('simulated EACCES preserves private original identity while public cause and diagnostics exclude secrets', async () => {
  const createServer = net.createServer, secret = 'private://user:secret-token@not-a-diagnostic/';
  let calls = 0, original, failure;
  try {
    net.createServer = (...args) => {
      const server = createServer(...args); calls++;
      if (calls === 2) server.listen = function (bind) {
        original = Object.assign(new Error(secret, { cause: Error(secret) }), { code: 'EACCES', errno: -13, syscall: 'listen', address: bind.host, port: bind.port, secret });
        queueMicrotask(() => server.emit('error', original)); return server;
      };
      return server;
    };
    try { await startHostAccessBridge(setupOptions); assert.fail('Controlled EACCES must reject'); } catch (error) { failure = error; }
    assert.equal(calls, 2); assert.equal(failure.code, 'QA_TRANSPORT_LISTEN_FAILED'); assert.equal(failure.diagnostic.phase, 'listen');
    assert.equal(failure.diagnostic.service, 'rest'); assert.equal(failure.diagnostic.listenerIndex, 1); assert.equal(failure.diagnostic.causeCode, 'EACCES');
    assert.deepEqual(failure.cause, { name: 'Error', code: 'EACCES', errno: -13, syscall: 'listen', address: '127.0.0.1', port: ports.rest, phase: 'listen' });
    assert.equal(Object.isFrozen(failure.cause), true); assert.equal(Object.isFrozen(failure.diagnostic), true);
    const keys = Object.getOwnPropertySymbols(failure).filter(key => failure[key] === original); assert.equal(keys.length, 1);
    assert.equal(Object.getOwnPropertyDescriptor(failure, keys[0]).enumerable, false); assert.equal(original.message, secret); assert.equal(original.secret, secret);
    assert.equal(JSON.stringify(failure).includes(secret), false); assert.equal(inspect(failure).includes(secret), false);
    setupCleanup(failure); setupProofs.push({ kind: 'simulated_permission_denied', actualWindowsPermissionDenialClaimed: false, diagnostic: failure.diagnostic });
  } finally { net.createServer = createServer; }
  await releasedSetupPorts();
});

await transportSetupCase('missing original errno cannot be relabeled as a known bind cause or complete evidence', async () => {
  const createServer = net.createServer;
  let original, failure;
  try {
    net.createServer = (...args) => { const server = createServer(...args); server.listen = function () {
      original = Error('private unstructured failure'); queueMicrotask(() => server.emit('error', original)); return server;
    }; return server; };
    try { await startHostAccessBridge(setupOptions); assert.fail('Missing native metadata must still reject'); } catch (error) { failure = error; }
    assert.equal(failure.code, 'QA_TRANSPORT_LISTEN_FAILED'); assert.equal(failure.diagnostic.originalMetadataComplete, false);
    assert.equal(failure.diagnostic.causeCode, null); assert.equal(failure.cause.code, null); assert.equal(failure.cause.syscall, null);
    assert.equal(failure.cause.address, null); assert.equal(failure.cause.port, null); assert.ok(Object.getOwnPropertySymbols(failure).some(key => failure[key] === original));
    assert.equal(inspect(failure).includes('private unstructured failure'), false); setupCleanup(failure);
  } finally { net.createServer = createServer; }
  await releasedSetupPorts();
});

await transportSetupCase('pre-cancellation and invalid setup budgets reject before a server timer or abort listener is allocated', async () => {
  const createServer = net.createServer, schedule = globalThis.setTimeout, controller = new AbortController(), original = Error('private cancellation');
  let servers = 0, timers = 0;
  controller.abort(original);
  try {
    net.createServer = () => { servers++; throw Error('Unexpected server allocation'); };
    globalThis.setTimeout = () => { timers++; throw Error('Unexpected timer allocation'); };
    await assert.rejects(() => startHostAccessBridge({ ...options, signal: controller.signal }), error => {
      assert.equal(error.code, 'QA_TRANSPORT_CANCELLED'); assert.equal(error.diagnostic.phase, 'before_listener_setup');
      assert.equal(error.diagnostic.cleanup.status, 'NOT_STARTED'); assert.equal(error.diagnostic.originalErrorRetainedPrivately, true);
      assert.ok(Object.getOwnPropertySymbols(error).some(key => error[key] === original)); return true;
    });
    for (const setupTimeoutMs of [0, -1, 15001, 0.5, NaN, Infinity]) await assert.rejects(() => startHostAccessBridge({ ...options, setupTimeoutMs }), /INVALID_QA_TRANSPORT_SETUP_TIMEOUT/u);
    await assert.rejects(() => startHostAccessBridge({ ...options, signal: {} }), /INVALID_QA_TRANSPORT_SIGNAL/u);
    assert.equal(servers, 0); assert.equal(timers, 0); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  } finally { net.createServer = createServer; globalThis.setTimeout = schedule; }
});

await transportSetupCase('cancellation during actual partial listen closes owned ports and cannot continue later setup', async () => {
  const createServer = net.createServer, controller = new AbortController(), original = Error('private partial cancellation');
  let calls = 0, failure;
  try {
    net.createServer = (...args) => {
      const server = createServer(...args); calls++;
      if (calls === 2) { const listen = server.listen; server.listen = function (...input) { const result = listen.apply(this, input); controller.abort(original); return result; }; }
      return server;
    };
    try { await startHostAccessBridge({ ...setupOptions, signal: controller.signal }); assert.fail('Partial cancellation must reject'); } catch (error) { failure = error; }
    assert.equal(calls, 2); assert.equal(failure.code, 'QA_TRANSPORT_CANCELLED'); assert.equal(failure.diagnostic.service, 'rest');
    assert.equal(failure.diagnostic.listenerIndex, 1); setupCleanup(failure); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.ok(Object.getOwnPropertySymbols(failure).some(key => failure[key] === original));
  } finally { net.createServer = createServer; }
  await releasedSetupPorts();
});

await transportSetupCase('one bounded setup timeout closes actual earlier listeners without retrying the stalled listener', async () => {
  const createServer = net.createServer, schedule = globalThis.setTimeout;
  let calls = 0, setupTimers = 0, failure;
  try {
    globalThis.setTimeout = (run, duration, ...args) => { if (duration === 200) setupTimers++; return schedule(run, duration, ...args); };
    net.createServer = (...args) => { const server = createServer(...args); calls++; if (calls === 2) server.listen = function () { return server; }; return server; };
    try { await startHostAccessBridge({ ...setupOptions, setupTimeoutMs: 200 }); assert.fail('Stalled setup must time out'); } catch (error) { failure = error; }
    assert.equal(calls, 2); assert.equal(setupTimers, 1); assert.equal(failure.code, 'QA_TRANSPORT_SETUP_TIMEOUT'); assert.equal(failure.diagnostic.service, 'rest');
    assert.equal(failure.diagnostic.setupTimeoutMs, 200); assert.equal(failure.diagnostic.originalMetadataComplete, false);
    assert.equal(failure.diagnostic.originalErrorRetainedPrivately, false); setupCleanup(failure);
  } finally { net.createServer = createServer; globalThis.setTimeout = schedule; }
  await releasedSetupPorts();
});

await transportSetupCase('active cancellation waits for owned socket close and cannot dispatch a delayed ownership result', async () => {
  const controller = new AbortController(); let release, entered, actual, client;
  const pending = new Promise(done => { release = done; });
  const ownershipEntered = new Promise(done => { entered = done; });
  try {
    actual = await startHostAccessBridge({ ...options, signal: controller.signal, assertOwnedTransport: () => { entered(); return pending; } });
    client = net.createConnection({ host: '127.0.0.1', port: ports.db }); client.on('error', () => undefined); await once(client, 'connect');
    await ownershipEntered; assert.equal(actual.snapshot().accepted, 1); assert.equal(actual.snapshot().active, 1);
    const closed = new Promise(done => client.once('close', done)); controller.abort(Error('private active cancellation'));
    const first = actual.close(), second = actual.close(); assert.equal(first, second); await first; await closed;
    release('not-an-owned-container'); await new Promise(done => setImmediate(done));
    const snapshot = actual.snapshot(); assert.equal(snapshot.failure.code, 'QA_TRANSPORT_CANCELLED'); assert.equal(snapshot.failure.phase, 'active_bridge');
    assert.equal(snapshot.cleanup.status, 'PASS'); assert.equal(snapshot.active, 0); assert.equal(snapshot.localProcesses, 0); assert.equal(snapshot.cleanup.pendingSocketCloses, 0);
    assert.equal(snapshot.closeReasons.owner_shutdown, 1); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    snapshot.failure.code = 'forged'; assert.equal(actual.snapshot().failure.code, 'QA_TRANSPORT_CANCELLED');
  } finally { release?.('not-an-owned-container'); client?.destroy(); await actual?.close(); }
  await releasedSetupPorts();
});

await transportSetupCase('event-triggered cleanup preserves the first listener error and has no unhandled rejection', async () => {
  const createServer = net.createServer, servers = [], unhandled = [], onUnhandled = error => unhandled.push(error);
  let actual;
  process.on('unhandledRejection', onUnhandled);
  try {
    net.createServer = (...args) => { const server = createServer(...args); servers.push(server); return server; };
    actual = await startHostAccessBridge(setupOptions);
    const original = Object.assign(Error('private active listener failure'), { code: 'EIO', syscall: 'listen', address: '127.0.0.1', port: ports.db });
    servers[0].emit('error', original); const closing = actual.close(); assert.equal(actual.close(), closing); await closing;
    await new Promise(done => setImmediate(done)); assert.deepEqual(unhandled, []);
    assert.equal(actual.snapshot().failure.phase, 'active_listener'); assert.equal(actual.snapshot().failure.causeCode, 'EIO'); assert.equal(actual.snapshot().cleanup.status, 'PASS');
  } finally { net.createServer = createServer; await actual?.close(); process.removeListener('unhandledRejection', onUnhandled); }
  await releasedSetupPorts();
});

await transportSetupCase('cleanup failure remains explicit and cannot replace the original partial listen cause', async () => {
  const createServer = net.createServer;
  let calls = 0, failure, original;
  try {
    net.createServer = (...args) => {
      const server = createServer(...args); calls++;
      if (calls === 1) { const close = server.close; server.close = function (done) { return close.call(this,
        typeof done === 'function' ? () => done(Object.assign(Error('private cleanup failure'), { code: 'EIO' })) : undefined); }; }
      if (calls === 2) server.listen = function (bind) { original = Object.assign(Error('private listen failure'), { code: 'EACCES', syscall: 'listen', address: bind.host, port: bind.port }); queueMicrotask(() => server.emit('error', original)); return server; };
      return server;
    };
    try { await startHostAccessBridge(setupOptions); assert.fail('Partial failure with failed cleanup proof must reject'); } catch (error) { failure = error; }
    assert.equal(failure.code, 'QA_TRANSPORT_LISTEN_FAILED'); assert.equal(failure.cause.code, 'EACCES'); assert.equal(failure.diagnostic.cleanup.status, 'FAIL');
    assert.equal(failure.diagnostic.service, 'rest'); assert.ok(Object.getOwnPropertySymbols(failure).some(key => failure[key] === original));
    assert.equal(inspect(failure).includes('private cleanup failure'), false); assert.equal(inspect(failure).includes('private listen failure'), false);
  } finally { net.createServer = createServer; }
  await releasedSetupPorts();
});

await transportSetupCase('a missing listener close acknowledgement reaches the unchanged cleanup deadline and never reports PASS', async () => {
  const createServer = net.createServer, schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout;
  const token = { controlledCleanupDeadline: true }; let calls = 0, deadline, cleared = false, actual, closing;
  try {
    globalThis.setTimeout = (run, duration, ...args) => {
      if (duration === 5000) { assert.equal(deadline, undefined); deadline = run; return token; }
      return schedule(run, duration, ...args);
    };
    globalThis.clearTimeout = timer => { if (timer === token) { cleared = true; return; } return cancel(timer); };
    net.createServer = (...args) => {
      const server = createServer(...args); calls++;
      if (calls === 1) { const close = server.close; server.close = function (done) {
        // Actual handle closes; withholding only its acknowledgement proves
        // that socket absence cannot substitute for awaited owner cleanup.
        return close.call(this, typeof done === 'function' ? () => undefined : undefined);
      }; }
      return server;
    };
    actual = await startHostAccessBridge(setupOptions); closing = actual.close(); const rejected = assert.rejects(closing, /QA_TRANSPORT_CLEANUP_INCOMPLETE/u);
    await new Promise(done => setImmediate(done)); assert.equal(typeof deadline, 'function'); deadline(); await rejected;
    assert.equal(actual.close(), closing); assert.equal(actual.snapshot().cleanup.status, 'FAIL'); assert.equal(actual.snapshot().cleanup.pendingListenerCloses, 1);
    assert.equal(actual.snapshot().cleanup.setupTimerActive, false); assert.equal(cleared, true);
  } finally {
    net.createServer = createServer; globalThis.setTimeout = schedule; globalThis.clearTimeout = cancel;
    if (closing) await closing.catch(() => undefined);
  }
  await releasedSetupPorts();
});

process.stdout.write(`${JSON.stringify({ status: 'PASS', checks: cases.length, cases,
  setupProofs,
  dockerExecuted: false, productionAccess: false, externalConnections: false,
  scope: 'New QA transport contract only; no retained Navigation gates rerun.' }, null, 2)}\n`);
