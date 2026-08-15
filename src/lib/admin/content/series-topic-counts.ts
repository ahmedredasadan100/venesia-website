import { getSupabaseAdmin } from "../../supabase-admin";

export type SeriesTopicCountsResult = {
  counts: Map<number, number>;
  error: { message: string } | null;
};

/**
 * Single owner of the per-series topic count semantics used by the admin
 * series list (initial page render and the AJAX fresh-rows refresh path).
 *
 * Soft-deleted topics (deleted_at IS NOT NULL) never count toward a series.
 * Archived-but-not-deleted topics keep counting, matching the topics list.
 */
export async function loadActiveSeriesTopicCounts(): Promise<SeriesTopicCountsResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("series_id")
    .not("series_id", "is", null)
    .is("deleted_at", null);

  const counts = new Map<number, number>();
  (data ?? []).forEach((row) => {
    if (!row.series_id) return;
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  });

  return { counts, error };
}
