"use client";

import { useEffect, useMemo, useState } from "react";

import {
  assessProjectEntryPayload,
  PROJECT_ENTRY_FIELD_TABS,
  PROJECT_ENTRY_FOCUS_TARGETS,
  PROJECT_ENTRY_NAVIGATION_EVENT,
  projectEntryPayloadFromFormData,
  type ProjectEntryPayload,
  type ProjectEntryValidationField,
} from "../../../lib/admin/projects/project-entry-contract";
import {
  getProjectPublishingReadiness,
  resolveProjectPublicationStatusForVisibility,
} from "../../../lib/admin/projects/project-publishing-capability";
import type {
  EntityReviewAnalysisCardDefinition,
  EntityReviewAnalysisGroup,
  EntityReviewCheck,
  EntityReviewSeverity,
} from "../../../lib/admin/review/entity-review-presentation";
import { formatAdminDateTime } from "../../../lib/content-dates";
import AdminEntityReviewPanel, {
  AdminEntityReviewDecisionCard,
} from "../review/AdminEntityReviewPanel";
import { AdminFormSwitch } from "../ui";

type ProjectPublishChecklistPanelProps = {
  formId: string;
  initial: ProjectEntryPayload;
};

const SEO_FIELDS = new Set([
  "seo_title",
  "seo_description",
  "focus_keyword",
  "seo_keywords",
  "canonical_url",
  "robots_index",
  "robots_follow",
  "og_image",
  "og_image_alt",
]);

const PROJECT_REVIEW_FIELD_LABELS: Partial<
  Record<ProjectEntryValidationField, string>
> = {
  type: "نوع المشروع",
  publication_status: "حالة النشر",
  arabic_name: "اسم المشروع بالعربية",
  english_name: "اسم المشروع بالإنجليزية",
  slug: "الرابط المختصر",
  general_description: "الوصف العام",
  short_description: "وصف الهيرو والبوكس الصغير",
  image: "صورة الكارت الخارجي",
  image_alt: "Alt لصورة الكارت الخارجي",
  hero_image: "صورة الهيرو",
  hero_image_alt: "Alt لصورة الهيرو",
  small_box_image: "صورة البوكس الصغير",
  small_box_image_alt: "Alt لصورة البوكس الصغير",
  overview_main_image: "الصورة الرئيسية للنظرة العامة",
  overview_main_image_alt: "Alt لصورة النظرة العامة",
  governorate_id: "تسلسل موقع المشروع",
  location_label: "العنوان التفصيلي",
  google_maps_url: "رابط خرائط جوجل",
  latitude: "خط العرض",
  longitude: "خط الطول",
  map_zoom: "مستوى تقريب الخريطة",
  location_point_label: "نقاط الموقع",
  feature_body: "مميزات المشروع",
  overview_title: "عنوان النظرة العامة",
  overview_body: "محتوى النظرة العامة",
  overview_video_url: "فيديو النظرة العامة",
  floor_plan_name: "المخططات",
  floor_plan_architectural_image_alt: "Alt للمخطط المعماري",
  floor_plan_furnishing_image_alt: "Alt لمخطط الفرش",
  floor_plan_detail_label: "تفاصيل المخططات",
  delivery_item_body: "بنود التسليم",
  delivery_title: "عنوان المواصفات والتسليم",
  delivery_body: "محتوى المواصفات والتسليم",
  overview_media_image: "صور وسائط النظرة العامة",
  overview_media_alt_text: "Alt لوسائط النظرة العامة",
  delivery_media_image: "صور وسائط التسليم",
  delivery_media_alt_text: "Alt لوسائط التسليم",
  gallery_media_image: "صور Gallery",
  gallery_media_alt_text: "Alt لصور Gallery",
  overview_video_poster_alt: "Alt لغلاف فيديو النظرة العامة",
  gallery_video_url: "روابط فيديو Gallery",
  gallery_video_poster_alt: "Alt لأغلفة فيديو Gallery",
  seo_title: "SEO Title",
  seo_description: "SEO Description",
  canonical_url: "Canonical URL",
  og_image_alt: "Alt لصورة المشاركة",
  id: "سلامة العناصر المحذوفة",
};

function reviewGroupForField(field: string): EntityReviewAnalysisGroup {
  if (SEO_FIELDS.has(field)) return "seo";
  if (/(image|media|video|poster)/.test(field)) return "image";
  return "content";
}

function reviewSeverity(status: EntityReviewCheck["status"]): EntityReviewSeverity {
  if (status === "pass") return "success";
  if (status === "fail") return "error";
  if (status === "warn") return "warning";
  return "info";
}

function buildSnapshot(payload: ProjectEntryPayload) {
  const validation = assessProjectEntryPayload(payload);
  return {
    payload,
    validation,
    readiness: getProjectPublishingReadiness({
      validationChecks: validation.checks,
      seoTitle: payload.project.seo_title,
      seoDescription: payload.project.seo_description,
    }),
  };
}

