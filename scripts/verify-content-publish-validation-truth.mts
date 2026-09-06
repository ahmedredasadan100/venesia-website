import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const require = createRequire(import.meta.url);
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
  (module as NodeModule & { _compile(source: string, filename: string): void })._compile(
    output,
    filename,
  );
};

const {
  CONTENT_RELEASE_TITLE_QUALITY_POLICY,
  buildContentReviewChecks,
  getContentDraftBlockingChecks,
  getContentReleaseTitleQualityCheck,
  getContentPublishBlockingChecks,
  getContentPublishValidationError,
  normalizeContentReleaseTitle,
  violatesContentReleaseTitleQualityPolicy,
} = require("../src/lib/admin/content-workflow/content-review-capability.ts") as typeof import("../src/lib/admin/content-workflow/content-review-capability.ts");
const {
  buildTopicPublishChecklist,
  getTopicPublishBlockingChecks,
  parseTopicFaq,
  topicRowToPublishInput,
} = require("../src/lib/admin/content-workflow/topic-publish-validation.ts") as typeof import("../src/lib/admin/content-workflow/topic-publish-validation.ts");
const {
  buildContentReviewReport,
} = require("../src/lib/admin/content-workflow/content-review-report.ts") as typeof import("../src/lib/admin/content-workflow/content-review-report.ts");
const {
  buildMediaPublishChecklist,
  getMediaPublishBlockingChecks,
  mediaRowToPublishInput,
} = require("../src/lib/admin/content-workflow/media-publish-validation.ts") as typeof import("../src/lib/admin/content-workflow/media-publish-validation.ts");
const { CONTENT_TYPES, isContentType } = require("../src/lib/admin/content/content-types.ts") as typeof import("../src/lib/admin/content/content-types.ts");
const topicsBulkPublishContract = require("../src/lib/admin/content/topics-bulk-publish.ts") as typeof import("../src/lib/admin/content/topics-bulk-publish.ts");

type ReviewInput = import("../src/lib/admin/content-workflow/content-review-capability.ts").ContentReviewInput;

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const capability = read("src/lib/admin/content-workflow/content-review-capability.ts");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const sharedReview = read("src/components/admin/review/AdminEntityReviewPanel.tsx");
const reviewContract = read("src/lib/admin/review/entity-review-presentation.ts");
const articleSave = read("src/app/admin/content/topics/article-actions/save.ts");
const mediaSave = read("src/app/admin/content/topics/media-actions/save.ts");
const listActions = read("src/app/admin/content/topics/actions.ts");
const articleValidation = read("src/app/admin/content/topics/article-actions/validation.ts");
const reviewLoader = read("src/lib/admin/content-workflow/load-content-review-report.ts");
const projectReview = read("src/components/admin/projects/ProjectPublishChecklistPanel.tsx");

function parseSource(path: string, source = read(path)) {
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function findFunction(sourceFile: ts.SourceFile, name: string) {
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration?.body, `Missing executable function ${name}.`);
  return declaration;
}

function replaceFunctionBody(
  path: string,
  functionName: string,
  replacementBody: string,
) {
  const source = read(path);
  const sourceFile = parseSource(path, source);
  const declaration = findFunction(sourceFile, functionName);
  assert.ok(declaration.body);
  return `${source.slice(0, declaration.body.getStart(sourceFile))}${replacementBody}${source.slice(declaration.body.end)}`;
}

function callName(call: ts.CallExpression) {
  return ts.isIdentifier(call.expression)
    ? call.expression.text
    : ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name.text
      : null;
}

