"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeTopicSeo, type FaqItem, type SeoIssue } from "../../lib/admin/seo-score";
import {
  SEO_LENGTH_STANDARDS,
  assessSeoLength,
  formatSeoLengthRange,
  getSeoLengthStateLabel,
  type SeoLengthAssessment,
} from "../../lib/admin/seo-length-standards";
import AdminTagsField from "./AdminTagsField";
import TopicCorrectionButton from "./content/editors/article/TopicCorrectionButton";
import AdminFormListboxSelect from "./ui/AdminFormListboxSelect";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "./ui/AdminFormRuntime";
import AdminSingleOpenAccordion from "./ui/AdminSingleOpenAccordion";
import { AdminFormLayout } from "./ui/AdminForm";

export { default as AdminEntitySeoPanel } from "./seo/AdminEntitySeoPanel";

type SeoPanelProps = {
  title: string;
  excerpt: string;
  slug: string;
  content: string;
  image: string;
  imageAlt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  focusKeyword: string;
  canonicalUrl: string;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  faq?: FaqItem[];
  hideImageAltField?: boolean;
};

type CorrectionTarget = {
  tabId: "basic" | "faq" | "seo";
  targetId: string;
};

const SEO_CORRECTION_TARGETS: Record<string, CorrectionTarget> = {
  "seo-title-length": { tabId: "seo", targetId: "topic-seo-title" },
  "meta-description-length": { tabId: "seo", targetId: "topic-seo-description" },
  "focus-keyword": { tabId: "seo", targetId: "topic-focus-keyword" },
  "keyword-title": { tabId: "seo", targetId: "topic-seo-title" },
  "keyword-description": { tabId: "seo", targetId: "topic-seo-description" },
  "keyword-intro": { tabId: "basic", targetId: "topic-content-markdown" },
  image: { tabId: "basic", targetId: "topic-image-field" },
  "image-alt-length": { tabId: "basic", targetId: "topic-image-alt" },
  "keyword-alt": { tabId: "basic", targetId: "topic-image-alt" },
  "seo-keywords": { tabId: "seo", targetId: "topic-seo-keywords" },
  slug: { tabId: "basic", targetId: "topic-slug" },
  "keyword-density": { tabId: "basic", targetId: "topic-content-markdown" },
};

const ROBOTS_INDEX_OPTIONS = [
  { value: "", label: "استخدام الإعداد العام" },
  { value: "true", label: "Index" },
  { value: "false", label: "Noindex" },
] as const;

const ROBOTS_FOLLOW_OPTIONS = [
  { value: "", label: "استخدام الإعداد العام" },
  { value: "true", label: "Follow" },
  { value: "false", label: "Nofollow" },
] as const;

function value(form: HTMLFormElement, name: string, fallback: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  return field?.value ?? fallback;
}

function optionalBoolean(
  form: HTMLFormElement,
  name: string,
  fallback: boolean | null,
) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLSelectElement)) return fallback;
  if (field.value === "true") return true;
  if (field.value === "false") return false;
  return null;
}

function faqFrom(form: HTMLFormElement, fallback: FaqItem[] = []) {
  const questions = Array.from(form.querySelectorAll<HTMLInputElement>('[name="faq_question"]'));
  const answers = Array.from(form.querySelectorAll<HTMLTextAreaElement>('[name="faq_answer"]'));
  if (!questions.length) return fallback;
  return questions
    .map((question, index) => ({
      question: question.value.trim(),
      answer: answers[index]?.value.trim() ?? "",
    }))
    .filter((item) => item.question || item.answer);
}

function robotsLabel(value: boolean | null, enabled: string, disabled: string) {
  if (value === null) return "الإعداد العام";
  return value ? enabled : disabled;
}

