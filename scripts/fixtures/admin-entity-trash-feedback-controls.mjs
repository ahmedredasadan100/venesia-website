import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import ts from "typescript";
import { chromium, expect } from "playwright/test";

export async function verifyAdminEntityTrashFeedback({ ownerFile = "src/components/admin/entity-list/AdminEntityTrashHeader.tsx" } = {}) {
const root = process.cwd();
const owner = "src/components/admin/entity-list/AdminEntityTrashHeader.tsx";
const out = path.resolve(".tmp-qa/admin-entity-trash-feedback");
fs.mkdirSync(out, { recursive: true });
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");
const sha = (text) => createHash("sha256").update(text).digest("hex");
const require = createRequire(import.meta.url);
assert.ok(ownerFile);
const candidate = read(ownerFile);
assert.equal((candidate.match(/placement: "global"/gu) ?? []).length, 1);
assert.equal((candidate.match(/placement: "inline"/gu) ?? []).length, 0);
const baseline = candidate.replace('placement: "global"', 'placement: "inline"');
const consumerSpecs = [
  { entity: "topics", consumer: "content-topics", file: "src/components/admin/content/TopicsListClient.tsx", channel: "entity-list:content-topics-table" },
  { entity: "categories", consumer: "content-categories", file: "src/app/admin/content/categories/CategoriesListClient.tsx", channel: "entity-list:content-categories-table" },
  { entity: "series", consumer: "content-series", file: "src/app/admin/content/series/SeriesTableClient.tsx", channel: "entity-list:content-series-table" },
];
const checks = [];
const sourceBindings = [{ path: owner, sha256: sha(candidate) }];
function headerJsx(spec) {
  const source = read(spec.file);
  const ast = ts.createSourceFile(spec.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const headers = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "AdminEntityTrashHeader") headers.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(headers.length, 1, spec.file);
  const jsx = headers[0].getText(ast);
  assert.ok(jsx.includes("onSuccess={controller.invalidate}"));
  assert.ok(jsx.includes("feedbackChannel="));
  sourceBindings.push({ path: spec.file, sha256: sha(source), jsxSha256: sha(jsx) });
  return jsx;
}
const calls = Object.fromEntries(consumerSpecs.map((spec) => [spec.entity, headerJsx(spec)]));
const entityListSource = read("src/components/admin/entity-list/AdminEntityList.tsx");
assert.ok(!entityListSource.includes("AdminFeedbackChannelViewport"));
assert.ok(entityListSource.includes('placement: "global"'));
checks.push("Actual EntityList publishes globally and has no inline channel outlet");
for (const file of [
  "src/components/admin/entity-list/AdminEntityList.tsx",
  "src/components/admin/entity-list/AdminEntityListSurface.tsx",
  "src/components/admin/entity-list/AdminFloatingLayerContext.tsx",
  "src/components/admin/AdminFeedbackProvider.tsx",
  "src/components/admin/ui/AdminConfirmDialog.tsx",
  "src/lib/admin/content/topics-action-feedback.ts",
]) sourceBindings.push({ path: file, sha256: sha(read(file)) });
assert.ok(read("src/components/admin/ui/index.ts").includes('export { default as AdminActionButton } from "./AdminActionButton";'));
function relocateImports(source) {
  return source.replace('import { AdminActionButton } from', 'import AdminActionButton from').replace(/from "(\.[^"]+)"/gu, (_match, relative) =>
    "from " + JSON.stringify(path.resolve(root, path.dirname(owner), relative === "../ui" ? "../ui/AdminActionButton" : relative).replaceAll("\\", "/")));
}
fs.writeFileSync(path.join(out, "BaselineTrash.tsx"), relocateImports(baseline));
fs.writeFileSync(path.join(out, "CandidateTrash.tsx"), relocateImports(candidate));
const entry = path.join(out, "entry.tsx");
fs.writeFileSync(entry, [
  "import React from 'react';import{createRoot}from'react-dom/client';",
  "import BaselineTrash from './BaselineTrash';import CandidateTrash from './CandidateTrash';",
  "import AdminFeedbackProvider,{useAdminFeedback}from'@src/components/admin/AdminFeedbackProvider';",
  "import AdminEntityListSurface from'@src/components/admin/entity-list/AdminEntityListSurface';",
  "import AdminEntityList from'@src/components/admin/entity-list/AdminEntityList';",
  "import{mapAdminActionResultToFeedback}from'@src/lib/admin/admin-action-feedback';",
  "import{mapTopicsActionResultToFeedback}from'@src/lib/admin/content/topics-action-feedback';",
  "const UNIFIED_CONTENT_LIST_ID='content-topics-table',LIST_ID='content-categories-table';",
  "let calls=[],succeeded=0,release=null,generation=0;window.readState=()=>({calls,succeeded,entries:window.entries});window.settle=result=>{if(!release)throw Error('No pending action');const done=release;release=null;done(result)};",
  "function Probe(){const{entries}=useAdminFeedback();window.entries=entries.map(({channel,placement,feedback})=>({channel,placement,variant:feedback.variant}));return null;}",
  "function Consumer({config}){const AdminEntityTrashHeader=config.baseline?BaselineTrash:CandidateTrash;const trashCount=config.count??3;const currentListPath='/admin/content/topics?status=trash';const dispatch=(expectedCount,acknowledged)=>{calls.push({expectedCount,acknowledged});return new Promise(resolve=>{release=resolve})};const emptyTrash=count=>dispatch(count,null),emptyCategoriesTrashAjax=dispatch,emptySeriesTrashAjax=dispatch;const controller={result:{metrics:{trashed:trashCount}},invalidate:async()=>{succeeded++}};",
  "const headers={topics:()=>(" + calls.topics + "),categories:()=>(" + calls.categories + "),series:()=>(" + calls.series + ")};const header=headers[config.entity]();",
  "return <AdminEntityListSurface consumer={config.entity}>{header}<AdminEntityList listId={'controlled-'+config.entity} rows={[]} columns={[{key:'name',label:'الاسم',primary:true,primaryPresentation:'text-only',sticky:'start',defaultVisible:true,hideable:false,minWidth:200,renderCell:()=>null}]} getRowId={row=>row.id} getRowLabel={()=>'Owned row'} sizingStrategy={{mode:'fixed'}} actionsColumnWidth={120} emptyState={{mode:'system',systemEmpty:'Controlled empty list',filteredEmpty:'Controlled empty list'}} mapResultToFeedback={mapAdminActionResultToFeedback}/></AdminEntityListSurface>}",
  "const root=createRoot(document.getElementById('root'));window.mount=config=>{if(release)throw Error('Pending action not drained');calls=[];succeeded=0;root.render(<AdminFeedbackProvider key={++generation}><Probe/><Consumer config={config}/></AdminFeedbackProvider>)};",
].join("\n"));
fs.writeFileSync(path.join(out, "navigation.js"), "export const useRouter=()=>({push(){},replace(){}});export const unstable_rethrow=()=>{};");
fs.writeFileSync(path.join(out, "link.tsx"), "import React from'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}");
const posix = (value) => value.replaceAll("\\", "/");
const css = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })]).process(
  '@import "tailwindcss" source(none);\n@source "' + posix(path.join(root, "src")) + '";\n@source "' + posix(entry) + '";',
  { from: path.join(out, "input.css") },
)).css;
await require("next/dist/build/swc").loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({
  mode: "development", target: "web", context: root, entry,
  output: { path: out, filename: "fixture.js" }, devtool: false,
  plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("development") })],
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias: { "@src": path.resolve("src"), "next/link": path.join(out, "link.tsx"), "next/navigation": path.join(out, "navigation.js") } },
  module: { rules: [{ test: /\.[jt]sx?$/u, exclude: /node_modules/u, use: [{ loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: { rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {}, swcCacheDir: path.join(out, "swc"), serverComponents: false, serverReferenceHashSalt: "trash-feedback-controls", esm: false, transpilePackages: [] } }] }] },
});
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close((closeError) =>
  error || closeError || stats?.hasErrors() ? reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors))) : resolve())));
