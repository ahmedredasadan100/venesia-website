"use client";

import { AdminActionButton } from "../ui";

export default function AdminReportActions({ exportHref }: { exportHref: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden" aria-label="إجراءات التقرير">
      <AdminActionButton href={exportHref} variant="gold">
        تصدير CSV
      </AdminActionButton>
      <AdminActionButton onClick={() => window.print()} variant="dark">
        طباعة
      </AdminActionButton>
    </div>
  );
}
