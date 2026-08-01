import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockTemplateSummaryListClient from "../BlockTemplateSummaryListClient";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function MediaSidebarModulesPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const { data: templates, error } = await getSupabaseAdmin()
    .from("media_sidebar_module_templates")
    .select("id,name,slug,widget_key,status,sort_order")
    .order("sort_order");

  return (
    <BlockTemplateSummaryListClient
      moduleKey="media-sidebar"
      title="Media Sidebar Modules"
      description="قوالب لوحات الشريط الجانبي للمركز الإعلامي — تُدار الربط من صفحات Pages Blocks."
      detailLabel="Widget"
      rows={(templates ?? []).map((template) => ({
        id: Number(template.id),
        name: String(template.name),
        slug: String(template.slug),
        detail: String(template.widget_key),
        status: String(template.status),
      }))}
      errorMessage={error?.message}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
    />
  );
}
