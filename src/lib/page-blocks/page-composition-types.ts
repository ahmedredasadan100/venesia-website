import type { ResolvedFeedModule } from "../feed-modules/types";
import type { HeroSectionVisibility } from "../load-hero-section";
import type { MediaHubModulesState } from "../media-hub-modules/types";
import type { MediaSidebarModulesState } from "../media-sidebar-modules/types";
import type { HeroSectionData } from "../page-sections";
import type { PageLayoutSlot } from "./layout-slots";
import type { PageBlockPublicState, ResolvedPageBlock } from "./types";

export type PageLayoutMode = "stack" | "main-sidebar";

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

export type SlotEntry = HeroSlotEntry | BlockSlotEntry | FeedSlotEntry;

export type PageComposition = {
  layoutMode: PageLayoutMode;
  slots: Record<PageLayoutSlot, SlotEntry[]>;
  /** Page Block assignment/publication truth before render filtering. */
  blockStates: PageBlockPublicState[];
  heroVisibility: HeroSectionVisibility;
  mediaHubModules: MediaHubModulesState | null;
  mediaSidebarModules: MediaSidebarModulesState | null;
  /** Assignment rows exist before visibility/publication filters. */
  hasAnyAssignmentRows: boolean;
  /** Visible and published modules exposed by the canonical composition, including specialized Media modules. */
  hasRenderableModules: boolean;
  /** Any canonical composition query failed. */
  hasCompositionError: boolean;
  /** @deprecated Alias of hasRenderableModules. */
  hasAssignments: boolean;
};