function callsInSourceOrder(node: ts.Node) {
  const calls: ts.CallExpression[] = [];
  const visit = (current: ts.Node) => {
    if (ts.isCallExpression(current)) calls.push(current);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return calls.sort((left, right) => left.getStart() - right.getStart());
}

function usesBroadSubstringMatch(node: ts.Node) {
  return callsInSourceOrder(node).some(
    (call) =>
      ts.isPropertyAccessExpression(call.expression) &&
      call.expression.name.text === "includes",
  );
}

function referencesEnvironment(node: ts.Node) {
  let found = false;
  const visit = (current: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(current) &&
      current.name.text === "env" &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === "process"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function releaseTitlePolicyLiteralCount(sourceFile: ts.SourceFile) {
  const normalizedRules = new Set(
    CONTENT_RELEASE_TITLE_QUALITY_POLICY.rules.map((rule) =>
      normalizeContentReleaseTitle(rule.value),
    ),
  );
  let count = 0;
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteralLike(node) &&
      normalizedRules.has(normalizeContentReleaseTitle(node.text))
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}

type InMemoryBulkHarness = {
  action: (formData: FormData) => Promise<Record<string, unknown>>;
  rpcCalls: () => number;
  directMutationCalls: () => number;
};

function loadInMemoryBulkPublishAction(
  rows: readonly Record<string, unknown>[],
): InMemoryBulkHarness {
  let rpcCallCount = 0;
  let directMutationCallCount = 0;
  const supabase = {
    from(table: string) {
      assert.equal(table, "topics");
      const query = {
        select() {
          return query;
        },
        in(field: string, ids: readonly number[]) {
          assert.equal(field, "id");
          return Promise.resolve({
            data: rows.filter((row) => ids.includes(Number(row.id))),
            error: null,
          });
        },
        insert() {
          directMutationCallCount += 1;
          return query;
        },
        update() {
          directMutationCallCount += 1;
          return query;
        },
        delete() {
          directMutationCallCount += 1;
          return query;
        },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "admin_publish_topics_atomically");
      rpcCallCount += 1;
      const requestedIds = (
        args.p_topics as Array<{ id: number; expected_updated_at: string }>
      ).map((item) => item.id);
      const alreadyPublishedIds = requestedIds.filter(
        (id) => rows.find((row) => Number(row.id) === id)?.status === "published",
      );
      const publishedIds = requestedIds.filter(
        (id) => !alreadyPublishedIds.includes(id),
      );
      return {
        data: {
          ok: true,
          code: "published",
          requestedIds,
          publishedIds,
          alreadyPublishedIds,
          committedAt: "2026-09-07T10:00:00.000Z",
          auditIds: publishedIds.map((id) => id + 1000),
        },
        error: null,
      };
    },
  };
  class InMemoryMediaReferenceWriteLeaseError extends Error {
    code = "in_memory";
  }
  const actionDependencies: Readonly<Record<string, unknown>> = {
    "next/cache": { revalidatePath: () => undefined },
    "../../../../lib/admin/auth/require-admin-session": {
      requireAdminSession: async () => ({ id: 73 }),
    },
    "../../../../lib/admin/admin-action-result": {
      adminActionFailure: (
        title: string,
        message: string,
        options: Record<string, unknown> = {},
      ) => ({ status: "error", title, message, ...options }),
      adminActionSuccess: (
        title: string,
        message: string,
        options: Record<string, unknown> = {},
      ) => ({ status: "success", title, message, ...options }),
      adminActionWarning: (
        title: string,
        message: string,
        options: Record<string, unknown> = {},
      ) => ({ status: "warning", title, message, ...options }),
    },
    "../../../../lib/admin/audit/cms-audit-actions": {
      buildCmsAuditAction: () => "in-memory",
    },
    "../../../../lib/admin/audit-log": {
      recordCmsAdminAudit: async () => undefined,
    },
    "../../../../lib/admin/content-workflow/media-publish-validation": {
      getMediaPublishBlockingChecks,
      mediaRowToPublishInput,
    },
    "../../../../lib/admin/content-workflow/topic-publish-validation": {
      getTopicPublishBlockingChecks,
      parseTopicFaq,
      topicRowToPublishInput,
    },
    "../../../../lib/admin/content-workflow/content-review-capability": {
      getContentReleaseTitleQualityCheck,
    },
    "../../../../lib/admin/content/content-types": { isContentType },
    "../../../../lib/admin/content-routes": {
      ADMIN_CONTENT_ROUTES: { topics: "/admin/content/topics" },
      adminContentTopicPath: (id: number) => `/admin/content/topics/${id}`,
    },
    "../../../../lib/content-public-visibility": {
      getContentPublicVisibilityState: () => ({
        actionIntent: "publish",
        nextStatus: "published",
        tooltip: "",
      }),
    },
    "../../../../lib/cache/revalidate-public-cache-tags": {
      revalidateMediaCenterCache: () => undefined,
      revalidateTopicsCache: () => undefined,
      runBoundedPublicCacheRevalidation: async () => ({ ok: true }),
    },
    "../../../../lib/media-center/revalidate-public-paths": {
      revalidateMediaCenterPublicPaths: () => undefined,
    },
    "../../../../lib/admin/content/topics-list-config": {
      TOPICS_COLUMN_CONTRACT_VERSION: "in-memory",
      TOPICS_LIST_VIEW_KEY: "content-topics",
      TOPICS_PREFERENCE_COLUMN_KEYS: [],
    },
    "../../../../lib/admin/content/topics-bulk-publish": {
      ...topicsBulkPublishContract,
      runTopicsBulkPublishPostCommit: async (
        metadata: { correlation_id: string },
      ) => ({
        feedbackStatus: "success",
        correlationId: metadata.correlation_id,
      }),
    },
    "../../../../lib/admin/preferences/admin-column-preferences": {
      saveAdminColumnPreferences: async () => undefined,
    },
    "../../../../lib/supabase-admin": { getSupabaseAdmin: () => supabase },
    "../../../../lib/logging": { logError: () => undefined },
    "../../../../lib/admin/content/category-hierarchy": {
      isAdminContentSeriesInCategory: () => true,
      TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE: "in-memory",
    },
    "../../../../lib/admin/media-catalog/domain-write-coordination": {
      coordinateMediaReferenceEntityMutation: async () => {
        throw new Error("Unexpected direct mutation in bulk policy proof.");
      },
    },
    "../../../../lib/admin/media-catalog/synchronization": {
      synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => ({
        status: "synchronized",
      }),
    },
    "../../../../lib/admin/media-catalog/write-lease": {
      getMediaReferenceWriteLeaseUserMessage: () => "in-memory",
      MediaReferenceWriteLeaseError: InMemoryMediaReferenceWriteLeaseError,
    },
    "../../../../lib/admin/links/usage": {
      getResourceLinkUsageCount: async () => 0,
    },
    "../../../../lib/admin/media-topic-payload": {
      parseMediaTopicPayload: (value: unknown) => value,
    },
  };
  const actionPath = "src/app/admin/content/topics/actions.ts";
  const compiled = ts.transpileModule(read(actionPath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: actionPath,
  }).outputText;
  const isolatedModule = {
    exports: {} as {
      bulkUpdateUnifiedContent(
        formData: FormData,
      ): Promise<Record<string, unknown>>;
    },
  };
  Function("exports", "module", "require", compiled)(
    isolatedModule.exports,
    isolatedModule,
    (specifier: string) => {
      assert.ok(
        Object.hasOwn(actionDependencies, specifier),
        `Unsupported isolated Action dependency: ${specifier}`,
      );
      return actionDependencies[specifier];
    },
  );
  return {
    action: isolatedModule.exports.bulkUpdateUnifiedContent,
    rpcCalls: () => rpcCallCount,
    directMutationCalls: () => directMutationCallCount,
  };
}

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const base: ReviewInput = {
  contentType: "article",
  title: "عنوان صالح للنشر",
  slug: "publish-ready-content",
  excerpt: "هذا مقتطف صالح يزيد طوله بوضوح على عشرين حرفًا.",
  content: Array.from({ length: 300 }, (_, index) => `كلمة${index}`).join(" "),
  image: "/images/publish-ready.jpg",
  imageAlt: "وصف بديل لصورة الغلاف",
  categorySlug: "1",
  seoTitle: "س".repeat(45),
  seoDescription: "ص".repeat(120),
  focusKeyword: "جاهزية النشر",
  canonicalUrl: "",
  ogImage: "",
  ogImageAlt: "",
  faq: [],
  mediaPayload: null,
};

check(
  "the FAQ Database JSON parser accepts only a complete canonical array",
  JSON.stringify(parseTopicFaq([{ question: "Question", answer: "Answer" }])) ===
    JSON.stringify([{ question: "Question", answer: "Answer" }]) &&
    parseTopicFaq(null) === null &&
    parseTopicFaq([
      { question: "Question", answer: "Answer" },
      { question: "Malformed", answer: 42 },
    ]) === null,
);

const invalidFaqReview = buildContentReviewReport([{
  id: 1,
  title: base.title,
  slug: base.slug,
  status: "published",
  contentType: "article",
  excerpt: base.excerpt,
  content: base.content,
  image: base.image,
  imageAlt: base.imageAlt,
  categorySlug: base.categorySlug,
  seoTitle: base.seoTitle,
  seoDescription: base.seoDescription,
  focusKeyword: base.focusKeyword,
  canonicalUrl: base.canonicalUrl,
  ogImage: base.ogImage,
  ogImageAlt: base.ogImageAlt,
  faq: [],
  faqContractValid: false,
  mediaPayload: null,
}]);
check(
  "Content Review reports malformed persisted FAQ JSON as an explicit blocker",
  invalidFaqReview.blockingChecks.some((item) => item.id === "faq") &&
    invalidFaqReview.publishedWithBlocks === 1,
);
check(
  "FAQ Database JSON narrowing has one owner and bulk publish fails closed",
  [listActions, articleValidation, reviewLoader].every((source) =>
    source.includes("parseTopicFaq"),
  ) &&
    [listActions, articleValidation, reviewLoader].every((source) =>
      !source.includes("function normalizeTopicFaq"),
    ) &&
    listActions.includes('topic.content_type === "article" && faq === null') &&
    listActions.includes('focusTarget: "topic-faq-editor"') &&
    reviewLoader.includes("faqContractValid: faq !== null"),
);

function inputFor(contentType: ReviewInput["contentType"]): ReviewInput {
  if (contentType === "video") {
    return {
      ...base,
      contentType,
      content: "",
      mediaPayload: {
        kind: "video",
        provider: "youtube",
        video_url: "https://www.youtube.com/watch?v=valid-video-id",
        thumbnail: "/images/video-cover.jpg",
      },
    };
  }
  if (contentType === "gallery") {
    return {
      ...base,
      contentType,
      content: "",
      mediaPayload: {
        kind: "gallery",
        images: [{ url: "/images/gallery-1.jpg", alt: "وصف صورة المعرض" }],
      },
    };
  }
  return { ...base, contentType, faq: contentType === "article" ? [] : undefined };
}

check(
  "the canonical content registry covers exactly the six in-scope types",
  JSON.stringify(CONTENT_TYPES) ===
    JSON.stringify(["article", "news", "press", "site_update", "video", "gallery"]),
);

check(
  "the typed release-title policy is publish-only and owns the approved exact and suffix rules",
  CONTENT_RELEASE_TITLE_QUALITY_POLICY.scope === "publish_only" &&
    CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId === "release-title-quality" &&
    JSON.stringify(CONTENT_RELEASE_TITLE_QUALITY_POLICY.rules) ===
      JSON.stringify([
        { kind: "exact", value: "test" },
        { kind: "exact", value: "test copy" },
        { kind: "exact", value: "copy" },
        { kind: "exact", value: "random" },
        { kind: "suffix", value: " - نسخة" },
      ]),
);

check(
  "release-title normalization is Unicode-aware, case-folded, trimmed, and whitespace-stable",
  normalizeContentReleaseTitle("  ＴＥＳＴ\t  COPY  ") === "test copy",
);

const temporaryTitles = [
  "test",
  "  TeSt   CoPy  ",
  "COPY",
  " Random ",
  "عنوان حقيقي   -   نسخة",
] as const;
for (const title of temporaryTitles) {
  const input = { ...base, title };
  const draftIssues = getContentDraftBlockingChecks(input);
  const publishIssues = getContentPublishBlockingChecks(input);
  const qualityIssue = publishIssues.find(
    (item) => item.id === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId,
  );
  check(
    `temporary title ${JSON.stringify(title)} remains draft-saveable and blocks publish at the visible title field`,
    !draftIssues.some(
      (item) => item.id === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId,
    ) &&
      Boolean(qualityIssue) &&
      qualityIssue?.field === "title" &&
      qualityIssue.correctionTarget?.tabId === "basic" &&
      qualityIssue.correctionTarget.targetId === "content-title",
  );
}

const legitimateNearMatches = [
  "contest",
  "Test-driven development in editorial workflows",
  "Copywriting guide for release notes",
  "Randomized study of content quality",
  "عنوان حقيقي يناقش الاختبارات ونسخ المحتوى",
  "عنوان - نسخة محدثة",
] as const;
for (const title of legitimateNearMatches) {
  check(
    `legitimate near-match ${JSON.stringify(title)} is not rejected by the release-title policy`,
    !violatesContentReleaseTitleQualityPolicy(title) &&
      !getContentPublishBlockingChecks({ ...base, title }).some(
        (item) => item.id === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId,
      ),
  );
}

const emptyTitleChecks = buildContentReviewChecks({ ...base, title: "" });
check(
  "the existing required-title check remains independent and sole owner of empty-title failure",
  emptyTitleChecks.some(
    (item) => item.id === "title" && item.status === "fail",
  ) &&
    emptyTitleChecks.some(
      (item) =>
        item.id === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId &&
        item.status === "pass",
    ),
);

for (const contentType of CONTENT_TYPES) {
  const input = inputFor(contentType);
  check(
    `${contentType} accepts a payload with no publish blockers`,
    getContentPublishBlockingChecks(input).length === 0 &&
      getContentPublishValidationError(input) === null,
  );

  const wrapperChecks = contentType === "article"
    ? getTopicPublishBlockingChecks(input)
    : getMediaPublishBlockingChecks(input as Parameters<typeof getMediaPublishBlockingChecks>[0]);
  const checklist = contentType === "article"
    ? buildTopicPublishChecklist(input)
    : buildMediaPublishChecklist(input as Parameters<typeof buildMediaPublishChecklist>[0]);
  check(
    `${contentType} wrappers expose the same blocking IDs as Review`,
    JSON.stringify(wrapperChecks.map((item) => item.id)) ===
      JSON.stringify(getContentPublishBlockingChecks(input).map((item) => item.id)) &&
      JSON.stringify(checklist.map((item) => item.id)) ===
        JSON.stringify(buildContentReviewChecks(input).map((item) => item.id)),
  );

  const temporaryInput = { ...input, title: "TEST COPY" };
  const temporaryWrapperChecks = contentType === "article"
    ? getTopicPublishBlockingChecks(temporaryInput)
    : getMediaPublishBlockingChecks(
        temporaryInput as Parameters<typeof getMediaPublishBlockingChecks>[0],
      );
  check(
    `${contentType} publish uses the canonical release-title decision while draft remains allowed`,
    temporaryWrapperChecks.some(
      (item) => item.id === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId,
    ) &&
      !getContentDraftBlockingChecks(temporaryInput).some(
        (item) => item.id === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId,
      ),
  );
}

const commonBlockingCases: Array<{
  id: string;
  input: ReviewInput;
  expected: string;
}> = [
  { id: "title", input: { ...base, title: "" }, expected: "title" },
  { id: "slug", input: { ...base, slug: "Invalid Slug" }, expected: "slug" },
  { id: "category", input: { ...base, categorySlug: "" }, expected: "category" },
  { id: "excerpt", input: { ...base, excerpt: "قصير" }, expected: "excerpt" },
  { id: "content", input: { ...base, content: "" }, expected: "content" },
  { id: "image", input: { ...base, image: "" }, expected: "image" },
  { id: "image-alt", input: { ...base, imageAlt: "" }, expected: "image-alt" },
  { id: "focus", input: { ...base, focusKeyword: "" }, expected: "focus-keyword" },
  { id: "seo-title-min", input: { ...base, seoTitle: "س".repeat(44) }, expected: "seo-title" },
  { id: "seo-title-max", input: { ...base, seoTitle: "س".repeat(61) }, expected: "seo-title" },
  { id: "seo-description-min", input: { ...base, seoDescription: "ص".repeat(119) }, expected: "seo-description" },
  { id: "seo-description-max", input: { ...base, seoDescription: "ص".repeat(161) }, expected: "seo-description" },
  { id: "canonical", input: { ...base, canonicalUrl: "ftp://invalid.example" }, expected: "canonical-url" },
  { id: "og-alt", input: { ...base, ogImage: "/images/og.jpg", ogImageAlt: "" }, expected: "og-image-alt" },
  {
    id: "faq",
    input: { ...base, faq: [{ question: "سؤال غير مكتمل", answer: "" }] },
    expected: "faq",
  },
];

for (const testCase of commonBlockingCases) {
  const issues = getContentPublishBlockingChecks(testCase.input);
  check(
    `${testCase.id} is rejected by the canonical publish contract with a correction target`,
    issues.some(
      (item) =>
        item.id === testCase.expected &&
        item.blocksPublish &&
        item.status === "fail" &&
        Boolean(item.field) &&
        Boolean(item.correctionTarget?.tabId) &&
        Boolean(item.correctionTarget?.targetId),
    ),
  );
}

const warningOnly = {
  ...base,
  content: "محتوى قصير صالح للنشر لكنه يحتاج تحسينًا",
};
const warningChecks = buildContentReviewChecks(warningOnly);
check(
  "short content and missing internal links remain warnings that do not block publish",
  warningChecks.filter((item) => ["content", "internal-links"].includes(item.id)).every(
    (item) => item.status === "warn",
  ) && getContentPublishBlockingChecks(warningOnly).length === 0,
);

const invalidVideo = {
  ...inputFor("video"),
  mediaPayload: {
    kind: "video" as const,
    provider: "youtube" as const,
    video_url: "https://example.com/not-youtube",
    thumbnail: "/images/video-cover.jpg",
  },
};
check(
  "invalid Video URL blocks publish and fixes the visible video field",
  getContentPublishBlockingChecks(invalidVideo).some(
    (item) => item.id === "video-url" && item.correctionTarget?.targetId === "video_url",
  ),
);

const emptyGallery = {
  ...inputFor("gallery"),
  mediaPayload: { kind: "gallery" as const, images: [] },
};
check(
  "an empty Gallery blocks publish and fixes the first visible Gallery URL field",
  getContentPublishBlockingChecks(emptyGallery).some(
    (item) => item.id === "gallery-images" && item.correctionTarget?.targetId === "gallery_image_url",
  ),
);

const galleryWithoutAlt = {
  ...inputFor("gallery"),
  mediaPayload: {
    kind: "gallery" as const,
    images: [{ url: "/images/gallery-1.jpg", alt: "" }],
  },
};
check(
  "a Gallery image without Alt blocks publish and fixes the first suitable visible Alt field",
  getContentPublishBlockingChecks(galleryWithoutAlt).some(
    (item) => item.id === "gallery-alt" && item.correctionTarget?.targetId === "gallery_image_alt",
  ),
);

const allBlockingChecks = CONTENT_TYPES.flatMap((contentType) => {
  const input = inputFor(contentType);
  const empty = {
    ...input,
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    image: "",
    imageAlt: "",
    categorySlug: "",
    seoTitle: "",
    seoDescription: "",
    focusKeyword: "",
    canonicalUrl: "ftp://invalid.example",
    ogImage: "/images/og.jpg",
    ogImageAlt: "",
    faq: contentType === "article" ? [{ question: "سؤال", answer: "" }] : undefined,
    mediaPayload: contentType === "video"
      ? { kind: "video" as const, provider: "youtube" as const, video_url: "" }
      : contentType === "gallery"
        ? { kind: "gallery" as const, images: [{ url: "/images/gallery.jpg", alt: "" }] }
        : null,
  };
  return buildContentReviewChecks(empty).filter((item) => item.blocksPublish);
});
check(
  "every declared publish-blocking check owns a field and shared correction target",
  allBlockingChecks.every(
    (item) => Boolean(item.field) && Boolean(item.correctionTarget?.tabId) && Boolean(item.correctionTarget?.targetId),
  ),
);

const canonicalPublishBinding = [
  {
    sourceFile:
      "src/lib/admin/content-workflow/content-review-capability.ts",
    exportNames: ["getContentPublishBlockingChecks"],
  },
] as const;
const canonicalReleaseTitleBinding = [
  {
    sourceFile:
      "src/lib/admin/content-workflow/content-review-capability.ts",
    exportNames: ["getContentReleaseTitleQualityCheck"],
  },
] as const;
const publishEntryPoints = [
  {
    label: "Article Save as Published",
    entrySourceFile:
      "src/app/admin/content/topics/article-actions/save.ts",
  },
  {
    label: "all Media Save as Published variants",
    entrySourceFile: "src/app/admin/content/topics/media-actions/save.ts",
  },
  {
    label: "row and atomic bulk publish",
    entrySourceFile: "src/app/admin/content/topics/actions.ts",
  },
] as const;

for (const entryPoint of publishEntryPoints) {
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [entryPoint.entrySourceFile],
  });
  check(
    `${entryPoint.label} reaches the canonical publish-quality decision through the executable graph`,
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: canonicalPublishBinding,
    }),
  );
}

