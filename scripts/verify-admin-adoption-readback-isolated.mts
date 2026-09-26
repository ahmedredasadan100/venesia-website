import { verifyCoreQueryPresentationCompletion } from "./verify-admin-core-query-presentation-isolated.mts";
import { assertCoreAuthEntryCompleted } from "./verify-admin-core-auth-entry-isolated.mts";
import { assertCoreNavigationSettingsCompleted } from "./verify-admin-core-navigation-settings-isolated.mts";
import assert from "node:assert/strict";
import { assertCoreSpecializedSettingsCompleted } from "./verify-admin-core-specialized-settings-isolated.mts";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

import { assertCoreAuditActor, readCoreFixedQaActor, verifyCoreDomainWrites } from "./verify-admin-core-domain-readback-isolated.mts";

import { verifyCoreReadonlyReadback } from "./verify-admin-core-readonly-isolated.mts";

type ExpectedRead = { table: string; id: number; expected: Record<string, unknown> };
/** Complete selected authenticated journeys through the existing owned SQL handle. */
export async function verifyAdminAdoptionReadback(handle: OwnedLocalHandle, artifactDir: string) {
  assertOwnedLocalHandle(handle);
  const browser = JSON.parse(readFileSync(join(artifactDir, "admin-adoption-browser.json"), "utf8")) as {
    status: string; scope?: string; cohort?: string; startedAt: string; databaseReadback: ExpectedRead[]; readOnlyReadback: unknown[];
    previewMatrix: Array<{ status: string }>; specializedSettings?: { status: string }; media?: { completed: unknown[]; checkpoints: unknown[] }; mediaRecovery?: { completed: unknown[]; checkpoints: unknown[] };
    menuIntegrityReadback: Array<{ topicId: number; menuId: number; expectedItems: number }>;
    evidence: Array<{ id: string; status: string }>; globalClosed: boolean;
  };
  assert.equal(browser.status, "pass", "Failed selected browser journeys cannot receive a passing database receipt.");
  assert.ok(Number.isFinite(Date.parse(browser.startedAt)));
  if (browser.scope === "core-closure") {
    assert.ok(["preview-recovery-templates", "domain-forms", "domain-commands", "page-composition", "template-libraries", "readonly-hubs", "recovery-templates", "specialized-settings", "media-library", "template-bulk", "navigation-settings", "auth-entry", "media-recovery", "query-presentation"].includes(browser.cohort ?? ""));
    const previewStates = browser.cohort === "preview-recovery-templates" ? await verifyCorePreviewStateReadback(handle, artifactDir, "after") : null;
    if (previewStates) {
      assert.equal(browser.previewMatrix.length, previewStates.reads.length * 2);
      assert.ok(browser.previewMatrix.every(row => row.status === "behavior_verified"));
    }
    let nativeCheckpoints = null;
    if (browser.cohort === "page-composition" || browser.cohort === "readonly-hubs" || browser.cohort === "specialized-settings" || browser.cohort === "media-library" || browser.cohort === "navigation-settings" || browser.cohort === "auth-entry") {
      nativeCheckpoints = JSON.parse(readFileSync(join(artifactDir, "core-native-control-readback.json"), "utf8"));
      assert.equal(nativeCheckpoints.status, "pass", "Every joined fixed checkpoint must complete.");
      const kind = browser.cohort === "page-composition" ? "page-composition-state" : browser.cohort === "readonly-hubs" ? "readonly-hub-state" : browser.cohort === "media-library" ? "media-library-state" : browser.cohort === "navigation-settings" ? "navigation-settings-state" : browser.cohort === "auth-entry" ? "auth-entry-state" : "specialized-settings-state";
      assert.ok(Array.isArray(nativeCheckpoints.records) && nativeCheckpoints.records.length > 0);
      assert.ok(nativeCheckpoints.records.every((row: {kind: string; status: string}) => row.kind === kind && row.status === "pass"));
    }
    if (browser.cohort === "media-library") {
      assert.ok(browser.media && browser.media.completed.length > 0 && browser.media.checkpoints.length > 0);
      assert.equal(browser.evidence.filter(row=>row.id.startsWith("core-media-")).length,browser.media.completed.length);
      assert.ok(browser.evidence.filter(row=>row.id.startsWith("core-media-")).every(row=>row.status === "pass"));
    }
    let mediaRecovery=null;
    if(browser.cohort==="media-recovery") {
      nativeCheckpoints=JSON.parse(readFileSync(join(artifactDir,"core-native-control-readback.json"),"utf8"));
      assert.equal(nativeCheckpoints.status,"pass");
      assert.ok(nativeCheckpoints.records.length>0 && nativeCheckpoints.records.every((row:{kind:string;status:string})=>row.kind.startsWith("media-recovery-")&&row.status==="pass"));
      const cleanup=JSON.parse(readFileSync(join(artifactDir,"core-native-media-recovery.json"),"utf8"));
      assert.equal(cleanup.status,"closed");assert.equal(cleanup.activeLocks,0);
      assert.deepEqual([...new Set(cleanup.records.filter((row:{kind:string})=>row.kind==="media-recovery-fault-release").map((row:{scenario:string})=>row.scenario))].sort(),["finalize","lease","missing"]);
      assert.ok(browser.mediaRecovery && browser.mediaRecovery.completed.length>0);
      mediaRecovery={...browser.mediaRecovery,cleanup};
    }
    const queryPresentation = browser.cohort === "query-presentation" ? verifyCoreQueryPresentationCompletion(handle,browser) : null;
    const authEntry = browser.cohort === "auth-entry" ? assertCoreAuthEntryCompleted(handle) : null;
    const navigationSettings = browser.cohort === "navigation-settings" ? assertCoreNavigationSettingsCompleted(handle) : null;
    const specializedSettings = browser.cohort === "specialized-settings" ? assertCoreSpecializedSettingsCompleted(handle) : null;
    if (specializedSettings) assert.equal(browser.specializedSettings?.status,"pass");
    const writes = await verifyCoreDomainWrites(handle, browser);
    const readOnly = browser.cohort === "domain-commands" ? await verifyCoreReadonlyReadback(handle, browser) : null;
    const result = { status: "pass", authenticatedBrowserReceipt: "admin-adoption-browser.json", previewStates, writes, readOnly, nativeCheckpoints, specializedSettings, media: browser.media ?? null, navigationSettings, authEntry, mediaRecovery, queryPresentation, globalClosed: browser.globalClosed, boundary: "Selected Core writes joined to native fields/configuration/audit, and read-only Preview states joined to unchanged native publication/deletion state." };
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