"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isAdminAuthPagePath } from "../../lib/admin/auth/session-paths";
import type {
  AdminNavigationItem,
  ResolvedAdminCompanyConfig,
} from "../../lib/admin/shell/contracts";
import AdminShell from "./AdminShell";
import AdminEntityListQueryProvider from "./entity-list/AdminEntityListQueryProvider";

type AdminAccessLayoutProps = {
  children: ReactNode;
  company: ResolvedAdminCompanyConfig;
  navigation: AdminNavigationItem[];
};

export default function AdminAccessLayout({
  children,
  company,
  navigation,
}: AdminAccessLayoutProps) {
  const pathname = usePathname();

  if (isAdminAuthPagePath(pathname)) {
    return <>{children}</>;
  }

  return (
    <AdminEntityListQueryProvider>
      <AdminShell company={company} navigation={navigation}>
        {children}
      </AdminShell>
    </AdminEntityListQueryProvider>
  );
}
