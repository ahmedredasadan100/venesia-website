import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import net from 'node:net';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
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
process.stdout.write(`${JSON.stringify({ status: 'PASS', checks: cases.length, cases,
  dockerExecuted: false, productionAccess: false, externalConnections: false,
  scope: 'New QA transport contract only; no retained Navigation gates rerun.' }, null, 2)}\n`);
