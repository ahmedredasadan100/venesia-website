import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";

export type TopicWithoutImageRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  contentType: string;
  categorySlug: string | null;
  updatedAt: string | null;
};

export async function listTopicsWithoutImage(input: {
  query?: string;
  status?: string;
  contentType?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(12, Math.trunc(input.pageSize ?? 24)));
  let query = getSupabaseAdmin()
    .from("topics")
    .select("id,title,slug,status,content_type,category_slug,updated_at", { count: "exact" })
    .is("deleted_at", null)
    .or("image.is.null,image.eq.");
  const safeSearch = input.query?.trim().replace(/[,%_()]/g, " ").slice(0, 120);
  if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.contentType && input.contentType !== "all") query = query.eq("content_type", input.contentType);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []).map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ""),
      slug: String(row.slug ?? ""),
      status: String(row.status ?? "draft"),
      contentType: String(row.content_type ?? "article"),
      categorySlug: typeof row.category_slug === "string" ? row.category_slug : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })) satisfies TopicWithoutImageRow[],
    page,
    pageSize,
    total,
    totalPages: total ? Math.ceil(total / pageSize) : 0,
  };
}
