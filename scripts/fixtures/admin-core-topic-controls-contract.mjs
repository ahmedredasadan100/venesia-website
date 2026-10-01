import assert from "node:assert/strict";

export const TOPIC_CONTROL_KINDS = ["article", "news", "press", "site_update", "video", "gallery"];
export const TOPIC_CONTROL_PHASES = ["baseline", "draft", "negative", "serverRejected", "saved", "reloaded"];
export const TOPIC_CONTROL_ASSET_KEYS = ["images/projects/c35/hero.jpg", "images/projects/c35/cover.jpg", "images/projects/c35/location-map.jpg"];
export const TOPIC_CONTROL_VALUES = {
  imageAlt: "وصف صورة عناصر المحتوى المحفوظة",
  markdown: "فقرة محررة للتحقق من الحفظ وإعادة الفتح لعناصر المحتوى المتخصصة.",
  videoUrl: "https://youtu.be/aqz-KE-bpKQ", storedVideoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", duration: "4:32",
  mediaProject: "B4-C35",
  faq: [{ question: "كيف يظهر السؤال الأول؟", answer: "تظهر الإجابة الأولى بعد الحفظ." }, { question: "كيف يظهر السؤال الثاني؟", answer: "تظهر الإجابة الثانية بالترتيب الجديد." }],
  display: { show_title_on_page: false, show_image_on_page: true, show_category_on_page: false, show_series_on_page: true, show_excerpt_on_page: false, show_date_on_page: true, show_intro_card_on_page: false },
};
export function buildCoreTopicControlsPlan({ manifest, fixtures }) {
  assert.ok(Array.isArray(manifest)); assert.ok(Array.isArray(fixtures?.topics));
  assert.deepEqual(fixtures.topics.map(row => row.kind).sort(), [...TOPIC_CONTROL_KINDS].sort());
  assert.deepEqual(fixtures.assets.map(row => row.objectKey), TOPIC_CONTROL_ASSET_KEYS);
  assert.equal(new Set(fixtures.assets.map(row => row.id)).size, TOPIC_CONTROL_ASSET_KEYS.length);
  for (const asset of fixtures.assets) assert.equal(asset.publicUrl, "/" + asset.objectKey);
  const recipes = fixtures.topics.map(topic => {
    const consumer = topic.kind === "article" ? "topic-article-create-edit" : "topic-media-create-edit";
    const registered = manifest.filter(row => row.id === consumer); assert.equal(registered.length, 1);
    const surface = topic.kind === "article" ? "edit" : topic.kind + ":edit";
    assert.ok(registered[0].surfaces.includes(surface));
    assert.ok(Number.isSafeInteger(topic.id) && topic.id > 0);
    assert.equal(topic.slug, "qa-core-topic-controls-" + topic.kind);
    assert.equal(topic.editPath, "/admin/content/topics/" + topic.id);
    return { ...topic, consumer, surface, coverage: [] };
  });
  return { recipes, automaticAxisCoverage: [], globalClosed: false,
    explicitNonCapabilities: ["Gallery picker is single-select; duplicate URLs remain separate authored rows.", "Gallery removal is immediate local state; picker cancellation is a separate no-write control.", "Unpublished date edits do not set published_at.", "Video duration is free text; no nonexistent duration validator is claimed."] };
}
export function validateTopicControlsRequest(input) {
  assert.ok(input && typeof input === "object" && !Array.isArray(input));
  assert.deepEqual(Object.keys(input).sort(), ["id", "kind", "phase", "recipe"]);
  assert.match(input.id, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);
  assert.equal(input.kind, "topic-controls-state"); assert.ok(TOPIC_CONTROL_KINDS.includes(input.recipe));
  assert.ok(TOPIC_CONTROL_PHASES.includes(input.phase)); return input;
}
export function expectedTopicControlPayload(kind, fixtures) {
  const [a, b, c] = fixtures.assets, v = TOPIC_CONTROL_VALUES;
  if (kind === "video") return { kind: "video", provider: "youtube", video_url: v.storedVideoUrl, thumbnail: c.publicUrl, duration: v.duration };
  if (kind === "gallery") return { kind: "gallery", images: [
    { url: b.publicUrl, alt: "وصف المعرض الثاني", caption: "تعليق المعرض الثاني" },
    { url: c.publicUrl, alt: "وصف المعرض الأول", caption: "تعليق المعرض الأول" },
    { url: a.publicUrl, alt: "وصف الصورة المكررة", caption: "تعليق الصورة المكررة" },
  ] };
  return null;
}
export function assertTopicControlsProjection(kind, row, original, fixtures, actorId) {
  assert.ok(TOPIC_CONTROL_KINDS.includes(kind)); const v = TOPIC_CONTROL_VALUES;
  for (const key of ["id", "slug", "title", "excerpt", "created_at", "created_by", "published_by", "view_count", "deleted_at"]) assert.deepEqual(row[key], original[key], "Preserve Topic identity/history: " + key);
  assert.equal(row.status, "unpublished"); assert.equal(row.published_at, null); assert.equal(row.date_label, original.date_label);
  assert.equal(row.content_type, kind); assert.equal(Number(row.updated_by), actorId);
  // Native pg returns bigint as decimal text; write builders use safe numeric IDs.
  // Accept only those two exact representations, without coercing malformed values.
  for (const [key, id] of [["category_id", fixtures.category.id], ["series_id", fixtures.series.id]]) {
    assert.ok(Number.isSafeInteger(id) && id > 0, "Owned Topic fixture identity must be a positive safe integer: " + key);
    assert.ok(row[key] === id || row[key] === String(id), "Persist exact Topic relationship identity: " + key);
  }
  assert.equal(row.category_slug, fixtures.category.slug); assert.equal(row.category, fixtures.category.name);
  assert.equal(row.series_slug, fixtures.series.slug); assert.equal(row.series, fixtures.series.name);
  assert.equal(row.image, fixtures.assets[1].publicUrl); assert.equal(row.image_alt, v.imageAlt);
  assert.equal(row.is_featured, true); assert.equal(row.is_popular, true);
  for (const [key, value] of Object.entries(v.display)) assert.equal(row[key], value, key);
  assert.deepEqual(row.media_payload, expectedTopicControlPayload(kind, fixtures));
  assert.equal(row.content, ["video", "gallery"].includes(kind) ? "" : v.markdown);
  if (["news", "site_update"].includes(kind)) assert.equal(row.media_project, v.mediaProject);
  if (kind === "article") { assert.deepEqual(row.faq, [v.faq[1], v.faq[0]]); assert.equal(row.show_faq_on_page, true); assert.equal(row.show_faq_title_on_page, false); }
}

