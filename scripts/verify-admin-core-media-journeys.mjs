import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { chromium } from "playwright";
import { createJiti } from "jiti";
import { buildCoreMediaPlan, matchesCoreMediaResponse, assertCoreMediaReceipt, assertCoreMediaUnchanged, assertCoreMediaAsset, assertCoreMediaAudit, validateCoreMediaReplaySpecimen, assertCoreMediaPermissionPrerequisites, assertCoreMediaPermissionResponse, coreMediaSyntheticPdf } from "./fixtures/admin-core-media-journeys.mjs";

const checks = [], digest = input => createHash("sha256").update(input).digest("hex");
const check = async (name, task) => { await task(); checks.push({ name, status: "pass" }); };
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: forms } = await jiti.import("../src/lib/admin/form-system/adoption-manifest.ts");
const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../src/lib/admin/interaction-system/adoption-manifest.ts");
const fixture = { namespace: "qa-core-media-0123456789abcdef", namespaceUnique: true, maximumAssets: 13, article: { id: 91, slug: "qa-core-media-article", title: "QA Media", editPath: "/admin/content/topics/91" } };
const planInput = { fixtures: { mediaClosure: fixture }, forms, collections: ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces, requiredCases: [{ consumer: "media-library", key: "current-media-case" }] };
await check("actual-manifests-and-twelve-groups", () => assert.equal(buildCoreMediaPlan(planInput).groups.length, 12));
for (const kind of ["namespace", "namespaceUnique", "maximumAssets", "article", "missing-form", "missing-surface", "missing-collection", "missing-case"]) {
  const input = structuredClone(planInput);
  if (kind === "missing-form") input.forms = [];
  else if (kind === "missing-surface") input.forms.find(row => row.id === "activity-sitemap-media-commands").surfaces = ["activity-query"];
  else if (kind === "missing-collection") input.collections = [];
  else if (kind === "missing-case") input.requiredCases = [];
  else input.fixtures.mediaClosure[kind] = null;
  await check("plan-rejects-" + kind, () => assert.throws(() => buildCoreMediaPlan(input)));
}
const responseFor = (url, method = "GET") => ({ url: () => url, request: () => ({ method: () => method, postDataJSON: () => ({ operation: "update_metadata" }) }) });
const matchedOrigin = "http://127.0.0.1:65431", matchedPath = matchedOrigin + "/api/admin/media-library";
await check("catalog-response-matches-current-request", () => assert.equal(matchesCoreMediaResponse(responseFor(matchedPath + "?q=current&page=2"), matchedOrigin, "GET", { queryMatch: { q: "current", page: "2", folder: null } }), true));
for (const [label, url, method] of [["prior-query", matchedPath + "?q=old&page=2", "GET"], ["prior-folder", matchedPath + "?q=current&page=2&folder=images", "GET"], ["prior-page", matchedPath + "?q=current&page=1", "GET"], ["wrong-method", matchedPath + "?q=current&page=2", "POST"], ["foreign", "http://localhost:65431/api/admin/media-library?q=current&page=2", "GET"]]) {
  await check("catalog-response-rejects-" + label, () => assert.equal(matchesCoreMediaResponse(responseFor(url, method), matchedOrigin, "GET", { queryMatch: { q: "current", page: "2", folder: null } }), false));
}
const body = Buffer.from('{"operation":"update_metadata"}');
const specimen = { url: "http://127.0.0.1:65431/api/admin/media-library", method: "PATCH", body, bodySha256: digest(body), acknowledged: true, headers: { "content-type": "application/json", origin: "http://127.0.0.1:65431" } };
await check("exact-memory-only-replay-shape", () => validateCoreMediaReplaySpecimen("http://127.0.0.1:65431", specimen));
for (const kind of ["foreign", "wrong-origin", "body-drift", "cookie", "not-acknowledged", "oversize", "bad-method", "wrong-route"]) {
  const value = { ...specimen, body: Buffer.from(body), headers: { ...specimen.headers } };
  if (kind === "foreign") value.url = "http://localhost:65431/api/admin/media-library";
  if (kind === "wrong-origin") value.headers.origin = "https://external.invalid";
  if (kind === "body-drift") value.body = Buffer.from("{}");
  if (kind === "cookie") value.headers.cookie = "private";
  if (kind === "not-acknowledged") value.acknowledged = false;
  if (kind === "oversize") value.body = Buffer.alloc(2 * 1024 * 1024 + 1);
  if (kind === "bad-method") value.method = "PUT";
  if (kind === "wrong-route") value.url = "http://127.0.0.1:65431/api/admin/auth/logout";
  await check("replay-rejects-" + kind, () => assert.throws(() => validateCoreMediaReplaySpecimen("http://127.0.0.1:65431", value)));
}
const requiredOperations = ["upload", "create_folder", "reconcile", "update_metadata", "move_asset", "replace_all", "DELETE", "/api/admin/media-library", "/api/admin/media-usage"];
await check("permission-requires-all-observed-native-backed-operations", () => assertCoreMediaPermissionPrerequisites(requiredOperations.map(operation => ({operation})), new Set(requiredOperations)));
for (const missing of requiredOperations) await check("permission-rejects-unverified-" + missing, () => assert.throws(() => assertCoreMediaPermissionPrerequisites(requiredOperations.map(operation => ({operation})), new Set(requiredOperations.filter(value => value !== missing)))));
for (const [status,value] of [[200,{error:"Unauthorized"}],[400,{error:"duplicate"}],[500,{error:"failure"}],[302,{error:"Unauthorized"}],[401,{error:"validation"}]]) await check("permission-rejects-status-shape-" + status, () => assert.throws(() => assertCoreMediaPermissionResponse(status,value)));
await check("actual401-is-auth-denial", () => assertCoreMediaPermissionResponse(401,{error:"Unauthorized"}));
const current = { id: randomUUID(), kind: "media-library-state", status: "pass", ownedRunId: "controlled", namespace: fixture.namespace, articleId: 91, qaActorId: 7,
  article: { id: 91 }, assets: [], objects: [], folders: [], references: [], leases: [], reservations: [], audits: [], binaries: [], storageSha256: "a".repeat(64), publicDataSha256: "b".repeat(64), publicTableInventorySha256: "c".repeat(64) };
