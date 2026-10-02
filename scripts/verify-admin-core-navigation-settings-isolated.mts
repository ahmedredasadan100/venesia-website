import {CORE_DOWNLOAD_MEDIA_HREF,CORE_DOWNLOAD_LINK} from './fixtures/admin-core-download-media-adoption.mjs';
import {recordCoreDownloadCheckpoint,prepareCoreDownloadMediaFixture,assertCoreDownloadMediaUnchanged} from './verify-admin-core-download-media-isolated.mts';
import {CORE_NAVIGATION_FOOTER_SELECTION,CORE_NAVIGATION_GRAPH_FOOTER_SELECTION,CORE_NAVIGATION_MENU_FOOTER_SELECTION,isCoreNavigationExistingSelection,isCoreNavigationFollowupSelection} from "./fixtures/admin-core-navigation-settings-journeys.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { FOOTER_SETTING_KEYS } from "../src/lib/footer/types.ts";
import type { FooterSlot } from "../src/lib/footer/footer-slot-types.ts";

const root = resolve(import.meta.dirname, "..");
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
type Row = Record<string, unknown>;
export const NAVIGATION_SETTINGS_PHASES = {
  page: ["baseline", "rejected", "created", "seo-rejected", "seo-saved"],
  menu: ["baseline", "rejected", "created", "created-row-inspected", "metadata-saved", "item-a", "item-b", "item-c", "items-inspected", "item-edited", "reparented", "reordered", "hidden", "cycle-rejected", "delete-cancelled", "subtree-deleted", "menu-hidden", "duplicated", "duplicate-delete-cancelled", "duplicate-deleted", "menu-shown"],
  footer: ["baseline", "draft", "delete-cancelled", "draft-final", "visibility-draft", "rejected", "saved", "reloaded", "visibility-shown-draft", "shown-saved", "shown-reloaded", "restore-cancelled", "restore-rejected", "restored", "restore-reloaded"],
} as const;
type Entity = keyof typeof NAVIGATION_SETTINGS_PHASES;
export function coreNavigationPhases(selection:string|null=null):Record<Entity,readonly string[]>{if(selection===null)return NAVIGATION_SETTINGS_PHASES;assert.ok(isCoreNavigationFollowupSelection(selection));if(selection===CORE_NAVIGATION_FOOTER_SELECTION)return{page:[],menu:[],footer:NAVIGATION_SETTINGS_PHASES.footer};return isCoreNavigationExistingSelection(selection)?{page:[CORE_NAVIGATION_MENU_FOOTER_SELECTION,CORE_NAVIGATION_GRAPH_FOOTER_SELECTION].includes(selection)?[]:NAVIGATION_SETTINGS_PHASES.page.slice(3),menu:selection===CORE_NAVIGATION_GRAPH_FOOTER_SELECTION?NAVIGATION_SETTINGS_PHASES.menu.slice(3,16):NAVIGATION_SETTINGS_PHASES.menu.slice(3),footer:NAVIGATION_SETTINGS_PHASES.footer}:NAVIGATION_SETTINGS_PHASES;}
export const CORE_NAVIGATION_RECIPE = {
  page: { title: "صفحة إثبات التنقل", path: "/qa-core-navigation-page", slug: "qa-core-navigation-page", seoTitle: "صفحة إثبات التنقل وإدارة المعلومات في الاختبار المعزول", seoDescription: "إثبات التنقل يراجع حفظ بيانات الصفحة والوصف والكلمات المفتاحية داخل البيئة المعزولة، مع بقاء الصفحة غير منشورة والتحقق من سجل التدقيق بعد الحفظ.", focusKeyword: "إثبات التنقل", seoKeywords: ["إثبات التنقل", "اختبار معزول"], canonicalUrl: "https://example.invalid/qa-core-navigation-page" },
  menu: { name: "قائمة إثبات التنقل", editedName: "قائمة إثبات التنقل المعدلة", slug: "qa-core-navigation-menu", a: "أصل التنقل الأول", b: "أصل التنقل الثاني", c: "فرع التنقل", editedC: "فرع التنقل المعدل", href: "https://example.invalid/navigation/child", editedHref: "https://example.invalid/navigation/edited", css: "qa-navigation-child" },
  footer: { headings: ["إثبات النص", "إثبات الروابط", "إثبات القائمة", "إثبات التواصل"], title: "عنوان الفوتر المعزول", body: "نص فوتر معزول للتحقق من الحفظ", contactLabel: "تواصل الاختبار", contactValue: "القاهرة المعزولة", socialLabel: "سوشيال الاختبار", socialHref: "https://example.invalid/footer/social", copyright: "QA Footer Copyright", tagline: "QA Footer Tagline", links: ["رابط الفوتر الأول", "رابط الفوتر الثاني", "رابط الفوتر الثالث"], editedLink: "رابط الفوتر الثاني المعدل", hrefs: ["https://example.invalid/footer/one", "https://example.invalid/footer/two", "https://example.invalid/footer/three"], editedHref: "https://example.invalid/footer/edited" },
} as const;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const select = (row: Row, keys: string[]) => Object.fromEntries(keys.map(key => [key, row[key]]));
const graphSelect = (row: Row, keys: string[]) => Object.fromEntries(keys.map(key => [key, ["id", "menu_id", "parent_id", "linked_id"].includes(key) && row[key] != null ? Number(row[key]) : row[key]]));
type State = { selection:string|null; prepared:Row|null; actor: { id: number; username: string }; originalFooter: Row[]; baselineFooter: Row[]; originalMenus: Row[]; originalItems: Row[]; originalPages: Row[]; phase: Record<Entity, number>; auditCursor: Record<Entity, number>; last: Partial<Record<Entity, unknown>>; pageId?: number; menuId?: number; duplicateId?: number; itemIds: Record<string, number>; cleanup: boolean };
const states = new WeakMap<OwnedLocalHandle, State>();
const footerRows = async (handle: OwnedLocalHandle) => (await handle.query("select key,value,updated_at from public.site_settings where key=any($1::text[]) order by key", [[...FOOTER_SETTING_KEYS]])).rows;
const auditHead = async (handle: OwnedLocalHandle) => Number((await handle.query("select coalesce(max(id),0)::bigint id from public.admin_audit_logs")).rows[0].id);
const valuesOnly = (rows: Row[]) => rows.map(row => ({ key: row.key, value: row.value })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
const footerUtils = () => jiti.import<typeof import("../src/app/admin/pages-blocks/footer/footer-builder-utils.ts")>(resolve(root, "src/app/admin/pages-blocks/footer/footer-builder-utils.ts"));

/** Fixed isolated preparation. Footer originals remain private and are never accepted from Browser. */
export async function prepareCoreNavigationSettingsFixtures(handle: OwnedLocalHandle, credentials: { username: string },selection:string|null=null) {
  assertOwnedLocalHandle(handle); assert.equal(states.has(handle), false);coreNavigationPhases(selection);
  const actors = (await handle.query("select id,username from public.admin_users where username=$1 and is_active", [credentials.username])).rows;
  assert.equal(actors.length, 1); const actor = { id: Number(actors[0].id), username: String(actors[0].username) };
  const originalPages = (await handle.query("select * from public.pages order by id")).rows;
  const originalMenus = (await handle.query("select * from public.menus order by id")).rows;
  const originalItems = (await handle.query("select * from public.menu_items order by id")).rows;
  assert.ok(!originalPages.some(row => row.path === CORE_NAVIGATION_RECIPE.page.path || row.slug === CORE_NAVIGATION_RECIPE.page.slug));
  assert.ok(!originalMenus.some(row => row.slug === CORE_NAVIGATION_RECIPE.menu.slug));
  assert.ok(originalPages.length && originalMenus.length, "Canonical isolated baseline supplies duplicate identity controls.");
  const originalFooter = await footerRows(handle);
  const state: State = { selection,prepared:null,actor, originalFooter, baselineFooter: [], originalMenus, originalItems, originalPages, phase: { page: 0, menu: 0, footer: 0 }, auditCursor: { page: 0, menu: 0, footer: 0 }, last: {}, itemIds: {}, cleanup: false };
  states.set(handle, state); // Retain restoration ownership even when later preparation fails.
  const { evaluateFooterReadiness } = await jiti.import<typeof import("../src/lib/footer/footer-settings-readiness.ts")>(resolve(root, "src/lib/footer/footer-settings-readiness.ts"));
  const value = (key: string) => originalFooter.find(row => row.key === key)?.value;
  const valid = originalFooter.length === FOOTER_SETTING_KEYS.length && evaluateFooterReadiness({ slots: value("footer.slots"), contactItems: value("footer.contact_items"), socialLinks: value("footer.social_links"), legal: value("footer.legal") }).systemValid;
  if (!valid) {
    const { createFreshFooterSettings } = await jiti.import<typeof import("../src/lib/footer/defaults.ts")>(resolve(root, "src/lib/footer/defaults.ts"));
    const settings = createFreshFooterSettings();
    const { changeSlotType } = await footerUtils();
    let fresh = settings.slots.slots;
    for (const slot of fresh) fresh = changeSlotType(fresh, slot.index, "text");
    const baseline = [{ key: "footer.slots", value: { version: 1, slots: fresh } }, { key: "footer.contact_items", value: [] }, { key: "footer.social_links", value: [{ platform: "facebook", label: "QA baseline", href: "https://example.invalid/footer/baseline" }] }, { key: "footer.legal", value: { copyright: "QA baseline", tagline: "QA baseline" } }];
    await handle.query("select public.save_footer_settings($1::jsonb,$2,$3,'qa.navigation.footer.prepare','{}'::jsonb)", [JSON.stringify(baseline), actor.id, actor.username]);
  }
  if(isCoreNavigationExistingSelection(selection)){
    await handle.withDatabaseConnection(async connection=>{await connection.query('begin');try{
      const page=(await connection.query("insert into public.pages(title,slug,path,page_type,status) values($1,$2,$3,'static','unpublished') returning *",[CORE_NAVIGATION_RECIPE.page.title,CORE_NAVIGATION_RECIPE.page.slug,CORE_NAVIGATION_RECIPE.page.path])).rows;assert.equal(page.length,1);
      const menu=(await connection.query("insert into public.menus(name,slug,location,is_active) values($1,$2,'custom',true) returning *",[selection===CORE_NAVIGATION_FOOTER_SELECTION?CORE_NAVIGATION_RECIPE.menu.editedName:CORE_NAVIGATION_RECIPE.menu.name,CORE_NAVIGATION_RECIPE.menu.slug])).rows;assert.equal(menu.length,1);
      state.pageId=Number(page[0].id);state.menuId=Number(menu[0].id);for(const id of[state.pageId,state.menuId])assert.ok(Number.isSafeInteger(id)&&id>0);
      if(selection===CORE_NAVIGATION_FOOTER_SELECTION){await connection.query("select public.mutate_menu_tree($1,'save_item',$2::jsonb,$3,$4)",[state.menuId,JSON.stringify({item:{parent_id:null,label:CORE_NAVIGATION_RECIPE.menu.a,href:'#',linked_type:null,linked_id:null,anchor:null,target:'_self',css_class:null,style_preset:'default',is_visible:true,item_type:'parent',sort_order:10}}),actor.id,actor.username]);const item=(await connection.query('select id from public.menu_items where menu_id=$1 order by id',[state.menuId])).rows;assert.equal(item.length,1);state.itemIds.a=Number(item[0].id);assert.ok(Number.isSafeInteger(state.itemIds.a)&&state.itemIds.a>0);}
      await connection.query('commit');
    }catch(error){await connection.query('rollback');throw error;}});
    assert.ok(state.pageId!==undefined&&state.menuId!==undefined);
    const pages=(await handle.query('select * from public.pages where id=$1',[state.pageId])).rows,menus=(await handle.query('select * from public.menus where id=$1',[state.menuId])).rows,items=(await handle.query('select * from public.menu_items where menu_id=$1',[state.menuId])).rows;
    assert.equal(pages.length,1);assert.equal(menus.length,1);if(selection===CORE_NAVIGATION_FOOTER_SELECTION)assertCoreNavigationGraph(items,state.menuId,'subtree-deleted',state.itemIds);else assert.deepEqual(items,[]);assert.equal(Number((await handle.query('select count(*)::int count from public.page_composition_assignments where page_id=$1',[state.pageId])).rows[0].count),0);
    assert.deepEqual(select(pages[0],['title','slug','path','page_type','status']),{title:CORE_NAVIGATION_RECIPE.page.title,slug:CORE_NAVIGATION_RECIPE.page.slug,path:CORE_NAVIGATION_RECIPE.page.path,page_type:'static',status:'unpublished'});assert.deepEqual(select(menus[0],['name','slug','location','is_active']),{name:selection===CORE_NAVIGATION_FOOTER_SELECTION?CORE_NAVIGATION_RECIPE.menu.editedName:CORE_NAVIGATION_RECIPE.menu.name,slug:CORE_NAVIGATION_RECIPE.menu.slug,location:'custom',is_active:true});
    assert.deepEqual((await handle.query('select * from public.pages where id<>$1 order by id',[state.pageId])).rows,originalPages);assert.deepEqual((await handle.query('select * from public.menus where id<>$1 order by id',[state.menuId])).rows,originalMenus);assert.deepEqual((await handle.query('select * from public.menu_items where menu_id<>$1 order by id',[state.menuId])).rows,originalItems);
    state.last.page=structuredClone(pages);state.last.menu=structuredClone({menus,items});state.auditCursor.page=await auditHead(handle);state.auditCursor.menu=state.auditCursor.page;
    const prepared={kind:'owned-fixture-preparation',ownedRunId:handle.identity.runId,pageId:state.pageId,menuId:state.menuId,pageSnapshotHash:hash(state.last.page),menuSnapshotHash:hash(state.last.menu),uiCreateClaim:false,automaticCoverage:[],globalClosed:false};state.prepared=prepared;handle.record('navigation-existing-fixture-prepared',{kind:prepared.kind,ownedRunId:prepared.ownedRunId,pageId:prepared.pageId,menuId:prepared.menuId,pageSnapshotHash:prepared.pageSnapshotHash,menuSnapshotHash:prepared.menuSnapshotHash,uiCreateClaim:prepared.uiCreateClaim,globalClosed:prepared.globalClosed});
  }
  state.baselineFooter = await footerRows(handle);
  return { selection,prepared:clone(state.prepared),footerRestore:{key:'footer.slots' as const}, downloadMedia:await prepareCoreDownloadMediaFixture(handle),recipe: clone(CORE_NAVIGATION_RECIPE), duplicatePagePath: String(originalPages[0].path), duplicateMenuSlug: String(originalMenus[0].slug), footerBaselineSeeded: !valid, originalFooterHash: hash(originalFooter), phaseCounts: Object.fromEntries(Object.entries(coreNavigationPhases(selection)).map(([key, phases]) => [key, phases.length])) };
}

export function validateCoreNavigationSettingsRequest(input: unknown) {
  assert.ok(input && typeof input === "object"); const row = input as Record<string, unknown>;
  assert.deepEqual(Object.keys(row).sort(), ["entity", "id", "kind", "phase"]);
  assert.equal(row.kind, "navigation-settings-state"); assert.match(String(row.id), /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);
  assert.ok(Object.hasOwn(NAVIGATION_SETTINGS_PHASES, String(row.entity)));
  assert.ok((NAVIGATION_SETTINGS_PHASES[row.entity as Entity] as readonly string[]).includes(String(row.phase)));
  return row as { id: string; kind: string; entity: Entity; phase: string };
}

/** Pure fixed graph assertion, used by native checkpoints and adversarial offline controls. */
export function assertCoreNavigationGraph(items: Row[], menuId: number, phase: string, ids: Record<string, number>) {
  const r = CORE_NAVIGATION_RECIPE.menu;
  const rank = NAVIGATION_SETTINGS_PHASES.menu.indexOf(phase as typeof NAVIGATION_SETTINGS_PHASES.menu[number]);
  const after = (name: typeof NAVIGATION_SETTINGS_PHASES.menu[number]) => rank >= NAVIGATION_SETTINGS_PHASES.menu.indexOf(name);
  const expected: Row[] = [];
  const base = { menu_id: menuId, href: "#", linked_type: null, linked_id: null, anchor: null, target: "_self", css_class: null, style_preset: "default", is_visible: true, item_type: "parent" };
  if (after("item-a")) expected.push({ ...base, id: ids.a, parent_id: null, label: r.a, sort_order: after("reordered") && !after("subtree-deleted") ? 20 : 10 });
  if (after("item-b") && !after("subtree-deleted")) expected.push({ ...base, id: ids.b, parent_id: null, label: r.b, sort_order: after("reordered") ? 10 : 20 });
  if (after("item-c") && !after("subtree-deleted")) expected.push({ ...base, id: ids.c, parent_id: after("reparented") ? ids.b : ids.a, label: after("item-edited") ? r.editedC : r.c, item_type: after("item-edited") ? "custom" : "external", href: after("item-edited") ? CORE_DOWNLOAD_MEDIA_HREF : r.href, target: "_blank", css_class: after("item-edited") ? r.css : null, style_preset: after("item-edited") ? "gold-card" : "default", is_visible: !after("hidden"), sort_order: 10 });
  assert.equal(new Set(items.map(row => row.id)).size, items.length);
  const keys = ["id", ...Object.keys(base), "parent_id", "label", "sort_order"];
  assert.deepEqual(items.map(row => graphSelect(row, keys)).sort((a, b) => Number(a.id) - Number(b.id)), expected.map(row => select(row, keys)).sort((a, b) => Number(a.id) - Number(b.id)), "Exact bounded Menu graph and all authored fields must match.");
}

export async function buildExpectedCoreNavigationFooter(baselineFooter: Row[], menuId: number, editedLinkVisible = false) {
  const r = CORE_NAVIGATION_RECIPE.footer;
  const { changeSlotType, moveFooterSlotInOrder, normalizeSlotsForSave } = await footerUtils();
  const { createFreshFooterSettings } = await jiti.import<typeof import("../src/lib/footer/defaults.ts")>(resolve(root, "src/lib/footer/defaults.ts"));
  const { serializeAdminLink } = await jiti.import<typeof import("../src/lib/admin/links/serialize.ts")>(resolve(root, "src/lib/admin/links/serialize.ts"));
  const { parseFooterContactItems } = await jiti.import<typeof import("../src/lib/footer/parse-footer-settings.ts")>(resolve(root, "src/lib/footer/parse-footer-settings.ts"));
  let slots = createFreshFooterSettings().slots.slots;
  for (const [i, type] of (["text", "custom_links", "menu", "contact"] as const).entries()) slots = changeSlotType(slots, (i + 1) as FooterSlot["index"], type);
  slots = slots.map((slot, i) => ({ ...slot, enabled: true, heading: r.headings[i] }));
  slots[0].config = { title: r.title, body: r.body, showBrandIcon: false, cta: { enabled: false, label: "", href: "", target: "_self" } };
  slots[1].config = { links: [
    { label: r.editedLink, href: "", target: "_self", visible: editedLinkVisible, sortOrder: 0, link: serializeAdminLink(CORE_DOWNLOAD_LINK) },
    { label: r.links[0], href: "", target: "_self", visible: true, sortOrder: 1, link: serializeAdminLink({ link_kind: "external", href: r.hrefs[0], target: "_blank" }) },
  ] };
  // Keep defaults from the actual owner for unedited configuration fields.
  slots[2].config = { ...slots[2].config, source: "menu_id", menuId } as FooterSlot["config"];
  slots[3].config = { source: "custom", items: [{ label: r.contactLabel, value: r.contactValue, href: "", icon: "", visible: true }] };
  slots = moveFooterSlotInOrder(slots, 1, "later");
  const originalContacts = baselineFooter.find(row => row.key === "footer.contact_items")?.value;
  return clone(valuesOnly([{ key: "footer.slots", value: normalizeSlotsForSave(slots) }, { key: "footer.contact_items", value: parseFooterContactItems(originalContacts, []) }, { key: "footer.social_links", value: [{ platform: "facebook", label: r.socialLabel, href: r.socialHref }] }, { key: "footer.legal", value: { copyright: r.copyright, tagline: r.tagline } }]));
}

/** Exact persisted defaults command: one owned slot row changes; the other three rows and their timestamps remain byte-equivalent. */
export function assertCoreFooterRestore(before: Row[], after: Row[], defaultSlots: unknown, audit: Row[], actorId: number) {
  for (const rows of [before,after]) assert.deepEqual(rows.map(row=>row.key).sort(), [...FOOTER_SETTING_KEYS].sort());
  assert.deepEqual(after.filter(row=>row.key!=='footer.slots'), before.filter(row=>row.key!=='footer.slots'));
  assert.deepEqual(after.find(row=>row.key==='footer.slots')!.value, defaultSlots);
  assert.equal(audit.length,1); const entry=audit[0];
  assert.equal(Number(entry.actor_admin_user_id),actorId); assert.equal(entry.action,'footer_settings.restore_default');
  assert.equal(entry.entity_type,'footer_settings'); assert.equal(entry.entity_id,null);
  const metadata=entry.metadata as Row; assert.equal(metadata.persistence_owner,'save_footer_settings'); assert.deepEqual(metadata.persisted_keys,['footer.slots']);
}

/** Browser names only a finite checkpoint; expected values and ownership stay server-side. */
export async function readCoreNavigationSettingsCheckpoint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle); const request = validateCoreNavigationSettingsRequest(input), state = states.get(handle); assert.ok(state);
  const { entity, phase } = request;
  assert.equal(phase, coreNavigationPhases(state.selection)[entity][state.phase[entity]], "No skipped, repeated or out-of-order checkpoint may promote coverage.");
  if (phase === "baseline") state.auditCursor[entity] = await auditHead(handle);
  const allMenus = (await handle.query("select * from public.menus order by id")).rows;
  const allItems = (await handle.query("select * from public.menu_items order by id")).rows;
  const allPages = (await handle.query("select * from public.pages order by id")).rows;
  const newPages = allPages.filter(row => !state.originalPages.some(old => old.id === row.id));
  if([CORE_NAVIGATION_MENU_FOOTER_SELECTION,CORE_NAVIGATION_GRAPH_FOOTER_SELECTION,CORE_NAVIGATION_FOOTER_SELECTION].includes(state.selection??""))assert.deepEqual(newPages,state.last.page,'Retained Page SEO is not replayed; owned prerequisite Page stays byte-identical during Menu/Footer work.');
  const newMenus = allMenus.filter(row => !state.originalMenus.some(old => old.id === row.id));
  assert.deepEqual(allMenus.filter(row => state.originalMenus.some(old => old.id === row.id)), state.originalMenus, "Other menus unchanged.");
  assert.deepEqual(allItems.filter(row => state.originalItems.some(old => old.id === row.id)), state.originalItems, "Other menu graphs unchanged.");
  assert.deepEqual(allPages.filter(row => state.originalPages.some(old => old.id === row.id)), state.originalPages, "Other pages unchanged.");
  const audit = (await handle.query("select id,actor_admin_user_id,action,entity_type,entity_id,metadata from public.admin_audit_logs where id>$1 and (entity_type=any($2::text[])) order by id", [state.auditCursor[entity], entity === "page" ? ["page"] : entity === "menu" ? ["menu", "menu_item"] : ["footer_settings"]])).rows;
  for (const entry of audit) assert.equal(Number(entry.actor_admin_user_id), state.actor.id, "Every observed domain write belongs to the prepared primary actor.");
  let snapshot: unknown; let writeAction: string | undefined;
  if (entity === "page") {
    assert.equal(newPages.length, ["baseline", "rejected"].includes(phase) ? 0 : 1);
    if (newPages.length) {
      const page = newPages[0], r = CORE_NAVIGATION_RECIPE.page; state.pageId ??= Number(page.id);
      assert.equal(Number(page.id), state.pageId); assert.equal(page.title, r.title); assert.equal(page.path, r.path); assert.equal(page.slug, r.slug); assert.equal(page.status, "unpublished"); assert.equal(page.page_type, "static");
      assert.equal(Number((await handle.query("select count(*)::integer count from public.page_composition_assignments where page_id=$1", [state.pageId])).rows[0].count), 0);
      if (phase === "seo-saved") {
        assert.deepEqual(select(page, ["seo_title", "seo_description", "focus_keyword", "seo_keywords", "canonical_url", "robots_index", "robots_follow"]), { seo_title: r.seoTitle, seo_description: r.seoDescription, focus_keyword: r.focusKeyword, seo_keywords: [...r.seoKeywords], canonical_url: r.canonicalUrl, robots_index: false, robots_follow: false });
        const seo = await jiti.import<typeof import("../src/lib/admin/seo/entity-seo-persistence.ts")>(resolve(root, "src/lib/admin/seo/entity-seo-persistence.ts"));
        const score = seo.deriveEntitySeoScore(seo.toPageSeoScoreInput({ ...page, semanticContent: "" }));
        assert.deepEqual(select(page, Object.keys(score)), score, "Current canonical SEO calculation must match persisted tuple.");
      }
    }
    snapshot = newPages; if (phase === "created") writeAction = "page.create"; if (phase === "seo-saved") writeAction = "page.update";
  } else if (entity === "menu") {
    const exists = !["baseline", "rejected"].includes(phase); const duplicated = ["duplicated", "duplicate-delete-cancelled"].includes(phase);
    assert.equal(newMenus.length, exists ? duplicated ? 2 : 1 : 0);
    if (exists) {
      const menu = newMenus.find(row => row.slug === CORE_NAVIGATION_RECIPE.menu.slug); assert.ok(menu); state.menuId ??= Number(menu.id);
      assert.equal(Number(menu.id), state.menuId); assert.equal(menu.location, "custom"); assert.equal(menu.name, ["created","created-row-inspected"].includes(phase) ? CORE_NAVIGATION_RECIPE.menu.name : CORE_NAVIGATION_RECIPE.menu.editedName);
      assert.equal(menu.is_active, phase === "menu-shown" || NAVIGATION_SETTINGS_PHASES.menu.indexOf(phase as never) < NAVIGATION_SETTINGS_PHASES.menu.indexOf("menu-hidden"));
      const items = allItems.filter(row => Number(row.menu_id) === state.menuId);
      for (const [key, label] of [["a", CORE_NAVIGATION_RECIPE.menu.a], ["b", CORE_NAVIGATION_RECIPE.menu.b], ["c", CORE_NAVIGATION_RECIPE.menu.c]]) { const row = items.find(item => item.label === label); if (row && !state.itemIds[key]) state.itemIds[key] = Number(row.id); }
      assertCoreNavigationGraph(items, state.menuId, phase, state.itemIds);
      if (duplicated) {
        const duplicate = newMenus.find(row => Number(row.id) !== state.menuId)!; state.duplicateId ??= Number(duplicate.id); assert.equal(Number(duplicate.id), state.duplicateId); assert.equal(duplicate.is_active, false); assert.equal(duplicate.location, `custom-copy-${state.duplicateId}`); assert.equal(duplicate.slug, `${CORE_NAVIGATION_RECIPE.menu.slug}-copy-${state.duplicateId}`); assert.equal(duplicate.name, `${CORE_NAVIGATION_RECIPE.menu.editedName} — نسخة`);
        const copies = allItems.filter(row => Number(row.menu_id) === state.duplicateId); assert.equal(copies.length, items.length);
        for (const [i, item] of items.entries()) { const copy = copies[i]; assert.ok(!items.some(row => row.id === copy.id)); assert.deepEqual(select(copy, ["label", "href", "parent_id", "sort_order", "is_visible"]), { ...select(item, ["label", "href", "parent_id", "sort_order"]), is_visible: false }); }
      }
      if (phase === "duplicate-deleted") assert.ok(!allItems.some(row => Number(row.menu_id) === state.duplicateId));
    }
    const actions: Record<string, string> = { created: "menu.create", "metadata-saved": "menu.update", "item-a": "menu.save_item", "item-b": "menu.save_item", "item-c": "menu.save_item", "item-edited": "menu.save_item", reparented: "menu.save_item", reordered: "menu.reorder", hidden: "menu_item.update", "subtree-deleted": "menu.delete_item", "menu-hidden": "menu.update", duplicated: "menu.duplicate_menu", "duplicate-deleted": "menu.delete_menu", "menu-shown": "menu.update" };
    writeAction = actions[phase]; snapshot = { menus: newMenus, items: allItems.filter(row => newMenus.some(menu => menu.id === row.menu_id)) };
  } else {
    assert.ok(state.menuId && state.pageId); assert.equal(state.phase.menu, coreNavigationPhases(state.selection).menu.length); assert.equal(state.phase.page, coreNavigationPhases(state.selection).page.length);
    assert.equal(newMenus.length, 1); assertCoreNavigationGraph(allItems.filter(row => Number(row.menu_id) === state.menuId), state.menuId, "duplicate-deleted", state.itemIds);
    if([CORE_NAVIGATION_GRAPH_FOOTER_SELECTION,CORE_NAVIGATION_FOOTER_SELECTION].includes(state.selection??"")) assert.deepEqual({menus:newMenus,items:allItems.filter(row=>newMenus.some(menu=>menu.id===row.menu_id))},state.last.menu,"Completed owned Menu graph and metadata remain unchanged through Footer work.");
    const footer = await footerRows(handle); snapshot = footer;
    const restored = phase === 'restored' || phase === 'restore-reloaded';
    const saved = ['saved','reloaded','visibility-shown-draft','shown-saved','shown-reloaded','restore-cancelled','restore-rejected'].includes(phase);
    const shown = ['shown-saved','shown-reloaded','restore-cancelled','restore-rejected'].includes(phase);
    if (restored) {
      const { DEFAULT_FOOTER_SLOTS } = await jiti.import<typeof import('../src/lib/footer/defaults.ts')>(resolve(root,'src/lib/footer/defaults.ts'));
      if (phase==='restored') { assertCoreFooterRestore(state.last.footer as Row[],footer,clone(DEFAULT_FOOTER_SLOTS),audit,state.actor.id); writeAction='footer_settings.restore_default'; }
      else assert.deepEqual(footer,state.last.footer);
    } else assert.deepEqual(valuesOnly(footer), saved ? await buildExpectedCoreNavigationFooter(state.baselineFooter, state.menuId, shown) : valuesOnly(state.baselineFooter));
    if (phase === "saved" || phase === "shown-saved") writeAction = "footer_settings.update";
  }
  if (writeAction) {
    assert.equal(audit.length, 1, "Each successful isolated UI command must commit exactly one actor-bound domain audit."); assert.equal(audit[0].action, writeAction);
    const ids: Array<number | null | undefined> = entity === "page" ? [state.pageId] : entity === "menu" ? [state.menuId, state.duplicateId, ...Object.values(state.itemIds)] : [null];
    assert.ok(ids.includes(audit[0].entity_id == null ? null : Number(audit[0].entity_id)));
    if (entity === "footer") { const metadata = audit[0].metadata as Row; assert.equal(metadata.persistence_owner, "save_footer_settings"); assert.deepEqual(metadata.persisted_keys, writeAction==='footer_settings.restore_default' ? ['footer.slots'] : [...FOOTER_SETTING_KEYS].sort()); }
  } else {
    assert.equal(audit.length, 0, "Draft/rejection/cancellation/reload must not write domain audit.");
    if (phase !== "baseline") assert.deepEqual(snapshot, state.last[entity], "Rejected and local-only changes must preserve exact persisted rows/revisions.");
  }
  state.last[entity] = structuredClone(snapshot); state.phase[entity]++; state.auditCursor[entity] = await auditHead(handle);
  return recordCoreDownloadCheckpoint(handle,{ ...request, status: "pass", downloadMedia:await assertCoreDownloadMediaUnchanged(handle), actorBoundAuditCount: audit.length, snapshotHash: hash(snapshot), pageId: state.pageId ?? null, menuId: state.menuId ?? null, duplicateMenuId: state.duplicateId ?? null, itemIds: { ...state.itemIds }, globalClosed: false });
}