const bundle = fs.readFileSync(path.join(out, "fixture.js"));
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/fixture.js" ? "application/javascript" : req.url === "/fixture.css" ? "text/css" : "text/html");
  res.end(req.url === "/fixture.js" ? bundle : req.url === "/fixture.css" ? css : '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
const check = async (name, work) => { await work(); checks.push(name); };
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(1500);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  const dialog = page.locator("[data-admin-confirm-dialog]");
  const submit = dialog.locator("[data-admin-confirm-submit]");
  const cancel = dialog.locator("[data-admin-confirm-cancel]");
  const trigger = page.locator("[data-admin-entity-list-consumer]").getByRole("button", { name: "إفراغ المحذوفات", exact: true });
  const state = () => page.evaluate(() => window.readState());
  const settle = (result) => page.evaluate((value) => window.settle(value), result);
  const failure = { ok: false, code: "trash_count_changed", title: "تعذر إفراغ المحذوفات", message: "تغيّر عدد المحذوفات. أعد المحاولة." };
  const success = { ok: true, completion: "committed", title: "تم إفراغ المحذوفات", message: "تم الحذف النهائي بنجاح." };
  async function mount(spec, options = {}) {
    await page.evaluate((config) => window.mount(config), { entity: spec.entity, ...options });
    await expect(page.locator("[data-admin-entity-list-consumer]")).toHaveAttribute("data-admin-entity-list-consumer", spec.entity);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-admin-entity-list]")).toHaveCount(1);
    await expect(page.locator("[data-admin-feedback-channel-viewport]")).toHaveCount(0);
  }
  async function shown(spec, variant) {
    const notice = page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="' + spec.channel + '"]');
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveAttribute("data-admin-feedback-variant", variant);
    await expect(notice).toBeVisible();
    return notice;
  }
  async function reachable(locator) {
    assert.equal(await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && (hit === element || element.contains(hit));
    }), true, "Actual feedback control must be topmost and reachable");
  }
  for (const spec of consumerSpecs) {
    await check(spec.entity + " baseline real failure is retained internally but invisible in composed owners", async () => {
      await mount(spec, { baseline: true });
      await trigger.click(); await submit.click();
      await expect.poll(async () => (await state()).calls.length).toBe(1);
      await settle(failure); await expect(submit).toBeEnabled();
      assert.deepEqual((await state()).entries, [{ channel: spec.channel, placement: "inline", variant: "danger" }]);
      await expect(page.locator("[data-admin-feedback-entry]")).toHaveCount(0);
      await expect(dialog).toHaveCount(1); assert.equal((await state()).succeeded, 0);
      await assert.rejects(shown(spec, "danger"));
      await cancel.click();
    });
    await check(spec.entity + " cancellation performs no action and restores exact trigger focus", async () => {
      await mount(spec); await trigger.click(); await cancel.click();
      assert.equal((await state()).calls.length, 0); await expect(trigger).toBeFocused();
    });
    await check(spec.entity + " pending confirm and cancellation cannot dispatch duplicates", async () => {
      await trigger.click(); await submit.click();
      await expect(submit).toBeDisabled(); await expect(cancel).toBeDisabled();
      await submit.evaluate((button) => button.click()); await cancel.evaluate((button) => button.click());
      await page.keyboard.press("Escape");
      assert.equal((await state()).calls.length, 1); await expect(dialog).toHaveCount(1);
    });
    await check(spec.entity + " actual rejected result remains failure with visible usable global feedback and retained retry", async () => {
      await settle(failure); await expect(submit).toBeEnabled();
      const notice = await shown(spec, "danger");
      await expect(notice).toContainText(failure.message);
      await expect(notice).toHaveAttribute("data-admin-feedback-critical", "true");
      await expect(dialog).toHaveCount(1); assert.equal((await state()).succeeded, 0);
      const stacking = await page.evaluate(() => ({
        feedback: getComputedStyle(document.querySelector("[data-admin-feedback-viewport]")).zIndex,
        confirmation: getComputedStyle(document.querySelector("[data-admin-confirm-dialog-root]")).zIndex,
      }));
      assert.ok(Number(stacking.feedback) > Number(stacking.confirmation), JSON.stringify(stacking));
      const close = notice.getByRole("button", { name: "إغلاق الإشعار", exact: true });
      await reachable(close);
      await close.click();
      await expect(page.locator("[data-admin-feedback-entry]")).toHaveCount(0);
      await expect(dialog).toHaveCount(1); await expect(submit).toBeEnabled();
    });
    await check(spec.entity + " explicit retry succeeds once and preserves actual consumer count/ack adapter", async () => {
      await submit.click(); await settle(success); await expect(dialog).toHaveCount(0);
      const notice = await shown(spec, "success");
      await expect(notice).toHaveAttribute("data-admin-feedback-critical", "false");
      assert.equal((await state()).succeeded, 1);
      assert.deepEqual((await state()).calls, [{ expectedCount: 3, acknowledged: spec.entity === "topics" ? null : true }, { expectedCount: 3, acknowledged: spec.entity === "topics" ? null : true }]);
      await expect(trigger).toBeFocused();
    });
    await check(spec.entity + " committed warning is visible and closes confirmation without misclassifying failure", async () => {
      await mount(spec); await trigger.click(); await submit.click();
      await settle({ ...success, feedbackStatus: "warning" });
      await expect(dialog).toHaveCount(0); await shown(spec, "warning");
      assert.equal((await state()).succeeded, 1);
      await assert.rejects(shown(spec, "danger"));
    });
    await check(spec.entity + " failed warning retains dialog and never invokes success", async () => {
      await mount(spec); await trigger.click(); await submit.click();
      await settle({ ...failure, feedbackStatus: "warning" }); await expect(submit).toBeEnabled();
      const notice = await shown(spec, "warning"); assert.equal((await state()).succeeded, 0);
      await expect(dialog).toHaveCount(1);
      await assert.rejects(shown({ ...spec, channel: "entity-list:foreign" }, "warning"));
      const close = notice.getByRole("button", { name: "إغلاق الإشعار", exact: true });
      await page.evaluate(() => { const blocker = document.createElement("div"); blocker.id = "controlled-occlusion"; blocker.style.cssText = "position:fixed;inset:0;z-index:9999;background:transparent"; document.body.append(blocker); });
      await assert.rejects(reachable(close));
      await page.evaluate(() => document.getElementById("controlled-occlusion").remove());
      await reachable(close); await cancel.click();
    });
    await check(spec.entity + " empty owned trash disables action and produces neither command nor notice", async () => {
      await mount(spec, { count: 0 }); await expect(trigger).toBeDisabled();
      await trigger.evaluate((button) => button.click());
      assert.equal((await state()).calls.length, 0); await expect(dialog).toHaveCount(0);
      await expect(page.locator("[data-admin-feedback-entry]")).toHaveCount(0);
    });
  }
  assert.deepEqual(errors, []);
  await context.close();
  const report = { status: "pass", classification: "PRODUCT_REGRESSION", controls: checks.length, checks, sourceBindings, baseline: { placement: "inline", reproducedConsumers: consumerSpecs.map((row) => row.consumer), failureObservable: false }, candidate: { placement: "global", consumers: consumerSpecs.map((row) => row.consumer), realCssTopmostDismissControl: true }, scope: "Mounted actual current consumer TrashHeader JSX and mapper adapters with installed shared Surface, EntityList, Confirmation and Feedback owners. Controlled in-memory Action ports, no authenticated application or native database proof.", automaticCoverage: [], globalClosed: false };
  fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(report, null, 2));
  return report;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}


}
