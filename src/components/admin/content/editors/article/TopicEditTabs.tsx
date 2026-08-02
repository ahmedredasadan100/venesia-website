"use client";

import type { ReactNode } from "react";
import AdminModuleTabs from "../../../page-blocks/AdminModuleTabs";
import { TOPIC_EDITOR_NAVIGATION_EVENT } from "./topic-editor-navigation";

type TopicEditTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type TopicEditTabsProps = {
  tabs: TopicEditTab[];
};

function TopicEditorTabIcon({ tabId }: { tabId: string }) {
  const glyph =
    tabId === "basic" ? (
      <>
        <path d="M14 2.75H6.75a2 2 0 0 0-2 2v14.5a2 2 0 0 0 2 2h10.5a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2.75V8h5.25M8 12h8M8 16h6" />
      </>
    ) : tabId === "faq" ? (
      <>
        <path d="M20.25 11.5a8.25 8.25 0 1 1-3.18-6.52" />
        <path d="M17.5 3.75h2.75V6.5M9.65 9.4a2.55 2.55 0 0 1 4.85 1.1c0 1.8-2.5 2-2.5 3.7M12 17.65v.1" />
      </>
    ) : tabId === "seo" ? (
      <>
        <circle cx="10.75" cy="10.75" r="6.5" />
        <path d="m15.5 15.5 4.25 4.25M8.5 11.25l1.55 1.55 3.2-3.55" />
      </>
    ) : tabId === "publish" ? (
      <>
        <path d="M12 15.75v-12M7.75 8 12 3.75 16.25 8" />
        <path d="M5 13.75v4.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
      </>
    ) : null;

  if (!glyph) return null;

  return (
    <svg
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

export default function TopicEditTabs({ tabs }: TopicEditTabsProps) {
  const configuredTabs = tabs.map((tab) => ({
    ...tab,
    icon: <TopicEditorTabIcon tabId={tab.id} />,
  }));

  return (
    <AdminModuleTabs
      tabs={configuredTabs}
      variant="editor"
      navigationEventName={TOPIC_EDITOR_NAVIGATION_EVENT}
    />
  );
}
