import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const moduleLoader = require("node:module") as {
  _load(request: string, parent: NodeModule | null, isMain: boolean): unknown;
};
const loadModule = moduleLoader._load;
moduleLoader._load = (request, parent, isMain) =>
  request === "server-only" ? {} : loadModule(request, parent, isMain);

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  (module as NodeModule & { _compile(source: string, filename: string): void })._compile(output, filename);
};

const { getPayload, preservePayloadFromCurrent } = require(
  "../src/app/admin/content/topics/article-actions/helpers.ts",
) as typeof import("../src/app/admin/content/topics/article-actions/helpers.ts");
type TopicRow = import("../src/app/admin/content/topics/article-actions/types.ts").TopicRow;

const currentImage = "https://storage.example/cms-images/images/topics/current.jpg";
const currentTopic: TopicRow = {
  id: 1,
  title: "Regression topic",
  slug: "regression-topic",
  excerpt: "Current excerpt",
  content: "Current content",
  image: currentImage,
  image_alt: "Current alt",
  category_slug: "topics",
  status: "draft",
  published_at: null,
  seo_title: null,
  seo_description: null,
  focus_keyword: null,
  seo_keywords: [],
  canonical_url: null,
  robots_index: null,
  robots_follow: null,
  faq: [],
};

const explicitClearForm = new FormData();
explicitClearForm.set("image", "");
const explicitClearPayload = preservePayloadFromCurrent(getPayload(explicitClearForm), currentTopic);
assert.equal(explicitClearPayload.image, "");
console.log("PASS present empty image field remains empty");

const omittedImagePayload = preservePayloadFromCurrent(getPayload(new FormData()), currentTopic);
assert.equal(omittedImagePayload.image, currentImage);
console.log("PASS omitted image field preserves current image");

console.log("verify:topic-image-clear-persistence passed (2 assertions)");
