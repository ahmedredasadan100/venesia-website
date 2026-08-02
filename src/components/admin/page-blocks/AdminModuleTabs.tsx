"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type AdminModuleTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  indicator?: ReactNode;
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
  variant?: "pills" | "segmented" | "underline" | "editor";
  navigationEventName?: string;
  ariaLabel?: string;
};

const ADMIN_EDITOR_TAB_CONTAINER_CLASS_NAME =
  "flex w-full min-w-0 flex-nowrap items-center justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-white/10 bg-[#090D12]/88 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const ADMIN_EDITOR_TAB_CLASS_NAME =
  "relative inline-flex h-14 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-transparent ps-6 pe-6 text-[15px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D8B87A]/70";
const ADMIN_EDITOR_TAB_CONTENT_CLASS_NAME =
  "inline-flex items-center justify-center gap-2";
const ADMIN_EDITOR_TAB_ICON_CLASS_NAME =
  "inline-flex size-5 shrink-0 items-center justify-center [&>svg]:size-5";
const ADMIN_EDITOR_TAB_INDICATOR_CLASS_NAME =
  "inline-flex shrink-0 items-center justify-center";
const ADMIN_EDITOR_TAB_ACTIVE_INDICATOR_CLASS_NAME =
  "pointer-events-none absolute bottom-0 start-6 end-6 h-0.5 rounded-t-full bg-[#D8B87A]";

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

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
      const focusTarget = target.matches('input, textarea, select, button, [contenteditable="true"], [tabindex]')
        ? target
        : target.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
          );
      focusTarget?.focus({ preventScroll: true });
    });
  });
}

export default function AdminModuleTabs({ tabs, initialTabId, nowrap = false, variant = "pills", navigationEventName, ariaLabel = "أقسام المحرر" }: AdminModuleTabsProps) {
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    setActiveId(next.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="space-y-5" data-admin-module-tabs={variant}>
      <div
        className={[
          variant === "editor"
            ? ADMIN_EDITOR_TAB_CONTAINER_CLASS_NAME
            : variant === "segmented"
            ? "grid grid-cols-2 overflow-hidden rounded-2xl border border-white/12 bg-[#090D12]/88 sm:grid-cols-4"
            : variant === "underline"
              ? "flex border-b border-white/10 bg-[#080B10]/92 px-2"
            : "flex gap-2 border-b border-white/10 pb-3",
          variant !== "segmented" && variant !== "editor" && nowrap ? "flex-nowrap overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "",
          variant !== "segmented" && variant !== "editor" && !nowrap ? "flex-wrap" : "",
        ].join(" ")}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`${instanceId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${instanceId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              data-topic-tab={tab.id}
              data-admin-tab-id={tab.id}
              className={[
                variant === "editor"
                  ? ADMIN_EDITOR_TAB_CLASS_NAME
                  : variant === "segmented"
                  ? "min-h-12 cursor-pointer border-b border-e border-white/10 px-3 py-3 text-sm font-semibold transition sm:border-b-0"
                  : variant === "underline"
                    ? "min-h-14 shrink-0 cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D8B87A]/70"
                  : "cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition",
                nowrap && variant !== "segmented" && variant !== "editor" ? "shrink-0 whitespace-nowrap" : "",
                isActive
                  ? variant === "editor"
                    ? "border-[#D8B87A]/20 bg-[#D8B87A]/[0.08] text-[#E6C98D]"
                    : variant === "segmented"
                    ? "bg-[linear-gradient(135deg,rgba(201,148,42,0.34),rgba(104,71,20,0.35))] text-[#F2CB69] shadow-[inset_0_0_24px_rgba(226,174,59,0.10)]"
                    : variant === "underline"
                      ? "border-[#D8B87A] bg-[#D8B87A]/[0.06] text-[#F2D99B]"
                    : "bg-[#D8B87A]/15 text-[#D8B87A] ring-1 ring-[#D8B87A]/35"
                  : variant === "editor"
                    ? "text-white/55 hover:bg-white/[0.035] hover:text-white/85"
                    : variant === "underline"
                    ? "border-transparent text-white/52 hover:border-[#D8B87A]/35 hover:bg-white/[0.035] hover:text-white"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white",
              ].join(" ")}
            >
              {variant === "editor" ? (
                <>
                  <span className={ADMIN_EDITOR_TAB_CONTENT_CLASS_NAME}>
                    {tab.icon ? (
                      <span aria-hidden="true" className={ADMIN_EDITOR_TAB_ICON_CLASS_NAME}>
                        {tab.icon}
                      </span>
                    ) : null}
                    <span>{tab.label}</span>
                    {tab.indicator ? (
                      <span aria-hidden="true" className={ADMIN_EDITOR_TAB_INDICATOR_CLASS_NAME}>
                        {tab.indicator}
                      </span>
                    ) : null}
                  </span>
                  {isActive ? (
                    <span aria-hidden="true" className={ADMIN_EDITOR_TAB_ACTIVE_INDICATOR_CLASS_NAME} />
                  ) : null}
                </>
              ) : (
                <>
                  {isActive && variant === "segmented" ? <span aria-hidden className="me-2">✓</span> : null}
                  {tab.label}
                </>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${instanceId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          className={tab.id === activeId ? "block" : "hidden"}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
