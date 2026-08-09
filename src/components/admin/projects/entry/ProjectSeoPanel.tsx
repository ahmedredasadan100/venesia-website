"use client";

import AdminEntitySeoPanel, {
  type AdminEntitySeoFieldIds,
  type AdminEntitySeoFieldNames,
} from "../../seo/AdminEntitySeoPanel";
import {
  PROJECT_ENTRY_NAVIGATION_EVENT,
  type ProjectEntryRoot,
} from "../../../../lib/admin/projects/project-entry-contract";
import { ENTITY_SEO_FIELD_NAMES } from "../../../../lib/seo/entity-seo-types";

const PROJECT_SEO_FIELD_NAMES = ENTITY_SEO_FIELD_NAMES satisfies AdminEntitySeoFieldNames;

const PROJECT_SEO_FIELD_IDS = {
  seoTitle: "project-seo-title",
  seoDescription: "project-seo-description",
  focusKeyword: "project-focus-keyword",
  seoKeywords: "project-seo-keywords",
  canonicalUrl: "project-canonical-url",
  robotsSection: "project-seo-robots",
  robotsIndexListbox: "project-robots-index-listbox",
  robotsIndexFocusTarget: "project-robots-index",
  robotsFollowListbox: "project-robots-follow-listbox",
  robotsFollowFocusTarget: "project-robots-follow",
} satisfies AdminEntitySeoFieldIds;

export default function ProjectSeoPanel({ project }: { project: ProjectEntryRoot }) {
  return (
    <AdminEntitySeoPanel
      id="project-seo-panel"
      entityLabel="المشروع"
      publicPathPrefix="/projects"
      slugPlaceholder="project-slug"
      navigationEventName={PROJECT_ENTRY_NAVIGATION_EVENT}
      sourceFieldNames={{
        title: "arabic_name",
        description: "general_description",
        content: "overview_body",
        slug: "slug",
        image: "hero_image",
        imageAlt: "hero_image_alt",
      }}
      fieldNames={PROJECT_SEO_FIELD_NAMES}
      fieldIds={PROJECT_SEO_FIELD_IDS}
      social={{
        mediaBrowseFolder: "images/projects/seo",
        fieldIds: {
          imageSection: "project-og-image",
          imageAlt: "project-og-image-alt",
        },
      }}
      initial={{
        profile: "entity",
        title: project.arabic_name,
        description: project.general_description,
        content: project.overview_body,
        slug: project.slug,
        image: project.hero_image,
        imageAlt: project.hero_image_alt,
        seoTitle: project.seo_title,
        seoDescription: project.seo_description,
        seoKeywords: project.seo_keywords,
        focusKeyword: project.focus_keyword,
        canonicalUrl: project.canonical_url,
        robotsIndex: project.robots_index,
        robotsFollow: project.robots_follow,
        ogImage: project.og_image,
        ogImageAlt: project.og_image_alt,
        faq: [],
      }}
      correctionTargets={{
        "seo-title-length": { tabId: "seo", targetId: PROJECT_SEO_FIELD_IDS.seoTitle },
        "meta-description-length": { tabId: "seo", targetId: PROJECT_SEO_FIELD_IDS.seoDescription },
        "focus-keyword": { tabId: "seo", targetId: PROJECT_SEO_FIELD_IDS.focusKeyword },
        "keyword-title": { tabId: "seo", targetId: PROJECT_SEO_FIELD_IDS.seoTitle },
        "keyword-description": { tabId: "seo", targetId: PROJECT_SEO_FIELD_IDS.seoDescription },
        "keyword-content": { tabId: "overview", targetId: "overview_body-editor" },
        image: { tabId: "seo", targetId: "project-og-image" },
        "image-alt": { tabId: "seo", targetId: "project-og-image-alt" },
        slug: { tabId: "basic", targetId: "project-slug" },
        "seo-keywords": { tabId: "seo", targetId: PROJECT_SEO_FIELD_IDS.seoKeywords },
      }}
    />
  );
}
