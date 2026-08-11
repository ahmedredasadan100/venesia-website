import "server-only";

import { PUBLIC_CONTENT_VISIBILITY_CONTRACT } from "../content-public-visibility";
import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";

export type TopicCategoryFilterOption = {
  id: number;
  slug: string;
  name: string;
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

type SeriesRow = {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
};

export async function loadTopicFilterOptionsForAdmin(): Promise<TopicFilterOptions> {
  const supabase = getSupabaseAdmin();

  const [{ data: categories, error: categoriesError }, { data: seriesRows, error: seriesError }] =
    await Promise.all([
      supabase
        .from("topic_categories")
        .select("id,name,slug")
        .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
        .is("deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("topic_series")
        .select("id,name,slug,category_id")
        .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
        .is("deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt)
        .not("category_id", "is", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  if (categoriesError) logError("loadTopicFilterOptionsForAdmin: categories failed", categoriesError);
  if (seriesError) logError("loadTopicFilterOptionsForAdmin: series failed", seriesError);

  const categorySlugById = new Map<number, string>();
  for (const category of categories ?? []) {
    categorySlugById.set(category.id, category.slug);
  }

  const series: TopicSeriesFilterOption[] = ((seriesRows ?? []) as SeriesRow[])
    .filter((row) => row.category_id && categorySlugById.has(row.category_id))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryId: row.category_id as number,
    }));

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
    categories: (categories ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
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

export function isSeriesAllowedForCategories(
  options: TopicFilterOptions,
  categorySlugs: readonly string[],
  seriesSlug: string | null | undefined,
) {
  if (!seriesSlug) return true;
  if (!categorySlugs.length) return false;
  return getSeriesOptionsForCategories(options, categorySlugs).some((item) => item.slug === seriesSlug);
}
