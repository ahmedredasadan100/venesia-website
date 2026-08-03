"use client";

import { useEffect, useMemo, useState } from "react";

import {
  analyzeEntitySeo,
  type EntitySeoScoreInput,
  type SeoIssue,
} from "../../../lib/admin/seo-score";
import {
  SEO_LENGTH_STANDARDS,
  assessSeoLength,
  formatSeoLengthRange,
  getSeoLengthStateLabel,
  type SeoLengthStandard,
} from "../../../lib/admin/seo-length-standards";
import AdminTagsField from "../AdminTagsField";
import AdminMediaImageField from "../media/AdminMediaImageField";
import { ADMIN_FORM_SECTION_CLASSES, AdminFormLayout } from "../ui/AdminForm";
import AdminFormListboxSelect from "../ui/AdminFormListboxSelect";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../ui/AdminFormRuntime";
import AdminSingleOpenAccordion from "../ui/AdminSingleOpenAccordion";

export const ADMIN_ENTITY_SEO_TERMINOLOGY = {
  seoTitle: "عنوان صفحة محركات البحث (SEO Title)",
  seoDescription: "الوصف التعريفي لمحركات البحث (Meta Description)",
  focusKeyword: "الكلمة المفتاحية الرئيسية (Focus Keyword)",
  focusKeywordHelper:
    "عبارة البحث الرئيسية التي تُحسب عليها الكثافة والتحليلات.",
  seoKeywords: "الكلمات المفتاحية الداعمة (SEO Keywords)",
  canonicalUrl: "الرابط الأساسي (Canonical URL)",
  robots: "الفهرسة وتتبع الروابط (Robots)",
  socialSettings: "إعدادات المشاركة الاجتماعية (Open Graph)",
  socialPreview: "معاينة المشاركة الاجتماعية (Open Graph)",
  socialSettingsDescription:
    "تحكم في صورة المشاركة والنص البديل المستخدمين عند مشاركة الرابط.",
  socialPreviewDescription:
    "الشكل المتوقع للرابط عند مشاركته على المنصات الاجتماعية.",
} as const;

export type AdminEntitySeoCorrectionTarget = {
  tabId: string;
  targetId: string;
};

export type AdminEntitySeoFieldNames = {
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  seoKeywords: string;
  canonicalUrl: string;
  robotsIndex: string;
  robotsFollow: string;
};

export type AdminEntitySeoFieldIds = {
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  seoKeywords: string;
  canonicalUrl: string;
  robotsSection: string;
  robotsIndexListbox: string;
  robotsIndexFocusTarget: string;
  robotsFollowListbox: string;
  robotsFollowFocusTarget: string;
};

export type AdminEntitySeoSocialContract =
  | {
      mode: "editable_override";
      mediaBrowseFolder: string;
      fieldNames: {
        image: string;
        imageAlt: string;
      };
      fieldIds: {
        imageSection: string;
        imageAlt: string;
      };
    }
  | {
      mode: "entity_fallback";
      sourceFieldNames: {
        image: string;
        imageAlt: string;
      };
      correctionTargets: {
        image: AdminEntitySeoCorrectionTarget;
        imageAlt: AdminEntitySeoCorrectionTarget;
      };
    };

export type AdminEntitySeoAnalysisMetric = {
  id: string;
  label: string;
  value: string;
};

export type AdminEntitySeoAnalysisExtensionResult = {
  issues?: readonly SeoIssue[];
  metrics?: readonly AdminEntitySeoAnalysisMetric[];
  issueOrder?: readonly string[];
  score?: number;
  label?: string;
};

export type AdminEntitySeoAnalysisExtension<TState> = {
  initialState: TState;
  readState: (form: HTMLFormElement, initialState: TState) => TState;
  analyze: (
    input: EntitySeoScoreInput,
    state: TState,
  ) => AdminEntitySeoAnalysisExtensionResult;
};

