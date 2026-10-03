import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import { assertOwnedLocalHandle, type OwnedLocalHandle, type OwnedDatabaseConnection } from "./lib/isolated-supabase.mts";
import type { TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";

type Sql = Pick<OwnedDatabaseConnection, "query">;
type Mode = "single" | "selected" | "empty_trash";
type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };
const settle = async (operation: Promise<unknown>): Promise<Outcome> => {
  try { return { ok: true, value: await operation }; }
  catch (error) { const failure = error as { code?: string; message?: string }; return { ok: false, code: failure.code ?? "unknown", message: failure.message ?? "" }; }
};

/** Native transaction proof only. Authenticated Admin/browser behavior is a separate gate. */
export async function verifyMenuResourceIntegrity(handle: OwnedLocalHandle, options: { draftMigrationPath?: string } = {}) {
  assertOwnedLocalHandle(handle);
  const existing = (await handle.query("select count(*)::int count from pg_constraint where conrelid='public.menu_items'::regclass and conname like 'menu_items_linked_%_fkey'")).rows[0].count;
  if (existing === 0) {
    assert.ok(options.draftMigrationPath, "Reviewed Menu reference migration must already be applied or explicitly supplied for this owned fixture.");
    await handle.query(readFileSync(options.draftMigrationPath, "utf8"));
  }
  const constraints = (await handle.query("select conname,convalidated,confdeltype from pg_constraint where conrelid='public.menu_items'::regclass and conname like 'menu_items_linked_%_fkey' order by conname")).rows;
  assert.equal(constraints.length, 5);
  assert.ok(constraints.every(row => row.convalidated === true && row.confdeltype === "r"));
  const actor = (await handle.query("select id,username from public.admin_users where is_active order by id limit 1")).rows[0];
  assert.ok(actor);
  assert.equal(Number((await handle.query("select count(*) count from public.topics where deleted_at is not null")).rows[0].count), 0, "Empty Trash scenarios require a fresh isolated trash set.");
  const seo = loadEntitySeoPersistenceOwner();
  let sequence = 0;
  const records: Array<Record<string, unknown>> = [];
  const allMenus: number[] = [];
  const allTopics: number[] = [];
  const createTopic = async (trashed = true) => {
    const slug = `audit2-menu-integrity-${++sequence}`;
    const row = { slug, title: "موضوع للتحقق من سلامة مراجع القائمة", excerpt: "بيانات اصطناعية للتحقق من التزامن داخل قاعدة البيانات المعزولة.",
      content: "محتوى معزول لاختبار اتساق الحذف والمرجع. ".repeat(20), image: "/images/venesia-5.png", image_alt: "صورة الاختبار",
      category: "اختبار", category_slug: "audit2", content_type: "article", status: "unpublished", deleted_at: trashed ? "2026-09-26T00:00:00Z" : null,
      focus_keyword: "سلامة", seo_title: "موضوع للتحقق من سلامة مراجع القائمة", seo_description: "بيانات اصطناعية للتحقق من التزامن داخل قاعدة البيانات المعزولة.", faq: [], seo_keywords: ["سلامة"] };
    const payload = { ...row, ...seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as unknown as TopicSeoSource)) };
    const keys = Object.keys(payload);
    const values = Object.values(payload).map((value, index) => ["faq"].includes(keys[index]) ? JSON.stringify(value) : value);
    const created = (await handle.query(`insert into public.topics(${keys.map(key => `"${key}"`).join(",")}) values(${keys.map((_, index) => `$${index + 1}`).join(",")}) returning id`, values)).rows[0];
    const id = Number(created.id); allTopics.push(id); return id;
  };
  const createFixture = async (mode: Mode) => {
    const ids = await Promise.all(Array.from({ length: mode === "single" ? 1 : 2 }, () => createTopic()));
    const menu = (await handle.query("insert into public.menus(name,slug) values('Audit reference integrity',$1) returning id", [`audit2-reference-menu-${++sequence}`])).rows[0];
    const menuId = Number(menu.id); allMenus.push(menuId);
    return { ids, menuId, targetId: ids.at(-1)! };
  };
  const mutateMenu = async (db: Sql, menuId: number, linkedType: string | null, linkedId: number | null, itemType = "topic", href = "/topics/fixture") => {
    const item = { label: "Audit reference", item_type: itemType, href, linked_type: linkedType, linked_id: linkedId, is_visible: true };
    return (await db.query("select public.mutate_menu_tree($1,'save_item',$2::jsonb,$3,$4) result", [menuId, JSON.stringify({ item }), actor.id, actor.username])).rows[0].result;
  };
  const purge = async (db: Sql, mode: Mode, ids: number[]) => {
    const result = (await db.query("select public.admin_mutate_topics_batch_atomically($1,$2,$3::bigint[],null,$4) result", [actor.id, mode === "empty_trash" ? "empty_trash" : "permanent_delete", ids, mode === "empty_trash" ? ids.length : null])).rows[0].result as { ok: boolean; changedIds: number[] };
    assert.equal(result.ok, true);
    assert.deepEqual(result.changedIds.map(Number).sort((a: number, b: number) => a - b), [...ids].sort((a, b) => a - b));
    return result;
  };
  const state = async (fixture: { ids: number[]; menuId: number }) => {
    const targets = Number((await handle.query("select count(*) count from public.topics where id=any($1::bigint[])", [fixture.ids])).rows[0].count);
    const links = Number((await handle.query("select count(*) count from public.menu_items where menu_id=$1 and linked_type='topics'", [fixture.menuId])).rows[0].count);
    return { targets, links };
  };
  const cleanupFixture = async (fixture: { ids: number[]; menuId: number }) => {
    await handle.query("select public.mutate_menu_tree($1,'delete_menu','{}'::jsonb,$2,$3)", [fixture.menuId, actor.id, actor.username]);
    await handle.query("delete from public.topics where id=any($1::bigint[])", [fixture.ids]);
  };
  const waitBlocked = async (waitingPid: number, blockingPid: number) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const row = (await handle.query("select pid,wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1", [waitingPid])).rows[0];
      if (row?.wait_event_type === "Lock" && Array.isArray(row.blockers) && row.blockers.map(Number).includes(blockingPid)) return row;
      await new Promise(done => setTimeout(done, 60));
    }
    assert.fail("Native lock wait was not observed; a timing-only race is insufficient proof.");
  };
  try {
    for (const mode of ["single", "selected", "empty_trash"] as const) {
      const fixture = await createFixture(mode);
      await mutateMenu(handle, fixture.menuId, "topics", fixture.targetId);
      const result = await settle(purge(handle, mode, fixture.ids));
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "23503");
      assert.deepEqual(await state(fixture), { targets: fixture.ids.length, links: 1 });
      records.push({ scenario: "existing-reference", mode, rejectedCode: !result.ok && result.code });
      await cleanupFixture(fixture);
    }
    for (const isolation of ["read committed", "repeatable read"] as const) {
      for (const mode of ["single", "selected", "empty_trash"] as const) {
        for (const ordering of ["reference-first", "delete-first"] as const) {
          for (const release of isolation === "read committed" ? ["commit", "rollback"] as const : ["commit"] as const) {
            const fixture = await createFixture(mode);
            await handle.withDatabaseConnection(async first => handle.withDatabaseConnection(async second => {
              const firstPid = Number((await first.query("select pg_backend_pid() pid")).rows[0].pid);
              const secondPid = Number((await second.query("select pg_backend_pid() pid")).rows[0].pid);
              let pending: Promise<Outcome> | undefined;
              try {
                for (const db of [first, second]) {
                  await db.query(`begin isolation level ${isolation}`);
                  await db.query("set local statement_timeout='20s'");
                  await db.query("set local role service_role");
                  await db.query("select count(*) from public.topics where id=any($1::bigint[])", [fixture.ids]);
                }
                if (ordering === "reference-first") {
                  await mutateMenu(first, fixture.menuId, "topics", fixture.targetId);
                  pending = settle(purge(second, mode, fixture.ids));
                } else {
                  await purge(first, mode, fixture.ids);
                  pending = settle(mutateMenu(second, fixture.menuId, "topics", fixture.targetId));
                }
                const blocked = await waitBlocked(secondPid, firstPid);
                await first.query(release);
                const result = await pending;
                if (release === "commit") {
                  assert.equal(result.ok, false);
                  if (!result.ok) assert.ok(["23503", ...(isolation === "repeatable read" ? ["40001"] : [])].includes(result.code));
                  await second.query("rollback");
                  assert.deepEqual(await state(fixture), ordering === "reference-first" ? { targets: fixture.ids.length, links: 1 } : { targets: 0, links: 0 });
                } else {
                  assert.equal(result.ok, true);
                  await second.query("commit");
                  assert.deepEqual(await state(fixture), ordering === "reference-first" ? { targets: 0, links: 0 } : { targets: fixture.ids.length, links: 1 });
                }
                records.push({ scenario: "native-race", mode, isolation, ordering, firstRelease: release, observedLock: blocked.wait_event, blockingPidVerified: true, second: result.ok ? "committed" : result.code, state: await state(fixture) });
              } finally {
                await first.query("rollback");
                if (pending) await pending;
                await second.query("rollback");
              }
            }));
            await cleanupFixture(fixture);
          }
        }
      }
    }
    const fixture = await createFixture("single");
    const category = (await handle.query("select id from public.topic_categories order by id limit 1")).rows[0];
    assert.ok(category);
    let series = (await handle.query("select id from public.topic_series order by id limit 1")).rows[0];
    let createdSeries: number | undefined;
    if (!series) { series = (await handle.query("insert into public.topic_series(name,slug,category_id) values('Audit reference series','audit2-reference-series',$1) returning id", [category.id])).rows[0]; createdSeries = Number(series.id); }
    const types = [["pages", "page"], ["projects", "project"], ["topics", "topic"], ["topic_categories", "topic_category"], ["topic_series", "custom"]] as const;
    for (const [provider, itemType] of types) {
      const id = provider === "topics" ? fixture.targetId : Number((await handle.query(`select id from public.${provider} order by id limit 1`)).rows[0].id);
      await mutateMenu(handle, fixture.menuId, provider, id, itemType);
      const before = Number((await handle.query("select count(*) count from public.menu_items where menu_id=$1", [fixture.menuId])).rows[0].count);
      const rejected = await settle(mutateMenu(handle, fixture.menuId, provider, 9007199254740991, itemType));
      assert.equal(rejected.ok, false);
      if (!rejected.ok) assert.equal(rejected.code, "23503");
      assert.equal(Number((await handle.query("select count(*) count from public.menu_items where menu_id=$1", [fixture.menuId])).rows[0].count), before);
      records.push({ scenario: "typed-provider", provider, validTargetAccepted: true, missingTargetRejected: true, failedMenuWriteAtomic: true });
    }
    for (const [linkedType, itemType, href] of [["static_routes", "page", "/"], [null, "external", "https://example.invalid/"], [null, "anchor", "#content"]] as const) await mutateMenu(handle, fixture.menuId, linkedType, null, itemType, href);
    records.push({ scenario: "non-resource-links", staticRoute: true, external: true, anchor: true });
    await cleanupFixture(fixture);
    if (createdSeries) await handle.query("delete from public.topic_series where id=$1", [createdSeries]);
    const orphanCount = Number((await handle.query("select count(*) count from public.menu_items m where m.linked_type='topics' and m.linked_id is not null and not exists(select 1 from public.topics t where t.id=m.linked_id)")).rows[0].count);
    assert.equal(orphanCount, 0);
    return { status: "complete", constraints, cases: records.length, records, orphanCount, transport: "actual PostgreSQL RPCs through opaque owned native connections", authBrowserProof: false };
  } finally {
    for (const menuId of allMenus) if (Number((await handle.query("select count(*) count from public.menus where id=$1", [menuId])).rows[0].count)) await handle.query("select public.mutate_menu_tree($1,'delete_menu','{}'::jsonb,$2,$3)", [menuId, actor.id, actor.username]);
    await handle.query("delete from public.topics where id=any($1::bigint[])", [allTopics]);
  }
}
