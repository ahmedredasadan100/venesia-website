"use client";

import type { GlobalSeoSettings } from "../../../lib/seo/global-seo-types";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import {
  analyzeEntitySeo,
  resolveEntitySeoScoreInput,
  type SeoScoreInput,
  type SeoIssue,
} from "../../../lib/admin/seo-score";
import {
  SEO_LENGTH_STANDARDS,
  assessSeoLength,
  countSeoTextCharacters,
  formatSeoLengthRange,
  getSeoLengthStateLabel,
  type SeoLengthStandard,
} from "../../../lib/admin/seo-length-standards";
import AdminTagsField from "../AdminTagsField";
import AdminMediaImageField from "../media/AdminMediaImageField";
import { ADMIN_FORM_SECTION_CLASSES, ADMIN_FORM_STACK_CLASS_NAME, AdminFormControlHeader, AdminFormLayout, AdminFormSection } from "../ui/AdminForm";
import AdminCard from "../ui/AdminCard";
import AdminActionButton from "../ui/AdminActionButton";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../ui/AdminModuleTabs";
import { AdminDataGridActionIcon } from "../ui/AdminDataGrid";
import { ADMIN_FORM, ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME, adminFormFieldClassName, adminFormHintClassName, adminFormLabelClassName, adminFormTextareaClassName } from "../../../lib/admin/admin-ui-styles";
import AdminFormListboxSelect from "../ui/AdminFormListboxSelect";
import {
  AdminFormError,
  AdminFormGrid,
  AdminFormGridItem,
  useOptionalAdminFormRuntime,
} from "../ui/AdminFormRuntime";
import AdminSingleOpenAccordion from "../ui/AdminSingleOpenAccordion";
import { stripSeoTitleSuffix } from "../../../lib/seo/seo-utils";
import { getSeoRoute } from "../../../config/seo/seo-data";
import { resolveSeoMetadata } from "../../../lib/seo/resolve-seo-metadata";
import { getGlobalSeoDefaults } from "../../../lib/seo/global-seo-defaults";
import { getSeoTitleSuffix, presentSeoText } from "../../../lib/seo/seo-utils";
import { stripHtml } from "../../../lib/rich-text/html-utils";
import { hasEntitySeoData } from "../../../lib/seo/entity-seo-types";

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
  ogImage: string;
  ogImageAlt: string;
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

export type AdminEntitySeoSocialContract = {
  mediaBrowseFolder: string;
  fieldIds: {
    imageSection: string;
    imageAlt: string;
  };
};

export type AdminEntitySeoAnalysisExtension<TState> = {
  initialState: TState;
  readState: (form: HTMLFormElement, initialState: TState) => TState;
  resolveFaq: (state: TState) => SeoScoreInput["faq"];
};

