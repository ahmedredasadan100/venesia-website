import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
// Preserve previous mounted evidence when running the bounded Integration tranche.
const integrationsOnly=process.argv.some(value=>value.startsWith('--only=integrations-'));
const out = path.join(root, ".tmp-qa/shared-corrections-adoption/components", ...(integrationsOnly ? ["integrations-feedback",new Date().toISOString().replaceAll(/[:.]/g,'-')] : []));
await mkdir(out, { recursive: true });
const entry = String.raw`import React, {StrictMode,useState,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import AdminFeedbackProvider,{useAdminFeedback} from '@src/components/admin/AdminFeedbackProvider';
import AdminFormRuntime,{AdminFormPendingFields} from '@src/components/admin/ui/AdminFormRuntime';
import {createAdminFormErrorState} from '@src/lib/admin/form-runtime';
import Footer from '@src/app/admin/pages-blocks/footer/FooterBuilderClient';
import Security from '@src/app/admin/settings/security/SecuritySettingsClient';
import Menu from '@src/app/admin/pages-blocks/menus/MenuBuilderClient';
import MenuItem from '@src/app/admin/pages-blocks/menus/MenuItemForm';
import Seo from '@src/app/admin/pages-blocks/pages/[id]/PageSeoPanel';
import {EMPTY_FOOTER_SETTINGS,DEFAULT_FOOTER_SLOTS} from '@src/lib/footer/defaults';
import IntegrationConnectionWizard from '@src/components/admin/integrations/IntegrationConnectionWizard';
import IntegrationsServerConfiguration from '@src/components/admin/integrations/IntegrationsServerConfiguration';
import {INTEGRATION_DEFINITIONS} from '@src/lib/admin/integrations/integrations-contract';
import {INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION} from '@src/lib/admin/integrations/server-configuration-contract';
const root=createRoot(document.getElementById('root'));
window.calls=0;window.payloads=[];
window.action=async(...args)=>{window.calls++;window.payloads.push(args[0] instanceof FormData?[...args[0].entries()]:args[0]);return new Promise((resolve,reject)=>{window.finish=resolve;window.reject=()=>reject(new Error('isolated failure'));});};
const menu={id:1,name:'Original menu',slug:'fixture',location:'header',is_active:true};
const settings={...EMPTY_FOOTER_SETTINGS,slots:structuredClone(DEFAULT_FOOTER_SLOTS),sourceStatus:'database'};
const security={username:'fixture',email:'fixture@example.test',fullName:'Original name',lastLoginAt:null};
const seo={pageId:1,pageTitle:'Page',path:'/fixture',content:'',titleSuffix:'',resolvedFallback:{title:'',description:'',image:'',imageAlt:''},seoTitle:'Original SEO',seoDescription:'',focusKeyword:'',seoKeywords:[],canonicalUrl:'',robotsIndex:null,robotsFollow:null,ogImage:'',ogImageAlt:''};
const integrationItem={...INTEGRATION_DEFINITIONS.find(item=>item.key==='google_analytics'),connectionId:'fixture-connection',status:'connected',checkedAt:'2026-10-22T00:00:00.000Z',lastSyncAt:null,nextSyncAt:null,message:'Fixture connection read model remains unchanged.',security:'guarded',configureHref:null,testHref:null,reportsAvailable:true,availableAssets:[],selectedAssets:[{id:'fixture-property',type:'property',externalId:'fixture-property',parentExternalId:null,displayName:'Fixture Property',permissions:[],metadata:{},selected:true}],missingConfiguration:[],appConfigurationStatus:'ready_to_connect',appConfigurationSource:'cms_vault',appConfigurationLastTestedAt:null};
const configurationSurface=(key,label,version)=>({key,owner:key,label,description:'Isolated credential presentation fixture.',sharedOwnerLabel:null,source:'cms_vault',version,updatedAt:null,fields:[{key:key==='google'?'google_client_id':'meta_app_id',label:'Fixture App ID',secret:false,placeholder:'Fixture App ID',help:'Only synthetic fixture values.',configured:true,safeValue:'fixture-app-id'},{key:key==='google'?'google_client_secret':'meta_app_secret',label:'Fixture App Secret',secret:true,placeholder:'Fixture App Secret',help:'No saved secret is exposed.',configured:true,safeValue:null}],validations:[{integration:key==='google'?'google_analytics':'meta_business',label,configured:true,status:'ready_to_connect',missing:[],lastTestedAt:null,safeErrorCode:null}],callbackUrls:[{integration:key==='google'?'google_analytics':'meta_business',label,url:'https://fixture.invalid/callback/'+key}]});
const configurationSnapshot={contractVersion:INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION,state:'ready',checkedAt:'2026-10-22T00:00:00.000Z',migrationRegistered:true,vaultAvailable:true,canonicalOrigin:'https://fixture.invalid',surfaces:[configurationSurface('google','Google fixture',7),configurationSurface('meta','Meta fixture',3)]};
function IntegrationFixtureControls(){const feedback=useAdminFeedback();window.integrationFeedbackEntries=feedback.entries;window.publishUnrelatedIntegrationFeedback=()=>feedback.publishFeedback({variant:'danger',title:'Unrelated critical fixture',message:'Unrelated critical fixture must survive.',layout:'stacked',dismissible:true,lifecycle:'persistent'},{channel:'integration-fixture:unrelated',critical:true});return null;}
function FeedbackFixture(){return <AdminFormRuntime mode="edit" entityKey="media-error" initialState={createAdminFormErrorState('edit','Legacy','Legacy media failure')} action={async()=>{await window.action();return createAdminFormErrorState('edit','Current','Current save failure');}}><input name="title" defaultValue="Draft"/><button>Save feedback</button></AdminFormRuntime>;}
function Fixture({kind,overrides={},onCommitted}){
 useLayoutEffect(onCommitted,[kind,overrides,onCommitted]);
 if(kind==='footer')return <Footer settings={{...settings,...overrides}} footerMenuId={null} quickLinkItems={[]} menuOptions={[]}/>;
 if(kind==='security')return <Security {...security} {...overrides}/>;
 if(kind==='menu')return <Menu menu={menu} items={[]}/>;
 if(kind==='menuitem')return <MenuItem menu={menu} parentItems={[]} submitLabel="Save item" action={window.action}/>;
 if(kind==='seo')return <Seo {...seo}/>;
 if(kind==='feedback')return <FeedbackFixture/>;
 if(kind==='integration-wizard')return <div className="mx-auto w-full max-w-[1440px] px-4 py-6"><IntegrationFixtureControls/>{!overrides.hideConsumer&&<IntegrationConnectionWizard item={{...integrationItem,...overrides.item}} requestedAction={overrides.requestedAction??null} callbackError={overrides.callbackError??null}/>}</div>;
 if(kind==='integration-configuration')return <div className="mx-auto w-full max-w-[1440px] px-4 py-6"><IntegrationFixtureControls/>{!overrides.hideConsumer&&<IntegrationsServerConfiguration snapshot={{...configurationSnapshot,...overrides.snapshot}}/>}</div>;
 return <form action={window.action}><AdminFormPendingFields><input name="title" defaultValue="Initial"/><button>Save native</button></AdminFormPendingFields></form>;
}
// root.render schedules work; resolve only after React commits incoming props.
window.mount=(kind,overrides={})=>new Promise(resolve=>{window.kind=kind;root.render(<AdminFeedbackProvider><Fixture kind={kind} overrides={overrides} onCommitted={resolve}/></AdminFeedbackProvider>);});
window.mountIntegration=(kind,overrides={})=>new Promise(resolve=>{window.kind=kind;root.render(<StrictMode><AdminFeedbackProvider><Fixture kind={kind} overrides={overrides} onCommitted={resolve}/></AdminFeedbackProvider></StrictMode>);});
window.footerFixture=settings;window.mount('native');
`;
await writeFile(path.join(out, "entry.tsx"), entry);
// Integration adoption uses actual shared utility rules, never a modal/layout override.
// Legacy fixture routes retain their existing CSS and assertion contracts.


