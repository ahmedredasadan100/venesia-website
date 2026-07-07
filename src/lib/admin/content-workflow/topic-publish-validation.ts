import type { PublishChecklistItem } from "./publish-checklist-types";
import { VENESIA_BRAND_TONE_RULES } from "./brand-tone-guardrails";

export type TopicFaqItem = {
  question?: string;
  answer?: string;
};

export type TopicPublishInput = {
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
  faq?: TopicFaqItem[];
};

export function validateSlugFormat(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function getTopicDraftValidationError(input: TopicPublishInput): string | null {
  if (!input.title.trim()) return "العنوان مطلوب.";
  if (!input.slug.trim()) return "الرابط مطلوب.";
  if (!validateSlugFormat(input.slug)) {
    return "الـ Slug لازم يكون إنجليزي صغير، أرقام، وشرطة بين الكلمات فقط.";
  }
  if (!input.categorySlug.trim()) return "التصنيف مطلوب.";
  return null;
}

export function getTopicPublishReadyError(input: TopicPublishInput): string | null {
  const draftError = getTopicDraftValidationError(input);
  if (draftError) return draftError;
  if (!input.excerpt.trim() || input.excerpt.trim().length < 20) {
    return "الوصف المختصر مطلوب ولا يقل عن 20 حرف.";
  }
  if (!input.image.trim()) return "الصورة الرئيسية مطلوبة.";
  return null;
}

export function getTopicPublishOnlyValidationError(input: TopicPublishInput): string | null {
  if (input.image.trim() && !input.imageAlt.trim()) {
    return "وصف الصورة Alt Text مطلوب قبل النشر.";
  }
  if (!input.focusKeyword.trim()) return "Focus Keyword مطلوب قبل النشر.";
  if (!input.seoTitle.trim()) return "SEO Title مطلوب قبل النشر.";
  if (input.seoTitle.length < 45) return "SEO Title قصير. النطاق المقترح من 45 إلى 60 حرف.";
  if (input.seoTitle.length > 70) return "SEO Title طويل جدًا. الأفضل ألا يزيد عن 70 حرف.";
  if (!input.seoDescription.trim()) return "SEO Description مطلوب قبل النشر.";
  if (input.seoDescription.length < 120) {
    return "SEO Description قصير. النطاق المقترح من 120 إلى 160 حرف.";
  }
  if (input.seoDescription.length > 170) {
    return "SEO Description طويل جدًا. الأفضل ألا يزيد عن 170 حرف.";
  }
  return null;
}

export function getTopicPublishValidationError(input: TopicPublishInput): string | null {
  const readyError = getTopicPublishReadyError(input);
  if (readyError) return readyError;
  return getTopicPublishOnlyValidationError(input);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countInternalLinks(content: string) {
  return content.match(/\[[^\]]+\]\((\/topics\/|\/projects\/)[^)]+\)/g)?.length ?? 0;
}

function getFaqValidationHint(faq: TopicFaqItem[] = []) {
  const partial = faq.filter(
    (item) => Boolean(item.question?.trim()) !== Boolean(item.answer?.trim()),
  );
  if (partial.length > 0) {
    return "أكمل السؤال والإجابة لكل عنصر FAQ أو احذف الصفوف الناقصة.";
  }
  const complete = faq.filter((item) => item.question?.trim() && item.answer?.trim());
  if (complete.length === 0) return "FAQ اختياري — أضف أسئلة مكتملة إن وُجدت.";
  return `${complete.length} سؤالًا مكتملًا في FAQ.`;
}

