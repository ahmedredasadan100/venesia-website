export const dynamic = "force-dynamic";

import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { FEATURED_EDITOR_PRESENTATION_VARIANTS, FEATURED_PRESENTATION_LABELS_AR } from "../../../../../lib/featured-modules/contract";
import { parseFeaturedModuleConfig } from "../../../../../lib/featured-modules/config";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  bulkFeaturedModules,
  createFeaturedModule,
  deleteFeaturedModule,
  duplicateFeaturedModule,
  toggleFeaturedModuleStatus,
} from "./actions";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function FeaturedModulesPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin().from("featured_module_templates")
      .select("id,name,slug,description,status,config,updated_at")
      .order("sort_order", { ascending: true }).order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("featuredTemplates").viewKey,
    ),
  ]);
  return (
    <BlockModuleManagerClient
      moduleKey="featured"
      moduleTitle="Featured"
      moduleDescription="قسم المحتوى المميز المستقل؛ المصدر والاختيار منفصلان عن Presentation، والموضع تديره Page Composition."
      rows={(templatesResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        variant: parseFeaturedModuleConfig(
          row.config && typeof row.config === "object" && !Array.isArray(row.config)
            ? row.config as Record<string, unknown>
            : null,
        ).presentation.variant,
        status: row.status,
      }))}
      createAction={createFeaturedModule}
      deleteAction={deleteFeaturedModule}
      duplicateAction={duplicateFeaturedModule}
      toggleAction={toggleFeaturedModuleStatus}
      bulkAction={bulkFeaturedModules}
      defaultVariant="editorial"
      variantOptions={FEATURED_EDITOR_PRESENTATION_VARIANTS.map((variant) => [variant, FEATURED_PRESENTATION_LABELS_AR[variant]])}
      loadError={templatesResult.error ? `تعذر قراءة Featured: ${templatesResult.error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