const bulkReleaseTitleGraph = collectExecutableSourceGraph({
  root: ROOT,
  entrySourceFiles: ["src/app/admin/content/topics/actions.ts"],
});
check(
  "atomic bulk publish directly reaches the central release-title check for the full selection",
  graphUsesExecutableBinding({
    root: ROOT,
    graph: bulkReleaseTitleGraph,
    bindings: canonicalReleaseTitleBinding,
  }),
);

const publicationGraphSources = new Map<string, ts.SourceFile>();
for (const entryPoint of publishEntryPoints) {
  for (const [sourceFile, parsedSource] of collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [entryPoint.entrySourceFile],
  })) {
    publicationGraphSources.set(sourceFile, parsedSource);
  }
}
const releaseTitlePolicyOwner =
  "src/lib/admin/content-workflow/content-review-capability.ts";
const parallelPolicyLiteralLocations = [...publicationGraphSources]
  .filter(([sourceFile]) => sourceFile !== releaseTitlePolicyOwner)
  .flatMap(([sourceFile, parsedSource]) =>
    releaseTitlePolicyLiteralCount(parsedSource) > 0 ? [sourceFile] : [],
  );
const localPolicyFixture = parseSource(
  "local-title-policy-fixture.ts",
  'const localPolicy = new Set(["test", "copy", " - نسخة"]);',
);
check(
  "the executable publication graph contains no local copy of the release-title rules",
  parallelPolicyLiteralLocations.length === 0 &&
    releaseTitlePolicyLiteralCount(localPolicyFixture) === 3,
);

