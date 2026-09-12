import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/shared-capability-completion/browser");
await mkdir(out, { recursive: true });
const entry = String.raw`
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminFeedbackProvider, { useAdminFeedback } from "@src/components/admin/AdminFeedbackProvider";
import AdminFormRuntime from "@src/components/admin/ui/AdminFormRuntime";
import AdminDatePicker, { openAdminDatePicker } from "@src/components/admin/ui/AdminDatePicker";
import TopicDateLabelField from "@src/components/admin/content/editors/article/TopicDateLabelField";
import { BlockEditorSaveFeedback } from "@src/components/admin/page-blocks/BlockEditorContextHeader";
import {resolveHeroContentControlsForVariant} from "@src/lib/hero/hero-content-controls";
import ProjectDetailsHero from "@src/components/projects/details/ProjectDetailsHero";
import AdminDataGridRowActions from "@src/components/admin/ui/AdminDataGridRowActions";
import AdminEntityPreviewActions from "@src/components/admin/ui/AdminEntityPreviewActions";
import { AdminFloatingLayerProvider } from "@src/components/admin/entity-list/AdminFloatingLayerContext";
import { useAdminBoundedClientInstantMutation } from "@src/lib/admin/entity-list/data-engine/instant-mutation";
import { mapAdminActionResultToFeedback } from "@src/lib/admin/admin-action-feedback";
const rows = [{id: 1, name: 'Fixture'}];
const client = new QueryClient({defaultOptions: {queries:{retry:false}, mutations:{retry:false}}});
const root = createRoot(document.getElementById('root'));
window.calls = 0; window.duplicateCalls = 0; window.errors = []; window.formValues = [];
class RedirectBoundary extends React.Component {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error) {
    if (!error.digest?.startsWith('NEXT_REDIRECT;')) { window.errors.push(String(error)); return; }
    window.mount('form', {...window.options, saved:true, warning:window.nextWarning, revision:String(Date.now()), value:window.savedValue});
  }
  render() { return this.state.failed ? null : this.props.children; }
}
function FormFixture({saved=false, warning=false, revision='0', value='Initial'}) {
  async function save(data) {
    window.calls++; window.formValues.push([...data.entries()]); window.savedValue = data.get('title');
    const outcome = await new Promise(resolve => { window.finishSave = resolve; });
    if(outcome === 'error') throw new Error('isolated save rejected');
    window.nextWarning = outcome === 'warning';
    throw Object.assign(new Error('NEXT_REDIRECT'), {digest:'NEXT_REDIRECT;replace;/fixture?saved=1;303;'});
  }
  return <RedirectBoundary key={revision}><AdminFormRuntime mode="edit" entityKey="schema-fixture" redirectAction={save}>
    <BlockEditorSaveFeedback backHref="/fixture" entityKey="schema-fixture" saved={saved} mediaSynchronizationWarning={warning} savedRevision={revision} message="Fixture saved" />
    <label>Title<input name="title" defaultValue={value}/></label>
    <AdminDatePicker name="date" defaultValue="2026-09-12"/>
    <textarea name="body" defaultValue="Body"/>
    <button type="submit">Save fixture</button>
  </AdminFormRuntime></RedirectBoundary>;
}
function DateFixture() {
  const [date,setDate]=useState('2026-09-12'); const ref=React.useRef(null);
  return <form dir="rtl"><label>Date<AdminDatePicker ref={ref} name="date" aria-label="Date" value={date} onChange={e=>setDate(e.target.value)} min="2026-09-01" max="2026-09-30"/></label>
    <button type="button" onClick={()=>openAdminDatePicker(ref.current)}>Open calendar</button>
    <AdminDatePicker aria-label="Local time" name="local_time" type="datetime-local" defaultValue="2026-09-12T09:30"/>
    <AdminDatePicker aria-label="Invalid date" name="invalid" defaultValue="not-a-date"/>
    <AdminDatePicker aria-label="Empty date" name="empty" defaultValue=""/>
    <TopicDateLabelField defaultValue="Legacy text" publishedAt="2026-09-12T09:30:00Z"/>
    <output data-value="">{date}</output></form>;
}
function RowsFixture() {
  const data = useAdminBoundedClientInstantMutation({entity:'isolated-qa',initialRows:rows});
  const feedback = useAdminFeedback();
  async function remove() {
    feedback.clearFeedback('row-fixture');
    try {
      await data.mutateAsync({rowId:1,action:'delete',optimistic:cache=>cache.removeRows(new Set([1])),execute:async()=>{
        window.calls++; const ok=await new Promise(resolve=>window.finishRow=resolve);
        return ok?{ok:true,message:'Removed'}:{ok:false,code:'fixture',message:'Rejected'};
      }});
      feedback.publishFeedback(mapAdminActionResultToFeedback({ok:true,title:'Done',message:'Removed'}),{channel:'row-fixture'});
    } catch(error) {
      feedback.publishFeedback(mapAdminActionResultToFeedback({ok:false,title:'Failed',message:error.message}),{channel:'row-fixture'}); throw error;
    }
  }
  window.duplicateMutation = async()=>{ try { await data.mutateAsync({rowId:1,action:'delete',optimistic:()=>{},execute:async()=>{window.duplicateCalls++;return {ok:true,message:'unexpected'};}}); } catch(e) {return e.code;} };
  const hidden={access:'hidden'};
  return <AdminFloatingLayerProvider><section tabIndex={-1} data-admin-entity-list=""><button id="focus-fallback">Collection focus</button>
    <output id="row-count">{data.rows.length}</output>
    {data.rows.map(row=><AdminDataGridRowActions key={row.id} capability={{entityType:'fixture',entityId:row.id,entityLabel:row.name,actions:{
      edit:{access:'allowed',href:'/edit/1'},preview:{access:'allowed',href:'/preview/1'},information:hidden,copyPublicLink:hidden,visibility:hidden,featured:hidden,duplicate:hidden,archive:hidden,
      delete:{access:'allowed',onSelect:remove,confirmation:{mode:'shared',title:'Remove fixture?',description:'Isolated only',confirmLabel:'Confirm removal'}}
    }}} />)}
    </section></AdminFloatingLayerProvider>;
}
function PreviewFixture({status='published',access='allowed',href='/public/1'}) {
  return <AdminEntityPreviewActions capability={{entityType:'fixture',entityId:1,publicationStatus:status,routes:{internalPreview:'/admin/preview/1',publicView:href},access:{'internal-preview':'allowed','public-view':access}}}/>;
}
function BrochureFixture({href=null,hidden=false}) {
  const project = {id:1,slug:'fixture',name:'Fixture project',title:'Fixture project',code:'QA',brochureUrl:href,images:[],gallery:[],heroImage:{src:'/fixture.png',alt:'Fixture'},heroBoxImage:{src:'/fixture.png',alt:'Fixture'},location:{label:'Fixture'},locationLabel:'Fixture',category:'residential',locationTags:[]};
  return <ProjectDetailsHero project={project} presentation={{...resolveHeroContentControlsForVariant({},"project-detail"),showProjectDownloadAction:!hidden}}/>;
}
window.mount = (kind, options={}) => {
  window.options=options;
  const Component={form:FormFixture,date:DateFixture,rows:RowsFixture,preview:PreviewFixture,brochure:BrochureFixture}[kind];
  root.render(<QueryClientProvider client={client}><AdminFeedbackProvider><Component {...options}/></AdminFeedbackProvider></QueryClientProvider>);
};
window.mount('date');
`;
await writeFile(path.join(out, "entry.tsx"), entry);
await writeFile(path.join(out, "navigation.ts"), `export { unstable_rethrow } from 'next/dist/client/components/unstable-rethrow.browser'; const router={push(){},replace(){},refresh(){}}; export const useRouter=()=>router; export const usePathname=()=>'/fixture'; const params=new URLSearchParams(); export const useSearchParams=()=>params;`);
await writeFile(path.join(out, "link.tsx"), `import React from 'react'; export default function Link({href,children,prefetch,...props}) { return <a href={href} {...props}>{children}</a>; }`);
await writeFile(path.join(out, "image.tsx"), `import React from 'react'; export default function Image({fill,priority,unoptimized,quality,loader,...props}) { return <img {...props}/>; }`);
const {loadBindings} = require("next/dist/build/swc"); await loadBindings();
// Avoid loading unrelated barrel exports/server actions into an isolated client
// bundle. These are the actual UI owners reached by BlockEditorContextHeader.
await writeFile(path.join(out,"ui.ts"), `export {default as AdminActionButton} from '@src/components/admin/ui/AdminActionButton'; export {default as AdminPageContextHeader} from '@src/components/admin/ui/AdminPageContextHeader';`);
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({mode:"development",target:"web",context:root,entry:path.join(out,"entry.tsx"),output:{path:out,filename:"fixture.js"},devtool:false,
  plugins:[new webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],
  resolve:{extensions:[".tsx",".ts",".jsx",".js"],alias:{"../ui$":path.join(out,"ui.ts"),"@src":path.join(root,"src"),"next/navigation":path.join(out,"navigation.ts"),"next/link":path.join(out,"link.tsx"),"next/image":path.join(out,"image.tsx")}},
  module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:[{loader:require.resolve("next/dist/build/webpack/loaders/next-swc-loader"),options:{rootDir:root,isServer:false,compilerType:"client",hasReactRefresh:false,nextConfig:{},jsConfig:{},swcCacheDir:path.join(out,"swc-cache"),serverComponents:false,serverReferenceHashSalt:"isolated-capability-qa",esm:false,transpilePackages:[]}}]}]}});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>error||closeError||stats?.hasErrors()?reject(error??closeError??new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors))):resolve())));
