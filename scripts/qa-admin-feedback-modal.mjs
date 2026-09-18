import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/admin-feedback-modal");
await mkdir(out, { recursive: true });
const entryPath = path.join(out, "entry.tsx");
await writeFile(entryPath, `import React,{StrictMode,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Provider,{useAdminFeedback} from '@src/components/admin/AdminFeedbackProvider';
import Modal,{AdminModalPrimaryButton} from '@src/components/admin/VenesiaModal';
const root=createRoot(document.getElementById('root'));
window.outerSaves=0;window.nestedSaves=0;window.standaloneSaves=0;
function Content({name}){return <form className="space-y-4" onSubmit={event=>{event.preventDefault();window[name+'Saves']++;}}>
<label className="block">Title<input aria-label={name+' title'} className="block w-full rounded-xl border p-3" defaultValue="Preserved draft"/></label>
<textarea aria-label={name+' body'} className="block h-60 w-full rounded-xl border p-3" defaultValue="Saved content remains editable"/>
<div className="h-64 rounded-xl border p-4">Resident media and fields</div>
<div className="flex justify-end"><AdminModalPrimaryButton type="submit">{'Save '+name}</AdminModalPrimaryButton></div></form>;}
function Hosted(){const [open,setOpen]=useState(false),[nested,setNested]=useState(false);const {publishFeedback}=useAdminFeedback();
const success=()=>publishFeedback({variant:'success',title:'Saved item',message:'The previous item was saved.',layout:'inline',lifecycle:'persistent'},{channel:'success'});
const critical=()=>publishFeedback({variant:'danger',title:'Critical warning',message:'This persistent warning must remain readable.',layout:'stacked',lifecycle:'persistent'},{channel:'critical',critical:true});
return <main className="p-6"><button onClick={success}>Publish success</button><button onClick={()=>setOpen(true)}>Open outer</button>
<Modal open={open} title="Outer editor" size="xl" onClose={()=>setOpen(false)}>
<div className="mb-4 flex gap-4"><button onClick={critical}>Publish critical</button><button onClick={()=>setNested(true)}>Open nested</button></div>
<Content name="outer"/><Modal open={nested} title="Nested editor" onClose={()=>setNested(false)}><Content name="nested"/></Modal></Modal></main>;}
function Standalone(){const [open,setOpen]=useState(true);return <Modal open={open} title="Standalone editor" onClose={()=>setOpen(false)}><Content name="standalone"/></Modal>;}
window.standalone=()=>root.render(<StrictMode><Standalone/></StrictMode>);
root.render(<StrictMode><Provider><Hosted/></Provider></StrictMode>);`);
await writeFile(path.join(out, "navigation.ts"), "export const useRouter=()=>({replace(){},refresh(){}});export const usePathname=()=>'/qa';export const useSearchParams=()=>new URLSearchParams();");
await writeFile(path.join(out, "link.tsx"), "import React from 'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>;}");

// Compile the real Tailwind utility rules used by the actual owners and fixture.
// No artificial modal position/z-index override can hide the obstruction.
const posix = value => value.replaceAll("\\", "/");
const cssInput = `@import "tailwindcss" source(none);\n@source "${posix(path.join(root, "src/components/admin"))}";\n@source "${posix(path.join(root, "src/lib/admin/admin-ui-styles.ts"))}";\n@source "${posix(entryPath)}";\n`;
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");
const css = (await postcss([tailwind({ base: root })]).process(cssInput, { from: path.join(out, "input.css") })).css;
await writeFile(path.join(out, "fixture.css"), css);

