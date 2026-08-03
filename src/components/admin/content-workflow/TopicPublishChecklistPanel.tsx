"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTopicPublishChecklist,
  type TopicFaqItem,
  type TopicPublishInput,
} from "../../../lib/admin/content-workflow/topic-publish-validation";
import { countChecklistStatus, type PublishChecklistItem } from "../../../lib/admin/content-workflow/publish-checklist-types";
import TopicCorrectionButton from "../content/editors/article/TopicCorrectionButton";

type SummaryState = TopicPublishInput & {
  contentType: string;
  category: string;
  series: string;
  publishedAt: string;
  published: boolean;
  featured: boolean;
  showTitle: boolean;
  showImage: boolean;
  showExcerpt: boolean;
  faqVisible: boolean;
};

type Props = {
  formId: string;
  initial: TopicPublishInput;
  status?: string;
  publishedAt?: string | null;
  dateLabel?: string | null;
  featured?: boolean;
  updatedAt?: string | null;
  contentTypeLabel?: string;
  seriesLabel?: string;
  categoryLabel?: string;
  initialDisplay?: {
    title?: boolean | null;
    image?: boolean | null;
    excerpt?: boolean | null;
    faq?: boolean | null;
  };
};

type CorrectionTarget = {
  tabId: "basic" | "faq" | "seo";
  targetId: string;
};

const CHECKLIST_CORRECTION_TARGETS: Record<string, CorrectionTarget> = {
  title: { tabId: "basic", targetId: "content-title" },
  slug: { tabId: "basic", targetId: "topic-slug" },
  category: { tabId: "basic", targetId: "content-category-listbox" },
  excerpt: { tabId: "basic", targetId: "content-excerpt" },
  image: { tabId: "basic", targetId: "content-image-field" },
  "image-alt": { tabId: "basic", targetId: "topic-image-alt" },
  content: { tabId: "basic", targetId: "topic-content-markdown" },
  "seo-title": { tabId: "seo", targetId: "topic-seo-title" },
  "seo-description": { tabId: "seo", targetId: "topic-seo-description" },
  "focus-keyword": { tabId: "seo", targetId: "topic-focus-keyword" },
  faq: { tabId: "faq", targetId: "topic-faq-editor" },
  "internal-links": { tabId: "basic", targetId: "topic-content-markdown" },
};

const GATE_IDS = new Set(["draft-gate", "publish-ready", "publish-seo"]);

function field(form: HTMLFormElement, name: string, fallback = "") {
  const item = form.elements.namedItem(name);
  return item instanceof HTMLInputElement ||
    item instanceof HTMLTextAreaElement ||
    item instanceof HTMLSelectElement
    ? item.value
    : fallback;
}

function checked(form: HTMLFormElement, name: string, fallback = true) {
  const item = form.elements.namedItem(name);
  return item instanceof HTMLInputElement ? item.checked : fallback;
}

function faq(form: HTMLFormElement): TopicFaqItem[] {
  const questions = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="faq_question"]'));
  const answers = Array.from(form.querySelectorAll<HTMLTextAreaElement>('textarea[name="faq_answer"]'));
  return questions.map((question, index) => ({
    question: question.value,
    answer: answers[index]?.value ?? "",
  }));
}

function read(form: HTMLFormElement, seed: SummaryState): SummaryState {
  const categoryControl = form.querySelector('select[name="category_id"]');
  const category =
    categoryControl instanceof HTMLSelectElement
      ? categoryControl.selectedOptions.item(0)?.textContent?.trim() || seed.category
      : seed.category;

  return {
    ...seed,
    title: field(form, "title"),
    slug: field(form, "slug"),
    excerpt: field(form, "excerpt"),
    content: field(form, "content"),
    image: field(form, "image", seed.image),
    imageAlt: field(form, "image_alt"),
    categorySlug: field(form, "category_id"),
    seoTitle: field(form, "seo_title"),
    seoDescription: field(form, "seo_description"),
    focusKeyword: field(form, "focus_keyword"),
    faq: faq(form),
    category,
    publishedAt: field(form, "published_at", seed.publishedAt),
    published:
      field(form, "status", seed.published ? "published" : "draft") ===
      "published",
    featured: checked(form, "is_featured", seed.featured),
    showTitle: checked(form, "show_title_on_page", seed.showTitle),
    showImage: checked(form, "show_image_on_page", seed.showImage),
    showExcerpt: checked(form, "show_excerpt_on_page", seed.showExcerpt),
    faqVisible: checked(form, "show_faq_on_page", seed.faqVisible),
  };
}

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function statusLabel(status?: string) {
  if (status === "published") return "منشور";
  if (status === "unpublished") return "غير منشور";
  if (status === "archived") return "مؤرشف";
  return "مسودة";
}

