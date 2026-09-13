import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/shared-corrections-adoption/components");
await mkdir(out, { recursive: true });
const entry = String.raw`import React, {useState,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';
import AdminFormRuntime,{AdminFormPendingFields} from '@src/components/admin/ui/AdminFormRuntime';
import {createAdminFormErrorState} from '@src/lib/admin/form-runtime';
import Footer from '@src/app/admin/pages-blocks/footer/FooterBuilderClient';
import Security from '@src/app/admin/settings/security/SecuritySettingsClient';
import Menu from '@src/app/admin/pages-blocks/menus/MenuBuilderClient';
import MenuItem from '@src/app/admin/pages-blocks/menus/MenuItemForm';
import Seo from '@src/app/admin/pages-blocks/pages/[id]/PageSeoPanel';
import {EMPTY_FOOTER_SETTINGS,DEFAULT_FOOTER_SLOTS} from '@src/lib/footer/defaults';
const root=createRoot(document.getElementById('root'));
window.calls=0;window.payloads=[];
window.action=async(...args)=>{window.calls++;window.payloads.push(args[0] instanceof FormData?[...args[0].entries()]:args[0]);return new Promise((resolve,reject)=>{window.finish=resolve;window.reject=()=>reject(new Error('isolated failure'));});};
const menu={id:1,name:'Original menu',slug:'fixture',location:'header',is_active:true};
const settings={...EMPTY_FOOTER_SETTINGS,slots:structuredClone(DEFAULT_FOOTER_SLOTS),sourceStatus:'database'};
const security={username:'fixture',email:'fixture@example.test',fullName:'Original name',lastLoginAt:null};
const seo={pageId:1,pageTitle:'Page',path:'/fixture',content:'',titleSuffix:'',resolvedFallback:{title:'',description:'',image:'',imageAlt:''},seoTitle:'Original SEO',seoDescription:'',focusKeyword:'',seoKeywords:[],canonicalUrl:'',robotsIndex:null,robotsFollow:null,ogImage:'',ogImageAlt:''};
function FeedbackFixture(){return <AdminFormRuntime mode="edit" entityKey="media-error" initialState={createAdminFormErrorState('edit','Legacy','Legacy media failure')} action={async()=>{await window.action();return createAdminFormErrorState('edit','Current','Current save failure');}}><input name="title" defaultValue="Draft"/><button>Save feedback</button></AdminFormRuntime>;}
function Fixture({kind,overrides={},onCommitted}){
 useLayoutEffect(onCommitted,[kind,overrides,onCommitted]);
 if(kind==='footer')return <Footer settings={{...settings,...overrides}} footerMenuId={null} quickLinkItems={[]} menuOptions={[]}/>;
 if(kind==='security')return <Security {...security} {...overrides}/>;
 if(kind==='menu')return <Menu menu={menu} items={[]}/>;
 if(kind==='menuitem')return <MenuItem menu={menu} parentItems={[]} submitLabel="Save item" action={window.action}/>;
 if(kind==='seo')return <Seo {...seo}/>;
 if(kind==='feedback')return <FeedbackFixture/>;
 return <form action={window.action}><AdminFormPendingFields><input name="title" defaultValue="Initial"/><button>Save native</button></AdminFormPendingFields></form>;
}
// root.render schedules work; resolve only after React commits incoming props.
window.mount=(kind,overrides={})=>new Promise(resolve=>{window.kind=kind;root.render(<AdminFeedbackProvider><Fixture kind={kind} overrides={overrides} onCommitted={resolve}/></AdminFeedbackProvider>);});
window.footerFixture=settings;window.mount('native');
`;
await writeFile(path.join(out, "entry.tsx"), entry);
await writeFile(path.join(out, "navigation.ts"), `export { unstable_rethrow } from 'next/dist/client/components/unstable-rethrow.browser'; const router={push(){},replace(href){history.replaceState({},"",href);},refresh(){window.refreshes=(window.refreshes||0)+1;}}; export const useRouter=()=>router; export const usePathname=()=>'/fixture'; export const useSearchParams=()=>new URLSearchParams(window.location.search);`);
await writeFile(path.join(out, "link.tsx"), `import React from 'react'; export default function Link({href,children,prefetch,...props}) { return <a href={href} {...props}>{children}</a>; }`);
await writeFile(path.join(out, "image.tsx"), `import React from 'react'; export default function Image({fill,priority,unoptimized,quality,loader,...props}) { return <img {...props}/>; }`);
const {loadBindings} = require("next/dist/build/swc"); await loadBindings();
// Actual UI exports are used; only Action transports and the unrelated Menu items table are isolated.
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
await writeFile(path.join(out,'actions.ts'), `const run=(...args)=>window.action(...args); export const updateMenu=run,createMenuItem=run,savePageSeoAction=run,saveFooterBuilderAction=run,restoreDefaultFooterAction=run,updateAdminSelfAccountAction=run,changeAdminPasswordAction=run,revokeAllAdminSessionsAction=run;`);
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
const results=[];const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
async function check(name,run){if(only&&!name.startsWith(only))return;const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.goto(url);await page.waitForFunction(()=>typeof window.mount==='function');await run(page);assert.deepEqual(errors,[]);results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){console.error(JSON.stringify(errors));await page.screenshot({path:path.join(out,name.replaceAll(/[^a-z0-9]/gi,'-')+'-failure.png')});throw e;}finally{await context.close();await writeFile(path.join(out,only?'results-'+only+'.json':'results.json'),JSON.stringify({results,limits:'Mounted actual UI owners; deferred action ports and Next router isolated. Not Auth or database-save proof.'},null,2));}}
const mount=(p,k,o={})=>p.evaluate(([k,o])=>window.mount(k,o),[k,o]);
async function pending(p,field,button){await field.fill('Submitted draft');await button.click();await p.waitForFunction(()=>window.calls===1);assert.equal(await field.isDisabled(),true);assert.equal(await field.evaluate(el=>Boolean(el.closest('fieldset[inert]'))),true);await field.evaluate(el=>el.closest('form').requestSubmit());assert.equal(await p.evaluate(()=>window.calls),1);const payload=await p.evaluate(()=>window.payloads[0]);assert.ok(JSON.stringify(payload).includes('Submitted draft'),'Submitted values captured before disabling');await p.evaluate(()=>window.finish());await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));}
try {
await check('native-menu-fields',async p=>{await mount(p,'menu');await p.getByRole('tab',{name:'بيانات القائمة',exact:true}).click();await pending(p,p.locator('input[name=name]'),p.getByRole('button',{name:'حفظ بيانات القائمة',exact:true}));});
await check('native-menu-item-fields',async p=>{await mount(p,'menuitem');await pending(p,p.locator('input[name=label]'),p.getByRole('button',{name:'Save item',exact:true}));});
await check('native-page-seo-fields',async p=>{await mount(p,'seo');await pending(p,p.locator('#page-seo-title'),p.locator('form button[type=submit]'));});
await check('security-delayed-read-failure-retry',async p=>{await mount(p,'security');await p.getByRole('tab',{name:'بيانات الحساب',exact:true}).click();const name=p.getByPlaceholder('الاسم الكامل');await name.fill('Unsaved name');await mount(p,'security',{fullName:'Late server name'});assert.equal(await name.inputValue(),'Unsaved name');await p.getByRole('button',{name:'حفظ بيانات الحساب',exact:true}).click();await p.waitForFunction(()=>window.calls===1);assert.equal(await name.isDisabled(),true);await p.evaluate(()=>window.reject());await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));assert.equal(await name.inputValue(),'Unsaved name');await p.getByRole('button',{name:'حفظ بيانات الحساب',exact:true}).click();await p.waitForFunction(()=>window.calls===2);await p.evaluate(()=>window.finish({success:true,fullName:'Unsaved name',email:'fixture@example.test'}));await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));await name.fill('Newer unsaved');await mount(p,'security',{fullName:'Stale saved name'});assert.equal(await name.inputValue(),'Newer unsaved');});
await check('footer-delayed-read-failure-retry',async p=>{await mount(p,'footer');await p.getByRole('tab',{name:'السوشيال والقانوني',exact:true}).click();const field=p.locator('[role=tabpanel]:visible input:not([type=checkbox])').first();await field.fill('Unsaved footer');await mount(p,'footer',{legal:{copyright:'Late source',privacyLabel:'Privacy',privacyHref:'/privacy',termsLabel:'Terms',termsHref:'/terms'}});assert.equal(await field.inputValue(),'Unsaved footer');await p.getByRole('button',{name:'حفظ الفوتر',exact:true}).click();await p.waitForFunction(()=>window.calls===1);assert.equal(await field.isDisabled(),true);await p.evaluate(()=>window.reject());await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));assert.equal(await field.inputValue(),'Unsaved footer');await p.getByRole('button',{name:'حفظ الفوتر',exact:true}).click();await p.waitForFunction(()=>window.calls===2);await p.evaluate(()=>window.finish({status:'success'}));await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));await field.fill('Newer footer');await mount(p,'footer',{legal:{copyright:'Another late source',privacyLabel:'Privacy',privacyHref:'/privacy',termsLabel:'Terms',termsHref:'/terms'}});assert.equal(await field.inputValue(),'Newer footer');});
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
  await p.evaluate(()=>window.finish({status:'success'}));await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));
});
await check('footer-restore-baseline',async p=>{
  const slots=await p.evaluate(()=>structuredClone(window.footerFixture.slots));slots.slots[0].heading='Custom persisted layout';
  await mount(p,'footer',{slots});await p.getByRole('button',{name:'استعادة الافتراضي',exact:true}).click();
  await p.getByRole('button',{name:'تأكيد الاستعادة',exact:true}).click();await p.waitForFunction(()=>window.calls===1);
  await p.evaluate(()=>window.finish({status:'success',slots:window.footerFixture.slots}));
  await p.waitForFunction(()=>!document.querySelector('fieldset[disabled]'));
  await p.getByRole('tab',{name:'السوشيال والقانوني',exact:true}).click();
  await mount(p,'footer',{legal:{copyright:'Clean after restore',tagline:''}});
  assert.equal(await p.getByLabel('Copyright',{exact:true}).inputValue(),'Clean after restore');
});
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
