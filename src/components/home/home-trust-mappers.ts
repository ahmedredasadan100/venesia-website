import { mapAboutPrinciplesBlock } from "../modules/about-principles-mappers";
import type { AboutPrinciplesModuleContent } from "../modules/about-principles-mappers";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type HomeTrustItem = {
  title: string;
  text: string;
};

/**
 * Home trust CMS content — independent module identity (slug: home-trust),
 * reuses About Principles config shape. Rendered only by HomeTrustSection.
 */
export type HomeTrustContent = {
  eyebrow: string;
  title: string;
  description: string;
  items: HomeTrustItem[];
};

export function mapHomeTrustBlock(block: ResolvedPageBlock): HomeTrustContent {
  const mapped: AboutPrinciplesModuleContent = mapAboutPrinciplesBlock(block);

  return {
    eyebrow: mapped.eyebrow,
    title: mapped.title,
    description: mapped.description,
    items: mapped.items.map((item) => ({
      title: item.title,
      text: item.description,
    })),
  };
}
