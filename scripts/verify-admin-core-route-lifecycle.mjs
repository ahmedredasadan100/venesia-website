import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {registerCorePageRoute} from './fixtures/admin-core-form-permission-context.mjs';
import {chromium} from 'playwright';
const stage='.tmp-qa/core-route-lifecycle';mkdirSync(stage,{recursive:true});
const source=readFileSync('scripts/fixtures/admin-core-template-library-journeys.mjs','utf8');
const command=source.slice(source.indexOf('  async function heldCommand('),source.indexOf('  async function statusFilter('));
const guardSource=readFileSync('scripts/qa-admin-adoption-journeys.mjs','utf8');
const guard=guardSource.slice(guardSource.indexOf('const ownedNetworkOnly ='),guardSource.indexOf('await observe("owned-network-guard"'));
const errors=[],checks=[];process.on('unhandledRejection',error=>errors.push({name:error.name,message:error.message}));
let writes=0,foreignHits=0;
const foreign=createServer((req,res)=>{foreignHits++;res.end('must not arrive');});
const server=createServer((req,res)=>{if(req.method==='POST'){writes++;res.setHeader('content-type','text/plain');res.end('ok');}else if(req.url?.startsWith('/pulse'))res.end('pulse');else{res.setHeader('content-type','text/html');res.end('<button id="go">Go</button><script>document.querySelector("button").onclick=async()=>{await fetch(location.pathname,{method:"POST",headers:{"next-action":"owned-probe"}});for(let i=0;i<16;i++)fetch("/pulse?i="+i).catch(()=>{});};</script>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));await new Promise(resolve=>foreign.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,foreignOrigin='http://127.0.0.1:'+foreign.address().port;let browser;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();
 const allowedStorage=[],expectedBlockedRequests=[],externalRequests=[],expectedLogoutDestination=null,coreClosure=true,activeCase='probe';
 const ownedNetworkOnly=new Function('origin','allowedStorage','expectedBlockedRequests','externalRequests','expectedLogoutDestination','coreClosure','activeCase',guard+';return ownedNetworkOnly;')(origin,allowedStorage,expectedBlockedRequests,externalRequests,expectedLogoutDestination,coreClosure,activeCase);
 await context.route('**/*',ownedNetworkOnly);
 const isAction=request=>request.method()==='POST'&&request.headers()['next-action']&&new URL(request.url()).origin===origin;
 const actionResponse=()=>page.waitForResponse(response=>isAction(response.request()),{timeout:5000});
 const assertActionAcknowledged=response=>assert.equal(response.status(),200);
 const heldCommand=new Function('page','origin','isAction','actionResponse','assertActionAcknowledged','assert','registerCorePageRoute',command+';return heldCommand;')(page,origin,isAction,actionResponse,assertActionAcknowledged,assert,registerCorePageRoute);
 await page.goto(origin+'/action');
 for(let i=0;i<80;i++){
  const previous=writes;
  await heldCommand(()=>page.locator('#go').click(),async()=>{assert.equal(writes,previous);await page.evaluate(()=>Promise.all(Array.from({length:12},(_,j)=>fetch('/pulse?during='+j))));});
  assert.equal(writes,previous+1);await page.reload({waitUntil:'domcontentloaded'});assert.deepEqual(errors,[]);
 }
 checks.push('80 exact current held commands: request held, exactly one write each, concurrent GET bursts and reloads, zero route ownership errors');
 const peer=await context.newPage();await peer.goto(origin+'/action');let peerStatus;
 const previous=writes;
 await heldCommand(()=>page.locator('#go').click(),async()=>{
  peerStatus=await peer.evaluate(()=>fetch(location.pathname,{method:'POST',headers:{'next-action':'peer'}}).then(r=>r.status));
  assert.equal(peerStatus,200);assert.equal(writes,previous+1);
  const foreignResult=await page.evaluate(url=>fetch(url).then(()=>false,()=>true),foreignOrigin+'/denied');assert.equal(foreignResult,true);assert.equal(foreignHits,0);
 });assert.equal(writes,previous+2);await peer.close();
 checks.push('Same-path Action from a different page is not captured; target page remains held; foreign loopback denied during hold with zero foreign deliveries');
 let sentinel=0;const marker=async route=>{sentinel++;await route.fallback();};await context.route(origin+'/sentinel',marker);
 await heldCommand(()=>page.locator('#go').click(),async()=>{});
 assert.equal(await page.evaluate(()=>fetch('/sentinel').then(r=>r.status)),200);assert.equal(sentinel,1);await context.unroute(origin+'/sentinel',marker);
 checks.push('Removing the temporary handler preserves unrelated context handlers and the persistent guard');
 const expected=new Error('controlled pending-proof rejection');
 const failedProofResponse=actionResponse();
 await assert.rejects(heldCommand(()=>page.locator('#go').click(),async()=>{throw expected;}),error=>error===expected);
 assertActionAcknowledged(await failedProofResponse);
 await heldCommand(()=>page.locator('#go').click(),async()=>{});
 assert.equal(await page.evaluate(url=>fetch(url).then(()=>false,()=>true),foreignOrigin+'/after-cleanup'),true);assert.equal(foreignHits,0);
 checks.push('Pending assertion failure propagates unchanged, gate/temporary route cleanup completes, next command works, foreign denial remains');

 {
  let release,saw;const gate=new Promise(r=>release=r),held=new Promise(r=>saw=r);let callbacks=0;
  const remove=await registerCorePageRoute(page,origin+'/hold',async r=>{callbacks++;saw();await gate;await r.fallback();});
  const fetching=page.evaluate(()=>fetch('/hold').then(r=>r.status));await held;let removed=false;const removal=remove().then(()=>removed=true);assert.equal(remove(),remove());await page.evaluate(()=>Promise.resolve());assert.equal(removed,false);release();await removal;assert.equal(await fetching,200);assert.equal(callbacks,1);assert.equal(await page.evaluate(()=>fetch('/hold').then(r=>r.status)),200);assert.equal(callbacks,1);
  checks.push('Removal drains its active held callback, is idempotent, and preserves the persistent guard');
  const failure=new Error('controlled-handler-failure');let failedSeen;const seen=new Promise(r=>failedSeen=r);
  const removeFail=await registerCorePageRoute(page,origin+'/fail',async r=>{await r.abort('failed');failedSeen();throw failure;});
  assert.equal(await page.evaluate(()=>fetch('/fail').then(()=>false,()=>true)),true);await seen;await assert.rejects(removeFail(),e=>e===failure);await page.evaluate(()=>Promise.resolve());
  assert.equal(errors.length,1);assert.equal(errors[0].message,'controlled-handler-failure');errors.length=0;
  checks.push('Actual callback error reaches Playwright and removal unchanged; unexpected errors remain fatal to this verifier');
  await assert.rejects(registerCorePageRoute(page,'**/*',null),{code:'ERR_ASSERTION'});checks.push('Invalid callback is rejected before registration');
  let bound,cleaned=0,used=0,fallbacks=0;const portContext={route:async(_url,fn)=>bound=fn,unroute:async()=>{cleaned++;}},portPage={context:()=>portContext};
  const removePort=await registerCorePageRoute(portPage,'**/*',async()=>{used++;});
  await bound({request:()=>({serviceWorker:()=>({}),frame:()=>{throw Error('must not inspect SW frame');}}),fallback:async()=>{fallbacks++;}});
  await bound({request:()=>({serviceWorker:()=>null,frame:()=>({page:()=>({})})}),fallback:async()=>{fallbacks++;}});
  assert.equal(used,0);assert.equal(fallbacks,2);await removePort();assert.equal(cleaned,1);checks.push('Service-worker and other-page ports fall through without invoking the temporary handler');
 }
 await context.unrouteAll({behavior:'wait'});await context.close();assert.deepEqual(errors,[]);
 const result={status:'pass',checks,installedPlaywright:JSON.parse(readFileSync('node_modules/playwright-core/package.json')).version,writes,foreignHits,externalDenied:externalRequests.length,unhandledErrors:errors,scope:'Actual installed Chromium and exact source-extracted heldCommand/ownedNetworkOnly; local disposable HTTP servers only, no application DB or Product execution.'};
 writeFileSync(stage+'/controls.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>foreign.close(resolve));}
