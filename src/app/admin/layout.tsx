import type { Metadata } from "next";

import AdminAccessLayout from "../../components/admin/AdminAccessLayout";
import { ADMIN_COMPANY_DEFAULT } from "../../config/admin/company";
import { ADMIN_NAVIGATION_REGISTRY } from "../../config/admin/navigation";
import { loadAdminCompanyConfig } from "../../lib/admin/shell/company-config";
import { resolveAdminNavigation } from "../../lib/admin/shell/navigation";
import { NO_INDEX_ROBOTS } from "../../config/seo/seo-rules";
import { buildMetadata } from "../../lib/seo/build-metadata";

/** Admin depends on auth/searchParams/runtime data and must not be statically prerendered. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/admin",
  title: `${ADMIN_COMPANY_DEFAULT.adminLabel} | ${ADMIN_COMPANY_DEFAULT.name}`,
  description: `${ADMIN_COMPANY_DEFAULT.cmsLabel} administration.`,
  robots: NO_INDEX_ROBOTS,
});

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const company = await loadAdminCompanyConfig(ADMIN_COMPANY_DEFAULT);
  const navigation = resolveAdminNavigation(ADMIN_NAVIGATION_REGISTRY);

  return (
    <AdminAccessLayout company={company} navigation={navigation}>
      {children}
    </AdminAccessLayout>
  );
}
