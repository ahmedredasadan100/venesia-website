import type { MediaSidebarItem } from "../media-center";
import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import type { MediaSidebarModuleConfig } from "./parse-config";

export type MediaSidebarWidgetKey = "sections" | "latest" | "popular";

export type MediaSidebarWidgetState = {
  widgetKey: MediaSidebarWidgetKey;
  assignmentId: number;
  slot: PageLayoutSlot;
  sortOrder: number;
  isVisible: boolean;
  title: string;
  config: MediaSidebarModuleConfig;
  items?: MediaSidebarItem[];
};

export type MediaSidebarModulesState = {
  widgets: MediaSidebarWidgetState[];
  sourceStatus: "database" | "missing" | "error";
  sourceIssues: string[];
  hasAnyAssignmentRows: boolean;
  hasRenderableModules: boolean;
};