await writeFile(path.join(out, "navigation.ts"), `export { unstable_rethrow } from 'next/dist/client/components/unstable-rethrow.browser'; const router={push(){},replace(href){history.replaceState({},"",href);},refresh(){window.refreshes=(window.refreshes||0)+1;}}; export const useRouter=()=>router; export const usePathname=()=>'/fixture'; export const useSearchParams=()=>new URLSearchParams(window.location.search);`);
await writeFile(path.join(out, "link.tsx"), `import React from 'react'; export default function Link({href,children,prefetch,...props}) { return <a href={href} {...props}>{children}</a>; }`);
await writeFile(path.join(out, "image.tsx"), `import React from 'react'; export default function Image({fill,priority,unoptimized,quality,loader,...props}) { return <img {...props}/>; }`);
const {loadBindings} = require("next/dist/build/swc"); await loadBindings();
// Actual UI exports are used; only Action transports and the unrelated Menu items table are isolated.
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
await writeFile(path.join(out,'actions.ts'), `const run=(...args)=>window.action(...args); export const updateMenu=run,createMenuItem=run,savePageSeoAction=run,saveFooterBuilderAction=run,updateAdminSelfAccountAction=run,changeAdminPasswordAction=run,revokeAllAdminSessionsAction=run;`);
await writeFile(path.join(out,'empty.tsx'), `import React from 'react'; export default function Empty(){return null;}`);
await writeFile(path.join(out,"link-actions.ts"), "export const browseAdminLinksAjax=async()=>[];\nexport const browseMenusPickerAjax=async()=>[];\nexport const browseMenuItemsPickerAjax=async()=>[];\nexport const browseTopicCategoriesPickerAjax=async()=>[];\nexport const resolveAdminLinkAjax=async()=>[];");
const compiler = webpack({mode:"development",target:"web",context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"fixture.js"},devtool:false,
  plugins:[new webpack.NormalModuleReplacementPlugin(/(actions|page-seo-actions|MenuItemsTableClient|\/ui)$/, resource=>{
 const full=path.resolve(resource.context,resource.request).replaceAll('\\','/');
 if(full.endsWith('/components/admin/ui')) resource.request=path.join(root,'src/components/admin/ui/index.ts');
 else if(full.endsWith('/MenuItemsTableClient'))resource.request=path.join(out,'empty.tsx');
 else if(full.endsWith('/lib/admin/links/actions'))resource.request=path.join(out,'link-actions.ts');
 else if(/src\/app\/admin\/(pages-blocks\/(menus|footer|pages)|settings\/security)\/(actions|page-seo-actions)$/.test(full))resource.request=path.join(out,'actions.ts');
}),new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],
  resolve:{extensions:[".tsx",".ts",".jsx",".js"],alias:{"@src":path.join(root,"src"),"next/navigation":path.join(out,"navigation.ts"),"next/link":path.join(out,"link.tsx"),"next/image":path.join(out,"image.tsx")}},
  module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:[{loader:require.resolve("next/dist/build/webpack/loaders/next-swc-loader"),options:{rootDir:root,isServer:false,compilerType:"client",hasReactRefresh:false,nextConfig:{},jsConfig:{},swcCacheDir:path.join(out,"swc-cache"),serverComponents:false,serverReferenceHashSalt:"isolated-capability-qa",esm:false,transpilePackages:[]}}]}]}});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>error||closeError||stats?.hasErrors()?reject(error??closeError??new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors))):resolve())));
