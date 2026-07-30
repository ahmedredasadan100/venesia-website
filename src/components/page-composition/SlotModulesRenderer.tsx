import { Fragment } from "react";

import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import { buildSlotModuleNodes } from "./slot-module-nodes";

export { buildSlotModuleNodes } from "./slot-module-nodes";
export type { SlotModuleNode, SlotModuleRenderContext } from "./slot-module-nodes";

type SlotModulesRendererProps = {
  blocks: ResolvedPageBlock[];
  homepageProjects?: HomepageProjectCard[];
};

export default function SlotModulesRenderer({ blocks, homepageProjects }: SlotModulesRendererProps) {
  const nodes = buildSlotModuleNodes(blocks, { homepageProjects });

  if (!nodes.length) return null;

  return (
    <>
      {nodes.map((entry) => (
        <Fragment key={entry.key}>{entry.node}</Fragment>
      ))}
    </>
  );
}
