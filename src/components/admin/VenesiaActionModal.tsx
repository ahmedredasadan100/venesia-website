"use client";

import type { ReactNode } from "react";

type VenesiaActionModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function VenesiaActionModal({
  open,
  title,
  subtitle,
  eyebrow = "Venesia Action Modal",
  onClose,
  children,
}: VenesiaActionModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      dir="rtl"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8B87A]/70">{eyebrow}</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3">{children}</div>
      </div>
    </div>
  );
}

export function VenesiaActionModalButton({
  children,
  onClick,
  tone = "neutral",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "neutral" | "blue" | "red";
  disabled?: boolean;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/15"
      : tone === "blue"
        ? "border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/15"
        : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-right text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {children}
    </button>
  );
}
