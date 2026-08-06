"use client";

import Link from "next/link";

import type { ModuleAssignmentRow } from "../../../lib/page-blocks/module-assignments-query";
import { LAYOUT_SLOT_LABELS_AR, normalizeLayoutSlot } from "../../../lib/page-blocks/layout-slots";

type ModuleCrossPageUsageBannerProps = {
  moduleName: string;
  assignments: ModuleAssignmentRow[];
};

export default function ModuleCrossPageUsageBanner({
  moduleName,
  assignments,
}: ModuleCrossPageUsageBannerProps) {
  if (assignments.length <= 1) return null;

  return (
    <div className="rounded-[20px] border border-amber-400/20 bg-amber-500/8 px-4 py-4">
      <p className="text-sm font-semibold text-amber-100">تنبيه: موديول مشترك بين عدة صفحات</p>
      <p className="mt-2 text-sm leading-7 text-amber-100/80">
        «{moduleName}» مستخدم في <strong>{assignments.length}</strong> صفحات. أي تعديل على المحتوى سيظهر في
        كل الصفحات المرتبطة — للقراءة والتنبيه فقط.
      </p>
      <ul className="mt-3 space-y-2">
        {assignments.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-amber-400/10 bg-black/20 px-3 py-2 text-sm"
          >
            <span>
              {row.page_title}
              <span className="mr-2 font-mono text-xs text-white/35" dir="ltr">
                {row.page_path}
              </span>
            </span>
            <div className="flex items-center gap-2 text-xs text-white/45">
              <span>{LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)]}</span>
              <Link
                href={`/admin/pages-blocks/pages/${row.page_id}`}
                className="rounded-full border border-amber-300/25 px-2.5 py-1 text-amber-100 hover:bg-amber-400/10"
              >
                مدير الصفحة
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
