import "server-only";

import { getAdminUserById } from "../../../../../lib/admin/auth/admin-users";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { getAdminContentSeriesCategoryError } from "../../../../../lib/admin/content/category-hierarchy";
import { validateEntitySeoValues } from "../../../../../lib/seo/entity-seo-types";
import {
  buildArticleBatchImportFingerprint,
  findDuplicateValues,
  articleBatchImportEnvelopeSchema,
  articleBatchImportItemSchema,
  zodIssuesToBatchErrors,
  type ArticleBatchImportError,
  type ArticleBatchImportItem,
  type ArticleBatchImportTarget,
} from "./batch-import-schema";
import {
  ArticleSlugConflictError,
  createArticleDomainRecord,
} from "./create-domain";
import {
  getDraftBlockingChecks,
  getPayload,
  getPublishBlockingChecks,
  type TopicPayload,
} from "./helpers";
import type { CategoryRow, SeriesRow } from "./types";
import {
  getCategory,
  getConflictingTopicSlugs,
  getSeries,
} from "./validation";
import { revalidateUnifiedContentBatchPaths } from "../editor-actions/revalidate";

type ValidationGroup = {
  valid: boolean;
  errors: ArticleBatchImportError[];
};

export type ArticleBatchImportDryRunItem = {
  index: number;
  title: string;
  sourceSlug: string;
  slug: string;
  status: "valid" | "invalid";
  valid: boolean;
  slugConflict: {
    conflict: boolean;
    scopes: ("dataset" | "database")[];
  };
  categorySeriesValidation: ValidationGroup;
  seoValidation: ValidationGroup;
  faqValidation: ValidationGroup & { count: number | null };
  publishReadiness: {
    ready: boolean;
    errors: ArticleBatchImportError[];
  };
  errors: ArticleBatchImportError[];
};

export type ArticleBatchImportDryRunReport = {
  mode: "dry_run";
  batchKey: string | null;
  fingerprint: string;
  total: number;
  valid: number;
  invalid: number;
  duplicateSlugs: string[];
  target: {
    requested: ArticleBatchImportTarget | null;
    resolved: {
      category: CategoryRow;
      series: SeriesRow;
    } | null;
    valid: boolean;
    errors: ArticleBatchImportError[];
  };
  errors: ArticleBatchImportError[];
  articles: ArticleBatchImportDryRunItem[];
};

export type ArticleBatchImportExecutionItem = {
  index: number;
  title: string;
  slug: string;
  outcome: "created" | "failed" | "skipped";
  id?: number;
  errors: ArticleBatchImportError[];
  warnings: string[];
};

export type ArticleBatchImportExecutionReport = {
  mode: "execute";
  status: "completed" | "completed_with_failures" | "blocked";
  batchKey: string | null;
  fingerprint: string;
  total: number;
  created: number;
  failed: number;
  skipped: number;
  duplicateSlugs: string[];
  createdIds: number[];
  createdSlugs: string[];
  categorySeriesUsed: {
    category: CategoryRow;
    series: SeriesRow;
  } | null;
  errors: ArticleBatchImportError[];
  warnings: string[];
  articles: ArticleBatchImportExecutionItem[];
};

type AnalyzedArticle = {
  item: ArticleBatchImportItem;
  payload: TopicPayload;
};

type Analysis = {
  report: ArticleBatchImportDryRunReport;
  target: { category: CategoryRow; series: SeriesRow } | null;
  analyzedArticles: Map<number, AnalyzedArticle>;
};

function batchError(
  code: string,
  message: string,
  field: string | null = null,
): ArticleBatchImportError {
  return { code, field, message };
}

