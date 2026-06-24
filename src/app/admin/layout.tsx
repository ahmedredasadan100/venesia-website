import type { Metadata } from "next";

import AdminShell from "../../components/admin/AdminShell";
import { NO_INDEX_ROBOTS } from "../../config/seo/seo-rules";
import { buildMetadata } from "../../lib/seo/build-metadata";

export const metadata: Metadata = buildMetadata({
  path: "/admin",
  title: "لوحة التحكم | فينيسيا للتطوير العقاري",
  description: "لوحة تحكم فينيسيا للتطوير العقاري.",
  robots: NO_INDEX_ROBOTS,
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
