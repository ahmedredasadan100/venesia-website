import "server-only";

import { loadFeedModuleStateForPageSlug } from "../feed-modules/load-feed-modules";
import { loadFeaturedModuleStateForPageSlug } from "../featured-modules/load-featured-modules";
import { getHeroSectionState } from "../load-hero-section";
import { isMediaCenterCmsPageSlug } from "../media-center-page-config";
import { queryMediaHubModules } from "../media-hub-modules/load-media-hub-modules";
import { queryMediaSidebarModules } from "../media-sidebar-modules/load-media-sidebar-modules";
import { normalizeLayoutSlot } from "./layout-slots";
import type { PageComposition, SlotEntry } from "./page-composition-types";
import { loadPageBlockStateBySlug } from "./load-page-blocks";
import type { PageLayoutSlot } from "./layout-slots";
import type { ResolvedPageBlock } from "./types";
import {
  getDefaultAssignmentPosition,
  isAssignmentPositionAllowed,
} from "../page-composition/page-assignment-contract";
import { PAGE_COMPOSITION_POSITIONS } from "../page-composition/positions";

function emptySlots(): Record<PageLayoutSlot, SlotEntry[]> {
  return Object.fromEntries(
    PAGE_COMPOSITION_POSITIONS.map((position) => [position, []]),
  ) as unknown as Record<PageLayoutSlot, SlotEntry[]>;
}

function sortEntries(entries: SlotEntry[]) {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.assignmentId - b.assignmentId);
}

function pushBlock(
  slots: Record<PageLayoutSlot, SlotEntry[]>,
  block: ResolvedPageBlock,
) {
  if (!isAssignmentPositionAllowed(block.blockType, block.slot)) return;
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
): Promise<PageComposition> {
  const isMediaCenterPage = isMediaCenterCmsPageSlug(pageSlug);
  const [heroState, blockState, feedState, featuredState, mediaHubModules, mediaSidebarModules] = await Promise.all([
    getHeroSectionState(pageSlug),
    loadPageBlockStateBySlug(pageSlug),
    loadFeedModuleStateForPageSlug(pageSlug),
    loadFeaturedModuleStateForPageSlug(pageSlug),
    isMediaCenterPage
      ? queryMediaHubModules(pageSlug)
      : null,
    queryMediaSidebarModules(pageSlug),
  ]);

  const slots = emptySlots();

  for (const block of blockState.blocks) {
    pushBlock(slots, block);
  }

  for (const feed of feedState.modules) {
    if (!isAssignmentPositionAllowed("feed", feed.slot)) continue;
    slots[feed.slot].push({
      kind: "feed",
      assignmentId: feed.assignmentId,
      sortOrder: feed.sortOrder,
      module: feed,
    });
  }

  for (const featured of featuredState.modules) {
    if (!isAssignmentPositionAllowed("featured", featured.slot)) continue;
    slots[featured.slot].push({
      kind: "featured",
      assignmentId: featured.assignmentId,
      sortOrder: featured.sortOrder,
      module: featured,
    });
  }

  for (const widget of mediaSidebarModules.widgets) {
    if (!widget.isVisible) continue;
    if (!isAssignmentPositionAllowed("media-sidebar", widget.slot)) continue;
    slots[widget.slot].push({
      kind: "media-sidebar",
      assignmentId: widget.assignmentId,
      sortOrder: widget.sortOrder,
      widget,
    });
  }

  for (const hubModule of mediaHubModules?.modules ?? []) {
    if (
      !hubModule.isVisible ||
      hubModule.config.placement === "listing" ||
      !isAssignmentPositionAllowed("media-hub", hubModule.slot)
    ) continue;
    slots[hubModule.slot].push({
      kind: "media-hub",
      assignmentId: hubModule.assignmentId,
      sortOrder: hubModule.sortOrder,
      module: hubModule,
    });
  }

  if (heroState.hero && heroState.assignmentId !== null) {
    const position = getDefaultAssignmentPosition("hero");
    if (isAssignmentPositionAllowed("hero", position)) slots[position].push({
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
    featuredState.hasAnyAssignmentRows ||
    Boolean(mediaHubModules?.hasAnyAssignmentRows) ||
    mediaSidebarModules.hasAnyAssignmentRows;
  const hasRenderableModules =
    heroState.visibility === "visible" ||
    blockState.hasRenderableModules ||
    feedState.modules.length > 0 ||
    featuredState.modules.length > 0 ||
    Boolean(mediaHubModules?.hasRenderableModules) ||
    mediaSidebarModules.hasRenderableModules;
  const hasCompositionError =
    heroState.visibility === "error" ||
    blockState.hasCompositionError ||
    feedState.hasCompositionError ||
    featuredState.hasCompositionError ||
    mediaHubModules?.sourceStatus === "error" ||
    mediaSidebarModules.sourceStatus === "error";

  return {
    slots,
    blockStates: blockState.blockStates ?? [],
    heroVisibility: heroState.visibility,
    mediaHubModules,
    mediaSidebarModules,
    featuredModules: featuredState.modules,
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    hasAssignments: hasRenderableModules,
  };
}
