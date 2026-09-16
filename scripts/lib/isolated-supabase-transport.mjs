import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { lookup } from 'node:dns/promises';

// QA lifecycle transport only. Supabase protocol/auth/routing stay upstream.
// The Docker exec channel is binary, never TTY, never a container log stream.
const TARGETS = Object.freeze({
  db: Object.freeze({ host: 'db', port: 5432 }),
  rest: Object.freeze({ host: 'rest', port: 3000 }),
  storage: Object.freeze({ host: 'storage', port: 5000 }),
  'api-gw': Object.freeze({ host: 'api-gw', port: 8000 }),
});
const LOCAL_ENGINES = new Set([
  'npipe:////./pipe/dockerDesktopLinuxEngine',
  'npipe:////./pipe/docker_engine',
  'unix:///var/run/docker.sock',
]);
const CONTAINER_MODULE = '/qa/isolated-supabase-transport.mjs';
const MAX_CONNECTIONS = 32;
const CONNECT_MS = 15_000;
const IDLE_MS = 60_000;
const LIFETIME_MS = 600_000;

function safeEnvironment(source) {
  const clean = {};
  for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'SystemDrive', 'COMSPEC', 'ComSpec',
    'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA',
    'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData']) {
    if (typeof source[name] === 'string') clean[name] = source[name];
  }
  clean.CI = '1';
  return clean;
}

export function validateTransportOptions(options) {
  if (!options || !LOCAL_ENGINES.has(options.dockerHost)
    || typeof options.dockerBinary !== 'string' || !options.dockerBinary
    || typeof options.assertOwnedTransport !== 'function'
    || !options.ports || Object.keys(options.ports).sort().join(',') !== Object.keys(TARGETS).sort().join(',')) {
    throw new Error('INVALID_QA_TRANSPORT');
  }
  const ports = Object.values(options.ports);
  if (new Set(ports).size !== ports.length || ports.some(port => !Number.isInteger(port) || port <= 1024 || port > 65535)) {
    throw new Error('INVALID_QA_TRANSPORT_PORTS');
  }
}

