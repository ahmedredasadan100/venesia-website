import {loadCoreResidualSearchContract,coreResidualSearchQueries,projectCoreResidualSearchRows,assertCoreResidualSearchFragments,bindCoreResidualSearchCells,coreResidualMediaRows} from './admin-core-residual-search.mjs';
import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect, request as http } from "playwright/test";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const searchLabel = "ابحث بالاسم أو المسار أو الوصف البديل…";
const groupNames = ["readiness", "folders", "upload-validation-retry", "catalog-query", "metadata-failure-retry", "preview", "picker-use", "in-use-delete", "physical-move", "replace-references", "detach-delete", "permission"];
export const CORE_MEDIA_HELD_SELECTION = "media-library-held-followup";
export const CORE_MEDIA_FINAL_THREE_SELECTION = "media-library-final-three-followup";
export function isCoreMediaSelection(selection) {
  return selection === CORE_MEDIA_HELD_SELECTION || selection === CORE_MEDIA_FINAL_THREE_SELECTION;
}
/** @param {string|null} selection */
export function coreSelectedMediaGroups(selection = null) {
  assert.ok(selection === null || isCoreMediaSelection(selection), "Unknown Media selection.");
  return selection === null ? [...groupNames] : selection === CORE_MEDIA_FINAL_THREE_SELECTION ? ["preview", "detach-delete", "permission"] : groupNames.slice(2);
}
export function coreSelectedMediaIds(selection) {
  assert.ok(isCoreMediaSelection(selection));
  return coreSelectedMediaGroups(selection).map(name => "core-media-" + name);
}
export function assertCoreMediaSelectionReceipt(browser, requiredCases) {
  const ids = coreSelectedMediaIds(browser.journeySelection);
  assert.equal(browser.scope, "core-closure"); assert.equal(browser.cohort, "media-library");
  assert.equal(browser.status, "pass"); assert.equal(browser.driverCompleted, true);
  assert.equal(browser.inventoryOnly, false); assert.equal(browser.wholeCohortExecuted, false);
  assert.equal(browser.globalClosed, false); assert.deepEqual(browser.errors, []);
  const expectedCases = requiredCases.map(row => {
    if (Object.hasOwn(row, "status") || Object.hasOwn(row, "evidence")) {
      assert.equal(row.status, "open"); assert.equal(row.evidence, null);
    }
    return { ...row, status: "open", evidence: null };
  });
  assert.equal(new Set(expectedCases.map(row => row.key)).size, expectedCases.length);
  assert.deepEqual(browser.requiredCases, expectedCases);
  assert.deepEqual(browser.selectedJourneyIds, ids); assert.deepEqual(browser.executedJourneyIds, ids);
  const login = browser.evidence.filter(row => row.id === "existing-auth-login");
  assert.equal(login.length, 1); assert.equal(login[0].status, "pass"); assert.equal(login[0].authenticated, true);
  const rows = browser.evidence.filter(row => row.id !== "existing-auth-login");
  assert.deepEqual(rows.map(row => row.id), ids);
  assert.ok(rows.every(row => row.status === "pass" && row.coverage.length === 0));
  return { status: "pass", selection: browser.journeySelection, selectedJourneyIds: ids, executedJourneyIds: ids,
    retainedTwoReplayed: false, ...(browser.journeySelection === CORE_MEDIA_FINAL_THREE_SELECTION ? { retainedSevenReplayed: false } : {}), automaticCoverage: [], wholeCohortExecuted: false, globalClosed: false };
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==", "base64");
export function coreMediaSyntheticPng() { return Buffer.from(png); }
export function coreMediaSyntheticPdf() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let data = "%PDF-1.4\n"; const offsets = [];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(data)); data += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; }
  const offset = Buffer.byteLength(data);
  data += "xref\n0 5\n0000000000 65535 f \n" + offsets.map(n => String(n).padStart(10, "0") + " 00000 n \n").join("");
  return Buffer.from(data + "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n" + offset + "\n%%EOF\n");
}
export function buildCoreMediaPlan({ fixtures, forms, collections, requiredCases, selection = null }) {
  const fixture = fixtures.mediaClosure;
  assert.ok(fixture?.namespaceUnique === true && fixture.maximumAssets === 13);
  assert.match(fixture.namespace, /^qa-core-media-[a-f0-9]{16}$/u);
  assert.ok(Number.isSafeInteger(fixture.article?.id) && fixture.article.id > 0);
  assert.equal(fixture.article.slug, "qa-core-media-article");
  assert.equal(fixture.article.editPath, "/admin/content/topics/" + fixture.article.id);
  const form = forms.filter(row => row.id === "activity-sitemap-media-commands"); assert.equal(form.length, 1);
  for (const surface of ["media-command", "media-usage"]) assert.ok(form[0].surfaces.includes(surface));
  assert.equal(collections.filter(row => row.id === "media-library").length, 1);
  const relatedRequiredCases = requiredCases.filter(row => row.consumer === "media-library" || row.consumer === form[0].id).map(row => row.key);
  assert.ok(relatedRequiredCases.length > 0);
  return { ...fixture, groups: coreSelectedMediaGroups(selection), relatedRequiredCases, automaticCoverage: [] };
}
export function assertCoreMediaReceipt(value, request, fixture) {
  assert.equal(value?.id, request.id); assert.equal(value.kind, "media-library-state"); assert.equal(value.status, "pass");
  assert.equal(value.namespace, fixture.namespace); assert.equal(value.articleId, fixture.article.id);
  assert.ok(Number.isSafeInteger(value.qaActorId) && value.qaActorId > 0 && typeof value.ownedRunId === "string" && value.ownedRunId);
  for (const key of ["assets", "objects", "folders", "references", "leases", "reservations", "audits", "binaries"]) assert.ok(Array.isArray(value[key]));
  assert.ok(value.assets.length <= 13);
  for (const row of value.audits) assert.equal(Number(row.actor_admin_user_id), value.qaActorId);
  assert.match(value.storageSha256, /^[a-f0-9]{64}$/u);
}
export function assertCoreMediaHeldPrerequisite(result, records) {
  const p = result.prerequisite;
  assert.ok(p); assert.equal(p.selection, CORE_MEDIA_HELD_SELECTION);
  assert.equal(p.purpose, "uncredited-owned-fixture-prerequisite");
  assert.equal(p.uiCredit, false); assert.equal(p.globalClosed, false); assert.deepEqual(p.automaticCoverage, []);
  assert.deepEqual(p.operations, ["reconcile", "create_folder"]);
  const labels = ["prerequisite-reconcile-before", "prerequisite-reconciled", "prerequisite-folder-before-images",
    "prerequisite-folder-after-images", "prerequisite-folder-before-files", "prerequisite-folder-after-files"];
  assert.deepEqual(p.checkpoints, result.checkpoints.slice(0, 6));
  assert.deepEqual(p.checkpoints.map(row => row.label), labels);
  const states = p.checkpoints.map((point, index) => {
    assert.deepEqual(Object.keys(point).sort(), ["label", "receiptId"]);
    const matches = records.filter(row => row.id === point.receiptId); assert.equal(matches.length, 1);
    const row = matches[0]; assert.equal(row, records[index], "Prerequisite must be the native prefix.");
    assertCoreMediaReceipt(row, { id: point.receiptId }, { namespace: p.namespace, article: { id: p.articleId } });
    for (const key of ["ownedRunId", "namespace", "articleId", "qaActorId"]) assert.equal(row[key], p[key]);
    for (const key of ["assets", "objects", "references", "leases", "reservations", "binaries"]) assert.deepEqual(row[key], []);
    return row;
  });
  assert.equal(new Set(p.checkpoints.map(row => row.receiptId)).size, 6);
  assert.deepEqual(states[0].folders, []); assert.deepEqual(states[1].folders, []);
  assert.equal(states[1].runtime?.state, "synced");
  const roots = ["images/" + p.namespace, "files/" + p.namespace];
  for (const [index, path] of roots.entries()) {
    const before = states[2 + index * 2], after = states[3 + index * 2];
    assert.equal(before.folders.some(row => row.normalized_path === path), false);
    assert.deepEqual(after.folders.map(row => row.normalized_path).sort(), roots.slice(0, index + 1).sort());
    const folder = after.folders.find(row => row.normalized_path === path);
    assert.equal(Number(folder.created_by), p.qaActorId);
    assert.equal(folder.display_name, p.namespace); assert.equal(folder.parent_path, path.split("/")[0]);
    assertCoreMediaAudit(before, after, "media_folder.create", row => row.metadata.folder === path);
  }
  assert.equal(p.requests.length, 3);
  const expected = [{ operation: "reconcile", dryRun: false }, ...roots.map(folder => ({ operation: "create_folder", folder, displayName: p.namespace }))];
  const first = new URL(p.requests[0].url); assert.equal(first.protocol, "http:"); assert.equal(first.hostname, "127.0.0.1"); assert.ok(first.port);
  for (const [index, proof] of p.requests.entries()) {
    assert.equal(proof.url, first.origin + "/api/admin/media-library"); assert.equal(proof.method, "POST");
    assert.equal(proof.acknowledged, true); assert.equal(proof.status, index === 0 ? 200 : 201);
    assert.equal(proof.provenance, "captured-current-request"); assert.equal(hash(proof.body), proof.bodySha256);
    assert.deepEqual(JSON.parse(proof.body), expected[index]);
  }
  return { nativeCheckpointIds: states.map(row => row.id), operations: [...p.operations], uiCredit: false, automaticCoverage: [], globalClosed: false };
}

