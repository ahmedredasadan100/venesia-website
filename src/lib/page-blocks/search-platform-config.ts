import {
  CONTENT_TYPES,
  isContentType,
  type ContentType,
} from "../admin/content/content-types";
import type { PageBlockTextAlignment } from "./configs";

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

export type SearchPlatformTextDisplay = {
  visible: boolean;
  bold: boolean;
  alignment: PageBlockTextAlignment;
};

export type SearchPlatformInterfaceDisplay = {
  title: SearchPlatformTextDisplay;
  description: SearchPlatformTextDisplay;
  helpText: SearchPlatformTextDisplay;
  searchAction: { visible: boolean };
  resultsTitle: SearchPlatformTextDisplay;
  emptyResults: {
    title: string;
    description: string;
  };
};

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
  interfaceDisplay: SearchPlatformInterfaceDisplay;
};

export const DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY: SearchPlatformInterfaceDisplay = {
  title: { visible: true, bold: true, alignment: "right" },
  description: { visible: true, bold: false, alignment: "right" },
  helpText: { visible: true, bold: false, alignment: "right" },
  searchAction: { visible: true },
  resultsTitle: { visible: true, bold: false, alignment: "right" },
  emptyResults: {
    title: "لا توجد نتائج مطابقة",
    description: "جرّب كلمة مختلفة أو خفّف الفلاتر الحالية.",
  },
};

export const DEFAULT_SEARCH_PLATFORM_CONFIG: SearchPlatformConfig = {
  title: "ابحث في محتوى فينيسيا",
  description:
    "اكتشف المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية من مكان واحد.",
  placeholder: "اكتب كلمة البحث...",
  helpText: "ابحث بالعنوان أو الملخص أو الرابط.",
  scope: "all",
  contentTypes: [...CONTENT_TYPES],
  resultLimit: 12,
  presentation: "full-grid",
  filters: ["content-type"],
  defaultSort: "newest",
  interfaceDisplay: DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY,
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

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function readAlignment(
  value: unknown,
  fallback: PageBlockTextAlignment,
): PageBlockTextAlignment {
  return value === "right" || value === "center" || value === "left"
    ? value
    : fallback;
}

function resolveTextDisplay(
  raw: unknown,
  fallback: SearchPlatformTextDisplay,
): SearchPlatformTextDisplay {
  const value = asRecord(raw);
  return {
    visible: readBoolean(value.visible, fallback.visible),
    bold: readBoolean(value.bold, fallback.bold),
    alignment: readAlignment(value.alignment, fallback.alignment),
  };
}

function buildTextDisplayFromFormData(
  formData: FormData,
  field: string,
  fallback: SearchPlatformTextDisplay,
): SearchPlatformTextDisplay {
  return {
    visible: readBoolean(formData.get(`show_${field}`), fallback.visible),
    bold: readBoolean(formData.get(`${field}_bold`), fallback.bold),
    alignment: readAlignment(
      formData.get(`${field}_alignment`),
      fallback.alignment,
    ),
  };
}

export function resolveSearchPlatformInterfaceDisplay(
  raw: unknown,
): SearchPlatformInterfaceDisplay {
  const value = asRecord(raw);
  const searchAction = asRecord(value.searchAction ?? value.search_action);
  const emptyResults = asRecord(value.emptyResults ?? value.empty_results);

  return {
    title: resolveTextDisplay(
      value.title,
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.title,
    ),
    description: resolveTextDisplay(
      value.description,
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.description,
    ),
    helpText: resolveTextDisplay(
      value.helpText ?? value.help_text,
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.helpText,
    ),
    searchAction: {
      visible: readBoolean(
        searchAction.visible,
        DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.searchAction.visible,
      ),
    },
    resultsTitle: resolveTextDisplay(
      value.resultsTitle ?? value.results_title,
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.resultsTitle,
    ),
    emptyResults: {
      title: cleanText(
        emptyResults.title,
        DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.emptyResults.title,
      ),
      description: cleanText(
        emptyResults.description,
        DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.emptyResults.description,
      ),
    },
  };
}

export function buildSearchPlatformInterfaceDisplayFromFormData(
  formData: FormData,
): SearchPlatformInterfaceDisplay {
  const emptyResultsTitle = String(
    formData.get("empty_results_title") ?? "",
  ).trim();
  const emptyResultsDescription = String(
    formData.get("empty_results_description") ?? "",
  ).trim();

  if (!emptyResultsTitle || !emptyResultsDescription) {
    throw new Error("أكمل عنوان ووصف حالة عدم وجود نتائج.");
  }

  return {
    title: buildTextDisplayFromFormData(
      formData,
      "search_title",
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.title,
    ),
    description: buildTextDisplayFromFormData(
      formData,
      "search_description",
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.description,
    ),
    helpText: buildTextDisplayFromFormData(
      formData,
      "search_help_text",
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.helpText,
    ),
    searchAction: {
      visible: readBoolean(
        formData.get("show_search_action"),
        DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.searchAction.visible,
      ),
    },
    resultsTitle: buildTextDisplayFromFormData(
      formData,
      "search_results_title",
      DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY.resultsTitle,
    ),
    emptyResults: {
      title: emptyResultsTitle,
      description: emptyResultsDescription,
    },
  };
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
  const interfaceDisplay = resolveSearchPlatformInterfaceDisplay(
    config.interfaceDisplay ?? config.interface_display,
  );

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
    interfaceDisplay,
  };
}

export function isSearchPlatformTemplate(
  slug: string | null | undefined,
  variant?: string | null,
) {
  return slug === SEARCH_PLATFORM_TEMPLATE_SLUG ||
    variant === SEARCH_PLATFORM_TEMPLATE_SLUG;
}
