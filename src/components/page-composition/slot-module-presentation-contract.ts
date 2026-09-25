import type { ReactNode } from "react";

import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import type {
  ListingRenderContext,
  SlotEntry,
} from "../../lib/page-blocks/page-composition-types";
import type {
  PageBlockType,
  ResolvedPageBlock,
} from "../../lib/page-blocks/types";
import type { HomepageProjectCard } from "../../lib/projects/public-types";

export type SlotModuleNode = {
  key: string;
  moduleKind: PageBlockType;
  assignmentId: number;
  sortOrder: number;
  node: ReactNode;
};

export type SlotModuleRenderContext = {
  homepageProjects?: HomepageProjectCard[];
  breadcrumbCurrentLabel?: string;
  publicPath?: string;
  searchParams?: SearchPlatformSearchParams;
  listingContext?: ListingRenderContext;
  suppressFeaturedDuringSearch?: boolean;
};

/**
 * Shared Page Composition-to-Theme seam.
 *
 * The shared render plan owns ordering and module capability. A Theme may map
 * known branded templates to visual components through this one contract; it
 * must not create another assignment reader or Page Composition renderer.
 */
export type SlotModulePresentationContract = Readonly<{
  id: string;
  buildNodes(input: Readonly<{
    blocks: ResolvedPageBlock[];
    orderedEntries: SlotEntry[];
    context: SlotModuleRenderContext;
  }>): SlotModuleNode[];
}>;
