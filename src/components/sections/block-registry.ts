import type { ComponentType } from "react";
import type { ResolvedPageBlock } from "../../lib/page-blocks";
import CardsSection from "./CardsSection";
import ContentSection from "./ContentSection";
import CtaSection from "./CtaSection";

export type BlockRendererProps = {
  block: Extract<ResolvedPageBlock, { blockType: RenderableBlockType }>;
};

type RenderableBlockType = Exclude<ResolvedPageBlock["blockType"], "breadcrumb">;

const BLOCK_RENDERERS: Record<RenderableBlockType, ComponentType<BlockRendererProps>> = {
  content: ContentSection,
  cta: CtaSection,
  cards: CardsSection,
};

export { BLOCK_RENDERERS };
