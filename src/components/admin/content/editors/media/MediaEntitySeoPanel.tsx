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
} from "./media-content-config";

const MEDIA_SEO_FIELD_IDS = {
  seoTitle: "media-seo-title",
  seoDescription: "media-seo-description",
  focusKeyword: "media-focus-keyword",
  seoKeywords: "media-seo-keywords",
  canonicalUrl: "media-canonical-url",
  robotsSection: "media-seo-robots",
  robotsIndexListbox: "media-robots-index-listbox",
  robotsIndexFocusTarget: "media-robots-index",
  robotsFollowListbox: "media-robots-follow-listbox",
  robotsFollowFocusTarget: "media-robots-follow",
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
}: {
  contentType: MediaEditableContentType;
  values?: MediaEntitySeoValues | null;
}) {
  return (
    <AdminEntitySeoPanel
      id="media-entity-seo-panel"
      entityLabel={getContentTypeLabel(contentType)}
      publicPathPrefix={resolvePublicContentBasePath(contentType)}
      slugPlaceholder="content-slug"
      navigationEventName="admin-media-entity-seo-navigation"
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
          imageSection: "media-og-image",
          imageAlt: "media-og-image-alt",
        },
      }}
      initial={{
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
      }}
      correctionTargets={{
        "seo-title-length": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoTitle },
        "meta-description-length": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoDescription },
        "focus-keyword": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.focusKeyword },
        "keyword-title": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoTitle },
        "keyword-description": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoDescription },
        "keyword-content": { tabId: "content", targetId: "topic-content-markdown" },
        image: { tabId: "seo", targetId: "media-og-image" },
        "image-alt": { tabId: "seo", targetId: "media-og-image-alt" },
        slug: { tabId: "content", targetId: "topic-slug" },
        "seo-keywords": { tabId: "seo", targetId: MEDIA_SEO_FIELD_IDS.seoKeywords },
      }}
    />
  );
}
