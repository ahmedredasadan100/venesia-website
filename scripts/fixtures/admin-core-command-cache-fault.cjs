/* eslint-disable @typescript-eslint/no-require-imports -- Fixed verification-only Node preload, before Next imports. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createHash } = require('node:crypto');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const controlPath = process.env.QA_ADMIN_CORE_CACHE_CONTROL;
assert.ok(controlPath && path.isAbsolute(controlPath) && path.basename(controlPath) === 'admin-core-cache-control.json'
  && controlPath.includes(path.sep + '.tmp-qa' + path.sep), 'The cache fault needs its fixed owned control file.');
assert.equal(fs.realpathSync(path.dirname(controlPath)), path.dirname(controlPath), 'Control directory must not redirect.');
assert.equal(fs.realpathSync(controlPath), controlPath, 'Control file must not redirect.');
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV, 'This instrumentation only belongs to the owned local server.');
const dataOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(dataOrigin.protocol === 'http:' && dataOrigin.hostname === '127.0.0.1' && dataOrigin.port
  && !dataOrigin.username && !dataOrigin.password && dataOrigin.pathname === '/' && !dataOrigin.search && !dataOrigin.hash,
  'The cache fault requires the owned loopback Data API.');
const eventsPath = path.join(path.dirname(controlPath), 'admin-core-cache-events.jsonl');
assert.equal(fs.existsSync(eventsPath), false, 'A cache observation session cannot overwrite prior evidence.');
const write = row => fs.appendFileSync(eventsPath, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n', { mode: 0o600 });
function readControl() {
  assert.equal(fs.realpathSync(controlPath), controlPath);
  const row = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
  assert.equal(row.schemaVersion, 1);
  assert.ok(['off', 'armed', 'recover'].includes(row.mode), 'Unknown cache fault mode.');
  if (row.mode !== 'off') {
    assert.match(row.token, UUID);
    assert.ok(Number.isSafeInteger(row.topicId) && row.topicId > 0);
    assert.equal(typeof row.expectedFeatured, 'boolean');
  }
  return row;
}
assert.equal(readControl().mode, 'off', 'The owner must start an inert cache fault session.');
const modules = ['next/package.json', 'next/dist/server/lib/incremental-cache/file-system-cache.js',
  'next/dist/server/lib/incremental-cache/index.js', 'next/dist/server/revalidation-utils.js', 'next/dist/server/app-render/action-handler.js'];
write({ type: 'installed', nextVersion: require('next/package.json').version, backend: 'FileSystemCache',
  modules: modules.map(name => ({ name, sha256: createHash('sha256').update(fs.readFileSync(require.resolve(name))).digest('hex') })) });
const FileSystemCache = require('next/dist/server/lib/incremental-cache/file-system-cache.js').default;
assert.equal(typeof FileSystemCache.prototype.revalidateTag, 'function');
const originalBackend = FileSystemCache.prototype.revalidateTag;
const originalFetch = globalThis.fetch;
const originalEmit = http.Server.prototype.emit;
const store = new AsyncLocalStorage();
const committed = new Map();
let serial = 0;
http.Server.prototype.emit = function(event, ...args) {
  if (event !== 'request') return originalEmit.call(this, event, ...args);
  const [request, response] = args;
  const control = readControl();
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (control.mode === 'off' || pathname !== '/admin/content/topics' || request.method !== 'POST' || !request.headers['next-action']) {
    return originalEmit.call(this, event, ...args);
  }
  const context = { requestId: ++serial, token: control.token, topicId: control.topicId, commandId: null, proof: null };
  write({ type: 'action-start', requestId: context.requestId, token: context.token, topicId: context.topicId });
  response.once('finish', () => write({ type: 'action-finish', requestId: context.requestId, token: context.token,
    commandId: context.commandId, status: response.statusCode, proof: context.proof }));
  return store.run(context, () => originalEmit.call(this, event, ...args));
};
function acceptReceipt(row, context, control) {
  const command = row?.metadata?.command;
  const known = committed.get(control.token);
  if (!known || command?.id !== known.commandId || command?.result?.ok !== true
    || command.result.commandId !== known.commandId || command.intent?.action !== known.action
    || !Array.isArray(command.intent.ids) || command.intent.ids.length !== 1 || Number(command.intent.ids[0]) !== control.topicId) return;
  context.commandId = known.commandId; context.proof = 'atomic-receipt-read';
  write({ type: 'receipt-read', requestId: context.requestId, token: control.token, topicId: control.topicId, commandId: known.commandId });
}
globalThis.fetch = async function(input, init) {
  const context = store.getStore();
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!context || url.origin !== dataOrigin.origin) return originalFetch.call(this, input, init);
  const control = readControl();
  if (control.mode === 'off' || control.token !== context.token) return originalFetch.call(this, input, init);
  const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
  const rpc = method === 'POST' && url.pathname === '/rest/v1/rpc/admin_mutate_topics_batch_atomically';
  const audit = method === 'GET' && url.pathname === '/rest/v1/admin_audit_logs';
  let command;
  if (rpc) {
    const body = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : null;
    if (body) command = JSON.parse(body);
    if (command && ['feature', 'unfeature'].includes(command.p_action) && Array.isArray(command.p_topic_ids)
      && command.p_topic_ids.length === 1 && Number(command.p_topic_ids[0]) === control.topicId) {
      assert.match(command.p_command_id, UUID);
      assert.equal(command.p_action === 'feature', control.expectedFeatured);
      write({ type: 'domain-rpc-attempt', requestId: context.requestId, token: control.token, topicId: control.topicId, commandId: command.p_command_id });
    } else command = null;
  }
  // The original SDK transport and response are preserved; only a clone is observed.
  const response = await originalFetch.call(this, input, init);
  if (command || audit) {
    let payload;
    try { payload = await response.clone().json(); } catch { return response; }
    if (command && response.ok && payload?.ok === true && payload.commandId === command.p_command_id
      && Array.isArray(payload.changedIds) && payload.changedIds.length === 1 && Number(payload.changedIds[0]) === control.topicId) {
      const known = committed.get(control.token);
      assert.ok(!known || known.commandId === command.p_command_id, 'One fixture token must retain its original command identity.');
      committed.set(control.token, { commandId: command.p_command_id, action: command.p_action });
      context.commandId = command.p_command_id; context.proof = 'validated-rpc-ack';
      write({ type: 'rpc-committed', requestId: context.requestId, token: control.token, topicId: control.topicId, commandId: command.p_command_id, status: response.status });
    } else if (audit && response.ok) {
      for (const row of Array.isArray(payload) ? payload : [payload]) acceptReceipt(row, context, control);
    }
  }
  return response;
};
FileSystemCache.prototype.revalidateTag = async function(...args) {
  const context = store.getStore();
  const control = readControl();
  if (!context || control.mode === 'off' || control.token !== context.token || !context.commandId || !context.proof) {
    return originalBackend.apply(this, args);
  }
  const proof = { requestId: context.requestId, token: context.token, topicId: context.topicId,
    commandId: context.commandId, proof: context.proof, backend: 'FileSystemCache', tagCount: Array.isArray(args[0]) ? args[0].length : 1 };
  if (control.mode === 'armed') {
    write({ type: 'backend-failed', ...proof });
    throw new Error('QA_OWNED_POST_COMMIT_CACHE_BACKEND_FAILURE');
  }
  const result = await originalBackend.apply(this, args);
  write({ type: 'backend-settled', ...proof });
  return result;
};
// Used solely by the offline boundary verifier after its real installed backend exercise.
module.exports = { restore() {
  globalThis.fetch = originalFetch; http.Server.prototype.emit = originalEmit;
  FileSystemCache.prototype.revalidateTag = originalBackend;
} };
