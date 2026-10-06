import {validateCoreJourneySelection} from "./fixtures/admin-core-domain-form-journeys.mjs";
import {installCoreTemplateReadConsumptionObserver,assertCoreTemplateReadConsumption,coreTemplateReadFailureDiagnostic,finishCoreTemplateReadResponses} from './fixtures/admin-core-template-controls-journeys.mjs';
import {CORE_DOWNLOAD_MEDIA_HREF} from './fixtures/admin-core-download-media-adoption.mjs';
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import type { AdminLinkValue } from "../src/lib/admin/links/types.ts";
import ts from "typescript";
import { createJiti } from "jiti";
import { assertCoreTemplateReadApplicationCompletion,assertCoreTemplateReadApplicationReceipts,assertCoreTemplateControlsRetryReceipt,CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION,CORE_TEMPLATE_LINK_CONTROLS_SELECTION,CORE_TEMPLATE_CONTROLS_RETRY_SELECTION,coreTemplateControlKinds,coreTemplateFeedbackLinkValues,TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS, assertCoreTemplateFeedbackAdapter, assertCoreTemplateFeedbackCompletion, buildCoreTemplateControlsPlan, TEMPLATE_CONTROL_PHASES, TEMPLATE_CONTROL_RECIPES, TEMPLATE_CONTROL_VALUES as v, validateTemplateControlsRequest, assertTemplateControlsProjection } from "./fixtures/admin-core-template-controls-contract.mjs";
const root=resolve(import.meta.dirname,".."),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{"server-only":resolve(root,"node_modules/next/dist/compiled/server-only/empty.js")}});
const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root,"src/lib/admin/form-system/adoption-manifest.ts"));
const fixtures={templates:Object.keys(TEMPLATE_CONTROL_RECIPES).map((kind,index)=>({kind,id:index+1,name:kind,slug:"qa-"+kind})),category:{slug:"qa-category"},series:{slug:"qa-series"},article:{id:41},news:{id:42}};
const cases:string[]=[];const test=(name:string,cb:()=>unknown)=>{cb();cases.push(name);};
test("Canonical specialized identities resolve without generic or automatic axis coverage",()=>{const p=buildCoreTemplateControlsPlan({manifest,fixtures});assert.equal(p.recipes.length,Object.keys(TEMPLATE_CONTROL_RECIPES).length);assert.ok(p.recipes.every(row=>row.coverage.length===0));assert.deepEqual(p.automaticAxisCoverage,[]);assert.equal(p.globalClosed,false);assert.deepEqual(p.remainingBoundaries.map(row=>row.consumer).sort(),["block-template-content-editor","block-template-hero-editor"]);});
for(const kind of Object.keys(TEMPLATE_CONTROL_RECIPES)){
 test("Missing canonical consumer rejects: "+kind,()=>assert.throws(()=>buildCoreTemplateControlsPlan({manifest:manifest.filter(row=>!("registryModuleKind" in row)||row.registryModuleKind!==kind),fixtures})));
 test("Missing owned template rejects: "+kind,()=>assert.throws(()=>buildCoreTemplateControlsPlan({manifest,fixtures:{...fixtures,templates:fixtures.templates.filter(row=>row.kind!==kind)}})));
}
test("Duplicate consumer rejects",()=>assert.throws(()=>buildCoreTemplateControlsPlan({manifest:[...manifest,manifest.find(row=>"registryModuleKind" in row&&row.registryModuleKind==="cards")!],fixtures})));
test("Duplicate fixture cannot double-count coverage",()=>assert.throws(()=>buildCoreTemplateControlsPlan({manifest,fixtures:{...fixtures,templates:[...fixtures.templates,fixtures.templates[0]]}})));
const request={id:randomUUID(),kind:"template-controls-state",recipe:"cards",phase:"baseline"};
test("Only fixed exact checkpoint accepted",()=>assert.deepEqual(validateTemplateControlsRequest(request),request));
for(const delta of [{sql:"select 1"},{expected:[]},{table:"topics"},{id:"bad"},{recipe:"__proto__"},{recipe:"constructor"},{kind:"arbitrary"},{phase:"anything"}])test("Reject unowned checkpoint "+JSON.stringify(delta),()=>assert.throws(()=>validateTemplateControlsRequest({...request,...delta})));
test("All finite phases validate without client data",()=>{for(const recipe of Object.keys(TEMPLATE_CONTROL_RECIPES))for(const phase of TEMPLATE_CONTROL_PHASES)validateTemplateControlsRequest({...request,recipe,phase});});

