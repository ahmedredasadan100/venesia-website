export type SidebarCategoryItem = {
  name: string;
  href: string;
  count: number;
};

export type SidebarSeriesItem = {
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  href: string;
  slug: string;
};

export type SidebarArticleItem = {
  id: number;
  title: string;
  date?: string;
  excerpt?: string;
  image: string;
  imageAlt: string;
  href: string;
  category: string;
  series: string;
  viewsCount: number;
};
