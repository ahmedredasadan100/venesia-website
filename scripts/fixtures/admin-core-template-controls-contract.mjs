import {CORE_DOWNLOAD_LINK} from './admin-core-download-media-adoption.mjs';
import {createHash} from "node:crypto";
import {createJiti} from "jiti";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const {linkDefaultFromContainer}=createJiti(import.meta.url,{fsCache:false,moduleCache:false})("../../src/lib/admin/links/link-defaults.ts");
import assert from "node:assert/strict";

// Finite verification recipes. Applicability comes from the existing Form
// manifest; this is not a Product capability registry.
export const TEMPLATE_CONTROL_RECIPES = {
  cards: { table: "cards_block_templates", controls: ["columns-keyboard", "item-add-edit-reorder-remove", "minimum-one", "item-link", "title-format"] },
  breadcrumb: { table: "breadcrumb_block_templates", controls: ["source-keyboard", "show-home", "manual-add-edit-reorder-remove", "manual-link"] },
  cta: { table: "cta_block_templates", controls: ["background-keyboard", "primary-link-select-replace", "secondary-link-clear", "title-format"] },
  feed: { table: "feed_module_templates", controls: ["feed-type-keyboard", "dependent-series-reset", "four-feed-type-configs", "numeric-rejection", "slider-and-list-switches"] },
  featured: { table: "featured_module_templates", controls: ["source-keyboard", "manual-selection-toggle-order", "unresolved-retention", "explicit-remove", "presentation", "numeric-rejection"] },
  "media-sidebar": { table: "media_sidebar_module_templates", controls: ["widget-source-conditional-controls", "content-type", "presentation-keyboard", "clamped-limit", "display-switches"] },
  "media-hub": { table: "media_hub_module_templates", controls: ["section-dependent-defaults", "collection-layout-keyboard", "numeric-rejection", "title-format"] },
};
export const CORE_TEMPLATE_CONTROLS_RETRY_SELECTION="template-controls-followup";
export const CORE_TEMPLATE_LINK_CONTROLS_SELECTION="template-link-controls-followup";
export const CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION="template-dual-link-controls-followup";
export const isCoreTemplateControlSelection=selection=>[CORE_TEMPLATE_CONTROLS_RETRY_SELECTION,CORE_TEMPLATE_LINK_CONTROLS_SELECTION,CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION].includes(selection);
export const CORE_TEMPLATE_CONTROLS_RETRY_KINDS=Object.freeze(["cards","breadcrumb","cta","media-hub"]);
export const CORE_TEMPLATE_CONTROLS_RETRY_IDS=Object.freeze(CORE_TEMPLATE_CONTROLS_RETRY_KINDS.map(kind=>"core-template-controls-"+kind));
/** @param {string|null} [selection] */
export function coreTemplateControlKinds(selection=null){if(selection===null)return Object.keys(TEMPLATE_CONTROL_RECIPES);assert.ok(isCoreTemplateControlSelection(selection));return CORE_TEMPLATE_CONTROLS_RETRY_KINDS.filter(kind=>selection===CORE_TEMPLATE_CONTROLS_RETRY_SELECTION||kind!=="media-hub").filter(kind=>selection!==CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION||kind!=="cta");}
export const TEMPLATE_CONTROL_PHASES = ["baseline", "draft", "negative", "saved", "reloaded"];
export const TEMPLATE_CONTROL_VALUES = {
  cards: [
    { title: "بطاقة الفحص الأولى", body: "وصف البطاقة الأولى", icon: "one" },
    { title: "بطاقة الفحص الثانية المعدلة", body: "وصف البطاقة الثانية المعدل", icon: "two" },
    { title: "بطاقة الفحص المحذوفة", body: "وصف محذوف", icon: "three" },
  ],
  breadcrumbs: ["مسار الفحص الأول", "مسار الفحص الثاني المعدل", "مسار محذوف"],
  title: "عنوان فحص عناصر النموذج",
  primaryLabel: "الرابط الأساسي للفحص",
  secondaryLabel: "الرابط الثانوي للفحص",
  hrefs: ["https://example.invalid/form-controls/one", "https://example.invalid/form-controls/two"],
};
export function buildCoreTemplateControlsPlan({ manifest, fixtures }) {
  assert.ok(Array.isArray(manifest)); assert.ok(Array.isArray(fixtures?.templates));
  const recipes = Object.entries(TEMPLATE_CONTROL_RECIPES).filter(([kind])=>coreTemplateControlKinds(fixtures.selection??null).includes(kind)).map(([kind, recipe]) => {
    const entries = manifest.filter(entry => entry.registryModuleKind === kind);
    assert.equal(entries.length, 1, "Missing/ambiguous registered " + kind + " editor.");
    const entry = entries[0], surface = kind + ":template-edit";
    assert.ok(entry.surfaces.includes(surface)); assert.equal(entry.classification, "specialized_exception");
    const templates = fixtures.templates.filter(row => row.kind === kind);
    assert.equal(templates.length, 1, "Missing/ambiguous owned " + kind + " fixture.");
    assert.ok(Number.isSafeInteger(templates[0].id) && templates[0].id > 0);
    return { ...recipe, kind, consumer: entry.id, surface, template: templates[0], coverage: [] };
  });
  return { recipes, globalClosed: false, automaticAxisCoverage: [],
    remainingBoundaries: manifest.filter(entry => entry.registryModuleKind && !Object.hasOwn(TEMPLATE_CONTROL_RECIPES, entry.registryModuleKind)).map(entry => ({ consumer: entry.id, surface: entry.registryModuleKind + ":template-edit", reason: "Separate preset/media recipe required; scalar lifecycle receipts do not prove compound controls." })) };
}
export function validateTemplateControlsRequest(input) {
  assert.ok(input && typeof input === "object");
  assert.deepEqual(Object.keys(input).sort(), ["id", "kind", "phase", "recipe"]);
  assert.equal(input.kind, "template-controls-state");
  assert.match(String(input.id), /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);
  assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES, input.recipe));
  assert.ok(TEMPLATE_CONTROL_PHASES.includes(input.phase)); return input;
}
export function assertTemplateControlsProjection(kind, row, fixtures) {
  assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES, kind));
  const c = row.config, r = TEMPLATE_CONTROL_VALUES;
  const external = (href, target) => ({ link_kind: "external", linked_type: null, linked_id: null, href, anchor: null, target, meta: null });
  if (kind === "cards") {
    assert.equal(c.columns, 4);
    assert.deepEqual(c.items, [
      { ...r.cards[1], link: CORE_DOWNLOAD_LINK, target: "_blank" },
      { ...r.cards[0], link: external(r.hrefs[0], "_blank"), target: "_blank" },
    ]);
  }
  if (kind === "breadcrumb") {
    assert.deepEqual(c, { source: "manual", showHome: false, currentLabelOverride: r.title, manualItems: [
      { label: r.breadcrumbs[1], link: CORE_DOWNLOAD_LINK },
      { label: r.breadcrumbs[0], link: external(r.hrefs[0], "_blank") },
    ] });
  }
  if (kind === "cta") {
    assert.equal(c.backgroundStyle, "gradient");
    assert.deepEqual(c.primaryCta, { label: r.primaryLabel, link: CORE_DOWNLOAD_LINK, target: "_blank" });
    assert.equal(Object.hasOwn(c, "secondaryCta"), false, "Explicit clear must not retain the old destination or empty CTA.");
  }
  if (["cards", "cta"].includes(kind)) assert.deepEqual([c.title, c.showTitle, c.titleBold, c.titleAlignment], [r.title, true, false, "center"]);
  if (kind === "feed") {
    assert.equal(row.feed_type, "latest");
    assert.deepEqual(c.query, { limit: 7, categorySlugs: [fixtures.category.slug], seriesSlugs: [fixtures.series.slug] });
    const v = c.presentation.variants;
    assert.deepEqual([v.latest.layout, v.latest.density, v.latest.showArrows, v.latest.showDots], ["slider", 2, false, true]);
    assert.deepEqual([v.popular.layout, v.popular.columns, v.categories.layout, v.categories.columns], ["grid", 2, "grid", 3]);
    assert.deepEqual([v.series.layout, v.series.list.itemsPerGroup, v.series.list.intervalSeconds, v.series.list.showDots], ["list", 2, 9, false]);
  }
  if (kind === "featured") {
    assert.deepEqual(c.source, { kind: "categories", categorySlug: fixtures.category.slug });
    assert.deepEqual(c.selection, { mode: "manual", topicIds: [fixtures.article.id] });
    assert.equal(c.itemLimit, 3); assert.equal(c.presentation.variant, "list");
  }
  if (kind === "media-sidebar") {
    assert.equal(row.widget_key, "popular");
    assert.deepEqual(c.source, { kind: "media-center", contentType: "video" });
    assert.equal(c.limit, 7); assert.equal(c.presentation, "group-carousel");
    assert.deepEqual(c.display, { title: true, image: false, category: false, series: false, excerpt: true, date: false });
  }
  if (kind === "media-hub") {
    assert.equal(row.section_key, "press");
    assert.equal(c.placement, "hub"); assert.equal(c.type, "press"); assert.equal(c.itemLimit, 5);
    assert.equal(c.presentation.collectionView.layout, "list");
    assert.deepEqual([c.presentation.title, c.presentation.showTitle, c.presentation.titleBold, c.presentation.titleAlignment], [r.title, true, false, "center"]);
    assert.deepEqual([c.display.titleBold, c.display.titleAlignment], [true, "left"], "Item title formatting must persist independently from the section title.");
  }
}





