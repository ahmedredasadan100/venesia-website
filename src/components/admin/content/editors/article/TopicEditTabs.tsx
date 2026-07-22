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

export default function TopicEditTabs({ tabs }: TopicEditTabsProps) {
  return <AdminModuleTabs tabs={tabs} variant="segmented" navigationEventName={TOPIC_EDITOR_NAVIGATION_EVENT} />;
}
