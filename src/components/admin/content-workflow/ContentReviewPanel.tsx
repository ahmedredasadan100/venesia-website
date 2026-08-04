"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  buildContentReviewChecks,
  type ContentReviewFaqItem,
  type ContentReviewInput,
} from "../../../lib/admin/content-workflow/content-review-capability";
import type { MediaTopicPayload } from "../../../lib/admin/media-topic-payload";
import type { EntityReviewAnalysisCardDefinition } from "../../../lib/admin/review/entity-review-presentation";
import AdminEntityReviewPanel, {
  AdminEntityReviewCorrectionButton,
  AdminEntityReviewDecisionCard,
} from "../review/AdminEntityReviewPanel";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "../content/editors/content-editor-navigation";

type ReviewState = ContentReviewInput & {
  status: string;
  publishedAt: string;
  featured: boolean;
  popular: boolean;
  showTitle: boolean;
  showImage: boolean;
  showExcerpt: boolean;
};

type ContentReviewPanelProps = {
  formId: string;
  initial: ContentReviewInput;
  publishingOptions: ReactNode;
  status?: string | null;
  publishedAt?: string | null;
  dateLabel?: string | null;
  featured?: boolean;
  popular?: boolean;
  updatedAt?: string | null;
  contentTypeLabel: string;
  seriesLabel?: string;
  categoryLabel?: string;
  initialDisplay?: {
    title?: boolean | null;
    image?: boolean | null;
    excerpt?: boolean | null;
  };
};

const CONTENT_REVIEW_GUIDANCE_CARDS: readonly EntityReviewAnalysisCardDefinition[] = [
  {
    id: "content",
    title: "جاهزية المحتوى",
    description: "اكتمال مادة المحتوى والمتطلبات الخاصة بنوعها.",
    group: "content",
  },
  {
    id: "image",
    title: "جاهزية الصور وAlt",
    description: "توفر الصورة ووصفها البديل للعرض وإتاحة الوصول.",
    group: "image",
  },
  {
    id: "seo",
    title: "تحليل SEO",
    description: "سلامة بيانات البحث والمشاركة والربط الداخلي.",
    group: "seo",
  },
] as const;

function field(form: HTMLFormElement, name: string, fallback = "") {
  const item = form.elements.namedItem(name);
  return item instanceof HTMLInputElement ||
    item instanceof HTMLTextAreaElement ||
    item instanceof HTMLSelectElement
    ? item.value
    : fallback;
}

function checked(form: HTMLFormElement, name: string, fallback = false) {
  const item = form.elements.namedItem(name);
  return item instanceof HTMLInputElement ? item.checked : fallback;
}

function readFaq(form: HTMLFormElement): ContentReviewFaqItem[] {
  const questions = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="faq_question"]'),
  );
  const answers = Array.from(
    form.querySelectorAll<HTMLTextAreaElement>('textarea[name="faq_answer"]'),
  );
  return questions.map((question, index) => ({
    question: question.value,
    answer: answers[index]?.value ?? "",
  }));
}

function readMediaPayload(
  form: HTMLFormElement,
  contentType: ContentReviewInput["contentType"],
): MediaTopicPayload | null {
  if (contentType === "video") {
    return {
      kind: "video",
      provider: "youtube",
      video_url: field(form, "video_url"),
      duration: field(form, "video_duration") || null,
      thumbnail: field(form, "video_thumbnail") || null,
    };
  }
  if (contentType === "gallery") {
    const urls = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="gallery_image_url"]'),
    );
    const alts = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="gallery_image_alt"]'),
    );
    const captions = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="gallery_image_caption"]'),
    );
    return {
      kind: "gallery",
      images: urls
        .map((item, index) => ({
          url: item.value.trim(),
          alt: alts[index]?.value.trim() || null,
          caption: captions[index]?.value.trim() || null,
        }))
        .filter((item) => item.url),
    };
  }
  return null;
}