const permissionOperations = ["upload", "create_folder", "reconcile", "update_metadata", "move_asset", "replace_all", "DELETE", "/api/admin/media-library", "/api/admin/media-usage"];
const finalThreeSetupOperations = permissionOperations.filter(operation => operation !== "DELETE");
function serializeCoreMediaSpecimen(specimen) {
  return { ...specimen, body: specimen.body.toString("base64"), bodyEncoding: "base64" };
}
function readCoreMediaSpecimen(proof, origin) {
  assert.equal(proof.bodyEncoding, "base64"); assert.equal(typeof proof.body, "string");
  const body = Buffer.from(proof.body, "base64"); assert.equal(body.toString("base64"), proof.body);
  const specimen = { ...proof, body }; validateCoreMediaReplaySpecimen(origin, specimen);
  assert.equal(proof.provenance, "captured-current-request");
  assert.ok(proof.status >= 200 && proof.status < 300);
  const url = new URL(proof.url);
  const operation = proof.method === "GET" ? url.pathname : proof.method === "POST" && !proof.headers["content-type"].includes("application/json") ? "upload" : (() => {
    const value = JSON.parse(body.toString("utf8"));
    return value.operation === "reconcile" && value.dryRun === true ? "reconcile_preview" : value.operation ?? proof.method;
  })();
  assert.equal(proof.operation, operation); return specimen;
}
export function assertCoreMediaFinalThreePrerequisite(result, records) {
  const p = result.prerequisite; assert.ok(p); assert.equal(p.selection, CORE_MEDIA_FINAL_THREE_SELECTION);
  assert.equal(p.purpose, "uncredited-owned-fixture-prerequisite"); assert.equal(p.uiCredit, false);
  assert.deepEqual(p.automaticCoverage, []); assert.equal(p.globalClosed, false);
  assert.deepEqual(p.operations, finalThreeSetupOperations);
  assertCoreMediaHeldPrerequisite({ prerequisite: p.seed, checkpoints: result.checkpoints }, records);
  const labels = [...p.seed.checkpoints.map(row => row.label), "prerequisite-uploaded", "prerequisite-metadata",
    "prerequisite-picker", "prerequisite-usage", "prerequisite-moved", "prerequisite-replacement-staged", "prerequisite-replaced"];
  assert.deepEqual(p.checkpoints, result.checkpoints.slice(0, labels.length));
  assert.deepEqual(p.checkpoints.map(row => row.label), labels);
  const states = p.checkpoints.map((point, index) => {
    assert.deepEqual(Object.keys(point).sort(), ["label", "receiptId"]);
    const row = records[index]; assert.ok(row); assert.equal(row.id, point.receiptId);
    assertCoreMediaReceipt(row, { id: point.receiptId }, { namespace: p.namespace, article: { id: p.articleId } });
    for (const key of ["ownedRunId", "namespace", "articleId", "qaActorId"]) { assert.equal(row[key], p[key]); assert.equal(p.seed[key], p[key]); }
    assert.ok(row.assets.length <= 3); return row;
  });
  assert.equal(new Set(p.checkpoints.map(row => row.receiptId)).size, labels.length);
  const [uploaded, metadata, picker, usage, moved, staged, replaced] = states.slice(6);
  assert.deepEqual(states.slice(6).map(row => row.assets.length), [2, 2, 2, 2, 2, 3, 3]);
  assert.notEqual(p.primaryId, p.documentId); assert.notEqual(p.primaryId, p.replacementId); assert.notEqual(p.documentId, p.replacementId);
  const image = assertCoreMediaAsset(uploaded, p.primaryId, { status: "active", media_kind: "image", checksum: hash(png) });
  assertCoreMediaAsset(uploaded, p.documentId, { status: "active", media_kind: "document", checksum: hash(coreMediaSyntheticPdf()) });
  for (const asset of uploaded.assets) assertCoreMediaAudit(states[5], uploaded, "media_asset.create", row => row.metadata.objectKey === asset.object_key && row.metadata.bucket === asset.bucket);
  const named = assertCoreMediaAsset(metadata, p.primaryId, { status: "active", object_key: image.object_key,
    display_name: p.namespace + "-authored", default_alt_text: "QA synthetic pixel", default_title: "QA media title", default_caption: "QA media caption" });
  assertCoreMediaAudit(uploaded, metadata, "media_asset.update", row => row.metadata.assetId === p.primaryId && row.metadata.operation === "metadata");
  assert.equal(picker.article.image, named.public_url);
  assert.ok(picker.references.some(row => row.asset_id === p.primaryId && String(row.entity_identity) === String(p.articleId) && row.field_key === "image"));
  assertCoreMediaAudit(metadata, picker, "topic.update", row => String(row.entity_id) === String(p.articleId));
  assertCoreMediaUnchanged(picker, usage, true);
  const changed = assertCoreMediaAsset(moved, p.primaryId, { status: "active", checksum: image.checksum,
    object_key: "images/" + p.namespace + "/moved/" + p.namespace + "-renamed.png" });
  assert.equal(moved.article.image, changed.public_url);
  const references = rows => rows.map(({ asset_id, domain_key, entity_type, entity_identity, field_key, reference_state }) => ({ asset_id, domain_key, entity_type, entity_identity, field_key, reference_state })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.deepEqual(references(moved.references), references(usage.references));
  assert.equal(moved.binaries.find(row => row.publicUrl === named.public_url)?.missing, true);
  assertCoreMediaAudit(usage, moved, "media_asset.update", row => row.metadata.assetId === p.primaryId && row.metadata.operation === "move_physical_object");
  const replacement = assertCoreMediaAsset(staged, p.replacementId, { status: "active", checksum: hash(png) });
  assertCoreMediaAudit(moved, staged, "media_asset.create", row => row.metadata.objectKey === replacement.object_key && row.metadata.bucket === replacement.bucket);
  assert.equal(staged.article.image, changed.public_url);
  assert.equal(replaced.article.image, replacement.public_url); assert.equal(replaced.references.some(row => row.asset_id === p.primaryId), false);
  assert.ok(replaced.references.some(row => row.asset_id === p.replacementId && String(row.entity_identity) === String(p.articleId) && row.field_key === "image"));
  for (const asset of replaced.assets) assertCoreMediaAsset(replaced, asset.id, { status: "active" });
  assertCoreMediaAudit(staged, replaced, "media_asset.update", row => row.metadata.previousAssetId === p.primaryId && row.metadata.nextAssetId === p.replacementId && row.metadata.operation === "replace_all_supported_references");
  assert.deepEqual(p.specimens.map(row => row.operation).sort(), [...finalThreeSetupOperations].sort());
  assert.equal(p.origin, new URL(p.seed.requests[0].url).origin);
  const captured = p.specimens.map(row => readCoreMediaSpecimen(row, p.origin));
  for (const operation of ["reconcile", "create_folder"]) assert.equal(captured.find(row => row.operation === operation).bodySha256, p.seed.requests.find(row => JSON.parse(row.body).operation === operation).bodySha256);
  const upload = captured.find(row => row.operation === "upload"); assert.equal(upload.status, 201); assert.ok(upload.body.includes(png)); assert.ok(upload.body.includes(Buffer.from(p.namespace)));
  const json = operation => JSON.parse(captured.find(row => row.operation === operation).body.toString("utf8"));
  assert.deepEqual(json("update_metadata"), { operation: "update_metadata", assetId: p.primaryId, displayName: p.namespace + "-authored", defaultAltText: "QA synthetic pixel", defaultTitle: "QA media title", defaultCaption: "QA media caption" });
  assert.deepEqual(json("move_asset"), { operation: "move_asset", assetId: p.primaryId, targetFolder: "images/" + p.namespace + "/moved", targetFilename: p.namespace + "-renamed.png" });
  assert.deepEqual(json("replace_all"), { operation: "replace_all", previousAssetId: p.primaryId, nextAssetId: p.replacementId });
  for (const operation of ["update_metadata", "move_asset", "replace_all"]) { const row = captured.find(row => row.operation === operation); assert.equal(row.method, "PATCH"); assert.equal(row.status, 200); }
  const catalog = captured.find(row => row.operation === "/api/admin/media-library"), usageRequest = captured.find(row => row.operation === "/api/admin/media-usage");
  assert.equal(new URL(catalog.url).searchParams.get("q"), p.namespace); assert.equal(catalog.body.length, 0);
  assert.equal(new URL(usageRequest.url).searchParams.get("asset"), named.public_url); assert.equal(usageRequest.body.length, 0);
  return { nativeCheckpointIds: states.map(row => row.id), operations: [...p.operations], assets: 3, uiCredit: false, automaticCoverage: [], globalClosed: false };
}
export function assertCoreMediaFinalThreePermission(result, records) {
  assertCoreMediaFinalThreePrerequisite(result, records);
  const p = result.prerequisite, proof = result.completed.find(row => row.group === "permission")?.requestProof;
  assert.ok(proof); assert.equal(proof.origin, p.origin);
  const specimens = proof.specimens.map(row => readCoreMediaSpecimen(row, p.origin));
  assert.equal(new Set(specimens.map(row => row.operation)).size, specimens.length);
  assertCoreMediaPermissionPrerequisites(specimens, new Set(proof.verifiedOperations));
  assert.ok(specimens.every(row => permissionOperations.includes(row.operation) || row.operation === "reconcile_preview"));
  assert.deepEqual([...proof.verifiedOperations].sort(), [...permissionOperations].sort());
  for (const row of p.specimens) assert.deepEqual(proof.specimens.find(specimen => specimen.operation === row.operation), row);
  assert.deepEqual(proof.denials.map(row => row.operation), specimens.map(row => row.operation));
  for (const [index, denial] of proof.denials.entries()) {
    assert.equal(denial.bodySha256, specimens[index].bodySha256); assertCoreMediaPermissionResponse(denial.status, denial.value);
  }
  const expectedSuffix = ["preview", "detached", "delete-cancel", "delete-complete", "delete-next-ready", "delete-cancel", "delete-complete", "delete-next-ready", "delete-cancel", "delete-complete", "permission-before", "permission-after"];
  assert.deepEqual(result.checkpoints.slice(p.checkpoints.length).map(row => row.label), expectedSuffix);
  const tail = result.checkpoints.slice(p.checkpoints.length).map(point => records.find(row => row.id === point.receiptId));
  assert.ok(tail.every(Boolean));
  const prepared = records[p.checkpoints.length - 1]; assertCoreMediaUnchanged(prepared, tail[0], true);
  let current = tail[1]; assert.ok(!current.article.image); assert.equal(current.references.length, 0); assert.equal(current.assets.length, 3);
  assertCoreMediaAudit(prepared, current, "topic.update", row => String(row.entity_id) === String(p.articleId));
  const deleteOrder = current.assets.filter(row => row.status === "active"); assert.equal(deleteOrder.length, 3);
  const deletion = specimens.find(row => row.operation === "DELETE"); assert.equal(deletion.method, "DELETE"); assert.equal(deletion.status, 200);
  assert.deepEqual(JSON.parse(deletion.body.toString("utf8")), { asset: deleteOrder[0].public_url });
  for (const [index, asset] of deleteOrder.entries()) {
    const cancelled = tail[2 + index * 3], deleted = tail[3 + index * 3];
    assertCoreMediaUnchanged(current, cancelled, true); assertCoreMediaAsset(deleted, asset.id, { status: "deleted" });
    assertCoreMediaAudit(current, deleted, "media_asset.delete", row => row.metadata.assetId === asset.id);
    assert.ok(deleted.reservations.some(row => row.asset_id === asset.id && row.status === "completed"));
    assert.equal(deleted.leases.some(row => row.asset_id === asset.id && (row.status === "active" || (["failed", "expired"].includes(row.status) && !row.resolved_at))), false);
    for (const other of current.assets.filter(row => row.id !== asset.id)) assert.deepEqual(deleted.assets.find(row => row.id === other.id), other);
    current = index < 2 ? tail[4 + index * 3] : deleted;
  }
  const beforePoint = result.checkpoints.filter(row => row.label === "permission-before"), afterPoint = result.checkpoints.filter(row => row.label === "permission-after");
  assert.equal(beforePoint.length, 1); assert.equal(afterPoint.length, 1);
  const before = records.find(row => row.id === beforePoint[0].receiptId), after = records.find(row => row.id === afterPoint[0].receiptId);
  assert.ok(before && after); assertCoreMediaUnchanged(current, before, true); assertCoreMediaUnchanged(before, after, true);
  assert.equal(before.assets.length, 3); assert.equal(before.references.length, 0); assert.ok(!before.article.image);
  for (const asset of before.assets) { assertCoreMediaAsset(before, asset.id, { status: "deleted" }); assert.ok(before.reservations.some(row => row.asset_id === asset.id && row.status === "completed")); }
  return { operations: [...permissionOperations], denialCount: proof.denials.length, nativeCheckpointIds: [before.id, after.id], automaticCoverage: [], globalClosed: false };
}
/** Intrinsic naturalWidth is density corrected; inspect the decoded pixels of this exact DOM image. */
export async function observeCoreMediaPreviewImage(element, ownedUrl) {
  const source = new URL(element.currentSrc || element.src, location.origin);
  const actual = source.pathname === "/_next/image" ? source.searchParams.get("url") : source.href;
  const box = element.getBoundingClientRect(), style = getComputedStyle(element);
  const facts = { actual, exactOwnedUrl: actual === ownedUrl, complete: element.complete, visible: box.width > 0 && box.height > 0 && style.visibility === "visible",
    naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight,
    decoded: false, decodedWidth: 0, decodedHeight: 0, sourceStable: false, decodeError: null };
  try {
    await element.decode(); const bitmap = await createImageBitmap(element);
    try { facts.decoded = true; facts.decodedWidth = bitmap.width; facts.decodedHeight = bitmap.height;
      facts.sourceStable = (element.currentSrc || element.src) === source.href;
    } finally { bitmap.close(); }
  } catch (error) { facts.decodeError = error instanceof Error ? error.message : String(error); }
  return facts;
}

export function assertCoreMediaUnchanged(before, after, allPublic = false) {
  for (const key of ["ownedRunId", "qaActorId", "namespace", "articleId", "article", "assets", "objects", "folders", "references", "leases", "reservations", "audits", "storageSha256"]) assert.deepEqual(after[key], before[key], "Unexpected Media change: " + key);
  if (allPublic) { assert.match(before.publicDataSha256, /^[a-f0-9]{64}$/u); assert.equal(after.publicDataSha256, before.publicDataSha256); assert.equal(after.publicTableInventorySha256, before.publicTableInventorySha256); }
}
export function assertCoreMediaAsset(state, id, expected) {
  const rows = state.assets.filter(row => row.id === id); assert.equal(rows.length, 1); const asset = rows[0];
  assert.equal(asset.provider, "supabase"); assert.equal(Number(asset.uploaded_by), state.qaActorId);
  for (const [key, value] of Object.entries(expected)) assert.equal(asset[key], value, key);
  const objects = state.objects.filter(row => row.bucket_id === asset.bucket && row.name === asset.object_key);
  const binary = state.binaries.find(row => row.publicUrl === asset.public_url); assert.ok(binary);
  if (asset.status === "deleted") { assert.equal(objects.length, 0); assert.equal(binary.missing, true); }
  else { assert.equal(objects.length, 1); assert.equal(binary.status, 200); assert.equal(binary.missing, false); assert.equal(binary.bytes, Number(asset.byte_size)); assert.equal(binary.sha256, asset.checksum); }
  return asset;
}
export function assertCoreMediaAudit(before, after, action, predicate) {
  assert.equal(after.qaActorId, before.qaActorId);
  const previous = new Set(before.audits.map(row => String(row.id)));
  assert.deepEqual(after.audits.filter(row => previous.has(String(row.id))), before.audits);
  const rows = after.audits.filter(row => !previous.has(String(row.id)) && row.action === action && predicate(row));
  assert.equal(rows.length, 1, "One semantic audit for this exact intent."); assert.equal(Number(rows[0].actor_admin_user_id), after.qaActorId);
  return rows[0].id;
}
export function validateCoreMediaReplaySpecimen(origin, specimen) {
  const base = new URL(origin), target = new URL(specimen.url);
  assert.equal(base.protocol, "http:"); assert.equal(base.hostname, "127.0.0.1"); assert.ok(base.port);
  assert.equal(target.origin, origin); assert.equal(target.username + target.password + target.hash, "");
  assert.ok(["/api/admin/media-library", "/api/admin/media-usage"].includes(target.pathname));
  assert.ok(["GET", "POST", "PATCH", "DELETE"].includes(specimen.method));
  assert.ok(Buffer.isBuffer(specimen.body) && specimen.body.length <= 2 * 1024 * 1024);
  assert.equal(hash(specimen.body), specimen.bodySha256); assert.equal(specimen.acknowledged, true);
  assert.deepEqual(Object.keys(specimen.headers).sort(), specimen.method === "GET" ? [] : ["content-type", "origin"]);
  if (specimen.method !== "GET") { assert.equal(specimen.headers.origin, origin); assert.ok(specimen.headers["content-type"]); }
  if (target.pathname.endsWith("media-usage")) assert.equal(specimen.method, "GET");
}
export function assertCoreMediaPermissionPrerequisites(specimens, verifiedOperations) {
  for (const operation of permissionOperations) {
    assert.ok(specimens.some(row => row.operation === operation), "Missing acknowledged specimen: " + operation);
    assert.ok(verifiedOperations.has(operation), "Missing joined UI/native operation proof: " + operation);
  }
}
export function assertCoreMediaPermissionResponse(status, value) {
  assert.equal(status, 401, "Validation/500/redirect is not API Auth rejection.");
  assert.equal(value?.error, "Unauthorized");
}
export function matchesCoreMediaResponse(response, origin, method, { operation, path = "/api/admin/media-library", queryMatch = {} } = {}) {
  const request = response.request(), url = new URL(response.url());
  if (url.origin !== origin || url.pathname !== path || request.method() !== method) return false;
  if (!Object.entries(queryMatch).every(([key, value]) => url.searchParams.get(key) === value)) return false;
  if (!operation) return true;
  try { return request.postDataJSON().operation === operation; } catch { return false; }
}
export async function runCoreMediaJourneys(ctx) {
  const { page, origin, fixtures, run, observe, mediaCheckpoint, requiredCases, actionResponse, assertActionAcknowledged } = ctx;
  assert.equal(new URL(origin).origin, origin); assert.equal(new URL(origin).hostname, "127.0.0.1"); assert.equal(typeof mediaCheckpoint, "function");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: forms } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../../src/lib/admin/interaction-system/adoption-manifest.ts");
  const selection = ctx.journeySelection ?? null;
  const plan = buildCoreMediaPlan({ fixtures, forms, collections: ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces, requiredCases, selection });
  const completed = [], checkpoints = [], nativeStates = [], specimens = [], uploaded = [], payloads = new Map(), verifiedOperations = new Set();
  let prerequisite;
  let primaryId, currentId;
  const main = () => page.locator("main"), search = owner => owner.getByPlaceholder(searchLabel, { exact: true });
  const feedback = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="media-library"]');
  const imageField = () => page.locator('[data-admin-media-image-field="image"]');
  const assetButton = (owner, name) => owner.locator('button[aria-pressed]').filter({ has: page.getByText(name, { exact: true }) });
  async function snapshot(label) {
    const request = { id: randomUUID(), kind: "media-library-state" }, value = await observe("media-native-" + label, () => mediaCheckpoint(request));
    assertCoreMediaReceipt(value, request, plan); checkpoints.push({ label, receiptId: value.id }); nativeStates.push(value); return value;
  }
  async function navigate(path) {
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss(); page.on("dialog", leave);
    try { await observe("media-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); } finally { page.off("dialog", leave); }
  }
  function remember(response) {
    const req = response.request(), method = req.method(), url = new URL(req.url());
    if (url.origin !== origin || !["/api/admin/media-library", "/api/admin/media-usage"].includes(url.pathname) || response.status() < 200 || response.status() > 299) return;
    const body = req.postDataBuffer() ?? Buffer.alloc(0), headers = method === "GET" ? {} : { "content-type": req.headers()["content-type"], origin: req.headers().origin };
    const specimen = { url: req.url(), method, body: Buffer.from(body), headers, bodySha256: hash(body), acknowledged: true };
    validateCoreMediaReplaySpecimen(origin, specimen);
    const operation = method === "GET" ? url.pathname : method === "POST" && !headers["content-type"].includes("application/json") ? "upload" : (() => { try { const value = JSON.parse(body.toString()); return value.operation === "reconcile" && value.dryRun === true ? "reconcile_preview" : value.operation ?? method; } catch { return method; } })();
    if (specimens.some(row => row.operation === operation)) { specimen.body.fill(0); return; }
    specimens.push({ ...specimen, operation, status: response.status(), provenance: "captured-current-request" });
  }
  async function api(method, trigger, { operation, status = 200, path = "/api/admin/media-library", queryMatch = {}, receiptSink } = {}) {
    const wait = page.waitForResponse(response => matchesCoreMediaResponse(response, origin, method, { operation, path, queryMatch }), { timeout: 60_000 });
    const [response] = await Promise.all([wait, trigger()]); assert.equal(response.status(), status);
    const value = await response.json(); remember(response);
    if (receiptSink) { const body = response.request().postDataBuffer(); assert.ok(body); receiptSink({ url: response.request().url(), method, status: response.status(), body: body.toString("utf8"), bodySha256: hash(body), acknowledged: true, provenance: "captured-current-request" }); }
    return value;
  }
  async function library(query = plan.namespace) {
    await navigate("/admin/media-library?q=" + encodeURIComponent(query)); await expect(search(main())).toHaveValue(query);
    return api("GET", () => main().getByRole("button", { name: "كل الملفات", exact: true }).click(), { queryMatch: { q: query, folder: null } });
  }
  async function folder(root, child = false, owner = main()) {
    // Folder accessible names come from the actual Catalog response, never a guessed translation.
    const data = await api("GET", () => search(owner).fill(plan.namespace + "-folder-probe"), { queryMatch: { q: plan.namespace + "-folder-probe" } });
    const entry = data.folders.find(row => row.path === root); assert.ok(entry);
    await api("GET", () => owner.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ has: page.getByText(entry.displayName, { exact: true }) }).click(), { queryMatch: { folder: root, q: plan.namespace + "-folder-probe" } });
    if (child) await api("GET", () => owner.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ hasText: plan.namespace }).click(), { queryMatch: { folder: root + "/" + plan.namespace, q: plan.namespace + "-folder-probe" } });
    await api("GET", () => search(owner).fill(plan.namespace), { queryMatch: { q: plan.namespace, folder: child ? root + "/" + plan.namespace : root } });
  }
  async function selectAsset(asset) {
    const data = await library(asset.display_name); assert.ok(data.assets.some(row => row.id === asset.id));
    const button = assetButton(main(), asset.display_name); await expect(button).toHaveCount(1);
    await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(main().getByRole("heading", { name: asset.display_name, exact: true })).toBeVisible();
  }
  async function ready() {
    await navigate("/admin/settings/media");
    const value = await api("POST", () => main().getByRole("button", { name: "معاينة الفحص", exact: true }).click(), { operation: "reconcile" });
    assert.equal(value.dryRun, true); assert.equal(value.complete, true);
  }
  async function reconcile(receiptSink) {
    await ready(); await main().getByRole("button", { name: "تنفيذ الفحص والمزامنة", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "تنفيذ الفحص والمزامنة؟", exact: true });
    const value = await api("POST", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "reconcile", receiptSink });
    assert.equal(value.dryRun, false); assert.equal(value.complete, true); await expect(dialog).toHaveCount(0);
  }
  async function openDelete() {
    await main().getByRole("button", { name: /^حذف آمن \(/u }).click();
    const dialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true }); await expect(dialog).toBeVisible(); return dialog;
  }
  async function upload(files, replacement = false) {
    const input = replacement ? main().locator("section").filter({ has: page.getByRole("heading", { name: "البيانات الوصفية", exact: true }) }).locator('input[type="file"]') : main().locator('input[type="file"][multiple]');
    const responses = [];
    const listener = response => { if (new URL(response.url()).pathname !== "/api/admin/media-library" || response.request().method() !== "POST") return;
      // Signed images have preparation + completion; documents keep multipart.
      const request = response.request();
      if (request.headers()["content-type"]?.includes("application/json") && request.postDataJSON()?.operation !== "complete_upload") return;
      responses.push(response); };
    page.on("response", listener);
    try {
      await input.setInputFiles(files);
      if (replacement) await expect(page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true })).toBeVisible({ timeout: 60_000 });
      else { await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "success", { timeout: 60_000 }); await expect(main().getByRole("button", { name: "رفع ملفات", exact: true })).toBeEnabled(); }
      await expect.poll(() => responses.length, { timeout: 60_000 }).toBe(files.length);
      for (const [index, response] of responses.entries()) {
        assert.equal(response.status(), 201); const value = await response.json(); assert.ok(value.asset?.id);
        remember(response); uploaded.push(value.asset.id); assert.ok(uploaded.length <= 13);
        payloads.set(value.asset.id, { sha256: hash(files[index].buffer), size: files[index].buffer.length });
      }
      return (await responses.at(-1).json()).asset;
    } finally { page.off("response", listener); }
  }
  async function articleSave(expectedImage) {
    const form = page.locator("form[data-admin-form-runtime]");
    const [response] = await Promise.all([actionResponse(), form.locator('button[type="submit"]').click()]); assertActionAcknowledged(response);
    await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"],[data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first()).toBeVisible({ timeout: 60_000 });
    await page.reload({ waitUntil: "domcontentloaded" }); await form.locator('[data-admin-tab-id="basic"]').click();
    await expect(imageField().locator('input[name="image"]')).toHaveValue(expectedImage);
  }
  const details = (group, verified, extra = {}) => {
    const value = { group, consumer: "media-library", formConsumer: "activity-sitemap-media-commands", surfaces: ["media-command", "media-usage"], verified, automaticCoverage: [], ...extra };
    const operations = { readiness: ["reconcile"], folders: ["create_folder"], "upload-validation-retry": ["upload"],
      "catalog-query": ["/api/admin/media-library"], "metadata-failure-retry": ["update_metadata"], "picker-use": ["/api/admin/media-usage"],
      "physical-move": ["move_asset"], "replace-references": ["replace_all"], "detach-delete": ["DELETE"] };
    for (const operation of operations[group] ?? []) verifiedOperations.add(operation);
    completed.push(value); return value;
  };
  async function createFolderPositive(root, before, prefix = "", receiptSink) {
    await main().getByPlaceholder("اسم المجلد", { exact: true }).fill(plan.namespace);
    await api("POST", () => main().getByRole("button", { name: "إنشاء داخل " + root, exact: true }).click(), { operation: "create_folder", status: 201, receiptSink });
    const after = await snapshot(prefix + "folder-after-" + root);
    assert.ok(after.folders.some(row => row.normalized_path === root + "/" + plan.namespace));
    assertCoreMediaAudit(before, after, "media_folder.create", row => row.metadata.folder === root + "/" + plan.namespace);
    const assertNavigation = async () => {
      const response = await page.request.get(origin + "/api/admin/media-library");
      assert.equal(response.status(), 200);
      const model = await response.json();
      assert.equal(model.summary.folderCount, model.folders.length);
      await expect(main().locator("[data-media-folder-path]")).toHaveCount(model.folders.length);
      await expect(main().locator(`[data-media-folder-path="${root}/${plan.namespace}"]`)).toBeVisible();
    };
    await assertNavigation();
    await folder(root === "images" ? "files" : "images");
    await assertNavigation();
    await page.reload({ waitUntil: "domcontentloaded" });
    await assertNavigation();
    await folder(root);

  }
  async function prepareHeldPrerequisite() {
    assert.ok(isCoreMediaSelection(selection)); assert.equal(checkpoints.length, 0);
    const requests = [], capture = proof => requests.push(proof);
    const before = await snapshot("prerequisite-reconcile-before");
    await reconcile(capture); const after = await snapshot("prerequisite-reconciled");
    assert.equal(after.runtime?.state, "synced");
    assert.equal((await library()).readiness.usageResultsAuthoritative, true);
    for (const root of ["images", "files"]) {
      await library(); await folder(root); await main().getByRole("button", { name: "+ جديد", exact: true }).click();
      const folderBefore = await snapshot("prerequisite-folder-before-" + root);
      await createFolderPositive(root, folderBefore, "prerequisite-", capture);
    }
    const proof = { selection: CORE_MEDIA_HELD_SELECTION, purpose: "uncredited-owned-fixture-prerequisite", uiCredit: false,
      ownedRunId: before.ownedRunId, namespace: before.namespace, articleId: before.articleId, qaActorId: before.qaActorId,
      operations: ["reconcile", "create_folder"], checkpoints: checkpoints.map(row => ({ ...row })), requests,
      automaticCoverage: [], globalClosed: false };
    assertCoreMediaHeldPrerequisite({ prerequisite: proof, checkpoints }, nativeStates);
    for (const [index, operation] of proof.operations.entries()) {
      const specimen = specimens.find(row => row.operation === operation); assert.ok(specimen);
      validateCoreMediaReplaySpecimen(origin, specimen);
      assert.equal(specimen.bodySha256, requests[index].bodySha256);
      verifiedOperations.add(operation);
    }
    return proof;
  }

  async function prepareFinalThreePrerequisite(seed) {
    assert.equal(selection, CORE_MEDIA_FINAL_THREE_SELECTION);
    await library(); await folder("images", true);
    await upload([{ name: plan.namespace + ".png", mimeType: "image/png", buffer: png }]); primaryId = uploaded[0];
    await library(); await folder("files", true);
    await upload([{ name: plan.namespace + ".pdf", mimeType: "application/pdf", buffer: coreMediaSyntheticPdf() }]);
    const uploadedState = await snapshot("prerequisite-uploaded"); assert.equal(uploadedState.assets.length, 2);
    const image = assertCoreMediaAsset(uploadedState, primaryId, { status: "active", checksum: hash(png) });
    const document = uploadedState.assets.find(row => row.media_kind === "document"); assert.ok(document);
    await selectAsset(image);
    const metadataForm = main().locator("form").filter({ has: page.locator('input[name="displayName"]') });
    const values = { displayName: plan.namespace + "-authored", defaultAltText: "QA synthetic pixel", defaultTitle: "QA media title", defaultCaption: "QA media caption" };
    for (const [name, value] of Object.entries(values)) await metadataForm.locator('[name="' + name + '"]').fill(value);
    await api("PATCH", () => metadataForm.getByRole("button", { name: "حفظ البيانات", exact: true }).click(), { operation: "update_metadata" });
    const metadata = await snapshot("prerequisite-metadata"), asset = assertCoreMediaAsset(metadata, primaryId, { display_name: values.displayName });
    await selectAsset(asset); for (const [name, value] of Object.entries(values)) await expect(metadataForm.locator('[name="' + name + '"]')).toHaveValue(value);
    await navigate(plan.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
    await imageField().getByRole("button").first().click();
    let dialog = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true }); await expect(dialog).toBeVisible();
    await folder("images", true, dialog);
    const pickerData = await api("GET", () => search(dialog).fill(asset.display_name), { queryMatch: { q: asset.display_name, folder: "images/" + plan.namespace } });
    assert.deepEqual(pickerData.assets.map(row => row.id), [asset.id]); await assetButton(dialog, asset.display_name).click();
    await dialog.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.locator('[name="image_alt"]').fill("QA synthetic image"); await articleSave(asset.public_url);
    await snapshot("prerequisite-picker");
    const usage = page.waitForResponse(response => matchesCoreMediaResponse(response, origin, "GET", { path: "/api/admin/media-usage" }) && response.status() === 200);
    await selectAsset(asset); remember(await usage);
    await expect(main().getByRole("link", { name: "فتح التحرير", exact: true })).toHaveAttribute("href", plan.article.editPath);
    await expect(main().locator('[data-media-library-mode="manage"]')).toContainText(plan.article.title);
    await snapshot("prerequisite-usage");
    await main().getByRole("button", { name: "نقل / إعادة تسمية", exact: true }).click();
    const moveForm = main().locator("form").filter({ has: page.locator('input[name="targetFolder"]') });
    await moveForm.getByLabel("مجلد الوجهة", { exact: true }).fill("images/" + plan.namespace + "/moved");
    await moveForm.getByLabel("اسم الملف الفعلي الجديد", { exact: true }).fill(plan.namespace + "-renamed.png");
    await moveForm.getByRole("button", { name: "مراجعة العملية", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "مراجعة النقل وإعادة التسمية", exact: true });
    await api("PATCH", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "move_asset" }); await expect(dialog).toHaveCount(0);
    const moved = await snapshot("prerequisite-moved"); await selectAsset(moved.assets.find(row => row.id === primaryId));
    const replacement = await upload([{ name: plan.namespace + "-replacement.png", mimeType: "image/png", buffer: png }], true);
    await snapshot("prerequisite-replacement-staged");
    dialog = page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true });
    await api("PATCH", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "replace_all" }); await expect(dialog).toHaveCount(0);
    await snapshot("prerequisite-replaced"); currentId = replacement.id;
    const proof = { selection, purpose: "uncredited-owned-fixture-prerequisite", uiCredit: false, seed,
      ownedRunId: seed.ownedRunId, namespace: seed.namespace, articleId: seed.articleId, qaActorId: seed.qaActorId,
      origin, primaryId, documentId: document.id, replacementId: replacement.id,
      checkpoints: checkpoints.map(row => ({ ...row })), operations: [...finalThreeSetupOperations],
      specimens: specimens.filter(row => finalThreeSetupOperations.includes(row.operation)).map(serializeCoreMediaSpecimen), automaticCoverage: [], globalClosed: false };
    assertCoreMediaFinalThreePrerequisite({ prerequisite: proof, checkpoints }, nativeStates);
    for (const operation of proof.operations) verifiedOperations.add(operation);
    return proof;
  }

  const group = (name, execute) => plan.groups.includes(name) ? run("core-media-" + name, [], execute) : Promise.resolve();
  try {
    if (selection === null) {
    await group("readiness", async () => {
      const before = await snapshot("readiness-before"); await ready();
      assertCoreMediaUnchanged(before, await snapshot("preview-readonly"), true);
      await main().getByRole("button", { name: "تنفيذ الفحص والمزامنة", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "تنفيذ الفحص والمزامنة؟", exact: true });
      await dialog.locator("[data-admin-confirm-cancel]").click(); await expect(dialog).toHaveCount(0);
      assertCoreMediaUnchanged(before, await snapshot("reconcile-cancel"), true);
      await reconcile(); const after = await snapshot("reconciled"); assert.equal(after.runtime?.state, "synced");
      assert.equal((await library()).readiness.usageResultsAuthoritative, true);
      return details("readiness", ["preview_readonly", "confirmation_cancel", "real_reconciliation"]);
    });
    await group("folders", async () => {
      for (const root of ["images", "files"]) {
        await library(); await folder(root); await main().getByRole("button", { name: "+ جديد", exact: true }).click();
        const before = await snapshot("folder-before-" + root); let posts = 0;
        const listener = req => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/admin/media-library") posts++; };
        page.on("request", listener);
        try { await main().getByRole("button", { name: "إنشاء داخل " + root, exact: true }).click(); }
        finally { page.off("request", listener); }
        assert.equal(posts, 0);
        await createFolderPositive(root, before);
      }
      return details("folders", ["empty_no_post", "create_native_actor_audit"]);
    });
    } else {
      prerequisite = await prepareHeldPrerequisite();
      if (selection === CORE_MEDIA_FINAL_THREE_SELECTION) prerequisite = await prepareFinalThreePrerequisite(prerequisite);
    }
    await group("upload-validation-retry", async () => {
      await library(); await folder("images", true);
      const before = await snapshot("upload-invalid-before"); let posts = 0;
      const listener = req => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/admin/media-library") posts++; };
      page.on("request", listener);
      try {
        await main().locator('input[type="file"][multiple]').setInputFiles({ name: plan.namespace + ".svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
        await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "warning"); await expect(feedback()).toContainText("SVG");
      } finally { page.off("request", listener); }
      assert.equal(posts, 0); assertCoreMediaUnchanged(before, await snapshot("upload-invalid-after"), true);
      await upload(Array.from({ length: 10 }, (_, index) => ({ name: plan.namespace + "-" + index + ".png", mimeType: "image/png", buffer: png })));
      primaryId = uploaded[0]; currentId = primaryId;
      await library(); await folder("files", true);
      await upload([{ name: plan.namespace + ".pdf", mimeType: "application/pdf", buffer: coreMediaSyntheticPdf() }]);
      const after = await snapshot("uploaded"); assert.equal(after.assets.length, 11);
      for (const id of uploaded) {
        const asset = assertCoreMediaAsset(after, id, { status: "active", reconciliation_state: "synced" });
        assert.equal(asset.checksum, payloads.get(id).sha256);
        assertCoreMediaAudit(before, after, "media_asset.create", row => row.metadata.objectKey === asset.object_key && row.metadata.bucket === asset.bucket);
      }
      return details("upload-validation-retry", ["invalid_zero_write", "busy_released", "valid_png_pdf_retry", "eleven_catalog_object_binary_audits"]);
    });
    await group("catalog-query", async () => {
      let searchWrites=0;const countSearchWrites=request=>{if(new URL(request.url()).origin===origin&&!['GET','HEAD'].includes(request.method()))searchWrites++;};page.on('request',countSearchWrites);try{
      const state = await snapshot("query-baseline"); assert.equal(state.assets.length, 11);
      const first = await library(); assert.equal(first.assets.length, 10); assert.equal(first.total, 11);
      const selectedFirstPage = assetButton(main(), first.assets[0].displayName);
      await selectedFirstPage.click(); await expect(selectedFirstPage).toHaveAttribute("aria-pressed", "true");
      const second = await api("GET", () => main().locator("[data-admin-table-pagination]").getByRole("button", { name: "التالي", exact: true }).click(), { queryMatch: { page: "2" } }); assert.equal(second.assets.length, 1);
      await expect(main().locator('button[aria-pressed="true"]').filter({ hasNotText: /^(?:شبكة|قائمة)$/u })).toHaveCount(0);
      assert.deepEqual([...first.assets, ...second.assets].map(row => row.id).sort(), state.assets.map(row => row.id).sort());
      const again = await api("GET", () => main().locator("[data-admin-table-pagination]").getByRole("button", { name: "السابق", exact: true }).click(), { queryMatch: { page: "1" } });
      assert.deepEqual(again.assets.map(row => row.id), first.assets.map(row => row.id));
      await main().locator('[data-admin-table-pagination] button[aria-haspopup="listbox"]').click();
      const twenty = await api("GET", () => page.getByRole("option", { name: "20", exact: true }).click(), { queryMatch: { pageSize: "20" } }); assert.equal(twenty.assets.length, 11);
      await main().getByRole("button", { name: "قائمة", exact: true }).click();
      for (const asset of state.assets) await expect(assetButton(main(), asset.display_name)).toHaveCount(1);
      await main().getByRole("button", { name: "شبكة", exact: true }).click();
      const selected = assetButton(main(), first.assets[0].displayName); await selected.click(); await expect(selected).toHaveAttribute("aria-pressed", "true");
      await main().getByRole("button", { name: "مسح التحديد", exact: true }).click(); await expect(selected).toHaveAttribute("aria-pressed", "false");
      await main().getByRole("button", { name: /^الفلاتر/u }).click();
      const filter = page.getByRole("dialog", { name: "الفلاتر", exact: true });
      await filter.getByRole("option", { name: "PDF", exact: true }).click();
      const pdfOnly = await api("GET", () => filter.getByRole("button", { name: "تطبيق الفلاتر", exact: true }).click(), { queryMatch: { kind: "document" } }); assert.equal(pdfOnly.total, 1);
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).searchParams.get("kind"), "document"); await expect(search(main())).toHaveValue(plan.namespace);
      await library();
      const selectBeforeQuery = assetButton(main(), first.assets[0].displayName);
      await selectBeforeQuery.click(); await expect(selectBeforeQuery).toHaveAttribute("aria-pressed", "true");
      const empty = await api("GET", () => search(main()).fill(plan.namespace + "-absent"), { queryMatch: { q: plan.namespace + "-absent" } }); assert.equal(empty.total, 0);
      await expect(main().locator('[data-media-library-mode="manage"]')).toContainText("لا توجد ملفات مطابقة داخل هذا العرض.");
      await expect(main().locator('button[aria-pressed="true"]').filter({ hasNotText: /^(?:شبكة|قائمة)$/u })).toHaveCount(0);
      // Reuse only the already populated owned images folder; no new asset or metadata mutation.
      await folder('images',true);const folderPath='images/'+plan.namespace,contract=await loadCoreResidualSearchContract('media'),searchRows=coreResidualMediaRows(contract,state,folderPath),observations=[];
      assert.equal(searchRows.length,10);const cards=main().locator('[data-media-library-mode="manage"] button[aria-pressed]').filter({hasNotText:/^(?:شبكة|قائمة)$/u});
      for(const query of coreResidualSearchQueries(plan.namespace)){
        const payload=await api('GET',()=>search(main()).fill(query.query),{queryMatch:{q:query.query||null,folder:folderPath}});
        const ids=projectCoreResidualSearchRows(contract,searchRows,query.query);assert.deepEqual(payload.assets.map(row=>row.id).sort(),ids);assert.equal(payload.total,ids.length);
        await expect(cards).toHaveCount(ids.length);for(const id of ids){const asset=state.assets.find(row=>row.id===id);await expect(assetButton(main(),asset.display_name)).toHaveCount(1);}
        assert.equal(new URL(page.url()).searchParams.get('folder'),folderPath);assert.equal(new URL(page.url()).searchParams.get('q')??'',query.query);
        observations.push({...query,ids:payload.assets.map(row=>row.id).sort(),uiExact:true,queryStateExact:true});
      }
      const searchFragments=assertCoreResidualSearchFragments(contract,searchRows,plan.namespace,observations),searchNamedCellBindings=bindCoreResidualSearchCells(contract,requiredCases);
      await page.reload({waitUntil:'domcontentloaded'});await expect(search(main())).toHaveValue(plan.namespace);assert.equal(new URL(page.url()).searchParams.get('folder'),folderPath);await expect(cards).toHaveCount(searchRows.length);
      const searchAfter=await snapshot('query-after');assertCoreMediaUnchanged(state,searchAfter,true);assert.equal(searchWrites,0);
      return details("catalog-query", ["query_reload", "kind_filter", "selection_clear", "page_query_selection_reset", "grid_list", "pagination_disjoint_union", "page_size", "empty_result"],{searchFragments,searchNamedCellBindings,searchNativeCheckpointIds:[state.id,searchAfter.id],searchFolder:folderPath,searchReloadRetained:true,searchWrites});
      }finally{page.off('request',countSearchWrites);}
    });
    await group("metadata-failure-retry", async () => {
      const before = await snapshot("metadata-before"), asset = before.assets.find(row => row.id === primaryId); assert.ok(asset); await selectAsset(asset);
      const form = main().locator("form").filter({ has: page.locator('input[name="displayName"]') });
      const values = { displayName: plan.namespace + "-authored", defaultAltText: "QA synthetic pixel", defaultTitle: "QA media title", defaultCaption: "QA media caption" };
      for (const [name, value] of Object.entries(values)) await form.locator('[name="' + name + '"]').fill(value);
      let blocked = 0;
      const interceptor = async route => {
        const req = route.request();
        if (req.method() === "PATCH" && req.postDataJSON()?.operation === "update_metadata" && blocked === 0) { blocked++; await route.abort("failed"); }
        else await route.fallback();
      };
      const removeMetadataRoute = await registerCorePageRoute(page, origin + "/api/admin/media-library", interceptor);
      try { await form.getByRole("button", { name: "حفظ البيانات", exact: true }).click(); await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "danger"); }
      finally { await removeMetadataRoute(); }
      assert.equal(blocked, 1); await expect(form.getByRole("button", { name: "حفظ البيانات", exact: true })).toBeEnabled();
      for (const [name, value] of Object.entries(values)) await expect(form.locator('[name="' + name + '"]')).toHaveValue(value);
      assertCoreMediaUnchanged(before, await snapshot("metadata-failed"), true);
      await api("PATCH", () => form.getByRole("button", { name: "حفظ البيانات", exact: true }).click(), { operation: "update_metadata" });
      const after = await snapshot("metadata-saved");
      const saved = assertCoreMediaAsset(after, primaryId, { display_name: values.displayName, default_alt_text: values.defaultAltText, default_title: values.defaultTitle, default_caption: values.defaultCaption });
      assert.equal(saved.object_key, asset.object_key);
      assertCoreMediaAudit(before, after, "media_asset.update", row => row.metadata.assetId === primaryId && row.metadata.operation === "metadata");
      await selectAsset(saved); for (const [name, value] of Object.entries(values)) await expect(form.locator('[name="' + name + '"]')).toHaveValue(value);
      for (const query of [saved.display_name, saved.object_key, saved.default_alt_text]) {
        const found = await library(query); assert.deepEqual(found.assets.map(row => row.id), [primaryId]);
      }
      assertCoreMediaUnchanged(after, await snapshot("metadata-search-readonly"), true);
      return details("metadata-failure-retry", ["pre_delivery_failure", "typed_values_preserved", "busy_released", "real_retry_reload_native", "name_path_alt_search"]);
    });
    await group("preview", async () => {
      const state = await snapshot("preview"), image = assertCoreMediaAsset(state, primaryId, { status: "active" }); await selectAsset(image);
      const preview = main().locator("section").filter({ has: page.getByRole("heading", { name: image.display_name, exact: true }) }).locator("img");
      await expect(preview).toHaveCount(1);
      await expect(preview).toBeVisible();
      await expect.poll(() => preview.evaluate(observeCoreMediaPreviewImage, image.public_url)).toMatchObject({
        exactOwnedUrl: true, complete: true, visible: true, decoded: true, decodedWidth: 1, decodedHeight: 1, sourceStable: true, decodeError: null,
      });
      const document = state.assets.find(row => row.media_kind === "document"); assert.ok(document); assertCoreMediaAsset(state, document.id, { status: "active" }); await selectAsset(document);
      await expect(main().getByTitle("معاينة " + document.display_name, { exact: true })).toHaveAttribute("src", document.public_url + "#page=1&view=FitH&toolbar=0&navpanes=0");
      return details("preview", ["loaded_image", "pdf_owned_iframe", "native_exact_binary_hashes"]);
    });
    await group("picker-use", async () => {
      const before = await snapshot("picker-before"), asset = before.assets.find(row => row.id === primaryId); assert.ok(asset);
      await navigate(plan.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
      await imageField().getByRole("button").first().click();
      let dialog = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true }); await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "إلغاء", exact: true }).click(); await expect(dialog).toHaveCount(0);
      assertCoreMediaUnchanged(before, await snapshot("picker-cancel"), true);
      await imageField().getByRole("button").first().click();
      dialog = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
      await folder("images", true, dialog);
      const pickerData = await api("GET", () => search(dialog).fill(asset.display_name), { queryMatch: { q: asset.display_name, folder: "images/" + plan.namespace } });
      assert.deepEqual(pickerData.assets.map(row => row.id), [asset.id]);
      await assetButton(dialog, asset.display_name).click();
      await dialog.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click(); await expect(dialog).toHaveCount(0);
      await page.locator('[name="image_alt"]').fill("QA synthetic image"); await articleSave(asset.public_url);
      const after = await snapshot("picker-saved"); assert.equal(after.article.image, asset.public_url);
      assert.ok(after.references.some(row => row.asset_id === primaryId && String(row.entity_identity) === String(plan.article.id) && row.field_key === "image"));
      assertCoreMediaAudit(before, after, "topic.update", row => String(row.entity_id) === String(plan.article.id));
      const usage = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/media-usage" && response.status() === 200);
      await selectAsset(asset); const usageResponse = await usage; remember(usageResponse);
      await expect(main().getByRole("link", { name: "فتح التحرير", exact: true })).toHaveAttribute("href", plan.article.editPath);
      await expect(main().locator('[data-media-library-mode="manage"]')).toContainText(plan.article.title);
      return details("picker-use", ["cancel_no_write", "actual_picker", "article_save_reload", "native_reference", "usage_edit_link"]);
    });
    await group("in-use-delete", async () => {
      const before = await snapshot("used-before"), asset = before.assets.find(row => row.id === currentId); assert.ok(asset);
      assert.ok(before.references.some(row => row.asset_id === asset.id)); await selectAsset(asset);
      let dialog = await openDelete(); await dialog.locator("[data-admin-confirm-cancel]").click();
      assertCoreMediaUnchanged(before, await snapshot("used-cancel"), true);
      dialog = await openDelete();
      const value = await api("DELETE", () => dialog.locator("[data-admin-confirm-submit]").click(), { status: 409 });
      assert.equal(value.code, "media_delete_in_use"); await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-admin-confirm-submit]")).toBeEnabled();
      await expect(feedback()).toContainText("لا يمكن حذف الملف قبل فك جميع مراجعه الحالية.");
      const after = await snapshot("used-rejected"); assertCoreMediaAsset(after, asset.id, { status: "active" });
      assert.deepEqual(after.references, before.references); assert.equal(after.article.image, before.article.image); assert.equal(after.storageSha256, before.storageSha256);
      await dialog.locator("[data-admin-confirm-cancel]").click();
      return details("in-use-delete", ["cancel_no_write", "real_conflict", "object_refs_preserved", "retryable_confirmation"]);
    });
    await group("physical-move", async () => {
      for (const [index, targetFolder] of ["images/" + plan.namespace, "images/" + plan.namespace + "/moved"].entries()) {
        const before = await snapshot("move-before-" + index), asset = before.assets.find(row => row.id === currentId); assert.ok(asset);
        await selectAsset(asset); await main().getByRole("button", { name: "نقل / إعادة تسمية", exact: true }).click();
        const form = main().locator("form").filter({ has: page.locator('input[name="targetFolder"]') });
        const filename = plan.namespace + "-renamed.png";
        await form.getByLabel("مجلد الوجهة", { exact: true }).fill(targetFolder); await form.getByLabel("اسم الملف الفعلي الجديد", { exact: true }).fill(filename);
        await form.getByRole("button", { name: "مراجعة العملية", exact: true }).click();
        let dialog = page.getByRole("dialog", { name: "مراجعة النقل وإعادة التسمية", exact: true });
        await dialog.locator("[data-admin-confirm-cancel]").click(); await expect(form.getByLabel("مجلد الوجهة", { exact: true })).toHaveValue(targetFolder);
        await expect(form.getByLabel("اسم الملف الفعلي الجديد", { exact: true })).toHaveValue(filename);
        assertCoreMediaUnchanged(before, await snapshot("move-cancel-" + index), true);
        await form.getByRole("button", { name: "مراجعة العملية", exact: true }).click();
        dialog = page.getByRole("dialog", { name: "مراجعة النقل وإعادة التسمية", exact: true });
        await api("PATCH", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "move_asset" }); await expect(dialog).toHaveCount(0);
        const after = await snapshot("move-after-" + index);
        const changed = assertCoreMediaAsset(after, currentId, { object_key: targetFolder + "/" + filename, status: "active" });
        assert.equal(changed.checksum, asset.checksum); assert.equal(after.article.image, changed.public_url);
        const semanticReferences = rows => rows.map(({ asset_id, domain_key, entity_type, entity_identity, field_key, reference_state }) => ({ asset_id, domain_key, entity_type, entity_identity, field_key, reference_state })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        assert.deepEqual(semanticReferences(after.references), semanticReferences(before.references), "A physical move preserves this owned asset's semantic references; the canonical synchronization RPC may replace row IDs.");
        assert.equal(after.binaries.find(row => row.publicUrl === asset.public_url)?.missing, true);
        assertCoreMediaAudit(before, after, "media_asset.update", row => row.metadata.assetId === asset.id && row.metadata.operation === (index ? "move_physical_object" : "rename_physical_object"));
      }
      return details("physical-move", ["cancel_preserves_draft", "rename_move", "same_bytes", "old_object_absent", "reference_retargeted"]);
    });
    await group("replace-references", async () => {
      const before = await snapshot("replace-before"), asset = before.assets.find(row => row.id === currentId); assert.ok(asset);
      await selectAsset(asset); await upload([{ name: plan.namespace + "-replacement-cancel.png", mimeType: "image/png", buffer: png }], true);
      let dialog = page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true });
      const staged = await snapshot("replacement-staged"); assert.equal(staged.assets.length, before.assets.length + 1);
      await dialog.locator("[data-admin-confirm-cancel]").click();
      const cancelled = await snapshot("replacement-cancelled"); assertCoreMediaUnchanged(staged, cancelled, true); assert.equal(cancelled.article.image, asset.public_url);
      await selectAsset(asset);
      const next = await upload([{ name: plan.namespace + "-replacement-confirm.png", mimeType: "image/png", buffer: png }], true);
      const preConfirm = await snapshot("replacement-confirm-before");
      dialog = page.getByRole("dialog", { name: "استبدال كل المراجع المدعومة؟", exact: true });
      await api("PATCH", () => dialog.locator("[data-admin-confirm-submit]").click(), { operation: "replace_all" }); await expect(dialog).toHaveCount(0);
      const after = await snapshot("replacement-confirmed");
      assert.equal(after.article.image, next.publicUrl); assert.equal(after.references.some(row => row.asset_id === asset.id), false);
      assertCoreMediaAsset(after, asset.id, { status: "active" }); assertCoreMediaAsset(after, next.id, { status: "active" });
      assertCoreMediaAudit(preConfirm, after, "media_asset.update", row => row.metadata.previousAssetId === asset.id && row.metadata.nextAssetId === next.id && row.metadata.operation === "replace_all_supported_references");
      currentId = next.id;
      return details("replace-references", ["stage_real_upload", "cancel_retains_new_object", "confirmed_rebind", "old_object_retained"]);
    });
    await group("detach-delete", async () => {
      await navigate(plan.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
      await imageField().getByRole("button", { name: "إزالة", exact: true }).click(); await articleSave("");
      await reconcile(); let before = await snapshot("detached"); assert.ok(!before.article.image); assert.equal(before.references.length, 0);
      for (const asset of before.assets.filter(row => row.status === "active")) {
        await selectAsset(asset); await expect(main().locator('[data-media-library-mode="manage"]')).toContainText("لا توجد استخدامات حالية لهذا الملف.");
        let dialog = await openDelete(); await dialog.locator("[data-admin-confirm-cancel]").click();
        assertCoreMediaUnchanged(before, await snapshot("delete-cancel"), true);
        dialog = await openDelete(); await api("DELETE", () => dialog.locator("[data-admin-confirm-submit]").click()); await expect(dialog).toHaveCount(0);
        const after = await snapshot("delete-complete"); assertCoreMediaAsset(after, asset.id, { status: "deleted" });
        assertCoreMediaAudit(before, after, "media_asset.delete", row => row.metadata.assetId === asset.id);
        assert.ok(after.reservations.some(row => row.asset_id === asset.id && row.status === "completed"));
        assert.equal(after.leases.some(row => row.asset_id === asset.id && (row.status === "active" || (["failed", "expired"].includes(row.status) && !row.resolved_at))), false);
        before = after;
        if (before.assets.some(row => row.status === "active")) { await reconcile(); before = await snapshot("delete-next-ready"); }
      }
      assert.equal(before.assets.filter(row => row.status !== "deleted").length, 0);
      return details("detach-delete", ["article_detach", "authoritative_unused", "cancel_no_write", "safe_delete_all_owned_files", "tombstone_binary_absence"]);
    });
    await group("permission", async () => {
      assertCoreMediaPermissionPrerequisites(specimens, verifiedOperations);
      const before = await snapshot("permission-before"), client = await http.newContext({ storageState: { cookies: [], origins: [] } }), denials = [];
      try {
        for (const specimen of specimens) {
          validateCoreMediaReplaySpecimen(origin, specimen);
          const response = await client.fetch(specimen.url, { method: specimen.method, headers: specimen.headers, ...(specimen.method === "GET" ? {} : { data: specimen.body }), maxRedirects: 0, timeout: 30_000 });
          const value = await response.json(); assertCoreMediaPermissionResponse(response.status(), value);
          denials.push({ operation: specimen.operation, bodySha256: specimen.bodySha256, status: response.status(), value }); await response.dispose();
        }
      } finally { await client.dispose(); }
      assertCoreMediaUnchanged(before, await snapshot("permission-after"), true);
      return details("permission", ["actual_cookie_free_HTTP_Auth_boundary", "all_public_storage_unchanged"], { operations: specimens.map(row => row.operation), ...(selection === CORE_MEDIA_FINAL_THREE_SELECTION ? { requestProof: { origin, specimens: specimens.map(serializeCoreMediaSpecimen), verifiedOperations: [...verifiedOperations], denials } } : {}), proofLimit: "No UI denial or internal Action execution claim." });
    });
    if (selection === CORE_MEDIA_FINAL_THREE_SELECTION) assertCoreMediaFinalThreePermission({ prerequisite, completed, checkpoints }, nativeStates);
  } finally { for (const specimen of specimens) specimen.body.fill(0); }
  return { completed, checkpoints, ...(prerequisite ? { prerequisite } : {}), relatedRequiredCases: plan.relatedRequiredCases, automaticCoverage: [], globalClosed: false,
    limits: ["Media only; sibling Activity/Sitemap remain separate.", "No Production, original assets, external provider or generic Form/Row Actions closure."] };
}