function dedupeErrors(errors: readonly ArticleBatchImportError[]) {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.code}:${error.field ?? ""}:${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rawIdentity(value: unknown, key: "title" | "slug") {
  if (!value || typeof value !== "object") return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

function rawFaqCount(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const faq = (value as Record<string, unknown>).faq;
  return Array.isArray(faq) ? faq.length : null;
}

function setBoolean(formData: FormData, key: string, value: boolean) {
  formData.set(key, value ? "true" : "false");
}

function toArticleFormData(item: ArticleBatchImportItem) {
  const formData = new FormData();
  formData.set("title", item.title);
  formData.set("slug", item.slug);
  formData.set("excerpt", item.excerpt);
  formData.set("content", item.content);
  formData.set("image", item.image);
  formData.set("image_alt", item.image_alt);
  formData.set("category_id", String(item.category_id));
  formData.set("series_id", String(item.series_id));
  formData.set("seo_title", item.seo_title);
  formData.set("seo_description", item.seo_description);
  formData.set("focus_keyword", item.focus_keyword);
  formData.set("seo_keywords", item.seo_keywords.join(","));
  formData.set("canonical_url", item.canonical_url);
  if (item.robots_index !== null) {
    setBoolean(formData, "robots_index", item.robots_index);
  }
  if (item.robots_follow !== null) {
    setBoolean(formData, "robots_follow", item.robots_follow);
  }
  formData.set("og_image", item.og_image);
  formData.set("og_image_alt", item.og_image_alt);
  setBoolean(formData, "is_featured", item.is_featured);
  setBoolean(formData, "is_popular", item.is_popular);
  setBoolean(formData, "show_title_on_page", item.show_title_on_page);
  setBoolean(formData, "show_image_on_page", item.show_image_on_page);
  setBoolean(formData, "show_excerpt_on_page", item.show_excerpt_on_page);
  setBoolean(formData, "show_date_on_page", true);
  setBoolean(formData, "show_category_on_page", true);
  setBoolean(formData, "show_series_on_page", true);
  setBoolean(formData, "show_intro_card_on_page", true);
  setBoolean(formData, "show_faq_on_page", item.show_faq_on_page);
  setBoolean(
    formData,
    "show_faq_title_on_page",
    item.show_faq_title_on_page,
  );
  setBoolean(formData, "faq_editor_present", true);
  for (const faqItem of item.faq) {
    formData.append("faq_question", faqItem.question);
    formData.append("faq_answer", faqItem.answer);
  }
  return formData;
}

function reviewErrors(
  code: string,
  issues: readonly { field?: string; hint: string }[],
) {
  return issues.map((issue) =>
    batchError(code, issue.hint, issue.field ?? null),
  );
}

async function resolveImportTarget(target: ArticleBatchImportTarget) {
  const errors: ArticleBatchImportError[] = [];
  const [category, series] = await Promise.all([
    getCategory(target.category.id),
    getSeries(target.series.id),
  ]);

  if (!category) {
    errors.push(batchError(
      "category_not_available",
      "The requested Article category does not exist or is not active.",
      "target.category",
    ));
  } else {
    if (category.slug !== target.category.slug) {
      errors.push(batchError(
        "category_slug_mismatch",
        `Category ${target.category.id} currently uses slug ${category.slug}.`,
        "target.category.slug",
      ));
    }
    if (category.name !== target.category.name) {
      errors.push(batchError(
        "category_name_mismatch",
        `Category ${target.category.id} currently uses a different name.`,
        "target.category.name",
      ));
    }
  }

  if (!series) {
    errors.push(batchError(
      "series_not_available",
      "The requested Article series does not exist, is unpublished, or is deleted.",
      "target.series",
    ));
  } else {
    if (series.slug !== target.series.slug) {
      errors.push(batchError(
        "series_slug_mismatch",
        `Series ${target.series.id} currently uses slug ${series.slug}.`,
        "target.series.slug",
      ));
    }
    if (series.name !== target.series.name) {
      errors.push(batchError(
        "series_name_mismatch",
        `Series ${target.series.id} currently uses a different name.`,
        "target.series.name",
      ));
    }
  }

  if (category && series) {
    const relationError = getAdminContentSeriesCategoryError(
      series,
      category.id,
    );
    if (relationError) {
      errors.push(batchError(
        "series_category_mismatch",
        relationError,
        "target.series",
      ));
    }
  }

  return {
    resolved:
      category && series && errors.length === 0 ? { category, series } : null,
    errors,
  };
}

async function analyzeArticleBatchImport(dataset: unknown): Promise<Analysis> {
  const parsedEnvelope = articleBatchImportEnvelopeSchema.safeParse(dataset);
  const source = dataset && typeof dataset === "object"
    ? dataset as Record<string, unknown>
    : null;
  const rawArticles = Array.isArray(source?.articles) ? source.articles : [];
  const batchErrors = parsedEnvelope.success
    ? []
    : zodIssuesToBatchErrors(parsedEnvelope.error.issues);
  const batchKey = parsedEnvelope.success
    ? parsedEnvelope.data.batch_key
    : typeof source?.batch_key === "string"
      ? source.batch_key
      : null;
  const requestedTarget = parsedEnvelope.success
    ? parsedEnvelope.data.target
    : null;
  const targetResolution = requestedTarget
    ? await resolveImportTarget(requestedTarget)
    : { resolved: null, errors: [] as ArticleBatchImportError[] };
  const targetErrors = [
    ...batchErrors.filter((error) => error.field?.startsWith("target")),
    ...targetResolution.errors,
  ];

  const parsedItems = rawArticles.map((rawItem, index) => ({
    index,
    rawItem,
    parsed: articleBatchImportItemSchema.safeParse(rawItem),
  }));
  const analyzedArticles = new Map<number, AnalyzedArticle>();
  for (const item of parsedItems) {
    if (!item.parsed.success) continue;
    analyzedArticles.set(item.index, {
      item: item.parsed.data,
      payload: getPayload(toArticleFormData(item.parsed.data)),
    });
  }

  const normalizedSlugs = [...analyzedArticles.values()].map(
    (item) => item.payload.slug,
  );
  const datasetDuplicateSlugs = findDuplicateValues(normalizedSlugs);
  let databaseConflictSlugs = new Set<string>();
  const slugLookupErrors: ArticleBatchImportError[] = [];
  try {
    databaseConflictSlugs = await getConflictingTopicSlugs(normalizedSlugs);
  } catch (error) {
    slugLookupErrors.push(batchError(
      "slug_lookup_failed",
      error instanceof Error
        ? error.message
        : "Could not verify Article slug uniqueness.",
      "slug",
    ));
  }

  const duplicateSlugs = [
    ...new Set([
      ...datasetDuplicateSlugs,
      ...databaseConflictSlugs,
    ]),
  ].sort();
  const articles: ArticleBatchImportDryRunItem[] = [];

  for (const parsedItem of parsedItems) {
    const analyzed = analyzedArticles.get(parsedItem.index);
    const schemaErrors = parsedItem.parsed.success
      ? []
      : zodIssuesToBatchErrors(parsedItem.parsed.error.issues);
    const sourceSlug = rawIdentity(parsedItem.rawItem, "slug");
    const title = analyzed?.payload.title ?? rawIdentity(parsedItem.rawItem, "title");
    const slug = analyzed?.payload.slug ?? sourceSlug;
    const categorySeriesErrors = [
      ...targetErrors,
      ...schemaErrors.filter(
        (error) =>
          error.field === "category_id" || error.field === "series_id",
      ),
    ];
    if (analyzed && requestedTarget) {
      if (analyzed.item.category_id !== requestedTarget.category.id) {
        categorySeriesErrors.push(batchError(
          "article_category_target_mismatch",
          "Article category_id does not match the resolved batch category.",
          "category_id",
        ));
      }
      if (analyzed.item.series_id !== requestedTarget.series.id) {
        categorySeriesErrors.push(batchError(
          "article_series_target_mismatch",
          "Article series_id does not match the resolved batch series.",
          "series_id",
        ));
      }
    }

    const draftErrors = analyzed
      ? reviewErrors("draft_validation", getDraftBlockingChecks(analyzed.payload))
      : [];
    const seoErrors = analyzed
      ? validateEntitySeoValues(analyzed.payload).map((issue) =>
          batchError("seo_validation", issue.message, issue.field)
        )
      : schemaErrors.filter((error) => error.field?.startsWith("seo_") ||
          error.field === "focus_keyword" ||
          error.field?.startsWith("canonical_url") ||
          error.field?.startsWith("robots_") ||
          error.field?.startsWith("og_"));
    const faqErrors = analyzed
      ? reviewErrors(
          "faq_validation",
          getDraftBlockingChecks(analyzed.payload).filter(
            (issue) => issue.field?.startsWith("faq"),
          ),
        )
      : schemaErrors.filter((error) => error.field?.startsWith("faq"));
    const slugScopes: ("dataset" | "database")[] = [];
    if (datasetDuplicateSlugs.includes(slug)) slugScopes.push("dataset");
    if (databaseConflictSlugs.has(slug)) slugScopes.push("database");
    const slugErrors = [
      ...slugLookupErrors,
      ...(slugScopes.length
        ? [batchError(
            "slug_conflict",
            `Slug ${slug || "(empty)"} conflicts in ${slugScopes.join(" and ")}.`,
            "slug",
          )]
        : []),
    ];
    const publishErrors = analyzed
      ? reviewErrors(
          "publish_readiness",
          getPublishBlockingChecks(analyzed.payload),
        )
      : [];
    const itemBatchErrors = batchErrors.filter(
      (error) => !error.field?.startsWith("target"),
    );
    const errors = dedupeErrors([
      ...itemBatchErrors,
      ...schemaErrors,
      ...categorySeriesErrors,
      ...draftErrors,
      ...seoErrors,
      ...faqErrors,
      ...slugErrors,
    ]);
    const readinessErrors = dedupeErrors([
      ...errors,
      ...publishErrors,
    ]);

    articles.push({
      index: parsedItem.index,
      title,
      sourceSlug,
      slug,
      status: errors.length ? "invalid" : "valid",
      valid: errors.length === 0,
      slugConflict: {
        conflict: slugScopes.length > 0 || slugLookupErrors.length > 0,
        scopes: slugScopes,
      },
      categorySeriesValidation: {
        valid: categorySeriesErrors.length === 0,
        errors: dedupeErrors(categorySeriesErrors),
      },
      seoValidation: {
        valid: seoErrors.length === 0,
        errors: dedupeErrors(seoErrors),
      },
      faqValidation: {
        valid: faqErrors.length === 0,
        count: analyzed?.item.faq.length ?? rawFaqCount(parsedItem.rawItem),
        errors: dedupeErrors(faqErrors),
      },
      publishReadiness: {
        ready: readinessErrors.length === 0,
        errors: readinessErrors,
      },
      errors,
    });
  }

  const reportWithoutFingerprint = {
    mode: "dry_run" as const,
    batchKey,
    total: rawArticles.length,
    valid: articles.filter((article) => article.valid).length,
    invalid: articles.filter((article) => !article.valid).length,
    duplicateSlugs,
    target: {
      requested: requestedTarget,
      resolved: targetResolution.resolved,
      valid: targetErrors.length === 0 && Boolean(targetResolution.resolved),
      errors: dedupeErrors(targetErrors),
    },
    errors: dedupeErrors([...batchErrors, ...slugLookupErrors]),
    articles,
  };
  const fingerprint = buildArticleBatchImportFingerprint({
    dataset,
    observedTarget: targetResolution.resolved,
    duplicateSlugs,
    errors: reportWithoutFingerprint.errors,
  });

  return {
    report: { ...reportWithoutFingerprint, fingerprint },
    target: targetResolution.resolved,
    analyzedArticles,
  };
}

export async function dryRunArticleBatchImport(
  dataset: unknown,
): Promise<ArticleBatchImportDryRunReport> {
  return (await analyzeArticleBatchImport(dataset)).report;
}

function blockedExecutionReport(
  analysis: Analysis,
  error: ArticleBatchImportError,
): ArticleBatchImportExecutionReport {
  return {
    mode: "execute",
    status: "blocked",
    batchKey: analysis.report.batchKey,
    fingerprint: analysis.report.fingerprint,
    total: analysis.report.total,
    created: 0,
    failed: 0,
    skipped: analysis.report.total,
    duplicateSlugs: analysis.report.duplicateSlugs,
    createdIds: [],
    createdSlugs: [],
    categorySeriesUsed: analysis.target,
    errors: [error],
    warnings: [],
    articles: analysis.report.articles.map((article) => ({
      index: article.index,
      title: article.title,
      slug: article.slug,
      outcome: "skipped",
      errors: dedupeErrors([...article.errors, error]),
      warnings: [],
    })),
  };
}

export async function executeArticleBatchImport(input: {
  dataset: unknown;
  dryRunFingerprint: string;
  actorId: number;
}): Promise<ArticleBatchImportExecutionReport> {
  const analysis = await analyzeArticleBatchImport(input.dataset);
  if (
    !input.dryRunFingerprint ||
    input.dryRunFingerprint !== analysis.report.fingerprint
  ) {
    return blockedExecutionReport(
      analysis,
      batchError(
        "dry_run_fingerprint_mismatch",
        "Execution requires the fingerprint from a current Dry Run of the same dataset and live conflict state.",
      ),
    );
  }
  const actor = Number.isInteger(input.actorId)
    ? await getAdminUserById(input.actorId)
    : null;
  if (!actor?.is_active) {
    return blockedExecutionReport(
      analysis,
      batchError(
        "invalid_actor",
        "Execution requires an explicit active CMS admin actor.",
      ),
    );
  }

  const results: ArticleBatchImportExecutionItem[] = [];
  const createdRows: { id: number; slug: string }[] = [];
  const duplicateSlugs = new Set(analysis.report.duplicateSlugs);
  const warnings: string[] = [];

  for (const dryRunItem of analysis.report.articles) {
    const analyzed = analysis.analyzedArticles.get(dryRunItem.index);
    if (!dryRunItem.valid || !analyzed || !analysis.target) {
      results.push({
        index: dryRunItem.index,
        title: dryRunItem.title,
        slug: dryRunItem.slug,
        outcome: "skipped",
        errors: dryRunItem.errors,
        warnings: [],
      });
      continue;
    }

    try {
      const now = new Date().toISOString();
      const coordinated = await createArticleDomainRecord({
        payload: analyzed.payload,
        category: analysis.target.category,
        series: analysis.target.series,
        status: "unpublished",
        actorId: actor.id,
        now,
        requestIdentity:
          `seo-article-batch:${analysis.report.batchKey}:${dryRunItem.index}:${analysis.report.fingerprint.slice(0, 12)}`,
      });
      const created = coordinated.value;
      const itemWarnings: string[] = [];
      if (
        coordinated.mediaSynchronization.status ===
        "saved_with_media_sync_warning"
      ) {
        itemWarnings.push(
          coordinated.mediaSynchronization.failureReason ??
            "Article was created with an unresolved Media reference synchronization warning.",
        );
      }

      try {
        await recordCmsAdminAudit(
          {
            action: buildCmsAuditAction("topic", "create"),
            entityType: "topic",
            entityId: created.id,
            entityLabel: analyzed.payload.title,
            metadata: {
              slug: created.slug,
              status: "unpublished",
              source: "seo_article_batch_import",
              batchKey: analysis.report.batchKey,
              fingerprint: analysis.report.fingerprint,
              categoryId: analysis.target.category.id,
              seriesId: analysis.target.series.id,
            },
          },
          actor,
        );
      } catch (error) {
        itemWarnings.push(
          error instanceof Error
            ? `Audit context failed: ${error.message}`
            : "Audit context failed after Article creation.",
        );
      }

      createdRows.push(created);
      results.push({
        index: dryRunItem.index,
        title: dryRunItem.title,
        slug: created.slug,
        outcome: "created",
        id: created.id,
        errors: [],
        warnings: itemWarnings,
      });
    } catch (error) {
      if (error instanceof ArticleSlugConflictError) {
        duplicateSlugs.add(error.slug);
        results.push({
          index: dryRunItem.index,
          title: dryRunItem.title,
          slug: dryRunItem.slug,
          outcome: "skipped",
          errors: [batchError(
            "slug_conflict_during_execution",
            error.message,
            "slug",
          )],
          warnings: [],
        });
        continue;
      }
      results.push({
        index: dryRunItem.index,
        title: dryRunItem.title,
        slug: dryRunItem.slug,
        outcome: "failed",
        errors: [batchError(
          "article_create_failed",
          error instanceof Error ? error.message : "Article creation failed.",
        )],
        warnings: [],
      });
    }
  }

  if (createdRows.length) {
    try {
      revalidateUnifiedContentBatchPaths({
        contentType: "article",
        entries: createdRows.map((row) => ({
          id: row.id,
          newSlug: row.slug,
        })),
      });
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Cache and sitemap invalidation failed: ${error.message}`
          : "Cache and sitemap invalidation failed after Article creation.",
      );
    }
  }

  results.sort((left, right) => left.index - right.index);
  const created = results.filter((item) => item.outcome === "created");
  const failed = results.filter((item) => item.outcome === "failed");
  const skipped = results.filter((item) => item.outcome === "skipped");

  return {
    mode: "execute",
    status: failed.length ? "completed_with_failures" : "completed",
    batchKey: analysis.report.batchKey,
    fingerprint: analysis.report.fingerprint,
    total: analysis.report.total,
    created: created.length,
    failed: failed.length,
    skipped: skipped.length,
    duplicateSlugs: [...duplicateSlugs].sort(),
    createdIds: created.flatMap((item) => item.id === undefined ? [] : [item.id]),
    createdSlugs: created.map((item) => item.slug),
    categorySeriesUsed: analysis.target,
    errors: [],
    warnings,
    articles: results,
  };
}
