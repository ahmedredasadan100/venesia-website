import {CORE_DOWNLOAD_LINK} from './admin-core-download-media-adoption.mjs';
import assert from "node:assert/strict";

// Finite verification recipes. Applicability comes from the existing Form
// manifest; this is not a Product capability registry.
export const TEMPLATE_CONTROL_RECIPES = {
  cards: { table: "cards_block_templates", controls: ["columns-keyboard", "item-add-edit-reorder-remove", "minimum-one", "item-link", "title-format"] },
  breadcrumb: { table: "breadcrumb_block_templates", controls: ["source-keyboard", "show-home", "manual-add-edit-reorder-remove", "manual-link"] },
  cta: { table: "cta_block_templates", controls: ["background-keyboard", "primary-link-select-replace", "secondary-link-clear", "title-format"] },
  feed: { table: "feed_module_templates", controls: ["feed-type-keyboard", "dependent-series-reset", "four-feed-type-configs", "numeric-rejection", "slider-and-list-switches"] },
  featured: { table: "featured_module_templates", controls: ["source-keyboard", "manual-selection-toggle-order", "unresolved-retention", "explicit-remove", "presentation", "numeric-rejection"] },
  "media-sidebar": { table: "media_sidebar_module_templates", controls: ["widget-source-conditional-controls", "content-type", "presentation-keyboard", "clamped-limit", "display-switches"] },
  "media-hub": { table: "media_hub_module_templates", controls: ["section-dependent-defaults", "collection-layout-keyboard", "numeric-rejection", "title-format"] },
};
export const TEMPLATE_CONTROL_PHASES = ["baseline", "draft", "negative", "saved", "reloaded"];
export const TEMPLATE_CONTROL_VALUES = {
  cards: [
    { title: "بطاقة الفحص الأولى", body: "وصف البطاقة الأولى", icon: "one" },
    { title: "بطاقة الفحص الثانية المعدلة", body: "وصف البطاقة الثانية المعدل", icon: "two" },
    { title: "بطاقة الفحص المحذوفة", body: "وصف محذوف", icon: "three" },
  ],
  breadcrumbs: ["مسار الفحص الأول", "مسار الفحص الثاني المعدل", "مسار محذوف"],
  title: "عنوان فحص عناصر النموذج",
  primaryLabel: "الرابط الأساسي للفحص",
  secondaryLabel: "الرابط الثانوي للفحص",
  hrefs: ["https://example.invalid/form-controls/one", "https://example.invalid/form-controls/two"],
};
export function buildCoreTemplateControlsPlan({ manifest, fixtures }) {
  assert.ok(Array.isArray(manifest)); assert.ok(Array.isArray(fixtures?.templates));
  const recipes = Object.entries(TEMPLATE_CONTROL_RECIPES).map(([kind, recipe]) => {
    const entries = manifest.filter(entry => entry.registryModuleKind === kind);
    assert.equal(entries.length, 1, "Missing/ambiguous registered " + kind + " editor.");
    const entry = entries[0], surface = kind + ":template-edit";
    assert.ok(entry.surfaces.includes(surface)); assert.equal(entry.classification, "specialized_exception");
    const templates = fixtures.templates.filter(row => row.kind === kind);
    assert.equal(templates.length, 1, "Missing/ambiguous owned " + kind + " fixture.");
    assert.ok(Number.isSafeInteger(templates[0].id) && templates[0].id > 0);
    return { ...recipe, kind, consumer: entry.id, surface, template: templates[0], coverage: [] };
  });
  return { recipes, globalClosed: false, automaticAxisCoverage: [],
    remainingBoundaries: manifest.filter(entry => entry.registryModuleKind && !Object.hasOwn(TEMPLATE_CONTROL_RECIPES, entry.registryModuleKind)).map(entry => ({ consumer: entry.id, surface: entry.registryModuleKind + ":template-edit", reason: "Separate preset/media recipe required; scalar lifecycle receipts do not prove compound controls." })) };
}
export function validateTemplateControlsRequest(input) {
  assert.ok(input && typeof input === "object");
  assert.deepEqual(Object.keys(input).sort(), ["id", "kind", "phase", "recipe"]);
  assert.equal(input.kind, "template-controls-state");
  assert.match(String(input.id), /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);
  assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES, input.recipe));
  assert.ok(TEMPLATE_CONTROL_PHASES.includes(input.phase)); return input;
}
export function assertTemplateControlsProjection(kind, row, fixtures) {
  assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES, kind));
  const c = row.config, r = TEMPLATE_CONTROL_VALUES;
  const external = (href, target) => ({ link_kind: "external", linked_type: null, linked_id: null, href, anchor: null, target, meta: null });
  if (kind === "cards") {
    assert.equal(c.columns, 4);
    assert.deepEqual(c.items, [
      { ...r.cards[1], link: CORE_DOWNLOAD_LINK, target: "_blank" },
      { ...r.cards[0], link: external(r.hrefs[0], "_blank"), target: "_blank" },
    ]);
  }
  if (kind === "breadcrumb") {
    assert.deepEqual(c, { source: "manual", showHome: false, currentLabelOverride: r.title, manualItems: [
      { label: r.breadcrumbs[1], link: CORE_DOWNLOAD_LINK },
      { label: r.breadcrumbs[0], link: external(r.hrefs[0], "_blank") },
    ] });
  }
  if (kind === "cta") {
    assert.equal(c.backgroundStyle, "gradient");
    assert.deepEqual(c.primaryCta, { label: r.primaryLabel, link: CORE_DOWNLOAD_LINK, target: "_blank" });
    assert.equal(Object.hasOwn(c, "secondaryCta"), false, "Explicit clear must not retain the old destination or empty CTA.");
  }
  if (["cards", "cta"].includes(kind)) assert.deepEqual([c.title, c.showTitle, c.titleBold, c.titleAlignment], [r.title, true, false, "center"]);
  if (kind === "feed") {
    assert.equal(row.feed_type, "latest");
    assert.deepEqual(c.query, { limit: 7, categorySlugs: [fixtures.category.slug], seriesSlugs: [fixtures.series.slug] });
    const v = c.presentation.variants;
    assert.deepEqual([v.latest.layout, v.latest.density, v.latest.showArrows, v.latest.showDots], ["slider", 2, false, true]);
    assert.deepEqual([v.popular.layout, v.popular.columns, v.categories.layout, v.categories.columns], ["grid", 2, "grid", 3]);
    assert.deepEqual([v.series.layout, v.series.list.itemsPerGroup, v.series.list.intervalSeconds, v.series.list.showDots], ["list", 2, 9, false]);
  }
  if (kind === "featured") {
    assert.deepEqual(c.source, { kind: "categories", categorySlug: fixtures.category.slug });
    assert.deepEqual(c.selection, { mode: "manual", topicIds: [fixtures.article.id] });
    assert.equal(c.itemLimit, 3); assert.equal(c.presentation.variant, "list");
  }
  if (kind === "media-sidebar") {
    assert.equal(row.widget_key, "popular");
    assert.deepEqual(c.source, { kind: "media-center", contentType: "video" });
    assert.equal(c.limit, 7); assert.equal(c.presentation, "group-carousel");
    assert.deepEqual(c.display, { title: true, image: false, category: false, series: false, excerpt: true, date: false });
  }
  if (kind === "media-hub") {
    assert.equal(row.section_key, "press");
    assert.equal(c.placement, "hub"); assert.equal(c.type, "press"); assert.equal(c.itemLimit, 5);
    assert.equal(c.presentation.collectionView.layout, "list");
    assert.deepEqual([c.presentation.title, c.presentation.showTitle, c.presentation.titleBold, c.presentation.titleAlignment], [r.title, true, false, "center"]);
  }
}





