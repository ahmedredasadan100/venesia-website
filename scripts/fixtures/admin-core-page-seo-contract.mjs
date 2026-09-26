import assert from "node:assert/strict";
export const PAGE_SEO_PHASES = Object.freeze(["before", "rejected", "saved", "reloaded"]);
export const PAGE_SEO_RECIPE = Object.freeze({
 seo_title: "إعدادات سيو الصفحة لاختبار الحفظ والتحقق",
 seo_description: "إعدادات سيو الصفحة تصف محتوى الصفحة المركب وتثبت حفظ العنوان والوصف والكلمات المفتاحية والإعدادات الاختيارية من خلال المالك الحالي.",
 focus_keyword: "إعدادات سيو الصفحة", seo_keywords: Object.freeze(["سيو الصفحة", "محتوى مركب"]),
 canonical_url: "https://example.invalid/qa-core-page-seo", robots_index: false, robots_follow: null,
});
export const PAGE_SEO_INVALID_CANONICAL = "ftp://example.invalid/qa-core-page-seo";
export function assertPageSeoScope(manifest) {
 const entries = manifest.filter(row => row.id === "page-composition-and-seo"); assert.equal(entries.length, 1);
 const entry = entries[0]; assert.equal(entry.classification, "specialized_exception"); assert.ok(entry.surfaces.includes("seo"));
 assert.ok(entry.exceptionContract.lowerLevelSharedCapabilities.includes("busy_state"));
 assert.ok(entry.exceptionContract.lowerLevelSharedCapabilities.includes("feedback"));
 return { consumer: entry.id, surface: "seo", automaticCoverage: [], genericDraftPreservationClaim: false };
}
export function summarizePageSeoRejection(before, authored, after) {
 const fields = Object.keys(PAGE_SEO_RECIPE), observations = fields.map(field => ({field,
  authoredRetained: JSON.stringify(after[field]) === JSON.stringify(authored[field]),
  persistedReloaded: JSON.stringify(after[field]) === JSON.stringify(before[field])}));
 // Redirect forms have a specialized lifecycle. Observation does not promote a rollback axis.
 return { observations, classification: observations.every(row=>row.authoredRetained) ? "authored-draft-retained" : observations.every(row=>row.persistedReloaded) ? "persisted-values-reloaded" : "mixed-field-lifecycle",
  genericDraftPreservationClaim: false };
}
export function assertPageSeoEvidence(before, after, phase) {
 assert.ok(PAGE_SEO_PHASES.includes(phase) && phase !== "before");
 for (const key of ["ownedRunId", "pageId", "actorId", "otherPagesHash", "compositionHash", "assignedTemplatesHash", "semanticContentHash"]) assert.deepEqual(after[key], before[key], "SEO must not change " + key);
 if (phase === "rejected") { assert.deepEqual(after.page, before.page); assert.deepEqual(after.audit, before.audit); return; }
 const omit = row => Object.fromEntries(Object.entries(row).filter(([key])=> ![...Object.keys(PAGE_SEO_RECIPE), "og_image", "og_image_alt", "seo_score", "seo_score_version", "seo_score_input_hash", "updated_at"].includes(key)));
 assert.deepEqual(omit(after.page), omit(before.page), "All target non-SEO fields must remain identical.");
 for (const [key, value] of Object.entries(PAGE_SEO_RECIPE)) assert.deepEqual(after.page[key], value, "Persisted SEO differs: " + key);
 assert.equal(after.page.og_image, String(before.page.og_image ?? "").trim() || null);
 assert.equal(after.page.og_image_alt, String(before.page.og_image_alt ?? "").trim(), "Untouched OG fields use the existing parser's null/empty normalization only.");
 for (const key of ["seo_score", "seo_score_version", "seo_score_input_hash"]) assert.equal(after.page[key], after.expectedScore[key], "Canonical composition score differs: " + key);
 assert.deepEqual(after.audit.slice(0, before.audit.length), before.audit);
 assert.equal(after.audit.length, before.audit.length + 1);
 const entry = after.audit.at(-1); assert.equal(entry.action,"page.update"); assert.equal(entry.entity_type,"page"); assert.equal(Number(entry.entity_id), before.pageId); assert.equal(Number(entry.actor_admin_user_id), before.actorId);
 assert.equal(entry.metadata.scope,"page_seo"); assert.equal(entry.metadata.score,after.page.seo_score); assert.equal(entry.metadata.scoreVersion,after.page.seo_score_version);
}
/** Join named executed SEO evidence to all four native snapshots and its single released hold. */
export function assertPageSeoReceiptJoin(browser, native, cleanup, completion) {
 assert.equal(browser.status,"pass");assert.equal(browser.driverCompleted,true);assert.deepEqual(browser.errors,[]);assert.equal(browser.cohort,"page-composition");
 assert.equal(native.status,"pass");assert.equal(completion.status,"pass");assert.deepEqual(completion.phases,PAGE_SEO_PHASES);assert.equal(completion.exactWrites,1);assert.equal(completion.nativeCheckpoints,4);
 const matches=browser.evidence.filter(row=>row.id==="core-page-composition-seo-reject-retry-reload");assert.equal(matches.length,1);const row=matches[0];assert.equal(row.status,"pass");assert.equal(row.consumer,"page-composition-and-seo");assert.equal(row.surface,"seo");
 assert.deepEqual(row.automaticCoverage,[]);assert.deepEqual(row.coverage,[]);assert.equal(row.genericDraftPreservationClaim,false);assert.equal(row.rejectionUi.genericDraftPreservationClaim,false);
 assert.equal(row.nativeCheckpoints,4);assert.equal(row.exactWrites,1);assert.deepEqual(row.nativePhases,PAGE_SEO_PHASES);
 const snapshots=native.records.filter(item=>item.kind==="page-composition-state"&&item.seo);assert.equal(snapshots.length,4);assert.deepEqual(snapshots.map(item=>item.seo.phase),PAGE_SEO_PHASES);assert.deepEqual(snapshots.map(item=>item.id),row.checkpoints);
 for(const item of snapshots){assert.equal(item.status,"pass");assert.equal(item.seo.status,"pass");assert.equal(item.pageId,completion.pageId);assert.equal(item.qaActorId,completion.actorId);assert.equal(item.ownedRunId,native.ownedRunId);}
 for(const [index,item]of snapshots.entries()){assert.equal(item.seo.exactWrites,index<2?0:1);assert.equal(item.seo.canonicalScoreVerified,index>=2);assert.equal(item.seo.auditIds.length,index<2?0:1);}
 assert.deepEqual(snapshots[3].seo.auditIds,snapshots[2].seo.auditIds);
 const faults=native.records.filter(item=>String(item.kind).startsWith("domain-write-fault-"));assert.equal(faults.length,4);assert.deepEqual(faults.map(item=>item.id),row.faultReceipts);assert.deepEqual(faults.map(item=>item.kind),["arm","observe-blocked","observe-blocked","release"].map(kind=>"domain-write-fault-"+kind));
 for(const item of faults){assert.equal(item.status,"pass");assert.equal(item.entity,"pages");assert.equal(item.token,row.faultToken);}
 for(const key of["backendPid","backendStartedAt","queryStartedAt","queryFingerprint","holderPid"])assert.ok(faults[1][key]!==undefined&&faults[1][key]===faults[2][key]);
 assert.equal(faults[1].observedOneStatement,true);assert.equal(faults[2].observedOneStatement,true);assert.equal(faults[3].ownedLockRolledBack,true);assert.equal(faults[3].cancellationObserved,false);
 assert.ok(native.records.every(item=>item.status==="pass"&&(item.kind==="page-composition-state"||faults.includes(item))));
 assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);assert.deepEqual(cleanup.records,faults);
 for(const key of["nativeStatementObservedTwice","sameStatementIdentity","normalKeyboardDedup","fieldsDisabledAndInert","ownedLockReleased"])assert.equal(row.pending[key],true);assert.equal(row.pending.actionRequests,1);
 return{...completion,joinedNativeReceipts:row.checkpoints,joinedFaultReceipts:row.faultReceipts,rejectionUi:row.rejectionUi,automaticCoverage:[],globalClosed:false};
}
