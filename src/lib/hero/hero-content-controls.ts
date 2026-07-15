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
  "breadcrumb",
  "cta",
] as const;

export type HeroElementKey = (typeof HERO_ELEMENT_KEYS)[number];

export type HeroTextAlignment = "right" | "center" | "left";
export type HeroDescriptionAlignment = HeroTextAlignment | "justify";

export const DEFAULT_HERO_ELEMENT_ORDER: HeroElementKey[] = [...HERO_ELEMENT_KEYS];

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

  showBreadcrumb: boolean;
  breadcrumbBold: boolean;
  breadcrumbAlignment: HeroTextAlignment;
  breadcrumbCurrentLabel: string;

  showCta: boolean;
  ctaAlignment: HeroTextAlignment;

  heroElementOrder: HeroElementKey[];
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
export function normalizeHeroElementOrder(raw: unknown): HeroElementKey[] {
  const allowed = new Set<string>(HERO_ELEMENT_KEYS);
  const collected: HeroElementKey[] = [];
  const seen = new Set<HeroElementKey>();

  const push = (key: string) => {
    if (!allowed.has(key)) return;
    const typed = key as HeroElementKey;
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

  for (const key of DEFAULT_HERO_ELEMENT_ORDER) {
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

  // Legacy showCta / show_cta may already exist on config — prefer it when new key absent.
  const showCtaResolved =
    parseOptionalBool(raw.showCta) ??
    parseOptionalBool(raw.show_cta) ??
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

    showBreadcrumb: boolOr(raw.showBreadcrumb, true),
    breadcrumbBold: boolOr(raw.breadcrumbBold, false),
    breadcrumbAlignment: parseHeroTextAlignment(raw.breadcrumbAlignment, "right"),
    breadcrumbCurrentLabel: readText(raw.breadcrumbCurrentLabel),

    showCta: showCtaResolved,
    ctaAlignment: parseHeroTextAlignment(raw.ctaAlignment, "right"),

    heroElementOrder: normalizeHeroElementOrder(raw.heroElementOrder ?? raw.hero_element_order),
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

export const HERO_ELEMENT_LABELS_AR: Record<HeroElementKey, string> = {
  eyebrow: "Eyebrow",
  title: "العنوان",
  highlight: "Highlight",
  subtitle: "Subtitle",
  description: "الوصف",
  breadcrumb: "Breadcrumb",
  cta: "CTA",
};
