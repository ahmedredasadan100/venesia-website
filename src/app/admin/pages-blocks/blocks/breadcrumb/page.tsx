export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkBreadcrumbBlocks,
  createBreadcrumbBlock,
  deleteBreadcrumbBlock,
  duplicateBreadcrumbBlock,
  toggleBreadcrumbBlockStatus,
} from "./actions";

export default async function BreadcrumbBlocksPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة بلوكات Breadcrumb: {error.message}
      </div>
    );
  }

  return (
    <BlockModuleManagerClient
      moduleKey="breadcrumb"
      moduleTitle="إدارة Breadcrumb"
      moduleDescription="موديولات مسار التنقل المستقلة. اربطها بالصفحات من Pages Manager — منفصلة تمامًا عن Hero."
      rows={(data ?? []).map((row) => ({ ...row, description: row.description ?? null }))}
      createAction={createBreadcrumbBlock}
      deleteAction={deleteBreadcrumbBlock}
      duplicateAction={duplicateBreadcrumbBlock}
      toggleAction={toggleBreadcrumbBlockStatus}
      bulkAction={bulkBreadcrumbBlocks}
      defaultVariant="hero-inline"
      variantOptions={[["hero-inline", "Hero Inline"], ["standalone", "Standalone"]]}
    />
  );
}
