import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {AsyncLocalStorage} from "node:async_hooks";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import {chromium} from "playwright";
import {createSharedAtomicActionHarness} from "./fixtures/shared-atomic-action-harness.mjs";
// The standalone HTTP harness initializes the same Node primitive Next boots.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const root=process.cwd(),out=path.join(root,".tmp-qa/shared-corrections-adoption/atomic/browser");await mkdir(out,{recursive:true});
const resume=process.env.SHARED_ATOMIC_BROWSER_RESUME?JSON.parse(await readFile(process.env.SHARED_ATOMIC_BROWSER_RESUME,"utf8")):null;
const dbUrl=new URL(process.env.SHARED_ATOMIC_DATABASE_URL);assert.equal(dbUrl.hostname,"127.0.0.1");assert.equal(dbUrl.pathname,"/shared_atomic_test");assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:55436");
const db=new pg.Client({connectionString:dbUrl.toString(),application_name:"shared-atomic-mounted-proof"});await db.connect();
const identity=(await db.query("select current_database() database,current_user as role,version() version")).rows[0];assert.equal(identity.database,"shared_atomic_test");assert.equal(identity.role,"supabase_admin");
await writeFile(path.join(out,"before-write-isolation.json"),JSON.stringify({identity,target:"127.0.0.1:55435",originalEnvironmentLoaded:false},null,2));
const originalFetch=globalThis.fetch;globalThis.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input.url??String(input));assert.equal(url.origin,"http://127.0.0.1:55436","Server request blocked before external network");url.pathname=url.pathname.replace(/^\/rest\/v1(?=\/|$)/,"");return originalFetch(url,init);};
const {actions,state}=await createSharedAtomicActionHarness(path.join(out,"action-harness"));
const passwordHash=await actions.hashPassword(process.env.SHARED_ATOMIC_PASSWORD);
await db.query("insert into admin_users(id,email,username,password_hash,role) values(9001,'atomic@example.test','atomic-admin',$1,'admin') on conflict(id) do update set password_hash=excluded.password_hash,is_active=true",[passwordHash]);
if(!resume)await db.query(`insert into pages(id,title,slug,path,status) values(850,'Mounted A','mounted-a','/mounted-a','unpublished'),(851,'Mounted B','mounted-b','/mounted-b','unpublished'),(852,'Protected path','mounted-protected','//','unpublished');
create sequence qa_mounted_delete_attempt;
create function qa_mounted_delete_failure() returns trigger language plpgsql as $$ begin if old.id=850 then perform nextval('public.qa_mounted_delete_attempt');end if;if old.id=851 then raise exception 'qa_mounted_later_failure';end if;return old;end;$$;
create trigger qa_mounted_delete_failure before delete on pages for each row execute function qa_mounted_delete_failure();`);
const entry=String.raw`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import{useAdminBoundedClientInstantMutation}from'@src/lib/admin/entity-list/data-engine/instant-mutation';import AdminFeedbackProvider from'@src/components/admin/AdminFeedbackProvider';import{BlockEditorSaveFeedback}from'@src/components/admin/page-blocks/BlockEditorContextHeader';
const root=createRoot(document.getElementById('root'));const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});const invalidate=client.invalidateQueries.bind(client);client.invalidateQueries=(...args)=>window.failRefetch?Promise.reject(new Error('isolated mounted refetch failure')):invalidate(...args);window.requests=0;window.rowHistory=[];
function Rows(){const data=useAdminBoundedClientInstantMutation({entity:'atomic-mounted',initialRows:window.sourceRows});const[result,setResult]=useState(null);React.useEffect(()=>{window.rowHistory.push(data.rows.map(x=>x.id))},[data.rows]);async function remove(){try{const result=await data.mutateAsync({bulk:true,action:'delete',optimistic:cache=>cache.removeRows(new Set([850,851,852])),execute:async()=>{window.requests++;return(await fetch('/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[851,850,852]})})).json()},reconcileSuccess:(result,{reconcileDeletedRows})=>reconcileDeletedRows(new Set(result.deletedIds))});setResult(result);}catch(error){setResult({ok:false,message:error.message})}}return <><button disabled={data.bulkInteraction.isPending} onClick={remove}>Delete batch</button><output id="rows">{data.rows.map(x=>x.id).join(',')}</output><output id="result">{JSON.stringify(result)}</output></>}
window.mount=async()=>{window.sourceRows=await(await fetch('/read')).json();root.render(<QueryClientProvider client={client}><Rows/></QueryClientProvider>)};
window.mountFeedback=href=>{history.replaceState({},'',href);root.render(<AdminFeedbackProvider><BlockEditorSaveFeedback saved backHref="/fixture" savedRevision="persisted-revision" entityKey="atomic-template"/></AdminFeedbackProvider>)};`;
await writeFile(path.join(out,"entry.tsx"),entry);
await writeFile(path.join(out,"navigation.ts"),`export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';const router={push(){},refresh(){},replace(href){history.replaceState({},'',href)}};export const useRouter=()=>router;export const usePathname=()=>'/fixture';export const useSearchParams=()=>new URLSearchParams(location.search);`);
await writeFile(path.join(out,"link.tsx"),`import React from'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}`);
await writeFile(path.join(out,"image.tsx"),`import React from'react';export default function Image({fill,priority,unoptimized,quality,loader,...props}){return <img {...props}/>} `);
await writeFile(path.join(out,"link-actions.ts"), "const blocked=async()=>{throw Error('Unrelated link picker not part of atomic proof')};export const browseAdminLinksAjax=blocked,browseMenusPickerAjax=blocked,browseMenuItemsPickerAjax=blocked,browseTopicCategoriesPickerAjax=blocked,resolveAdminLinkAjax=blocked;");
const require=createRequire(import.meta.url);await require("next/dist/build/swc").loadBindings();const webpack=require("next/dist/compiled/webpack/webpack").webpack;
const compiler=webpack({mode:"development",target:"web",context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"fixture.js"},devtool:false,
plugins:[new webpack.NormalModuleReplacementPlugin(/links[\\/]actions$/,resource=>{resource.request=path.join(out,"link-actions.ts")}),new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],resolve:{extensions:[".tsx",".ts",".jsx",".js"],alias:{"@src":path.join(root,"src"),"next/navigation":path.join(out,"navigation.ts"),"next/link":path.join(out,"link.tsx"),"next/image":path.join(out,"image.tsx")}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:[{loader:require.resolve("next/dist/build/webpack/loaders/next-swc-loader"),options:{rootDir:root,isServer:false,compilerType:"client",hasReactRefresh:false,nextConfig:{},jsConfig:{},swcCacheDir:path.join(out,"swc-cache"),serverComponents:false,serverReferenceHashSalt:"isolated-atomic-qa",esm:false,transpilePackages:[]}}]}]}});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>error||closeError||stats?.hasErrors()?reject(error??closeError??new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors))):resolve())));
const bundle=await readFile(path.join(out,"fixture.js"));let origin;const actionResults=[];
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString();
 if(req.url==='/login'){const response=await actions.handleAdminLoginRequest(new Request(origin+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body}));res.statusCode=response.status;const cookie=response.headers.get('set-cookie');if(cookie)res.setHeader('set-cookie',cookie);res.setHeader('content-type','application/json');res.end(await response.text());return;}
 state.cookie=(req.headers.cookie??'').match(/venesia_admin_session=([^;]+)/)?.[1]??'';
 if(req.url==='/read'){await actions.requireAdminSession();const{data,error}=await actions.getSupabaseAdmin().from('pages').select('id,title,slug,path').in('id',[850,851,852]).order('id');if(error)throw error;res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;}
 if(req.url==='/delete'){const result=await actions.deletePages(JSON.parse(body).ids);actionResults.push(result);res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;}
 if(req.url==='/fixture.js'){res.setHeader('content-type','application/javascript');res.end(bundle);return;}
 res.setHeader('content-type','text/html');res.end('<!doctype html><html><meta charset="utf-8"><style>body{font-family:Arial;padding:24px}button,output{display:block;margin:16px}</style><div id="root"></div><script src="/fixture.js"></script></html>');
 }catch(error){res.statusCode=500;res.end(JSON.stringify({error:String(error)}));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'}),blocked=[],errors=[],proof=resume?resume.proof.map(item=>({...item,reused:true})):[];
await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin||/\/api\/content\/topics\/.*views?/.test(url.pathname)){blocked.push({method:route.request().method(),url:url.origin+url.pathname});return route.abort('blockedbyclient')}return route.continue()});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(origin);await page.waitForFunction(()=>typeof window.mount==='function');
 await page.evaluate(()=>fetch('https://example.invalid/atomic-network-guard').catch(()=>null));assert.equal(blocked.length,1);
 const status=await page.evaluate(async password=>(await fetch('/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'atomic-admin',password})})).status,process.env.SHARED_ATOMIC_PASSWORD);assert.equal(status,200);
 await page.evaluate(()=>window.mount());await page.waitForFunction(()=>document.querySelector('#rows')?.textContent==='850,851,852');
 if(!resume){await page.getByRole('button',{name:'Delete batch'}).click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#result').textContent)?.ok===false);
 assert.equal(await page.locator('#rows').textContent(),'850,851,852');assert.equal((await db.query('select is_called from qa_mounted_delete_attempt')).rows[0].is_called,true);assert.equal((await db.query('select count(*)::int count from pages where id in(850,851,852)')).rows[0].count,3);
 proof.push({name:'mounted-real-action-db-rollback',ok:true,writeAttemptObserved:true,result:actionResults[0]});
 await db.query('drop trigger qa_mounted_delete_failure on pages');}state.cacheFailures=999;
 await page.evaluate(()=>{window.failRefetch=true;window.rowHistory=[]});await page.getByRole('button',{name:'Delete batch'}).click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#result').textContent)?.ok===true);
 const consumer=await page.locator('#result').textContent();assert.equal(JSON.parse(consumer).feedbackStatus,'warning');assert.match(consumer,/أعد تحديث القائمة/);assert.equal(await page.locator('#rows').textContent(),'852');
 assert.deepEqual((await db.query('select id::int from pages where id in(850,851,852) order by id')).rows.map(x=>x.id),[852]);const history=await page.evaluate(()=>window.rowHistory);assert.ok(!history.some(ids=>ids.includes(850)||ids.includes(851)));assert.equal(await page.evaluate(()=>window.requests),resume?1:2);
 proof.push({name:'committed-warning-no-false-snapshot-rollback',ok:true,consumer:JSON.parse(consumer),rowHistory:history,dbIds:[852],boundedCacheFailure:true,queryRefetchFailure:true});
 await page.screenshot({path:path.join(out,'committed-warning.png')});
 await page.evaluate(()=>window.mountFeedback('/fixture?saved=1&cache_warning=1&notice=saved_with_media_sync_warning'));
 await page.waitForFunction(()=>document.querySelectorAll('[data-admin-feedback-entry]').length===1);const message=await page.locator('[data-admin-feedback-entry]').textContent();assert.match(message,/الميديا/);assert.match(message,/الكاش/);await page.locator('[data-admin-feedback-entry] button').click();const params=new URL(page.url()).searchParams;for(const key of ['saved','notice','cache_warning'])assert.equal(params.has(key),false);
 proof.push({name:'one-save-warning-and-dismissal',ok:true,combinedMediaCacheWarning:true});assert.deepEqual(errors,[]);console.log('PASS mounted authenticated Action/PostgreSQL/consumer: '+proof.length+' cases');
}catch(error){console.error('BROWSER STATE',await page.evaluate(()=>({result:document.querySelector('#result')?.textContent,rows:document.querySelector('#rows')?.textContent,requests:window.requests,history:window.rowHistory})));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await writeFile(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),proof,blocked,errors,actionResults,limits:'Actual current Auth/session, Actions, Domain RPC, PostgreSQL, SDK reread and mounted Instant Mutation/Feedback owners. Next HTTP/headers/cache and Media side-service adapters isolated. The full Pages screen is tied by source adoption; this is the shared mutation consumer fixture, not a full-screen claim. No external service writes.',globalClosed:false},null,2));await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;await db.end();}
