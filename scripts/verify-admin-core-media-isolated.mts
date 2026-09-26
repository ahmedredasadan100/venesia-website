import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

import { readCoreFormPermissionFingerprint } from "./verify-admin-core-form-permission-isolated.mts";

const SLUG = "qa-core-media-article";
const MAX_ASSETS = 13;
const MAX_BYTES = 100 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
type Row = Record<string, unknown>;
type Registration = { namespace: string; origin: string; qaActorId: number; articleId: number; startedAt: string; ids: Set<string>; history: Map<string, { bucket: string; objectKey: string; publicUrl: string }> };
const registrations = new WeakMap<OwnedLocalHandle, Registration>();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const positive = (value: unknown) => { const n = Number(value); assert.ok(Number.isSafeInteger(n) && n > 0); return n; };
const rowsOf = (result: { rows: Row[] }) => result.rows;

/** No caller-selected fixture/actor/storage endpoint; the registration is server-owned. */
export async function registerOwnedCoreMediaFixture(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  assert.equal(registrations.has(handle), false, "Register the Media fixture only once per owned lifecycle.");
  const namespace = "qa-core-media-" + hash(handle.identity.runId).slice(0, 16);
  const actors = rowsOf(await handle.query("select id from public.admin_users where username='qa_admin_interaction' and email='qa-admin-interaction@example.invalid' and role='admin' and is_active=true limit 2"));
  assert.equal(actors.length, 1);
  const articles = rowsOf(await handle.query("select id,title,slug,status,image from public.topics where slug=$1 and content_type='article' and deleted_at is null", [SLUG]));
  assert.equal(articles.length, 1); const article = articles[0];
  assert.equal(article.status, "unpublished"); assert.ok(!article.image);
  const response = await handle.readDataApi("/rest/v1/media_assets?select=id&limit=1");
  try {
    assert.equal(response.ok, true);
    const url = new URL(response.url);
    assert.equal(url.protocol, "http:"); assert.equal(url.hostname, "127.0.0.1"); assert.ok(url.port);
    assert.equal(url.pathname, "/rest/v1/media_assets"); assert.equal(url.username + url.password, "");
    const namespaceRows = rowsOf(await handle.query("select id from public.media_assets where object_key like $1 or object_key like $2 limit 1",
      ["images/" + namespace + "/%", "files/" + namespace + "/%"]));
    assert.equal(namespaceRows.length, 0, "The run namespace must start empty.");
    const roots = ["images/" + namespace, "files/" + namespace], patterns = roots.map(root => root + "/%");
    const priorObjects = rowsOf(await handle.query("select id from storage.objects where bucket_id in ('cms-images','cms-documents') and name like any($1::text[]) limit 1", [patterns]));
    const priorFolders = rowsOf(await handle.query("select id from public.media_folders where normalized_path=any($1::text[]) or normalized_path like any($2::text[]) limit 1", [roots, patterns]));
    assert.equal(priorObjects.length, 0, "Never adopt an existing object, including an uncataloged orphan.");
    assert.equal(priorFolders.length, 0, "The reserved folders must start absent.");
    const registration: Registration = { namespace, origin: url.origin, qaActorId: positive(actors[0].id),
      articleId: positive(article.id), startedAt: new Date().toISOString(), ids: new Set(), history: new Map() };
    registrations.set(handle, registration);
    return { namespace, namespaceUnique: true, maximumAssets: MAX_ASSETS,
      article: { id: registration.articleId, slug: SLUG, title: String(article.title), editPath: "/admin/content/topics/" + registration.articleId } };
  } finally { await response.body?.cancel(); }
}

export function validateCoreMediaCheckpointRequest(input: unknown) {
  assert.ok(input && typeof input === "object" && !Array.isArray(input));
  const request = input as { id: string; kind: string };
  assert.deepEqual(Object.keys(request).sort(), ["id", "kind"]);
  assert.match(request.id, UUID); assert.equal(request.kind, "media-library-state");
  return request;
}

/** Exact local namespace, bucket/root pairing and canonical URL, including encoded traversal rejection. */
export function validateCoreMediaBinaryIdentity(origin: string, namespace: string, input: { bucket: string; objectKey: string; publicUrl: string }) {
  const base = new URL(origin);
  assert.equal(base.origin, origin); assert.equal(base.protocol, "http:");
  assert.equal(base.hostname, "127.0.0.1"); assert.ok(base.port); assert.equal(base.username + base.password, "");
  assert.match(namespace, /^qa-core-media-[a-f0-9]{16}$/u);
  const root = input.bucket === "cms-images" ? "images" : input.bucket === "cms-documents" ? "files" : null;
  assert.ok(root);
  assert.ok(input.objectKey.startsWith(root + "/" + namespace + "/"));
  const parts = input.objectKey.split("/");
  assert.ok(parts.length >= 3 && parts.length <= 5);
  assert.ok(parts.every(part => /^[a-zA-Z0-9._-]+$/u.test(part) && part !== "." && part !== ".."));
  const url = new URL(input.publicUrl);
  assert.equal(url.origin, origin); assert.equal(url.username + url.password + url.hash + url.search, "");
  const prefix = "/storage/v1/object/public/" + input.bucket + "/";
  assert.equal(url.pathname, prefix + parts.map(encodeURIComponent).join("/"));
  return url.href;
}

