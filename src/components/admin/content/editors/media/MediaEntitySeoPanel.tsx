"use client";

import { ENTITY_SEO_FIELD_NAMES } from "../../../../../lib/seo/entity-seo-types";
import { resolvePublicContentBasePath } from "../../../../../lib/content/public-content-path";
import AdminEntitySeoPanel, {
  type AdminEntitySeoFieldIds,
  type AdminEntitySeoFieldNames,
} from "../../../seo/AdminEntitySeoPanel";
import {
  getContentTypeLabel,
  type MediaEditableContentType,
} from "../../../../../lib/admin/content/content-types";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "../content-editor-navigation";

const MEDIA_SEO_FIELD_IDS = {
  seoTitle: "content-seo-title",
  seoDescription: "content-seo-description",
  focusKeyword: "content-focus-keyword",
  seoKeywords: "content-seo-keywords",
  canonicalUrl: "content-canonical-url",
  robotsSection: "content-seo-robots",
  robotsIndexListbox: "content-robots-index-listbox",
  robotsIndexFocusTarget: "content-robots-index",
  robotsFollowListbox: "content-robots-follow-listbox",
  robotsFollowFocusTarget: "content-robots-follow",
} satisfies AdminEntitySeoFieldIds;

export type MediaEntitySeoValues = {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  seo_keywords?: string[] | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
};

export default function MediaEntitySeoPanel({
  contentType,
  values,
  controlledValues,
  onControlledValueChange,
}: {
  contentType: MediaEditableContentType;
  values?: MediaEntitySeoValues | null;
  controlledValues?: {
    title: string;
    excerpt: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
    focusKeyword: string;
  };
  onControlledValueChange?: (
    field: "seoTitle" | "seoDescription" | "focusKeyword",
    value: string,
  ) => void;
}) {
  const bodyCorrectionTarget =
    contentType === "video"
      ? "video_url"
      : contentType === "gallery"
        ? "gallery-editor"
        : "topic-content-markdown";

  return (
    <AdminEntitySeoPanel
      id="media-entity-seo-panel"
      entityLabel={getContentTypeLabel(contentType)}
      publicPathPrefix={resolvePublicContentBasePath(contentType)}
      slugPlaceholder="content-slug"
      navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
      sourceFieldNames={{
        title: "title",
        description: "excerpt",
        content: "content",
        slug: "slug",
        image: "image",
        imageAlt: "image_alt",
      }}
      fieldNames={ENTITY_SEO_FIELD_NAMES satisfies AdminEntitySeoFieldNames}
      fieldIds={MEDIA_SEO_FIELD_IDS}
      social={{
        mediaBrowseFolder: "images/topics/seo",
        fieldIds: {
          imageSection: "content-og-image",
          imageAlt: "content-og-image-alt",
        },
      }}
      initial={{
        profile: "entity",
        title: values?.title ?? "",
        description: values?.excerpt ?? "",
        content: values?.content ?? "",
        slug: values?.slug ?? "",
        image: values?.image ?? "",
        imageAlt: values?.image_alt ?? "",
        seoTitle: values?.seo_title ?? "",
        seoDescription: values?.seo_description ?? "",
        focusKeyword: values?.focus_keyword ?? "",
        seoKeywords: Array.isArray(values?.seo_keywords) ? values.seo_keywords : [],
        canonicalUrl: values?.canonical_url ?? "",
        robotsIndex: values?.robots_index ?? null,
        robotsFollow: values?.robots_follow ?? null,
        ogImage: values?.og_image ?? "",
        ogImageAlt: values?.og_image_alt ?? "",
        faq: [],
      }}
      correctionTargets={{
        "seo-title-length": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoTitle },
        "meta-description-length": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoDescription },
        "focus-keyword": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.focusKeyword },
        "keyword-title": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoTitle },
        "keyword-description": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoDescription },
        "keyword-content": { tabId: "basic", targetId: bodyCorrectionTarget },
        image: { tabId: "seo", targetId: "content-og-image" },
        "image-alt": { tabId: "seo", targetId: "content-og-image-alt" },
        slug: { tabId: "basic", targetId: "topic-slug" },
        "seo-keywords": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoKeywords },
      }}
      controlledValues={
        controlledValues
          ? {
              title: controlledValues.title,
              description: controlledValues.excerpt,
              content: controlledValues.content,
              seoTitle: controlledValues.seoTitle,
              seoDescription: controlledValues.seoDescription,
              focusKeyword: controlledValues.focusKeyword,
            }
          : undefined
      }
      onControlledValueChange={onControlledValueChange}
    />
  );
}