const bundle=await readFile(path.join(out,"fixture.js"));

const server=createServer((req,res)=>{ if(req.url==='/fixture.js'){res.setHeader('content-type','application/javascript');res.end(bundle);return;} res.setHeader('content-type','text/html');res.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{background:#080b10;color:white;font-family:Arial;padding:32px}button,input,textarea,a{padding:12px;margin:8px}button,a{cursor:pointer}button:disabled{cursor:default}[role=dialog]{position:fixed;inset:15%;background:#222;padding:20px;z-index:10001}[role=menu]{background:#333;position:fixed;z-index:10000} [role=menuitem]{display:block}fieldset{border:0}</style><div id="root"></div><script src="/fixture.js"></script></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const results=[];
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
async function check(name,run){if(only&&!name.startsWith(only))return;const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.goto(url);await page.waitForFunction(()=>typeof window.mount==='function');await run(page);assert.deepEqual(errors,[]);results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){console.error(JSON.stringify(errors));await page.screenshot({path:path.join(out,name.replaceAll(/[^a-z0-9]/gi,'-')+'-failure.png')});throw e;}finally{await context.close();await writeFile(path.join(out,only?'results-'+only+'.json':'results.json'),JSON.stringify({results,limits:'Mounted actual UI owners; deferred action ports and Next router isolated. Not Auth or database-save proof.'},null,2));}}
const mount=(p,k,o={})=>p.evaluate(([k,o])=>window.mount(k,o),[k,o]);
const mountIntegration=(p,k,o={})=>p.evaluate(([kind,overrides])=>window.mountIntegration(kind,overrides),[k,o]);
async function pending(p,field,button){await field.fill('Submitted draft');await button.click();await p.waitForFunction(()=>window.calls===1);assert.equal(await field.isDisabled(),true);assert.equal(await field.evaluate(el=>Boolean(el.closest('fieldset[inert]'))),true);await field.evaluate(el=>el.closest('form').requestSubmit());assert.equal(await p.evaluate(()=>window.calls),1);const payload=await p.evaluate(()=>window.payloads[0]);assert.ok(JSON.stringify(payload).includes('Submitted draft'),'Submitted values captured before disabling');await p.evaluate(()=>window.finish());await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));}


let integrationCss;

async function prepareIntegrationFixture(page, width) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (integrationCss === undefined) {
    const posix = value => value.replaceAll("\\", "/");
    const cssInput = `@import "tailwindcss" source(none);\n@source "${posix(path.join(root, "src/components/admin"))}";\n@source "${posix(path.join(root, "src/lib/admin/admin-ui-styles.ts"))}";\n@source "${posix(path.join(out, "entry.tsx"))}";\n`;
    integrationCss = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })]).process(cssInput, { from: path.join(out, "integration-input.css") })).css;
    await writeFile(path.join(out, "integration-fixture.css"), integrationCss);
  }
  // The canonical harness keeps its original document. Only this fixture replaces its mock style.
  const fixtureStyle = page.locator("head > style");
  assert.equal(await fixtureStyle.count(), 1, "The original fixture owns one mock stylesheet");
  await fixtureStyle.evaluate(element => element.remove());
  await page.addStyleTag({ content: integrationCss });
  await page.addStyleTag({ content: "body{margin:0;background:#080b10;color:white;font-family:Arial}" });
}

async function captureIntegrationSources() {
  const files = ["src/components/admin/integrations/IntegrationConnectionWizard.tsx", "src/components/admin/integrations/IntegrationsServerConfiguration.tsx", "src/components/admin/AdminFeedbackProvider.tsx", "src/components/admin/AdminNotice.tsx", "src/components/admin/AdminNoticeDismissibleFrame.tsx", "src/components/admin/ui/AdminConfirmDialog.tsx", "src/components/admin/ui/AdminModalButtons.tsx", "src/lib/admin/admin-action-feedback.ts", "src/lib/admin/integrations/integrations-contract.ts", "src/lib/admin/integrations/server-configuration-contract.ts", "scripts/qa-shared-corrections-adoption.mjs"];
  return Promise.all(files.map(async file => ({ file, sha256: createHash("sha256").update(await readFile(path.join(root, file))).digest("hex") })));
}

