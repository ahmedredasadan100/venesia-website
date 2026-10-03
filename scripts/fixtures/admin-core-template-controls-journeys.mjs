import {exerciseCoreDownloadField,CORE_DOWNLOAD_MEDIA_HREF} from './admin-core-download-media-adoption.mjs';
import {observeCoreScrollbarAdoption,observeCoreModalFocusAdoption} from "./admin-core-rendered-adoption.mjs";
import {readFileSync} from "node:fs";
import {selectCoreLinkPreviewAction,assertCoreReadOnlyEditRequests} from "./admin-core-template-library-presentation-journeys.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";
import { coreTemplateFeedbackLinkValues, buildCoreTemplateControlsPlan, TEMPLATE_CONTROL_VALUES as values, TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS, assertCoreTemplateFeedbackAdapter, assertCoreTemplateReadApplicationCompletion } from "./admin-core-template-controls-contract.mjs";

/** Diagnostic only: preserve known transport codes without exposing arbitrary error text. */
export function coreTemplateReadFailureDiagnostic(failure){if(failure===null)return{code:null};const code=String(failure?.errorText??'');const allowed=['net::ERR_ABORTED','net::ERR_FAILED','net::ERR_CONNECTION_RESET','net::ERR_CONNECTION_CLOSED','net::ERR_NETWORK_CHANGED','net::ERR_INTERNET_DISCONNECTED','net::ERR_TIMED_OUT'];return allowed.includes(code)?{code}:{code:'OTHER',sha256:createHash('sha256').update(code).digest('hex')};}

/** Observe the application's original reader only. The init script lives until page/context disposal. */
export async function installCoreTemplateReadConsumptionObserver(page, { origin, pathname, actionId, expectedValues }) {
  assert.equal(new URL(origin).origin, origin);
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.ok(pathname.startsWith('/admin/pages-blocks/blocks/'));
  assert.ok(typeof actionId === 'string' && actionId.length > 0);
  assert.ok(Array.isArray(expectedValues) && expectedValues.length > 0 && expectedValues.length <= 2);
  const bodies = expectedValues.map(value => JSON.stringify([value]));
  assert.equal(new Set(bodies).size, bodies.length);
  const key = '__coreTemplateReadConsumption_' + randomUUID().replaceAll('-', '');
  const configuration = { key, origin, pathname, actionId, bodies, maxBytes: 65536, maxRequests: 8 };
  await page.addInitScript(function installOriginalReaderObserver(config) {
    if (location.origin !== config.origin || location.pathname !== config.pathname || globalThis[config.key]) return;
    const documentUrl = location.href, documentToken = crypto.randomUUID();
    const rows = [], streams = new WeakMap(), readers = new WeakMap();
    let active = true, overflow = false, observerError = false;
    const nativeFetch = globalThis.fetch, streamPrototype = ReadableStream.prototype;
    const readerPrototype = ReadableStreamDefaultReader.prototype;
    const nativeGetReader = streamPrototype.getReader, nativeRead = readerPrototype.read;
    const nativeReaderCancel = readerPrototype.cancel, nativeStreamCancel = streamPrototype.cancel;
    const note = callback => { try { callback(); } catch { observerError = true; } };
    const observePromise = (promise, fulfilled, rejected) => {
      // Side handlers observe settlement; the caller always receives the original promise.
      promise.then(value => note(() => fulfilled(value)), error => note(() => rejected(error)));
      return promise;
    };
    const rejected = (row, phase) => { row.errors.push(phase); };
    function observedFetch(...args) {
      const promise = Reflect.apply(nativeFetch, this, args);
      if (!active) return promise;
      note(() => {
        const [input, init] = args;
        const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, documentUrl);
        const method = String(init?.method ?? (typeof input === 'object' ? input.method : null) ?? 'GET').toUpperCase();
        const headers = new Headers(init?.headers ?? (typeof input === 'object' ? input.headers : undefined));
        const sentAction = headers.get('next-action');
        if (url.origin !== config.origin || url.pathname !== config.pathname || method !== 'POST' || !sentAction) return;
        if (rows.length >= config.maxRequests) { overflow = true; return; }
        const expectedIndex = typeof init?.body === 'string' ? config.bodies.indexOf(init.body) : -1;
        const row = { sequence: rows.length, expectedIndex, matched: sentAction === config.actionId && expectedIndex >= 0,
          documentToken, requestUrl: url.href, method, status: null, contentType: null, cacheControl: null,
          redirected: null, responseUrl: null, bytes: [], byteLength: 0, chunks: 0, reads: 0, done: false,
          readerCount: 0, cancelCount: 0, errors: [], overflow: false, unsupportedReader: false };
        rows.push(row);
        observePromise(promise, response => {
          row.status = response.status; row.contentType = response.headers.get('content-type');
          row.cacheControl = response.headers.get('cache-control'); row.redirected = response.redirected;
          row.responseUrl = response.url;
          if (row.matched) { if (response.body) streams.set(response.body, row); else rejected(row, 'missing-body'); }
        }, () => rejected(row, 'fetch-rejected'));
      });
      return promise;
    }
    function observedGetReader(...args) {
      const reader = Reflect.apply(nativeGetReader, this, args);
      const row = active && streams.get(this);
      if (row) note(() => { row.readerCount++; readers.set(reader, row); if (args[0]?.mode) row.unsupportedReader = true; });
      return reader;
    }
    function observedRead(...args) {
      const promise = Reflect.apply(nativeRead, this, args), row = active && readers.get(this);
      if (row) {
        row.reads++;
        observePromise(promise, result => {
          if (result.done) { row.done = true; return; }
          if (!(result.value instanceof Uint8Array)) { rejected(row, 'non-byte-chunk'); return; }
          row.chunks++; row.byteLength += result.value.byteLength;
          if (row.byteLength > config.maxBytes) { row.overflow = true; return; }
          // Copy only bytes already delivered by the original read; never read ahead or tee.
          row.bytes.push(Array.from(result.value));
        }, () => rejected(row, 'reader-rejected'));
      }
      return promise;
    }
    function observedReaderCancel(...args) {
      const row = active && readers.get(this); if (row) row.cancelCount++;
      return Reflect.apply(nativeReaderCancel, this, args);
    }
    function observedStreamCancel(...args) {
      const row = active && streams.get(this); if (row) row.cancelCount++;
      return Reflect.apply(nativeStreamCancel, this, args);
    }
    globalThis.fetch = observedFetch; streamPrototype.getReader = observedGetReader;
    readerPrototype.read = observedRead; readerPrototype.cancel = observedReaderCancel; streamPrototype.cancel = observedStreamCancel;
    globalThis[config.key] = {
      snapshot: () => ({ documentToken, documentUrl, pathname: location.pathname, active, overflow, observerError,
        rows: rows.map(row => ({ ...row, errors: [...row.errors], bytes: row.bytes.flat() })) }),
      deactivate: () => {
        active = false;
        if (globalThis.fetch === observedFetch) globalThis.fetch = nativeFetch;
        if (streamPrototype.getReader === observedGetReader) streamPrototype.getReader = nativeGetReader;
        if (readerPrototype.read === observedRead) readerPrototype.read = nativeRead;
        if (readerPrototype.cancel === observedReaderCancel) readerPrototype.cancel = nativeReaderCancel;
        if (streamPrototype.cancel === observedStreamCancel) streamPrototype.cancel = nativeStreamCancel;
      },
    };
  }, configuration);
  return {
    key,
    async snapshot() {
      const raw = await page.evaluate(key => globalThis[key]?.snapshot() ?? null, key);
      assert.ok(raw, 'TEMPLATE_READ_CONSUMPTION_MISSING_DOCUMENT');
      const sha = value => createHash('sha256').update(value).digest('hex');
      const { documentUrl, ...safe } = raw;
      return { ...safe, documentUrl, documentUrlSha256: sha(documentUrl), owner: 'src/lib/admin/links/actions.ts#resolveAdminLinkAjax',
        actionIdSha256: sha(actionId), rows: safe.rows.map(row => {
          const { requestUrl, responseUrl, bytes, ...rest } = row;
          return { ...rest, requestUrlSha256: sha(requestUrl), responseUrlSha256: sha(responseUrl ?? ''),
            payloadSha256: row.matched ? sha(bodies[row.expectedIndex]) : null,
            bytesBase64: Buffer.from(bytes).toString('base64'), bytesSha256: sha(Buffer.from(bytes)) };
        }) };
    },
    async deactivate() { await page.evaluate(key => globalThis[key]?.deactivate(), key); },
  };
}