// Exercise the actual private config builders without importing Server Actions.
// AST extracts only the reviewed pure declarations; dependencies are real owners.
const configs=await jiti.import<typeof import("../src/lib/page-blocks/configs.ts")>(resolve(root,"src/lib/page-blocks/configs.ts"));
const adminUtils=await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>(resolve(root,"src/lib/page-blocks/admin-utils.ts"));
const links=await jiti.import<typeof import("../src/lib/admin/links/block-save.ts")>(resolve(root,"src/lib/admin/links/block-save.ts"));
function privateBuilder(kind:string,names:string[]){
 const file=resolve(root,"src/app/admin/pages-blocks/blocks",kind,"actions.ts"),source=readFileSync(file,"utf8"),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 const declarations=names.map(name=>{const matches=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);assert.equal(matches.length,1);return matches[0].getText(ast);}).join("\n");
 const dependencies={cleanText:adminUtils.cleanText,parseNumber:adminUtils.parseNumber,parseFormBoolean:adminUtils.parseFormBoolean,buildPageBlockTextFormattingPatch:configs.buildPageBlockTextFormattingPatch,linkFieldFromFormData:links.linkFieldFromFormData,hasSavedLinkField:links.hasSavedLinkField};
 const javascript=ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(dependencies),javascript+"\nreturn "+names.at(-1)+";")(...Object.values(dependencies)) as (f:FormData)=>Record<string,unknown>;
}
const cards=privateBuilder("cards",["buildCardsItems","assertValidCardsItems","buildCardsConfig"]),breadcrumb=privateBuilder("breadcrumb",["buildManualItems","buildBreadcrumbConfig"]),cta=privateBuilder("cta",["buildCtaLink","buildCtaConfig"]);
const form=(pairs:Record<string,unknown>)=>{const f=new FormData();for(const[key,value]of Object.entries(pairs))for(const item of Array.isArray(value)?value:[value])f.append(key,String(item));return f;};
const link=(prefix:string,href:string,target:string)=>({[prefix+"_link_kind"]:"external",[prefix+"_link_href"]:href,[prefix+"_link_target"]:target});
const title={title:v.title,show_title:"true",title_bold:"false",title_alignment:"center"};
const cardFields:Record<string,unknown>={...title,columns:4};
for(const[i,item]of [v.cards[1],v.cards[0]].entries())Object.assign(cardFields,Object.fromEntries(Object.entries(item).map(([key,value])=>["item_"+i+"_"+key,value])),link("item_"+i,v.hrefs[1-i],i?"_blank":"_self"));
Object.assign(cardFields,link("item_0",CORE_DOWNLOAD_MEDIA_HREF,"_blank"),{item_0_link_kind:"download"});
const rows:Record<string,Record<string,unknown>>={
 cards:{config:cards(form(cardFields))},
 breadcrumb:{config:breadcrumb(form({source:"manual",show_home:"false",current_label_override:v.title,manual_item_0_label:v.breadcrumbs[1],manual_item_1_label:v.breadcrumbs[0],...link("manual_item_0",CORE_DOWNLOAD_MEDIA_HREF,"_blank"),manual_item_0_link_kind:"download",...link("manual_item_1",v.hrefs[0],"_blank")}))},
 cta:{config:cta(form({...title,background_style:"gradient",primary_cta_label:v.primaryLabel,...link("primary_cta",CORE_DOWNLOAD_MEDIA_HREF,"_blank"),primary_cta_link_kind:"download",secondary_cta_label:"",secondary_cta_link_kind:"none"}))},
};
for(const kind of ["cards","breadcrumb","cta"])test("Actual "+kind+" Action config builder matches exact authored projection",()=>assertTemplateControlsProjection(kind,JSON.parse(JSON.stringify(rows[kind])),fixtures));
test("Cards empty aggregate rejected by actual builder",()=>assert.throws(()=>cards(new FormData())));
test("Cards half-authored row rejected by actual builder",()=>assert.throws(()=>cards(form({item_0_title:"missing description"}))));
test("Breadcrumb href without label rejected by actual builder",()=>assert.throws(()=>breadcrumb(form(link("manual_item_0",v.hrefs[0],"_blank")))));
const feed=await jiti.import<typeof import("../src/lib/feed-modules/parse-feed-config.ts")>(resolve(root,"src/lib/feed-modules/parse-feed-config.ts"));
rows.feed={feed_type:"latest",config:feed.buildFeedModuleConfig(form({widget_title:"QA",limit:7,category_slugs:fixtures.category.slug,series_slugs:fixtures.series.slug,latest_layout:"slider",latest_density:2,latest_show_arrows:"false",latest_show_dots:"true",popular_layout:"grid",popular_columns:2,categories_layout:"grid",categories_columns:3,series_layout:"list",series_list_items_per_group:2,series_list_interval_seconds:9,series_list_show_dots:"false"}),"latest")};
test("Actual Feed parser preserves authored independent variant state and filters",()=>assertTemplateControlsProjection("feed",rows.feed,fixtures));
test("Feed numeric negative uses actual owner",()=>assert.throws(()=>feed.buildFeedModuleConfig(form({widget_title:"QA",limit:0}),"latest")));
const featured=await jiti.import<typeof import("../src/lib/featured-modules/config.ts")>(resolve(root,"src/lib/featured-modules/config.ts"));
const featuredContract=await jiti.import<typeof import("../src/lib/featured-modules/contract.ts")>(resolve(root,"src/lib/featured-modules/contract.ts"));
rows.featured={config:featured.buildFeaturedModuleConfig(form({source_kind:"categories",category_slug:fixtures.category.slug,selection_mode:"manual",manual_topic_ids:fixtures.article.id,item_limit:3,presentation_variant:"list"}))};
test("Actual Featured parser matches remaining authored selection",()=>assertTemplateControlsProjection("featured",rows.featured,fixtures));
test("Featured actual selection owner deduplicates and preserves unresolved order",()=>{let ids=featuredContract.updateFeaturedManualSelection([41],41,true);assert.deepEqual(ids,[41]);ids=featuredContract.updateFeaturedManualSelection(ids,42,true);assert.deepEqual(ids,[41,42]);assert.deepEqual(featuredContract.resolveFeaturedManualEditorSelection(ids,[]).map(row=>[row.id,row.state]),[[41,"unresolved"],[42,"unresolved"]]);assert.deepEqual(featuredContract.updateFeaturedManualSelection(ids,42,false),[41]);});
test("Featured empty manual selection rejected by actual owner",()=>assert.throws(()=>featured.buildFeaturedModuleConfig(form({source_kind:"categories",category_slug:fixtures.category.slug,selection_mode:"manual",item_limit:3}))));
const sidebar=await jiti.import<typeof import("../src/lib/media-sidebar-modules/parse-config.ts")>(resolve(root,"src/lib/media-sidebar-modules/parse-config.ts"));
rows["media-sidebar"]={widget_key:"popular",config:sidebar.buildMediaSidebarModuleConfig("popular",form({source_kind:"media-center",content_type:"video",limit:7,presentation:"group-carousel",show_title_on_page:"on",show_excerpt_on_page:"on"}))};
test("Actual Sidebar parser uses real checked field names and explicit false values",()=>assertTemplateControlsProjection("media-sidebar",rows["media-sidebar"],fixtures));
test("Sidebar direct invalid limit rejected despite UI clamping",()=>assert.throws(()=>sidebar.buildMediaSidebarModuleConfig("popular",form({source_kind:"media-center",content_type:"video",limit:0,presentation:"list"}))));
const hub=await jiti.import<typeof import("../src/lib/media-hub-modules/parse-config.ts")>(resolve(root,"src/lib/media-hub-modules/parse-config.ts"));
const hubExports=Object.keys(hub).filter(key=>key.startsWith("build"));
assert.ok(hubExports.includes("buildMediaHubModuleConfig"),"Use the existing Hub config owner.");
const hubForm=form({details_text:"التفاصيل",show_section_title:"true",section_title_bold:"false",section_title_alignment:"center",title_bold:"true",title_alignment:"left"});
rows["media-hub"]={section_key:"press",config:hub.buildMediaHubModuleConfig("press","topics",5,hub.MEDIA_HUB_SECTION_DEFAULTS.press.config.contentHierarchy!,{...hub.MEDIA_HUB_SECTION_DEFAULTS.press.config.presentation,...configs.buildPageBlockTextFormattingPatch(hubForm,[{field:"title",formField:"section_title",defaults:{bold:true}}]),title:v.title,collectionView:{...hub.MEDIA_HUB_SECTION_DEFAULTS.press.config.presentation.collectionView,layout:"list"}},{placement:"hub",mediaType:"press",itemLimit:5,presentation:"list",itemsPerRow:3,display:configs.buildCollectionModuleDisplayFormattingFromFormData(hubForm)})};
test("Actual Hub parser matches reached section/layout projection",()=>assertTemplateControlsProjection("media-hub",rows["media-hub"],fixtures));
for(const [kind,row] of Object.entries(rows)){
 test("Native projection rejects missing authored configuration: "+kind,()=>assert.throws(()=>assertTemplateControlsProjection(kind,{...row,config:{}},fixtures)));
}
for(const [name,mutate]of [
 ["reordered card data mismatch",(r:Record<string,unknown>)=>{((r.cards as {config:{items:unknown[]}}).config.items).reverse();}],
 ["cleared CTA destination resurrected",(r:Record<string,unknown>)=>{(r.cta as {config:Record<string,unknown>}).config.secondaryCta={label:"",link:{href:"stale"}};}],
 ["phantom manual item",(r:Record<string,unknown>)=>{(r.featured as {config:{selection:{topicIds:number[]}}}).config.selection.topicIds.push(99);}],
 ["stale series selection",(r:Record<string,unknown>)=>{(r.feed as {config:{query:{seriesSlugs:string[]}}}).config.query.seriesSlugs=["other"]; }],
] as const)test("Persistence corruption rejected: "+name,()=>{const changed=structuredClone(rows);mutate(changed);assert.throws(()=>{for(const[k,row]of Object.entries(changed))assertTemplateControlsProjection(k,row,fixtures);});});
const browser=readFileSync(resolve(root,"scripts/fixtures/admin-core-template-controls-journeys.mjs"),"utf8");
test("Concrete Browser recipe never writes hidden fields or starts a route interceptor",()=>{assert.doesNotMatch(browser,/page\.(route|unroute)|\.evaluate\([^)]*=>\s*[^)]*\.value\s*=/u);assert.doesNotMatch(browser,/force:\s*true|page\.request|service_role/u);assert.match(browser,/nativeFinalityRequired: true/u);});
// Real installed Flight decoder + existing canonical link owner; never a mocked decoder.
const completionValues = coreTemplateFeedbackLinkValues('cards');
const completionOptions = { origin: 'http://127.0.0.1:49152', pathname: '/admin/pages-blocks/blocks/cards/123', actionId: 'owned-action', expectedValues: completionValues };
const completionUrl = completionOptions.origin + completionOptions.pathname + '?saved=1';
const completionDigest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const displayOwner = await jiti.import<typeof import('../src/lib/admin/links/index.ts')>(resolve(root, 'src/lib/admin/links/index.ts'));
const completionResults = await Promise.all(completionValues.map(async value => { const display = await displayOwner.describeAdminLink(value); return { ok: true, publicPath: display.publicPath, display }; }));
function completionFixture(pathname = completionOptions.pathname, actionId = completionOptions.actionId) {
  const fixtureUrl = completionOptions.origin + pathname + '?saved=1';
  const documentToken = randomUUID();
  const rows = completionValues.map((value, sequence) => {
    const bytes = Buffer.from('0:{"a":"$@1"}\n1:' + JSON.stringify(completionResults[sequence]) + '\n');
    return { sequence, expectedIndex: sequence, matched: true, documentToken, method: 'POST', status: 200,
      contentType: 'text/x-component', cacheControl: 'no-cache, no-store, max-age=0, must-revalidate', redirected: false,
      requestUrlSha256: completionDigest(fixtureUrl), responseUrlSha256: completionDigest(fixtureUrl),
      payloadSha256: completionDigest(JSON.stringify([value])), bytesBase64: bytes.toString('base64'), bytesSha256: completionDigest(bytes),
      byteLength: bytes.length, chunks: 1, reads: 2, done: true, readerCount: 1, cancelCount: 0, errors: [] as string[], overflow: false, unsupportedReader: false };
  });
  const snapshot = { documentToken, documentUrl: fixtureUrl, documentUrlSha256: completionDigest(fixtureUrl), pathname,
    active: true, overflow: false, observerError: false, owner: 'src/lib/admin/links/actions.ts#resolveAdminLinkAjax', actionIdSha256: completionDigest(actionId), rows };
  const requests: Parameters<typeof assertCoreTemplateReadApplicationCompletion>[0]['requests'] = completionValues.map(value => ({ method: 'POST', url: fixtureUrl, actionId: actionId,
    body: JSON.stringify([value]), httpStatus: 200, contentType: 'text/x-component', cacheControl: rows[0].cacheControl,
    hasActionRedirect: false, transportTerminal: 'failed', transportError: 'net::ERR_ABORTED' as string | null }));
  const frameId = 'owned-frame', loaderId = 'current-loader';
  type NetworkTerminal = { kind: string; requestId: string; timestamp: number; canceled?: boolean; failure?: { code: string }; blockedReason?: string | null; encodedDataLength?: number };
  const documentNetwork = { currentDocument: { frameId, loaderId, originMatches: true, urlSha256: snapshot.documentUrlSha256 },
    requests: rows.map((row, index) => {
      const requestId = 'owned-request-' + index, timestamp = 100 + index;
      return { requestId, frameId, loaderId, timestamp, wallTime: 1700000000 + index,
        actionIdSha256: snapshot.actionIdSha256, postDataAvailable: true, payloadSha256: row.payloadSha256,
        documentUrlSha256: snapshot.documentUrlSha256, urlSha256: snapshot.documentUrlSha256, originMatches: true,
        response: { requestId, frameId, loaderId, timestamp: timestamp + 0.1, status: 200, mimeType: 'text/x-component',
          contentType: row.contentType, cacheControl: row.cacheControl, hasActionRedirect: false },
        terminal: { kind: 'failed', requestId, timestamp: timestamp + 0.2, canceled: true, failure: { code: 'net::ERR_ABORTED' }, blockedReason: null } as NetworkTerminal };
    }) };
  return { snapshot, requests, documentNetwork };
}
function changeCompletionBytes(fixture: ReturnType<typeof completionFixture>, text: string) {
  const bytes = Buffer.from(text), row = fixture.snapshot.rows[0];
  row.bytesBase64 = bytes.toString('base64'); row.bytesSha256 = completionDigest(bytes); row.byteLength = bytes.length;
}
type CompletedFixtureRead = Awaited<ReturnType<typeof assertCoreTemplateReadApplicationCompletion>> & { sourceEvidence: { snapshot: ReturnType<typeof completionFixture>['snapshot']; documentNetwork: ReturnType<typeof completionFixture>['documentNetwork'] } };
const feedbackReadCompletions: Record<string, CompletedFixtureRead> = {};
for (const [index, kind] of ['cards', 'breadcrumb'].entries()) {
  const pathname = '/admin/pages-blocks/blocks/' + kind + '/' + (index + 1), actionId = 'a'.repeat(40);
  feedbackReadCompletions[kind] = await assertCoreTemplateReadApplicationCompletion(completionFixture(pathname, actionId), { ...completionOptions, pathname, actionId, expectedValues: coreTemplateFeedbackLinkValues(kind) }) as CompletedFixtureRead;
}
function feedbackReadActions(kind: string) {
  const prototype = feedbackReadCompletions[kind], actionIdSha256 = completionDigest('a'.repeat(40));
  const ownerProjection = { owner: 'src/lib/admin/links/actions.ts', exportedName: 'resolveAdminLinkAjax', worker: 'app/admin/pages-blocks/blocks/' + kind + '/[id]/page', allowedFilenames: ['src/lib/admin/links/actions.ts'], sourceSha256: 'd'.repeat(64), candidates: [{ actionIdSha256, filename: 'src/lib/admin/links/actions.ts', exportedName: 'resolveAdminLinkAjax', workerPresent: true }], matches: 1 };
  const legs = TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.flatMap(spec => ['open', 'reloaded'].map(phase => {
    const applicationCompletion = structuredClone(prototype), documentToken = randomUUID();
    applicationCompletion.documentToken = documentToken;
    applicationCompletion.sourceEvidence.snapshot.documentToken = documentToken;
    applicationCompletion.sourceEvidence.snapshot.rows.forEach(row => { row.documentToken = documentToken; });
    applicationCompletion.sourceEvidence.documentNetwork.currentDocument.loaderId = documentToken;
    applicationCompletion.sourceEvidence.documentNetwork.requests.forEach((row, index) => {
      const requestId = documentToken + ':' + index;
      row.loaderId = documentToken; row.requestId = requestId; row.response.loaderId = documentToken; row.response.requestId = requestId; row.terminal.requestId = requestId;
    });
    applicationCompletion.requests.forEach((row, index) => { row.documentToken = documentToken; row.originalReader.documentToken = documentToken; row.documentRequest = structuredClone(applicationCompletion.sourceEvidence.documentNetwork.requests[index]); });
    return { id: spec.id + ':' + phase, owner: 'src/lib/admin/links/actions.ts#resolveAdminLinkAjax', count: 2, actionIdSha256,
      payloadSha256: coreTemplateFeedbackLinkValues(kind).map(value => JSON.stringify([value])).sort().map(completionDigest),
      responsesCompleted: 2, responsesOk: true, applicationCompletion };
  }));
  return { ownerProjection, legs, mutatingOrUnknownActionPosts: 0 };
}
function feedbackFixture(){
 const sourceSha256='a'.repeat(64),ownedRunId='owned-fixture';
 const outcomes=Object.keys(TEMPLATE_CONTROL_RECIPES).map((kind,kindIndex)=>{
  const templateId=kindIndex+1;
  const feedbackAdapter={kind,templateId,channel:'block-editor:/admin/pages-blocks/blocks/'+kind,routePathname:'/admin/pages-blocks/blocks/'+kind+'/'+templateId,sourceSha256,actualAcceptedSaveVisible:true,actualAcceptedVariant:'success',additionalActionPosts:0,adapterOnly:true,backendFailureClaim:false,automaticCoverage:[],globalClosed:false,nativeBefore:kind+':saved',nativeAfter:kind+':reloaded',scenarios:TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.map(spec=>({id:spec.id,variant:spec.variant,messageText:spec.text,visibleCount:1,dismissButtonVisible:true,dismissed:true,savedRemoved:true,noticeRemoved:true,cacheWarningRemoved:true,unrelatedQueryPreserved:true,samePathAndHash:true,absentAfterReload:true})),...(['cards','breadcrumb'].includes(kind)?{linkReadActions:feedbackReadActions(kind),additionalActionPosts:16}:{})};return{kind,templateId,feedbackAdapter};
 });
 const records=outcomes.flatMap(({kind,templateId})=>TEMPLATE_CONTROL_PHASES.map((phase,index)=>({id:kind+':'+phase,kind:'template-controls-state',recipe:kind,phase,status:'pass',templateId,actorBound:true,assignmentGraphUnchanged:true,rowHash:'b'.repeat(64),otherRowsHash:'c'.repeat(64),auditCount:index===3?1:0})));
 const evidence=outcomes.map(({kind,feedbackAdapter})=>({id:'core-template-controls-'+kind,status:'pass',feedbackAdapter}));
 return{browser:{cohort:'template-controls',sourceSha256,templateControls:{outcomes},evidence,errors:[] as Array<{id:string}>},native:{status:'pass',ownedRunId,records},ownedRunId};
}
test('Specialized Feedback seven exact adapters join existing35 native phases',()=>{const x=feedbackFixture();assert.equal(assertCoreTemplateFeedbackCompletion(x.browser,x.native,x.ownedRunId).adapterObservations,28);});
for(const[name,mutate]of Object.entries({
 'missing-kind':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes.pop(),
 'duplicate-kind':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[1]=x.browser.templateControls.outcomes[0],
 'wrong-source':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.sourceSha256='f'.repeat(64),
 'foreign-native-run':(x:ReturnType<typeof feedbackFixture>):unknown=>x.native.ownedRunId='foreign',
 'wrong-channel':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.channel='global',
 'missing-warning':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.scenarios.pop(),
 'wrong-warning':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.scenarios[1].variant='success',
 'dismiss-not-cleared':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.scenarios[0].cacheWarningRemoved=false,
 'additional-action':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.additionalActionPosts=1,
 'changed-native-row':(x:ReturnType<typeof feedbackFixture>):unknown=>x.native.records.find((r)=>r.phase==='reloaded')!.rowHash='d'.repeat(64),
 'phantom-audit':(x:ReturnType<typeof feedbackFixture>):unknown=>x.native.records.find((r)=>r.phase==='reloaded')!.auditCount=1,
 'missing-native':(x:ReturnType<typeof feedbackFixture>):unknown=>x.native.records.pop(),
 'duplicate-native':(x:ReturnType<typeof feedbackFixture>):unknown=>x.native.records[1]=x.native.records[0],
 'failed-selected-journey':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.evidence[0].status='fail',
 'backend-failure-inferred':(x:ReturnType<typeof feedbackFixture>):unknown=>x.browser.templateControls.outcomes[0].feedbackAdapter.backendFailureClaim=true,
})){test('Specialized Feedback rejects '+name,()=>{const x=feedbackFixture();mutate(x);assert.throws(()=>assertCoreTemplateFeedbackCompletion(x.browser,x.native,x.ownedRunId));});}
test('Specialized adapter scenarios stay isolated and have no automatic coverage',()=>{for(const row of feedbackFixture().browser.templateControls.outcomes)assertCoreTemplateFeedbackAdapter(row.feedbackAdapter,row.kind,row.templateId,'a'.repeat(64));});

