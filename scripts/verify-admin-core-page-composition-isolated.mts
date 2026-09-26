import assert from "node:assert/strict";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

const templateTables: Record<string, string> = {
  content: "content_block_templates", cta: "cta_block_templates", cards: "cards_block_templates",
  breadcrumb: "breadcrumb_block_templates", feed: "feed_module_templates", featured: "featured_module_templates",
  hero: "hero_templates", "media-sidebar": "media_sidebar_module_templates", "media-hub": "media_hub_module_templates",
};
type Request = { id: string; kind: "page-composition-state"; pageId: number; startedAt: string;
  layoutKeys: string[]; templateRefs: Array<{ kind: string; id: number }> };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;

/** Fixed read-only projection over the existing disposable QA page and requested QA templates. */
export function validateCorePageCompositionRequest(input: unknown): Request {
  assert.ok(input && typeof input === "object" && !Array.isArray(input));
  const request = input as Request;
  assert.deepEqual(Object.keys(request).sort(), ["id", "kind", "layoutKeys", "pageId", "startedAt", "templateRefs"]);
  assert.match(request.id, uuid); assert.equal(request.kind, "page-composition-state");
  assert.ok(Number.isSafeInteger(request.pageId) && request.pageId > 0);
  assert.ok(typeof request.startedAt === "string" && Number.isFinite(Date.parse(request.startedAt)));
  assert.ok(Array.isArray(request.layoutKeys) && request.layoutKeys.length <= 2);
  assert.ok(request.layoutKeys.every(key => /^qa-core-layout-[a-z0-9-]{1,45}$/u.test(key)));
  assert.equal(new Set(request.layoutKeys).size, request.layoutKeys.length);
  assert.ok(Array.isArray(request.templateRefs) && request.templateRefs.length > 0 && request.templateRefs.length <= 9);
  for (const reference of request.templateRefs) {
    assert.deepEqual(Object.keys(reference).sort(), ["id", "kind"]);
    assert.ok(Object.hasOwn(templateTables, reference.kind));
    assert.ok(Number.isSafeInteger(reference.id) && reference.id > 0);
  }
  assert.equal(new Set(request.templateRefs.map(ref => ref.kind + ":" + ref.id)).size, request.templateRefs.length);
  return request;
}

export async function readCorePageCompositionCheckpoint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle);
  const request = validateCorePageCompositionRequest(input);
  const snapshot = await handle.withDatabaseConnection(async connection => {
    await connection.query("begin isolation level repeatable read read only");
    let committed = false;
    try {
      await connection.query("set local statement_timeout='15000ms'");
      await connection.query("set local lock_timeout='3000ms'");
      // Fixed identity from prepareOwnedAdminMeasurementAccount; the caller cannot select an actor.
      const actors = (await connection.query(
        "select id from public.admin_users where username='qa_admin_interaction' and email='qa-admin-interaction@example.invalid' and role='admin' and is_active=true limit 2")).rows;
      assert.equal(actors.length, 1, "Exactly one active canonical QA actor is required.");
      const qaActorId = Number(actors[0].id);
      assert.ok(Number.isSafeInteger(qaActorId) && qaActorId > 0);
      const pages = (await connection.query(
        "select id,title,slug,path,status,layout_id,md5(to_jsonb(p)::text) as row_hash from public.pages p where id=$1 and slug='qa-admin-page-interaction'",
        [request.pageId])).rows;
      assert.equal(pages.length, 1, "Only the existing owned QA page is eligible.");
      const page = pages[0];
      const assignments = (await connection.query(
        "select kind,id,page_id,template_id,slot,sort_order,is_visible,updated_at::text from public.page_composition_assignments where page_id=$1 order by kind,id limit 129",
        [request.pageId])).rows;
      assert.ok(assignments.length <= 128, "Unexpected QA composition size.");
      const layouts = (await connection.query(
        "select id,key,admin_label from public.page_composition_layouts where id=$1 or key=any($2::text[]) order by id",
        [page.layout_id, request.layoutKeys])).rows;
      assert.ok(layouts.length > 0 && layouts.length <= 3);
      const regions = (await connection.query(
        "select layout_id,key,admin_label,sort_order from public.page_composition_regions where layout_id=any($1::bigint[]) order by layout_id,sort_order,key limit 193",
        [layouts.map(layout => layout.id)])).rows;
      assert.ok(regions.length <= 192, "Unexpected QA layout region count.");
      const audit = (await connection.query(
        "select id,action,entity_type,entity_id,actor_admin_user_id,metadata->>'operation' operation,metadata->>'persistence_owner' persistence_owner,metadata->'atomic' atomic from public.admin_audit_logs where entity_type='page_composition' and entity_id=$1 and created_at >= $2::timestamptz order by id limit 257",
        [request.pageId, request.startedAt])).rows;
      assert.ok(audit.length <= 256);
      for (const entry of audit) assert.equal(Number(entry.actor_admin_user_id), qaActorId, "Composition audit must belong to the canonical QA actor.");
      const templates = [];
      for (const reference of request.templateRefs) {
        const rows = (await connection.query(
          "select id,name,slug,status,md5(config::text) config_hash from public." + templateTables[reference.kind] + " where id=$1 and slug like $2",
          [reference.id, "qa-admin-page-interaction-" + reference.kind + "-%"])).rows;
        assert.equal(rows.length, 1, "The reserved QA template must remain in its existing library.");
        templates.push({ kind: reference.kind, ...rows[0] });
      }
      await connection.query("commit"); committed = true;
      return { qaActorId, page, assignments, layouts, regions, audit, templates };
    } finally { if (!committed) await connection.query("rollback"); }
  });
  assertOwnedLocalHandle(handle);
  return { id: request.id, kind: request.kind, status: "pass", ownedRunId: handle.identity.runId,
    pageId: request.pageId, startedAt: request.startedAt, ...snapshot,
    scope: "Fixed current QA page, canonical assignment view, selected/requested QA layouts and regions, reserved templates and page-bound composition audits; read-only, no Product or global closure claim." };
}
