import type { Json } from "../database.types";
import type { MediaHubSectionKey } from "./types";
import {
  DEFAULT_COLLECTION_DETAILS_ACTION,
  resolveCollectionDetailsAction,
  resolvePageBlockTextFormattingConfig,
  type CollectionDisplayOverrides,
  type PageBlockTextFormattingConfig,
} from "../page-blocks/configs";
import type { CollectionContentHierarchy } from "../collection-modules/content-hierarchy";
import {
  COLLECTION_LISTING_ITEMS_PER_ROW,
  COLLECTION_LISTING_LAYOUTS,
  type CollectionListingItemsPerRow,
  type CollectionListingLayout,
  type CollectionView,
} from "../collection-modules/collection-view";
import {
  COLLECTION_LISTING_ITEM_LIMITS,
  parseCollectionItemLimit,
  type CollectionListingItemLimit,
} from "../collection-modules/item-limit";
import {
  buildMediaHubCollectionView,
  buildMediaHubContentHierarchy,
  getMediaHubCollectionCapabilities,
  getMediaHubPresentationVariantCapabilities,
  parseMediaHubCollectionView,
  parseMediaHubContentHierarchy,
} from "./presentation-contract";

export type MediaHubMediaType = "news" | "site_update" | "video" | "gallery" | "press";

export type MediaHubModulePlacement = "hub" | "featured" | "listing";
export type MediaListingLayout = CollectionListingLayout;
export type MediaListingColumns = CollectionListingItemsPerRow;

export type MediaListingPresentationConfig = {
  itemLimit: CollectionListingItemLimit;
  presentation: MediaListingLayout;
  itemsPerRow: MediaListingColumns;
  display: CollectionDisplayOverrides;
};

export type MediaHubModulePresentation = PageBlockTextFormattingConfig & {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  collectionView: CollectionView;
};

export type MediaHubModuleConfig = {
  placement: MediaHubModulePlacement;
  source: "topics";
  type?: MediaHubMediaType;
  itemLimit?: number;
  contentHierarchy?: CollectionContentHierarchy;
  listing?: MediaListingPresentationConfig;
  presentation: MediaHubModulePresentation;
};

const MEDIA_HUB_MEDIA_TYPES: readonly MediaHubMediaType[] = [
  "news",
  "site_update",
  "video",
  "gallery",
  "press",
];

export function getDefaultMediaListingPresentation(): MediaListingPresentationConfig {
  return {
    itemLimit: 6,
    presentation: "list",
    itemsPerRow: 3,
    display: {
      title: true,
      image: true,
      excerpt: true,
      date: true,
      category: true,
      series: true,
      details: DEFAULT_COLLECTION_DETAILS_ACTION,
    },
  };
}

export const MEDIA_HUB_SECTION_DEFAULTS: Record<
  MediaHubSectionKey,
  {
    config: MediaHubModuleConfig;
    defaultLimit?: number;
  }
> = {
  featured: {
    config: {
      placement: "hub",
      source: "topics",
      type: "news",
      itemLimit: 4,
      contentHierarchy:
        getMediaHubCollectionCapabilities("featured").hierarchy.defaults,
      presentation: {
        eyebrow: "Latest News",
        title: "آخر الأخبار",
        description: "",
        ctaText: "استكشف الأخبار",
        collectionView:
          getMediaHubCollectionCapabilities("featured").view.defaults,
      },
    },
    defaultLimit: 4,
  },
  "site-updates": {
    config: {
      placement: "hub",
      source: "topics",
      type: "site_update",
      itemLimit: 4,
      contentHierarchy:
        getMediaHubCollectionCapabilities("site-updates").hierarchy.defaults,
      presentation: {
        eyebrow: "Site Updates",
        title: "من أرض التنفيذ",
        description: "",
        ctaText: "استكشف القسم",
        collectionView:
          getMediaHubCollectionCapabilities("site-updates").view.defaults,
      },
    },
    defaultLimit: 4,
  },
  videos: {
    config: {
      placement: "hub",
      source: "topics",
      type: "video",
      itemLimit: 4,
      contentHierarchy:
        getMediaHubCollectionCapabilities("videos").hierarchy.defaults,
      presentation: {
        eyebrow: "Videos",
        title: "الفيديوهات",
        description: "",
        ctaText: "استكشف القسم",
        collectionView:
          getMediaHubCollectionCapabilities("videos").view.defaults,
      },
    },
    defaultLimit: 4,
  },
  gallery: {
    config: {
      placement: "hub",
      source: "topics",
      type: "gallery",
      itemLimit: 8,
      contentHierarchy:
        getMediaHubCollectionCapabilities("gallery").hierarchy.defaults,
      presentation: {
        eyebrow: "Gallery",
        title: "معرض الصور",
        description: "",
        ctaText: "استكشف القسم",
        collectionView:
          getMediaHubCollectionCapabilities("gallery").view.defaults,
      },
    },
    defaultLimit: 8,
  },
  press: {
    config: {
      placement: "hub",
      source: "topics",
      type: "press",
      itemLimit: 6,
      contentHierarchy:
        getMediaHubCollectionCapabilities("press").hierarchy.defaults,
      presentation: {
        eyebrow: "Press Releases",
        title: "البيانات الصحفية",
        description: "",
        ctaText: "كل البيانات",
        collectionView:
          getMediaHubCollectionCapabilities("press").view.defaults,
      },
    },
    defaultLimit: 6,
  },
};

