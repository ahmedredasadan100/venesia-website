import { asAboutPrinciplesConfig } from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type HomeTrustItem = {
  title: string;
  text: string;
};

export type HomeTrustTextAlignment = "right" | "center" | "left";

/**
 * Home trust CMS content — independent module identity (slug: home-trust),
 * reuses About Principles config shape. Rendered only by HomeTrustSection.
 */
export type HomeTrustContent = {
  eyebrow: string;
  title: string;
  description: string;
  /** Plain-text eyebrow weight. Legacy default: false. */
  eyebrowBold: boolean;
  /** Eyebrow text alignment. Legacy default: right. */
  eyebrowAlignment: HomeTrustTextAlignment;
  /** Plain-text title weight. Legacy default: true (was font-bold). */
  titleBold: boolean;
  /** Title text alignment. Legacy default: right. */
  titleAlignment: HomeTrustTextAlignment;
  items: HomeTrustItem[];
};

function mapTextAlignment(value: unknown): HomeTrustTextAlignment {
  if (value === "right" || value === "left" || value === "center") return value;
  return "right";
}

export function mapHomeTrustBlock(block: ResolvedPageBlock): HomeTrustContent {
  const config = asAboutPrinciplesConfig(block.template.config);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.description ?? "",
    // Legacy eyebrow was not bold (`text-sm text-[#D8B87A]` without font-bold).
    eyebrowBold: config.eyebrowBold === true,
    eyebrowAlignment: mapTextAlignment(config.eyebrowAlignment),
    // Legacy title used `font-bold`.
    titleBold: config.titleBold !== false,
    titleAlignment: mapTextAlignment(config.titleAlignment),
    items: (config.items ?? [])
      .map((item) => ({
        title: item.title ?? "",
        text: item.description ?? "",
      }))
      .filter((item) => item.title.trim() || item.text.trim()),
  };
}
