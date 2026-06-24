import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";

export type TopicCategoryOption = {
  id: number;
  name: string;
  slug: string;
};

export async function loadActiveTopicCategoriesForAdmin(): Promise<TopicCategoryOption[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []) as TopicCategoryOption[];
}
