"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  buildContentReviewChecks,
  getContentReviewScore,
  type ContentReviewCheck,
  type ContentReviewFaqItem,
  type ContentReviewInput,
} from "../../../lib/admin/content-workflow/content-review-capability";
import type { MediaTopicPayload } from "../../../lib/admin/media-topic-payload";
import ContentCorrectionButton from "../content/editors/ContentCorrectionButton";

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

type AnalysisCardDefinition = {
  id: "content" | "image" | "seo" | "validation";
  title: string;
  description: string;
  checkIds: readonly string[];
};

const ANALYSIS_CARDS: readonly AnalysisCardDefinition[] = [
  {
    id: "content",
    title: "جاهزية المحتوى",
    description: "اكتمال مادة المحتوى والمتطلبات الخاصة بنوعها.",
    checkIds: ["content", "video-url", "gallery-images", "faq"],
  },
  {
    id: "image",
    title: "جاهزية الصورة وAlt",
    description: "توفر الصورة ووصفها البديل للعرض وإتاحة الوصول.",
    checkIds: ["image", "image-alt", "gallery-alt"],
  },
  {
    id: "seo",
    title: "تحليل SEO",
    description: "سلامة بيانات البحث والمشاركة والربط الداخلي.",
    checkIds: [
      "seo-title",
      "seo-description",
      "focus-keyword",
      "canonical-url",
      "og-image-alt",
      "internal-links",
    ],
  },
  {
    id: "validation",
    title: "التحقق العام (Validation)",
    description: "الحقول الأساسية التي تحكم قبول الحفظ والنشر.",
    checkIds: ["title", "slug", "category", "excerpt"],
  },
] as const;

