import {observeCoreVisibleAcceptedFeedback} from "./admin-core-domain-form-journeys.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect, request as http } from "playwright/test";
import { registerCorePageRoute } from "./admin-core-form-permission-context.mjs";
import { coreMediaSyntheticPng, matchesCoreMediaResponse, assertCoreMediaAsset } from "./admin-core-media-journeys.mjs";


export const CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION='media-recovery-followup';
export const CORE_MEDIA_RECOVERY_MISSING_SELECTION='media-recovery-missing-followup';
export const CORE_MEDIA_RECOVERY_GROUPS=Object.freeze(['prepare','queue-fetch-retry','committed-lease-warning','resolve-lease','produce-existing-object-reservation','produce-finalize','repair-finalize','produce-missing','repair-missing','repair-existing-object-reservation','permission']);
/** @param {string|null} selection */
export function coreSelectedMediaRecoveryGroups(selection=null){assert.ok(selection===null||selection===CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION||selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION);if(selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION)return CORE_MEDIA_RECOVERY_GROUPS.filter(name=>['produce-missing','repair-missing','permission'].includes(name));return selection===null?[...CORE_MEDIA_RECOVERY_GROUPS]:CORE_MEDIA_RECOVERY_GROUPS.slice(3);}
export function coreSelectedMediaRecoveryIds(selection){assert.ok(selection===CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION||selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION);return coreSelectedMediaRecoveryGroups(selection).map(name=>'core-media-recovery-'+name);}
export function assertCoreMediaRecoverySelectionReceipt(browser,requiredCases){const ids=coreSelectedMediaRecoveryIds(browser.journeySelection);assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'media-recovery');assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);assert.deepEqual(browser.errors,[]);const expectedCases=requiredCases.map(row=>{if(Object.hasOwn(row,'status')||Object.hasOwn(row,'evidence')){assert.equal(row.status,'open');assert.equal(row.evidence,null);}return{...row,status:'open',evidence:null};});assert.equal(new Set(expectedCases.map(row=>row.key)).size,expectedCases.length);assert.deepEqual(browser.requiredCases,expectedCases);assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);const login=browser.evidence.filter(r=>r.id==='existing-auth-login');assert.equal(login.length,1);assert.equal(login[0].status,'pass');assert.equal(login[0].authenticated,true);const rows=browser.evidence.filter(r=>r.id!=='existing-auth-login');assert.deepEqual(rows.map(r=>r.id),ids);assert.ok(rows.every(r=>r.status==='pass'&&r.coverage.length===0));return{status:'pass',selection:browser.journeySelection,selectedJourneyIds:ids,executedJourneyIds:ids,retainedThreeReplayed:false,automaticCoverage:[],wholeCohortExecuted:false,globalClosed:false};}