// Existing specialized save-notice adapter states; query flags test rendering,
// not a fabricated cache/media backend failure or another domain mutation.
export const TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS = [
 {id:'saved',query:{saved:'1'},variant:'success',text:'تم حفظ الموديول بنجاح.'},
 {id:'cache-warning',query:{saved:'1',cache_warning:'1'},variant:'warning',text:'تم حفظ الموديول بنجاح. تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة.'},
 {id:'media-warning',query:{saved:'1',notice:'saved_with_media_sync_warning'},variant:'warning',text:'تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص.'},
 {id:'combined-warning',query:{saved:'1',notice:'saved_with_media_sync_warning',cache_warning:'1'},variant:'warning',text:'تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص. تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة.'},
];
export function coreTemplateFeedbackLinkValues(kind){assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES,kind));const stored=kind==='cta'?[CORE_DOWNLOAD_LINK]:['cards','breadcrumb'].includes(kind)?[CORE_DOWNLOAD_LINK,{link_kind:'external',linked_type:null,linked_id:null,href:TEMPLATE_CONTROL_VALUES.hrefs[0],anchor:null,target:'_blank',meta:null}]:[];return stored.map(link=>linkDefaultFromContainer({link}));}

const linkReadOwner='src/lib/admin/links/actions.ts#resolveAdminLinkAjax';
const linkReadDecoder='next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.node.production.js';
const linkReadDigest=value=>createHash('sha256').update(value).digest('hex');
const linkReadNoStore=value=>typeof value==='string'&&/(?:^|,)\s*no-store\s*(?:,|$)/iu.test(value);

