import type {
  SidebarArticleItem,
  SidebarCategoryItem,
  SidebarSeriesItem,
} from "../content-feeds/types";
import type {
  PageBlockTextAlignment,
  PageBlockTextFormattingConfig,
} from "../page-blocks/configs";

export const TOPICS_FEED_TYPES = ["latest", "popular", "categories", "series"] as const;
export type TopicsFeedType = (typeof TOPICS_FEED_TYPES)[number];

export const TOPICS_FEED_TYPE_LABELS_AR: Record<TopicsFeedType, string> = {
  latest: "أحدث الموضوعات",
  popular: "الموضوعات الأكثر قراءة",
  categories: "تصنيفات الموضوعات",
  series: "سلاسل المحتوى",
};

export const FEED_PRESENTATION_LAYOUTS = ["slider", "grid", "list"] as const;
export type FeedPresentationLayout = (typeof FEED_PRESENTATION_LAYOUTS)[number];

export const FEED_PRESENTATION_DENSITIES = [1, 2, 3] as const;
export type FeedPresentationDensity = (typeof FEED_PRESENTATION_DENSITIES)[number];

export type FeedListPresentationVariant = {
  itemsPerGroup: number;
  showDots: boolean;
  intervalSeconds: number;
};

export const DEFAULT_FEED_LIST_PRESENTATION = {
  itemsPerGroup: 3,
  showDots: true,
  intervalSeconds: 8,
} as const satisfies FeedListPresentationVariant;

export type FeedLatestPresentationVariant = {
  layout: FeedPresentationLayout;
  density: FeedPresentationDensity;
  showArrows: boolean;
  showDots: boolean;
  list: FeedListPresentationVariant;
};

export type FeedPopularPresentationVariant = {
  layout: Extract<FeedPresentationLayout, "list" | "grid">;
  columns: FeedPresentationDensity;
  list: FeedListPresentationVariant;
};

export type FeedCategoriesPresentationVariant = {
  layout: Extract<FeedPresentationLayout, "list" | "grid">;
  columns: FeedPresentationDensity;
  list: FeedListPresentationVariant;
};

export type FeedSeriesPresentationVariant = {
  layout: FeedPresentationLayout;
  columns: FeedPresentationDensity;
  showArrows: boolean;
  list: FeedListPresentationVariant;
};

export type FeedPresentationVariants = {
  latest: FeedLatestPresentationVariant;
  popular: FeedPopularPresentationVariant;
  categories: FeedCategoriesPresentationVariant;
  series: FeedSeriesPresentationVariant;
};

/** Defaults preserve the pre-variant public output for configs without this contract. */
export const DEFAULT_FEED_PRESENTATION_VARIANTS = {
  latest: {
    layout: "slider",
    density: 3,
    showArrows: false,
    showDots: true,
    list: DEFAULT_FEED_LIST_PRESENTATION,
  },
  popular: {
    layout: "list",
    columns: 1,
    list: DEFAULT_FEED_LIST_PRESENTATION,
  },
  categories: {
    layout: "list",
    columns: 1,
    list: DEFAULT_FEED_LIST_PRESENTATION,
  },
  series: {
    layout: "slider",
    columns: 1,
    showArrows: true,
    list: DEFAULT_FEED_LIST_PRESENTATION,
  },
} as const satisfies FeedPresentationVariants;

export type FeedModuleDisplayFormattingField =
  | "image"
  | "title"
  | "excerpt"
  | "date"
  | "category"
  | "count"
  | "series"
  | "description"
  | "details";

/** The canonical Feed-owned support matrix used by Admin, config, and public presenters. */
export const FEED_MODULE_DISPLAY_FORMATTING_CAPABILITY = {
  id: "feed-module-display-formatting",
  variants: {
    latest: {
      image: "visibility-only",
      title: "text",
      excerpt: "text",
      date: "text",
    },
    popular: {
      image: "visibility-only",
      title: "text",
      excerpt: "text",
      date: "text",
    },
    categories: {
      category: "text",
      count: "text",
    },
    series: {
      image: "visibility-only",
      series: "text",
      description: "text",
      details: "text",
    },
  },
} as const satisfies {
  id: string;
  variants: Record<
    TopicsFeedType,
    Partial<Record<FeedModuleDisplayFormattingField, "text" | "visibility-only">>
  >;
};

