import { z } from "zod";

import {
  isMediaEditableContentType,
  type MediaEditableContentType,
} from "../admin/content/content-types";
import {
  buildContentDisplayOptionsFromFormData,
  buildPageBlockTextFormattingPatch,
  resolveContentDisplayOptions,
  resolvePageBlockTextFormat,
} from "../page-blocks/configs";
import {
  FEATURED_PRESENTATION_VARIANTS,
  FEATURED_SELECTION_MODES,
  type FeaturedModuleConfig,
  type FeaturedPresentationVariant,
  type FeaturedSelectionMode,
  type FeaturedSourceKind,
} from "./contract";

export const featuredModuleConfigSchema: z.ZodType<FeaturedModuleConfig> = z
  .object({
    source: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("categories"),
          categorySlug: z.string().min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("media-center"),
          contentType: z.enum([
            "news",
            "press",
            "site_update",
            "video",
            "gallery",
          ]),
        })
        .strict(),
    ]),
    selection: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("automatic") }).strict(),
      z.object({ mode: z.literal("latest") }).strict(),
      z.object({ mode: z.literal("popular") }).strict(),
      z
        .object({
          mode: z.literal("manual"),
          topicIds: z.array(z.number().int().positive()),
        })
        .strict(),
    ]),
    itemLimit: z.number().int().min(1).max(12),
    display: z
      .object({
        title: z.boolean(),
        image: z.boolean(),
        category: z.boolean(),
        series: z.boolean(),
        excerpt: z.boolean(),
        date: z.boolean(),
      })
      .strict(),
    presentation: z
      .object({
        variant: z.enum(FEATURED_PRESENTATION_VARIANTS),
        eyebrow: z.string().nullable(),
        title: z.string(),
        description: z.string(),
        ctaText: z.string(),
        showEyebrow: z.boolean(),
        eyebrowBold: z.boolean(),
        eyebrowAlignment: z.enum(["right", "center", "left"]),
        showTitle: z.boolean(),
        titleBold: z.boolean(),
        titleAlignment: z.enum(["right", "center", "left"]),
        showDescription: z.boolean(),
        descriptionBold: z.boolean(),
        descriptionAlignment: z.enum(["right", "center", "left"]),
        showCta: z.boolean(),
        ctaBold: z.boolean(),
        ctaAlignment: z.enum(["right", "center", "left"]),
      })
      .strict(),
  })
  .strict();

const DEFAULT_PRESENTATION = {
  variant: "editorial" as const,
  eyebrow: "المميز",
  title: "مختارات مميزة",
  description: "",
  ctaText: "اقرأ المزيد",
};

function positiveIds(values: readonly unknown[]) {
  return [
    ...new Set(
      values
        .map(Number)
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    ),
  ];
}

function presentationVariant(value: unknown): FeaturedPresentationVariant {
  return FEATURED_PRESENTATION_VARIANTS.includes(
    value as FeaturedPresentationVariant,
  )
    ? (value as FeaturedPresentationVariant)
    : DEFAULT_PRESENTATION.variant;
}

function selectionMode(value: unknown): FeaturedSelectionMode {
  return FEATURED_SELECTION_MODES.includes(value as FeaturedSelectionMode)
    ? (value as FeaturedSelectionMode)
    : "automatic";
}

function sourceKind(value: unknown): FeaturedSourceKind {
  return value === "media-center" ? "media-center" : "categories";
}

function mediaContentType(value: unknown): MediaEditableContentType {
  return isMediaEditableContentType(String(value ?? ""))
    ? (String(value) as MediaEditableContentType)
    : "news";
}

