import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {chromium,expect} from 'playwright/test';

/** Actual readonly consumers, controller, Query provider and EntityList; only the
 * loopback GET transport and uncalled Server Action boundary are controlled. */
const root=process.cwd(),output=path.resolve(root,process.env.QA_READONLY_OUTPUT??'.tmp-qa/admin-readonly-query-adoption'),require=createRequire(import.meta.url);
await mkdir(output,{recursive:true});
const specs=[
 {entity:'activity_log',route:'/admin/activity-log',file:'src/app/admin/activity-log/ActivityLogClient.tsx',search:'بحث في المستخدم أو الكيان...'},
 {entity:'topics_without_image',route:'/admin/reports/topics-without-image',file:'src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx',search:'بحث بالعنوان أو slug'},
];
const ts=require('typescript');
const sourceHashes={},overrides={},aliases={};
function serverActionBoundaryLoader(original){
 const source=overrides[this.resourcePath]??original;
 if(!/^\s*["']use server["']/u.test(source))return source;
 const ast=ts.createSourceFile(this.resourcePath,source,ts.ScriptTarget.Latest,true),exports=[];
 for(const statement of ast.statements){if(!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;if(ts.isFunctionDeclaration(statement)&&statement.name)exports.push(statement.name.text);else if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name))exports.push(declaration.name.text);}
 if(!exports.length)throw Error('Unsupported Server Action test boundary');
 return exports.map(name=>'export async function '+name+'(){throw Error('+JSON.stringify('Unexpected Server Action boundary')+')}').join(';');
}
for(const spec of specs){
 const full=path.join(root,spec.file),source=readFileSync(full,'utf8');sourceHashes[spec.file]=createHash('sha256').update(source).digest('hex');overrides[full]=source;aliases['@consumer-'+spec.entity]=full;
 for(const omission of ['error','retry']){
  const pattern=omission==='error'?/\s*queryError=\{controller\.error\?\.message\}/gu:/\s*onQueryRetry=\{\(\) => \{ void controller\.retry\(\); \}\}/gu;
  assert.equal([...source.matchAll(pattern)].length,1,'Exactly one actual consumer adoption binding is required: '+spec.entity+'/'+omission);
  const mutant=source.replace(pattern,'').replace(/(from\s+["'])(\.[^"']+)(["'])/gu,(_whole,start,relative,end)=>start+path.resolve(path.dirname(full),relative).replaceAll('\\','/')+end);
  const file=path.join(output,spec.entity+'-omit-'+omission+'.tsx');await writeFile(file,mutant);aliases['@consumer-'+spec.entity+'-omit-'+omission]=file;
 }
}
const entry=String.raw`
import React,{useLayoutEffect} from 'react';import{createRoot}from'react-dom/client';import{useQueryClient}from'@tanstack/react-query';
import Provider from '@query-provider';import Feedback from '@feedback';import{normalizeAdminEntityListQuery}from'@contracts';
import{activityLogQueryContract}from'@activity-contract';import{topicsWithoutImageQueryContract}from'@report-contract';
import Activity from '@consumer-activity_log';import ActivityNoError from '@consumer-activity_log-omit-error';import ActivityNoRetry from '@consumer-activity_log-omit-retry';
import Report from '@consumer-topics_without_image';import ReportNoError from '@consumer-topics_without_image-omit-error';import ReportNoRetry from '@consumer-topics_without_image-omit-retry';
const options=window.__OPTIONS__,contracts={activity_log:activityLogQueryContract,topics_without_image:topicsWithoutImageQueryContract};
const components={activity_log:{normal:Activity,error:ActivityNoError,retry:ActivityNoRetry},topics_without_image:{normal:Report,error:ReportNoError,retry:ReportNoRetry}};
const initialQuery=normalizeAdminEntityListQuery(contracts[options.entity],new URLSearchParams('q=seed'));
function Harness(){const client=useQueryClient();useLayoutEffect(()=>{window.__cache=()=>client.getQueryCache().getAll().map(query=>({key:query.queryKey,state:{status:query.state.status,fetchStatus:query.state.fetchStatus,error:query.state.error?.message??null,data:query.state.data}}));});const Consumer=components[options.entity][options.mode];return <main dir='rtl'><Consumer initialQuery={initialQuery} initialResult={window.__INITIAL__} initialVisibleColumns={null} actionOptions={[]} actorOptions={[]} entityTypeOptions={[]}/></main>;}
createRoot(document.getElementById('root')).render(<Provider><Feedback><Harness/></Feedback></Provider>);
`;
const entryPath=path.join(output,'entry.jsx'),navigationPath=path.join(output,'navigation.js'),linkPath=path.join(output,'link.jsx'),overridePath=path.join(output,'source-loader.cjs');
await Promise.all([
 writeFile(entryPath,entry),
 writeFile(navigationPath,"export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){throw Error('Unexpected RSC navigation')},replace(){throw Error('Unexpected RSC replacement')},refresh(){throw Error('Unexpected RSC refresh')}});"),
 writeFile(linkPath,"import React from 'react';export default function Link({href,children,prefetch,scroll,onNavigate,...props}){return <a href={href} {...props}>{children}</a>}"),
 writeFile(overridePath,'const ts=require("typescript"),overrides='+JSON.stringify(overrides)+';module.exports='+serverActionBoundaryLoader.toString()+';'),
]);
const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss'),posix=value=>value.replaceAll('\\','/');
const css=(await postcss([tailwind()]).process('@import "tailwindcss" source(none);\n@source "'+posix(path.join(root,'src/components/admin'))+'";\n@source "'+posix(path.join(root,'src/app/admin/activity-log'))+'";\n@source "'+posix(path.join(root,'src/app/admin/reports/topics-without-image'))+'";\n',{from:path.join(root,'src/app/globals.css')})).css;
await require('next/dist/build/swc').loadBindings();const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const compiler=webpack({mode:'development',target:'web',context:root,entry:entryPath,output:{path:output,filename:'bundle.js'},devtool:false,optimization:{minimize:false},plugins:[new webpack.DefinePlugin({'process.env':JSON.stringify({})})],resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{...aliases,'next/navigation':navigationPath,'next/link':linkPath,'@query-provider':path.join(root,'src/components/admin/entity-list/AdminEntityListQueryProvider.tsx'),'@feedback':path.join(root,'src/components/admin/AdminFeedbackProvider.tsx'),'@contracts':path.join(root,'src/lib/admin/entity-list/data-engine/contracts.ts'),'@activity-contract':path.join(root,'src/lib/admin/audit/entity-list-contract.ts'),'@report-contract':path.join(root,'src/lib/admin/media-catalog/topics-without-image-entity-list-contract.ts')}},module:{rules:[{test:/\.[jt]sx?$/u,exclude:/node_modules/u,use:[{loader:require.resolve('next/dist/build/webpack/loaders/next-swc-loader'),options:{rootDir:root,isServer:false,compilerType:'client',hasReactRefresh:false,nextConfig:{},jsConfig:{},swcCacheDir:path.join(output,'swc-cache'),serverComponents:false,serverReferenceHashSalt:'readonly-query-adoption',esm:false,transpilePackages:[]}},overridePath]}]}});
await new Promise((done,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>{if(error||closeError||stats?.hasErrors())reject(error||closeError||new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors)));else done();})));
const bundle=await readFile(path.join(output,'bundle.js')),requests=[],observations=[],errors=[],foreign=[],checks=[];let mode='normal',entity=specs[0].entity,transport='success',held;
function result(key,q){const id=q==='second'?22:11,label=q==='second'?'Second retained row':'Initial seed row';return{rows:[key==='activity_log'?{id,actor_admin_user_id:7,actor_username:'readonly_fixture',action:'topic.update',entity_type:'topic',entity_id:id,entity_label:label,metadata:{fixture:true},ip_address:null,user_agent:null,created_at:'2026-01-03T12:00:00Z'}:{id,title:label,slug:'readonly-'+id,status:'unpublished',contentType:'article',categorySlug:'fixture',updatedAt:'2026-01-03T12:00:00Z',deletedAt:null}],pagination:{page:1,pageSize:10,totalRows:1,totalPages:1},meta:{generatedAt:new Date().toISOString(),mode:'server-page'}};}
const server=createServer((req,res)=>{const url=new URL(req.url,'http://fixture');if(req.method!=='GET'){errors.push('Unexpected non-GET '+req.method);res.writeHead(405);res.end();return;}
 if(url.pathname==='/bundle.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(bundle);return;}
 if(url.pathname==='/styles.css'){res.writeHead(200,{'content-type':'text/css; charset=utf-8'});res.end(css);return;}
 if(url.pathname.startsWith('/api/admin/entity-lists/')){const key=url.pathname.split('/').at(-1),q=url.searchParams.get('q');requests.push({entity:key,q,method:req.method});const send=()=>{res.writeHead(200,{'content-type':'application/json','cache-control':'private, no-store'});res.end(JSON.stringify(result(key,q)));};if(q==='failed-query'&&transport==='fail'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'fixture_read_failure'}}));}else if(q==='failed-query'&&transport==='hold'){assert.equal(held,undefined);held=send;}else send();return;}
 if(specs.some(spec=>spec.route===url.pathname)){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<html><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script>window.__OPTIONS__='+JSON.stringify({entity,mode})+';window.__INITIAL__='+JSON.stringify(result(entity,'seed'))+'</script><script src="/bundle.js"></script></body></html>');return;}res.writeHead(404);res.end();});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
const test=async(name,body)=>{await body();checks.push({name,status:'pass'});};
try{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){foreign.push('foreign-origin-denied');return route.abort();}return route.continue();});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const state=()=>page.evaluate(()=>({rows:[...document.querySelectorAll('[data-entity-row-id]')].map(row=>Number(row.getAttribute('data-entity-row-id'))),footer:document.querySelector('[data-admin-table-pagination]')?.textContent??'',notice:document.querySelector('[data-admin-entity-list-query-error]')?.textContent??'',pending:document.querySelector('[data-admin-entity-list-pending]')?.getAttribute('data-admin-entity-list-pending'),toasts:document.querySelectorAll('[data-admin-feedback-entry]').length,confirmation:document.querySelectorAll('[data-admin-confirm-dialog-root],[data-admin-confirm-dialog],[data-admin-confirm-submit]').length,cache:window.__cache?.()}));
 for(const spec of specs){entity=spec.entity;for(const variant of ['normal','error','retry']){mode=variant;transport='success';held=undefined;requests.length=0;await page.goto(origin+spec.route+'?q=seed');const search=page.getByPlaceholder(spec.search,{exact:true});await expect(search).toBeVisible();await expect(page.locator('[data-entity-row-id="11"]')).toBeVisible();
 await test(entity+'/'+mode+': initial hydrated read does not refetch',async()=>{await page.waitForFunction(()=>window.__cache?.().some(query=>query.state.status==='success'));assert.equal(requests.length,0);});
 const positive=page.waitForResponse(response=>new URL(response.url()).searchParams.get('q')==='second');await search.fill('second');assert.equal((await positive).status(),200);await expect(page.locator('[data-entity-row-id="22"]')).toBeVisible();const before=await state();
 transport='fail';await search.fill('failed-query');await expect.poll(()=>requests.filter(row=>row.q==='failed-query').length).toBe(3);await page.waitForFunction(()=>window.__cache().some(query=>query.state.status==='error'&&query.state.fetchStatus==='idle'));const failed=await state();observations.push({entity,mode,phase:'failed',...failed});
 await test(entity+'/'+mode+': failed new key retains last successful rows/counters',()=>{assert.deepEqual(failed.rows,[22]);assert.equal(failed.footer,before.footer);assert.equal(failed.pending,'false');assert.equal(failed.toasts,0);assert.equal(before.confirmation,0);assert.equal(failed.confirmation,0);});
 if(mode==='error'){await test(entity+': omitted queryError negative suppresses required warning and retry',async()=>{await expect(page.locator('[data-admin-entity-list-query-error]')).toHaveCount(0);});continue;}
 const notice=page.locator('[data-admin-entity-list-query-error]');await expect(notice).toBeVisible();await expect(notice).toContainText('الصفوف والعدّادات المعروضة تخص النتائج السابقة');
 if(mode==='retry'){await test(entity+': omitted onQueryRetry negative leaves warning without executable recovery',async()=>{await expect(notice.getByRole('button',{name:'إعادة المحاولة',exact:true})).toHaveCount(0);});continue;}
 const previousCalls=requests.length;transport='hold';await notice.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await expect.poll(()=>Boolean(held)).toBe(true);await expect.poll(()=>requests.length).toBe(previousCalls+1);const pending=await state();await test(entity+': explicit retry uses identical failed query with one GET and retained rows',()=>{assert.equal(pending.confirmation,0);assert.deepEqual(pending.rows,[22]);assert.equal(pending.footer,before.footer);assert.deepEqual(requests.at(-1),{entity,q:'failed-query',method:'GET'});});
 transport='success';held();held=undefined;await expect(notice).toHaveCount(0);await expect(page.locator('[data-entity-row-id="11"]')).toBeVisible();await test(entity+': recovery clears terminal cache error without a duplicate danger toast',async()=>{const recovered=await state();assert.equal(recovered.toasts,0);assert.equal(recovered.confirmation,0);assert.equal(recovered.cache.filter(query=>query.state.error!==null).length,0);assert.equal(requests.length,previousCalls+1);});
 const beforeCache=requests.length;await search.fill('second');await expect(page.locator('[data-entity-row-id="22"]')).toBeVisible();await search.fill('failed-query');await expect(page.locator('[data-entity-row-id="11"]')).toBeVisible();await test(entity+': resolved same-key cache reuse needs no extra GET',()=>assert.equal(requests.length,beforeCache));
 }}await test('No external requests, unexpected mutation boundary or browser errors',()=>{assert.deepEqual(foreign,[]);assert.deepEqual(errors,[]);});
}finally{if(held){held();held=undefined;}await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));await writeFile(path.join(output,'evidence.json'),JSON.stringify({status:checks.length===23?'pass':'incomplete',checks:checks.length,cases:checks,sourceHashes,observations,requests,errors,foreign,boundary:'Actual two readonly consumers + shared runtime mounted with controlled GET transport, not authenticated app/native/Production proof.',globalClosed:false},null,2)+'\n');}
assert.equal(checks.length,23);console.log(JSON.stringify({status:'pass',checks:checks.length,output,sourceHashes,globalClosed:false}));