async function integrationTransport(page) {
  const calls = [], violations = [], consoleErrors = [], transportErrors = [];
  const handlers = new Set();
  const onConsole = message => { if (message.type() === "error") consoleErrors.push(message.text()); };
  page.on("console", onConsole);
  await page.evaluate(() => { window.integrationRequests = []; });
  const onRoute = async route => {
    const complete = Promise.withResolvers();
    handlers.add(complete.promise);
    try {
      const request = route.request(), target = new URL(request.url()), pathname = target.pathname;
      if (target.origin !== url) {
        violations.push({ method: request.method(), pathname, reason: "foreign-origin" });
        await route.abort("blockedbyclient");
        return;
      }
      if (request.method() === "GET" && !pathname.startsWith("/api/")) {
        await route.continue();
        return;
      }
      if (request.method() !== "POST" || !/^\/api\/admin\/integrations\/(?:google_analytics\/action|server-configuration\/(?:google|meta))$/.test(pathname)) {
        violations.push({ method: request.method(), pathname, reason: "unowned-action" });
        await route.abort("blockedbyclient");
        return;
      }
      const decision = Promise.withResolvers();
      const call = { pathname, method: request.method(), payload: request.postDataJSON(), decision, settled: false, status: null };
      calls.push(call);
      await page.evaluate(payload => window.integrationRequests.push(payload), { pathname, method: call.method, payload: call.payload });
      const outcome = await decision.promise;
      call.settled = true;
      call.status = outcome.abort ? "aborted" : outcome.status;
      if (outcome.abort) await route.abort("failed");
      else await route.fulfill({ status: outcome.status, contentType: "application/json", body: JSON.stringify(outcome.body) });
    } catch (error) {
      transportErrors.push(error.message);
    } finally {
      complete.resolve();
      handlers.delete(complete.promise);
    }
  };
  await page.route("**/*", onRoute);
  return {
    calls,
    async at(count) {
      await page.waitForFunction(expected => window.integrationRequests.length >= expected, count);
      assert.equal(calls.length, count, "One request for each actual user intent");
      return calls[count - 1];
    },
    reply(call, body, status = 200) { assert.equal(call.settled, false); call.decision.resolve({ status, body }); },
    failNetwork(call) { assert.equal(call.settled, false); call.decision.resolve({ abort: true }); },
    assertClean() {
      assert.deepEqual(violations, [], "Only the exact owned Integration action ports are invoked");
      assert.ok(calls.every(call => call.settled), "Every intercepted operation settles before cleanup");
      const expectedFailures = calls.filter(call => call.status === "aborted" || call.status >= 400).length;
      assert.ok(consoleErrors.length <= expectedFailures && consoleErrors.every(message => /^Failed to load resource:/.test(message)), `Unexpected console error: ${JSON.stringify(consoleErrors)}`);
      assert.deepEqual(transportErrors, [], "Fixture transport handlers propagate unexpected errors");
    },
    snapshot() {
      return { requests: calls.map(({ pathname, method, payload, status }) => ({ pathname, method, payload, status })), expectedFailureConsoleMessages: consoleErrors, unownedRequests: violations, transportErrors };
    },
    async dispose() {
      for (const call of calls) if (!call.settled) call.decision.resolve({ abort: true });
      await Promise.all([...handlers]);
      await page.unroute("**/*", onRoute);
      page.off("console", onConsole);
      assert.equal(handlers.size, 0, "All fixture-owned request handlers finish");
      assert.ok(calls.every(call => call.settled), "Fixture cleanup releases every pending request");
      assert.deepEqual(transportErrors, [], "Fixture transport cleanup preserves failures");
      return { pendingRequests: calls.filter(call => !call.settled).length, pendingHandlers: handlers.size, routeRemoved: true, consoleListenerRemoved: true };
    },
  };
}

