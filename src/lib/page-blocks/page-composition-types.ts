import type { ResolvedFeedModule } from "../feed-modules/types";
import type { HeroSectionData } from "../page-sections";
import type { HomeModuleSlug } from "./home-module-slugs";
import type { ResolvedPageBlock } from "./types";
import type { PageLayoutSlot } from "./layout-slots";

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
  hasAssignments: boolean;
  /** Home modules with an assignment row where is_visible=false — suppress fallback rendering. */
  hiddenHomeModuleSlugs?: HomeModuleSlug[];
};
