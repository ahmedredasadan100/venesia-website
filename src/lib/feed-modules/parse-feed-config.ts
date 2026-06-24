import type { FeedModuleConfig, FeedModulePresentation, FeedModuleQueryConfig } from "./types";
import { parseFormBoolean } from "../page-blocks/admin-utils";

const DEFAULT_PRESENTATION: FeedModulePresentation = {
  title: "",
  eyebrow: null,
  linkText: null,
  showImage: true,
  showDate: true,
  showExcerpt: false,
  emptyBehavior: "hide",
};

const DEFAULT_QUERY: FeedModuleQueryConfig = {
  limit: 3,
  categorySlug: null,
  seriesSlug: null,
};

function readOptionalSlug(value: unknown) {
  const slug = String(value ?? "").trim();
  return slug || null;
}

export function parseFeedModuleConfig(raw: Record<string, unknown> | null | undefined): FeedModuleConfig {
  const presentationRaw =
    raw?.presentation && typeof raw.presentation === "object"
      ? (raw.presentation as Record<string, unknown>)
      : {};
  const queryRaw =
    raw?.query && typeof raw.query === "object" ? (raw.query as Record<string, unknown>) : {};

  const limitValue = Number(queryRaw.limit ?? DEFAULT_QUERY.limit);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : DEFAULT_QUERY.limit;

  return {
    presentation: {
      title: String(presentationRaw.title ?? DEFAULT_PRESENTATION.title).trim(),
      eyebrow: String(presentationRaw.eyebrow ?? "").trim() || null,
      linkText: String(presentationRaw.linkText ?? "").trim() || null,
      showImage:
        presentationRaw.showImage === undefined ? DEFAULT_PRESENTATION.showImage : Boolean(presentationRaw.showImage),
      showDate:
        presentationRaw.showDate === undefined ? DEFAULT_PRESENTATION.showDate : Boolean(presentationRaw.showDate),
      showExcerpt:
        presentationRaw.showExcerpt === undefined
          ? DEFAULT_PRESENTATION.showExcerpt
          : Boolean(presentationRaw.showExcerpt),
      emptyBehavior: "hide",
    },
    query: {
      limit,
      categorySlug: readOptionalSlug(queryRaw.categorySlug),
      seriesSlug: readOptionalSlug(queryRaw.seriesSlug),
    },
  };
}

export function buildFeedModuleConfig(formData: FormData): FeedModuleConfig {
  const categorySlug = String(formData.get("category_slug") ?? "").trim();
  const seriesSlug = String(formData.get("series_slug") ?? "").trim();

  return {
    presentation: {
      title: String(formData.get("widget_title") ?? formData.get("name") ?? "").trim(),
      eyebrow: String(formData.get("eyebrow") ?? "").trim() || null,
      linkText: String(formData.get("link_text") ?? "").trim() || null,
      showImage: parseFormBoolean(formData, "show_image", true),
      showDate: parseFormBoolean(formData, "show_date", true),
      showExcerpt: parseFormBoolean(formData, "show_excerpt", false),
      emptyBehavior: "hide",
    },
    query: {
      limit: Math.max(1, Number(formData.get("limit") ?? 3) || 3),
      categorySlug: categorySlug && categorySlug !== "__all__" ? categorySlug : null,
      seriesSlug: seriesSlug && seriesSlug !== "__all__" ? seriesSlug : null,
    },
  };
}
