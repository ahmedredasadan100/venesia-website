import { MEDIA_SIDEBAR_WIDGET_DEFAULTS } from "./parse-config";
import type { MediaSidebarModulesState, MediaSidebarWidgetState } from "./types";

export const DEFAULT_MEDIA_SIDEBAR_WIDGETS: MediaSidebarWidgetState[] = [
  {
    widgetKey: "sections",
    assignmentId: 0,
    sortOrder: 10,
    isVisible: true,
    title: "أقسام المركز الإعلامي",
    config: MEDIA_SIDEBAR_WIDGET_DEFAULTS.sections.config,
  },
  {
    widgetKey: "latest",
    assignmentId: 0,
    sortOrder: 20,
    isVisible: true,
    title: "أحدث الأخبار",
    config: MEDIA_SIDEBAR_WIDGET_DEFAULTS.latest.config,
  },
  {
    widgetKey: "popular",
    assignmentId: 0,
    sortOrder: 30,
    isVisible: true,
    title: "الأكثر قراءة",
    config: MEDIA_SIDEBAR_WIDGET_DEFAULTS.popular.config,
  },
];

export const DEFAULT_MEDIA_SIDEBAR_MODULES: MediaSidebarModulesState = {
  widgets: DEFAULT_MEDIA_SIDEBAR_WIDGETS,
  usesFallback: true,
};
