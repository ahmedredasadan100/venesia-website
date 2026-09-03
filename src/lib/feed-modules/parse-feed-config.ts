import { z } from "zod";

import {
  DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
  DEFAULT_FEED_CATEGORY_CARD_PRESENTATION,
  DEFAULT_FEED_SERIES_CARD_PRESENTATION,
  DEFAULT_FEED_SERIES_LINK_TEXT,
  type FeedArticleCardPresentation,
  type FeedCategoryCardPresentation,
  type FeedModuleConfig,
  type FeedModulePresentation,
  type FeedModuleQueryConfig,
  type FeedSeriesCardPresentation,
  type TopicsFeedType,
} from "./types";
import { normalizeBoolean, parseFormBoolean } from "../page-blocks/admin-utils";
import {
  buildPageBlockTextFormattingPatch,
  PAGE_BLOCK_TEXT_ALIGNMENTS,
  type PageBlockTextAlignment,
  resolvePageBlockTextFormat,
} from "../page-blocks/configs";

const DEFAULT_PRESENTATION: FeedModulePresentation = {
  title: "",
  eyebrow: null,
  linkText: null,
  showImage: true,
  showDate: true,
  showExcerpt: false,
  emptyBehavior: "hide",
};

const DEFAULT_QUERY: FeedModuleQueryConfig = {
  limit: 3,
  categorySlugs: [],
  seriesSlugs: [],
};

export const feedModuleConfigSchema: z.ZodType<FeedModuleConfig> = z
  .object({
    presentation: z
      .object({
        title: z.string(),
        eyebrow: z.string().nullable().optional(),
        linkText: z.string().nullable().optional(),
        showImage: z.boolean(),
        showDate: z.boolean(),
        showExcerpt: z.boolean(),
        emptyBehavior: z.literal("hide"),
        showEyebrow: z.boolean(),
        eyebrowBold: z.boolean(),
        eyebrowAlignment: z.enum(["right", "center", "left"]),
        showTitle: z.boolean(),
        titleBold: z.boolean(),
        titleAlignment: z.enum(["right", "center", "left"]),
        articleCard: z
          .object({
            showTitle: z.boolean(),
            titleBold: z.boolean(),
            titleAlignment: z.enum(["right", "center", "left"]),
            showExcerpt: z.boolean(),
            excerptBold: z.boolean(),
            excerptAlignment: z.enum(["right", "center", "left"]),
            showDate: z.boolean(),
            dateBold: z.boolean(),
            dateAlignment: z.enum(["right", "center", "left"]),
          })
          .strict()
          .optional(),
        categoryCard: z
          .object({
            showCategory: z.boolean(),
            categoryBold: z.boolean(),
            categoryAlignment: z.enum(["right", "center", "left"]),
            showCount: z.boolean(),
            countBold: z.boolean(),
            countAlignment: z.enum(["right", "center", "left"]),
          })
          .strict()
          .optional(),
        seriesCard: z
          .object({
            showSeries: z.boolean(),
            seriesBold: z.boolean(),
            seriesAlignment: z.enum(["right", "center", "left"]),
            showDescription: z.boolean(),
            descriptionBold: z.boolean(),
            descriptionAlignment: z.enum(["right", "center", "left"]),
            showDetails: z.boolean(),
            detailsBold: z.boolean(),
            detailsAlignment: z.enum(["right", "center", "left"]),
          })
          .strict()
          .optional(),
      })
      .strict(),
    query: z
      .object({
        limit: z.number().int().min(1),
        categorySlugs: z.array(z.string().min(1)),
        seriesSlugs: z.array(z.string().min(1)),
      })
      .strict(),
  })
  .strict();

export type FeedModuleConfigFormField = "widget_title" | "limit";

export class FeedModuleConfigValidationError extends Error {
  readonly field: FeedModuleConfigFormField;

  constructor(field: FeedModuleConfigFormField, message: string) {
    super(message);
    this.name = "FeedModuleConfigValidationError";
    this.field = field;
  }
}

function readOptionalSlug(value: unknown) {
  const slug = String(value ?? "").trim();
  return slug || null;
}

function normalizeSlugList(values: readonly unknown[]) {
  return [...new Set(values.map(readOptionalSlug).filter((value): value is string => Boolean(value)))];
}

function readPersistedCategorySlugs(queryRaw: Record<string, unknown>) {
  const categorySlugs = Array.isArray(queryRaw.categorySlugs)
    ? normalizeSlugList(queryRaw.categorySlugs)
    : [];
  if (categorySlugs.length) return categorySlugs;

  const legacyCategorySlug = readOptionalSlug(queryRaw.categorySlug);
  return legacyCategorySlug ? [legacyCategorySlug] : [];
}

