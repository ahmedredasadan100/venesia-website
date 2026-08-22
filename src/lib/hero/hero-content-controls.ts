/**
 * Internal (non-home) hero content controls — visibility, bold, alignment, order.
 * Stored in hero_templates.config JSONB; defaults preserve legacy visual behavior.
 */

export const HERO_ELEMENT_KEYS = [
  "eyebrow",
  "title",
  "highlight",
  "subtitle",
  "description",
  "cta",
] as const;

export type HeroElementKey = (typeof HERO_ELEMENT_KEYS)[number];

export type HeroTextAlignment = "right" | "center" | "left";
export type HeroDescriptionAlignment = HeroTextAlignment | "justify";

/** One platform contract; variants are declared product presentations, not routes. */
export const HERO_VARIANTS = [
  "home-cinematic",
  "internal-page",
  "projects-hub",
  "project-detail",
] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const HERO_FAMILIES = ["special", "standard-internal"] as const;
export type HeroFamily = (typeof HERO_FAMILIES)[number];

/** Product classification: route consumers never choose their own Hero family. */
export const HERO_VARIANT_FAMILY = {
  "home-cinematic": "special",
  "projects-hub": "special",
  "project-detail": "special",
  "internal-page": "standard-internal",
} as const satisfies Record<HeroVariant, HeroFamily>;

export function resolveHeroFamily(variant: unknown): HeroFamily {
  const normalized = String(variant ?? "").trim() as HeroVariant;
  return HERO_VARIANT_FAMILY[normalized] ?? "standard-internal";
}

/** Variants authored by the Generic Hero Template pipeline. Domain-owned variants use their own adapters. */
export const HERO_TEMPLATE_VARIANTS = ["home-cinematic", "internal-page"] as const satisfies readonly HeroVariant[];
export type HeroTemplateVariant = (typeof HERO_TEMPLATE_VARIANTS)[number];

export const HERO_VARIANT_LABELS_AR: Record<HeroVariant, string> = {
  "home-cinematic": "رئيسية سينمائية",
  "internal-page": "صفحة داخلية",
  "projects-hub": "مركز المشروعات",
  "project-detail": "تفاصيل المشروع",
};

export const HERO_TEMPLATE_VARIANT_OPTIONS_AR = HERO_TEMPLATE_VARIANTS.map((value) => ({
  value,
  label: HERO_VARIANT_LABELS_AR[value],
}));

export const HERO_IMAGE_COMPOSITION_OPTIONS_AR = [
  { value: "cover-center", label: "تركيز متوازن" },
  { value: "cover-upper", label: "تركيز علوي" },
] as const;
export type HeroImageCompositionPreset =
  (typeof HERO_IMAGE_COMPOSITION_OPTIONS_AR)[number]["value"];

const HERO_IMAGE_COMPOSITION_PRESETS = new Set<string>(
  HERO_IMAGE_COMPOSITION_OPTIONS_AR.map((option) => option.value),
);

/**
 * CMS output is always a Product preset. Raw CSS values are accepted only at
 * this compatibility boundary so already-persisted records can be migrated.
 */
export function resolveHeroImageCompositionPreset(value: unknown): HeroImageCompositionPreset {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (HERO_IMAGE_COMPOSITION_PRESETS.has(candidate)) {
    return candidate as HeroImageCompositionPreset;
  }

  return candidate === "object-[42%_36%]" ? "cover-upper" : "cover-center";
}

export function parseHeroTemplateVariant(value: unknown): HeroTemplateVariant {
  const normalized = String(value ?? "").trim() || "internal-page";
  if (!(HERO_TEMPLATE_VARIANTS as readonly string[]).includes(normalized)) {
    throw new Error("نمط عرض قالب الهيرو غير مدعوم.");
  }
  return normalized as HeroTemplateVariant;
}

export const DEFAULT_HERO_ELEMENT_ORDER: HeroElementKey[] = [...HERO_ELEMENT_KEYS];
export const STANDARD_INTERNAL_HERO_ELEMENT_ORDER = [...HERO_ELEMENT_KEYS] as const;
export const STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE = "topics" as const;

