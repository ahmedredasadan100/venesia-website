import { z } from "zod";

import {
  ENTITY_SEO_SCORE_VERSION,
  isPersistedEntitySeoScore,
} from "../../seo/entity-seo-types.ts";
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
  seo_score: z.number().int().min(0).max(100).nullable().optional(),
  seo_score_version: z.number().int().positive().nullable().optional(),
  seo_score_input_hash: transitionalString,
});

const pagesReadModelSchema = z.object({
  rows: z.array(pagesReadModelRowSchema),
  total_count: z.coerce.number().int().nonnegative().finite(),
  page: z.number().int().positive(),
  contract_version: z.number().int().positive().optional(),
});

type AdaptPagesReadModelOptions = {
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
 * shapes. Collection reads consume only the persisted tuple and never invoke
 * the shared SEO calculator or reconstruct semantic Page inputs.
 */
export function adaptPagesReadModel(
  data: unknown,
  options: AdaptPagesReadModelOptions,
): AdaptedPagesReadModel {
  const readModel = pagesReadModelSchema.parse(data);
  const readModelContractVersion = readModel.contract_version ?? 1;
  const extendedContractAvailable = readModelContractVersion >= 3;

  return {
    rows: readModel.rows.map((source) => {
      const persisted = isPersistedEntitySeoScore(source)
        && source.seo_score_version === ENTITY_SEO_SCORE_VERSION
        ? source
        : null;
      const seoLabel = persisted
        ? persisted.seo_score >= 80
          ? "جيد جدًا"
          : persisted.seo_score >= 60
            ? "جيد"
            : persisted.seo_score >= 40
              ? "يحتاج تحسين"
              : "غير مكتمل"
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
        seoScore: persisted?.seo_score ?? null,
        seoLabel,
        seoBlockingErrors: null,
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
