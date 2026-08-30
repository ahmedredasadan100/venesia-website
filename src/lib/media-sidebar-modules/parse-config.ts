import {
  isMediaEditableContentType,
  type MediaEditableContentType,
} from "../admin/content/content-types";
import type {
  PublicContentSource,
  PublicContentSourceKind,
} from "../content/public-content-read/contract";
import type { Json } from "../database.types";
import {
  buildContentDisplayOptionsFromFormData,
  resolveContentDisplayOptions,
  type ContentDisplayOptions,
} from "../page-blocks/configs";
import type { MediaSidebarWidgetKey } from "./types";

export const MEDIA_SIDEBAR_ALL_MEDIA_CONTENT_TYPE = "all" as const;
export type MediaSidebarMediaContentType =
  | MediaEditableContentType
  | typeof MEDIA_SIDEBAR_ALL_MEDIA_CONTENT_TYPE;

export type MediaSidebarContentSource =
  PublicContentSource<MediaSidebarMediaContentType>;

export const MEDIA_SIDEBAR_PRESENTATIONS = [
  "list",
  "single-carousel",
  "group-carousel",
] as const;

export type MediaSidebarPresentation =
  (typeof MEDIA_SIDEBAR_PRESENTATIONS)[number];

export type MediaSidebarModuleConfig =
  | {
      source: "navigation";
      menuParent: string;
    }
  | {
      source: MediaSidebarContentSource;
      limit: number;
      presentation: MediaSidebarPresentation;
      display: ContentDisplayOptions;
    };

const DEFAULT_PRESENTATION: MediaSidebarPresentation = "list";

const LATEST_DISPLAY_DEFAULTS: ContentDisplayOptions = {
  title: true,
  image: true,
  category: false,
  series: false,
  excerpt: false,
  date: true,
};

const POPULAR_DISPLAY_DEFAULTS: ContentDisplayOptions = {
  title: true,
  image: true,
  category: true,
  series: true,
  excerpt: false,
  date: true,
};

export const MEDIA_SIDEBAR_WIDGET_DEFAULTS: Record<
  MediaSidebarWidgetKey,
  { config: MediaSidebarModuleConfig; defaultLimit?: number }
> = {
  sections: {
    config: { source: "navigation", menuParent: "/media-center" },
  },
  latest: {
    config: {
      source: { kind: "media-center", contentType: "news" },
      limit: 3,
      presentation: DEFAULT_PRESENTATION,
      display: LATEST_DISPLAY_DEFAULTS,
    },
    defaultLimit: 3,
  },
  popular: {
    config: {
      source: { kind: "media-center", contentType: "all" },
      limit: 4,
      presentation: DEFAULT_PRESENTATION,
      display: POPULAR_DISPLAY_DEFAULTS,
    },
    defaultLimit: 4,
  },
};

export function isMediaSidebarWidgetKey(
  value: string,
): value is MediaSidebarWidgetKey {
  return value === "sections" || value === "latest" || value === "popular";
}

export function parseMediaSidebarWidgetKey(
  value: string,
): MediaSidebarWidgetKey {
  if (isMediaSidebarWidgetKey(value)) return value;
  throw new Error("نوع الـ widget غير صالح.");
}

type MediaSidebarContentConfig = Extract<
  MediaSidebarModuleConfig,
  { source: MediaSidebarContentSource }
>;

function contentDefaults(
  widgetKey: Exclude<MediaSidebarWidgetKey, "sections">,
): MediaSidebarContentConfig {
  return MEDIA_SIDEBAR_WIDGET_DEFAULTS[widgetKey]
    .config as MediaSidebarContentConfig;
}

