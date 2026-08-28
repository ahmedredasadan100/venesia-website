import type { CtaBlockConfig } from "../../lib/page-blocks";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type TopicsInsightCtaContent = {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
};

export function mapTopicsInsightCtaBlock(
  block: ResolvedPageBlock,
): TopicsInsightCtaContent {
  const config = block.template.config as CtaBlockConfig;

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.description ?? "",
    buttonLabel: config.primaryCta?.label ?? "",
    buttonHref: config.primaryCta?.href ?? "/contact",
  };
}
