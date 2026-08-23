import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import HeroManagerClient from "./HeroManagerClient";

type PageProps = {
  searchParams?: Promise<{ notice?: string }> | { notice?: string };
};

export default async function HeroesManagerPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const [heroesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("hero_templates")
      .select("id,name,slug,description,status,variant,hero_assignments(id,path,is_active)")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("heroTemplates").viewKey,
    ),
  ]);
  const { data, error } = heroesResult;

  return (
    <HeroManagerClient
      heroes={data ?? []}
      loadError={error ? `حدث خطأ أثناء قراءة الهيروهات: ${error.message}` : null}
      mediaSynchronizationWarning={
        resolvedSearch.notice === "saved_with_media_sync_warning"
      }
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
