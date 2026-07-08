import type { Metadata } from "next";

import AdminAccessLayout from "../../components/admin/AdminAccessLayout";
import { NO_INDEX_ROBOTS } from "../../config/seo/seo-rules";
import { buildMetadata } from "../../lib/seo/build-metadata";

/** Admin depends on auth/searchParams/runtime data and must not be statically prerendered. */
export const dynamic = "force-dynamic";

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
  return <AdminAccessLayout>{children}</AdminAccessLayout>;
}