function read(form: HTMLFormElement, seed: ReviewState): ReviewState {
  return {
    ...seed,
    title: field(form, "title", seed.title),
    slug: field(form, "slug", seed.slug),
    excerpt: field(form, "excerpt", seed.excerpt),
    content: field(form, "content", seed.content),
    image: field(form, "image", seed.image),
    imageAlt: field(form, "image_alt", seed.imageAlt),
    categorySlug: field(form, "category_id", seed.categorySlug),
    seoTitle: field(form, "seo_title", seed.seoTitle),
    seoDescription: field(form, "seo_description", seed.seoDescription),
    focusKeyword: field(form, "focus_keyword", seed.focusKeyword),
    canonicalUrl: field(form, "canonical_url", seed.canonicalUrl),
    ogImage: field(form, "og_image", seed.ogImage),
    ogImageAlt: field(form, "og_image_alt", seed.ogImageAlt),
    faq: seed.contentType === "article" ? readFaq(form) : [],
    mediaPayload: readMediaPayload(form, seed.contentType),
    status: checked(form, "content_publication_toggle", seed.status === "published")
      ? "published"
      : field(form, "status", seed.status),
    publishedAt: field(form, "published_at", seed.publishedAt),
    featured: checked(form, "is_featured", seed.featured),
    popular: checked(form, "is_popular", seed.popular),
    showTitle: checked(form, "show_title_on_page", seed.showTitle),
    showImage: checked(form, "show_image_on_page", seed.showImage),
    showExcerpt: checked(form, "show_excerpt_on_page", seed.showExcerpt),
  };
}

function statusLabel(status: string) {
  if (status === "published") return "منشور";
  if (status === "archived") return "مؤرشف";
  return "غير منشور";
}

function formatAuditTimestamp(value?: string | null) {
  if (!value) return "لم يُحفظ بعد";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Cairo",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ContentReviewPanel({
  formId,
  initial,
  publishingOptions,
  status = "draft",
  publishedAt,
  dateLabel,
  featured = false,
  popular = false,
  updatedAt,
  initialDisplay,
}: ContentReviewPanelProps) {
  const seed = useMemo<ReviewState>(
    () => ({
      ...initial,
      status: status ?? "draft",
      publishedAt: publishedAt?.slice(0, 10) ?? "",
      featured,
      popular,
      showTitle: initialDisplay?.title !== false,
      showImage: initialDisplay?.image !== false,
      showExcerpt: initialDisplay?.excerpt !== false,
    }),
    [initial, status, publishedAt, featured, popular, initialDisplay],
  );
  const [input, setInput] = useState(seed);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const sync = () => setInput(read(form, seed));
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId, seed]);

  const checks = useMemo(() => buildContentReviewChecks(input), [input]);
  const visibleDate = dateLabel || input.publishedAt || "سيُحدد عند أول نشر";

  return (
    <div
      data-content-review-capability
      data-content-review-presentation="dashboard"
    >
      <AdminEntityReviewPanel
        entityKey="content"
        navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
        checks={checks}
        guidanceCards={CONTENT_REVIEW_GUIDANCE_CARDS}
        decisionCards={
          <>
            {publishingOptions}
            <AdminEntityReviewDecisionCard
              id="display-settings"
              title="إعدادات العرض"
              description="ما سيظهر داخل صفحة المحتوى."
              badge={
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] text-white/45">
                  3 خيارات
                </span>
              }
            >
              <dl className="mt-3 space-y-2">
                <DisplayDecision label="إظهار العنوان" enabled={input.showTitle} />
                <DisplayDecision label="إظهار الصورة" enabled={input.showImage} />
                <DisplayDecision label="إظهار المقتطف" enabled={input.showExcerpt} />
              </dl>
              <AdminEntityReviewCorrectionButton
                navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
                tabId="basic"
                targetId="content-display-settings"
                label="تعديل الإعدادات"
                className="mt-3 self-start rounded-full px-4 py-2"
              />
            </AdminEntityReviewDecisionCard>
          </>
        }
        summaryEntries={[
          { id: "last-save", title: "آخر حفظ", value: formatAuditTimestamp(updatedAt) },
          { id: "status", title: "حالة النشر الحالية", value: statusLabel(input.status) },
          { id: "publish-date", title: "تاريخ النشر", value: visibleDate },
        ]}
      />
    </div>
  );
}

function DisplayDecision({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
      <dt className="text-[10px] leading-4 text-white/42">{label}</dt>
      <dd
        className={`shrink-0 text-[11px] font-semibold ${
          enabled ? "text-emerald-200/80" : "text-white/32"
        }`}
      >
        {enabled ? "ظاهر" : "مخفي"}
      </dd>
    </div>
  );
}