/** Loopback ingress -> local Engine exec stdio -> fixed internal service. */
export async function startHostAccessBridge(options) {
  validateTransportOptions(options);
  const env = safeEnvironment(options.env ?? {});
  const sessions = new Set();
  const processes = new Map();
  const servers = [];
  const counts = { accepted: 0, rejected: 0, failed: 0, closed: 0 };
  let stopping = false;

  async function open(client, service) {
    client.on('error', () => undefined);
    if (stopping || sessions.size >= MAX_CONNECTIONS
      || client.localAddress !== '127.0.0.1' || client.remoteAddress !== '127.0.0.1') {
      counts.rejected++;
      client.destroy();
      return;
    }
    const session = { client, child: null, released: false };
    sessions.add(session);
    counts.accepted++;
    client.pause();
    let lifetime;
    let ownershipTimer;
    function release(failed = false) {
      if (session.released) return;
      session.released = true;
      clearTimeout(lifetime);
      clearTimeout(ownershipTimer);
      if (failed) counts.failed++;
      counts.closed++;
      sessions.delete(session);
      session.child?.stdin.destroy();
      session.child?.kill();
      if (!client.destroyed) client.destroy();
    }
    client.once('close', () => release());
    client.setTimeout(IDLE_MS, () => release(true));
    lifetime = setTimeout(() => release(true), LIFETIME_MS);
    try {
      // The owner checks label/image/mount/network identity for every accepted
      // connection. No caller-supplied endpoint, executable or container name.
      const identity = await Promise.race([
        options.assertOwnedTransport(),
        new Promise((_, reject) => {
          ownershipTimer = setTimeout(() => reject(new Error('OWNERSHIP_TIMEOUT')), CONNECT_MS);
          ownershipTimer.unref();
        }),
      ]);
      clearTimeout(ownershipTimer);
      if (!/^[a-f0-9]{64}$/.test(identity)) throw new Error('UNOWNED_TRANSPORT');
      if (stopping || session.released || client.destroyed) { release(); return; }
      const child = spawn(options.dockerBinary, ['--host', options.dockerHost, 'container', 'exec',
        '-i', '--user', '1000:1000', identity, 'node', CONTAINER_MODULE, '--pipe', service], {
        env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      });
      session.child = child;
      const exited = new Promise(done => child.once('close', () => { processes.delete(child); done(); }));
      processes.set(child, exited);
      child.once('error', () => release(true));
      // stderr may include platform details; drain without retaining/logging it.
      child.stderr.on('data', () => undefined);
      child.stdin.on('error', () => release(true));
      child.stdout.on('error', () => release(true));
      client.pipe(child.stdin);
      child.stdout.pipe(client);
      child.once('close', code => {
        if (code !== 0) release(true);
        else if (!client.destroyed) client.end();
      });
      client.resume();
    } catch { release(true); }
  }

  async function close() {
    if (stopping) return;
    stopping = true;
    for (const session of sessions) {
      session.child?.stdin.destroy();
      session.child?.kill();
      session.client.destroy();
    }
    await Promise.all(servers.map(server => new Promise(done => {
      if (!server.listening) done();
      else server.close(() => done());
    })));
    let deadline;
    try {
      await Promise.race([
        Promise.all([...processes.values()]),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(new Error('QA_TRANSPORT_CLEANUP_INCOMPLETE')), 5000);
        }),
      ]);
    } finally { clearTimeout(deadline); }
    if (sessions.size || processes.size) throw new Error('QA_TRANSPORT_CLEANUP_INCOMPLETE');
  }

  try {
    for (const service of Object.keys(TARGETS)) {
      const server = net.createServer({ allowHalfOpen: true }, client => void open(client, service));
      servers.push(server);
      await new Promise((done, reject) => {
        server.once('error', reject);
        server.listen({ host: '127.0.0.1', port: options.ports[service], exclusive: true }, done);
      });
      server.on('error', () => { void close(); });
    }
  } catch {
    await close();
    throw new Error('QA_TRANSPORT_LISTEN_FAILED');
  }
  return Object.freeze({
    close,
    snapshot: () => ({ ...counts, active: sessions.size, localProcesses: processes.size, stopping,
      listeners: servers.filter(server => server.listening).map(server => {
        const address = server.address();
        return { host: address.address, port: address.port };
      }),
    }),
  });
}

// Executed only inside the dedicated, unprivileged, internal-network QA
// transport container. No arbitrary hostname, port, shell or URL is accepted.
export function runContainerPipe(service, input = process.stdin, output = process.stdout) {
  if (!Object.hasOwn(TARGETS, service)) throw new Error('INVALID_QA_TRANSPORT_TARGET');
  const target = TARGETS[service];
  const socket = net.createConnection({ ...target, allowHalfOpen: true });
  input.pause();
  const connectTimer = setTimeout(() => socket.destroy(new Error('CONNECT_TIMEOUT')), CONNECT_MS);
  const lifetime = setTimeout(() => socket.destroy(new Error('LIFETIME_TIMEOUT')), LIFETIME_MS);
  socket.setTimeout(IDLE_MS, () => socket.destroy(new Error('IDLE_TIMEOUT')));
  socket.once('connect', () => {
    clearTimeout(connectTimer);
    input.pipe(socket);
    socket.pipe(output);
    input.resume();
  });
  input.on('error', () => socket.destroy());
  output.on('error', () => socket.destroy());
  socket.once('close', () => {
    clearTimeout(connectTimer);
    clearTimeout(lifetime);
    input.unpipe(socket);
    input.pause();
    if (!output.writableEnded) output.end();
  });
  socket.once('error', () => {
    process.exitCode = 1;
    input.destroy();
  });
  return socket;
}