export type HeroContentControls = {
  showEyebrow: boolean;
  eyebrowBold: boolean;
  eyebrowAlignment: HeroTextAlignment;

  showTitle: boolean;
  titleBold: boolean;
  titleAlignment: HeroTextAlignment;

  showHighlight: boolean;
  highlightBold: boolean;
  highlightAlignment: HeroTextAlignment;

  showSubtitle: boolean;
  subtitleBold: boolean;
  subtitleAlignment: HeroTextAlignment;

  showDescription: boolean;
  descriptionAlignment: HeroDescriptionAlignment;

  showCta: boolean;
  ctaAlignment: HeroTextAlignment;

  heroElementOrder: HeroElementKey[];
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeroCopy(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prevents the same authored copy from occupying subtitle and description slots. */
export function resolveDistinctHeroDescription(
  descriptionValue: unknown,
  subtitleValue: unknown,
) {
  const description = readText(descriptionValue);
  if (!description) return "";

  const subtitle = readText(subtitleValue);
  return normalizeHeroCopy(description) === normalizeHeroCopy(subtitle)
    ? ""
    : description;
}

export function parseOptionalBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1" || value === "on") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

export function parseHeroTextAlignment(
  value: unknown,
  fallback: HeroTextAlignment = "right",
): HeroTextAlignment {
  const text = readText(value).toLowerCase();
  if (text === "right" || text === "center" || text === "left") return text;
  return fallback;
}

export function parseHeroDescriptionAlignment(
  value: unknown,
  fallback: HeroDescriptionAlignment = "right",
): HeroDescriptionAlignment {
  const text = readText(value).toLowerCase();
  if (text === "right" || text === "center" || text === "left" || text === "justify") return text;
  return fallback;
}

/** Allow only known keys, drop duplicates, append missing in default order. */
export function normalizeHeroElementOrder(
  raw: unknown,
  allowedKeys: readonly HeroElementKey[] = HERO_ELEMENT_KEYS,
): HeroElementKey[] {
  const allowed = new Set<string>(allowedKeys);
  const defaultOrder = allowedKeys;
  const collected: HeroElementKey[] = [];
  const seen = new Set<HeroElementKey>();

  const push = (key: string) => {
    // `explore` was a Projects Hub-only CTA implementation. Read it as the
    // canonical CTA slot so existing saved configs adopt the shared contract.
    const canonicalKey = key === "explore" ? "cta" : key;
    if (!allowed.has(canonicalKey)) return;
    const typed = canonicalKey as HeroElementKey;
    if (seen.has(typed)) return;
    seen.add(typed);
    collected.push(typed);
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      push(String(item).trim());
    }
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) push(String(item).trim());
      } else {
        for (const part of raw.split(/[,\s]+/)) push(part);
      }
    } catch {
      for (const part of raw.split(/[,\s]+/)) push(part);
    }
  }

  for (const key of defaultOrder) {
    if (!seen.has(key)) collected.push(key);
  }

  return collected;
}

/**
 * Resolve content-control fields from raw JSON config with legacy-safe defaults.
 * Missing keys → show all, bold defaults as specified, alignment right, default order.
 */
export function resolveHeroContentControls(raw: Record<string, unknown> = {}): HeroContentControls {
  const boolOr = (value: unknown, fallback: boolean) => parseOptionalBool(value) ?? fallback;

  // Legacy Projects Hub Explore keys are read into the canonical CTA contract.
  const showCtaResolved =
    parseOptionalBool(raw.showCta) ??
    parseOptionalBool(raw.show_cta) ??
    parseOptionalBool(raw.showExploreLink) ??
    parseOptionalBool(raw.show_explore_link) ??
    parseOptionalBool(raw.showExplore) ??
    parseOptionalBool(raw.show_explore) ??
    true;

  return {
    showEyebrow: boolOr(raw.showEyebrow, true),
    eyebrowBold: boolOr(raw.eyebrowBold, false),
    eyebrowAlignment: parseHeroTextAlignment(raw.eyebrowAlignment, "right"),

    showTitle: boolOr(raw.showTitle, true),
    titleBold: boolOr(raw.titleBold, true),
    titleAlignment: parseHeroTextAlignment(raw.titleAlignment, "right"),

    showHighlight: boolOr(raw.showHighlight, true),
    highlightBold: boolOr(raw.highlightBold, false),
    highlightAlignment: parseHeroTextAlignment(raw.highlightAlignment, "right"),

    showSubtitle: boolOr(raw.showSubtitle, true),
    subtitleBold: boolOr(raw.subtitleBold, false),
    subtitleAlignment: parseHeroTextAlignment(raw.subtitleAlignment, "right"),

    showDescription: boolOr(raw.showDescription, true),
    descriptionAlignment: parseHeroDescriptionAlignment(raw.descriptionAlignment, "right"),

    showCta: showCtaResolved,
    ctaAlignment: parseHeroTextAlignment(
      raw.ctaAlignment ?? raw.cta_alignment ?? raw.exploreAlignment ?? raw.explore_alignment,
      "right",
    ),

    heroElementOrder: normalizeHeroElementOrder(raw.heroElementOrder ?? raw.hero_element_order),
  };
}

/**
 * Family B has one Design System composition. CMS content may be hidden, but
 * per-page alignment, weight, and ordering cannot fork the shared template.
 */
