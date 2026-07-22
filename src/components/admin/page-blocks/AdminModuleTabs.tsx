"use client";

import { useEffect, useState, type ReactNode } from "react";

type AdminModuleTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type AdminModuleTabsProps = {
  tabs: AdminModuleTab[];
  /** Optional initial tab id; falls back to the first tab. */
  initialTabId?: string;
  /**
   * Keep tabs on one horizontal row (scroll instead of wrap).
   * Safe default remains wrap for existing editors.
   */
  nowrap?: boolean;
  variant?: "pills" | "segmented";
  navigationEventName?: string;
};

type AdminModuleNavigationDetail =
  | string
  | {
      tabId: string;
      targetId?: string;
    };

function focusNavigationTarget(targetId: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusTarget = target.matches("input, textarea, select, button, [tabindex]")
        ? target
        : target.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
      focusTarget?.focus({ preventScroll: true });
    });
  });
}

export default function AdminModuleTabs({ tabs, initialTabId, nowrap = false, variant = "pills", navigationEventName }: AdminModuleTabsProps) {
  const fallbackId = tabs[0]?.id ?? "";
  const resolvedInitial =
    initialTabId && tabs.some((tab) => tab.id === initialTabId) ? initialTabId : fallbackId;
  const [activeId, setActiveId] = useState(resolvedInitial);

  useEffect(() => {
    if (!navigationEventName) return;
    const navigate = (event: Event) => {
      const detail = (event as CustomEvent<AdminModuleNavigationDetail>).detail;
      const tabId = typeof detail === "string" ? detail : detail?.tabId;
      const targetId = typeof detail === "string" ? undefined : detail?.targetId;
      if (!tabId || !tabs.some((tab) => tab.id === tabId)) return;

      setActiveId(tabId);
      if (targetId) focusNavigationTarget(targetId);
    };
    window.addEventListener(navigationEventName, navigate);
    return () => window.removeEventListener(navigationEventName, navigate);
  }, [navigationEventName, tabs]);

  if (!tabs.length) return null;

  return (
    <div className="space-y-5" data-admin-module-tabs={variant}>
      <div
        className={[
          variant === "segmented"
            ? "grid grid-cols-2 overflow-hidden rounded-2xl border border-white/12 bg-[#090D12]/88 sm:grid-cols-4"
            : "flex gap-2 border-b border-white/10 pb-3",
          variant !== "segmented" && nowrap ? "flex-nowrap overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "",
          variant !== "segmented" && !nowrap ? "flex-wrap" : "",
        ].join(" ")}
        role="tablist"
        aria-label="أقسام محرر الصفحة"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              data-topic-tab={tab.id}
              className={[
                variant === "segmented"
                  ? "min-h-12 cursor-pointer border-b border-e border-white/10 px-3 py-3 text-sm font-semibold transition sm:border-b-0"
                  : "cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition",
                nowrap && variant !== "segmented" ? "shrink-0 whitespace-nowrap" : "",
                isActive
                  ? variant === "segmented"
                    ? "bg-[linear-gradient(135deg,rgba(201,148,42,0.34),rgba(104,71,20,0.35))] text-[#F2CB69] shadow-[inset_0_0_24px_rgba(226,174,59,0.10)]"
                    : "bg-[#D8B87A]/15 text-[#D8B87A] ring-1 ring-[#D8B87A]/35"
                  : "text-white/50 hover:bg-white/[0.04] hover:text-white",
              ].join(" ")}
            >
              {isActive && variant === "segmented" ? <span aria-hidden className="me-2">✓</span> : null}
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          hidden={tab.id !== activeId}
          className={tab.id === activeId ? "block" : "hidden"}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
