import type { ContentType } from "../content/content-types";
import {
  assertPayloadMatchesContentType,
  validateGalleryPayload,
  validateVideoPayload,
  type MediaTopicPayload,
} from "../media-topic-payload";
import { ENTITY_SEO_LIMITS } from "../../seo/entity-seo-types";

export type ContentReviewStatus = "pass" | "warn" | "fail" | "info";
export type ContentReviewSeverity = "success" | "error" | "warning" | "info";

export type ContentReviewCorrectionTarget = {
  tabId: "basic" | "faq" | "seo" | "publish";
  targetId: string;
};

export type ContentReviewCheck = {
  id: string;
  label: string;
  status: ContentReviewStatus;
  severity: ContentReviewSeverity;
  hint: string;
  field?: string;
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

const COMMON_CORRECTION_TARGETS = {
  title: { tabId: "basic", targetId: "content-title" },
  slug: { tabId: "basic", targetId: "topic-slug" },
  category: { tabId: "basic", targetId: "content-category-listbox" },
  excerpt: { tabId: "basic", targetId: "content-excerpt" },
  image: { tabId: "basic", targetId: "content-image-field" },
  "image-alt": { tabId: "basic", targetId: "topic-image-alt" },
  faq: { tabId: "faq", targetId: "topic-faq-editor" },
  "video-url": { tabId: "basic", targetId: "video_url" },
  "gallery-images": { tabId: "basic", targetId: "gallery-editor" },
  "gallery-alt": { tabId: "basic", targetId: "gallery-editor" },
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

function check(
  input: ContentReviewInput,
  value: Omit<ContentReviewCheck, "severity" | "correctionTarget">,
): ContentReviewCheck {
  return {
    ...value,
    severity: severity(value.status),
    correctionTarget: resolveContentReviewCorrectionTarget(input.contentType, value.id),
  };
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

function canonicalIsValid(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getContentDraftValidationError(input: ContentReviewInput): string | null {
  if (!input.title.trim()) return "العنوان مطلوب.";
  if (!input.slug.trim()) return "الرابط مطلوب.";
  if (!validateContentSlug(input.slug)) {
    return "الـ Slug يجب أن يتكوّن من أحرف إنجليزية صغيرة وأرقام وشرطات فقط.";
  }
  if (!input.categorySlug.trim()) return "التصنيف مطلوب.";
  return null;
}

export function getContentPublishValidationError(input: ContentReviewInput): string | null {
  const draftError = getContentDraftValidationError(input);
  if (draftError) return draftError;
  const seoTitleLength = input.seoTitle.trim().length;
  const seoDescriptionLength = input.seoDescription.trim().length;
  if (!input.excerpt.trim() || input.excerpt.trim().length < 20) {
    return "الوصف المختصر مطلوب ولا يقل عن 20 حرفًا.";
  }

  if (input.contentType === "video" || input.contentType === "gallery") {
    const matchError = assertPayloadMatchesContentType(input.contentType, input.mediaPayload ?? null);
    if (matchError) return matchError;
    if (input.contentType === "video" && input.mediaPayload?.kind === "video") {
      const videoError = validateVideoPayload(input.mediaPayload, { published: true });
      if (videoError) return videoError;
    }
    if (input.contentType === "gallery" && input.mediaPayload?.kind === "gallery") {
      const galleryError = validateGalleryPayload(input.mediaPayload, { published: true });
      if (galleryError) return galleryError;
      if (input.mediaPayload.images.some((item) => !item.alt?.trim())) {
        return "النص البديل مطلوب لكل صورة في المعرض قبل النشر.";
      }
    }
  } else if (!input.content.trim()) {
    return "نص المحتوى مطلوب قبل النشر.";
  }

  if (!effectiveImage(input)) return "صورة الغلاف مطلوبة قبل النشر.";
  if (!effectiveImageAlt(input)) return "وصف الصورة Alt Text مطلوب قبل النشر.";
  if (!input.focusKeyword.trim()) return "Focus Keyword مطلوب قبل النشر.";
  if (!input.seoTitle.trim()) return "SEO Title مطلوب قبل النشر.";
  if (
    seoTitleLength < ENTITY_SEO_LIMITS.title.min ||
    seoTitleLength > ENTITY_SEO_LIMITS.title.max
  ) {
    return `SEO Title يجب أن يكون بين ${ENTITY_SEO_LIMITS.title.min} و${ENTITY_SEO_LIMITS.title.max} حرفًا.`;
  }
  if (!input.seoDescription.trim()) return "SEO Description مطلوب قبل النشر.";
  if (
    seoDescriptionLength < ENTITY_SEO_LIMITS.description.min ||
    seoDescriptionLength > ENTITY_SEO_LIMITS.description.max
  ) {
    return `SEO Description يجب أن يكون بين ${ENTITY_SEO_LIMITS.description.min} و${ENTITY_SEO_LIMITS.description.max} حرفًا.`;
  }
  if (!canonicalIsValid(input.canonicalUrl)) return "الرابط الأساسي يجب أن يبدأ بـ http أو https.";
  if (input.ogImage.trim() && !input.ogImageAlt.trim()) {
    return "النص البديل لصورة المشاركة مطلوب عند اختيار الصورة.";
  }
  if (
    input.contentType === "article" &&
    (input.faq ?? []).some(
      (item) => Boolean(item.question?.trim()) !== Boolean(item.answer?.trim()),
    )
  ) {
    return "أكمل السؤال والإجابة لكل عنصر FAQ أو احذف الصف الناقص.";
  }
  return null;
}

export function buildContentReviewChecks(input: ContentReviewInput): ContentReviewCheck[] {
  const image = effectiveImage(input);
  const imageAlt = effectiveImageAlt(input);
  const wordCount = countWords(input.content);
  const internalLinks = countInternalLinks(input.content);
  const checks: ContentReviewCheck[] = [
    check(input, {
      id: "title",
      label: "العنوان",
      status: input.title.trim() ? "pass" : "fail",
      hint: input.title.trim() ? "العنوان موجود." : "أضف عنوانًا واضحًا للمحتوى.",
      field: "title",
    }),
    check(input, {
      id: "slug",
      label: "Slug",
      status: input.slug.trim() && validateContentSlug(input.slug) ? "pass" : "fail",
      hint: input.slug.trim() && validateContentSlug(input.slug)
        ? "صيغة الرابط صحيحة."
        : "استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.",
      field: "slug",
    }),
    check(input, {
      id: "category",
      label: "التصنيف",
      status: input.categorySlug.trim() ? "pass" : "fail",
      hint: input.categorySlug.trim() ? "تم اختيار التصنيف." : "اختر تصنيفًا نشطًا.",
      field: "category_id",
    }),
    check(input, {
      id: "excerpt",
      label: "المقتطف",
      status: input.excerpt.trim().length >= 20 ? "pass" : "fail",
      hint: input.excerpt.trim().length >= 20
        ? "المقتطف جاهز للنشر."
        : "أضف مقتطفًا لا يقل عن 20 حرفًا.",
      field: "excerpt",
    }),
    check(input, {
      id: "image",
      label: "صورة الغلاف",
      status: image ? "pass" : "fail",
      hint: image ? "صورة الغلاف متوفرة." : "أضف صورة غلاف قبل النشر.",
      field: "image",
    }),
    check(input, {
      id: "image-alt",
      label: "Alt Text",
      status: image && imageAlt ? "pass" : "fail",
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
    checks.push(check(input, {
      id: "video-url",
      label: "رابط YouTube",
      status: videoUrl && videoPayload && !validateVideoPayload(videoPayload, { published: true }) ? "pass" : "fail",
      hint: videoUrl ? "رابط الفيديو متوفر وصالح." : "أضف رابط YouTube صالحًا.",
      field: "video_url",
    }));
  } else if (input.contentType === "gallery") {
    const images = input.mediaPayload?.kind === "gallery" ? input.mediaPayload.images : [];
    checks.push(check(input, {
      id: "gallery-images",
      label: "صور المعرض",
      status: images.length > 0 ? "pass" : "fail",
      hint: images.length > 0 ? `${images.length} صورة في المعرض.` : "أضف صورة واحدة على الأقل.",
      field: "gallery_image_url",
    }));
    checks.push(check(input, {
      id: "gallery-alt",
      label: "Alt لكل صور المعرض",
      status: images.length > 0 && images.every((item) => Boolean(item.alt?.trim())) ? "pass" : "fail",
      hint: images.length > 0 && images.every((item) => Boolean(item.alt?.trim()))
        ? "كل صور المعرض لها وصف بديل."
        : "أضف وصفًا بديلًا لكل صورة في المعرض.",
      field: "gallery_image_alt",
    }));
  } else {
    checks.push(check(input, {
      id: "content",
      label: "جاهزية المحتوى",
      status: !input.content.trim() ? "fail" : wordCount >= 300 ? "pass" : "warn",
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
      status: input.seoTitle.trim().length >= ENTITY_SEO_LIMITS.title.min && input.seoTitle.trim().length <= ENTITY_SEO_LIMITS.title.max
        ? "pass"
        : "fail",
      hint: input.seoTitle.trim()
        ? `${input.seoTitle.trim().length} حرف — النطاق المطلوب ${ENTITY_SEO_LIMITS.title.min}–${ENTITY_SEO_LIMITS.title.max}.`
        : "أضف SEO Title قبل النشر.",
      field: "seo_title",
    }),
    check(input, {
      id: "seo-description",
      label: "SEO Description",
      status: input.seoDescription.trim().length >= ENTITY_SEO_LIMITS.description.min && input.seoDescription.trim().length <= ENTITY_SEO_LIMITS.description.max
        ? "pass"
        : "fail",
      hint: input.seoDescription.trim()
        ? `${input.seoDescription.trim().length} حرف — النطاق المطلوب ${ENTITY_SEO_LIMITS.description.min}–${ENTITY_SEO_LIMITS.description.max}.`
        : "أضف SEO Description قبل النشر.",
      field: "seo_description",
    }),
    check(input, {
      id: "focus-keyword",
      label: "Focus Keyword",
      status: input.focusKeyword.trim() ? "pass" : "fail",
      hint: input.focusKeyword.trim() ? "الكلمة المفتاحية محددة." : "حدد الكلمة المفتاحية الأساسية.",
      field: "focus_keyword",
    }),
    check(input, {
      id: "canonical-url",
      label: "Canonical URL",
      status: canonicalIsValid(input.canonicalUrl) ? "pass" : "fail",
      hint: canonicalIsValid(input.canonicalUrl)
        ? "الرابط الأساسي صالح أو سيُولّد تلقائيًا."
        : "استخدم رابطًا يبدأ بـ http أو https.",
      field: "canonical_url",
    }),
    check(input, {
      id: "og-image-alt",
      label: "Alt لصورة المشاركة",
      status: input.ogImage.trim() && !input.ogImageAlt.trim() ? "fail" : "pass",
      hint: input.ogImage.trim() && !input.ogImageAlt.trim()
        ? "أضف النص البديل لصورة المشاركة."
        : "عقد صورة المشاركة مكتمل.",
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
      hint: internalLinks > 0
        ? `${internalLinks} رابط داخلي مرتبط بالمحتوى.`
        : "أضف رابطًا داخليًا ذا صلة عندما يكون ذلك مناسبًا.",
      field: "content",
    }));
  }

  return checks;
}

export function getContentReviewScore(checks: readonly ContentReviewCheck[]) {
  const scored = checks.filter((item) => item.status !== "info");
  const earned = scored.reduce(
    (total, item) => total + (item.status === "pass" ? 1 : item.status === "warn" ? 0.5 : 0),
    0,
  );
  return Math.round((earned / Math.max(1, scored.length)) * 100);
}
