import { assertCorePresentationControlsCompleted } from "./verify-admin-core-presentation-controls-isolated.mts";
import { PRESENTATION_CONTROL_PHASES } from "./fixtures/admin-core-presentation-controls-contract.mjs";
import { assertCoreProjectControlsCompleted } from "./verify-admin-core-project-controls-isolated.mts";
import { PROJECT_CONTROL_PHASES } from "./fixtures/admin-core-project-controls-contract.mjs";
import { assertCoreTopicControlsCompleted } from "./verify-admin-core-topic-controls-isolated.mts";
import { verifyCoreDomainBulkCompletion } from "./verify-admin-core-domain-bulk-isolated.mts";
import { assertCoreTemplateControlsCompleted } from "./verify-admin-core-template-controls-isolated.mts";
import { assertOwnedCoreMediaCheckpointCompletion } from "./verify-admin-core-media-isolated.mts";
import { assertOwnedCoreMediaRecoveryCompletion } from "./verify-admin-core-media-recovery-isolated.mts";
import { verifyCoreQueryPresentationCompletion } from "./verify-admin-core-query-presentation-isolated.mts";
import { assertCoreAuthEntryCompleted } from "./verify-admin-core-auth-entry-isolated.mts";
import { assertCoreNavigationSettingsCompleted, NAVIGATION_SETTINGS_PHASES, CORE_NAVIGATION_RECIPE } from "./verify-admin-core-navigation-settings-isolated.mts";
import assert from "node:assert/strict";
import { assertCorePageSeoCompleted } from "./verify-admin-core-page-seo-isolated.mts";
import { assertPageSeoReceiptJoin } from "./fixtures/admin-core-page-seo-contract.mjs";
import { assertCoreSpecializedSettingsCompleted } from "./verify-admin-core-specialized-settings-isolated.mts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { assertCoreFormDraftRestorationJoin } from "./fixtures/admin-core-form-draft-restoration.mjs";
import { join } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

import { assertCoreAuditActor, readCoreFixedQaActor, verifyCoreDomainWrites } from "./verify-admin-core-domain-readback-isolated.mts";

import { verifyCoreReadonlyReadback } from "./verify-admin-core-readonly-isolated.mts";


type MediaJoinRow = Record<string, unknown> & { id?: string; status?: string; kind?: string; name?: string; group?: string; consumer?: string; label?: string; scenario?: string; token?: string; activeLocks?: number; ownedTransactionsRolledBack?: boolean; cancellationAcknowledged?: boolean };
type MediaJoinResult = { completed: MediaJoinRow[]; checkpoints: MediaJoinRow[]; automaticCoverage: unknown[]; globalClosed: boolean };
type MediaJoinBrowser = { status: string; driverCompleted?: boolean; errors?: unknown[]; scope?: string; cohort?: string; evidence: MediaJoinRow[]; media?: MediaJoinResult; mediaRecovery?: MediaJoinResult };
type MediaJoinNative = MediaJoinRow & { records: MediaJoinRow[] };
/** Named executed groups plus exact native request identities; never automatic capability credit. */
export function assertCoreMediaCompletionReceipts(handle: OwnedLocalHandle, browser: MediaJoinBrowser, native: MediaJoinNative, cleanup?: MediaJoinNative) {
  assertOwnedLocalHandle(handle);
  assert.equal(browser.status, "pass"); assert.equal(browser.driverCompleted, true);
  assert.deepEqual(browser.errors, []); assert.equal(browser.scope, "core-closure");
  const recovery = browser.cohort === "media-recovery";
  assert.ok(recovery || browser.cohort === "media-library");
  const expectedGroups = recovery
    ? ["prepare", "queue-fetch-retry", "committed-lease-warning", "resolve-lease", "produce-existing-object-reservation", "produce-finalize", "repair-finalize", "produce-missing", "repair-missing", "repair-existing-object-reservation", "permission"]
    : ["readiness", "folders", "upload-validation-retry", "catalog-query", "metadata-failure-retry", "preview", "picker-use", "in-use-delete", "physical-move", "replace-references", "detach-delete", "permission"];
  const result = recovery ? browser.mediaRecovery : browser.media;
  assert.ok(result && Array.isArray(result.completed) && Array.isArray(result.checkpoints));
  assert.deepEqual(result.automaticCoverage, []); assert.equal(result.globalClosed, false);
  assert.deepEqual(result.completed.map((row: MediaJoinRow) => row[recovery ? "name" : "group"]), expectedGroups, "Every named group must complete once in execution order.");
  const prefix = recovery ? "core-media-recovery-" : "core-media-";
  const evidence = browser.evidence.filter((row: MediaJoinRow) => String(row.id).startsWith(prefix));
  assert.deepEqual(evidence.map((row: MediaJoinRow) => row.id), expectedGroups.map(name => prefix + name));
  for (const [index, row] of evidence.entries()) {
    assert.equal(row.status, "pass"); assert.deepEqual(row.coverage, []);
    assert.equal(row[recovery ? "name" : "group"], expectedGroups[index]);
    assert.equal(row.consumer, recovery ? "media-recovery-queue" : "media-library");
    assert.deepEqual(row.automaticCoverage, []);
    for (const [key, value] of Object.entries(result.completed[index])) assert.deepEqual(row[key], value, "Completed group must match its actual named evidence.");
  }
  assert.equal(native.status, "pass"); assert.ok(Array.isArray(native.records) && native.records.length > 0);
  const stateKind = recovery ? "media-recovery-state" : "media-library-state";
  const stateRecords = native.records.filter((row: MediaJoinRow) => row.kind === stateKind);
  const ids = result.checkpoints.map((row: MediaJoinRow) => row.id);
  assert.equal(new Set(ids).size, ids.length, "Repeated checkpoint identity is not new proof.");
  assert.deepEqual(ids, stateRecords.map((row: MediaJoinRow) => row.id), "Every Browser checkpoint must join the same native result in order.");
  assert.ok(ids.length > 0);
  for (const row of result.checkpoints) assert.ok(typeof row.label === "string" && row.label.length > 0);
  let binding;
  if (recovery) {
    assert.ok(cleanup); assert.equal(cleanup.status, "closed"); assert.equal(cleanup.activeLocks, 0);
    const faults = native.records.filter((row: MediaJoinRow) => row.kind !== stateKind);
    assert.deepEqual(faults, cleanup.records, "Every fault command must agree with the closed producer.");
    for (const scenario of ["lease", "cancel", "finalize", "missing"]) {
      const rows = faults.filter((row: MediaJoinRow) => row.scenario === scenario);
      assert.deepEqual(rows.map((row: MediaJoinRow) => row.kind), (scenario === "lease" ? ["arm", "cancel", "release"] : ["arm", "switch", "cancel", "release"]).map(step => "media-recovery-fault-" + step));
      assert.equal(new Set(rows.map((row: MediaJoinRow) => row.token)).size, 1);
      assert.equal(rows.at(-1)?.activeLocks, 0); assert.equal(rows.at(-1)?.ownedTransactionsRolledBack, true);
      assert.equal(rows.at(-1)?.cancellationAcknowledged, true);
    }
    assert.deepEqual([...new Set(faults.map((row: MediaJoinRow) => row.scenario))].sort(), ["cancel", "finalize", "lease", "missing"]);
    binding = assertOwnedCoreMediaRecoveryCompletion(handle, native.records, cleanup);
  } else {
    assert.equal(native.records.length, stateRecords.length);
    binding = assertOwnedCoreMediaCheckpointCompletion(handle, native.records);
  }
  return { groups: expectedGroups, nativeCheckpoints: ids.length, binding, automaticCoverage: [], globalClosed: false };
}

