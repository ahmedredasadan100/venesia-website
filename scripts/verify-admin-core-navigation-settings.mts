import ts from "typescript";
import {assertCoreFormFeedbackPublicationSource,assertCoreAcceptedFormFeedback,assertCoreVisibleAcceptedFeedback} from "./fixtures/admin-core-domain-form-journeys.mjs";
import {CORE_DOWNLOAD_MEDIA_HREF} from './fixtures/admin-core-download-media-adoption.mjs';
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { buildCoreNavigationSettingsPlan, CORE_NAVIGATION_FOLLOWUP_SELECTION, CORE_NAVIGATION_FOLLOWUP_IDS,CORE_NAVIGATION_EXISTING_SELECTION,CORE_NAVIGATION_MENU_FOOTER_SELECTION,coreNavigationSelectedIds, assertCoreNavigationFollowupReceipt } from "./fixtures/admin-core-navigation-settings-journeys.mjs";
const root = resolve(import.meta.dirname, "..");
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
import * as owner from './verify-admin-core-navigation-settings-isolated.mts';
const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root, "src/lib/admin/form-system/adoption-manifest.ts"));
const { ADMIN_COLLECTION_SURFACE_ADOPTION: collections } = await jiti.import<typeof import("../src/lib/admin/interaction-system/adoption-manifest.ts")>(resolve(root, "src/lib/admin/interaction-system/adoption-manifest.ts"));
const requiredCases = manifest.filter(row => ["pages-quick-create", "menu-quick-create"].includes(row.id)).flatMap(row => row.surfaces.flatMap(surface => ["save_reload", "failure_preserves_input", "retry"].map(scenario => ({ key: ["form", row.id, surface, scenario].join(":"), boundary: "form", consumer: row.id, surface, scenario }))));
const args = { manifest, collections: collections.surfaces, requiredCases, fixtures: { recipe: owner.CORE_NAVIGATION_RECIPE, duplicatePagePath: "/about", duplicateMenuSlug: "existing-menu", originalFooterHash: "a".repeat(64) } };
const cases: string[] = [];
const test = async (name: string, callback: () => unknown | Promise<unknown>) => { await callback(); cases.push(name); };
await test("Canonical five Form and four Collection boundaries derive only six generic lifecycle cells", () => { const plan = buildCoreNavigationSettingsPlan(args); assert.equal(plan.consumers.length, 5); assert.equal(plan.pageCoverage.length + plan.menuCoverage.length, 6); assert.deepEqual(plan.specializedAutomaticCoverage, []); assert.equal(plan.globalClosed, false); assert.deepEqual(plan.consumers[4].surfaces, ["seo"]); });
for (const id of ["pages-quick-create", "menu-quick-create", "menu-builder", "footer-builder", "page-composition-and-seo"]) await test("Missing canonical boundary rejects: " + id, () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, manifest: manifest.filter(row => row.id !== id) })));
await test("Duplicate boundary cannot double-count observations", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, manifest: [...manifest, manifest.find(row => row.id === "menu-builder")] })));
await test("Specialized closure cannot be promoted through generic classification", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, manifest: manifest.map(row => row.id === "footer-builder" ? { ...row, classification: "shared_adopter" } : row) })));
await test("Missing Footer manual-link collection rejects", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, collections: collections.surfaces.filter(row => row.id !== "footer-manual-links") })));
await test("Missing generic lifecycle cell rejects", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, requiredCases: requiredCases.slice(1) })));
await test("Repeated generic lifecycle cell rejects", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, requiredCases: [...requiredCases, requiredCases[0]] })));
const request = { id: randomUUID(), kind: "navigation-settings-state", entity: "menu", phase: "baseline" };
await test("Fixed checkpoint accepts no Browser expectation or SQL", () => assert.deepEqual(owner.validateCoreNavigationSettingsRequest(request), request));
for (const changed of [{ sql: "select secret" }, { expected: [] }, { menuId: 1 }, { actorId: 1 }, { phase: "commit-anything" }, { kind: "run-sql" }, { entity: "__proto__" }, { entity: "constructor" }, { id: "invalid-uuid" }, { phase: "seo-saved" }]) await test("Reject unknown checkpoint contract: " + Object.keys(changed)[0] + "/" + String(Object.values(changed)[0]), () => assert.throws(() => owner.validateCoreNavigationSettingsRequest({ ...request, ...changed })));
await test("Every declared finite phase is independently addressable", () => { for (const [entity, phases] of Object.entries(owner.NAVIGATION_SETTINGS_PHASES)) for (const phase of phases) owner.validateCoreNavigationSettingsRequest({ ...request, entity, phase }); assert.equal(Object.values(owner.NAVIGATION_SETTINGS_PHASES).reduce((sum, phases) => sum + phases.length, 0), 41); });
const r = owner.CORE_NAVIGATION_RECIPE.menu, ids = { a: 101, b: 102, c: 103 };
const base = { menu_id: 41, parent_id: null, href: "#", linked_type: null, linked_id: null, anchor: null, target: "_self", css_class: null, style_preset: "default", is_visible: true, item_type: "parent" };
const graph = [{ ...base, id: 101, label: r.a, sort_order: 20 }, { ...base, id: 102, label: r.b, sort_order: 10 }, { ...base, id: 103, parent_id: 102, label: r.editedC, sort_order: 10, href: CORE_DOWNLOAD_MEDIA_HREF, item_type: "custom", target: "_blank", css_class: r.css, style_preset: "gold-card", is_visible: false }];
await test("Complete hidden/reparented/reordered graph accepted with exact authored identity", () => owner.assertCoreNavigationGraph(graph, 41, "hidden", ids));
for (const [name, mutate] of [
  ["orphan", (rows: typeof graph) => { rows[2].parent_id = 999; }],
  ["cycle", (rows: typeof graph) => { rows[1].parent_id = 103; }],
  ["foreign menu", (rows: typeof graph) => { rows[2].menu_id = 99; }],
  ["duplicate ID", (rows: typeof graph) => { rows[2].id = 101; }],
  ["wrong order", (rows: typeof graph) => { rows[0].sort_order = 10; }],
  ["wrong destination", (rows: typeof graph) => { rows[2].href = "https://example.invalid/other"; }],
  ["wrong visibility", (rows: typeof graph) => { rows[2].is_visible = true; }],
  ["missing child", (rows: typeof graph) => { rows.pop(); }],
] as const) await test("Graph corruption rejects: " + name, () => { const changed = structuredClone(graph); mutate(changed); assert.throws(() => owner.assertCoreNavigationGraph(changed, 41, "hidden", ids)); });
await test("Subtree delete preserves only the original first root and renormalizes order", () => owner.assertCoreNavigationGraph([{ ...graph[0], sort_order: 10 }], 41, "subtree-deleted", ids));
const footer = await owner.buildExpectedCoreNavigationFooter([{ key: "footer.contact_items", value: [{ label: " preserved ", value: " original ", visible: true }] }], 41);
const { validateFooterSlots } = await jiti.import<typeof import("../src/lib/footer/validate-footer-slots.ts")>(resolve(root, "src/lib/footer/validate-footer-slots.ts"));
const slots = footer.find(row => row.key === "footer.slots")!.value as import("../src/lib/footer/footer-slot-types.ts").FooterSlotsConfig;
await test("Authored Footer uses canonical four-slot schema and real Menu identity", () => { assert.equal(validateFooterSlots(slots).ok, true); assert.deepEqual(slots.slots.map(slot => [slot.index, slot.type]), [[1, "custom_links"], [2, "text"], [3, "menu"], [4, "contact"]]); assert.equal((slots.slots[2].config as { menuId: number }).menuId, 41); });
await test("Footer manual draft owner preserves only edited/reordered and surviving links", () => { const links = (slots.slots[0].config as { links: { label: string; sortOrder: number; link: { href: string } }[] }).links; assert.deepEqual(links.map(row => [row.label, row.sortOrder]), [[owner.CORE_NAVIGATION_RECIPE.footer.editedLink, 0], [owner.CORE_NAVIGATION_RECIPE.footer.links[0], 1]]); assert.equal(links[0].link.href, CORE_DOWNLOAD_MEDIA_HREF); });
await test("Nonempty original global contacts normalize through the current owner", () => assert.deepEqual(footer.find(row => row.key === "footer.contact_items")!.value, [{ label: "preserved", value: "original" }]));
await test("Disabled slot is still schema validated", () => { const changed = structuredClone(slots); changed.slots[0].enabled = false; (changed.slots[0].config as Record<string, unknown>).links = "invalid"; assert.equal(validateFooterSlots(changed).ok, false); });
await test("Footer unsafe href rejects using the actual owner", () => { const changed = structuredClone(slots); (changed.slots[0].config as { links: { href: string }[] }).links[0].href = "javascript:alert(1)"; assert.equal(validateFooterSlots(changed).ok, false); });

