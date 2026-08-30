import type { MediaEditableContentType } from "../admin/content/content-types";
import {
  publicContentSourceContentTypes,
  type PublicContentSource,
  type PublicContentSummary,
} from "../content/public-content-read/contract";
import {
  resolveContentItemDisplay,
  type ContentDisplayOptions,
  type PageBlockTextFormattingConfig,
} from "../page-blocks/configs";

export const FEATURED_SOURCE_KINDS = ["categories", "media-center"] as const;
export type FeaturedSourceKind = (typeof FEATURED_SOURCE_KINDS)[number];

export const FEATURED_SELECTION_MODES = [
  "automatic",
  "latest",
  "popular",
  "manual",
] as const;
export type FeaturedSelectionMode = (typeof FEATURED_SELECTION_MODES)[number];

export const FEATURED_SELECTION_LABELS_AR: Record<
  FeaturedSelectionMode,
  string
> = {
  automatic: "العناصر المميزة فقط",
  latest: "الأحدث",
  popular: "الأكثر قراءة",
  manual: "اختيار يدوي",
};

export const FEATURED_PRESENTATION_VARIANTS = [
  "hero",
  "editorial",
  "large-card",
  "three-cards",
  "list",
  "carousel",
  "single-carousel",
  "group-carousel",
] as const;
export type FeaturedPresentationVariant =
  (typeof FEATURED_PRESENTATION_VARIANTS)[number];

export const FEATURED_EDITOR_PRESENTATION_VARIANTS = [
  "hero",
  "editorial",
  "large-card",
  "three-cards",
  "list",
  "single-carousel",
  "group-carousel",
] as const satisfies readonly FeaturedPresentationVariant[];

export const FEATURED_PRESENTATION_LABELS_AR: Record<
  FeaturedPresentationVariant,
  string
> = {
  hero: "هيرو",
  editorial: "تحريري",
  "large-card": "بطاقة كبيرة",
  "three-cards": "3 بطاقات",
  list: "قائمة",
  carousel: "عرض شرائح كلاسيكي",
  "single-carousel": "خبر واحد متحرك",
  "group-carousel": "مجموعة متحركة",
};

export type FeaturedSource = PublicContentSource<MediaEditableContentType>;

export type FeaturedSelection =
  | { mode: "automatic" | "latest" | "popular" }
  | { mode: "manual"; topicIds: number[] };

export type FeaturedPresentation = PageBlockTextFormattingConfig & {
  variant: FeaturedPresentationVariant;
  eyebrow: string | null;
  title: string;
  description: string;
  ctaText: string;
};

export type FeaturedModuleConfig = {
  source: FeaturedSource;
  selection: FeaturedSelection;
  itemLimit: number;
  display: ContentDisplayOptions;
  presentation: FeaturedPresentation;
};

export type FeaturedModuleTemplateRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  config: Record<string, unknown> | null;
  sort_order: number;
};

export type ResolvedFeaturedModule = {
  assignmentId: number;
  templateId: number;
  sortOrder: number;
  source: FeaturedSource;
  selection: FeaturedSelection;
  display: ContentDisplayOptions;
  presentation: FeaturedPresentation;
  items: PublicContentSummary[];
};

export function resolveFeaturedItemDisplay(
  display: ContentDisplayOptions,
  item: PublicContentSummary,
): ContentDisplayOptions {
  return resolveContentItemDisplay(display, item.display, {
    title: item.title,
    image: item.image,
    category: item.category,
    series: item.series,
    excerpt: item.excerpt,
    date: item.date,
  });
}

export type FeaturedEditorItem = Pick<
  PublicContentSummary,
  "id" | "contentType" | "title" | "categorySlug" | "publishedAt"
>;

export type FeaturedEditorCategory = {
  id: number;
  slug: string;
  name: string;
  parentId: number | null;
  depth: number;
  scopeSlugs: string[];
};

export type FeaturedEditorOptions = {
  categories: FeaturedEditorCategory[];
  items: FeaturedEditorItem[];
};

export function featuredSourceContentTypes(
  source: FeaturedSource,
): ReturnType<typeof publicContentSourceContentTypes> {
  return publicContentSourceContentTypes(source);
}