export { assertCoreTemplateReadConsumption } from './admin-core-template-controls-contract.mjs';

/** Finish every admitted read or fail the leg within the existing 60-second verification bound. */
export async function finishCoreTemplateReadResponses(responses,{schedule=(callback,ms)=>setTimeout(callback,ms),cancel=timer=>clearTimeout(timer)}={}){
  assert.ok(Array.isArray(responses));let timer;
  const completion=Promise.all(responses.map(async response=>{assert.equal(response.status(),200);if(response.request().failure()!==null)throw Error('TEMPLATE_READ_REQUEST_FAILED');assert.equal(await response.finished(),null,'TEMPLATE_READ_RESPONSE_FAILED');if(response.request().failure()!==null)throw Error('TEMPLATE_READ_REQUEST_FAILED');}));
  try{await Promise.race([completion,new Promise((_,reject)=>{timer=schedule(()=>reject(Error('TEMPLATE_READ_FINISH_DEADLINE')),60000);})]);}finally{cancel(timer);}
}


/** Observation only: associate a read transport with its real Chromium document. */
export async function installCoreTemplateReadDocumentDiagnostic(page,origin,kind){
 const session=await page.context().newCDPSession(page),requests=new Map();let mainFrameId=null,currentDocument=null,eventCount=0;
 const sha=value=>createHash('sha256').update(String(value)).digest('hex');
 const emit=(event,details)=>{if(eventCount++<150)console.log('core-template-read-document '+JSON.stringify({kind,event,...details,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256}));};
 const urlProjection=value=>{const url=new URL(value);return{originMatches:url.origin===origin,urlSha256:sha(value)};};
 const documentProjection=frame=>({frameId:frame.id,loaderId:frame.loaderId,...urlProjection(frame.url)});
 session.on('Page.frameNavigated',({frame,type})=>{if(frame.parentId)return;mainFrameId=frame.id;currentDocument=documentProjection(frame);emit('document-navigated',{...currentDocument,type});});
 session.on('Page.navigatedWithinDocument',event=>{if(event.frameId===mainFrameId){if(currentDocument)currentDocument={...currentDocument,...urlProjection(event.url)};emit('same-document-navigated',{frameId:event.frameId,navigationType:event.navigationType,...urlProjection(event.url)});}});
 session.on('Network.requestWillBeSent',event=>{const request=event.request,url=new URL(request.url);if(url.origin!==origin)return;
  if(event.type==='Document'&&event.frameId===mainFrameId)emit('document-request',{requestId:event.requestId,loaderId:event.loaderId,frameId:event.frameId,timestamp:event.timestamp,...urlProjection(request.url)});
  const actionKey=Object.keys(request.headers).find(key=>key.toLowerCase()==='next-action');if(request.method!=='POST'||!actionKey)return;
  const row={requestId:event.requestId,loaderId:event.loaderId,frameId:event.frameId,timestamp:event.timestamp,wallTime:event.wallTime,actionIdSha256:sha(request.headers[actionKey]),postDataAvailable:typeof request.postData==='string',payloadSha256:typeof request.postData==='string'?sha(request.postData):null,documentUrlSha256:sha(event.documentURL),...urlProjection(request.url),response:null,terminal:null};requests.set(event.requestId,row);emit('action-request',row);
 });
 session.on('Network.responseReceived',event=>{const row=requests.get(event.requestId);if(!row)return;const headers=event.response.headers,header=name=>{const key=Object.keys(headers).find(key=>key.toLowerCase()===name);return key===undefined?null:String(headers[key]);};const response={requestId:event.requestId,loaderId:event.loaderId,frameId:event.frameId,timestamp:event.timestamp,status:event.response.status,mimeType:event.response.mimeType,contentType:header('content-type'),cacheControl:header('cache-control'),hasActionRedirect:Object.keys(headers).some(key=>key.toLowerCase()==='x-action-redirect')};row.response=response;emit('action-response',response);});
 session.on('Network.loadingFinished',event=>{const row=requests.get(event.requestId);if(!row)return;const terminal={kind:'finished',requestId:event.requestId,timestamp:event.timestamp,encodedDataLength:event.encodedDataLength};row.terminal=terminal;emit('action-finished',{requestId:event.requestId,timestamp:event.timestamp,encodedDataLength:event.encodedDataLength});});
 session.on('Network.loadingFailed',event=>{const row=requests.get(event.requestId);if(!row)return;const details={requestId:event.requestId,timestamp:event.timestamp,canceled:typeof event.canceled==='boolean'?event.canceled:null,failure:coreTemplateReadFailureDiagnostic({errorText:event.errorText}),blockedReason:event.blockedReason??null};row.terminal={kind:'failed',...details};emit('action-failed',details);});
 await session.send('Page.enable');await session.send('Network.enable');const initial=await session.send('Page.getFrameTree');mainFrameId=initial.frameTree.frame.id;currentDocument=documentProjection(initial.frameTree.frame);emit('initial-document',currentDocument);
 return{snapshot:async()=>{const tree=await session.send('Page.getFrameTree');currentDocument=documentProjection(tree.frameTree.frame);mainFrameId=currentDocument.frameId;return{currentDocument:{...currentDocument},requests:[...requests.values()].filter(row=>row.frameId===currentDocument.frameId&&row.loaderId===currentDocument.loaderId&&row.documentUrlSha256===currentDocument.urlSha256&&row.urlSha256===currentDocument.urlSha256).map(row=>structuredClone(row))};},close:async()=>{console.log('core-template-read-document '+JSON.stringify({kind,event:'diagnostic-end',events:eventCount,truncated:eventCount>150,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256}));try{await session.detach();}catch(error){console.log('core-template-read-document '+JSON.stringify({kind,event:'diagnostic-close-failed',messageSha256:sha(error instanceof Error?error.message:String(error)),sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256}));}}};
}
/** Only finite owned templates. No generic capability/axis is promoted here. */
export async function runCoreTemplateControlsJourneys(ctx) {
  const { page, origin, fixtures, run, observe, actionResponse, assertActionAcknowledged, nativeCheckpoint, requiredCases } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const f = fixtures.templateControls; assert.ok(f);assert.equal(f.selection??null,ctx.journeySelection??null);
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const plan = buildCoreTemplateControlsPlan({ manifest, fixtures: f }), outcomes = [];
  let currentRecipe, renderedAdoption = [], renderedSeen = new Set();
  const input = (form, name) => form.locator('[name="' + name + '"]:not([type="hidden"])');
  const state = (form, name) => form.locator('[name="' + name + '"]');
  const formFor = id => page.locator("form").filter({ has: page.locator('input[name="id"][value="' + id + '"]') });
  const save = form => form.locator('button[type="submit"]');
  const checkpoint = async (recipe, phase) => { const request = { id: randomUUID(), kind: "template-controls-state", recipe, phase }; const result = await nativeCheckpoint(request); for (const key of Object.keys(request)) assert.equal(result[key], request[key]); assert.equal(result.status, "pass"); return result; };
  const tab = (form, name) => form.locator('[data-admin-tab-id="' + name + '"]').click();

  async function select(form, name, value) {
    const owner = form.locator('[data-admin-form-listbox]').filter({ has: page.locator('select[name="' + name + '"]') });
    await expect(owner).toHaveCount(1);
    const source = owner.locator("select"), combo = owner.getByRole("combobox");
    const choices = await source.locator("option").evaluateAll(options => options.filter(o => o.value && !o.disabled).map(o => ({ value: o.value, label: o.textContent })));
    const index = choices.findIndex(option => option.value === String(value));
    assert.ok(index >= 0, "The current control must actually expose " + name + "=" + value);
    // Actual installed listbox keyboard contract: Home, ArrowDown, Enter.
    await combo.press("Home");
    for (let i = 0; i < index; i++) await combo.press("ArrowDown");
    await combo.press("Enter");
    await expect(source).toHaveValue(String(value)); await expect(combo).toBeFocused();
  }
  async function setChecked(control, checked) {
    await expect(control).toHaveCount(1);
    if (await control.isChecked() !== checked) await control.locator("xpath=ancestor::label[1]").click();
    if (checked) await expect(control).toBeChecked(); else await expect(control).not.toBeChecked();
  }
  async function titleFormat(form, formatField = "title") {
    const row = form.locator("[data-module-editor-control-row]").filter({ has: page.locator('input[name="'+formatField+'_alignment"]') });
    await expect(row).toHaveCount(1); await input(form, "title").fill(values.title);
    await setChecked(row.getByRole("switch"), false); await expect(state(form, "show_" + formatField)).toHaveValue("false");
    await setChecked(row.getByRole("switch"), true);
    const bold = row.locator("[data-admin-text-format-bold]");
    if (await bold.getAttribute("aria-pressed") !== "false") await bold.click();
    await row.locator('[data-admin-text-alignment="left"]').click();
    await row.locator('[data-admin-text-alignment="center"]').click();
    await expect(state(form, formatField + "_bold")).toHaveValue("false");
    await expect(state(form, formatField + "_alignment")).toHaveValue("center");
  }
  const linkOwner = (form, prefix) => state(form, prefix + "_link_kind").locator("xpath=..");
  async function chooseExternal(form, prefix, href, target, cancelOnly = false) {
    const owner = linkOwner(form, prefix), trigger = owner.getByRole("button", { name: "اختيار الرابط", exact: true });
    const before = await state(form, prefix + "_link_href").inputValue();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "اختيار رابط", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "External", exact: true }).click();
    await dialog.getByLabel("الرابط", { exact: true }).fill(href);
    await setChecked(dialog.getByRole("switch", { name: "فتح في تبويب جديد", exact: true }), target === "_blank");
    await expect(state(form, prefix + "_link_href")).toHaveValue(before);
    if(!renderedSeen.has('link:'+prefix)){
      const common={page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:currentRecipe.consumer,surface:currentRecipe.surface}]};
      renderedAdoption.push(await observeCoreModalFocusAdoption({...common,id:'template-controls-'+currentRecipe.kind+'-'+prefix+'-link-focus',dialog}));
      const body=dialog.locator(':scope > div').filter({has:page.getByLabel('الرابط',{exact:true})}),target=dialog.getByRole('switch',{name:'فتح في تبويب جديد',exact:true}).locator('xpath=ancestor::label[1]');
      renderedAdoption.push(await observeCoreScrollbarAdoption({...common,id:'template-controls-'+currentRecipe.kind+'-'+prefix+'-link-scroll',container:body,target,axis:'y',containment:'modal-lock'}));
      renderedSeen.add('link:'+prefix);
    }
    if (cancelOnly) {
      await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
      await expect(state(form, prefix + "_link_href")).toHaveValue(before);
    } else {
      await dialog.getByRole("button", { name: "اعتماد الرابط", exact: true }).click();
      await expect(state(form, prefix + "_link_href")).toHaveValue(href);
      await expect(state(form, prefix + "_link_target")).toHaveValue(target);
    }
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  }
  async function numericNegative(form, name, valid) {
    const posts = [], listener = request => { if (request.method() === "POST" && request.headers()["next-action"]) posts.push(request); };
    await input(form, name).fill("0"); page.on("request", listener);
    try {
      await save(form).click();
      assert.equal(await input(form, name).evaluate(control => control.validity.rangeUnderflow), true);
      await expect(input(form, name)).toBeFocused();
      assert.equal(posts.length, 0, "Native invalid numeric form must not dispatch an Action.");
    } finally { page.off("request", listener); }
    await input(form, name).fill(String(valid));
  }
  async function viewportProof(form) {
    const previous = page.viewportSize(); const observations = [];
    try {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await save(form).scrollIntoViewIfNeeded(); await expect(save(form)).toBeVisible();
        const layout = await form.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, pageScroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        assert.ok(layout.scroll <= layout.client + 1, "The reached editor form must not overflow horizontally.");
        assert.ok(layout.pageScroll <= layout.viewport + 1, "The reached editor must not cause page overflow.");
        observations.push({ width, saveReachable: true, horizontalOverflow: false });
      }
    } finally { if (previous) await page.setViewportSize(previous); }
    return observations;
  }
  async function authorCards(form) {
    while (await form.getByRole("button", { name: /^حذف البطاقة \d+$/u }).count() > 1) await form.getByRole("button", { name: /^حذف البطاقة \d+$/u }).last().click();
    await expect(form.getByRole("button", { name: "حذف البطاقة 1", exact: true })).toBeDisabled();
    await expect(form.getByRole("button", { name: "تحريك البطاقة 1 لأعلى", exact: true })).toBeDisabled();
    await select(form, "columns", "2"); await select(form, "columns", "4");
    for (let i = 0; i < 3; i++) {
      if (i) await form.getByRole("button", { name: "إضافة بطاقة", exact: true }).click();
      for (const key of ["icon", "title", "body"]) await input(form, "item_" + i + "_" + key).fill(values.cards[i][key]);
      if (i < 2) await chooseExternal(form, "item_" + i, values.hrefs[i], i ? "_self" : "_blank");
    }
    await form.getByRole("button", { name: "تحريك البطاقة 2 لأعلى", exact: true }).click();
    await expect(input(form, "item_0_title")).toHaveValue(values.cards[1].title);
    await expect(state(form, "item_0_link_href")).toHaveValue(values.hrefs[1]);
    await form.getByRole("button", { name: "حذف البطاقة 3", exact: true }).click();
    await expect(input(form, "item_2_title")).toHaveCount(0); await titleFormat(form);
  }
  async function authorBreadcrumb(form) {
    while (await form.getByRole("button", { name: /^حذف عنصر المسار \d+$/u }).count()) await form.getByRole("button", { name: /^حذف عنصر المسار \d+$/u }).last().click();
    await select(form, "source", "navigation"); await select(form, "source", "manual");
    await setChecked(input(form, "show_home"), true); await setChecked(input(form, "show_home"), false);
    await input(form, "current_label_override").fill(values.title);
    for (let i = 0; i < 3; i++) {
      await form.getByRole("button", { name: "إضافة عنصر مسار", exact: true }).click();
      await input(form, "manual_item_" + i + "_label").fill(values.breadcrumbs[i]);
      if (i < 2) await chooseExternal(form, "manual_item_" + i, values.hrefs[i], i ? "_self" : "_blank");
    }
    await form.getByRole("button", { name: "تحريك عنصر المسار 2 لأعلى", exact: true }).click();
    await expect(input(form, "manual_item_0_label")).toHaveValue(values.breadcrumbs[1]);
    await expect(state(form, "manual_item_0_link_href")).toHaveValue(values.hrefs[1]);
    await form.getByRole("button", { name: "حذف عنصر المسار 3", exact: true }).click();
    await expect(input(form, "manual_item_2_label")).toHaveCount(0);
  }
  async function authorCta(form) {
    await select(form, "background_style", "gold"); await select(form, "background_style", "gradient");
    await input(form, "primary_cta_label").fill(values.primaryLabel);
    await chooseExternal(form, "primary_cta", values.hrefs[0], "_blank");
    await chooseExternal(form, "primary_cta", values.hrefs[1], "_self");
    await input(form, "secondary_cta_label").fill(values.secondaryLabel);
    await chooseExternal(form, "secondary_cta", values.hrefs[0], "_blank");
    await linkOwner(form, "secondary_cta").getByRole("button", { name: "مسح", exact: true }).click();
    await input(form, "secondary_cta_label").fill("");
    await expect(state(form, "secondary_cta_link_kind")).toHaveValue("none");
    await expect(state(form, "secondary_cta_link_href")).toHaveValue(""); await titleFormat(form);
  }
  async function authorFeed(form) {
    const categories = form.locator('input[name="category_slugs"]');
    for (const control of await categories.all()) await setChecked(control, false);
    const category = form.locator('input[name="category_slugs"][value="' + f.category.slug + '"]');
    const other = form.locator('input[name="category_slugs"][value="' + f.otherCategory.slug + '"]');
    const series = form.locator('input[name="series_slugs"][value="' + f.series.slug + '"]');
    await setChecked(category, true); await setChecked(series, true);
    await setChecked(other, true); await setChecked(category, false);
    await expect(series).toHaveCount(0); await expect(form.locator("[data-feed-series-all]")).toBeChecked();
    await setChecked(category, true); await setChecked(other, false); await setChecked(series, true);
    await form.locator("[data-feed-series-all]").locator("xpath=ancestor::label[1]").click();
    await expect(series).not.toBeChecked(); await setChecked(series, true);
    for (const [kind, layout] of [["latest", "slider"], ["popular", "grid"], ["categories", "grid"], ["series", "list"]]) {
      await select(form, "feed_type", kind); await select(form, kind + "_layout", layout);
      if (kind === "latest") {
        await select(form, "latest_density", "2");
        await setChecked(input(form, "latest_show_arrows"), false); await setChecked(input(form, "latest_show_dots"), true);
      } else if (kind !== "series") await select(form, kind + "_columns", kind === "popular" ? "2" : "3");
      else {
        await input(form, "series_list_items_per_group").fill("2"); await input(form, "series_list_interval_seconds").fill("9");
        await setChecked(input(form, "series_list_show_dots"), false);
      }
    }
    await select(form, "feed_type", "latest"); await input(form, "limit").fill("7");
  }
  async function authorFeatured(form) {
    await select(form, "source_kind", "categories"); await select(form, "category_slug", f.category.slug);
    await select(form, "selection_mode", "manual");
    const manual=form.locator('[data-featured-manual-items-scroll]');await expect(manual).toHaveCount(1);
    renderedAdoption.push(await observeCoreScrollbarAdoption({page,origin,requiredCases,formManifest:manifest,bindings:[{boundary:'form',consumer:currentRecipe.consumer,surface:currentRecipe.surface}],id:'template-controls-featured-manual-scroll',container:manual,target:manual.locator(':scope > label').last(),axis:'y',containment:'default-chaining'}));
    for (const remove of await form.locator("[data-featured-manual-remove]").all()) await remove.click();
    const article = form.getByRole("checkbox", { name: "اختيار " + f.article.title, exact: true });
    await setChecked(article, true); await setChecked(article, false); await setChecked(article, true);
    await expect(form.locator('[name="manual_topic_ids"]')).toHaveCount(1);
    await select(form, "source_kind", "media-center"); await select(form, "content_type", "news");
    await expect(form.locator('[data-featured-item-id="' + f.article.id + '"]')).toHaveAttribute("data-featured-resolution", "unresolved");
    await setChecked(form.getByRole("checkbox", { name: "اختيار " + f.news.title, exact: true }), true);
    assert.deepEqual(await form.locator('[name="manual_topic_ids"]').evaluateAll(nodes => nodes.map(node => Number(node.value))), [f.article.id, f.news.id]);
    await select(form, "source_kind", "categories");
    await expect(form.locator('[data-featured-item-id="' + f.news.id + '"]')).toHaveAttribute("data-featured-resolution", "unresolved");
    await form.locator('[data-featured-manual-remove="' + f.news.id + '"]').click();
    await input(form, "item_limit").fill("3");
    await tab(form, "presentation"); await select(form, "presentation_variant", "list"); await tab(form, "content");
  }
  async function authorSidebar(form) {
    await select(form, "widget_key", "sections"); await expect(input(form, "limit")).toHaveCount(0);
    await expect(form.locator('select[name="source_kind"]')).toHaveCount(0);
    await select(form, "widget_key", "latest"); await select(form, "source_kind", "categories"); await select(form, "category_slug", f.category.slug);
    await select(form, "source_kind", "media-center"); await select(form, "content_type", "video");
    await select(form, "widget_key", "popular"); await select(form, "presentation", "group-carousel");
    for (const [name, value] of Object.entries({ show_title: true, show_image: false, show_category: false, show_series: false, show_excerpt: true, show_date: false })) {
      const control = input(form, name + "_on_page");
      await setChecked(control, value);
    }
    await input(form, "limit").fill("7");
  }
  async function authorHub(form) {
    await select(form, "section_key", "videos"); await select(form, "section_key", "press");
    await expect(input(form, "title")).toHaveValue("البيانات الصحفية"); await titleFormat(form, "section_title");
    await tab(form, "presentation"); await select(form, "collection_layout", "grid"); await select(form, "collection_layout", "list");
    const itemTitle = form.locator('[data-collection-display-settings] [data-module-editor-control-row]').filter({ has: page.locator('input[name="title_alignment"]') });
    await expect(itemTitle).toHaveCount(1);
    const itemBold = itemTitle.locator('[data-admin-text-format-bold]');
    if (await itemBold.getAttribute('aria-pressed') !== 'true') await itemBold.click();
    await itemTitle.locator('[data-admin-text-alignment="left"]').click();
    await expect(state(form, 'title_bold')).toHaveValue('true');
    await expect(state(form, 'title_alignment')).toHaveValue('left');
    await input(form, "item_limit").fill("5");
  }
  const author = { cards: authorCards, breadcrumb: authorBreadcrumb, cta: authorCta, feed: authorFeed, featured: authorFeatured, "media-sidebar": authorSidebar, "media-hub": authorHub };
  async function saveWithNativePending(recipe, form) {
    const token = randomUUID(), entity = "template_control_" + recipe.kind.replaceAll("-", "_");
    const fault = async operation => {
      const request = { id: randomUUID(), kind: "domain-write-fault-" + operation, entity, token };
      const result = await nativeCheckpoint(request);
      for (const key of Object.keys(request)) assert.equal(result[key], request[key]);
      assert.equal(result.status, "pass"); return result;
    };
    let armed = false, responsePromise;
    const posts = [], onRequest = request => {
      if (request.method() === "POST" && request.headers()["next-action"] && new URL(request.url()).origin === origin) posts.push(request);
    };
    try {
      await fault("arm"); armed = true;
      page.on("request", onRequest);
      responsePromise = actionResponse();
      // Observe the same promise immediately; the original rejection is still
      // awaited below, and finally drains it after releasing the owned lock.
      void responsePromise.catch(() => {});
      await save(form).click();
      const first = await fault("observe-blocked");
      assert.equal(first.observedOneStatement, true); assert.equal(first.cancelledOneStatement, false);
      const pending = form.locator("[data-admin-form-pending-fields]");
      await expect(pending).toHaveAttribute("aria-busy", "true");
      await expect(pending).toHaveAttribute("inert", "");
      await expect(save(form)).toBeDisabled(); await expect(input(form, "name")).toBeDisabled();
      // A normal keyboard repeat cannot activate the now-inert submit surface.
      // No forced click, dispatchEvent or hidden-field write is admitted.
      await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
      const second = await fault("observe-blocked");
      for (const key of ["backendPid", "backendStartedAt", "queryStartedAt", "queryFingerprint", "holderPid"]) assert.equal(second[key], first[key]);
      assert.equal(posts.length, 1, "Pending normal-keyboard repeats must not dispatch another Action.");
      const released = await fault("release"); armed = false;
      assert.equal(released.ownedLockRolledBack, true); assert.equal(released.cancellationObserved, false);
      const response = await responsePromise; assertActionAcknowledged(response);
      return { nativeBlockedStatementObservedTwice: true, sameStatementIdentity: true, fieldsDisabledAndInert: true,
        actionRequests: posts.length, keyboardRepeatDispatchedNoExtraAction: true, ownedLockReleased: true,
        closeControl: "not_declared_by_this_specialized_form", sharedFailureRetentionClaim: false };
    } finally {
      page.off("request", onRequest);
      try { if (armed) await fault("release"); }
      finally { if (responsePromise) await Promise.allSettled([responsePromise]); }
    }
  }


  async function checkReload(recipe, form) {
    const kind = recipe.kind;
    const field=({cards:"item_0",breadcrumb:"manual_item_0",cta:"primary_cta"})[kind];
    if(field){await expect(state(form,field+"_link_href")).toHaveValue(CORE_DOWNLOAD_MEDIA_HREF);await expect(state(form,field+"_link_kind")).toHaveValue("download");await expect(state(form,field+"_link_target")).toHaveValue("_blank");}
    if (kind === "cards") {
      await expect(form.locator('select[name="columns"]')).toHaveValue("4");
      for (let i = 0; i < 2; i++) {
        await expect(input(form, "item_" + i + "_title")).toHaveValue(values.cards[1 - i].title);
        await expect(state(form, "item_" + i + "_link_href")).toHaveValue(i ? values.hrefs[0] : CORE_DOWNLOAD_MEDIA_HREF);
      }
    } else if (kind === "breadcrumb") {
      await expect(form.locator('select[name="source"]')).toHaveValue("manual");
      await expect(input(form, "show_home")).not.toBeChecked();
      for (let i = 0; i < 2; i++) await expect(input(form, "manual_item_" + i + "_label")).toHaveValue(values.breadcrumbs[1 - i]);
    } else if (kind === "cta") {
      await expect(state(form, "primary_cta_link_href")).toHaveValue(CORE_DOWNLOAD_MEDIA_HREF);
      await expect(state(form, "secondary_cta_link_kind")).toHaveValue("none");
      await expect(input(form, "secondary_cta_label")).toHaveValue("");
    } else if (kind === "feed") {
      await expect(form.locator('select[name="feed_type"]')).toHaveValue("latest");
      await expect(input(form, "limit")).toHaveValue("7");
      await expect(form.locator('input[name="series_slugs"][value="' + f.series.slug + '"]')).toBeChecked();
    } else if (kind === "featured") {
      await expect(form.locator('[name="manual_topic_ids"]')).toHaveCount(1);
      await expect(form.locator('[name="manual_topic_ids"]')).toHaveValue(String(f.article.id));
      await tab(form, "presentation"); await expect(form.locator('select[name="presentation_variant"]')).toHaveValue("list");
    } else if (kind === "media-sidebar") {
      await expect(form.locator('select[name="widget_key"]')).toHaveValue("popular");
      await expect(form.locator('select[name="content_type"]')).toHaveValue("video");
      await expect(input(form, "limit")).toHaveValue("7");
    } else if (kind === "media-hub") {
      await expect(form.locator('select[name="section_key"]')).toHaveValue("press");
      await expect(input(form, "title")).toHaveValue(values.title);
      await tab(form, "presentation"); await expect(form.locator('select[name="collection_layout"]')).toHaveValue("list");
    }
  }
  async function feedbackAdapterProof(recipe,nativeBefore){
    const channel='block-editor:/admin/pages-blocks/blocks/'+recipe.kind,routePathname='/admin/pages-blocks/blocks/'+recipe.kind+'/'+recipe.template.id;
    const entry=()=>page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="'+channel+'"]');
    await expect(entry()).toHaveCount(1);await expect(entry()).toBeVisible();const actualAcceptedVariant=await entry().getAttribute('data-admin-feedback-variant');assert.ok(['success','warning'].includes(actualAcceptedVariant));
    const original=new URL(page.url());assert.equal(original.pathname,routePathname);const clean=new URL(original);for(const key of ['saved','notice','cache_warning'])clean.searchParams.delete(key);
    const expectedValues=coreTemplateFeedbackLinkValues(recipe.kind);let ownerProjection=null;
    const actionId=expectedValues.length?selectCoreLinkPreviewAction(JSON.parse(readFileSync(new URL('../../.next/server/server-reference-manifest.json',import.meta.url),'utf8')),'app/admin/pages-blocks/blocks/'+recipe.kind+'/[id]/page',{buildMetadata:JSON.parse(readFileSync(new URL('../../.next/required-server-files.json',import.meta.url),'utf8')),recordProjection:projection=>{ownerProjection=projection;console.log('core-template-feedback-read-projection '+JSON.stringify(projection));}}):null;
    const documentDiagnostic=await installCoreTemplateReadDocumentDiagnostic(page,origin,recipe.kind);
    const consumption=["cards","breadcrumb"].includes(recipe.kind)?await installCoreTemplateReadConsumptionObserver(page,{origin,pathname:routePathname,actionId,expectedValues}):null;
    const terminals=new Map(),onFinished=request=>terminals.set(request,{transportTerminal:"finished",transportError:null}),onFailed=request=>terminals.set(request,{transportTerminal:"failed",transportError:request.failure()?.errorText??"UNKNOWN"});
    page.on("requestfinished",onFinished);page.on("requestfailed",onFailed);
    let frameNavigationSequence=0,navigationPhase="before-first-navigation";const navigated=frame=>{if(frame===page.mainFrame()){frameNavigationSequence++;navigationPhase="main-frame-navigated";}};
    const requests=[],responses=new Map(),readLegs=[];const count=request=>{if(request.method()==='POST'&&request.headers()['next-action']&&new URL(request.url()).origin===origin)requests.push({request,frameNavigationSequence,navigationPhase,observedAt:Date.now(),method:request.method(),url:request.url(),actionId:request.headers()['next-action'],contentType:request.headers()['content-type']??'',body:request.postData()});};const onResponse=response=>{if(requests.some(row=>row.request===response.request()))responses.set(response.request(),response);};page.on('request',count);page.on('response',onResponse);page.on('framenavigated',navigated);
    async function settleReadLeg(id,start){
      const startedAt=Date.now(),expectedCount=start+expectedValues.length;let stage='start',proof=null,finishedCount=0;
      const diagnostic=reason=>console.log('core-template-feedback-read-leg '+JSON.stringify({kind:recipe.kind,leg:id,stage,reason,elapsedMs:Date.now()-startedAt,expectedCount:expectedValues.length,requestCount:requests.length-start,responseCount:requests.slice(start).filter(row=>responses.has(row.request)).length,failedCount:requests.slice(start).filter(row=>row.request.failure()!==null).length,finishedCount,frameNavigationSequence,navigationPhase,requestTimeline:requests.slice(start).map((row,index)=>({index,frameNavigationSequence:row.frameNavigationSequence,navigationPhase:row.navigationPhase,observedAt:row.observedAt,startedAt:row.request.timing().startTime,payloadSha256:createHash("sha256").update(row.body??"").digest("hex"),failure:coreTemplateReadFailureDiagnostic(row.request.failure()),contentType:responses.has(row.request)?responses.get(row.request).headers()["content-type"]??null:null})),statuses:requests.slice(start).filter(row=>responses.has(row.request)).map(row=>responses.get(row.request).status()),readProof:proof,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256}));
      try{
        diagnostic('BEGIN');await expect.poll(()=>requests.length,{timeout:60000}).toBe(expectedCount);stage='request-count';diagnostic('OBSERVED');
        await expect.poll(()=>requests.slice(start).filter(row=>responses.has(row.request)).length,{timeout:60000}).toBe(expectedValues.length);stage='response-count';diagnostic('OBSERVED');
        const rows=requests.slice(start);proof=assertCoreReadOnlyEditRequests(rows,{origin,pathname:routePathname,actionId,expectedValues});for(const row of rows)assert.equal(responses.get(row.request).status(),200);stage='payload-and-owner';diagnostic('VERIFIED');
        const tracked=rows.map(row=>{const response=responses.get(row.request);return{status:()=>response.status(),request:()=>row.request,finished:async()=>{const result=await response.finished();if(result===null)finishedCount++;return result;}};});
        stage='transport-finish';let applicationCompletion;
        if(consumption){
          await expect.poll(()=>rows.filter(row=>terminals.has(row.request)).length,{timeout:60000}).toBe(expectedValues.length);
          await expect.poll(async()=>{const snapshot=await consumption.snapshot();return snapshot.rows.length===expectedValues.length&&snapshot.rows.every(row=>row.done||row.errors.length||row.cancelCount||row.overflow);},{timeout:60000}).toBe(true);
          const snapshot=await consumption.snapshot(),hostRequests=rows.map(row=>{const response=responses.get(row.request),headers=response.headers();return{method:row.method,url:row.url,actionId:row.actionId,body:row.body,httpStatus:response.status(),contentType:headers['content-type']??null,cacheControl:headers['cache-control']??null,hasActionRedirect:Object.hasOwn(headers,'x-action-redirect'),...terminals.get(row.request)};});
          const documentNetwork=await documentDiagnostic.snapshot();
          console.log('core-template-original-reader-observation '+JSON.stringify({kind:recipe.kind,leg:id,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,documentNetwork,snapshot:{...snapshot,rows:snapshot.rows.map(({bytesBase64,...row})=>({...row,capturedBodyBytes:Buffer.from(bytesBase64,'base64').byteLength}))}}));
          applicationCompletion=await assertCoreTemplateReadApplicationCompletion({snapshot,requests:hostRequests,documentNetwork},{origin,pathname:routePathname,actionId,expectedValues});
          for(const read of applicationCompletion.requests){
            const prefix=(recipe.kind==='cards'?'item_':'manual_item_')+read.originalReader.expectedIndex,owner=linkOwner(formFor(recipe.template.id),prefix),display=read.decodedResult.display;
            await expect(owner.locator('p.text-sm.font-semibold')).toHaveText(display.title);
            await expect(owner.locator('p[dir="ltr"]')).toHaveText(display.publicPath);
            await expect(owner.locator('input[name="'+prefix+'_link_kind"]')).toHaveValue(display.kind);
            await expect(owner.locator('input[name="'+prefix+'_link_target"]')).toHaveValue(display.target);
          }
          finishedCount=applicationCompletion.requests.length;
          console.log('core-template-original-reader '+JSON.stringify({kind:recipe.kind,leg:id,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,documentToken:applicationCompletion.documentToken,requests:applicationCompletion.requests.map(row=>({payloadSha256:row.payloadSha256,transportTerminal:row.transportTerminal,transportError:row.transportError,byteLength:row.originalReader.byteLength,bytesSha256:row.originalReader.bytesSha256,done:row.originalReader.done,canonicalResultMatched:true}))}));
        }else await finishCoreTemplateReadResponses(tracked);
        assert.equal(requests.length,expectedCount);assertCoreReadOnlyEditRequests(requests.slice(start),{origin,pathname:routePathname,actionId,expectedValues});assert.equal(finishedCount,expectedValues.length);
        stage='complete';diagnostic('VERIFIED');readLegs.push({id,...proof,responsesCompleted:finishedCount,responsesOk:true,...(applicationCompletion?{applicationCompletion}:{} )});
      }catch(error){diagnostic(error.message==='TEMPLATE_READ_FINISH_DEADLINE'?'FINISH_DEADLINE':error.message==='TEMPLATE_READ_REQUEST_FAILED'?'REQUEST_FAILED':'EVIDENCE_REJECTED');throw Error('TEMPLATE_FEEDBACK_READ_EVIDENCE_REJECTED:'+recipe.kind+':'+id+':'+stage);}
    }
    const scenarios=[];
    try{for(const spec of TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS){
      const target=new URL(clean);for(const[key,value]of Object.entries(spec.query))target.searchParams.set(key,value);
      const openedAt=requests.length;navigationPhase='goto-requested';await observe('template-feedback-adapter-'+recipe.kind+'-'+spec.id,()=>page.goto(target.href,{waitUntil:'domcontentloaded'}));await settleReadLeg(spec.id+':open',openedAt);
      await expect(entry()).toHaveCount(1);await expect(entry()).toBeVisible();await expect(entry()).toHaveAttribute('data-admin-feedback-variant',spec.variant);await expect(entry()).toContainText(spec.text);
      const dismiss=entry().getByRole('button',{name:'إغلاق الإشعار',exact:true});await expect(dismiss).toBeVisible();await dismiss.click();await expect(entry()).toHaveCount(0);
      const after=new URL(page.url());for(const key of ['saved','notice','cache_warning'])assert.equal(after.searchParams.has(key),false);assert.equal(after.pathname,clean.pathname);assert.equal(after.hash,clean.hash);assert.equal(after.search,clean.search);
      const reloadAt=requests.length;navigationPhase='reload-requested';await observe('template-feedback-dismissed-reload',()=>page.reload({waitUntil:'domcontentloaded'}));await settleReadLeg(spec.id+':reloaded',reloadAt);await expect(entry()).toHaveCount(0);
      scenarios.push({id:spec.id,variant:spec.variant,visibleCount:1,messageText:spec.text,dismissButtonVisible:true,dismissed:true,savedRemoved:true,noticeRemoved:true,cacheWarningRemoved:true,unrelatedQueryPreserved:true,samePathAndHash:true,absentAfterReload:true});
    }}finally{page.off('request',count);page.off('response',onResponse);page.off('framenavigated',navigated);page.off('requestfinished',onFinished);page.off('requestfailed',onFailed);if(consumption)await consumption.deactivate();await documentDiagnostic.close();}
    const proof={kind:recipe.kind,templateId:recipe.template.id,channel,routePathname,sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,actualAcceptedSaveVisible:true,actualAcceptedVariant,scenarios,additionalActionPosts:requests.length,linkReadActions:{ownerProjection,legs:readLegs,mutatingOrUnknownActionPosts:requests.filter(request=>request.actionId!==actionId).length},adapterOnly:true,backendFailureClaim:false,nativeBefore:nativeBefore.id,nativeAfter:null,automaticCoverage:[],globalClosed:false};
    return assertCoreTemplateFeedbackAdapter(proof,recipe.kind,recipe.template.id,process.env.QA_ADMIN_SOURCE_SHA256);
  }
  for (const recipe of plan.recipes) await run("core-template-controls-" + recipe.kind, [], async () => {
    currentRecipe=recipe;renderedAdoption=[];renderedSeen=new Set();
    const path = "/admin/pages-blocks/blocks/" + recipe.kind + "/" + recipe.template.id;
    await observe("template-controls-open", () => page.goto(origin + path, { waitUntil: "domcontentloaded" }));
    const form = formFor(recipe.template.id); await expect(form).toHaveCount(1); await tab(form, "content");
    await checkpoint(recipe.kind, "baseline"); await author[recipe.kind](form);
    const downloadField=({cards:'item_0',breadcrumb:'manual_item_0',cta:'primary_cta'})[recipe.kind];
    const downloadMedia=downloadField ? await exerciseCoreDownloadField({page,origin,owner:linkOwner(form,downloadField),asset:f.downloadMedia,field:downloadField,originalHref:values.hrefs[1],clearLabel:recipe.kind==='cta'?'مسح':'مسح الرابط',assertCurrent:async(href,kind)=>{
      await expect(state(form,downloadField+'_link_href')).toHaveValue(href);await expect(state(form,downloadField+'_link_kind')).toHaveValue(kind);
      await expect(state(form,downloadField+'_link_target')).toHaveValue(kind==='download'?'_blank':'_self');
    }}) : null;
    await checkpoint(recipe.kind, "draft");
    if (recipe.kind === "cards") await chooseExternal(form, "item_0", values.hrefs[0], "_blank", true);
    else if (recipe.kind === "breadcrumb") await chooseExternal(form, "manual_item_0", values.hrefs[0], "_blank", true);
    else if (recipe.kind === "cta") await chooseExternal(form, "primary_cta", values.hrefs[0], "_blank", true);
    else if (recipe.kind === "feed") await numericNegative(form, "limit", 7);
    else if (recipe.kind === "featured") await numericNegative(form, "item_limit", 3);
    else if (recipe.kind === "media-hub") await numericNegative(form, "item_limit", 5);
    else {
      await input(form, "limit").fill("0"); await expect(input(form, "limit")).toHaveValue("1");
      await input(form, "limit").fill("61"); await expect(input(form, "limit")).toHaveValue("60");
      await input(form, "limit").fill("7");
    }
    await checkpoint(recipe.kind, "negative");
    const viewports = await viewportProof(form);
    const pendingProof = await observe("template-controls-native-pending", () => saveWithNativePending(recipe, form));
    await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get("saved") === "1", { timeout: 60_000 });
    await expect(save(formFor(recipe.template.id))).toBeEnabled(); const savedNative=await checkpoint(recipe.kind, "saved");
    const feedbackAdapter=await feedbackAdapterProof(recipe,savedNative);
    await observe("template-controls-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
    const reloaded = formFor(recipe.template.id); await tab(reloaded, "content"); await checkReload(recipe, reloaded);
    const reloadedNative=await checkpoint(recipe.kind, "reloaded"); feedbackAdapter.nativeAfter=reloadedNative.id;
    const result = { feedbackAdapter,templateId:recipe.template.id,renderedAdoption, consumer: recipe.consumer, surface: recipe.surface, kind: recipe.kind, observations: recipe.controls, viewports, pendingProof, downloadMedia,
      nativeCheckpoints: 5, genericCoverage: [], completeAxisCoverage: [], globalClosed: false };
    outcomes.push(result); return result;
  });
  return { planned: plan.recipes.length, completed: outcomes.length, outcomes, remainingBoundaries: plan.remainingBoundaries,
    nativeFinalityRequired: true, globalClosed: false };
}