/** Reads only already-registered namespace identities; never follows redirects or exports bytes. */
async function binary(registration: Registration, identity: { bucket: string; objectKey: string; publicUrl: string }) {
  const url = validateCoreMediaBinaryIdentity(registration.origin, registration.namespace, identity);
  const response = await fetch(url, { redirect: "error", headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(15_000) });
  assert.ok([200, 400, 404].includes(response.status), "Unexpected Storage public-read status.");
  const length = response.headers.get("content-length");
  if (length !== null) assert.ok(/^\d+$/u.test(length) && Number(length) <= MAX_BYTES);
  const reader = response.body?.getReader(); assert.ok(reader);
  const digest = createHash("sha256"); let bytes = 0; const errorParts: Buffer[] = [];
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength; assert.ok(bytes <= MAX_BYTES, "Synthetic binary exceeded its bound.");
      digest.update(next.value);
      if (response.status !== 200) errorParts.push(Buffer.from(next.value));
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  let missing = response.status === 404;
  if (response.status === 400) {
    let value: Record<string, unknown> = {};
    try { value = JSON.parse(Buffer.concat(errorParts).toString("utf8")); } catch {}
    missing = String(value.statusCode) === "404" || value.code === "NoSuchKey" || value.error === "not_found";
    assert.equal(missing, true, "HTTP400 alone does not prove a missing object.");
  }
  for (const part of errorParts) part.fill(0);
  return { publicUrl: url, status: response.status, missing, bytes, sha256: digest.digest("hex"), contentType: response.headers.get("content-type") };
}

