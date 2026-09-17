import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import net from 'node:net';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { runContainerPipe, startHostAccessBridge, validateTransportOptions } from './lib/isolated-supabase-transport.mjs';

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
assert.equal(bridge.snapshot().active, 0);
cases.push('invalid owner identity closes connection before Docker execution');
await bridge.close();
assert.equal(bridge.snapshot().listeners.length, 0);
cases.push('cleanup releases every owned listener');
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
