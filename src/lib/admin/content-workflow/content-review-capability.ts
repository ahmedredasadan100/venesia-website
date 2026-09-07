import type { ContentType } from "../content/content-types";
import {
  assertPayloadMatchesContentType,
  validateGalleryPayload,
  validateVideoPayload,
  type MediaTopicPayload,
} from "../media-topic-payload";
import {
  ENTITY_SEO_LIMITS,
  validateEntitySeoValues,
} from "../../seo/entity-seo-types";
import type {
  EntityReviewAnalysisGroup,
  EntityReviewCheck,
  EntityReviewCorrectionTarget,
  EntityReviewSeverity,
  EntityReviewStatus,
} from "../review/entity-review-presentation";

export type ContentReviewStatus = EntityReviewStatus;
export type ContentReviewSeverity = EntityReviewSeverity;

export type ContentReviewCorrectionTarget = EntityReviewCorrectionTarget & {
  tabId: "basic" | "faq" | "seo" | "publish";
};

export type ContentReviewCheck = Omit<EntityReviewCheck, "correctionTarget"> & {
  correctionTarget?: ContentReviewCorrectionTarget;
};

export type ContentReviewFaqItem = {
  question?: string;
  answer?: string;
};

export type ContentReviewInput = {
  contentType: ContentType;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  imageAlt: string;
  categorySlug: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogImage: string;
  ogImageAlt: string;
  faq?: ContentReviewFaqItem[];
  mediaPayload?: MediaTopicPayload | null;
};

export type ContentReleaseTitleQualityRule =
  | Readonly<{ kind: "exact"; value: string }>
  | Readonly<{ kind: "suffix"; value: string }>;

export type ContentReleaseTitleQualityPolicy = Readonly<{
  checkId: "release-title-quality";
  scope: "publish_only";
  rules: readonly ContentReleaseTitleQualityRule[];
  failureHint: string;
}>;

export const CONTENT_RELEASE_TITLE_QUALITY_POLICY = {
  checkId: "release-title-quality",
  scope: "publish_only",
  rules: [
    { kind: "exact", value: "test" },
    { kind: "exact", value: "test copy" },
    { kind: "exact", value: "copy" },
    { kind: "exact", value: "random" },
    { kind: "suffix", value: " - نسخة" },
  ],
  failureHint: "استبدل العنوان المؤقت بعنوان واضح قبل النشر.",
} as const satisfies ContentReleaseTitleQualityPolicy;

export function normalizeContentReleaseTitle(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}

function normalizeContentReleaseTitleRule(
  rule: ContentReleaseTitleQualityRule,
) {
  const value = rule.value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
  return rule.kind === "exact" ? value.trim() : value;
}

export function violatesContentReleaseTitleQualityPolicy(
  title: string,
  policy: ContentReleaseTitleQualityPolicy =
    CONTENT_RELEASE_TITLE_QUALITY_POLICY,
) {
  const normalizedTitle = normalizeContentReleaseTitle(title);
  if (!normalizedTitle) return false;

  return policy.rules.some((rule) => {
    const normalizedRule = normalizeContentReleaseTitleRule(rule);
    return rule.kind === "exact"
      ? normalizedTitle === normalizedRule
      : normalizedTitle.endsWith(normalizedRule);
  });
}

const COMMON_CORRECTION_TARGETS = {
  title: { tabId: "basic", targetId: "content-title" },
  slug: { tabId: "basic", targetId: "topic-slug" },
  category: { tabId: "basic", targetId: "content-category-listbox" },
  excerpt: { tabId: "basic", targetId: "content-excerpt" },
  image: { tabId: "basic", targetId: "content-image-field" },
  "image-alt": { tabId: "basic", targetId: "topic-image-alt" },
  faq: { tabId: "faq", targetId: "topic-faq-editor" },
  "video-url": { tabId: "basic", targetId: "video_url" },
  "gallery-images": { tabId: "basic", targetId: "gallery_image_url" },
  "gallery-alt": { tabId: "basic", targetId: "gallery_image_alt" },
} as const satisfies Record<string, ContentReviewCorrectionTarget>;

function seoTarget(_contentType: ContentType, field: "title" | "description" | "focus" | "canonical" | "og-alt") {
  const targetId = {
    title: "content-seo-title",
    description: "content-seo-description",
    focus: "content-focus-keyword",
    canonical: "content-canonical-url",
    "og-alt": "content-og-image-alt",
  }[field];
  return { tabId: "seo", targetId } as const;
}

