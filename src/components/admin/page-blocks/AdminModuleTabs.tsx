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
};

export default function AdminModuleTabs({ tabs, initialTabId }: AdminModuleTabsProps) {
  const fallbackId = tabs[0]?.id ?? "";
  const resolvedInitial =
    initialTabId && tabs.some((tab) => tab.id === initialTabId) ? initialTabId : fallbackId;
  const [activeId, setActiveId] = useState(resolvedInitial);

  if (!tabs.length) return null;

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-2 border-b border-white/10 pb-3"
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