/** Join actual confirmation/fault evidence before partitioning it from the unchanged Navigation permission contract. */
export function assertCoreFooterRestoreCompletion(browser: Row, native: Row, cleanup: Row, ownedRunId: string, sourceSha256: string) {
  assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(browser.sourceSha256,sourceSha256);assert.equal(browser.cohort,'navigation-settings');assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.deepEqual(browser.errors,[]);
  assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.ok(Array.isArray(native.records));const records=native.records as Row[];
  assert.equal(new Set(records.map(row=>row.id)).size,records.length);for(const row of records)assert.equal(row.status,row.kind==='form-save-native'?'partial-not-global-pass':'pass');
  const matching=(browser.evidence as Row[]).filter(row=>row.id==='core-navigation-footer-default-restore-confirm-reject-retry');assert.equal(matching.length,1);const receipt=matching[0];assert.equal(receipt.status,'pass');
  for(const key of ['confirmationCancelled','explicitRetry','otherThreeRowsAndTimestampsUnchanged'])assert.equal(receipt[key],true);assert.equal(receipt.cancelledActionRequests,0);assert.equal(receipt.actionRequests,2);assert.deepEqual(receipt.automaticCoverage,[]);assert.equal(receipt.globalClosed,false);
  const phases=['restore-cancelled','restore-rejected','restored','restore-reloaded'];assert.deepEqual(receipt.nativePhases,phases);
  const states=records.filter(row=>row.kind==='navigation-settings-state'&&row.entity==='footer'&&phases.includes(String(row.phase)));assert.deepEqual(states.map(row=>row.phase),phases);assert.deepEqual(states.map(row=>row.actorBoundAuditCount),[0,0,1,0]);assert.equal(states[0].snapshotHash,states[1].snapshotHash);assert.equal(states[2].snapshotHash,states[3].snapshotHash);
  const faults=records.filter(row=>String(row.kind).startsWith('domain-write-fault-'));assert.equal(faults.length,9);assert.equal(cleanup.status,'closed');assert.equal(cleanup.activeLocks,0);assert.deepEqual(faults,cleanup.records);
  const rejection=receipt.rejection as Row,retry=receipt.retry as Row;assert.notEqual(rejection.token,retry.token);
  for(const [i,attempt]of [rejection,retry].entries()){
    assert.match(String(attempt.token),/^[a-f0-9-]{36}$/u);assert.equal(attempt.actionRequests,1);assert.equal(attempt.sameNativeStatementObservedTwice,true);assert.equal(attempt.actualStatementCancelled,i===0);assert.equal(attempt.ownedLockReleased,true);
    const batch=faults.filter(row=>row.token===attempt.token);assert.deepEqual(batch.map(row=>row.kind),['arm','observe-blocked','observe-blocked',...(i===0?['cancel']:[]),'release'].map(k=>'domain-write-fault-'+k));
    for(const row of batch){assert.equal(row.entity,'footer_restore');if(row.kind!=='domain-write-fault-release'){assert.equal(row.table,'site_settings');assert.equal(row.fixtureId,'footer.slots');}}
    for(const key of ['backendPid','backendStartedAt','queryStartedAt','queryFingerprint','holderPid'])assert.equal(batch[2][key],batch[1][key]);
    for(const row of batch.filter(row=>row.kind==='domain-write-fault-observe-blocked')){assert.equal(row.observedOneStatement,true);assert.equal(row.cancelledOneStatement,false);assert.equal(row.fixedMutationSignatureMatched,true);assert.equal(row.holderLifetimeVerified,true);}
    if(i===0)assert.equal(batch[3].cancelledOneStatement,true);const release=batch.at(-1)!;assert.equal(release.ownedLockRolledBack,true);assert.equal(release.cancellationObserved,i===0);
    assert.ok(records.indexOf(states[i])<records.indexOf(batch[0])&&records.indexOf(release)<records.indexOf(states[i+1]));
  }
  return{status:'pass',faultRecords:9,nativePhases:phases,confirmedWrites:1,automaticCoverage:[],globalClosed:false,nativeWithoutFaults:{...native,records:records.filter(row=>!faults.includes(row))}};
}

