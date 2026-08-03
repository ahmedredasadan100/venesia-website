import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

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
  buildContentReviewChecks,
  getContentPublishBlockingChecks,
  getContentPublishValidationError,
} = require("../src/lib/admin/content-workflow/content-review-capability.ts") as typeof import("../src/lib/admin/content-workflow/content-review-capability.ts");
const {
  buildTopicPublishChecklist,
  getTopicPublishBlockingChecks,
} = require("../src/lib/admin/content-workflow/topic-publish-validation.ts") as typeof import("../src/lib/admin/content-workflow/topic-publish-validation.ts");
const {
  buildMediaPublishChecklist,
  getMediaPublishBlockingChecks,
} = require("../src/lib/admin/content-workflow/media-publish-validation.ts") as typeof import("../src/lib/admin/content-workflow/media-publish-validation.ts");
const { CONTENT_TYPES } = require("../src/lib/admin/content/content-types.ts") as typeof import("../src/lib/admin/content/content-types.ts");

type ReviewInput = import("../src/lib/admin/content-workflow/content-review-capability.ts").ContentReviewInput;

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const capability = read("src/lib/admin/content-workflow/content-review-capability.ts");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const sharedReview = read("src/components/admin/review/AdminEntityReviewPanel.tsx");
const reviewContract = read("src/lib/admin/review/entity-review-presentation.ts");
const articleSave = read("src/app/admin/content/topics/article-actions/save.ts");
const mediaSave = read("src/app/admin/content/topics/media-actions/save.ts");
const listActions = read("src/app/admin/content/topics/actions.ts");
const projectReview = read("src/components/admin/projects/ProjectPublishChecklistPanel.tsx");

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
  "an empty Gallery blocks publish and fixes the Gallery editor",
  getContentPublishBlockingChecks(emptyGallery).some(
    (item) => item.id === "gallery-images" && item.correctionTarget?.targetId === "gallery-editor",
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
  "a Gallery image without Alt blocks publish and fixes the Gallery editor",
  getContentPublishBlockingChecks(galleryWithoutAlt).some(
    (item) => item.id === "gallery-alt" && item.correctionTarget?.targetId === "gallery-editor",
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
