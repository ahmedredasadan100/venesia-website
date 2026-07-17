"use client";

import type { SelectHTMLAttributes } from "react";

export const ADMIN_SELECT_CORE_CLASSES =
  "h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-white/10 bg-[#070A0F] px-3 pe-9 text-sm text-white/78 outline-none transition hover:border-white/18 focus:border-[#D8B87A]/40 disabled:cursor-not-allowed disabled:opacity-45";

type AdminSelectCoreProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function AdminSelectCore({
  className = "",
  hasError = false,
  children,
  ...props
}: AdminSelectCoreProps) {
  return (
    <span className={`relative block ${className}`}>
      <select
        {...props}
        className={`${ADMIN_SELECT_CORE_CLASSES} ${hasError ? "border-red-400/45" : ""}`}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/42"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

export function AdminFormSelect(props: AdminSelectCoreProps) {
  return <AdminSelectCore {...props} />;
}

export function AdminBulkActionSelect(props: AdminSelectCoreProps) {
  return <AdminSelectCore {...props} />;
}
