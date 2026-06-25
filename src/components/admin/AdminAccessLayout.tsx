"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import AdminShell from "./AdminShell";

type AdminAccessLayoutProps = {
  children: ReactNode;
};

export default function AdminAccessLayout({ children }: AdminAccessLayoutProps) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
