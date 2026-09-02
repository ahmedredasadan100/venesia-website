import { type ReactNode } from "react";

import type { ResolvedFeedModule } from "../../lib/feed-modules/types";
import type { ResolvedFeaturedModule } from "../../lib/featured-modules/contract";
import type { MediaHubModuleState } from "../../lib/media-hub-modules/types";
import type { MediaSidebarWidgetState } from "../../lib/media-sidebar-modules/types";
import type { SlotEntry } from "../../lib/page-blocks/page-composition-types";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import {
  buildSlotModuleNodes,
  type SlotModuleRenderContext,
} from "./slot-module-nodes";

/**
 * Explicit slot render plan items.
 *
 * - `feed` — standalone feed module (keeps its sort_order among blocks)
 * - `module` — output of buildSlotModuleNodes (may be a composite that already
 *   consumed peer blocks; peers never appear as separate module items)
 */
export type SlotRenderPlanItem =
  | {
      kind: "feed";
      key: string;
      assignmentId: number;
      sortOrder: number;
      module: ResolvedFeedModule;
    }
  | {
      kind: "media-sidebar";
      key: string;
      assignmentId: number;
      sortOrder: number;
      widget: MediaSidebarWidgetState;
    }
  | {
      kind: "featured";
      key: string;
      assignmentId: number;
      sortOrder: number;
      module: ResolvedFeaturedModule;
    }
  | {
      kind: "media-hub";
      key: string;
      assignmentId: number;
      sortOrder: number;
      module: MediaHubModuleState;
    }
  | {
      kind: "module";
      key: string;
      sortOrder: number;
      node: ReactNode;
    };

/**
 * Peer-composite relationships resolved inside `buildSlotModuleNodes`.
 * Kept here so PageSlotLayout does not invent ad-hoc pairing rules.
 *
 * Parent triggers the composite; peers are marked consumed and must not render twice.
 */
export const SLOT_COMPOSITE_RELATIONSHIPS = [
  {
    id: "contact-office-form",
    parentSlugs: ["contact-form-office", "contact-form"] as const,
    peerSlugs: ["contact-form-office", "contact-form"] as const,
    notes: "Either slug opens one ContactFormSection; missing peer renders half section.",
  },
] as const;

/**
 * Build an ordered render plan for one layout slot.
 *
 * Strategy:
 * 1. Collect all block entries and resolve composites via buildSlotModuleNodes
 *    (batching is required so peer lookup works).
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

  for (const entry of entries) {
    if (entry.kind === "feed") {
      feedItems.push({
        kind: "feed",
        key: `feed-${entry.assignmentId}`,
        assignmentId: entry.assignmentId,
        sortOrder: entry.sortOrder,
        module: entry.module,
      });
      continue;
    }

    if (entry.kind === "featured") {
      if (context.suppressFeaturedDuringSearch) continue;
      featuredItems.push({
        kind: "featured",
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
        key: `media-sidebar-${entry.assignmentId}`,
        assignmentId: entry.assignmentId,
        sortOrder: entry.sortOrder,
        widget: entry.widget,
      });
      continue;
    }

    if (entry.kind === "media-hub") {
      mediaHubItems.push({
        kind: "media-hub",
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

  const moduleItems: SlotRenderPlanItem[] = buildSlotModuleNodes(blocks, context).map((node) => ({
    kind: "module" as const,
    key: node.key,
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
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
  );
}