const { DEFAULT_FOOTER_SLOTS }=await jiti.import<typeof import('../src/lib/footer/defaults.ts')>(resolve(root,'src/lib/footer/defaults.ts'));
const beforeRestore=footer.map(row=>({...row,updated_at:'2026-09-27T00:00:00Z'})),afterRestore=beforeRestore.map(row=>row.key==='footer.slots'?{...row,value:structuredClone(DEFAULT_FOOTER_SLOTS),updated_at:'2026-09-27T00:00:01Z'}:structuredClone(row));
const restoreAudit=[{action:'footer_settings.restore_default',actor_admin_user_id:'51',entity_type:'footer_settings',entity_id:null,metadata:{persistence_owner:'save_footer_settings',persisted_keys:['footer.slots']}}];
await test('Default restore changes only canonical slots with one actor audit; other three exact timestamps survive',()=>owner.assertCoreFooterRestore(beforeRestore,afterRestore,DEFAULT_FOOTER_SLOTS,restoreAudit,51));
for(const [name,mutate]of [
 ['other value',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.rows.find(row=>row.key==='footer.legal')!.value={copyright:'foreign'};}],
 ['other timestamp',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.rows.find(row=>row.key==='footer.legal')!.updated_at='changed';}],
 ['missing row',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.rows.pop();}],
 ['duplicate key',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.rows[1].key=x.rows[0].key;}],
 ['wrong defaults',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.rows.find(row=>row.key==='footer.slots')!.value={};}],
 ['wrong actor',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.audit[0].actor_admin_user_id='52';}],
 ['wrong action',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.audit[0].action='footer_settings.update';}],
 ['extra write',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.audit.push(structuredClone(x.audit[0]));}],
 ['missing audit',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.audit=[];}],
 ['wrong keys',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.audit[0].metadata.persisted_keys.push('footer.legal');}],
 ['wrong persistence',(x:{rows:typeof afterRestore;audit:typeof restoreAudit})=>{x.audit[0].metadata.persistence_owner='other';}],
]as const)await test('Restore rejects '+name,()=>{const x={rows:structuredClone(afterRestore),audit:structuredClone(restoreAudit)};mutate(x);assert.throws(()=>owner.assertCoreFooterRestore(beforeRestore,x.rows,DEFAULT_FOOTER_SLOTS,x.audit,51));});


