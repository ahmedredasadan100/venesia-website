import assert from 'node:assert/strict';
import { createHmac,randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';
import { fillCorePrivateField } from './admin-core-specialized-settings-journeys.mjs';
import { registerCorePageRoute } from './admin-core-form-permission-context.mjs';
export function buildCoreAuthEntryPlan(manifest){const rows=manifest.filter(row=>row.id==='authentication-login');assert.equal(rows.length,1);assert.equal(rows[0].classification,'explicit_exception');assert.deepEqual(rows[0].surfaces,['admin-login','maintenance-login']);return {consumer:rows[0].id,surfaces:[{id:'admin-login',path:'/admin/login',endpoint:'/api/admin/auth/login'},{id:'maintenance-login',path:'/maintenance',endpoint:'/api/maintenance/login'}],automaticCoverage:[]};}
export function assertCoreAuthCookieMetadata(cookie,origin,ttl,before,after){assert.ok(cookie);assert.equal(cookie.name,'venesia_admin_session');assert.equal(cookie.domain,new URL(origin).hostname);assert.equal(cookie.path,'/');assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'Lax');assert.equal(cookie.secure,false);assert.ok(cookie.expires>=before+ttl-2&&cookie.expires<=after+ttl+2,'Only the current owner TTL is accepted.');}
export function coreAuthEntryBrowserOptions(surfaceId){assert.ok(['admin-login','maintenance-login'].includes(surfaceId));return surfaceId==='maintenance-login'?{serviceWorkers:'block'}:{};}
const DASHBOARD_ENTRY_STATES={ready:{label:'قراءة المصادر ناجحة',receipt:'Dashboard جاهزة'},partial:{label:'قراءة جزئية',receipt:'Dashboard جزئية'},unavailable:{label:'القراءة غير متاحة',receipt:'Dashboard غير متاحة'}};
// Measurement callers keep their two-snapshot endpoint and select an exact
// expected state from the same contract as authenticated entry journeys.
export function coreDashboardEntryReadinessCriteria(state){
 assert.ok(Object.hasOwn(DASHBOARD_ENTRY_STATES,state),'Dashboard readiness must use a current source-reading state.');const expected=DASHBOARD_ENTRY_STATES[state];
 const summary='main [data-dashboard-readiness-summary]',banner='main [data-dashboard-state-banner]';
 return [
  {target:{css:'main h1:text-is("لوحة التحكم")'},visible:true,count:1},
  {target:{css:summary},visible:true,count:1,attribute:{name:'data-dashboard-readiness-summary',value:state}},
  {target:{css:summary},attribute:{name:'role',value:'status'}},
  {target:{css:`${summary}:text-is("${expected.label}")`},visible:true,count:1},
  ...(state==='ready'?[{target:{css:banner},count:0}]:[
   {target:{css:banner},visible:true,count:1,attribute:{name:'data-dashboard-state-banner',value:state}},
   {target:{css:`${banner} h2:text-is("${expected.receipt}")`},visible:true,count:1},
  ]),
 ];
}
export async function assertCoreDashboardEntry(page,{timeout=60_000}={}){
 const main=page.locator('main');
 await expect(main.getByRole('heading',{name:'لوحة التحكم',exact:true,level:1})).toBeVisible({timeout});
 const summary=main.locator('[data-dashboard-readiness-summary]');
 await expect(summary).toHaveCount(1,{timeout});await expect(summary).toBeVisible({timeout});await expect(summary).toHaveAttribute('role','status',{timeout});
 const state=await summary.getAttribute('data-dashboard-readiness-summary');
 assert.ok(Object.hasOwn(DASHBOARD_ENTRY_STATES,state),'Dashboard readiness must come from the current source-reading summary.');
 const expected=DASHBOARD_ENTRY_STATES[state];
 await expect(summary).toHaveText(expected.label,{timeout});
 const banner=main.locator('[data-dashboard-state-banner]');
 if(state==='ready')await expect(banner).toHaveCount(0,{timeout});
 else{await expect(banner).toHaveCount(1,{timeout});await expect(banner).toHaveAttribute('data-dashboard-state-banner',state,{timeout});await expect(banner.getByRole('heading',{name:expected.receipt,exact:true,level:2})).toBeVisible({timeout});}
 // Preserve the existing evidence-state contract; the page title no longer owns readiness.
 return expected.receipt;
}
export async function runCoreAuthEntryJourneys(ctx){
 const {browser,origin,login,run,observe,nativeCheckpoint,ownedNetworkOnly}=ctx;assert.equal(new URL(origin).hostname,'127.0.0.1');assert.ok(login.username&&login.password);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import('../../src/lib/admin/form-system/adoption-manifest.ts');const session=await jiti.import('../../src/lib/admin/auth/session.ts');const plan=buildCoreAuthEntryPlan(manifest);const checkpoints=[];
 const native=async phase=>{const request={id:randomUUID(),kind:'auth-entry-state',phase};const value=await nativeCheckpoint(request);assert.equal(value.id,request.id);assert.equal(value.kind,request.kind);assert.equal(value.phase,phase);assert.equal(value.status,'pass');checkpoints.push(value.id);return value;};
 await native('baseline');
 const completed=[];
 for(const surface of plan.surfaces)await run('core-auth-entry-'+surface.id,[],async()=>{
  // This cohort injects page-owned transport faults. The Maintenance PWA worker
  // proxies requests and is outside that test boundary; Product PWA behavior is unchanged.
  const context=await browser.newContext(coreAuthEntryBrowserOptions(surface.id));await context.route('**/*',ownedNetworkOnly);const page=await context.newPage();page.setDefaultTimeout(25_000);const endpoint=origin+surface.endpoint;const prefix=surface.id==='admin-login'?'admin':'maintenance';
  const open=()=>observe('auth-entry-open',()=>page.goto(origin+surface.path+'?next='+encodeURIComponent(surface.id==='admin-login'?'https://example.invalid/blocked-redirect':'/admin'),{waitUntil:'domcontentloaded'}));
  const submit=()=>page.locator('button[type="submit"]');const received=status=>page.waitForResponse(response=>response.url()===endpoint&&response.request().method()==='POST'&&response.status()===status);
  try{
   await open();
   if(prefix==='admin'){
    await page.getByRole('link',{name:'نسيت كلمة المرور؟',exact:true}).click();await expect(page.getByRole('heading',{name:'استعادة كلمة المرور',exact:true})).toBeVisible();await expect(page.getByText('استعادة كلمة المرور غير مفعّلة حاليًا. يرجى التواصل مع مدير النظام.',{exact:false})).toBeVisible();await expect(page.locator('form')).toHaveCount(0);await native('forgot');await page.getByRole('link',{name:'العودة لتسجيل الدخول',exact:true}).click();await open();
   }
   let initialPosts=0;const count=request=>{if(request.url()===endpoint&&request.method()==='POST')initialPosts++;};page.on('request',count);
   await submit().click();assert.equal(initialPosts,0);await expect(page.locator('input[name="username"]')).toBeFocused();page.off('request',count);
   await fillCorePrivateField(page.locator('input[name="username"]'),login.username);
   const wrong=createHmac('sha256',login.password).update('isolated-auth-entry-wrong-password').digest('base64url');await fillCorePrivateField(page.locator('input[name="password"]'),wrong);
   const rejected=received(401);await submit().click();await rejected;await expect(page.getByText('بيانات الدخول غير صحيحة.',{exact:true})).toBeVisible();await expect(submit()).toBeEnabled();assert.equal((await context.cookies(origin)).some(row=>row.name===session.ADMIN_SESSION_COOKIE),false);await native(prefix+'-invalid');
   await fillCorePrivateField(page.locator('input[name="password"]'),login.password);
   let denied=0;const removeReject=await registerCorePageRoute(page,'**/*',async route=>{if(route.request().url()===endpoint&&route.request().method()==='POST'){denied++;await route.abort('failed');}else await route.fallback();});
   try{const failed=page.waitForEvent('requestfailed',{predicate:request=>request.url()===endpoint&&request.method()==='POST',timeout:25_000});failed.catch(()=>{});const [,failure]=await Promise.all([submit().click(),failed]);assert.equal(failure.serviceWorker(),null);assert.equal(denied,1);await expect(page.getByText('تعذر الاتصال بالخادم.',{exact:true})).toBeVisible();await expect(submit()).toBeEnabled();assert.equal(denied,1);let preserved=false;try{preserved=await page.locator('input[name="password"]').evaluate((node,expected)=>node.value===expected,login.password);}catch{throw Error('Private field preservation could not be checked.');}assert.equal(preserved,true,'Rejected transport must preserve the private draft.');}finally{await removeReject();}
   await native(prefix+'-transport');
   let release,observed,timer,requests=0;const held=new Promise(resolve=>{observed=resolve;}),gate=new Promise(resolve=>{release=resolve;});const removeHold=await registerCorePageRoute(page,'**/*',async route=>{if(route.request().url()===endpoint&&route.request().method()==='POST'){requests++;observed();await gate;}await route.fallback();});
   const before=Date.now()/1000,ack=received(200);ack.catch(()=>{});await submit().click();
   try{await Promise.race([held,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bounded login request hold not reached.')),20_000);})]);await expect(submit()).toBeDisabled();await submit().evaluate(node=>node.click());assert.equal(requests,1);release();await ack;await page.waitForURL(url=>url.pathname==='/admin',{timeout:60_000});assert.equal(requests,1);}finally{clearTimeout(timer);release();await removeHold();}
   const after=Date.now()/1000,cookie=(await context.cookies(origin)).find(row=>row.name===session.ADMIN_SESSION_COOKIE);assertCoreAuthCookieMetadata(cookie,origin,session.ADMIN_SESSION_TTL_SEC,before,after);await native(prefix+'-normal');
   await page.reload({waitUntil:'domcontentloaded'});await assertCoreDashboardEntry(page);await native(prefix+'-reload');
   if(prefix==='admin'){
    const remembered=await browser.newContext();await remembered.route('**/*',ownedNetworkOnly);const rememberPage=await remembered.newPage();
    try{await rememberPage.goto(origin+'/admin/login',{waitUntil:'domcontentloaded'});await fillCorePrivateField(rememberPage.locator('input[name="username"]'),login.username);await fillCorePrivateField(rememberPage.locator('input[name="password"]'),login.password);const checkbox=rememberPage.getByRole('checkbox',{name:'تذكرني',exact:true});await checkbox.check();await expect(checkbox).toBeChecked();const beforeRemember=Date.now()/1000;await Promise.all([rememberPage.waitForURL(url=>url.pathname==='/admin',{timeout:60_000}),rememberPage.locator('button[type="submit"]').click()]);const rememberCookie=(await remembered.cookies(origin)).find(row=>row.name===session.ADMIN_SESSION_COOKIE);assertCoreAuthCookieMetadata(rememberCookie,origin,session.ADMIN_SESSION_REMEMBER_TTL_SEC,beforeRemember,Date.now()/1000);await native('admin-remember');}finally{await remembered.close();}
   }
   const result={consumer:plan.consumer,surface:surface.id,requiredFields:true,invalidCredentials401:true,transportFailureNoWrite:true,transportBoundary:prefix==='maintenance'?'page-owned-network-service-worker-blocked':'page-owned-network',preservedPrivateDraft:true,pendingDedup:true,actualSessionCookie:true,authenticatedReload:true,nativeAudit:true,rememberMe:prefix==='admin'?'actual-owner-TTL':'not-exposed',forgotPassword:prefix==='admin'?'current-unavailable-page-no-reset-form':'not-exposed',automaticCoverage:[]};completed.push(result);return result;
  }finally{await context.close();}
 });
 return {completed,checkpoints,automaticCoverage:[],globalClosed:false,boundary:'Two actual session-entry surfaces and fixed native Auth audit/timestamp checkpoints. No hosted Auth, role policy, email/reset workflow or complete-axis claim.'};
}