/** Only the Page create's one accepted save and its cookie-free denial pair may extend Navigation's native checkpoints. */
export function assertCoreNavigationPermissionReceipts(handle: OwnedLocalHandle, browserInput: unknown, nativeInput: unknown, draftRestorationInput?: unknown) {
  assertOwnedLocalHandle(handle);
  type Row = Record<string, unknown>;
  const object = (value: unknown): Row => { assert.ok(value && typeof value === "object" && !Array.isArray(value)); return value as Row; };
  const rows = (value: unknown): Row[] => { assert.ok(Array.isArray(value)); return value.map(object); };
  const browser = object(browserInput), native = object(nativeInput), result = object(browser.navigationSettings);
  assert.equal(browser.status, "pass"); assert.equal(browser.driverCompleted, true); assert.equal(browser.inventoryOnly, false);
  assert.equal(browser.scope, "core-closure"); assert.equal(browser.cohort, "navigation-settings"); assert.deepEqual(browser.errors, []);
  assert.equal(result.status, "pass"); assert.equal(result.globalClosed, false); assert.equal(result.requiresOwnedCleanupBeforePromotion, true);
  assert.equal(native.status, "pass"); const records = rows(native.records), checkpoints = rows(result.checkpoints);
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
  for (const row of records) assert.match(String(row.id), uuid);
  assert.equal(new Set(records.map(row => row.id)).size, records.length, "Duplicate native request identity cannot add proof.");
  const expectedPhases = Object.entries(NAVIGATION_SETTINGS_PHASES).flatMap(([entity, phases]) => phases.map(phase => ({ entity, phase })));
  const stateRecords = records.filter(row => row.kind === "navigation-settings-state");
  assert.deepEqual(stateRecords.map(row => ({ entity: row.entity, phase: row.phase })), expectedPhases);
  for (const row of stateRecords) assert.equal(row.status, "pass");
  assert.deepEqual(checkpoints, stateRecords, "Every real Navigation checkpoint must join its exact native result.");
  const proofs = rows(result.permissionEvidence); assert.equal(proofs.length, 1); const proof = proofs[0];
  const caseId = "core-navigation-page-create-accepted-save", formConsumer = "pages-quick-create", surface = "create";
  assert.equal(proof.status, "pass"); assert.equal(proof.caseId, caseId); assert.equal(proof.formConsumer, formConsumer); assert.equal(proof.surface, surface);
  const evidence = rows(browser.evidence).filter(row => row.id === "core-navigation-page-create-rejection-retry-reload");
  assert.equal(evidence.length, 1); assert.equal(evidence[0].status, "pass"); assert.equal(evidence[0].consumer, formConsumer); assert.equal(evidence[0].surface, surface);
  assert.deepEqual(evidence[0].permissionEvidence, proofs); assert.deepEqual(evidence[0].automaticCoverage, []);
  const cells = rows(browser.requiredCases).filter(row => row.boundary === "form" && row.consumer === formConsumer && row.surface === surface && row.scenario === "permission_denied");
  assert.equal(cells.length, 1); assert.equal(typeof cells[0].key, "string"); assert.equal(proof.candidateRequiredCase, cells[0].key);
  assert.deepEqual(result.permissionCandidateKeys, [cells[0].key]); assert.deepEqual(proof.automaticCoverage, []);
  assert.match(String(browser.sourceSha256), /^[a-f0-9]{64}$/u); assert.equal(proof.sourceSha256, browser.sourceSha256);
  assert.match(String(proof.actionSha256), /^[a-f0-9]{64}$/u); assert.equal(proof.routePathname, "/admin/pages-blocks/pages");
  for (const key of ["originalUiSuccessVerified", "originalNativeSaveVerified", "replayCookieFree", "publicDomainAuditDependentsUnchanged"]) assert.equal(proof[key], true);
  assert.equal(proof.bodyOrCookieArtifactsWritten, false); assert.equal(proof.replayCount, 1); assert.equal(proof.replayRedirectsFollowed, 0); assert.equal(proof.originalProjectionCount, 1);
  assert.ok(Number.isSafeInteger(proof.originalActionHttpStatus) && Number(proof.originalActionHttpStatus) >= 200 && Number(proof.originalActionHttpStatus) < 400);
  assert.equal(proof.ownedRunId, handle.identity.runId);
  const denial = object(proof.denial); assert.equal(denial.actionBodyExecutionProven, false);
  if (denial.kind === "http-unauthorized") assert.equal(denial.httpStatus, 401);
  else { assert.equal(denial.kind, "owned-admin-login-denial"); assert.equal(denial.destination, "/admin/login"); assert.ok([200, 301, 302, 303, 307, 308].includes(Number(denial.httpStatus))); }
  const claim = (id: unknown, kind: string) => { const found = records.filter(row => row.id === id); assert.equal(found.length, 1); assert.equal(found[0].kind, kind); return found[0]; };
  const saved = claim(proof.originalNativeSaveReceipt, "form-save-native"), before = claim(proof.nativeBefore, "form-permission-fingerprint"), after = claim(proof.nativeAfter, "form-permission-fingerprint");
  assert.equal(saved.status, "partial-not-global-pass"); assert.equal(saved.globalClosed, false);
  for (const [key, value] of Object.entries({ caseId, formConsumer, surface })) assert.equal(saved[key], value);
  const created = stateRecords.find(row => row.entity === "page" && row.phase === "created")!;
  assert.ok(Number.isSafeInteger(created.pageId) && Number(created.pageId) > 0);
  const writes = rows(saved.writes); assert.equal(writes.length, 1); const write = writes[0], recipe = CORE_NAVIGATION_RECIPE.page;
  assert.equal(write.table, "pages"); assert.equal(write.id, created.pageId); assert.equal(write.deleted, false); assert.deepEqual(write.json, []);
  assert.deepEqual(write.actual, { title: recipe.title, path: recipe.path, slug: recipe.slug, status: "unpublished", page_type: "static" });
  assert.ok(Number.isSafeInteger(write.expectedActorId) && Number(write.expectedActorId) > 0);
  const audit = rows(write.audit); assert.equal(audit.length, 1); assert.equal(audit[0].action, "page.create");
  assert.equal(audit[0].entity_type, "page"); assert.equal(Number(audit[0].entity_id), created.pageId); assert.equal(audit[0].entity_label, recipe.title);
  assert.equal(Number(audit[0].actor_admin_user_id), write.expectedActorId);
  for (const row of [before, after]) {
    assert.equal(row.status, "pass"); assert.equal(row.ownedRunId, handle.identity.runId); assert.equal(row.adminAuditIncluded, true); assert.equal(row.adminUsersIncluded, true);
    assert.ok(Number.isSafeInteger(row.publicTableCount) && Number(row.publicTableCount) > 0);
    for (const key of ["publicTableInventorySha256", "publicDataSha256"]) assert.match(String(row[key]), /^[a-f0-9]{64}$/u);
    assert.match(String(row.correlationId), uuid);
  }
  assert.equal(before.phase, "before"); assert.equal(after.phase, "after"); assert.equal(before.correlationId, after.correlationId);
  for (const key of ["publicTableCount", "publicTableInventorySha256", "publicDataSha256"]) assert.equal(after[key], before[key]);
  assert.equal(proof.publicTableCount, before.publicTableCount);
  const expectedIds = stateRecords.map(row => row.id), createIndex = stateRecords.indexOf(created);
  if (draftRestorationInput !== undefined) {
    const draft = object(draftRestorationInput);
    const joined = assertCoreFormDraftRestorationJoin({artifact:draft,browser,native,ownedRunId:handle.identity.runId,sourceSha256:browser.sourceSha256});
    assert.equal(joined.qualified.length,1);
    const restoration=rows(draft.receipts)[0];
    for (const [key,value] of Object.entries({caseId,formConsumer,surface,journeyId:"core-navigation-page-create-rejection-retry-reload",routePathname:"/admin/pages-blocks/pages",dirtyNavigation:"close"})) assert.equal(restoration[key],value);
    expectedIds.splice(createIndex,0,restoration.nativeBefore,restoration.nativeAfter);
  }
  expectedIds.splice(expectedIds.indexOf(created.id) + 1, 0, saved.id, before.id, after.id);
  assert.deepEqual(records.map(row => row.id), expectedIds, "Only the exact Page save and ordered denial pair may extend Navigation; no orphan, foreign or extra native records.");
  return { status: "pass", ownedRunId: handle.identity.runId, navigationCheckpoints: stateRecords.length, pagePermissionIntents: 1, nativeCheckpoints: records.length, candidateRequiredCase: cells[0].key, automaticCoverage: [], globalClosed: false };
}