/** Owned teardown restores captured four-key policy before deleting only identities created above. */
export async function cleanupCoreNavigationSettingsFixtures(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle); const state = states.get(handle); assert.ok(state); assert.equal(state.cleanup, false);
  // Discover a committed create even if UI acknowledgement failed before its first checkpoint.
  const pageRows = (await handle.query("select id,title,slug from public.pages where path=$1", [CORE_NAVIGATION_RECIPE.page.path])).rows;
  if (pageRows.length) { assert.equal(pageRows.length, 1); assert.equal(pageRows[0].title, CORE_NAVIGATION_RECIPE.page.title); assert.equal(pageRows[0].slug, CORE_NAVIGATION_RECIPE.page.slug); assert.ok(!state.originalPages.some(row => row.id === pageRows[0].id)); state.pageId ??= Number(pageRows[0].id); }
  const menuRows = (await handle.query("select id,name,location from public.menus where slug=$1", [CORE_NAVIGATION_RECIPE.menu.slug])).rows;
  if (menuRows.length) { assert.equal(menuRows.length, 1); assert.ok([CORE_NAVIGATION_RECIPE.menu.name, CORE_NAVIGATION_RECIPE.menu.editedName].includes(menuRows[0].name as never)); assert.equal(menuRows[0].location, "custom"); assert.ok(!state.originalMenus.some(row => row.id === menuRows[0].id)); state.menuId ??= Number(menuRows[0].id); }
  if (state.menuId && !state.duplicateId) { const copies = (await handle.query("select entity_id from public.admin_audit_logs where action='menu.duplicate_menu' and actor_admin_user_id=$1 and metadata->>'menu_id'=$2 order by id", [state.actor.id, String(state.menuId)])).rows; assert.ok(copies.length <= 1); if (copies.length) state.duplicateId = Number(copies[0].entity_id); }
  await handle.query("begin");
  try {
    if (state.originalFooter.length) await handle.query("select public.save_footer_settings($1::jsonb,$2,$3,'qa.navigation.footer.restore','{}'::jsonb)", [JSON.stringify(valuesOnly(state.originalFooter)), state.actor.id, state.actor.username]);
    const absent = [...FOOTER_SETTING_KEYS].filter(key => !state.originalFooter.some(row => row.key === key));
    if (absent.length) await handle.query("delete from public.site_settings where key=any($1::text[])", [absent]);
    for (const row of state.originalFooter) await handle.query("update public.site_settings set updated_at=$2 where key=$1", [row.key, row.updated_at]);
    assert.deepEqual(await footerRows(handle), state.originalFooter);
    for (const id of [state.duplicateId, state.menuId].filter((id): id is number => Boolean(id))) {
      if ((await handle.query("select id from public.menus where id=$1", [id])).rows.length) await handle.query("select public.mutate_menu_tree($1,'delete_menu','{}'::jsonb,$2,$3)", [id, state.actor.id, state.actor.username]);
    }
    if (state.pageId) await handle.query("delete from public.pages where id=$1 and path=$2 and status='unpublished'", [state.pageId, CORE_NAVIGATION_RECIPE.page.path]);
    assert.deepEqual((await handle.query("select * from public.menus order by id")).rows, state.originalMenus);
    assert.deepEqual((await handle.query("select * from public.menu_items order by id")).rows, state.originalItems);
    assert.deepEqual((await handle.query("select * from public.pages order by id")).rows, state.originalPages);
    await handle.query("commit"); state.cleanup = true;
  } catch (error) { await handle.query("rollback"); throw error; }
  return { status: "pass", originalFooterHash: hash(state.originalFooter), footerRestored: true, originalMenusUnchanged: true, originalPagesUnchanged: true, onlyOwnedRecordsRemoved: true };
}
export function assertCoreNavigationSettingsCompleted(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle); const state = states.get(handle); assert.ok(state);
  for (const entity of Object.keys(NAVIGATION_SETTINGS_PHASES) as Entity[]) assert.equal(state.phase[entity], coreNavigationPhases(state.selection)[entity].length);
  assert.equal(state.cleanup, true);
  return { status: "pass", checkpoints: { ...state.phase }, ...(state.prepared?{prepared:clone(state.prepared)}:{}),footerRestored: true, globalClosed: false };
}

