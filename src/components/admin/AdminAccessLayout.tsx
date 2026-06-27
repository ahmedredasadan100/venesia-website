"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isAdminAuthPagePath } from "../../lib/admin/auth/session";
import AdminShell from "./AdminShell";

type AdminAccessLayoutProps = {
  children: ReactNode;
};

export default function AdminAccessLayout({ children }: AdminAccessLayoutProps) {
  const pathname = usePathname();

  if (isAdminAuthPagePath(pathname)) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
