import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import BlockTemplateSummaryListClient from "../BlockTemplateSummaryListClient";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function MediaHubModulesPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("media_hub_module_templates")
      .select("id,name,slug,section_key,status,sort_order")
      .order("sort_order"),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("mediaHubTemplates").viewKey,
    ),
  ]);
  const { data: templates, error } = templatesResult;

  return (
    <BlockTemplateSummaryListClient
      moduleKey="media-hub"
      title="Media Hub Modules"
      description="قوالب سكاشن Hub في /media-center — الظهور والترتيب يُدار من ربط الصفحة."
      detailLabel="Section"
      rows={(templates ?? []).map((template) => ({
        id: Number(template.id),
        name: String(template.name),
        slug: String(template.slug),
        detail: String(template.section_key),
        status: String(template.status),
      }))}
      errorMessage={error?.message}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