function restoreJoinFixture(){
 const state=(phase:string,audit:number,snapshotHash:string)=>({id:randomUUID(),kind:'navigation-settings-state',entity:'footer',phase,status:'pass',actorBoundAuditCount:audit,snapshotHash});
 const phases=['restore-cancelled','restore-rejected','restored','restore-reloaded'],states=[state(phases[0],0,'a'),state(phases[1],0,'a'),state(phases[2],1,'b'),state(phases[3],0,'b')];
 const make=(cancelled:boolean)=>{const token=randomUUID();return{token,records:['arm','observe-blocked','observe-blocked',...(cancelled?['cancel']:[]),'release'].map(kind=>({id:randomUUID(),kind:'domain-write-fault-'+kind,entity:'footer_restore',token,status:'pass',table:'site_settings',fixtureId:'footer.slots',backendPid:2,backendStartedAt:'b',queryStartedAt:'q',queryFingerprint:'f',holderPid:1,observedOneStatement:true,cancelledOneStatement:kind==='cancel',fixedMutationSignatureMatched:true,holderLifetimeVerified:true,ownedLockRolledBack:true,cancellationObserved:cancelled})),receipt:{token,actionRequests:1,sameNativeStatementObservedTwice:true,actualStatementCancelled:cancelled,ownedLockReleased:true}};};
 const a=make(true),b=make(false),faults=[...a.records,...b.records],records=[states[0],...a.records,states[1],...b.records,states[2],states[3]],source='a'.repeat(64);
 return{browser:{cohort:'navigation-settings',status:'pass',driverCompleted:true,errors:[],sourceSha256:source,evidence:[{id:'core-navigation-footer-default-restore-confirm-reject-retry',status:'pass',confirmationCancelled:true,explicitRetry:true,otherThreeRowsAndTimestampsUnchanged:true,cancelledActionRequests:0,actionRequests:2,automaticCoverage:[],globalClosed:false,nativePhases:phases,rejection:a.receipt,retry:b.receipt}]},native:{status:'pass',ownedRunId:'run',records},cleanup:{status:'closed',activeLocks:0,records:faults},source};
}
await test('Exact two Footer fault attempts partition only after Browser/native/cleanup/source join',()=>{const x=restoreJoinFixture(),r=owner.assertCoreFooterRestoreCompletion(x.browser,x.native,x.cleanup,'run',x.source);assert.equal(r.faultRecords,9);assert.equal(r.confirmedWrites,1);assert.equal(r.nativeWithoutFaults.records.length,4);});
for(const[name,mutate]of Object.entries({foreignSource:(x:ReturnType<typeof restoreJoinFixture>)=>{x.browser.sourceSha256='b'.repeat(64);},foreignRun:(x:ReturnType<typeof restoreJoinFixture>)=>{x.native.ownedRunId='other';},uncompleted:(x:ReturnType<typeof restoreJoinFixture>)=>{x.browser.driverCompleted=false;},extraPost:(x:ReturnType<typeof restoreJoinFixture>)=>{x.browser.evidence[0].actionRequests=3;},missingCancellation:(x:ReturnType<typeof restoreJoinFixture>)=>{x.browser.evidence[0].confirmationCancelled=false;},missingFault:(x:ReturnType<typeof restoreJoinFixture>)=>{x.native.records.splice(1,1);},wrongKey:(x:ReturnType<typeof restoreJoinFixture>)=>{Object.assign(x.native.records[1],{fixtureId:'footer.legal'});},changedQuery:(x:ReturnType<typeof restoreJoinFixture>)=>{Object.assign(x.native.records[3],{queryStartedAt:'foreign'});},earlySuccess:(x:ReturnType<typeof restoreJoinFixture>)=>{x.native.records.reverse();},missingAudit:(x:ReturnType<typeof restoreJoinFixture>)=>{Object.assign(x.native.records.at(-2)!,{actorBoundAuditCount:0});},changedFailure:(x:ReturnType<typeof restoreJoinFixture>)=>{Object.assign(x.native.records[6],{snapshotHash:'different'});},activeLock:(x:ReturnType<typeof restoreJoinFixture>)=>{x.cleanup.activeLocks=1;},orphanCleanup:(x:ReturnType<typeof restoreJoinFixture>)=>{x.cleanup.records=x.cleanup.records.slice(1);},duplicateEvidence:(x:ReturnType<typeof restoreJoinFixture>)=>{x.browser.evidence.push(structuredClone(x.browser.evidence[0]));}}))await test('Footer joined completion rejects '+name,()=>{const x=restoreJoinFixture();mutate(x);assert.throws(()=>owner.assertCoreFooterRestoreCompletion(x.browser,x.native,x.cleanup,'run',x.source));});

const seo = await jiti.import<typeof import("../src/lib/seo/entity-seo-types.ts")>(resolve(root, "src/lib/seo/entity-seo-types.ts"));
const seoValues = { seoTitle: owner.CORE_NAVIGATION_RECIPE.page.seoTitle, seoDescription: owner.CORE_NAVIGATION_RECIPE.page.seoDescription, focusKeyword: owner.CORE_NAVIGATION_RECIPE.page.focusKeyword, seoKeywords: [...owner.CORE_NAVIGATION_RECIPE.page.seoKeywords], canonicalUrl: owner.CORE_NAVIGATION_RECIPE.page.canonicalUrl, robotsIndex: false, robotsFollow: false, ogImage: "", ogImageAlt: "" };
await test("Authored valid SEO passes real limits; negative control rejects only canonical URL", () => { assert.deepEqual(seo.validateEntitySeoValues(seoValues), []); const issues = seo.validateEntitySeoValues({ ...seoValues, canonicalUrl: "ftp://example.invalid/rejected" }); assert.equal(issues.length, 1); assert.equal(issues[0].field, "canonical_url"); });
const nativeSource = readFileSync(resolve(root, "scripts/verify-admin-core-navigation-settings-isolated.mts"), "utf8"), browserSource = readFileSync(resolve(root, "scripts/fixtures/admin-core-navigation-settings-journeys.mjs"), "utf8");
await test("Browser has no SQL/credential transport and requires owned cleanup", () => { assert.ok(!browserSource.includes("service_role") && !browserSource.includes("handle.query") && !browserSource.includes("page.request")); assert.match(browserSource, /requiresOwnedCleanupBeforePromotion: true/u); assert.match(nativeSource, /state\.cleanup, true/u); });
await test("Cleanup uses captured exact key set and assertion before commit", () => { const cleanup = nativeSource.slice(nativeSource.indexOf("export async function cleanupCoreNavigationSettingsFixtures")); const proof = cleanup.indexOf("assert.deepEqual(await footerRows(handle), state.originalFooter)"); const commit = cleanup.indexOf('await handle.query("commit")'); assert.ok(proof >= 0 && commit > proof); assert.match(cleanup, /FOOTER_SETTING_KEYS.*filter/u); assert.match(cleanup, /rollback/u); });

