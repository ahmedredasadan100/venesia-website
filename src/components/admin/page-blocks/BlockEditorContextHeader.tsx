"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { statusMeta } from "../../../lib/page-blocks/admin-utils";

type BlockEditorContextHeaderProps = {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description?: string;
  status?: string;
  saved?: boolean;
  slotContext?: string | null;
  actions?: ReactNode;
};

export default function BlockEditorContextHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  status,
  saved,
  slotContext,
  actions,
}: BlockEditorContextHeaderProps) {
  const statusInfo = status ? statusMeta(status) : null;

  return (
    <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={backHref} className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#D8B87A]">
            <span aria-hidden="true">→</span>
            {backLabel}
          </Link>
          <p className="font-en text-[11px] tracking-[0.28em] text-[#D8B87A]/70">{eyebrow}</p>
          <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">{description}</p> : null}
          {slotContext ? (
            <p className="mt-3 text-xs text-white/40">
              الفتحة المفضلة: <span className="text-[#D8B87A]/85">{slotContext}</span>
            </p>
          ) : null}
          {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الموديول بنجاح.</p> : null}
        </div>

        <div className="flex flex-col items-end gap-3">
          {statusInfo ? (
            <span
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold",
                statusInfo.tone === "green"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : statusInfo.tone === "gold"
                    ? "bg-[#D8B87A]/10 text-[#D8B87A]"
                    : "bg-white/10 text-white/45",
              ].join(" ")}
            >
              {statusInfo.label}
            </span>
          ) : null}
          {actions}
        </div>
      </div>
    </section>
  );
}
