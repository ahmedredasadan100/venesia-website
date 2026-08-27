import type { Json } from "../database.types";
import type { MediaHubSectionKey } from "./types";
import {
  resolvePageBlockTextFormattingConfig,
  type PageBlockTextFormattingConfig,
} from "../page-blocks/configs";
import type { CollectionContentHierarchy } from "../collection-modules/content-hierarchy";
import type { CollectionView } from "../collection-modules/collection-view";
import { parseCollectionItemLimit } from "../collection-modules/item-limit";
import {
  buildMediaHubCollectionView,
  buildMediaHubContentHierarchy,
  getMediaHubCollectionCapabilities,
  parseMediaHubCollectionView,
  parseMediaHubContentHierarchy,
} from "./presentation-contract";

export type MediaHubMediaType = "news" | "site_update" | "video" | "gallery" | "press";

export type MediaHubModulePlacement = "hub" | "featured" | "listing";
export type MediaListingLayout = "grid" | "vertical";
export type MediaListingColumns = 1 | 2 | 3;
export type MediaListingCardVariant = "default" | "compact";

export type MediaListingPresentationConfig = {
  pageSize: number;
  layout: MediaListingLayout;
  columns: MediaListingColumns;
  paginationEnabled: boolean;
  cardVariant: MediaListingCardVariant;
  cardCtaText: string;
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

const LISTING_CTA_DEFAULTS: Record<
  MediaHubMediaType,
  Pick<MediaListingPresentationConfig, "cardCtaText">
> = {
  news: { cardCtaText: "قراءة الخبر" },
  press: { cardCtaText: "قراءة البيان" },
  site_update: { cardCtaText: "عرض التحديث" },
  video: { cardCtaText: "مشاهدة الفيديو" },
  gallery: { cardCtaText: "عرض الصور" },
};

export function getDefaultMediaListingPresentation(
  mediaType: MediaHubMediaType,
): MediaListingPresentationConfig {
  return {
    pageSize: 2,
    layout: "grid",
    columns: 2,
    paginationEnabled: true,
    cardVariant: "default",
    ...LISTING_CTA_DEFAULTS[mediaType],
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

function readLimit(value: Json | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
  mediaType: MediaHubMediaType,
): MediaListingPresentationConfig {
  const fallback = getDefaultMediaListingPresentation(mediaType);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const pageSize = Math.min(60, Math.max(1, Math.floor(readLimit(value.pageSize, fallback.pageSize))));
  const columns = value.columns === 1 || value.columns === 2 || value.columns === 3
    ? value.columns
    : fallback.columns;
  return {
    pageSize,
    layout: value.layout === "vertical" ? "vertical" : "grid",
    columns,
    paginationEnabled:
      typeof value.paginationEnabled === "boolean"
        ? value.paginationEnabled
        : fallback.paginationEnabled,
    cardVariant: value.cardVariant === "compact" ? "compact" : "default",
    cardCtaText:
      typeof value.cardCtaText === "string" && value.cardCtaText.trim()
        ? value.cardCtaText.trim()
        : fallback.cardCtaText,
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
  const presentation = readPresentation(
    raw.presentation,
    fallback.presentation,
    sectionKey,
  );
  const contentHierarchy = readContentHierarchy(raw, sectionKey);
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
      listing: readListingPresentation(raw.listing, configuredMediaType),
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
    pageSize: number;
    layout: string;
    columns: number;
    paginationEnabled: boolean;
    cardVariant: string;
    cardCtaText: string;
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
  const normalizedHierarchy = buildMediaHubContentHierarchy(
    sectionKey,
    contentHierarchy,
  );

  if (listingInput?.placement === "listing") {
    if (!isMediaHubMediaType(listingInput.mediaType)) {
      throw new Error("نوع محتوى القائمة غير صالح.");
    }
    const mediaType = listingInput.mediaType;
    const defaults = getDefaultMediaListingPresentation(mediaType);
    return {
      placement: "listing",
      source: "topics",
      type: mediaType,
      presentation: normalizedPresentation,
      listing: {
        pageSize: Math.min(60, Math.max(1, Math.floor(listingInput.pageSize || defaults.pageSize))),
        layout: listingInput.layout === "vertical" ? "vertical" : "grid",
        columns:
          listingInput.columns === 1 || listingInput.columns === 2 || listingInput.columns === 3
            ? listingInput.columns
            : defaults.columns,
        paginationEnabled: listingInput.paginationEnabled,
        cardVariant: listingInput.cardVariant === "compact" ? "compact" : "default",
        cardCtaText: listingInput.cardCtaText || defaults.cardCtaText,
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
