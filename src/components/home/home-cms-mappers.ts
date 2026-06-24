import type { AboutIntroContent } from "../about/about-cms-mappers";
import { mapAboutIntroBlock } from "../about/about-cms-mappers";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

/**
 * Home story CMS content — independent module identity (slug: home-story),
 * reuses About Intro config shape + optional button. Rendered only by HomeStorySection.
 */
export type HomeStoryContent = AboutIntroContent;

export function mapHomeStoryBlock(block: ResolvedPageBlock): HomeStoryContent {
  return mapAboutIntroBlock(block);
}
