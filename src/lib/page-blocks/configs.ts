import type { AdminLinkValue } from "../admin/links/types";
import { deserializeAdminLink } from "../admin/links/serialize";
import {
  COLLECTION_LISTING_ITEMS_PER_ROW,
  COLLECTION_LISTING_LAYOUTS,
  type CollectionListingItemsPerRow,
  type CollectionListingLayout,
} from "../collection-modules/collection-view";
import {
  COLLECTION_LISTING_ITEM_LIMITS,
  type CollectionListingItemLimit,
} from "../collection-modules/item-limit";
import {
  asSearchPlatformConfig,
  isSearchPlatformTemplate,
  type SearchPlatformConfig,
} from "./search-platform-config";

export const PAGE_BLOCK_TEXT_ALIGNMENTS = ["right", "center", "left"] as const;
export type PageBlockTextAlignment =
  (typeof PAGE_BLOCK_TEXT_ALIGNMENTS)[number];

/**
 * Display Formatting Capability for Collection Modules.
 *
 * Collection Listing/Card consumers adopt this exact field inventory. Image
 * owns visibility only; every other field owns visibility, weight, and text
 * alignment through the shared Admin, parser, and public presentation owners.
 */
export const COLLECTION_MODULE_DISPLAY_FORMATTING_CAPABILITY = {
  id: "collection-module-display-formatting",
  fields: {
    title: "text",
    image: "visibility-only",
    category: "text",
    series: "text",
    excerpt: "text",
    date: "text",
    details: "text",
  },
} as const;

export const CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS = [
  "category",
  "series",
  "excerpt",
  "date",
] as const;
export type ContentDisplayFormattableTextField =
  (typeof CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS)[number];

export const PAGE_BLOCK_FORMATTABLE_TEXT_FIELDS = [
  "eyebrow",
  "title",
  "subtitle",
  "description",
  "highlight",
  "intro",
  "cta",
  "details",
] as const;
export type PageBlockFormattableTextField =
  (typeof PAGE_BLOCK_FORMATTABLE_TEXT_FIELDS)[number];
export type PageBlockTextFormattingField =
  | PageBlockFormattableTextField
  | ContentDisplayFormattableTextField;

type CapitalizedTextField<Field extends string> = Capitalize<Field>;

export type PageBlockTextFormattingConfig = Partial<
  {
    [
      Field in PageBlockFormattableTextField as `show${CapitalizedTextField<Field>}`
    ]: boolean;
  } & {
    [Field in PageBlockTextFormattingField as `${Field}Bold`]: boolean;
  } & {
    [
      Field in PageBlockTextFormattingField as `${Field}Alignment`
    ]: PageBlockTextAlignment;
  }
>;

export type ResolvedPageBlockTextFormat = {
  visible: boolean;
  bold: boolean;
  alignment: PageBlockTextAlignment;
};

export type PageBlockTextFormattingMap = Partial<
  Record<PageBlockTextFormattingField, ResolvedPageBlockTextFormat>
>;

export type PageBlockTextFormatDefaults = Partial<ResolvedPageBlockTextFormat>;

