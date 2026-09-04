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

/** Variants whose presentation is authored by the existing Hero Template pipeline. */
export const HERO_TEMPLATE_VARIANTS = [
  "home-cinematic",
  "internal-page",
  "project-detail",
] as const satisfies readonly HeroVariant[];
export type HeroTemplateVariant = (typeof HERO_TEMPLATE_VARIANTS)[number];

/**
 * These variants read content from their domain while keeping presentation in
 * hero_templates.config. This is a source classification, not a second config.
 */
export const HERO_DOMAIN_BACKED_TEMPLATE_VARIANTS = [
  "project-detail",
] as const satisfies readonly HeroTemplateVariant[];
export type HeroDomainBackedTemplateVariant =
  (typeof HERO_DOMAIN_BACKED_TEMPLATE_VARIANTS)[number];

export function isDomainBackedHeroTemplateVariant(
  value: unknown,
): value is HeroDomainBackedTemplateVariant {
  return (HERO_DOMAIN_BACKED_TEMPLATE_VARIANTS as readonly unknown[]).includes(
    value,
  );
}

/** Semantic elements actually rendered by the Project Detail Hero variant. */
export const PROJECT_DETAIL_HERO_ELEMENT_KEYS = [
  "eyebrow",
  "title",
  "subtitle",
  "description",
  "cta",
] as const satisfies readonly HeroElementKey[];

export const PROJECT_HERO_ACTION_KEYS = [
  "download",
  "tracking",
  "reservation",
] as const;
export type ProjectHeroActionKey = (typeof PROJECT_HERO_ACTION_KEYS)[number];

export const PROJECT_HERO_ACTION_LABELS_AR: Record<
  ProjectHeroActionKey,
  string
> = {
  download: "تحميل ملف المشروع",
  tracking: "متابعة مراحل الإنشاء",
  reservation: "حجز وحدة",
};

export function normalizeProjectHeroActionOrder(
  raw: unknown,
): ProjectHeroActionKey[] {
  const allowed = new Set<string>(PROJECT_HERO_ACTION_KEYS);
  const collected: ProjectHeroActionKey[] = [];
  const seen = new Set<ProjectHeroActionKey>();
  const push = (value: unknown) => {
    const key = String(value ?? "").trim() as ProjectHeroActionKey;
    if (!allowed.has(key) || seen.has(key)) return;
    seen.add(key);
    collected.push(key);
  };

  if (Array.isArray(raw)) {
    raw.forEach(push);
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) parsed.forEach(push);
      else raw.split(/[,\s]+/).forEach(push);
    } catch {
      raw.split(/[,\s]+/).forEach(push);
    }
  }

  PROJECT_HERO_ACTION_KEYS.forEach(push);
  return collected;
}

export const HERO_VARIANT_LABELS_AR: Record<HeroVariant, string> = {
  "home-cinematic": "رئيسية سينمائية",
  "internal-page": "صفحة داخلية",
  "projects-hub": "مركز المشروعات",
  "project-detail": "تفاصيل المشروع",
};

