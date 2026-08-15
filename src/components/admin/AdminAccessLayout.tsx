"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isAdminAuthPagePath } from "../../lib/admin/auth/session-paths";
import type {
  AdminNavigationItem,
  ResolvedAdminCompanyConfig,
} from "../../lib/admin/shell/contracts";

const AdminAuthenticatedLayout = dynamic(
  () => import("./AdminAuthenticatedLayout"),
  { ssr: false },
);

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
    <AdminAuthenticatedLayout company={company} navigation={navigation}>
      {children}
    </AdminAuthenticatedLayout>
  );
}
