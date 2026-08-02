"use client";

import type { ReactNode } from "react";
import AdminModuleTabs from "../../../ui/AdminModuleTabs";
import type { AdminModuleTabIconName } from "../../../ui/AdminModuleTabs";
import { TOPIC_EDITOR_NAVIGATION_EVENT } from "./topic-editor-navigation";

type TopicEditTab = {
  id: string;
  navigationLabel: string;
  sectionHeading: string;
  sectionDescription?: string;
  icon: AdminModuleTabIconName;
  content: ReactNode;
};

type TopicEditTabsProps = {
  tabs: TopicEditTab[];
};

export default function TopicEditTabs({ tabs }: TopicEditTabsProps) {
  return (
    <AdminModuleTabs
      tabs={tabs}
      variant="editor"
      navigationEventName={TOPIC_EDITOR_NAVIGATION_EVENT}
    />
  );
}
