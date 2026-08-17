import "server-only";

import { loadFeedModuleStateForPageSlug } from "../feed-modules/load-feed-modules";
import { getHeroSectionState } from "../load-hero-section";
import { isMediaCenterCmsPageSlug } from "../media-center-page-config";
import { queryMediaHubModules } from "../media-hub-modules/load-media-hub-modules";
import { queryMediaSidebarModules } from "../media-sidebar-modules/load-media-sidebar-modules";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageComposition, PageLayoutMode, SlotEntry } from "./page-composition-types";
import { loadPageBlockStateBySlug } from "./load-page-blocks";
import type { PageLayoutSlot } from "./layout-slots";
import type { ResolvedPageBlock } from "./types";

function emptySlots(): Record<PageLayoutSlot, SlotEntry[]> {
  return {
    hero: [],
    main: [],
    sidebar: [],
    bottom: [],
    footer: [],
  };
}

function sortEntries(entries: SlotEntry[]) {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.assignmentId - b.assignmentId);
}

function pushBlock(slots: Record<PageLayoutSlot, SlotEntry[]>, block: ResolvedPageBlock) {
  const slot = normalizeLayoutSlot(block.slot);
  slots[slot].push({
    kind: "block",
    assignmentId: block.assignmentId,
    sortOrder: block.sortOrder,
    block,
  });
}

export async function loadPageCompositionBySlug(
  pageSlug: string,
  layoutMode: PageLayoutMode = "stack",
): Promise<PageComposition> {
  const isMediaCenterPage = isMediaCenterCmsPageSlug(pageSlug);
  const [heroState, blockState, feedState, mediaHubModules, mediaSidebarModules] = await Promise.all([
    getHeroSectionState(pageSlug),
    loadPageBlockStateBySlug(pageSlug),
    loadFeedModuleStateForPageSlug(pageSlug),
    isMediaCenterPage
      ? queryMediaHubModules(pageSlug)
      : null,
    isMediaCenterPage ? queryMediaSidebarModules(pageSlug) : null,
  ]);

  const slots = emptySlots();

  for (const block of blockState.blocks) {
    pushBlock(slots, block);
  }

  for (const feed of feedState.modules) {
    slots[feed.slot].push({
      kind: "feed",
      assignmentId: feed.assignmentId,
      sortOrder: feed.sortOrder,
      module: feed,
    });
  }

  if (heroState.hero && heroState.assignmentId !== null) {
    slots.hero.push({
      kind: "hero",
      assignmentId: heroState.assignmentId,
      sortOrder: 0,
      hero: heroState.hero,
    });
  }

  for (const key of Object.keys(slots) as PageLayoutSlot[]) {
    slots[key] = sortEntries(slots[key]);
  }

  const hasAnyAssignmentRows =
    heroState.hasAnyAssignmentRows ||
    blockState.hasAnyAssignmentRows ||
    feedState.hasAnyAssignmentRows ||
    Boolean(mediaHubModules?.hasAnyAssignmentRows) ||
    Boolean(mediaSidebarModules?.hasAnyAssignmentRows);
  const hasRenderableModules =
    heroState.visibility === "visible" ||
    blockState.hasRenderableModules ||
    feedState.modules.length > 0 ||
    Boolean(mediaHubModules?.hasRenderableModules) ||
    Boolean(mediaSidebarModules?.hasRenderableModules);
  const hasCompositionError =
    heroState.visibility === "error" ||
    blockState.hasCompositionError ||
    feedState.hasCompositionError ||
    mediaHubModules?.sourceStatus === "error" ||
    mediaSidebarModules?.sourceStatus === "error";

  return {
    layoutMode,
    slots,
    blockStates: blockState.blockStates ?? [],
    heroVisibility: heroState.visibility,
    mediaHubModules,
    mediaSidebarModules,
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    hasAssignments: hasRenderableModules,
  };
}
