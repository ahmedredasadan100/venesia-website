import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";

export async function countProjectsByType() {
  const supabase = getSupabaseAdmin();
  const [residential, commercial] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("type", "residential"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("type", "commercial"),
  ]);

  return {
    residential: residential.count ?? 0,
    commercial: commercial.count ?? 0,
    residentialError: residential.error?.message ?? null,
    commercialError: commercial.error?.message ?? null,
    total: (residential.count ?? 0) + (commercial.count ?? 0),
  };
}
