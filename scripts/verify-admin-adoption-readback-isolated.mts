import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

type ExpectedRead = { table: string; id: number; expected: Record<string, unknown> };
/** Complete selected authenticated journeys through the existing owned SQL handle. */
export async function verifyAdminAdoptionReadback(handle: OwnedLocalHandle, artifactDir: string) {
  assertOwnedLocalHandle(handle);
  const browser = JSON.parse(readFileSync(join(artifactDir, "admin-adoption-browser.json"), "utf8")) as {
    status: string; startedAt: string; databaseReadback: ExpectedRead[];
    menuIntegrityReadback: Array<{ topicId: number; menuId: number; expectedItems: number }>;
    evidence: Array<{ id: string; status: string }>; globalClosed: boolean;
  };
  assert.equal(browser.status, "pass", "Failed selected browser journeys cannot receive a passing database receipt.");
  assert.ok(Number.isFinite(Date.parse(browser.startedAt)));
  const allowed: Record<string, { fields: string[]; entity: string }> = {
    topic_categories: { fields: ["name", "slug"], entity: "topic_category" },
    topic_series: { fields: ["name", "slug"], entity: "topic_series" },
    topics: { fields: ["title", "content_type", "status", "is_featured"], entity: "topic" },
  };
  const reads = [];
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
    reads.push({ table: expected.table, id: expected.id, actual: rows[0], audit });
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