test('Only original three link recipes selected after retaining Media Hub',()=>{assert.deepEqual(coreTemplateControlKinds(CORE_TEMPLATE_LINK_CONTROLS_SELECTION),['cards','breadcrumb','cta']);assert.deepEqual(coreTemplateControlKinds(CORE_TEMPLATE_CONTROLS_RETRY_SELECTION),['cards','breadcrumb','cta','media-hub']);assert.throws(()=>coreTemplateControlKinds('any-new-recipe'));});
function tripleReceipt(){const kinds=coreTemplateControlKinds(CORE_TEMPLATE_LINK_CONTROLS_SELECTION),ids=kinds.map(k=>'core-template-controls-'+k),requiredCases=[{key:'sentinel-existing-open'}];return{requiredCases,browser:{scope:'core-closure',cohort:'template-controls',journeySelection:CORE_TEMPLATE_LINK_CONTROLS_SELECTION,status:'pass',driverCompleted:true,inventoryOnly:false,wholeCohortExecuted:false,globalClosed:false,errors:[],requiredCases:requiredCases.map(row=>({...row,status:'open',evidence:null})),selectedJourneyIds:ids.slice(),executedJourneyIds:ids.slice(),evidence:['existing-auth-login',...ids].map(id=>({id,status:'pass',coverage:[] as string[]})),templateControls:{outcomes:kinds.map(kind=>({kind}))}}};}
test('Three-case receipt preserves existing open identities and excludes Media Hub',()=>{const f=tripleReceipt();assert.deepEqual(assertCoreTemplateControlsRetryReceipt(f.browser,f.requiredCases).selectedJourneyIds,['cards','breadcrumb','cta'].map(k=>'core-template-controls-'+k));});
for(const[name,mutate]of Object.entries({missing:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.executedJourneyIds.pop(),replay:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.executedJourneyIds.push('core-template-controls-media-hub'),duplicate:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.executedJourneyIds[1]=f.browser.executedJourneyIds[0],droppedOpen:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.requiredCases.pop(),promotedOpen:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.requiredCases[0].status='pass',automaticCredit:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.evidence[1].coverage.push('borrowed-axis'),wrongOutcome:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.templateControls.outcomes[0].kind='media-hub',whole:(f:ReturnType<typeof tripleReceipt>):unknown=>f.browser.wholeCohortExecuted=true}))test('Three-case receipt rejects '+name,()=>{const f=tripleReceipt();mutate(f);assert.throws(()=>assertCoreTemplateControlsRetryReceipt(f.browser,f.requiredCases));});
const {linkDefaultFromContainer}=await jiti.import<typeof import('../src/lib/admin/links/link-defaults.ts')>(resolve(root,'src/lib/admin/links/link-defaults.ts'));
for(const kind of ['cards','breadcrumb','cta'])test('Exact first caller projection from real saved config '+kind,()=>{const c=rows[kind].config as Record<string,unknown>,containers=(kind==='cards'?c.items:kind==='breadcrumb'?c.manualItems:[c.primaryCta]) as Array<Record<string,unknown>>;assert.deepEqual(coreTemplateFeedbackLinkValues(kind),containers.map(row=>linkDefaultFromContainer(row)));});
function classifiedFeedback(){const proof=structuredClone(feedbackFixture().browser.templateControls.outcomes[0].feedbackAdapter);return {...proof,linkReadActions:feedbackReadActions('cards'),additionalActionPosts:16};}
test('Known compiled read requests are counted truthfully across every visit and reload',()=>{const p=classifiedFeedback();assert.equal(p.additionalActionPosts,16);assertCoreTemplateFeedbackAdapter(p,'cards',1,'a'.repeat(64));});
for(const[name,mutate]of Object.entries({unknown:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.mutatingOrUnknownActionPosts=1,wrongWorker:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.ownerProjection.worker='foreign',wrongOwner:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.ownerProjection.owner='foreign',wrongExport:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.ownerProjection.exportedName='mutate',missingLeg:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.legs.pop(),extraPost:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.additionalActionPosts++,wrongPayload:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.legs[0].payloadSha256[0]='f'.repeat(64),wrongAction:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.legs[0].actionIdSha256='f'.repeat(64),missingResponse:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.legs[0].responsesCompleted--,failedResponse:(p:ReturnType<typeof classifiedFeedback>):unknown=>p.linkReadActions.legs[0].responsesOk=false}))test('Feedback read evidence rejects '+name,()=>{const p=classifiedFeedback();mutate(p);assert.throws(()=>assertCoreTemplateFeedbackAdapter(p,'cards',1,'a'.repeat(64)));});