function readFormCategorySlugs(formData: FormData) {
  const categorySlugs = normalizeSlugList(formData.getAll("category_slugs"))
    .filter((slug) => slug !== "__all__");
  if (categorySlugs.length || formData.has("category_slugs")) return categorySlugs;

  return normalizeSlugList(formData.getAll("category_slug"))
    .filter((slug) => slug !== "__all__");
}

function readPersistedSeriesSlugs(queryRaw: Record<string, unknown>) {
  if (Array.isArray(queryRaw.seriesSlugs)) {
    return normalizeSlugList(queryRaw.seriesSlugs);
  }

  const legacySeriesSlug = readOptionalSlug(queryRaw.seriesSlug);
  return legacySeriesSlug ? [legacySeriesSlug] : [];
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type FeedCardTextFormat = {
  visible: boolean;
  bold: boolean;
  alignment: PageBlockTextAlignment;
};

function buildFeedCardTextFormat(
  formData: FormData,
  formField: string,
  defaults: FeedCardTextFormat,
): FeedCardTextFormat {
  const alignmentRaw = String(formData.get(`${formField}_alignment`) ?? "").trim();

  return {
    visible: parseFormBoolean(formData, `show_${formField}`, defaults.visible),
    bold: parseFormBoolean(formData, `${formField}_bold`, defaults.bold),
    alignment: PAGE_BLOCK_TEXT_ALIGNMENTS.includes(
      alignmentRaw as PageBlockTextAlignment,
    )
      ? (alignmentRaw as PageBlockTextAlignment)
      : defaults.alignment,
  };
}

function parseArticleCardPresentation(
  presentationRaw: Record<string, unknown>,
  legacyShowDate: boolean,
  legacyShowExcerpt: boolean,
): FeedArticleCardPresentation {
  const raw = readObject(presentationRaw.articleCard);
  const title = resolvePageBlockTextFormat(raw, "title", {
    visible: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.showTitle,
    bold: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.titleBold,
    alignment: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.titleAlignment,
  });
  const excerpt = resolvePageBlockTextFormat(raw, "excerpt", {
    bold: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.excerptBold,
    alignment: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.excerptAlignment,
  });
  const date = resolvePageBlockTextFormat(raw, "date", {
    bold: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.dateBold,
    alignment: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.dateAlignment,
  });

  return {
    showTitle: normalizeBoolean(raw.showTitle, title.visible),
    titleBold: title.bold,
    titleAlignment: title.alignment,
    showExcerpt: normalizeBoolean(raw.showExcerpt, legacyShowExcerpt),
    excerptBold: excerpt.bold,
    excerptAlignment: excerpt.alignment,
    showDate: normalizeBoolean(raw.showDate, legacyShowDate),
    dateBold: date.bold,
    dateAlignment: date.alignment,
  };
}

function buildArticleCardPresentation(formData: FormData): FeedArticleCardPresentation {
  const title = buildFeedCardTextFormat(formData, "article_title", {
    visible: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.showTitle,
    bold: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.titleBold,
    alignment: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.titleAlignment,
  });
  const excerpt = buildFeedCardTextFormat(formData, "article_excerpt", {
    visible: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.showExcerpt,
    bold: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.excerptBold,
    alignment: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.excerptAlignment,
  });
  const date = buildFeedCardTextFormat(formData, "article_date", {
    visible: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.showDate,
    bold: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.dateBold,
    alignment: DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.dateAlignment,
  });

  return {
    showTitle: title.visible,
    titleBold: title.bold,
    titleAlignment: title.alignment,
    showExcerpt: excerpt.visible,
    excerptBold: excerpt.bold,
    excerptAlignment: excerpt.alignment,
    showDate: date.visible,
    dateBold: date.bold,
    dateAlignment: date.alignment,
  };
}

function parseCategoryCardPresentation(
  presentationRaw: Record<string, unknown>,
): FeedCategoryCardPresentation {
  const raw = readObject(presentationRaw.categoryCard);
  const category = resolvePageBlockTextFormat(raw, "category", {
    bold: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.categoryBold,
    alignment: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.categoryAlignment,
  });
  const countAlignmentRaw = raw.countAlignment;

  return {
    showCategory: normalizeBoolean(
      raw.showCategory,
      DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.showCategory,
    ),
    categoryBold: category.bold,
    categoryAlignment: category.alignment,
    showCount: normalizeBoolean(
      raw.showCount,
      DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.showCount,
    ),
    countBold: normalizeBoolean(
      raw.countBold,
      DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.countBold,
    ),
    countAlignment: PAGE_BLOCK_TEXT_ALIGNMENTS.includes(
      countAlignmentRaw as PageBlockTextAlignment,
    )
      ? (countAlignmentRaw as PageBlockTextAlignment)
      : DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.countAlignment,
  };
}

function buildCategoryCardPresentation(formData: FormData): FeedCategoryCardPresentation {
  const category = buildFeedCardTextFormat(formData, "category", {
    visible: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.showCategory,
    bold: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.categoryBold,
    alignment: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.categoryAlignment,
  });
  const count = buildFeedCardTextFormat(formData, "count", {
    visible: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.showCount,
    bold: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.countBold,
    alignment: DEFAULT_FEED_CATEGORY_CARD_PRESENTATION.countAlignment,
  });

  return {
    showCategory: category.visible,
    categoryBold: category.bold,
    categoryAlignment: category.alignment,
    showCount: count.visible,
    countBold: count.bold,
    countAlignment: count.alignment,
  };
}

function parseSeriesCardPresentation(
  presentationRaw: Record<string, unknown>,
  legacyShowExcerpt: boolean,
): FeedSeriesCardPresentation {
  const raw = readObject(presentationRaw.seriesCard);
  const seriesFormat = resolvePageBlockTextFormat(raw, "series", {
    bold: DEFAULT_FEED_SERIES_CARD_PRESENTATION.seriesBold,
  });
  const descriptionFormat = resolvePageBlockTextFormat(raw, "description", {
    visible: legacyShowExcerpt,
  });
  const detailsFormat = resolvePageBlockTextFormat(raw, "details", {
    alignment: DEFAULT_FEED_SERIES_CARD_PRESENTATION.detailsAlignment,
  });

  return {
    showSeries: normalizeBoolean(
      raw.showSeries,
      DEFAULT_FEED_SERIES_CARD_PRESENTATION.showSeries,
    ),
    seriesBold: seriesFormat.bold,
    seriesAlignment: seriesFormat.alignment,
    showDescription: descriptionFormat.visible,
    descriptionBold: descriptionFormat.bold,
    descriptionAlignment: descriptionFormat.alignment,
    showDetails: detailsFormat.visible,
    detailsBold: detailsFormat.bold,
    detailsAlignment: detailsFormat.alignment,
  };
}

function buildSeriesCardPresentation(formData: FormData): FeedSeriesCardPresentation {
  const series = buildFeedCardTextFormat(formData, "series", {
    visible: DEFAULT_FEED_SERIES_CARD_PRESENTATION.showSeries,
    bold: DEFAULT_FEED_SERIES_CARD_PRESENTATION.seriesBold,
    alignment: DEFAULT_FEED_SERIES_CARD_PRESENTATION.seriesAlignment,
  });
  const description = buildFeedCardTextFormat(formData, "description", {
    visible: DEFAULT_FEED_SERIES_CARD_PRESENTATION.showDescription,
    bold: DEFAULT_FEED_SERIES_CARD_PRESENTATION.descriptionBold,
    alignment: DEFAULT_FEED_SERIES_CARD_PRESENTATION.descriptionAlignment,
  });
  const details = buildFeedCardTextFormat(formData, "details", {
    visible: DEFAULT_FEED_SERIES_CARD_PRESENTATION.showDetails,
    bold: DEFAULT_FEED_SERIES_CARD_PRESENTATION.detailsBold,
    alignment: DEFAULT_FEED_SERIES_CARD_PRESENTATION.detailsAlignment,
  });

  return {
    showSeries: series.visible,
    seriesBold: series.bold,
    seriesAlignment: series.alignment,
    showDescription: description.visible,
    descriptionBold: description.bold,
    descriptionAlignment: description.alignment,
    showDetails: details.visible,
    detailsBold: details.bold,
    detailsAlignment: details.alignment,
  };
}

export function parseFeedModuleConfig(
  raw: Record<string, unknown> | null | undefined,
  feedType: TopicsFeedType,
): FeedModuleConfig {
  const presentationRaw =
    raw?.presentation && typeof raw.presentation === "object"
      ? (raw.presentation as Record<string, unknown>)
      : {};
  const queryRaw =
    raw?.query && typeof raw.query === "object" ? (raw.query as Record<string, unknown>) : {};

  const limitValue = Number(queryRaw.limit ?? DEFAULT_QUERY.limit);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : DEFAULT_QUERY.limit;

  const eyebrowFormat = resolvePageBlockTextFormat(presentationRaw, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(presentationRaw, "title", { bold: true });
  const isArticleVariant = feedType === "latest" || feedType === "popular";
  const articleCard = parseArticleCardPresentation(
    presentationRaw,
    isArticleVariant
      ? normalizeBoolean(presentationRaw.showDate, DEFAULT_PRESENTATION.showDate)
      : DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.showDate,
    isArticleVariant
      ? normalizeBoolean(presentationRaw.showExcerpt, DEFAULT_PRESENTATION.showExcerpt)
      : DEFAULT_FEED_ARTICLE_CARD_PRESENTATION.showExcerpt,
  );
  const categoryCard = parseCategoryCardPresentation(presentationRaw);
  const seriesCard = parseSeriesCardPresentation(
    presentationRaw,
    feedType === "series"
      ? normalizeBoolean(presentationRaw.showExcerpt, DEFAULT_PRESENTATION.showExcerpt)
      : DEFAULT_FEED_SERIES_CARD_PRESENTATION.showDescription,
  );

  return feedModuleConfigSchema.parse({
    presentation: {
      title: String(presentationRaw.title ?? DEFAULT_PRESENTATION.title).trim(),
      eyebrow: String(presentationRaw.eyebrow ?? "").trim() || null,
      linkText: String(presentationRaw.linkText ?? "").trim() || null,
      showImage: normalizeBoolean(presentationRaw.showImage, DEFAULT_PRESENTATION.showImage),
      showDate: isArticleVariant ? articleCard.showDate : false,
      showExcerpt:
        isArticleVariant
          ? articleCard.showExcerpt
          : feedType === "series"
            ? seriesCard.showDescription
            : false,
      emptyBehavior: "hide",
      showEyebrow: eyebrowFormat.visible,
      eyebrowBold: eyebrowFormat.bold,
      eyebrowAlignment: eyebrowFormat.alignment,
      showTitle: titleFormat.visible,
      titleBold: titleFormat.bold,
      titleAlignment: titleFormat.alignment,
      articleCard,
      categoryCard,
      seriesCard,
    },
    query: {
      limit,
      categorySlugs: readPersistedCategorySlugs(queryRaw),
      seriesSlugs: readPersistedSeriesSlugs(queryRaw),
    },
  });
}

export function buildFeedModuleConfig(
  formData: FormData,
  feedType: TopicsFeedType,
): FeedModuleConfig {
  const title = String(formData.get("widget_title") ?? "").trim();
  if (!title) {
    throw new FeedModuleConfigValidationError("widget_title", "عنوان القسم مطلوب.");
  }

  const rawLimit = String(formData.get("limit") ?? "").trim();
  const limit = Number(rawLimit);
  if (!/^\d+$/u.test(rawLimit) || !Number.isInteger(limit) || limit < 1) {
    throw new FeedModuleConfigValidationError(
      "limit",
      "عدد العناصر المعروضة يجب أن يكون رقمًا صحيحًا أكبر من أو يساوي 1.",
    );
  }

  const categorySlugs = readFormCategorySlugs(formData);
  const seriesSlugs = normalizeSlugList(formData.getAll("series_slugs"));
  const formatting = buildPageBlockTextFormattingPatch(formData, [
    { field: "eyebrow" },
    { field: "title", defaults: { bold: true } },
  ]);
  const isArticleVariant = feedType === "latest" || feedType === "popular";
  const articleCard = buildArticleCardPresentation(formData);
  const categoryCard = buildCategoryCardPresentation(formData);
  const seriesCard = buildSeriesCardPresentation(formData);

  return feedModuleConfigSchema.parse({
    presentation: {
      ...formatting,
      title,
      eyebrow: String(formData.get("eyebrow") ?? "").trim() || null,
      linkText:
        String(formData.get("link_text") ?? "").trim() ||
        DEFAULT_FEED_SERIES_LINK_TEXT,
      showImage: parseFormBoolean(formData, "show_image", true),
      showDate: isArticleVariant ? articleCard.showDate : false,
      showExcerpt:
        isArticleVariant
          ? articleCard.showExcerpt
          : feedType === "series"
            ? seriesCard.showDescription
            : false,
      emptyBehavior: "hide",
      articleCard,
      categoryCard,
      seriesCard,
    },
    query: {
      limit,
      categorySlugs,
      seriesSlugs,
    },
  });
}

export function isPersistedFeedModuleConfigEqual(
  raw: unknown,
  expected: FeedModuleConfig,
) {
  const parsed = feedModuleConfigSchema.safeParse(raw);
  return parsed.success && JSON.stringify(parsed.data) === JSON.stringify(expected);
}