/** Scoped folder lifecycle proof using the existing Media UI and mutation owners.
 * The caller supplies an authenticated page; only fresh, run-owned folders are mutated.
 */
export async function verifyManagedMediaFolderLifecycle({ page, origin, namespace = `qa-folder-${randomUUID()}` }) {
  assert.match(namespace, /^qa-folder-[a-z0-9-]+$/);
  const apiUrl = origin + "/api/admin/media-library";
  const main = () => page.locator('[data-media-library-mode="manage"]');
  const ownedFolders = new Set();
  const uploaded = [];
  const responseFor = operation => page.waitForResponse(r => r.url() === apiUrl && r.request().method() === "POST"
    && r.request().postDataJSON()?.operation === operation, { timeout: 120_000 });
  async function model() {
    const response = await page.request.get(apiUrl);
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  }
  async function visibility(expected) {
    const current = await model();
    assert.equal(current.summary.folderCount, current.folders.length);
    await expect(main().locator("[data-media-folder-path]")).toHaveCount(current.folders.length);
    for (const path of expected) await expect(main().locator(`[data-media-folder-path="${path}"]`)).toBeVisible();
    return current;
  }
  async function open(path) {
    await main().locator(`[data-media-folder-path="${path}"]`).click();
    await expect(main().locator(`[data-media-folder-path="${path}"]`)).toHaveAttribute("aria-current", "page");
  }
  async function create(root) {
    const path = root + "/" + namespace;
    assert.ok(!(await model()).folders.some(row => row.path === path));
    await open(root);
    await main().getByRole("button", { name: "+ جديد", exact: true }).click();
    await main().getByPlaceholder("اسم المجلد", { exact: true }).fill(namespace);
    const pending = responseFor("create_folder");
    await main().getByRole("button", { name: "إنشاء داخل " + root, exact: true }).click();
    const response = await pending;
    assert.equal(response.status(), 201, await response.text()); ownedFolders.add(path);
    await visibility([path]);
    await open(root === "files" ? "images" : "files");
    await visibility([path]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await visibility([path]);
    return path;
  }
  async function remove(path) {
    assert.ok(ownedFolders.has(path));
    await open(path);
    const preview = responseFor("preview_delete");
    await main().getByRole("button", { name: "حذف المجلد", exact: true }).click();
    const previewResponse = await preview;
    assert.equal(previewResponse.status(), 200, await previewResponse.text());
    const previewModel = await previewResponse.json();
    assert.ok(previewModel.assets.every(asset => asset.folderPath === path));
    const submit = page.locator("[data-admin-confirm-submit]");
    await expect(submit).toBeEnabled({ timeout: 120_000 });
    const retired = responseFor("delete_folder");
    await submit.click();
    const response = await retired;
    assert.equal(response.status(), 200, await response.text());
    await expect(page.locator("[data-admin-confirm-dialog]")).toHaveCount(0, { timeout: 120_000 });
    await expect(main().locator(`[data-media-folder-path="${path}"]`)).toHaveCount(0);
    assert.ok(!(await model()).folders.some(row => row.path === path)); ownedFolders.delete(path);
  }
  await page.goto(origin + "/admin/media-library", { waitUntil: "domcontentloaded" });
  await expect(main()).toBeVisible({ timeout: 60_000 });
  const before = await visibility([]);
  try {
    const empty = await create("files");
    await remove(empty);
    const populated = await create("images");
    await open(populated);
    const prepared = responseFor("prepare_upload");
    const completed = responseFor("complete_upload");
    void completed.catch(() => {});
    const bytes = coreMediaSyntheticPng();
    await main().locator('input[type="file"][multiple]').setInputFiles({ name: namespace + ".png", mimeType: "image/png", buffer: bytes });
    const preparation = await prepared;
    assert.equal(preparation.status(), 200, await preparation.text());
    const response = await completed;
    assert.equal(response.status(), 201, await response.text());
    const { asset } = await response.json(); uploaded.push(asset);
    assert.equal(asset.folderPath, populated); assert.equal(asset.provider, "supabase");
    assert.equal(asset.status, "active"); assert.equal(asset.reconciliationState, "synced");
    const binary = await page.request.get(asset.publicUrl);
    assert.equal(binary.status(), 200); assert.deepEqual(await binary.body(), bytes);
    await page.reload({ waitUntil: "domcontentloaded" });
    await visibility([populated]);
    await expect(main().getByText(namespace + ".png", { exact: true }).first()).toBeVisible();
    await remove(populated);
    // A public CDN response can outlive deletion; authoritative Storage deletion is read separately.
    assert.ok(!(await model()).assets.some(row => row.id === asset.id));
    const after = await visibility([]);
    assert.deepEqual(after.folders.map(row => row.path).sort(), before.folders.map(row => row.path).sort());
    return { status: "PASS", namespace, uploaded: uploaded.map(({ id, folderPath, objectKey }) => ({ id, folderPath, objectKey })),
      storageDeletionRequiresAuthoritativeRead: true,
      checks: ["create", "empty_visibility", "other_root_visibility", "reload", "navigation", "signed_upload_inside", "storage_bytes", "active_synced_catalog", "empty_delete", "populated_delete", "count_consistency", "cleanup"] };
  } finally {
    // Never force-delete: cleanup is confined to this run and uses the same official UI contract.
    for (const path of [...ownedFolders]) await remove(path);
  }
}
