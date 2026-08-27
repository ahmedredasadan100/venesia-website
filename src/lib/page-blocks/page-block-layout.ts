import type { PageLayoutSlot, ResolvedPageBlock } from "./types";
import { PAGE_COMPOSITION_POSITIONS } from "../page-composition/positions";

function sortBlocks(a: ResolvedPageBlock, b: ResolvedPageBlock) {
  if (a.slot !== b.slot) {
    return PAGE_COMPOSITION_POSITIONS.indexOf(a.slot)
      - PAGE_COMPOSITION_POSITIONS.indexOf(b.slot);
  }
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.assignmentId - b.assignmentId;
}

export function groupPageBlocksBySlot(blocks: ResolvedPageBlock[]) {
  return blocks.reduce<Record<string, ResolvedPageBlock[]>>((groups, block) => {
    const key = block.slot;
    groups[key] = groups[key] ?? [];
    groups[key].push(block);
    return groups;
  }, {});
}

export function getPageBlocksForSlot(blocks: ResolvedPageBlock[], slot: PageLayoutSlot) {
  return blocks.filter((block) => block.slot === slot).sort(sortBlocks);
}

export function hasPageBlocks(blocks: ResolvedPageBlock[]) {
  return blocks.length > 0;
}

export function sortPageBlocks(blocks: ResolvedPageBlock[]) {
  return [...blocks].sort(sortBlocks);
}