const actionsAst = parseSource("src/app/admin/content/topics/actions.ts");
const rowPublishFunction = findFunction(actionsAst, "setUnifiedContentStatus");
const bulkPublishFunction = findFunction(actionsAst, "bulkUpdateUnifiedContent");
const rowPublishCalls = callsInSourceOrder(rowPublishFunction);
const bulkPublishCalls = callsInSourceOrder(bulkPublishFunction);
const rowValidationCall = rowPublishCalls.find(
  (call) => callName(call) === "getPublishFailure",
);
const rowWriteCall = rowPublishCalls.find((call) => callName(call) === "update");
const bulkValidationCall = bulkPublishCalls.find(
  (call) => callName(call) === "getPublishFailure",
);
const bulkReleaseTitleCall = bulkPublishCalls.find(
  (call) => callName(call) === "getReleaseTitleQualityFailure",
);
const bulkRpcCall = bulkPublishCalls.find((call) => callName(call) === "rpc");
check(
  "row and bulk publish perform canonical semantic validation before their write boundary",
  Boolean(rowValidationCall) &&
    Boolean(rowWriteCall) &&
    rowValidationCall!.getStart(actionsAst) < rowWriteCall!.getStart(actionsAst) &&
    Boolean(bulkValidationCall) &&
    Boolean(bulkReleaseTitleCall) &&
    Boolean(bulkRpcCall) &&
    bulkReleaseTitleCall!.getStart(actionsAst) < bulkRpcCall!.getStart(actionsAst) &&
    bulkValidationCall!.getStart(actionsAst) < bulkRpcCall!.getStart(actionsAst),
);

