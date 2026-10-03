import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createJiti} from 'jiti';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium,expect as browserExpect} from 'playwright/test';
import {buildCoreReadonlyHubPlan,readCoreIntegrationCardStatus,assertCoreReadonlyDestinationHeader} from './fixtures/admin-core-readonly-hubs-journeys.mjs';
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,jsx:{runtime:"automatic"}}), require=createRequire(import.meta.url);
const collection=await jiti.import('../src/lib/admin/interaction-system/adoption-manifest.ts');
const forms=await jiti.import('../src/lib/admin/form-system/adoption-manifest.ts');
const reports=await jiti.import('../src/lib/admin/reports/reports-information-architecture.ts');
const integrations=await jiti.import('../src/lib/admin/integrations/integrations-contract.ts');
const base={collectionAdoption:collection.ADMIN_COLLECTION_SURFACE_ADOPTION,formManifest:forms.ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
 reportDefinitions:reports.ADMIN_REPORT_DEFINITIONS,integrationDefinitions:integrations.INTEGRATION_DEFINITIONS};
const checks=[];async function test(name,body){await body();checks.push({name,status:'pass'});}
async function verifyReadonlyDestinationHeaderContract() {
 const {chromium,expect: browserExpect}=require('playwright/test');
 const shell=readFileSync('src/components/admin/AdminShell.tsx','utf8');
 const classes=shell.match(/className="([^"]*\[&:has\(\[data-admin-page-header\]\)>\[data-admin-fallback-header\]\]:hidden[^"]*)"/u)?.[1];assert.ok(classes);
 const shellPath=require('node:path').resolve('src/components/admin/AdminShell.tsx').replaceAll('\\','/');
 const css=(await require('postcss')([require('@tailwindcss/postcss')({base:process.cwd()})]).process('@import "tailwindcss" source(none);\n@source "'+shellPath+'";',{from:require('node:path').resolve('readonly-header-controlled.css')})).css;
 assert.ok(css.includes('&:has([data-admin-page-header])>[data-admin-fallback-header]'));
 const headerSource=readFileSync('src/components/admin/ui/AdminPageContextHeader.tsx','utf8'),headerModule={exports:{}};
 const headerCode=ts.transpileModule(headerSource,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',headerCode)(name=>{assert.equal(name,'react/jsx-runtime');return require(name);},headerModule,headerModule.exports);
 const render=title=>require('react-dom/server').renderToStaticMarkup(require('react').createElement(headerModule.exports.default,{title}));
 const fallback=render('Fallback'),headers=['المشاريع السكنية','المحافظات','متابعة التنفيذ'];const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());const main=page.locator('main');
  const html=(custom,extra='')=>'<style>'+css+'</style><main><div class="'+classes+'"><div data-admin-page-body>'+custom+'</div><div data-admin-fallback-header>'+fallback+'</div>'+extra+'</div></main>';
  await test('header-original-strict-probe-rejects-hidden-fallback',async()=>{await page.setContent(html(render(headers[0])));assert.equal(await main.locator('[data-admin-page-header]').count(),2);assert.equal(await main.locator('[data-admin-page-header]:visible').count(),1);await assert.rejects(browserExpect(main.locator('[data-admin-page-header]')).toBeVisible({timeout:100}),/strict mode violation/u);});
  for(const title of headers)await test('header-current-owner-visible-unique-'+title,async()=>{await page.setContent(html(render(title)));await assertCoreReadonlyDestinationHeader(main,{timeout:100});await browserExpect(main.getByRole('heading',{name:title,exact:true})).toBeVisible();});
  for(const [name,custom,change]of[
   ['duplicate-visible-custom',render(headers[0])+render(headers[1]),null],
   ['missing-custom','',null],
   ['hidden-custom',render(headers[0]),"document.querySelector('[data-admin-page-body]').style.display='none'"],
   ['missing-heading',render(headers[0]).replace(/<h1[^>]*>[\s\S]*?<\/h1>/u,''),null],
   ['visible-fallback',render(headers[0]),"document.querySelector('[data-admin-fallback-header]').style.setProperty('display','block','important')"],
   ['fallback-only-visible','',"document.querySelector('[data-admin-fallback-header]').style.setProperty('display','block','important')"],
  ])await test('header-rejects-'+name,async()=>{await page.setContent(html(custom));if(change)await page.evaluate(change);await assert.rejects(assertCoreReadonlyDestinationHeader(main,{timeout:100}));});
 }finally{await browser.close();}
}

