"use client";

import { useState, type ReactNode } from "react";

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
};

export default function AdminModuleTabs({ tabs, initialTabId, nowrap = false }: AdminModuleTabsProps) {
  const fallbackId = tabs[0]?.id ?? "";
  const resolvedInitial =
    initialTabId && tabs.some((tab) => tab.id === initialTabId) ? initialTabId : fallbackId;
  const [activeId, setActiveId] = useState(resolvedInitial);

  if (!tabs.length) return null;

  return (
    <div className="space-y-5">
      <div
        className={[
          "flex gap-2 border-b border-white/10 pb-3",
          nowrap ? "flex-nowrap overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap",
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
              className={[
                "cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition",
                nowrap ? "shrink-0 whitespace-nowrap" : "",
                isActive
                  ? "bg-[#D8B87A]/15 text-[#D8B87A] ring-1 ring-[#D8B87A]/35"
                  : "text-white/50 hover:bg-white/[0.04] hover:text-white",
              ].join(" ")}
            >
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