export async function readCoreMediaCheckpoint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle);
  const request = validateCoreMediaCheckpointRequest(input);
  const registered = registrations.get(handle); assert.ok(registered, "Native fixture registration is mandatory.");
  const state = await handle.withDatabaseConnection(async connection => {
    await connection.query("begin isolation level repeatable read read only");
    let committed = false;
    try {
      await connection.query("set local statement_timeout='15000ms'");
      await connection.query("set local lock_timeout='3000ms'");
      const actors = rowsOf(await connection.query("select id from public.admin_users where username='qa_admin_interaction' and email='qa-admin-interaction@example.invalid' and role='admin' and is_active=true limit 2"));
      assert.equal(actors.length, 1); assert.equal(positive(actors[0].id), registered.qaActorId);
      const articleRows = rowsOf(await connection.query("select id,title,slug,status,image,md5(to_jsonb(t)::text) row_hash from public.topics t where id=$1 and slug=$2 and content_type='article' and deleted_at is null", [registered.articleId, SLUG]));
      assert.equal(articleRows.length, 1);
      const roots = ["images/" + registered.namespace, "files/" + registered.namespace];
      const patterns = roots.map(root => root + "/%");
      const buckets = rowsOf(await connection.query("select id,public,file_size_limit,allowed_mime_types from storage.buckets where id in ('cms-images','cms-documents') order by id"));
      assert.deepEqual(buckets.map(row => row.id), ["cms-documents", "cms-images"]);
      assert.ok(buckets.every(row => row.public === true));
      assert.equal(Number(buckets[0].file_size_limit), 12 * 1024 * 1024);
      assert.deepEqual(buckets[0].allowed_mime_types, ["application/pdf"]);
      assert.equal(Number(buckets[1].file_size_limit), 5 * 1024 * 1024);
      assert.deepEqual([...(buckets[1].allowed_mime_types as string[])].sort(), ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
      const assets = rowsOf(await connection.query("select id,provider,bucket,object_key,public_url,original_filename,display_name,media_kind,mime_type,byte_size,width,height,checksum,folder_path,status,uploaded_by,default_alt_text,default_title,default_caption,reconciliation_state,missing_object from public.media_assets where object_key like any($1::text[]) or id=any($2::uuid[]) order by id limit 14", [patterns, [...registered.ids]]));
      assert.ok(assets.length <= MAX_ASSETS, "Thirteen total assets, including tombstones, is a hard bound.");
      for (const asset of assets) {
        assert.equal(asset.provider, "supabase"); assert.equal(positive(asset.uploaded_by), registered.qaActorId);
        assert.ok(Number(asset.byte_size) > 0 && Number(asset.byte_size) <= MAX_BYTES);
        assert.match(String(asset.id), UUID);
        validateCoreMediaBinaryIdentity(registered.origin, registered.namespace, { bucket: String(asset.bucket), objectKey: String(asset.object_key), publicUrl: String(asset.public_url) });
      }
      for (const id of registered.ids) assert.ok(assets.some(row => row.id === id), "A previously observed owned catalog identity cannot disappear.");
      const ids = assets.map(row => row.id);
      const objects = rowsOf(await connection.query("select id,bucket_id,name,metadata->>'size' byte_size,metadata->>'mimetype' mime_type from storage.objects where bucket_id in ('cms-images','cms-documents') and name like any($1::text[]) order by bucket_id,name limit 14", [patterns]));
      assert.ok(objects.length <= MAX_ASSETS);
      const folders = rowsOf(await connection.query("select id,normalized_path,parent_path,display_name,created_by from public.media_folders where normalized_path=any($1::text[]) or normalized_path like any($2::text[]) order by normalized_path limit 9", [roots, patterns]));
      assert.ok(folders.length <= 8);
      const references = rowsOf(await connection.query("select id,asset_id,domain_key,entity_type,entity_identity,field_key,reference_state from public.media_references where asset_id=any($1::uuid[]) order by id limit 33", [ids]));
      assert.ok(references.length <= 32);
      const leases = rowsOf(await connection.query("select id,asset_id,status,actor_id,resolved_at::text,failure_code from public.media_reference_write_leases where asset_id=any($1::uuid[]) order by id limit 97", [ids]));
      const reservations = rowsOf(await connection.query("select id,asset_id,status,actor_id,failure_code from public.media_delete_reservations where asset_id=any($1::uuid[]) order by id limit 33", [ids]));
      assert.ok(leases.length <= 96 && reservations.length <= 32);
      const runtime = rowsOf(await connection.query("select value from public.site_settings where key='media.catalog_state'"));
      assert.ok(runtime.length <= 1);
      const audits = rowsOf(await connection.query(`select id,action,entity_type,entity_id,actor_admin_user_id,entity_label,
        jsonb_build_object('assetId',metadata->'assetId','previousAssetId',metadata->'previousAssetId','nextAssetId',metadata->'nextAssetId',
          'bucket',metadata->'bucket','objectKey',metadata->'objectKey','folder',metadata->'folder','operation',metadata->'operation') metadata
        from public.admin_audit_logs where created_at >= $1::timestamptz and (
          (entity_type='topic' and entity_id=$2)
          or (entity_type='media_asset' and (metadata->>'assetId'=any($3::text[]) or metadata->>'previousAssetId'=any($3::text[])
            or metadata->>'nextAssetId'=any($3::text[]) or metadata->>'objectKey' like any($4::text[])))
          or (entity_type='media_folder' and (metadata->>'folder'=any($5::text[]) or metadata->>'folder' like any($4::text[])))
          or entity_type='media_catalog') order by id limit 161`,
        [registered.startedAt, String(registered.articleId), ids, patterns, roots]));
      assert.ok(audits.length <= 160);
      for (const audit of audits) assert.equal(positive(audit.actor_admin_user_id), registered.qaActorId, "The exact QA actor must own each observed audit.");
      const fingerprints = rowsOf(await connection.query("select 'objects' kind,count(*)::text count,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) hash from storage.objects t union all select 'buckets' kind,count(*)::text count,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) hash from storage.buckets t"));
      assert.equal(fingerprints.length, 2);
      await connection.query("commit"); committed = true;
      return { article: articleRows[0], buckets, assets, objects, folders, references, leases, reservations, runtime: runtime[0]?.value ?? null, audits,
        storageSha256: hash(JSON.stringify(fingerprints)) };
    } finally { if (!committed) await connection.query("rollback"); }
  });
  for (const asset of state.assets) {
    registered.ids.add(String(asset.id));
    const identity = { bucket: String(asset.bucket), objectKey: String(asset.object_key), publicUrl: String(asset.public_url) };
    registered.history.set(identity.publicUrl, identity);
  }
  // Track old URLs after move/rename, so native proof includes absence at the previous physical identity.
  assert.ok(registered.history.size <= MAX_ASSETS + 2);
  const binaries = [];
  for (const identity of registered.history.values()) {
    assertOwnedLocalHandle(handle);
    binaries.push(await binary(registered, identity));
  }
  const fingerprint = await readCoreFormPermissionFingerprint(handle, { id: randomUUID(), kind: "form-permission-fingerprint", correlationId: request.id, phase: "after" });
  assertOwnedLocalHandle(handle);
  return { id: request.id, kind: request.kind, status: "pass", ownedRunId: handle.identity.runId,
    qaActorId: registered.qaActorId, namespace: registered.namespace, articleId: registered.articleId, ...state, binaries, publicDataSha256: fingerprint.publicDataSha256, publicTableInventorySha256: fingerprint.publicTableInventorySha256,
    automaticCoverage: [], scope: "Fixed server-registered synthetic Media fixture and exact QA actor; read-only metadata and bounded local public-byte hashes. No secrets, raw bytes, provider mutation or global closure." };
}
