import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import BlockTemplateSummaryListClient from "../BlockTemplateSummaryListClient";
import {
  bulkMediaSidebarModuleStatuses,
  toggleMediaSidebarModuleStatus,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function MediaSidebarModulesPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("media_sidebar_module_templates")
      .select("id,name,slug,widget_key,status,sort_order")
      .order("sort_order"),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("mediaSidebarTemplates").viewKey,
    ),
  ]);
  const { data: templates, error } = templatesResult;

  return (
    <BlockTemplateSummaryListClient
      moduleKey="media-sidebar"
      title="إدارة موديولات الشريط الجانبي الإعلامي"
      description="قوالب لوحات الشريط الجانبي للمركز الإعلامي — تُدار الربط من صفحات Pages Blocks."
      detailLabel="الودجت"
      toggleAction={toggleMediaSidebarModuleStatus}
      bulkAction={bulkMediaSidebarModuleStatuses}
      rows={(templates ?? []).map((template) => ({
        id: Number(template.id),
        name: String(template.name),
        slug: String(template.slug),
        detail: String(template.widget_key),
        status: String(template.status),
      }))}
      errorMessage={error?.message}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