export type FeedArticleCardPresentation = {
  showTitle: boolean;
  titleBold: boolean;
  titleAlignment: PageBlockTextAlignment;
  showExcerpt: boolean;
  excerptBold: boolean;
  excerptAlignment: PageBlockTextAlignment;
  showDate: boolean;
  dateBold: boolean;
  dateAlignment: PageBlockTextAlignment;
};

export const DEFAULT_FEED_ARTICLE_CARD_PRESENTATION = {
  showTitle: true,
  titleBold: false,
  titleAlignment: "right",
  showExcerpt: false,
  excerptBold: false,
  excerptAlignment: "right",
  showDate: true,
  dateBold: false,
  dateAlignment: "right",
} as const satisfies FeedArticleCardPresentation;

export type FeedCategoryCardPresentation = {
  showCategory: boolean;
  categoryBold: boolean;
  categoryAlignment: PageBlockTextAlignment;
  showCount: boolean;
  countBold: boolean;
  countAlignment: PageBlockTextAlignment;
};

export const DEFAULT_FEED_CATEGORY_CARD_PRESENTATION = {
  showCategory: true,
  categoryBold: false,
  categoryAlignment: "right",
  showCount: true,
  countBold: false,
  countAlignment: "left",
} as const satisfies FeedCategoryCardPresentation;

export type FeedSeriesCardPresentation = {
  showSeries: boolean;
  seriesBold: boolean;
  seriesAlignment: PageBlockTextAlignment;
  showDescription: boolean;
  descriptionBold: boolean;
  descriptionAlignment: PageBlockTextAlignment;
  showDetails: boolean;
  detailsBold: boolean;
  detailsAlignment: PageBlockTextAlignment;
};

export const DEFAULT_FEED_SERIES_CARD_PRESENTATION = {
  showSeries: true,
  seriesBold: true,
  seriesAlignment: "right",
  showDescription: false,
  descriptionBold: false,
  descriptionAlignment: "right",
  showDetails: true,
  detailsBold: false,
  detailsAlignment: "left",
} as const satisfies FeedSeriesCardPresentation;

export const DEFAULT_FEED_SERIES_LINK_TEXT = "عرض كل الموضوعات";

export type FeedModulePresentation = PageBlockTextFormattingConfig & {
  title: string;
  eyebrow?: string | null;
  linkText?: string | null;
  showImage: boolean;
  showDate: boolean;
  showExcerpt: boolean;
  emptyBehavior: "hide";
  articleCard?: FeedArticleCardPresentation;
  categoryCard?: FeedCategoryCardPresentation;
  seriesCard?: FeedSeriesCardPresentation;
  variants: FeedPresentationVariants;
};

export type FeedModuleQueryConfig = {
  limit: number;
  categorySlugs: string[];
  seriesSlugs: string[];
};

export type FeedModuleConfig = {
  presentation: FeedModulePresentation;
  query: FeedModuleQueryConfig;
};

export type FeedModuleTemplateRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  feed_type: TopicsFeedType;
  config: Record<string, unknown> | null;
  sort_order: number;
};

export type FeedModulePayload =
  | { kind: "articles"; items: SidebarArticleItem[] }
  | { kind: "categories"; items: SidebarCategoryItem[] }
  | { kind: "series"; items: SidebarSeriesItem[] };

export type ResolvedFeedModule = {
  assignmentId: number;
  templateId: number;
  sortOrder: number;
  feedType: TopicsFeedType;
  presentation: FeedModulePresentation;
  payload: FeedModulePayload;
};
