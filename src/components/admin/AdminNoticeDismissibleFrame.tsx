"use client";

import { useState, type ReactNode } from "react";

type AdminNoticeDismissibleFrameProps = {
  children: ReactNode;
  className: string;
  layout: "stacked" | "inline";
  role: "alert" | "status";
  ariaLive: "assertive" | "polite";
  dismissSearchParams?: readonly string[];
};

export default function AdminNoticeDismissibleFrame({
  children,
  className,
  layout,
  role,
  ariaLive,
  dismissSearchParams = [],
}: AdminNoticeDismissibleFrameProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    if (!dismissSearchParams.length) return;
    const url = new URL(window.location.href);
    let changed = false;
    dismissSearchParams.forEach((param) => {
      if (!url.searchParams.has(param)) return;
      url.searchParams.delete(param);
      changed = true;
    });
    if (changed) {
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }

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
        onClick={dismiss}
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