const { loadBindings } = require("next/dist/build/swc");
await loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({
  mode: "development", target: "web", context: root, entry: entryPath,
  output: { path: out, filename: "fixture.js" }, devtool: false,
  plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("development") })],
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias: {
    "@src": path.join(root, "src"), "next/navigation": path.join(out, "navigation.ts"), "next/link": path.join(out, "link.tsx"),
  } },
  module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{ loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: {
    rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {},
    swcCacheDir: path.join(out, "swc-cache"), serverComponents: false, serverReferenceHashSalt: "feedback-modal-regression", esm: false, transpilePackages: [],
  } }] }] },
});
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => {
  if (error || closeError || stats?.hasErrors()) reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)));
  else resolve();
})));
const bundle = await readFile(path.join(out, "fixture.js"));
const server = createServer((request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("content-type", "application/javascript"); response.end(bundle); return; }
  if (request.url === "/fixture.css") { response.setHeader("content-type", "text/css"); response.end(css); return; }
  response.setHeader("content-type", "text/html");
  response.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;background:#05070b;color:white;font-family:Arial}</style><div id="root"></div><script src="/fixture.js"></script></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
let browser;
async function hitTestAndClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return target === element || element.contains(target);
  });
  assert.equal(hit, true, "actual center hit test reaches intended Save, not feedback overlay");
  await locator.click();
}
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1365, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(origin);
      await page.getByRole("button", { name: "Publish success", exact: true }).click();
      const viewport = page.locator("[data-admin-feedback-viewport]");
      assert.equal(await viewport.getAttribute("data-admin-feedback-placement"), "global");
      assert.equal(await viewport.evaluate(element => getComputedStyle(element).position), "fixed");
      await page.getByRole("button", { name: "Open outer", exact: true }).click();
      const outer = page.getByRole("dialog", { name: "Outer editor", exact: true });
      await outer.locator("[data-admin-feedback-viewport]").waitFor();
      assert.equal(await viewport.count(), 1, "same viewport; no duplicated notices");
      assert.equal(await viewport.evaluate(element => getComputedStyle(element).position), "static");
      await hitTestAndClick(page, outer.getByRole("button", { name: "Save outer", exact: true }));
      assert.equal(await page.evaluate(() => window.outerSaves), 1);
      assert.equal(await page.locator("[data-admin-feedback-entry]").count(), 1, "saving does not clear previous persistent notice");

      await outer.getByRole("button", { name: "Publish critical", exact: true }).click();
      const critical = page.locator('[data-admin-feedback-critical="true"]');
      await critical.waitFor();
      await page.waitForFunction(() => {
        const element = document.querySelector('[data-admin-feedback-critical="true"]');
        const box = element?.getBoundingClientRect();
        return box && box.top >= 0 && box.bottom <= innerHeight;
      });
      assert.match(await critical.innerText(), /persistent warning must remain readable/);
      await outer.getByRole("button", { name: "Open nested", exact: true }).click();
      const nested = page.getByRole("dialog", { name: "Nested editor", exact: true });
      await nested.locator("[data-admin-feedback-viewport]").waitFor();
      assert.equal(await viewport.count(), 1);
      assert.equal(await page.locator("[data-admin-feedback-entry]").count(), 2);
      await hitTestAndClick(page, nested.getByRole("button", { name: "Save nested", exact: true }));
      assert.equal(await page.evaluate(() => window.nestedSaves), 1);
      await nested.getByRole("button", { name: "إغلاق", exact: true }).click();
      await outer.locator("[data-admin-feedback-viewport]").waitFor();
      assert.equal(await critical.count(), 1, "nested cleanup retains critical entry");

      const dismiss = critical.getByRole("button", { name: "إغلاق الإشعار", exact: true });
      await dismiss.focus();
      await page.keyboard.press("Tab");
      assert.equal(await outer.evaluate(element => element.contains(document.activeElement)), true, "feedback controls participate in modal focus trap");
      await outer.getByRole("button", { name: "إغلاق", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-admin-feedback-viewport]')?.getAttribute('data-admin-feedback-placement') === 'global');
      assert.equal(await page.locator("[role=dialog]").count(), 0);
      assert.equal(await page.locator("[data-admin-feedback-entry]").count(), 2, "closing modal restores all persistent feedback outside");
      await critical.getByRole("button", { name: "إغلاق الإشعار", exact: true }).click();
      assert.equal(await critical.count(), 0, "normal dismissal still works");
      assert.equal(await page.locator("[data-admin-feedback-entry]").count(), 1);
      await page.getByRole("button", { name: "Open outer", exact: true }).click();
      await outer.locator("[data-admin-feedback-viewport]").waitFor();
      assert.equal(await viewport.count(), 1, "reopen does not retain stale host registrations");
      await page.screenshot({ path: path.join(out, `modal-feedback-${width}.png`), fullPage: true });

      await page.evaluate(() => window.standalone());
      const standalone = page.getByRole("dialog", { name: "Standalone editor", exact: true });
      await standalone.waitFor();
      await hitTestAndClick(page, standalone.getByRole("button", { name: "Save standalone", exact: true }));
      assert.equal(await page.evaluate(() => window.standaloneSaves), 1);
      await standalone.getByRole("button", { name: "إغلاق", exact: true }).click();
      await standalone.waitFor({ state: "detached" });
      assert.deepEqual(errors, []);
      results.push({ width, status: "PASS", checks: ["actual Save hit-test/click", "one viewport", "critical warning readable", "nested latest host and restoration", "focus trap includes dismiss", "persistent outside restoration", "reopen lifecycle", "standalone optional provider"] });
      console.log(`PASS feedback/modal mounted regression (${width}px)`);
    } catch (error) {
      await page.screenshot({ path: path.join(out, `failure-${width}.png`), fullPage: true }).catch(() => {});
      results.push({ width, status: "FAIL", error: error.message, browserErrors: errors });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  const files = ["src/components/admin/AdminFeedbackProvider.tsx", "src/components/admin/VenesiaModal.tsx", "scripts/qa-admin-feedback-modal.mjs"];
  const sources = await Promise.all(files.map(async file => ({ file, sha256: createHash("sha256").update(await readFile(path.join(root, file))).digest("hex") })));
  await writeFile(path.join(out, "results.json"), JSON.stringify({ sources, cssSha256: createHash("sha256").update(css).digest("hex"), boundary: "Actual owners, actual Tailwind CSS, isolated same-origin mounted transport; no product DB or live latency claim", results }, null, 2));
}