/** Read-only routing evidence plus a reserved TEST-NET denial probe. */
export async function networkProof(resolveAliases = true) {
  const routes = readFileSync('/proc/net/route', 'utf8').trim().split('\n').slice(1).map(line => {
    const fields = line.trim().split(/\s+/);
    return { interface: fields[0], destination: fields[1], gateway: fields[2], flags: parseInt(fields[3], 16), mask: fields[7] };
  });
  const ipv6 = readFileSync('/proc/net/ipv6_route', 'utf8').trim().split('\n').filter(Boolean).map(line => {
    const fields = line.trim().split(/\s+/);
    return { destination: fields[0], prefix: fields[1], flags: parseInt(fields[8], 16) };
  });
  const usable = route => (route.flags & 1) !== 0 && (route.flags & 0x200) === 0;
  const ipv4Default = routes.some(route => usable(route) && route.destination === '00000000' && route.mask === '00000000');
  const ipv6Default = ipv6.some(route => usable(route) && /^0+$/.test(route.destination) && route.prefix === '00');
  const interfaces = Object.values(networkInterfaces()).flat().filter(Boolean).map(item => ({ address: item.address, family: item.family, internal: item.internal, cidr: item.cidr }));
  if (ipv4Default || ipv6Default) throw new Error('UNEXPECTED_EXTERNAL_ROUTE');
  // This reserved documentation address is not a Production endpoint. The
  // route guard runs first, so no permitted external path is exercised.
  const externalDenial = await new Promise(done => {
    const socket = net.createConnection({ host: '203.0.113.254', port: 9 });
    socket.setTimeout(2000, () => { socket.destroy(); done('TIMEOUT'); });
    socket.once('error', error => done(error.code ?? 'ERROR'));
    socket.once('connect', () => { socket.destroy(); done('UNEXPECTED_CONNECTED'); });
  });
  if (externalDenial !== 'ENETUNREACH') throw new Error('EXTERNAL_DENIAL_NOT_PROVEN');
  const aliases = {};
  if (resolveAliases) {
    for (const target of Object.values(TARGETS)) aliases[target.host] = (await lookup(target.host, { family: 4 })).address;
  }
  return { ipv4Default, ipv6Default, interfaces, routes, aliases, externalDenial,
    productionConnectionAttempted: false, assertion: 'No usable default route; reserved external destination denied before TCP connection.' };
}

/** Probe only this Windows host's own NIC addresses, never a remote LAN host. */
export async function proveHostBoundary(ports) {
  const values = Object.values(ports);
  if (values.length !== 4 || values.some(port => !Number.isInteger(port) || port < 1025 || port > 65535)) {
    throw new Error('INVALID_QA_BOUNDARY_PORTS');
  }
  const addresses = [...new Set(Object.values(networkInterfaces()).flat().filter(item =>
    item && item.family === 'IPv4' && !item.internal).map(item => item.address))];
  const outcomes = await Promise.all(addresses.flatMap(host => values.map(port => new Promise(done => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(1500, () => { socket.destroy(); done('TIMEOUT'); });
    socket.once('connect', () => { socket.destroy(); done('UNEXPECTED_CONNECTED'); });
    socket.once('error', error => done(error.code ?? 'ERROR'));
  }))));
  if (outcomes.some(code => code === 'UNEXPECTED_CONNECTED')) throw new Error('NON_LOOPBACK_EXPOSURE');
  return { localNonLoopbackAddresses: addresses.length, attempts: outcomes.length,
    refused: outcomes.filter(code => code === 'ECONNREFUSED').length,
    timedOut: outcomes.filter(code => code === 'TIMEOUT' || code === 'ETIMEDOUT').length,
    unexpectedConnections: 0, externalLanClientTested: false,
    proof: 'Loopback listeners and zero Docker publishing, plus probes to this host own IPv4 NICs only.' };
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--hold') {
    // PID1 receives no secrets and never emits protocol bytes to Docker logs.
    setInterval(() => {}, 60_000);
  } else if (args.length === 1 && ['--network-proof', '--route-proof'].includes(args[0])) {
    networkProof(args[0] === '--network-proof').then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(() => {
      process.stderr.write('QA_NETWORK_PROOF_FAILED\n'); process.exitCode = 1;
    });
  } else if (args.length === 2 && args[0] === '--pipe' && Object.hasOwn(TARGETS, args[1])) {
    runContainerPipe(args[1]);
  } else {
    process.stderr.write('INVALID_QA_TRANSPORT_ARGUMENTS\n');
    process.exitCode = 1;
  }
}
