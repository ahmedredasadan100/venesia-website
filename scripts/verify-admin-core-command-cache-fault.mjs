import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest, Server } from 'node:http';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const directory = resolve('.tmp-qa', 'core-cache-preload-offline-' + randomUUID());
mkdirSync(directory, { recursive: true });
const controlPath = join(directory, 'admin-core-cache-control.json');
const preload = resolve('scripts/fixtures/admin-core-command-cache-fault.cjs');
const setControl = control => { const temporary = controlPath + '.tmp'; writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, ...control })); renameSync(temporary, controlPath); };
const nextControl = () => ({ mode: 'armed', token: randomUUID(), topicId: 731, expectedFeatured: true });
const listen = server => new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolveListen('http://127.0.0.1:' + server.address().port)); });
const close = server => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
const results = [];
const check = async (name, task) => { await task(); results.push(name); console.log('PASS ' + name); };
const fields = { commandId: randomUUID(), topicId: 731, reject: false };
const command = () => ({ id: fields.commandId, intent: { action: 'feature', ids: [fields.topicId] },
  result: { ok: true, commandId: fields.commandId, changedIds: [fields.topicId] } });
const api = createServer(async (request, response) => {
  for await (const chunk of request) void chunk;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(request.url.startsWith('/rest/v1/rpc/')
    ? fields.reject ? { ok: false } : command().result
    : { metadata: { command: command() } }));
});
let apiOrigin, appOrigin, installed, app;
const originalFetch = globalThis.fetch, originalEmit = Server.prototype.emit;
const FileSystemCache = require('next/dist/server/lib/incremental-cache/file-system-cache.js').default;
const originalBackend = FileSystemCache.prototype.revalidateTag;
const tags = require('next/dist/server/lib/incremental-cache/tags-manifest.external.js').tagsManifest;
const previousEnvironment = { control: process.env.QA_ADMIN_CORE_CACHE_CONTROL, api: process.env.NEXT_PUBLIC_SUPABASE_URL,
  vercel: process.env.VERCEL, vercelEnv: process.env.VERCEL_ENV };