function formatAuditTimestamp(value?: string | null) {
  if (!value) return "لم يُحفظ بعد";
  const normalized = value.replace("T", " ").replace("Z", "");
  return normalized.length >= 16 ? `${normalized.slice(0, 10)} · ${normalized.slice(11, 16)}` : value;
}

function inferGateTarget(hint: string): CorrectionTarget | undefined {
  if (hint.includes("العنوان")) return CHECKLIST_CORRECTION_TARGETS.title;
  if (hint.includes("Slug") || hint.includes("الرابط")) return CHECKLIST_CORRECTION_TARGETS.slug;
  if (hint.includes("التصنيف")) return CHECKLIST_CORRECTION_TARGETS.category;
  if (hint.includes("الوصف المختصر")) return CHECKLIST_CORRECTION_TARGETS.excerpt;
  if (hint.includes("الصورة الرئيسية")) return CHECKLIST_CORRECTION_TARGETS.image;
  if (hint.includes("Alt Text") || hint.includes("وصف الصورة")) return CHECKLIST_CORRECTION_TARGETS["image-alt"];
  if (hint.includes("Focus Keyword")) return CHECKLIST_CORRECTION_TARGETS["focus-keyword"];
  if (hint.includes("SEO Title")) return CHECKLIST_CORRECTION_TARGETS["seo-title"];
  if (hint.includes("SEO Description")) return CHECKLIST_CORRECTION_TARGETS["seo-description"];
  return undefined;
}

function correctionTarget(item: PublishChecklistItem) {
  return CHECKLIST_CORRECTION_TARGETS[item.id] ?? (GATE_IDS.has(item.id) ? inferGateTarget(item.hint) : undefined);
}