function projectReviewChecks(
  snapshot: ReturnType<typeof buildSnapshot>,
): EntityReviewCheck[] {
  return snapshot.readiness.checks.map((check) => {
    const group = reviewGroupForField(check.field);
    const tabId = PROJECT_ENTRY_FIELD_TABS[check.field];
    return {
      id: check.id,
      label:
        PROJECT_REVIEW_FIELD_LABELS[
          check.field as ProjectEntryValidationField
        ] ??
        (group === "seo"
          ? "سلامة إعدادات SEO"
          : group === "image"
            ? "سلامة الصور والوسائط"
            : "سلامة بيانات المشروع"),
      hint: check.message,
      status: check.status,
      severity: reviewSeverity(check.status),
      blocksPublish: check.blocksPublish,
      group,
      field: check.field,
      correctionTarget: tabId
        ? {
            tabId,
            targetId: PROJECT_ENTRY_FOCUS_TARGETS[check.field] ?? check.field,
          }
        : undefined,
    };
  });
}

const PROJECT_REVIEW_GUIDANCE_CARDS: readonly EntityReviewAnalysisCardDefinition[] = [
  {
    id: "content",
    title: "جاهزية المحتوى",
    description: "اكتمال بيانات المشروع وأقسامه ومحتواه التعريفي.",
    group: "content",
  },
  {
    id: "image",
    title: "جاهزية الصور وAlt",
    description: "سلامة صور Hero وGallery وMedia والنصوص البديلة المرتبطة بها.",
    group: "image",
  },
  {
    id: "seo",
    title: "تحليل SEO",
    description: "نفس بيانات SEO المشتركة المستخدمة في محرر المشروع.",
    group: "seo",
  },
] as const;

export default function ProjectPublishChecklistPanel({
  formId,
  initial,
}: ProjectPublishChecklistPanelProps) {
  const [snapshot, setSnapshot] = useState(() => buildSnapshot(initial));

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => {
      setSnapshot(buildSnapshot(projectEntryPayloadFromFormData(new FormData(form))));
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId]);

  const checks = useMemo(() => projectReviewChecks(snapshot), [snapshot]);
  const project = snapshot.payload.project;
  const hiddenStatus = resolveProjectPublicationStatusForVisibility(
    initial.project.publication_status,
    false,
  );
  const publicPath = project.slug ? `/projects/${project.slug}` : "—";

  return (
    <AdminEntityReviewPanel
      entityKey="project"
      navigationEventName={PROJECT_ENTRY_NAVIGATION_EVENT}
      checks={checks}
      guidanceCards={PROJECT_REVIEW_GUIDANCE_CARDS}
      decisionCards={
        <>
          <AdminEntityReviewDecisionCard
            id="publication-schedule"
            title="حالة النشر والتاريخ"
            description="حالة المشروع وبيانات أول ظهور عام."
          >
            <AdminFormSwitch
              id="project-publication-status"
              name="publication_status"
              value="published"
              uncheckedValue={hiddenStatus}
              defaultChecked={initial.project.publication_status === "published"}
              surface
              className="mt-3 border-white/8 bg-black/20 px-3 py-2.5"
              label={project.publication_status === "published" ? "منشور" : "غير منشور"}
              describedBy="project-publication-hint"
            />
            <dl className="mt-2">
              <ProjectDecision
                label="تاريخ أول نشر"
                value={formatAdminDateTime(initial.project.published_at)}
                ltr
              />
            </dl>
            <p
              id="project-publication-hint"
              className="mt-2 text-[10px] leading-5 text-white/38"
            >
              النشر يتطلب اكتمال كل المتطلبات الإلزامية.
            </p>
          </AdminEntityReviewDecisionCard>

          <AdminEntityReviewDecisionCard
            id="featured"
            title="التمييز"
            description="التمييز مستقل عن حالة النشر."
          >
            <AdminFormSwitch
              id="project-featured"
              name="featured"
              value="true"
              uncheckedValue="false"
              defaultChecked={initial.project.featured}
              surface
              className="mt-3 border-white/8 bg-black/20 px-3 py-2.5"
              label={project.featured ? "مشروع مميز" : "غير مميز"}
            />
          </AdminEntityReviewDecisionCard>

          <AdminEntityReviewDecisionCard
            id="public-display"
            title="معلومات العرض العام"
            description="المسار العام المثبت في عقد المشروع الحالي."
          >
            <dl className="mt-3">
              <ProjectDecision label="الرابط العام" value={publicPath} ltr />
            </dl>
          </AdminEntityReviewDecisionCard>
        </>
      }
      summaryEntries={[
        {
          id: "last-save",
          title: "آخر حفظ",
          value: formatAdminDateTime(initial.project.updated_at),
        },
        {
          id: "created-at",
          title: "تاريخ الإنشاء",
          value: formatAdminDateTime(initial.project.created_at),
        },
        {
          id: "project-type",
          title: "نوع المشروع",
          value: project.type === "residential" ? "سكني" : "تجاري",
        },
      ]}
    />
  );
}

function ProjectDecision({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
      <dt className="text-[10px] leading-4 text-white/42">{label}</dt>
      <dd
        className="mt-1 min-w-0 truncate text-xs font-semibold text-white/72"
        dir={ltr ? "ltr" : undefined}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
