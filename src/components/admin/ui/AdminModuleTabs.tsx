"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ModuleEditorIconToken } from "../../../lib/page-composition/slot-module-registry";

export type AdminModuleTabIconName = ModuleEditorIconToken;

type AdminModuleTabNavigationLabel =
  | {
      navigationLabel: ReactNode;
      /** @deprecated Use navigationLabel for the short tab label. */
      label?: never;
    }
  | {
      /** @deprecated Use navigationLabel for the short tab label. */
      label: ReactNode;
      navigationLabel?: never;
    };

export type AdminModuleTab = AdminModuleTabNavigationLabel & {
  id: string;
  /** Full descriptive heading rendered inside the active panel. */
  sectionHeading?: ReactNode;
  sectionDescription?: ReactNode;
  /** Optional compact context rendered opposite the active section title. */
  sectionSummary?: ReactNode;
  /** Semantic icon rendered by the shared owner. */
  icon?: AdminModuleTabIconName;
  indicator?: ReactNode;
  content: ReactNode;
};

export type AdminModuleTabsProps = {
  tabs: AdminModuleTab[];
  /** Section-level feedback or context rendered inside the active panel. */
  activePanelContext?: ReactNode;
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

function AdminModuleTabIcon({ name }: { name: AdminModuleTabIconName }) {
  const glyph =
    name === "content" ? (
      <>
        <path d="M14 2.75H6.75a2 2 0 0 0-2 2v14.5a2 2 0 0 0 2 2h10.5a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2.75V8h5.25M8 12h8M8 16h6" />
      </>
    ) : name === "faq" ? (
      <>
        <path d="M20.25 11.5a8.25 8.25 0 1 1-3.18-6.52" />
        <path d="M17.5 3.75h2.75V6.5M9.65 9.4a2.55 2.55 0 0 1 4.85 1.1c0 1.8-2.5 2-2.5 3.7M12 17.65v.1" />
      </>
    ) : name === "location" ? (
      <>
        <path d="M20 10c0 5-8 11.25-8 11.25S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ) : name === "media" ? (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m4.5 17 4.25-4.25 3.25 3.25 2.5-2.5 5 5" />
      </>
    ) : name === "overview" ? (
      <>
        <path d="M3.5 12s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ) : name === "plans" ? (
      <>
        <path d="M4 4h16v16H4zM9 4v6h6V4M4 14h6v6M15 10h5" />
      </>
    ) : name === "publish" ? (
      <>
        <path d="M12 15.75v-12M7.75 8 12 3.75 16.25 8" />
        <path d="M5 13.75v4.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
      </>
    ) : name === "seo" ? (
      <>
        <circle cx="10.75" cy="10.75" r="6.5" />
        <path d="m15.5 15.5 4.25 4.25M8.5 11.25l1.55 1.55 3.2-3.55" />
      </>
    ) : name === "settings" ? (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.05V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ) : name === "specifications" ? (
      <>
        <path d="M8 5h12M8 12h12M8 19h12" />
        <path d="m3.5 5 1.25 1.25L6.5 4.5m-3 7.5 1.25 1.25L6.5 11.5m-3 7.5 1.25 1.25L6.5 18.5" />
      </>
    ) : (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {glyph}
    </svg>
  );
}

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

export default function AdminModuleTabs({ tabs, activePanelContext, initialTabId, nowrap = false, variant = "editor", navigationEventName, ariaLabel = "أقسام المحرر" }: AdminModuleTabsProps) {
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
    <div
      className="space-y-5"
      data-admin-module-tabs={variant}
      data-admin-tabs-owner="AdminModuleTabs"
    >
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
          const navigationLabel = tab.navigationLabel ?? tab.label;
          const icon = tab.icon ?? "section";
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
                    <span className={ADMIN_EDITOR_TAB_ICON_CLASS_NAME}>
                      <AdminModuleTabIcon name={icon} />
                    </span>
                    <span>{navigationLabel}</span>
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
                  {navigationLabel}
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
          {tab.sectionHeading ? (
            <header
              className="mb-5 flex min-h-[84px] min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-[#D8B87A]/20 bg-[linear-gradient(120deg,rgba(7,10,15,0.98),rgba(24,28,33,0.9))] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.24),0_0_22px_rgba(216,184,122,0.04)] sm:gap-4 sm:px-5"
              data-admin-tab-section-heading={tab.id}
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-[#D8B87A]/[0.08] text-[#E6C98D] shadow-[inset_0_0_14px_rgba(216,184,122,0.08)] sm:size-12 [&>svg]:size-5">
                <AdminModuleTabIcon name={tab.icon ?? "section"} />
              </span>
              <span
                aria-hidden="true"
                className="h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-[#D8B87A]/45 to-transparent sm:h-9"
                data-admin-tab-section-accent
              />
              <span className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-6 text-white sm:text-xl sm:leading-7">
                  {tab.sectionHeading}
                </h2>
                {tab.sectionDescription ? (
                  <span className="mt-1 block max-w-3xl text-sm leading-5 text-white/45 sm:leading-6">
                    {tab.sectionDescription}
                  </span>
                ) : null}
              </span>
              {tab.sectionSummary ? (
                <div
                  className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-white/8 pt-3 sm:ms-auto sm:w-auto sm:max-w-[46%] sm:border-s sm:border-t-0 sm:ps-4 sm:pt-0"
                  data-admin-tab-section-summary={tab.id}
                >
                  {tab.sectionSummary}
                </div>
              ) : null}
            </header>
          ) : null}
          {tab.id === activeId && activePanelContext ? (
            <div className="mb-5" data-admin-active-panel-context>
              {activePanelContext}
            </div>
          ) : null}
          {tab.content}
        </div>
      ))}
    </div>
  );
}