const capabilityAst = parseSource(
  "src/lib/admin/content-workflow/content-review-capability.ts",
);
const titlePolicyEvaluator = findFunction(
  capabilityAst,
  "violatesContentReleaseTitleQualityPolicy",
);
const broadSubstringFixture = findFunction(
  parseSource(
    "broad-substring-fixture.ts",
    'function broadTitlePolicy(title: string) { return title.includes("test"); }',
  ),
  "broadTitlePolicy",
);
check(
  "the central title-quality evaluator has no environment gate or broad substring match",
  !referencesEnvironment(titlePolicyEvaluator) &&
    !usesBroadSubstringMatch(titlePolicyEvaluator) &&
    usesBroadSubstringMatch(broadSubstringFixture),
);

const negativeGraphFixtures = [
  {
    entrySourceFile:
      "src/app/admin/content/topics/article-actions/save.ts",
    sourceFile:
      "src/app/admin/content/topics/article-actions/helpers.ts",
    functionName: "getPublishBlockingChecks",
  },
  {
    entrySourceFile: "src/app/admin/content/topics/media-actions/save.ts",
    sourceFile: "src/app/admin/content/topics/media-actions/helpers.ts",
    functionName: "getPublishedValidationChecks",
  },
  {
    entrySourceFile: "src/app/admin/content/topics/actions.ts",
    sourceFile: "src/app/admin/content/topics/actions.ts",
    functionName: "getPublishFailure",
  },
] as const;
for (const fixture of negativeGraphFixtures) {
  const sourceOverrides = new Map([
    [
      fixture.sourceFile,
      replaceFunctionBody(fixture.sourceFile, fixture.functionName, "{ return []; }"),
    ],
  ]);
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [fixture.entrySourceFile],
    sourceOverrides,
  });
  check(
    `${fixture.functionName} negative fixture loses canonical publish-quality reachability`,
    !graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: canonicalPublishBinding,
      sourceOverrides,
    }),
  );
}

