"use client";

import { useState, type ReactNode } from "react";

import type { HeroTextAlignment } from "../../../../../../lib/hero/hero-content-controls";

type HeroVisibilityAlignRowProps = {
  label: string;
  alignmentName: string;
  showName: string;
  alignmentDefault?: HeroTextAlignment;
  showDefault?: boolean;
  /** When false, only show/hide is rendered (useful when alignment lives in Rich Text). */
  enableAlignment?: boolean;
  children?: ReactNode;
  helperText?: string;
};

function toolClass(active: boolean) {
  return [
    "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border text-xs font-semibold transition",
    active
      ? "border-[#D8B87A]/40 bg-[#D8B87A]/15 text-[#F2D99B]"
      : "border-white/10 bg-white/[0.035] text-white/70 hover:border-[#D8B87A]/30 hover:text-[#F2D99B]",
  ].join(" ");
}

export default function HeroVisibilityAlignRow({
  label,
  alignmentName,
  showName,
  alignmentDefault = "right",
  showDefault = true,
  enableAlignment = true,
  children,
  helperText,
}: HeroVisibilityAlignRowProps) {
  const [alignment, setAlignment] = useState<HeroTextAlignment>(alignmentDefault);
  const [show, setShow] = useState(showDefault);

  const alignOptions: Array<{ value: HeroTextAlignment; label: string; title: string }> = [
    { value: "right", label: "يمين", title: "محاذاة لليمين" },
    { value: "center", label: "وسط", title: "محاذاة للوسط" },
    { value: "left", label: "يسار", title: "محاذاة لليسار" },
  ];

  return (
    <div className="max-w-[920px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/55">{label}</span>
        <input type="hidden" name={alignmentName} value={alignment} />
        <input type="hidden" name={showName} value={show ? "true" : "false"} />
        <div className="flex shrink-0 flex-wrap gap-1.5" role="toolbar" aria-label={`إعدادات ${label}`}>
          {enableAlignment
            ? alignOptions.map((option) => {
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
              })
            : null}
          <button
            type="button"
            title={show ? "إخفاء العنصر" : "إظهار العنصر"}
            aria-label={show ? "إخفاء العنصر" : "إظهار العنصر"}
            aria-pressed={show}
            onClick={() => setShow((current) => !current)}
            className={[toolClass(show), "w-auto min-w-10 px-2.5"].join(" ")}
          >
            {show ? "إخفاء" : "إظهار"}
          </button>
        </div>
      </div>
      {children}
      {helperText ? <p className="text-xs leading-6 text-white/45">{helperText}</p> : null}
    </div>
  );
}
