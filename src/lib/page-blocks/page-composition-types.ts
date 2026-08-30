import type { ResolvedFeedModule } from "../feed-modules/types";
import type { ResolvedFeaturedModule } from "../featured-modules/contract";
import type { HeroSectionVisibility } from "../load-hero-section";
import type { MediaHubModuleState, MediaHubModulesState } from "../media-hub-modules/types";
import type { MediaSidebarModulesState } from "../media-sidebar-modules/types";
import type { MediaSidebarWidgetState } from "../media-sidebar-modules/types";
import type { HeroSectionData } from "../page-sections";
import type { PageLayoutSlot } from "./layout-slots";
import type { PageBlockPublicState, ResolvedPageBlock } from "./types";

export type HeroSlotEntry = {
  kind: "hero";
  assignmentId: number;
  sortOrder: number;
  hero: HeroSectionData;
};

export type BlockSlotEntry = {
  kind: "block";
  assignmentId: number;
  sortOrder: number;
  block: ResolvedPageBlock;
};

export type FeedSlotEntry = {
  kind: "feed";
  assignmentId: number;
  sortOrder: number;
  module: ResolvedFeedModule;
};

export type FeaturedSlotEntry = {
  kind: "featured";
  assignmentId: number;
  sortOrder: number;
  module: ResolvedFeaturedModule;
};

export type MediaSidebarSlotEntry = {
  kind: "media-sidebar";
  assignmentId: number;
  sortOrder: number;
  widget: MediaSidebarWidgetState;
};

export type MediaHubSlotEntry = {
  kind: "media-hub";
  assignmentId: number;
  sortOrder: number;
  module: MediaHubModuleState;
};

export type SlotEntry =
  | HeroSlotEntry
  | BlockSlotEntry
  | FeedSlotEntry
  | FeaturedSlotEntry
  | MediaSidebarSlotEntry
  | MediaHubSlotEntry;

export type PageComposition = {
  slots: Record<PageLayoutSlot, SlotEntry[]>;
  /** Page Block assignment/publication truth before render filtering. */
  blockStates: PageBlockPublicState[];
  heroVisibility: HeroSectionVisibility;
  mediaHubModules: MediaHubModulesState | null;
  mediaSidebarModules: MediaSidebarModulesState | null;
  featuredModules: ResolvedFeaturedModule[];
  /** Assignment rows exist before visibility/publication filters. */
  hasAnyAssignmentRows: boolean;
  /** Visible and published modules exposed by the canonical composition, including specialized Media modules. */
  hasRenderableModules: boolean;
  /** Any canonical composition query failed. */
  hasCompositionError: boolean;
  /** @deprecated Alias of hasRenderableModules. */
  hasAssignments: boolean;
};
