export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
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
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("breadcrumb_block_templates")
      .select("id,name,description,status,updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("breadcrumbTemplates").viewKey,
    ),
  ]);
  const { data, error } = templatesResult;

  return (
    <BlockModuleManagerClient
      moduleKey="breadcrumb"
      moduleTitle="إدارة مسارات التنقل"
      moduleDescription="موديولات مسار التنقل القابلة للربط بمواضع العرض التي تدعمها كل صفحة."
      rows={(data ?? []).map((row) => ({ ...row, description: row.description ?? null }))}
      createAction={createBreadcrumbBlock}
      deleteAction={deleteBreadcrumbBlock}
      duplicateAction={duplicateBreadcrumbBlock}
      toggleAction={toggleBreadcrumbBlockStatus}
      bulkAction={bulkBreadcrumbBlocks}
      defaultVariant="default"
      variantOptions={[]}
      technicalIdentityMode="internal"
      variantFieldMode="internal"
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات Breadcrumb: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