await verifyReadonlyDestinationHeaderContract();
let plan;
await test('current-canonical-plan-preserves-remaining-security-and-media',()=>{plan=buildCoreReadonlyHubPlan(base);assert.ok(plan.selected.length&&plan.reports.length&&plan.integrations.length);assert.ok(plan.remaining.some(r=>r.id==='security-settings'));assert.ok(plan.remaining.some(r=>r.state==='remaining-specialized-media-behavior'));});
for(const change of ['missing-hub','duplicate-hub','unknown-route','generic-owner','missing-command-surface','duplicate-report','foreign-report','report-no-filter','duplicate-integration','unknown-integration-category','missing-security-inventory']){
 const value=structuredClone(base);
 if(change==='missing-hub')value.collectionAdoption.surfaces=value.collectionAdoption.surfaces.filter(r=>r.id!=='projects-hub');
 if(change==='duplicate-hub')value.collectionAdoption.surfaces.push(value.collectionAdoption.surfaces.find(r=>r.id==='projects-hub'));
 if(change==='unknown-route')value.collectionAdoption.surfaces.find(r=>r.id==='projects-hub').routes=[];
 if(change==='generic-owner')value.collectionAdoption.surfaces.find(r=>r.id==='projects-hub').generic=true;
 if(change==='missing-command-surface')value.formManifest.find(r=>r.id==='activity-sitemap-media-commands').surfaces=[];
 if(change==='duplicate-report')value.reportDefinitions.push(value.reportDefinitions[0]);
 if(change==='foreign-report')value.reportDefinitions[0].href='/admin/foreign';
 if(change==='report-no-filter')value.reportDefinitions[0].filters=[{id:'all'}];
 if(change==='duplicate-integration')value.integrationDefinitions.push(value.integrationDefinitions[0]);
 if(change==='unknown-integration-category')value.integrationDefinitions[0].category='unknown';
 if(change==='missing-security-inventory')value.formManifest=value.formManifest.filter(r=>r.id!=='security-settings');
 await test('plan-rejects-'+change,()=>assert.throws(()=>buildCoreReadonlyHubPlan(value)));
}
async function reportStatusControls(journeySource,{reproduceOnly=false}={}){
 const file=ts.createSourceFile('journey.mjs',journeySource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),nodes=[];
 const visit=node=>{if(ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&ts.isPropertyAccessExpression(node.expression.expression)&&node.expression.expression.name.text==='toBeVisible'&&node.getText(file).includes('حالة التقرير')&&node.getText(file).includes('غير متاح'))nodes.push(node);ts.forEachChild(node,visit);};visit(file);assert.equal(nodes.length,1);
 const check=new Function('expect','return async(page,main)=>{'+nodes[0].getText(file)+';}')(browserExpect.configure({timeout:100}));
 const source=readFileSync('src/components/admin/reports/AdminReportDetailView.tsx','utf8'),component=ts.createSourceFile('report.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const declarations=component.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&['STATE_LABELS','STATE_TONES'].includes(d.name.text))||ts.isFunctionDeclaration(n)&&n.name?.text==='ReportStateBanner');assert.equal(declarations.length,3);
 const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React};const pillModule={exports:{}};
 new Function('React','module','exports',ts.transpileModule(readFileSync('src/components/admin/ui/AdminStatusPill.tsx','utf8'),{compilerOptions:options}).outputText)(React,pillModule,pillModule.exports);
 const Banner=new Function('React','AdminStatusPill',ts.transpileModule(declarations.map(n=>n.getText(component)).join('\n'),{compilerOptions:options}).outputText+';return ReportStateBanner;')(React,pillModule.exports.default);
 const html=state=>renderToStaticMarkup(React.createElement(Banner,{presentation:{state,message:'Controlled unavailable provider; no fabricated metrics.'}}));
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();const checks=[];
 const run=async(name,contents,accept)=>{await page.setContent(contents);const main=page.locator('main').last();let error=null;try{await check(page,main);}catch(e){error=String(e);}assert.equal(error===null,accept,name+' '+(error??''));checks.push({name,status:'pass',assertionAccepted:error===null,...error?{rejection:error.slice(0,1000)}:{}});};
 try{
  if(reproduceOnly){await run('original-main-rooted-relative-has-rejects-actual-unavailable-banner','<main>'+html('unavailable')+'</main>',false);assert.equal(await page.getByRole('heading',{name:'حالة التقرير',exact:true}).count(),1);assert.equal(await page.getByText('غير متاح',{exact:true}).count(),1);return{status:'pass',classificationEvidence:'Original assertion rejects the actual canonical unavailable banner despite visible correct heading/status.',checks};}
  for(const report of ['analytics','business'])await run(report+'-actual-unavailable-banner','<main>'+html('unavailable')+'</main>',true);
  await run('ready-status-is-not-unavailable','<main>'+html('ready')+'</main>',false);
  await run('missing-status-rejected','<main>'+html('unavailable').replace('غير متاح','')+'</main>',false);
  await run('missing-heading-rejected','<main>'+html('unavailable').replace('حالة التقرير','different')+'</main>',false);
  await run('outside-status-does-not-satisfy-owned-banner',html('unavailable')+'<main>'+html('ready')+'</main>',false);
  await run('duplicate-visible-banners-rejected','<main>'+html('unavailable')+html('unavailable')+'</main>',false);
  await run('hidden-status-rejected','<main>'+html('unavailable').replace('<span ','<span hidden ')+'</main>',false);
  return{status:'pass',cases:checks.length,checks,boundary:'Actual extracted ReportStateBanner plus full canonical AdminStatusPill rendered by React DOM in controlled Playwright. No application database, live cohort, network, provider or coverage proof.'};
 }finally{await browser.close();}
}

