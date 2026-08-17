import type { Json } from "../database.types";
import type { MediaHubSectionKey } from "./types";

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

export type MediaHubModulePresentation = {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
};

export type MediaHubModuleConfig = {
  placement: MediaHubModulePlacement;
  source: "topics";
  type?: MediaHubMediaType;
  featured?: boolean;
  limit?: number;
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
      featured: true,
      limit: 1,
      presentation: {
        eyebrow: "Featured Content",
        title: "المحتوى المميز",
        description: "",
        ctaText: "استكشف القسم",
      },
    },
    defaultLimit: 1,
  },
  "site-updates": {
    config: {
      placement: "hub",
      source: "topics",
      type: "site_update",
      limit: 4,
      presentation: {
        eyebrow: "Site Updates",
        title: "من أرض التنفيذ",
        description: "",
        ctaText: "استكشف القسم",
      },
    },
    defaultLimit: 4,
  },
  videos: {
    config: {
      placement: "hub",
      source: "topics",
      type: "video",
      limit: 4,
      presentation: {
        eyebrow: "Videos",
        title: "الفيديوهات",
        description: "",
        ctaText: "استكشف القسم",
      },
    },
    defaultLimit: 4,
  },
  gallery: {
    config: {
      placement: "hub",
      source: "topics",
      type: "gallery",
      limit: 8,
      presentation: {
        eyebrow: "Gallery",
        title: "معرض الصور",
        description: "",
        ctaText: "استكشف القسم",
      },
    },
    defaultLimit: 8,
  },
  press: {
    config: {
      placement: "hub",
      source: "topics",
      type: "press",
      limit: 6,
      presentation: {
        eyebrow: "Press Releases",
        title: "البيانات الصحفية",
        description: "",
        ctaText: "كل البيانات",
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
): MediaHubModulePresentation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback };
  }

  const readText = (key: keyof MediaHubModulePresentation) =>
    typeof value[key] === "string" ? value[key].trim() : fallback[key];

  return {
    eyebrow: readText("eyebrow"),
    title: readText("title"),
    description: readText("description"),
    ctaText: readText("ctaText"),
  };
}

export function parseMediaHubModuleConfig(
  raw: Json,
  sectionKey: MediaHubSectionKey,
): MediaHubModuleConfig {
  const fallback = MEDIA_HUB_SECTION_DEFAULTS[sectionKey].config;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };

  const source = raw.source === "topics" ? "topics" : fallback.source;
  const presentation = readPresentation(raw.presentation, fallback.presentation);
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
    return {
      placement,
      source,
      type: configuredMediaType,
      featured: true,
      limit: readLimit(raw.limit, fallback.limit ?? 1),
      presentation,
    };
  }

  return {
    placement,
    source,
    type: mediaTypeForSection(sectionKey),
    limit: readLimit(raw.limit, fallback.limit ?? MEDIA_HUB_SECTION_DEFAULTS[sectionKey].defaultLimit ?? 4),
    presentation,
  };
}

export function buildMediaHubModuleConfig(
  sectionKey: MediaHubSectionKey,
  dataSource: string,
  limits: { limit?: number },
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
      presentation,
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
      featured: true,
      limit: Math.max(1, limits.limit || defaults.defaultLimit || 1),
      presentation,
    };
  }

  const defaults = MEDIA_HUB_SECTION_DEFAULTS[sectionKey];
  return {
    placement: "hub",
    source: "topics",
    type: mediaTypeForSection(sectionKey),
    limit: Math.max(1, limits.limit || defaults.defaultLimit || 4),
    presentation,
  };
}
