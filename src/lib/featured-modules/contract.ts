import type { MediaEditableContentType } from "../admin/content/content-types";
import {
  publicContentSourceContentTypes,
  type PublicContentSource,
  type PublicContentSummary,
} from "../content/public-content-read/contract";
import {
  type ContentDisplayField,
  resolveContentItemDisplay,
  type ContentDisplayOptions,
  type PageBlockTextFormattingConfig,
  type ResolvedCollectionDisplayTextFormatting,
} from "../page-blocks/configs";

export const FEATURED_SOURCE_KINDS = ["categories", "media-center"] as const;
export type FeaturedSourceKind = (typeof FEATURED_SOURCE_KINDS)[number];

export const FEATURED_SELECTION_MODES = [
  "automatic",
  "latest",
  "popular",
  "manual",
] as const;
export type FeaturedSelectionMode = (typeof FEATURED_SELECTION_MODES)[number];

export const FEATURED_SELECTION_LABELS_AR: Record<
  FeaturedSelectionMode,
  string
> = {
  automatic: "العناصر المميزة فقط",
  latest: "الأحدث",
  popular: "الأكثر قراءة",
  manual: "اختيار يدوي",
};

export const FEATURED_PRESENTATION_VARIANTS = [
  "hero",
  "editorial",
  "large-card",
  "three-cards",
  "list",
  "carousel",
  "single-carousel",
  "group-carousel",
] as const;
export type FeaturedPresentationVariant =
  (typeof FEATURED_PRESENTATION_VARIANTS)[number];

export const FEATURED_EDITOR_PRESENTATION_VARIANTS = [
  "hero",
  "editorial",
  "large-card",
  "three-cards",
  "list",
  "single-carousel",
  "group-carousel",
] as const satisfies readonly FeaturedPresentationVariant[];

export const FEATURED_PRESENTATION_LABELS_AR: Record<
  FeaturedPresentationVariant,
  string
> = {
  hero: "هيرو",
  editorial: "تحريري",
  "large-card": "بطاقة كبيرة",
  "three-cards": "بطاقات",
  list: "قائمة",
  carousel: "عرض شرائح كلاسيكي",
  "single-carousel": "خبر واحد متحرك",
  "group-carousel": "مجموعة متحركة",
};

export type FeaturedSource = PublicContentSource<MediaEditableContentType>;

export type FeaturedSelection =
  | { mode: "automatic" | "latest" | "popular" }
  | { mode: "manual"; topicIds: number[] };

export type FeaturedPresentation = PageBlockTextFormattingConfig & {
  variant: FeaturedPresentationVariant;
  eyebrow: string | null;
  title: string;
  description: string;
  ctaText: string;
};

export type FeaturedNavigation = {
  showArrows: boolean;
  showDots: boolean;
  autoplay: boolean;
};

type FeaturedItemsPerViewPolicy =
  | { mode: "fixed"; value: number }
  | { mode: "configurable"; defaultValue: number; min: number; max: number };

export type FeaturedPresentationProfile = {
  summaryAr: string;
  itemsPerView: FeaturedItemsPerViewPolicy;
  supportsNavigation: boolean;
  defaultNavigation: FeaturedNavigation;
  displayFields: readonly ContentDisplayField[];
};

const FEATURED_CARD_DISPLAY_FIELDS = [
  "image",
  "title",
  "excerpt",
  "date",
  "category",
  "series",
] as const satisfies readonly ContentDisplayField[];

const STATIC_NAVIGATION = {
  showArrows: false,
  showDots: false,
  autoplay: false,
} as const satisfies FeaturedNavigation;

const MANUAL_CAROUSEL_NAVIGATION = {
  showArrows: true,
  showDots: true,
  autoplay: false,
} as const satisfies FeaturedNavigation;

const AUTOMATIC_CAROUSEL_NAVIGATION = {
  showArrows: false,
  showDots: true,
  autoplay: true,
} as const satisfies FeaturedNavigation;