export function parseFeaturedModuleConfig(
  raw: Record<string, unknown> | null | undefined,
): FeaturedModuleConfig {
  const sourceRaw =
    raw?.source && typeof raw.source === "object"
      ? (raw.source as Record<string, unknown>)
      : {};
  const selectionRaw =
    raw?.selection && typeof raw.selection === "object"
      ? (raw.selection as Record<string, unknown>)
      : {};
  const presentationRaw =
    raw?.presentation && typeof raw.presentation === "object"
      ? (raw.presentation as Record<string, unknown>)
      : {};
  const displayRaw =
    raw?.display && typeof raw.display === "object"
      ? (raw.display as Record<string, unknown>)
      : {};
  const kind = sourceKind(sourceRaw.kind);
  const itemLimitValue = Math.floor(Number(raw?.itemLimit ?? 4));
  const eyebrowFormat = resolvePageBlockTextFormat(presentationRaw, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(presentationRaw, "title", {
    bold: true,
  });
  const descriptionFormat = resolvePageBlockTextFormat(
    presentationRaw,
    "description",
  );
  const ctaFormat = resolvePageBlockTextFormat(presentationRaw, "cta");

  return featuredModuleConfigSchema.parse({
    source:
      kind === "categories"
        ? {
            kind,
            categorySlug:
              String(sourceRaw.categorySlug ?? "").trim() || "uncategorized",
          }
        : { kind, contentType: mediaContentType(sourceRaw.contentType) },
    selection:
      selectionMode(selectionRaw.mode) === "manual"
        ? {
            mode: "manual",
            topicIds: positiveIds(
              Array.isArray(selectionRaw.topicIds) ? selectionRaw.topicIds : [],
            ),
          }
        : { mode: selectionMode(selectionRaw.mode) },
    itemLimit: Number.isFinite(itemLimitValue)
      ? Math.max(1, Math.min(12, itemLimitValue))
      : 4,
    display: resolveContentDisplayOptions({
      title: displayRaw.title ?? presentationRaw.showItemTitle,
      image: displayRaw.image ?? presentationRaw.showImage,
      category: displayRaw.category ?? presentationRaw.showCategory,
      series: displayRaw.series ?? presentationRaw.showSeries,
      excerpt: displayRaw.excerpt ?? presentationRaw.showExcerpt,
      date: displayRaw.date ?? presentationRaw.showDate,
    }),
    presentation: {
      variant: presentationVariant(presentationRaw.variant),
      eyebrow:
        String(
          presentationRaw.eyebrow ?? DEFAULT_PRESENTATION.eyebrow,
        ).trim() || null,
      title: String(presentationRaw.title ?? DEFAULT_PRESENTATION.title).trim(),
      description: String(presentationRaw.description ?? "").trim(),
      ctaText: String(
        presentationRaw.ctaText ?? DEFAULT_PRESENTATION.ctaText,
      ).trim(),
      showEyebrow: eyebrowFormat.visible,
      eyebrowBold: eyebrowFormat.bold,
      eyebrowAlignment: eyebrowFormat.alignment,
      showTitle: titleFormat.visible,
      titleBold: titleFormat.bold,
      titleAlignment: titleFormat.alignment,
      showDescription: descriptionFormat.visible,
      descriptionBold: descriptionFormat.bold,
      descriptionAlignment: descriptionFormat.alignment,
      showCta: ctaFormat.visible,
      ctaBold: ctaFormat.bold,
      ctaAlignment: ctaFormat.alignment,
    },
  });
}

export class FeaturedModuleConfigValidationError extends Error {
  constructor(
    readonly field:
      "category_slug" | "content_type" | "manual_topic_ids" | "item_limit",
    message: string,
  ) {
    super(message);
    this.name = "FeaturedModuleConfigValidationError";
  }
}

export function buildFeaturedModuleConfig(
  formData: FormData,
): FeaturedModuleConfig {
  const kind = sourceKind(formData.get("source_kind"));
  const categorySlug = String(formData.get("category_slug") ?? "").trim();
  const contentType = mediaContentType(formData.get("content_type"));
  if (kind === "categories" && !categorySlug) {
    throw new FeaturedModuleConfigValidationError(
      "category_slug",
      "اختر تصنيفًا.",
    );
  }
  const selectedMode = selectionMode(formData.get("selection_mode"));
  const topicIds = positiveIds(formData.getAll("manual_topic_ids"));
  if (selectedMode === "manual" && topicIds.length === 0) {
    throw new FeaturedModuleConfigValidationError(
      "manual_topic_ids",
      "اختر عنصرًا واحدًا على الأقل.",
    );
  }
  const itemLimitRaw = String(formData.get("item_limit") ?? "").trim();
  const itemLimit = Number(itemLimitRaw);
  if (
    !/^\d+$/u.test(itemLimitRaw) ||
    !Number.isInteger(itemLimit) ||
    itemLimit < 1 ||
    itemLimit > 12
  ) {
    throw new FeaturedModuleConfigValidationError(
      "item_limit",
      "عدد العناصر يجب أن يكون بين 1 و12.",
    );
  }
  const formatting = buildPageBlockTextFormattingPatch(formData, [
    { field: "eyebrow" },
    { field: "title", defaults: { bold: true } },
    { field: "description" },
    { field: "cta" },
  ]);

  return featuredModuleConfigSchema.parse({
    source:
      kind === "categories" ? { kind, categorySlug } : { kind, contentType },
    selection:
      selectedMode === "manual"
        ? { mode: selectedMode, topicIds }
        : { mode: selectedMode },
    itemLimit,
    display: buildContentDisplayOptionsFromFormData(formData, false),
    presentation: {
      ...formatting,
      variant: presentationVariant(formData.get("presentation_variant")),
      eyebrow: String(formData.get("eyebrow") ?? "").trim() || null,
      title: String(formData.get("title") ?? "").trim(),
      description: String(
        formData.get("presentation_description") ?? "",
      ).trim(),
      ctaText: String(formData.get("cta_text") ?? "").trim(),
    },
  });
}

export function isPersistedFeaturedModuleConfigEqual(
  raw: unknown,
  expected: FeaturedModuleConfig,
) {
  const parsed = featuredModuleConfigSchema.safeParse(raw);
  return (
    parsed.success && JSON.stringify(parsed.data) === JSON.stringify(expected)
  );
}

export function createDefaultFeaturedModuleConfig(
  categorySlug: string,
  variant: FeaturedPresentationVariant,
): FeaturedModuleConfig {
  return parseFeaturedModuleConfig({
    source: { kind: "categories", categorySlug },
    selection: { mode: "automatic" },
    itemLimit: variant === "three-cards" ? 3 : 4,
    presentation: { ...DEFAULT_PRESENTATION, variant },
  });
}