export function isMediaHubSectionKey(value: string): value is MediaHubSectionKey {
  return value in MEDIA_HUB_SECTION_DEFAULTS;
}

export function parseMediaHubSectionKey(value: string): MediaHubSectionKey {
  if (isMediaHubSectionKey(value)) return value;
  throw new Error("نوع السكشن غير صالح.");
}

function readBoolean(value: Json | undefined, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function isMediaHubMediaType(value: Json | undefined): value is MediaHubMediaType {
  return typeof value === "string" && MEDIA_HUB_MEDIA_TYPES.includes(value as MediaHubMediaType);
}

function mediaTypeForSection(sectionKey: MediaHubSectionKey): MediaHubMediaType {
  if (sectionKey === "featured") return "news";
  if (sectionKey === "videos") return "video";
  return sectionKey === "site-updates" ? "site_update" : sectionKey;
}

function readListingPresentation(
  value: Json | undefined,
): MediaListingPresentationConfig {
  const fallback = getDefaultMediaListingPresentation();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const rawItemLimit = Number(value.itemLimit ?? value.pageSize);
  const itemLimit = COLLECTION_LISTING_ITEM_LIMITS.includes(
    rawItemLimit as CollectionListingItemLimit,
  )
    ? (rawItemLimit as CollectionListingItemLimit)
    : fallback.itemLimit;
  const rawPresentation = value.presentation ?? value.layout;
  const normalizedPresentation = rawPresentation === "vertical"
    ? "list"
    : rawPresentation;
  const presentation = COLLECTION_LISTING_LAYOUTS.includes(
    normalizedPresentation as CollectionListingLayout,
  )
    ? (normalizedPresentation as CollectionListingLayout)
    : fallback.presentation;
  const rawItemsPerRow = Number(value.itemsPerRow ?? value.columns);
  const itemsPerRow = COLLECTION_LISTING_ITEMS_PER_ROW.includes(
    rawItemsPerRow as CollectionListingItemsPerRow,
  )
    ? (rawItemsPerRow as CollectionListingItemsPerRow)
    : fallback.itemsPerRow;
  const rawDisplay = value.display && typeof value.display === "object" && !Array.isArray(value.display)
    ? value.display
    : {};
  const legacyDetailsText = typeof value.cardCtaText === "string"
    ? value.cardCtaText
    : undefined;
  const details = resolveCollectionDetailsAction(
    rawDisplay.details ?? (legacyDetailsText ? { text: legacyDetailsText } : undefined),
  );
  return {
    itemLimit,
    presentation,
    itemsPerRow,
    display: {
      title: readBoolean(rawDisplay.title, fallback.display.title),
      image: readBoolean(rawDisplay.image, fallback.display.image),
      excerpt: readBoolean(rawDisplay.excerpt, fallback.display.excerpt),
      date: readBoolean(rawDisplay.date, fallback.display.date),
      category: readBoolean(rawDisplay.category, fallback.display.category),
      series: readBoolean(rawDisplay.series, fallback.display.series),
      details,
    },
  };
}

function readPresentation(
  value: Json | undefined,
  fallback: MediaHubModulePresentation,
  sectionKey: MediaHubSectionKey,
): MediaHubModulePresentation {
  const valueRecord =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : undefined;
  const legacyCollectionView =
    valueRecord?.collection &&
    typeof valueRecord.collection === "object" &&
    !Array.isArray(valueRecord.collection)
      ? {
          layout: valueRecord.collection.layoutVariant,
          itemsPerRow: valueRecord.collection.itemsPerRow,
          cardVariant: valueRecord.collection.cardVariant,
        }
      : undefined;
  const collectionView = parseMediaHubCollectionView(
    sectionKey,
    valueRecord?.collectionView ?? legacyCollectionView,
  );

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback, collectionView };
  }

  const readText = (key: "eyebrow" | "title" | "description" | "ctaText") =>
    typeof value[key] === "string" ? value[key].trim() : fallback[key];

  return {
    ...resolvePageBlockTextFormattingConfig(value, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
    eyebrow: readText("eyebrow"),
    title: readText("title"),
    description: readText("description"),
    ctaText: readText("ctaText"),
    collectionView,
  };
}