const feedbackSource=readFileSync(resolve(root,'src/components/admin/ui/AdminFormRuntime.tsx'),'utf8'),feedbackBinding=assertCoreFormFeedbackPublicationSource(feedbackSource),feedbackSourceSha='a'.repeat(64);
function acceptedFeedbackFixture(){return{consumer:'pages-quick-create',surface:'create',entityId:41,entityKey:'page-quick-create',mode:'create',channel:'form:page-quick-create',routePathname:'/admin/pages-blocks/pages/41',events:[{type:'admin-form-saved',entityId:41,targetIsForm:true,formConnected:true}],sourceSha256:feedbackSourceSha,sourceBinding:feedbackBinding,publicationOrderObserved:true,renderedRegionObserved:true,postUnmountPersistenceRequired:true,visibleFeedback:{...visibleFeedbackFixture(),channel:'form:page-quick-create',routePathname:'/admin/pages-blocks/pages/41',createFormDetached:true,placement:'global',lifecycle:'manual',dismissed:true},automaticCoverage:[] as string[],globalClosed:false};}
const acceptedFeedbackArgs={consumer:'pages-quick-create',surface:'create',entityId:41,entityKey:'page-quick-create',routePrefix:'/admin/pages-blocks/pages',requiredCases,sourceSha256:feedbackSourceSha,sourceBinding:feedbackBinding};
await test('Feedback current publication precedes saved event and create handoff',()=>assert.equal(feedbackBinding.publicationBeforeSavedEvent,true));
await test('Feedback requires distinct publication and visible dismissed result after actual create handoff',()=>assertCoreAcceptedFormFeedback(acceptedFeedbackFixture(),acceptedFeedbackArgs));
for(const[name,mutate]of Object.entries({
 'missing-event':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.events=[],
 'duplicate-event':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.events.push(p.events[0]),
 'foreign-entity':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.events[0].entityId=42,
 'foreign-form':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.entityKey='foreign',
 'foreign-route':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.routePathname='/admin/pages-blocks/menus/41',
 'foreign-consumer':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.consumer='menu-quick-create',
 'event-after-unmount':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.events[0].formConnected=false,
 'bubbled-other-form':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.events[0].targetIsForm=false,
 'foreign-source':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.sourceSha256='b'.repeat(64),
 'source-binding-drift':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.sourceBinding={...p.sourceBinding,sha256:'b'.repeat(64)},
 'event-only':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>Reflect.deleteProperty(p,'visibleFeedback'),
 'render-not-observed':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.renderedRegionObserved=false,
 'handoff-persistence-skipped':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.postUnmountPersistenceRequired=false,
 'visible-wrong-channel':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.channel='form:menu-quick-create',
 'visible-wrong-source':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.sourceSha256='b'.repeat(64),
 'visible-stale':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.priorEntryDetached=false,
 'visible-wrong-route':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.routePathname='/admin/pages-blocks/pages/42',
 'create-still-mounted':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.createFormDetached=false,
 'visible-only-in-closed-modal':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.placement='modal',
 'manual-lifecycle-missing':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.lifecycle='auto',
 'dismiss-not-observed':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.dismissed=false,
 'visible-after-reload':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.observedBeforeReload=false,
 'visible-missing':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.visibleCount=0,
 'visible-duplicate':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.visibleCount=2,
 'visible-error':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.visibleFeedback.variant='danger',
 'auto-credit':(p:ReturnType<typeof acceptedFeedbackFixture>):unknown=>p.automaticCoverage=['foreign'],
})){await test('Feedback accepted event rejects '+name,()=>{const p=acceptedFeedbackFixture();mutate(p);assert.throws(()=>assertCoreAcceptedFormFeedback(p,acceptedFeedbackArgs));});}
await test('Feedback saved event cannot move before actual publisher',()=>assert.throws(()=>assertCoreFormFeedbackPublicationSource(feedbackSource.replace('publishFeedback(nextFeedback, {','deferredPublication(nextFeedback, {'))));
await test('Feedback missing canonical save identity cannot qualify',()=>assert.throws(()=>assertCoreAcceptedFormFeedback(acceptedFeedbackFixture(),{...acceptedFeedbackArgs,requiredCases:[]})));