function bodyTarget(contentType: ContentType): ContentReviewCorrectionTarget {
  if (contentType === "video") return COMMON_CORRECTION_TARGETS["video-url"];
  if (contentType === "gallery") return COMMON_CORRECTION_TARGETS["gallery-images"];
  return { tabId: "basic", targetId: "topic-content-markdown" };
}

export function resolveContentReviewCorrectionTarget(
  contentType: ContentType,
  checkId: string,
): ContentReviewCorrectionTarget | undefined {
  if (checkId === CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId) {
    return COMMON_CORRECTION_TARGETS.title;
  }
  if (checkId === "content" || checkId === "internal-links") return bodyTarget(contentType);
  if (checkId === "seo-title") return seoTarget(contentType, "title");
  if (checkId === "seo-description") return seoTarget(contentType, "description");
  if (checkId === "focus-keyword") return seoTarget(contentType, "focus");
  if (checkId === "canonical-url") return seoTarget(contentType, "canonical");
  if (checkId === "og-image-alt") return seoTarget(contentType, "og-alt");
  return COMMON_CORRECTION_TARGETS[checkId as keyof typeof COMMON_CORRECTION_TARGETS];
}

function severity(status: ContentReviewStatus): ContentReviewSeverity {
  if (status === "pass") return "success";
  if (status === "fail") return "error";
  if (status === "warn") return "warning";
  return "info";
}

function reviewGroup(checkId: string): EntityReviewAnalysisGroup {
  if (["image", "image-alt", "gallery-alt"].includes(checkId)) return "image";
  if (
    [
      "seo-title",
      "seo-description",
      "focus-keyword",
      "canonical-url",
      "og-image-alt",
      "internal-links",
    ].includes(checkId)
  ) {
    return "seo";
  }
  return "content";
}

function check(
  input: Pick<ContentReviewInput, "contentType">,
  value: Omit<ContentReviewCheck, "severity" | "correctionTarget" | "group">,
): ContentReviewCheck {
  return {
    ...value,
    severity: severity(value.status),
    group: reviewGroup(value.id),
    correctionTarget: resolveContentReviewCorrectionTarget(input.contentType, value.id),
  };
}

export function getContentReleaseTitleQualityCheck(
  input: Pick<ContentReviewInput, "contentType" | "title">,
) {
  const blocked = violatesContentReleaseTitleQualityPolicy(input.title);
  return check(input, {
    id: CONTENT_RELEASE_TITLE_QUALITY_POLICY.checkId,
    label: "جودة عنوان النشر",
    status: blocked ? "fail" : "pass",
    blocksPublish: true,
    hint: blocked
      ? CONTENT_RELEASE_TITLE_QUALITY_POLICY.failureHint
      : "العنوان لا يحمل علامة عنوان مؤقت.",
    field: "title",
  });
}

export function validateContentSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countInternalLinks(value: string) {
  return value.match(/\[[^\]]+\]\((\/topics\/|\/projects\/|\/media-center\/)[^)]+\)/g)?.length ?? 0;
}

function effectiveImage(input: ContentReviewInput) {
  if (input.image.trim()) return input.image.trim();
  if (input.mediaPayload?.kind === "video") return input.mediaPayload.thumbnail?.trim() ?? "";
  if (input.mediaPayload?.kind === "gallery") return input.mediaPayload.images[0]?.url?.trim() ?? "";
  return "";
}

function effectiveImageAlt(input: ContentReviewInput) {
  if (input.imageAlt.trim()) return input.imageAlt.trim();
  if (input.mediaPayload?.kind === "gallery") return input.mediaPayload.images[0]?.alt?.trim() ?? "";
  return "";
}

