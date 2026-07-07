"use client";

import { useMemo } from "react";

import type { PublishChecklistItem, PublishChecklistStatus } from "../../../lib/admin/content-workflow/publish-checklist-types";
import { countChecklistStatus, isPublishChecklistReady } from "../../../lib/admin/content-workflow/publish-checklist-types";

type PublishChecklistProps = {
  title?: string;
  items: PublishChecklistItem[];
  compact?: boolean;
};

function statusIcon(status: PublishChecklistStatus) {
  if (status === "pass") return "✓";
  if (status === "fail") return "×";
  if (status === "warn") return "!";
  return "·";
}

function statusClass(status: PublishChecklistStatus) {
  if (status === "pass") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (status === "fail") return "border-red-400/20 bg-red-500/10 text-red-100";
  if (status === "warn") return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-white/[0.03] text-white/55";
}

export default function PublishChecklist({
  title = "قائمة الجاهزية للنشر",
  items,
  compact = false,
}: PublishChecklistProps) {
  const ready = useMemo(() => isPublishChecklistReady(items), [items]);
  const failCount = useMemo(() => countChecklistStatus(items, "fail"), [items]);
  const warnCount = useMemo(() => countChecklistStatus(items, "warn"), [items]);

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/92 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">PUBLISH CHECKLIST</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
        </div>
        <span
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-semibold",
            ready
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
              : "border-amber-400/25 bg-amber-500/10 text-amber-100",
          ].join(" ")}
        >
          {ready ? "جاهز للنشر" : `${failCount} عنصر يحتاج إصلاحًا`}
        </span>
      </div>

      {!compact && (failCount > 0 || warnCount > 0) ? (
        <p className="mt-3 text-sm text-white/48">
          {failCount > 0 ? `${failCount} متطلبات إلزامية ناقصة.` : null}
          {failCount > 0 && warnCount > 0 ? " " : null}
          {warnCount > 0 ? `${warnCount} تحسينات موصى بها.` : null}
        </p>
      ) : null}

      <ul className="mt-5 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={[
              "rounded-[16px] border px-4 py-3",
              statusClass(item.status),
              compact && item.status === "info" ? "hidden" : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-bold">
                {statusIcon(item.status)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-xs leading-6 opacity-80">{item.hint}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