export function assertCoreMediaRecoveryPermissionHistory(value){assert.ok(value&&typeof value==='object');assert.equal(value.dataSha256,'f1baeff6d4b28fcad7f66d4582c13951ee896222c08e9303b460bb4fa6e54286');assert.equal(createHash('sha256').update(JSON.stringify(value.record)).digest('hex'),value.dataSha256);const h=value.record;assert.equal(h.status,'QUALIFIED_NATIVE_CANONICAL_PERMISSION_REQUESTS');assert.equal(h.run,'browser-r140');assert.equal(h.sourceHead,'f76f4d2885f61961255c0ee994219e03fb2f118b');assert.equal(h.sourceSha256,'116bd51e2c9a46ae41f308e852567f9391d361fec24d11adf68ed60a73c5870c');assert.equal(h.qualification.sha256,'f13850d97e96db95bfb5bce3d5f6f55c91a254ed6f37754692563bec3a526c25');assert.equal(h.review.sha256,'9eb85ce38242d53d8f9939b27b9a568d7830108e7cbab49c9b1eef150eea57df');assert.equal(h.inputSeal.sha256,'c4c47a5f8a729969fb5b17e1c9289dddadbd57df0c80a38082e012fd3456fc7c');assert.equal(h.originalRequestBytesCaptured,false);assert.equal(h.freshDenialsRequired,true);assert.equal(h.freshDomainUnchangedRequired,true);assert.equal(h.globalClosed,false);assert.deepEqual(h.automaticCoverage,[]);assert.deepEqual(h.requests.map(r=>r.action),['resolve_write_lease','retry_finalization','cancel_reservation']);for(const r of h.requests){assert.equal(r.path,'/api/admin/media-library/recovery');assert.equal(r.method,'POST');assert.equal(r.provenance,'canonical-reconstruction-from-qualified-native');assert.equal(r.capturedOriginalBytes,false);assert.equal(createHash('sha256').update(r.body).digest('hex'),r.bodySha256);assert.ok(Number.isSafeInteger(r.actorId)&&r.actorId>0);assert.match(r.beforeId,/^[a-f0-9-]{36}$/u);assert.match(r.afterId,/^[a-f0-9-]{36}$/u);const parsed=JSON.parse(r.body);assert.deepEqual(Object.keys(parsed).sort(),['action','target']);assert.equal(parsed.action,r.action);assert.deepEqual(Object.keys(parsed.target).sort(),['expectedUpdatedAt','id','kind']);assert.equal(parsed.target.kind,r.action==='resolve_write_lease'?'write_lease':'delete_reservation');assert.match(parsed.target.id,/^[a-f0-9-]{36}$/u);assert.equal(parsed.target.expectedUpdatedAt,r.canonicalUpdatedAt);assert.equal(Date.parse(r.canonicalUpdatedAt),Date.parse(r.originalUpdatedAtText));assert.equal(r.body,JSON.stringify({action:r.action,target:{kind:parsed.target.kind,id:parsed.target.id,expectedUpdatedAt:r.canonicalUpdatedAt}}));}return h.requests;}
export function assertCoreMediaRecoveryPermissionContinuation(result,native){
  const outcomes=result.completed.filter(r=>r.name==='permission');assert.equal(outcomes.length,1);const p=outcomes[0];
  assert.equal(p.actualCookieFreeAuthBoundary,true);assert.equal(p.unchangedAllPublicAndStorage,true);assert.equal(p.uiDenialClaim,false);
  const history=assertCoreMediaRecoveryPermissionHistory(p.historicalPermission);
  const nativeById=id=>{const rows=native.records.filter(r=>r.id===id&&r.kind==='media-recovery-state');assert.equal(rows.length,1);assert.equal(rows[0].status,'pass');return rows[0];};
  const get=label=>{const points=result.checkpoints.filter(r=>r.label===label);assert.equal(points.length,1);return nativeById(points[0].id);};
  const before=get('permission-before'),after=get('permission-after');assertCoreRecoveryDomainUnchanged(before,after,true);
  const current=['GET','retry_verification','preview_scoped_reconciliation','confirm_missing'];
  assert.equal(p.currentRequestProofs.length,4);assert.deepEqual(p.currentRequestProofs.map(r=>r.action).sort(),[...current].sort());
  for(const r of p.currentRequestProofs){
    assert.equal(r.path,'/api/admin/media-library/recovery');assert.equal(r.method,r.action==='GET'?'GET':'POST');assert.equal(r.provenance,'captured-current-request');
    assert.equal(createHash('sha256').update(r.body).digest('hex'),r.bodySha256);
    if(r.action==='GET'){assert.equal(r.body,'');continue;}
    const body=JSON.parse(r.body);assert.deepEqual(Object.keys(body).sort(),['action','target']);assert.equal(body.action,r.action);assert.deepEqual(Object.keys(body.target).sort(),['expectedUpdatedAt','id','kind']);assert.equal(body.target.kind,'delete_reservation');
    const proof=result.acceptedFeedback.find(a=>a.action===r.action);assert.ok(proof);assert.equal(proof.targetId,body.target.id);
    const previous=nativeById(proof.nativeBefore),next=nativeById(proof.nativeAfter);assert.equal(previous.ownedRunId,before.ownedRunId);assert.equal(previous.qaActorId,before.qaActorId);
    const reservation=previous.reservations.find(v=>v.id===body.target.id);assert.ok(reservation);assert.match(reservation.updated_at,/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00(?::00)?$/u);assert.equal(body.target.expectedUpdatedAt,reservation.updated_at.replace(' ','T').replace(/\+00$/u,'+00:00'));
    assertCoreRecoveryAudit(previous,next,body.target,r.action,r.action==='confirm_missing'?'mutated':'verified');
    if(r.action!=='confirm_missing')assertCoreRecoveryDomainUnchanged(previous,next);
  }
  assert.equal(p.denialReceipts.length,7);const expected=[...current,...history.map(r=>r.action)];assert.deepEqual(p.denialReceipts.map(r=>r.action).sort(),[...expected].sort());
  for(const r of p.denialReceipts){assert.equal(r.status,401);assert.equal(r.error,'Unauthorized');assert.equal(r.method,r.action==='GET'?'GET':'POST');const sources=[...history,...p.currentRequestProofs].filter(v=>v.action===r.action);assert.equal(sources.length,1);assert.equal(r.requestBodySha256,sources[0].bodySha256);assert.equal(r.provenance,sources[0].provenance);}
  return{status:'pass',freshDenials:7,historicalActions:3,currentActions:3,currentGet:1,unchangedNative:true,originalRequestBytesClaimed:false,automaticCoverage:[],globalClosed:false};
}
const endpoint = "/api/admin/media-library/recovery";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=", "base64");
const labels = { retry_verification: "التحقق من هذا الملف", preview_scoped_reconciliation: "فحص ارتباطات هذا الملف",
  resolve_write_lease: "حل عملية الحفظ", cancel_reservation: "إلغاء حجز الحذف", retry_finalization: "إكمال إنهاء الحذف", confirm_missing: "تأكيد فقد الملف" };
