import type { ContentDisplayOptions } from "../page-blocks/configs";
import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import type { MediaSidebarModuleConfig } from "./parse-config";

export type MediaSidebarWidgetKey = "sections" | "latest" | "popular";

export type MediaSidebarContentItem = {
  id: number;
  href: string;
  title: string;
  image: string;
  imageAlt: string;
  category: string;
  series: string;
  excerpt: string;
  date: string;
  display: ContentDisplayOptions;
};

export type MediaSidebarWidgetState = {
  widgetKey: MediaSidebarWidgetKey;
  assignmentId: number;
  slot: PageLayoutSlot;
  sortOrder: number;
  isVisible: boolean;
  title: string;
  config: MediaSidebarModuleConfig;
  items?: MediaSidebarContentItem[];
};

export type MediaSidebarModulesState = {
  widgets: MediaSidebarWidgetState[];
  sourceStatus: "database" | "missing" | "error";
  sourceIssues: string[];
  hasAnyAssignmentRows: boolean;
  hasRenderableModules: boolean;
};
