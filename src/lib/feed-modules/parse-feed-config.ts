import { z } from "zod";

import {
  FEED_MODULE_PRESENTATION_SUPPORT,
  type FeedModuleConfig,
  type FeedModulePresentation,
  type FeedModuleQueryConfig,
  type TopicsFeedType,
} from "./types";
import { normalizeBoolean, parseFormBoolean } from "../page-blocks/admin-utils";
import {
  buildPageBlockTextFormattingPatch,
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

  const support = FEED_MODULE_PRESENTATION_SUPPORT[feedType];
  const eyebrowFormat = resolvePageBlockTextFormat(presentationRaw, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(presentationRaw, "title", { bold: true });

  return feedModuleConfigSchema.parse({
    presentation: {
      title: String(presentationRaw.title ?? DEFAULT_PRESENTATION.title).trim(),
      eyebrow: String(presentationRaw.eyebrow ?? "").trim() || null,
      linkText: feedType === "series" ? String(presentationRaw.linkText ?? "").trim() || null : null,
      showImage:
        support.showImage &&
        normalizeBoolean(presentationRaw.showImage, DEFAULT_PRESENTATION.showImage),
      showDate:
        support.showDate &&
        normalizeBoolean(presentationRaw.showDate, DEFAULT_PRESENTATION.showDate),
      showExcerpt:
        support.showExcerpt &&
        normalizeBoolean(presentationRaw.showExcerpt, DEFAULT_PRESENTATION.showExcerpt),
      emptyBehavior: "hide",
      showEyebrow: eyebrowFormat.visible,
      eyebrowBold: eyebrowFormat.bold,
      eyebrowAlignment: eyebrowFormat.alignment,
      showTitle: titleFormat.visible,
      titleBold: titleFormat.bold,
      titleAlignment: titleFormat.alignment,
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
  const support = FEED_MODULE_PRESENTATION_SUPPORT[feedType];
  const formatting = buildPageBlockTextFormattingPatch(formData, [
    { field: "eyebrow" },
    { field: "title", defaults: { bold: true } },
  ]);

  return feedModuleConfigSchema.parse({
    presentation: {
      ...formatting,
      title,
      eyebrow: String(formData.get("eyebrow") ?? "").trim() || null,
      linkText:
        feedType === "series" ? String(formData.get("link_text") ?? "").trim() || null : null,
      showImage: support.showImage && parseFormBoolean(formData, "show_image", true),
      showDate: support.showDate && parseFormBoolean(formData, "show_date", true),
      showExcerpt: support.showExcerpt && parseFormBoolean(formData, "show_excerpt", false),
      emptyBehavior: "hide",
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
