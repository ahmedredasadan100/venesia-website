import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/f01-f03-layout");
await mkdir(out, { recursive: true });

const entry = String.raw`import React,{useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';
import PageSlotLayout from '@src/components/page-composition/PageSlotLayout';
import PageLayoutManager from '@src/app/admin/pages-blocks/pages/[id]/PageLayoutManager';
const root=createRoot(document.getElementById('root'));
const regions=[{key:'hero',adminLabel:'Hero',sortOrder:0},{key:'main',adminLabel:'Main',sortOrder:10},{key:'sidebar',adminLabel:'Sidebar',sortOrder:20},{key:'bottom',adminLabel:'Bottom',sortOrder:30},{key:'footer',adminLabel:'Footer',sortOrder:40}];
const layouts=[{id:1,key:'venisia-legacy',adminLabel:'Venesia legacy',regions},{id:2,key:'editorial-flow',adminLabel:'Editorial flow',regions:[regions[1],regions[2]]},{id:3,key:'compact',adminLabel:'Compact',regions:[regions[1]]}];
const composition=(layoutKey,layoutRegions)=>({layoutKey,regions:layoutRegions,slots:{hero:[],main:[],sidebar:[],bottom:[],footer:[]},heroVisibility:'none',featuredModules:[],hasCompositionError:false});
window.calls=[];window.refreshes=0;window.actionMode='failure';
window.__layoutAction=(kind,payload)=>{window.calls.push({kind,payload});if(window.actionMode==='deferred-warning')return new Promise(resolve=>{window.finish=resolve;});return Promise.resolve({ok:false,message:'رفض Assignment غير متوافق'});};
function Commit({done}){useLayoutEffect(done,[done]);return null;}
function PublicFixture({kind,done}){const legacy=kind==='legacy';return <><Commit done={done}/><PageSlotLayout composition={composition(legacy?'venisia-legacy':'editorial-flow',legacy?regions:[regions[1],regions[2]])} mainAfter={<article data-proof='main'>Main proof</article>} sidebarPrefix={<div data-proof='sidebar'>Sidebar proof</div>}/></>}
function AdminFixture({done}){return <AdminFeedbackProvider><Commit done={done}/><PageLayoutManager pageId={77} currentLayoutId={2} layouts={layouts}/></AdminFeedbackProvider>}
window.mount=kind=>new Promise(resolve=>root.render(kind==='admin'?<AdminFixture done={resolve}/>:<PublicFixture kind={kind} done={resolve}/>));
window.mount('legacy');`;
await writeFile(path.join(out, "entry.tsx"), entry);
await writeFile(path.join(out, "navigation.ts"), `const router={refresh(){window.refreshes+=1;},push(){},replace(){}};export const useRouter=()=>router;`);
await writeFile(path.join(out, "actions.ts"), `export const savePageLayout=input=>window.__layoutAction('save',input);export const selectPageLayout=(pageId,layoutId)=>window.__layoutAction('select',{pageId,layoutId});`);
await writeFile(path.join(out, "plan.ts"), `export function buildSlotRenderPlan(){return []}`);
await writeFile(path.join(out, "theme.ts"), `import {resolveVenesiaThemeLayout} from '@src/components/page-composition/venisia-theme-regions';export const VENISIA_THEME_CONTRACT={resolveLayout:resolveVenesiaThemeLayout,modulePresentation:{}};`);
await writeFile(path.join(out, "renderers.tsx"), `import React from 'react';export default function Empty(){return null}export const MediaSidebarWidget=Empty;export const renderMediaHubSections=()=>[];export const renderVenesiaThemeMediaHubNodes=nodes=>nodes;`);
await writeFile(path.join(out, "search.ts"), `export const isSearchPlatformTemplate=()=>false;`);