function persistedArticle(
  id: number,
  title: string,
  status: "published" | "unpublished" = "unpublished",
) {
  return {
    id,
    title,
    slug: `bulk-title-policy-${id}`,
    excerpt: base.excerpt,
    content: base.content,
    image: base.image,
    image_alt: base.imageAlt,
    category_slug: base.categorySlug,
    content_type: "article",
    media_payload: null,
    seo_title: base.seoTitle,
    seo_description: base.seoDescription,
    focus_keyword: base.focusKeyword,
    canonical_url: base.canonicalUrl,
    og_image: base.ogImage,
    og_image_alt: base.ogImageAlt,
    faq: [],
    status,
    deleted_at: null,
    published_at: null,
    updated_at: `2026-09-07T10:00:0${id}.000Z`,
  };
}

function bulkPublishForm(ids: readonly number[]) {
  const formData = new FormData();
  formData.set("bulk_action", "publish");
  ids.forEach((id) => formData.append("topic_ids", String(id)));
  return formData;
}

const invalidBulkHarness = loadInMemoryBulkPublishAction([
  persistedArticle(1, base.title),
  persistedArticle(2, "test"),
]);
const invalidBulkResult = await invalidBulkHarness.action(
  bulkPublishForm([1, 2]),
);
check(
  "a mixed valid and temporary-title bulk selection aborts before every write and RPC",
  invalidBulkResult.status === "error" &&
    invalidBulkResult.code === "publish_validation" &&
    invalidBulkResult.entityId === 2 &&
    invalidBulkResult.focusTarget === "content-title" &&
    invalidBulkHarness.rpcCalls() === 0 &&
    invalidBulkHarness.directMutationCalls() === 0,
);

