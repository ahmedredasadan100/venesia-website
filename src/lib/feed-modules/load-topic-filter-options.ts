import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  type AdminContentCategory,
} from "../admin/content/category-hierarchy";

export type TopicCategoryFilterOption = {
  id: number;
  slug: string;
  name: string;
  parentId: number | null;
  depth: number;
};

export type TopicSeriesFilterOption = {
  id: number;
  slug: string;
  name: string;
  categoryId: number;
};

export type TopicFilterOptions = {
  categories: TopicCategoryFilterOption[];
  series: TopicSeriesFilterOption[];
  seriesByCategorySlug: Record<string, TopicSeriesFilterOption[]>;
};

export async function loadTopicFilterOptionsForAdmin(): Promise<TopicFilterOptions> {
  const supabase = getSupabaseAdmin();

  const [{ data: categories, error: categoriesError }, { data: seriesRows, error: seriesError }] =
    await Promise.all([
      supabase
        .from("topic_categories")
        .select("id,name,slug,parent_id,sort_order,is_active,status")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("topic_series")
        .select("id,name,slug,category_id")
        .eq("status", "published")
        .is("deleted_at", null)
        .not("category_id", "is", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  if (categoriesError) logError("loadTopicFilterOptionsForAdmin: categories failed", categoriesError);
  if (seriesError) logError("loadTopicFilterOptionsForAdmin: series failed", seriesError);

  const categoryRows = (categories ?? []) as AdminContentCategory[];
  const orderedCategories = flattenAdminCategoryTree(
    buildAdminCategoryTree(categoryRows),
  );
  const categorySlugById = new Map<number, string>();
  for (const category of orderedCategories) {
    categorySlugById.set(category.id, category.slug);
  }

  const series: TopicSeriesFilterOption[] = (seriesRows ?? []).flatMap((row) => {
    const categoryId = row.category_id;
    if (categoryId === null || !categorySlugById.has(categoryId)) return [];
    return [{
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryId,
    }];
  });

  const seriesByCategorySlug: Record<string, TopicSeriesFilterOption[]> = {};

  for (const item of series) {
    const categorySlug = categorySlugById.get(item.categoryId);
    if (!categorySlug) continue;

    if (!seriesByCategorySlug[categorySlug]) seriesByCategorySlug[categorySlug] = [];
    seriesByCategorySlug[categorySlug].push(item);
  }

  for (const categorySlug of Object.keys(seriesByCategorySlug)) {
    seriesByCategorySlug[categorySlug].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  return {
    categories: orderedCategories.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      parentId: row.parent_id,
      depth: row.depth,
    })),
    series,
    seriesByCategorySlug,
  };
}

export function getSeriesOptionsForCategories(
  options: TopicFilterOptions,
  categorySlugs: readonly string[],
) {
  const seen = new Set<number>();
  return categorySlugs.flatMap((categorySlug) =>
    (options.seriesByCategorySlug[categorySlug] ?? []).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  );
}

export function filterSeriesSlugsForCategories(
  options: TopicFilterOptions,
  categorySlugs: readonly string[],
  seriesSlugs: readonly string[],
) {
  if (!categorySlugs.length || !seriesSlugs.length) return [];

  const allowedSlugs = new Set(
    getSeriesOptionsForCategories(options, categorySlugs).map((item) => item.slug),
  );
  return [...new Set(seriesSlugs)].filter((slug) => allowedSlugs.has(slug));
}
