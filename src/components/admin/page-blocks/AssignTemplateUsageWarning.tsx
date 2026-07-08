"use client";

import { useEffect, useState } from "react";

import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import type { ModuleAssignmentRow } from "../../../lib/page-blocks/module-assignments-query";

type AssignTemplateUsageWarningProps = {
  moduleKind: string;
  templateId: number | null;
  currentPageId: number;
};

export default function AssignTemplateUsageWarning({
  moduleKind,
  templateId,
  currentPageId,
}: AssignTemplateUsageWarningProps) {
  if (!templateId) return null;

  return (
    <AssignTemplateUsageWarningContent
      key={`${moduleKind}-${templateId}-${currentPageId}`}
      moduleKind={moduleKind}
      templateId={templateId}
      currentPageId={currentPageId}
    />
  );
}

function AssignTemplateUsageWarningContent({
  moduleKind,
  templateId,
  currentPageId,
}: {
  moduleKind: string;
  templateId: number;
  currentPageId: number;
}) {
  const [assignments, setAssignments] = useState<ModuleAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/page-blocks/module-usage?kind=${encodeURIComponent(moduleKind)}&templateId=${templateId}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          assignments?: ModuleAssignmentRow[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "تعذر التحقق من الاستخدام.");
        return payload.assignments ?? [];
      })
      .then((rows) => {
        if (!cancelled) setAssignments(rows.filter((row) => row.page_id !== currentPageId));
      })
      .catch(() => {
        if (!cancelled) setAssignments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleKind, templateId, currentPageId]);

  if (loading) return <p className="text-sm text-white/45">جاري فحص استخدام الموديول على صفحات أخرى…</p>;
  if (!assignments.length) {
    return (
      <p className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
        لا يوجد استخدام آخر لهذا الموديول على صفحات مختلفة.
      </p>
    );
  }

  return (
    <ModuleCrossPageUsageBanner
      moduleName={`موديول #${templateId}`}
      assignments={assignments}
    />
  );
}
