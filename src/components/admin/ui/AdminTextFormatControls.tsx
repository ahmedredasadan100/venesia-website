"use client";

export type AdminTextAlignment = "right" | "center" | "left" | "justify";

type AdminTextFormatControlsProps = {
  alignment?: AdminTextAlignment;
  onAlignmentChange?: (alignment: AdminTextAlignment) => void;
  alignmentOptions?: readonly AdminTextAlignment[];
  bold?: boolean;
  onBoldChange?: (bold: boolean) => void;
  includeJustify?: boolean;
  disabled?: boolean;
  appearance?: "dark" | "light";
  ariaLabel: string;
  alignmentAriaLabel?: string;
  embedded?: boolean;
};

const ALIGNMENT_OPTIONS: Array<{
  value: AdminTextAlignment;
  title: string;
  path: string;
}> = [
  {
    value: "right",
    title: "محاذاة لليمين",
    path: "M3 4h14M7 8h10M3 12h14M9 16h8",
  },
  {
    value: "center",
    title: "محاذاة للوسط",
    path: "M3 4h14M5 8h10M3 12h14M6 16h8",
  },
  {
    value: "left",
    title: "محاذاة لليسار",
    path: "M3 4h14M3 8h10M3 12h14M3 16h8",
  },
  {
    value: "justify",
    title: "ضبط النص من الجانبين",
    path: "M3 4h14M3 8h14M3 12h14M3 16h14",
  },
];

function toolClass(active: boolean, appearance: "dark" | "light") {
  return [
    "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-xs font-semibold transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
    "disabled:cursor-not-allowed disabled:opacity-45",
    active
      ? appearance === "light"
        ? "bg-[#b98724] text-white shadow-[0_0_0_1px_rgba(185,135,36,0.24)]"
        : "bg-[#D8B87A]/85 text-[#07101C] shadow-[0_0_0_1px_rgba(216,184,122,0.38)]"
      : appearance === "light"
        ? "text-slate-500 hover:bg-amber-50 hover:text-[#8a5b12] focus-visible:outline-[#b98724]/60"
        : "text-white/55 hover:bg-white/[0.05] hover:text-white/85 focus-visible:outline-[#D8B87A]/70",
  ].join(" ");
}

export default function AdminTextFormatControls({
  alignment,
  onAlignmentChange,
  alignmentOptions: requestedAlignmentOptions,
  bold,
  onBoldChange,
  includeJustify = false,
  disabled = false,
  appearance = "dark",
  ariaLabel,
  alignmentAriaLabel = "محاذاة النص",
  embedded = false,
}: AdminTextFormatControlsProps) {
  const allowedAlignments = requestedAlignmentOptions ?? (
    includeJustify
      ? ALIGNMENT_OPTIONS.map((option) => option.value)
      : ALIGNMENT_OPTIONS.filter((option) => option.value !== "justify").map((option) => option.value)
  );
  const alignmentOptions = ALIGNMENT_OPTIONS.filter((option) =>
    allowedAlignments.includes(option.value),
  );
  const frameClass =
    appearance === "light"
      ? "border-slate-200 bg-slate-50"
      : "border-white/10 bg-black/20";

  return (
    <div
      className="inline-flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap"
      role={embedded ? "group" : "toolbar"}
      aria-label={ariaLabel}
      data-admin-text-format-controls=""
      dir="rtl"
    >
      {alignment !== undefined && onAlignmentChange ? (
        <div
          className={`inline-flex items-center gap-0.5 rounded-lg border p-0.5 ${frameClass}`}
          role="group"
          aria-label={alignmentAriaLabel}
        >
          {alignmentOptions.map((option) => {
            const active = option.value === alignment;
            return (
              <button
                key={option.value}
                type="button"
                title={option.title}
                aria-label={option.title}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onAlignmentChange(option.value)}
                data-admin-text-alignment={option.value}
                className={toolClass(active, appearance)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="size-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d={option.path} />
                </svg>
              </button>
            );
          })}
        </div>
      ) : null}
      {bold !== undefined && onBoldChange ? (
        <button
          type="button"
          title="خط عريض"
          aria-label="تنسيق عريض"
          aria-pressed={bold}
          disabled={disabled}
          onClick={() => onBoldChange(!bold)}
          data-admin-text-format-bold=""
          className={toolClass(bold, appearance)}
        >
          <span aria-hidden="true" className="text-sm font-black leading-none">
            B
          </span>
        </button>
      ) : null}
    </div>
  );
}