const reportStatusProof=await reportStatusControls(readFileSync('scripts/fixtures/admin-core-readonly-hubs-journeys.mjs','utf8'));checks.push(...reportStatusProof.checks);
const integrationOwnerPath='src/components/admin/integrations/AdminIntegrationsPlatform.tsx';
const integrationOwnerSource=readFileSync(integrationOwnerPath,'utf8'),integrationTree=ts.createSourceFile(integrationOwnerPath,integrationOwnerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const integrationNames=new Set(['CATEGORY_LABELS','STATUS_LABELS','STATUS_TONES','STATUS_DOTS','DisabledAction','IntegrationAction','IntegrationCard']);
const integrationNodes=integrationTree.statements.filter(node=>ts.isFunctionDeclaration(node)?integrationNames.has(node.name?.text):ts.isVariableStatement(node)&&node.declarationList.declarations.some(declaration=>integrationNames.has(declaration.name.getText(integrationTree))));
assert.equal(integrationNodes.length,integrationNames.size);
const integrationCompiled=ts.transpileModule(integrationNodes.map(node=>node.getText(integrationTree)).join('\n')+'\nexport {IntegrationCard,STATUS_LABELS};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const integrationModule={exports:{}},statusPill=await jiti.import('../src/components/admin/ui/AdminStatusPill.tsx',{default:true}),brandIcon=await jiti.import('../src/components/admin/integrations/IntegrationBrandIcon.tsx',{default:true}),configuration=await jiti.import('../src/lib/admin/integrations/server-configuration-contract.ts'),dates=await jiti.import('../src/lib/content-dates.ts');
new Function('require','module','exports','Link','AdminStatusPill','IntegrationBrandIcon','isIntegrationAppConfigurationAuthorizationReady','formatAdminDateTime',integrationCompiled)(require,integrationModule,integrationModule.exports,require('next/link').default,statusPill,brandIcon,configuration.isIntegrationAppConfigurationAuthorizationReady,dates.formatAdminDateTime);
const {IntegrationCard,STATUS_LABELS}=integrationModule.exports,labels=Object.values(STATUS_LABELS),controlledRows=plan.integrations.map((row,index)=>({...row,status:index<7?'needs_attention':'unavailable',reportsAvailable:false,appConfigurationStatus:null,appConfigurationLastTestedAt:null,lastSyncAt:null,message:'Controlled current status',configureHref:null,testHref:null}));
const cardHtml=rows=>renderToStaticMarkup(React.createElement(React.Fragment,null,...rows.map(item=>React.createElement(IntegrationCard,{key:item.key,item}))));
const integrationBrowser=await chromium.launch({headless:true}),integrationPage=await integrationBrowser.newPage();await integrationPage.route('**/*',route=>route.abort());
try{
 await integrationPage.setContent(cardHtml(controlledRows));const cards=integrationPage.locator('article'),cardFor=row=>cards.filter({has:integrationPage.getByText(row.label,{exact:true})});
 await test('integration-old-status-selector-reproduces-action-label-collision',async()=>{assert.equal(await cards.count(),controlledRows.length);for(const row of controlledRows)assert.equal(await cardFor(row).getByText(STATUS_LABELS.testing,{exact:true}).count(),1);assert.equal(controlledRows.filter(row=>row.status==='testing').length,0);});
 await test('integration-real-card-status-excludes-testing-actions',async()=>{const observed=[];for(const row of controlledRows)observed.push(await readCoreIntegrationCardStatus(cardFor(row),labels));assert.deepEqual(observed,controlledRows.map(row=>STATUS_LABELS[row.status]));assert.equal(observed.filter(label=>label===STATUS_LABELS.testing).length,0);});
 await test('integration-real-status-count-agrees-with-current-card-projection',async()=>{const observed=[];for(const row of controlledRows)if(await readCoreIntegrationCardStatus(cardFor(row),labels)===STATUS_LABELS.needs_attention)observed.push(row.key);assert.deepEqual(observed,controlledRows.filter(row=>row.status==='needs_attention').map(row=>row.key));});
 await test('integration-actual-testing-status-remains-distinct-from-shared-action',async()=>{const rows=structuredClone(controlledRows);rows[0].status='testing';await integrationPage.setContent(cardHtml(rows));assert.equal(await cardFor(rows[0]).getByText(STATUS_LABELS.testing,{exact:true}).count(),2);assert.equal(await readCoreIntegrationCardStatus(cardFor(rows[0]),labels),STATUS_LABELS.testing);});
 await test('integration-missing-status-span-rejected',async()=>{await integrationPage.setContent(cardHtml([controlledRows[0]]));await cards.locator('span').filter({hasText:STATUS_LABELS.needs_attention}).first().evaluate(node=>node.remove());await assert.rejects(readCoreIntegrationCardStatus(cards,labels));});
 await test('integration-duplicate-status-span-rejected',async()=>{await integrationPage.setContent(cardHtml([controlledRows[0]]));await cards.locator('span').filter({hasText:STATUS_LABELS.needs_attention}).first().evaluate(node=>node.after(node.cloneNode(true)));await assert.rejects(readCoreIntegrationCardStatus(cards,labels));});
 await test('integration-unrecognized-status-rejected',async()=>{await integrationPage.setContent(cardHtml([controlledRows[0]]));await cards.locator('span').filter({hasText:STATUS_LABELS.needs_attention}).first().evaluate(node=>node.textContent='Unknown status');await assert.rejects(readCoreIntegrationCardStatus(cards,labels));});
 await test('integration-foreign-or-ambiguous-card-rejected',async()=>{await integrationPage.setContent(cardHtml(controlledRows));await assert.rejects(readCoreIntegrationCardStatus(cards.filter({hasText:'Foreign identity'}),labels));await assert.rejects(readCoreIntegrationCardStatus(cards,labels));});
 await test('integration-duplicate-status-options-rejected',async()=>{await integrationPage.setContent(cardHtml([controlledRows[0]]));await assert.rejects(readCoreIntegrationCardStatus(cards,[...labels,labels[0]]));});
}finally{await integrationBrowser.close();}

const nativePath='scripts/verify-admin-core-readonly-hubs-isolated.mts',nativeSource=readFileSync(nativePath,'utf8');
const compiled=ts.transpileModule(nativeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const db=new PGlite();let statements=[],opened=0,closed=0,owned=0,fault=null;
const handle={identity:{runId:'controlled-owned'},withDatabaseConnection:async callback=>{opened++;try{return await callback({query:async(sql,args)=>{statements.push(sql);if(fault==='query'&&sql.startsWith('select jsonb'))throw Error('controlled query error');const result=await db.query(sql,args);if(fault==='wrong-db'&&sql.startsWith('select current_database()'))result.rows[0].database='foreign';return result;}});}finally{closed++;}}};
const loaded={exports:{}};
new Function('require','module','exports',compiled)(name=>{
 if(name==='./lib/isolated-supabase.mts')return {assertOwnedLocalHandle:value=>{assert.equal(value,handle);owned++;if(fault==='expired-before'||(fault==='expired-after'&&owned===2))throw Error('expired owned handle');}};
 if(name==='./verify-admin-core-form-permission-isolated.mts')return{readCoreFormPermissionFingerprint:async(h,input)=>{assert.equal(h,handle);assert.deepEqual(Object.keys(input).sort(),['correlationId','id','kind','phase']);assert.equal(input.id,input.correlationId);assert.equal(input.kind,'form-permission-fingerprint');assert.equal(input.phase,'after');return{publicDataSha256:'a'.repeat(64),publicTableInventorySha256:'b'.repeat(64)};}};
 assert.equal(name,'node:assert/strict');return require(name);
},loaded,loaded.exports);
const call=loaded.exports.readCoreReadonlyHubCheckpoint;
const request=(entity,fields={})=>({id:randomUUID(),kind:'readonly-hub-state',entity,...fields});
function reset(){statements=[];opened=closed=owned=0;fault=null;}
try{
 await db.exec(`create table public.projects(id bigint primary key,arabic_name text,type text);
 create table public.project_tracking_stages(id bigint primary key,project_id bigint);
 create table public.project_tracking_items(id bigint primary key,stage_id bigint);
 create table public.project_tracking_updates(id bigint primary key,item_id bigint);
 create table public.analytics_provider_read_models(period_key text,compare_key text);
 create function public.admin_dashboard_truth_v1() returns jsonb language sql as $$select '{"recentTopics":[{"id":41,"title":"Current one","status":"published","privateField":"not exported"},{"id":40,"title":"Current two","status":"unpublished"}]}'::jsonb$$;
 insert into projects values(1,'Owned A','residential'),(2,'Owned B','commercial'),(3,'Owned C','residential');
 insert into project_tracking_stages values(10,1),(11,1),(12,2);
 insert into project_tracking_items values(20,10),(21,11),(22,12);
 insert into project_tracking_updates values(30,20),(31,20),(32,21),(33,22);
 insert into analytics_provider_read_models values('last_30_days','none'),('last_30_days','previous_period');`);
 for(const [entity,fields,expected] of [
 ['projects',{}, {residential:2,commercial:1}],
 ['tracking',{projectId:1},{id:1,title:'Owned A',stageCount:2,updateCount:3}],
 ['dashboard',{},[{id:41,title:'Current one',status:'published'},{id:40,title:'Current two',status:'unpublished'}]],
 ['analytics',{period:'last_90_days',compare:'previous_period'},{period:'last_90_days',compare:'previous_period',storedReadModelCount:0}],
 ['analytics',{period:'last_30_days',compare:'none'},{period:'last_30_days',compare:'none',storedReadModelCount:1}],
 ]) await test('actual-projection-'+entity+'-'+JSON.stringify(fields),async()=>{reset();const input=request(entity,fields),result=await call(handle,input);assert.equal(result.id,input.id);assert.deepEqual(result.value,expected);assert.equal(owned,2);assert.equal(opened,1);assert.equal(closed,1);assert.equal(statements[0],'begin isolation level repeatable read read only');assert.equal(statements.at(-1),'commit');});
 await test('integration-query-delegates-only-fixed-hash-fingerprint',async()=>{reset();const input=request('integration-search'),result=await call(handle,input);assert.deepEqual(result.value,{publicDataSha256:'a'.repeat(64),publicTableInventorySha256:'b'.repeat(64)});assert.equal(result.id,input.id);assert.equal(opened,0);});
 for(const [name,input] of [
 ['null',null],['array',[]],['bad-id',request('projects',{id:'no'})],['coerced-id',request('projects',{id:{toString:()=>randomUUID()}})],
 ['integration-extra-selector',request('integration-search',{table:'vault.secrets'})],['unknown-kind',request('projects',{kind:'other'})],['unknown-entity',request('admin_users')],['coerced-entity',request({toString:()=> 'projects'})],
 ['sql',request('projects',{sql:'select secret'})],['bad-project',request('tracking',{projectId:0})],['string-project',request('tracking',{projectId:'1'})],
 ['unsafe-project',request('tracking',{projectId:9007199254740992})],['missing-project',request('tracking')],
 ['bad-period',request('analytics',{period:'all',compare:'none'})],['coerced-period',request('analytics',{period:{toString:()=> 'last_30_days'},compare:'none'})],
 ['bad-compare',request('analytics',{period:'last_30_days',compare:'all'})],['coerced-compare',request('analytics',{period:'last_30_days',compare:{toString:()=> 'none'}})],
 ['extra-key',request('analytics',{period:'last_30_days',compare:'none',schema:'auth'})]
 ]) await test('fixed-request-rejects-'+name,async()=>{reset();await assert.rejects(call(handle,input));assert.equal(opened,0);assert.equal(statements.length,0);});
 for(const name of ['query','wrong-db','expired-before','expired-after']) await test('scope-failure-'+name,async()=>{reset();fault=name;await assert.rejects(call(handle,request('projects')));assert.equal(opened,closed);if(name==='query'||name==='wrong-db')assert.equal(statements.at(-1),'rollback');if(name==='expired-before')assert.equal(opened,0);if(name==='expired-after')assert.equal(statements.at(-1),'commit');});
 await test('missing-project-fails-and-rolls-back',async()=>{reset();await assert.rejects(call(handle,request('tracking',{projectId:999})));assert.equal(statements.at(-1),'rollback');assert.equal(opened,closed);});
 await test('actual-readonly-transaction-rejects-write',async()=>{await db.exec('begin isolation level repeatable read read only');try{await assert.rejects(db.query("insert into projects values(999,'must not persist','residential')"),e=>e.code==='25006');}finally{await db.exec('rollback');}assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,3);});
 const sources=[nativePath,'scripts/fixtures/admin-core-readonly-hubs-journeys.mjs'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
 const result={status:'pass',cases:checks.length,checks,plan,sources,boundary:'Canonical current manifests plus actual helper control flow and SQL executed in disposable PGlite. Ownership port is controlled; installed full-Supabase/native Browser proof remains pending. Dashboard truth function returns a test projection; no claim of its full production RPC behavior.'};
 console.log(JSON.stringify({status:result.status,cases:checks.length,hubs:plan.selected.length,reports:plan.reports.length,integrations:plan.integrations.length,checks,sources,boundary:result.boundary},null,2));
}finally{await db.close();}
