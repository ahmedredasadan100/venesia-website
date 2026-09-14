import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";

// Execute the real editor declarations and shared panel up to analyzeEntitySeo.
// Only React's initial hooks and unrendered UI children are replaced. Comparing
// captured inputs avoids restating the input resolver inside this test.
const root = process.cwd();
const require = createRequire(import.meta.url);
const owner = loadEntitySeoPersistenceOwner();
const shared = "src/components/admin/seo/AdminEntitySeoPanel.tsx";
const article = "src/components/admin/SeoPanel.tsx";
const media = "src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx";
const mediaForm = "src/components/admin/content/editors/media/MediaContentForm.tsx";
const projectPanel = "src/components/admin/projects/entry/ProjectSeoPanel.tsx";
const scorePath = "src/lib/admin/seo-score.ts";
const cache = new Map();
const completed = Symbol("captured actual panel input");
let captured;
let resolutions = 0;
let checks = 0;
function load(file) {
  const path = resolve(root, file);
  if (cache.has(path)) return cache.get(path).exports;
  const loaded = { exports: {} }; cache.set(path, loaded);
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), { fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", compiled)((specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "react") return { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useMemo: (get) => get(), useEffect: () => {} };
    if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (!specifier.startsWith(".")) return require(specifier);
    const base = resolve(dirname(path), specifier);
    const target = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")].find(existsSync);
    assert.ok(target, specifier);
    if (path === resolve(root, shared) && target === resolve(root, scorePath)) {
      const actual = load(target);
      return { ...actual,
        resolveEntitySeoScoreInput(input, context) { resolutions++; return actual.resolveEntitySeoScoreInput(input, context); },
        analyzeEntitySeo(input) { captured = { input, analysis: actual.analyzeEntitySeo(input) }; throw completed; },
      };
    }
    if (target.startsWith(resolve(root, "src/app/"))) return {};
    if (target.startsWith(resolve(root, "src/components/admin")) && ![shared, article, media, mediaForm, projectPanel].some((entry) => resolve(root, entry) === target)
      && !target.endsWith("content-editor-navigation.ts") && !target.endsWith("project-entry-navigation.ts")) return { __esModule: true, default: () => null };
    return load(target);
  }, loaded, loaded.exports);
  return loaded.exports;
}
const value = (item) => item ?? "";
function topicElement(row) {
  if (row.content_type !== "article") {
    const shell = load(mediaForm).default({ mode: "edit", contentType: row.content_type, values: row, categories: [], series: [] });
    const seoTab = shell.props.tabs({ value: shell.props.initialModelValue, setField: () => {} }).find((tab) => tab.id === "seo");
    assert.ok(seoTab);
    return seoTab.content.type(seoTab.content.props);
  }
  return load(article).default({
    title: value(row.title), excerpt: value(row.excerpt), content: value(row.content), slug: value(row.slug),
    image: value(row.image), imageAlt: value(row.image_alt), seoTitle: value(row.seo_title), seoDescription: value(row.seo_description),
    seoKeywords: row.seo_keywords ?? [], focusKeyword: value(row.focus_keyword), ogImage: value(row.og_image), ogImageAlt: value(row.og_image_alt),
    canonicalUrl: "", robotsIndex: null, robotsFollow: null, faq: row.faq ?? [],
  });
}
function capture(element) {
  captured = null; resolutions = 0;
  try { element.type(element.props); assert.fail("Panel did not analyze"); } catch (error) { if (error !== completed) throw error; }
  assert.ok(captured); assert.equal(resolutions, 1, "Shared panel must invoke its canonical resolver exactly once.");
  return captured;
}
function equalPersisted(input, element, label) {
  const editor = capture(element);
  assert.deepEqual(input, editor.input, `${label}: persisted inputs differ from actual editor input`);
  assert.equal(owner.deriveEntitySeoScore(input).seo_score, editor.analysis.score, `${label}: score differs`);
  assert.equal(owner.entitySeoInputHash(input), owner.entitySeoInputHash(editor.input), `${label}: hash differs`);
  checks++;
  return editor;
}
const base = {
  title: "The complete guide to choosing a new coastal home",
  excerpt: "Learn how to choose a coastal home with useful details about the surrounding services, nearby facilities, public transport and available homes.",
  content: "Choosing a coastal home depends on nearby facilities and services.",
  slug: "coastal-home", image: "/fixture.jpg", image_alt: "A coastal home",
  og_image: "", og_image_alt: "",
  seo_title: "", seo_description: "", seo_keywords: ["coastal home"], focus_keyword: "coastal home", faq: [],
};
const whitespace = [0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff].map((code) => String.fromCodePoint(code));
const variations = [
  {},
  { content: "" },
  { content: null },
  { content: undefined },
  ...whitespace.map((space) => ({ content: space })),
  { seo_title: null, seo_description: null, image: null, image_alt: null, seo_keywords: null, faq: null },
  { title: null, excerpt: null, seo_title: null, seo_description: null, image: null, image_alt: null },
  { seo_title: "\u0085\u180e\u200b", seo_description: "\u0085\u180e\u200b", seo_keywords: ["", " coastal home ", "coastal home"] },
  ...whitespace.flatMap((space) => [
    { seo_title: `${space}A${space}${space}coastal home${space}`, seo_description: `${space}A${space}${space}coastal description${space}`,
      image: `${space}/fixture.jpg${space}`, image_alt: `${space}A${space}${space}coastal home${space}` },
    { title: `${space}A${space}${space}coastal title${space}`, excerpt: `${space}A${space}${space}coastal description${space}`, seo_title: space, seo_description: space },
  ]),
];
for (const content_type of ["article", "news", "video", "gallery", "press", "site_update"]) {
  for (const [index, variation] of variations.entries()) {
    const row = { ...base, ...variation, content_type };
    equalPersisted(owner.toTopicSeoScoreInput(row), topicElement(row), `${content_type} case ${index}`);
  }
}
const articleFallback = equalPersisted(owner.toTopicSeoScoreInput({ ...base, content_type: "article" }), topicElement({ ...base, content_type: "article" }), "Article fallback score");
assert.equal(articleFallback.analysis.score, 62, "Stored Article score follows the editor, replacing the former raw-list score 46.");
const mediaFallback = equalPersisted(owner.toTopicSeoScoreInput({ ...base, content_type: "news" }), topicElement({ ...base, content_type: "news" }), "Media fallback score");
assert.equal(mediaFallback.analysis.score, 100, "Stored Media score follows the editor, replacing the former raw-list score 76.");
for (const content_type of ["article", "news"]) {
  const row = { ...base, content_type, faq: [{ question: "Where is this home?", answer: "Near the coast." }] };
  equalPersisted(owner.toTopicSeoScoreInput(row), topicElement(row), `${content_type} FAQ declaration`);
}
for (const content_type of ["video", "gallery"]) {
  const row = { ...base, content_type, content: "Legacy text excluded by the existing specialized editor body." };
  const result = equalPersisted(owner.toTopicSeoScoreInput(row), topicElement(row), `${content_type} legacy stored text`);
  assert.equal(result.input.content, "");
}
for (const contentType of ["news", "press", "site_update"]) {
  const starter = load(mediaForm).default({ mode: "create", contentType, categories: [], series: [] }).props.initialModelValue.content;
  assert.notEqual(starter, "", "New Markdown drafts retain their existing starter text.");
  for (const content of ["", null, undefined, " \t\n"]) {
    const shell = load(mediaForm).default({ mode: "create", contentType, values: { ...base, content }, categories: [], series: [] });
    assert.equal(shell.props.initialModelValue.content, starter, "Create-mode starter behavior remains unchanged.");
    checks++;
  }
  const shell = load(mediaForm).default({ mode: "create", contentType, values: base, categories: [], series: [] });
  assert.equal(shell.props.initialModelValue.content, base.content, "Create-mode supplied content remains unchanged.");
  checks++;
}
for (const [index, variation] of variations.entries()) {
  const source = { ...base, ...variation };
  const row = { ...source, arabic_name: source.title, general_description: source.excerpt,
    overview_body: source.content, hero_image: source.image, hero_image_alt: source.image_alt };
  const initial = Object.fromEntries(Object.entries(row).map(([key, item]) => [key, item ?? (key === "seo_keywords" ? [] : "")]));
  equalPersisted(owner.toProjectSeoScoreInput(row), load(projectPanel).default({ project: initial }), `Project case ${index}`);
}

