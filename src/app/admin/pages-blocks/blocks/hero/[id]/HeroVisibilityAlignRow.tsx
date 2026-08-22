"use client";

import { useState, type ReactNode } from "react";

import { AdminFormSwitch } from "../../../../../../components/admin/ui";
import type { HeroTextAlignment } from "../../../../../../lib/hero/hero-content-controls";

type HeroVisibilityAlignRowProps = {
  label: string;
  alignmentName: string;
  showName: string;
  boldName?: string;
  alignmentDefault?: HeroTextAlignment;
  showDefault?: boolean;
  boldDefault?: boolean;
  /** When false, only show/hide is rendered (useful when alignment lives in Rich Text). */
  enableAlignment?: boolean;
  children?: ReactNode;
  helperText?: string;
};

function toolClass(active: boolean) {
  return [
    "inline-flex h-9 min-w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold transition sm:min-w-14 sm:px-3",
    active
      ? "bg-[#D8B87A]/16 text-[#F2D99B] shadow-[0_0_0_1px_rgba(216,184,122,0.28)]"
      : "text-white/55 hover:bg-white/[0.05] hover:text-white/85",
  ].join(" ");
}

const ALIGN_OPTIONS: Array<{ value: HeroTextAlignment; label: string; title: string }> = [
  { value: "right", label: "يمين", title: "محاذاة لليمين" },
  { value: "center", label: "وسط", title: "محاذاة للوسط" },
  { value: "left", label: "يسار", title: "محاذاة لليسار" },
];

export default function HeroVisibilityAlignRow({
  label,
  alignmentName,
  showName,
  boldName,
  alignmentDefault = "right",
  showDefault = true,
  boldDefault = false,
  enableAlignment = true,
  children,
  helperText,
}: HeroVisibilityAlignRowProps) {
  const [alignment, setAlignment] = useState<HeroTextAlignment>(alignmentDefault);
  const [show, setShow] = useState(showDefault);

  return (
    <div
      data-hero-control-row=""
      className="rounded-2xl border border-white/10 bg-[#05070B]/72 p-4"
    >
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-white/78">{label}</span>
        {enableAlignment ? <input type="hidden" name={alignmentName} value={alignment} /> : null}
        {boldName ? <input type="hidden" name={boldName} value={String(boldDefault)} /> : null}
        <div
          className="flex w-full flex-nowrap items-center justify-between gap-2"
          role="toolbar"
          aria-label={`إعدادات ${label}`}
          dir="rtl"
        >
          <AdminFormSwitch
            name={showName}
            label={show ? "ظاهر" : "مخفي"}
            value="true"
            uncheckedValue="false"
            checked={show}
            onChange={(event) => setShow(event.target.checked)}
            wrapLabel
            className="h-9 min-w-24 justify-between border border-white/10 bg-white/[0.035] px-3 py-2 sm:min-w-28"
          />
          {enableAlignment ? (
            <div
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
              role="group"
              aria-label={`محاذاة ${label}`}
            >
              {ALIGN_OPTIONS.map((option) => {
                const active = option.value === alignment;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.title}
                    aria-label={option.title}
                    aria-pressed={active}
                    onClick={() => setAlignment(option.value)}
                    className={toolClass(active)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
      {helperText ? <p className="mt-3 text-xs leading-6 text-white/45">{helperText}</p> : null}
    </div>
  );
}
