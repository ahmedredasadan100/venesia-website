"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isAdminAuthPagePath } from "../../lib/admin/auth/session-paths";
import AdminShell from "./AdminShell";
import AdminEntityListQueryProvider from "./entity-list/AdminEntityListQueryProvider";

type AdminAccessLayoutProps = {
  children: ReactNode;
};

export default function AdminAccessLayout({ children }: AdminAccessLayoutProps) {
  const pathname = usePathname();

  if (isAdminAuthPagePath(pathname)) {
    return <>{children}</>;
  }

  return (
    <AdminEntityListQueryProvider>
      <AdminShell>{children}</AdminShell>
    </AdminEntityListQueryProvider>
  );
}