export type AdminEntitySeoPanelProps<TAnalysisState = undefined> = {
  id?: string;
  entityLabel: string;
  publicPathPrefix: string;
  slugPlaceholder: string;
  navigationEventName: string;
  sourceFieldNames: {
    title: string;
    description: string;
    content: string;
    slug: string;
  };
  fieldNames: AdminEntitySeoFieldNames;
  fieldIds: AdminEntitySeoFieldIds;
  social: AdminEntitySeoSocialContract;
  initial: EntitySeoScoreInput & {
    canonicalUrl: string;
    robotsIndex: boolean | null;
    robotsFollow: boolean | null;
  };
  correctionTargets: Partial<
    Record<string, AdminEntitySeoCorrectionTarget>
  >;
  analysisExtension?: AdminEntitySeoAnalysisExtension<TAnalysisState>;
};

type LiveSeoState = AdminEntitySeoPanelProps<unknown>["initial"];

const fieldClass =
  "mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 hover:border-white/18 focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/15";

const robotsIndexOptions = [
  { value: "", label: "الإعداد العام" },
  { value: "true", label: "Index" },
  { value: "false", label: "Noindex" },
] as const;

const robotsFollowOptions = [
  { value: "", label: "الإعداد العام" },
  { value: "true", label: "Follow" },
  { value: "false", label: "Nofollow" },
] as const;

function readValue(form: HTMLFormElement, name: string, fallback: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
    ? field.value
    : fallback;
}

function readNullableBoolean(
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

function splitKeywords(value: string) {
  return value
    .split(/[,;،؛]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function robotsPreviewLabel(
  value: boolean | null,
  enabled: string,
  disabled: string,
) {
  if (value === null) return "الإعداد العام";
  return value ? enabled : disabled;
}

function correctionButton(
  navigationEventName: string,
  target: AdminEntitySeoCorrectionTarget | undefined,
) {
  if (!target) return null;
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-[#D8B87A]/28 bg-[#D8B87A]/8 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] transition hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent(navigationEventName, { detail: target }),
        );
      }}
    >
      تصحيح
    </button>
  );
}

