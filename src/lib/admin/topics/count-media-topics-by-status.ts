import "server-only";

import { MEDIA_LIST_CONTENT_TYPES } from "../../../app/admin/content/media/media-content-config";
import { getSupabaseAdmin } from "../../supabase-admin";

export type MediaTopicStatusCounts = {
  published: number;
  draft: number;
  featured: number;
};

export async function countMediaTopicsByStatus(): Promise<MediaTopicStatusCounts> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("status, is_featured")
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const counts: MediaTopicStatusCounts = {
    published: 0,
    draft: 0,
    featured: 0,
  };

  for (const row of data ?? []) {
    if (row.status === "published") counts.published += 1;
    if (row.status === "draft") counts.draft += 1;
    if (row.is_featured) counts.featured += 1;
  }

  return counts;
}