export type AdminEntitySeoPanelProps<TAnalysisState = undefined> = {
  /** Explicit consumer adoption; existing Entity SEO editors retain their default presentation. */
  presentation?: "default" | "premium" | "panel";
  seoSettings?: GlobalSeoSettings;
  previewDescription?: { fieldName: string; value: string };
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
    image: string;
    imageAlt: string;
  };
  fieldNames: AdminEntitySeoFieldNames;
  fieldIds: AdminEntitySeoFieldIds;
  social: AdminEntitySeoSocialContract;
  /** Site Settings-owned suffix. The persisted field remains page/entity-specific. */
  seoTitleSuffix?: string;
  /** Actual route/global metadata when the entity has no meaningful local SEO. */
  resolvedFallback?: {
    title: string;
    description: string;
    image: string;
    imageAlt: string;
  };
  initial: SeoScoreInput & {
    canonicalUrl: string;
    robotsIndex: boolean | null;
    robotsFollow: boolean | null;
  };
  correctionTargets: Partial<
    Record<string, AdminEntitySeoCorrectionTarget>
  >;
  controlledValues?: Partial<
    Pick<
      SeoScoreInput,
      | "title"
      | "description"
      | "content"
      | "seoTitle"
      | "seoDescription"
      | "focusKeyword"
    >
  >;
  onControlledValueChange?: (
    field: "seoTitle" | "seoDescription" | "focusKeyword",
    value: string,
  ) => void;
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
  presentation: "default" | "premium" = "default",
) {
  if (!target) return null;
  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent(navigationEventName, { detail: target }),
    );
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const element = document.getElementById(target.targetId);
        if (!element) return;
        const focusTarget = element.matches(
          'input, textarea, select, button, [contenteditable="true"], [tabindex]',
        )
          ? element
          : element.querySelector<HTMLElement>(
              'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
            );
        element.scrollIntoView({ block: "center" });
        (focusTarget as HTMLElement | null)?.focus({ preventScroll: true });
      });
    });
  };
  if (presentation === "premium") {
    return (
      <AdminActionButton type="button" variant="gold" onClick={onClick} className="shrink-0">
        <AdminDataGridActionIcon action="edit" />
        تصحيح
      </AdminActionButton>
    );
  }
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-[#D8B87A]/28 bg-[#D8B87A]/8 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] transition hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55"
      onClick={onClick}
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
  value,
  onValueChange,
  helper,
  textarea = false,
  dir = "rtl",
  standard,
  presentation = "default",
  icon,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  liveValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  helper?: string;
  textarea?: boolean;
  dir?: "rtl" | "ltr";
  standard?: SeoLengthStandard;
  presentation?: "default" | "premium" | "panel";
  icon?: ReactNode;
}) {
  const panel = presentation === "panel";
  const premium = presentation === "premium" || panel;
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
  const valueProps =
    value === undefined
      ? { defaultValue }
      : {
          value,
          onChange: (
            event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => onValueChange?.(event.currentTarget.value),
        };
  return (
    <label
      htmlFor={id}
      className={premium ? `${adminFormLabelClassName({ textInset: panel })} scroll-mt-28` : "block scroll-mt-28 text-sm font-semibold text-white/72"}
    >
      {panel ? <span data-admin-form-label-text>{label}</span> : premium ? <AdminFormControlHeader title={label} icon={icon} presentation="leading-icon" /> : label}
      {textarea ? (
        <textarea
          id={id}
          name={name}
          {...valueProps}
          rows={4}
          dir={dir}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={premium ? adminFormTextareaClassName("resize-y leading-7") : `${fieldClass} resize-y leading-7`}
        />
      ) : (
        <input
          id={id}
          name={name}
          {...valueProps}
          dir={dir}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={premium ? adminFormFieldClassName() : fieldClass}
        />
      )}
      <span
        id={assessment ? lengthFeedbackId : undefined}
        aria-live={assessment ? "polite" : undefined}
        aria-atomic={assessment ? "true" : undefined}
        className={`mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white/42 ${panel ? ADMIN_FORM.helperTextInset : ""}`.trim()}
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
          {assessment?.count ?? countSeoTextCharacters(liveValue)} حرف
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
  presentation = "default",
}: {
  issue: SeoIssue;
  target?: AdminEntitySeoCorrectionTarget;
  navigationEventName: string;
  presentation?: "default" | "premium";
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
      <div className={presentation === "premium" ? "flex flex-wrap items-start justify-between gap-3" : "flex items-start justify-between gap-3"}>
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
          : correctionButton(navigationEventName, target, presentation)}
      </div>
    </div>
  );
}

