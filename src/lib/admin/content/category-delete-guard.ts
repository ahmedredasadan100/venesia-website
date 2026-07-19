import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { createAdminPreDeleteValidation } from "../entity-list/pre-delete-validation";

export type CategoryDeleteDependencies = {
  topicCount: number;
  seriesCount: number;
  childrenCount: number;
};

export async function loadCategoryDeleteDependencies(
  categoryId: number,
): Promise<CategoryDeleteDependencies> {
  const supabase = getSupabaseAdmin();
  const [topics, series, children] = await Promise.all([
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId),
    supabase
      .from("topic_series")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId),
    supabase
      .from("topic_categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", categoryId),
  ]);

  const error = topics.error ?? series.error ?? children.error;
  if (error) throw new Error(error.message);

  return {
    topicCount: topics.count ?? 0,
    seriesCount: series.count ?? 0,
    childrenCount: children.count ?? 0,
  };
}

function dependencyLabel(key: string, count: number) {
  if (key === "topics") return `${count} موضوعات`;
  if (key === "series") return `${count} سلسلة محتوى`;
  return `${count} تصنيفات فرعية`;
}

export function getCategoryDeleteBlockMessage(
  dependencies: CategoryDeleteDependencies,
  options: { includeTopics?: boolean } = {},
) {
  const validation = createAdminPreDeleteValidation([
    ...(options.includeTopics
      ? [{ key: "topics", count: dependencies.topicCount }]
      : []),
    { key: "series", count: dependencies.seriesCount },
    { key: "children", count: dependencies.childrenCount },
  ]);
  if (!validation.blocked) return null;
  const details = validation.dependencies
    .map((dependency) => dependencyLabel(dependency.key, dependency.count))
    .join(" و");
  return `لا يمكن حذف التصنيف لأنه مرتبط بـ ${details}. انقل العناصر المرتبطة إلى تصنيف آخر أولًا.`;
}