type ExpectedRead = { table: string; id: number; expected: Record<string, unknown> };
/** Complete selected authenticated journeys through the existing owned SQL handle. */
export async function verifyAdminAdoptionReadback(handle: OwnedLocalHandle, artifactDir: string) {
  assertOwnedLocalHandle(handle);
  const browser = JSON.parse(readFileSync(join(artifactDir, "admin-adoption-browser.json"), "utf8")) as {
    status: string; scope?: string; cohort?: string; startedAt: string; databaseReadback: ExpectedRead[]; readOnlyReadback: unknown[];
    previewMatrix: Array<{ status: string }>; presentationControls?: {planned:number;completed:number;outcomes:Array<Record<string,unknown>>}; projectControls?: {planned:number;completed:number;outcomes:Array<Record<string,unknown>>}; topicControls?: {planned:number;completed:number;outcomes:Array<Record<string,unknown>>}; templateControls?: {planned:number;completed:number;outcomes:Array<Record<string,unknown>>}; specializedSettings?: { status: string }; media?: MediaJoinResult; mediaRecovery?: MediaJoinResult;
    menuIntegrityReadback: Array<{ topicId: number; menuId: number; expectedItems: number }>;
    evidence: Array<{ id: string; status: string }>; globalClosed: boolean;
  };
  assert.equal(browser.status, "pass", "Failed selected browser journeys cannot receive a passing database receipt.");
  assert.ok(Number.isFinite(Date.parse(browser.startedAt)));
  if (browser.scope === "core-closure") {
    assert.ok(["preview-recovery-templates", "domain-forms", "domain-commands", "page-composition", "template-libraries", "readonly-hubs", "recovery-templates", "specialized-settings", "media-library", "template-bulk", "navigation-settings", "auth-entry", "media-recovery", "query-presentation", "template-controls", "domain-bulk", "topic-controls", "project-controls", "presentation-controls"].includes(browser.cohort ?? ""));
    const previewStates = browser.cohort === "preview-recovery-templates" ? await verifyCorePreviewStateReadback(handle, artifactDir, "after") : null;
    if (previewStates) {
      assert.equal(browser.previewMatrix.length, previewStates.reads.length * 2);
      assert.ok(browser.previewMatrix.every(row => row.status === "behavior_verified"));
    }
    const draftFile=join(artifactDir,"admin-core-draft-restoration.json");
    const draftRequired=["preview-recovery-templates","recovery-templates","domain-forms","navigation-settings"].includes(browser.cohort ?? "");
    if(draftRequired)assert.equal(existsSync(draftFile),true,"Prepared Form restoration must retain its sanitized same-run receipt.");
    const draftArtifact=existsSync(draftFile)?JSON.parse(readFileSync(draftFile,"utf8")):null;
    let draftRestoration=null;
    if(draftRequired || draftArtifact?.receipts?.length) {
      const draftNative=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));
      assert.equal(draftNative.status,"pass");
      draftRestoration=assertCoreFormDraftRestorationJoin({artifact:draftArtifact,browser,native:draftNative,ownedRunId:handle.identity.runId,sourceSha256:(browser as unknown as {sourceSha256:string}).sourceSha256});
    }
    let nativeCheckpoints = null;
    let pageSeo = null;
    let navigationPermission: ReturnType<typeof assertCoreNavigationPermissionReceipts> | null = null;
    if (browser.cohort === "page-composition" || browser.cohort === "readonly-hubs" || browser.cohort === "specialized-settings" || browser.cohort === "media-library" || browser.cohort === "navigation-settings" || browser.cohort === "auth-entry") {
      nativeCheckpoints = JSON.parse(readFileSync(join(artifactDir, "core-native-control-readback.json"), "utf8"));
      assert.equal(nativeCheckpoints.status, "pass", "Every joined fixed checkpoint must complete.");
      const kind = browser.cohort === "page-composition" ? "page-composition-state" : browser.cohort === "readonly-hubs" ? "readonly-hub-state" : browser.cohort === "media-library" ? "media-library-state" : browser.cohort === "navigation-settings" ? "navigation-settings-state" : browser.cohort === "auth-entry" ? "auth-entry-state" : "specialized-settings-state";
      assert.ok(Array.isArray(nativeCheckpoints.records) && nativeCheckpoints.records.length > 0);
      if (browser.cohort === "navigation-settings") navigationPermission = assertCoreNavigationPermissionReceipts(handle, browser, nativeCheckpoints, draftArtifact);
      else if (browser.cohort === "page-composition") pageSeo = assertPageSeoReceiptJoin(browser, nativeCheckpoints, JSON.parse(readFileSync(join(artifactDir, "core-native-write-faults.json"), "utf8")), assertCorePageSeoCompleted(handle));
      else assert.ok(nativeCheckpoints.records.every((row: {kind: string; status: string}) => row.kind === kind && row.status === "pass"));
    }
    const mediaCompletion = browser.cohort === "media-library" ? assertCoreMediaCompletionReceipts(handle, browser, nativeCheckpoints) : null;
    let mediaRecovery=null;
    if(browser.cohort==="media-recovery") {
      nativeCheckpoints=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));
      assert.equal(nativeCheckpoints.status,"pass");
      assert.ok(nativeCheckpoints.records.length>0 && nativeCheckpoints.records.every((row:{kind:string;status:string})=>row.kind.startsWith("media-recovery-")&&row.status==="pass"));
      const cleanup=JSON.parse(readFileSync(join(artifactDir,"core-native-media-recovery.json"),"utf8"));
      assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);
      const completion = assertCoreMediaCompletionReceipts(handle, browser, nativeCheckpoints, cleanup);
      mediaRecovery={...browser.mediaRecovery,cleanup,completion};
    }
    let templateControls=null;
    if(browser.cohort==="template-controls") {
      const completion=assertCoreTemplateControlsCompleted(handle),result=browser.templateControls;assert.ok(result);
      assert.equal(result.planned,completion.recipes);assert.equal(result.completed,completion.recipes);assert.equal(result.outcomes.length,completion.recipes);
      assert.equal(new Set(result.outcomes.map(row=>row.kind)).size,completion.recipes);
      for(const row of result.outcomes){const proof=row.pendingProof as Record<string,unknown>;for(const key of ["nativeBlockedStatementObservedTwice","sameStatementIdentity","fieldsDisabledAndInert","keyboardRepeatDispatchedNoExtraAction","ownedLockReleased"])assert.equal(proof[key],true);assert.equal(proof.actionRequests,1);const evidence=browser.evidence.filter(item=>item.id==="core-template-controls-"+row.kind);assert.equal(evidence.length,1);assert.equal(evidence[0].status,"pass");}
      const cleanup=JSON.parse(readFileSync(join(artifactDir,"core-native-write-faults.json"),"utf8"));assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);
      templateControls={...result,completion,cleanup};
    }
    let topicControls=null;
    if(browser.cohort==="topic-controls") {
      const completion=assertCoreTopicControlsCompleted(handle),result=browser.topicControls;assert.ok(result);
      assert.equal(result.planned,completion.recipes);assert.equal(result.completed,completion.recipes);assert.equal(result.outcomes.length,completion.recipes);
      assert.equal(new Set(result.outcomes.map(row=>row.kind)).size,completion.recipes);
      const native=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));assert.equal(native.status,"pass");assert.equal(native.ownedRunId,handle.identity.runId);
      const cleanup=JSON.parse(readFileSync(join(artifactDir,"core-native-write-faults.json"),"utf8"));assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);
      const faults=native.records.filter((r:Record<string,unknown>)=>String(r.kind).startsWith("domain-write-fault-"));assert.deepEqual(faults,cleanup.records);
      assert.ok(native.records.every((r:Record<string,unknown>)=>r.kind==="topic-controls-state"||faults.includes(r)));assert.equal(native.records.filter((r:Record<string,unknown>)=>r.kind==="topic-controls-state").length,completion.nativeCheckpoints);
      for(const row of result.outcomes){
        const evidence=browser.evidence.filter(item=>item.id==="core-topic-controls-"+row.kind);assert.equal(evidence.length,1);assert.equal(evidence[0].status,"pass");
        const actual=faults.filter((r:Record<string,unknown>)=>r.entity==="topic_control_"+row.kind);const tokens=[...new Set(actual.map((r:Record<string,unknown>)=>r.token))];assert.equal(tokens.length,2);
        for(const [index,key]of ["rejectedPending","successfulPending"].entries()){
          const proof=row[key] as Record<string,unknown>;for(const name of ["sameNativeStatementObservedTwice","normalKeyboardDedup","fieldsAndCloseDisabled","ownedLockReleased"])assert.equal(proof[name],true);assert.equal(proof.actionRequests,1);assert.equal(proof.actualStatementCancelled,index===0);
          const sequence=actual.filter((r:Record<string,unknown>)=>r.token===tokens[index]);assert.deepEqual(sequence.map((r:Record<string,unknown>)=>r.kind),["arm","observe-blocked","observe-blocked",...(index===0?["cancel"]:[]),"release"].map(kind=>"domain-write-fault-"+kind));
          assert.equal(sequence.at(-1).ownedLockRolledBack,true);assert.equal(sequence.at(-1).cancellationObserved,index===0);
        }
      }
      topicControls={...result,completion,cleanup};
    }
    let projectControls=null;
    if(browser.cohort==="project-controls") {
      const completion=assertCoreProjectControlsCompleted(handle),result=browser.projectControls;assert.ok(result);
      assert.equal(completion.exactWrites,4);assert.equal(completion.allRemainUnpublished,true);assert.equal(completion.optionalGraphsEmpty,true);
      assert.equal(result.planned,completion.recipes);assert.equal(result.completed,completion.recipes);assert.equal(result.outcomes.length,completion.recipes);
      assert.equal(new Set(result.outcomes.map(row=>row.kind)).size,completion.recipes);
      const native=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));assert.equal(native.status,"pass");assert.equal(native.ownedRunId,handle.identity.runId);
      const cleanup=JSON.parse(readFileSync(join(artifactDir,"core-native-write-faults.json"),"utf8"));assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);
      const faults=native.records.filter((r:Record<string,unknown>)=>String(r.kind).startsWith("domain-write-fault-"));assert.deepEqual(faults,cleanup.records);
      assert.ok(native.records.every((r:Record<string,unknown>)=>r.kind==="project-controls-state"||faults.includes(r)));assert.equal(native.records.filter((r:Record<string,unknown>)=>r.kind==="project-controls-state").length,completion.nativeCheckpoints);
      for(const row of result.outcomes){
        assert.equal(row.exactWrites,2);assert.equal(row.optionalGraphsEmpty,true);assert.deepEqual(row.nativePhases,PROJECT_CONTROL_PHASES);
        const states=native.records.filter((r:Record<string,unknown>)=>r.kind==="project-controls-state"&&r.recipe===row.kind);assert.deepEqual(states.map((r:Record<string,unknown>)=>r.phase),PROJECT_CONTROL_PHASES);assert.ok(states.every((r:Record<string,unknown>)=>r.status==="pass"));
        const evidence=browser.evidence.filter(item=>item.id==="core-project-controls-"+row.kind);assert.equal(evidence.length,1);assert.equal(evidence[0].status,"pass");
        const actual=faults.filter((r:Record<string,unknown>)=>r.entity===(row.kind==="residential"?"projects":"project_control_commercial"));const tokens=[...new Set(actual.map((r:Record<string,unknown>)=>r.token))];assert.equal(tokens.length,2);
        for(const [index,key]of ["rejectedPending","successfulPending"].entries()){
          const proof=row[key] as Record<string,unknown>;for(const name of ["sameNativeStatementObservedTwice","normalKeyboardDedup","fieldsAndCloseDisabled","ownedLockReleased"])assert.equal(proof[name],true);assert.equal(proof.actionRequests,1);assert.equal(proof.actualStatementCancelled,index===0);
          const sequence=actual.filter((r:Record<string,unknown>)=>r.token===tokens[index]);assert.deepEqual(sequence.map((r:Record<string,unknown>)=>r.kind),["arm","observe-blocked","observe-blocked",...(index===0?["cancel"]:[]),"release"].map(kind=>"domain-write-fault-"+kind));
          assert.equal(sequence.at(-1).ownedLockRolledBack,true);assert.equal(sequence.at(-1).cancellationObserved,index===0);
        }
      }
      projectControls={...result,completion,cleanup};
    }
    let presentationControls=null;
    if(browser.cohort==="presentation-controls") {
      const completion=assertCorePresentationControlsCompleted(handle),result=browser.presentationControls;assert.ok(result);
      assert.equal(completion.recipes,2);assert.equal(completion.exactWrites,2);assert.equal(completion.nativeCheckpoints,12);for(const key of ["actorBound","publicAssignmentsUnchanged","catalogUnchanged"] as const)assert.equal(completion[key],true);
      assert.equal(result.planned,completion.recipes);assert.equal(result.completed,completion.recipes);assert.equal(result.outcomes.length,completion.recipes);
      assert.deepEqual(result.outcomes.map(row=>row.kind).sort(),["content","hero"]);
      const native=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));assert.equal(native.status,"pass");assert.equal(native.ownedRunId,handle.identity.runId);
      const cleanup=JSON.parse(readFileSync(join(artifactDir,"core-native-write-faults.json"),"utf8"));assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);
      const faults=native.records.filter((r:Record<string,unknown>)=>String(r.kind).startsWith("domain-write-fault-"));assert.deepEqual(faults,cleanup.records);
      assert.ok(native.records.every((r:Record<string,unknown>)=>r.kind==="presentation-controls-state"||faults.includes(r)));assert.equal(native.records.filter((r:Record<string,unknown>)=>r.kind==="presentation-controls-state").length,completion.nativeCheckpoints);
      for(const row of result.outcomes){
        assert.equal(row.postRejectionDirtyNavigationCancelled,true);assert.equal(row.exactWrites,1);assert.equal(row.nativeCheckpoints,6);assert.deepEqual(row.nativePhases,PRESENTATION_CONTROL_PHASES);
        const states=native.records.filter((r:Record<string,unknown>)=>r.kind==="presentation-controls-state"&&r.recipe===row.kind);assert.deepEqual(states.map((r:Record<string,unknown>)=>r.phase),PRESENTATION_CONTROL_PHASES);assert.ok(states.every((r:Record<string,unknown>)=>r.status==="pass"));
        const evidence=browser.evidence.filter(item=>item.id==="core-presentation-controls-"+row.kind);assert.equal(evidence.length,1);assert.equal(evidence[0].status,"pass");
        const actual=faults.filter((r:Record<string,unknown>)=>r.entity==="presentation_control_"+row.kind);const tokens=[...new Set(actual.map((r:Record<string,unknown>)=>r.token))];assert.equal(tokens.length,2);
        for(const [index,key]of ["pendingRejection","pendingSave"].entries()){
          const proof=row[key] as Record<string,unknown>;for(const name of ["nativeStatementObservedTwice","sameStatementIdentity","normalKeyboardDedup","fieldsDisabled","ownedLockReleased"])assert.equal(proof[name],true);assert.equal(proof.closeControl,"not_declared");assert.equal(proof.actionRequests,1);assert.equal(proof.actualStatementCancelled,index===0);
          const sequence=actual.filter((r:Record<string,unknown>)=>r.token===tokens[index]);assert.deepEqual(sequence.map((r:Record<string,unknown>)=>r.kind),["arm","observe-blocked","observe-blocked",...(index===0?["cancel"]:[]),"release"].map(kind=>"domain-write-fault-"+kind));
          assert.equal(sequence.at(-1).ownedLockRolledBack,true);assert.equal(sequence.at(-1).cancellationObserved,index===0);
        }
      }
      presentationControls={...result,completion,cleanup};
    }
    const domainBulk=browser.cohort==="domain-bulk"?await verifyCoreDomainBulkCompletion(handle,browser,JSON.parse(readFileSync(join(artifactDir,"admin-adoption-fixtures.json"),"utf8")),JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"))):null;
    const queryPresentation = browser.cohort === "query-presentation" ? verifyCoreQueryPresentationCompletion(handle,browser) : null;
    const authEntry = browser.cohort === "auth-entry" ? assertCoreAuthEntryCompleted(handle) : null;
    const navigationSettings = browser.cohort === "navigation-settings" ? { ...assertCoreNavigationSettingsCompleted(handle), permission: navigationPermission } : null;
    const specializedSettings = browser.cohort === "specialized-settings" ? assertCoreSpecializedSettingsCompleted(handle) : null;
    if (specializedSettings) assert.equal(browser.specializedSettings?.status,"pass");
    const writes = await verifyCoreDomainWrites(handle, browser);
    const readOnly = browser.cohort === "domain-commands" ? await verifyCoreReadonlyReadback(handle, browser) : null;
    const result = { status: "pass", authenticatedBrowserReceipt: "admin-adoption-browser.json", previewStates, writes, readOnly, nativeCheckpoints, draftRestoration, pageSeo, specializedSettings, media: browser.media ?? null, mediaCompletion, navigationSettings, authEntry, mediaRecovery, queryPresentation, templateControls, topicControls, projectControls, presentationControls, domainBulk, globalClosed: browser.globalClosed, boundary: "Selected Core writes joined to native fields/configuration/audit, and read-only Preview states joined to unchanged native publication/deletion state." };
    writeFileSync(join(artifactDir, "admin-adoption-database-readback.json"), JSON.stringify(result, null, 2) + "\n");
    return result;
  }
  const allowed: Record<string, { fields: string[]; entity: string }> = {
    topic_categories: { fields: ["name", "slug"], entity: "topic_category" },
    topic_series: { fields: ["name", "slug"], entity: "topic_series" },
    topics: { fields: ["title", "content_type", "status", "is_featured"], entity: "topic" },
  };
  const reads = [];
  const expectedActorId = await readCoreFixedQaActor(handle);
  assert.ok(browser.databaseReadback.length >= 6, "Every selected persisted mutation must provide its exact readback expectation.");
  for (const expected of browser.databaseReadback) {
    const contract = allowed[expected.table];
    assert.ok(contract && Number.isSafeInteger(expected.id) && expected.id > 0);
    const columns = Object.keys(expected.expected);
    assert.ok(columns.length && columns.every(column => contract.fields.includes(column)));
    const rows = (await handle.query('select ' + columns.map(column => '"' + column + '"').join(',') + ' from public.' + expected.table + ' where id=$1', [expected.id])).rows;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], expected.expected, "Authenticated reload must agree with direct native database state.");
    const audit = (await handle.query("select id,action,actor_admin_user_id from public.admin_audit_logs where entity_type=$1 and entity_id=$2 and created_at >= $3::timestamptz order by id", [contract.entity, expected.id, browser.startedAt])).rows;
    assert.ok(audit.length > 0 && audit.every(row => row.actor_admin_user_id !== null), "The selected authenticated write must retain an actual actor-bound audit record.");
    for (const row of audit) assertCoreAuditActor(row, expectedActorId);
    reads.push({ table: expected.table, id: expected.id, actual: rows[0], audit, expectedActorId });
  }
  // Feature/unfeature must be two actor-bound immutable receipts, never only an
  // optimistic browser label or a previous editor's ordinary update audit.
  const feature = browser.databaseReadback.find(row => Object.hasOwn(row.expected, "is_featured"));
  assert.ok(feature);
  const commandReceipts = (await handle.query("select id,metadata->'command'->'intent'->>'action' command_action from public.admin_audit_logs where entity_type='topic' and entity_id=$1 and created_at >= $2::timestamptz and metadata->'command'->'intent'->>'action' in ('feature','unfeature') order by id", [feature.id, browser.startedAt])).rows;
  assert.deepEqual(commandReceipts.map(row => row.command_action).sort(), ["feature", "unfeature"]);
  assert.equal(browser.menuIntegrityReadback.length, 1, "The selected stale Menu UI journey must supply direct readback identities.");
  const menuIntegrity = [];
  for (const expectation of browser.menuIntegrityReadback) {
    assert.ok(Number.isSafeInteger(expectation.topicId) && Number.isSafeInteger(expectation.menuId));
    const topic = (await handle.query("select id from public.topics where id=$1", [expectation.topicId])).rows;
    const menu = (await handle.query("select id from public.menus where id=$1", [expectation.menuId])).rows;
    const items = (await handle.query("select id from public.menu_items where menu_id=$1 or (linked_type='topics' and linked_id=$2)", [expectation.menuId, expectation.topicId])).rows;
    assert.equal(topic.length, 0); assert.equal(menu.length, 1); assert.equal(items.length, expectation.expectedItems);
    const receipt = (await handle.query("select id from public.admin_audit_logs where entity_type='topic' and entity_id=$1 and created_at >= $2::timestamptz and metadata->'command'->'intent'->>'action'='permanent_delete'", [expectation.topicId, browser.startedAt])).rows;
    assert.equal(receipt.length, 1);
    menuIntegrity.push({ ...expectation, targetDeleted: true, noOrphanOrPartialMenuItem: true, purgeReceipt: receipt[0].id });
  }
  const result = { status: "pass", authenticatedBrowserReceipt: "admin-adoption-browser.json", reads, commandReceipts, menuIntegrity, globalClosed: browser.globalClosed,
    boundary: "Selected real authenticated browser writes, fresh page reloads, native database fields and actor-bound audit readback; remaining applicability cells stay open." };
  writeFileSync(join(artifactDir, "admin-adoption-database-readback.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

/** The Preview driver never manufactures publication states in the browser. */
export async function verifyCorePreviewStateReadback(handle: OwnedLocalHandle, artifactDir: string, stage: "before" | "after") {
  assertOwnedLocalHandle(handle);
  const fixtures = JSON.parse(readFileSync(join(artifactDir, "admin-adoption-fixtures.json"), "utf8")) as {
    previewClosure: Array<{ consumer: string; publication: string; table: string; id: number; slug: string; expectedStatus: string; expectedDeleted: boolean; expectedActive: boolean | null }>;
  };
  assert.equal(fixtures.previewClosure.length, 12);
  assert.equal(new Set(fixtures.previewClosure.map(row => row.consumer + ":" + row.publication)).size, fixtures.previewClosure.length);
  const reads = [];
  for (const row of fixtures.previewClosure) {
    assert.ok(["topics", "topic_categories", "topic_series"].includes(row.table));
    assert.ok(Number.isSafeInteger(row.id) && row.id > 0);
    const columns = "id,slug,status,(deleted_at is not null) as deleted" + (row.table === "topic_categories" ? ",is_active" : "");
    const rows = (await handle.query(`select ${columns} from public.${row.table} where id=$1`, [row.id])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, row.slug); assert.equal(rows[0].status, row.expectedStatus);
    assert.equal(rows[0].deleted, row.expectedDeleted);
    if (row.expectedActive !== null) assert.equal(rows[0].is_active, row.expectedActive);
    reads.push({ consumer: row.consumer, publication: row.publication, table: row.table, ...rows[0] });
  }
  if (stage === "after") {
    const before = JSON.parse(readFileSync(join(artifactDir, "core-preview-native-before.json"), "utf8"));
    assert.deepEqual(reads, before.reads, "Read-only Preview execution must preserve every synthetic state.");
  }
  const result = { status: "pass", stage, reads, scope: "Twelve isolated publication/deletion states for the current four registered Preview consumers." };
  writeFileSync(join(artifactDir, `core-preview-native-${stage}.json`), JSON.stringify(result, null, 2) + "\n");
  return result;
}
/** Exact persisted projections and actor-bound audit for executed Core writes. */
export async function verifyCoreSelectedWrites(handle: OwnedLocalHandle, browser: {
  startedAt: string; databaseReadback: Array<ExpectedRead & {
    expectedJson?: Array<{ column: string; path: string[]; value: unknown }>;
    auditEntityType?: string; auditActions?: string[]; auditMetadata?: Record<string, unknown>; auditEntityLabel?: string;
  }>;
}) {
  const tables = new Set(["topics", "topic_categories", "content_block_templates", "hero_templates", "cta_block_templates", "cards_block_templates", "breadcrumb_block_templates", "feed_module_templates", "featured_module_templates", "media_sidebar_module_templates", "media_hub_module_templates"]);
  assertOwnedLocalHandle(handle);
  const expectedActorId = await readCoreFixedQaActor(handle);
  const result = [];
  for (const expectation of browser.databaseReadback) {
    assert.ok(tables.has(expectation.table) && Number.isSafeInteger(expectation.id) && expectation.id > 0);
    const fields = [...new Set([...Object.keys(expectation.expected), ...(expectation.expectedJson ?? []).map(row => row.column)])];
    assert.ok(fields.every(field => ["name", "slug", "status", "config", "is_featured"].includes(field)));
    const rows = (await handle.query(`select ${fields.length ? fields.map(field => '"' + field + '"').join(",") : "id"} from public.${expectation.table} where id=$1`, [expectation.id])).rows;
    assert.equal(rows.length, 1);
    for (const [field, expected] of Object.entries(expectation.expected)) assert.deepEqual(rows[0][field], expected, "Native saved field differs: " + expectation.table + "." + field);
    for (const projection of expectation.expectedJson ?? []) {
      assert.equal(projection.column, "config"); assert.ok(projection.path.length > 0);
      let actual: unknown = rows[0].config;
      for (const key of projection.path) {
        assert.ok(actual && typeof actual === "object" && Object.hasOwn(actual, key), "Authored configuration path must be persisted.");
        actual = (actual as Record<string, unknown>)[key];
      }
      assert.deepEqual(actual, projection.value);
    }
    const entityType = expectation.table === "topics" ? "topic" : expectation.table === "topic_categories" ? "topic_category" : "content_block_template";
    assert.ok(expectation.auditEntityType === undefined || expectation.auditEntityType === entityType);
    const entityLabel = expectation.auditEntityLabel ?? expectation.expected.name;
    assert.ok(entityType === "topic" || typeof entityLabel === "string", "Shared template audit IDs require exact entity label attribution.");
    const audit = (await handle.query("select id,action,entity_label,actor_admin_user_id,metadata from public.admin_audit_logs where entity_type=$1 and entity_id=$2 and ($3::text is null or entity_label=$3) and created_at >= $4::timestamptz order by id", [entityType, expectation.id, entityLabel ?? null, browser.startedAt])).rows;
    const attributed = audit.filter(row => Object.entries(expectation.auditMetadata ?? {}).every(([key, value]) => JSON.stringify((row.metadata as Record<string, unknown> | null)?.[key]) === JSON.stringify(value)));
    assert.ok(attributed.length > 0 && attributed.every(row => row.actor_admin_user_id !== null), "Executed save must retain its actual domain/label/actor-bound audit.");
    for (const row of attributed) assertCoreAuditActor(row, expectedActorId);
    for (const action of expectation.auditActions ?? []) assert.ok(attributed.some(row => row.action === action), "Expected domain audit action is absent: " + action);
    result.push({ table: expectation.table, id: expectation.id, actual: rows[0], audit: attributed, expectedActorId });
  }
  return result;
}