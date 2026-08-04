import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import {
  resolveHomeModuleSlugFromTemplate,
  type HomeModuleSlug,
} from "../../lib/page-blocks/home-module-slugs";

export type { HomeModuleSlug };

export function resolveHomeModuleSlug(block: ResolvedPageBlock): HomeModuleSlug | null {
  if (block.blockType !== "content") return null;
  return resolveHomeModuleSlugFromTemplate(block.template.slug, block.template.variant);
}
