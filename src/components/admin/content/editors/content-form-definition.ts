import type { AdminFormNavigationContract } from "../../../../lib/admin/form-runtime";
import type { ContentType } from "../../../../lib/admin/content/content-types";
import {
  getTopicFormDraftFieldNames,
  type TopicFormDraftFields,
} from "../../../../lib/admin/content/topic-revision";
import {
  isVideoProvider,
  type MediaTopicPayload,
} from "../../../../lib/admin/media-topic-payload";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "./content-editor-navigation";

type TopicFormDraftValues = {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_id?: number | null;
  series_id?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  seo_keywords?: unknown;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  is_popular?: boolean | null;
  date_label?: string | null;
  show_title_on_page?: boolean | null;
  show_image_on_page?: boolean | null;
  show_excerpt_on_page?: boolean | null;
  show_date_on_page?: boolean | null;
  show_category_on_page?: boolean | null;
  show_series_on_page?: boolean | null;
  show_intro_card_on_page?: boolean | null;
  show_faq_on_page?: boolean | null;
  show_faq_title_on_page?: boolean | null;
  faq?: unknown;
  media_payload?: MediaTopicPayload | null;
  media_project?: string | null;
};

/** Project the existing native field contract into each owner's initial props. */
export function applyTopicFormDraftFields<Value extends object>(
  values: Value,
  fields: TopicFormDraftFields | null | undefined,
  contentType: ContentType,
): Value & TopicFormDraftValues {
  if (!fields) return values;
  const restored: TopicFormDraftValues = {};
  const applicable = new Set(getTopicFormDraftFieldNames(contentType));
  const has = (name: string) => applicable.has(name) && Object.hasOwn(fields, name);
  const last = (name: string) => fields[name]?.at(-1) ?? "";
  const textFields = [
    "title", "slug", "excerpt", "content", "image", "image_alt",
    "seo_title", "seo_description", "focus_keyword", "canonical_url",
    "og_image", "og_image_alt", "status", "date_label", "media_project",
  ] as const;
  for (const name of textFields) {
    if (has(name)) restored[name] = last(name);
  }
  const booleanFields = [
    "is_featured", "is_popular", "show_title_on_page", "show_image_on_page",
    "show_excerpt_on_page", "show_date_on_page", "show_category_on_page",
    "show_series_on_page", "show_intro_card_on_page", "show_faq_on_page",
    "show_faq_title_on_page",
  ] as const;
  for (const name of booleanFields) {
    if (has(name)) restored[name] = ["on", "true"].includes(last(name));
  }
  for (const name of ["category_id", "series_id"] as const) {
    if (has(name)) restored[name] = last(name) ? Number(last(name)) : null;
  }
  for (const name of ["robots_index", "robots_follow"] as const) {
    if (has(name)) restored[name] = last(name) === "" ? null : last(name) === "true";
  }
  if (has("seo_keywords")) {
    restored.seo_keywords = last("seo_keywords").split(/[,;،؛]+/).map(value => value.trim()).filter(Boolean);
  }
  if (contentType === "article" && has("faq_question") && has("faq_answer")) {
    restored.faq = fields.faq_question.map((question, index) => ({
      question,
      answer: fields.faq_answer[index] ?? "",
    }));
  }
  const current = values as TopicFormDraftValues;
  if (contentType === "gallery" && has("gallery_image_url") && has("gallery_image_alt") && has("gallery_image_caption")) {
    restored.media_payload = {
      kind: "gallery",
      images: fields.gallery_image_url.map((url, index) => ({
        url,
        alt: fields.gallery_image_alt[index] ?? "",
        caption: fields.gallery_image_caption[index] ?? "",
      })),
    };
  }
  if (contentType === "video") {
    const previous = current.media_payload?.kind === "video" ? current.media_payload : null;
    const provider = has("video_provider") ? last("video_provider") : previous?.provider ?? "youtube";
    const startSeconds = has("video_start_seconds") ? Number(last("video_start_seconds")) : previous?.start_seconds;
    restored.media_payload = {
      kind: "video",
      provider: isVideoProvider(provider) ? provider : "youtube",
      video_url: has("video_url") ? last("video_url") : previous?.video_url ?? "",
      duration: has("video_duration") ? last("video_duration") : previous?.duration ?? null,
      thumbnail: has("video_thumbnail") ? last("video_thumbnail") : previous?.thumbnail ?? null,
      ...(Number.isFinite(startSeconds) && startSeconds! > 0 ? { start_seconds: startSeconds } : {}),
    };
  }
  return { ...values, ...restored };
}

/** The editable display date must never replace persisted publication metadata. */
export function getTopicDraftDisplayDate(
  fields: TopicFormDraftFields | null | undefined,
  publishedAt?: string | null,
) {
  if (publishedAt || !fields || !Object.hasOwn(fields, "published_at")) return undefined;
  return fields.published_at.at(-1) ?? "";
}

export const CONTENT_FORM_NAVIGATION: AdminFormNavigationContract = {
  eventName: CONTENT_EDITOR_NAVIGATION_EVENT,
  fields: {
    content_type: {
      tabId: "basic",
      targetId: "topic-content-type-popover-trigger",
    },
    title: { tabId: "basic", targetId: "content-title" },
    slug: { tabId: "basic", targetId: "topic-slug" },
    excerpt: { tabId: "basic", targetId: "content-excerpt" },
    category_id: { tabId: "basic", targetId: "content-category-listbox" },
    series_id: { tabId: "basic", targetId: "content-series-listbox" },
    content: { tabId: "basic", targetId: "topic-content-markdown" },
    image: { tabId: "basic", targetId: "content-image-field" },
    image_alt: { tabId: "basic", targetId: "topic-image-alt" },
    video_provider: { tabId: "video", targetId: "video-provider-option-youtube" },
    video_url: { tabId: "video", targetId: "video_url" },
    video_start_seconds: { tabId: "video", targetId: "video_start_seconds" },
    video_duration: { tabId: "video", targetId: "video_url" },
    video_thumbnail: {
      tabId: "video",
      targetId: "video_thumbnail_control",
    },
    gallery_image_url: {
      tabId: "gallery",
      targetId: "gallery_image_url",
    },
    gallery_image_alt: {
      tabId: "gallery",
      targetId: "gallery_image_alt",
    },
    gallery_image_caption: {
      tabId: "gallery",
      targetId: "gallery_image_url",
    },
    faq_question: { tabId: "faq", targetId: "topic-faq-editor" },
    faq_answer: { tabId: "faq", targetId: "topic-faq-editor" },
    seo_title: { tabId: "seo", targetId: "content-seo-title" },
    seo_description: {
      tabId: "seo",
      targetId: "content-seo-description",
    },
    focus_keyword: { tabId: "seo", targetId: "content-focus-keyword" },
    seo_keywords: { tabId: "seo", targetId: "content-seo-keywords" },
    canonical_url: { tabId: "seo", targetId: "content-canonical-url" },
    robots_index: { tabId: "seo", targetId: "content-robots-index" },
    robots_follow: { tabId: "seo", targetId: "content-robots-follow" },
    og_image: { tabId: "seo", targetId: "content-og-image" },
    og_image_alt: { tabId: "seo", targetId: "content-og-image-alt" },
    status: { tabId: "publish", targetId: "content-status" },
  },
};
