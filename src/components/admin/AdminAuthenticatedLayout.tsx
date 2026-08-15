"use client";

import type { ReactNode } from "react";

import type {
  AdminNavigationItem,
  ResolvedAdminCompanyConfig,
} from "../../lib/admin/shell/contracts";
import AdminFeedbackProvider from "./AdminFeedbackProvider";
import AdminShell from "./AdminShell";
import AdminEntityListQueryProvider from "./entity-list/AdminEntityListQueryProvider";

type AdminAuthenticatedLayoutProps = {
  children: ReactNode;
  company: ResolvedAdminCompanyConfig;
  navigation: AdminNavigationItem[];
};

export default function AdminAuthenticatedLayout({
  children,
  company,
  navigation,
}: AdminAuthenticatedLayoutProps) {
  return (
    <AdminEntityListQueryProvider>
      <AdminFeedbackProvider>
        <AdminShell company={company} navigation={navigation}>
          {children}
        </AdminShell>
      </AdminFeedbackProvider>
    </AdminEntityListQueryProvider>
  );
}
