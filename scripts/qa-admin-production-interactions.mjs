import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { chromium } from "playwright";
import { browserAtomicReadiness } from "./fixtures/admin-atomic-readiness.mjs";

const origin = process.env.E2E_BASE_URL;
assert.match(origin ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const phase = process.env.QA_ADMIN_PHASE;
assert.ok(phase === "before" || phase === "after");
const control = resolve(process.env.QA_ADMIN_CONTROL ?? "");
const output = resolve(process.env.QA_ADMIN_OUTPUT ?? "");
assert.ok(control.includes(`${sep}.tmp-qa${sep}`) && output.includes(`${sep}.tmp-qa${sep}`));
const fixtures = JSON.parse(readFileSync(join(control, "fixtures.json"), "utf8"));
const localAuth={username:process.env.QA_ADMIN_USERNAME,password:process.env.QA_ADMIN_PASSWORD,next:randomBytes(32).toString("base64url")};
const privateValues=[localAuth.password,localAuth.next].filter(Boolean);
const storagePublicPrefixes = JSON.parse(process.env.QA_ADMIN_STORAGE_PUBLIC_PREFIXES ?? "[]");
assert.ok(Array.isArray(storagePublicPrefixes) && storagePublicPrefixes.length <= 2);
for (const prefix of storagePublicPrefixes) assert.match(prefix, /^http:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/public\/cms-(?:images|documents)\/$/u);
const allowsOwnedStorageRead = request => {
  if (request.method() !== "GET") return false;
  const url = new URL(request.url());
  return storagePublicPrefixes.some(prefix => {const allowed=new URL(prefix);return url.origin===allowed.origin&&url.pathname.startsWith(allowed.pathname);});
};
const sanitize=value=>privateValues.reduce((text,secret)=>text.replaceAll(secret,"[REDACTED_LOCAL_PASSWORD]"),value);
const save = (file, value) => writeFileSync(join(output, file), `${sanitize(JSON.stringify(value, null, 2))}\n`, { flag: "wx" });
const checkpoint=value=>appendFileSync(join(output,"browser-checkpoints.jsonl"),`${sanitize(JSON.stringify({at:Date.now(),...value}))}\n`);
const completeResponseTelemetry = async (row,response,request) => {
  row.responseCompletion="pending";
  try {
    const completionError=await response.finished();if(completionError)throw completionError;
    // HTTP completion is independent of optional CDP size metadata.
    row.finishedAt=Date.now();row.responseCompletion="complete";
  } catch(error) {row.responseCompletion="error";row.completionError=String(error.message??error);return;}
  try {row.timing=request.timing();} catch(error) {row.timingError=String(error.message??error);}
  await new Promise(done=>{
    let settled=false;
    const finish=apply=>{if(settled)return;settled=true;clearTimeout(timer);apply();done();};
    const timer=setTimeout(()=>finish(()=>{row.sizesStatus="timeout";row.sizeError="Optional request size metadata exceeded 1000ms";}),1_000);
    Promise.resolve().then(()=>request.sizes()).then(sizes=>finish(()=>{Object.assign(row,sizes);row.sizesStatus="complete";}),error=>finish(()=>{row.sizesStatus="error";row.sizeError=String(error.message??error);}));
  });
};
const sessionPath = join(control, "local-browser-session.private.json");
const reuseLocalSession = process.env.QA_ADMIN_STUDY === "heavy-editor-performance" && phase === "after";
const preservedCookies = reuseLocalSession ? JSON.parse(readFileSync(sessionPath, "utf8")) : null;
if (preservedCookies) assert.ok(preservedCookies.length > 0 && preservedCookies.every(cookie => cookie.domain === "127.0.0.1"));
const credentialArtifacts = process.env.QA_ADMIN_STUDY === "heavy-editor-performance" ? "owned-private-local-session-cookie" : false;
const browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1, locale: "ar-EG", timezoneId: "Africa/Cairo", reducedMotion: "reduce", serviceWorkers: "block" });
if (preservedCookies) {
  try { await context.addCookies(preservedCookies); }
  catch (error) { await context.close(); await browser.close(); throw error; }
}
const blocked = [];
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:" || allowsOwnedStorageRead(route.request())) return route.continue();
  blocked.push({ origin: url.origin, pathname: url.pathname }); return route.abort("blockedbyclient");
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
page.setDefaultTimeout(30_000);
const trustedEvents = [];
await page.exposeBinding("qaTrustedAction", (_source, value) => { trustedEvents.push(value); });
await page.addInitScript(() => {
  const longTasks=[];
  Object.defineProperty(window,"__qaAdminLongTasks",{value:longTasks});
  new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push({startedAt:performance.timeOrigin+entry.startTime,durationMs:entry.duration});if(longTasks.length>1000)longTasks.splice(0,longTasks.length-1000);}).observe({type:"longtask",buffered:true});
  for (const name of ["click","input","keydown","change"]) addEventListener(name,event=>{
    if(event.isTrusted) void window.qaTrustedAction({type:name,at:performance.timeOrigin+performance.now(),tag:event.target?.tagName,name:event.target?.getAttribute?.("name") ?? null});
  },{capture:true,passive:true});
});
const substitute = value => typeof value === "string" ? value.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/gu, (_, path) => {
  const result = path.split(".").reduce((item, key) => item?.[key], fixtures); assert.notEqual(result, undefined, `Unknown fixture ${path}`); return String(result);
}) : value;
const nativeCriteria = criteria => criteria.map(item => ({ ...item,
  target: item.target ? { ...item.target, css: substitute(item.target.css) } : undefined,
  urlContains: substitute(item.urlContains), value: substitute(item.value), textContains: substitute(item.textContains),
  attribute: item.attribute ? { ...item.attribute, value: substitute(item.attribute.value) } : undefined,
}));
const canBatchCriteria = criteria => criteria.every(item => !item.target ||
  (item.target.css && !/:(?:has-text|text(?:-is|-matches)?|visible)\(/u.test(item.target.css) && !item.target.css.includes(":visible")));
const locator = (target, surface = page) => {
  assert.ok(target && typeof target === "object");
  let value = target.css ? surface.locator(substitute(target.css)) : target.role ? surface.getByRole(target.role, { name: substitute(target.name), exact: target.exact ?? true })
    : target.label ? surface.getByLabel(substitute(target.label), { exact: target.exact ?? true })
    : target.placeholder ? surface.getByPlaceholder(substitute(target.placeholder), { exact: target.exact ?? true })
    : surface.getByText(substitute(target.text), { exact: target.exact ?? true });
  if (target.nth !== undefined) { assert.ok(Number.isInteger(target.nth) && target.nth >= 0); value = value.nth(target.nth); }
  return value;
};
const atomicReadiness = async (criteria, surface = page) => {
  const entries=[],probeStarted=performance.now();let lookupMs=0;
  if (canBatchCriteria(criteria)) {
    const observation = await surface.evaluate(browserAtomicReadiness, { operation: "snapshot", criteria: nativeCriteria(criteria) });
    return { ...observation, lookupMs: 0, probeMs: performance.now() - probeStarted, collector: "single-renderer-task" };
  }
  try {
    for(const item of criteria) entries.push({item:{...item,urlContains:substitute(item.urlContains),value:substitute(item.value),textContains:substitute(item.textContains),attribute:item.attribute?{...item.attribute,value:substitute(item.attribute.value)}:undefined},elements:item.target?await locator(item.target,surface).elementHandles():[]});
    lookupMs=performance.now()-probeStarted;
    const observation=await surface.evaluate(rows=>{
      const failures=[];
      const visible=element=>{
        const style=getComputedStyle(element);
        if(style.visibility!=="visible")return false;
        if(style.display==="contents")return [...element.childNodes].some(child=>{
          if(child.nodeType===Node.ELEMENT_NODE)return visible(child);
          if(child.nodeType!==Node.TEXT_NODE)return false;
          const range=document.createRange();range.selectNode(child);const rect=range.getBoundingClientRect();return rect.width>0&&rect.height>0;
        });
        const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0;
      };
      const enabled=element=>{
        if(element.matches(":disabled"))return false;
        for(let node=element;node;node=node.parentElement){const value=node.getAttribute("aria-disabled");if(value==="false")break;if(value==="true")return false;}
        return true;
      };
      rows.forEach(({item,elements},index)=>{
        const fail=condition=>failures.push({index,condition});
        if(item.urlContains!==undefined&&!location.href.includes(item.urlContains))fail("url");
        if(!item.target)return;
        if(elements.some(element=>!element.isConnected)){fail("detached");return;}
        if(item.count!==undefined&&elements.length!==item.count)fail("count");
        const elementChecks=["visible","enabled","value","textContains","attribute","checked"].some(key=>item[key]!==undefined)||item.nonEmpty===true||item.imageLoaded===true;
        if(!elementChecks)return;
        if(elements.length===0&&item.visible===false&&item.enabled===undefined&&item.value===undefined&&item.nonEmpty!==true&&item.textContains===undefined&&!item.attribute&&item.checked===undefined)return;
        if(elements.length!==1){fail("strict-cardinality");return;}
        const element=elements[0];
        if(item.visible!==undefined&&visible(element)!==item.visible)fail("visible");
        if(item.enabled!==undefined&&enabled(element)!==item.enabled)fail("enabled");
        if(item.value!==undefined&&element.value!==item.value)fail("value");
        if(item.nonEmpty===true&&(typeof element.value!=="string"||!element.value.trim()))fail("nonEmpty");
        if(item.textContains!==undefined&&!element.textContent?.includes(item.textContains))fail("textContains");
        if(item.attribute&&element.getAttribute(item.attribute.name)!==item.attribute.value)fail("attribute");
        if(item.checked!==undefined&&element.checked!==item.checked)fail("checked");
        if(item.imageLoaded===true&&(!(element instanceof HTMLImageElement)||!element.complete||element.naturalWidth<=0))fail("imageLoaded");
      });
      return {at:performance.timeOrigin+performance.now(),failures};
    },entries);
    return {...observation,lookupMs,probeMs:performance.now()-probeStarted};
  } finally {await Promise.all(entries.flatMap(entry=>entry.elements).map(element=>element.dispose()));}
};
const ready = async (criteria, surface = page, metrics) => {
  const deadline = Date.now() + 45_000; let error;
  do { try {
    const first=await atomicReadiness(criteria,surface);if(metrics){metrics.probes=(metrics.probes??0)+1;metrics.lookupMs=(metrics.lookupMs??0)+first.lookupMs;metrics.probeMs=(metrics.probeMs??0)+first.probeMs;}assert.equal(first.failures.length,0,JSON.stringify(first.failures));
    await surface.evaluate(()=>new Promise((done,reject)=>{const timer=setTimeout(()=>reject(new Error("Readiness frame fence timed out")),2_000);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);done();}));}));
    const final=await atomicReadiness(criteria,surface);if(metrics){metrics.probes=(metrics.probes??0)+1;metrics.lookupMs=(metrics.lookupMs??0)+final.lookupMs;metrics.probeMs=(metrics.probeMs??0)+final.probeMs;}assert.equal(final.failures.length,0,JSON.stringify(final.failures));return final.at;
  } catch (failure) { error = failure; await new Promise(done => setTimeout(done, 20)); } } while (Date.now() < deadline);
  throw error;
};
const act = async action => {
  assert.ok(["goto", "click", "fill", "press", "select", "check", "back", "reload", "reset-client", "assert", "settle-network", "local-password", "local-login", "upload"].includes(action.op), "Unknown fixed QA action");
  if (action.op === "goto") { const path = substitute(action.path); assert.ok(path.startsWith("/admin") && !path.startsWith("//")); await page.goto(origin + path, { waitUntil: "domcontentloaded" }); }
  else if (action.op === "reset-client") {
    assert.equal(process.env.QA_ADMIN_STUDY, "heavy-editor-performance");
    const path = substitute(action.path); assert.ok(path.startsWith("/admin") && !path.startsWith("//"));
    await page.goto("about:blank"); await cdp.send("Network.clearBrowserCache");
    await page.goto(origin + path, { waitUntil: "domcontentloaded" });
    checkpoint({type:"client-reset",job:activeJob,cookiesPreserved:true,documentAndRouterReset:true,httpCacheCleared:true,serverCacheReset:false});
  }
  else if (action.op === "back") await page.goBack({waitUntil:"domcontentloaded"});
  else if (action.op === "reload") await page.reload({waitUntil:"domcontentloaded"});
  else if (action.op === "settle-network") {
    const started=Date.now(),deadline=started+5_000;
    while(Date.now()<deadline) {
      if(![...activeRequests].some(request=>{const item=requests.get(request);return item?.job===activeJob&&!item.prefetch;})&&Date.now()-lastRelevantNetworkAt>=500) break;
      await new Promise(done=>setTimeout(done,50));
    }
    checkpoint({type:"network-settle",job:activeJob,waitMs:Date.now()-started,
      pendingRelevant:[...activeRequests].filter(request=>{const item=requests.get(request);return item?.job===activeJob&&!item.prefetch;}).length,
      pendingPrefetch:[...activeRequests].filter(request=>requests.get(request)?.prefetch).length});
  }
  else if(action.op === "upload") {
    assert.equal(phase,"after");assert.equal(new URL(page.url()).origin,origin);assert.equal(new URL(page.url()).pathname,"/admin/media-library");
    assert.equal(action.fixture,"project-hero");assert.equal(action.fileName,"qa-admin-interaction-managed-hero.jpg");
    const bytes=readFileSync(resolve("public/images/projects/c35/hero.jpg"));
    assert.equal(bytes.length,502238);assert.equal(createHash("sha256").update(bytes).digest("hex"),"cf60677938acaeef1c835f56fac83f8f0d864f9d7813866d5cc21b02c87f7b04");
    const target=locator(action.target);assert.equal(await target.getAttribute("type"),"file");
    await target.setInputFiles({name:action.fileName,mimeType:"image/jpeg",buffer:bytes});
    checkpoint({type:"fixed-file-input",job:activeJob,fixture:action.fixture,fileName:action.fileName,bytes:bytes.length});
  }
  else if(action.op === "local-password") {
    assert.equal(new URL(page.url()).origin,origin);assert.equal(new URL(page.url()).pathname,"/admin/settings/security");assert.ok(action.value==="current"||action.value==="next");
    const target=locator(action.target);assert.equal(await target.getAttribute("type"),"password");
    try{await target.fill(action.value==="next"?localAuth.next:localAuth.password);}catch(error){throw new Error(sanitize(error.message));}
  }
  else if(action.op === "local-login") {
    assert.equal(new URL(page.url()).origin,origin);assert.equal(new URL(page.url()).pathname,"/admin/login");assert.ok(action.value==="current"||action.value==="next");
    assert.ok(action.dashboardState===undefined||action.dashboardState==="partial-media-warning");
    try {await page.locator('input[name="username"]').fill(localAuth.username);await page.locator('input[name="password"]').fill(action.value==="next"?localAuth.next:localAuth.password);
      await Promise.all([page.waitForURL(url=>url.pathname==="/admin"),page.locator('button[type="submit"]').click()]);
      await ready(action.dashboardState==="partial-media-warning"?[
        {target:{css:'main h1:text-is("Dashboard جزئية")'},visible:true},
        {target:{text:'تشخيص الميديا متاح، لكنه لا يثبت تزامنًا كاملًا مع البيئة الحالية.',exact:true},visible:true},
        ...['public.admin_dashboard_truth_v1()','admin_audit_logs via listAdminAuditLogs','Next.js force-dynamic request-time rendering'].map(source=>({target:{css:`main div:has(> p:text-is("${source}")) > div > span:text-is("جاهز")`},visible:true})),
        {target:{css:'main div:has(> p:text-is("media.catalog_state via getMediaCatalogRuntimeState")) > div > span:text-is("تحذير")'},visible:true},
        ...['/admin/content/topics/new','/admin/content/categories/new','/admin/settings/general'].map(path=>({target:{css:`main a[href="${path}"]`},visible:true,enabled:true})),
      ]:[{target:{css:'main h1:has-text("Dashboard جاهزة")'},visible:true}]);if(action.value==="next")localAuth.password=localAuth.next;
    }catch(error){throw new Error(sanitize(error.message));}
  }
  else if (action.op === "assert") await ready([action]);
  else { const target = locator(action.target); if(action.op === "click") await target.click(); else if(action.op === "fill") await target.fill(substitute(action.value));
    else if(action.op === "press") await target.press(action.value); else if(action.op === "select") await target.selectOption(substitute(action.value)); else await target.setChecked(action.value ?? true); }
};
const network = [], consoleErrors = [], pageErrors = [], requests = new WeakMap(), activeRequests = new Set();
let lastRelevantNetworkAt=Date.now();
let activeJob = null, activeMeasurement = null;
const pendingNetwork = new Set();
const observeNetwork = (emitter, accepts = () => true, surface) => {
  const responseRows=new WeakMap(),pendingByRequest=new WeakMap();
  const onRequest=request=>{if(!accepts(request))return;const headers=request.headers(),prefetch=headers["next-router-prefetch"]==="1"||Boolean(headers["next-router-segment-prefetch"])||headers.purpose==="prefetch";
    requests.set(request,{startedAt:Date.now(),job:activeJob,measurement:activeMeasurement,prefetch,...(surface?{surface}:{})});activeRequests.add(request);if(!prefetch)lastRelevantNetworkAt=Date.now();};
  const onFinished=request=>{if(!accepts(request))return;activeRequests.delete(request);if(!requests.get(request)?.prefetch)lastRelevantNetworkAt=Date.now();};
  const onFailed=request=>{onFinished(request);if(!accepts(request))return;const row=responseRows.get(request);if(row){row.browserRequestFailedAt=Date.now();row.browserRequestFailure=request.failure()?.errorText??"unknown";row.responseCompletion="failed";}const pending=pendingByRequest.get(request);if(pending)pendingNetwork.delete(pending);};
  const onResponse=response=>{
    const request=response.request();if(!accepts(request))return;const url=new URL(request.url());if(url.origin!==origin&&!allowsOwnedStorageRead(request))return;
    const row={...requests.get(request),method:request.method(),pathname:url.pathname,queryKeys:[...url.searchParams.keys()],
      ...(url.origin!==origin?{ownedStorageRead:true,origin:url.origin}:{}),
      rsc:request.headers().rsc==="1",serverAction:Boolean(request.headers()["next-action"]),status:response.status(),at:Date.now(),resourceType:request.resourceType()};
    responseRows.set(request,row);network.push(row);const pending=completeResponseTelemetry(row,response,request).finally(()=>pendingNetwork.delete(pending));pendingNetwork.add(pending);pendingByRequest.set(request,pending);
  };
  emitter.on("request",onRequest);emitter.on("requestfinished",onFinished);emitter.on("requestfailed",onFailed);emitter.on("response",onResponse);
  return ()=>{emitter.off("request",onRequest);emitter.off("requestfinished",onFinished);emitter.off("requestfailed",onFailed);emitter.off("response",onResponse);};
};
const measurePreview = async step => {
  assert.equal(phase,"after","Popup preview measurements are After-only");
  assert.match(step.id,/^[a-z0-9-]+$/u);assert.ok(Array.isArray(step.ready)&&step.ready.length>0);assert.ok(Array.isArray(step.returnReady)&&step.returnReady.length>0);
  const trigger=locator(step.target);await trigger.waitFor({state:"visible"});assert.equal(await trigger.getAttribute("target"),"_blank");
  const callerUrl=page.url();assert.equal(new URL(callerUrl).origin,origin);
  const previewUrl=new URL(await trigger.getAttribute("href"),callerUrl);
  assert.equal(previewUrl.origin,origin);assert.match(previewUrl.pathname,/^\/admin\/(?:content\/topics|projects)\/[1-9]\d*\/preview$/u);assert.equal(previewUrl.search,"");assert.equal(previewUrl.hash,"");
  const networkStart=network.length,eventStart=trustedEvents.length,automationStarted=performance.now(),browserStarted=await page.evaluate(()=>performance.timeOrigin+performance.now());
  let popup=null,failure=null,usableAt=null,popupIdentity=null,returnUsableAt=null;
  activeMeasurement=step.id;
  // Context listeners are installed before the click so the popup's first document request is retained.
  const stop=observeNetwork(context,request=>{
    // Playwright may expose a popup navigation before its Frame exists.
    if(request.isNavigationRequest()&&request.url()===previewUrl.href)return true;
    try{return request.frame().page()!==page;}catch{return false;}
  },"preview");
  const onPopup=surface=>{
    popup=surface;surface.setDefaultTimeout(30_000);
    surface.on("console",message=>{if(message.type()==="error")consoleErrors.push({job:activeJob,surface:"preview",text:message.text()});});
    surface.on("pageerror",error=>pageErrors.push({job:activeJob,surface:"preview",message:error.message}));
  };
  page.once("popup",onPopup);
  try {
    [popup]=await Promise.all([page.waitForEvent("popup",{timeout:30_000}),trigger.click()]);
    await popup.waitForURL(previewUrl.href,{waitUntil:"domcontentloaded",timeout:45_000});
    const completed=row=>row.measurement===step.id&&row.surface==="preview"&&row.resourceType==="document"&&row.pathname===previewUrl.pathname&&row.status>=200&&row.status<300&&Number.isFinite(row.finishedAt);
    const deadline=Date.now()+45_000;while(!network.slice(networkStart).some(completed)&&Date.now()<deadline)await new Promise(done=>setTimeout(done,20));
    assert.ok(network.slice(networkStart).some(completed),"Preview document response did not complete successfully");
    usableAt=await ready(step.ready,popup);assert.equal(popup.url(),previewUrl.href);
    popupIdentity={url:popup.url(),title:await popup.title(),headings:await popup.locator("h1").allTextContents()};
  } catch(error){failure={name:error.name,message:error.message};
    if(popup&&!popup.isClosed())popupIdentity={url:popup.url(),title:await popup.title().catch(()=>null),bodyText:await popup.locator("body").innerText({timeout:2_000}).catch(()=>null)};
  }
  finally {
    page.off("popup",onPopup);
    try {if(popup&&!popup.isClosed())await popup.close();await page.bringToFront();assert.equal(page.url(),callerUrl);returnUsableAt=await ready(step.returnReady);}
    catch(error){failure??={name:error.name,message:error.message};}
    stop();
  }
  const events=trustedEvents.slice(eventStart).filter(event=>event.at>=browserStarted),trusted=events.find(event=>event.type==="click");
  assert.ok(trusted,"Preview must originate from a trusted click on the existing link");
  const result={id:step.id,status:failure?"fail":"pass",automationMs:performance.now()-automationStarted,trustedActionToUsableMs:usableAt&&!failure?usableAt-trusted.at:null,
    trustedAction:trusted,observedEvents:events,finishedAt:Date.now(),url:callerUrl,popup:popupIdentity,previewUsableAt:usableAt,returnUsableAt,returnCriteria:step.returnReady,criteria:step.ready,failure,
    endpoint:"After-only existing target_blank internal preview; completed document plus two atomic snapshots; popup closed and exact caller restored"};
  activeMeasurement=null;return result;
};
try {
  if (reuseLocalSession) {
    await page.goto(`${origin}/admin`, {waitUntil:"domcontentloaded"});
    assert.equal(new URL(page.url()).pathname, "/admin", "The original owned local session must remain valid");
    save("login-dashboard.json",{phase,status:"reused-local-session",localAuth:true,newLogin:false,credentialArtifacts});
  } else {
  await page.goto(`${origin}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="username"]').fill(process.env.QA_ADMIN_USERNAME);
  await page.locator('input[name="password"]').fill(process.env.QA_ADMIN_PASSWORD);
  const loginEventsStart=trustedEvents.length,loginAutomationStart=performance.now();
  await Promise.all([page.waitForURL(url => url.pathname === "/admin", { timeout: 45_000 }), page.locator('button[type="submit"]').click()]);
  let loginReadinessFailure=null;
  try {await ready([{target:{css:'main h1:has-text("Dashboard جاهزة")'},visible:true}]);}
  catch(error) {loginReadinessFailure={name:error.name,message:error.message};}
  const loginFinished=await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(performance.timeOrigin+performance.now())))));
  const loginAction=trustedEvents.slice(loginEventsStart).find(event=>event.type==="click");
  save("login-dashboard.json",{phase,status:loginReadinessFailure?"partial-or-unready":"pass",trustedAction:loginAction??null,
    trustedActionToUsableMs:loginAction&&!loginReadinessFailure?loginFinished-loginAction.at:null,automationMs:performance.now()-loginAutomationStart,
    dashboardHeadings:await page.locator("main h1").allTextContents(),failure:loginReadinessFailure,localAuth:true,credentialArtifacts});
  if (process.env.QA_ADMIN_STUDY === "heavy-editor-performance") {
    const cookies = await context.cookies();
    assert.ok(cookies.length > 0 && cookies.every(cookie => cookie.domain === "127.0.0.1"));
    writeFileSync(sessionPath, JSON.stringify(cookies), {mode:0o600,flag:"wx"});
  }
  }
  delete process.env.QA_ADMIN_USERNAME; delete process.env.QA_ADMIN_PASSWORD;
  observeNetwork(page);
  page.on("console", message => { if(message.type() === "error") consoleErrors.push({job:activeJob,text:message.text()}); });
  page.on("pageerror", error => pageErrors.push({job:activeJob,message:error.message}));
  save("ready.json", {origin,phase,fixturePath:join(control,"fixtures.json"),sourceSha256:process.env.QA_ADMIN_SOURCE_SHA256,mode:"production",headless:true,viewport:{width:1365,height:900},localLogin:!reuseLocalSession,credentialArtifacts});
  const driverAttempt=process.env.QA_ADMIN_DRIVER_ATTEMPT;
  writeFileSync(join(control, `${phase}-ready${driverAttempt?`-${driverAttempt}`:""}.json`), `${JSON.stringify({origin,output,phase},null,2)}\n`, {flag:"wx"});
  const completed = new Set();
  const deadline = Date.now() + (process.env.QA_ADMIN_STUDY === "heavy-editor-performance" ? 21_300_000 : 6_900_000);
  while(Date.now() < deadline) {
    const jobs = readdirSync(control).filter(name => new RegExp(`^${phase}-job-[a-z0-9-]+\\.json$`, "u").test(name) && !completed.has(name))
      .filter(name=>{const job=JSON.parse(readFileSync(join(control,name),"utf8"));return !existsSync(join(control,`${phase}-result-${job.id}.json`));}).sort();
    if(!jobs.length) { if(existsSync(join(control,`${phase}-finish.json`))) break; await new Promise(done => setTimeout(done,500)); continue; }
    for(const file of jobs) {
      const raw = readFileSync(join(control,file),"utf8"); const job = JSON.parse(raw); assert.match(job.id,/^[a-z0-9-]+$/u); assert.ok(Array.isArray(job.steps) && job.steps.length <= 150);
      activeJob=job.id; const start=Date.now();const measurements=[]; const snapshots=[]; const networkStart=network.length;let failure=null;
      if (process.env.QA_ADMIN_STUDY === "heavy-editor-performance") {
        assert.ok(["off", "headers", "full"].includes(job.serverTrace ?? "off"));
        const mode = job.serverTrace ?? "off", token = `${job.id}:${Date.now()}`;
        writeFileSync(join(control, "server-trace-mode.json"), JSON.stringify({mode,token}));
        const acknowledgement = join(control, "server-trace-mode-ack.json"), deadline = Date.now() + 10_000;
        let acknowledged = false;
        while (!acknowledged && Date.now() < deadline) {
          try { const ack = JSON.parse(readFileSync(acknowledgement,"utf8")); acknowledged = ack.token === token && ack.mode === mode; } catch { /* The fixed tiny file may be in flight. */ }
          if (!acknowledged) await new Promise(done => setTimeout(done, 50));
        }
        assert.ok(acknowledged, "The owned server did not acknowledge its instrumentation mode");
      }
      let traceEvents = null;
      const onTrace = event => traceEvents.push(...event.value);
      if (job.profile === true) {
        assert.equal(process.env.QA_ADMIN_STUDY, "heavy-editor-performance");
        traceEvents = []; cdp.on("Tracing.dataCollected", onTrace);
        await cdp.send("Profiler.enable"); await cdp.send("Profiler.start");
        await cdp.send("Tracing.start", {categories:"devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline",options:"record-as-much-as-possible"});
      }
      checkpoint({type:"job-start",job:job.id,file,scenarioSha256:createHash("sha256").update(raw).digest("hex")});
      writeFileSync(join(control,`${phase}-current-job.json`),JSON.stringify({id:job.id,file,output,startedAt:start}));
      const frameCalibration=await page.evaluate(()=>new Promise(done=>{const frames=[];let last=performance.now();const tick=now=>{frames.push(now-last);last=now;if(frames.length===20)done({visibility:document.visibilityState,hasFocus:document.hasFocus(),frames});else requestAnimationFrame(tick);};requestAnimationFrame(tick);}));
      try { for(const [stepIndex,step] of job.steps.entries()) {
        const stepMetadata={index:stepIndex,op:step.op,id:step.id??null,target:step.target??step.action?.target??null};
        checkpoint({type:"step-start",job:job.id,...stepMetadata});
        let stepStatus="pass",stepFailure=null;
        try {
        if(step.op === "measure-preview") {
          const measurement=await measurePreview(step);measurements.push(measurement);checkpoint({type:"measurement",job:job.id,measurement});
          if(measurement.status==="fail"){stepStatus="fail";if(step.continueOnFailure!==true)throw new Error(`Measurement ${step.id}: ${measurement.failure.message}`);}
        } else if(step.op === "measure") {
          assert.match(step.id,/^[a-z0-9-]+$/u); assert.ok(Array.isArray(step.ready) && step.ready.length > 0);
          if(step.action.target) {await locator(step.action.target).waitFor({state:"visible"});assert.ok(await locator(step.action.target).isEnabled());}
          activeMeasurement=step.id; const eventStart=trustedEvents.length,nodeStarted=performance.now(), browserStarted=await page.evaluate(()=>performance.timeOrigin+performance.now());
          const expectedEvent=step.action.op === "fill" ? "input" : step.action.op === "press" ? "keydown" : step.action.op === "select" ? "change" : "click";
          const watcherId = `${job.id}:${step.id}`;
          const armed = canBatchCriteria(step.ready) && ["click", "fill", "press"].includes(step.action.op);
          if (step.requireFormSaved) assert.ok(armed, "Committed-form readiness requires the native prearmed observer");
          if (armed) await page.evaluate(browserAtomicReadiness, { operation: "arm", id: watcherId, criteria: nativeCriteria(step.ready), eventType: expectedEvent,
            requireFormSaved: step.requireFormSaved ? { entityId: substitute(step.requireFormSaved.entityId) } : undefined });
          let measurementFailure=null,browserFinished=null;const pipeline={actionInvokedAt:Date.now(),readiness:{}};
          try {
            const networkIndex=network.length;
            await act(step.action);
            pipeline.actionResolvedAt=Date.now();
            if(step.requireActionResponse === true) {
              const deadline=Date.now()+45_000;
              const matches=row=>row.measurement===step.id&&row.serverAction&&row.status>=200&&row.status<300&&Number.isFinite(row.finishedAt);
              while(!network.slice(networkIndex).some(matches) && Date.now()<deadline) await new Promise(done=>setTimeout(done,20));
              assert.ok(network.slice(networkIndex).some(matches),"The measured action did not complete its required successful Server Action response");
            }
            if(step.requireApiResponse !== undefined) {
              assert.deepEqual(step.requireApiResponse,{method:"GET",pathname:"/api/admin/media-library/recovery"});
              const matches=row=>row.measurement===step.id&&row.method==="GET"&&row.pathname==="/api/admin/media-library/recovery"&&row.status>=200&&row.status<300&&Number.isFinite(row.finishedAt);
              const deadline=Date.now()+45_000;
              while(!network.slice(networkIndex).some(matches)&&Date.now()<deadline) await new Promise(done=>setTimeout(done,20));
              assert.ok(network.slice(networkIndex).some(matches),"The measured action did not complete its required owned Recovery API response");
            }
            pipeline.readinessStartedAt=Date.now();
            const observation = armed ? await page.evaluate(browserAtomicReadiness, { operation: "result", id: watcherId }) : null;
            if (observation) {
              Object.assign(pipeline.readiness, observation, { collector: "prearmed-native-css", timestamp: "first-of-three-consecutive-ready-frames" });
              assert.equal(observation.failures.length, 0, JSON.stringify(observation));
              assert.ok(Number.isFinite(observation.actionAt) && Number.isFinite(observation.firstReadyAt) && Number.isFinite(observation.confirmedAt)
                && observation.actionAt <= observation.firstReadyAt && observation.firstReadyAt <= observation.confirmedAt, "Invalid readiness chronology");
              browserFinished = observation.firstReadyAt;
            } else {
              assert.ok(!step.requireFormSaved, "The document changed before the required committed-form event could be verified");
              browserFinished=await ready(step.ready,page,pipeline.readiness);
            }
          } catch(error) {measurementFailure={name:error.name,message:error.message};}
          if(browserFinished===null)browserFinished=await page.evaluate(()=>performance.timeOrigin+performance.now());
          const events=trustedEvents.slice(eventStart).filter(event=>event.at>=browserStarted);
          const trusted=events.find(event=>event.type===expectedEvent);
          pipeline.longTasks=await page.evaluate(since=>(window.__qaAdminLongTasks??[]).filter(task=>task.startedAt+task.durationMs>=since),browserStarted);
          measurements.push({id:step.id,status:measurementFailure?"fail":"pass",automationMs:performance.now()-nodeStarted,navigationCommandMs:trusted?null:browserFinished-browserStarted,
            pipeline,
            trustedActionToUsableMs:trusted&&!measurementFailure?browserFinished-trusted.at:null,trustedAction:trusted??null,observedEvents:events,
            finishedAt:Date.now(),url:page.url(),criteria:step.ready,failure:measurementFailure,endpoint:pipeline.readiness.collector === "prearmed-native-css" ? "Trusted action to first correct atomic native-CSS snapshot, confirmed on two subsequent animation frames; observer CPU reported separately" : "Two complete atomic connected-element snapshots separated by double rAF; timestamp sampled inside final successful snapshot; includes observation latency"});activeMeasurement=null;
          checkpoint({type:"measurement",job:job.id,measurement:measurements.at(-1)});
          if(measurementFailure)stepStatus="fail";
          if(measurementFailure && step.continueOnFailure !== true) throw new Error(`Measurement ${step.id}: ${measurementFailure.message}`);
        } else if(step.op === "snapshot") {
          const fields=await page.locator("input,textarea,select,[contenteditable=true],[data-admin-tab-id]").evaluateAll(elements=>elements.map(element=>({tag:element.tagName,name:element.getAttribute("name"),id:element.id,type:element.getAttribute("type"),value:element.type === "password" ? "[REDACTED]" : element.value ?? null,text:element.isContentEditable ? element.textContent : null,disabled:Boolean(element.disabled),tab:element.getAttribute("data-admin-tab-id"),selected:element.getAttribute("aria-selected")})));
          let formData;
          if (step.formData === true) {
            assert.equal(typeof step.formSelector, "string");
            formData = await page.locator(step.formSelector).evaluate(form => {
              if (!(form instanceof HTMLFormElement)) throw new Error("Expected owned editor form");
              return [...new FormData(form).entries()].map(([name, value]) => [name, typeof value === "string" ? value : { name: value.name, size: value.size, type: value.type }]);
            });
            for (const [name, count] of Object.entries(step.formAssertions?.names ?? {})) assert.equal(formData.filter(entry => entry[0] === name).length, count, `Successful FormData count: ${name}`);
            for (const [name, values] of Object.entries(step.formAssertions?.values ?? {})) assert.deepEqual(formData.filter(entry => entry[0] === name).map(entry => entry[1]), values.map(substitute), `Successful FormData values: ${name}`);
            if (step.compareFormTo) {
              const previous = snapshots.find(snapshot => snapshot.id === step.compareFormTo);
              assert.ok(previous?.formData, "Missing earlier successful FormData snapshot");
              assert.deepEqual(formData, previous.formData, "Tab navigation changed successful FormData");
            }
          }
          snapshots.push({id:step.id,url:page.url(),fields,...(formData ? {formData} : {}),bodyText:await page.locator("body").innerText()});
          checkpoint({type:"snapshot",job:job.id,snapshot:snapshots.at(-1)});
        } else await act(step);
        } catch(error) {
          stepStatus="fail";stepFailure={name:error.name,message:error.message};throw error;
        } finally {
          checkpoint({type:"step-end",job:job.id,...stepMetadata,status:stepStatus,failure:stepFailure});
        }
      }} catch(error) {failure={name:error.name,message:error.message};
        const artifactFailures=[];
        await page.screenshot({path:join(output,`job-${job.id}-failure.png`),fullPage:true,timeout:5_000})
          .catch(error=>artifactFailures.push({artifact:"screenshot",name:error.name,message:error.message}));
        const [bodyText,html]=await Promise.all([
          page.locator("body").innerText({timeout:2_000}).catch(error=>{artifactFailures.push({artifact:"bodyText",name:error.name,message:error.message});return null;}),
          page.locator("body").innerHTML({timeout:2_000}).catch(error=>{artifactFailures.push({artifact:"html",name:error.name,message:error.message});return null;}),
        ]);
        save(`job-${job.id}-failure-dom.json`,{url:page.url(),bodyText,html,artifactFailures});
      }
      await Promise.race([Promise.allSettled([...pendingNetwork]),new Promise(done=>setTimeout(done,2_000))]);
      if (traceEvents) {
        const profile = await cdp.send("Profiler.stop"); await cdp.send("Profiler.disable");
        const tracingComplete = new Promise(done => cdp.once("Tracing.tracingComplete", done));
        await cdp.send("Tracing.end"); await tracingComplete; cdp.off("Tracing.dataCollected", onTrace);
        save(`job-${job.id}-cpu-profile.json`,profile); save(`job-${job.id}-browser-trace.json`,{traceEvents});
      }
      const result={id:job.id,phase,status:failure||measurements.some(row=>row.status==="fail")?"fail":"pass",startedAt:start,finishedAt:Date.now(),instrumentation:{serverTrace:job.serverTrace ?? (process.env.QA_ADMIN_STUDY ? "off" : "legacy-full"),browserProfile:job.profile === true},frameCalibration,scenarioSha256:createHash("sha256").update(raw).digest("hex"),measurements,snapshots,network:network.slice(networkStart),pendingTelemetryAtReceipt:pendingNetwork.size,failure};
      save(`job-${job.id}.json`,result); completed.add(file); activeJob=null;activeMeasurement=null;
      writeFileSync(join(control,`${phase}-result-${job.id}.json`),`${JSON.stringify({status:result.status,path:join(output,`job-${job.id}.json`)},null,2)}\n`,{flag:"wx"});
    }
  }
  assert.ok(existsSync(join(control,`${phase}-finish.json`)),"Admin measurement control lease expired");
  save("browser-summary.json",{phase,jobs:[...completed],network,consoleErrors,pageErrors,blockedExternal:blocked,allOutliersRetained:true,measurementScope:"Explicit scenario full readiness criteria; no global UI timing claim"});
} finally { await context.close(); await browser.close(); }