function SeoTextField({
  id,
  name,
  label,
  defaultValue,
  liveValue,
  helper,
  textarea = false,
  dir = "rtl",
  standard,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  liveValue: string;
  helper?: string;
  textarea?: boolean;
  dir?: "rtl" | "ltr";
  standard?: SeoLengthStandard;
}) {
  const assessment = standard ? assessSeoLength(liveValue, standard) : null;
  const hasError = Boolean(
    useOptionalAdminFormRuntime()?.fieldErrors[name]?.length,
  );
  const errorId = `${name}-error`;
  const lengthFeedbackId = `${id}-length-feedback`;
  const describedBy = [
    assessment ? lengthFeedbackId : null,
    hasError ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  return (
    <label
      htmlFor={id}
      className="block scroll-mt-28 text-sm font-semibold text-white/72"
    >
      {label}
      {textarea ? (
        <textarea
          id={id}
          name={name}
          defaultValue={defaultValue}
          rows={4}
          dir={dir}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={`${fieldClass} resize-y leading-7`}
        />
      ) : (
        <input
          id={id}
          name={name}
          defaultValue={defaultValue}
          dir={dir}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={fieldClass}
        />
      )}
      <span
        id={assessment ? lengthFeedbackId : undefined}
        aria-live={assessment ? "polite" : undefined}
        aria-atomic={assessment ? "true" : undefined}
        className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white/42"
      >
        <span>
          {assessment
            ? getSeoLengthStateLabel(assessment.state)
            : helper ?? ""}
        </span>
        <span
          className={
            assessment?.state === "success"
              ? "text-emerald-300"
              : assessment?.state === "danger"
                ? "text-red-300"
                : "text-[#D8B87A]"
          }
          data-seo-length-state={assessment?.state}
          data-seo-length-count={assessment?.count}
          data-seo-length-target={
            assessment ? formatSeoLengthRange(assessment) : undefined
          }
        >
          {liveValue.length} حرف
          {assessment
            ? ` — المدى القياسي ${formatSeoLengthRange(assessment)}`
            : ""}
        </span>
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

function IssueRow({
  issue,
  target,
  navigationEventName,
}: {
  issue: SeoIssue;
  target?: AdminEntitySeoCorrectionTarget;
  navigationEventName: string;
}) {
  const tone =
    issue.type === "success"
      ? "border-emerald-400/15 bg-emerald-400/8"
      : issue.type === "error"
        ? "border-red-400/20 bg-red-400/8"
        : issue.type === "warning"
          ? "border-[#D8B87A]/18 bg-[#D8B87A]/8"
          : "border-white/10 bg-white/[0.025]";
  const icon =
    issue.type === "success"
      ? "✓"
      : issue.type === "error"
        ? "×"
        : issue.type === "warning"
          ? "!"
          : "•";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${tone}`}
      data-admin-entity-seo-issue={issue.id ?? "unclassified"}
      data-admin-entity-seo-severity={issue.type}
    >
      <div className="flex items-start justify-between gap-3">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-sm font-medium text-white/78">
            {icon} {issue.label}
            <span
              className="ms-2 font-en text-[10px] font-normal uppercase tracking-wider text-white/30"
              data-admin-entity-seo-issue-code
            >
              {issue.id ?? "unclassified"}
            </span>
          </summary>
          <p className="mt-2 text-xs leading-6 text-white/45">{issue.hint}</p>
        </details>
        {issue.type === "success"
          ? null
          : correctionButton(navigationEventName, target)}
      </div>
    </div>
  );
}

function mergeMetrics(
  base: readonly AdminEntitySeoAnalysisMetric[],
  extra: readonly AdminEntitySeoAnalysisMetric[] = [],
) {
  const metrics = new Map<string, AdminEntitySeoAnalysisMetric>();
  for (const metric of [...base, ...extra]) metrics.set(metric.id, metric);
  return [...metrics.values()];
}

function orderIssues(issues: readonly SeoIssue[], order?: readonly string[]) {
  if (!order?.length) return [...issues];
  const positions = new Map(order.map((id, index) => [id, index]));
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((left, right) => {
      const leftPosition = positions.get(left.issue.id ?? "");
      const rightPosition = positions.get(right.issue.id ?? "");
      if (leftPosition === undefined && rightPosition === undefined) {
        return left.index - right.index;
      }
      if (leftPosition === undefined) return 1;
      if (rightPosition === undefined) return -1;
      return leftPosition - rightPosition;
    })
    .map(({ issue }) => issue);
}

export default function AdminEntitySeoPanel<TAnalysisState = undefined>({
  id = "admin-entity-seo-panel",
  entityLabel,
  publicPathPrefix,
  slugPlaceholder,
  navigationEventName,
  sourceFieldNames,
  fieldNames,
  fieldIds,
  social,
  initial,
  correctionTargets,
  analysisExtension,
}: AdminEntitySeoPanelProps<TAnalysisState>) {
  const [live, setLive] = useState<LiveSeoState>(initial);
  const [analysisState, setAnalysisState] = useState<TAnalysisState>(() =>
    analysisExtension
      ? analysisExtension.initialState
      : (undefined as TAnalysisState),
  );

  useEffect(() => {
    const root = document.getElementById(id);
    const form = root?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    const read = () => {
      const socialFieldNames =
        social.mode === "editable_override"
          ? social.fieldNames
          : social.sourceFieldNames;
      setLive({
        title: readValue(form, sourceFieldNames.title, initial.title),
        description: readValue(
          form,
          sourceFieldNames.description,
          initial.description,
        ),
        content: readValue(form, sourceFieldNames.content, initial.content),
        slug: readValue(form, sourceFieldNames.slug, initial.slug),
        image: readValue(form, socialFieldNames.image, initial.image),
        imageAlt: readValue(form, socialFieldNames.imageAlt, initial.imageAlt),
        seoTitle: readValue(form, fieldNames.seoTitle, initial.seoTitle),
        seoDescription: readValue(
          form,
          fieldNames.seoDescription,
          initial.seoDescription,
        ),
        seoKeywords: splitKeywords(
          readValue(form, fieldNames.seoKeywords, initial.seoKeywords.join(", ")),
        ),
        focusKeyword: readValue(
          form,
          fieldNames.focusKeyword,
          initial.focusKeyword,
        ),
        canonicalUrl: readValue(
          form,
          fieldNames.canonicalUrl,
          initial.canonicalUrl,
        ),
        robotsIndex: readNullableBoolean(
          form,
          fieldNames.robotsIndex,
          initial.robotsIndex,
        ),
        robotsFollow: readNullableBoolean(
          form,
          fieldNames.robotsFollow,
          initial.robotsFollow,
        ),
      });
      if (analysisExtension) {
        setAnalysisState(
          analysisExtension.readState(form, analysisExtension.initialState),
        );
      }
    };

    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [analysisExtension, fieldNames, id, initial, social, sourceFieldNames]);

  const baseAnalysis = useMemo(() => analyzeEntitySeo(live), [live]);
  const extensionAnalysis = useMemo(
    () => analysisExtension?.analyze(live, analysisState),
    [analysisExtension, analysisState, live],
  );
  const analysis = {
    score: extensionAnalysis?.score ?? baseAnalysis.overallScore,
    label: extensionAnalysis?.label ?? baseAnalysis.label,
    issues: orderIssues(
      [...baseAnalysis.issues, ...(extensionAnalysis?.issues ?? [])],
      extensionAnalysis?.issueOrder,
    ),
    metrics: mergeMetrics(
      [
        {
          id: "keyword-density",
          label: "كثافة الكلمة المفتاحية",
          value: live.focusKeyword.trim()
            ? `${baseAnalysis.keywordDensity}%`
            : "غير متاح",
        },
      ],
      extensionAnalysis?.metrics,
    ),
  };
  const title =
    live.seoTitle.trim() || live.title.trim() || `عنوان ${entityLabel}`;
  const description =
    live.seoDescription.trim() ||
    live.description.trim() ||
    `سيظهر وصف ${entityLabel} هنا بعد إدخاله.`;
  const publicPath = `${publicPathPrefix}/${live.slug.trim() || slugPlaceholder}`;
  const canonical = live.canonicalUrl.trim() || publicPath;

  const seoBasicsContent = (
    <section
      className="rounded-2xl border border-white/10 bg-black/20 p-5"
      data-admin-entity-seo-basics
    >
      <div className="space-y-5">
        <SeoTextField
          id={fieldIds.seoTitle}
          name={fieldNames.seoTitle}
          label={ADMIN_ENTITY_SEO_TERMINOLOGY.seoTitle}
          defaultValue={initial.seoTitle}
          liveValue={live.seoTitle}
          standard={SEO_LENGTH_STANDARDS.title}
        />
        <SeoTextField
          id={fieldIds.seoDescription}
          name={fieldNames.seoDescription}
          label={ADMIN_ENTITY_SEO_TERMINOLOGY.seoDescription}
          defaultValue={initial.seoDescription}
          liveValue={live.seoDescription}
          textarea
          standard={SEO_LENGTH_STANDARDS.description}
        />
        <SeoTextField
          id={fieldIds.focusKeyword}
          name={fieldNames.focusKeyword}
          label={ADMIN_ENTITY_SEO_TERMINOLOGY.focusKeyword}
          defaultValue={initial.focusKeyword}
          liveValue={live.focusKeyword}
          helper={ADMIN_ENTITY_SEO_TERMINOLOGY.focusKeywordHelper}
        />
        <div id={fieldIds.seoKeywords} className="scroll-mt-28">
          <AdminTagsField
            name={fieldNames.seoKeywords}
            label={ADMIN_ENTITY_SEO_TERMINOLOGY.seoKeywords}
            defaultTags={initial.seoKeywords}
            appearance="dark"
          />
          <AdminFormError name={fieldNames.seoKeywords} />
        </div>
      </div>
    </section>
  );

  const robotsCanonicalContent = (
    <section
      id={fieldIds.robotsSection}
      className="scroll-mt-28 rounded-2xl border border-white/10 bg-black/20 p-5"
      data-admin-entity-seo-overrides
    >
      <h3 className="text-base font-semibold text-white">
        {ADMIN_ENTITY_SEO_TERMINOLOGY.robots}
      </h3>
      <p className="mt-2 text-sm leading-7 text-white/42">
        القيم العامة تظل المصدر الافتراضي، ويمكن تخصيص هذا {entityLabel} فقط
        عند الحاجة.
      </p>
      <div
        className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,.7fr)_minmax(180px,.7fr)_minmax(0,1.6fr)] lg:items-start"
        data-admin-seo-control-order="index-follow-canonical"
      >
        <AdminFormListboxSelect
          id={fieldIds.robotsIndexListbox}
          focusTargetId={fieldIds.robotsIndexFocusTarget}
          name={fieldNames.robotsIndex}
          label="الفهرسة"
          options={robotsIndexOptions}
          defaultValue={
            initial.robotsIndex === null ? "" : String(initial.robotsIndex)
          }
          placeholder="الإعداد العام"
          sizing="full"
        />
        <AdminFormListboxSelect
          id={fieldIds.robotsFollowListbox}
          focusTargetId={fieldIds.robotsFollowFocusTarget}
          name={fieldNames.robotsFollow}
          label="تتبع الروابط"
          options={robotsFollowOptions}
          defaultValue={
            initial.robotsFollow === null ? "" : String(initial.robotsFollow)
          }
          placeholder="الإعداد العام"
          sizing="full"
        />
        <SeoTextField
          id={fieldIds.canonicalUrl}
          name={fieldNames.canonicalUrl}
          label={ADMIN_ENTITY_SEO_TERMINOLOGY.canonicalUrl}
          defaultValue={initial.canonicalUrl}
          liveValue={live.canonicalUrl}
          helper={`اتركه فارغًا لاستخدام رابط ${entityLabel} العام تلقائيًا.`}
          dir="ltr"
        />
      </div>
    </section>
  );

  const socialSharingFields = (
    <section
      className="rounded-2xl border border-white/10 bg-black/20 p-5"
      data-admin-entity-seo-social-fields
      data-admin-entity-seo-social-mode={social.mode}
    >
      <h3 className="text-base font-semibold text-white">
        {ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettings}
      </h3>
      <p className="mt-2 text-sm leading-7 text-white/42">
        {ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettingsDescription}
      </p>
      {social.mode === "editable_override" ? (
        <div id={social.fieldIds.imageSection} className="mt-5 scroll-mt-28">
          <AdminMediaImageField
            name={social.fieldNames.image}
            label="صورة المشاركة"
            defaultValue={initial.image}
            dimensionHint="content"
            browseFolder={social.mediaBrowseFolder}
            appearance="dark"
            onValueChange={(image) =>
              setLive((current) => ({ ...current, image }))
            }
          />
          <label className="mt-4 block text-sm font-semibold text-white/72">
            النص البديل لصورة المشاركة
            <input
              id={social.fieldIds.imageAlt}
              name={social.fieldNames.imageAlt}
              defaultValue={initial.imageAlt}
              className={fieldClass}
            />
            <AdminFormError name={social.fieldNames.imageAlt} />
          </label>
        </div>
      ) : (
        <div
          className="mt-5 grid gap-3 sm:grid-cols-2"
          data-admin-entity-seo-social-source
        >
          <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="min-w-0">
              <p className="text-xs text-white/38">مصدر صورة المشاركة</p>
              <p className="mt-1 text-sm leading-6 text-white/72">
                {live.image ? `صورة ${entityLabel} الحالية` : "الإعداد العام"}
              </p>
            </div>
            {correctionButton(
              navigationEventName,
              social.correctionTargets.image,
            )}
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="min-w-0">
              <p className="text-xs text-white/38">النص البديل المستخدم</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/72">
                {live.imageAlt || "الإعداد العام"}
              </p>
            </div>
            {correctionButton(
              navigationEventName,
              social.correctionTargets.imageAlt,
            )}
          </div>
        </div>
      )}
    </section>
  );

  const searchResultPreviewContent = (
    <div data-admin-entity-seo-search-preview>
      <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-4">
        <p className="break-all font-mono text-xs text-emerald-200/70" dir="ltr">
          {canonical}
        </p>
        <p className="mt-3 text-lg font-semibold leading-7 text-[#8AB4F8]">
          {title}
        </p>
        <p className="mt-2 text-sm leading-7 text-white/58">{description}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <PreviewValue
          label="Robots"
          value={robotsPreviewLabel(live.robotsIndex, "Index", "Noindex")}
        />
        <PreviewValue
          label="Links"
          value={robotsPreviewLabel(live.robotsFollow, "Follow", "Nofollow")}
        />
      </div>
    </div>
  );

  const openGraphPreviewContent = (
    <div
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F14]"
      data-admin-entity-seo-social-preview
    >
      {live.image ? (
        <div
          className="aspect-[1.91/1] bg-cover bg-center"
          style={{ backgroundImage: `url(${live.image})` }}
          role="img"
          aria-label={live.imageAlt || title}
        />
      ) : (
        <div className="grid aspect-[1.91/1] place-items-center border-b border-white/10 text-xs text-white/30">
          تُستخدم صورة Open Graph العامة
        </div>
      )}
      <div className="p-4">
        <p className="line-clamp-2 text-sm font-semibold leading-6 text-white/78">
          {title}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">
          {description}
        </p>
      </div>
    </div>
  );

  const liveSeoAnalysisContent = (
    <div data-admin-entity-seo-analysis>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/72">{analysis.label}</p>
          <p className="mt-1 text-xs text-white/40">
            الدرجة إرشادية ولا تمنع النشر وحدها.
          </p>
        </div>
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-[7px] border-[#D8B87A]/60 bg-black/25 font-en text-xl font-semibold text-white">
          {analysis.score}
        </div>
      </div>
      <div
        className="mt-4 grid gap-2 sm:grid-cols-2"
        data-admin-entity-seo-metrics
      >
        {analysis.metrics.map((metric) => (
          <div
            key={metric.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm"
            data-admin-entity-seo-metric={metric.id}
          >
            <span className="text-white/55">{metric.label}</span>
            <span className="font-en font-semibold text-[#D8B87A]">
              {metric.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2">
        {analysis.issues.length ? (
          analysis.issues.map((issue) => (
            <IssueRow
              key={issue.id ?? issue.label}
              issue={issue}
              target={issue.id ? correctionTargets[issue.id] : undefined}
              navigationEventName={navigationEventName}
            />
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-white/45">
            لا توجد ملاحظات SEO متاحة حاليًا.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <section
      id={id}
      className={ADMIN_FORM_SECTION_CLASSES}
      data-admin-entity-seo-panel
    >
      <AdminFormLayout
        aside={
          <AdminSingleOpenAccordion
            ariaLabel={`معاينات وتحليل SEO الخاصة بـ${entityLabel}`}
            defaultOpenId="search-result-preview"
            navigationEventName={navigationEventName}
            items={[
              {
                id: "search-result-preview",
                label: "معاينة نتائج البحث",
                description: "الشكل المتوقع للرابط داخل نتائج محركات البحث.",
                content: searchResultPreviewContent,
              },
              {
                id: "open-graph-preview",
                label: ADMIN_ENTITY_SEO_TERMINOLOGY.socialPreview,
                description:
                  ADMIN_ENTITY_SEO_TERMINOLOGY.socialPreviewDescription,
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
        {robotsCanonicalContent}
        {socialSharingFields}
      </AdminFormLayout>
    </section>
  );
}