// Existing specialized save-notice adapter states; query flags test rendering,
// not a fabricated cache/media backend failure or another domain mutation.
export const TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS = [
 {id:'saved',query:{saved:'1'},variant:'success',text:'تم حفظ الموديول بنجاح.'},
 {id:'cache-warning',query:{saved:'1',cache_warning:'1'},variant:'warning',text:'تم حفظ الموديول بنجاح. تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة.'},
 {id:'media-warning',query:{saved:'1',notice:'saved_with_media_sync_warning'},variant:'warning',text:'تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص.'},
 {id:'combined-warning',query:{saved:'1',notice:'saved_with_media_sync_warning',cache_warning:'1'},variant:'warning',text:'تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص. تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة.'},
];
export function assertCoreTemplateFeedbackAdapter(proof,kind,templateId,sourceSha256){
 assert.ok(Object.hasOwn(TEMPLATE_CONTROL_RECIPES,kind));assert.ok(proof&&typeof proof==='object');
 assert.equal(proof.kind,kind);assert.equal(proof.templateId,templateId);assert.equal(proof.sourceSha256,sourceSha256);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);
 assert.equal(proof.channel,'block-editor:/admin/pages-blocks/blocks/'+kind);assert.equal(proof.routePathname,'/admin/pages-blocks/blocks/'+kind+'/'+templateId);
 assert.equal(proof.actualAcceptedSaveVisible,true);assert.ok(['success','warning'].includes(proof.actualAcceptedVariant));
 assert.equal(proof.additionalActionPosts,0);assert.equal(proof.adapterOnly,true);assert.equal(proof.backendFailureClaim,false);assert.equal(proof.globalClosed,false);assert.deepEqual(proof.automaticCoverage,[]);
 assert.equal(proof.scenarios.length,TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.length);assert.deepEqual(proof.scenarios.map(row=>row.id),TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.map(row=>row.id));
 for(const[at,spec]of TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.entries()){
  const row=proof.scenarios[at];assert.equal(row.variant,spec.variant);assert.equal(row.visibleCount,1);assert.equal(row.messageText,spec.text);
  for(const key of ['dismissButtonVisible','dismissed','savedRemoved','noticeRemoved','cacheWarningRemoved','unrelatedQueryPreserved','samePathAndHash','absentAfterReload'])assert.equal(row[key],true);
 }
 return proof;
}
export function assertCoreTemplateFeedbackCompletion(browser,native,ownedRunId){
 assert.equal(browser.cohort,'template-controls');assert.equal(native.status,'pass');assert.equal(native.ownedRunId,ownedRunId);assert.match(browser.sourceSha256,/^[a-f0-9]{64}$/u);
 const result=browser.templateControls,kinds=Object.keys(TEMPLATE_CONTROL_RECIPES);assert.ok(result);assert.equal(result.outcomes.length,kinds.length);assert.deepEqual(result.outcomes.map(row=>row.kind).sort(),[...kinds].sort());
 const records=native.records.filter(row=>row.kind==='template-controls-state');assert.equal(records.length,kinds.length*TEMPLATE_CONTROL_PHASES.length);assert.equal(new Set(records.map(row=>row.id)).size,records.length);
 for(const row of result.outcomes){
  const evidence=browser.evidence.filter(e=>e.id==='core-template-controls-'+row.kind);assert.equal(evidence.length,1);assert.equal(evidence[0].status,'pass');assert.ok(!browser.errors.some(e=>e.id===evidence[0].id));
  assert.deepEqual(evidence[0].feedbackAdapter,row.feedbackAdapter);
  const proof=assertCoreTemplateFeedbackAdapter(row.feedbackAdapter,row.kind,row.templateId,browser.sourceSha256);
  const phase=records.filter(record=>record.recipe===row.kind);assert.deepEqual(phase.map(record=>record.phase),TEMPLATE_CONTROL_PHASES);assert.ok(phase.every(record=>record.status==='pass'&&record.templateId===row.templateId&&record.actorBound===true&&record.assignmentGraphUnchanged===true));
  const before=phase.find(record=>record.phase==='saved'),after=phase.find(record=>record.phase==='reloaded');
  assert.equal(proof.nativeBefore,before.id);assert.equal(proof.nativeAfter,after.id);assert.equal(after.rowHash,before.rowHash);assert.equal(after.otherRowsHash,before.otherRowsHash);assert.equal(before.auditCount,1);assert.equal(after.auditCount,0);
 }
 return{status:'pass',consumers:kinds.length,adapterObservations:kinds.length*TEMPLATE_FEEDBACK_ADAPTER_SCENARIOS.length,nativeCheckpoints:records.length,additionalActions:0,backendFailureClaim:false,automaticCoverage:[],globalClosed:false};
}