export const HERO_TEMPLATE_VARIANT_OPTIONS_AR = HERO_TEMPLATE_VARIANTS.map(
  (value) => ({
    value,
    label: HERO_VARIANT_LABELS_AR[value],
  }),
);

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
export function resolveHeroImageCompositionPreset(
  value: unknown,
): HeroImageCompositionPreset {
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

export const DEFAULT_HERO_ELEMENT_ORDER: HeroElementKey[] = [
  ...HERO_ELEMENT_KEYS,
];
export const STANDARD_INTERNAL_HERO_ELEMENT_ORDER = [
  ...HERO_ELEMENT_KEYS,
] as const;
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
  descriptionBold: boolean;
  descriptionAlignment: HeroDescriptionAlignment;

  showCta: boolean;
  ctaBold: boolean;
  ctaAlignment: HeroTextAlignment;
  showProjectDownloadAction: boolean;
  showProjectTrackingAction: boolean;
  showProjectReservationAction: boolean;
  projectActionOrder: ProjectHeroActionKey[];

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
  if (value === "true" || value === 1 || value === "1" || value === "on")
    return true;
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
  if (
    text === "right" ||
    text === "center" ||
    text === "left" ||
    text === "justify"
  )
    return text;
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
export function resolveHeroContentControls(
  raw: Record<string, unknown> = {},
): HeroContentControls {
  const boolOr = (value: unknown, fallback: boolean) =>
    parseOptionalBool(value) ?? fallback;

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
    descriptionBold: boolOr(
      raw.descriptionBold ?? raw.description_bold,
      false,
    ),
    descriptionAlignment: parseHeroDescriptionAlignment(
      raw.descriptionAlignment,
      "right",
    ),

    showCta: showCtaResolved,
    ctaBold: boolOr(raw.ctaBold ?? raw.cta_bold, false),
    ctaAlignment: parseHeroTextAlignment(
      raw.ctaAlignment ??
        raw.cta_alignment ??
        raw.exploreAlignment ??
        raw.explore_alignment,
      "right",
    ),
    showProjectDownloadAction: boolOr(
      raw.showProjectDownloadAction ?? raw.show_project_download_action,
      true,
    ),
    showProjectTrackingAction: boolOr(
      raw.showProjectTrackingAction ?? raw.show_project_tracking_action,
      true,
    ),
    showProjectReservationAction: boolOr(
      raw.showProjectReservationAction ?? raw.show_project_reservation_action,
      true,
    ),
    projectActionOrder: normalizeProjectHeroActionOrder(
      raw.projectActionOrder ?? raw.project_action_order,
    ),

    heroElementOrder: normalizeHeroElementOrder(
      raw.heroElementOrder ?? raw.hero_element_order,
    ),
  };
}

/**
 * Family B keeps one Design System composition and element order. Typography
 * controls remain authored through the existing shared Hero fields.
 */
export function resolveHeroContentControlsForVariant(
  raw: Record<string, unknown> = {},
  variant: unknown = "internal-page",
): HeroContentControls {
  const controls = resolveHeroContentControls(raw);
  if (variant === "project-detail") {
    return {
      ...controls,
      showCta: true,
      subtitleBold:
        parseOptionalBool(raw.subtitleBold ?? raw.subtitle_bold) ?? true,
      showHighlight: false,
      highlightBold: false,
      highlightAlignment: "right",
      heroElementOrder: normalizeHeroElementOrder(
        raw.heroElementOrder ?? raw.hero_element_order,
        PROJECT_DETAIL_HERO_ELEMENT_KEYS,
      ),
    };
  }
  if (resolveHeroFamily(variant) !== "standard-internal") return controls;

  return {
    ...controls,
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
  const orderValue =
    orderEntries.length > 1
      ? orderEntries
      : (orderEntries[0] ?? defaults.heroElementOrder);
  const projectActionOrderEntries = formData.getAll("project_action_order");
  const projectActionOrderValue =
    projectActionOrderEntries.length > 1
      ? projectActionOrderEntries
      : (projectActionOrderEntries[0] ?? defaults.projectActionOrder);

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
    descriptionBold: readBoolean(
      "description_bold",
      defaults.descriptionBold,
    ),
    descriptionAlignment: parseHeroDescriptionAlignment(
      formData.get("description_alignment"),
      defaults.descriptionAlignment,
    ),
    showCta: readBoolean("show_cta", defaults.showCta),
    ctaBold: readBoolean("cta_bold", defaults.ctaBold),
    ctaAlignment: parseHeroTextAlignment(
      formData.get("cta_alignment"),
      defaults.ctaAlignment,
    ),
    showProjectDownloadAction: readBoolean(
      "show_project_download_action",
      defaults.showProjectDownloadAction,
    ),
    showProjectTrackingAction: readBoolean(
      "show_project_tracking_action",
      defaults.showProjectTrackingAction,
    ),
    showProjectReservationAction: readBoolean(
      "show_project_reservation_action",
      defaults.showProjectReservationAction,
    ),
    projectActionOrder: normalizeProjectHeroActionOrder(
      projectActionOrderValue,
    ),
    heroElementOrder: normalizeHeroElementOrder(
      orderValue,
      options.allowedElementKeys,
    ),
  };
}

/** Physical text-align classes (not logical start/end). */
export function heroTextAlignClass(
  alignment: HeroTextAlignment | HeroDescriptionAlignment,
): string {
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
