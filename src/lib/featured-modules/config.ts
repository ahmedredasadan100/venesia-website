import { z } from "zod";

import {
  isMediaEditableContentType,
  type MediaEditableContentType,
} from "../admin/content/content-types";
import {
  buildContentDisplayOptionsFromFormData,
  buildPageBlockTextFormattingPatch,
  CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS,
  resolveCollectionDisplayTextFormatting,
  resolveContentDisplayOptions,
  resolvePageBlockTextFormat,
} from "../page-blocks/configs";
import {
  FEATURED_PRESENTATION_VARIANTS,
  FEATURED_SELECTION_MODES,
  resolveFeaturedItemsPerView,
  resolveFeaturedNavigation,
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
    itemsPerView: z.number().int().min(1).max(12),
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
    displayFormatting: z
      .object({
        titleBold: z.boolean(),
        titleAlignment: z.enum(["right", "center", "left"]),
        categoryBold: z.boolean(),
        categoryAlignment: z.enum(["right", "center", "left"]),
        seriesBold: z.boolean(),
        seriesAlignment: z.enum(["right", "center", "left"]),
        excerptBold: z.boolean(),
        excerptAlignment: z.enum(["right", "center", "left"]),
        dateBold: z.boolean(),
        dateAlignment: z.enum(["right", "center", "left"]),
      })
      .strict(),
    navigation: z
      .object({
        showArrows: z.boolean(),
        showDots: z.boolean(),
        autoplay: z.boolean(),
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
  const displayFormattingRaw =
    raw?.displayFormatting &&
    typeof raw.displayFormatting === "object" &&
    !Array.isArray(raw.displayFormatting)
      ? (raw.displayFormatting as Record<string, unknown>)
      : {};
  const navigationRaw =
    raw?.navigation &&
    typeof raw.navigation === "object" &&
    !Array.isArray(raw.navigation)
      ? (raw.navigation as Record<string, unknown>)
      : {};
  const kind = sourceKind(sourceRaw.kind);
  const itemLimitValue = Math.floor(Number(raw?.itemLimit ?? 4));
  const itemLimit = Number.isFinite(itemLimitValue)
    ? Math.max(1, Math.min(12, itemLimitValue))
    : 4;
  const variant = presentationVariant(presentationRaw.variant);
  const eyebrowFormat = resolvePageBlockTextFormat(presentationRaw, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(presentationRaw, "title", {
    bold: true,
  });
  const descriptionFormat = resolvePageBlockTextFormat(
    presentationRaw,
    "description",
  );
  const ctaFormat = resolvePageBlockTextFormat(presentationRaw, "cta");
  const displayFormatting = resolveCollectionDisplayTextFormatting({
    titleBold: displayFormattingRaw.titleBold,
    titleAlignment: displayFormattingRaw.titleAlignment,
    categoryBold:
      displayFormattingRaw.categoryBold ?? presentationRaw.categoryBold,
    categoryAlignment:
      displayFormattingRaw.categoryAlignment ??
      presentationRaw.categoryAlignment,
    seriesBold: displayFormattingRaw.seriesBold ?? presentationRaw.seriesBold,
    seriesAlignment:
      displayFormattingRaw.seriesAlignment ?? presentationRaw.seriesAlignment,
    excerptBold:
      displayFormattingRaw.excerptBold ?? presentationRaw.excerptBold,
    excerptAlignment:
      displayFormattingRaw.excerptAlignment ?? presentationRaw.excerptAlignment,
    dateBold: displayFormattingRaw.dateBold ?? presentationRaw.dateBold,
    dateAlignment:
      displayFormattingRaw.dateAlignment ?? presentationRaw.dateAlignment,
  });

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
    itemLimit,
    itemsPerView: resolveFeaturedItemsPerView(
      variant,
      raw?.itemsPerView,
      itemLimit,
    ),
    display: resolveContentDisplayOptions({
      title: displayRaw.title ?? presentationRaw.showItemTitle,
      image: displayRaw.image ?? presentationRaw.showImage,
      category: displayRaw.category ?? presentationRaw.showCategory,
      series: displayRaw.series ?? presentationRaw.showSeries,
      excerpt: displayRaw.excerpt ?? presentationRaw.showExcerpt,
      date: displayRaw.date ?? presentationRaw.showDate,
    }),
    displayFormatting,
    navigation: resolveFeaturedNavigation(variant, navigationRaw),
    presentation: {
      variant,
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
  const variant = presentationVariant(formData.get("presentation_variant"));
  const formatting = buildPageBlockTextFormattingPatch(formData, [
    { field: "eyebrow" },
    { field: "title", defaults: { bold: true } },
    { field: "description" },
    { field: "cta" },
  ]);
  const displayFormatting = resolveCollectionDisplayTextFormatting(
    Object.fromEntries(
      ["title", ...CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS].flatMap((field) => [
        [
          `${field}Bold`,
          formData.getAll(`display_${field}_bold`).at(-1),
        ],
        [
          `${field}Alignment`,
          formData.get(`display_${field}_alignment`),
        ],
      ]),
    ),
  );

  return featuredModuleConfigSchema.parse({
    source:
      kind === "categories" ? { kind, categorySlug } : { kind, contentType },
    selection:
      selectedMode === "manual"
        ? { mode: selectedMode, topicIds }
        : { mode: selectedMode },
    itemLimit,
    itemsPerView: resolveFeaturedItemsPerView(
      variant,
      formData.get("items_per_view"),
      itemLimit,
    ),
    display: buildContentDisplayOptionsFromFormData(formData, false),
    displayFormatting,
    navigation: resolveFeaturedNavigation(variant, {
      showArrows: formData.getAll("show_navigation_arrows").at(-1),
      showDots: formData.getAll("show_navigation_dots").at(-1),
      autoplay: formData.getAll("navigation_autoplay").at(-1),
    }),
    presentation: {
      ...formatting,
      variant,
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
