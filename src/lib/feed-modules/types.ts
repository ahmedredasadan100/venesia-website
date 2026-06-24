import type {
  SidebarArticleItem,
  SidebarCategoryItem,
  SidebarSeriesItem,
} from "../content-feeds/types";

export const TOPICS_FEED_TYPES = ["latest", "popular", "categories", "series"] as const;
export type TopicsFeedType = (typeof TOPICS_FEED_TYPES)[number];

export type FeedModulePresentation = {
  title: string;
  eyebrow?: string | null;
  linkText?: string | null;
  showImage: boolean;
  showDate: boolean;
  showExcerpt: boolean;
  emptyBehavior: "hide";
};

export type FeedModuleQueryConfig = {
  limit: number;
  categorySlug: string | null;
  seriesSlug: string | null;
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
