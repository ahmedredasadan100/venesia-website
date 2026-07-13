export type ContentBlockConfig = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  alignment?: "start" | "center";
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

/** Structured config for the full About Intro visual section (text + images + beats). */
export type AboutIntroModuleConfig = ContentBlockConfig & {
  images?: AboutIntroImagesConfig;
  beats?: AboutIntroBeatConfig[];
  /** Optional CTA — used by home-story; ignored by About Who We Are renderer. */
  button?: AboutCtaButtonConfig;
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
export type VisionGoalsModuleConfig = {
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
  link?: Record<string, unknown>;
  target?: "_self" | "_blank";
};

export type AboutCtaButtonConfig = {
  label?: string;
  href?: string;
  link?: Record<string, unknown>;
  target?: "_self" | "_blank";
  /** Home Story CTA layout — optional; ignored by other About CTA renderers. */
  alignment?: "right" | "center" | "left";
  icon?: "none" | "arrow";
  iconPosition?: "right" | "left";
};

/** Structured config for the About CTA band (contacts + copy + image). */
export type AboutCtaModuleConfig = {
  eyebrow?: string;
  title?: string;
  description?: string;
  button?: AboutCtaButtonConfig;
  note?: string;
  image?: string;
  imageAlt?: string;
  contacts?: AboutCtaContactConfig[];
};

export const ABOUT_PRINCIPLES_ICON_KEYS = ["land", "engineering", "timeline"] as const;
export type AboutPrinciplesIconKey = (typeof ABOUT_PRINCIPLES_ICON_KEYS)[number];

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
export type AboutPrinciplesModuleConfig = {
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
export type AboutApproachModuleConfig = {
  eyebrow?: string;
  title?: string;
};

/** Section copy for Home Projects — project cards remain in the projects table. */
export type HomeProjectsModuleConfig = {
  eyebrow?: string;
  title?: string;
  intro?: string;
  showEyebrow?: boolean;
  showTitle?: boolean;
  showIntro?: boolean;
  showFooterCta?: boolean;
  projectsLimit?: number;
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
    link?: Record<string, unknown>;
    target?: "_self" | "_blank";
    /** Physical section alignment for the footer CTA. Default for legacy content: center. */
    alignment?: "right" | "center" | "left";
  };
};

export type CtaLinkConfig = {
  label?: string;
  href?: string;
  target?: "_self" | "_blank";
  link?: Record<string, unknown>;
};

export type CtaBlockConfig = {
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
  link?: Record<string, unknown>;
  target?: "_self" | "_blank";
};

export type CardsBlockConfig = {
  eyebrow?: string;
  title?: string;
  description?: string;
  columns?: 2 | 3 | 4;
  items?: CardsBlockItem[];
};

export type BreadcrumbBlockItem = {
  label?: string;
  href?: string;
  link?: Record<string, unknown>;
};

export type BreadcrumbBlockConfig = {
  source?: "navigation" | "manual";
  showHome?: boolean;
  currentLabelOverride?: string;
  manualItems?: BreadcrumbBlockItem[];
};

export function asContentConfig(raw: unknown): ContentBlockConfig {
  return (raw ?? {}) as ContentBlockConfig;
}

export function isAboutIntroTemplate(slug: string, variant?: string | null) {
  return slug === "about-intro" || variant === "about-intro";
}

export function isHomeStoryTemplate(slug: string, variant?: string | null) {
  return slug === "home-story" || variant === "home-story";
}

/** Shared config shape (about-intro schema) — not the same admin module identity as about-intro. */
export function usesAboutIntroConfigSchema(slug: string, variant?: string | null) {
  return isAboutIntroTemplate(slug, variant) || isHomeStoryTemplate(slug, variant);
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
export function usesAboutCtaConfigSchema(slug: string, variant?: string | null) {
  return isAboutCtaTemplate(slug, variant) || isHomeContactTemplate(slug, variant);
}

export function isAboutPrinciplesTemplate(slug: string, variant?: string | null) {
  return slug === "about-principles" || variant === "about-principles";
}

export function isHomeTrustTemplate(slug: string, variant?: string | null) {
  return slug === "home-trust" || variant === "home-trust";
}

export function isHomeProjectsTemplate(slug: string, variant?: string | null) {
  return slug === "home-projects" || variant === "home-projects";
}

/** Shared config shape (about-principles schema) — not the same admin module identity as about-principles. */
export function usesAboutPrinciplesConfigSchema(slug: string, variant?: string | null) {
  return isAboutPrinciplesTemplate(slug, variant) || isHomeTrustTemplate(slug, variant);
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
  | AboutApproachModuleConfig {
  if (usesAboutIntroConfigSchema(template.slug, template.variant)) {
    return asAboutIntroConfig(template.config);
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
  return asContentConfig(template.config);
}

export function asAboutIntroConfig(raw: unknown): AboutIntroModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const imagesRaw = config.images as Record<string, unknown> | undefined;
  const readImage = (nestedKey: string, flatKey: string) =>
    readText(imagesRaw?.[nestedKey]) || readText(config[flatKey]) || undefined;

  const images = imagesRaw || config.image_main || config.image_secondary || config.image_accent
    ? {
        main: readImage("main", "image_main"),
        secondary: readImage("secondary", "image_secondary"),
        accent: readImage("accent", "image_accent"),
        mainAlt: readText(imagesRaw?.mainAlt ?? imagesRaw?.main_alt ?? config.image_main_alt) || undefined,
        secondaryAlt:
          readText(imagesRaw?.secondaryAlt ?? imagesRaw?.secondary_alt ?? config.image_secondary_alt) || undefined,
        accentAlt: readText(imagesRaw?.accentAlt ?? imagesRaw?.accent_alt ?? config.image_accent_alt) || undefined,
      }
    : undefined;

  const beatsRaw = config.beats;
  const beats = Array.isArray(beatsRaw)
    ? beatsRaw
        .slice(0, 3)
        .map((beat, index) => {
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
  const buttonLabel = readText(buttonRaw?.label ?? config.button_label) || undefined;
  const buttonHref = readText(buttonRaw?.href ?? config.button_href) || undefined;
  const buttonLink =
    buttonRaw?.link && typeof buttonRaw.link === "object"
      ? (buttonRaw.link as Record<string, unknown>)
      : undefined;
  const buttonTarget =
    buttonRaw?.target === "_blank" || buttonRaw?.target === "_self"
      ? (buttonRaw.target as "_blank" | "_self")
      : undefined;
  const buttonAlignment =
    buttonRaw?.alignment === "center" || buttonRaw?.alignment === "left" || buttonRaw?.alignment === "right"
      ? (buttonRaw.alignment as "right" | "center" | "left")
      : undefined;
  const buttonIcon = buttonRaw?.icon === "arrow" || buttonRaw?.icon === "none" ? (buttonRaw.icon as "none" | "arrow") : undefined;
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

function readVisionGoalsColumn(raw: unknown): VisionGoalsColumnConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const column = raw as Record<string, unknown>;
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const itemsRaw = column.items;

  const items = Array.isArray(itemsRaw)
    ? itemsRaw
        .map((item) => {
          const row = item as Record<string, unknown>;
          const title = readText(row.title);
          const text = readText(row.text);
          if (!title && !text) return null;
          return { title: title || undefined, text: text || undefined };
        })
        .filter(Boolean) as VisionGoalsItemConfig[]
    : undefined;

  const title = readText(column.title) || undefined;

  return title || items?.length ? { title, items } : undefined;
}

export function asVisionGoalsConfig(raw: unknown): VisionGoalsModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const readTarget = (value: unknown): "_self" | "_blank" | undefined =>
    value === "_blank" || value === "_self" ? value : undefined;

  const buttonRaw =
    config.button && typeof config.button === "object"
      ? (config.button as Record<string, unknown>)
      : undefined;
  const buttonLabel = readText(buttonRaw?.label) || readText(config.button_label) || undefined;
  const buttonHref = readText(buttonRaw?.href) || readText(config.button_href) || undefined;
  const buttonLink =
    buttonRaw?.link && typeof buttonRaw.link === "object"
      ? (buttonRaw.link as Record<string, unknown>)
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
    ? contactsRaw
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
            row.link && typeof row.link === "object" ? (row.link as Record<string, unknown>) : undefined;
          const target = readTarget(row.target);
          if (!label && !value && !secondaryValue && !href && !link) return null;
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
        .filter(Boolean) as AboutCtaContactConfig[]
    : undefined;

  return {
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    description: readText(config.description) || readText(config.body) || undefined,
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

export function asAboutPrinciplesConfig(raw: unknown): AboutPrinciplesModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const itemsRaw = config.items;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw
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
        .filter(Boolean) as AboutPrinciplesItemConfig[]
    : undefined;

  const readOptionalBool = (camelKey: string, snakeKey: string) => {
    const value = config[camelKey] ?? config[snakeKey];
    if (typeof value === "boolean") return value;
    if (value === "false" || value === "0") return false;
    if (value === "true" || value === "1") return true;
    return undefined;
  };

  const readOptionalAlign = (camelKey: string, snakeKey: string) => {
    const value = config[camelKey] ?? config[snakeKey];
    return value === "right" || value === "left" || value === "center" ? value : undefined;
  };

  return {
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    description: readText(config.description) || undefined,
    eyebrowBold: readOptionalBool("eyebrowBold", "eyebrow_bold"),
    eyebrowAlignment: readOptionalAlign("eyebrowAlignment", "eyebrow_alignment"),
    titleBold: readOptionalBool("titleBold", "title_bold"),
    titleAlignment: readOptionalAlign("titleAlignment", "title_alignment"),
    items,
  };
}

export function asAboutApproachConfig(raw: unknown): AboutApproachModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  return {
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
  };
}

export function asHomeProjectsConfig(raw: unknown): HomeProjectsModuleConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
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
            return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
          })()
        : undefined;

  const cardAlignRaw = config.cardCtaAlignment ?? config.card_cta_alignment;
  const cardCtaAlignment =
    cardAlignRaw === "right" || cardAlignRaw === "left" || cardAlignRaw === "center"
      ? cardAlignRaw
      : undefined;

  const eyebrowBoldRaw = config.eyebrowBold ?? config.eyebrow_bold;
  let eyebrowBold: boolean | undefined;
  if (typeof eyebrowBoldRaw === "boolean") {
    eyebrowBold = eyebrowBoldRaw;
  } else if (eyebrowBoldRaw === "false" || eyebrowBoldRaw === "0") {
    eyebrowBold = false;
  } else if (eyebrowBoldRaw === "true" || eyebrowBoldRaw === "1") {
    eyebrowBold = true;
  }

  const eyebrowAlignRaw = config.eyebrowAlignment ?? config.eyebrow_alignment;
  const eyebrowAlignment =
    eyebrowAlignRaw === "right" || eyebrowAlignRaw === "left" || eyebrowAlignRaw === "center"
      ? eyebrowAlignRaw
      : undefined;

  return {
    eyebrow: readText(config.eyebrow) || undefined,
    title: readText(config.title) || undefined,
    intro: readText(config.intro) || undefined,
    showEyebrow: readShowFlag("showEyebrow", "show_eyebrow"),
    showTitle: readShowFlag("showTitle", "show_title"),
    showIntro: readShowFlag("showIntro", "show_intro"),
    showFooterCta: readShowFlag("showFooterCta", "show_footer_cta"),
    projectsLimit: parsedLimit,
    cardCtaAlignment,
    eyebrowBold,
    eyebrowAlignment,
    footerCta: footer
      ? {
          label: readText(footer.label) || undefined,
          href: readText(footer.href) || undefined,
          link:
            footer.link && typeof footer.link === "object"
              ? (footer.link as Record<string, unknown>)
              : undefined,
          target: footer.target === "_blank" ? "_blank" : footer.target === "_self" ? "_self" : undefined,
          alignment:
            footer.alignment === "right" || footer.alignment === "left" || footer.alignment === "center"
              ? footer.alignment
              : undefined,
        }
      : undefined,
  };
}

export function asCtaConfig(raw: unknown): CtaBlockConfig {
  return (raw ?? {}) as CtaBlockConfig;
}

export function asCardsConfig(raw: unknown): CardsBlockConfig {
  return (raw ?? {}) as CardsBlockConfig;
}

export function asBreadcrumbConfig(raw: unknown): BreadcrumbBlockConfig {
  const config = (raw ?? {}) as Record<string, unknown>;

  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const source = config.source === "manual" ? "manual" : "navigation";

  let showHome = true;
  if (typeof config.showHome === "boolean") {
    showHome = config.showHome;
  } else if (config.show_home === false || config.show_home === "false") {
    showHome = false;
  }

  const manualRaw = config.manualItems ?? config.manual_items;
  const manualItems = Array.isArray(manualRaw)
    ? manualRaw
        .map((item) => {
          const row = item as Record<string, unknown>;
          const label = readText(row.label);
          const href = readText(row.href);
          if (!label) return null;
          return { label, href: href || undefined };
        })
        .filter(Boolean) as BreadcrumbBlockItem[]
    : undefined;

  const currentLabelOverride =
    readText(config.currentLabelOverride) || readText(config.current_label_override) || undefined;

  return {
    source,
    showHome,
    currentLabelOverride,
    manualItems,
  };
}