/**
 * The application's original reader must have delivered every byte and EOF.
 * @param {unknown} snapshot Untrusted serialized original-reader observation.
 * @param {{expectedValues: import('../../src/lib/admin/links/types').AdminLinkValue[], actionId?: string, actionIdSha256?: string, documentToken?: string}} bindings
 */
export function assertCoreTemplateReadConsumption(snapshot,{expectedValues,actionId=undefined,actionIdSha256=undefined,documentToken=snapshot?.documentToken}){
 assert.ok(snapshot&&typeof snapshot==='object');assert.equal(snapshot.active,true);assert.equal(snapshot.overflow,false);assert.equal(snapshot.observerError,false);
 assert.match(snapshot.documentToken,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);assert.equal(snapshot.documentToken,documentToken);
 const actionDigest=actionId===undefined?actionIdSha256:linkReadDigest(actionId);assert.match(actionDigest,/^[a-f0-9]{64}$/u);if(actionIdSha256!==undefined)assert.equal(actionIdSha256,actionDigest);assert.equal(snapshot.owner,linkReadOwner);assert.equal(snapshot.actionIdSha256,actionDigest);assert.match(snapshot.documentUrlSha256,/^[a-f0-9]{64}$/u);
 assert.ok(Array.isArray(expectedValues)&&expectedValues.length>0&&expectedValues.length<=2);assert.ok(Array.isArray(snapshot.rows));assert.equal(snapshot.rows.length,expectedValues.length);
 assert.equal(new Set(expectedValues.map(value=>JSON.stringify([value]))).size,expectedValues.length);
 const seen=new Set();
 for(const[index,row]of snapshot.rows.entries()){
  assert.equal(row.sequence,index);assert.equal(row.matched,true);assert.equal(row.documentToken,documentToken);assert.equal(row.method,'POST');
  assert.ok(Number.isInteger(row.expectedIndex)&&row.expectedIndex>=0&&row.expectedIndex<expectedValues.length);assert.ok(!seen.has(row.expectedIndex));seen.add(row.expectedIndex);
  assert.equal(row.payloadSha256,linkReadDigest(JSON.stringify([expectedValues[row.expectedIndex]])));assert.equal(row.status,200);assert.match(row.contentType??'',/^text\/x-component(?:;|$)/iu);
  assert.equal(row.redirected,false);assert.equal(row.readerCount,1);assert.equal(row.unsupportedReader,false);assert.equal(row.done,true);assert.equal(row.cancelCount,0);assert.deepEqual(row.errors,[]);assert.equal(row.overflow,false);
  assert.ok(Number.isSafeInteger(row.chunks)&&row.chunks>0);assert.equal(row.reads,row.chunks+1);assert.ok(Number.isSafeInteger(row.byteLength)&&row.byteLength>0&&row.byteLength<=65536);
  assert.equal(typeof row.bytesBase64,'string');const bytes=Buffer.from(row.bytesBase64,'base64');assert.equal(bytes.byteLength,row.byteLength);assert.equal(bytes.toString('base64'),row.bytesBase64);assert.equal(linkReadDigest(bytes),row.bytesSha256);
  assert.match(row.requestUrlSha256,/^[a-f0-9]{64}$/u);assert.equal(row.responseUrlSha256,row.requestUrlSha256);
 }
 return snapshot;
}

