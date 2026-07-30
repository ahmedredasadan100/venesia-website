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
import { ADMIN_FORM_SECTION_CLASSES } from "../ui/AdminForm";
import AdminFormListboxSelect from "../ui/AdminFormListboxSelect";
import { AdminFormError } from "../ui/AdminFormRuntime";

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
  ogImageSection: string;
  ogImageAlt: string;
};

export type AdminEntitySeoPanelProps = {
  id?: string;
  entityLabel: string;
  publicPathPrefix: string;
  slugPlaceholder: string;
  mediaBrowseFolder: string;
  navigationEventName: string;
  sourceFieldNames: {
    title: string;
    description: string;
    content: string;
    slug: string;
  };
  fieldNames: AdminEntitySeoFieldNames;
  fieldIds: AdminEntitySeoFieldIds;
  initial: EntitySeoScoreInput & {
    canonicalUrl: string;
    robotsIndex: boolean | null;
    robotsFollow: boolean | null;
  };
  correctionTargets: Partial<Record<string, AdminEntitySeoCorrectionTarget>>;
};

type LiveSeoState = AdminEntitySeoPanelProps["initial"];

const fieldClass =
  "mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 hover:border-white/18 focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/15";

const robotsIndexOptions = [
  { value: "", label: "الإعداد العام" },
  { value: "true", label: "السماح بالفهرسة" },
  { value: "false", label: "منع الفهرسة" },
] as const;