const confirmations = new Set(["resolve_write_lease", "cancel_reservation", "retry_finalization", "confirm_missing"]);
export function createCoreRecoveryQueueReadFault(origin) {
  const expected = new URL(origin); assert.equal(expected.origin, origin); assert.equal(expected.hostname, "127.0.0.1");
  let intercepted = 0;
  return { handle: async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || url.pathname !== endpoint || url.search || request.method() !== "GET") return route.fallback();
    assert.equal(++intercepted, 1, "Only one exact queue GET may be aborted before delivery.");
    await route.abort("failed");
  }, assertConsumed: () => assert.equal(intercepted, 1) };
}
export function assertCoreRecoveryReceipt(value, request, fixture) {
  assert.equal(value?.id, request.id); assert.equal(value.kind, "media-recovery-state"); assert.equal(value.status, "pass");
  assert.equal(value.namespace, fixture.namespace); assert.equal(value.articleId, fixture.article.id);
  assert.ok(typeof value.ownedRunId === "string" && value.ownedRunId && Number.isSafeInteger(value.qaActorId) && value.qaActorId > 0);
  for (const key of ["assets", "objects", "folders", "references", "leases", "reservations", "audits", "binaries", "recoveryAudits"]) assert.ok(Array.isArray(value[key]), "Missing fixed native projection: " + key);
  assert.ok(value.assets.length <= 4 && value.leases.length <= 16 && value.reservations.length <= 8);
  assert.ok(Number.isFinite(Date.parse(value.observedAt)), "The native database clock is required.");
  for (const key of ["storageSha256", "publicDataSha256", "publicTableInventorySha256"]) assert.match(value[key], /^[a-f0-9]{64}$/u);
  for (const row of [...value.audits, ...value.recoveryAudits]) assert.equal(Number(row.actor_admin_user_id), value.qaActorId);
}
export function assertCoreRecoveryReservationAge(state, reservation, ready = false) {
  const start = Date.parse(reservation.started_at), now = Date.parse(state.observedAt);
  assert.ok(Number.isFinite(start) && Number.isFinite(now));
  const age = now - start; assert.ok(age >= 0 && age <= 12 * 60_000, "Real reservation age exceeded its 12-minute bound.");
  if (ready) assert.ok(age >= 10 * 60_000, "Queue repair must follow the actual ten-minute threshold.");
  return age;
}
export function assertCoreRecoveryAudit(before, after, target, action, outcome) {
  assert.equal(after.qaActorId, before.qaActorId);
  const prior = new Set(before.recoveryAudits.map(row => String(row.id)));
  assert.deepEqual(after.recoveryAudits.filter(row => prior.has(String(row.id))), before.recoveryAudits);
  const added = after.recoveryAudits.filter(row => !prior.has(String(row.id)));
  assert.equal(added.length, 2, "Each actual Recovery action requires requested and one outcome audit.");
  assert.deepEqual(added.map(row => row.outcome), ["requested", outcome]);
  for (const row of added) {
    assert.equal(row.operation, action); assert.equal(row.target_id, target.id); assert.equal(row.target_kind, target.kind);
    assert.equal(Number(row.actor_admin_user_id), after.qaActorId);
  }
}
export function assertCoreRecoveryDomainUnchanged(before, after, cancel = false) {
  for (const key of ["ownedRunId", "qaActorId", "namespace", "articleId", "article", "assets", "objects", "folders", "references", "leases", "reservations", "audits", "storageSha256"]) assert.deepEqual(after[key], before[key], "Unexpected owned Recovery domain change: " + key);
  if (cancel) {
    assert.deepEqual(after.recoveryAudits, before.recoveryAudits);
    assert.equal(after.publicDataSha256, before.publicDataSha256);
    assert.equal(after.publicTableInventorySha256, before.publicTableInventorySha256);
  }
}
export function assertCoreRecoveryQueue(queue, state) {
  assert.equal(queue.available, true); assert.equal(queue.truncated, false);
  assert.ok(Array.isArray(queue.items));
  for (const key of ["stuckDeletes", "missingOrUncertainAssets", "unresolvedLeaseBatches"]) assert.ok(Number.isSafeInteger(queue.counts?.[key]) && queue.counts[key] >= 0);
  assert.equal(queue.counts.stuckDeletes, queue.items.filter(row => row.kind === "delete_reservation").length);
  assert.equal(queue.counts.unresolvedLeaseBatches, queue.items.filter(row => row.kind === "write_lease").length);
  const owned = new Set(state.assets.map(row => row.id));
  const items = queue.items.filter(row => owned.has(row.assetId));
  assert.equal(new Set(items.map(row => row.kind + ":" + row.id)).size, items.length);
  for (const item of items) {
    assert.ok(["asset", "delete_reservation", "write_lease"].includes(item.kind));
    assert.ok(item.allowedActions.every(action => Object.hasOwn(labels, action)));
  }
  return items;
}
export async function runCoreMediaRecoveryJourneys(ctx) {
  const { page, origin, fixtures, run, observe, recoveryCheckpoint, requiredCases, actionResponse, assertActionAcknowledged } = ctx;
  assert.equal(new URL(origin).origin, origin); assert.equal(new URL(origin).hostname, "127.0.0.1"); assert.equal(typeof recoveryCheckpoint, "function");
  const selection=ctx.journeySelection??null;coreSelectedMediaRecoveryGroups(selection);assert.equal(fixtures.mediaRecoverySelection??null,selection);
  const fixture = fixtures.mediaClosure; assert.ok(fixture?.namespaceUnique && fixture.maximumAssets === 13);
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import("../../src/lib/admin/interaction-system/adoption-manifest.ts");
  const manifest = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.filter(row => row.id === "media-recovery-queue");
  assert.equal(manifest.length, 1); assert.equal(manifest[0].generic, false);
  const { MEDIA_RECOVERY_ACTIONS } = await jiti.import("../../src/lib/admin/media-catalog/recovery-contract.ts");
  assert.deepEqual([...MEDIA_RECOVERY_ACTIONS].sort(), Object.keys(labels).sort());
  const relatedRequiredCases = requiredCases.filter(row => row.consumer === "media-recovery-queue").map(row => row.key);
  assert.ok(relatedRequiredCases.length);
  const main = () => page.locator("main");
  const root = () => main().locator("section").filter({ has: page.getByRole("heading", { name: "حالات تحتاج مراجعة", exact: true }) });
  const feedback = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="media-settings-recovery"]');
  const search = owner => owner.getByPlaceholder("ابحث بالاسم أو المسار أو الوصف البديل…", { exact: true });
  const imageField = () => page.locator('[data-admin-media-image-field="image"]');
  const assetButton = (owner, name) => owner.locator("button[aria-pressed]").filter({ has: page.getByText(name, { exact: true }) });
  const specimens = [], completed = [], checkpoints = [], verifiedActions = new Set(), acceptedFeedback=[];
  let pendingCancellation,prerequisite;
  async function snapshot(label) {
    const request = { id: randomUUID(), kind: "media-recovery-state" };
    const value = await observe("recovery-native-" + label, () => recoveryCheckpoint(request));
    assertCoreRecoveryReceipt(value, request, fixture);
    assert.equal(value.namespace, fixture.namespace); assert.equal(value.articleId, fixture.article.id);
    assert.ok(Number.isSafeInteger(value.qaActorId) && value.qaActorId > 0 && value.assets.length <= 4);
    assert.ok(Array.isArray(value.recoveryAudits) && Array.isArray(value.leases) && Array.isArray(value.reservations));
    checkpoints.push({ label, id: value.id }); return value;
  }
  async function navigate(path) {
    const leave = async dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss(); page.on("dialog", leave);
    try { await observe("recovery-navigation", () => page.goto(origin + path, { waitUntil: "domcontentloaded" })); } finally { page.off("dialog", leave); }
  }
  function remember(response, action = "GET") {
    if (specimens.some(row => row.action === action)) return;
    const request = response.request(), body = Buffer.from(request.postDataBuffer() ?? Buffer.alloc(0));
    assert.equal(new URL(request.url()).origin, origin); assert.equal(new URL(request.url()).pathname, endpoint);
    assert.ok(body.length <= 8192);
    const headers = request.method() === "GET" ? {} : { "content-type": request.headers()["content-type"], origin: request.headers().origin };
    if (request.method() !== "GET") { assert.equal(headers.origin, origin); assert.equal(headers["content-type"], "application/json"); }
    specimens.push({ action, url: request.url(), method: request.method(), headers, body, sha256: createHash("sha256").update(body).digest("hex") });
  }
  async function api(method, trigger, { action, operation, path = endpoint, status = 200, queryMatch = {} } = {}) {
    const wait = page.waitForResponse(response => {
      if (!matchesCoreMediaResponse(response, origin, method, { path, operation, queryMatch })) return false;
      if (!action) return true;
      try { return response.request().postDataJSON().action === action; } catch { return false; }
    }, { timeout: 60_000 });
    const [response] = await Promise.all([wait, trigger()]); assert.equal(response.status(), status);
    const data = await response.json();
    if (path === endpoint && response.ok()) remember(response, action);
    return data;
  }
  async function queueUI(queue) {
    assert.equal(queue.available, true); assert.equal(queue.truncated, false);
    for (const [label, key] of [["عمليات حذف متوقفة", "stuckDeletes"], ["أصول مفقودة أو غير مؤكدة", "missingOrUncertainAssets"], ["عمليات حفظ غير محلولة", "unresolvedLeaseBatches"]]) {
      await expect(root().locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd")).toHaveText(String(queue.counts[key]));
    }
    if (!queue.items.length) await expect(root().getByText("لا توجد حاليًا حالات تشغيلية عالقة تحتاج تدخلًا.", { exact: true })).toBeVisible();
  }
  async function settings() {
    const result = await api("GET", () => navigate("/admin/settings/media"));
    await expect(root().getByRole("button", { name: "تحديث الحالات", exact: true })).toBeEnabled(); await queueUI(result); return result;
  }
  async function refresh() {
    const result = await api("GET", () => root().getByRole("button", { name: "تحديث الحالات", exact: true }).click());
    await expect(root().getByRole("button", { name: "تحديث الحالات", exact: true })).toBeEnabled(); await queueUI(result); return result;
  }
  async function reconcile() {
    await settings();
    const preview = await api("POST", () => main().getByRole("button", { name: "معاينة الفحص", exact: true }).click(), { path: "/api/admin/media-library", operation: "reconcile" });
    assert.equal(preview.dryRun, true); assert.equal(preview.complete, true);
    await main().getByRole("button", { name: "تنفيذ الفحص والمزامنة", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "تنفيذ الفحص والمزامنة؟", exact: true });
    const result = await api("POST", () => dialog.locator("[data-admin-confirm-submit]").click(), { path: "/api/admin/media-library", operation: "reconcile" });
    assert.equal(result.dryRun, false); assert.equal(result.complete, true); await expect(dialog).toHaveCount(0);
  }
  async function library(name = fixture.namespace) {
    await navigate("/admin/media-library?q=" + encodeURIComponent(name));
    return api("GET", () => main().getByRole("button", { name: "كل الملفات", exact: true }).click(), { path: "/api/admin/media-library", queryMatch: { q: name, folder: null } });
  }
  async function selectAsset(asset) {
    const data = await library(asset.display_name); assert.ok(data.assets.some(row => row.id === asset.id));
    const button = assetButton(main(), asset.display_name); await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  const articleChannel = () => page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="form:content:article"]');
  const articleFeedback = () => articleChannel().filter({ hasText: "تم حفظ الموضوع مع تنبيه للميديا" });
  async function saveArticle(warning = false) {
    const [response] = await Promise.all([actionResponse(), page.locator('form[data-admin-form-runtime] button[data-admin-form-action="save"]').click()]);
    assertActionAcknowledged(response);
    if (warning) await expect(articleFeedback()).toHaveAttribute("data-admin-feedback-variant", "warning");
    else await expect(articleChannel()).toHaveAttribute("data-admin-feedback-variant", /^(success|warning)$/u);
    await expect(page.locator('form[data-admin-form-runtime] button[data-admin-form-action="save"]')).toBeEnabled();
  }
  const card = target => root().locator("article").filter({ has: page.getByText(target.assetLabel, { exact: true }) }).filter({ hasText: target.kind === "write_lease" ? "عملية حفظ" : target.kind === "delete_reservation" ? "حجز حذف" : "أصل يحتاج تحققًا" });
  async function recoveryAction(target, action, outcome = "verified", expectedStatus = 200) {
    const before = await snapshot(action + "-before"), row = card(target); await expect(row).toHaveCount(1);
    assert.ok(target.allowedActions.includes(action));
    const button = row.getByRole("button", { name: labels[action], exact: true });
    let actionFeedback;
    if (confirmations.has(action)) {
      await button.click();
      let dialog = page.getByRole("dialog", { name: labels[action] + "؟", exact: true });
      await dialog.locator("[data-admin-confirm-cancel]").click(); await expect(dialog).toHaveCount(0);
      assertCoreRecoveryDomainUnchanged(before, await snapshot(action + "-cancel"), true);
      await button.click(); dialog = page.getByRole("dialog", { name: labels[action] + "؟", exact: true });
      let result;const perform=async()=>{result=await api("POST", () => dialog.locator("[data-admin-confirm-submit]").click(), { action, status: expectedStatus });};
      if(expectedStatus===200)actionFeedback=await observeCoreVisibleAcceptedFeedback({page,channel:"media-settings-recovery",perform});else await perform();
      if (expectedStatus === 200) {
        assert.equal(result.ok, true); assert.equal(result.auditWarning, null); await expect(dialog).toHaveCount(0);
      } else {
        assert.equal(result.code, "media_delete_storage_existence_not_proven");
        await expect(dialog).toBeVisible(); await expect(dialog.locator("[data-admin-confirm-submit]")).toBeEnabled();
        await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "danger");
        await dialog.locator("[data-admin-confirm-cancel]").click();
      }
    } else {
      let result;actionFeedback=await observeCoreVisibleAcceptedFeedback({page,channel:"media-settings-recovery",perform:async()=>{result=await api("POST", () => button.click(), { action });}});
      assert.equal(result.ok, true); assert.equal(result.mutated, false); assert.equal(result.auditWarning, null);
      assert.deepEqual(result.verification.uncertainties, []);
    }
    const after = await snapshot(action + "-after");
    assertCoreRecoveryAudit(before, after, target, action, outcome);
    if (outcome !== "mutated") assertCoreRecoveryDomainUnchanged(before, after);
    if (expectedStatus === 200) {verifiedActions.add(action);acceptedFeedback.push({action,targetId:target.id,nativeBefore:before.id,nativeAfter:after.id,feedback:actionFeedback});}
    return after;
  }
  async function faulted(scenario, trigger) {
    const token = randomUUID();
    const command = async suffix => {
      const request = { id: randomUUID(), kind: "media-recovery-fault-" + suffix, scenario, token };
      const value = await observe("recovery-fault-" + suffix, () => recoveryCheckpoint(request));
      for (const key of ["id", "kind", "scenario", "token"]) assert.equal(value[key], request[key]); assert.equal(value.status, "pass");
      return value;
    };
    await command("arm");
    try {
      await trigger();
      if (scenario !== "lease") {
        const switched = await command("switch");
        if (scenario === "cancel") assert.equal(switched.storageCancelled?.cancellationAcknowledged, true);
      }
      const cancelled = await command("cancel"); assert.equal(cancelled.cancellationAcknowledged, true);
      if (scenario === "lease") assert.equal(cancelled.domainCommitVerified, true);
    } finally { const released = await command("release"); assert.equal(released.activeLocks, 0); assert.equal(released.ownedTransactionsRolledBack, true); }
  }
  const group = (name, execute) => run("core-media-recovery-" + name, [], execute);
  const done = (name, fields) => { const result = { name, consumer: "media-recovery-queue", ...fields, automaticCoverage: [] }; completed.push(result); return result; };
  try {
    if(selection===CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION||selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION){
      // Official authenticated API setup only; none of the retained three UI operations receives credit.
      const call=async (options,status)=>{const response=await page.request.post(origin+'/api/admin/media-library',{...options,maxRedirects:0,timeout:60_000});try{assert.equal(response.status(),status);const data=await response.json();assert.equal(data.error,undefined);return data;}finally{await response.dispose();}};
      for(const dryRun of[true,false]){const data=await call({data:{operation:'reconcile',dryRun}},200);assert.equal(data.dryRun,dryRun);assert.equal(data.complete,true);}
      const folder='images/'+fixture.namespace,created=await call({data:{operation:'create_folder',folder,displayName:fixture.namespace}},201);assert.equal(created.created,true);assert.equal(created.folder.path,folder);assert.equal(created.folder.displayName,fixture.namespace);const apiAssets=[];
      const bytes=coreMediaSyntheticPng();for(const role of['lease','finalize','missing','cancel']){const uploaded=await call({multipart:{file:{name:fixture.namespace+'-'+role+'.png',mimeType:'image/png',buffer:bytes},folder,kind:'image'}},201);assert.match(uploaded.asset.id,/^[a-f0-9-]{36}$/iu);assert.equal(uploaded.asset.displayName,fixture.namespace+'-'+role+'.png');assert.equal(uploaded.asset.folderPath,folder);assert.equal(uploaded.asset.catalogRegistered,true);apiAssets.push(uploaded.asset);}
      const request={id:randomUUID(),kind:'media-recovery-followup-prepare'};prerequisite=await observe('recovery-uncredited-owned-prerequisite',()=>recoveryCheckpoint(request));assert.equal(prerequisite.id,request.id);assert.equal(prerequisite.kind,request.kind);assert.equal(prerequisite.status,'pass');assert.equal(prerequisite.namespace,fixture.namespace);assert.equal(prerequisite.articleId,fixture.article.id);assert.equal(prerequisite.selection,selection);assert.equal(prerequisite.uiCredit,false);assert.equal(prerequisite.purpose,'uncredited-owned-fixture-prerequisite');assert.equal(prerequisite.globalClosed,false);assert.deepEqual(prerequisite.automaticCoverage,[]);
      assert.equal(new Set(apiAssets.map(a=>a.id)).size,4);assert.equal(prerequisite.assets.length,4);for(const actual of apiAssets){const rows=prerequisite.assets.filter(a=>a.id===actual.id);assert.equal(rows.length,1);for(const [api,db]of Object.entries({id:'id',provider:'provider',bucket:'bucket',objectKey:'object_key',publicUrl:'public_url',originalFilename:'original_filename',displayName:'display_name',kind:'media_kind',mimeType:'mime_type',sizeBytes:'byte_size',width:'width',height:'height',checksum:'checksum',folderPath:'folder_path',status:'status',uploadedBy:'uploaded_by',reconciliationState:'reconciliation_state',missingObject:'missing_object'})){const value=rows[0][db],expected=['sizeBytes','width','height','uploadedBy'].includes(api)&&value!==null?Number(value):value;if(typeof expected==='number')assert.ok(Number.isSafeInteger(expected));assert.deepEqual(actual[api],expected);}}
      if(selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION){assertCoreMediaRecoveryPermissionHistory(fixtures.mediaRecoveryHistoricalPermission);await reconcile();}
    }else{
    await group("prepare", async () => {
      const before = await snapshot("initial"), initial = await settings();
      assert.equal(assertCoreRecoveryQueue(initial, before).length, 0);
      await reconcile();
      await navigate("/admin/media-library?q=" + encodeURIComponent(fixture.namespace));
      await expect(main().getByRole("button", { name: "+ جديد", exact: true })).toBeVisible();
      await main().getByRole("button", { name: "+ جديد", exact: true }).click();
      await main().getByPlaceholder("اسم المجلد", { exact: true }).fill(fixture.namespace);
      await api("POST", () => main().getByRole("button", { name: "إنشاء داخل images", exact: true }).click(), { path: "/api/admin/media-library", operation: "create_folder", status: 201 });
      await api("GET", () => main().getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ hasText: fixture.namespace }).click(), { path: "/api/admin/media-library", queryMatch: { folder: "images/" + fixture.namespace } });
      const uploads = [], listener = response => { if (new URL(response.url()).pathname === "/api/admin/media-library" && response.request().method() === "POST") uploads.push(response); };
      page.on("response", listener);
      try {
        await main().locator('input[type="file"][multiple]').setInputFiles(["lease", "finalize", "missing", "cancel"].map(scenario => ({ name: fixture.namespace + "-" + scenario + ".png", mimeType: "image/png", buffer: png })));
        await expect.poll(() => uploads.length, { timeout: 60_000 }).toBe(4);
        for (const response of uploads) { assert.equal(response.status(), 201); assert.ok((await response.json()).asset.id); }
        await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="media-library"]')).toHaveAttribute("data-admin-feedback-variant", "success");
        await expect(main().getByRole("button", { name: "رفع ملفات", exact: true })).toBeEnabled();
      } finally { page.off("response", listener); }
      const uploaded = await snapshot("uploaded"); assert.equal(uploaded.assets.length, 4);
      for (const asset of uploaded.assets) { assertCoreMediaAsset(uploaded, asset.id, { status: "active" }); assert.equal(asset.checksum, createHash("sha256").update(png).digest("hex")); }
      const lease = uploaded.assets.find(row => row.display_name.endsWith("-lease.png")); assert.ok(lease);
      await navigate(fixture.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
      await imageField().getByRole("button").first().click();
      const picker = page.getByRole("dialog", { name: "اختيار صورة من المكتبة", exact: true });
      const folders = await api("GET", () => search(picker).fill(fixture.namespace + "-picker"), { path: "/api/admin/media-library", queryMatch: { q: fixture.namespace + "-picker" } });
      const images = folders.folders.find(row => row.path === "images"); assert.ok(images);
      await api("GET", () => picker.getByRole("navigation", { name: "مجلدات الوسائط", exact: true }).getByRole("button").filter({ has: page.getByText(images.displayName, { exact: true }) }).click(), { path: "/api/admin/media-library", queryMatch: { folder: "images" } });
      await api("GET", () => search(picker).fill(lease.display_name), { path: "/api/admin/media-library", queryMatch: { q: lease.display_name } });
      await assetButton(picker, lease.display_name).click(); await picker.getByRole("button", { name: "تأكيد الاختيار", exact: true }).click();
      await page.locator('[name="image_alt"]').fill("QA recovery synthetic image"); await saveArticle();
      await page.reload({ waitUntil: "domcontentloaded" }); await page.locator('[data-admin-tab-id="basic"]').click();
      await expect(imageField().locator('input[name="image"]')).toHaveValue(lease.public_url);
      const saved = await snapshot("image-saved"); assert.equal(saved.article.image, lease.public_url);
      assert.equal(saved.references.filter(row => row.asset_id === lease.id && row.field_key === "image" && String(row.entity_identity) === String(saved.articleId)).length, 1);
      return done("prepare", { assets: 4, ownedQueueInitiallyEmpty: true, globalQueueInitiallyEmpty: initial.items.length === 0 });
    });
    await group("queue-fetch-retry", async () => {
      const before = await snapshot("queue-fetch-before"), prior = await settings();
      const fault = createCoreRecoveryQueueReadFault(origin), remove = await registerCorePageRoute(page, origin + endpoint, fault.handle);
      try {
        await root().getByRole("button", { name: "تحديث الحالات", exact: true }).click();
        await expect(feedback()).toHaveAttribute("data-admin-feedback-variant", "danger");
        await expect(feedback()).toContainText("تعذر تحميل حالات الميديا");
        await expect(root().getByRole("button", { name: "تحديث الحالات", exact: true })).toBeEnabled();
        await queueUI(prior);
      } finally { await remove(); }
      fault.assertConsumed(); assertCoreRecoveryDomainUnchanged(before, await snapshot("queue-fetch-failed"), true);
      const retry = await refresh(); assertCoreRecoveryQueue(retry, before); await queueUI(retry);
      assertCoreRecoveryDomainUnchanged(before, await snapshot("queue-fetch-retried"), true);
      return done("queue-fetch-retry", { preDeliveryReadFailure: true, priorQueuePreserved: true, busyReleased: true, realRefreshRetry: true, domainAndAuditUnchanged: true });
    });
    await group("committed-lease-warning", async () => {
      const before = await snapshot("lease-before"); assert.equal(before.assets.length, 4);
      await navigate(fixture.article.editPath); await page.locator('[data-admin-tab-id="basic"]').click();
      await page.locator('[name="title"]').fill("QA Media Recovery committed title");
      const response = actionResponse(); response.catch(() => {});
      await faulted("lease", () => page.locator('form[data-admin-form-runtime] button[data-admin-form-action="save"]').click());
      assertActionAcknowledged(await response);
      await expect(articleFeedback()).toHaveAttribute("data-admin-feedback-variant", "warning", { timeout: 60_000 });
      await expect(articleFeedback()).toContainText("تم حفظ بيانات الموضوع");
      await expect(page.locator('button[data-admin-form-action="save"]')).toBeEnabled();
      await page.reload({ waitUntil: "domcontentloaded" }); await page.locator('[data-admin-tab-id="basic"]').click();
      await expect(page.locator('[name="title"]')).toHaveValue("QA Media Recovery committed title");
      const after = await snapshot("lease-warning");
      assert.equal(after.article.title, "QA Media Recovery committed title"); assert.equal(after.article.image, before.article.image);
      const failed = after.leases.filter(row => row.status === "failed" && row.resolved_at === null);
      assert.equal(failed.length, 1); assert.equal(failed[0].domain_write_committed, true);
      const oldAudits = new Set(before.audits.map(row => String(row.id)));
      const topicAudits = after.audits.filter(row => !oldAudits.has(String(row.id)) && row.entity_type === "topic" && String(row.entity_id) === String(after.articleId));
      assert.equal(topicAudits.length, 1); assert.equal(Number(topicAudits[0].actor_admin_user_id), after.qaActorId);
      const queue = await settings(), items = assertCoreRecoveryQueue(queue, after), lease = items.find(row => row.kind === "write_lease" && row.id === failed[0].lease_token);
      assert.ok(lease); assert.deepEqual(lease.allowedActions, []);
      await expect(card(lease).getByRole("button", { name: labels.resolve_write_lease, exact: true })).toHaveCount(0);
      return done("committed-lease-warning", { domainCommit: true, warning: true, unresolvedLease: true, resolutionBeforeReconciliationBlocked: true });
    });
    }
    await group("resolve-lease", async () => {
      await reconcile();
      const before = await snapshot("lease-reconciled"), queue = await refresh();
      const target = assertCoreRecoveryQueue(queue, before).find(row => row.kind === "write_lease");
      assert.ok(target); assert.ok(target.allowedActions.includes("resolve_write_lease"));
      const after = await recoveryAction(target, "resolve_write_lease", "mutated");
      const rows = after.leases.filter(row => row.lease_token === target.id); assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "reconciled"); assert.ok(rows[0].resolved_at);
      assert.equal(after.article.title, "QA Media Recovery committed title");
      assert.equal(assertCoreRecoveryQueue(await refresh(), after).some(row => row.kind === "write_lease" && row.id === target.id), false);
      return done("resolve-lease", { confirmedAfterNewerReconciliation: true, cancelNoWrite: true, exactActorAudits: true });
    });
    await group("produce-existing-object-reservation", async () => {
      const before = await snapshot("cancel-before"), asset = before.assets.find(row => row.display_name.endsWith("-cancel.png")); assert.ok(asset);
      assertCoreMediaAsset(before, asset.id, { status: "active" });
      await selectAsset(asset); await main().getByRole("button", { name: /^حذف آمن \(/u }).click();
      const dialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true });
      const response = page.waitForResponse(result => matchesCoreMediaResponse(result, origin, "DELETE"), { timeout: 60_000 }); response.catch(() => {});
      await faulted("cancel", () => dialog.locator("[data-admin-confirm-submit]").click());
      const actual = await response; assert.equal(actual.status(), 503);
      const body = await actual.json(); assert.equal(body.code, "media_delete_storage_failed");
      assert.equal(body.workflow.repairRequired, true); assert.equal(body.workflow.recoveryState, "deleting");
      await expect(dialog).toBeVisible(); await expect(dialog.locator("[data-admin-confirm-submit]")).toBeEnabled();
      await dialog.locator("[data-admin-confirm-cancel]").click();
      const after = await snapshot("cancel-produced"); assertCoreMediaAsset(after, asset.id, { status: "deleting" });
      assert.deepEqual(after.objects.filter(row => row.bucket_id === asset.bucket && row.name === asset.object_key), before.objects.filter(row => row.bucket_id === asset.bucket && row.name === asset.object_key));
      const rows = after.reservations.filter(row => row.asset_id === asset.id && row.status === "reserved"); assert.equal(rows.length, 1);
      const reservation = rows[0]; assert.ok(assertCoreRecoveryReservationAge(after, reservation) < 60_000, "The age starts at a genuinely new reservation.");
      assert.equal(after.references.some(row => row.asset_id === asset.id), false);
      assert.equal(after.leases.some(row => row.asset_id === asset.id), false);
      const initial = assertCoreRecoveryQueue(await settings(), after); assert.equal(initial.some(row => row.id === reservation.id), false);
      pendingCancellation = { assetId: asset.id, reservationId: reservation.id, startedAt: reservation.started_at, checksum: asset.checksum, publicUrl: asset.public_url, originalObject: before.objects.find(row => row.bucket_id === asset.bucket && row.name === asset.object_key) };
      return done("produce-existing-object-reservation", { actualStorageAndCompensationFailures: true, reservation: "reserved", objectBytesPreserved: true, earlyQueueHidden: true, reservationStartedAt: reservation.started_at });
    });
    for (const scenario of ["finalize", "missing"]) {
      await group("produce-" + scenario, async () => {
        // A real complete reconciliation already preceded the reserved fourth asset; per-target guards remain active.
        const before = await snapshot(scenario + "-before");
        const asset = before.assets.find(row => row.display_name.endsWith("-" + scenario + ".png")); assert.ok(asset);
        await selectAsset(asset);
        await main().getByRole("button", { name: /^حذف آمن \(/u }).click();
        const dialog = page.getByRole("dialog", { name: "حذف الأصول المحددة؟", exact: true });
        const response = page.waitForResponse(result => matchesCoreMediaResponse(result, origin, "DELETE"), { timeout: 60_000 }); response.catch(() => {});
        await faulted(scenario, () => dialog.locator("[data-admin-confirm-submit]").click());
        const actual = await response; assert.equal(actual.status(), 503);
        const body = await actual.json(); assert.equal(body.code, "media_delete_finalization_failed"); assert.equal(body.workflow.repairRequired, true);
        await expect(dialog).toBeVisible(); await expect(dialog.locator("[data-admin-confirm-submit]")).toBeEnabled();
        await dialog.locator("[data-admin-confirm-cancel]").click();
        const after = await snapshot(scenario + "-produced");
        const reservations = after.reservations.filter(row => row.asset_id === asset.id && row.status === "recovery_required"); assert.equal(reservations.length, 1);
        assert.equal(after.assets.find(row => row.id === asset.id).status, "missing");
        assert.equal(after.objects.some(row => row.bucket_id === asset.bucket && row.name === asset.object_key), false);
        assert.equal(after.binaries.find(row => row.publicUrl === asset.public_url).missing, true);
        const target = assertCoreRecoveryQueue(await settings(), after).find(row => row.kind === "delete_reservation" && row.id === reservations[0].id);
        assert.ok(target); await expect(card(target)).toBeVisible();
        return done("produce-" + scenario, { actualFinalizationFault: true, reservationRecoveryRequired: true, physicalObjectAbsent: true });
      });
      await group("repair-" + scenario, async () => {
        let state = await snapshot(scenario + "-repair-before"), queue = await settings();
        const asset = state.assets.find(row => row.display_name.endsWith("-" + scenario + ".png")); assert.ok(asset);
        let target = assertCoreRecoveryQueue(queue, state).find(row => row.kind === "delete_reservation" && row.assetId === asset.id); assert.ok(target);
        for (const action of ["retry_verification", "preview_scoped_reconciliation"]) {
          state = await recoveryAction(target, action); queue = await refresh();
          target = assertCoreRecoveryQueue(queue, state).find(row => row.kind === "delete_reservation" && row.assetId === asset.id); assert.ok(target);
        }
        await recoveryAction(target, "cancel_reservation", "blocked", 409);
        const action = scenario === "finalize" ? "retry_finalization" : "confirm_missing";
        state = await recoveryAction(target, action, "mutated");
        const reservation = state.reservations.find(row => row.id === target.id); assert.ok(reservation);
        assert.equal(reservation.status, scenario === "finalize" ? "completed" : "missing_confirmed");
        assert.equal(state.assets.find(row => row.id === asset.id).status, scenario === "finalize" ? "deleted" : "missing");
        assert.equal(state.binaries.find(row => row.publicUrl === asset.public_url).missing, true);
        const remaining = assertCoreRecoveryQueue(await refresh(), state);
        assert.equal(remaining.some(row => row.kind === "delete_reservation" && row.id === target.id), false);
        if (scenario === "missing") {
          let standalone = remaining.find(row => row.kind === "asset" && row.assetId === asset.id); assert.ok(standalone);
          assert.deepEqual([...standalone.allowedActions].sort(), ["preview_scoped_reconciliation", "retry_verification"]);
          for (const check of ["retry_verification", "preview_scoped_reconciliation"]) {
            state = await recoveryAction(standalone, check);
            standalone = assertCoreRecoveryQueue(await refresh(), state).find(row => row.kind === "asset" && row.assetId === asset.id); assert.ok(standalone);
          }
        }
        return done("repair-" + scenario, { readOnlyDomainChecks: true, missingCancelRefused: true, terminalState: reservation.status, standaloneAssetChecks: scenario === "missing" });
      });
    }
    await group("repair-existing-object-reservation", async () => {
      assert.ok(pendingCancellation, "The actual compensation failure must complete first.");
      let state, reservation, target;
      while (true) {
        state = await snapshot("cancel-real-age");
        reservation = state.reservations.find(row => row.id === pendingCancellation.reservationId);
        assert.ok(reservation); assert.equal(reservation.status, "reserved"); assert.equal(reservation.started_at, pendingCancellation.startedAt);
        const age = assertCoreRecoveryReservationAge(state, reservation);
        assertCoreMediaAsset(state, pendingCancellation.assetId, { status: "deleting", checksum: pendingCancellation.checksum });
        const queue = await settings(); target = assertCoreRecoveryQueue(queue, state).find(row => row.kind === "delete_reservation" && row.id === reservation.id);
        if (target) {
          state = await snapshot("cancel-age-visible"); reservation = state.reservations.find(row => row.id === pendingCancellation.reservationId);
          assert.ok(reservation); assert.equal(reservation.started_at, pendingCancellation.startedAt); assertCoreRecoveryReservationAge(state, reservation, true);
          break;
        }
        await observe("recovery-real-age-wait", () => page.waitForTimeout(Math.min(30_000, Math.max(250, 10 * 60_000 - age + 100))));
      }
      assert.ok(target.allowedActions.includes("cancel_reservation"));
      const after = await recoveryAction(target, "cancel_reservation", "mutated");
      const cancelled = after.reservations.find(row => row.id === reservation.id); assert.ok(cancelled); assert.equal(cancelled.status, "cancelled");
      assert.equal(cancelled.started_at, pendingCancellation.startedAt);
      assertCoreMediaAsset(after, pendingCancellation.assetId, { status: "active", reconciliation_state: "synced", missing_object: false, checksum: pendingCancellation.checksum });
      assert.ok(after.objects.some(row => row.id === pendingCancellation.originalObject.id));
      assert.equal(after.binaries.find(row => row.publicUrl === pendingCancellation.publicUrl).sha256, pendingCancellation.checksum);
      assert.equal(assertCoreRecoveryQueue(await refresh(), after).some(row => row.id === target.id), false);
      return done("repair-existing-object-reservation", { realAgeMs: assertCoreRecoveryReservationAge(state, reservation, true), cancelNoWrite: true, confirmedCancel: true, unchangedObjectIdentityAndBytes: true, exactActorAudits: true });
    });
    await group("permission", async () => {
      const historical=selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION?assertCoreMediaRecoveryPermissionHistory(fixtures.mediaRecoveryHistoricalPermission):[];const historicalActions=new Set(historical.map(r=>r.action));
      for (const action of ["retry_verification", "preview_scoped_reconciliation", "resolve_write_lease", "retry_finalization", "confirm_missing", "cancel_reservation"]) {
        assert.ok((verifiedActions.has(action)&&specimens.some(row=>row.action===action))||historicalActions.has(action),"Actual current or independently qualified original native-backed action is mandatory.");
      }
      assert.ok(specimens.some(row => row.action === "GET"));
      for(const prior of historical){assert.equal(specimens.some(r=>r.action===prior.action),false);const body=Buffer.from(prior.body);specimens.push({action:prior.action,url:origin+endpoint,method:prior.method,headers:{"content-type":"application/json",origin},body,sha256:prior.bodySha256,provenance:prior.provenance});}
      const denialReceipts=[];
      const before = await snapshot("permission-before"), client = await http.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        for (const specimen of specimens) {
          assert.equal(createHash("sha256").update(specimen.body).digest("hex"), specimen.sha256);
          assert.equal(new URL(specimen.url).origin, origin); assert.equal(new URL(specimen.url).pathname, endpoint);
          const response = await client.fetch(specimen.url, { method: specimen.method, headers: specimen.headers, ...(specimen.method === "GET" ? {} : { data: specimen.body }), maxRedirects: 0, timeout: 30_000 });
          assert.equal(response.status(), 401); assert.equal((await response.json()).error, "Unauthorized");denialReceipts.push({action:specimen.action,method:specimen.method,requestBodySha256:specimen.sha256,status:401,error:"Unauthorized",provenance:specimen.provenance??"captured-current-request"}); await response.dispose();
        }
      } finally { await client.dispose(); }
      assertCoreRecoveryDomainUnchanged(before, await snapshot("permission-after"), true);
      return done("permission", { actualCookieFreeAuthBoundary: true, unchangedAllPublicAndStorage: true, uiDenialClaim: false, ...(selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION?{denialReceipts,currentRequestProofs:specimens.filter(r=>r.provenance===undefined).map(r=>({action:r.action,path:new URL(r.url).pathname,method:r.method,body:r.body.toString("utf8"),bodySha256:r.sha256,provenance:"captured-current-request"})),historicalPermission:fixtures.mediaRecoveryHistoricalPermission}: {}) });
    });
  } finally { for (const specimen of specimens) specimen.body.fill(0); }
  return { acceptedFeedback, completed, checkpoints, relatedRequiredCases, ...((selection===CORE_MEDIA_RECOVERY_FOLLOWUP_SELECTION||selection===CORE_MEDIA_RECOVERY_MISSING_SELECTION)?{prerequisite}:{}), automaticCoverage: [], globalClosed: false,
    open: ["Active expired lease, queue truncation and missing-schema branches are not proved by these cases."] };
}
