"use client";

import type { ReactNode } from "react";
import AdminModuleTabs from "../../../components/admin/page-blocks/AdminModuleTabs";

type MediaEditTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type MediaEditTabsProps = {
  tabs: MediaEditTab[];
};

export default function MediaEditTabs({ tabs }: MediaEditTabsProps) {
  return <AdminModuleTabs tabs={tabs} />;
}
