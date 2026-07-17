"use client";

import type { ReactNode } from "react";
import AdminModuleTabs from "../../../page-blocks/AdminModuleTabs";

type TopicEditTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type TopicEditTabsProps = {
  tabs: TopicEditTab[];
};

export default function TopicEditTabs({ tabs }: TopicEditTabsProps) {
  return <AdminModuleTabs tabs={tabs} />;
}
