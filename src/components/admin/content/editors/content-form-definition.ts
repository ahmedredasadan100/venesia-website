import type { AdminFormNavigationContract } from "../../../../lib/admin/form-runtime";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "./content-editor-navigation";

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
    video_url: { tabId: "basic", targetId: "video_url" },
    video_duration: { tabId: "basic", targetId: "video_duration" },
    video_thumbnail: {
      tabId: "basic",
      targetId: "video_thumbnail_control",
    },
    gallery_image_url: {
      tabId: "basic",
      targetId: "gallery_image_url",
    },
    gallery_image_alt: {
      tabId: "basic",
      targetId: "gallery_image_alt",
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
