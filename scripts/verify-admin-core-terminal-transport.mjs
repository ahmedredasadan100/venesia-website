import { verifyAdminEntityTrashFeedback } from './fixtures/admin-entity-trash-feedback-controls.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {registerCorePageRoute} from './fixtures/admin-core-form-permission-context.mjs';
const source=readFileSync('scripts/fixtures/admin-core-domain-terminal-journeys.mjs','utf8');
const command=source.slice(source.indexOf('  async function heldCommand('),source.indexOf('  async function rowCommand('));
assert.ok(command.startsWith('  async function heldCommand('));
const errors=[],checks=[];process.on('unhandledRejection',error=>errors.push(error.message));let writes=0;
const server=createServer((req,res)=>{if(req.method==='POST'){writes++;res.end('ack');}else{res.setHeader('content-type','text/html');res.end('<button id="go">Delete</button><output id="state"></output><script>document.querySelector("button").onclick=async function(){this.disabled=true;try{await fetch(location.pathname,{method:"POST",headers:{"next-action":"actual-control"}});document.querySelector("output").textContent="ack";}catch{document.querySelector("output").textContent="rejected";}finally{this.disabled=false;}};</script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
 const pathname=()=>new URL(page.url()).pathname;
 const isAction=request=>request.method()==='POST'&&Boolean(request.headers()['next-action'])&&new URL(request.url()).origin===origin;
 const actionResponse=()=>page.waitForResponse(r=>isAction(r.request()),{timeout:5000});
 const assertActionAcknowledged=r=>assert.equal(r.status(),200);
 const held=new Function('page','origin','pathname','actionResponse','assertActionAcknowledged','registerCorePageRoute','assert',command+';return heldCommand;')(page,origin,pathname,actionResponse,assertActionAcknowledged,registerCorePageRoute,assert);
 await page.goto(origin+'/admin/users-roles');
 for(let i=0;i<3;i++){
  const before=writes;
  await held(()=>page.locator('#go').click(),async()=>{assert.equal(writes,before);assert.equal(await page.locator('#go').isDisabled(),true);await page.locator('#go').evaluate(n=>n.click());},{rejectBeforeDelivery:true});
  assert.equal(writes,before);await page.waitForFunction(()=>document.querySelector('output').textContent==='rejected');assert.equal(await page.locator('#go').isEnabled(),true);
  checks.push('exact cancelled transport sends no server write and releases UI '+i);
  await held(()=>page.locator('#go').click(),async()=>{assert.equal(writes,before);});
  assert.equal(writes,before+1);await page.waitForFunction(()=>document.querySelector('output').textContent==='ack');
  checks.push('explicit subsequent retry sends exactly one write '+i);
 }
 const before=writes;
 const ack=actionResponse();await assert.rejects(held(()=>page.locator('#go').click(),async()=>{throw Error('required-pending-proof-failed');}),/required-pending-proof-failed/);assertActionAcknowledged(await ack);assert.equal(writes,before+1);checks.push('pending assertion failure propagates and releases the held request');
 await page.waitForFunction(()=>!document.querySelector('button').disabled);
 const peer=await context.newPage();await peer.goto(origin+'/admin/users-roles');const peerBefore=writes;
 await held(()=>page.locator('#go').click(),async()=>{assert.equal(await peer.evaluate(()=>fetch(location.pathname,{method:'POST',headers:{'next-action':'peer'}}).then(r=>r.status)),200);assert.equal(writes,peerBefore+1);},{rejectBeforeDelivery:true});assert.equal(writes,peerBefore+1);await peer.close();checks.push('same-path peer request is not aborted by page-specific rejected intent');
 await context.unrouteAll({behavior:'wait'});await context.close();assert.deepEqual(errors,[]);
 const result={status:'pass',checks,writes,unhandledErrors:errors,boundary:'Exact held transport helper with installed Chromium and owned loopback HTTP. Application delete/native/permission still require isolated cohort.'};mkdirSync('.tmp-qa/core-terminal-transport',{recursive:true});writeFileSync('.tmp-qa/core-terminal-transport/controls.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}

const trashFeedback = await verifyAdminEntityTrashFeedback();
console.log(JSON.stringify({ terminalTrashFeedback: trashFeedback }));
