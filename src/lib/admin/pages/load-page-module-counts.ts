import "server-only";

import { ALL_ASSIGNMENT_TABLES } from "../../page-blocks/block-module-registry";
import { getSupabaseAdmin } from "../../supabase-admin";

export async function loadPageModuleCounts(pageIds: number[]) {
  if (!pageIds.length) return new Map<number, number>();

  const counts = new Map<number, number>();
  pageIds.forEach((id) => counts.set(id, 0));

  await Promise.all(
    ALL_ASSIGNMENT_TABLES.map(async (table) => {
      const { data } = await getSupabaseAdmin().from(table).select("page_id").in("page_id", pageIds);
      for (const row of data ?? []) {
        counts.set(row.page_id, (counts.get(row.page_id) ?? 0) + 1);
      }
    }),
  );

  const { data: heroAssignments } = await getSupabaseAdmin()
    .from("hero_assignments")
    .select("target_id")
    .eq("target_type", "page")
    .eq("is_active", true)
    .in("target_id", pageIds);

  for (const row of heroAssignments ?? []) {
    counts.set(row.target_id, (counts.get(row.target_id) ?? 0) + 1);
  }

  return counts;
}