function assertLinkReadTerminal(row){
 assert.ok(row.transportTerminal==='finished'||row.transportTerminal==='failed','Unfinished requests have no completion proof.');
 if(row.transportTerminal==='finished')assert.equal(row.transportError,null);
 else {assert.equal(row.transportError,'net::ERR_ABORTED','Unknown transport failures cannot be qualified by link-preview evidence.');assert.ok(linkReadNoStore(row.cacheControl),'The bounded Chromium anomaly requires the observed no-store response.');}
}


function assertLinkReadDocumentNetwork(documentNetwork,snapshot){
 assert.ok(documentNetwork&&typeof documentNetwork==='object');const current=documentNetwork.currentDocument;
 assert.ok(current&&typeof current==='object');for(const key of ['frameId','loaderId'])assert.ok(typeof current[key]==='string'&&current[key].length>0);
 assert.equal(current.originMatches,true);assert.equal(current.urlSha256,snapshot.documentUrlSha256);assert.ok(Array.isArray(documentNetwork.requests));assert.equal(documentNetwork.requests.length,snapshot.rows.length);
 const identities=new Set(),payloads=new Set();
 for(const row of documentNetwork.requests){
  assert.ok(typeof row.requestId==='string'&&row.requestId.length>0);assert.ok(!identities.has(row.requestId));identities.add(row.requestId);
  assert.equal(row.frameId,current.frameId);assert.equal(row.loaderId,current.loaderId);assert.equal(row.originMatches,true);assert.equal(row.urlSha256,current.urlSha256);assert.equal(row.documentUrlSha256,current.urlSha256);assert.equal(row.actionIdSha256,snapshot.actionIdSha256);assert.equal(row.postDataAvailable,true);assert.ok(!payloads.has(row.payloadSha256));payloads.add(row.payloadSha256);
  const original=snapshot.rows.filter(value=>value.payloadSha256===row.payloadSha256);assert.equal(original.length,1);const consumed=original[0],response=row.response,terminal=row.terminal;
  assert.ok(response&&terminal);for(const part of [response,terminal])assert.equal(part.requestId,row.requestId);for(const key of ['frameId','loaderId'])assert.equal(response[key],current[key]);
  assert.equal(response.status,200);assert.equal(response.mimeType,'text/x-component');assert.equal(response.contentType,consumed.contentType);assert.equal(response.cacheControl,consumed.cacheControl);assert.equal(response.hasActionRedirect,false);
  assert.ok(Number.isFinite(row.timestamp)&&Number.isFinite(response.timestamp)&&Number.isFinite(terminal.timestamp));assert.ok(response.timestamp>=row.timestamp&&terminal.timestamp>=row.timestamp);
  if(terminal.kind==='failed'){assert.equal(terminal.failure?.code,'net::ERR_ABORTED');assert.equal(terminal.blockedReason,null);assert.equal(typeof terminal.canceled,'boolean');assert.ok(linkReadNoStore(response.cacheControl));}
  else{assert.equal(terminal.kind,'finished');assert.ok(Number.isFinite(terminal.encodedDataLength)&&terminal.encodedDataLength>=0);}
 }
 return documentNetwork;
}

/**
 * Join host transport to the same document's original reader, then use the installed Flight decoder.
 * @param {{snapshot: unknown, requests: {method: string, url: string, actionId?: string, actionIdSha256?: string, body: string, httpStatus: number, contentType: string, cacheControl: string, hasActionRedirect: boolean, transportTerminal: 'finished'|'failed', transportError: string|null}[], documentNetwork: unknown}} evidence
 * @param {{origin: string, pathname: string, actionId?: string, actionIdSha256?: string, expectedValues: import('../../src/lib/admin/links/types').AdminLinkValue[]}} bindings
 */
