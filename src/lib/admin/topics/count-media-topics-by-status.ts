import "server-only";

import { MEDIA_LIST_CONTENT_TYPES } from "../../../app/admin/content/media/media-content-config";
import { getSupabaseAdmin } from "../../supabase-admin";

export type MediaTopicStatusCounts = {
  published: number;
  draft: number;
  featured: number;
};

function mediaTopicsCountQuery() {
  return getSupabaseAdmin()
    .from("topics")
    .select("*", { count: "exact", head: true })
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);
}

async function readCount(
  label: string,
  result: { count: number | null; error: { message: string } | null },
): Promise<number> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.count ?? 0;
}

export async function countMediaTopicsByStatus(): Promise<MediaTopicStatusCounts> {
  const [publishedResult, draftResult, featuredResult] = await Promise.all([
    mediaTopicsCountQuery().eq("status", "published"),
    mediaTopicsCountQuery().eq("status", "draft"),
    mediaTopicsCountQuery().eq("is_featured", true),
  ]);

  const [published, draft, featured] = await Promise.all([
    readCount("published", publishedResult),
    readCount("draft", draftResult),
    readCount("featured", featuredResult),
  ]);

  return { published, draft, featured };
}
