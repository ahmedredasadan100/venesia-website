import "server-only";

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

export function getSeriesOptionsForCategory(
  options: TopicFilterOptions,
  categorySlug: string | null | undefined,
) {
  if (!categorySlug) return [];
  return options.seriesByCategorySlug[categorySlug] ?? [];
}

export function isSeriesAllowedForCategory(
  options: TopicFilterOptions,
  categorySlug: string | null | undefined,
  seriesSlug: string | null | undefined,
) {
  if (!seriesSlug) return true;
  if (!categorySlug) return false;
  return getSeriesOptionsForCategory(options, categorySlug).some((item) => item.slug === seriesSlug);
}