export default function AdminEntitySeoPanel<TAnalysisState = undefined>({
  presentation = "default",
  id = "admin-entity-seo-panel",
  entityLabel,
  publicPathPrefix,
  slugPlaceholder,
  navigationEventName,
  sourceFieldNames,
  fieldNames,
  fieldIds,
  social,
  seoSettings,
  previewDescription,
  seoTitleSuffix = "",
  resolvedFallback,
  initial,
  correctionTargets,
  controlledValues,
  onControlledValueChange,
  analysisExtension,
}: AdminEntitySeoPanelProps<TAnalysisState>) {
  const panel = presentation === "panel";
  const premium = presentation === "premium" || panel;
  const [publicDescription, setPublicDescription] = useState(previewDescription?.value);
  const initialSeoTitleSegment = stripSeoTitleSuffix(
    initial.seoTitle,
    seoTitleSuffix,
  );
  const [observedLive, setObservedLive] = useState<LiveSeoState>(() => ({
    ...initial,
    seoTitle: initialSeoTitleSegment,
  }));
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
      if (previewDescription) setPublicDescription(readValue(form, previewDescription.fieldName, previewDescription.value));
      setObservedLive({
        profile: initial.profile,
        title: readValue(form, sourceFieldNames.title, initial.title),
        description: readValue(
          form,
          sourceFieldNames.description,
          initial.description,
        ),
        content: readValue(form, sourceFieldNames.content, initial.content),
        slug: readValue(form, sourceFieldNames.slug, initial.slug),
        image: readValue(form, sourceFieldNames.image, initial.image),
        imageAlt: readValue(form, sourceFieldNames.imageAlt, initial.imageAlt),
        seoTitle: readValue(form, fieldNames.seoTitle, initialSeoTitleSegment),
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
        ogImage: readValue(form, fieldNames.ogImage, initial.ogImage),
        ogImageAlt: readValue(form, fieldNames.ogImageAlt, initial.ogImageAlt),
        faq: initial.faq,
      });
      if (analysisExtension) {
        setAnalysisState(
          analysisExtension.readState(form, analysisExtension.initialState),
        );
      }
    };

    // Observe after React's root listener has committed controlled field edits.
    // A form-level render can restore the old value before onChange receives it.
    const observe = (event: Event) => {
      if (event.target instanceof Node && form.contains(event.target)) read();
    };
    read();
    form.ownerDocument.addEventListener("input", observe);
    form.ownerDocument.addEventListener("change", observe);
    return () => {
      form.ownerDocument.removeEventListener("input", observe);
      form.ownerDocument.removeEventListener("change", observe);
    };
  }, [analysisExtension, fieldNames, id, initial, initialSeoTitleSegment, social, sourceFieldNames, previewDescription]);

  const live = useMemo(
    () =>
      controlledValues
        ? { ...observedLive, ...controlledValues }
        : observedLive,
    [controlledValues, observedLive],
  );

  const hasLocalSeo = hasEntitySeoData({
    title: live.seoTitle,
    description: live.seoDescription,
    focusKeyword: live.focusKeyword,
    keywords: live.seoKeywords,
    canonical: live.canonicalUrl,
    robotsIndex: live.robotsIndex,
    robotsFollow: live.robotsFollow,
    ogImage: live.ogImage,
    ogImageAlt: live.ogImageAlt,
  });
  const analysisInput = useMemo<SeoScoreInput>(
    () => resolveEntitySeoScoreInput({
      profile: live.profile,
      title: live.title,
      description: live.description,
      content: live.content,
      slug: live.slug,
      image: live.image,
      imageAlt: live.imageAlt,
      ogImage: live.ogImage,
      ogImageAlt: live.ogImageAlt,
      seoTitle: live.seoTitle,
      seoDescription: live.seoDescription,
      seoKeywords: live.seoKeywords,
      focusKeyword: live.focusKeyword,
      faq: analysisExtension
        ? analysisExtension.resolveFaq(analysisState)
        : live.faq,
    }, { seoTitleSuffix, resolvedFallback, hasLocalSeo }),
    [
      analysisExtension,
      analysisState,
      hasLocalSeo,
      live,
      resolvedFallback,
      seoTitleSuffix,
    ],
  );
  const effectiveSeoTitle = analysisInput.seoTitle;
  const analysis = useMemo(
    () => analyzeEntitySeo(analysisInput),
    [analysisInput],
  );
  const previewImage =
    live.ogImage.trim() || live.image.trim() || resolvedFallback?.image || "";
  const previewImageAlt = live.ogImage.trim()
    ? live.ogImageAlt.trim()
    : live.imageAlt.trim() || resolvedFallback?.imageAlt || "";
  const publicPath = `${publicPathPrefix}/${live.slug.trim() || slugPlaceholder}`;
  const settings = seoSettings ?? getGlobalSeoDefaults();
  const previewSuffix = getSeoTitleSuffix(settings);
  const resolvedPreview = resolveSeoMetadata({
    path: publicPath,
    entitySeo: {
      title: live.seoTitle, description: live.seoDescription,
      keywords: live.seoKeywords, focusKeyword: live.focusKeyword,
      canonical: live.canonicalUrl, robotsIndex: live.robotsIndex, robotsFollow: live.robotsFollow,
      ogImage: live.ogImage, ogImageAlt: live.ogImageAlt,
      image: live.image, imageAlt: live.imageAlt,
    },
    // Core Pages own route fallbacks; entity details own their authored source copy.
    ...(publicPathPrefix
      ? { title: live.seoTitle || live.title, description: live.seoDescription || (publicDescription !== undefined ? stripHtml(publicDescription) : live.description) }
      : getSeoRoute(publicPath) ? {} : { title: live.title }),
  }, settings);
  const { title, description } = presentSeoText(resolvedPreview);
  const canonical = resolvedPreview.canonical;

  const seoTitleField = (
    <SeoTextField
      id={fieldIds.seoTitle}
      name={fieldNames.seoTitle}
      label={
        previewSuffix
          ? "عنوان صفحة محركات البحث (بدون اسم الموقع)"
          : ADMIN_ENTITY_SEO_TERMINOLOGY.seoTitle
      }
      defaultValue={initialSeoTitleSegment}
      value={controlledValues?.seoTitle}
      onValueChange={(value) =>
        onControlledValueChange?.("seoTitle", value)
      }
      liveValue={effectiveSeoTitle}
      standard={SEO_LENGTH_STANDARDS.title}
      presentation={presentation}
      icon={<AdminModuleTabIcon name="seo" />}
    />
  );
  const seoTitleTemplate = previewSuffix ? (
      <p className={`-mt-3 text-xs leading-6 text-white/42 ${panel ? ADMIN_FORM.helperTextInset : ""}`.trim()} data-admin-seo-title-template>
        يُضاف تلقائيًا: <span dir="auto" className="text-white/60">{previewSuffix}</span>
      </p>
    ) : null;
  const seoDescriptionField = (
    <SeoTextField
      id={fieldIds.seoDescription}
      name={fieldNames.seoDescription}
      label={ADMIN_ENTITY_SEO_TERMINOLOGY.seoDescription}
      defaultValue={initial.seoDescription}
      value={controlledValues?.seoDescription}
      onValueChange={(value) =>
        onControlledValueChange?.("seoDescription", value)
      }
      liveValue={live.seoDescription}
      textarea
      standard={SEO_LENGTH_STANDARDS.description}
      presentation={presentation}
      icon={<AdminModuleTabIcon name="content" />}
    />
  );
  const focusKeywordField = (
    <SeoTextField
      id={fieldIds.focusKeyword}
      name={fieldNames.focusKeyword}
      label={ADMIN_ENTITY_SEO_TERMINOLOGY.focusKeyword}
      defaultValue={initial.focusKeyword}
      value={controlledValues?.focusKeyword}
      onValueChange={(value) =>
        onControlledValueChange?.("focusKeyword", value)
      }
      liveValue={live.focusKeyword}
      helper={ADMIN_ENTITY_SEO_TERMINOLOGY.focusKeywordHelper}
      presentation={presentation}
      icon={<AdminModuleTabIcon name="seo" />}
    />
  );
  const seoKeywordsField = (
    <div id={fieldIds.seoKeywords} className="scroll-mt-28">
      <AdminTagsField
        name={fieldNames.seoKeywords}
        label={ADMIN_ENTITY_SEO_TERMINOLOGY.seoKeywords}
        defaultTags={initial.seoKeywords}
        appearance="dark"
        className={panel ? "min-w-0" : undefined}
        labelClassName={panel ? adminFormLabelClassName({ textInset: true }) : undefined}
        helperClassName={panel ? `mt-2 ${adminFormHintClassName({ textInset: true })}` : undefined}
      />
      <AdminFormError name={fieldNames.seoKeywords} />
    </div>
  );
  const seoBasicsGrid = (
    <AdminFormGrid columns={1}>
      <AdminFormSection surface="neutral">
        <div className="space-y-5">{seoTitleField}{seoTitleTemplate}</div>
      </AdminFormSection>
      <AdminFormSection surface="neutral">{seoDescriptionField}</AdminFormSection>
      <AdminFormSection surface="neutral">{focusKeywordField}</AdminFormSection>
      <AdminFormSection surface="neutral">{seoKeywordsField}</AdminFormSection>
    </AdminFormGrid>
  );
  const seoBasicsContent = panel ? (
    <section data-admin-entity-seo-basics>
      <AdminCard presentation="premium" className="p-3">
        <AdminModuleSectionHeader
          id={`${id}-basics`}
          sectionHeading="أساسيات تحسين محركات البحث"
          icon="seo"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
        {seoBasicsGrid}
      </AdminCard>
    </section>
  ) : premium ? (
    <section data-admin-entity-seo-basics>
      <AdminFormGrid columns={1}>
        <AdminCard presentation="premium" className="p-3">
          <div className="space-y-5">{seoTitleField}{seoTitleTemplate}</div>
        </AdminCard>
        <AdminCard presentation="premium" className="p-3">{seoDescriptionField}</AdminCard>
        <AdminCard presentation="premium" className="p-3">{focusKeywordField}</AdminCard>
        <AdminCard presentation="premium" className="p-3">{seoKeywordsField}</AdminCard>
      </AdminFormGrid>
    </section>
  ) : (
    <section
      className="rounded-2xl border border-white/10 bg-black/20 p-5"
      data-admin-entity-seo-basics
    >
      <div className="space-y-5">
        {seoTitleField}
        {seoTitleTemplate}
        {seoDescriptionField}
        {focusKeywordField}
        {seoKeywordsField}
      </div>
    </section>
  );

  const robotsIndexField = (
    <AdminFormListboxSelect
      id={fieldIds.robotsIndexListbox}
      focusTargetId={fieldIds.robotsIndexFocusTarget}
      name={fieldNames.robotsIndex}
      label={panel ? <span className={adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>الفهرسة</span></span> : "الفهرسة"}
      options={robotsIndexOptions}
      defaultValue={
        initial.robotsIndex === null ? "" : String(initial.robotsIndex)
      }
      placeholder="الإعداد العام"
      sizing={premium ? "full" : "wide"}
    />
  );
  const robotsFollowField = (
    <AdminFormListboxSelect
      id={fieldIds.robotsFollowListbox}
      focusTargetId={fieldIds.robotsFollowFocusTarget}
      name={fieldNames.robotsFollow}
      label={panel ? <span className={adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>تتبع الروابط</span></span> : "تتبع الروابط"}
      options={robotsFollowOptions}
      defaultValue={
        initial.robotsFollow === null ? "" : String(initial.robotsFollow)
      }
      placeholder="الإعداد العام"
      sizing={premium ? "full" : "wide"}
    />
  );
  const canonicalField = (
    <SeoTextField
      id={fieldIds.canonicalUrl}
      name={fieldNames.canonicalUrl}
      label={ADMIN_ENTITY_SEO_TERMINOLOGY.canonicalUrl}
      defaultValue={initial.canonicalUrl}
      liveValue={live.canonicalUrl}
      helper={`اتركه فارغًا لاستخدام رابط ${entityLabel} العام تلقائيًا.`}
      dir="ltr"
      presentation={presentation}
      icon={<AdminModuleTabIcon name="settings" />}
    />
  );
  const robotsCanonicalContent = panel ? (
    <section id={fieldIds.robotsSection} className="scroll-mt-28" data-admin-entity-seo-overrides>
      <div data-admin-seo-control-order="index-follow-canonical">
        <AdminFormGrid columns={1}>
          <section>
            <AdminCard presentation="premium" className="p-3">
              <AdminFormGrid columns={2}>
                {robotsIndexField}
                {robotsFollowField}
              </AdminFormGrid>
            </AdminCard>
          </section>
          <AdminCard presentation="premium" className="p-3">
            {canonicalField}
          </AdminCard>
        </AdminFormGrid>
      </div>
    </section>
  ) : premium ? (
    <section id={fieldIds.robotsSection} className="scroll-mt-28" data-admin-entity-seo-overrides>
      <div data-admin-seo-control-order="index-follow-canonical">
        <AdminFormGrid columns={1}>
          <section>
            <AdminModuleSectionHeader
              id={fieldIds.robotsSection}
              sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.robots}
              icon="settings"
            />
            <AdminCard presentation="premium" className="p-3">
              <AdminFormGrid columns={2}>
                {robotsIndexField}
                {robotsFollowField}
              </AdminFormGrid>
            </AdminCard>
          </section>
          <AdminCard presentation="premium" className="p-3">{canonicalField}</AdminCard>
        </AdminFormGrid>
      </div>
    </section>
  ) : (
    <section
      id={fieldIds.robotsSection}
      className="scroll-mt-28 rounded-2xl border border-white/10 bg-black/20 p-5"
      data-admin-entity-seo-overrides
    >
      <h3 className="text-base font-semibold text-white">
        {ADMIN_ENTITY_SEO_TERMINOLOGY.robots}
      </h3>
      <p className="mt-2 text-sm leading-7 text-white/42">
        القيم العامة تظل المصدر الافتراضي، ويمكن تخصيص إعدادات {entityLabel} فقط عند
        الحاجة.
      </p>
      <div
        className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,.7fr)_minmax(180px,.7fr)_minmax(0,1.6fr)] lg:items-start"
        data-admin-seo-control-order="index-follow-canonical"
      >
        {robotsIndexField}
        {robotsFollowField}
        {canonicalField}
      </div>
    </section>
  );

  const socialImageField = (
    <AdminMediaImageField
      name={fieldNames.ogImage}
      label="صورة المشاركة"
      defaultValue={initial.ogImage}
      browseFolder={social.mediaBrowseFolder}
      appearance="dark"
      variant={premium ? "card" : undefined}
      labelClassName={panel ? adminFormLabelClassName({ textInset: true }) : undefined}
      guidanceClassName={panel ? adminFormHintClassName({ textInset: true }) : undefined}
      originalDimensionsClassName={panel ? ADMIN_FORM.helperTextInset : undefined}
      onValueChange={(ogImage) =>
        setObservedLive((current) => ({ ...current, ogImage }))
      }
    />
  );
  const socialImageAltField = (
    <label className={premium ? adminFormLabelClassName({ textInset: panel }) : "mt-4 block text-sm font-semibold text-white/72"}>
      {panel ? <span data-admin-form-label-text>النص البديل لصورة المشاركة</span> : premium ? <AdminFormControlHeader title="النص البديل لصورة المشاركة" icon={<AdminModuleTabIcon name="content" />} presentation="leading-icon" /> : "النص البديل لصورة المشاركة"}
      <input
        id={social.fieldIds.imageAlt}
        name={fieldNames.ogImageAlt}
        defaultValue={initial.ogImageAlt}
        className={premium ? adminFormFieldClassName() : fieldClass}
      />
      <AdminFormError name={fieldNames.ogImageAlt} />
    </label>
  );
  const socialSharingFields = panel ? (
    <section data-admin-entity-seo-social-fields data-admin-entity-seo-social-mode="editable_override">
      <AdminCard presentation="premium" className="p-3">
        <AdminModuleSectionHeader
          id={social.fieldIds.imageSection}
          sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettings}
          icon="media"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
        <AdminFormGrid columns={12} presentation="equal-height-columns">
          <AdminFormGridItem span={8}>
            <AdminFormGrid columns={1}>
              {robotsCanonicalContent}
              <AdminFormSection surface="neutral">
                {socialImageAltField}
              </AdminFormSection>
            </AdminFormGrid>
          </AdminFormGridItem>
          <AdminFormGridItem span={4} className="grid grid-cols-1">
            <AdminCard presentation="premium" className="p-3">
              <AdminModuleSectionHeader
                id={`${social.fieldIds.imageSection}-media`}
                sectionHeading="صورة المشاركة"
                icon="media"
                sectionHeaderPresentation="premium"
                sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              />
              <div id={social.fieldIds.imageSection} className="scroll-mt-28">{socialImageField}</div>
            </AdminCard>
          </AdminFormGridItem>
        </AdminFormGrid>
      </AdminCard>
    </section>
  ) : premium ? (
    <section data-admin-entity-seo-social-fields data-admin-entity-seo-social-mode="editable_override">
      <AdminModuleSectionHeader
        id={social.fieldIds.imageSection}
        sectionHeading={ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettings}
        icon="media"
      />
      <AdminCard presentation="premium" className="p-3">
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          <div id={social.fieldIds.imageSection} className="scroll-mt-28">{socialImageField}</div>
          {socialImageAltField}
        </div>
      </AdminCard>
    </section>
  ) : (
    <section
      className="rounded-2xl border border-white/10 bg-black/20 p-5"
      data-admin-entity-seo-social-fields
      data-admin-entity-seo-social-mode="editable_override"
    >
      <h3 className="text-base font-semibold text-white">
        {ADMIN_ENTITY_SEO_TERMINOLOGY.socialSettings}
      </h3>
      <div id={social.fieldIds.imageSection} className="mt-5 scroll-mt-28">
        {socialImageField}
        {socialImageAltField}
      </div>
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
      {previewImage ? (
        <div
          className="aspect-[1.91/1] bg-cover bg-center"
          style={{ backgroundImage: `url(${previewImage})` }}
          role="img"
          aria-label={previewImageAlt || title}
        />
      ) : (
        <div className="aspect-[1.91/1] border-b border-white/10" aria-hidden="true" />
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
              presentation={premium ? "premium" : "default"}
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
      className={premium ? "min-w-0 space-y-5" : ADMIN_FORM_SECTION_CLASSES}
      data-admin-entity-seo-panel
      data-admin-entity-seo-presentation={premium ? presentation : undefined}
    >
      <AdminFormLayout
        className={premium ? "min-w-0 grid-cols-[minmax(0,1fr)] [&>div]:min-w-0" : undefined}
        aside={
          <AdminSingleOpenAccordion
            presentation={panel ? "panel" : undefined}
            ariaLabel={`معاينات وتحليل SEO الخاصة بـ${entityLabel}`}
            defaultOpenId="search-result-preview"
            navigationEventName={navigationEventName}
            items={[
              {
                id: "search-result-preview",
                icon: "overview",
                label: "معاينة نتائج البحث",
                description: panel ? undefined : "الشكل المتوقع للرابط داخل نتائج محركات البحث.",
                content: searchResultPreviewContent,
              },
              {
                id: "open-graph-preview",
                icon: "media",
                label: ADMIN_ENTITY_SEO_TERMINOLOGY.socialPreview,
                description:
                  panel ? undefined : ADMIN_ENTITY_SEO_TERMINOLOGY.socialPreviewDescription,
                content: openGraphPreviewContent,
              },
              {
                id: "live-seo-analysis",
                icon: "seo",
                label: "تحليل SEO المباشر",
                description: panel ? undefined : "الدرجة الإرشادية وملاحظات تحسين المحتوى.",
                content: liveSeoAnalysisContent,
              },
            ]}
          />
        }
        asideClassName={premium ? "min-w-0 xl:sticky xl:top-6 xl:self-start" : "xl:sticky xl:top-6 xl:self-start"}
      >
        {seoBasicsContent}
        {panel ? socialSharingFields : premium ? (
          <AdminFormGrid columns={2} className="items-start">
            {robotsCanonicalContent}
            {socialSharingFields}
          </AdminFormGrid>
        ) : (
          <>
            {robotsCanonicalContent}
            {socialSharingFields}
          </>
        )}
      </AdminFormLayout>
    </section>
  );
}
