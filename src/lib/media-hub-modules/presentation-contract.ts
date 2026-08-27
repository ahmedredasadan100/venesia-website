import {
  buildCollectionContentHierarchy,
  parseCollectionContentHierarchy,
  type CollectionContentHierarchy,
  type CollectionContentHierarchyCapabilities,
  type CollectionContentHierarchyInput,
} from "../collection-modules/content-hierarchy";
import {
  buildCollectionView,
  getCollectionViewVariantCapabilities,
  parseCollectionView,
  type CollectionView,
  type CollectionViewCapabilities,
  type CollectionViewInput,
} from "../collection-modules/collection-view";
import type { MediaHubSectionKey } from "./types";

type MediaHubCollectionCapabilities = {
  hierarchy: CollectionContentHierarchyCapabilities;
  view: CollectionViewCapabilities;
};

const FEATURED_VARIANT = {
  itemsPerRow: true,
  cardVariant: true,
  contentHierarchyMode: "uniform",
} as const;

const EDITORIAL_VARIANT = {
  itemsPerRow: false,
  cardVariant: true,
  contentHierarchyMode: "featured-first",
} as const;

const MOSAIC_VARIANT = {
  itemsPerRow: false,
  cardVariant: false,
  contentHierarchyMode: "featured-first",
} as const;

const GRID_VARIANT = {
  itemsPerRow: true,
  cardVariant: true,
  contentHierarchyMode: "uniform",
} as const;

const LIST_VARIANT = {
  itemsPerRow: false,
  cardVariant: true,
  contentHierarchyMode: "uniform",
} as const;

const TIMELINE_VARIANT = {
  itemsPerRow: false,
  cardVariant: false,
  contentHierarchyMode: "uniform",
} as const;

export const MEDIA_HUB_COLLECTION_CAPABILITIES: Record<
  MediaHubSectionKey,
  MediaHubCollectionCapabilities
> = {
  featured: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "featured-first", secondaryItemCount: 3 },
    },
    view: {
      layouts: ["editorial", "featured", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      variants: {
        editorial: EDITORIAL_VARIANT,
        featured: FEATURED_VARIANT,
        grid: GRID_VARIANT,
        list: LIST_VARIANT,
      },
      defaults: { layout: "editorial", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  "site-updates": {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "uniform", secondaryItemCount: 4 },
    },
    view: {
      layouts: ["timeline", "timeline-digest", "editorial", "featured", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      variants: {
        timeline: TIMELINE_VARIANT,
        "timeline-digest": TIMELINE_VARIANT,
        editorial: EDITORIAL_VARIANT,
        featured: FEATURED_VARIANT,
        grid: GRID_VARIANT,
        list: LIST_VARIANT,
      },
      defaults: { layout: "timeline", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  videos: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "featured-first", secondaryItemCount: 3 },
    },
    view: {
      layouts: ["editorial", "mosaic", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      variants: {
        editorial: EDITORIAL_VARIANT,
        mosaic: MOSAIC_VARIANT,
        grid: GRID_VARIANT,
        list: LIST_VARIANT,
      },
      defaults: { layout: "editorial", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  gallery: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "featured-first", secondaryItemCount: 4 },
    },
    view: {
      layouts: ["mosaic", "editorial", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      variants: {
        mosaic: MOSAIC_VARIANT,
        editorial: EDITORIAL_VARIANT,
        grid: GRID_VARIANT,
        list: LIST_VARIANT,
      },
      defaults: { layout: "editorial", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  press: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "uniform", secondaryItemCount: 3 },
    },
    view: {
      layouts: ["featured", "editorial", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      variants: {
        featured: FEATURED_VARIANT,
        editorial: EDITORIAL_VARIANT,
        grid: GRID_VARIANT,
        list: LIST_VARIANT,
      },
      legacyLayoutAliases: { carousel: "featured" },
      defaults: { layout: "featured", itemsPerRow: 4, cardVariant: "default" },
    },
  },
};

export function getMediaHubCollectionCapabilities(
  sectionKey: MediaHubSectionKey,
) {
  return MEDIA_HUB_COLLECTION_CAPABILITIES[sectionKey];
}

export function getMediaHubPresentationVariantCapabilities(
  sectionKey: MediaHubSectionKey,
  layout: CollectionView["layout"],
) {
  return getCollectionViewVariantCapabilities(
    getMediaHubCollectionCapabilities(sectionKey).view,
    layout,
  );
}

export function parseMediaHubContentHierarchy(
  sectionKey: MediaHubSectionKey,
  value: unknown,
): CollectionContentHierarchy {
  return parseCollectionContentHierarchy(
    value,
    getMediaHubCollectionCapabilities(sectionKey).hierarchy,
  );
}

export function buildMediaHubContentHierarchy(
  sectionKey: MediaHubSectionKey,
  input: CollectionContentHierarchyInput,
) {
  return buildCollectionContentHierarchy(
    input,
    getMediaHubCollectionCapabilities(sectionKey).hierarchy,
  );
}

export function parseMediaHubCollectionView(
  sectionKey: MediaHubSectionKey,
  value: unknown,
): CollectionView {
  return parseCollectionView(
    value,
    getMediaHubCollectionCapabilities(sectionKey).view,
  );
}

export function buildMediaHubCollectionView(
  sectionKey: MediaHubSectionKey,
  input: CollectionViewInput,
) {
  return buildCollectionView(
    input,
    getMediaHubCollectionCapabilities(sectionKey).view,
  );
}