try {
  apiOrigin = await listen(api);
  setControl({ mode: 'off' });
  const childEnvironment = { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: process.env.TEMP,
    NEXT_PUBLIC_SUPABASE_URL: apiOrigin, QA_ADMIN_CORE_CACHE_CONTROL: controlPath };
  for (const [name, change, expected] of [
    ['missing-control-rejected', { QA_ADMIN_CORE_CACHE_CONTROL: '' }, 'fixed owned control file'],
    ['external-data-origin-rejected', { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid' }, 'owned loopback Data API'],
    ['hosted-runtime-rejected', { VERCEL: '1' }, 'owned local server'],
  ]) await check(name, async () => {
    const result = spawnSync(process.execPath, ['--require', preload, '-e', ''], { env: { ...childEnvironment, ...change }, encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0); assert.ok(result.stderr.includes(expected));
  });
  await check('armed-startup-rejected', async () => {
    setControl(nextControl());
    const result = spawnSync(process.execPath, ['--require', preload, '-e', ''], { env: childEnvironment, encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0); assert.ok(result.stderr.includes('inert cache fault session'));
    setControl({ mode: 'off' });
  });
  process.env.QA_ADMIN_CORE_CACHE_CONTROL = controlPath; process.env.NEXT_PUBLIC_SUPABASE_URL = apiOrigin;
  delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  installed = require(preload);
  const backend = new FileSystemCache({ fs: {}, flushToDisk: false, serverDistDir: directory, revalidatedTags: [], maxMemoryCacheSize: 0 });
  app = createServer(async (request, response) => {
    try {
      const mode = request.headers['x-fixture-mode'];
      if (mode === 'rpc') await fetch(apiOrigin + '/rest/v1/rpc/admin_mutate_topics_batch_atomically', {
        method: 'POST', body: JSON.stringify({ p_action: 'feature', p_topic_ids: [fields.topicId], p_command_id: fields.commandId }),
      });
      if (mode === 'receipt') await fetch(apiOrigin + '/rest/v1/admin_audit_logs');
      await backend.revalidateTag(request.headers['x-fixture-tag']);
      response.end('settled');
    } catch (error) { response.statusCode = 500; response.end(error.message); }
  });
  appOrigin = await listen(app);
  const invoke = (tag, mode, action = true, path = '/admin/content/topics') => new Promise((resolveResponse, reject) => {
    const request = httpRequest(appOrigin + path, { method: 'POST', headers: { 'x-fixture-tag': tag, 'x-fixture-mode': mode,
      ...(action ? { 'next-action': 'offline-boundary-only' } : {}) } }, response => {
      let body = ''; response.on('data', chunk => { body += chunk; }); response.on('end', () => resolveResponse({ status: response.statusCode, body }));
    }); request.once('error', reject); request.end();
  });
  const eventRows = () => readFileSync(join(directory, 'admin-core-cache-events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  await check('off-delegates-real-installed-backend', async () => { assert.equal((await invoke('off', 'rpc')).status, 200); assert.ok(tags.has('off')); });
  let control = nextControl(); setControl(control);
  await check('different-route-does-not-arm-fault', async () => { assert.equal((await invoke('other-route', 'rpc', true, '/admin/content/categories')).status, 200); assert.ok(tags.has('other-route')); });
  await check('non-action-does-not-arm-fault', async () => { assert.equal((await invoke('non-action', 'rpc', false)).status, 200); assert.ok(tags.has('non-action')); });
  await check('no-native-ack-does-not-arm-fault', async () => { assert.equal((await invoke('no-ack', 'none')).status, 200); assert.ok(tags.has('no-ack')); });
  await check('rejected-rpc-does-not-arm-fault', async () => { fields.reject = true; assert.equal((await invoke('reject', 'rpc')).status, 200); fields.reject = false; assert.ok(tags.has('reject')); });
  await check('different-topic-does-not-arm-fault', async () => { fields.topicId = 732; assert.equal((await invoke('different-topic', 'rpc')).status, 200); fields.topicId = 731; assert.ok(tags.has('different-topic')); });
  await check('receipt-without-known-commit-does-not-arm-fault', async () => { assert.equal((await invoke('unknown-receipt', 'receipt')).status, 200); assert.ok(tags.has('unknown-receipt')); });
  await check('validated-rpc-fails-before-real-backend-mutation', async () => {
    const response = await invoke('blocked-first', 'rpc'); assert.equal(response.status, 500); assert.equal(response.body, 'QA_OWNED_POST_COMMIT_CACHE_BACKEND_FAILURE');
    assert.equal(tags.has('blocked-first'), false); assert.equal(eventRows().filter(row => row.type === 'rpc-committed').length, 1);
  });
  await check('automatic-receipt-recovery-remains-unresolved', async () => { assert.equal((await invoke('blocked-recovery', 'receipt')).status, 500); assert.equal(tags.has('blocked-recovery'), false); });
  await check('explicit-recovery-settles-real-backend-without-rpc', async () => {
    setControl({ ...control, mode: 'recover' }); const before = eventRows().filter(row => row.type === 'domain-rpc-attempt').length;
    assert.equal((await invoke('settled-recovery', 'receipt')).status, 200); assert.ok(tags.has('settled-recovery'));
    assert.equal(eventRows().filter(row => row.type === 'domain-rpc-attempt').length, before);
    const settled = eventRows().filter(row => row.type === 'backend-settled'); assert.equal(settled.length, 1); assert.equal(settled[0].commandId, fields.commandId);
  });
  await check('different-token-receipt-cannot-inherit-native-proof', async () => {
    control = nextControl(); setControl(control); assert.equal((await invoke('new-token', 'receipt')).status, 200); assert.ok(tags.has('new-token'));
  });
  await check('malformed-control-fails-closed', async () => { setControl({ ...control, mode: 'invented' }); assert.throws(() => app.emit('request', { url: '/admin/content/topics', method: 'POST', headers: {} }, {}), /Unknown cache fault mode/); setControl({ mode: 'off' }); });
  await check('provenance-fingerprints-installed-next-modules', async () => {
    const rows = eventRows(); const item = rows.find(row => row.type === 'installed'); assert.equal(item.nextVersion, require('next/package.json').version);
    assert.equal(item.modules.length, 5); assert.ok(item.modules.every(row => /^[a-f0-9]{64}$/.test(row.sha256)));
    const forbidden = ['authorization', 'apikey', 'password', 'p_actor_id']; assert.ok(forbidden.every(key => !JSON.stringify(rows).includes(key)));
  });
} finally {
  if (installed) installed.restore();
  assert.equal(globalThis.fetch, originalFetch); assert.equal(Server.prototype.emit, originalEmit); assert.equal(FileSystemCache.prototype.revalidateTag, originalBackend);
  if (app) await close(app); if (api.listening) await close(api);
  for (const [key, value] of Object.entries({ QA_ADMIN_CORE_CACHE_CONTROL: previousEnvironment.control, NEXT_PUBLIC_SUPABASE_URL: previousEnvironment.api, VERCEL: previousEnvironment.vercel, VERCEL_ENV: previousEnvironment.vercelEnv })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  for (const tag of ['off', 'other-route', 'non-action', 'no-ack', 'reject', 'different-topic', 'unknown-receipt', 'blocked-first', 'blocked-recovery', 'settled-recovery', 'new-token']) tags.delete(tag);
}
writeFileSync(join(directory, 'result.json'), JSON.stringify({ status: 'pass', checks: results,
  boundary: 'Offline instrumentation boundaries with loopback transport fixture and the real installed Next backend; not authenticated product or database proof.',
  hooksRestored: true, listenersClosed: true }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'pass', checks: results.length, artifact: join(directory, 'result.json') }));