function hasPersistedCollectionCapabilities(
  raw: Record<string, Json | undefined>,
) {
  return Boolean(
    raw.itemLimit != null ||
      (raw.contentHierarchy &&
        typeof raw.contentHierarchy === "object" &&
        !Array.isArray(raw.contentHierarchy)) ||
      (raw.presentation &&
        typeof raw.presentation === "object" &&
        !Array.isArray(raw.presentation) &&
        raw.presentation.collectionView &&
        typeof raw.presentation.collectionView === "object" &&
        !Array.isArray(raw.presentation.collectionView)),
  );
}

function readContentHierarchy(
  raw: Record<string, Json | undefined>,
  sectionKey: MediaHubSectionKey,
) {
  if (
    raw.contentHierarchy &&
    typeof raw.contentHierarchy === "object" &&
    !Array.isArray(raw.contentHierarchy)
  ) {
    return parseMediaHubContentHierarchy(sectionKey, raw.contentHierarchy);
  }

  return parseMediaHubContentHierarchy(sectionKey, {
    mode: raw.featured === true ? "featured-first" : undefined,
    secondaryItemCount: raw.sideLimit,
  });
}

function readPersistedCollectionLayout(
  raw: Record<string, Json | undefined>,
): unknown {
  if (
    !raw.presentation ||
    typeof raw.presentation !== "object" ||
    Array.isArray(raw.presentation)
  ) return undefined;

  const collectionView = raw.presentation.collectionView;
  if (collectionView && typeof collectionView === "object" && !Array.isArray(collectionView)) {
    return collectionView.layout;
  }

  const legacyCollection = raw.presentation.collection;
  if (legacyCollection && typeof legacyCollection === "object" && !Array.isArray(legacyCollection)) {
    return legacyCollection.layoutVariant;
  }

  return undefined;
}

function resolveAuthoritativePresentation(
  raw: Record<string, Json | undefined>,
  sectionKey: MediaHubSectionKey,
  presentation: MediaHubModulePresentation,
  contentHierarchy: CollectionContentHierarchy,
) {
  const persistedLayout = readPersistedCollectionLayout(raw);
  const hasCanonicalHierarchyVariant =
    persistedLayout === "featured" ||
    persistedLayout === "editorial" ||
    persistedLayout === "mosaic" ||
    persistedLayout === "timeline-digest";
  const layout =
    !hasCanonicalHierarchyVariant && contentHierarchy.mode === "featured-first"
      ? "editorial"
      : presentation.collectionView.layout;
  const collectionView = buildMediaHubCollectionView(sectionKey, {
    ...presentation.collectionView,
    layout,
  });
  const variantCapabilities = getMediaHubPresentationVariantCapabilities(
    sectionKey,
    collectionView.layout,
  );

  return {
    presentation: { ...presentation, collectionView },
    contentHierarchy: buildMediaHubContentHierarchy(sectionKey, {
      mode: variantCapabilities.contentHierarchyMode,
      secondaryItemCount: contentHierarchy.secondaryItemCount,
    }),
  };
}

export function parseMediaHubModuleConfig(
  raw: Json,
  sectionKey: MediaHubSectionKey,
): MediaHubModuleConfig {
  const fallback = MEDIA_HUB_SECTION_DEFAULTS[sectionKey].config;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ...fallback,
      contentHierarchy: fallback.contentHierarchy
        ? { ...fallback.contentHierarchy }
        : undefined,
      presentation: {
        ...fallback.presentation,
        collectionView: { ...fallback.presentation.collectionView },
      },
    };
  }

  const source = raw.source === "topics" ? "topics" : fallback.source;
  const parsedPresentation = readPresentation(
    raw.presentation,
    fallback.presentation,
    sectionKey,
  );
  const parsedContentHierarchy = readContentHierarchy(raw, sectionKey);
  const { presentation, contentHierarchy } = resolveAuthoritativePresentation(
    raw,
    sectionKey,
    parsedPresentation,
    parsedContentHierarchy,
  );
  const placement = raw.placement === "listing"
    ? "listing"
    : raw.placement === "featured" && sectionKey === "featured"
      ? "featured"
      : "hub";
  const configuredMediaType = isMediaHubMediaType(raw.type)
    ? raw.type
    : mediaTypeForSection(sectionKey);

  if (placement === "listing") {
    return {
      placement,
      source,
      type: configuredMediaType,
      presentation,
      listing: readListingPresentation(raw.listing),
    };
  }

  if (sectionKey === "featured") {
    const itemLimit = hasPersistedCollectionCapabilities(raw)
      ? parseCollectionItemLimit(raw.itemLimit, fallback.itemLimit ?? 4)
      : parseCollectionItemLimit(raw.listLimit, fallback.itemLimit ?? 4);
    return {
      placement,
      source,
      type: configuredMediaType,
      itemLimit,
      contentHierarchy,
      presentation,
    };
  }

  return {
    placement,
    source,
    type: mediaTypeForSection(sectionKey),
    itemLimit: parseCollectionItemLimit(
      raw.itemLimit ?? raw.limit,
      fallback.itemLimit ?? MEDIA_HUB_SECTION_DEFAULTS[sectionKey].defaultLimit ?? 4,
    ),
    contentHierarchy,
    presentation,
  };
}