await check("receipt-requires-native-identity", () => assertCoreMediaReceipt(current, current, fixture));
for (const field of ["id", "kind", "status", "namespace", "articleId", "qaActorId", "ownedRunId", "assets", "storageSha256"]) await check("receipt-rejects-" + field, () => assert.throws(() => assertCoreMediaReceipt({ ...current, [field]: null }, current, fixture)));
await check("all-public-and-storage-no-write", () => assertCoreMediaUnchanged(current, structuredClone(current), true));
for (const key of ["article", "assets", "objects", "folders", "references", "leases", "reservations", "audits", "storageSha256", "publicDataSha256", "publicTableInventorySha256", "qaActorId"]) {
  await check("no-write-rejects-" + key, () => assert.throws(() => assertCoreMediaUnchanged(current, { ...current, [key]: "changed" }, true)));
}
const provedAsset = { id: "owned", provider: "supabase", uploaded_by: 7, bucket: "cms-images", object_key: "images/controlled.png", public_url: "http://127.0.0.1:65431/controlled.png", status: "active", byte_size: 17, checksum: "d".repeat(64) };
const provedAssetState = { ...current, assets: [provedAsset], objects: [{ bucket_id: provedAsset.bucket, name: provedAsset.object_key }], binaries: [{ publicUrl: provedAsset.public_url, status: 200, missing: false, bytes: 17, sha256: provedAsset.checksum }] };
await check("joined-object-binary-proof", () => assertCoreMediaAsset(provedAssetState, "owned", { status: "active" }));
for (const kind of ["missing-object", "missing-binary", "wrong-binary-hash", "wrong-binary-size", "deleted-still-readable"]) {
  const value = structuredClone(provedAssetState);
  if (kind === "missing-object") value.objects = [];
  if (kind === "missing-binary") value.binaries = [];
  if (kind === "wrong-binary-hash") value.binaries[0].sha256 = "e".repeat(64);
  if (kind === "wrong-binary-size") value.binaries[0].bytes = 18;
  if (kind === "deleted-still-readable") { value.assets[0].status = "deleted"; value.objects = []; }
  await check("asset-rejects-" + kind, () => assert.throws(() => assertCoreMediaAsset(value, "owned", {})));
}
const audit = { id: 1, actor_admin_user_id: 7, action: "media_asset.update", metadata: { assetId: "owned" } };
await check("semantic-audit-exact-actor", () => assert.equal(assertCoreMediaAudit(current, { ...current, audits: [audit] }, audit.action, row => row.metadata.assetId === "owned"), 1));
for (const rows of [[], [audit, { ...audit, id: 2 }], [{ ...audit, actor_admin_user_id: 8 }]]) await check("audit-negative-" + checks.length, () => assert.throws(() => assertCoreMediaAudit(current, { ...current, audits: rows }, audit.action, () => true)));
const nativePath = "scripts/verify-admin-core-media-isolated.mts";
const nativeSource = readFileSync(nativePath, "utf8");
const compiled = ts.transpileModule(nativeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=", "base64");
let mode = "valid", foreignHits = 0, publicGets = 0;
const foreign = createServer((req, res) => { foreignHits++; res.end("must not follow"); });
foreign.listen(0, "127.0.0.1"); await once(foreign, "listening");
const server = createServer((req, res) => {
  if (req.url === "/api/admin/media-library") {
    if (req.method === "PATCH" && req.headers.cookie) { res.writeHead(200, { "content-type": "application/json" }); res.end('{"updated":true}'); }
    else { res.writeHead(401, { "content-type": "application/json" }); res.end('{"error":"Unauthorized"}'); }
    return;
  }
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end('<button id="save">Save</button><p id="result"></p><input id="draft" value="retained"><script>save.onclick=async()=>{save.disabled=true;try{const r=await fetch("/api/admin/media-library",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({operation:"update_metadata"})});result.textContent=String(r.status)}catch{result.textContent="failure"}finally{save.disabled=false}}</script>'); return; }
  publicGets++;
  if (mode === "redirect") { res.writeHead(302, { location: "http://127.0.0.1:" + foreign.address().port + "/private" }); res.end(); return; }
  if (mode === "missing" || mode === "missing400") { res.writeHead(mode === "missing" ? 404 : 400, { "content-type": "application/json" }); res.end('{"statusCode":"404","error":"not_found"}'); return; }
  if (mode === "ambiguous400") { res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"arbitrary_failure"}'); return; }
  if (mode === "oversize-binary") { res.writeHead(200, { "content-type": "image/png" }); res.end(Buffer.alloc(100 * 1024 + 1)); return; }
  res.writeHead(200, { "content-type": "image/png" }); res.end(pixel);
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
const origin = "http://127.0.0.1:" + server.address().port;
try {
  for (const kind of ["valid", "missing", "missing400", "unregistered", "bad-request-key", "missing-account", "duplicate-account", "changed-actor", "wrong-article", "preexisting-image", "existing-namespace", "existing-storage-object", "existing-folder", "foreign-api", "wrong-asset-actor", "foreign-asset", "wrong-bucket", "bucket-private", "bucket-limit", "bucket-mime", "too-many-assets", "too-many-objects", "audit-wrong-actor", "redirect", "ambiguous400", "oversize-binary", "query-failure"]) {
    mode = kind; const namespace = "qa-core-media-" + digest("controlled-media").slice(0, 16), assetId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const publicUrl = origin + "/storage/v1/object/public/cms-images/images/" + namespace + "/pixel.png";
    const asset = { id: assetId, provider: "supabase", bucket: kind === "wrong-bucket" ? "other" : "cms-images", object_key: "images/" + namespace + "/pixel.png", public_url: kind === "foreign-asset" ? "https://external.invalid/pixel.png" : publicUrl, byte_size: pixel.length, uploaded_by: kind === "wrong-asset-actor" ? 8 : 7, status: kind.startsWith("missing") ? "deleted" : "active", checksum: digest(pixel) };
    let actorReads = 0; const statements = [];
    const handle = { identity: { runId: "controlled-media" }, query: async (sql, params = []) => query(sql, params), readDataApi: async () => {
      const response = new Response("[]", { status: 200 }); Object.defineProperty(response, "url", { value: (kind === "foreign-api" ? "https://external.invalid" : origin) + "/rest/v1/media_assets?select=id&limit=1" }); return response;
    }, withDatabaseConnection: async execute => execute({ query }) };
    async function query(sql, params = []) {
      statements.push(sql);
      assert.equal(params.length, Math.max(0, ...[...sql.matchAll(/\$(\d+)/gu)].map(match => Number(match[1]))), "Exact SQL parameter binding.");
      if (sql.includes("from public.admin_users")) { actorReads++; return { rows: kind === "missing-account" ? [] : kind === "duplicate-account" ? [{ id: 7 }, { id: 8 }] : [{ id: kind === "changed-actor" && actorReads > 1 ? 8 : 7 }] }; }
      if (sql.startsWith("select id,title,slug,status,image from public.topics")) return { rows: kind === "wrong-article" ? [] : [{ id: 91, title: "QA", slug: "qa-core-media-article", status: "unpublished", image: kind === "preexisting-image" ? "original" : "" }] };
      if (sql.startsWith("select id from public.media_assets")) return { rows: kind === "existing-namespace" ? [{ id: assetId }] : [] };
      if (sql.startsWith("select id from storage.objects")) return { rows: kind === "existing-storage-object" ? [{id:"original"}] : [] };
      if (sql.startsWith("select id from public.media_folders")) return { rows: kind === "existing-folder" ? [{id:"original"}] : [] };
      if (sql.startsWith("select id,title,slug,status,image,md5")) return { rows: [{ id: 91, title: "QA", slug: "qa-core-media-article", status: "unpublished", image: "", row_hash: "stable" }] };
      if (sql.includes("from storage.buckets where")) return { rows: [
        { id: "cms-documents", public: true, file_size_limit: 12582912, allowed_mime_types: ["application/pdf"] },
        { id: "cms-images", public: kind !== "bucket-private", file_size_limit: kind === "bucket-limit" ? 1 : 5242880,
          allowed_mime_types: kind === "bucket-mime" ? ["image/png"] : ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] }] };
      if (sql.includes("from public.media_assets where object_key like any")) return { rows: kind === "too-many-assets" ? Array.from({ length: 14 }, () => asset) : [asset] };
      if (sql.includes("from storage.objects where")) return { rows: kind.startsWith("missing") ? [] : kind === "too-many-objects" ? Array.from({ length: 14 }, () => ({})) : [{ id: "object", bucket_id: "cms-images", name: asset.object_key }] };
      if (sql.includes("from public.media_folders") || sql.includes("from public.media_references") || sql.includes("from public.media_reference_write_leases") || sql.includes("from public.media_delete_reservations")) return { rows: [] };
      if (sql.includes("from public.site_settings")) { if (kind === "query-failure") throw Error("controlled"); return { rows: [] }; }
      if (sql.includes("from public.admin_audit_logs")) return { rows: kind === "audit-wrong-actor" ? [{ actor_admin_user_id: 8 }] : [] };
      if (sql.startsWith("select 'objects'")) return { rows: [{ kind: "objects", count: "1", hash: "a".repeat(32) }, { kind: "buckets", count: "2", hash: "b".repeat(32) }] };
      assert.ok(/^(begin isolation level repeatable read read only|set local (statement_timeout|lock_timeout)=|commit$|rollback$)/u.test(sql), "No unreviewed SQL."); return { rows: [] };
    }
    const exports = {};
    vm.runInThisContext("(function(exports,require){" + compiled + "\n})")(exports, name => {
      if (name === "node:assert/strict") return assert;
      if (name === "node:crypto") return { createHash, randomUUID };
      if (name === "./lib/isolated-supabase.mts") return { assertOwnedLocalHandle: value => assert.equal(value, handle) };
      if (name === "./verify-admin-core-form-permission-isolated.mts") return { readCoreFormPermissionFingerprint: async () => ({ publicDataSha256: "b".repeat(64), publicTableInventorySha256: "c".repeat(64) }) };
      throw Error("Unexpected dependency");
    });
    const request = { id: randomUUID(), kind: "media-library-state", ...(kind === "bad-request-key" ? { namespace } : {}) };
    const execute = async () => {
      if (kind !== "unregistered") await exports.registerOwnedCoreMediaFixture(handle);
      return exports.readCoreMediaCheckpoint(handle, request);
    };
    await check("actual-native-owner-" + kind, async () => {
      if (["valid", "missing", "missing400"].includes(kind)) {
        const result = await execute(); assert.equal(result.status, "pass"); assert.equal(result.qaActorId, 7);
        assertCoreMediaAsset(result, assetId, { status: asset.status }); assert.ok(statements.includes("commit"));
      } else {
        await assert.rejects(execute);
        if (statements.includes("begin isolation level repeatable read read only") && !statements.includes("commit")) assert.equal(statements.at(-1), "rollback");
      }
    });
  }
  assert.equal(foreignHits, 0); assert.ok(publicGets > 0);
  await check("no-redirect-ever-reached-foreign-server", () => assert.equal(foreignHits, 0));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const driver = ts.createSourceFile("driver.mjs", readFileSync("scripts/qa-admin-adoption-journeys.mjs", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const media = ts.createSourceFile("media.mjs", readFileSync("scripts/fixtures/admin-core-media-journeys.mjs", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const initializer = (source, name) => { let result; const visit = node => { if(ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text===name) { assert.equal(result,undefined); result=node.initializer.getText(source); } ts.forEachChild(node,visit); }; visit(source); assert.ok(result); return result; };
    const guard = vm.runInNewContext("("+initializer(driver,"ownedNetworkOnly")+")", {origin,allowedStorage:[],URL,coreClosure:false,activeCase:"controlled-media",expectedLogoutDestination:null,expectedBlockedRequests:[],externalRequests:[]});
    await context.route("**/*", guard);
    const interceptorScope = {blocked:0};
    const actualInterceptor = vm.runInNewContext("("+initializer(media,"interceptor")+")",interceptorScope);
    const page = await context.newPage(); await page.goto(origin); await context.addCookies([{ name: "qa-control", value: "ephemeral", url: origin }]);
    let delivered = 0; page.on("response", response => { if (response.request().method() === "PATCH") delivered++; });
    const interceptor = actualInterceptor;
    await page.route(origin + "/api/admin/media-library", interceptor);
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#result").textContent === "failure");
    await check("real-Chromium-predelivery-abort-busy-and-draft", async () => {
      assert.equal(delivered, 0); assert.equal(interceptorScope.blocked,1); assert.equal(await page.locator("#save").isEnabled(), true); assert.equal(await page.locator("#draft").inputValue(), "retained");
    });
    await page.unroute(origin + "/api/admin/media-library", interceptor);
    const [response] = await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH"), page.locator("#save").click()]);
    await check("real-Chromium-guarded-retry-one-response", () => assert.equal(response.status(), 200));
    const imageLoaded = await page.evaluate(async data => {
      const image = new Image(); const wait = new Promise(resolve => { image.onload = () => resolve(image.naturalWidth); image.onerror = () => resolve(0); }); image.src = data; return wait;
    }, "data:image/png;base64," + pixel.toString("base64"));
    await check("synthetic-png-is-actually-decodable", () => assert.equal(imageLoaded, 1));
    await context.close();
  } finally { await browser.close(); }
} finally {
  server.closeAllConnections(); foreign.closeAllConnections();
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => foreign.close(resolve))]);
}
await check("synthetic-PDF-xref-is-byte-correct", () => {
  const value = coreMediaSyntheticPdf().toString(); const offset = Number(value.match(/startxref\n(\d+)/u)[1]); assert.equal(value.slice(offset, offset + 4), "xref");
});
const sources = ["scripts/fixtures/admin-core-media-journeys.mjs", nativePath, "scripts/verify-admin-core-media-journeys.mjs"];
const receipt = { status: "pass", count: checks.length, checks, sourceSha256: Object.fromEntries(sources.map(path => [path, digest(readFileSync(path))])), automaticCoverage: [], globalClosed: false,
  boundary: "Actual exported verification assertions, transpiled native owner with controlled SQL ports, actual bounded loopback binary HTTP and Chromium transport controls. Product Browser/native journeys remain pending." };
mkdirSync(".tmp-qa/core-final-closure", { recursive: true });
writeFileSync(".tmp-qa/core-final-closure/media-helper-controls.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ status: "pass", count: checks.length, sourceSha256: receipt.sourceSha256 }));