export async function assertCoreTemplateReadApplicationCompletion({snapshot,requests,documentNetwork},{origin,pathname,actionId=undefined,actionIdSha256=undefined,expectedValues}){
 const base=new URL(origin);assert.equal(base.origin,origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);
 const route=/^\/admin\/pages-blocks\/blocks\/(cards|breadcrumb)\/[1-9][0-9]*$/u.exec(pathname);assert.ok(route,'Application read completion is limited to the existing Cards/Breadcrumb recipes.');
 assert.deepEqual(expectedValues,coreTemplateFeedbackLinkValues(route[1]));assert.ok(expectedValues.every(value=>['external','download'].includes(value.link_kind)));
 assertCoreTemplateReadConsumption(snapshot,{expectedValues,actionId,actionIdSha256});assert.equal(snapshot.pathname,pathname);
 const documentUrl=new URL(snapshot.documentUrl);assert.equal(documentUrl.origin,origin);assert.equal(documentUrl.pathname,pathname);assert.equal(linkReadDigest(documentUrl.href),snapshot.documentUrlSha256);
 assert.ok(Array.isArray(requests));assert.equal(requests.length,expectedValues.length);assertLinkReadDocumentNetwork(documentNetwork,snapshot);
 const root=resolve(import.meta.dirname,'../..'),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{'server-only':resolve(root,'node_modules/next/dist/compiled/server-only/empty.js')}});
 const {describeAdminLink}=await jiti.import(resolve(root,'src/lib/admin/links/index.ts'));
 const {createFromReadableStream}=createRequire(import.meta.url)(linkReadDecoder);
 const receipts=[],sourceRequests=[],seen=new Set();
 for(const[index,request]of requests.entries()){
  assert.equal(request.method,'POST');const requestActionSha256=request.actionId===undefined?request.actionIdSha256:linkReadDigest(request.actionId);assert.equal(requestActionSha256,snapshot.actionIdSha256);if(request.actionIdSha256!==undefined)assert.equal(request.actionIdSha256,requestActionSha256);assert.equal(new URL(request.url).href,documentUrl.href);assert.equal(typeof request.body,'string');
  const payloadSha256=linkReadDigest(request.body),rows=snapshot.rows.filter(row=>row.payloadSha256===payloadSha256);assert.equal(rows.length,1,'Exactly one original reader must belong to each host request.');
  const row=rows[0],networkRows=documentNetwork.requests.filter(value=>value.payloadSha256===payloadSha256);assert.equal(networkRows.length,1);const documentRequest=networkRows[0];assert.equal(documentRequest.terminal.kind,request.transportTerminal);if(request.transportTerminal==="failed")assert.equal(documentRequest.terminal.failure.code,request.transportError);assert.ok(!seen.has(row.sequence));seen.add(row.sequence);assert.equal(request.body,JSON.stringify([expectedValues[row.expectedIndex]]));assert.equal(row.requestUrlSha256,linkReadDigest(request.url));
  assert.equal(request.httpStatus,200);assert.equal(request.contentType,row.contentType);assert.equal(request.cacheControl,row.cacheControl);assert.equal(request.hasActionRedirect,false);assertLinkReadTerminal(request);
  const bytes=Buffer.from(row.bytesBase64,'base64');
  const decoded=await createFromReadableStream(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(bytes));controller.close();}}),{serverConsumerManifest:{moduleMap:{},serverModuleMap:{},moduleLoading:null}});
  assert.ok(decoded&&typeof decoded==='object'&&Object.hasOwn(decoded,'a'),'The captured Flight response must expose the actual Action result.');
  const decodedResult=await decoded.a,display=await describeAdminLink(expectedValues[row.expectedIndex]),canonicalResult={ok:true,publicPath:display.publicPath,display};assert.deepEqual(decodedResult,canonicalResult,'Original-reader bytes must decode to the canonical link owner result.');
  sourceRequests.push({method:request.method,url:request.url,actionIdSha256:requestActionSha256,body:request.body,httpStatus:request.httpStatus,contentType:request.contentType,cacheControl:request.cacheControl,hasActionRedirect:request.hasActionRedirect,transportTerminal:request.transportTerminal,transportError:request.transportError});
  receipts.push({status:'verified-original-reader-application-completion',owner:linkReadOwner,canonicalOwner:'src/lib/admin/links/index.ts#describeAdminLink',decoder:linkReadDecoder,requestOrdinal:index,documentToken:snapshot.documentToken,documentUrlSha256:snapshot.documentUrlSha256,pathname,actionIdSha256:snapshot.actionIdSha256,payloadSha256,requestUrlSha256:row.requestUrlSha256,responseUrlSha256:row.responseUrlSha256,httpStatus:request.httpStatus,contentType:request.contentType,cacheControl:request.cacheControl,hasActionRedirect:request.hasActionRedirect,transportTerminal:request.transportTerminal,transportError:request.transportError,originalReader:{...row},documentRequest:structuredClone(documentRequest),decodedResult,canonicalResult});
 }
 return {status:'verified-original-reader-application-completion',owner:linkReadOwner,origin,pathname,documentToken:snapshot.documentToken,documentUrlSha256:snapshot.documentUrlSha256,actionIdSha256:snapshot.actionIdSha256,requests:receipts,sourceEvidence:{snapshot:structuredClone(snapshot),requests:sourceRequests,documentNetwork:structuredClone(documentNetwork)}};
}

