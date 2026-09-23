import "server-only";

import { loadFeedModuleStateForPageSlug } from "../feed-modules/load-feed-modules";
import { loadFeaturedModuleStateForPageSlug } from "../featured-modules/load-featured-modules";
import { getHeroSectionState } from "../load-hero-section";
import { queryMediaHubModules } from "../media-hub-modules/load-media-hub-modules";
import { queryMediaSidebarModules } from "../media-sidebar-modules/load-media-sidebar-modules";
import {
  getPublishedPageStateBySlug,
  toPublicPageIdentity,
} from "../pages/get-published-page-by-slug";
import {
  comparePageAssignmentOrder,
  getDefaultAssignmentPosition,
  isAssignmentPositionAllowed,
} from "../page-composition/page-assignment-contract";
import { loadPageRegionsForPage } from "../page-composition/load-page-regions";
import { PAGE_COMPOSITION_POSITIONS } from "../page-composition/positions";
import { loadHomepageProjects } from "../projects/load-homepage-projects";
import { isHomeProjectsTemplate } from "./configs";
import { normalizeLayoutSlot } from "./layout-slots";
import { loadPageBlockStateBySlug } from "./load-page-blocks";
import type { PageLayoutSlot } from "./layout-slots";
import type { PageComposition, SlotEntry } from "./page-composition-types";
import type { ResolvedPageBlock } from "./types";

function emptySlots(regions: readonly string[]): Record<PageLayoutSlot, SlotEntry[]> {
  return Object.fromEntries(
    [...new Set([...PAGE_COMPOSITION_POSITIONS, ...regions])].map((position) => [position, []]),
  ) as unknown as Record<PageLayoutSlot, SlotEntry[]>;
}

function sortEntries(entries: SlotEntry[]) {
  return [...entries].sort((left, right) =>
    comparePageAssignmentOrder(
      {
        sortOrder: left.sortOrder,
        moduleKind: left.kind === "block" ? left.block.blockType : left.kind,
        assignmentId: left.assignmentId,
      },
      {
        sortOrder: right.sortOrder,
        moduleKind: right.kind === "block" ? right.block.blockType : right.kind,
        assignmentId: right.assignmentId,
      },
    ),
  );
}

function pushBlock(
  slots: Record<PageLayoutSlot, SlotEntry[]>,
  block: ResolvedPageBlock,
  regions: readonly string[],
) {
  if (!isAssignmentPositionAllowed(block.blockType, block.slot, regions)) return false;
  const slot = normalizeLayoutSlot(block.slot);
  slots[slot].push({
    kind: "block",
    assignmentId: block.assignmentId,
    sortOrder: block.sortOrder,
    block,
  });
  return true;
}