const invalidAlreadyPublishedBulkHarness = loadInMemoryBulkPublishAction([
  persistedArticle(1, base.title),
  persistedArticle(2, "عنوان قديم - نسخة", "published"),
]);
const invalidAlreadyPublishedBulkResult =
  await invalidAlreadyPublishedBulkHarness.action(bulkPublishForm([1, 2]));
check(
  "a selected already-published temporary title aborts the whole mixed bulk request before RPC",
  invalidAlreadyPublishedBulkResult.status === "error" &&
    invalidAlreadyPublishedBulkResult.code === "publish_validation" &&
    invalidAlreadyPublishedBulkResult.entityId === 2 &&
    invalidAlreadyPublishedBulkHarness.rpcCalls() === 0 &&
    invalidAlreadyPublishedBulkHarness.directMutationCalls() === 0,
);

const publishedLegacyNonTitleDebt = {
  ...persistedArticle(2, "عنوان منشور قديم سليم", "published"),
  excerpt: "",
  image: "",
  image_alt: "",
  category_slug: "",
  seo_title: "",
  seo_description: "",
  focus_keyword: "",
};
const legacyNoOpBulkHarness = loadInMemoryBulkPublishAction([
  persistedArticle(1, base.title),
  publishedLegacyNonTitleDebt,
]);
const legacyNoOpBulkResult = await legacyNoOpBulkHarness.action(
  bulkPublishForm([1, 2]),
);
check(
  "an already-published row with only legacy non-title debt remains a no-op in a valid mixed bulk request",
  legacyNoOpBulkResult.status === "success" &&
    legacyNoOpBulkResult.code === "published" &&
    legacyNoOpBulkHarness.rpcCalls() === 1 &&
    legacyNoOpBulkHarness.directMutationCalls() === 0,
);

