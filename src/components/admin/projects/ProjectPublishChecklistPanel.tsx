"use client";

import { useEffect, useMemo, useState } from "react";

import {
  PROJECT_ENTRY_FIELD_TABS,
  PROJECT_ENTRY_FOCUS_TARGETS,
  PROJECT_ENTRY_NAVIGATION_EVENT,
  projectEntryPayloadFromFormData,
  validateProjectEntryPayload,
  type ProjectEntryPayload,
} from "../../../lib/admin/projects/project-entry-contract";
import {
  getProjectPublicationMetadata,
  getProjectPublishingReadiness,
  resolveProjectPublicationStatusForVisibility,
} from "../../../lib/admin/projects/project-publishing-capability";
import type {
  EntityReviewAnalysisCardDefinition,
  EntityReviewCheck,
} from "../../../lib/admin/review/entity-review-presentation";
import { formatAdminDateTime } from "../../../lib/content-dates";
import AdminEntityReviewPanel, {
  AdminEntityReviewDecisionCard,
} from "../review/AdminEntityReviewPanel";
import { AdminFormSwitch, AdminStatusPill } from "../ui";

type ProjectPublishChecklistPanelProps = {
  formId: string;
  initial: ProjectEntryPayload;
};

type ProjectReviewGroup = "content" | "image" | "seo";

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

function reviewGroupForField(field: string): ProjectReviewGroup {
  if (SEO_FIELDS.has(field)) return "seo";
  if (/(image|media|video|poster)/.test(field)) return "image";
  return "content";
}

function buildSnapshot(payload: ProjectEntryPayload) {
  return {
    payload,
    readiness: getProjectPublishingReadiness({
      fieldErrors: validateProjectEntryPayload(payload),
      seoTitle: payload.project.seo_title,
      seoDescription: payload.project.seo_description,
    }),
  };
}

function projectReviewChecks(
  snapshot: ReturnType<typeof buildSnapshot>,
): EntityReviewCheck[] {
  const blockerChecks = snapshot.readiness.blockers.map((blocker, index) => ({
    id: `project:${reviewGroupForField(blocker.field)}:blocker:${blocker.field}:${index}`,
    label: "متطلب نشر إلزامي",
    hint: blocker.message,
    status: "fail" as const,
    severity: "error" as const,
    blocksPublish: true,
    field: blocker.field,
    correctionTarget: {
      tabId: PROJECT_ENTRY_FIELD_TABS[blocker.field] ?? "basic",
      targetId: PROJECT_ENTRY_FOCUS_TARGETS[blocker.field] ?? blocker.field,
    },
  }));
  const warningChecks = snapshot.readiness.warnings.map((warning) => ({
    id: `project:seo:warning:${warning.code}`,
    label: "تحسين SEO موصى به",
    hint: warning.message,
    status: "warn" as const,
    severity: "warning" as const,
    blocksPublish: false,
    field: warning.field,
    correctionTarget: {
      tabId: PROJECT_ENTRY_FIELD_TABS[warning.field] ?? "seo",
      targetId: PROJECT_ENTRY_FOCUS_TARGETS[warning.field] ?? warning.field,
    },
  }));

  return [...blockerChecks, ...warningChecks];
}

function guidanceCards(
  checks: readonly EntityReviewCheck[],
): readonly EntityReviewAnalysisCardDefinition[] {
  const idsFor = (group: ProjectReviewGroup) =>
    checks
      .filter((check) => check.id.startsWith(`project:${group}:`))
      .map((check) => check.id);

  return [
    {
      id: "content",
      title: "جاهزية محتوى المشروع",
      description: "اكتمال بيانات المشروع وأقسامه ومحتواه التعريفي.",
      checkIds: idsFor("content"),
    },
    {
      id: "image",
      title: "جاهزية الصور وAlt وHero وGallery",
      description: "سلامة الصور والوسائط والنصوص البديلة المرتبطة بها.",
      checkIds: idsFor("image"),
    },
    {
      id: "seo",
      title: "تحليل SEO",
      description: "نفس بيانات SEO المشتركة المستخدمة في محرر المشروع.",
      checkIds: idsFor("seo"),
    },
  ];
}

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
  const cards = useMemo(() => guidanceCards(checks), [checks]);
  const project = snapshot.payload.project;
  const publication = getProjectPublicationMetadata(project.publication_status);
  const hiddenStatus = resolveProjectPublicationStatusForVisibility(
    initial.project.publication_status,
    false,
  );
  const publicPath = project.slug ? `/projects/${project.slug}` : "—";

  return (
    <AdminEntityReviewPanel
      entityKey="project"
      navigationEventName={PROJECT_ENTRY_NAVIGATION_EVENT}
      decisionTitle="حالة المشروع والعرض"
      checks={checks}
      guidanceCards={cards}
      decisionCards={
        <>
          <AdminEntityReviewDecisionCard
            id="publication-status"
            title="حالة النشر"
            description="تحكم في ظهور المشروع للعامة."
            badge={
              <AdminStatusPill tone={publication.tone}>
                {publication.label}
              </AdminStatusPill>
            }
          >
            <AdminFormSwitch
              id="project-publication-status"
              name="publication_status"
              value="published"
              uncheckedValue={hiddenStatus}
              defaultChecked={initial.project.publication_status === "published"}
              surface
              className="mt-3 border-white/8 bg-black/20 px-3 py-2.5"
              label={
                <span>
                  <strong className="block text-sm text-white/82">
                    {project.publication_status === "published" ? "منشور" : "غير منشور"}
                  </strong>
                  <span className="mt-1 block text-xs text-white/42">
                    النشر يتطلب اكتمال كل المتطلبات الإلزامية.
                  </span>
                </span>
              }
            />
          </AdminEntityReviewDecisionCard>

          <AdminEntityReviewDecisionCard
            id="publication-date"
            title="تاريخ النشر"
            description="بيانات أول نشر والرابط العام."
          >
            <dl className="mt-3 space-y-2">
              <ProjectDecision
                label="أول نشر"
                value={formatAdminDateTime(initial.project.published_at)}
                ltr
              />
              <ProjectDecision label="الرابط العام" value={publicPath} ltr />
            </dl>
          </AdminEntityReviewDecisionCard>

          <AdminEntityReviewDecisionCard
            id="featured"
            title="مميز"
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
        </>
      }
      validationDescription="يعرض متطلبات الحقول والقيم التي تمنع نشر المشروع فعليًا وفق Validation Truth الحالية."
      summaryEntries={[
        {
          id: "last-save",
          title: "آخر حفظ",
          value: formatAdminDateTime(initial.project.updated_at),
        },
        {
          id: "status",
          title: "حالة النشر الحالية",
          value: publication.label,
        },
        {
          id: "publish-date",
          title: "تاريخ أول نشر",
          value: formatAdminDateTime(initial.project.published_at),
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
