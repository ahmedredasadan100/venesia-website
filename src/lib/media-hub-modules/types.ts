import type { MediaContentItem } from "../media-center";
import type { MediaHubModuleConfig } from "./parse-config";

export type MediaHubSectionKey = "featured" | "site-updates" | "videos" | "gallery" | "press";

export type MediaHubFeaturedSectionData = {
  kind: "featured";
  featuredNews: MediaContentItem;
  latestNews: MediaContentItem[];
  sideLimit: number;
};

export type MediaHubItemsSectionData = {
  kind: "site-updates" | "videos" | "gallery" | "press";
  items: MediaContentItem[];
};

export type MediaHubSectionData = MediaHubFeaturedSectionData | MediaHubItemsSectionData;

export type MediaHubModuleState = {
  sectionKey: MediaHubSectionKey;
  assignmentId: number;
  sortOrder: number;
  isVisible: boolean;
  title: string;
  templateSlug: string;
  config: MediaHubModuleConfig;
  sectionData?: MediaHubSectionData | null;
};

export type MediaHubModulesState = {
  modules: MediaHubModuleState[];
  sourceStatus: "database" | "missing" | "error";
  sourceIssues: string[];
};

export type MediaHubListingTopicOption = {
  id: number;
  title: string;
};