/** Serialized checks supplement UI/native proof; offline admission repeats the real decoder. */
export function assertCoreTemplateReadApplicationReceipts(proof,{pathname,actionIdSha256,expectedValues}){
 assert.ok(proof&&typeof proof==='object');assert.equal(proof.status,'verified-original-reader-application-completion');assert.equal(proof.owner,linkReadOwner);assert.equal(proof.pathname,pathname);assert.equal(proof.actionIdSha256,actionIdSha256);
 const base=new URL(proof.origin);assert.equal(base.origin,proof.origin);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);
 assert.match(proof.documentToken,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);assert.match(proof.documentUrlSha256,/^[a-f0-9]{64}$/u);assert.ok(Array.isArray(proof.requests));assert.equal(proof.requests.length,expectedValues.length);
 assert.ok(proof.sourceEvidence&&typeof proof.sourceEvidence==='object');assertCoreTemplateReadConsumption(proof.sourceEvidence.snapshot,{expectedValues,actionIdSha256,documentToken:proof.documentToken});assert.equal(proof.sourceEvidence.snapshot.pathname,pathname);assert.equal(proof.sourceEvidence.snapshot.documentUrlSha256,proof.documentUrlSha256);assert.equal(proof.sourceEvidence.requests.length,expectedValues.length);assertLinkReadDocumentNetwork(proof.sourceEvidence.documentNetwork,proof.sourceEvidence.snapshot);
 const documentUrl=new URL(proof.sourceEvidence.snapshot.documentUrl);assert.equal(documentUrl.origin,proof.origin);assert.equal(documentUrl.pathname,pathname);assert.equal(linkReadDigest(documentUrl.href),proof.documentUrlSha256);
 const expectedPayloads=expectedValues.map(value=>linkReadDigest(JSON.stringify([value]))).sort();assert.deepEqual(proof.requests.map(row=>row.payloadSha256).sort(),expectedPayloads);
 const seen=new Set();
 for(const[index,row]of proof.requests.entries()){
  assert.equal(row.status,proof.status);assert.equal(row.owner,linkReadOwner);assert.equal(row.canonicalOwner,'src/lib/admin/links/index.ts#describeAdminLink');assert.equal(row.decoder,linkReadDecoder);assert.equal(row.requestOrdinal,index);
  for(const key of ['pathname','documentToken','documentUrlSha256','actionIdSha256'])assert.equal(row[key],proof[key]);
  assert.equal(row.httpStatus,200);assert.match(row.contentType,/^text\/x-component(?:;|$)/iu);assert.equal(row.hasActionRedirect,false);assertLinkReadTerminal(row);
  const input=proof.sourceEvidence.requests[index];assert.equal(input.method,'POST');assert.equal(input.url,documentUrl.href);assert.equal(input.actionIdSha256,actionIdSha256);assert.equal(linkReadDigest(input.body),row.payloadSha256);for(const key of ['httpStatus','contentType','cacheControl','hasActionRedirect','transportTerminal','transportError'])assert.equal(input[key],row[key]);
  assert.deepEqual(row.documentRequest,proof.sourceEvidence.documentNetwork.requests.find(value=>value.payloadSha256===row.payloadSha256));assert.equal(row.documentRequest.terminal.kind,row.transportTerminal);if(row.transportTerminal==="failed")assert.equal(row.documentRequest.terminal.failure.code,row.transportError);
  const original=row.originalReader;assert.ok(original&&typeof original==='object');assert.deepEqual(original,proof.sourceEvidence.snapshot.rows.find(candidate=>candidate.sequence===original.sequence));assert.ok(Number.isInteger(original.sequence)&&original.sequence>=0&&original.sequence<expectedValues.length);assert.ok(!seen.has(original.sequence));seen.add(original.sequence);
  assert.ok(Number.isInteger(original.expectedIndex)&&original.expectedIndex>=0&&original.expectedIndex<expectedValues.length);assert.equal(original.payloadSha256,linkReadDigest(JSON.stringify([expectedValues[original.expectedIndex]])));
  assert.equal(original.documentToken,proof.documentToken);assert.equal(original.matched,true);assert.equal(original.method,'POST');assert.equal(original.payloadSha256,row.payloadSha256);assert.equal(original.status,row.httpStatus);assert.equal(original.contentType,row.contentType);assert.equal(original.cacheControl,row.cacheControl);assert.equal(original.redirected,false);assert.equal(original.requestUrlSha256,row.requestUrlSha256);assert.equal(original.responseUrlSha256,row.responseUrlSha256);assert.equal(row.requestUrlSha256,proof.documentUrlSha256);assert.equal(row.responseUrlSha256,row.requestUrlSha256);
  assert.equal(original.done,true);assert.equal(original.readerCount,1);assert.equal(original.cancelCount,0);assert.equal(original.unsupportedReader,false);assert.equal(original.overflow,false);assert.deepEqual(original.errors,[]);assert.ok(Number.isSafeInteger(original.chunks)&&original.chunks>0);assert.equal(original.reads,original.chunks+1);
  const bytes=Buffer.from(original.bytesBase64,'base64');assert.ok(bytes.byteLength>0&&bytes.byteLength<=65536);assert.equal(bytes.byteLength,original.byteLength);assert.equal(bytes.toString('base64'),original.bytesBase64);assert.equal(linkReadDigest(bytes),original.bytesSha256);
  assert.equal(row.canonicalResult?.ok,true);assert.deepEqual(Object.keys(row.canonicalResult).sort(),['display','ok','publicPath']);assert.equal(row.canonicalResult.publicPath,row.canonicalResult.display?.publicPath);assert.deepEqual(row.decodedResult,row.canonicalResult);
 }
 return proof;
}

