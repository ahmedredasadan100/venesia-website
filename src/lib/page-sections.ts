import type {
  HeroContentControls,
  HeroDescriptionAlignment,
  HeroElementKey,
  HeroTextAlignment,
} from "./hero/hero-content-controls";
import { resolveHeroContentControls } from "./hero/hero-content-controls";

export type HeroSourceType =
  | "manual"
  | "latest_topics"
  | "featured_topics"
  | "topic_category"
  | "latest_media"
  | "featured_media"
  | "media_category";

export type PageRecord = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
};

export type PageSectionRecord = {
  id: number;
  page_id: number;
  section_key: string;
  section_type: string;
  slot: string;
  variant: string;
  style_preset: string;
  source_type: HeroSourceType;
  source_id: number | null;
  source_slug: string | null;
  limit_count: number;
  is_visible: boolean;
  sort_order: number;
  config: Record<string, unknown> | null;
};

type HeroTemplateRecord = {
  id: number;
  name: string;
  slug: string;
  variant: string;
  style_preset: string;
  source_type: HeroSourceType;
  source_id: number | null;
  source_slug: string | null;
  limit_count: number;
  is_visible: boolean;
  sort_order: number;
  config: Record<string, unknown> | null;
};

export type HeroSectionData = PageSectionRecord & {
  page?: PageRecord | null;
  template?: Pick<HeroTemplateRecord, "id" | "name" | "slug"> | null;
  resolvedItems?: Array<{
    id: number;
    title: string;
    excerpt?: string | null;
    image?: string | null;
    href?: string;
    category?: string | null;
  }>;
};

export type HeroLayoutPreset = "compact" | "standard";

export type HeroConfig = {
  eyebrow?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
  description?: string;
  images?: string[];
  mobileImages?: string[];
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  primaryCtaLink?: Record<string, unknown>;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  secondaryCtaLink?: Record<string, unknown>;
  imagePositionClassName?: string;
  heroLayout?: HeroLayoutPreset;
} & HeroContentControls;

export type {
  HeroContentControls,
  HeroDescriptionAlignment,
  HeroElementKey,
  HeroTextAlignment,
};

export function getHeroConfig(hero?: HeroSectionData | null): HeroConfig {
  const raw = (hero?.config ?? {}) as Record<string, unknown>;

  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const readBool = (value: unknown) => {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1) return true;
    if (value === "false" || value === 0) return false;
    return undefined;
  };

  const images = Array.isArray(raw.images)
    ? raw.images.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const mobileImagesRaw = Array.isArray(raw.mobileImages)
    ? raw.mobileImages
    : Array.isArray(raw.mobile_images)
      ? raw.mobile_images
      : [];
  const mobileImages = mobileImagesRaw.map((item) => String(item).trim()).filter(Boolean);

  const controls = resolveHeroContentControls(raw);
  const legacyShowCta = readBool(raw.showCta) ?? readBool(raw.show_cta);
  const showCta = legacyShowCta === undefined ? controls.showCta : legacyShowCta;

  const heroLayoutRaw = readText(raw.heroLayout) || readText(raw.hero_layout);
  const heroLayout: HeroLayoutPreset | undefined =
    heroLayoutRaw === "compact" || heroLayoutRaw === "standard" ? heroLayoutRaw : undefined;

  return {
    eyebrow: readText(raw.eyebrow) || undefined,
    title: readText(raw.title) || undefined,
    highlight: readText(raw.highlight) || undefined,
    subtitle: readText(raw.subtitle) || undefined,
    // Preserve HTML for rich description (do not strip tags).
    description: typeof raw.description === "string" ? raw.description.trim() || undefined : undefined,
    images: images.length ? images : undefined,
    mobileImages: mobileImages.length ? mobileImages : undefined,
    primaryCtaLabel: readText(raw.primaryCtaLabel) || readText(raw.primary_cta_label) || undefined,
    primaryCtaHref: readText(raw.primaryCtaHref) || readText(raw.primary_cta_href) || undefined,
    secondaryCtaLabel: readText(raw.secondaryCtaLabel) || readText(raw.secondary_cta_label) || undefined,
    secondaryCtaHref: readText(raw.secondaryCtaHref) || readText(raw.secondary_cta_href) || undefined,
    imagePositionClassName:
      readText(raw.imagePositionClassName) || readText(raw.image_position_class) || undefined,
    heroLayout,
    ...controls,
    showCta,
  };
}
