import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";

export type ArticleTopicStatusCounts = {
  total: number;
  published: number;
  draft: number;
  unpublished: number;
  archived: number;
};

export async function countArticleTopicsByStatus(): Promise<ArticleTopicStatusCounts> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("status, deleted_at")
    .eq("content_type", "article");

  if (error) throw new Error(error.message);

  const counts: ArticleTopicStatusCounts = {
    total: 0,
    published: 0,
    draft: 0,
    unpublished: 0,
    archived: 0,
  };

  for (const row of data ?? []) {
    if (row.deleted_at) {
      counts.archived += 1;
      continue;
    }

    counts.total += 1;

    if (row.status === "published") counts.published += 1;
    else if (row.status === "draft") counts.draft += 1;
    else if (row.status === "unpublished") counts.unpublished += 1;
  }

  return counts;
}