const bundle=await readFile(path.join(out,"fixture.js"));
const server=createServer((req,res)=>{ if(req.url==='/fixture.js'){res.setHeader('content-type','application/javascript');res.end(bundle);return;} res.setHeader('content-type','text/html');res.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{background:#080b10;color:white;font-family:Arial;padding:32px}button,input,textarea,a{padding:12px;margin:8px}button,a{cursor:pointer}button:disabled{cursor:default}[role=dialog]{position:fixed;inset:15%;background:#222;padding:20px;z-index:10001}[role=menu]{background:#333;position:fixed;z-index:10000} [role=menuitem]{display:block}fieldset{border:0}</style><div id="root"></div><script src="/fixture.js"></script></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const results=[];
const only=process.argv.find(arg=>arg.startsWith("--only="))?.slice(7);
async function check(label,run){if(only && !label.includes(only)) return; await run();results.push(label);console.log(`PASS ${label}`);}
try {
  for(const timezoneId of ['Africa/Cairo','America/Los_Angeles']) {
    const context=await browser.newContext({timezoneId});
    await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
    const page=await context.newPage(); await page.goto(url); await page.waitForSelector('[data-admin-date-picker]');
    await check(`VEN-A08 native contract ${timezoneId}`,async()=>{
      assert.equal(await page.getByLabel('Local time',{exact:true}).inputValue(),'2026-09-12T09:30');
      assert.equal(await page.getByLabel('Invalid date',{exact:true}).inputValue(),'');
      assert.equal(await page.getByLabel('Empty date',{exact:true}).inputValue(),'');
      assert.equal(await page.locator('[name=date_label]').inputValue(),'Legacy text');
      const date=page.getByLabel('Date',{exact:true}); await date.fill(''); assert.equal(await date.inputValue(),'');
      await date.fill('2026-08-31'); assert.equal(await date.evaluate(el=>el.validity.rangeUnderflow),true);
      await date.fill('2026-10-01'); assert.equal(await date.evaluate(el=>el.validity.rangeOverflow),true);
      await date.fill('2026-09-30'); assert.equal(await date.evaluate(el=>el.checkValidity()),true);
      const keyboardDate=page.getByLabel('Empty date',{exact:true}); await keyboardDate.fill('2026-09-12'); await keyboardDate.focus(); await page.keyboard.press('ArrowUp'); assert.notEqual(await keyboardDate.inputValue(),'2026-09-12');
      await date.fill('2026-09-12');
      await page.getByRole('button',{name:'Open calendar'}).evaluate(el=>{HTMLInputElement.prototype.showPicker=()=>{throw new DOMException('unsupported');};el.click();});
      assert.equal(await date.evaluate(el=>document.activeElement===el),true);
      assert.equal(await page.locator('form').getAttribute('dir'),'rtl');
    }); await context.close();
  }
  const page=await browser.newPage(); const browserErrors=[]; page.on('pageerror',e=>browserErrors.push(String(e)));
  await page.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
  await page.goto(url); await page.waitForFunction(()=>typeof window.mount==='function');
  await check('VEN-A07 shared redirect feedback, failed save, busy, retained values, retry success/warning',async()=>{
    await page.evaluate(()=>window.mount('form')); await page.getByRole('button',{name:'Save fixture'}).waitFor();
    await page.locator('[name=title]').fill('Retained title'); await page.locator('[name=body]').fill('Retained body');
    await page.getByRole('button',{name:'Save fixture'}).click();
    await page.waitForSelector('form[aria-busy=true]'); assert.equal(await page.getByRole('button',{name:'Save fixture'}).isDisabled(),true);
    await page.evaluate(()=>window.finishSave('error')); await page.waitForSelector('form:not([aria-busy])');
    assert.equal(await page.locator('[name=title]').inputValue(),'Retained title'); assert.equal(await page.locator('[name=body]').inputValue(),'Retained body');
    await page.getByText('تعذر حفظ البيانات',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-admin-feedback-entry]').count(),1);
    await page.getByRole('button',{name:'Save fixture'}).click(); await page.waitForSelector('form[aria-busy=true]');
    await page.evaluate(()=>window.finishSave('success')); await page.getByText('Fixture saved',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-admin-feedback-entry]').count(),1); assert.equal(await page.locator('[name=title]').inputValue(),'Retained title');
    await page.getByRole('button',{name:'Save fixture'}).click(); await page.waitForSelector('form[aria-busy=true]');
    await page.evaluate(()=>window.finishSave('warning')); await page.getByText('تم الحفظ مع تنبيه',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-admin-feedback-entry]').count(),1); assert.equal(await page.getByRole('button',{name:'Save fixture'}).isDisabled(),false);
    assert.equal(await page.evaluate(()=>window.calls),3); assert.deepEqual(await page.evaluate(()=>window.errors),[]);
  });
  await check('VEN-A10 mounted Row Actions -> Confirmation -> Data -> Feedback, rollback/retry and focus',async()=>{
    await page.evaluate(()=>{window.calls=0;window.mount('rows');});
    const more=page.locator('[data-admin-row-action=more] button'); await more.waitFor(); await more.focus(); await page.keyboard.press('Enter');
    await page.getByRole('menuitem',{name:/حذف/}).click(); await page.locator('[data-admin-confirm-submit]').click();
    await page.waitForFunction(()=>document.querySelector('#row-count')?.textContent==='0');
    assert.equal(await page.evaluate(()=>window.duplicateMutation()),'mutation_in_flight');
    assert.equal(await page.locator('[data-admin-confirm-submit]').isDisabled(),true); await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(),1);
    await page.evaluate(()=>window.finishRow(false)); await page.waitForFunction(()=>document.querySelector('#row-count')?.textContent==='1');
    assert.equal(await page.locator('[data-admin-confirm-submit]').isDisabled(),false); assert.equal(await page.locator('[data-admin-feedback-entry]').count(),1);
    await page.locator('[data-admin-confirm-cancel]').click(); await page.waitForFunction(()=>document.activeElement?.closest('[data-admin-row-action=more]'));
    await more.click(); await page.getByRole('menuitem',{name:/حذف/}).click(); await page.locator('[data-admin-confirm-submit]').click();
    await page.waitForFunction(()=>document.querySelector('#row-count')?.textContent==='0'); await page.evaluate(()=>window.finishRow(true));
    await page.getByRole('dialog').waitFor({state:'detached'}); await page.getByText('Removed',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.calls),2); assert.equal(await page.evaluate(()=>window.duplicateCalls),0);
    assert.equal(await page.evaluate(()=>document.activeElement?.isConnected),true);
  });
  await check('VEN-A10 mounted Entity Preview: public eligibility, disabled and safe navigation',async()=>{
    await page.evaluate(()=>window.mount('preview')); const publicLink=page.locator('[data-admin-entity-preview-action=public-view]'); await publicLink.waitFor();
    assert.equal(await publicLink.getAttribute('href'),'/public/1'); assert.equal(await publicLink.getAttribute('target'),'_blank');
    await publicLink.focus(); assert.equal(await publicLink.evaluate(el=>document.activeElement===el),true);
    await page.evaluate(()=>window.mount('preview',{status:'unpublished'})); await publicLink.waitFor({state:'detached'});
    await page.evaluate(()=>window.mount('preview',{access:'disabled'})); await publicLink.waitFor(); assert.equal(await publicLink.getAttribute('aria-disabled'),'true');
    await page.evaluate(()=>window.mount('preview',{href:'javascript:alert(1)'})); await publicLink.waitFor({state:'detached'});
  });
  await check('VEN-A05 brochure valid, absent, invalid and hidden',async()=>{
    for(const [href,hidden,kind] of [['https://example.com/fixture.pdf',false,'a'],[null,false,'button'],['javascript:alert(1)',false,'button'],['https://example.com/fixture.pdf',true,'none']]) {
      await page.evaluate(options=>window.mount('brochure',options),{href,hidden});
      await page.waitForTimeout(100);
      const download=page.locator('[data-project-hero-action=download]');
      if(kind==='none') assert.equal(await download.count(),0); else {assert.equal(await download.evaluate(el=>el.tagName.toLowerCase()),kind); if(kind==='a') assert.equal(await download.getAttribute('href'),href); else assert.equal(await download.isDisabled(),true);}
    }
  });
  assert.deepEqual(browserErrors,[]);
  await page.screenshot({path:path.join(out,'final.png'),fullPage:true});
  await writeFile(path.join(out,'results.json'),JSON.stringify({passed:results,externalRequests:'blocked',boundary:'actual shared components; isolated transport and Next navigation; no authenticated domain persistence claim'},null,2));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
