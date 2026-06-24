import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import HeroManagerClient from "./HeroManagerClient";

type HeroRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  style_preset: string;
  source_type: string;
  is_visible: boolean;
  updated_at: string;
  hero_assignments: Array<{
    id: number;
    target_type: string;
    target_slug: string | null;
    path: string | null;
    is_active: boolean;
  }>;
};

export default async function HeroesManagerPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id,name,slug,description,variant,style_preset,source_type,is_visible,updated_at,hero_assignments(id,target_type,target_slug,path,is_active)")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة الهيروهات: {error.message}
      </div>
    );
  }

  return <HeroManagerClient heroes={(data ?? []) as HeroRow[]} />;
}