export async function loadPageCompositionBySlug(
  pageSlug: string,
): Promise<PageComposition> {
  const featuredStatePromise = loadFeaturedModuleStateForPageSlug(pageSlug);
  const feedStatePromise = featuredStatePromise.then((featuredState) =>
    loadFeedModuleStateForPageSlug(
      pageSlug,
      featuredState.modules.flatMap((module) =>
        module.items.map((item) => item.id),
      ),
    ),
  );
  const [
    pageState,
    heroState,
    blockState,
    feedState,
    featuredState,
    mediaHubModules,
    mediaSidebarModules,
  ] = await Promise.all([
    getPublishedPageStateBySlug(pageSlug),
    getHeroSectionState(pageSlug),
    loadPageBlockStateBySlug(pageSlug),
    feedStatePromise,
    featuredStatePromise,
    queryMediaHubModules(pageSlug),
    queryMediaSidebarModules(pageSlug),
  ]);

  let layoutError = false;
  const layout = pageState.page
    ? await loadPageRegionsForPage(pageState.page.id).catch(() => {
        layoutError = true;
        return null;
      })
    : null;
  const regions = layout?.regions ?? [];
  // Routes without a persisted Page retain their historical static shell.
  // Persisted Pages take their Region authority only from their Layout.
  const regionKeys = pageState.page
    ? regions.map((region) => region.key)
    : [...PAGE_COMPOSITION_POSITIONS];
  const slots = emptySlots(regionKeys);
  let invalidAssignmentRegion = false;
  const homepageProjects = blockState.blocks.some((block) =>
    isHomeProjectsTemplate(block.template.slug, block.template.variant),
  )
    ? await loadHomepageProjects()
    : null;

  for (const block of blockState.blocks) {
    if (!pushBlock(slots, block, regionKeys)) invalidAssignmentRegion = true;
  }

  for (const feed of feedState.modules) {
    if (!isAssignmentPositionAllowed("feed", feed.slot, regionKeys)) {
      invalidAssignmentRegion = true;
      continue;
    }
    slots[feed.slot].push({
      kind: "feed",
      assignmentId: feed.assignmentId,
      sortOrder: feed.sortOrder,
      module: feed,
    });
  }

  for (const featured of featuredState.modules) {
    if (!isAssignmentPositionAllowed("featured", featured.slot, regionKeys)) {
      invalidAssignmentRegion = true;
      continue;
    }
    slots[featured.slot].push({
      kind: "featured",
      assignmentId: featured.assignmentId,
      sortOrder: featured.sortOrder,
      module: featured,
    });
  }

  for (const widget of mediaSidebarModules.widgets) {
    if (!widget.isVisible) continue;
    if (!isAssignmentPositionAllowed("media-sidebar", widget.slot, regionKeys)) {
      invalidAssignmentRegion = true;
      continue;
    }
    slots[widget.slot].push({
      kind: "media-sidebar",
      assignmentId: widget.assignmentId,
      sortOrder: widget.sortOrder,
      widget,
    });
  }

  for (const hubModule of mediaHubModules.modules) {
    if (!hubModule.isVisible) continue;
    if (!isAssignmentPositionAllowed("media-hub", hubModule.slot, regionKeys)) {
      invalidAssignmentRegion = true;
      continue;
    }
    slots[hubModule.slot].push({
      kind: "media-hub",
      assignmentId: hubModule.assignmentId,
      sortOrder: hubModule.sortOrder,
      module: hubModule,
    });
  }

  if (heroState.hero && heroState.assignmentId !== null) {
    const position = getDefaultAssignmentPosition("hero", regionKeys);
    if (position && isAssignmentPositionAllowed("hero", position, regionKeys)) {
      slots[position].push({
        kind: "hero",
        assignmentId: heroState.assignmentId,
        sortOrder: 0,
        hero: heroState.hero,
      });
    } else {
      invalidAssignmentRegion = true;
    }
  }

  for (const key of Object.keys(slots) as PageLayoutSlot[]) {
    slots[key] = sortEntries(slots[key]);
  }

  const hasAnyAssignmentRows =
    heroState.hasAnyAssignmentRows ||
    blockState.hasAnyAssignmentRows ||
    feedState.hasAnyAssignmentRows ||
    featuredState.hasAnyAssignmentRows ||
    mediaHubModules.hasAnyAssignmentRows ||
    mediaSidebarModules.hasAnyAssignmentRows;
  const hasRenderableModules =
    heroState.visibility === "visible" ||
    blockState.hasRenderableModules ||
    feedState.modules.length > 0 ||
    featuredState.modules.length > 0 ||
    mediaHubModules.hasRenderableModules ||
    mediaSidebarModules.hasRenderableModules;
  const hasCompositionError =
    pageState.sourceStatus === "error" || layoutError || invalidAssignmentRegion ||
    heroState.visibility === "error" ||
    blockState.hasCompositionError ||
    feedState.hasCompositionError ||
    featuredState.hasCompositionError ||
    mediaHubModules.sourceStatus === "error" ||
    mediaSidebarModules.sourceStatus === "error";

  return {
    pageIdentity: pageState.page ? toPublicPageIdentity(pageState.page) : null,
    layoutKey: layout?.key ?? (pageState.page ? "" : "venisia-legacy"),
    regions,
    slots,
    blockStates: blockState.blockStates ?? [],
    heroVisibility: heroState.visibility,
    mediaHubModules,
    mediaSidebarModules,
    featuredModules: featuredState.modules,
    homepageProjects,
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    hasAssignments: hasRenderableModules,
  };
}
