"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeTopicSeo, type FaqItem, type SeoIssue } from "../../lib/admin/seo-score";
import AdminTagsField from "./AdminTagsField";

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
  faq?: FaqItem[];
  hideImageAltField?: boolean;
};

type LiveState = SeoPanelProps;

function getStringFromForm(form: HTMLFormElement | null, name: string, fallback: string) {
  const field = form?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return field?.value ?? fallback;
}

function getFaqFromForm(form: HTMLFormElement | null, fallback: FaqItem[] = []) {
  if (!form) return fallback;

  const questions = Array.from(form.querySelectorAll<HTMLInputElement>('[name="faq_question"]'));
  const answers = Array.from(form.querySelectorAll<HTMLTextAreaElement>('[name="faq_answer"]'));

  return questions
    .map((question, index) => ({
      question: question.value.trim(),
      answer: (answers[index]?.value ?? "").trim(),
    }))
    .filter((item) => item.question || item.answer);
}

function getRangeStatus(value: number, min: number, max: number) {
  if (value < min) return "short";
  if (value > max) return "long";
  return "good";
}

function getStatusLabel(status: "short" | "long" | "good") {
  if (status === "short") return "قصير";
  if (status === "long") return "طويل";
  return "ممتاز";
}

function getStatusClass(status: "short" | "long" | "good") {
  if (status === "good") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (status === "short") return "border-[#D8B87A]/30 bg-[#D8B87A]/10 text-[#F2D99B]";
  return "border-red-400/25 bg-red-400/10 text-red-200";
}

function getScoreClass(score: number) {
  if (score >= 75) return "text-emerald-200";
  if (score >= 55) return "text-[#F2D99B]";
  return "text-red-200";
}

