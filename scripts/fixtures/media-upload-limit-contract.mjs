import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Owned by verify-media-library-system: executes the shared upload contract.
export async function verifyMediaUploadLimitContract() {
  // Execute production modules; isolate only authentication, database/storage,
  // catalog coordination and Next cache ports. No external network or mutation.
  const root = process.cwd();
  const stubs = new Map([['server-only', {}]]), modules = new Map();
  const stub = (file, value) => stubs.set(path.resolve(root, file), value);
  function load(file) {
    const filename = path.resolve(root, file);
    if (stubs.has(filename)) return stubs.get(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const target = { exports: {} }; modules.set(filename, target);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const localRequire = specifier => {
      if (stubs.has(specifier)) return stubs.get(specifier);
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier);
        for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
          if (stubs.has(candidate) || existsSync(candidate) && candidate.endsWith('.ts')) return load(candidate);
        }
      }
      return createRequire(filename)(specifier);
    };
    new vm.Script(`(function(require,module,exports){${source}\n})`, { filename })
      .runInThisContext()(localRequire, target, target.exports);
    return target.exports;
  }
  const storedFiles = new Map(), catalog = new Map();
  const state = { value: null, uploads: 0, writes: 0, readError: false, writeError: false, auth: true };
  const database = { from(table) {
    assert.equal(table, 'site_settings');
    return {
      select() { return this; }, eq(key, value) { assert.equal(key, 'key'); assert.equal(value, 'media.settings'); return this; },
      async maybeSingle() { return { data: state.value ? { value: structuredClone(state.value) } : null,
        error: state.readError ? { message: 'isolated read failure' } : null }; },
      async upsert(row) { assert.equal(row.key, 'media.settings');
        if (state.writeError) return { error: { code: '42501', message: 'isolated write failure' } };
        state.value = structuredClone(row.value); state.writes++; return { error: null }; },
    };
  }, storage: { from(bucket) { return {
    async upload(key, bytes) { assert.equal(bucket, 'cms-images'); assert.ok(bytes.byteLength > 0); assert.ok(key.startsWith('images/')); state.uploads++; return { error: null }; },
    async createSignedUploadUrl(key) { return { data: { signedUrl: `https://fixture.invalid/storage/${encodeURIComponent(key)}` }, error: null }; },
    async download(key) { return { data: storedFiles.get(key) ?? null, error: storedFiles.has(key) ? null : new Error('not found') }; },
    async remove(keys) { for (const key of keys) storedFiles.delete(key); return { error: null }; },
    getPublicUrl(key) { return { data: { publicUrl: `https://fixture.invalid/storage/v1/object/public/${bucket}/${key}` } }; },
  }; } } };
  stub('src/lib/supabase-admin.ts', { getSupabaseAdmin: () => database, getSupabaseStorageAdmin: () => database });
  stub('src/lib/admin/auth/session.ts', { getAdminAuthConfig: () => ({ configured: true, secret: 'isolated-upload-receipt-secret-only' }) });
  stub('src/lib/logging.ts', { logError() {} });
  stub('src/lib/admin/auth/require-admin-session.ts', { requireAdminSession: async () => ({ id: 17, session_version: 1 }) });
  stub('src/lib/admin/auth/require-admin-api.ts', { requireAdminApi: async () => state.auth ? null : Response.json({}, { status: 401 }) });
  stub('src/lib/admin/audit-log.ts', { recordCmsAdminAudit: async () => {} });
  stub('src/lib/cache/public-cache-generation.ts', { advancePublicCacheGeneration: async () => {} });
  stubs.set('next/cache', { revalidatePath() {}, revalidateTag() {}, updateTag() {} });
  stub('src/lib/admin/media-catalog/catalog.ts', {
    prepareCatalogUploadRegistration: async () => ({}),
    getCatalogAssetByIdentity: async identity => catalog.get(identity.objectKey) ?? null,
    registerCatalogUpload: async saved => { const asset = { id: 'fixture', uploadedBy: 17, status: 'active', missingObject: false, ...saved }; catalog.set(saved.objectKey, asset); return asset; },
    MediaCatalogUploadRegistrationUnprovenError: class extends Error {},
  });
  for (const name of ['reconciliation', 'physical-move', 'safe-delete', 'synchronization']) {
    stub(`src/lib/admin/media-catalog/${name}.ts`, {});
  }
  const policy = load('src/lib/admin/media-intelligence/cms-upload-policy.ts');
  const settings = load('src/lib/admin/media-catalog/settings.ts');
  const action = load('src/app/admin/settings/media/actions.ts');
  const route = load('src/app/api/admin/media-library/route.ts');
  const storageOwner = load('src/lib/storage/upload-cms-asset.ts');
  const adapter = storageOwner.createSupabaseCmsMediaStorageAdapter();
  const MiB = 1024 * 1024;
  const form = size => {
    const data = new FormData();
    for (const [key, value] of [['maxImageMb', String(size)], ['maxDocumentMb', '12'], ['allowedKinds', 'image'],
      ['allowedImageExtensions', '.jpg'], ['allowedImageExtensions', '.png'], ['allowedImageExtensions', '.webp'], ['allowedDocumentExtensions', '.pdf'], ['mimeVerification', 'on']]) data.append(key, value);
    return data;
  };
  const initial = { status: 'idle', mode: 'edit', revision: 0, message: '' };
  assert.equal((await action.updateMediaSettingsAction(initial, form(10))).status, 'success');
  assert.equal(state.value.maxImageBytes, 10 * MiB);
  modules.delete(path.resolve(root, 'src/lib/admin/media-catalog/settings.ts'));
  assert.equal((await load('src/lib/admin/media-catalog/settings.ts').loadMediaSettings()).maxImageBytes, 10 * MiB);
  async function receiveTransfer(request) {
    const key = decodeURIComponent(new URL(request.url).pathname.slice('/storage/'.length));
    const body = await request.formData(); storedFiles.set(key, body.get('')); state.uploads++;
    return Response.json({ Key: key });
  }
  const getPolicy = () => route.GET(new Request('http://localhost/api/admin/media-library?policy=upload'));
  let response = await getPolicy();
  assert.match(response.headers.get('cache-control'), /no-store/);
  let runtimePolicy = (await response.json()).uploadPolicy;
  const file = size => new File([new Uint8Array(size)], 'm10.jpg', { type: 'image/jpeg' });
  async function post(file) {
    const body = new FormData(); body.set('file', file); body.set('folder', 'images'); body.set('kind', 'image');
    return route.POST(new Request('http://localhost/api/admin/media-library', { method: 'POST', body }));
  }
  for (const [size, accepted] of [[10 * MiB - 1, true], [10 * MiB, true], [10 * MiB + 1, false]]) {
    const f = file(size), validation = policy.validateCmsUploadFile(f, 'image', runtimePolicy);
    assert.equal(validation.ok, accepted);
    const before = state.uploads;
    const result = await post(f);
    assert.equal(result.status, accepted ? 201 : 400);
    if (!accepted) { assert.equal((await result.json()).error, validation.message); assert.match(validation.message, /10 ميجابايت/); }
    assert.equal(state.uploads, before + Number(accepted));
  }
  // Run the actual client upload function, with its HTTP port routed to the real
  // handlers above. This proves wiring without claiming a mounted-browser test.
  const coreFile = 'src/components/admin/media/MediaLibraryCore.tsx';
  const coreSource = ts.createSourceFile(coreFile, readFileSync(coreFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let uploadNode;
  function findUpload(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'uploadOne') uploadNode = node;
    ts.forEachChild(node, findUpload);
  }
  findUpload(coreSource); assert.ok(uploadNode);
  const uploadCode = ts.transpileModule(uploadNode.getText(coreSource), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let clientPosts = 0;
  const uploadOne = new Function('fetch', 'validateCmsUploadFile', 'resolveCmsUploadKind', 'resolveCmsUploadFolder', 'pickerKind', 'folder', `${uploadCode}; return uploadOne;`)(
    async (url, init) => {
      if (url.endsWith('?policy=upload')) { assert.equal(init.cache, 'no-store'); return getPolicy(); }
      if (url.startsWith('https://fixture.invalid/storage/')) return receiveTransfer(new Request(url, init));
      clientPosts++; return route.POST(new Request(`http://localhost${url}`, init));
    }, policy.validateCmsUploadFile, policy.resolveCmsUploadKind, policy.resolveCmsUploadFolder, 'image', 'files/home');
  await uploadOne(file(10 * MiB));
  assert.equal(clientPosts, 2);
  await assert.rejects(uploadOne(file(10 * MiB + 1)), /10 ميجابايت/);
  assert.equal(clientPosts, 2);
  // Reproduce the screenshot's files/home + image/jpeg mismatch at the unchanged server.
  await assert.rejects(storageOwner.createSignedCmsUpload('files/home', file(MiB), 'image', 17, 1, {}), /نوع الملف لا يطابق/);
  assert.equal(policy.resolveCmsUploadFolder('files/home', 'image'), 'images');
  assert.equal(policy.resolveCmsUploadFolder('images/home', 'image'), 'images/home');
  assert.equal(policy.resolveCmsUploadFolder('images', 'pdf'), 'files');
  assert.equal(policy.resolveCmsUploadFolder('files/projects', 'pdf'), 'files/projects');
  assert.equal(policy.isCmsUploadFolderCompatible('files/home', 'image'), false);
  assert.equal(policy.isCmsUploadFolderCompatible('images-other', 'image'), false);
  assert.equal(policy.isCmsUploadFolderCompatible('images/home', 'image'), true);
  for (const [name, type] of [['slide-1.jpg', 'image/jpeg'], ['slide.png', 'image/png'], ['slide.webp', 'image/webp']]) {
    const asset = await uploadOne(new File([new Uint8Array(32)], name, { type }));
    assert.ok(asset.objectKey.startsWith('images/'));
  }
  const acceptedPosts = clientPosts;
  await assert.rejects(uploadOne(new File(['pdf'], 'wrong.pdf', { type: 'application/pdf' })), /امتداد غير مدعوم/);
  await assert.rejects(uploadOne(new File(['svg'], 'wrong.svg', { type: 'image/svg+xml' })), /SVG/);
  await assert.rejects(uploadOne(new File(['pdf'], 'wrong.jpg', { type: 'application/pdf' })), /غير متطابقين/);
  assert.equal(clientPosts, acceptedPosts, 'Rejected image-picker files never prepare or transfer.');
  // Receipts bind the existing Admin identity and session; stored bytes are revalidated.
  const signed = await storageOwner.createSignedCmsUpload('images', file(MiB), 'image', 17, 1, {});
  const receipt = storageOwner.readSignedCmsUploadReceipt(signed.receipt, 17, 1);
  assert.throws(() => storageOwner.readSignedCmsUploadReceipt(signed.receipt, 18, 1));
  assert.throws(() => storageOwner.readSignedCmsUploadReceipt(signed.receipt, 17, 2));
  assert.throws(() => storageOwner.readSignedCmsUploadReceipt(signed.receipt + 'x', 17, 1));
  const clock = Date.now;
  try {
    Date.now = () => receipt.expiresAt + 1;
    assert.throws(() => storageOwner.readSignedCmsUploadReceipt(signed.receipt, 17, 1));
  } finally { Date.now = clock; }
  storedFiles.set(receipt.objectKey, file(MiB + 1));
  await assert.rejects(storageOwner.readSignedCmsUpload(receipt));
  assert.equal(storedFiles.has(receipt.objectKey), false);
  // Direct adapter callers also obey the persisted value rather than the default.
  await adapter.uploadImage('images', file(6 * MiB));
  await assert.rejects(adapter.uploadImage('images', file(10 * MiB + 1)), /10 ميجابايت/);
  assert.equal((await action.updateMediaSettingsAction(initial, form(2))).status, 'success');
  runtimePolicy = (await (await getPolicy()).json()).uploadPolicy;
  assert.equal(runtimePolicy.maxImageBytes, 2 * MiB);
  await assert.rejects(uploadOne(file(3 * MiB)), /2 ميجابايت/);
  assert.equal(clientPosts, acceptedPosts);
  assert.equal((await post(file(3 * MiB))).status, 400);
  await assert.rejects(adapter.uploadImage('images', file(3 * MiB)), /2 ميجابايت/);
  for (const value of [undefined, null, {}, { maxImageBytes: 'bad' }, { maxImageBytes: -1 },
    { maxImageBytes: Infinity }, { maxImageBytes: 0 }, { maxImageBytes: 51 * MiB }]) {
    assert.equal(settings.parseMediaSettings(value).maxImageBytes, 5 * MiB);
  }
  assert.equal(settings.parseMediaSettings({ maxImageBytes: 50 * MiB }).maxImageBytes, 50 * MiB);
  assert.equal((await action.updateMediaSettingsAction(initial, form(51))).status, 'error');
  assert.equal(state.value.maxImageBytes, 2 * MiB);
  state.value = null;
  assert.equal((await (await getPolicy()).json()).uploadPolicy.maxImageBytes, 5 * MiB);
  state.readError = true;
  assert.equal((await getPolicy()).status, 500);
  await assert.rejects(adapter.uploadImage('images', file(MiB)), /isolated read failure/);
  state.readError = false; state.auth = false;
  assert.equal((await getPolicy()).status, 401);
  state.auth = true; state.writeError = true;
  assert.equal((await action.updateMediaSettingsAction(initial, form(10))).status, 'error');
  console.log('PASS: actual save/reload, runtime GET, API and adapter; 10MiB +/-1 byte and equality; change without restart; fallback, ceiling, auth/read/write failures. Ports isolated; no live upload claimed.');

}
