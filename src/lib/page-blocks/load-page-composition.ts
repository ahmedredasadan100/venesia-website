import "server-only";

import { loadFeedModulesForPageSlug } from "../feed-modules/load-feed-modules";
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
  const [hero, blockState, feedModules] = await Promise.all([
    getHeroSectionByPageSlug(pageSlug),
    loadPageBlockStateBySlug(pageSlug),
    loadFeedModulesForPageSlug(pageSlug),
  ]);

  const slots = emptySlots();

  for (const block of blockState.blocks) {
    pushBlock(slots, block);
  }

  for (const feed of feedModules) {
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

  return {
    layoutMode,
    slots,
    hasAssignments: blockState.hasAssignments || feedModules.length > 0,
    hiddenHomeModuleSlugs:
      pageSlug === "home" ? blockState.hiddenHomeModuleSlugs : undefined,
  };
}
