import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import {
  HOME_MODULE_SLUGS,
  isHomeModuleSlug,
  resolveHomeModuleSlugFromTemplate,
  type HomeModuleSlug,
} from "../../lib/page-blocks/home-module-slugs";

/** Product-approved home main slot order — source of truth for fallback placement. */
export const HOME_MAIN_PLACEMENTS = HOME_MODULE_SLUGS.map((slug, index) => ({
  slug,
  sortOrder: (index + 1) * 10,
})) as ReadonlyArray<{ slug: HomeModuleSlug; sortOrder: number }>;

export type { HomeModuleSlug };

export function resolveHomeModuleSlug(block: ResolvedPageBlock): HomeModuleSlug | null {
  if (block.blockType !== "content") return null;
  return resolveHomeModuleSlugFromTemplate(block.template.slug, block.template.variant);
}

export { isHomeModuleSlug };