const robotsFollowOptions = [
  { value: "", label: "الإعداد العام" },
  { value: "true", label: "السماح بتتبع الروابط" },
  { value: "false", label: "منع تتبع الروابط" },
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

function correctionButton(
  navigationEventName: string,
  target: AdminEntitySeoCorrectionTarget | undefined,
) {
  if (!target) return null;
  return (
    <button
      type="button"
      className="shrink-0 rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-2.5 py-1.5 text-xs font-semibold text-[#F2D99B] transition hover:border-[#D8B87A]/55 hover:bg-[#D8B87A]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70"
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
  textarea = false,
  dir = "rtl",
  standard,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  liveValue: string;
  textarea?: boolean;
  dir?: "rtl" | "ltr";
  standard?: SeoLengthStandard;
}) {
  const assessment = standard ? assessSeoLength(liveValue, standard) : null;
  return (
    <label htmlFor={id} className="block scroll-mt-28 text-sm font-semibold text-white/72">
      {label}
      {textarea ? (
        <textarea
          id={id}
          name={name}
          defaultValue={defaultValue}
          rows={4}
          dir={dir}
          className={`${fieldClass} resize-y leading-7`}
        />
      ) : (
        <input
          id={id}
          name={name}
          defaultValue={defaultValue}
          dir={dir}
          className={fieldClass}
        />
      )}
      <span className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white/42">
        <span>{assessment ? getSeoLengthStateLabel(assessment.state) : "قيمة اختيارية قابلة للتخصيص."}</span>
        <span
          className={assessment?.state === "success" ? "text-emerald-300" : assessment?.state === "danger" ? "text-red-300" : "text-[#D8B87A]"}
          data-seo-length-state={assessment?.state}
        >
          {liveValue.length} حرف{assessment ? ` — المدى ${formatSeoLengthRange(assessment)}` : ""}
        </span>
      </span>
      <AdminFormError name={name} />
    </label>
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
      ? "border-emerald-400/20 bg-emerald-400/[0.07]"
      : issue.type === "error"
        ? "border-red-400/20 bg-red-400/[0.07]"
        : "border-[#D8B87A]/20 bg-[#D8B87A]/[0.07]";
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/82">
            {issue.type === "success" ? "✓" : issue.type === "error" ? "×" : "!"} {issue.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/48">{issue.hint}</p>
        </div>
        {issue.type === "success"
          ? null
          : correctionButton(navigationEventName, target)}
      </div>
    </div>
  );
}

export default function AdminEntitySeoPanel({
  id = "admin-entity-seo-panel",
  entityLabel,
  publicPathPrefix,
  slugPlaceholder,
  mediaBrowseFolder,
  navigationEventName,
  sourceFieldNames,
  fieldNames,
  fieldIds,
  initial,
  correctionTargets,
}: AdminEntitySeoPanelProps) {
  const [live, setLive] = useState<LiveSeoState>(initial);

  useEffect(() => {
    const root = document.getElementById(id);
    const form = root?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    const read = () => {
      setLive({
        title: readValue(form, sourceFieldNames.title, initial.title),
        description: readValue(
          form,
          sourceFieldNames.description,
          initial.description,
        ),
        content: readValue(form, sourceFieldNames.content, initial.content),
        slug: readValue(form, sourceFieldNames.slug, initial.slug),
        image: readValue(form, fieldNames.ogImage, initial.image),
        imageAlt: readValue(form, fieldNames.ogImageAlt, initial.imageAlt),
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
    };

    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [fieldNames, id, initial, sourceFieldNames]);

  const analysis = useMemo(() => analyzeEntitySeo(live), [live]);
  const title = live.seoTitle.trim() || live.title.trim() || `عنوان ${entityLabel}`;
  const description =
    live.seoDescription.trim() ||
    live.description.trim() ||
    `سيظهر وصف ${entityLabel} هنا بعد إدخاله.`;
  const publicPath = `${publicPathPrefix}/${live.slug.trim() || slugPlaceholder}`;
  const canonical = live.canonicalUrl.trim() || publicPath;

  return (
    <section id={id} className={ADMIN_FORM_SECTION_CLASSES} data-admin-entity-seo-panel>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.85fr)] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-[24px] border border-white/10 bg-[#05070B]/70 p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white">البيانات الأساسية لتحسين محركات البحث</h3>
              <p className="mt-1 text-sm leading-6 text-white/45">خصص عنوان ووصف وكلمات {entityLabel} مع إبقاء التحليل ضمن نظام تحسين محركات البحث المشترك.</p>
            </div>
            <div className="space-y-4">
              <SeoTextField id={fieldIds.seoTitle} name={fieldNames.seoTitle} label="عنوان صفحة محركات البحث" defaultValue={initial.seoTitle} liveValue={live.seoTitle} standard={SEO_LENGTH_STANDARDS.title} />
              <SeoTextField id={fieldIds.seoDescription} name={fieldNames.seoDescription} label="الوصف التعريفي" defaultValue={initial.seoDescription} liveValue={live.seoDescription} textarea standard={SEO_LENGTH_STANDARDS.description} />
              <SeoTextField id={fieldIds.focusKeyword} name={fieldNames.focusKeyword} label="الكلمة المفتاحية الرئيسية" defaultValue={initial.focusKeyword} liveValue={live.focusKeyword} />
              <div id={fieldIds.seoKeywords} className="scroll-mt-28">
                <AdminTagsField name={fieldNames.seoKeywords} label="الكلمات المفتاحية الداعمة" defaultTags={initial.seoKeywords} appearance="dark" />
                <AdminFormError name={fieldNames.seoKeywords} />
              </div>
              <SeoTextField id={fieldIds.canonicalUrl} name={fieldNames.canonicalUrl} label="الرابط الأساسي" defaultValue={initial.canonicalUrl} liveValue={live.canonicalUrl} dir="ltr" />
              <div id={fieldIds.robotsSection} className="grid scroll-mt-28 gap-3 sm:grid-cols-2">
                <AdminFormListboxSelect
                  id={fieldIds.robotsIndexListbox}
                  focusTargetId={fieldIds.robotsIndexFocusTarget}
                  name={fieldNames.robotsIndex}
                  label="الفهرسة"
                  options={robotsIndexOptions}
                  defaultValue={initial.robotsIndex === null ? "" : String(initial.robotsIndex)}
                  placeholder="الإعداد العام"
                />
                <AdminFormListboxSelect
                  id={fieldIds.robotsFollowListbox}
                  focusTargetId={fieldIds.robotsFollowFocusTarget}
                  name={fieldNames.robotsFollow}
                  label="تتبع الروابط"
                  options={robotsFollowOptions}
                  defaultValue={initial.robotsFollow === null ? "" : String(initial.robotsFollow)}
                  placeholder="الإعداد العام"
                />
              </div>
            </div>
          </section>

          <section id={fieldIds.ogImageSection} className="scroll-mt-28 rounded-[24px] border border-white/10 bg-[#05070B]/70 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-bold text-white">صورة المشاركة</h3>
            <AdminMediaImageField name={fieldNames.ogImage} label="صورة المشاركة" defaultValue={initial.image} dimensionHint="content" browseFolder={mediaBrowseFolder} appearance="dark" onValueChange={(image) => setLive((current) => ({ ...current, image }))} />
            <label className="mt-4 block text-sm font-semibold text-white/72">النص البديل للصورة
              <input id={fieldIds.ogImageAlt} name={fieldNames.ogImageAlt} defaultValue={initial.imageAlt} className={fieldClass} />
              <AdminFormError name={fieldNames.ogImageAlt} />
            </label>
          </section>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-5">
          <section className="rounded-[24px] border border-white/10 bg-[#05070B]/70 p-4 sm:p-5">
            <h3 className="text-base font-bold text-white">معاينة نتيجة البحث</h3>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/28 p-4">
              <p className="break-all font-mono text-xs text-emerald-300" dir="ltr">{canonical}</p>
              <p className="mt-2 text-lg font-semibold leading-7 text-[#8AB4F8]">{title}</p>
              <p className="mt-1 text-sm leading-6 text-white/58">{description}</p>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-[#05070B]/70 p-4 sm:p-5">
            <h3 className="text-base font-bold text-white">معاينة المشاركة</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/28">
              {live.image ? (
                <div className="aspect-[1.91/1] bg-cover bg-center" style={{ backgroundImage: `url(${live.image})` }} role="img" aria-label={live.imageAlt || title} />
              ) : (
                <div className="grid aspect-[1.91/1] place-items-center bg-[#05070B] text-xs text-white/35">لا توجد صورة مشاركة</div>
              )}
              <div className="p-3"><p className="font-semibold text-white/82">{title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{description}</p></div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-[#05070B]/70 p-4 sm:p-5" data-admin-entity-seo-analysis>
            <div className="flex items-center justify-between gap-4">
              <div><h3 className="text-base font-bold text-white">تحليل تحسين محركات البحث المباشر</h3><p className="mt-1 text-xs text-white/45">{analysis.label} — كثافة الكلمة {analysis.keywordDensity}%</p></div>
              <div className="grid size-20 shrink-0 place-items-center rounded-full border-[7px] border-emerald-400 bg-emerald-400/10 text-xl font-bold text-emerald-200">{analysis.overallScore}</div>
            </div>
            <div className="mt-4 space-y-2">
              {analysis.issues.map((issue) => (
                <IssueRow key={issue.id ?? issue.label} issue={issue} target={issue.id ? correctionTargets[issue.id] : undefined} navigationEventName={navigationEventName} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
