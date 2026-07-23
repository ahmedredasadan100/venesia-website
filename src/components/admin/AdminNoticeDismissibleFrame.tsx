"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { AdminFeedbackLifecycle } from "../../lib/admin/admin-action-feedback";

const DEFAULT_DISMISS_SEARCH_PARAMS = [
  "notice",
  "message",
  "error",
] as const;

type AdminNoticeDismissibleFrameProps = {
  children: ReactNode;
  className: string;
  layout: "stacked" | "inline";
  role: "alert" | "status";
  ariaLive: "assertive" | "polite";
  dismissSearchParams?: readonly string[];
  lifecycle: AdminFeedbackLifecycle;
  onDismiss?: () => void;
};

export default function AdminNoticeDismissibleFrame({
  children,
  className,
  layout,
  role,
  ariaLive,
  dismissSearchParams = DEFAULT_DISMISS_SEARCH_PARAMS,
  lifecycle,
  onDismiss,
}: AdminNoticeDismissibleFrameProps) {
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
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
  }, [dismissSearchParams, onDismiss]);

  if (dismissed) return null;

  return (
    <div
      role={role}
      aria-live={ariaLive}
      data-admin-notice-dismissible="true"
      data-admin-notice-lifecycle={lifecycle}
      data-admin-notice-layout={layout}
      className={className}
    >
      {children}
      <button
        type="button"
        aria-label="إغلاق الإشعار"
        onClick={dismiss}
        style={{ cursor: "pointer" }}
        className={
          layout === "inline"
            ? "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/30 bg-black/25 text-xl leading-none text-white shadow-sm transition hover:border-white/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            : "absolute left-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/30 bg-black/25 text-xl leading-none text-white shadow-sm transition hover:border-white/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        }
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
