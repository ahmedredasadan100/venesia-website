import {
  buildCollectionContentHierarchy,
  parseCollectionContentHierarchy,
  type CollectionContentHierarchy,
  type CollectionContentHierarchyCapabilities,
  type CollectionContentHierarchyInput,
} from "../collection-modules/content-hierarchy";
import {
  buildCollectionView,
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
      layouts: ["list", "grid"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      defaults: { layout: "list", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  "site-updates": {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "uniform", secondaryItemCount: 4 },
    },
    view: {
      layouts: ["timeline", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      defaults: { layout: "timeline", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  videos: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "featured-first", secondaryItemCount: 3 },
    },
    view: {
      layouts: ["list", "grid"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      defaults: { layout: "list", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  gallery: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "featured-first", secondaryItemCount: 4 },
    },
    view: {
      layouts: ["grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      defaults: { layout: "grid", itemsPerRow: 2, cardVariant: "default" },
    },
  },
  press: {
    hierarchy: {
      modes: ["uniform", "featured-first"],
      defaults: { mode: "uniform", secondaryItemCount: 3 },
    },
    view: {
      layouts: ["carousel", "grid", "list"],
      itemsPerRow: [1, 2, 3, 4],
      cardVariants: ["default", "compact"],
      defaults: { layout: "carousel", itemsPerRow: 4, cardVariant: "default" },
    },
  },
};

export function getMediaHubCollectionCapabilities(
  sectionKey: MediaHubSectionKey,
) {
  return MEDIA_HUB_COLLECTION_CAPABILITIES[sectionKey];
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
