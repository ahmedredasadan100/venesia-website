"use client";

import { useState, type ReactNode } from "react";

type AdminNoticeDismissibleFrameProps = {
  children: ReactNode;
  className: string;
  layout: "stacked" | "inline";
  role: "alert" | "status";
  ariaLive: "assertive" | "polite";
};

export default function AdminNoticeDismissibleFrame({
  children,
  className,
  layout,
  role,
  ariaLive,
}: AdminNoticeDismissibleFrameProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role={role}
      aria-live={ariaLive}
      data-admin-notice-layout={layout}
      className={className}
    >
      {children}
      <button
        type="button"
        aria-label="إغلاق الإشعار"
        onClick={() => setDismissed(true)}
        className={
          layout === "inline"
            ? "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-current/15 text-xl leading-none transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            : "absolute left-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-current/15 text-xl leading-none transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        }
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
