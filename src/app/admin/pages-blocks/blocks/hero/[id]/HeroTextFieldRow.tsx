"use client";

import { useState } from "react";

import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import type { HeroTextAlignment } from "../../../../../../lib/hero/hero-content-controls";

type HeroTextFieldRowProps = {
  label: string;
  name: string;
  defaultValue?: string;
  boldName: string;
  alignmentName: string;
  showName: string;
  boldDefault?: boolean;
  alignmentDefault?: HeroTextAlignment;
  showDefault?: boolean;
  /** When false, hide Bold control (e.g. breadcrumb-only rows that still need it can keep true). */
  enableBold?: boolean;
  placeholder?: string;
  helperText?: string;
};

function toolClass(active: boolean) {
  return [
    "inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border px-2.5 text-xs font-semibold transition",
    active
      ? "border-[#D8B87A]/40 bg-[#D8B87A]/15 text-[#F2D99B]"
      : "border-white/10 bg-white/[0.035] text-white/70 hover:border-[#D8B87A]/30 hover:text-[#F2D99B]",
  ].join(" ");
}

export default function HeroTextFieldRow({
  label,
  name,
  defaultValue = "",
  boldName,
  alignmentName,
  showName,
  boldDefault = false,
  alignmentDefault = "right",
  showDefault = true,
  enableBold = true,
  placeholder,
  helperText,
}: HeroTextFieldRowProps) {
  const [bold, setBold] = useState(boldDefault);
  const [alignment, setAlignment] = useState<HeroTextAlignment>(alignmentDefault);
  const [show, setShow] = useState(showDefault);

  const alignOptions: Array<{ value: HeroTextAlignment; label: string }> = [
    { value: "right", label: "يمين" },
    { value: "center", label: "وسط" },
    { value: "left", label: "يسار" },
  ];

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-white/55">{label}</span>
      {enableBold ? <input type="hidden" name={boldName} value={bold ? "true" : "false"} /> : null}
      <input type="hidden" name={alignmentName} value={alignment} />
      <input type="hidden" name={showName} value={show ? "true" : "false"} />

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="min-w-0 flex-1 space-y-2">
          <span className="sr-only">{label}</span>
          <input
            name={name}
            defaultValue={defaultValue}
            placeholder={placeholder}
            className={fieldClassName("h-11")}
          />
        </label>

        <div
          className="flex shrink-0 flex-wrap items-center gap-2"
          role="toolbar"
          aria-label={`تنسيق ${label}`}
        >
          {enableBold ? (
            <button
              type="button"
              title="عريض"
              aria-label="عريض"
              aria-pressed={bold}
              onClick={() => setBold((current) => !current)}
              className={toolClass(bold)}
            >
              B
            </button>
          ) : null}
          {alignOptions.map((option) => {
            const active = option.value === alignment;
            return (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                aria-pressed={active}
                onClick={() => setAlignment(option.value)}
                className={toolClass(active)}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            title={show ? "إخفاء العنصر" : "إظهار العنصر"}
            aria-label={show ? "إخفاء العنصر" : "إظهار العنصر"}
            aria-pressed={show}
            onClick={() => setShow((current) => !current)}
            className={toolClass(show)}
          >
            {show ? "إخفاء" : "إظهار"}
          </button>
        </div>
      </div>

      {helperText ? <p className="text-xs leading-6 text-white/45">{helperText}</p> : null}
    </div>
  );
}
