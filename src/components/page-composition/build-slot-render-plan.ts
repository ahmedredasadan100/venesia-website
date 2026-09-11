import { type ReactNode } from "react";

import type { ResolvedFeedModule } from "../../lib/feed-modules/types";
import type { ResolvedFeaturedModule } from "../../lib/featured-modules/contract";
import type { MediaHubModuleState } from "../../lib/media-hub-modules/types";
import type { MediaSidebarWidgetState } from "../../lib/media-sidebar-modules/types";
import type { SlotEntry } from "../../lib/page-blocks/page-composition-types";
import type {
  PageBlockType,
  ResolvedPageBlock,
} from "../../lib/page-blocks/types";
import { comparePageAssignmentOrder } from "../../lib/page-composition/page-assignment-contract";
import { isFeedModuleRenderable } from "../feed-modules/FeedModuleSection";
import { isFeaturedModuleRenderable } from "../featured/FeaturedModuleSection";
import { isMediaHubModuleRenderable } from "../media-center/renderMediaHubSections";
import {
  buildSlotModuleNodes,
  type ContactFormPair,
  type SlotModuleRenderContext,
} from "./slot-module-nodes";

/**
 * Explicit slot render plan items.
 *
 * - `feed` — standalone feed module (keeps its sort_order among blocks)
 * - `module` — output of buildSlotModuleNodes (a composite carries the
 *   assignmentId of its earliest member)
 */
export type SlotRenderPlanItem =
  | {
      kind: "feed";
      moduleKind: "feed";
      key: string;
      assignmentId: number;
      sortOrder: number;
      module: ResolvedFeedModule;
    }
  | {
      kind: "media-sidebar";
      moduleKind: "media-sidebar";
      key: string;
      assignmentId: number;
      sortOrder: number;
      widget: MediaSidebarWidgetState;
    }
  | {
      kind: "featured";
      moduleKind: "featured";
      key: string;
      assignmentId: number;
      sortOrder: number;
      module: ResolvedFeaturedModule;
    }
  | {
      kind: "media-hub";
      moduleKind: "media-hub";
      key: string;
      assignmentId: number;
      sortOrder: number;
      module: MediaHubModuleState;
    }
  | {
      kind: "module";
      key: string;
      moduleKind: PageBlockType;
      assignmentId: number;
      sortOrder: number;
      node: ReactNode;
    };

/**
 * Peer-composite relationships resolved inside `buildSlotModuleNodes`.
 * Kept here so PageSlotLayout does not invent ad-hoc pairing rules.
 *
 * Complementary slug occurrences pair only when adjacent in the full canonical
 * slot sequence. Unmatched occurrences render a half section, so no legal
 * Assignment is dropped or moved across another Assignment.
 */
export const SLOT_COMPOSITE_RELATIONSHIPS = [
  {
    id: "contact-office-form",
    parentSlugs: ["contact-form-office", "contact-form"] as const,
    peerSlugs: ["contact-form-office", "contact-form"] as const,
    notes: "Adjacent Office/Form occurrences pair one-to-one; every non-adjacent or unmatched occurrence renders a half section at its saved order.",
  },
] as const;

function slotEntryOrder(entry: SlotEntry) {
  return {
    sortOrder: entry.sortOrder,
    moduleKind: entry.kind === "block" ? entry.block.blockType : entry.kind,
    assignmentId: entry.assignmentId,
  };
}

function buildAdjacentContactFormPairs(entries: SlotEntry[]): ContactFormPair[] {
  const ordered = [...entries].sort((left, right) =>
    comparePageAssignmentOrder(slotEntryOrder(left), slotEntryOrder(right)),
  );
  const pairs: ContactFormPair[] = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    if (current.kind !== "block" || next.kind !== "block") continue;

    const currentSlug = current.block.template.slug;
    const nextSlug = next.block.template.slug;
    const isComplementaryPair =
      (currentSlug === "contact-form-office" && nextSlug === "contact-form") ||
      (currentSlug === "contact-form" && nextSlug === "contact-form-office");
    if (!isComplementaryPair) continue;

    pairs.push({
      office: currentSlug === "contact-form-office" ? current.block : next.block,
      form: currentSlug === "contact-form" ? current.block : next.block,
    });
    index += 1;
  }

  return pairs;
}

