export type ContentFeedParent = "topics" | "media-center";

export type SidebarCategoryItem = {
  name: string;
  href: string;
  count: number;
};

export type SidebarSeriesItem = {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  slug: string;
};

export type SidebarArticleItem = {
  title: string;
  date?: string;
  excerpt?: string;
  image: string;
  href: string;
};

export type SidebarFeedsData = {
  categories: SidebarCategoryItem[];
  series: SidebarSeriesItem[];
  latest: SidebarArticleItem[];
  popular: SidebarArticleItem[];
};

export type SidebarFeedLabels = {
  categoriesEyebrow: string;
  categoriesTitle: string;
  seriesEyebrow: string;
  seriesTitle: string;
  seriesLinkText: string;
  latestTitle: string;
  mostReadTitle: string;
};