const GUIDANCE_ANALYSIS_CARDS = ANALYSIS_CARDS.slice(0, 3);
const VALIDATION_ANALYSIS_CARD = ANALYSIS_CARDS[3];

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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set());

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
  const blockingIssues = checks.filter((item) => item.status === "fail");
  const suggestions = checks.filter(
    (item) => item.status === "warn" || item.status === "info",
  );
  const visibleDate = dateLabel || input.publishedAt || "سيُحدد عند أول نشر";

  function toggleCard(cardId: string) {
    setExpandedCards((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  return (
    <section className="space-y-5" data-content-review-capability data-content-review-presentation="dashboard">
      <section aria-labelledby="content-review-decisions-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
              قرارات سريعة
            </p>
            <h2 id="content-review-decisions-title" className="mt-1 text-lg font-semibold text-white/88">
              حالة المحتوى والعرض
            </h2>
          </div>
          <p className="hidden text-xs text-white/35 sm:block">تبقى هذه القرارات مكشوفة دائمًا.</p>
        </div>

        <div
          className="grid items-stretch gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)]"
          data-content-review-decisions
        >
          <article className="flex min-w-0 flex-col rounded-[22px] border border-[#D8B87A]/24 bg-[#D8B87A]/[0.065] p-4 md:p-5" data-content-review-decision="score">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/82">درجة جاهزية النشر</p>
                <p className="mt-1.5 text-xs leading-5 text-white/42">
                  الدرجة إرشادية ولا تمنع النشر وحدها.
                </p>
                <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${blockingIssues.length ? "border-red-300/20 bg-red-300/[0.07] text-red-100/75" : "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100/75"}`}>
                  {blockingIssues.length ? "النشر يتطلب إصلاحًا" : "النشر متاح"}
                </span>
              </div>
              <div
                className="grid size-20 shrink-0 place-items-center rounded-full p-1.5"
                style={{ background: `conic-gradient(#D8B87A ${score}%, rgba(255,255,255,.08) ${score}% 100%)` }}
                aria-label={`درجة جاهزية النشر ${score} من 100`}
              >
                <span className="grid size-full place-items-center rounded-full bg-[#0A0E14] font-en text-xl font-semibold text-white">
                  {score}
                </span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <ScoreDecision label="المشكلات" value={blockingIssues.length} />
              <ScoreDecision label="التحسينات" value={suggestions.length} />
            </dl>
            <button
              type="button"
              onClick={() => document.getElementById("content-review-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              aria-controls="content-review-analysis"
              className="mt-4 inline-flex min-h-9 self-start items-center justify-center rounded-full border border-[#D8B87A]/25 px-4 py-2 text-xs font-semibold text-[#EED49B] transition hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55"
              data-content-review-score-details
            >
              عرض التفاصيل
            </button>
          </article>

          {publishingOptions}

          <article className="flex min-w-0 flex-col rounded-[22px] border border-white/10 bg-[#090D13]/88 p-4" data-content-review-decision="display-settings">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/82">إعدادات العرض</p>
                <p className="mt-1 text-xs leading-5 text-white/38">ما سيظهر داخل صفحة المحتوى.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] text-white/45">
                3 خيارات
              </span>
            </div>
            <dl className="mt-3 space-y-2">
              <DisplayDecision label="إظهار العنوان" enabled={input.showTitle} />
              <DisplayDecision label="إظهار الصورة" enabled={input.showImage} />
              <DisplayDecision label="إظهار المقتطف" enabled={input.showExcerpt} />
            </dl>
            <ContentCorrectionButton
              tabId="basic"
              targetId="content-display-settings"
              label="تعديل الإعدادات"
              className="mt-3 self-start rounded-full px-4 py-2"
            />
          </article>
        </div>
      </section>

      <section id="content-review-analysis" aria-labelledby="content-review-analysis-title">
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
            التحليلات
          </p>
          <h2 id="content-review-analysis-title" className="mt-1 text-lg font-semibold text-white/88">
            مؤشرات الجاهزية
          </h2>
        </div>
        <div
          className="grid items-start gap-4 lg:grid-cols-3"
          data-content-review-analysis-grid
          data-content-review-guidance-grid
        >
          {GUIDANCE_ANALYSIS_CARDS.map((definition) => {
            const items = checks.filter((item) => definition.checkIds.includes(item.id));
            return (
              <ReviewAnalysisCard
                key={definition.id}
                definition={definition}
                items={items}
                expanded={expandedCards.has(definition.id)}
                onToggle={() => toggleCard(definition.id)}
                variant="guidance"
              />
            );
          })}
        </div>
        <div className="mt-4" data-content-review-validation-row>
          <ReviewAnalysisCard
            definition={VALIDATION_ANALYSIS_CARD}
            items={checks.filter((item) => VALIDATION_ANALYSIS_CARD.checkIds.includes(item.id))}
            expanded={expandedCards.has(VALIDATION_ANALYSIS_CARD.id)}
            onToggle={() => toggleCard(VALIDATION_ANALYSIS_CARD.id)}
            variant="validation"
          />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-[22px] border border-white/10 bg-[#090D13]/82 p-5" aria-labelledby="content-review-notes-title" data-content-review-notes>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">إرشادات</p>
              <h2 id="content-review-notes-title" className="mt-1 text-base font-semibold text-white/85">ملاحظات عامة</h2>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 font-en text-[11px] text-white/45">
              {suggestions.length}
            </span>
          </div>
          {suggestions.length ? (
            <ul className="mt-4 space-y-3">
              {suggestions.map((item) => (
                <li key={item.id} className="flex gap-3 text-sm leading-6 text-white/55">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#D8B87A]/75" />
                  <span><strong className="font-semibold text-white/72">{item.label}:</strong> {item.hint}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100/70">
              لا توجد اقتراحات غير مانعة في الحالة الحالية.
            </p>
          )}
        </section>

        <section className="rounded-[22px] border border-white/10 bg-[#090D13]/82 p-5" aria-labelledby="content-review-log-title" data-content-review-log>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">عرض فقط</p>
          <h2 id="content-review-log-title" className="mt-1 text-base font-semibold text-white/85">سجل المراجعة</h2>
          <ol className="mt-4 space-y-0">
            <TimelineEntry title="آخر حفظ" value={formatAuditTimestamp(updatedAt)} />
            <TimelineEntry title="حالة النشر الحالية" value={statusLabel(input.status)} />
            <TimelineEntry title="تاريخ النشر" value={visibleDate} last />
          </ol>
        </section>
      </div>
    </section>
  );
}

function DisplayDecision({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
      <dt className="text-[10px] leading-4 text-white/42">{label}</dt>
      <dd className={`shrink-0 text-[11px] font-semibold ${enabled ? "text-emerald-200/80" : "text-white/32"}`}>
        {enabled ? "ظاهر" : "مخفي"}
      </dd>
    </div>
  );
}

function ScoreDecision({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
      <dt className="text-[10px] text-white/38">{label}</dt>
      <dd className="mt-1 font-en text-base font-semibold text-white/78">{value}</dd>
    </div>
  );
}

function ReviewAnalysisCard({
  definition,
  items,
  expanded,
  onToggle,
  variant,
}: {
  definition: AnalysisCardDefinition;
  items: ContentReviewCheck[];
  expanded: boolean;
  onToggle: () => void;
  variant: "guidance" | "validation";
}) {
  const score = getContentReviewScore(items);
  const issues = items.filter((item) => item.status !== "pass");
  const errors = issues.filter((item) => item.status === "fail").length;
  const warnings = issues.filter((item) => item.status === "warn").length;
  const improvements = issues.filter((item) => item.status === "info").length;
  const topIssue = issues.find((item) => item.status === "fail") ?? issues[0];
  const panelId = `content-review-analysis-${definition.id}`;
  const publicationBlocked = errors > 0;

  return (
    <article
      className={`overflow-hidden rounded-[22px] border bg-[#090D13]/88 shadow-[0_18px_44px_rgba(0,0,0,0.18)] ${variant === "validation" ? publicationBlocked ? "border-red-300/25" : "border-emerald-300/18" : "min-h-[22.125rem] border-white/10"}`}
      data-content-review-analysis={definition.id}
      data-content-review-expanded={expanded ? "true" : "false"}
      data-content-review-analysis-tier={variant === "validation" ? "blocking" : "guidance"}
    >
      <div className={variant === "validation" ? "grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)_auto] md:items-center md:p-5" : "flex min-h-full flex-col p-4"}>
        {variant === "validation" ? (
          <>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200/55">
                تحقق مانع للنشر
              </p>
              <h3 className="mt-1 text-base font-semibold text-white/88">{definition.title}</h3>
              <p className="mt-1 text-xs leading-5 text-white/42">{definition.description}</p>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
              <div className={`grid size-14 shrink-0 place-items-center rounded-xl border font-en text-xl font-semibold ${publicationBlocked ? "border-red-300/20 bg-red-300/[0.07] text-red-100/80" : "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100/80"}`}>
                {errors}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${publicationBlocked ? "text-red-100/78" : "text-emerald-100/75"}`}>
                  {publicationBlocked ? "النشر ممنوع" : "النشر مسموح"}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/38">
                  {publicationBlocked
                    ? `${errors} ${errors === 1 ? "مشكلة مانعة تحتاج إصلاحًا." : "مشكلات مانعة تحتاج إصلاحًا."}`
                    : "الحقول المطلوبة والقيم الأساسية سليمة."}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-16 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white/88">{definition.title}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-white/38">{definition.description}</p>
              </div>
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#D8B87A]/22 bg-[#D8B87A]/[0.075] font-en text-base font-semibold text-[#F0D69F]">
                {score}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <AnalysisCount label="الأخطاء" value={errors} tone="error" />
              <AnalysisCount label="التنبيهات" value={warnings} tone="warning" />
              <AnalysisCount label="التحسينات" value={improvements} tone="info" />
            </dl>

            <div className="mt-3 min-h-24 rounded-xl border border-white/8 bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">أهم مشكلة</p>
              {topIssue ? (
                <div className="mt-1.5">
                  <p className="text-sm font-semibold text-white/72">{topIssue.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{topIssue.hint}</p>
                </div>
              ) : (
                <p className="mt-1.5 text-sm font-medium text-emerald-200/70">لا توجد مشكلات حالية.</p>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`${variant === "validation" ? "md:justify-self-end" : "mt-4 self-start"} inline-flex min-h-10 items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/[0.065] px-4 py-2 text-xs font-semibold text-[#EED49B] transition hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55`}
        >
          {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
          <span aria-hidden="true" className={`ms-2 transition ${expanded ? "rotate-180" : ""}`}>⌄</span>
        </button>
      </div>

      {expanded ? (
        <div id={panelId} className="border-t border-white/10 bg-black/15 p-5" role="region" aria-label={`تفاصيل ${definition.title}`}>
          <ReviewIssueList items={issues} />
        </div>
      ) : null}
    </article>
  );
}

function AnalysisCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "error" | "warning" | "info";
}) {
  const toneClassName = tone === "error"
    ? "text-red-200/80"
    : tone === "warning"
      ? "text-amber-200/80"
      : "text-sky-200/75";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-2.5 text-center">
      <dt className="text-[10px] leading-4 text-white/35">{label}</dt>
      <dd className={`mt-1 font-en text-base font-semibold ${toneClassName}`}>{value}</dd>
    </div>
  );
}

function ReviewIssueList({ items }: { items: ContentReviewCheck[] }) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100/75">
        لا توجد مشكلات في هذا التحليل.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => <ReviewIssueCard key={item.id} item={item} />)}
    </div>
  );
}

function ReviewIssueCard({ item }: { item: ContentReviewCheck }) {
  const tone = item.severity === "error"
    ? "border-red-400/20 bg-red-400/[0.07]"
    : item.severity === "warning"
      ? "border-[#D8B87A]/18 bg-[#D8B87A]/[0.07]"
      : "border-sky-300/15 bg-sky-300/[0.055]";
  const severityLabel = item.severity === "error"
    ? "خطأ"
    : item.severity === "warning"
      ? "تنبيه"
      : "تحسين";
  return (
    <article
      className={`rounded-xl border px-4 py-3 ${tone}`}
      data-content-review-issue={item.id}
      data-content-review-severity={item.severity}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white/78">{item.label}</h4>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/42">
              {severityLabel}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-white/48">{item.hint}</p>
        </div>
        {item.correctionTarget ? (
          <ContentCorrectionButton
            tabId={item.correctionTarget.tabId}
            targetId={item.correctionTarget.targetId}
          />
        ) : null}
      </div>
    </article>
  );
}

function TimelineEntry({ title, value, last = false }: { title: string; value: string; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last ? <span aria-hidden="true" className="absolute top-3 bottom-0 start-[5px] w-px bg-white/10" /> : null}
      <span aria-hidden="true" className="relative mt-1.5 size-3 shrink-0 rounded-full border-2 border-[#D8B87A]/70 bg-[#0A0E14]" />
      <div>
        <p className="text-sm font-semibold text-white/68">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/38">{value}</p>
      </div>
    </li>
  );
}