const { loadBindings } = require("next/dist/build/swc");
await loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({
  mode: "development", target: "web", context: root,
  entry: path.join(out, "entry.tsx"), output: { path: out, filename: "fixture.js" }, devtool: false,
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/.*/, (resource) => {
      const full = path.resolve(resource.context, resource.request).replaceAll("\\", "/");
      if (full.endsWith("/src/app/admin/pages-blocks/pages/actions")) resource.request = path.join(out, "actions.ts");
      if (full.endsWith("/src/components/page-composition/build-slot-render-plan")) resource.request = path.join(out, "plan.ts");
      if (full.endsWith("/src/components/page-composition/venisia-theme-contract")) resource.request = path.join(out, "theme.ts");
      if ([
        "/src/components/sections/DynamicHeroSection",
        "/src/components/feed-modules/FeedModuleSection",
        "/src/components/featured/FeaturedModuleSection",
        "/src/components/media-center/MediaSidebar",
        "/src/components/media-center/renderMediaHubSections",
        "/src/components/page-composition/VenesiaThemeMediaHubLayout",
      ].some((suffix) => full.endsWith(suffix))) resource.request = path.join(out, "renderers.tsx");
      if (full.endsWith("/src/lib/page-blocks/search-platform-config")) resource.request = path.join(out, "search.ts");
    }),
    new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) }),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
    alias: { "@src": path.join(root, "src"), "next/navigation": path.join(out, "navigation.ts") },
  },
  module: { rules: [{
    test: /\.[jt]sx?$/, exclude: /node_modules/,
    use: [{ loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: {
      rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false,
      nextConfig: {}, jsConfig: {}, swcCacheDir: path.join(out, "swc-cache"),
      serverComponents: false, serverReferenceHashSalt: "f01-f03-layout-qa", esm: false, transpilePackages: [],
    } }],
  }] },
});
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close((closeError) =>
  error || closeError || stats?.hasErrors()
    ? reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)))
    : resolve(),
)));

