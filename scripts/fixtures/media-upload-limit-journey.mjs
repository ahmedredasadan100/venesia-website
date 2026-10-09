import {verifyPickerUploads} from './media-picker-upload-journey.mjs';
// Reusable Browser journey owned by qa-isolated-supabase --media-upload-limit-proof.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium, request as playwrightRequest } from 'playwright';
import { expect } from 'playwright/test';

const origin = process.env.E2E_BASE_URL;
assert.equal(new URL(origin).hostname, '127.0.0.1');
const storagePrefixes = JSON.parse(process.env.QA_ADMIN_STORAGE_PUBLIC_PREFIXES);
const storageOrigin = new URL(storagePrefixes[0]).origin;
assert.equal(new URL(storageOrigin).hostname, '127.0.0.1');
const MiB = 1024 * 1024;
const image = await sharp({ create: { width: 2048, height: 1024, channels: 3, background: '#456789' } }).png({ compressionLevel: 0 }).toBuffer();
assert.ok(image.length > 5 * MiB && image.length < 7 * MiB);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [], transfers = [], completions = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() === 'PUT') {
    assert.equal(new URL(request.url()).origin, storageOrigin);
    transfers.push({ method: 'PUT', directToLocalStorage: true });
  }
});
const api = '/api/admin/media-library';
const json = async (data, client = page.request) => client.post(origin + api, { data });
async function setLimit(limit) {
  await page.goto(origin + '/admin/settings/media');
  const input = page.locator('[name="maxImageMb"]');
  await input.fill(String(limit));
  const form = input.locator('xpath=ancestor::form');
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText('تم حفظ إعدادات رفع الملفات.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator('[name="maxImageMb"]')).toHaveValue(String(limit));
  const policy = await page.request.get(origin + api + '?policy=upload');
  assert.equal(policy.status(), 200);
  assert.equal((await policy.json()).uploadPolicy.maxImageBytes, limit * MiB);
}
async function uploadViaUi(name) {
  await page.goto(origin + '/admin/media-library');
  await expect(page.getByRole('button', { name: 'رفع ملفات', exact: true })).toBeEnabled({ timeout: 30_000 });
  const completed = page.waitForResponse(response => response.url() === origin + api
    && response.request().postDataJSON()?.operation === 'complete_upload');
  await page.locator('input[type="file"][multiple]').setInputFiles({ name, mimeType: 'image/png', buffer: image });
  const response = await completed;
  assert.equal(response.status(), 201, await response.text());
  const result = await response.json();
  assert.equal(result.asset.sizeBytes, image.length);
  assert.ok(result.asset.publicUrl.startsWith(storagePrefixes[0]));
  const persisted = await page.request.get(result.asset.publicUrl);
  assert.equal(persisted.status(), 200); assert.deepEqual(await persisted.body(), image);
  completions.push({ id: result.asset.id, objectKey: result.asset.objectKey, sizeBytes: result.asset.sizeBytes });
  await expect(page.getByText('تمت إضافة 1 ملف إلى المكتبة.', { exact: true })).toBeVisible();
}
try {
  const anonymous = await playwrightRequest.newContext();
  for (const operation of ['prepare_upload', 'complete_upload']) {
    assert.equal((await json({ operation }, anonymous)).status(), 401);
  }
  await anonymous.dispose();
  await page.goto(origin + '/admin/login');
  await page.locator('[name="username"]').fill(process.env.QA_ADMIN_USERNAME);
  await page.locator('[name="password"]').fill(process.env.QA_ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => url.pathname !== '/admin/login');
  await setLimit(10);
  const reconciliation = await json({ operation: 'reconcile', dryRun: false });
  assert.equal(reconciliation.status(), 200, await reconciliation.text());
  await uploadViaUi('configured-limit-six-mib.png');
  assert.equal(transfers.length, 1);
  const denied = await json({ operation: 'prepare_upload', folder: 'images', kind: 'image', file: { name: 'too-large.png', type: 'image/png', size: 10 * MiB + 1 } });
  assert.equal(denied.status(), 400); assert.match((await denied.json()).error, /10 ميجابايت/);
  // The actual UI rejects before any signed transfer.
  await page.locator('input[type="file"][multiple]').setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * MiB + 1) });
  await expect(page.getByText(/حجم الملف أكبر من الحد المسموح \(10 ميجابايت\)/).first()).toBeVisible();
  assert.equal(transfers.length, 1);
  // A prepared upload does not freeze the policy. Completion rereads it.
  const prepared = await json({ operation: 'prepare_upload', folder: 'images', kind: 'image', file: { name: 'changed-policy.png', type: 'image/png', size: image.length } });
  assert.equal(prepared.status(), 200); const pending = await prepared.json();
  assert.equal(new URL(pending.signedUrl).origin, storageOrigin);
  assert.equal((await json({ operation: 'complete_upload', receipt: pending.receipt + 'tampered' })).status(), 400);
  await setLimit(2);
  const direct = await page.request.put(pending.signedUrl, { multipart: { '': { name: 'changed-policy.png', mimeType: 'image/png', buffer: image } } });
  assert.ok(direct.ok(), await direct.text());
  const stale = await json({ operation: 'complete_upload', receipt: pending.receipt });
  assert.equal(stale.status(), 400); assert.match((await stale.json()).error, /2 ميجابايت/);
  await setLimit(7);
  await uploadViaUi('configured-limit-after-runtime-change.png');
  const illegal = await page.request.post(storageOrigin + '/storage/v1/object/cms-images/images/unauthorized.png', { data: image, headers: { 'Content-Type': 'image/png' } });
  assert.ok([400, 401, 403].includes(illegal.status()));
  await verifyPickerUploads({page,origin,api,transfers});
  assert.deepEqual(errors, []);
  const proof = { status: 'pass', sourceSha256: process.env.QA_ADMIN_SOURCE_SHA256, imageBytes: image.length,
    adminSaveReload: [10, 2, 7], realSignedStorageUploads: completions, directBrowserTransfers: transfers,
    overLimitClientAndServerRejected: true, policyChangeAtCompletionRejected: true,
    unsignedStorageWriteDenied: true, unauthenticatedApiDenied: true, tamperedReceiptDenied: true,
    sameApplicationProcess: true, pageErrors: errors, productionAccess: false };
  writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT, 'media-upload-browser-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ status: 'pass', imageBytes: image.length, accepted: completions.length, adminSaveReload: proof.adminSaveReload }));
} catch (error) {
  await page.screenshot({path:path.join(process.env.QA_ADMIN_OUTPUT,'media-upload-failure.png'),fullPage:true}).catch(()=>{});
  writeFileSync(path.join(process.env.QA_ADMIN_OUTPUT,'media-upload-failure.txt'),String(error)+'\n'+await page.locator('body').innerText().catch(()=>''));
  throw error;
} finally { await context.close(); await browser.close(); }
