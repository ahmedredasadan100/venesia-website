import "server-only";

import type { Database } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  getCategoryAndDescendantIds,
  type AdminContentCategory,
} from "./category-hierarchy";

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
  status: string | null;
  color_token: string | null;
  updated_at: string;
};

export type SeriesFormRecord = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  category_id: number | null;
  updated_at: string;
};

export type TopicFormRecord = Database["public"]["Tables"]["topics"]["Row"];

export type TopicTaxonomySeriesOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
  category_id: number | null;
};

export type TopicTaxonomyFormDependencies = {
  categories: AdminContentCategory[];
  series: TopicTaxonomySeriesOption[];
};

type TaxonomyFormLoadScope =
  | "category_options"
  | "category_parent_contract"
  | "series_options"
  | "series_options_contract"
  | "category_record"
  | "series_record"
  | "topic_record"
  | "topic_taxonomy_dependencies"
  | "topic_taxonomy_contract"
  | "topic_taxonomy_required_options"
  | "topic_record_contract";

const TAXONOMY_FORM_LOAD_ERROR_MESSAGE =
  "تعذر تجهيز بيانات النموذج الإداري. أعد المحاولة.";

/**
 * Safe error for the Admin retry boundary. The public message is deliberately
 * fixed; the original cause remains server-side for observability only.
 */
export class TaxonomyFormLoadError extends Error {
  readonly code = "ADMIN_TAXONOMY_FORM_LOAD_FAILED";
  readonly scope: TaxonomyFormLoadScope;

  constructor(scope: TaxonomyFormLoadScope, cause?: unknown) {
    super(TAXONOMY_FORM_LOAD_ERROR_MESSAGE, { cause });
    this.name = "TaxonomyFormLoadError";
    this.scope = scope;
  }
}

export type TaxonomyFormDataResult<T> = {
  status: "data";
  data: T;
};

export type TaxonomyFormNotFoundResult = {
  status: "not_found";
};

export type TaxonomyFormErrorResult = {
  status: "error";
  error: TaxonomyFormLoadError;
};

export type TaxonomyFormRecordResult<T> =
  | TaxonomyFormDataResult<T>
  | TaxonomyFormNotFoundResult
  | TaxonomyFormErrorResult;

export type TaxonomyFormDependencyResult<T> =
  | TaxonomyFormDataResult<T>
  | TaxonomyFormErrorResult;

function dataResult<T>(data: T): TaxonomyFormDataResult<T> {
  return { status: "data", data };
}

function errorResult(
  scope: TaxonomyFormLoadScope,
  cause?: unknown,
): TaxonomyFormErrorResult {
  return { status: "error", error: new TaxonomyFormLoadError(scope, cause) };
}

async function loadCategoryRows(
  scope: "category_options" | "series_options",
): Promise<
  TaxonomyFormDependencyResult<AdminContentCategory[]>
> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id, name, slug, parent_id, sort_order, is_active, status, color_token")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) return errorResult(scope, error);
    if (data === null) return errorResult(scope);
    return dataResult(data);
  } catch (cause) {
    return errorResult(scope, cause);
  }
}

function toOptions(rows: AdminContentCategory[]): TaxonomyFormOption[] {
  return flattenAdminCategoryTree(buildAdminCategoryTree(rows)).map((row) => ({
    value: String(row.id),
    label: row.name,
    depth: row.depth,
  }));
}

export async function loadCategoryParentFormOptions(
  {
    excludeCategoryId,
    persistedParentId,
  }: {
    excludeCategoryId?: number;
    persistedParentId?: number | null;
  } = {},
): Promise<TaxonomyFormDependencyResult<TaxonomyFormOption[]>> {
  const result = await loadCategoryRows("category_options");
  if (result.status === "error") return result;

  const blockedIds = excludeCategoryId
    ? new Set(getCategoryAndDescendantIds(result.data, excludeCategoryId))
    : new Set<number>();
  const allowedRows = result.data.filter((row) => !blockedIds.has(row.id));

  if (
    persistedParentId != null &&
    !allowedRows.some((row) => row.id === persistedParentId)
  ) {
    return errorResult("category_parent_contract");
  }

  return dataResult(toOptions(allowedRows));
}