/** Scoped row-action fragments join only after the independently source-bound whole Navigation/native completion. */
export function assertCoreNavigationRowActionsCompletion(browser: Row, native: Row, ownedRunId: string, sourceSha256: string,prepared:Row|null=null) {
  assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(browser.sourceSha256,sourceSha256);assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.deepEqual(browser.errors,[]);assert.equal(browser.cohort,'navigation-settings');
  assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.ok(Array.isArray(native.records));const records=native.records as Row[];
  assert.equal(new Set(records.map(row=>row.id)).size,records.length);for(const row of records)assert.equal(row.status,row.kind==='form-save-native'?'partial-not-global-pass':'pass');
  const states=records.filter(row=>row.kind==='navigation-settings-state');
  for(const [entity,phases]of Object.entries(coreNavigationPhases((browser.journeySelection as string|null)??null)))assert.deepEqual(states.filter(row=>row.entity===entity).map(row=>row.phase),phases);
  const state=(entity:string,phase:string)=>{const found=states.filter(row=>row.entity===entity&&row.phase===phase);assert.equal(found.length,1);assert.match(String(found[0].snapshotHash),/^[a-f0-9]{64}$/u);return found[0];};
  const existingOnly=isCoreNavigationExistingSelection(browser.journeySelection);if(existingOnly){assert.ok(prepared);assert.equal(prepared.kind,'owned-fixture-preparation');assert.equal(prepared.ownedRunId,ownedRunId);assert.equal(prepared.uiCreateClaim,false);assert.deepEqual(prepared.automaticCoverage,[]);assert.equal(prepared.globalClosed,false);assert.match(String(prepared.menuSnapshotHash),/^[a-f0-9]{64}$/u);}else assert.equal(prepared,null);
  const footerOnly=browser.journeySelection===CORE_NAVIGATION_FOOTER_SELECTION;
  let menuRead:Row|null=null,itemRead:Row|null=null,menuId=Number(prepared?.menuId),ids:Row={};
  if(!footerOnly){
  const menu=existingOnly?{snapshotHash:prepared!.menuSnapshotHash,menuId:prepared!.menuId}:state('menu','created');menuRead=state('menu','created-row-inspected');const items=state('menu','item-c');itemRead=state('menu','items-inspected');
  for(const[a,b]of [[menu,menuRead],[items,itemRead]]){assert.equal(a.snapshotHash,b.snapshotHash);assert.equal(b.actorBoundAuditCount,0);}
  menuId=Number(menu.menuId);assert.ok(Number.isSafeInteger(menuId)&&menuId>0);ids=itemRead.itemIds as Row;
  for(const key of ['a','b','c'])assert.ok(Number.isSafeInteger(ids[key])&&Number(ids[key])>0);
  }else{assert.ok(prepared);assert.ok(Number.isSafeInteger(menuId)&&menuId>0);}
  const evidence=browser.evidence as Row[];
  const journey=(id:string)=>{const found=evidence.filter(row=>row.id===id);assert.equal(found.length,1);assert.equal(found[0].status,'pass');assert.deepEqual(found[0].automaticCoverage,[]);return found[0];};
  const graph=footerOnly?null:journey('core-navigation-menu-metadata-item-graph-commands'),footer=journey('core-navigation-footer-aggregate-slots-manual-links-rejection-retry');
  const observations=[...(graph?(graph.rowActionObservations as Row[]):[]),...(footer.rowActionObservations as Row[])];assert.equal(observations.length,footerOnly?1:4);
  assert.equal(new Set(observations.map(row=>String(row.type)+':'+String(row.id))).size,footerOnly?1:4);
  const r=CORE_NAVIGATION_RECIPE;
  const expected=[...(!footerOnly?[
    {type:'menu',id:String(menuId),label:r.menu.name,routePathname:'/admin/pages-blocks/menus',information:{Slug:r.menu.slug,'الموقع':'Custom','عدد العناصر':'0','الحالة':'ظاهرة'},preview:{access:'disabled',reason:'القائمة لا تملك مسار معاينة عامًا خاصًا بها.'},edit:{mode:'navigation',pathname:'/admin/pages-blocks/menus/'+menuId,opened:true},nativeCheckpointId:menuRead!.id},
    {type:'menu_item',id:String(ids.a),label:r.menu.a,routePathname:'/admin/pages-blocks/menus/'+menuId,information:{'الرابط':'#','الحالة':'ظاهر'},preview:{access:'disabled',reason:'لا يملك العنصر مسارًا عامًا مستقلاً يمكن معاينته من هنا.'},nativeCheckpointId:itemRead!.id},
    {type:'menu_item',id:String(ids.c),label:r.menu.c,routePathname:'/admin/pages-blocks/menus/'+menuId,information:{'الرابط':r.menu.href,'الحالة':'ظاهر'},preview:{access:'allowed',href:r.menu.href},edit:{mode:'dialog',opened:true},nativeCheckpointId:itemRead!.id},
  ]:[]),
    {type:'footer_manual_link',id:'0:'+r.footer.editedLink,label:r.footer.editedLink,routePathname:'/admin/pages-blocks/footer',information:{'الرابط':CORE_DOWNLOAD_MEDIA_HREF,'الهدف':'نفس النافذة','الحالة':'مخفي'},preview:{access:'allowed',href:CORE_DOWNLOAD_MEDIA_HREF},edit:{mode:'dialog-reloaded',opened:true},nativeCheckpointId:state('footer','reloaded').id},
  ].map(row=>({...row,copyHidden:true,informationReturnedFocus:true,actionRequests:0,externalDestinationFollowed:false}));
  assert.deepEqual(observations,expected);
  if(graph)assert.equal((graph.rowActionObservations as Row[]).length,3);assert.equal((footer.rowActionObservations as Row[]).length,1);
  const phases=['visibility-draft','saved','reloaded','visibility-shown-draft','shown-saved','shown-reloaded'];
  assert.deepEqual(footer.manualVisibility,{hiddenSavedReloaded:true,shownSavedReloaded:true,extraAcceptedSaves:1,nativePhases:phases});
  assert.deepEqual(phases.map(phase=>state('footer',phase).actorBoundAuditCount),[0,1,0,0,1,0]);
  assert.equal(state('footer','draft-final').snapshotHash,state('footer','visibility-draft').snapshotHash);
  for(const[a,b]of [['saved','reloaded'],['reloaded','visibility-shown-draft'],['shown-saved','shown-reloaded']])assert.equal(state('footer',a).snapshotHash,state('footer',b).snapshotHash);
  assert.notEqual(state('footer','saved').snapshotHash,state('footer','shown-saved').snapshotHash);
  return{status:'pass',rowObservations:footerOnly?1:4,readOnlyMenuCheckpoints:footerOnly?0:2,additionalFooterWrites:1,manualVisibilityPersistedBothDirections:true,externalPreviewBoundary:'declared href/target/rel only; no external destination was followed',automaticCoverage:[],globalClosed:false};
}

export function coreNavigationPreparedBaseline(handle:OwnedLocalHandle){assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);return clone(state.prepared);}
