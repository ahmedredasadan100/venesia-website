import { MEDIA_HUB_SECTION_DEFAULTS } from "./parse-config";
import type { MediaHubModuleState, MediaHubModulesState } from "./types";

export const DEFAULT_MEDIA_HUB_MODULES: MediaHubModuleState[] = [
  {
    sectionKey: "featured",
    assignmentId: 0,
    sortOrder: 10,
    isVisible: true,
    title: "Media Featured News Module",
    templateSlug: "media-hub-featured",
    config: MEDIA_HUB_SECTION_DEFAULTS.featured.config,
  },
  {
    sectionKey: "site-updates",
    assignmentId: 0,
    sortOrder: 20,
    isVisible: true,
    title: "Media Site Updates Module",
    templateSlug: "media-hub-site-updates",
    config: MEDIA_HUB_SECTION_DEFAULTS["site-updates"].config,
  },
  {
    sectionKey: "videos",
    assignmentId: 0,
    sortOrder: 30,
    isVisible: true,
    title: "Media Videos Module",
    templateSlug: "media-hub-videos",
    config: MEDIA_HUB_SECTION_DEFAULTS.videos.config,
  },
  {
    sectionKey: "gallery",
    assignmentId: 0,
    sortOrder: 40,
    isVisible: true,
    title: "Media Gallery Module",
    templateSlug: "media-hub-gallery",
    config: MEDIA_HUB_SECTION_DEFAULTS.gallery.config,
  },
  {
    sectionKey: "press",
    assignmentId: 0,
    sortOrder: 50,
    isVisible: true,
    title: "Media Press Module",
    templateSlug: "media-hub-press",
    config: MEDIA_HUB_SECTION_DEFAULTS.press.config,
  },
];

export const DEFAULT_MEDIA_HUB_MODULES_STATE: MediaHubModulesState = {
  modules: DEFAULT_MEDIA_HUB_MODULES,
  usesFallback: true,
};
