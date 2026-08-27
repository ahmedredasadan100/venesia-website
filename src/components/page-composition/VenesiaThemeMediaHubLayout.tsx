import type { ReactNode } from "react";

import MediaPageShell from "../media-center/MediaPageShell";
import VenisiaThemeMainLayout from "./VenesiaThemeMainLayout";
import {
  buildVenesiaThemeMainLayoutGroups,
} from "./venisia-theme-main-layout-plan";

const VENISIA_MEDIA_HUB_MAIN_LAYOUT_PATTERN = [
  "single-column",
  "two-content-columns",
] as const;

/**
 * Venisia Theme geometry for an ordered run of already-rendered Nodes.
 *
 * Module Presentation owns content selection, item count, featured behavior,
 * card variants, and internal grids before this boundary. The Theme sees only
 * opaque Nodes and applies width, columns, spacing, and responsive behavior.
 */
export function renderVenesiaThemeMediaHubNodes(
  nodes: readonly ReactNode[],
): ReactNode {
  const items = nodes.map((node, index) => ({
    key: `node-${index}`,
    value: node,
  }));
  const groups = buildVenesiaThemeMainLayoutGroups(
    items,
    VENISIA_MEDIA_HUB_MAIN_LAYOUT_PATTERN,
  );

  if (!groups.length) return null;

  return (
    <MediaPageShell>
      <section className="space-y-10 text-right text-white" dir="rtl">
        {groups.map((group) => (
          <VenisiaThemeMainLayout
            key={group.key}
            items={group.items.map((item) => ({
              key: item.key,
              node: item.value,
            }))}
            variant={group.variant}
          />
        ))}
      </section>
    </MediaPageShell>
  );
}