// Existing route/global fallback and suffix semantics remain presentation inputs.
const initial = { profile: "entity", title: "Local title", description: "", content: "", slug: "local", image: "", imageAlt: "",
  seoTitle: "", seoDescription: "", seoKeywords: [], focusKeyword: "", ogImage: "", ogImageAlt: "", faq: [], canonicalUrl: "", robotsIndex: null, robotsFollow: null };
const fallback = { title: "Resolved global title", description: "Resolved description", image: "/global.jpg", imageAlt: "Global alt" };
const element = { type: load(shared).default, props: { initial, seoTitleSuffix: "Brand", resolvedFallback: fallback } };
const global = capture(element);
assert.equal(global.input.seoTitle, fallback.title);
assert.equal(global.input.seoDescription, fallback.description);
assert.equal(global.input.image, fallback.image);
assert.equal(global.input.imageAlt, fallback.imageAlt);
const robots = capture({ ...element, props: { ...element.props, initial: { ...initial, robotsIndex: false } } });
assert.equal(robots.input.seoTitle, "Local title | Brand", "Local robots override preserves the existing local SEO fallback decision.");
const local = capture({ ...element, props: { ...element.props, initial: { ...initial,
  seoTitle: "  Specific  title | Brand ", seoDescription: "  Local description  ", image: "  /local.jpg  ", imageAlt: " Local alt " } } });
assert.equal(local.input.seoTitle, "Specific title | Brand");
assert.equal(local.input.seoDescription, "Local description");
assert.equal(local.input.image, "/local.jpg");
assert.equal(local.input.imageAlt, "Local alt");
const extendedFaq = [{ question: "Live question?", answer: "Live answer." }];
const extension = capture({ ...element, props: { ...element.props, initial: { ...initial, profile: "article" },
  analysisExtension: { initialState: { faq: extendedFaq }, resolveFaq: (state) => state.faq } } });
assert.deepEqual(extension.input.faq, extendedFaq);
checks += 4;
console.log(`${checks}/${checks} executable Entity SEO editor/persistence input parity checks passed.`);