/** One product registry drives Admin relevance and Public paging behavior. */
export const FEATURED_PRESENTATION_PROFILES = {
  hero: {
    summaryAr: "عنصر بارز واحد في كل شريحة مع تنقل عند تحميل أكثر من عنصر.",
    itemsPerView: { mode: "fixed", value: 1 },
    supportsNavigation: true,
    defaultNavigation: MANUAL_CAROUSEL_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  editorial: {
    summaryAr: "خبر رئيسي مع بطاقات تحريرية مساندة، من عنصرين إلى أربعة في كل مجموعة.",
    itemsPerView: {
      mode: "configurable",
      defaultValue: 4,
      min: 2,
      max: 4,
    },
    supportsNavigation: true,
    defaultNavigation: MANUAL_CAROUSEL_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  "large-card": {
    summaryAr: "بطاقة كبيرة واحدة في كل شريحة مع تنقل عند وجود عناصر إضافية.",
    itemsPerView: { mode: "fixed", value: 1 },
    supportsNavigation: true,
    defaultNavigation: MANUAL_CAROUSEL_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  "three-cards": {
    summaryAr: "من بطاقة إلى أربع بطاقات في كل مجموعة مع تنقل بين المجموعات الإضافية.",
    itemsPerView: {
      mode: "configurable",
      defaultValue: 3,
      min: 1,
      max: 4,
    },
    supportsNavigation: true,
    defaultNavigation: MANUAL_CAROUSEL_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  list: {
    summaryAr: "قائمة ثابتة تعرض العدد المختار فقط دون تنقل.",
    itemsPerView: {
      mode: "configurable",
      defaultValue: 12,
      min: 1,
      max: 12,
    },
    supportsNavigation: false,
    defaultNavigation: STATIC_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  carousel: {
    summaryAr: "عرض الشرائح القديم: عنصر واحد وتنقل يدوي بالأسهم.",
    itemsPerView: { mode: "fixed", value: 1 },
    supportsNavigation: true,
    defaultNavigation: {
      showArrows: true,
      showDots: false,
      autoplay: false,
    },
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  "single-carousel": {
    summaryAr: "عنصر واحد متحرك في كل شريحة.",
    itemsPerView: { mode: "fixed", value: 1 },
    supportsNavigation: true,
    defaultNavigation: AUTOMATIC_CAROUSEL_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
  "group-carousel": {
    summaryAr: "مجموعة متحركة قابلة للضبط من عنصرين إلى أربعة في كل شريحة.",
    itemsPerView: {
      mode: "configurable",
      defaultValue: 3,
      min: 2,
      max: 4,
    },
    supportsNavigation: true,
    defaultNavigation: AUTOMATIC_CAROUSEL_NAVIGATION,
    displayFields: FEATURED_CARD_DISPLAY_FIELDS,
  },
} as const satisfies Record<
  FeaturedPresentationVariant,
  FeaturedPresentationProfile
>;

export function featuredPresentationProfile(
  variant: FeaturedPresentationVariant,
): FeaturedPresentationProfile {
  return FEATURED_PRESENTATION_PROFILES[variant];
}

export function resolveFeaturedItemsPerView(
  variant: FeaturedPresentationVariant,
  value: unknown,
  itemLimit: number,
) {
  const policy = featuredPresentationProfile(variant).itemsPerView;
  const parsedItemLimit = Math.floor(Number(itemLimit));
  const availableItems = Number.isFinite(parsedItemLimit)
    ? Math.max(1, Math.min(12, parsedItemLimit))
    : 1;
  if (policy.mode === "fixed") {
    return Math.min(policy.value, availableItems);
  }

  const parsed = Math.floor(Number(value));
  const candidate = Number.isFinite(parsed) ? parsed : policy.defaultValue;
  const maximum = Math.min(policy.max, availableItems);
  const minimum = Math.min(policy.min, maximum);
  return Math.max(minimum, Math.min(maximum, candidate));
}

function navigationBoolean(value: unknown, fallback: boolean) {
  if (value === true || value === "true" || value === "1" || value === "on") {
    return true;
  }
  if (value === false || value === "false" || value === "0") return false;
  return fallback;
}

export function resolveFeaturedNavigation(
  variant: FeaturedPresentationVariant,
  raw: unknown,
): FeaturedNavigation {
  const profile = featuredPresentationProfile(variant);
  if (!profile.supportsNavigation) return { ...STATIC_NAVIGATION };

  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const showArrows = navigationBoolean(
    value.showArrows ?? value.show_arrows,
    profile.defaultNavigation.showArrows,
  );
  const requestedDots = navigationBoolean(
    value.showDots ?? value.show_dots,
    profile.defaultNavigation.showDots,
  );
  return {
    showArrows,
    showDots: showArrows || requestedDots ? requestedDots : true,
    autoplay: navigationBoolean(
      value.autoplay,
      profile.defaultNavigation.autoplay,
    ),
  };
}

export type FeaturedModuleConfig = {
  source: FeaturedSource;
  selection: FeaturedSelection;
  itemLimit: number;
  itemsPerView: number;
  display: ContentDisplayOptions;
  displayFormatting: ResolvedCollectionDisplayTextFormatting;
  navigation: FeaturedNavigation;
  presentation: FeaturedPresentation;
};

export type FeaturedModuleTemplateRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  config: Record<string, unknown> | null;
  sort_order: number;
};

export type ResolvedFeaturedModule = {
  assignmentId: number;
  templateId: number;
  sortOrder: number;
  source: FeaturedSource;
  selection: FeaturedSelection;
  itemLimit: number;
  itemsPerView: number;
  display: ContentDisplayOptions;
  displayFormatting: ResolvedCollectionDisplayTextFormatting;
  navigation: FeaturedNavigation;
  presentation: FeaturedPresentation;
  items: PublicContentSummary[];
};

export function resolveFeaturedItemDisplay(
  display: ContentDisplayOptions,
  item: PublicContentSummary,
): ContentDisplayOptions {
  return resolveContentItemDisplay(
    display,
    {
      // Featured owns visibility inside its own cards. Detail-page visibility
      // must not turn an exposed module control into a no-op.
      title: true,
      image: true,
      excerpt: true,
      date: true,
      category: true,
      series: true,
    },
    {
      title: item.title,
      image: item.image,
      category: item.category,
      series: item.series,
      excerpt: item.excerpt,
      date: item.date,
    },
  );
}

export type FeaturedEditorItem = Pick<
  PublicContentSummary,
  "id" | "contentType" | "title" | "categorySlug" | "publishedAt"
>;

export type FeaturedEditorCategory = {
  id: number;
  slug: string;
  name: string;
  parentId: number | null;
  depth: number;
  scopeSlugs: string[];
};

export type FeaturedEditorOptions = {
  categories: FeaturedEditorCategory[];
  items: FeaturedEditorItem[];
};

export function featuredSourceContentTypes(
  source: FeaturedSource,
): ReturnType<typeof publicContentSourceContentTypes> {
  return publicContentSourceContentTypes(source);
}
