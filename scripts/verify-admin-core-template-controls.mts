import {CORE_DOWNLOAD_MEDIA_HREF} from './fixtures/admin-core-download-media-adoption.mjs';
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { createJiti } from "jiti";
import { TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS, assertCoreTemplateFeedbackAdapter, assertCoreTemplateFeedbackCompletion, buildCoreTemplateControlsPlan, TEMPLATE_CONTROL_PHASES, TEMPLATE_CONTROL_RECIPES, TEMPLATE_CONTROL_VALUES as v, validateTemplateControlsRequest, assertTemplateControlsProjection } from "./fixtures/admin-core-template-controls-contract.mjs";
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
function feedbackFixture(){
 const sourceSha256='a'.repeat(64),ownedRunId='owned-fixture';
 const outcomes=Object.keys(TEMPLATE_CONTROL_RECIPES).map((kind,kindIndex)=>{
  const templateId=kindIndex+1;
  const feedbackAdapter={kind,templateId,channel:'block-editor:/admin/pages-blocks/blocks/'+kind,routePathname:'/admin/pages-blocks/blocks/'+kind+'/'+templateId,sourceSha256,actualAcceptedSaveVisible:true,actualAcceptedVariant:'success',additionalActionPosts:0,adapterOnly:true,backendFailureClaim:false,automaticCoverage:[],globalClosed:false,nativeBefore:kind+':saved',nativeAfter:kind+':reloaded',scenarios:TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.map(spec=>({id:spec.id,variant:spec.variant,messageText:spec.text,visibleCount:1,dismissButtonVisible:true,dismissed:true,savedRemoved:true,noticeRemoved:true,cacheWarningRemoved:true,unrelatedQueryPreserved:true,samePathAndHash:true,absentAfterReload:true}))};return{kind,templateId,feedbackAdapter};
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

// Execute the actual template collector branch and its final result property. No database/Browser runtime.
const templateCollectorSource=readFileSync(resolve(root,'scripts/verify-admin-adoption-readback-isolated.mts'),'utf8');
function templateCollectorWiring(source:string){
 const file=ts.createSourceFile('readback.mts',source,ts.ScriptTarget.Latest,true),branches:ts.IfStatement[]=[],properties:ts.ObjectLiteralElementLike[]=[];
 const visit=(node:ts.Node)=>{if(ts.isIfStatement(node)&&node.expression.getText(file)==='browser.cohort==="template-controls"')branches.push(node);if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='result'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer)){for(const property of node.initializer.properties)if(property.name?.getText(file)==='nativeCheckpoints')properties.push(property);}ts.forEachChild(node,visit);};visit(file);
 assert.equal(branches.length,1);assert.equal(properties.length,1);const branch=branches[0].getText(file),property=properties[0].getText(file);
 return{branch,property};
}
function executeTemplateCollector(source:string,change?:(x:ReturnType<typeof feedbackFixture>)=>void){
 const x=feedbackFixture();change?.(x);const pendingProof={nativeBlockedStatementObservedTwice:true,sameStatementIdentity:true,fieldsDisabledAndInert:true,keyboardRepeatDispatchedNoExtraAction:true,ownedLockReleased:true,actionRequests:1};
 const browserInput={...x.browser,templateControls:{planned:7,completed:7,outcomes:x.browser.templateControls.outcomes.map(row=>({...row,pendingProof}))}};
 const wiring=templateCollectorWiring(source);let reads=0,joinedNative:unknown=null;
 const sourceJs=ts.transpileModule('let nativeCheckpoints=null,templateControls=null;'+wiring.branch+';const result={'+wiring.property+',templateControls};return result;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const execute=new Function('browser','handle','assert','assertCoreTemplateControlsCompleted','readFileSync','join','artifactDir','assertCoreTemplateFeedbackCompletion',sourceJs);
 const result=execute(browserInput,{identity:{runId:x.ownedRunId}},assert,()=>({recipes:7}),(file:string)=>{if(file==='/owned/core-native-control-readback.json'){reads++;return JSON.stringify(x.native);}assert.equal(file,'/owned/core-native-write-faults.json');return JSON.stringify({status:'closed',activeLocks:0});},(...parts:string[])=>parts.join('/'),'/owned',(b:unknown,n:unknown,id:string)=>{joinedNative=n;return assertCoreTemplateFeedbackCompletion(b,n,id);});
 assert.equal(reads,1,'The template branch captures one owned native envelope.');assert.equal(result.nativeCheckpoints,joinedNative,'The final receipt must preserve the same parsed envelope passed to the strict join.');assert.deepEqual(result.nativeCheckpoints,x.native);assert.equal(result.templateControls.feedbackAdapter.adapterObservations,28);return result;
}
test('Actual template collector parses and persists same owned native envelope',()=>executeTemplateCollector(templateCollectorSource));
for(const[name,change]of Object.entries({
 'failed-native-status':(x:ReturnType<typeof feedbackFixture>)=>{x.native.status='fail';},
 'foreign-owned-run':(x:ReturnType<typeof feedbackFixture>)=>{x.native.ownedRunId='foreign';},
 'missing-native-phase':(x:ReturnType<typeof feedbackFixture>)=>{x.native.records.pop();},
 'detached-native-source':(x:ReturnType<typeof feedbackFixture>)=>{x.browser.templateControls.outcomes[0].feedbackAdapter.sourceSha256='0'.repeat(64);},
}))test('Actual template collector rejects '+name,()=>assert.throws(()=>executeTemplateCollector(templateCollectorSource,change)));
const templateNativeAssignment='nativeCheckpoints=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));';
function mutateTemplateBranch(source:string,change:(branch:string)=>string){const branch=templateCollectorWiring(source).branch;const changed=change(branch);assert.notEqual(changed,branch);return source.replace(branch,()=>changed);}
test('Original null template envelope wiring is rejected',()=>assert.throws(()=>executeTemplateCollector(mutateTemplateBranch(templateCollectorSource,branch=>branch.replace(templateNativeAssignment,'').replace('assert.equal(nativeCheckpoints.status,"pass");','').replace('assert.equal(nativeCheckpoints.ownedRunId,handle.identity.runId);','')))));
test('Template collector detached final envelope is rejected',()=>{const wiring=templateCollectorWiring(templateCollectorSource);assert.equal(wiring.property,'nativeCheckpoints');assert.throws(()=>executeTemplateCollector(templateCollectorSource.replace(/readOnly, nativeCheckpoints, draftRestoration/u,'readOnly, nativeCheckpoints:null, draftRestoration')));});
test('Template collector parses owned envelope before strict feedback join',()=>{const wiring=templateCollectorWiring(templateCollectorSource);assert.equal(wiring.branch.split(templateNativeAssignment).length,2);assert.ok(wiring.branch.indexOf(templateNativeAssignment)<wiring.branch.indexOf('assertCoreTemplateFeedbackCompletion'));assert.ok(wiring.branch.includes('assert.equal(nativeCheckpoints.status,"pass");'));assert.ok(wiring.branch.includes('assert.equal(nativeCheckpoints.ownedRunId,handle.identity.runId);'));});

console.log(JSON.stringify({status:"pass",controls:cases.length,cases,runtimeExecuted:false,globalClosed:false}));



