import { z } from "zod";

import type { SeoScoreInput } from "../seo-score";
import type {
  PageEntityListMetrics,
  PageEntityListRow,
  PageSortField,
} from "./entity-list-contract";

const transitionalString = z.string().nullable().optional();

const pagesReadModelRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  page_type: z.string(),
  status: z.string(),
  block_count: z.number().int().nonnegative(),
  updated_at: transitionalString,
  seo_title: transitionalString,
  seo_description: transitionalString,
  seo_keywords: z.array(z.string()).nullable().optional(),
  focus_keyword: transitionalString,
  og_image: transitionalString,
  og_image_alt: transitionalString,
});

const completePageSeoSourceSchema = z.object({
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
  contract_version: z.number().int().positive().optional(),
});

type PageSeoAnalyzerOutput = {
  score: number;
  label: string;
  blockingErrors: number;
};

type AdaptPagesReadModelOptions = {
  analyzeSeo: (input: SeoScoreInput) => PageSeoAnalyzerOutput;
  legacySortFields: readonly PageSortField[];
  extendedSortFields: readonly PageSortField[];
};

export type AdaptedPagesReadModel = {
  rows: PageEntityListRow[];
  totalRows: number;
  page: number;
  metrics: PageEntityListMetrics;
};

/**
 * Transitional translation boundary for the current and pending Pages RPC
 * shapes. Missing extended fields remain explicit nulls and never become
 * synthesized SEO inputs.
 */
export function adaptPagesReadModel(
  data: unknown,
  options: AdaptPagesReadModelOptions,
): AdaptedPagesReadModel {
  const readModel = pagesReadModelSchema.parse(data);
  const readModelContractVersion = readModel.contract_version ?? 1;
  const extendedContractAvailable = readModelContractVersion >= 2;

  return {
    rows: readModel.rows.map((source) => {
      const seoSource = completePageSeoSourceSchema.safeParse(source);
      const seo = seoSource.success
        ? options.analyzeSeo({
            profile: "entity",
            title: source.title,
            description: "",
            content: "",
            slug:
              source.path === "/"
                ? ""
                : source.path.replace(/^\/+/, ""),
            image: "",
            imageAlt: "",
            ogImage: seoSource.data.og_image ?? "",
            ogImageAlt: seoSource.data.og_image_alt,
            seoTitle: seoSource.data.seo_title,
            seoDescription: seoSource.data.seo_description,
            seoKeywords: seoSource.data.seo_keywords,
            focusKeyword: seoSource.data.focus_keyword,
            faq: [],
          })
        : null;

      return {
        id: source.id,
        title: source.title,
        slug: source.slug,
        path: source.path,
        page_type: source.page_type,
        status: source.status,
        moduleCount: source.block_count,
        updatedAt: source.updated_at ?? null,
        seoScore: seo?.score ?? null,
        seoLabel: seo?.label ?? null,
        seoBlockingErrors: seo?.blockingErrors ?? null,
      };
    }),
    totalRows: readModel.total_count,
    page: readModel.page,
    metrics: {
      readModelContractVersion,
      supportedSortFields: [
        ...(extendedContractAvailable
          ? options.extendedSortFields
          : options.legacySortFields),
      ],
    },
  };
}