function parseContentSource(
  rawSource: Json | undefined,
  widgetKey: Exclude<MediaSidebarWidgetKey, "sections">,
): MediaSidebarContentSource {
  const fallback = contentDefaults(widgetKey).source;

  // Legacy rows stored only the internal provider name.
  if (rawSource === "topics") return fallback;
  if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
    return fallback;
  }

  if (rawSource.kind === "categories") {
    const categorySlug =
      typeof rawSource.categorySlug === "string"
        ? rawSource.categorySlug.trim()
        : "";
    return categorySlug ? { kind: "categories", categorySlug } : fallback;
  }

  if (rawSource.kind === "media-center") {
    const contentType =
      typeof rawSource.contentType === "string" ? rawSource.contentType : "";
    if (contentType === MEDIA_SIDEBAR_ALL_MEDIA_CONTENT_TYPE) {
      return { kind: "media-center", contentType };
    }
    if (isMediaEditableContentType(contentType)) {
      return { kind: "media-center", contentType };
    }
  }

  return fallback;
}

export function isMediaSidebarPresentation(
  value: unknown,
): value is MediaSidebarPresentation {
  return MEDIA_SIDEBAR_PRESENTATIONS.includes(
    value as MediaSidebarPresentation,
  );
}

function parsePresentation(value: Json | undefined): MediaSidebarPresentation {
  return isMediaSidebarPresentation(value) ? value : DEFAULT_PRESENTATION;
}

export function parseMediaSidebarModuleConfig(
  raw: Json,
  widgetKey: MediaSidebarWidgetKey,
): MediaSidebarModuleConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    if (widgetKey === "sections") {
      return { source: "navigation", menuParent: "/media-center" };
    }
    const defaults = contentDefaults(widgetKey);
    return {
      ...defaults,
      source: { ...defaults.source },
      presentation: defaults.presentation,
      display: { ...defaults.display },
    };
  }

  if (widgetKey === "sections") {
    return {
      source: "navigation",
      menuParent:
        typeof raw.menuParent === "string" && raw.menuParent.trim()
          ? raw.menuParent.trim()
          : "/media-center",
    };
  }

  const defaults = contentDefaults(widgetKey);
  const limit = Number(raw.limit);
  return {
    source: parseContentSource(raw.source, widgetKey),
    limit:
      Number.isFinite(limit) && limit > 0
        ? Math.min(60, Math.floor(limit))
        : defaults.limit,
    presentation: parsePresentation(raw.presentation),
    display: resolveContentDisplayOptions(raw.display, defaults.display),
  };
}

function readSourceKind(
  value: FormDataEntryValue | null,
): PublicContentSourceKind {
  return value === "categories" ? "categories" : "media-center";
}

export function buildMediaSidebarModuleConfig(
  widgetKey: MediaSidebarWidgetKey,
  formData: FormData,
): MediaSidebarModuleConfig {
  if (widgetKey === "sections") {
    return { source: "navigation", menuParent: "/media-center" };
  }

  const kind = readSourceKind(formData.get("source_kind"));
  let source: MediaSidebarContentSource;
  if (kind === "categories") {
    const categorySlug = String(formData.get("category_slug") ?? "").trim();
    if (!categorySlug) throw new Error("اختر تصنيفًا.");
    source = { kind, categorySlug };
  } else {
    const contentType = String(formData.get("content_type") ?? "").trim();
    if (
      contentType !== MEDIA_SIDEBAR_ALL_MEDIA_CONTENT_TYPE &&
      !isMediaEditableContentType(contentType)
    ) {
      throw new Error("اختر نوع محتوى صالحًا للمركز الإعلامي.");
    }
    source = { kind, contentType };
  }

  const limitText = String(formData.get("limit") ?? "").trim();
  const limit = Number(limitText);
  if (
    !/^\d+$/u.test(limitText) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 60
  ) {
    throw new Error("عدد العناصر يجب أن يكون بين 1 و60.");
  }

  const presentation = String(formData.get("presentation") ?? "").trim();
  if (!isMediaSidebarPresentation(presentation)) {
    throw new Error("اختر شكل عرض صالحًا.");
  }

  return {
    source,
    limit,
    presentation,
    display: buildContentDisplayOptionsFromFormData(formData, false),
  };
}

export function isPersistedMediaSidebarModuleConfigEqual(
  raw: Json,
  widgetKey: MediaSidebarWidgetKey,
  expected: MediaSidebarModuleConfig,
) {
  return (
    JSON.stringify(parseMediaSidebarModuleConfig(raw, widgetKey)) ===
    JSON.stringify(expected)
  );
}
