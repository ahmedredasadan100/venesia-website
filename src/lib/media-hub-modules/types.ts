import type { MediaContentItem } from "../media-center";
import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import type { MediaHubModuleConfig } from "./parse-config";

export type MediaHubSectionKey = "featured" | "site-updates" | "videos" | "gallery" | "press";

export type MediaHubFeaturedSectionData = {
  kind: "featured";
  items: MediaContentItem[];
};

export type MediaHubItemsSectionData = {
  kind: "site-updates" | "videos" | "gallery" | "press";
  items: MediaContentItem[];
};

export type MediaHubSectionData = MediaHubFeaturedSectionData | MediaHubItemsSectionData;

export type MediaHubModuleState = {
  sectionKey: MediaHubSectionKey;
  assignmentId: number;
  slot: PageLayoutSlot;
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
  hasAnyAssignmentRows: boolean;
  hasRenderableModules: boolean;
};
