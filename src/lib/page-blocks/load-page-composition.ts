import "server-only";

import { loadFeedModuleStateForPageSlug } from "../feed-modules/load-feed-modules";
import { getHeroSectionByPageSlug } from "../load-hero-section";
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
  const [hero, blockState, feedState] = await Promise.all([
    getHeroSectionByPageSlug(pageSlug),
    loadPageBlockStateBySlug(pageSlug),
    loadFeedModuleStateForPageSlug(pageSlug),
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

  if (hero) {
    slots.hero.push({
      kind: "hero",
      assignmentId: hero.template?.id ?? hero.id,
      sortOrder: 0,
      hero,
    });
  }

  for (const key of Object.keys(slots) as PageLayoutSlot[]) {
    slots[key] = sortEntries(slots[key]);
  }

  const hasAnyAssignmentRows = blockState.hasAnyAssignmentRows || feedState.hasAnyAssignmentRows;
  const hasRenderableModules = blockState.hasRenderableModules || feedState.modules.length > 0;
  const hasCompositionError = blockState.hasCompositionError || feedState.hasCompositionError;

  return {
    layoutMode,
    slots,
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    hasAssignments: hasRenderableModules,
    hiddenHomeModuleSlugs:
      pageSlug === "home" ? blockState.hiddenHomeModuleSlugs : undefined,
  };
}
