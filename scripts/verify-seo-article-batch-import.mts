import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ARTICLE_BATCH_IMPORT_MAX_FAQ_ITEMS,
  articleBatchImportEnvelopeSchema,
  articleBatchImportItemSchema,
  buildArticleBatchImportFingerprint,
  findDuplicateValues,
} from "../src/app/admin/content/topics/article-actions/batch-import-schema.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const baseArticle = {
  title: "Validation fixture",
  slug: "validation-fixture",
  excerpt: "Validation fixture excerpt.",
  content: "# Validation fixture",
  image: "/images/fixture.webp",
  image_alt: "Fixture image",
  category_id: 11,
  series_id: 12,
  faq: [{ question: "Fixture question?", answer: "Fixture answer." }],
  seo_title: "Validation fixture SEO title",
  seo_description: "Validation fixture SEO description",
  focus_keyword: "validation fixture",
  seo_keywords: ["validation", "fixture"],
  canonical_url: "",
  robots_index: false,
  robots_follow: true,
  og_image: "",
  og_image_alt: "",
  is_featured: false,
  is_popular: false,
  show_title_on_page: true,
  show_image_on_page: true,
  show_excerpt_on_page: true,
  show_faq_on_page: true,
  show_faq_title_on_page: true,
};

const target = {
  category: { id: 11, name: "Category fixture", slug: "category-fixture" },
  series: { id: 12, name: "Series fixture", slug: "series-fixture" },
};

check(
  "the final Article dataset shape accepts the complete current contract",
  articleBatchImportEnvelopeSchema.safeParse({
    batch_key: "fixture-01",
    target,
    articles: [baseArticle],
  }).success && articleBatchImportItemSchema.safeParse(baseArticle).success,
);
check(
  "status is not accepted from the dataset and must be forced by the owner",
  !articleBatchImportItemSchema.safeParse({
    ...baseArticle,
    status: "published",
  }).success,
);
check(
  "FAQ is mandatory and capped at eight complete question-answer pairs",
  ARTICLE_BATCH_IMPORT_MAX_FAQ_ITEMS === 8 &&
    !articleBatchImportItemSchema.safeParse({ ...baseArticle, faq: [] }).success &&
    !articleBatchImportItemSchema.safeParse({
      ...baseArticle,
      faq: Array.from({ length: 9 }, (_, index) => ({
        question: `Question ${index}`,
        answer: `Answer ${index}`,
      })),
    }).success &&
    !articleBatchImportItemSchema.safeParse({
      ...baseArticle,
      faq: [{ question: " ", answer: "Answer" }],
    }).success,
);
check(
  "all current display flags are explicit dataset fields",
  [
    "show_title_on_page",
    "show_image_on_page",
    "show_excerpt_on_page",
    "show_faq_on_page",
    "show_faq_title_on_page",
  ].every((field) =>
    !articleBatchImportItemSchema.safeParse({
      ...baseArticle,
      [field]: undefined,
    }).success
  ),
);
check(
  "duplicate policy marks every repeated normalized slug",
  JSON.stringify(findDuplicateValues(["b", "a", "b", "a", "c"])) ===
    JSON.stringify(["a", "b"]),
);
check(
  "Dry Run fingerprints are stable by key order and bind content changes",
  buildArticleBatchImportFingerprint({ b: 2, a: { d: 4, c: 3 } }) ===
    buildArticleBatchImportFingerprint({ a: { c: 3, d: 4 }, b: 2 }) &&
    buildArticleBatchImportFingerprint(baseArticle) !==
      buildArticleBatchImportFingerprint({
        ...baseArticle,
        content: `${baseArticle.content}\nchanged`,
      }),
);

const [batch, create, save, validation, revalidation, cache, packageJson] =
  await Promise.all([
    read("src/app/admin/content/topics/article-actions/batch-import.ts"),
    read("src/app/admin/content/topics/article-actions/create-domain.ts"),
    read("src/app/admin/content/topics/article-actions/save.ts"),
    read("src/app/admin/content/topics/article-actions/validation.ts"),
    read("src/app/admin/content/topics/editor-actions/revalidate.ts"),
    read("src/lib/cache/revalidate-public-cache-tags.ts"),
    read("package.json"),
  ]);

check(
  "Batch stays inside the Article owner and reuses normalization, draft, publish, SEO, taxonomy, Audit, Media, and revalidation owners",
  [
    "getPayload",
    "getDraftBlockingChecks",
    "getPublishBlockingChecks",
    "validateEntitySeoValues",
    "getCategory",
    "getSeries",
    "getAdminContentSeriesCategoryError",
    "getConflictingTopicSlugs",
    "createArticleDomainRecord",
    "recordCmsAdminAudit",
    "revalidateUnifiedContentBatchPaths",
  ].every((marker) => batch.includes(marker)),
);
check(
  "the Batch adapter is not a Cookie Server Action or a parallel transport/runtime",
  !batch.includes('"use server"') &&
    !batch.includes("requireAdminSession") &&
    batch.includes("actorId: number") &&
    batch.includes("getAdminUserById(input.actorId)"),
);
check(
  "the editor and Batch share one Article create writer with Media coordination and insert-only persistence",
  save.includes("createArticleDomainRecord({") &&
    create.includes("coordinateMediaReferenceEntityMutation({") &&
    create.includes('.from("topics")') &&
    create.includes(".insert({") &&
    !create.includes(".upsert(") &&
    !save.includes(".insert({"),
);
check(
  "Batch forces unpublished and does not accept silent publishing",
  batch.includes('status: "unpublished"') &&
    !batch.includes('status: "published"') &&
    !batch.includes("published_by"),
);
check(
  "Dry Run is a mandatory exact-state gate before execution",
  batch.includes("dry_run_fingerprint_mismatch") &&
    batch.includes("input.dryRunFingerprint !== analysis.report.fingerprint") &&
    batch.indexOf("input.dryRunFingerprint !== analysis.report.fingerprint") <
      batch.indexOf("createArticleDomainRecord({"),
);
check(
  "duplicate slugs are preflighted in one owner and database races are skipped explicitly",
  validation.includes("getConflictingTopicSlugs") &&
    batch.includes("slug_conflict_during_execution") &&
    batch.includes("error instanceof ArticleSlugConflictError"),
);
check(
  "execution reports the required totals, IDs, slugs, duplicates, and resolved taxonomy",
  [
    "total:",
    "created:",
    "failed:",
    "skipped:",
    "duplicateSlugs:",
    "createdIds:",
    "createdSlugs:",
    "categorySeriesUsed:",
  ].every((marker) => batch.includes(marker)),
);
check(
  "the shared batch invalidation owner covers Topic cache and sitemap without manual deployment",
  revalidation.includes("revalidateUnifiedContentBatchPaths") &&
    revalidation.includes("revalidateTopicsCache()") &&
    cache.includes('revalidatePath("/sitemap.xml")'),
);
check(
  "the adapter contains no hardcoded Beit Al Watan identity",
  !batch.includes("bait-al-watan") &&
    !batch.includes("aldlyl-alshaml-lbyt-alwtn") &&
    !batch.includes("بيت الوطن"),
);
check(
  "the targeted verifier is registered in package scripts",
  packageJson.includes('"verify:seo-article-batch-import"'),
);

console.log(`verify:seo-article-batch-import passed (${passed} assertions)`);