export default function SeoPanel(props: SeoPanelProps) {
  const [live, setLive] = useState(props);

  useEffect(() => {
    const root = document.getElementById("seo-command-center");
    const form = root?.closest("form") as HTMLFormElement | null;
    if (!form) return;

    const read = () =>
      setLive({
        ...props,
        title: value(form, "title", props.title),
        excerpt: value(form, "excerpt", props.excerpt),
        slug: value(form, "slug", props.slug),
        content: value(form, "content", props.content),
        image: value(form, "image", props.image),
        imageAlt: value(form, "image_alt", props.imageAlt),
        seoTitle: value(form, "seo_title", props.seoTitle),
        seoDescription: value(form, "seo_description", props.seoDescription),
        focusKeyword: value(form, "focus_keyword", props.focusKeyword),
        canonicalUrl: value(form, "canonical_url", props.canonicalUrl),
        robotsIndex: optionalBoolean(form, "robots_index", props.robotsIndex),
        robotsFollow: optionalBoolean(form, "robots_follow", props.robotsFollow),
        seoKeywords: value(form, "seo_keywords", props.seoKeywords.join(", "))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        faq: faqFrom(form, props.faq),
      });

    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [props]);

  const analysis = useMemo(() => analyzeTopicSeo(live), [live]);
  const publicPath = `/topics/${live.slug.trim() || "your-slug"}`;
  const previewTitle = live.seoTitle.trim() || live.title.trim() || "عنوان الموضوع";
  const previewDescription =
    live.seoDescription.trim() || live.excerpt.trim() || "سيظهر وصف الموضوع هنا عند إضافته.";
  const canonicalPreview = live.canonicalUrl.trim() || publicPath;
  const seoTitleLength = assessSeoLength(
    live.seoTitle,
    SEO_LENGTH_STANDARDS.title,
  );
  const seoDescriptionLength = assessSeoLength(
    live.seoDescription,
    SEO_LENGTH_STANDARDS.description,
  );
  const searchResultPreviewContent = (
    <div data-topic-search-result-preview>
      <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-4" dir="rtl">
        <p className="break-all text-xs text-emerald-200/70" dir="ltr">{canonicalPreview}</p>
        <p className="mt-3 text-lg leading-7 text-[#8B8CFF]">{previewTitle}</p>
        <p className="mt-2 text-sm leading-7 text-white/58">{previewDescription}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <PreviewValue label="Robots" value={robotsLabel(live.robotsIndex, "Index", "Noindex")} />
        <PreviewValue label="Links" value={robotsLabel(live.robotsFollow, "Follow", "Nofollow")} />
      </div>
    </div>
  );
  const openGraphPreviewContent = (
    <div data-topic-open-graph-preview>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F14]">
        {live.image ? (
          <div
            className="aspect-[1.91/1] bg-cover bg-center"
            style={{ backgroundImage: `url(${live.image})` }}
            role="img"
            aria-label={live.imageAlt || previewTitle}
          />
        ) : (
          <div className="flex aspect-[1.91/1] items-center justify-center border-b border-white/10 text-xs text-white/30">
            تُستخدم صورة Open Graph العامة
          </div>
        )}
        <div className="p-4">
          <p className="line-clamp-2 text-sm font-semibold leading-6 text-white/78">{previewTitle}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{previewDescription}</p>
        </div>
      </div>
    </div>
  );
  const liveSeoAnalysisContent = (
    <div data-topic-live-seo-analysis>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mt-1 text-xs text-white/40">الدرجة إرشادية ولا تمنع النشر وحدها.</p>
        </div>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[7px] border-[#D8B87A]/60 bg-black/25 font-en text-xl font-semibold text-white">
          {analysis.seoScore}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm" data-topic-seo-keyword-density>
        <span className="text-white/55">كثافة Focus Keyword</span>
        <span className="font-en font-semibold text-[#D8B87A]">
          {live.focusKeyword.trim() ? `${analysis.keywordDensity}%` : "غير متاح"}
        </span>
      </div>
      <div className="mt-5 space-y-2">
        <IssueRows issues={analysis.issues.seo} />
      </div>
    </div>
  );
  const canonicalField = (
    <SeoField
      id="topic-canonical-url"
      label="Canonical URL"
      name="canonical_url"
      defaultValue={props.canonicalUrl}
      count={live.canonicalUrl.length}
      helper="اتركه فارغًا لاستخدام رابط الموضوع العام تلقائيًا"
      dir="ltr"
    />
  );
  const seoBasicsContent = (
    <div className="space-y-5" data-topic-seo-main-column>
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5" data-topic-seo-basics>
        <div className="space-y-5">
          <SeoField
            id="topic-seo-title"
            label="SEO Title"
            name="seo_title"
            defaultValue={props.seoTitle}
            lengthAssessment={seoTitleLength}
          />
          <SeoField
            id="topic-seo-description"
            label="Meta Description"
            name="seo_description"
            defaultValue={props.seoDescription}
            lengthAssessment={seoDescriptionLength}
            textarea
          />
          <SeoField
            id="topic-focus-keyword"
            label="Focus Keyword"
            name="focus_keyword"
            defaultValue={props.focusKeyword}
            count={live.focusKeyword.length}
            helper="عبارة البحث الرئيسية التي تُحسب عليها الكثافة والتحليلات"
          />
          <div id="topic-seo-keywords" className="scroll-mt-24">
            <AdminTagsField
              name="seo_keywords"
              label="SEO Keywords"
              defaultTags={props.seoKeywords}
              placeholder="اكتب كلمة أو عبارة ثم Enter"
              helperText="كل عبارة متعددة الكلمات تُحفظ كوحدة واحدة"
            />
          </div>
        </div>
      </section>

      <section
        id="topic-seo-overrides"
        className="scroll-mt-24 rounded-2xl border border-white/10 bg-black/20 p-5"
        data-topic-seo-overrides
      >
        <h3 className="text-base font-semibold text-white">Canonical وRobots</h3>
        <p className="mt-2 text-sm leading-7 text-white/42">
          القيم العامة تظل المصدر الافتراضي، ويمكن تخصيص هذا الموضوع فقط عند الحاجة.
        </p>
        <div
          id="topic-seo-robots"
          dir="rtl"
          data-topic-seo-top-row
          data-admin-seo-control-order="index-follow-canonical"
          className="mt-5 grid scroll-mt-24 gap-3 lg:grid-cols-[minmax(180px,.7fr)_minmax(180px,.7fr)_minmax(0,1.6fr)] lg:items-start"
        >
          <AdminFormListboxSelect
            id="topic-robots-index-listbox"
            focusTargetId="topic-robots-index"
            name="robots_index"
            label="الفهرسة"
            options={ROBOTS_INDEX_OPTIONS}
            defaultValue={props.robotsIndex === null ? "" : String(props.robotsIndex)}
            placeholder="استخدام الإعداد العام"
            sizing="full"
          />
          <AdminFormListboxSelect
            id="topic-robots-follow-listbox"
            focusTargetId="topic-robots-follow"
            name="robots_follow"
            label="تتبع الروابط"
            options={ROBOTS_FOLLOW_OPTIONS}
            defaultValue={props.robotsFollow === null ? "" : String(props.robotsFollow)}
            placeholder="استخدام الإعداد العام"
            sizing="full"
          />
          <div className="min-w-0 flex-1">{canonicalField}</div>
        </div>
      </section>
    </div>
  );

  return (
    <section
      id="seo-command-center"
      className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-6"
      data-topic-seo-panel
    >
      <AdminFormLayout
        aside={
          <AdminSingleOpenAccordion
            ariaLabel="معاينات وتحليل SEO"
            defaultOpenId="search-result-preview"
            items={[
              {
                id: "search-result-preview",
                label: "معاينة نتائج البحث",
                description: "الشكل المتوقع للرابط داخل نتائج محركات البحث.",
                content: searchResultPreviewContent,
              },
              {
                id: "open-graph-preview",
                label: "معاينة Open Graph",
                description: "الصورة والنص المتوقعان عند مشاركة الرابط.",
                content: openGraphPreviewContent,
              },
              {
                id: "live-seo-analysis",
                label: "تحليل SEO المباشر",
                description: "الدرجة الإرشادية وملاحظات تحسين المحتوى.",
                content: liveSeoAnalysisContent,
              },
            ]}
          />
        }
        asideClassName="xl:sticky xl:top-6 xl:self-start"
      >
        {seoBasicsContent}
      </AdminFormLayout>
    </section>
  );
}

function SeoField({
  id,
  label,
  name,
  defaultValue,
  count,
  helper,
  lengthAssessment,
  textarea = false,
  dir = "rtl",
}: {
  id: string;
  label: string;
  name: string;
  defaultValue: string;
  count?: number;
  helper?: string;
  lengthAssessment?: SeoLengthAssessment;
  textarea?: boolean;
  dir?: "rtl" | "ltr";
}) {
  const hasError = Boolean(
    useOptionalAdminFormRuntime()?.fieldErrors[name]?.length,
  );
  const errorId = `${name}-error`;
  const lengthFeedbackId = `${id}-length-feedback`;
  const describedBy = [
    lengthAssessment ? lengthFeedbackId : null,
    hasError ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const classes =
    "mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45";
  return (
    <label htmlFor={id} className="block scroll-mt-24 text-sm font-medium text-white/75">
      <span>{label}</span>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          defaultValue={defaultValue}
          rows={4}
          dir={dir}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={`${classes} resize-y leading-7`}
        />
      ) : (
        <input id={id} name={name} defaultValue={defaultValue} dir={dir} aria-invalid={hasError || undefined} aria-describedby={describedBy} className={classes} />
      )}
      <span
        id={lengthAssessment ? lengthFeedbackId : undefined}
        aria-live={lengthAssessment ? "polite" : undefined}
        aria-atomic={lengthAssessment ? "true" : undefined}
        className="mt-2 flex flex-col gap-2 text-xs text-white/35 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <span>
          {lengthAssessment
            ? getSeoLengthStateLabel(lengthAssessment.state)
            : helper}
        </span>
        {lengthAssessment ? (
          <span
            data-seo-length-state={lengthAssessment.state}
            data-seo-length-count={lengthAssessment.count}
            data-seo-length-target={formatSeoLengthRange(lengthAssessment)}
            className={`self-start whitespace-nowrap font-medium sm:self-auto ${
              lengthAssessment.state === "muted"
                ? "text-white/35"
                : lengthAssessment.state === "warning"
                  ? "text-amber-300/85"
                  : lengthAssessment.state === "success"
                    ? "text-emerald-300/85"
                    : "text-red-300/90"
            }`}
          >
            <span className="font-en">
              {lengthAssessment.count}
            </span>{" "}
            حرف — المدى القياسي{" "}
            <span className="font-en">{formatSeoLengthRange(lengthAssessment)}</span>
          </span>
        ) : (
          <span className="font-en">{count}</span>
        )}
      </span>
      <AdminFormError name={name} />
    </label>
  );
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-white/35">{label}</p>
      <p className="mt-1 font-en text-white/72">{value}</p>
    </div>
  );
}

function IssueRows({ issues }: { issues: SeoIssue[] }) {
  return issues.map((issue) => {
    const target = issue.id ? SEO_CORRECTION_TARGETS[issue.id] : undefined;
    const className =
      issue.type === "success"
        ? "border-emerald-400/15 bg-emerald-400/8"
        : issue.type === "error"
          ? "border-red-400/20 bg-red-400/8"
          : issue.type === "warning"
            ? "border-[#D8B87A]/18 bg-[#D8B87A]/8"
            : "border-white/10 bg-white/[0.025]";

    return (
      <div key={issue.id ?? `${issue.label}-${issue.hint}`} className={`rounded-xl border px-4 py-3 ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer text-sm font-medium text-white/78">
              {issue.type === "success"
                ? "✓"
                : issue.type === "error"
                  ? "×"
                  : issue.type === "warning"
                    ? "!"
                    : "•"}{" "}
              {issue.label}
            </summary>
            <p className="mt-2 text-xs leading-6 text-white/45">{issue.hint}</p>
          </details>
          {issue.type !== "success" && target ? (
            <TopicCorrectionButton tabId={target.tabId} targetId={target.targetId} />
          ) : null}
        </div>
      </div>
    );
  });
}
