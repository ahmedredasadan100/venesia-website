import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";

export type ArticleTopicStatusCounts = {
  total: number;
  published: number;
  draft: number;
  unpublished: number;
  archived: number;
};

function articleTopicsCountQuery() {
  return getSupabaseAdmin()
    .from("topics")
    .select("*", { count: "exact", head: true })
    .eq("content_type", "article");
}

async function readCount(
  label: string,
  result: { count: number | null; error: { message: string } | null },
): Promise<number> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.count ?? 0;
}

export async function countArticleTopicsByStatus(): Promise<ArticleTopicStatusCounts> {
  const [archivedResult, publishedResult, draftResult, unpublishedResult, totalResult] =
    await Promise.all([
      articleTopicsCountQuery().not("deleted_at", "is", null),
      articleTopicsCountQuery().is("deleted_at", null).eq("status", "published"),
      articleTopicsCountQuery().is("deleted_at", null).eq("status", "draft"),
      articleTopicsCountQuery().is("deleted_at", null).eq("status", "unpublished"),
      articleTopicsCountQuery().is("deleted_at", null),
    ]);

  const [archived, published, draft, unpublished, total] = await Promise.all([
    readCount("archived", archivedResult),
    readCount("published", publishedResult),
    readCount("draft", draftResult),
    readCount("unpublished", unpublishedResult),
    readCount("total", totalResult),
  ]);

  return { total, published, draft, unpublished, archived };
}