export function buildMediaHubModuleConfig(
  sectionKey: MediaHubSectionKey,
  dataSource: string,
  itemLimit: number,
  contentHierarchy: CollectionContentHierarchy,
  presentation: MediaHubModulePresentation,
  listingInput?: {
    placement: MediaHubModulePlacement;
    mediaType: string;
    itemLimit: number;
    presentation: string;
    itemsPerRow: number;
    display?: CollectionDisplayOverrides;
  },
): MediaHubModuleConfig {
  if (dataSource !== "topics") {
    throw new Error("مصدر البيانات غير مدعوم حاليًا.");
  }

  const normalizedPresentation: MediaHubModulePresentation = {
    ...presentation,
    collectionView: buildMediaHubCollectionView(
      sectionKey,
      presentation.collectionView,
    ),
  };
  const variantCapabilities = getMediaHubPresentationVariantCapabilities(
    sectionKey,
    normalizedPresentation.collectionView.layout,
  );
  const normalizedHierarchy = buildMediaHubContentHierarchy(
    sectionKey,
    {
      mode: variantCapabilities.contentHierarchyMode,
      secondaryItemCount: contentHierarchy.secondaryItemCount,
    },
  );

  if (listingInput?.placement === "listing") {
    if (!isMediaHubMediaType(listingInput.mediaType)) {
      throw new Error("نوع محتوى القائمة غير صالح.");
    }
    const mediaType = listingInput.mediaType;
    const defaults = getDefaultMediaListingPresentation();
    return {
      placement: "listing",
      source: "topics",
      type: mediaType,
      presentation: normalizedPresentation,
      listing: {
        itemLimit: COLLECTION_LISTING_ITEM_LIMITS.includes(
          listingInput.itemLimit as CollectionListingItemLimit,
        )
          ? (listingInput.itemLimit as CollectionListingItemLimit)
          : defaults.itemLimit,
        presentation: COLLECTION_LISTING_LAYOUTS.includes(
          listingInput.presentation as CollectionListingLayout,
        )
          ? (listingInput.presentation as CollectionListingLayout)
          : defaults.presentation,
        itemsPerRow: COLLECTION_LISTING_ITEMS_PER_ROW.includes(
          listingInput.itemsPerRow as CollectionListingItemsPerRow,
        )
          ? (listingInput.itemsPerRow as CollectionListingItemsPerRow)
          : defaults.itemsPerRow,
        display: listingInput.display ?? defaults.display,
      },
    };
  }

  if (sectionKey === "featured") {
    const defaults = MEDIA_HUB_SECTION_DEFAULTS.featured;
    if (!listingInput || !isMediaHubMediaType(listingInput.mediaType)) {
      throw new Error("نوع المحتوى المميز غير صالح.");
    }
    return {
      placement: listingInput.placement === "featured" ? "featured" : "hub",
      source: "topics",
      type: listingInput.mediaType,
      itemLimit: parseCollectionItemLimit(
        itemLimit,
        defaults.defaultLimit || 4,
      ),
      contentHierarchy: normalizedHierarchy,
      presentation: normalizedPresentation,
    };
  }

  const defaults = MEDIA_HUB_SECTION_DEFAULTS[sectionKey];
  return {
    placement: "hub",
    source: "topics",
    type: mediaTypeForSection(sectionKey),
    itemLimit: parseCollectionItemLimit(
      itemLimit,
      defaults.defaultLimit || 4,
    ),
    contentHierarchy: normalizedHierarchy,
    presentation: normalizedPresentation,
  };
}
