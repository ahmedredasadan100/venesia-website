import type { ContentBlockConfig, CtaBlockConfig } from "../../lib/page-blocks";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export const KNOWN_TOPICS_SECTION_SLUGS = new Set(["topics-intro", "topics-insight-cta"]);

export type TopicsIntroContent = {
  eyebrow: string;
  title: string;
  description: string;
};

export type TopicsInsightCtaContent = {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
};

export function mapTopicsIntroBlock(block: ResolvedPageBlock): TopicsIntroContent {
  const config = block.template.config as ContentBlockConfig;

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.subtitle ?? config.body ?? "",
  };
}

export function mapTopicsInsightCtaBlock(block: ResolvedPageBlock): TopicsInsightCtaContent {
  const config = block.template.config as CtaBlockConfig;

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.description ?? "",
    buttonLabel: config.primaryCta?.label ?? "",
    buttonHref: config.primaryCta?.href ?? "/contact",
  };
}

export function indexTopicsBlocksBySlug(blocks: ResolvedPageBlock[]) {
  const bySlug = new Map<string, ResolvedPageBlock>();
  for (const block of blocks) {
    bySlug.set(block.template.slug, block);
  }
  return bySlug;
}
