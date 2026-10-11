import { verifyMediaGuidanceBrowser } from "./media-guidance-browser.mjs";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function load(relative, ports = {}) {
  const output = ts.transpileModule(readFileSync(resolve(root, relative), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const m = { exports: {} };
  Function("module", "exports", "require", output)(m, m.exports, key => {
    if (key in ports) return ports[key];
    if (key === "server-only") return {};
    return require(key);
  });
  return m.exports;
}
export async function verifyMediaDimensionsContract() {
  await verifyMediaGuidanceBrowser();
  const adminPresentation = load("src/components/admin/media/AdminDeletedMediaNotice.tsx");
  const payloadOwner = load("src/lib/admin/media-topic-payload.ts");
  for (const status of ["active", "deleted", "missing", "empty"]) {
    const value = status === "empty" ? "" : "/preview-fixture.png";
    const row = { id: 1, title: "Preview fixture", content_type: "gallery", status: "draft", image: value, content: "Body", media_payload: {kind:"gallery",images:[{url:value,alt:"Preserved alt",caption:"Preserved caption"}]} };
    const original = JSON.stringify(row);
    const prefix = "../../../../../../";
    const query = {select(){return this},eq(){return this},is(){return this},async maybeSingle(){return {data:row,error:null}}};
    const Preview = load("src/app/admin/content/topics/[id]/preview/page.tsx", {
      [prefix+"components/admin/media/AdminDeletedMediaNotice"]: adminPresentation,
      [prefix+"lib/admin/media-catalog/deleted-reference-state"]: {readDeletedManagedValues:async()=>status==="deleted"?[value]:[],readMissingManagedValues:async()=>status==="missing"?[value]:[]},
      [prefix+"components/admin/content/AdminCategoryBadge"]:{default:()=>null},
      [prefix+"components/admin/ui"]:{AdminPageHeader:()=>null,AdminStatusPill:()=>null},
      [prefix+"components/content/RichTextContent"]:{default:()=>null},
      [prefix+"lib/admin/media-topic-payload"]:payloadOwner,
      [prefix+"lib/admin/auth/require-admin-session"]:{requireAdminSession:async()=>({})},
      [prefix+"lib/admin/content/content-types"]:{getContentTypeLabel:x=>x,isContentType:()=>true},
      [prefix+"lib/admin/content/content-status-metadata"]:{getContentStatusMetadata:()=>({tone:"neutral",label:"Draft"})},
      [prefix+"lib/supabase-admin"]:{getSupabaseAdmin:()=>({from:()=>query})},
    }).default;
    const html=renderToStaticMarkup(await Preview({params:Promise.resolve({id:"1"})}));
    assert.equal((html.match(/<img\b/g)||[]).length,status==="active"?2:0);
    assert(html.includes("Preserved caption"));assert(!/src="\s*"/.test(html));assert.equal(JSON.stringify(row),original);
    if(status==="deleted"||status==="missing")assert(html.includes(`data-admin-media-preview-state="${status}"`));
  }
  console.log("PASS Admin saved-content preview: active/deleted/missing/empty, no retained image, caption and row preserved");
  const contract = load("src/lib/media/media-slot-contract.ts");
  const Component = load("src/components/admin/media/AdminMediaSlotGuidance.tsx", { "../../../lib/media/media-slot-contract": contract }).default;
  const hero = load("src/lib/hero/hero-content-controls.ts");
  const desktop = hero.resolveHeroMediaSlot("home-cinematic", "desktop");
  const mobile = hero.resolveHeroMediaSlot("home-cinematic", "mobile");
  assert.equal(desktop.display.kind, "responsive");
  assert.equal(mobile.display.kind, "responsive");
  assert.match(mobile.display.description, /100vh/);
  assert.notDeepEqual(desktop, mobile);
  const fixture = { owner: "fixture/new-template", slot: "portrait", evidence: ["fixture"], display: { kind: "ratio", ratio: [2, 3] }, fit: "contain" };
  const Field = load("src/components/admin/media/AdminMediaImageField.tsx", {
    "next/image": { default: () => null },
    "./AdminMediaSlotGuidance": { default: Component },
    "./AdminDeletedMediaNotice": load("src/components/admin/media/AdminDeletedMediaNotice.tsx"),
    "./AdminMediaPickerModal": { default: () => null },
  }).default;
  const markup = renderToStaticMarkup(React.createElement(Field, { name: "fixture", label: "fixture", mediaSlot: fixture }));
  assert.match(markup, /2:3/); assert.ok(markup.includes("fixture/new-template"));
  assert.doesNotMatch(markup, /1920|1080|1600/);
  assert.notEqual(markup, renderToStaticMarkup(React.createElement(Component, { slot: mobile })));
  assert.match(hero.resolveHeroMediaSlot("internal-page", "desktop").display.description, /62vh/);
  const queryCalls = [];
  const query = { select(value) { queryCalls.push(value); return this; }, eq(key, value) { queryCalls.push([key,value]); return this; }, async in(key, values) { queryCalls.push([key,values]); return { data: [{ bucket: "images", object_key: "images/original.png", width: 400, height: 600 }], error: null }; } };
  const ports = Object.fromEntries(["../media-storage-adapter", "../media-library", "../entity-list/search-normalization", "./identity", "./binary-metadata", "./reference-providers", "./readiness"].map(name => [name, {}]));
  ports.path = { default: require("node:path") };
  ports["../../supabase-admin"] = { getSupabaseAdmin: () => ({ from: table => { assert.equal(table, "media_assets"); return query; } }) };
  ports["../../storage/upload-cms-asset"] = { parseManagedStorageAsset: value => value === "original" || value === "unknown" ? { kind: "image", bucket: "images", objectPath: "images/" + value + ".png" } : null };
  const catalog = load("src/lib/admin/media-catalog/catalog.ts", ports);
  assert.deepEqual(await catalog.readCatalogOriginalDimensions(["original", "unknown", "external", "original"]), [
    { value: "original", width: 400, height: 600 }, { value: "unknown", width: null, height: null },
  ]);
  assert.deepEqual(queryCalls[0], "bucket,object_key,width,height");
  const metadata = load("src/lib/admin/media-catalog/binary-metadata.ts");
  const sharp = require("sharp");
  const bytes = await sharp({ create: { width: 400, height: 600, channels: 3, background: "#b98724" } }).png().toBuffer();
  const original = await metadata.readUploadBinaryMetadata(new File([bytes], "original.png"), "image");
  assert.equal(original.width, 400); assert.equal(original.height, 600);
  const rendered = await sharp(bytes).resize(40, 60).png().toBuffer();
  const resized = await metadata.readUploadBinaryMetadata(new File([rendered], "rendered.png"), "image");
  assert.equal(resized.width, 40); assert.equal(original.width, 400);
  for (const name of ["AdminMediaImageField", "AdminMediaGalleryField", "AdminMediaPickerModal", "AdminMediaSlotGuidance"]) {
    const source = readFileSync(resolve(root, "src/components/admin/media/" + name + ".tsx"), "utf8");
    assert.doesNotMatch(source, /DIMENSION_HINTS|DIMENSION_CARD_LABELS|1920|1080|1600|hero-mobile/);
  }
  const heroSource = readFileSync(resolve(root, "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx"), "utf8");
  assert.doesNotMatch(heroSource, /commitMetrics\(image.naturalWidth/);
  assert.match(heroSource, /onChange=\{setGuidanceVariant\}/);
  assert.match(heroSource, /resolveHeroMediaSlot\(guidanceVariant, "mobile"\)/);
  console.log("PASS Media dimensions: real original binary, rendition separation, responsive Hero, new ratio template fixture, no generic hardcoded dimensions");
}