async function runIntegrationCase(page, width, kind, verify) {
  const startedAt = new Date().toISOString(), startedClock = performance.now(), sourcesBefore = await captureIntegrationSources();
  let transport, failure, cleanupError, cleanup;
  try {
    await prepareIntegrationFixture(page, width);
    transport = await integrationTransport(page);
    await verify(page, width, transport);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try { cleanup = await transport?.dispose(); } catch (error) { cleanupError = error; }
    const sources = await captureIntegrationSources(), inputsUnchanged = JSON.stringify(sourcesBefore) === JSON.stringify(sources);
    const receipt = { name: `integrations-${kind}-${width}-rtl`, status: failure || cleanupError || !inputsUnchanged ? "FAIL" : "PASS", startedAt, elapsedMs: Math.round(performance.now() - startedClock), sourcesBefore, sources, inputsUnchanged, ownedFixtureUrl: url, cssSha256: createHash("sha256").update(integrationCss ?? "").digest("hex"), entrySha256: createHash("sha256").update(entry).digest("hex"), transport: transport?.snapshot(), cleanup, ...(failure ? { error: failure.message } : {}), ...(cleanupError ? { cleanupError: cleanupError.message } : {}), limits: "Actual Integration consumer, Feedback and Confirmation owners in a root StrictMode fixture with actual Tailwind CSS; intercepted synthetic commands only. Shared runner/server/launcher/finally follow baseline. Context/browser/server cleanup belongs to that unchanged harness and is not claimed complete before it exits." };
    await writeFile(path.join(out, receipt.name + "-proof.json"), JSON.stringify(receipt, null, 2));
    console.log("Integration fixture evidence: " + path.join(out, receipt.name + "-proof.json"));
    if (cleanupError) throw cleanupError;
    assert.equal(inputsUnchanged, true, "Integration proof inputs remain unchanged within this case");
  }
}
function integrationEntry(page,channel){return page.locator(`[data-admin-feedback-entry][data-admin-feedback-channel="${channel}"]`);}
async function assertIntegrationFeedback(page,channel,variant,message){
 const entry=integrationEntry(page,channel);await entry.waitFor({state:'visible'});
 assert.equal(await entry.count(),1,'One canonical Feedback entry per operation');
 assert.equal(await entry.getAttribute('data-admin-feedback-variant'),variant);
 assert.equal(await entry.getByText(variant==='success'?'تم الإجراء':'تعذر إكمال الإجراء',{exact:true}).count(),1,'Shared notice preserves the approved operation title');
 if(message)assert.equal(await entry.getByText(message,{exact:true}).count(),1);
 const contract=await page.evaluate(channel=>window.integrationFeedbackEntries.filter(item=>item.channel===channel).map(item=>({placement:item.placement,critical:item.critical,reveal:item.reveal,layout:item.feedback.layout,lifecycle:item.feedback.lifecycle,dismissible:item.feedback.dismissible})),channel);
 assert.deepEqual(contract,[{placement:'inline',critical:false,reveal:false,layout:'stacked',lifecycle:'manual',dismissible:true}]);
 assert.equal(await page.locator('p[role=alert],p[role=status]').count(),0,'No parallel local action-result paragraph remains');
 assert.equal(await page.locator('[data-admin-feedback-channel-viewport]').filter({has:entry}).count(),1);
 return entry;
}
async function assertIntegrationLayout(page,label,width){
 assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 const layout=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,feedback:[...document.querySelectorAll('[data-admin-feedback-channel-viewport] [data-admin-feedback-entry]')].map(element=>{const box=element.getBoundingClientRect();return{left:box.left,right:box.right,width:box.width,client:element.clientWidth,scroll:element.scrollWidth};})}));
 assert.equal(layout.viewport,width);
 assert.ok(layout.document<=width&&layout.body<=width,`No horizontal overflow at ${width}px: ${JSON.stringify(layout)}`);
 assert.ok(layout.feedback.every(box=>box.left>=-1&&box.right<=width+1&&box.scroll<=box.client+1),`Inline notice remains in the viewport without clipping: ${JSON.stringify(layout)}`);
 await page.screenshot({path:path.join(out,`${label}-${width}-rtl.png`),fullPage:true});
}
async function publishUnrelatedIntegrationFeedback(page){
 await page.evaluate(()=>window.publishUnrelatedIntegrationFeedback());
 await page.getByText('Unrelated critical fixture must survive.',{exact:true}).waitFor();
}
async function assertUnrelatedIntegrationFeedback(page){
 assert.equal(await integrationEntry(page,'integration-fixture:unrelated').count(),1,'Consumer clears never remove unrelated critical feedback');
 assert.equal(await page.locator('[data-admin-feedback-viewport]').count(),1,'There is one canonical global viewport');
}
async function verifyIntegrationWizard(page,width,transport){
 const channel='integration-connection:google_analytics';
 await page.evaluate(()=>history.replaceState({},'','?action=test&error=fixture-query-error&notice=fixture-query-notice'));
 const originalSearch=new URL(page.url()).search;
 const incoming={callbackError:'Fixture OAuth callback failure',requestedAction:'test'};
 await mountIntegration(page,'integration-wizard',incoming);
 await assertIntegrationFeedback(page,channel,'danger',incoming.callbackError);
 await publishUnrelatedIntegrationFeedback(page);
 await mountIntegration(page,'integration-wizard',incoming);
 assert.equal(await integrationEntry(page,channel).count(),1,'StrictMode/rerender does not duplicate callback feedback');
 await integrationEntry(page,channel).getByRole('button',{name:'إغلاق الإشعار',exact:true}).click();
 assert.equal(new URL(page.url()).search,originalSearch,'Operation-feedback dismissal preserves every existing query parameter');
 await mountIntegration(page,'integration-wizard',incoming);
 assert.equal(await integrationEntry(page,channel).count(),0,'Same callback is not republished after dismissal');
 const diagnose=page.getByRole('button',{name:'تشخيص الاتصال',exact:true});
 await diagnose.click();let call=await transport.at(1);
 assert.deepEqual(call.payload,{operation:'diagnose',connectionId:'fixture-connection'});
 assert.equal(await diagnose.isDisabled(),true);
 await diagnose.evaluate(element=>{element.click();element.click();});
 assert.equal(transport.calls.length,1,'Pending blocks duplicate commands');
 assert.equal(await integrationEntry(page,channel).count(),0);
 transport.reply(call,{ok:false,error:'Fixture diagnosis failure'},503);
 await assertIntegrationFeedback(page,channel,'danger','Fixture diagnosis failure');
 assert.equal(await page.evaluate(()=>window.refreshes??0),0,'Failure never refreshes source data');
 await diagnose.click();call=await transport.at(2);
 transport.reply(call,{ok:true,result:{message:'Fixture diagnosis recovered',code:'fixture-recovered'}});
 await assertIntegrationFeedback(page,channel,'success','Fixture diagnosis recovered (fixture-recovered)');
 await page.waitForFunction(()=>window.refreshes===1);
 await diagnose.click();call=await transport.at(3);
 assert.equal(await integrationEntry(page,channel).count(),0,'Retry clears only its stale result before transport');
 await assertUnrelatedIntegrationFeedback(page);
 transport.failNetwork(call);
 await assertIntegrationFeedback(page,channel,'danger');
 assert.match(await integrationEntry(page,channel).innerText(),/Failed to fetch/);
 await diagnose.click();call=await transport.at(4);
 transport.reply(call,{ok:true,result:{message:'Fixture network retry recovered'}});
 await assertIntegrationFeedback(page,channel,'success','Fixture network retry recovered');
 const disconnect=page.getByRole('button',{name:'فصل الاتصال',exact:true});
 await disconnect.click();let dialog=page.getByRole('dialog',{name:'فصل Google Analytics 4؟',exact:true});
 await dialog.waitFor();await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();
 await dialog.waitFor({state:'detached'});
 assert.equal(transport.calls.length,4,'Cancel does not send a disconnect request');
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='فصل الاتصال');
 await disconnect.click();dialog=page.getByRole('dialog',{name:'فصل Google Analytics 4؟',exact:true});
 const confirm=dialog.locator('[data-admin-confirm-submit]');
 assert.equal((await confirm.innerText()).trim(),'فصل وحذف Credentials');
 await confirm.click();call=await transport.at(5);
 assert.deepEqual(call.payload,{operation:'disconnect',connectionId:'fixture-connection'});
 assert.equal(await confirm.isDisabled(),true);
 await confirm.evaluate(element=>element.click());assert.equal(transport.calls.length,5);
 transport.reply(call,{ok:false,error:'Fixture disconnect failure'},503);
 await assertIntegrationFeedback(page,channel,'danger','Fixture disconnect failure');
 assert.equal(await dialog.count(),1,'Failure retains the confirmation and command intent');
 await confirm.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('[data-admin-confirm-submit]')?.disabled===false);
 await confirm.click();call=await transport.at(6);transport.reply(call,{ok:true});
 await dialog.waitFor({state:'detached'});
 await assertIntegrationFeedback(page,channel,'success','فصل الاتصال تم بنجاح.');
 await page.waitForFunction(()=>window.refreshes===3);
 await assertUnrelatedIntegrationFeedback(page);
 await assertIntegrationLayout(page,'wizard-success',width);
 await mountIntegration(page,'integration-wizard',{callbackError:'Changed callback failure'});
 await assertIntegrationFeedback(page,channel,'danger','Changed callback failure');
 await assertIntegrationLayout(page,'wizard-error',width);
 await diagnose.click();call=await transport.at(7);
 await mountIntegration(page,'integration-wizard',{hideConsumer:true});
 await page.waitForFunction(channel=>window.integrationFeedbackEntries.every(entry=>entry.channel!==channel),channel);
 transport.reply(call,{ok:true,result:{message:'Late completed command'}});
 await page.waitForFunction(()=>window.refreshes===4);
 assert.equal(await integrationEntry(page,channel).count(),0,'Late completion cannot republish an unmounted consumer channel');
 await assertUnrelatedIntegrationFeedback(page);
 transport.assertClean(`wizard-${width}`);
}
async function verifyIntegrationConfiguration(page,width,transport){
 const channel='integration-server-configuration:google',peer='integration-server-configuration:meta';
 await page.evaluate(()=>history.replaceState({},'','?action=configure&error=fixture-query-error&notice=fixture-query-notice'));
 const originalSearch=new URL(page.url()).search;
 await mountIntegration(page,'integration-configuration');await publishUnrelatedIntegrationFeedback(page);
 const google=page.locator('article#google'),meta=page.locator('article#meta');
 const googleTest=google.getByRole('button',{name:'اختبار الإعداد',exact:true});
 await meta.getByRole('button',{name:'اختبار الإعداد',exact:true}).click();let call=await transport.at(1);
 transport.reply(call,{ok:false,error:'integration_app_configuration_version_conflict'},409);
 await assertIntegrationFeedback(page,peer,'danger','تغيّر الإعداد بواسطة جلسة أخرى. أعد تحميل الصفحة.');
 await googleTest.click();call=await transport.at(2);
 assert.deepEqual(call.payload,{operation:'test',expectedVersion:7});
 const pendingTest=google.getByRole('button',{name:'جارٍ الاختبار…',exact:true});
 assert.equal(await pendingTest.isDisabled(),true);await pendingTest.evaluate(element=>element.click());assert.equal(transport.calls.length,2);
 assert.equal(await integrationEntry(page,peer).count(),1,'A different SurfaceCard error is preserved during this operation');
 transport.reply(call,{ok:true});
 await assertIntegrationFeedback(page,channel,'success','اكتمل الاختبار الآمن. راجع حالة كل اتصال أدناه.');
 await integrationEntry(page,channel).getByRole('button',{name:'إغلاق الإشعار',exact:true}).click();
 assert.equal(new URL(page.url()).search,originalSearch,'Configuration feedback dismissal does not consume route query state');
 await google.locator('input[name=google_client_id]').fill('fixture-replacement-id');
 await google.locator('input[name=google_client_secret]').fill('fixture-replacement-not-a-secret');
 await google.getByRole('button',{name:'حفظ / استبدال',exact:true}).click();call=await transport.at(3);
 assert.deepEqual(call.payload,{operation:'save',expectedVersion:7,values:{google_client_id:'fixture-replacement-id',google_client_secret:'fixture-replacement-not-a-secret'}});
 assert.equal(await google.locator('input[type=password]').inputValue(),'','Existing secret-clearing contract remains unchanged');
 transport.reply(call,{ok:true});
 await assertIntegrationFeedback(page,channel,'success','حُفظ الإعداد داخل Vault دون إعادة أي Secret إلى المتصفح.');
 await page.waitForFunction(()=>window.refreshes===2);
 await googleTest.click();call=await transport.at(4);transport.reply(call,{ok:false,error:'integration_app_configuration_test_rate_limited'},429);
 await assertIntegrationFeedback(page,channel,'danger','وصل اختبار الإعداد إلى الحد الآمن. حاول لاحقًا.');
 await googleTest.click();call=await transport.at(5);transport.reply(call,{ok:false,error:'fixture-sensitive-unknown-error'},400);
 await assertIntegrationFeedback(page,channel,'danger','تعذر إكمال الإجراء. راجع Diagnostics دون كشف بيانات الاعتماد.');
 assert.equal(await page.getByText('fixture-sensitive-unknown-error',{exact:true}).count(),0,'Unknown server diagnostics remain sanitized');
 await googleTest.click();call=await transport.at(6);transport.failNetwork(call);
 await assertIntegrationFeedback(page,channel,'danger','تعذر الوصول إلى Server Configuration owner.');
 assert.equal(await page.evaluate(()=>window.refreshes??0),2,'All failed tests leave the previous read model untouched');
 await googleTest.click();call=await transport.at(7);transport.reply(call,{ok:true});
 await assertIntegrationFeedback(page,channel,'success','اكتمل الاختبار الآمن. راجع حالة كل اتصال أدناه.');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('isolated clipboard failure');}}}));
 await google.getByRole('button',{name:'نسخ',exact:true}).click();
 await assertIntegrationFeedback(page,channel,'danger','تعذر نسخ Callback URL من المتصفح الحالي.');
 assert.equal(transport.calls.length,7,'Clipboard failure never invokes the Integration API');
 await assertIntegrationLayout(page,'configuration-error',width);
 const remove=google.getByRole('button',{name:'حذف App Configuration',exact:true});
 await remove.click();let dialog=page.getByRole('dialog',{name:'حذف إعداد Google fixture؟',exact:true});
 await dialog.waitFor();await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.equal(transport.calls.length,7,'Cancel does not send a removal command');
 await remove.click();dialog=page.getByRole('dialog',{name:'حذف إعداد Google fixture؟',exact:true});
 const confirm=dialog.locator('[data-admin-confirm-submit]');
 assert.equal((await confirm.innerText()).trim(),'حذف من Vault');
 await confirm.click();call=await transport.at(8);
 assert.deepEqual(call.payload,{operation:'remove',expectedVersion:7});assert.equal(await confirm.isDisabled(),true);
 transport.reply(call,{ok:false,error:'integration_app_configuration_version_conflict'},409);
 await assertIntegrationFeedback(page,channel,'danger','تغيّر الإعداد بواسطة جلسة أخرى. أعد تحميل الصفحة.');
 assert.equal(await dialog.count(),1,'The existing failed-return branch retains the removal dialog');
 await page.waitForFunction(()=>document.querySelector('[data-admin-confirm-submit]')?.disabled===false);
 await confirm.click();call=await transport.at(9);transport.reply(call,{ok:true});await dialog.waitFor({state:'detached'});
 await assertIntegrationFeedback(page,channel,'success','حُذف App Configuration وأصبحت الاتصالات المتأثرة بحاجة لإعادة التفويض.');
 await page.waitForFunction(()=>window.refreshes===4);
 assert.equal(await integrationEntry(page,peer).count(),1,'Consumer-owned clear preserves other SurfaceCard error feedback');
 await assertUnrelatedIntegrationFeedback(page);
 await assertIntegrationLayout(page,'configuration-success',width);
 await mountIntegration(page,'integration-configuration',{snapshot:{migrationRegistered:false}});
 assert.equal(await googleTest.isDisabled(),true,'Missing infrastructure keeps mutation actions fail closed');
 assert.equal(await google.getByRole('button',{name:'حفظ / استبدال',exact:true}).isDisabled(),true);
 assert.equal(await remove.isDisabled(),true);
 assert.equal(transport.calls.length,9);
 await mountIntegration(page,'integration-configuration');await googleTest.click();call=await transport.at(10);
 await mountIntegration(page,'integration-configuration',{hideConsumer:true});
 await page.waitForFunction(()=>window.integrationFeedbackEntries.every(entry=>!entry.channel.startsWith('integration-server-configuration:')));
 transport.reply(call,{ok:true});await page.waitForFunction(()=>window.refreshes===5);
 assert.equal(await integrationEntry(page,channel).count(),0,'Late completion does not recreate an unmounted SurfaceCard feedback entry');
 await assertUnrelatedIntegrationFeedback(page);
 transport.assertClean(`configuration-${width}`);
}
try {
await check('native-menu-fields',async p=>{await mount(p,'menu');await p.getByRole('tab',{name:'بيانات القائمة',exact:true}).click();await pending(p,p.locator('input[name=name]'),p.getByRole('button',{name:'حفظ بيانات القائمة',exact:true}));});
await check('native-menu-item-fields',async p=>{await mount(p,'menuitem');await pending(p,p.locator('input[name=label]'),p.getByRole('button',{name:'Save item',exact:true}));});
await check('native-page-seo-fields',async p=>{await mount(p,'seo');await pending(p,p.locator('#page-seo-title'),p.locator('form button[type=submit]'));});
await check('security-delayed-read-failure-retry',async p=>{await mount(p,'security');await p.getByRole('tab',{name:'بيانات الحساب',exact:true}).click();const name=p.getByPlaceholder('الاسم الكامل');await name.fill('Unsaved name');await mount(p,'security',{fullName:'Late server name'});assert.equal(await name.inputValue(),'Unsaved name');await p.getByRole('button',{name:'حفظ بيانات الحساب',exact:true}).click();await p.waitForFunction(()=>window.calls===1);assert.equal(await name.isDisabled(),true);await p.evaluate(()=>window.reject());await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));assert.equal(await name.inputValue(),'Unsaved name');await p.getByRole('button',{name:'حفظ بيانات الحساب',exact:true}).click();await p.waitForFunction(()=>window.calls===2);await p.evaluate(()=>window.finish({success:true,fullName:'Unsaved name',email:'fixture@example.test'}));await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));await name.fill('Newer unsaved');await mount(p,'security',{fullName:'Stale saved name'});assert.equal(await name.inputValue(),'Newer unsaved');});
await check('footer-delayed-read-failure-retry',async p=>{await mount(p,'footer');await p.getByRole('tab',{name:'السوشيال والقانوني',exact:true}).click();const field=p.locator('[role=tabpanel]:visible input:not([type=checkbox])').first();await field.fill('Unsaved footer');await mount(p,'footer',{legal:{copyright:'Late source',privacyLabel:'Privacy',privacyHref:'/privacy',termsLabel:'Terms',termsHref:'/terms'}});assert.equal(await field.inputValue(),'Unsaved footer');await p.getByRole('button',{name:'حفظ الفوتر',exact:true}).click();await p.waitForFunction(()=>window.calls===1);assert.equal(await field.isDisabled(),true);await p.evaluate(()=>window.reject());await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));assert.equal(await field.inputValue(),'Unsaved footer');await p.getByRole('button',{name:'حفظ الفوتر',exact:true}).click();await p.waitForFunction(()=>window.calls===2);await p.evaluate(()=>window.finish({ok:true,status:'success',code:'synced',message:'تم حفظ إعدادات الفوتر بنجاح.'}));await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));await field.fill('Newer footer');await mount(p,'footer',{legal:{copyright:'Another late source',privacyLabel:'Privacy',privacyHref:'/privacy',termsLabel:'Terms',termsHref:'/terms'}});assert.equal(await field.inputValue(),'Newer footer');});
await check('media-feedback-legacy-clear-current',async p=>{await p.evaluate(()=>history.replaceState({},'','/?error=legacy'));await mount(p,'feedback');await p.waitForFunction(()=>document.querySelectorAll('[data-admin-feedback-entry]').length===1);assert.equal(await p.getByText('Legacy media failure',{exact:true}).count(),1);await p.locator('[data-admin-feedback-entry] button').click();assert.equal(new URL(p.url()).searchParams.has('error'),false);await p.getByRole('button',{name:'Save feedback'}).click();await p.waitForFunction(()=>window.calls===1);assert.equal(await p.locator('[data-admin-feedback-entry]').count(),0);await p.evaluate(()=>window.finish());await p.waitForFunction(()=>document.querySelectorAll('[data-admin-feedback-entry]').length===1);assert.equal(await p.getByText('Current save failure',{exact:true}).count(),1);});
await check('draft-clean-and-email-source-contract',async p=>{
  await mount(p,'security');await p.getByRole('tab',{name:'بيانات الحساب',exact:true}).click();
  await mount(p,'security',{fullName:'Clean source',email:'clean@example.test'});
  assert.equal(await p.getByPlaceholder('الاسم الكامل').inputValue(),'Clean source');
  const email=p.getByPlaceholder('البريد الإلكتروني');assert.equal(await email.inputValue(),'clean@example.test');
  await email.fill('dirty@example.test');await mount(p,'security',{fullName:'Later source',email:'later@example.test'});
  assert.equal(await email.inputValue(),'dirty@example.test');
  await mount(p,'footer');await p.getByRole('tab',{name:'السوشيال والقانوني',exact:true}).click();
  await mount(p,'footer',{legal:{copyright:'Clean incoming',tagline:''}});
  assert.equal(await p.getByLabel('Copyright',{exact:true}).inputValue(),'Clean incoming');
});
await check('footer-slot-late-source',async p=>{
  await mount(p,'footer');await p.getByRole('tab',{name:'العمود الأول',exact:true}).click();
  const heading=p.locator('[role=tabpanel]:visible').getByPlaceholder('يُترك فارغًا لإخفاء التسمية الذهبية');
  await heading.fill('Unsaved slot heading');
  const slots=await p.evaluate(()=>structuredClone(window.footerFixture.slots));slots.slots[0].heading='Late server heading';
  await mount(p,'footer',{slots});assert.equal(await heading.inputValue(),'Unsaved slot heading');
  await p.getByRole('button',{name:'حفظ الفوتر',exact:true}).click();await p.waitForFunction(()=>window.calls===1);
  assert.equal(await p.evaluate(()=>window.payloads[0].slots.slots[0].heading),'Unsaved slot heading');
  slots.slots[0].heading='Incoming during save';await mount(p,'footer',{slots});
  assert.equal(await heading.inputValue(),'Unsaved slot heading');assert.equal(await heading.isDisabled(),true);
  await p.evaluate(()=>window.finish({ok:true,status:'success',code:'synced',message:'تم حفظ إعدادات الفوتر بنجاح.'}));await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));
});
await check('footer-restore-removed',async p=>{
  await mount(p,'footer');
  assert.equal(await p.getByRole('button',{name:'استعادة الافتراضي',exact:true}).count(),0);
  assert.equal(await p.getByRole('dialog',{name:'استعادة الفوتر الافتراضي',exact:true}).count(),0);
  assert.equal(await p.getByRole('button',{name:'حفظ الفوتر',exact:true}).count(),1);
  assert.equal(await p.evaluate(()=>window.calls),0);
});
for(const width of [1440,390,320]){
 await check(`integrations-wizard-${width}-rtl`,page=>runIntegrationCase(page,width,"wizard",verifyIntegrationWizard));
 await check(`integrations-configuration-${width}-rtl`,page=>runIntegrationCase(page,width,"configuration",verifyIntegrationConfiguration));
}
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
