import { createElement } from "react";
import type { ResolvedPageBlock } from "../../lib/page-blocks";
import { BLOCK_RENDERERS } from "./block-registry";

type SectionRendererProps = {
  block: ResolvedPageBlock;
};

type RenderableBlockType = keyof typeof BLOCK_RENDERERS;

type RenderablePageBlock = Extract<ResolvedPageBlock, { blockType: RenderableBlockType }>;

function isRenderableBlock(block: ResolvedPageBlock): block is RenderablePageBlock {
  return block.blockType !== "breadcrumb" && block.blockType in BLOCK_RENDERERS;
}

export default function SectionRenderer({ block }: SectionRendererProps) {
  if (!isRenderableBlock(block)) return null;

  return createElement(BLOCK_RENDERERS[block.blockType], { block });
}
