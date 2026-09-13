import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createRemainingContentOwnerHarness } from "./fixtures/remaining-content-owner-harness.mjs";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".tmp-qa/evidence-adoption-gaps/content");
await mkdir(out, { recursive: true });
const runId = Date.now();
const only = process.argv.find(argument => argument.startsWith("--only="))?.slice(7).split(",");
const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Unexpected owner network request blocked before transport"); };
const owners = createRemainingContentOwnerHarness(root);
const form = entries => { const result = new FormData(); for (const [key, value] of entries) result.append(key, value); return result; };
const entry = String.raw`
import React,{useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';
import Content from '@src/components/admin/page-blocks/ContentModuleEditClient';
import Hero from '@src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient';
import Media from '@src/components/admin/content/editors/media/MediaContentForm';
import ProjectHero from '@src/components/projects/details/ProjectDetailsHero';
import {resolveContentModuleEditorConfig} from '@src/lib/page-blocks/module-edit-registry';
import {resolveHeroContentControlsForVariant} from '@src/lib/hero/hero-content-controls';
const root=createRoot(document.getElementById('root'));
const assignmentContext={assignments:[],pages:[]};
const block={id:51,name:'Proof block',slug:'',description:null,style_preset:'premium-dark',status:'unpublished',updated_at:'2026-09-13T00:00:00.000Z'};
window.calls=0;window.payloads=[];window.mode='failure';
window.action=async(...args)=>{
 const data=args.find(value=>value instanceof FormData);window.calls++;window.payloads.push([...data.entries()].filter(([,value])=>typeof value==='string'));
 await new Promise(resolve=>window.release=resolve);
 if(window.kind.startsWith('media:')){const result=await window.ownerMedia(args[0],window.payloads.at(-1),window.mode);window.lastActionResult=result;return result;}
 if(window.mode==='failure')throw new Error('isolated_action_failure');
};
function Fixture({kind,config,values,onCommitted}){
 useLayoutEffect(onCommitted,[kind,config,values,onCommitted]);
 if(kind==='project-render')return <ProjectHero project={{id:'P101',slug:'proof-project',code:'P101',englishName:'Separate Project title',arabicName:'اسم المشروع',shortDescription:'Separate Project description',location:{label:'Separate Project location'},heroImage:{src:'/proof.svg',alt:'Project image'},heroBoxImage:{src:'/proof.svg',alt:'Project box'},brochureUrl:'/brochure.pdf',tracking:{}}} presentation={{...resolveHeroContentControlsForVariant(config,'project-detail'),imageComposition:config.imageComposition}}/>;
 if(kind==='hero')return <Hero hero={{...block,variant:'project-detail',slug:'project-detail'}} config={config} imagesText='' mobileImagesText='' variantOptions={[{value:'project-detail',label:'Project Detail'}]} assignmentContext={assignmentContext}/>;
 if(kind.startsWith('media:'))return <Media mode={values.id?'edit':'create'} values={values} contentType={kind.slice(6)} categories={[{id:1,name:'Proof category',slug:'proof-category',depth:0,is_active:true,status:'published'}]} series={[]}/>;
 const normalized=resolveContentModuleEditorConfig({slug:kind,variant:kind,config});
 return <Content block={{...block,slug:kind,variant:kind}} config={normalized} assignmentContext={assignmentContext} projectDetailHeroEditorLinks={{root:'/hero-proof',buttons:'/hero-proof?tab=buttons'}} topicCategoryOptions={[]} updateAction={window.action}/>;
}
let generation=0;
window.mount=(kind,config={},values={})=>new Promise(resolve=>{window.kind=kind;root.render(<AdminFeedbackProvider key={++generation}><Fixture kind={kind} config={config} values={values} onCommitted={resolve}/></AdminFeedbackProvider>);});
window.capture=()=>[...new FormData(document.querySelector('form[data-admin-form-runtime]')).entries()].filter(([,value])=>typeof value==='string');
`;
await writeFile(path.join(out, "entry.tsx"), entry);
await writeFile(path.join(out, "navigation.ts"), `export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';const router={push(href){window.navigation=href},replace(href){window.navigation=href},refresh(){}};export const useRouter=()=>router;export const usePathname=()=>'/proof';export const useSearchParams=()=>new URLSearchParams();`);
await writeFile(path.join(out, "link.tsx"), `import React from 'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}`);
await writeFile(path.join(out, "image.tsx"), `import React from 'react';export default function Image({fill,priority,unoptimized,quality,loader,...props}){return <img {...props}/>}`);
await writeFile(path.join(out, "actions.ts"), `export const updateHeroTemplateDetails=(...args)=>window.action(...args);export const saveContentForm=(...args)=>window.action(...args);`);
await writeFile(path.join(out, "link-actions.ts"), `export const browseAdminLinksAjax=async()=>[];export const browseMenusPickerAjax=async()=>[];export const browseMenuItemsPickerAjax=async()=>[];export const browseTopicCategoriesPickerAjax=async()=>[];export const resolveAdminLinkAjax=async()=>[];`);
const { loadBindings } = require("next/dist/build/swc"); await loadBindings();
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({ mode: "development", target: "web", context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "fixture.js" }, devtool: false,
  plugins: [new webpack.NormalModuleReplacementPlugin(/(actions|save|\/ui)$/, resource => {
    const full = path.resolve(resource.context, resource.request).replaceAll("\\", "/");
    if (full.endsWith("/components/admin/ui")) resource.request = path.join(root, "src/components/admin/ui/index.ts");
    else if (full.endsWith("/lib/admin/links/actions")) resource.request = path.join(out, "link-actions.ts");
    else if (full.endsWith("/pages-blocks/blocks/hero/actions") || full.endsWith("/topics/editor-actions/save")) resource.request = path.join(out, "actions.ts");
  }), new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias: { "@src": path.join(root, "src"), "next/navigation": path.join(out, "navigation.ts"), "next/link": path.join(out, "link.tsx"), "next/image": path.join(out, "image.tsx") } },
  module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{ loader: require.resolve("next/dist/build/webpack/loaders/next-swc-loader"), options: { rootDir: root, isServer: false, compilerType: "client", hasReactRefresh: false, nextConfig: {}, jsConfig: {}, swcCacheDir: path.join(out, "swc-cache"), serverComponents: false, serverReferenceHashSalt: "remaining-content-proof", esm: false, transpilePackages: [] } }] }] },
});
let compiledFiles = [];
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => {
  if (error || closeError || stats?.hasErrors()) reject(error ?? closeError ?? new Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)));
  else { compiledFiles = [...stats.compilation.fileDependencies].filter(file => file.startsWith(path.join(root, "src"))); resolve(); }
})));
const bundle = await readFile(path.join(out, "fixture.js"));
const server = createServer((request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("content-type", "application/javascript"); response.end(bundle); }
  else if (request.url === "/proof.svg") { response.setHeader("content-type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#888"/></svg>'); }
  else { response.setHeader("content-type", "text/html"); response.end('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{font-family:Arial;background:#111;color:#fff}input,button,textarea{padding:8px;margin:4px}button{cursor:pointer}[hidden]{display:none!important}fieldset{border:0}</style><div id="root"></div><script src="/fixture.js"></script></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [], attempts = [];
async function check(name, run) {
  if (only && !only.some(prefix => name.startsWith(prefix))) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blocked = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && ["/", "/fixture.js", "/proof.svg"].includes(url.pathname)) return route.continue();
    blocked.push(url.pathname); return route.abort();
  });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  await page.exposeFunction("ownerMedia", async (previous, entries, mode) => {
    owners.state.failWrite = mode === "failure";
    return owners.media.saveMediaContentAdapter(previous, form(entries));
  });
  try {
    await page.goto(origin); await page.waitForFunction(() => typeof window.mount === "function");
    const detail = await run(page); assert.deepEqual(errors, []);
    results.push({ name, status: "PASS", ...detail, blockedRequests: blocked }); console.log(`PASS ${name}`);
  } catch (error) {
    attempts.push({ name, message: String(error), errors });
    await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
    throw error;
  } finally {
    await context.close();
    const evidence = JSON.stringify({ results, attempts, boundary: "Real mounted editors, canonical parsers and typed Media Action with isolated in-memory Auth, DB, cache, audit and media ports. Block redirect transports do not acknowledge a saved redirect: their proof stops at rejection/input retention, second submission, parser output and explicitly mounted read-back. No authenticated session, database persistence, production, provider playback or whole composed page claim." }, null, 2);
    await writeFile(path.join(out, "results.json"), evidence);
    await writeFile(path.join(out, `results-${runId}.json`), evidence);
  }
}
const mount = (page, kind, config = {}, values = {}) => page.evaluate(([kind, config, values]) => Promise.race([window.mount(kind, config, values), new Promise((_, reject) => setTimeout(() => reject(new Error(`Mounted fixture did not commit: ${kind}`)), 10000))]), [kind, config, values]);
async function reveal(field) {
  const tabIds = await field.evaluate(element => { const ids = []; for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.getAttribute("role") === "tabpanel" && parent.getAttribute("aria-labelledby")) ids.unshift(parent.getAttribute("aria-labelledby")); return ids; });
  for (const id of tabIds) await field.page().locator(`[id="${id}"]`).click();
}
async function fill(page, name, value) { const field = page.locator(`[name="${name}"]`).first(); await reveal(field); await field.fill(value); }
async function submit(page) {
  const before = await page.evaluate(() => window.calls);
  await page.locator('form[data-admin-form-runtime] button[type="submit"]').first().click();
  await page.waitForFunction(before => window.calls === before + 1, before);
}
async function release(page) { await page.evaluate(() => window.release()); await page.waitForFunction(() => !document.querySelector('form[data-admin-form-runtime][aria-busy="true"]') || (window.kind.startsWith('media:') && window.mode === 'success' && Boolean(window.navigation))); }
const branches = [
  { key: "home-projects", fields: { projects_limit: "4", card_cta_label: "Scoped card action" }, config: {} },
  { key: "projects-hub-hero", fields: { limit: "3", autoplay_ms: "7500", empty_state: "Scoped empty projects" }, config: {} },
  { key: "projects-hub-featured", fields: { title: "Scoped featured title", autoplay_ms: "8500" }, config: {} },
  { key: "projects-hub-listing", fields: { title: "Scoped listing title" }, config: {} },
  { key: "projects-hub-map", fields: { title: "Scoped map title", pin_0_district: "Scoped district", pin_0_right: "35%" }, config: { mapPins: [{ code: "P101", district: "Original", right: "50%", top: "50%" }] } },
];
try {
  for (const fixture of branches) await check(fixture.key, async page => {
    await mount(page, fixture.key, fixture.config);
    for (const [name, value] of Object.entries(fixture.fields)) await fill(page, name, value);
    await submit(page);
    const submitted = await page.evaluate(() => window.payloads.at(-1));
    const before = owners.state.writes;
    await release(page);
    for (const [name, value] of Object.entries(fixture.fields)) assert.equal(await page.locator(`[name="${name}"]`).inputValue(), value);
    assert.equal(owners.state.writes, before);
    await page.evaluate(() => window.mode = "success"); await submit(page); await release(page);
    const parsed = await owners.content.buildContentConfig(form(submitted), fixture.key, fixture.config);
    for (const value of Object.values(fixture.fields).filter(value => !/^\d+$/.test(value))) assert.ok(JSON.stringify(parsed).includes(value), `Current parser retains ${value}`);
    await mount(page, fixture.key, JSON.parse(JSON.stringify(parsed)));
    for (const [name, value] of Object.entries(fixture.fields)) assert.equal(await page.locator(`[name="${name}"]`).inputValue(), value, `${fixture.key} read-back ${name}`);
    if (fixture.key === "projects-hub-map") { const invalid = form(submitted); invalid.set("pin_0_right", "invalid"); await assert.rejects(() => owners.content.buildContentConfig(invalid, fixture.key, parsed)); }
    if (fixture.key === "projects-hub-listing") { const invalid = form(submitted); invalid.set("default_filter", "missing"); await assert.rejects(() => owners.content.buildContentConfig(invalid, fixture.key, parsed)); }
    return { fields: fixture.fields, mountedInputRetention: true, parserReadBack: true, redirectSaveAcknowledged: false, config: parsed };
  });
  await check("hero-project-detail", async page => {
    const config = { showTitle: false, showSubtitle: true, showProjectDownloadAction: false, showProjectTrackingAction: true, showProjectReservationAction: false, projectActionOrder: ["tracking", "reservation", "download"], heroElementOrder: ["description", "title", "subtitle", "eyebrow", "cta"], imageComposition: "cover-upper", descriptionBold: true };
    await mount(page, "hero", config);
    await fill(page, "name", "Scoped Project Detail presentation");
    const entries = await page.evaluate(() => window.capture());
    await submit(page); await release(page);
    assert.equal(await page.locator('[name="name"]').inputValue(), "Scoped Project Detail presentation");
    await page.evaluate(() => window.mode = "success"); await submit(page); await release(page);
    const data = form(entries); data.set("title", "Foreign template title"); data.set("description", "Foreign template description");
    const parsed = owners.hero.buildHeroConfig(data, "project-detail");
    assert.equal(Object.hasOwn(parsed, "title"), false); assert.equal(Object.hasOwn(parsed, "description"), false);
    for (const key of ["showTitle", "showProjectDownloadAction", "showProjectTrackingAction", "showProjectReservationAction", "projectActionOrder", "heroElementOrder", "imageComposition", "descriptionBold"]) assert.deepEqual(parsed[key], config[key]);
    await mount(page, "hero", parsed);
    const readBack = owners.hero.buildHeroConfig(form(await page.evaluate(() => window.capture())), "project-detail");
    assert.deepEqual(readBack, parsed);
    await mount(page, "project-render", parsed);
    assert.equal(await page.getByText("Separate Project title", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Foreign template title", { exact: true }).count(), 0);
    assert.ok(await page.getByText("Separate Project description", { exact: true }).count() > 0);
    assert.equal(await page.locator('[data-hero-element-order]').getAttribute('data-hero-element-order'), parsed.heroElementOrder.join(','));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('[data-hero-variant="project-detail"]').count(), 1);
    return { canonicalPresentation: parsed, isolatedRenderer: true, mountedInputRetention: true, redirectSaveAcknowledged: false, viewportWidths: [1280, 390] };
  });
  for (const type of ["news", "press", "site_update", "gallery"]) await check(`media-create-${type}`, async page => {
    const values = { category_id: 1, image: "/proof.svg", image_alt: "Proof cover", slug: `remaining-${type}`, title: `Scoped ${type} creation`, excerpt: "Scoped excerpt", content: "Scoped body", ...(type === "gallery" ? { media_payload: { kind: "gallery", images: [{ url: "/proof.svg", alt: "First proof", caption: "First caption" }] } } : {}) };
    await mount(page, `media:${type}`, {}, values);
    await fill(page, "title", `Preserved ${type} create input`);
    if (type === "news" || type === "site_update") await fill(page, "media_project", "P101");
    if (type === "gallery") await fill(page, "gallery_image_caption", "Preserved gallery caption");
    const before = owners.state.writes;
    await submit(page); await release(page);
    assert.equal(owners.state.writes, before); assert.equal(await page.locator('[name="title"]').inputValue(), `Preserved ${type} create input`);
    await page.evaluate(() => window.mode = "success"); await submit(page); await release(page);
    assert.equal(owners.state.writes, before + 1, JSON.stringify(await page.evaluate(() => window.lastActionResult)));
    const row = structuredClone(owners.state.rows.at(-1));
    assert.equal(row.content_type, type); assert.equal(row.status, "unpublished"); assert.equal(row.created_by, 7); assert.equal(row.title, `Preserved ${type} create input`);
    assert.equal(await page.evaluate(() => window.navigation), `/admin/content/topics/${row.id}`);
    if (type === "news" || type === "site_update") assert.equal(row.media_project, "P101");
    if (type === "gallery") { assert.equal(row.content, ""); assert.equal(row.media_payload.images[0].caption, "Preserved gallery caption"); }
    await mount(page, `media:${type}`, {}, JSON.parse(JSON.stringify(row)));
    assert.equal(await page.locator('[name="title"]').inputValue(), row.title);
    const readBack = form(await page.evaluate(() => window.capture()));
    assert.equal(readBack.get("content_type"), type); assert.equal(readBack.get("id"), String(row.id));
    const duplicate = form(await page.evaluate(() => window.payloads.at(-1))); duplicate.delete("id");
    const duplicateResult = await owners.media.saveMediaContentAdapter({ status: "idle", mode: "create", revision: 0 }, duplicate);
    assert.equal(duplicateResult.status, "error"); assert.ok(duplicateResult.fieldErrors?.slug); assert.equal(owners.state.writes, before + 1);
    return { isolatedCreateAction: true, mountedFailureRetry: true, createToEditResult: true, duplicateRejected: true, row };
  });
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve)); globalThis.fetch = originalFetch;
  const candidates = [...new Set([...owners.files].map(file => path.join(root, file)).concat(compiledFiles))].sort();
  const sources = (await Promise.all(candidates.map(async file => (await stat(file)).isFile() ? file : null))).filter(Boolean);
  await writeFile(path.join(out, "source-hashes.json"), JSON.stringify(await Promise.all(sources.map(async file => ({ file: path.relative(root, file).replaceAll("\\", "/"), sha256: createHash("sha256").update(await readFile(file)).digest("hex") }))), null, 2));
}