export function buildContentReviewChecks(input: ContentReviewInput): ContentReviewCheck[] {
  const image = effectiveImage(input);
  const imageAlt = effectiveImageAlt(input);
  const wordCount = countWords(input.content);
  const internalLinks = countInternalLinks(input.content);
  const entitySeoIssues = new Map(
    validateEntitySeoValues({
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      focusKeyword: input.focusKeyword,
      seoKeywords: [],
      canonicalUrl: input.canonicalUrl,
      robotsIndex: null,
      robotsFollow: null,
      ogImage: input.ogImage,
      ogImageAlt: input.ogImageAlt,
    }).map((issue) => [issue.field, issue.message]),
  );
  const checks: ContentReviewCheck[] = [
    check(input, {
      id: "title",
      label: "العنوان",
      status: input.title.trim() ? "pass" : "fail",
      blocksPublish: true,
      hint: input.title.trim() ? "العنوان موجود." : "أضف عنوانًا واضحًا للمحتوى.",
      field: "title",
    }),
    getContentReleaseTitleQualityCheck(input),
    check(input, {
      id: "slug",
      label: "Slug",
      status: input.slug.trim() && validateContentSlug(input.slug) ? "pass" : "fail",
      blocksPublish: true,
      hint: input.slug.trim() && validateContentSlug(input.slug)
        ? "صيغة الرابط صحيحة."
        : "استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.",
      field: "slug",
    }),
    check(input, {
      id: "category",
      label: "التصنيف",
      status: input.categorySlug.trim() ? "pass" : "fail",
      blocksPublish: true,
      hint: input.categorySlug.trim() ? "تم اختيار التصنيف." : "اختر تصنيفًا نشطًا.",
      field: "category_id",
    }),
    check(input, {
      id: "excerpt",
      label: "المقتطف",
      status: input.excerpt.trim().length >= 20 ? "pass" : "fail",
      blocksPublish: true,
      hint: input.excerpt.trim().length >= 20
        ? "المقتطف جاهز للنشر."
        : "أضف مقتطفًا لا يقل عن 20 حرفًا.",
      field: "excerpt",
    }),
    check(input, {
      id: "image",
      label: "صورة الغلاف",
      status: image ? "pass" : "fail",
      blocksPublish: true,
      hint: image ? "صورة الغلاف متوفرة." : "أضف صورة غلاف قبل النشر.",
      field: "image",
    }),
    check(input, {
      id: "image-alt",
      label: "Alt Text",
      status: image && imageAlt ? "pass" : "fail",
      blocksPublish: true,
      hint: !image
        ? "أضف صورة الغلاف أولًا ثم اكتب وصفها البديل."
        : imageAlt
          ? "وصف الصورة البديل متوفر."
          : "اكتب وصفًا بديلًا واضحًا للصورة.",
      field: "image_alt",
    }),
  ];

  if (input.contentType === "video") {
    const videoPayload = input.mediaPayload?.kind === "video" ? input.mediaPayload : null;
    const videoUrl = videoPayload?.video_url.trim() ?? "";
    const videoError = videoPayload
      ? validateVideoPayload(videoPayload, { published: true })
      : assertPayloadMatchesContentType(input.contentType, input.mediaPayload ?? null);
    checks.push(check(input, {
      id: "video-url",
      label: "رابط YouTube",
      status: videoUrl && !videoError ? "pass" : "fail",
      blocksPublish: true,
      hint: videoError ?? (videoUrl ? "رابط الفيديو متوفر وصالح." : "أضف رابط YouTube صالحًا."),
      field: "video_url",
    }));
  } else if (input.contentType === "gallery") {
    const images = input.mediaPayload?.kind === "gallery" ? input.mediaPayload.images : [];
    const galleryError = input.mediaPayload?.kind === "gallery"
      ? validateGalleryPayload(input.mediaPayload, { published: true })
      : assertPayloadMatchesContentType(input.contentType, input.mediaPayload ?? null);
    checks.push(check(input, {
      id: "gallery-images",
      label: "صور المعرض",
      status: images.length > 0 && !galleryError ? "pass" : "fail",
      blocksPublish: true,
      hint: galleryError ?? (images.length > 0 ? `${images.length} صورة في المعرض.` : "أضف صورة واحدة على الأقل."),
      field: "gallery_image_url",
    }));
    checks.push(check(input, {
      id: "gallery-alt",
      label: "Alt لكل صور المعرض",
      status: images.length === 0
        ? "info"
        : images.every((item) => Boolean(item.alt?.trim()))
          ? "pass"
          : "fail",
      blocksPublish: true,
      hint: images.length === 0
        ? "أضف صور المعرض أولًا ثم اكتب وصفًا بديلًا لكل صورة."
        : images.every((item) => Boolean(item.alt?.trim()))
        ? "كل صور المعرض لها وصف بديل."
        : "أضف وصفًا بديلًا لكل صورة في المعرض.",
      field: "gallery_image_alt",
    }));
  } else {
    checks.push(check(input, {
      id: "content",
      label: "جاهزية المحتوى",
      status: !input.content.trim() ? "fail" : wordCount >= 300 ? "pass" : "warn",
      blocksPublish: true,
      hint: !input.content.trim()
        ? "أضف نص المحتوى قبل النشر."
        : wordCount >= 300
          ? `${wordCount} كلمة — عمق جيد للمحتوى.`
          : `${wordCount} كلمة — المحتوى صالح، ويُفضّل توسيعه.`,
      field: "content",
    }));
  }

  checks.push(
    check(input, {
      id: "seo-title",
      label: "SEO Title",
      status: input.seoTitle.trim().length >= ENTITY_SEO_LIMITS.title.min && !entitySeoIssues.has("seo_title")
        ? "pass"
        : "fail",
      blocksPublish: true,
      hint: entitySeoIssues.get("seo_title") ?? (input.seoTitle.trim()
        ? `${input.seoTitle.trim().length} حرف — النطاق المطلوب ${ENTITY_SEO_LIMITS.title.min}–${ENTITY_SEO_LIMITS.title.max}.`
        : "أضف SEO Title قبل النشر."),
      field: "seo_title",
    }),
    check(input, {
      id: "seo-description",
      label: "SEO Description",
      status: input.seoDescription.trim().length >= ENTITY_SEO_LIMITS.description.min && !entitySeoIssues.has("seo_description")
        ? "pass"
        : "fail",
      blocksPublish: true,
      hint: entitySeoIssues.get("seo_description") ?? (input.seoDescription.trim()
        ? `${input.seoDescription.trim().length} حرف — النطاق المطلوب ${ENTITY_SEO_LIMITS.description.min}–${ENTITY_SEO_LIMITS.description.max}.`
        : "أضف SEO Description قبل النشر."),
      field: "seo_description",
    }),
    check(input, {
      id: "focus-keyword",
      label: "Focus Keyword",
      status: input.focusKeyword.trim() ? "pass" : "fail",
      blocksPublish: true,
      hint: input.focusKeyword.trim() ? "الكلمة المفتاحية محددة." : "حدد الكلمة المفتاحية الأساسية.",
      field: "focus_keyword",
    }),
    check(input, {
      id: "canonical-url",
      label: "Canonical URL",
      status: entitySeoIssues.has("canonical_url") ? "fail" : "pass",
      blocksPublish: true,
      hint: entitySeoIssues.get("canonical_url") ??
        "الرابط الأساسي صالح أو سيُولّد تلقائيًا.",
      field: "canonical_url",
    }),
    check(input, {
      id: "og-image-alt",
      label: "Alt لصورة المشاركة",
      status: entitySeoIssues.has("og_image_alt") ? "fail" : "pass",
      blocksPublish: true,
      hint: entitySeoIssues.get("og_image_alt") ?? "عقد صورة المشاركة مكتمل.",
      field: "og_image_alt",
    }),
  );

  if (input.contentType === "article") {
    const faq = input.faq ?? [];
    const partialFaq = faq.some(
      (item) => Boolean(item.question?.trim()) !== Boolean(item.answer?.trim()),
    );
    checks.push(check(input, {
      id: "faq",
      label: "الأسئلة الشائعة",
      status: partialFaq ? "fail" : "pass",
      blocksPublish: true,
      hint: partialFaq
        ? "أكمل السؤال والإجابة لكل صف أو احذف الصف الناقص."
        : "عقد FAQ مكتمل؛ يظل القسم اختياريًا.",
      field: "faq_question",
    }));
  }

  if (!["video", "gallery"].includes(input.contentType)) {
    checks.push(check(input, {
      id: "internal-links",
      label: "الروابط الداخلية",
      status: internalLinks > 0 ? "pass" : "warn",
      blocksPublish: false,
      hint: internalLinks > 0
        ? `${internalLinks} رابط داخلي مرتبط بالمحتوى.`
        : "أضف رابطًا داخليًا ذا صلة عندما يكون ذلك مناسبًا.",
      field: "content",
    }));
  }

  return checks;
}

export function getContentPublishBlockingChecks(
  input: ContentReviewInput,
): ContentReviewCheck[] {
  return buildContentReviewChecks(input).filter(
    (item) => item.blocksPublish && item.status === "fail",
  );
}

export function getContentDraftBlockingChecks(
  input: ContentReviewInput,
): ContentReviewCheck[] {
  return buildContentReviewChecks(input).filter((item) => {
    if (item.status !== "fail") return false;
    if (["title", "slug", "category", "canonical-url", "og-image-alt", "faq"].includes(item.id)) {
      return true;
    }
    if (item.id === "seo-title") {
      return input.seoTitle.trim().length > ENTITY_SEO_LIMITS.title.max;
    }
    if (item.id === "seo-description") {
      return input.seoDescription.trim().length > ENTITY_SEO_LIMITS.description.max;
    }
    return false;
  });
}

export function getContentPublishValidationError(
  input: ContentReviewInput,
): string | null {
  return getContentPublishBlockingChecks(input)[0]?.hint ?? null;
}
