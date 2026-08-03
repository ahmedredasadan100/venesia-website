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
import { formatAdminDateTime } from "../../../lib/content-dates";
import PublishChecklist from "../content-workflow/PublishChecklist";
import type { PublishChecklistItem } from "../../../lib/admin/content-workflow/publish-checklist-types";
import { AdminFormSwitch, AdminStatusPill } from "../ui";

type ProjectPublishChecklistPanelProps = {
  formId: string;
  initial: ProjectEntryPayload;
};

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

function checklistItems(
  snapshot: ReturnType<typeof buildSnapshot>,
): PublishChecklistItem[] {
  const blockerItems: PublishChecklistItem[] = snapshot.readiness.blockers.map((blocker, index) => ({
    id: `${blocker.code}:${blocker.field}:${index}`,
    label: "متطلب نشر إلزامي",
    hint: blocker.message,
    status: "fail" as const,
    field: blocker.field,
    fixable: true,
  }));
  const warningItems: PublishChecklistItem[] = snapshot.readiness.warnings.map((warning) => ({
    id: warning.code,
    label: "تحسين موصى به",
    hint: warning.message,
    status: "warn" as const,
    field: warning.field,
    fixable: true,
  }));

  if (!blockerItems.length) {
    blockerItems.push({
      id: "PROJECT_PUBLISH_READY",
      label: "بيانات العرض العام مكتملة",
      hint: "لا توجد متطلبات إلزامية تمنع نشر المشروع.",
      status: "pass",
      field: "",
      fixable: false,
    });
  }

  return [...blockerItems, ...warningItems];
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

  const items = useMemo(() => checklistItems(snapshot), [snapshot]);
  const project = snapshot.payload.project;
  const publication = getProjectPublicationMetadata(project.publication_status);
  const hiddenStatus = resolveProjectPublicationStatusForVisibility(
    initial.project.publication_status,
    false,
  );
  const publicPath = project.slug ? `/projects/${project.slug}` : "—";

  function fixItem(item: PublishChecklistItem) {
    if (!item.field) return;
    window.dispatchEvent(
      new CustomEvent(PROJECT_ENTRY_NAVIGATION_EVENT, {
        detail: {
          tabId: PROJECT_ENTRY_FIELD_TABS[item.field] ?? "basic",
          targetId: PROJECT_ENTRY_FOCUS_TARGETS[item.field] ?? item.field,
        },
      }),
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
      <div className="space-y-4">
        <section className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#D8B87A]/65">
                حالة الظهور
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                النشر الحالي للمشروع
              </h3>
            </div>
            <AdminStatusPill tone={publication.tone}>
              {publication.label}
            </AdminStatusPill>
          </div>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex items-start justify-between gap-4 border-t border-white/8 pt-3">
              <dt className="text-white/45">الظهور العام</dt>
              <dd className="font-semibold text-white/75">{publication.publicLabel}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-white/8 pt-3">
              <dt className="text-white/45">تاريخ أول نشر</dt>
              <dd className="text-left font-en text-white/70" dir="ltr">
                {formatAdminDateTime(initial.project.published_at)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-white/8 pt-3">
              <dt className="text-white/45">الرابط العام</dt>
              <dd className="min-w-0 truncate text-left font-en text-[#D8B87A]/80" dir="ltr" title={publicPath}>
                {publicPath}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-white/8 pt-3">
              <dt className="text-white/45">الحالة المميزة</dt>
              <dd className="font-semibold text-white/75">
                {project.featured ? "مميز" : "غير مميز"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/92 p-5">
          <h3 className="text-lg font-semibold text-white">خيارات الظهور</h3>
          <p className="mt-1 text-sm leading-6 text-white/45">
            تُحفظ الحالة والتمييز مع Project Aggregate من زر الحفظ نفسه.
          </p>
          <div className="mt-4 space-y-3">
            <AdminFormSwitch
              id="project-publication-status"
              name="publication_status"
              value="published"
              uncheckedValue={hiddenStatus}
              defaultChecked={initial.project.publication_status === "published"}
              surface
              label={
                <span>
                  <strong className="block text-sm text-white/82">إظهار المشروع للعامة</strong>
                  <span className="mt-1 block text-xs text-white/42">
                    النشر يتطلب اكتمال كل المتطلبات الإلزامية أدناه.
                  </span>
                </span>
              }
            />
            <AdminFormSwitch
              id="project-featured"
              name="featured"
              value="true"
              uncheckedValue="false"
              defaultChecked={initial.project.featured}
              surface
              label={
                <span>
                  <strong className="block text-sm text-white/82">مشروع مميز</strong>
                  <span className="mt-1 block text-xs text-white/42">
                    التمييز مستقل، ولا يسبب ظهور المشروع ما لم يكن منشورًا.
                  </span>
                </span>
              }
            />
          </div>
        </section>
      </div>

      <PublishChecklist
        title="مراجعة جاهزية المشروع للنشر"
        items={items}
        onFixItem={fixItem}
      />
    </div>
  );
}