export function buildTopicPublishChecklist(input: TopicPublishInput): PublishChecklistItem[] {
  const draftError = getTopicDraftValidationError(input);
  const readyError = getTopicPublishReadyError(input);
  const publishOnlyError = getTopicPublishOnlyValidationError(input);
  const wordCount = countWords(input.content);
  const internalLinks = countInternalLinks(input.content);
  const faqHint = getFaqValidationHint(input.faq);
  const faqPartial = (input.faq ?? []).some(
    (item) => Boolean(item.question?.trim()) !== Boolean(item.answer?.trim()),
  );

  const items: PublishChecklistItem[] = [
    {
      id: "title",
      label: "العنوان",
      status: input.title.trim() ? "pass" : "fail",
      hint: input.title.trim() ? "العنوان موجود." : "أضف عنوانًا واضحًا للموضوع.",
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
      label: "التصنيف",
      status: input.categorySlug.trim() ? "pass" : "fail",
      hint: input.categorySlug.trim() ? "تم اختيار التصنيف." : "اختر تصنيفًا نشطًا.",
    },
    {
      id: "excerpt",
      label: "الوصف المختصر",
      status: input.excerpt.trim().length >= 20 ? "pass" : input.excerpt.trim() ? "warn" : "fail",
      hint:
        input.excerpt.trim().length >= 20
          ? "الوصف المختصر جاهز للنشر."
          : "لا يقل عن 20 حرفًا قبل النشر.",
    },
    {
      id: "image",
      label: "الصورة الرئيسية",
      status: input.image.trim() ? "pass" : "fail",
      hint: input.image.trim() ? "تم اختيار صورة الغلاف." : "الصورة مطلوبة قبل النشر.",
    },
    {
      id: "image-alt",
      label: "Alt Text",
      status: !input.image.trim()
        ? "info"
        : input.imageAlt.trim()
          ? "pass"
          : "fail",
      hint: !input.image.trim()
        ? "يُفعّل بعد اختيار الصورة."
        : input.imageAlt.trim()
          ? "وصف الصورة متوفر."
          : "Alt Text إلزامي قبل النشر.",
    },
    {
      id: "content",
      label: "المحتوى",
      status: wordCount >= 300 ? "pass" : wordCount >= 120 ? "warn" : wordCount > 0 ? "warn" : "fail",
      hint:
        wordCount >= 300
          ? `${wordCount} كلمة — عمق جيد للمقال.`
          : wordCount > 0
            ? `${wordCount} كلمة — يُفضّل توسيع المحتوى قبل النشر.`
            : "أضف نص المقال.",
    },
    {
      id: "seo-title",
      label: "SEO Title",
      status: !input.seoTitle.trim()
        ? "fail"
        : input.seoTitle.length >= 45 && input.seoTitle.length <= 70
          ? "pass"
          : "warn",
      hint: input.seoTitle.trim()
        ? `${input.seoTitle.length} حرف — المستهدف 45–60.`
        : "SEO Title مطلوب قبل النشر.",
    },
    {
      id: "seo-description",
      label: "SEO Description",
      status: !input.seoDescription.trim()
        ? "fail"
        : input.seoDescription.length >= 120 && input.seoDescription.length <= 170
          ? "pass"
          : "warn",
      hint: input.seoDescription.trim()
        ? `${input.seoDescription.length} حرف — المستهدف 120–160.`
        : "SEO Description مطلوب قبل النشر.",
    },
    {
      id: "focus-keyword",
      label: "Focus Keyword",
      status: input.focusKeyword.trim() ? "pass" : "fail",
      hint: input.focusKeyword.trim() ? "الكلمة المفتاحية محددة." : "Focus Keyword مطلوب قبل النشر.",
    },
    {
      id: "faq",
      label: "الأسئلة الشائعة",
      status: faqPartial ? "fail" : "info",
      hint: faqHint,
    },
    {
      id: "internal-links",
      label: "روابط داخلية",
      status: internalLinks > 0 ? "pass" : "info",
      hint:
        internalLinks > 0
          ? `${internalLinks} رابطًا داخليًا (/topics/ أو /projects/).`
          : "يُفضّل ربط المقال بموضوعات أو مشاريع ذات صلة.",
    },
  ];

  if (draftError) {
    items.unshift({
      id: "draft-gate",
      label: "جاهزية المسودة",
      status: "fail",
      hint: draftError,
    });
  } else if (readyError) {
    items.unshift({
      id: "publish-ready",
      label: "جاهزية النشر",
      status: "fail",
      hint: readyError,
    });
  } else if (publishOnlyError) {
    items.unshift({
      id: "publish-seo",
      label: "جاهزية SEO للنشر",
      status: "fail",
      hint: publishOnlyError,
    });
  } else {
    items.unshift({
      id: "publish-ready",
      label: "جاهزية النشر",
      status: "pass",
      hint: "جميع متطلبات النشر الأساسية مستوفاة.",
    });
  }

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

export function topicRowToPublishInput(row: {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_slug?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  faq?: TopicFaqItem[] | null;
}): TopicPublishInput {
  return {
    title: row.title ?? "",
    slug: row.slug ?? "",
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    image: row.image ?? "",
    imageAlt: row.image_alt ?? "",
    categorySlug: row.category_slug ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    focusKeyword: row.focus_keyword ?? "",
    faq: Array.isArray(row.faq) ? row.faq : [],
  };
}
