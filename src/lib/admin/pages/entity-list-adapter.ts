import "server-only";

import { z } from "zod";

import { analyzeEntitySeo } from "../seo-score";
import type { AdminEntityListAdapter } from "../entity-list/data-engine/adapter";
import {
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  pagesQueryContract,
  pagesEntityListResultSchema,
  type PageEntityListRow,
  type PageFilters,
  type PageSortField,
} from "./entity-list-contract";

const pagesReadModelRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  page_type: z.string(),
  status: z.string(),
  block_count: z.number().int().nonnegative(),
  updated_at: z.string(),
  seo_title: z.string(),
  seo_description: z.string(),
  seo_keywords: z.array(z.string()),
  focus_keyword: z.string(),
  og_image: z.string().nullable(),
  og_image_alt: z.string(),
});

const pagesReadModelSchema = z.object({
  rows: z.array(pagesReadModelRowSchema),
  total_count: z.coerce.number().int().nonnegative().finite(),
  page: z.number().int().positive(),
});

export class PagesEntityListDatabaseError extends Error {
  readonly code: string;
  readonly details: string;
  readonly hint: string;

  constructor(error: { message: string; code: string; details: string; hint: string }) {
    super(error.message);
    this.name = "PagesEntityListDatabaseError";
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

export async function loadPagesEntityListResult(
  query: AdminEntityListQuery<PageFilters, PageSortField>,
) {
  // One database list operation: the read model owns count, sorting, paging,
  // and assignment aggregation as a single stable snapshot.
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_pages", {
    p_page: query.page,
    p_page_size: query.pageSize,
    p_sort_field: query.sort.field,
    p_sort_direction: query.sort.direction,
    p_search: query.search,
  });
  if (error) throw new PagesEntityListDatabaseError(error);

  const readModel = pagesReadModelSchema.parse(data);
  const totalRows = readModel.total_count;
  const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));
  const page = readModel.page;

  return pagesEntityListResultSchema.parse({
    rows: readModel.rows.map((source) => {
      const {
        block_count,
        updated_at,
        seo_title,
        seo_description,
        seo_keywords,
        focus_keyword,
        og_image,
        og_image_alt,
        ...row
      } = source;
      // This deliberately mirrors PageSeoPanel's entity-profile source shape:
      // Pages have no description/content/content-image fields in the current
      // domain contract, so those official inputs remain empty in both places.
      const seo = analyzeEntitySeo({
        profile: "entity",
        title: source.title,
        description: "",
        content: "",
        slug:
          source.path === "/" ? "" : source.path.replace(/^\/+/, ""),
        image: "",
        imageAlt: "",
        ogImage: og_image ?? "",
        ogImageAlt: og_image_alt,
        seoTitle: seo_title,
        seoDescription: seo_description,
        seoKeywords: seo_keywords,
        focusKeyword: focus_keyword,
        faq: [],
      });

      return {
        ...row,
        moduleCount: block_count,
        updatedAt: updated_at,
        seoScore: seo.score,
        seoLabel: seo.label,
        seoBlockingErrors: seo.blockingErrors,
      };
    }),
    pagination: { page, pageSize: query.pageSize, totalRows, totalPages },
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  });
}

export const pagesEntityListAdapter: AdminEntityListAdapter<
  "pages", PageFilters, PageSortField, PageEntityListRow
> = {
  entity: "pages",
  queryContract: pagesQueryContract,
  resultSchema: pagesEntityListResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadPagesEntityListResult,
};
