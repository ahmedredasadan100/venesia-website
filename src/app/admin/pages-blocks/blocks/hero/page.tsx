import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import HeroManagerClient from "./HeroManagerClient";

type PageProps = {
  searchParams?: Promise<{ notice?: string }> | { notice?: string };
};

type HeroRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_visible: boolean;
  hero_assignments: Array<{
    id: number;
    path: string | null;
    is_active: boolean;
  }>;
};

export default async function HeroesManagerPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const { data, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id,name,slug,description,is_visible,hero_assignments(id,path,is_active)")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة الهيروهات: {error.message}
      </div>
    );
  }

  return (
    <HeroManagerClient
      heroes={(data ?? []) as HeroRow[]}
      mediaSynchronizationWarning={
        resolvedSearch.notice === "saved_with_media_sync_warning"
      }
    />
  );
}
