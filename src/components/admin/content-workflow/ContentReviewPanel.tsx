"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildContentReviewChecks,
  getContentReviewScore,
  type ContentReviewCheck,
  type ContentReviewFaqItem,
  type ContentReviewInput,
} from "../../../lib/admin/content-workflow/content-review-capability";
import type { MediaTopicPayload } from "../../../lib/admin/media-topic-payload";
import { AdminSingleOpenAccordion } from "../ui";
import ContentCorrectionButton from "../content/editors/ContentCorrectionButton";

type ReviewState = ContentReviewInput & {
  category: string;
  series: string;
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
  const categoryControl = form.querySelector('select[name="category_id"]');
  const category = categoryControl instanceof HTMLSelectElement
    ? categoryControl.selectedOptions.item(0)?.textContent?.trim() || seed.category
    : seed.category;
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
    category,
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
  status = "draft",
  publishedAt,
  dateLabel,
  featured = false,
  popular = false,
  updatedAt,
  contentTypeLabel,
  seriesLabel = "—",
  categoryLabel = "—",
  initialDisplay,
}: ContentReviewPanelProps) {
  const seed = useMemo<ReviewState>(
    () => ({
      ...initial,
      category: categoryLabel,
      series: seriesLabel,
      status: status ?? "draft",
      publishedAt: publishedAt?.slice(0, 10) ?? "",
      featured,
      popular,
      showTitle: initialDisplay?.title !== false,
      showImage: initialDisplay?.image !== false,
      showExcerpt: initialDisplay?.excerpt !== false,
    }),
    [initial, categoryLabel, seriesLabel, status, publishedAt, featured, popular, initialDisplay],
  );
  const [input, setInput] = useState(seed);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
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
  const score = useMemo(() => getContentReviewScore(checks), [checks]);
  const blockers = checks.filter((item) => item.status === "fail");
  const improvements = checks.filter((item) => item.status === "warn" || item.status === "info");
  const passed = checks.filter((item) => item.status === "pass");
  const visibleDate = dateLabel || input.publishedAt || "سيُحدد عند أول نشر";

  return (
    <section className="space-y-4" data-content-review-capability>
      <div className="rounded-2xl border border-[#D8B87A]/22 bg-[#D8B87A]/[0.06] p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/75">درجة جاهزية المحتوى</p>
            <p className="mt-1 text-xs leading-6 text-white/45">
              الدرجة إرشادية ولا تمنع النشر وحدها. قواعد Validation المبيّنة كأخطاء هي التي تحكم الحفظ والنشر.
            </p>
          </div>
          <div className="flex size-20 items-center justify-center rounded-full border-[7px] border-[#D8B87A]/60 bg-black/25 font-en text-xl font-semibold text-white">
            {score}
          </div>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ReviewMetric label="الحالة" value={statusLabel(input.status)} />
          <ReviewMetric label="النوع" value={contentTypeLabel} />
          <ReviewMetric label="المميز / الشائع" value={`${input.featured ? "مميز" : "عادي"} · ${input.popular ? "شائع" : "غير شائع"}`} />
          <ReviewMetric label="تاريخ النشر" value={visibleDate} />
          <ReviewMetric label="التصنيف" value={input.category} />
          <ReviewMetric label="السلسلة" value={input.series} />
          <ReviewMetric label="إعدادات العرض" value={`${input.showTitle ? "عنوان" : "—"} · ${input.showImage ? "صورة" : "—"} · ${input.showExcerpt ? "مقتطف" : "—"}`} />
          <ReviewMetric label="آخر تحديث" value={formatAuditTimestamp(updatedAt)} />
        </dl>
      </div>

      <AdminSingleOpenAccordion
        ariaLabel="تفاصيل مراجعة المحتوى والنشر"
        defaultOpenId={blockers.length ? "review-errors" : improvements.length ? "review-improvements" : "review-passed"}
        items={[
          {
            id: "review-errors",
            label: `مشاكل Validation (${blockers.length})`,
            description: "المشاكل التي يجب إصلاحها قبل قبول النشر.",
            content: <ReviewIssueList items={blockers} empty="لا توجد مشاكل مانعة." />,
          },
          {
            id: "review-improvements",
            label: `تحسينات إرشادية (${improvements.length})`,
            description: "تحسينات جودة لا تمنع النشر وحدها.",
            content: <ReviewIssueList items={improvements} empty="لا توجد تحسينات معلّقة." />,
          },
          {
            id: "review-passed",
            label: `فحوص مكتملة (${passed.length})`,
            description: "العقود التي تحققت في الحالة الحالية.",
            content: <ReviewIssueList items={passed} empty="لا توجد فحوص مكتملة بعد." />,
          },
        ]}
      />
    </section>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <dt className="text-[11px] text-white/35">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-white/72">{value}</dd>
    </div>
  );
}

function ReviewIssueList({ items, empty }: { items: ContentReviewCheck[]; empty: string }) {
  if (!items.length) {
    return <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/8 p-4 text-sm text-emerald-100/75">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => <ReviewIssueCard key={item.id} item={item} />)}
    </div>
  );
}

function ReviewIssueCard({ item }: { item: ContentReviewCheck }) {
  const tone = item.severity === "error"
    ? "border-red-400/20 bg-red-400/8"
    : item.severity === "warning"
      ? "border-[#D8B87A]/18 bg-[#D8B87A]/8"
      : item.severity === "success"
        ? "border-emerald-400/15 bg-emerald-400/8"
        : "border-white/10 bg-white/[0.025]";
  const severityLabel = item.severity === "error"
    ? "خطأ"
    : item.severity === "warning"
      ? "تحسين"
      : item.severity === "success"
        ? "مكتمل"
        : "إرشاد";
  return (
    <article
      className={`rounded-xl border px-4 py-3 ${tone}`}
      data-content-review-issue={item.id}
      data-content-review-severity={item.severity}
    >
      <div className="flex items-start justify-between gap-3">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-sm font-medium text-white/78">
            {item.label}
            <span className="ms-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-normal text-white/42">
              {severityLabel}
            </span>
          </summary>
          <p className="mt-2 text-xs leading-6 text-white/48">{item.hint}</p>
        </details>
        {item.status !== "pass" && item.correctionTarget ? (
          <ContentCorrectionButton
            tabId={item.correctionTarget.tabId}
            targetId={item.correctionTarget.targetId}
          />
        ) : null}
      </div>
    </article>
  );
}
