import type { MediaSidebarItem } from "../media-center";
import type { MediaSidebarModuleConfig } from "./parse-config";

export type MediaSidebarWidgetKey = "sections" | "latest" | "popular";

export type MediaSidebarWidgetState = {
  widgetKey: MediaSidebarWidgetKey;
  assignmentId: number;
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
