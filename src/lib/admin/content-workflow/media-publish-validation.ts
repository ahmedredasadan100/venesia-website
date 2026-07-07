import {
  assertPayloadMatchesContentType,
  validateGalleryPayload,
  validateVideoPayload,
  type GalleryMediaPayload,
  type MediaTopicPayload,
  type VideoMediaPayload,
} from "../media-topic-payload";
import type { PublishChecklistItem } from "./publish-checklist-types";
import { VENESIA_BRAND_TONE_RULES } from "./brand-tone-guardrails";
import { validateSlugFormat } from "./topic-publish-validation";

export type MediaEditableContentType = "news" | "video" | "gallery" | "press" | "site_update";

export type MediaPublishInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  imageAlt: string;
  categorySlug: string;
  contentType: MediaEditableContentType;
  mediaPayload: MediaTopicPayload | null;
};

export function getMediaBaseValidationError(input: MediaPublishInput): string | null {
  if (!input.title.trim()) return "العنوان مطلوب.";
  if (!input.slug.trim()) return "الرابط مطلوب.";
  if (!validateSlugFormat(input.slug)) {
    return "الـ Slug لازم يكون إنجليزي صغير، أرقام، وشرطة بين الكلمات فقط.";
  }
  if (!input.categorySlug.trim()) return "قسم المركز الإعلامي مطلوب.";
  return null;
}

export function getMediaPublishValidationError(input: MediaPublishInput): string | null {
  const baseError = getMediaBaseValidationError(input);
  if (baseError) return baseError;

  const matchError = assertPayloadMatchesContentType(input.contentType, input.mediaPayload);
  if (matchError) return matchError;

  if (input.contentType === "video" && input.mediaPayload?.kind === "video") {
    return validateVideoPayload(input.mediaPayload as VideoMediaPayload, { published: true });
  }

  if (input.contentType === "gallery" && input.mediaPayload?.kind === "gallery") {
    return validateGalleryPayload(input.mediaPayload as GalleryMediaPayload, { published: true });
  }

  if (["news", "press", "site_update"].includes(input.contentType)) {
    if (!input.content.trim()) return "نص المحتوى مطلوب قبل النشر.";
    if (!input.image.trim()) return "صورة الغلاف مطلوبة قبل النشر.";
    if (!input.imageAlt.trim()) return "وصف الصورة Alt Text مطلوب قبل النشر.";
  }

  return null;
}

export function buildMediaPublishChecklist(input: MediaPublishInput): PublishChecklistItem[] {
  const baseError = getMediaBaseValidationError(input);
  const publishError = getMediaPublishValidationError(input);

  const items: PublishChecklistItem[] = [
    {
      id: "title",
      label: "العنوان",
      status: input.title.trim() ? "pass" : "fail",
      hint: input.title.trim() ? "العنوان موجود." : "أضف عنوانًا للمحتوى.",
    },
    {
      id: "slug",
      label: "Slug",
      status: !input.slug.trim() ? "fail" : validateSlugFormat(input.slug) ? "pass" : "fail",
      hint: !input.slug.trim()
        ? "Slug مطلوب."
        : validateSlugFormat(input.slug)
          ? "صيغة Slug صحيحة."
          : "استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.",
    },
    {
      id: "category",
      label: "قسم المركز الإعلامي",
      status: input.categorySlug.trim() ? "pass" : "fail",
      hint: input.categorySlug.trim() ? "تم اختيار القسم." : "اختر قسمًا فرعيًا تحت المركز الإعلامي.",
    },
  ];

  if (input.contentType === "video") {
    const url = input.mediaPayload?.kind === "video" ? input.mediaPayload.video_url : "";
    items.push({
      id: "video-url",
      label: "رابط YouTube",
      status: url.trim() ? "pass" : "fail",
      hint: url.trim() ? "رابط الفيديو موجود." : "رابط YouTube صالح مطلوب للنشر.",
    });
    items.push({
      id: "cover",
      label: "صورة الغلاف",
      status: input.image.trim() ? "pass" : "warn",
      hint: input.image.trim() ? "صورة الغلاف متوفرة." : "يُفضّل إضافة صورة غلاف للفيديو.",
    });
  } else if (input.contentType === "gallery") {
    const count =
      input.mediaPayload?.kind === "gallery" ? input.mediaPayload.images.length : 0;
    items.push({
      id: "gallery-images",
      label: "صور المعرض",
      status: count > 0 ? "pass" : "fail",
      hint: count > 0 ? `${count} صورة في المعرض.` : "أضف صورة واحدة على الأقل للنشر.",
    });
  } else {
    items.push({
      id: "content",
      label: "نص المحتوى",
      status: input.content.trim() ? "pass" : "fail",
      hint: input.content.trim() ? "نص المحتوى موجود." : "نص المحتوى مطلوب قبل النشر.",
    });
    items.push({
      id: "cover",
      label: "صورة الغلاف",
      status: input.image.trim() ? "pass" : "fail",
      hint: input.image.trim() ? "صورة الغلاف متوفرة." : "صورة الغلاف مطلوبة قبل النشر.",
    });
    items.push({
      id: "image-alt",
      label: "Alt Text",
      status: !input.image.trim() ? "info" : input.imageAlt.trim() ? "pass" : "fail",
      hint: !input.image.trim()
        ? "يُفعّل بعد اختيار صورة الغلاف."
        : input.imageAlt.trim()
          ? "وصف الصورة متوفر."
          : "Alt Text مطلوب قبل النشر للمحتوى النصي.",
    });
  }

  if (baseError) {
    items.unshift({ id: "base", label: "البيانات الأساسية", status: "fail", hint: baseError });
  } else if (publishError) {
    items.unshift({ id: "publish", label: "جاهزية النشر", status: "fail", hint: publishError });
  } else {
    items.unshift({
      id: "publish",
      label: "جاهزية النشر",
      status: "pass",
      hint: "المحتوى جاهز للنشر وفق قواعد هذا النوع.",
    });
  }

  items.push({
    id: "internal-preview",
    label: "المعاينة الداخلية",
    status: "info",
    hint: "استخدم المعاينة الداخلية — المحتوى الموحد لا يظهر على الموقع العام بعد.",
  });

  for (const rule of VENESIA_BRAND_TONE_RULES) {
    items.push({
      id: `tone-${rule.id}`,
      label: rule.label,
      status: "info",
      hint: rule.hint,
    });
  }

  return items;
}

export function mediaRowToPublishInput(row: {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_slug?: string | null;
  content_type?: string | null;
  media_payload?: MediaTopicPayload | null;
}): MediaPublishInput | null {
  const contentType = row.content_type;
  if (
    contentType !== "news" &&
    contentType !== "press" &&
    contentType !== "site_update" &&
    contentType !== "video" &&
    contentType !== "gallery"
  ) {
    return null;
  }

  return {
    title: row.title ?? "",
    slug: row.slug ?? "",
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    image: row.image ?? "",
    imageAlt: row.image_alt ?? "",
    categorySlug: row.category_slug ?? "",
    contentType,
    mediaPayload: row.media_payload ?? null,
  };
}
