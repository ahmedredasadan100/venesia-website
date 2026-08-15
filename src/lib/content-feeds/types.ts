

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
