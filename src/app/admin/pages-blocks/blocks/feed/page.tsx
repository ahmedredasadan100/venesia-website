export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  TOPICS_FEED_TYPE_LABELS_AR,
  TOPICS_FEED_TYPES,
} from "../../../../../lib/feed-modules/types";
import {
  bulkFeedModules,
  createFeedModule,
  deleteFeedModule,
  duplicateFeedModule,
  getFeedModuleRows,
  toggleFeedModuleStatus,
} from "./actions";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function FeedModulesPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("feed_module_templates")
      .select("id,name,slug,description,feed_type,status,updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("feedTemplates").viewKey,
    ),
  ]);
  const { data, error } = templatesResult;

  return (
    <BlockModuleManagerClient
      moduleKey="feed"
      moduleTitle="إدارة موديولات الخلاصة"
      moduleDescription="قوالب خلاصة المحتوى وإعدادات الاستعلام والعرض القابلة للربط بالصفحات."
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
      reloadRowsAction={getFeedModuleRows}
      defaultVariant="latest"
      variantOptions={TOPICS_FEED_TYPES.map(
        (feedType): [string, string] => [feedType, TOPICS_FEED_TYPE_LABELS_AR[feedType]],
      )}
      loadError={error ? `حدث خطأ أثناء قراءة Feed Modules: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