export function assertCoreTemplateFeedbackAdapter(proof,kind,templateId,sourceSha256){
 assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES,kind));assert.ok(proof&&typeof proof==='object');
 assert.equal(proof.kind,kind);assert.equal(proof.templateId,templateId);assert.equal(proof.sourceSha256,sourceSha256);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);
 assert.equal(proof.channel,'block-editor:/admin/pages-blocks/blocks/'+kind);assert.equal(proof.routePathname,'/admin/pages-blocks/blocks/'+kind+'/'+templateId);
 assert.equal(proof.actualAcceptedSaveVisible,true);assert.ok(['success','warning'].includes(proof.actualAcceptedVariant));
 if(['cards','breadcrumb'].includes(kind))assert.ok(proof.linkReadActions&&typeof proof.linkReadActions==='object','Cards/Breadcrumb require exact original-reader application completion; no transport-only fallback.');
 if(proof.linkReadActions!==undefined){const reads=proof.linkReadActions,expected=coreTemplateFeedbackLinkValues(kind);assert.ok(reads&&typeof reads==='object');assert.equal(reads.mutatingOrUnknownActionPosts,0);assert.deepEqual(reads.legs.map(row=>row.id),TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.flatMap(row=>[row.id+':open',row.id+':reloaded']));let actionHash=null;if(expected.length){const projection=reads.ownerProjection;assert.equal(projection.owner,'src/lib/admin/links/actions.ts');assert.equal(projection.exportedName,'resolveAdminLinkAjax');assert.equal(projection.worker,'app/admin/pages-blocks/blocks/'+kind+'/[id]/page');assert.equal(projection.matches,1);assert.match(projection.sourceSha256,/^[a-f0-9]{64}$/u);const matches=projection.candidates.filter(row=>projection.allowedFilenames.includes(row.filename)&&row.exportedName===projection.exportedName&&row.workerPresent);assert.equal(matches.length,1);actionHash=matches[0].actionIdSha256;assert.match(actionHash,/^[a-f0-9]{64}$/u);}else assert.equal(reads.ownerProjection,null);const payloadSha256=expected.map(value=>JSON.stringify([value])).sort().map(value=>createHash('sha256').update(value).digest('hex'));for(const leg of reads.legs){assert.equal(leg.owner,'src/lib/admin/links/actions.ts#resolveAdminLinkAjax');assert.equal(leg.count,expected.length);assert.equal(leg.actionIdSha256,actionHash);assert.deepEqual(leg.payloadSha256,payloadSha256);assert.equal(leg.responsesCompleted,expected.length);assert.equal(leg.responsesOk,true);if(['cards','breadcrumb'].includes(kind))assert.ok(leg.applicationCompletion,'Every Cards/Breadcrumb read leg requires original-reader application completion.');if(leg.applicationCompletion!==undefined){assert.ok(["cards","breadcrumb"].includes(kind));assertCoreTemplateReadApplicationReceipts(leg.applicationCompletion,{pathname:proof.routePathname,actionIdSha256:actionHash,expectedValues:expected});}}const completedDocuments=reads.legs.filter(leg=>leg.applicationCompletion!==undefined).map(leg=>leg.applicationCompletion.documentToken);assert.equal(new Set(completedDocuments).size,completedDocuments.length,"One document receipt cannot be reused across feedback navigation legs.");assert.equal(proof.additionalActionPosts,reads.legs.reduce((n,row)=>n+row.count,0));}else assert.equal(proof.additionalActionPosts,0);assert.equal(proof.adapterOnly,true);assert.equal(proof.backendFailureClaim,false);assert.equal(proof.globalClosed,false);assert.deepEqual(proof.automaticCoverage,[]);
 assert.equal(proof.scenarios.length,TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.length);assert.deepEqual(proof.scenarios.map(row=>row.id),TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.map(row=>row.id));
 for(const[at,spec]of TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.entries()){
  const row=proof.scenarios[at];assert.equal(row.variant,spec.variant);assert.equal(row.visibleCount,1);assert.equal(row.messageText,spec.text);
  for(const key of ['dismissButtonVisible','dismissed','savedRemoved','noticeRemoved','cacheWarningRemoved','unrelatedQueryPreserved','samePathAndHash','absentAfterReload'])assert.equal(row[key],true);
 }
 return proof;
}
export function assertCoreTemplateFeedbackCompletion(browser,native,ownedRunId){
 assert.equal(browser.cohort,'template-controls');assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.match(browser.sourceSha256,/^[a-f0-9]{64}$/u);
 const result=browser.templateControls,kinds=coreTemplateControlKinds(browser.journeySelection??null);assert.ok(result);assert.equal(result.outcomes.length,kinds.length);assert.deepEqual(result.outcomes.map(row=>row.kind).sort(),[...kinds].sort());
 const records=native.records.filter(row=>row.kind==='template-controls-state');assert.equal(records.length,kinds.length*TEMPLATE_CONTROL_PHASES.length);assert.equal(new Set(records.map(row=>row.id)).size,records.length);
 for(const row of result.outcomes){
  const evidence=browser.evidence.filter(e=>e.id==='core-template-controls-'+row.kind);assert.equal(evidence.length,1);assert.equal(evidence[0].status,'pass');assert.ok(!browser.errors.some(e=>e.id===evidence[0].id));
  assert.deepEqual(evidence[0].feedbackAdapter,row.feedbackAdapter);
  const proof=assertCoreTemplateFeedbackAdapter(row.feedbackAdapter,row.kind,row.templateId,browser.sourceSha256);
  const phase=records.filter(record=>record.recipe===row.kind);assert.deepEqual(phase.map(record=>record.phase),TEMPLATE_CONTROL_PHASES);assert.ok(phase.every(record=>record.status==='pass'&&record.templateId===row.templateId&&record.actorBound===true&&record.assignmentGraphUnchanged===true));
  const before=phase.find(record=>record.phase==='saved'),after=phase.find(record=>record.phase==='reloaded');
  assert.equal(proof.nativeBefore,before.id);assert.equal(proof.nativeAfter,after.id);assert.equal(after.rowHash,before.rowHash);assert.equal(after.otherRowsHash,before.otherRowsHash);assert.equal(before.auditCount,1);assert.equal(after.auditCount,0);
 }
 return{status:'pass',consumers:kinds.length,adapterObservations:kinds.length*TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.length,nativeCheckpoints:records.length,additionalActions:result.outcomes.reduce((n,row)=>n+row.feedbackAdapter.additionalActionPosts,0),backendFailureClaim:false,automaticCoverage:[],globalClosed:false};
}

export function assertCoreTemplateControlsRetryReceipt(browser,requiredCases){assert.equal(browser.scope,"core-closure");assert.equal(browser.cohort,"template-controls");assert.ok(isCoreTemplateControlSelection(browser.journeySelection));const kinds=coreTemplateControlKinds(browser.journeySelection),ids=kinds.map(kind=>"core-template-controls-"+kind);assert.equal(browser.status,"pass");assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.requiredCases,requiredCases.map(row=>({...row,status:"open",evidence:null})));assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);assert.deepEqual(browser.evidence.map(row=>row.id),["existing-auth-login",...ids]);assert.ok(browser.evidence.every(row=>row.status==="pass"));assert.ok(browser.evidence.slice(1).every(row=>Array.isArray(row.coverage)&&row.coverage.length===0));assert.deepEqual(browser.templateControls.outcomes.map(row=>row.kind),kinds);return{status:"pass",selection:browser.journeySelection,selectedJourneyIds:[...ids],executedJourneyIds:[...ids],retainedRecipesReplayed:false,wholeCohortExecuted:false,globalClosed:false,automaticCoverage:[]};}