const bundle = await readFile(path.join(out, "fixture.js"));
const css = String.raw`html{direction:rtl}body{margin:0;background:#080b10;color:#fff;font:16px Arial;padding:24px}.page-layout{width:100%}.page-layout-main-sidebar-grid{display:grid;gap:32px;grid-template-columns:minmax(0,1fr) 340px;direction:ltr}.page-layout-slot{min-width:0}.page-layout-slot[dir=rtl],section[dir=rtl],aside[dir=rtl]{direction:rtl}.page-layout--stack>.page-layout-slot{display:block;margin-bottom:24px}.max-w-7xl{max-width:1280px}.mx-auto{margin-inline:auto}.px-6{padding-inline:24px}.pt-10{padding-top:40px}[data-proof]{box-sizing:border-box;min-height:120px;padding:24px;border:2px solid #d8b87a;background:#142033}button,input{font:inherit;padding:10px;margin:4px;color:inherit;background:#111827;border:1px solid #64748b}button{cursor:pointer}button:disabled,input:disabled{opacity:.5}[data-admin-feedback-entry]{border:1px solid #d8b87a;padding:12px;margin-bottom:12px}@media(max-width:1279px){.page-layout-main-sidebar-grid{grid-template-columns:1fr}}`;
const server = createServer((request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("content-type", "application/javascript"); response.end(bundle); return; }
  response.setHeader("content-type", "text/html");
  response.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style><div id="root"></div><script src="/fixture.js"></script></html>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const mount = (kind) => page.evaluate((value) => window.mount(value), kind);
const box = (selector) => page.locator(selector).boundingBox();

try {
  await page.goto(url);
  await page.waitForFunction(() => typeof window.mount === "function");
  await mount("legacy");
  let main = await box('[data-proof="main"]');
  let sidebar = await box('[data-proof="sidebar"]');
  assert.ok(main && sidebar && Math.abs(main.y - sidebar.y) < 2, "legacy desktop must be two aligned columns");
  assert.ok(main.x < sidebar.x && sidebar.width < main.width, "RTL legacy desktop keeps the narrow sidebar on the right");
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  await page.screenshot({ path: path.join(out, "legacy-desktop-rtl.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  main = await box('[data-proof="main"]'); sidebar = await box('[data-proof="sidebar"]');
  assert.ok(main && sidebar && sidebar.y > main.y + main.height - 2, "legacy mobile must stack without overlap");
  assert.ok(Math.abs(main.width - sidebar.width) < 2, "legacy mobile regions must share the usable width");
  await page.screenshot({ path: path.join(out, "legacy-mobile-rtl.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await mount("alternate");
  main = await box('[data-proof="main"]'); sidebar = await box('[data-proof="sidebar"]');
  assert.ok(main && sidebar && sidebar.y > main.y + main.height - 2, "alternate Layout must use the Theme stack topology on desktop");
  assert.ok(Math.abs(main.width - sidebar.width) < 2, "alternate Layout regions must retain full stack width");
  assert.equal(await page.locator('[data-page-layout-contract="theme-owned"]').getAttribute("class").then((value) => value.includes("page-layout--stack")), true);
  await page.screenshot({ path: path.join(out, "alternate-desktop-rtl.png"), fullPage: true });

  await mount("admin");
  assert.equal(await page.locator("section").first().getAttribute("dir"), "rtl");
  await page.getByRole("combobox", { name: "إنشاء أو تحرير تخطيط" }).click();
  await page.getByRole("option", { name: "إنشاء تخطيط جديد" }).click();
  const technical = page.getByLabel("المعرّف التقني");
  const adminLabel = page.getByLabel("الاسم الإداري").first();
  await technical.fill("qa-editorial"); await adminLabel.fill("تخطيط اختباري");
  await page.getByRole("button", { name: "إضافة Region" }).click();
  const regionKeys = page.locator('input[dir="ltr"]').filter({ visible: true });
  assert.equal(await regionKeys.count(), 3);
  await page.getByRole("button", { name: /نقل منطقة 2 لأعلى/ }).click();
  assert.equal(await regionKeys.nth(1).inputValue(), "region-2");

  await page.evaluate(() => { window.actionMode = "deferred-warning"; });
  await page.getByRole("button", { name: "حفظ التخطيط والمناطق" }).click();
  await page.waitForFunction(() => window.calls.length === 1);
  assert.equal(await technical.isDisabled(), true);
  assert.equal(await page.evaluate(() => window.calls[0].payload.assignPage), true);
  await page.evaluate(() => window.finish({ ok: true, layoutId: 4, warning: "تعذر تحديث الكاش المعزول", message: "saved" }));
  await page.getByText("تعذر تحديث الكاش المعزول", { exact: true }).waitFor();
  assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ""), /تعذر تحديث الكاش المعزول/);
  assert.equal(await page.evaluate(() => window.refreshes), 1);

  await page.evaluate(() => { window.actionMode = "failure"; });
  await page.getByRole("button", { name: "حفظ التخطيط والمناطق" }).click();
  await page.getByText("رفض Assignment غير متوافق", { exact: true }).waitFor();
  assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ""), /رفض Assignment غير متوافق/);
  await page.screenshot({ path: path.join(out, "admin-layout-feedback-rtl.png"), fullPage: true });

  assert.deepEqual(errors, []);
  const evidence = {
    status: "PASS",
    public: ["legacy-desktop-rtl", "legacy-mobile-rtl", "alternate-desktop-rtl"],
    admin: ["create", "region-order", "pending", "cache-warning", "failure-message", "focus"],
    limits: "Actual Theme geometry and PageLayoutManager owners mounted with isolated action transport; database behavior is proven separately in isolated Supabase.",
  };
  await writeFile(path.join(out, "results.json"), JSON.stringify(evidence, null, 2));
  console.log("PASS F01 measured Desktop/Mobile/RTL geometry and F03 Admin pending/feedback/focus interactions");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