function formattingPropertyNames(field: PageBlockTextFormattingField) {
  const capitalized = `${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  return {
    visible: `show${capitalized}`,
    bold: `${field}Bold`,
    alignment: `${field}Alignment`,
  } as const;
}

function ownsFormattingVisibility(
  field: PageBlockTextFormattingField,
): field is PageBlockFormattableTextField {
  return PAGE_BLOCK_FORMATTABLE_TEXT_FIELDS.includes(
    field as PageBlockFormattableTextField,
  );
}

function readFormattingBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

export function resolvePageBlockTextFormat(
  raw: unknown,
  field: PageBlockTextFormattingField,
  defaults: PageBlockTextFormatDefaults = {},
): ResolvedPageBlockTextFormat {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const names = formattingPropertyNames(field);
  const alignmentRaw = record[names.alignment] ?? record[`${field}_alignment`];

  return {
    visible: ownsFormattingVisibility(field)
      ? readFormattingBoolean(
          record[names.visible] ?? record[`show_${field}`],
          defaults.visible ?? true,
        )
      : (defaults.visible ?? true),
    bold: readFormattingBoolean(
      record[names.bold] ?? record[`${field}_bold`],
      defaults.bold ?? false,
    ),
    alignment: PAGE_BLOCK_TEXT_ALIGNMENTS.includes(
      alignmentRaw as PageBlockTextAlignment,
    )
      ? (alignmentRaw as PageBlockTextAlignment)
      : (defaults.alignment ?? "right"),
  };
}

export function buildPageBlockTextFormattingPatch(
  formData: FormData,
  fields: ReadonlyArray<{
    field: PageBlockTextFormattingField;
    defaults?: PageBlockTextFormatDefaults;
    visibility?: boolean;
    bold?: boolean;
    alignment?: boolean;
  }>,
): PageBlockTextFormattingConfig {
  const patch: Record<string, boolean | PageBlockTextAlignment> = {};

  for (const descriptor of fields) {
    const { field, defaults = {} } = descriptor;
    const names = formattingPropertyNames(field);
    if (ownsFormattingVisibility(field) && descriptor.visibility !== false) {
      patch[names.visible] = readFormattingBoolean(
        formData.get(`show_${field}`),
        defaults.visible ?? true,
      );
    }
    if (descriptor.bold !== false) {
      patch[names.bold] = readFormattingBoolean(
        formData.get(`${field}_bold`),
        defaults.bold ?? false,
      );
    }
    if (descriptor.alignment !== false) {
      const alignment = String(formData.get(`${field}_alignment`) ?? "").trim();
      patch[names.alignment] = PAGE_BLOCK_TEXT_ALIGNMENTS.includes(
        alignment as PageBlockTextAlignment,
      )
        ? (alignment as PageBlockTextAlignment)
        : (defaults.alignment ?? "right");
    }
  }

  return patch as PageBlockTextFormattingConfig;
}

export function resolvePageBlockTextFormattingConfig(
  raw: unknown,
  fields: ReadonlyArray<{
    field: PageBlockTextFormattingField;
    defaults?: PageBlockTextFormatDefaults;
  }>,
): PageBlockTextFormattingConfig {
  const resolved: Record<string, boolean | PageBlockTextAlignment> = {};

  for (const descriptor of fields) {
    const names = formattingPropertyNames(descriptor.field);
    const format = resolvePageBlockTextFormat(
      raw,
      descriptor.field,
      descriptor.defaults,
    );
    if (ownsFormattingVisibility(descriptor.field)) {
      resolved[names.visible] = format.visible;
    }
    resolved[names.bold] = format.bold;
    resolved[names.alignment] = format.alignment;
  }

  return resolved as PageBlockTextFormattingConfig;
}

export function resolvePageBlockTextFormattingMap(
  raw: unknown,
  fields: ReadonlyArray<{
    field: PageBlockTextFormattingField;
    defaults?: PageBlockTextFormatDefaults;
  }>,
): PageBlockTextFormattingMap {
  return Object.fromEntries(
    fields.map(({ field, defaults }) => [
      field,
      resolvePageBlockTextFormat(raw, field, defaults),
    ]),
  ) as PageBlockTextFormattingMap;
}

export function pageBlockTextAlignClass(alignment: PageBlockTextAlignment) {
  if (alignment === "center") return "!text-center [&_*]:!text-center";
  if (alignment === "left") return "!text-left [&_*]:!text-left";
  return "!text-right [&_*]:!text-right";
}

export function pageBlockTextPlacementClass(alignment: PageBlockTextAlignment) {
  if (alignment === "center") return "mx-auto";
  if (alignment === "left") return "mr-auto ml-0";
  return "ml-auto mr-0";
}

export type ContentBlockConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  alignment?: "start" | "center";
};

export const TOPICS_LISTING_PRESENTATIONS = COLLECTION_LISTING_LAYOUTS;
export type TopicsListingPresentation = CollectionListingLayout;

export const TOPICS_LISTING_ITEMS_PER_ROW = COLLECTION_LISTING_ITEMS_PER_ROW;
export type TopicsListingItemsPerRow = CollectionListingItemsPerRow;

export const TOPICS_LISTING_ITEM_LIMITS = COLLECTION_LISTING_ITEM_LIMITS;
export type TopicsListingItemLimit = CollectionListingItemLimit;

export type TopicsListingCollection =
  { type: "all" } | { type: "category"; categorySlug: string };

export type CollectionDetailsAction = {
  text: string;
  visible: boolean;
  bold: boolean;
  alignment: PageBlockTextAlignment;
};

export const COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS = {
  title: { bold: true, alignment: "right" },
  category: { bold: false, alignment: "right" },
  series: { bold: false, alignment: "right" },
  excerpt: { bold: false, alignment: "right" },
  date: { bold: false, alignment: "right" },
} as const satisfies Record<
  "title" | ContentDisplayFormattableTextField,
  PageBlockTextFormatDefaults
>;

export type ResolvedCollectionDisplayTextFormatting = {
  titleBold: boolean;
  titleAlignment: PageBlockTextAlignment;
  categoryBold: boolean;
  categoryAlignment: PageBlockTextAlignment;
  seriesBold: boolean;
  seriesAlignment: PageBlockTextAlignment;
  excerptBold: boolean;
  excerptAlignment: PageBlockTextAlignment;
  dateBold: boolean;
  dateAlignment: PageBlockTextAlignment;
};

export type CollectionDisplayTextFormatting =
  Partial<ResolvedCollectionDisplayTextFormatting>;

export function resolveCollectionDisplayTextFormatting(
  raw: unknown,
): ResolvedCollectionDisplayTextFormatting {
  const title = resolvePageBlockTextFormat(
    raw,
    "title",
    COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.title,
  );
  const category = resolvePageBlockTextFormat(
    raw,
    "category",
    COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.category,
  );
  const series = resolvePageBlockTextFormat(
    raw,
    "series",
    COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.series,
  );
  const excerpt = resolvePageBlockTextFormat(
    raw,
    "excerpt",
    COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.excerpt,
  );
  const date = resolvePageBlockTextFormat(
    raw,
    "date",
    COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.date,
  );

  return {
    titleBold: title.bold,
    titleAlignment: title.alignment,
    categoryBold: category.bold,
    categoryAlignment: category.alignment,
    seriesBold: series.bold,
    seriesAlignment: series.alignment,
    excerptBold: excerpt.bold,
    excerptAlignment: excerpt.alignment,
    dateBold: date.bold,
    dateAlignment: date.alignment,
  };
}

export function buildCollectionDisplayTextFormattingFromFormData(
  formData: FormData,
): ResolvedCollectionDisplayTextFormatting {
  return buildPageBlockTextFormattingPatch(formData, [
    {
      field: "title",
      visibility: false,
      defaults: COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.title,
    },
    {
      field: "category",
      defaults: COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.category,
    },
    {
      field: "series",
      defaults: COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.series,
    },
    {
      field: "excerpt",
      defaults: COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.excerpt,
    },
    {
      field: "date",
      defaults: COLLECTION_DISPLAY_TEXT_FORMAT_DEFAULTS.date,
    },
  ]) as ResolvedCollectionDisplayTextFormatting;
}

export const DEFAULT_COLLECTION_DETAILS_ACTION: CollectionDetailsAction = {
  text: "اقرأ المزيد",
  visible: true,
  bold: false,
  alignment: "right",
};

export function resolveCollectionDetailsAction(
  raw: unknown,
  defaults: CollectionDetailsAction = DEFAULT_COLLECTION_DETAILS_ACTION,
): CollectionDetailsAction {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const alignment = PAGE_BLOCK_TEXT_ALIGNMENTS.includes(
    value.alignment as PageBlockTextAlignment,
  )
    ? (value.alignment as PageBlockTextAlignment)
    : defaults.alignment;

  return {
    text: text || defaults.text,
    visible: readFormattingBoolean(value.visible, defaults.visible),
    bold: readFormattingBoolean(value.bold, defaults.bold),
    alignment,
  };
}

export function buildCollectionDetailsActionFromFormData(
  formData: FormData,
  defaults: CollectionDetailsAction = DEFAULT_COLLECTION_DETAILS_ACTION,
): CollectionDetailsAction {
  const text = String(formData.get("details_text") ?? "").trim();
  if (!text) throw new Error("نص زر التفاصيل مطلوب.");

  const formatting = buildPageBlockTextFormattingPatch(formData, [
    {
      field: "details",
      defaults,
    },
  ]);
  const resolved = resolvePageBlockTextFormat(
    formatting,
    "details",
    defaults,
  );

  return { text, ...resolved };
}

export const CONTENT_DISPLAY_FIELDS = [
  "title",
  "image",
  "excerpt",
  "date",
  "category",
  "series",
] as const;
export type ContentDisplayField = (typeof CONTENT_DISPLAY_FIELDS)[number];

export type ContentDisplayOptions = Record<ContentDisplayField, boolean>;

export const CONTENT_DISPLAY_FORM_FIELDS: Record<ContentDisplayField, string> =
  {
    title: "show_title_on_page",
    image: "show_image_on_page",
    category: "show_category_on_page",
    series: "show_series_on_page",
    excerpt: "show_excerpt_on_page",
    date: "show_date_on_page",
  };

export function resolveContentDisplayOptions(
  raw: unknown,
  fallback: boolean | ContentDisplayOptions = true,
): ContentDisplayOptions {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    CONTENT_DISPLAY_FIELDS.map((field) => [
      field,
      readFormattingBoolean(
        value[field],
        typeof fallback === "boolean" ? fallback : fallback[field],
      ),
    ]),
  ) as ContentDisplayOptions;
}

export function buildContentDisplayOptionsFromFormData(
  formData: FormData,
  fallback: boolean | ContentDisplayOptions = true,
): ContentDisplayOptions {
  return Object.fromEntries(
    CONTENT_DISPLAY_FIELDS.map((field) => [
      field,
      readFormattingBoolean(
        formData.get(CONTENT_DISPLAY_FORM_FIELDS[field]),
        typeof fallback === "boolean" ? fallback : fallback[field],
      ),
    ]),
  ) as ContentDisplayOptions;
}

export function resolveContentItemDisplay(
  display: ContentDisplayOptions,
  itemDisplay: ContentDisplayOptions,
  values: Record<ContentDisplayField, string>,
): ContentDisplayOptions {
  return Object.fromEntries(
    CONTENT_DISPLAY_FIELDS.map((field) => [
      field,
      display[field] && itemDisplay[field] && Boolean(values[field]),
    ]),
  ) as ContentDisplayOptions;
}

export type CollectionDisplayOverrides = ContentDisplayOptions &
  CollectionDisplayTextFormatting & {
    details: CollectionDetailsAction;
  };

export type ResolvedCollectionModuleDisplayFormatting =
  CollectionDisplayOverrides & ResolvedCollectionDisplayTextFormatting;

export type TopicsListingDisplayOverrides =
  ResolvedCollectionModuleDisplayFormatting;

export function resolveCollectionModuleDisplayFormatting(
  raw: unknown,
): ResolvedCollectionModuleDisplayFormatting {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    ...resolveContentDisplayOptions(value),
    ...resolveCollectionDisplayTextFormatting(value),
    details: resolveCollectionDetailsAction(value.details),
  };
}

export function resolveCollectionModuleItemDisplay(
  display: CollectionDisplayOverrides,
  itemDisplay: ContentDisplayOptions,
  values: Record<ContentDisplayField, string>,
): ResolvedCollectionModuleDisplayFormatting {
  const resolved = resolveCollectionModuleDisplayFormatting(display);

  return {
    ...resolved,
    ...resolveContentItemDisplay(resolved, itemDisplay, values),
    details: {
      ...resolved.details,
      visible: resolved.details.visible && Boolean(resolved.details.text),
    },
  };
}

export function buildCollectionModuleDisplayFormattingFromFormData(
  formData: FormData,
): ResolvedCollectionModuleDisplayFormatting {
  return {
    ...buildContentDisplayOptionsFromFormData(formData, false),
    ...buildCollectionDisplayTextFormattingFromFormData(formData),
    details: buildCollectionDetailsActionFromFormData(formData),
  };
}

export type TopicsListingBlockConfig = {
  collection: TopicsListingCollection;
  presentation: TopicsListingPresentation;
  itemsPerRow: TopicsListingItemsPerRow;
  itemLimit: TopicsListingItemLimit;
  display: TopicsListingDisplayOverrides;
};

export type AboutIntroBeatConfig = {
  num?: string;
  title?: string;
  text?: string;
};

export type AboutIntroImagesConfig = {
  main?: string;
  secondary?: string;
  accent?: string;
  mainAlt?: string;
  secondaryAlt?: string;
  accentAlt?: string;
};

/** Structured config for About Intro (text + up to 3 images + beats). */
export type AboutIntroModuleConfig = ContentBlockConfig & {
  images?: AboutIntroImagesConfig;
  beats?: AboutIntroBeatConfig[];
  /** Optional CTA — used by home-story; ignored by About Who We Are renderer. */
  button?: AboutCtaButtonConfig;
};

/** Single-image About Intro variant — independent of about-intro (two/three frames). */
export type AboutIntroSingleImageModuleConfig = ContentBlockConfig & {
  images?: Pick<AboutIntroImagesConfig, "main" | "mainAlt">;
  beats?: AboutIntroBeatConfig[];
  /** Desktop image column: right | left. Default left. Mobile always stacks image above. */
  imagePosition?: "left" | "right";
};

export type VisionGoalsItemConfig = {
  title?: string;
  text?: string;
};

export type VisionGoalsColumnConfig = {
  title?: string;
  items?: VisionGoalsItemConfig[];
};

/** Structured config for the Vision & Goals visual section (text + image + two columns). */
export type VisionGoalsModuleConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  intro?: string[];
  image?: string;
  imageAlt?: string;
  vision?: VisionGoalsColumnConfig;
  goals?: VisionGoalsColumnConfig;
};

export type AboutCtaContactConfig = {
  label?: string;
  value?: string;
  /** Optional second WhatsApp number (home-contact whatsapp row only). */
  secondaryValue?: string;
  href?: string;
  icon?: string;
  link?: AdminLinkValue;
  target?: "_self" | "_blank";
};

export type AboutCtaButtonConfig = {
  label?: string;
  href?: string;
  link?: AdminLinkValue;
  target?: "_self" | "_blank";
  /** Home Story CTA layout — optional; ignored by other About CTA renderers. */
  alignment?: "right" | "center" | "left";
  icon?: "none" | "arrow";
  iconPosition?: "right" | "left";
};

/** Structured config for the About CTA band (contacts + copy + image). */
export type AboutCtaModuleConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  description?: string;
  button?: AboutCtaButtonConfig;
  note?: string;
  image?: string;
  imageAlt?: string;
  contacts?: AboutCtaContactConfig[];
};

export const ABOUT_PRINCIPLES_ICON_KEYS = [
  "land",
  "engineering",
  "timeline",
] as const;
export type AboutPrinciplesIconKey =
  (typeof ABOUT_PRINCIPLES_ICON_KEYS)[number];

export type AboutPrinciplesItemConfig = {
  icon?: AboutPrinciplesIconKey | string;
  title?: string;
  description?: string;
  /** Optional card background image (home-trust Layered Image Reveal). */
  image?: string;
  /** Optional alt text for the card image (home-trust). */
  imageAlt?: string;
};

/** Structured config for the About Principles section. */
export type AboutPrinciplesModuleConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  /** Optional intro copy — used by home-trust; ignored by About Principles renderer. */
  description?: string;
  /** Plain-text eyebrow weight (home-trust). Legacy default: false (was not bold). */
  eyebrowBold?: boolean;
  /** Physical text alignment for eyebrow (home-trust). Legacy default: right. */
  eyebrowAlignment?: "right" | "center" | "left";
  /** Plain-text title weight (home-trust). Legacy default: true (was font-bold). */
  titleBold?: boolean;
  /** Physical text alignment for title (home-trust). Legacy default: right. */
  titleAlignment?: "right" | "center" | "left";
  items?: AboutPrinciplesItemConfig[];
};

/** Structured config for the About Approach section. */
export type AboutApproachModuleConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
};

/** Section copy for Home Projects — project cards remain in the projects table. */
export type HomeProjectsModuleConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  intro?: string;
  showEyebrow?: boolean;
  showTitle?: boolean;
  showIntro?: boolean;
  showProjectLocation?: boolean;
  showFooterCta?: boolean;
  projectsLimit?: number;
  /** Editable label rendered inside every project card CTA. */
  cardCtaLabel?: string;
  /**
   * Physical alignment of the in-card «استكشف المشروع» CTA.
   * Default for legacy content (missing key): right — matches prior RTL inline-flex start.
   */
  cardCtaAlignment?: "right" | "center" | "left";
  /** Plain-text eyebrow weight. Legacy default: true (was rendered at 700). */
  eyebrowBold?: boolean;
  /** Physical text alignment within the heading column. Legacy default: right. */
  eyebrowAlignment?: "right" | "center" | "left";
  footerCta?: {
    label?: string;
    href?: string;
    link?: AdminLinkValue;
    target?: "_self" | "_blank";
    /** Physical section alignment for the footer CTA. Default for legacy content: center. */
    alignment?: "right" | "center" | "left";
  };
};

export type CtaLinkConfig = {
  label?: string;
  href?: string;
  target?: "_self" | "_blank";
  link?: AdminLinkValue;
};

export type CtaBlockConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  highlight?: string;
  description?: string;
  primaryCta?: CtaLinkConfig;
  secondaryCta?: CtaLinkConfig;
  backgroundImage?: string;
  backgroundStyle?: "dark" | "gold" | "gradient";
};

export type CardsBlockItem = {
  title?: string;
  body?: string;
  icon?: string;
  href?: string;
  link?: AdminLinkValue;
  target?: "_self" | "_blank";
};

export type CardsBlockConfig = PageBlockTextFormattingConfig & {
  eyebrow?: string;
  title?: string;
  description?: string;
  columns?: 2 | 3 | 4;
  items?: CardsBlockItem[];
};

export type BreadcrumbBlockItem = {
  label?: string;
  href?: string;
  link?: AdminLinkValue;
};

export type BreadcrumbBlockConfig = {
  source?: "navigation" | "manual";
  showHome?: boolean;
  currentLabelOverride?: string;
  manualItems?: BreadcrumbBlockItem[];
};

const PAGE_BLOCK_SEO_TEXT_KEYS = new Set([
  "eyebrow",
  "title",
  "subtitle",
  "body",
  "description",
  "text",
  "intro",
  "highlight",
  "note",
  "label",
  "value",
  "secondaryValue",
  "num",
  "currentLabelOverride",
  "question",
  "answer",
]);

/**
 * Extracts authored, visible copy from the existing Page Block config truth.
 * URLs, image paths, identifiers, icons, and presentation controls are excluded.
 */
export function extractPageBlockSeoText(config: unknown): string {
  const values: string[] = [];

  function visit(value: unknown, key: string | null) {
    if (typeof value === "string") {
      const cleaned = value.trim();
      if (cleaned && key && PAGE_BLOCK_SEO_TEXT_KEYS.has(key)) {
        values.push(cleaned);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    for (const [nestedKey, nestedValue] of Object.entries(record)) {
      const visibilityKey = `show${nestedKey.charAt(0).toUpperCase()}${nestedKey.slice(1)}`;
      if (record[visibilityKey] === false) continue;
      visit(nestedValue, nestedKey);
    }
  }

  visit(config, null);
  return values.join("\n");
}

export function asContentConfig(raw: unknown): ContentBlockConfig {
  const config = (raw ?? {}) as ContentBlockConfig;
  const legacyAlignment = config.alignment === "center" ? "center" : "right";
  return {
    ...config,
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow", defaults: { alignment: legacyAlignment } },
      { field: "title", defaults: { bold: true, alignment: legacyAlignment } },
      { field: "subtitle", defaults: { alignment: legacyAlignment } },
      { field: "description", defaults: { alignment: legacyAlignment } },
    ]),
  };
}

export function asTopicsListingConfig(raw: unknown): TopicsListingBlockConfig {
  const config =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const presentation = String(config.presentation ?? "").trim();
  const itemsPerRow = Number(config.itemsPerRow ?? config.items_per_row);
  const itemLimit = Number(config.itemLimit ?? config.item_limit);
  const rawCollection =
    config.collection &&
    typeof config.collection === "object" &&
    !Array.isArray(config.collection)
      ? (config.collection as Record<string, unknown>)
      : {};
  const collectionType = String(rawCollection.type ?? "").trim();
  const categorySlug = String(
    rawCollection.categorySlug ?? rawCollection.category_slug ?? "",
  ).trim();
  const collection: TopicsListingCollection =
    collectionType === "category" && categorySlug
      ? { type: "category", categorySlug }
      : { type: "all" };
  const rawDisplay =
    config.display &&
    typeof config.display === "object" &&
    !Array.isArray(config.display)
      ? (config.display as Record<string, unknown>)
      : {};
  return {
    collection,
    presentation: TOPICS_LISTING_PRESENTATIONS.includes(
      presentation as TopicsListingPresentation,
    )
      ? (presentation as TopicsListingPresentation)
      : "list",
    itemsPerRow: TOPICS_LISTING_ITEMS_PER_ROW.includes(
      itemsPerRow as TopicsListingItemsPerRow,
    )
      ? (itemsPerRow as TopicsListingItemsPerRow)
      : 3,
    itemLimit: TOPICS_LISTING_ITEM_LIMITS.includes(
      itemLimit as TopicsListingItemLimit,
    )
      ? (itemLimit as TopicsListingItemLimit)
      : 6,
    display: resolveCollectionModuleDisplayFormatting(rawDisplay),
  };
}

export function isTopicsListingTemplate(slug: string, variant?: string | null) {
  return slug === "topics-listing" || variant === "topics-listing";
}

export function isAboutIntroTemplate(slug: string, variant?: string | null) {
  return slug === "about-intro" || variant === "about-intro";
}

export function isAboutIntroSingleImageTemplate(
  slug: string,
  variant?: string | null,
) {
  return (
    slug === "about-intro-single-image" ||
    variant === "about-intro-single-image"
  );
}

export function isHomeStoryTemplate(slug: string, variant?: string | null) {
  return slug === "home-story" || variant === "home-story";
}

/** Shared config shape (about-intro schema) — not the same admin module identity as about-intro. */
export function usesAboutIntroConfigSchema(
  slug: string,
  variant?: string | null,
) {
  return (
    isAboutIntroTemplate(slug, variant) || isHomeStoryTemplate(slug, variant)
  );
}

export function isVisionGoalsTemplate(slug: string, variant?: string | null) {
  return slug === "vision-goals" || variant === "vision-goals";
}

export function isAboutCtaTemplate(slug: string, variant?: string | null) {
  return slug === "about-cta" || variant === "about-cta";
}

export function isHomeContactTemplate(slug: string, variant?: string | null) {
  return slug === "home-contact" || variant === "home-contact";
}

/** Shared config shape (about-cta schema) — not the same admin module identity as about-cta. */
export function usesAboutCtaConfigSchema(
  slug: string,
  variant?: string | null,
) {
  return (
    isAboutCtaTemplate(slug, variant) || isHomeContactTemplate(slug, variant)
  );
}

export function isAboutPrinciplesTemplate(
  slug: string,
  variant?: string | null,
) {
  return slug === "about-principles" || variant === "about-principles";
}

export function isHomeTrustTemplate(slug: string, variant?: string | null) {
  return slug === "home-trust" || variant === "home-trust";
}

export function isHomeProjectsTemplate(slug: string, variant?: string | null) {
  return slug === "home-projects" || variant === "home-projects";
}

/** Shared config shape (about-principles schema) — not the same admin module identity as about-principles. */
export function usesAboutPrinciplesConfigSchema(
  slug: string,
  variant?: string | null,
) {
  return (
    isAboutPrinciplesTemplate(slug, variant) ||
    isHomeTrustTemplate(slug, variant)
  );
}

export function isAboutApproachTemplate(slug: string, variant?: string | null) {
  return slug === "about-approach" || variant === "about-approach";
}

export function resolveContentBlockConfig(template: {
  slug: string;
  variant?: string | null;
  config: unknown;
}):
  | ContentBlockConfig
  | AboutIntroModuleConfig
  | VisionGoalsModuleConfig
  | AboutCtaModuleConfig
  | AboutPrinciplesModuleConfig
  | AboutApproachModuleConfig
  | HomeProjectsModuleConfig
  | SearchPlatformConfig {
  if (isSearchPlatformTemplate(template.slug, template.variant)) {
    return asSearchPlatformConfig(template.config);
  }
  if (usesAboutIntroConfigSchema(template.slug, template.variant)) {
    return asAboutIntroConfig(template.config);
  }
  if (isAboutIntroSingleImageTemplate(template.slug, template.variant)) {
    return asAboutIntroSingleImageConfig(template.config);
  }
  if (isVisionGoalsTemplate(template.slug, template.variant)) {
    return asVisionGoalsConfig(template.config);
  }
  if (usesAboutCtaConfigSchema(template.slug, template.variant)) {
    return asAboutCtaConfig(template.config);
  }
  if (usesAboutPrinciplesConfigSchema(template.slug, template.variant)) {
    return asAboutPrinciplesConfig(template.config);
  }
  if (isAboutApproachTemplate(template.slug, template.variant)) {
    return asAboutApproachConfig(template.config);
  }
  if (isHomeProjectsTemplate(template.slug, template.variant)) {
    return asHomeProjectsConfig(template.config);
  }
  return asContentConfig(template.config);
}

export function asAboutIntroConfig(raw: unknown): AboutIntroModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  const imagesRaw = config.images as Record<string, unknown> | undefined;
  const readImage = (nestedKey: string, flatKey: string) =>
    readText(imagesRaw?.[nestedKey]) || readText(config[flatKey]) || undefined;

  const images =
    imagesRaw ||
    config.image_main ||
    config.image_secondary ||
    config.image_accent
      ? {
          main: readImage("main", "image_main"),
          secondary: readImage("secondary", "image_secondary"),
          accent: readImage("accent", "image_accent"),
          mainAlt:
            readText(
              imagesRaw?.mainAlt ??
                imagesRaw?.main_alt ??
                config.image_main_alt,
            ) || undefined,
          secondaryAlt:
            readText(
              imagesRaw?.secondaryAlt ??
                imagesRaw?.secondary_alt ??
                config.image_secondary_alt,
            ) || undefined,
          accentAlt:
            readText(
              imagesRaw?.accentAlt ??
                imagesRaw?.accent_alt ??
                config.image_accent_alt,
            ) || undefined,
        }
      : undefined;

  const beatsRaw = config.beats;
  const beats = Array.isArray(beatsRaw)
    ? beatsRaw.slice(0, 3).map((beat, index) => {
        const row = beat as Record<string, unknown>;
        return {
          num: readText(row.num) || String(index + 1).padStart(2, "0"),
          title: readText(row.title) || undefined,
          text: readText(row.text) || undefined,
        };
      })
    : undefined;

  const buttonRaw =
    config.button && typeof config.button === "object"
      ? (config.button as Record<string, unknown>)
      : undefined;
  const buttonLabel =
    readText(buttonRaw?.label ?? config.button_label) || undefined;
  const buttonHref =
    readText(buttonRaw?.href ?? config.button_href) || undefined;
  const buttonLink =
    buttonRaw?.link && typeof buttonRaw.link === "object"
      ? deserializeAdminLink(buttonRaw.link)
      : undefined;
  const buttonTarget =
    buttonRaw?.target === "_blank" || buttonRaw?.target === "_self"
      ? (buttonRaw.target as "_blank" | "_self")
      : undefined;
  const buttonAlignment =
    buttonRaw?.alignment === "center" ||
    buttonRaw?.alignment === "left" ||
    buttonRaw?.alignment === "right"
      ? (buttonRaw.alignment as "right" | "center" | "left")
      : undefined;
  const buttonIcon =
    buttonRaw?.icon === "arrow" || buttonRaw?.icon === "none"
      ? (buttonRaw.icon as "none" | "arrow")
      : undefined;
  const buttonIconPosition =
    buttonRaw?.iconPosition === "left" || buttonRaw?.iconPosition === "right"
      ? (buttonRaw.iconPosition as "right" | "left")
      : undefined;
  const button =
    buttonLabel || buttonHref || buttonLink
      ? {
          ...(buttonLabel ? { label: buttonLabel } : {}),
          ...(buttonHref ? { href: buttonHref } : {}),
          ...(buttonLink ? { link: buttonLink } : {}),
          ...(buttonTarget ? { target: buttonTarget } : {}),
          ...(buttonAlignment ? { alignment: buttonAlignment } : {}),
          ...(buttonIcon ? { icon: buttonIcon } : {}),
          ...(buttonIconPosition ? { iconPosition: buttonIconPosition } : {}),
        }
      : undefined;

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "subtitle" },
      { field: "description" },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    subtitle: readText(config.subtitle) || undefined,
    body: readText(config.body) || undefined,
    alignment: config.alignment === "center" ? "center" : "start",
    images,
    beats,
    button,
  };
}

export function asAboutIntroSingleImageConfig(
  raw: unknown,
): AboutIntroSingleImageModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const imagesRaw = config.images as Record<string, unknown> | undefined;
  const main =
    readText(imagesRaw?.main) ||
    readText(config.image_main) ||
    readText(config.image) ||
    undefined;
  const mainAlt =
    readText(
      imagesRaw?.mainAlt ??
        imagesRaw?.main_alt ??
        config.image_main_alt ??
        config.imageAlt,
    ) || undefined;
  const beatsRaw = config.beats;
  const beats = Array.isArray(beatsRaw)
    ? beatsRaw.slice(0, 3).map((beat, index) => {
        const row = beat as Record<string, unknown>;
        return {
          num: readText(row.num) || String(index + 1).padStart(2, "0"),
          title: readText(row.title) || undefined,
          text: readText(row.text) || undefined,
        };
      })
    : undefined;
  const positionRaw = readText(
    config.imagePosition ?? config.image_position,
  ).toLowerCase();

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "subtitle" },
      { field: "description" },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    subtitle: readText(config.subtitle) || undefined,
    body: readText(config.body) || undefined,
    alignment: config.alignment === "center" ? "center" : "start",
    images: main || mainAlt ? { main, mainAlt } : undefined,
    beats,
    imagePosition: positionRaw === "right" ? "right" : "left",
  };
}

function readVisionGoalsColumn(
  raw: unknown,
): VisionGoalsColumnConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const column = raw as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const itemsRaw = column.items;

  const items = Array.isArray(itemsRaw)
    ? (itemsRaw
        .map((item) => {
          const row = item as Record<string, unknown>;
          const title = readText(row.title);
          const text = readText(row.text);
          if (!title && !text) return null;
          return { title: title || undefined, text: text || undefined };
        })
        .filter(Boolean) as VisionGoalsItemConfig[])
    : undefined;

  const title = readText(column.title) || undefined;

  return title || items?.length ? { title, items } : undefined;
}

export function asVisionGoalsConfig(raw: unknown): VisionGoalsModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  const image =
    readText(config.image) ||
    readText(config.image_path) ||
    readText(config.imagePath) ||
    undefined;

  const introRaw = config.intro;
  let intro: string[] | undefined;
  if (Array.isArray(introRaw)) {
    intro = introRaw.map(readText).filter(Boolean);
  } else if (typeof introRaw === "string" && introRaw.trim()) {
    intro = introRaw
      .split(/\n{2,}/)
      .map(readText)
      .filter(Boolean);
  } else if (typeof config.body === "string" && config.body.trim()) {
    intro = config.body
      .split(/\n{2,}/)
      .map(readText)
      .filter(Boolean);
  }

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "intro" },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    intro,
    image,
    imageAlt: readText(config.imageAlt ?? config.image_alt) || undefined,
    vision: readVisionGoalsColumn(config.vision),
    goals: readVisionGoalsColumn(config.goals),
  };
}

export function asAboutCtaConfig(raw: unknown): AboutCtaModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const readTarget = (value: unknown): "_self" | "_blank" | undefined =>
    value === "_blank" || value === "_self" ? value : undefined;

  const buttonRaw =
    config.button && typeof config.button === "object"
      ? (config.button as Record<string, unknown>)
      : undefined;
  const buttonLabel =
    readText(buttonRaw?.label) || readText(config.button_label) || undefined;
  const buttonHref =
    readText(buttonRaw?.href) || readText(config.button_href) || undefined;
  const buttonLink =
    buttonRaw?.link && typeof buttonRaw.link === "object"
      ? deserializeAdminLink(buttonRaw.link)
      : undefined;
  const buttonTarget = readTarget(buttonRaw?.target);
  const button =
    buttonLabel || buttonHref || buttonLink
      ? {
          ...(buttonLabel ? { label: buttonLabel } : {}),
          ...(buttonHref ? { href: buttonHref } : {}),
          ...(buttonLink ? { link: buttonLink } : {}),
          ...(buttonTarget ? { target: buttonTarget } : {}),
        }
      : undefined;

  const image =
    readText(config.image) ||
    readText(config.image_path) ||
    readText(config.imagePath) ||
    undefined;

  const contactsRaw = config.contacts;
  const contacts = Array.isArray(contactsRaw)
    ? (contactsRaw
        .slice(0, 4)
        .map((item) => {
          const row = item as Record<string, unknown>;
          const label = readText(row.label);
          const value = readText(row.value);
          const secondaryValue =
            readText(row.secondaryValue ?? row.secondary_value) || undefined;
          const href = readText(row.href) || undefined;
          const icon = readText(row.icon) || undefined;
          const link =
            row.link && typeof row.link === "object"
              ? deserializeAdminLink(row.link)
              : undefined;
          const target = readTarget(row.target);
          if (!label && !value && !secondaryValue && !href && !link)
            return null;
          return {
            ...(label ? { label } : {}),
            ...(value ? { value } : {}),
            ...(secondaryValue ? { secondaryValue } : {}),
            ...(href ? { href } : {}),
            ...(icon ? { icon } : {}),
            ...(link ? { link } : {}),
            ...(target ? { target } : {}),
          };
        })
        .filter(Boolean) as AboutCtaContactConfig[])
    : undefined;

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    description:
      readText(config.description) || readText(config.body) || undefined,
    button,
    note: readText(config.note) || undefined,
    image,
    imageAlt: readText(config.imageAlt ?? config.image_alt) || undefined,
    contacts,
  };
}

function normalizePrinciplesIcon(value: unknown): AboutPrinciplesIconKey {
  const key = typeof value === "string" ? value.trim() : "";
  if (ABOUT_PRINCIPLES_ICON_KEYS.includes(key as AboutPrinciplesIconKey)) {
    return key as AboutPrinciplesIconKey;
  }
  return "land";
}

export function asAboutPrinciplesConfig(
  raw: unknown,
): AboutPrinciplesModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  const itemsRaw = config.items;
  const items = Array.isArray(itemsRaw)
    ? (itemsRaw
        .slice(0, 6)
        .map((item) => {
          const row = item as Record<string, unknown>;
          const title = readText(row.title);
          const description = readText(row.description ?? row.text ?? row.body);
          const icon = normalizePrinciplesIcon(row.icon);
          const image = readText(row.image);
          const imageAlt = readText(row.imageAlt ?? row.image_alt);
          if (!title && !description) return null;
          return {
            icon,
            title: title || undefined,
            description: description || undefined,
            image: image || undefined,
            imageAlt: imageAlt || undefined,
          };
        })
        .filter(Boolean) as AboutPrinciplesItemConfig[])
    : undefined;

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    description: readText(config.description) || undefined,
    items,
  };
}

export function asAboutApproachConfig(raw: unknown): AboutApproachModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
  };
}

export function asHomeProjectsConfig(raw: unknown): HomeProjectsModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const readShowFlag = (camelKey: string, snakeKey: string) => {
    const value = config[camelKey] ?? config[snakeKey];
    if (typeof value === "boolean") return value;
    if (value === "false" || value === "0") return false;
    if (value === "true" || value === "1") return true;
    return true;
  };
  const footerRaw = config.footerCta ?? config.footer_cta;
  const footer =
    footerRaw && typeof footerRaw === "object"
      ? (footerRaw as Record<string, unknown>)
      : undefined;
  const limitRaw = config.projectsLimit ?? config.projects_limit;
  const parsedLimit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.floor(limitRaw)
      : typeof limitRaw === "string" && limitRaw.trim()
        ? (() => {
            const parsed = Number(limitRaw);
            return Number.isFinite(parsed) && parsed > 0
              ? Math.floor(parsed)
              : undefined;
          })()
        : undefined;

  const cardAlignRaw = config.cardCtaAlignment ?? config.card_cta_alignment;
  const cardCtaAlignment =
    cardAlignRaw === "right" ||
    cardAlignRaw === "left" ||
    cardAlignRaw === "center"
      ? cardAlignRaw
      : undefined;

  return {
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow", defaults: { bold: true } },
      { field: "title", defaults: { bold: true } },
      { field: "intro" },
    ]),
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    intro: readText(config.intro) || undefined,
    showEyebrow: readShowFlag("showEyebrow", "show_eyebrow"),
    showTitle: readShowFlag("showTitle", "show_title"),
    showIntro: readShowFlag("showIntro", "show_intro"),
    showProjectLocation: readShowFlag(
      "showProjectLocation",
      "show_project_location",
    ),
    showFooterCta: readShowFlag("showFooterCta", "show_footer_cta"),
    projectsLimit: parsedLimit,
    cardCtaLabel:
      readText(config.cardCtaLabel ?? config.card_cta_label) ||
      "استكشف المشروع",
    cardCtaAlignment,
    footerCta: footer
      ? {
          label: readText(footer.label) || undefined,
          href: readText(footer.href) || undefined,
          link:
            footer.link && typeof footer.link === "object"
              ? deserializeAdminLink(footer.link)
              : undefined,
          target:
            footer.target === "_blank"
              ? "_blank"
              : footer.target === "_self"
                ? "_self"
                : undefined,
          alignment:
            footer.alignment === "right" ||
            footer.alignment === "left" ||
            footer.alignment === "center"
              ? footer.alignment
              : undefined,
        }
      : undefined,
  };
}

export function asCtaConfig(raw: unknown): CtaBlockConfig {
  const config = (raw ?? {}) as CtaBlockConfig;
  return {
    ...config,
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow", defaults: { bold: true } },
      { field: "title", defaults: { bold: true } },
      { field: "highlight", defaults: { bold: true } },
      { field: "description" },
      { field: "cta" },
    ]),
  };
}

export function asCardsConfig(raw: unknown): CardsBlockConfig {
  const config = (raw ?? {}) as CardsBlockConfig;
  return {
    ...config,
    ...resolvePageBlockTextFormattingConfig(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
  };
}

export function asBreadcrumbConfig(raw: unknown): BreadcrumbBlockConfig {
  const config = (raw ?? {}) as Record<string, unknown>;

  const readText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const source = config.source === "manual" ? "manual" : "navigation";

  let showHome = true;
  if (typeof config.showHome === "boolean") {
    showHome = config.showHome;
  } else if (config.show_home === false || config.show_home === "false") {
    showHome = false;
  }

  const manualRaw = config.manualItems ?? config.manual_items;
  const manualItems = Array.isArray(manualRaw)
    ? (manualRaw
        .map((item) => {
          const row = item as Record<string, unknown>;
          const label = readText(row.label);
          const href = readText(row.href);
          const link =
            row.link && typeof row.link === "object"
              ? deserializeAdminLink(row.link)
              : undefined;
          if (!label) return null;
          return {
            label,
            ...(href ? { href } : {}),
            ...(link ? { link } : {}),
          };
        })
        .filter(Boolean) as BreadcrumbBlockItem[])
    : undefined;

  const currentLabelOverride =
    readText(config.currentLabelOverride) ||
    readText(config.current_label_override) ||
    undefined;

  return {
    source,
    showHome,
    currentLabelOverride,
    manualItems,
  };
}
