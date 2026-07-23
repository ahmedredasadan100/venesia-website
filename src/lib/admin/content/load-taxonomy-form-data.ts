import "server-only";

import { notFound } from "next/navigation";

import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  getCategoryAndDescendantIds,
  type AdminContentCategory,
} from "./category-hierarchy";
import { getSupabaseAdmin } from "../../supabase-admin";

export type TaxonomyFormOption = {
  value: string;
  label: string;
  depth?: number;
};

export type CategoryFormRecord = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: boolean | null;
  color_token: string | null;
};

export type SeriesFormRecord = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  category_id: number | null;
};

async function loadCategoryRows() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, sort_order, is_active, color_token")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminContentCategory[];
}

function toOptions(rows: AdminContentCategory[]): TaxonomyFormOption[] {
  return flattenAdminCategoryTree(buildAdminCategoryTree(rows)).map((row) => ({
    value: String(row.id),
    label: row.name,
    depth: row.depth,
  }));
}

export async function loadCategoryParentFormOptions(excludeId?: number) {
  const rows = await loadCategoryRows();
  const blockedIds = excludeId
    ? new Set(getCategoryAndDescendantIds(rows, excludeId))
    : new Set<number>();

  return toOptions(rows.filter((row) => !blockedIds.has(row.id)));
}

export async function loadSeriesCategoryFormOptions(currentCategoryId?: number | null) {
  const rows = await loadCategoryRows();
  return toOptions(
    rows.filter(
      (row) => row.is_active !== false || row.id === currentCategoryId,
    ),
  );
}

export async function loadCategoryFormRecord(id: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active, color_token")
    .eq("id", id)
    .maybeSingle<CategoryFormRecord>();

  if (error || !data) notFound();
  return data;
}

export async function loadSeriesFormRecord(id: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id, name, slug, status, category_id")
    .eq("id", id)
    .maybeSingle<SeriesFormRecord>();

  if (error || !data) notFound();
  return data;
}
