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

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function BreadcrumbBlocksPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const { data, error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

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
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات Breadcrumb: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
    />
  );
}
