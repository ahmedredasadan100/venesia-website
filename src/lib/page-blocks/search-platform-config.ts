import {
  CONTENT_TYPES,
  isContentType,
  type ContentType,
} from "../admin/content/content-types";

export const SEARCH_PLATFORM_TEMPLATE_SLUG = "search-platform";

export const SEARCH_PLATFORM_SCOPES = ["all", "selected"] as const;
export type SearchPlatformScope = (typeof SEARCH_PLATFORM_SCOPES)[number];

export const SEARCH_PLATFORM_PRESENTATIONS = [
  "compact",
  "full-list",
  "full-grid",
] as const;
export type SearchPlatformPresentation =
  (typeof SEARCH_PLATFORM_PRESENTATIONS)[number];

export const SEARCH_PLATFORM_FILTERS = [
  "content-type",
  "category",
  "series",
] as const;
export type SearchPlatformFilter = (typeof SEARCH_PLATFORM_FILTERS)[number];

export const SEARCH_PLATFORM_RESULT_LIMITS = [6, 9, 12, 24] as const;
export type SearchPlatformResultLimit =
  (typeof SEARCH_PLATFORM_RESULT_LIMITS)[number];

export type SearchPlatformConfig = {
  title: string;
  description: string;
  placeholder: string;
  helpText: string;
  scope: SearchPlatformScope;
  contentTypes: ContentType[];
  resultLimit: SearchPlatformResultLimit;
  presentation: SearchPlatformPresentation;
  filters: SearchPlatformFilter[];
  defaultSort: "newest" | "oldest";
};

export const DEFAULT_SEARCH_PLATFORM_CONFIG: SearchPlatformConfig = {
  title: "ابحث في محتوى فينيسيا",
  description:
    "اكتشف المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية من مكان واحد.",
  placeholder: "اكتب كلمة البحث...",
  helpText: "ابحث بالعنوان أو الملخص أو التصنيف أو السلسلة.",
  scope: "all",
  contentTypes: [...CONTENT_TYPES],
  resultLimit: 12,
  presentation: "full-grid",
  filters: [...SEARCH_PLATFORM_FILTERS],
  defaultSort: "newest",
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function asSearchPlatformConfig(raw: unknown): SearchPlatformConfig {
  const config = asRecord(raw);
  const scope = SEARCH_PLATFORM_SCOPES.includes(
    config.scope as SearchPlatformScope,
  )
    ? (config.scope as SearchPlatformScope)
    : DEFAULT_SEARCH_PLATFORM_CONFIG.scope;
  const configuredTypes = Array.isArray(config.contentTypes)
    ? config.contentTypes.filter(isContentType)
    : [];
  const contentTypes = scope === "all"
    ? [...CONTENT_TYPES]
    : configuredTypes.length
      ? [...new Set(configuredTypes)]
      : [...CONTENT_TYPES];
  const resultLimit = Number(config.resultLimit ?? config.result_limit);
  const presentation = SEARCH_PLATFORM_PRESENTATIONS.includes(
    config.presentation as SearchPlatformPresentation,
  )
    ? (config.presentation as SearchPlatformPresentation)
    : DEFAULT_SEARCH_PLATFORM_CONFIG.presentation;
  const filters = Array.isArray(config.filters)
    ? config.filters.filter((value): value is SearchPlatformFilter =>
        SEARCH_PLATFORM_FILTERS.includes(value as SearchPlatformFilter),
      )
    : DEFAULT_SEARCH_PLATFORM_CONFIG.filters;

  return {
    title: cleanText(config.title, DEFAULT_SEARCH_PLATFORM_CONFIG.title),
    description: cleanText(
      config.description,
      DEFAULT_SEARCH_PLATFORM_CONFIG.description,
    ),
    placeholder: cleanText(
      config.placeholder,
      DEFAULT_SEARCH_PLATFORM_CONFIG.placeholder,
    ),
    helpText: cleanText(
      config.helpText ?? config.help_text,
      DEFAULT_SEARCH_PLATFORM_CONFIG.helpText,
    ),
    scope,
    contentTypes,
    resultLimit: SEARCH_PLATFORM_RESULT_LIMITS.includes(
      resultLimit as SearchPlatformResultLimit,
    )
      ? (resultLimit as SearchPlatformResultLimit)
      : DEFAULT_SEARCH_PLATFORM_CONFIG.resultLimit,
    presentation,
    filters: [...new Set(filters)],
    defaultSort: config.defaultSort === "oldest" || config.default_sort === "oldest"
      ? "oldest"
      : "newest",
  };
}

export function isSearchPlatformTemplate(
  slug: string | null | undefined,
  variant?: string | null,
) {
  return slug === SEARCH_PLATFORM_TEMPLATE_SLUG ||
    variant === SEARCH_PLATFORM_TEMPLATE_SLUG;
}
