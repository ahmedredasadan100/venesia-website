export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkFeedModules,
  createFeedModule,
  deleteFeedModule,
  duplicateFeedModule,
  toggleFeedModuleStatus,
} from "./actions";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function FeedModulesPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const { data, error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .select("id,name,slug,description,feed_type,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  return (
    <BlockModuleManagerClient
      moduleKey="feed"
      moduleTitle="إدارة Feed Modules"
      moduleDescription="قوالب Feed Widget لموضوعات تهمك — إعدادات الاستعلام والعرض فقط. اربطها بالصفحات من Pages Manager."
      rows={(data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description ?? row.feed_type,
        variant: row.feed_type,
        status: row.status,
      }))}
      createAction={createFeedModule}
      deleteAction={deleteFeedModule}
      duplicateAction={duplicateFeedModule}
      toggleAction={toggleFeedModuleStatus}
      bulkAction={bulkFeedModules}
      defaultVariant="latest"
      variantOptions={[
        ["latest", "Latest Topics"],
        ["popular", "Popular Topics"],
        ["categories", "Categories"],
        ["series", "Series"],
      ]}
      loadError={error ? `حدث خطأ أثناء قراءة Feed Modules: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
    />
  );
}
