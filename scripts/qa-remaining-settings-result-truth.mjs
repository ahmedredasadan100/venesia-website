import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/evidence-adoption-gaps/settings-results");
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const entry = String.raw`import React,{useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';
import Footer from '@src/app/admin/pages-blocks/footer/FooterBuilderClient';
import Maintenance from '@src/app/admin/settings/general/MaintenanceModePanel';
import Media from '@src/app/admin/settings/media/MediaSettingsPanel';
import {EMPTY_FOOTER_SETTINGS,DEFAULT_FOOTER_SLOTS} from '@src/lib/footer/defaults';
const root=createRoot(document.getElementById('root'));
const footer={...EMPTY_FOOTER_SETTINGS,slots:structuredClone(DEFAULT_FOOTER_SLOTS),sourceStatus:'database'};
const settings={maxImageBytes:2097152,maxDocumentBytes:2097152,allowedKinds:['image'],allowedImageExtensions:['.jpg'],allowedDocumentExtensions:['.pdf'],mimeVerification:true,collisionPolicy:'unique_name',safeDeletePolicy:'authoritative_zero_references'};
const readiness={catalogAvailable:false,managedStorageAvailable:false,context:{identity:null},usageResultsAuthoritative:false,lastCompletedScanAt:null,unscannedAssetCount:0,reasons:[]};
window.calls=0;window.refreshes=0;
window.action=(...args)=>{window.calls++;window.payload=args.find(value=>value instanceof FormData);return new Promise((resolve,reject)=>{window.finish=resolve;window.reject=()=>reject(new Error('isolated write rejected'));});};
function Fixture({kind,onCommitted}){useLayoutEffect(onCommitted,[kind,onCommitted]);
 if(kind==='footer')return <Footer settings={footer} footerMenuId={null} quickLinkItems={[]} menuOptions={[]}/>;
 if(kind==='maintenance')return <Maintenance initialReadState={{status:'ready',enabled:false}}/>;
 return <Media settings={settings} readiness={readiness}/>;
}
let generation=0;
window.footerSlots=footer.slots;
window.mount=kind=>new Promise(resolve=>root.render(<AdminFeedbackProvider key={++generation}><Fixture kind={kind} onCommitted={resolve}/></AdminFeedbackProvider>));
`;
await writeFile(path.join(out, "entry.tsx"), entry);
await writeFile(path.join(out, "navigation.ts"), `export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';const router={push(){},replace(){},refresh(){window.refreshes++}};export const useRouter=()=>router;export const usePathname=()=>'/proof';export const useSearchParams=()=>new URLSearchParams();`);
await writeFile(path.join(out, "link.tsx"), `import React from 'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}`);
await writeFile(path.join(out, "image.tsx"), `import React from 'react';export default function Image({fill,priority,unoptimized,quality,loader,...props}){return <img {...props}/>}`);
await writeFile(path.join(out, "actions.ts"), `const run=(...args)=>window.action(...args);export const saveFooterBuilderAction=run,restoreDefaultFooterAction=run,updateMaintenanceModeAction=run,updateMediaSettingsAction=run;`);
await writeFile(path.join(out, "link-actions.ts"), `export const browseAdminLinksAjax=async()=>[];export const browseMenusPickerAjax=async()=>[];export const browseMenuItemsPickerAjax=async()=>[];export const browseTopicCategoriesPickerAjax=async()=>[];export const resolveAdminLinkAjax=async()=>[];`);
await require("next/dist/build/swc").loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({ mode: "development", target: "web", context: root,
  entry: path.join(out, "entry.tsx"), output: { path: out, filename: "fixture.js" }, devtool: false,
  plugins: [new webpack.NormalModuleReplacementPlugin(/(actions|\/ui)$/, resource => {
    const full = path.resolve(resource.context, resource.request).replaceAll("\\", "/");
    if (full.endsWith("/components/admin/ui")) resource.request = path.join(root, "src/components/admin/ui/index.ts");
    else if (full.endsWith("/lib/admin/links/actions")) resource.request = path.join(out, "link-actions.ts");
    else if (/src\/app\/admin\/(pages-blocks\/footer|settings\/(general|media))\/actions$/.test(full)) resource.request = path.join(out, "actions.ts");
  }), new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias: { "@src": path.join(root, "src"),
    "next/navigation": path.join(out, "navigation.ts"), "next/link": path.join(out, "link.tsx"), "next/image": path.join(out, "image.tsx") } },
  module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{
    loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: { rootDir: root,
      isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {},
      swcCacheDir: path.join(out, "swc-cache"), serverComponents: false,
      serverReferenceHashSalt: "remaining-settings-proof", esm: false, transpilePackages: [] },
  }] }] },
});
const compiledFiles = await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => {
  if (error || closeError || stats?.hasErrors()) reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)));
  else resolve([...stats.compilation.fileDependencies].filter(file => file.startsWith(path.join(root, "src"))).map(file => path.relative(root, file)));
})));
const bundle = await readFile(path.join(out, "fixture.js"));
const server = createServer((request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("content-type", "application/javascript"); response.end(bundle); return; }
  response.setHeader("content-type", "text/html");
  response.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{font-family:Arial;background:#111;color:white}button,input,textarea{padding:8px;margin:4px}button{cursor:pointer}[hidden]{display:none!important}fieldset{border:0}[role=dialog]{position:fixed;inset:10%;background:#222;padding:24px;z-index:10001}</style><div id="root"></div><script src="/fixture.js"></script></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [];
async function check(name, width, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const blocked = [], errors = [], consoleErrors = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && ["/", "/fixture.js"].includes(url.pathname)) return route.continue();
    blocked.push(url.pathname); return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  try {
    await page.goto(origin); await page.waitForFunction(() => typeof window.mount === "function");
    await run(page); assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(blocked, []);
    results.push({ name, width, status: "PASS", errors, consoleErrors, blocked }); console.log(`PASS ${name} ${width}px`);
  } catch (error) {
    await page.screenshot({ path: path.join(out, `${name}-${width}-failure.png`), fullPage: true });
    throw error;
  } finally { await context.close(); }
}
const mount = (page, kind) => page.evaluate(kind => window.mount(kind), kind);
const warningMessage = "Persisted once; cache update pending. Refresh before retry.";
const waitForCall = (page, count) => page.waitForFunction(count => window.calls === count, count);
const settle = (page, result) => page.evaluate(result => window.finish(result), result);
try {
  for (const width of [1280, 390]) {
    await check("footer-save-restore-warning", width, async page => {
      await mount(page, "footer");
      await page.getByRole("tab", { name: "السوشيال والقانوني", exact: true }).click();
      const copyright = page.getByLabel("Copyright", { exact: true });
      await copyright.fill("Saved warning draft");
      await page.getByRole("button", { name: "حفظ الفوتر", exact: true }).click(); await waitForCall(page, 1);
      assert.equal(await copyright.isDisabled(), true);
      await settle(page, { ok: true, status: "warning", code: "committed_cache_revalidation_pending", message: warningMessage });
      await page.getByText(warningMessage, { exact: true }).waitFor();
      assert.equal(await copyright.inputValue(), "Saved warning draft"); assert.equal(await copyright.isDisabled(), false);
      assert.equal(await page.getByText("يظل الحذف الآمن متوقفًا", { exact: false }).count(), 0);
      assert.equal(await page.evaluate(() => window.calls), 1);
      await page.getByRole("button", { name: "استعادة الافتراضي", exact: true }).click();
      await page.getByRole("button", { name: "تأكيد الاستعادة", exact: true }).click(); await waitForCall(page, 2);
      await page.evaluate(message => window.finish({ ok: true, status: "warning", code: "committed_cache_revalidation_pending", message, slots: window.footerSlots }), "Restored once; cache update pending.");
      await page.getByText("Restored once; cache update pending.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("dialog").count(), 0); assert.equal(await page.evaluate(() => window.calls), 2);
    });
    await check("maintenance-warning-retains-new-state", width, async page => {
      await mount(page, "maintenance");
      await page.getByRole("button", { name: "تشغيل الصيانة", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "تشغيل وضع الصيانة", exact: true }).click();
      await waitForCall(page, 1);
      await settle(page, { ok: true, feedbackStatus: "warning", code: "committed_cache_revalidation_pending", title: "Saved with warning", message: warningMessage });
      await page.getByText(warningMessage, { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "إيقاف الصيانة", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByRole("dialog").count(), 0); assert.equal(await page.evaluate(() => window.calls), 1);
    });
    await check("media-warning-shared-form-settles-clean", width, async page => {
      await mount(page, "media");
      const maximum = page.locator('[name="maxImageMb"]'); await maximum.fill("3");
      await page.locator('form[data-admin-form-runtime] button[type="submit"]').first().click(); await waitForCall(page, 1);
      assert.equal(await maximum.isDisabled(), true);
      await settle(page, { status: "warning", mode: "edit", revision: 1, savedRevision: "proof:1", code: "committed_cache_revalidation_pending", title: "Saved with warning", message: warningMessage });
      await page.getByText(warningMessage, { exact: true }).waitFor();
      assert.equal(await maximum.inputValue(), "3"); assert.equal(await maximum.isDisabled(), false);
      assert.equal(await page.locator('form[data-admin-form-runtime]').getAttribute("data-admin-form-dirty"), "false");
      assert.equal(await page.evaluate(() => window.calls), 1);
    });
  }
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, "results.json"), JSON.stringify({ results, compiledFiles,
    boundary: "Actual mounted Footer/Maintenance/Media consumers with shared Form, Feedback, Confirmation owners. Deferred action and router transports isolated. Action persistence/failure contract covered separately. No authenticated Admin, database, full composed page, production or styling closure claim." }, null, 2));
}