export function resolveHeroContentControlsForVariant(
  raw: Record<string, unknown> = {},
  variant: unknown = "internal-page",
): HeroContentControls {
  const controls = resolveHeroContentControls(raw);
  if (resolveHeroFamily(variant) !== "standard-internal") return controls;

  return {
    ...controls,
    eyebrowBold: false,
    eyebrowAlignment: "right",
    titleBold: true,
    titleAlignment: "right",
    highlightBold: false,
    highlightAlignment: "right",
    subtitleBold: false,
    subtitleAlignment: "right",
    descriptionAlignment: "right",
    ctaAlignment: "right",
    heroElementOrder: [...STANDARD_INTERNAL_HERO_ELEMENT_ORDER],
  };
}

/** Canonical persistence boundary for Generic Hero Template JSONB. */
export function normalizeHeroTemplateProductConfig(
  raw: Record<string, unknown> = {},
  variant: unknown = "internal-page",
) {
  const next = { ...raw };
  const imageComposition = resolveHeroImageCompositionPreset(
    next.imageComposition ??
      next.image_composition ??
      next.imagePositionClassName ??
      next.image_position_class,
  );

  delete next.image_composition;
  delete next.imagePositionClassName;
  delete next.image_position_class;
  delete next.heroLayout;
  delete next.hero_layout;

  return {
    ...next,
    imageComposition,
    ...resolveHeroContentControlsForVariant(raw, variant),
  };
}

type ParseHeroContentControlsFormDataOptions = {
  allowedElementKeys?: readonly HeroElementKey[];
  defaults?: HeroContentControls;
};

/** Canonical Admin Save parser for Hero visibility, alignment, bold, and order. */
export function parseHeroContentControlsFormData(
  formData: FormData,
  options: ParseHeroContentControlsFormDataOptions = {},
): HeroContentControls {
  const defaults = options.defaults ?? resolveHeroContentControls();
  const readBoolean = (key: string, fallback: boolean) => {
    const submittedValue = formData.getAll(key).at(-1);
    return parseOptionalBool(submittedValue) ?? fallback;
  };
  const orderEntries = formData.getAll("hero_element_order");
  const orderValue = orderEntries.length > 1
    ? orderEntries
    : (orderEntries[0] ?? defaults.heroElementOrder);

  return {
    showEyebrow: readBoolean("show_eyebrow", defaults.showEyebrow),
    eyebrowBold: readBoolean("eyebrow_bold", defaults.eyebrowBold),
    eyebrowAlignment: parseHeroTextAlignment(
      formData.get("eyebrow_alignment"),
      defaults.eyebrowAlignment,
    ),
    showTitle: readBoolean("show_title", defaults.showTitle),
    titleBold: readBoolean("title_bold", defaults.titleBold),
    titleAlignment: parseHeroTextAlignment(
      formData.get("title_alignment"),
      defaults.titleAlignment,
    ),
    showHighlight: readBoolean("show_highlight", defaults.showHighlight),
    highlightBold: readBoolean("highlight_bold", defaults.highlightBold),
    highlightAlignment: parseHeroTextAlignment(
      formData.get("highlight_alignment"),
      defaults.highlightAlignment,
    ),
    showSubtitle: readBoolean("show_subtitle", defaults.showSubtitle),
    subtitleBold: readBoolean("subtitle_bold", defaults.subtitleBold),
    subtitleAlignment: parseHeroTextAlignment(
      formData.get("subtitle_alignment"),
      defaults.subtitleAlignment,
    ),
    showDescription: readBoolean("show_description", defaults.showDescription),
    descriptionAlignment: parseHeroDescriptionAlignment(
      formData.get("description_alignment"),
      defaults.descriptionAlignment,
    ),
    showCta: readBoolean("show_cta", defaults.showCta),
    ctaAlignment: parseHeroTextAlignment(
      formData.get("cta_alignment"),
      defaults.ctaAlignment,
    ),
    heroElementOrder: normalizeHeroElementOrder(
      orderValue,
      options.allowedElementKeys,
    ),
  };
}

/** Physical text-align classes (not logical start/end). */
export function heroTextAlignClass(alignment: HeroTextAlignment | HeroDescriptionAlignment): string {
  if (alignment === "center") return "text-center";
  if (alignment === "left") return "text-left";
  if (alignment === "justify") return "text-justify";
  return "text-right";
}

/**
 * Flex justify for physical alignment inside a dir=rtl hero column.
 * right → flex-start (RTL start); left → flex-end (RTL end).
 */
export function heroFlexJustifyClass(alignment: HeroTextAlignment): string {
  if (alignment === "center") return "justify-center";
  if (alignment === "left") return "justify-end";
  return "justify-start";
}

export const HERO_ELEMENT_LABELS_AR: Record<string, string> = {
  eyebrow: "العنوان التمهيدي",
  title: "العنوان الرئيسي",
  highlight: "النص المميز",
  subtitle: "العنوان الفرعي",
  description: "الوصف",
  cta: "زر الإجراء",
};