export async function loadSeriesCategoryFormOptions(
  currentCategoryId?: number | null,
): Promise<TaxonomyFormDependencyResult<TaxonomyFormOption[]>> {
  const result = await loadCategoryRows("series_options");
  if (result.status === "error") return result;

  const selectableRows = result.data.filter(
    (row) =>
      row.id === currentCategoryId ||
      (row.is_active === true && row.status === "published"),
  );
  if (
    selectableRows.length === 0 ||
    (currentCategoryId != null &&
      !selectableRows.some((row) => row.id === currentCategoryId))
  ) {
    return errorResult("series_options_contract");
  }

  return dataResult(toOptions(selectableRows));
}

export async function loadCategoryFormRecord(
  id: number,
): Promise<TaxonomyFormRecordResult<CategoryFormRecord>> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id, name, slug, parent_id, is_active, status, color_token, updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return errorResult("category_record", error);
    if (data === null) return { status: "not_found" };
    const updatedAt = data.updated_at;
    if (typeof updatedAt !== "string" || updatedAt.trim() === "") {
      return errorResult("category_record");
    }
    return dataResult({ ...data, updated_at: updatedAt });
  } catch (cause) {
    return errorResult("category_record", cause);
  }
}

export async function loadSeriesFormRecord(
  id: number,
): Promise<TaxonomyFormRecordResult<SeriesFormRecord>> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_series")
      .select("id, name, slug, status, category_id, updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return errorResult("series_record", error);
    if (data === null) return { status: "not_found" };
    if (typeof data.updated_at !== "string" || data.updated_at.trim() === "") {
      return errorResult("series_record");
    }
    return dataResult(data);
  } catch (cause) {
    return errorResult("series_record", cause);
  }
}

export async function loadTopicFormRecord(
  id: number,
): Promise<TaxonomyFormRecordResult<TopicFormRecord>> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return errorResult("topic_record", error);
    if (data === null) return { status: "not_found" };
    return dataResult(data);
  } catch (cause) {
    return errorResult("topic_record", cause);
  }
}

export function invalidTopicFormRecord(
  cause?: unknown,
): TaxonomyFormErrorResult {
  return errorResult("topic_record_contract", cause);
}

export async function loadTopicTaxonomyFormDependencies({
  currentCategoryId,
  currentSeriesId,
}: {
  currentCategoryId?: number | null;
  currentSeriesId?: number | null;
} = {}): Promise<TaxonomyFormDependencyResult<TopicTaxonomyFormDependencies>> {
  try {
    const supabase = getSupabaseAdmin();
    const [categoriesResult, seriesResult] = await Promise.all([
      supabase
        .from("topic_categories")
        .select("id,name,slug,parent_id,sort_order,is_active,status,color_token")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("topic_series")
        .select("id,name,slug,status,deleted_at,category_id")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (categoriesResult.error || seriesResult.error) {
      return errorResult(
        "topic_taxonomy_dependencies",
        categoriesResult.error ?? seriesResult.error,
      );
    }
    if (categoriesResult.data === null || seriesResult.data === null) {
      return errorResult("topic_taxonomy_dependencies");
    }

    const persistedCategory = currentCategoryId == null
      ? null
      : categoriesResult.data.find(
          (category) => category.id === currentCategoryId,
        ) ?? null;
    const persistedSeries = currentSeriesId == null
      ? null
      : seriesResult.data.find((item) => item.id === currentSeriesId) ?? null;
    const persistedRelationshipInvalid =
      currentSeriesId != null &&
      (currentCategoryId == null ||
        persistedSeries == null ||
        persistedSeries.category_id !== currentCategoryId);

    if (
      (currentCategoryId != null && persistedCategory == null) ||
      persistedRelationshipInvalid
    ) {
      return errorResult("topic_taxonomy_contract");
    }

    const categories = categoriesResult.data.filter(
      (category) =>
        category.id === currentCategoryId ||
        (category.status === "published" && category.is_active === true),
    );
    const series = seriesResult.data.filter(
      (item) => item.status === "published" || item.id === currentSeriesId,
    );

    if (categories.length === 0) {
      return errorResult("topic_taxonomy_required_options");
    }

    return dataResult({ categories, series });
  } catch (cause) {
    return errorResult("topic_taxonomy_dependencies", cause);
  }
}
