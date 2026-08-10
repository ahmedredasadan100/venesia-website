import { z } from "zod";

import {
  FEED_MODULE_PRESENTATION_SUPPORT,
  type FeedModuleConfig,
  type FeedModulePresentation,
  type FeedModuleQueryConfig,
  type TopicsFeedType,
} from "./types";
import { normalizeBoolean, parseFormBoolean } from "../page-blocks/admin-utils";

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
  categorySlug: null,
  seriesSlug: null,
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
      })
      .strict(),
    query: z
      .object({
        limit: z.number().int().min(1),
        categorySlug: z.string().nullable(),
        seriesSlug: z.string().nullable(),
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
    },
    query: {
      limit,
      categorySlug: readOptionalSlug(queryRaw.categorySlug),
      seriesSlug: readOptionalSlug(queryRaw.seriesSlug),
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
      "عدد النتائج يجب أن يكون رقمًا صحيحًا أكبر من أو يساوي 1.",
    );
  }

  const categorySlug = String(formData.get("category_slug") ?? "").trim();
  const seriesSlug = String(formData.get("series_slug") ?? "").trim();
  const support = FEED_MODULE_PRESENTATION_SUPPORT[feedType];

  return feedModuleConfigSchema.parse({
    presentation: {
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
      categorySlug: categorySlug && categorySlug !== "__all__" ? categorySlug : null,
      seriesSlug: seriesSlug && seriesSlug !== "__all__" ? seriesSlug : null,
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