const validBulkHarness = loadInMemoryBulkPublishAction([
  persistedArticle(1, base.title),
  persistedArticle(2, "عنوان إصدار ثان صالح"),
]);
const validBulkResult = await validBulkHarness.action(bulkPublishForm([1, 2]));
check(
  "a valid bulk selection crosses one atomic RPC boundary and performs no direct row write",
  validBulkResult.status === "success" &&
    validBulkResult.code === "published" &&
    validBulkHarness.rpcCalls() === 1 &&
    validBulkHarness.directMutationCalls() === 0,
);

check(
  "Review Validation summarizes every failed blocksPublish check without changing dashboard geometry",
  sharedReview.includes("item.blocksPublish && item.status === \"fail\"") &&
    sharedReview.includes("items={blockingIssues}") &&
    sharedReview.includes("lg:grid-cols-3") &&
    sharedReview.includes("data-admin-entity-review-validation-row") &&
    review.includes('data-content-review-presentation="dashboard"') &&
    sharedReview.includes("ملخص الحالة") &&
    !sharedReview.includes("سجل المراجعة"),
);
check(
  "Review and server consumers use explicit blocking semantics instead of severity",
  reviewContract.includes("blocksPublish: boolean") &&
    capability.includes('item.blocksPublish && item.status === "fail"') &&
    [articleSave, mediaSave, listActions].every((source) => source.includes("PublishBlockingChecks") || source.includes("PublishedValidationChecks")),
);
check(
  "Article and Media publish preflight run before upload and persistence side effects",
  articleSave.indexOf("const publishErrors = validateTopicFields") <
      articleSave.indexOf("payload.image = await uploadTopicImage") &&
    mediaSave.indexOf("const publishIssues = getPublishedValidationChecks") <
      mediaSave.indexOf("await uploadMediaImage") &&
    mediaSave.indexOf("await uploadMediaImage") < mediaSave.indexOf('.from("topics")'),
);
check(
  "typed Save adapters no longer own parallel publish-rule lists",
  !articleSave.includes("ENTITY_SEO_LIMITS") &&
    !articleSave.includes("validateEntitySeoValues") &&
    !mediaSave.includes("validateEntitySeoValues") &&
    !mediaSave.includes("function publishField") &&
    !mediaSave.includes("payload.seoTitle.length") &&
    !mediaSave.includes("payload.seoDescription.length") &&
    !articleSave.includes("payload.seoTitle.length") &&
    !articleSave.includes("payload.seoDescription.length"),
);
check(
  "Project Review stays outside the shared content validation contract",
  !projectReview.includes("content-review-capability") &&
    !projectReview.includes("ContentReviewPanel"),
);

console.log(`verify:content-publish-validation-truth passed (${passed} assertions)`);