/**
 * Build an ordered render plan for one layout slot.
 *
 * Strategy:
 * 1. Resolve Contact composites only across adjacent assignments in the full
 *    canonical slot sequence, then batch Page Blocks through buildSlotModuleNodes.
 * 2. Keep feed entries as separate plan items.
 * 3. Merge and sort by sort_order so feeds stay interleaved with modules.
 *
 * Does not change assignments, slots, or DB data.
 */
export function buildSlotRenderPlan(
  entries: SlotEntry[],
  context: SlotModuleRenderContext = {},
): SlotRenderPlanItem[] {
  const feedItems: SlotRenderPlanItem[] = [];
  const featuredItems: SlotRenderPlanItem[] = [];
  const mediaSidebarItems: SlotRenderPlanItem[] = [];
  const mediaHubItems: SlotRenderPlanItem[] = [];
  const blocks: ResolvedPageBlock[] = [];
  // Product invariant: Hero is a fixed singleton rendered above this
  // composable-module plan. It never participates in Position ordering.
  const composableEntries = entries.filter((entry) => entry.kind !== "hero");
  const contactFormPairs = buildAdjacentContactFormPairs(composableEntries);

  for (const entry of composableEntries) {
    if (entry.kind === "feed") {
      if (!isFeedModuleRenderable(entry.module)) continue;
      feedItems.push({
        kind: "feed",
        moduleKind: "feed",
        key: `feed-${entry.assignmentId}`,
        assignmentId: entry.assignmentId,
        sortOrder: entry.sortOrder,
        module: entry.module,
      });
      continue;
    }

    if (entry.kind === "featured") {
      if (
        context.suppressFeaturedDuringSearch ||
        !isFeaturedModuleRenderable(entry.module)
      ) continue;
      featuredItems.push({
        kind: "featured",
        moduleKind: "featured",
        key: `featured-${entry.assignmentId}`,
        assignmentId: entry.assignmentId,
        sortOrder: entry.sortOrder,
        module: entry.module,
      });
      continue;
    }

    if (entry.kind === "media-sidebar") {
      mediaSidebarItems.push({
        kind: "media-sidebar",
        moduleKind: "media-sidebar",
        key: `media-sidebar-${entry.assignmentId}`,
        assignmentId: entry.assignmentId,
        sortOrder: entry.sortOrder,
        widget: entry.widget,
      });
      continue;
    }

    if (entry.kind === "media-hub") {
      if (!isMediaHubModuleRenderable(entry.module, {
        listingContext: context.listingContext,
      })) continue;
      mediaHubItems.push({
        kind: "media-hub",
        moduleKind: "media-hub",
        key: `media-hub-${entry.assignmentId}`,
        assignmentId: entry.assignmentId,
        sortOrder: entry.sortOrder,
        module: entry.module,
      });
      continue;
    }

    if (entry.kind === "block") {
      blocks.push(entry.block);
    }
  }

  const moduleItems: SlotRenderPlanItem[] = buildSlotModuleNodes(blocks, context, contactFormPairs).map((node) => ({
    kind: "module" as const,
    key: node.key,
    moduleKind: node.moduleKind,
    assignmentId: node.assignmentId,
    sortOrder: node.sortOrder,
    node: node.node,
  }));

  return [
    ...feedItems,
    ...featuredItems,
    ...mediaSidebarItems,
    ...mediaHubItems,
    ...moduleItems,
  ].sort(
    (left, right) => comparePageAssignmentOrder(left, right),
  );
}