for (const [name, mutate] of Object.entries({
  entireReadProof: (proof: ReturnType<typeof classifiedFeedback>) => { Reflect.deleteProperty(proof, 'linkReadActions'); },
  perLegApplicationProof: (proof: ReturnType<typeof classifiedFeedback>) => { Reflect.deleteProperty(proof.linkReadActions.legs[0], 'applicationCompletion'); },
  reusedDocument: (proof: ReturnType<typeof classifiedFeedback>) => { proof.linkReadActions.legs[1].applicationCompletion = structuredClone(proof.linkReadActions.legs[0].applicationCompletion); },
})) test('Mandatory Cards original-reader evidence rejects ' + name, () => {
  const proof = classifiedFeedback(); mutate(proof); assert.throws(() => assertCoreTemplateFeedbackAdapter(proof, 'cards', 1, 'a'.repeat(64)));
});
// Execute the actual template collector branch and its final result property. No database/Browser runtime.
const templateCollectorSource=readFileSync(resolve(root,'scripts/verify-admin-adoption-readback-isolated.mts'),'utf8');
function templateCollectorWiring(source:string){
 const file=ts.createSourceFile('readback.mts',source,ts.ScriptTarget.Latest,true),branches:ts.IfStatement[]=[],properties:ts.ObjectLiteralElementLike[]=[];
 const visit=(node:ts.Node)=>{if(ts.isIfStatement(node)&&node.expression.getText(file)==='browser.cohort==="template-controls"')branches.push(node);if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='result'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer)){for(const property of node.initializer.properties)if(property.name?.getText(file)==='nativeCheckpoints')properties.push(property);}ts.forEachChild(node,visit);};visit(file);
 assert.equal(branches.length,1);assert.equal(properties.length,1);const branch=branches[0].getText(file),property=properties[0].getText(file);
 return{branch,property};
}
async function executeTemplateCollector(source:string,change?:(x:ReturnType<typeof feedbackFixture>)=>void){
 const x=feedbackFixture();change?.(x);const pendingProof={nativeBlockedStatementObservedTwice:true,sameStatementIdentity:true,fieldsDisabledAndInert:true,keyboardRepeatDispatchedNoExtraAction:true,ownedLockReleased:true,actionRequests:1};
 const browserInput={...x.browser,templateControls:{planned:7,completed:7,outcomes:x.browser.templateControls.outcomes.map(row=>({...row,pendingProof}))}};
 const wiring=templateCollectorWiring(source);let reads=0,joinedNative:unknown=null;
 const sourceJs=ts.transpileModule('let nativeCheckpoints=null,templateControls=null;'+wiring.branch+';const result={'+wiring.property+',templateControls};return result;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const execute=new Function('browser','handle','assert','assertCoreTemplateControlsCompleted','readFileSync','join','artifactDir','assertCoreTemplateFeedbackCompletion','assertCoreTemplateReadApplicationCompletion','coreTemplateFeedbackLinkValues','return (async()=>{'+sourceJs+'})();');
 const result=await execute(browserInput,{identity:{runId:x.ownedRunId}},assert,()=>({recipes:7}),(file:string)=>{if(file==='/owned/core-native-control-readback.json'){reads++;return JSON.stringify(x.native);}assert.equal(file,'/owned/core-native-write-faults.json');return JSON.stringify({status:'closed',activeLocks:0});},(...parts:string[])=>parts.join('/'),'/owned',(b:unknown,n:unknown,id:string)=>{joinedNative=n;return assertCoreTemplateFeedbackCompletion(b,n,id);},assertCoreTemplateReadApplicationCompletion,coreTemplateFeedbackLinkValues);
 assert.equal(reads,1,'The template branch captures one owned native envelope.');assert.equal(result.nativeCheckpoints,joinedNative,'The final receipt must preserve the same parsed envelope passed to the strict join.');assert.deepEqual(result.nativeCheckpoints,x.native);assert.equal(result.templateControls.feedbackAdapter.adapterObservations,28);return result;
}
await finishTest('Actual template collector parses and persists same owned native envelope',()=>executeTemplateCollector(templateCollectorSource));
for(const[name,change]of Object.entries({
 'failed-native-status':(x:ReturnType<typeof feedbackFixture>)=>{x.native.status='fail';},
 'foreign-owned-run':(x:ReturnType<typeof feedbackFixture>)=>{x.native.ownedRunId='foreign';},
 'missing-native-phase':(x:ReturnType<typeof feedbackFixture>)=>{x.native.records.pop();},
 'detached-native-source':(x:ReturnType<typeof feedbackFixture>)=>{x.browser.templateControls.outcomes[0].feedbackAdapter.sourceSha256='0'.repeat(64);},
}))await finishTest('Actual template collector rejects '+name,()=>assert.rejects(executeTemplateCollector(templateCollectorSource,change)));
const templateNativeAssignment='nativeCheckpoints=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));';
function mutateTemplateBranch(source:string,change:(branch:string)=>string){const branch=templateCollectorWiring(source).branch;const changed=change(branch);assert.notEqual(changed,branch);return source.replace(branch,()=>changed);}
await finishTest('Original null template envelope wiring is rejected',()=>assert.rejects(executeTemplateCollector(mutateTemplateBranch(templateCollectorSource,branch=>branch.replace(templateNativeAssignment,'').replace('assert.equal(nativeCheckpoints.status,"pass");','').replace('assert.equal(nativeCheckpoints.ownedRunId,handle.identity.runId);','')))));
await finishTest('Template collector detached final envelope is rejected',async()=>{const wiring=templateCollectorWiring(templateCollectorSource);assert.equal(wiring.property,'nativeCheckpoints');await assert.rejects(executeTemplateCollector(templateCollectorSource.replace(/readOnly, nativeCheckpoints, draftRestoration/u,'readOnly, nativeCheckpoints:null, draftRestoration')));});
test('Template collector parses owned envelope before strict feedback join',()=>{const wiring=templateCollectorWiring(templateCollectorSource);assert.equal(wiring.branch.split(templateNativeAssignment).length,2);assert.ok(wiring.branch.indexOf(templateNativeAssignment)<wiring.branch.indexOf('assertCoreTemplateFeedbackCompletion'));assert.ok(wiring.branch.includes('assert.equal(nativeCheckpoints.status,"pass");'));assert.ok(wiring.branch.includes('assert.equal(nativeCheckpoints.ownedRunId,handle.identity.runId);'));});

test('Dual link selection is exactly originalCardsBreadcrumb with CTA retained',()=>{assert.deepEqual(coreTemplateControlKinds(CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION),['cards','breadcrumb']);validateCoreJourneySelection({scope:'core-closure',selection:CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION,cohort:'template-controls'});assert.throws(()=>validateCoreJourneySelection({scope:'core-closure',selection:CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION,cohort:'navigation-settings'}));});
function dualReceipt(){const f=tripleReceipt(),kinds=coreTemplateControlKinds(CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION),ids=kinds.map(k=>'core-template-controls-'+k);f.browser.journeySelection=CORE_TEMPLATE_DUAL_LINK_CONTROLS_SELECTION;f.browser.selectedJourneyIds=ids.slice();f.browser.executedJourneyIds=ids.slice();f.browser.evidence=f.browser.evidence.filter(r=>r.id==='existing-auth-login'||ids.includes(r.id));f.browser.templateControls.outcomes=kinds.map(kind=>({kind}));return f;}
test('Dual receipt grants no completed CTA replay or automatic cell credit',()=>{const f=dualReceipt();assert.deepEqual(assertCoreTemplateControlsRetryReceipt(f.browser,f.requiredCases).selectedJourneyIds,['core-template-controls-cards','core-template-controls-breadcrumb']);});
for(const[label,change]of Object.entries({ctaReplay:(f:ReturnType<typeof dualReceipt>)=>f.browser.executedJourneyIds.push('core-template-controls-cta'),missing:(f:ReturnType<typeof dualReceipt>)=>f.browser.evidence.pop(),lostOpen:(f:ReturnType<typeof dualReceipt>)=>f.browser.requiredCases.pop(),promoted:(f:ReturnType<typeof dualReceipt>)=>{f.browser.requiredCases[0].status='pass';}}))test('Dual receipt rejects '+label,()=>{const f=dualReceipt();change(f);assert.throws(()=>assertCoreTemplateControlsRetryReceipt(f.browser,f.requiredCases));});
test('Transport diagnostics preserve only allowlisted failure text',()=>{assert.deepEqual(coreTemplateReadFailureDiagnostic(null),{code:null});assert.deepEqual(coreTemplateReadFailureDiagnostic({errorText:'net::ERR_ABORTED'}),{code:'net::ERR_ABORTED'});const diagnostic=coreTemplateReadFailureDiagnostic({errorText:'private diagnostic sentinel'});assert.equal(diagnostic.code,'OTHER');assert.match(diagnostic.sha256!,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(diagnostic).includes('private diagnostic sentinel'),false);});

async function finishTest(name:string,task:()=>Promise<unknown>){await task();cases.push(name);}
const readResponse=({status=200,failure=null,finished=null}:{status?:number;failure?:{errorText:string}|null;finished?:Error|null}={})=>({status:()=>status,request:()=>({failure:()=>failure}),finished:async()=>finished});
function clockPort(expire=false){const calls:string[]=[];return{calls,schedule:(callback:()=>void,ms:number)=>{assert.equal(ms,60000);calls.push('scheduled');if(expire)queueMicrotask(callback);return 1 as unknown as ReturnType<typeof setTimeout>;},cancel:(timer:ReturnType<typeof setTimeout>|undefined)=>{assert.equal(timer,1);calls.push('cleared');}};}
await finishTest('Read completion waits for every real response and clears its deadline',async()=>{const c=clockPort();await finishCoreTemplateReadResponses([readResponse(),readResponse()],c);assert.deepEqual(c.calls,['scheduled','cleared']);});
for(const[name,response]of [['http error',readResponse({status:500})],['failed request',readResponse({failure:{errorText:'simulated failure'}})],['unfinished response error',readResponse({finished:Error('simulated failure')})]] as const)await finishTest('Read completion rejects '+name,async()=>{const c=clockPort();await assert.rejects(finishCoreTemplateReadResponses([response],c));assert.deepEqual(c.calls,['scheduled','cleared']);});
await finishTest('Unresolved transport fails at the existing60second bound with no success receipt',async()=>{const c=clockPort(true);await assert.rejects(finishCoreTemplateReadResponses([{...readResponse(),finished:()=>new Promise(()=>{})}],c),/TEMPLATE_READ_FINISH_DEADLINE/);assert.deepEqual(c.calls,['scheduled','cleared']);});
await finishTest('Target closure rejection cannot be transformed into transport success',async()=>{const c=clockPort();await assert.rejects(finishCoreTemplateReadResponses([{...readResponse(),finished:async()=>{throw Error('closed');}}],c));assert.deepEqual(c.calls,['scheduled','cleared']);});
await finishTest('Failure arriving during completion still rejects',async()=>{let failed=false;const c=clockPort(),r={status:()=>200,request:()=>({failure:()=>failed?{errorText:'late failure'}:null}),finished:async()=>{failed=true;return null;}};await assert.rejects(finishCoreTemplateReadResponses([r],c),/TEMPLATE_READ_REQUEST_FAILED/);assert.deepEqual(c.calls,['scheduled','cleared']);});
// Controlled original-reader observer tests: no browser, network, or Product runtime.
async function consumptionHarness({ chunks = [new TextEncoder().encode('0:{"a":{"ok":true}}\n')], rejectRead = false, action = 'owned-action', duplicate = false } = {}) {
  const expectedValues: AdminLinkValue[] = [{ link_kind: 'external', href: 'https://example.invalid/one' }];
  const pathname = '/admin/pages-blocks/blocks/cards/123', origin = 'http://127.0.0.1:49152';
  const results = [...chunks.map(value => ({ done: false, value })), { done: true, value: undefined }];
  const originalReadPromises = results.map(result => Promise.resolve(result));
  if (rejectRead) originalReadPromises[0] = Promise.reject(new Error('controlled-reader-failure'));
  // Register the test's rejection handler before any microtask can report it unhandled.
  if (rejectRead) void originalReadPromises[0].catch(() => {});
  const originalCancelPromise = Promise.resolve(); let readIndex = 0;
  class Reader { read() { return originalReadPromises[readIndex++]; } cancel() { return originalCancelPromise; } }
  const originalReader = new Reader();
  class Stream { getReader() { return originalReader; } cancel() { return originalCancelPromise; } }
  const originalStream = new Stream();
  const response = { status: 200, headers: new Headers({ 'content-type': 'text/x-component', 'cache-control': 'no-store' }), body: originalStream, redirected: false, url: origin + pathname };
  const originalFetchPromise = Promise.resolve(response);
  const originalFetch = (...args: unknown[]) => { assert.ok(args.length > 0); return originalFetchPromise; };
  const realm = { argument: undefined as unknown, config: undefined as unknown, location: { origin, pathname, href: origin + pathname }, crypto: { randomUUID }, URL, Headers, Uint8Array, ReadableStream: Stream, ReadableStreamDefaultReader: Reader, fetch: originalFetch };
  const context = createContext(realm); let initializer: { callback: (argument: unknown) => unknown; argument: unknown } | undefined;
  const page = {
    async addInitScript(callback: (argument: unknown) => unknown, argument: unknown) { initializer = { callback, argument }; },
    async evaluate(callback: (argument: unknown) => unknown, argument: unknown) { realm.argument = argument; return runInContext('(' + callback.toString() + ')(argument)', context); },
  };
  const observer = await installCoreTemplateReadConsumptionObserver(page, { origin, pathname, actionId: 'owned-action', expectedValues });
  assert.equal(realm.fetch, originalFetch, 'Installing for the next document must not start or alter a current fetch');
  realm.config = initializer!.argument; runInContext('(' + initializer!.callback.toString() + ')(config)', context);
  const options = { method: 'POST', headers: { 'next-action': action }, body: JSON.stringify([expectedValues[0]]) };
  const observedFetchPromise = realm.fetch(origin + pathname, options);
  assert.equal(observedFetchPromise, originalFetchPromise);
  assert.equal(await observedFetchPromise, response);
  const reader = response.body.getReader(); assert.equal(reader, originalReader);
  if (rejectRead) { const promise = reader.read(); assert.equal(promise, originalReadPromises[0]); await assert.rejects(promise, /controlled-reader-failure/); }
  else for (let index = 0; index < results.length; index++) {
    const promise = reader.read(); assert.equal(promise, originalReadPromises[index]); assert.equal(await promise, results[index]);
  }
  if (duplicate) await realm.fetch(origin + pathname, options);
  const snapshot = JSON.parse(JSON.stringify(await observer.snapshot()));
  return { observer, snapshot, expectedValues, options, originalFetchPromise, response, reader, originalCancelPromise, realm, originalFetch, pathname, origin };
}
await finishTest('Original-reader observer preserves fetch, response, stream, reader, read promise and result identity', async () => {
  const h = await consumptionHarness();
  assertCoreTemplateReadConsumption(h.snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' });
  assert.equal(h.snapshot.rows[0].reads, 2); assert.equal(h.snapshot.rows[0].cacheControl, 'no-store');
  assert.equal(Buffer.from(h.snapshot.rows[0].bytesBase64, 'base64').toString(), '0:{"a":{"ok":true}}\n');
  await h.observer.deactivate(); assert.equal(h.realm.fetch, h.originalFetch);
});
await finishTest('Original-reader observer retains cancellation promise and rejects canceled consumption', async () => {
  const h = await consumptionHarness(); assert.equal(h.reader.cancel(), h.originalCancelPromise);
  const snapshot = await h.observer.snapshot(); assert.equal(snapshot.rows[0].cancelCount, 1);
  assert.throws(() => assertCoreTemplateReadConsumption(snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' }));
});
await finishTest('Original-reader observer records original reader rejection', async () => {
  const h = await consumptionHarness({ rejectRead: true }); assert.deepEqual(h.snapshot.rows[0].errors, ['reader-rejected']);
  assert.throws(() => assertCoreTemplateReadConsumption(h.snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' }));
});
await finishTest('Original-reader observer bounds byte copies and rejects overflow', async () => {
  const h = await consumptionHarness({ chunks: [new Uint8Array(65537)] });
  assert.equal(h.snapshot.rows[0].overflow, true); assert.equal(h.snapshot.rows[0].bytesBase64, '');
  assert.throws(() => assertCoreTemplateReadConsumption(h.snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' }));
});
await finishTest('Original-reader observer rejects an unmatched scoped Action', async () => {
  const h = await consumptionHarness({ action: 'unmatched-action' }); assert.equal(h.snapshot.rows[0].matched, false);
  assert.equal(h.snapshot.rows[0].bytesBase64, ''); assert.equal(h.snapshot.rows[0].readerCount, 0); assert.equal(h.snapshot.rows[0].reads, 0);
  assert.throws(() => assertCoreTemplateReadConsumption(h.snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' }));
});
await finishTest('Original-reader observer rejects duplicate requests', async () => {
  const h = await consumptionHarness({ duplicate: true }); assert.equal(h.snapshot.rows.length, 2);
  assert.throws(() => assertCoreTemplateReadConsumption(h.snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' }));
});
await finishTest('Original-reader diagnostic rejects missing, partial, wrong document, errors and forged byte evidence', async () => {
  const h = await consumptionHarness();
  const changes: Record<string, (snapshot: typeof h.snapshot) => void> = {
    missing: s => { s.rows = []; }, partial: s => { s.rows[0].done = false; }, document: s => { s.rows[0].documentToken = randomUUID(); },
    errors: s => { s.rows[0].errors.push('fetch-rejected'); }, canceled: s => { s.rows[0].cancelCount++; },
    wrongHash: s => { s.rows[0].bytesSha256 = '0'.repeat(64); }, byteLength: s => { s.rows[0].byteLength++; },
    unmatched: s => { s.rows[0].matched = false; }, overflow: s => { s.overflow = true; }, observerError: s => { s.observerError = true; },
    action: s => { s.actionIdSha256 = '0'.repeat(64); }, payload: s => { s.rows[0].payloadSha256 = '0'.repeat(64); },
    redirect: s => { s.rows[0].redirected = true; }, contentType: s => { s.rows[0].contentType = 'text/html'; },
    extraReader: s => { s.rows[0].readerCount++; }, byob: s => { s.rows[0].unsupportedReader = true; },
  };
  for (const [name, change] of Object.entries(changes)) {
    const snapshot = structuredClone(h.snapshot); change(snapshot);
    assert.throws(() => assertCoreTemplateReadConsumption(snapshot, { expectedValues: h.expectedValues, actionId: 'owned-action' }), name);
  }
});
await finishTest('Application completion decodes exact canonical original-reader bytes despite bounded Chromium abort', async () => {
  const fixture = completionFixture(), proof = await assertCoreTemplateReadApplicationCompletion(fixture, completionOptions);
  assert.equal(proof.requests.length, 2); assert.deepEqual(proof.requests.map(row => row.decodedResult), completionResults);
  assert.equal(proof.requests[0].transportError, 'net::ERR_ABORTED');
  assertCoreTemplateReadApplicationReceipts(proof, { pathname: completionOptions.pathname, actionIdSha256: completionDigest(completionOptions.actionId), expectedValues: completionValues });
  const replay = await assertCoreTemplateReadApplicationCompletion(proof.sourceEvidence, { ...completionOptions, actionId: undefined, actionIdSha256: completionDigest(completionOptions.actionId) });
  assert.deepEqual(replay, proof);
});
await finishTest('Application completion preserves finished transport when CDP terminal time precedes response', async () => {
  const fixture = completionFixture(); for (const row of fixture.requests) { row.transportTerminal = 'finished'; row.transportError = null; }
  for (const row of fixture.documentNetwork.requests) row.terminal = { kind: 'finished', requestId: row.requestId, timestamp: row.timestamp + 0.05, encodedDataLength: 826 };
  assert.ok(fixture.documentNetwork.requests.every(row => row.terminal.timestamp < row.response.timestamp));
  const proof = await assertCoreTemplateReadApplicationCompletion(fixture, completionOptions);
  assert.ok(proof.requests.every(row => row.transportTerminal === 'finished' && row.transportError === null));
});
const completionChanges: Record<string, (fixture: ReturnType<typeof completionFixture>) => void> = {
  truncated: f => { const bytes = Buffer.from(f.snapshot.rows[0].bytesBase64, 'base64'); changeCompletionBytes(f, bytes.subarray(0, bytes.length - 2).toString()); },
  invalidFlight: f => { changeCompletionBytes(f, '0:{"unexpected":true}\n'); },
  wrongCanonicalResult: f => { const wrong = structuredClone(completionResults[0]); wrong.display.title = 'wrong canonical title'; changeCompletionBytes(f, '0:{"a":"$@1"}\n1:' + JSON.stringify(wrong) + '\n'); },
  noEof: f => { f.snapshot.rows[0].done = false; }, cancel: f => { f.snapshot.rows[0].cancelCount++; },
  readerError: f => { f.snapshot.rows[0].errors.push('reader-rejected'); },
  unknownTransport: f => { f.requests[0].transportError = 'net::ERR_CONNECTION_RESET'; },
  unfinished: f => { Object.assign(f.requests[0], { transportTerminal: 'pending' }); },
  missingNoStore: f => { f.requests[0].cacheControl = 'private'; f.snapshot.rows[0].cacheControl = 'private'; },
  wrongAction: f => { f.requests[0].actionId = 'foreign-action'; },
  wrongPayload: f => { f.requests[0].body = JSON.stringify([{ link_kind: 'none' }]); },
  rawBodyTamper: f => { f.requests[0].body += ' '; },
  wrongDocument: f => { f.snapshot.documentUrl = completionUrl + '&foreign=1'; },
  foreignRequestDocument: f => { f.requests[0].url = completionOptions.origin + completionOptions.pathname; },
  extraRequest: f => { f.requests.push({ ...f.requests[0] }); }, missingRequest: f => { f.requests.pop(); },
  duplicateReader: f => { f.snapshot.rows[1] = { ...f.snapshot.rows[0], sequence: 1 }; },
  staleLoader: f => { f.documentNetwork.requests[0].loaderId = 'preceding-loader'; },
  staleResponseLoader: f => { f.documentNetwork.requests[0].response.loaderId = 'preceding-loader'; },
  wrongFrame: f => { f.documentNetwork.requests[0].frameId = 'other-frame'; },
  wrongResponseRequest: f => { f.documentNetwork.requests[0].response.requestId = 'foreign-request'; },
  wrongTerminalRequest: f => { f.documentNetwork.requests[0].terminal.requestId = 'foreign-request'; },
  duplicateNetworkIdentity: f => { f.documentNetwork.requests[1].requestId = f.documentNetwork.requests[0].requestId; },
  wrongNetworkAction: f => { f.documentNetwork.requests[0].actionIdSha256 = '0'.repeat(64); },
  wrongNetworkPayload: f => { f.documentNetwork.requests[0].payloadSha256 = '0'.repeat(64); },
  networkHttpError: f => { f.documentNetwork.requests[0].response.status = 500; },
  networkUnknownFailure: f => { f.documentNetwork.requests[0].terminal.failure = { code: 'net::ERR_CONNECTION_CLOSED' }; },
  hostNetworkTerminalMismatch: f => { f.requests[0].transportTerminal = 'finished'; f.requests[0].transportError = null; },
  staleNetworkDocument: f => { f.documentNetwork.requests[0].documentUrlSha256 = '0'.repeat(64); },
  missingNetworkTerminal: f => { Object.assign(f.documentNetwork.requests[0], { terminal: null }); },
  reversedNetworkTime: f => { f.documentNetwork.requests[0].terminal.timestamp = 0; },
  missingNetworkRequest: f => { f.documentNetwork.requests.pop(); },
  extraNetworkRequest: f => { f.documentNetwork.requests.push(structuredClone(f.documentNetwork.requests[0])); },
  unavailableNetworkPayload: f => { f.documentNetwork.requests[0].postDataAvailable = false; },
};
for (const [name, change] of Object.entries(completionChanges)) await finishTest('Application completion rejects ' + name, async () => {
  const fixture = completionFixture(); change(fixture); await assert.rejects(assertCoreTemplateReadApplicationCompletion(fixture, completionOptions));
});
console.log(JSON.stringify({status:"pass",controls:cases.length,cases,runtimeExecuted:false,globalClosed:false}));



