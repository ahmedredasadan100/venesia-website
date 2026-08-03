import type { AdminFormNavigationContract } from "../../../../../lib/admin/form-runtime";
import { TOPIC_EDITOR_NAVIGATION_EVENT } from "./topic-editor-navigation";

export const TOPIC_FORM_NAVIGATION: AdminFormNavigationContract = {
  eventName: TOPIC_EDITOR_NAVIGATION_EVENT,
  fields: {
    title: { tabId: "basic", targetId: "topic-title" },
    slug: { tabId: "basic", targetId: "topic-slug" },
    excerpt: { tabId: "basic", targetId: "topic-excerpt" },
    category_slug: { tabId: "basic", targetId: "topic-category-listbox" },
    series_id: { tabId: "basic", targetId: "topic-series-listbox" },
    content: { tabId: "basic", targetId: "topic-content-markdown" },
    image: { tabId: "basic", targetId: "topic-image-field" },
    image_alt: { tabId: "basic", targetId: "topic-image-alt" },
    faq_question: { tabId: "faq", targetId: "topic-faq-editor" },
    faq_answer: { tabId: "faq", targetId: "topic-faq-editor" },
    seo_title: { tabId: "seo", targetId: "topic-seo-title" },
    seo_description: {
      tabId: "seo",
      targetId: "topic-seo-description",
    },
    focus_keyword: { tabId: "seo", targetId: "topic-focus-keyword" },
    seo_keywords: { tabId: "seo", targetId: "topic-seo-keywords" },
    canonical_url: { tabId: "seo", targetId: "topic-canonical-url" },
    robots_index: { tabId: "seo", targetId: "topic-robots-index" },
    robots_follow: { tabId: "seo", targetId: "topic-robots-follow" },
    og_image: { tabId: "seo", targetId: "topic-og-image" },
    og_image_alt: { tabId: "seo", targetId: "topic-og-image-alt" },
    is_published: { tabId: "publish", targetId: "topic-published-switch" },
    published_at: { tabId: "publish", targetId: "topic-published-at" },
  },
};