const feedbackHookSource=readFileSync(resolve(root,'scripts/fixtures/admin-core-domain-form-journeys.mjs'),'utf8');
function capturedFormObserverFactory(source:string){
 const ast=ts.createSourceFile('feedback-hook.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='observeCoreAcceptedFormFeedback');assert.ok(fn);
 const callbacks:ts.Expression[]=[];function visit(node:ts.Node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='evaluateHandle')callbacks.push(node.arguments[0]);ts.forEachChild(node,visit);}visit(fn);assert.equal(callbacks.length,1);
 const body=fn.getText(ast);assert.ok(body.includes('await expect.poll(()=>observer.evaluate(value=>value.isConnected())).toBe(false)'));assert.ok(!body.includes('expect(form).toHaveCount(0)'));
 return new Function('node','return ('+callbacks[0].getText(ast)+')(node);');
}
await test('Feedback original create node detaches while same locator can match new edit node',()=>{
 const make=capturedFormObserverFactory(feedbackHookSource),oldForm=Object.assign(new EventTarget(),{isConnected:true,getAttribute:(name:string)=>name==='data-admin-form-mode'?'create':'page-quick-create'}),observed=make(oldForm);
 oldForm.dispatchEvent(new CustomEvent('admin-form-saved',{detail:{entityId:41}}));assert.deepEqual(observed.events,[{type:'admin-form-saved',entityId:41,targetIsForm:true,formConnected:true}]);
 oldForm.isConnected=false;const newEditForm={isConnected:true};const liveLocatorMatches=[newEditForm];assert.equal(liveLocatorMatches.length,1);assert.equal(observed.isConnected(),false);assert.equal(newEditForm.isConnected,true);
 observed.dispose();oldForm.dispatchEvent(new CustomEvent('admin-form-saved',{detail:{entityId:42}}));assert.equal(observed.events.length,1);
});
await test('Feedback observer rejects replacement with re-resolved form count',()=>assert.throws(()=>capturedFormObserverFactory(feedbackHookSource.replace('await expect.poll(()=>observer.evaluate(value=>value.isConnected())).toBe(false)','await expect(form).toHaveCount(0)'))));
await test('Feedback original-node capture cannot be removed',()=>assert.throws(()=>capturedFormObserverFactory(feedbackHookSource.replace('form.evaluateHandle(node=>','form.fakeCapture(node=>'))));
function visibleFeedbackFixture(){return{channel:'menu-builder:list',sourceSha256:feedbackSourceSha,variant:'success',visibleCount:1,nonemptyMessage:true,priorEntryDetached:true,renderedRegionObserved:true,observedBeforeReload:true,automaticCoverage:[] as string[],globalClosed:false};}
await test('Feedback accepted visible region remains a distinct proof boundary',()=>assertCoreVisibleAcceptedFeedback(visibleFeedbackFixture(),'menu-builder:list',feedbackSourceSha));
for(const[name,mutate]of Object.entries({
 'wrong-channel':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.channel='foreign',
 'danger-as-success':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.variant='danger',
 'missing-region':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.visibleCount=0,
 'duplicate-region':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.visibleCount=2,
 'empty-message':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.nonemptyMessage=false,
 'stale-result':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.priorEntryDetached=false,
 'after-reload':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.observedBeforeReload=false,
 'wrong-source':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.sourceSha256='b'.repeat(64),
 'auto-credit':(p:ReturnType<typeof visibleFeedbackFixture>):unknown=>p.automaticCoverage=['foreign'],
})){await test('Feedback visible region rejects '+name,()=>{const p=visibleFeedbackFixture();mutate(p);assert.throws(()=>assertCoreVisibleAcceptedFeedback(p,'menu-builder:list',feedbackSourceSha));});}
type RowFragment=Record<string,unknown>;
function navigationRowJoinFixture(){
 const source='a'.repeat(64),menuId=41,itemIds={a:101,b:102,c:103},hash=(letter:string)=>letter.repeat(64);
 const records:RowFragment[]=Object.entries(owner.NAVIGATION_SETTINGS_PHASES).flatMap(([entity,phases])=>phases.map(phase=>({id:randomUUID(),kind:'navigation-settings-state',entity,phase,status:'pass',menuId,itemIds,actorBoundAuditCount:entity==='footer'&&['saved','shown-saved'].includes(phase)?1:0,snapshotHash:hash(entity==='footer'?['saved','reloaded','visibility-shown-draft'].includes(phase)?'c':['shown-saved','shown-reloaded'].includes(phase)?'d':'a':phase==='item-c'||phase==='items-inspected'?'b':'a')})));
 const state=(entity:string,phase:string)=>records.find(row=>row.entity===entity&&row.phase===phase)!;
 const m=owner.CORE_NAVIGATION_RECIPE.menu,f=owner.CORE_NAVIGATION_RECIPE.footer;
 const flags={copyHidden:true,informationReturnedFocus:true,actionRequests:0,externalDestinationFollowed:false};
 const graph:RowFragment[]=[
 {type:'menu',id:'41',label:m.name,routePathname:'/admin/pages-blocks/menus',information:{Slug:m.slug,'الموقع':'Custom','عدد العناصر':'0','الحالة':'ظاهرة'},preview:{access:'disabled',reason:'القائمة لا تملك مسار معاينة عامًا خاصًا بها.'},edit:{mode:'navigation',pathname:'/admin/pages-blocks/menus/41',opened:true},nativeCheckpointId:state('menu','created-row-inspected').id,...flags},
 {type:'menu_item',id:'101',label:m.a,routePathname:'/admin/pages-blocks/menus/41',information:{'الرابط':'#','الحالة':'ظاهر'},preview:{access:'disabled',reason:'لا يملك العنصر مسارًا عامًا مستقلاً يمكن معاينته من هنا.'},nativeCheckpointId:state('menu','items-inspected').id,...flags},
 {type:'menu_item',id:'103',label:m.c,routePathname:'/admin/pages-blocks/menus/41',information:{'الرابط':m.href,'الحالة':'ظاهر'},preview:{access:'allowed',href:m.href},edit:{mode:'dialog',opened:true},nativeCheckpointId:state('menu','items-inspected').id,...flags}];
 const footer:RowFragment[]=[{type:'footer_manual_link',id:'0:'+f.editedLink,label:f.editedLink,routePathname:'/admin/pages-blocks/footer',information:{'الرابط':CORE_DOWNLOAD_MEDIA_HREF,'الهدف':'نفس النافذة','الحالة':'مخفي'},preview:{access:'allowed',href:CORE_DOWNLOAD_MEDIA_HREF},edit:{mode:'dialog-reloaded',opened:true},nativeCheckpointId:state('footer','reloaded').id,...flags}];
 const evidence:RowFragment[]=[{id:'core-navigation-menu-metadata-item-graph-commands',status:'pass',rowActionObservations:graph,automaticCoverage:[]},{id:'core-navigation-footer-aggregate-slots-manual-links-rejection-retry',status:'pass',rowActionObservations:footer,automaticCoverage:[],manualVisibility:{hiddenSavedReloaded:true,shownSavedReloaded:true,extraAcceptedSaves:1,nativePhases:['visibility-draft','saved','reloaded','visibility-shown-draft','shown-saved','shown-reloaded']}}];
 return{source,browser:{sourceSha256:source,status:'pass',driverCompleted:true,errors:[],cohort:'navigation-settings',evidence},native:{status:'pass',ownedRunId:'owned',records},state,graph,footer,evidence};
}
await test('Four exact Native-bound information/preview/edit fragments retain explicit external-destination limit',()=>{const x=navigationRowJoinFixture(),result=owner.assertCoreNavigationRowActionsCompletion(x.browser,x.native,'owned',x.source);assert.equal(result.rowObservations,4);assert.equal(result.additionalFooterWrites,1);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);});
const rowMutators:Record<string,(x:ReturnType<typeof navigationRowJoinFixture>)=>void>={
 foreignSource:x=>{x.browser.sourceSha256='b'.repeat(64);},coherentSelfSource:x=>{x.browser.sourceSha256='b'.repeat(64);Object.assign(x.native,{sourceSha256:'b'.repeat(64)});},foreignRun:x=>{x.native.ownedRunId='other';},unfinished:x=>{x.browser.driverCompleted=false;},wrongCohort:x=>{x.browser.cohort='domain-forms';},missingObservation:x=>{x.graph.pop();},duplicateIdentity:x=>{x.graph[2].id=x.graph[1].id;},foreignRow:x=>{x.footer[0].id='1:'+owner.CORE_NAVIGATION_RECIPE.footer.editedLink;},foreignCheckpoint:x=>{x.graph[0].nativeCheckpointId=x.state('menu','metadata-saved').id;},changedNativeInspection:x=>{x.state('menu','items-inspected').snapshotHash='f'.repeat(64);},inspectionWrite:x=>{x.state('menu','created-row-inspected').actorBoundAuditCount=1;},unsafeParentPreview:x=>{x.graph[1].preview={access:'allowed',href:'#'};},wrongInformation:x=>{(x.graph[0].information as RowFragment).Slug='foreign';},wrongStoredFooterTarget:x=>{(x.footer[0].information as RowFragment)['الهدف']='تبويب جديد';},wrongPersistedFooterState:x=>{(x.footer[0].information as RowFragment)['الحالة']='ظاهر';},notOpenedEdit:x=>{(x.graph[2].edit as RowFragment).opened=false;},readOnlyPost:x=>{x.graph[0].actionRequests=1;},externalFollowed:x=>{x.graph[2].externalDestinationFollowed=true;},copyInvented:x=>{x.footer[0].copyHidden=false;},extraWrite:x=>{x.state('footer','shown-saved').actorBoundAuditCount=2;},lostShownCommit:x=>{x.state('footer','shown-saved').actorBoundAuditCount=0;},changedDraft:x=>{x.state('footer','visibility-shown-draft').snapshotHash='f'.repeat(64);},reloadMismatch:x=>{x.state('footer','shown-reloaded').snapshotHash='f'.repeat(64);},noopVisibility:x=>{x.state('footer','shown-saved').snapshotHash='c'.repeat(64);x.state('footer','shown-reloaded').snapshotHash='c'.repeat(64);},missingPhase:x=>{x.native.records.splice(x.native.records.indexOf(x.state('footer','shown-saved')),1);},duplicatedPhase:x=>{x.native.records.push({...x.state('footer','shown-reloaded'),id:randomUUID()});},duplicateJourney:x=>{x.evidence.push(structuredClone(x.evidence[0]));},inventedCoverage:x=>{x.evidence[0].automaticCoverage=['all-row-actions'];},skippedShow:x=>{(x.evidence[1].manualVisibility as RowFragment).shownSavedReloaded=false;},orphanObservation:x=>{(x.evidence[1].rowActionObservations as RowFragment[]).push(structuredClone(x.graph[0]));}
};
for(const[name,mutate]of Object.entries(rowMutators))await test('Navigation row fragment join rejects '+name,()=>{const x=navigationRowJoinFixture();mutate(x);assert.throws(()=>owner.assertCoreNavigationRowActionsCompletion(x.browser,x.native,'owned',x.source));});
await test('Actual Footer persistence shape differs only at the selected manual visibility field',async()=>{const a=await owner.buildExpectedCoreNavigationFooter([],41,false),b=await owner.buildExpectedCoreNavigationFooter([],41,true);const links=(rows:RowFragment[])=>(((rows.find(row=>row.key==='footer.slots')!.value as {slots:FooterSlotLike[]}).slots[0].config).links);type FooterSlotLike={config:{links:{visible:boolean}[]}};assert.equal(links(a)[0].visible,false);assert.equal(links(b)[0].visible,true);links(a)[0].visible=true;assert.deepEqual(a,b);});
const previewOwner=await jiti.import<typeof import('../src/lib/admin/links/validate.ts')>(resolve(root,'src/lib/admin/links/validate.ts'));
await test('Current preview owner disables parent anchors while retaining exact authored HTTP and PDF destinations',()=>{for(const value of ['#','','javascript:alert(1)','//foreign.invalid'])assert.equal(previewOwner.resolvePublicPreviewHref(value),null);assert.equal(previewOwner.resolvePublicPreviewHref(owner.CORE_NAVIGATION_RECIPE.menu.href),owner.CORE_NAVIGATION_RECIPE.menu.href);assert.equal(previewOwner.resolvePublicPreviewHref(CORE_DOWNLOAD_MEDIA_HREF),CORE_DOWNLOAD_MEDIA_HREF);});
await test('Browser row observation is real owner DOM with native phase after edit and no external click',()=>{assert.match(browserSource,/data-admin-row-actions-information/u);assert.match(browserSource,/data-admin-entity-id/u);assert.match(browserSource,/toHaveAttribute\('target','_blank'\)/u);assert.match(browserSource,/posts\.length,0/u);assert.match(browserSource,/await menuEdit\.click\(\)/u);assert.match(browserSource,/created-row-inspected/u);assert.match(browserSource,/items-inspected/u);assert.match(browserSource,/shown-reloaded/u);assert.doesNotMatch(browserSource,/previewOwner.*\.click\(/u);});

await test('Both scoped completions admit only the existing typed Page native-save intermediate receipt',()=>{
 const a=restoreJoinFixture();a.native.records.unshift({id:randomUUID(),kind:'form-save-native',status:'partial-not-global-pass'} as typeof a.native.records[number]);owner.assertCoreFooterRestoreCompletion(a.browser,a.native,a.cleanup,'run',a.source);
 const b=navigationRowJoinFixture();b.native.records.unshift({id:randomUUID(),kind:'form-save-native',status:'partial-not-global-pass'});owner.assertCoreNavigationRowActionsCompletion(b.browser,b.native,'owned',b.source);
});
for(const [kind,status]of [['unknown-kind','partial-not-global-pass'],['form-save-native','pass'],['form-save-native','fail'],['navigation-settings-state','partial-not-global-pass']])await test('Typed producer status rejects '+kind+'/'+status,()=>{
 const a=restoreJoinFixture();a.native.records.unshift({id:randomUUID(),kind,status} as typeof a.native.records[number]);assert.throws(()=>owner.assertCoreFooterRestoreCompletion(a.browser,a.native,a.cleanup,'run',a.source));
 const b=navigationRowJoinFixture();b.native.records.unshift({id:randomUUID(),kind,status});assert.throws(()=>owner.assertCoreNavigationRowActionsCompletion(b.browser,b.native,'owned',b.source));
});

const selectedReceipt = {scope:'core-closure',cohort:'navigation-settings',journeySelection:CORE_NAVIGATION_FOLLOWUP_SELECTION,status:'pass',driverCompleted:true,inventoryOnly:false,wholeCohortExecuted:false,errors:[],globalClosed:false,requiredCases,selectedJourneyIds:[...CORE_NAVIGATION_FOLLOWUP_IDS],executedJourneyIds:[...CORE_NAVIGATION_FOLLOWUP_IDS],evidence:CORE_NAVIGATION_FOLLOWUP_IDS.map(id=>({id,status:'pass'}))};
await test('Followup retains exactly seven original navigation operations without descendant replay',()=>{const receipt=assertCoreNavigationFollowupReceipt(selectedReceipt,requiredCases);assert.deepEqual(receipt,{status:'pass',selection:CORE_NAVIGATION_FOLLOWUP_SELECTION,automaticCoverage:[],selectedJourneyIds:[...CORE_NAVIGATION_FOLLOWUP_IDS],executedJourneyIds:[...CORE_NAVIGATION_FOLLOWUP_IDS],retainedDescendantsReplayed:false,wholeCohortExecuted:false,globalClosed:false});});
for(const [label,edit] of Object.entries({missing:(r:typeof selectedReceipt)=>{r.executedJourneyIds.pop();},replay:(r:typeof selectedReceipt)=>{r.evidence.push({id:'core-descendant-presentation-menus',status:'pass'});},failed:(r:typeof selectedReceipt)=>{r.evidence[0].status='fail';},whole:(r:typeof selectedReceipt)=>{r.wholeCohortExecuted=true;},unfinished:(r:typeof selectedReceipt)=>{r.driverCompleted=false;},inventory:(r:typeof selectedReceipt)=>{r.requiredCases=[];},foreign:(r:typeof selectedReceipt)=>{r.cohort='page-composition';}})) await test('Followup rejects '+label,()=>{const r=structuredClone(selectedReceipt);edit(r);assert.throws(()=>assertCoreNavigationFollowupReceipt(r,requiredCases));});
const remainingIds=coreNavigationSelectedIds(CORE_NAVIGATION_EXISTING_SELECTION);
await test('Fixed existing selection derives exactly original7 minus retained2 creates',()=>{assert.deepEqual(remainingIds,CORE_NAVIGATION_FOLLOWUP_IDS.filter(id=>!id.includes('create-rejection-retry-reload')));assert.equal(remainingIds.length,5);assert.deepEqual(owner.coreNavigationPhases(null),owner.NAVIGATION_SETTINGS_PHASES);assert.deepEqual(owner.coreNavigationPhases(CORE_NAVIGATION_FOLLOWUP_SELECTION),owner.NAVIGATION_SETTINGS_PHASES);assert.deepEqual(Object.fromEntries(Object.entries(owner.coreNavigationPhases(CORE_NAVIGATION_EXISTING_SELECTION)).map(([key,phases])=>[key,phases.length])),{page:2,menu:18,footer:15});});
await test('Menu Footer finite selection omits qualified SEO and native Page work while preserving original four identities',()=>{const ids=coreNavigationSelectedIds(CORE_NAVIGATION_MENU_FOOTER_SELECTION);assert.deepEqual(ids,remainingIds.filter(id=>id!=='core-navigation-page-seo-validation-save-reload'));assert.equal(ids.length,4);assert.deepEqual(owner.coreNavigationPhases(CORE_NAVIGATION_MENU_FOOTER_SELECTION),{page:[],menu:owner.coreNavigationPhases(CORE_NAVIGATION_EXISTING_SELECTION).menu,footer:owner.coreNavigationPhases(CORE_NAVIGATION_EXISTING_SELECTION).footer});const receipt={...structuredClone(selectedReceipt),journeySelection:CORE_NAVIGATION_MENU_FOOTER_SELECTION,selectedJourneyIds:[...ids],executedJourneyIds:[...ids],evidence:ids.map(id=>({id,status:'pass'}))};assertCoreNavigationFollowupReceipt(receipt,requiredCases);for(const id of ['core-navigation-page-seo-validation-save-reload','core-navigation-page-create-rejection-retry-reload']){const bad=structuredClone(receipt);bad.evidence.push({id,status:'pass'});assert.throws(()=>assertCoreNavigationFollowupReceipt(bad,requiredCases));}});
const remainingReceipt={...structuredClone(selectedReceipt),journeySelection:CORE_NAVIGATION_EXISTING_SELECTION,selectedJourneyIds:[...remainingIds],executedJourneyIds:[...remainingIds],evidence:remainingIds.map(id=>({id,status:'pass'}))};
await test('Existing5 retain original canonical cells without create or descendant credit',()=>{const r=assertCoreNavigationFollowupReceipt(remainingReceipt,requiredCases);assert.deepEqual(r.selectedJourneyIds,remainingIds);assert.equal(r.globalClosed,false);assert.deepEqual(r.automaticCoverage,[]);});
for(const[label,edit]of Object.entries({missing:(r:typeof remainingReceipt):unknown=>r.executedJourneyIds.pop(),createReplay:(r:typeof remainingReceipt):unknown=>r.executedJourneyIds.push('core-navigation-page-create-rejection-retry-reload'),descendantReplay:(r:typeof remainingReceipt):unknown=>r.evidence.push({id:'core-descendant-presentation-footer',status:'pass'}),lostCase:(r:typeof remainingReceipt):unknown=>r.requiredCases.pop(),failed:(r:typeof remainingReceipt):unknown=>r.evidence[0].status='fail',duplicate:(r:typeof remainingReceipt):unknown=>r.executedJourneyIds[1]=r.executedJourneyIds[0]}))await test('Existing5 rejects '+label,()=>{const r=structuredClone(remainingReceipt);edit(r);assert.throws(()=>assertCoreNavigationFollowupReceipt(r,requiredCases));});
// Execute the existing command adapters and the shared viewport selector together.
// This controlled projection proves placement, not authenticated Browser rendering.
function navigationFeedbackDeclaration(source: string, name: string) {
 const ast=ts.createSourceFile('feedback.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found:ts.FunctionDeclaration[]=[];
 const visit=(node:ts.Node)=>{if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found.push(node);ts.forEachChild(node,visit);};visit(ast);assert.equal(found.length,1);
 return ts.transpileModule(found[0].getText(ast).replace(/^export /u,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
}
type NavigationFeedbackEntry={channel:string;placement:string;feedback:{variant:string;message:string;[key:string]:unknown}};
type NavigationFeedbackTree={type:unknown;props:Record<string,unknown>;children:unknown[]};
const feedbackOwnerSource=readFileSync(resolve(root,'src/components/admin/AdminFeedbackProvider.tsx'),'utf8');
function navigationGlobalProjection(entries:NavigationFeedbackEntry[]){
 const token=Symbol('actual-viewport-entry'),react={createElement:(type:unknown,props:Record<string,unknown>,...children:unknown[]):NavigationFeedbackTree=>({type,props,children})};
 const render=new Function('useAdminFeedback','React','AdminFeedbackViewportEntry','createPortal',navigationFeedbackDeclaration(feedbackOwnerSource,'AdminFeedbackViewport')+';return AdminFeedbackViewport;')(()=>({entries,dismissFeedback:()=>{},modalHost:null}),react,token,()=>{throw Error('No modal host declared in this control.');});
 const result:NavigationFeedbackEntry[]=[];const visit=(node:unknown)=>{if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;const n=node as NavigationFeedbackTree;if(n.type===token)result.push(n.props.entry as NavigationFeedbackEntry);n.children?.forEach(visit);};visit(render());return result;
}
for(const[file,callback,channel,host]of[
 ['MenusTableClient.tsx','runMenuMutation','menu-builder:list','MenusTableClient.tsx'],
 ['MenuItemsTableClient.tsx','runMenuItemMutation','menu-builder:41','MenuBuilderClient.tsx'],
]){
 const source=readFileSync(resolve(root,'src/app/admin/pages-blocks/menus',file),'utf8');
 const region=readFileSync(resolve(root,'src/app/admin/pages-blocks/menus',host),'utf8');assert.match(region,/placement="global"/u);assert.doesNotMatch(region,/AdminFeedbackChannelViewport/u);
 for(const outcome of ['success','warning','error']){
  const execute=async(code:string)=>{
   let entries:NavigationFeedbackEntry[]=[{channel,placement:'global',feedback:{variant:'success',message:'previous'}}],mutations=0,refreshes=0;
   const request={id:'controlled-request'},clearFeedback=(target:string)=>{assert.equal(target,channel);entries=entries.filter(e=>e.channel!==target);};
   const instant={mutateAsync:async(actual:unknown)=>{mutations++;assert.equal(actual,request);if(outcome==='error')throw Error('controlled rejection');return{feedbackStatus:outcome,message:'controlled '+outcome};}};
   const publishFeedback=(feedback:NavigationFeedbackEntry['feedback'],options:{channel:string;placement:string})=>{entries.push({...options,feedback});};
   const router={refresh:()=>{refreshes++;}},run=new Function('clearFeedback','feedbackChannel','instant','publishFeedback','router',navigationFeedbackDeclaration(code,callback)+';return '+callback+';')(clearFeedback,channel,instant,publishFeedback,router);
   await run(request);assert.equal(mutations,1);assert.equal(refreshes,outcome==='error'?0:1);assert.equal(entries.length,1);assert.equal(entries[0].feedback.variant,outcome==='error'?'danger':outcome);assert.equal(entries[0].feedback.message,outcome==='error'?'controlled rejection':'controlled '+outcome);return entries;
  };
  await test('Menu actual command '+callback+' '+outcome+' reaches declared shared global viewport',async()=>{const entries=await execute(source);assert.deepEqual(navigationGlobalProjection(entries),entries);});
  await test('Menu placement regression '+callback+' '+outcome+' reproduces undisplayed result',async()=>{const old=source.replaceAll('placement: "global"','placement: "inline"');assert.notEqual(old,source);const entries=await execute(old);assert.deepEqual(navigationGlobalProjection(entries),[]);});
 }
}

console.log(JSON.stringify({ status: "pass", controls: cases.length, cases, runtimeExecuted: false, globalClosed: false }));