export default function SeoPanel(props: SeoPanelProps) {
  const [live, setLive] = useState<LiveState>(props);

  useEffect(() => {
    const root = document.getElementById("seo-command-center");
    const form = root?.closest("form") as HTMLFormElement | null;
    if (!form) return;

    function readForm() {
      setLive({
        title: getStringFromForm(form, "title", props.title),
        excerpt: getStringFromForm(form, "excerpt", props.excerpt),
        slug: getStringFromForm(form, "slug", props.slug),
        content: getStringFromForm(form, "content", props.content),
        image: getStringFromForm(form, "image", props.image),
        imageAlt: getStringFromForm(form, "image_alt", props.imageAlt),
        seoTitle: getStringFromForm(form, "seo_title", props.seoTitle),
        seoDescription: getStringFromForm(form, "seo_description", props.seoDescription),
        seoKeywords: getStringFromForm(form, "seo_keywords", props.seoKeywords.join(", "))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        focusKeyword: getStringFromForm(form, "focus_keyword", props.focusKeyword),
        faq: getFaqFromForm(form, props.faq),
      });
    }

    readForm();
    form.addEventListener("input", readForm);
    form.addEventListener("change", readForm);

    return () => {
      form.removeEventListener("input", readForm);
      form.removeEventListener("change", readForm);
    };
  }, [props]);

  const analysis = useMemo(() => analyzeTopicSeo(live), [live]);
  const titleStatus = getRangeStatus(live.seoTitle.length, 45, 60);
  const descriptionStatus = getRangeStatus(live.seoDescription.length, 120, 160);
  const imageAltStatus = getRangeStatus(live.imageAlt.length, 35, 140);

  return (
    <section
      id="seo-command-center"
      className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
    >
      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">SEO COMMAND CENTER</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">تقييم السيو وجودة الصفحة</h3>
          <p className="mt-2 text-sm leading-7 text-white/50">
            تحليل حي للحقول والمحتوى والجاهزية. لا يوجد أي اعتماد على reading_time.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <ScoreCard label="SEO" score={analysis.seoScore} />
          <ScoreCard label="Content" score={analysis.contentScore} />
          <ScoreCard label="Ready" score={analysis.readinessScore} />
          <ScoreCard label={analysis.label} score={analysis.overallScore} featured />
        </div>
      </div>

      {analysis.blockingErrors > 0 ? (
        <div className="mt-6 rounded-[20px] border border-red-400/20 bg-red-400/10 p-4">
          <p className="text-sm font-semibold text-red-100">يوجد {analysis.blockingErrors} تنبيه مانع للنشر.</p>
          <p className="mt-2 text-sm leading-7 text-white/50">
            عالج العناصر الحمراء أولًا قبل الضغط على نشر. المسودة يمكن حفظها، لكن النشر يحتاج نسخة مكتملة.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <FieldBlock
          label="SEO Title"
          name="seo_title"
          defaultValue={props.seoTitle}
          placeholder="اكتب عنوان SEO واضح وجذاب..."
          count={live.seoTitle.length}
          recommended="الموصى به: 45 إلى 60 حرف"
          status={titleStatus}
        />

        <FieldBlock
          label="Meta Description"
          name="seo_description"
          defaultValue={props.seoDescription}
          placeholder="اكتب وصف مختصر يظهر في نتائج البحث..."
          count={live.seoDescription.length}
          recommended="الموصى به: 120 إلى 160 حرف"
          status={descriptionStatus}
          textarea
        />

        <FieldBlock
          label="Focus Keyword"
          name="focus_keyword"
          defaultValue={props.focusKeyword}
          placeholder="مثال: بيت الوطن القاهرة الجديدة"
          count={live.focusKeyword.length}
          recommended="الكلمة الرئيسية التي يستهدفها المقال"
          status={live.focusKeyword ? "good" : "short"}
        />

        {props.hideImageAltField ? null : (
          <FieldBlock
            label="Image Alt Text"
            name="image_alt"
            defaultValue={props.imageAlt}
            placeholder="وصف واضح للصورة يحتوي على الكلمة الرئيسية إن أمكن..."
            count={live.imageAlt.length}
            recommended="الموصى به: 35 إلى 140 حرف"
            status={imageAltStatus}
          />
        )}
      </div>

      <AdminTagsField
        name="seo_keywords"
        label="SEO Keywords"
        defaultTags={props.seoKeywords}
        placeholder="مثال: بيت الوطن — ثم Enter أو , أو ;"
        helperText="الكلمات متعددة المسافات تُحفظ ككلمة واحدة"
      />

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <MiniStat label="عدد الكلمات" value={analysis.wordCount} note="ينصح 800 - 1800" />
        <MiniStat label="عدد الحروف" value={analysis.charCount} note="حسب عمق المقال" />
        <MiniStat label="H1" value={analysis.h1Count} note="واحد فقط" />
        <MiniStat label="عناوين H2" value={analysis.h2Count} note="ينصح 2 أو أكثر" />
        <MiniStat label="أسئلة FAQ" value={analysis.faqCount} note="ينصح 3 - 6" />
        <MiniStat label="H3" value={analysis.h3Count} note="اختياري لكنه مفيد" />
        <MiniStat label="روابط داخلية" value={analysis.internalLinksCount} note="ينصح برابط داخلي واحد" />
        <MiniStat label="كثافة الكلمة" value={analysis.keywordDensity} note="المريح 0.5% - 2%" suffix="%" />
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-3">
        <IssueGroup title="SEO Tasks" issues={analysis.issues.seo} />
        <IssueGroup title="Content Tasks" issues={analysis.issues.content} />
        <IssueGroup title="Publishing Tasks" issues={analysis.issues.readiness} />
      </div>
    </section>
  );
}

function ScoreCard({ label, score, featured = false }: { label: string; score: number; featured?: boolean }) {
  return (
    <div
      className={
        featured
          ? "rounded-[22px] border border-[#D8B87A]/35 bg-[#D8B87A]/12 px-5 py-4 text-center"
          : "rounded-[22px] border border-white/10 bg-black/25 px-5 py-4 text-center"
      }
      title={`${label}: ${score}/100`}
    >
      <p className={`font-en text-3xl font-semibold ${getScoreClass(score)}`}>
        {score}<span className="text-base">/100</span>
      </p>
      <p className="mt-1 text-xs text-white/50">{label}</p>
    </div>
  );
}

function FieldBlock({
  label,
  name,
  defaultValue,
  placeholder,
  count,
  recommended,
  status,
  textarea = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  count: number;
  recommended: string;
  status: "short" | "long" | "good";
  textarea?: boolean;
}) {
  const statusClass = getStatusClass(status);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-white/75">{label}</label>
        <span className={`rounded-full border px-3 py-1 text-xs ${statusClass}`}>{getStatusLabel(status)}</span>
      </div>

      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={4}
          placeholder={placeholder}
          className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45"
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45"
        />
      )}

      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-white/35">{recommended}</span>
        <span className="font-en text-white/45">{count} حرف</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, note, suffix = "" }: { label: string; value: number; note: string; suffix?: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-2 font-en text-2xl font-semibold text-[#D8B87A]">{value}{suffix}</p>
      <p className="mt-2 text-xs leading-6 text-white/35">{note}</p>
    </div>
  );
}

function IssueGroup({ title, issues }: { title: string; issues: SeoIssue[] }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 space-y-3">
        {issues.map((issue) => (
          <div
            key={`${issue.label}-${issue.hint}`}
            className={
              issue.type === "success"
                ? "rounded-2xl border border-emerald-400/15 bg-emerald-400/8 p-4"
                : issue.type === "error"
                  ? "rounded-2xl border border-red-400/20 bg-red-400/10 p-4"
                  : "rounded-2xl border border-[#D8B87A]/18 bg-[#D8B87A]/8 p-4"
            }
          >
            <div className="flex items-center justify-between gap-3">
              <p
                className={
                  issue.type === "success"
                    ? "text-sm font-medium text-emerald-200"
                    : issue.type === "error"
                      ? "text-sm font-medium text-red-100"
                      : "text-sm font-medium text-[#F2D99B]"
                }
              >
                {issue.type === "success" ? "✓" : issue.type === "error" ? "×" : "!"} {issue.label}
              </p>
              <span className="font-en text-xs text-white/35">+{issue.points}</span>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/40">{issue.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