export default function TopicPublishChecklistPanel({
  formId,
  initial,
  status,
  publishedAt,
  dateLabel,
  featured = false,
  updatedAt,
  contentTypeLabel = "مقال",
  seriesLabel = "—",
  categoryLabel = "—",
  initialDisplay,
}: Props) {
  const seed = useMemo<SummaryState>(
    () => ({
      ...initial,
      contentType: contentTypeLabel,
      category: categoryLabel,
      series: seriesLabel,
      publishedAt: publishedAt?.slice(0, 10) ?? "",
      published: status === "published",
      featured,
      showTitle: initialDisplay?.title !== false,
      showImage: initialDisplay?.image !== false,
      showExcerpt: initialDisplay?.excerpt !== false,
      faqVisible: initialDisplay?.faq !== false,
    }),
    [
      initial,
      contentTypeLabel,
      categoryLabel,
      seriesLabel,
      publishedAt,
      status,
      featured,
      initialDisplay,
    ],
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

  const items = useMemo(() => buildTopicPublishChecklist(input), [input]);
  const allBlockers = useMemo(() => items.filter((item) => item.status === "fail"), [items]);
  const blockers = useMemo(() => {
    const specific = allBlockers.filter((item) => !GATE_IDS.has(item.id));
    return specific.length ? specific : allBlockers;
  }, [allBlockers]);
  const improvements = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "warn" ||
          (item.status === "info" && ["faq", "internal-links"].includes(item.id)),
      ),
    [items],
  );
  const tasks = useMemo(
    () => items.filter((item) => !item.id.startsWith("tone-") && !["faq", "internal-links"].includes(item.id)),
    [items],
  );
  const readiness = Math.round(
    (items.filter((item) => item.status === "pass").length /
      Math.max(1, items.filter((item) => item.status !== "info").length)) *
      100,
  );
  const faqCount = (input.faq ?? []).filter(
    (item) => item.question?.trim() && item.answer?.trim(),
  ).length;
  const seoItems = items.filter((item) => ["seo-title", "seo-description", "focus-keyword"].includes(item.id));
  const seoStatus = seoItems.some((item) => item.status === "fail")
    ? "غير مكتمل"
    : seoItems.some((item) => item.status === "warn")
      ? "يحتاج تحسين"
      : "مكتمل";
  const publishDate = dateLabel || input.publishedAt || "غير محدد";
  const publishState = input.published === (status === "published")
    ? statusLabel(status)
    : input.published
      ? "سيُنشر عند الحفظ"
      : "سيُحفظ دون نشر";
  const warningSummary = blockers.length
    ? `${blockers.length} ${blockers.length === 1 ? "تنبيه مانع" : "تنبيهات مانعة"}`
    : improvements.length
      ? `${improvements.length} ${improvements.length === 1 ? "تحسين اختياري" : "تحسينات اختيارية"}`
      : "لا توجد تحذيرات";
  const cardClassName = "flex h-full min-h-0 min-w-0 flex-col rounded-2xl bg-black/20 p-4";

  return (
    <section
      className="space-y-4"
      data-topic-publish-review
      data-topic-publish-review-presentation="embedded"
    >
      <section
        className="rounded-2xl border border-white/10 bg-black/20 p-4"
        data-topic-publish-review-overview
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">ملخص المراجعة</h3>
            <p className="mt-1 text-xs leading-6 text-white/42">
              لقطة عرض فقط للحالة الحالية والقرار المتوقع بعد الحفظ.
            </p>
          </div>
          <span className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/[0.08] px-3 py-1.5 text-xs font-semibold text-[#F2D99B]">
            جاهزية {readiness}%
          </span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ReviewMetric label="حالة النشر" value={publishState} />
          <ReviewMetric label="الحالة المميزة" value={input.featured ? "مميز" : "غير مميز"} />
          <ReviewMetric label="تاريخ النشر" value={publishDate} />
          <ReviewMetric label="آخر تحديث" value={formatAuditTimestamp(updatedAt)} />
          <ReviewMetric label="نتيجة المراجعة" value={`${readiness}% جاهز`} />
          <ReviewMetric label="التحذيرات" value={warningSummary} tone={blockers.length ? "danger" : improvements.length ? "gold" : "success"} />
        </dl>
      </section>

      <div
        className="grid gap-4 lg:grid-cols-2"
        data-topic-publish-review-grid
      >
        <section className={`${cardClassName} border border-red-400/20`} data-topic-publish-blockers>
          <ReviewCardHeader
            title={blockers.length
              ? `يوجد ${blockers.length} ${blockers.length === 1 ? "تنبيه مانع" : "تنبيهات مانعة"} للنشر`
              : "لا توجد تنبيهات مانعة للنشر"}
            status={`${readiness}%`}
            tone="danger"
          />
          {blockers.length ? (
            <ReviewRows items={blockers} />
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/8 px-4 py-3 text-sm leading-7 text-emerald-100/80">
              متطلبات النشر الإلزامية الحالية مستوفاة.
            </p>
          )}
        </section>

        <section className={`${cardClassName} border border-white/10`} data-topic-publishing-tasks>
          <ReviewCardHeader
            title="Publishing Tasks"
            status={`${countChecklistStatus(tasks, "pass")}/${tasks.length}`}
          />
          <TaskRows items={tasks} />
        </section>

        <div className="contents" data-topic-publish-left-column>
          <section className={`${cardClassName} border border-[#D8B87A]/22`} data-topic-publish-improvements>
            <ReviewCardHeader
              title="تحسينات اختيارية"
              status={`${improvements.length}`}
              tone="gold"
            />
            {improvements.length ? (
              <ReviewRows items={improvements} />
            ) : (
              <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/42">
                لا توجد تحسينات اختيارية معلّقة.
              </p>
            )}
          </section>

          <section className={`${cardClassName} border border-white/10`} data-topic-publish-summary>
            <ReviewCardHeader title="ملخص الموضوع" status={statusLabel(status)} />
            <div className="mt-4 flex gap-4">
              {input.image ? (
                <div
                  className="h-20 w-24 shrink-0 rounded-xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${input.image})` }}
                  role="img"
                  aria-label={input.imageAlt || input.title}
                />
              ) : (
                <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-xs text-white/30">
                  لا صورة
                </div>
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 font-semibold leading-6 text-white">{input.title || "بدون عنوان"}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{input.excerpt || "لا يوجد ملخص."}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Summary label="نوع المحتوى" value={input.contentType} />
              <Summary label="حالة النشر" value={statusLabel(status)} />
              <Summary label="التصنيف" value={input.category} />
              <Summary label="السلسلة" value={input.series} />
              <Summary label="عدد الكلمات" value={`${words(input.content)} كلمة`} />
              <Summary label="تاريخ النشر الظاهر" value={publishDate} />
              <Summary label="حالة SEO" value={seoStatus} />
              <Summary label="الأسئلة الشائعة" value={`${faqCount} مكتمل · ${input.faqVisible ? "ظاهر" : "مخفي"}`} />
            </dl>
          </section>
        </div>
      </div>
    </section>
  );
}

function ReviewRows({ items }: { items: PublishChecklistItem[] }) {
  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => {
        const target = correctionTarget(item);
        return (
          <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <details className="min-w-0 flex-1">
                <summary className={item.status === "fail" ? "cursor-pointer text-sm text-red-100" : item.status === "pass" ? "cursor-pointer text-sm text-emerald-200" : "cursor-pointer text-sm text-[#F2D99B]"}>
                  {item.status === "pass" ? "✓" : item.status === "fail" ? "×" : "!"} {item.label}
                </summary>
                <p className="mt-2 text-xs leading-6 text-white/42">{item.hint}</p>
              </details>
              {target ? <TopicCorrectionButton tabId={target.tabId} targetId={target.targetId} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskRows({ items }: { items: PublishChecklistItem[] }) {
  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          <span className="min-w-0 text-white/68">{item.label}</span>
          <span className={item.status === "pass" ? "shrink-0 text-emerald-200" : item.status === "fail" ? "shrink-0 text-red-200" : "shrink-0 text-[#F2D99B]"}>
            {item.status === "pass" ? "✓ مكتمل" : item.status === "fail" ? "× راجع التنبيهات" : "! تحسين"}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReviewCardHeader({
  title,
  status,
  tone = "default",
}: {
  title: string;
  status: string;
  tone?: "default" | "danger" | "gold";
}) {
  const titleClassName =
    tone === "gold" ? "text-[#F2D99B]" : "text-white";
  const statusClassName =
    tone === "danger"
      ? "border-red-400/20 bg-red-400/[0.06] text-red-100/80"
      : tone === "gold"
        ? "border-[#D8B87A]/25 bg-[#D8B87A]/[0.08] text-[#F2D99B]"
        : "border-white/10 bg-white/[0.035] text-white/55";

  return (
    <div
      className="flex min-h-11 items-start justify-between gap-3"
      data-topic-publish-card-header
    >
      <h3 className={`min-w-0 text-base font-semibold leading-6 ${titleClassName}`}>
        {title}
      </h3>
      <span
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${statusClassName}`}
        data-topic-publish-card-status
      >
        {status}
      </span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
      <dt className="text-xs text-white/35">{label}</dt>
      <dd className="mt-1 break-words text-white/70">{value || "—"}</dd>
    </div>
  );
}

function ReviewMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "gold" | "success";
}) {
  const valueClassName =
    tone === "danger"
      ? "text-red-200"
      : tone === "gold"
        ? "text-[#F2D99B]"
        : tone === "success"
          ? "text-emerald-200"
          : "text-white/76";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#080B10]/72 p-3">
      <dt className="text-xs text-white/35">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold leading-6 ${valueClassName}`}>{value}</dd>
    </div>
  );
}
