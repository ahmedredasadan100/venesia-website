import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { buildAdminListSearchOrFilter } from "../admin-list-search";
import {
  CONTENT_STATUS_VALUES,
  type ContentStatus,
} from "../content/content-status-metadata";
import { isContentType, type ContentType } from "../content/content-types";

export type TopicWithoutImageRow = {
  id: number;
  title: string;
  slug: string;
  status: ContentStatus;
  contentType: ContentType;
  categorySlug: string | null;
  updatedAt: string | null;
};

function parseContentStatus(value: unknown): ContentStatus {
  if (
    typeof value === "string" &&
    CONTENT_STATUS_VALUES.includes(value as ContentStatus)
  ) {
    return value as ContentStatus;
  }
  throw new Error(`Unsupported topic status: ${String(value ?? "(empty)")}`);
}

function parseContentType(value: unknown): ContentType {
  if (isContentType(value)) return value;
  throw new Error(
    `Unsupported topic content type: ${String(value ?? "(empty)")}`,
  );
}

export async function queryTopicsWithoutImagePage(input: {
  query: string;
  status: ContentStatus | "all";
  contentType: ContentType | "all";
  page: number;
  pageSize: number;
  sortDirection: "asc" | "desc";
}) {
  const page = input.page;
  const pageSize = input.pageSize;
  let query = getSupabaseAdmin()
    .from("topics")
    .select("id,title,slug,status,content_type,category_slug,updated_at", { count: "exact" })
    .is("deleted_at", null)
    .or("image.is.null,image.eq.");
  const searchFilter = buildAdminListSearchOrFilter(
    ["title", "slug"],
    input.query,
  );
  if (searchFilter) query = query.or(searchFilter);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.contentType && input.contentType !== "all") query = query.eq("content_type", input.contentType);
  const from = (page - 1) * pageSize;
  const ascending = input.sortDirection === "asc";
  const { data, error, count } = await query
    .order("updated_at", { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ""),
      slug: String(row.slug ?? ""),
      status: parseContentStatus(row.status),
      contentType: parseContentType(row.content_type),
      categorySlug: typeof row.category_slug === "string" ? row.category_slug : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })) satisfies TopicWithoutImageRow[],
    totalRows: count ?? 0,
  };
}
