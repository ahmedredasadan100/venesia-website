"use client";

import { type FaqItem } from "../../lib/admin/seo-score";
import AdminEntitySeoPanel, {
  type AdminEntitySeoAnalysisExtension,
  type AdminEntitySeoCorrectionTarget,
  type AdminEntitySeoFieldIds,
  type AdminEntitySeoFieldNames,
} from "./seo/AdminEntitySeoPanel";
import { ENTITY_SEO_FIELD_NAMES } from "../../lib/seo/entity-seo-types";
import { CONTENT_EDITOR_NAVIGATION_EVENT } from "./content/editors/content-editor-navigation";

type SeoPanelProps = {
  title: string;
  excerpt: string;
  slug: string;
  content: string;
  image: string;
  imageAlt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  focusKeyword: string;
  canonicalUrl: string;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  ogImage: string;
  ogImageAlt: string;
  faq?: FaqItem[];
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
};

type TopicSeoAnalysisState = {
  faq: FaqItem[];
};

const TOPIC_SEO_FIELD_NAMES = ENTITY_SEO_FIELD_NAMES satisfies AdminEntitySeoFieldNames;

const TOPIC_SEO_FIELD_IDS = {
  seoTitle: "content-seo-title",
  seoDescription: "content-seo-description",
  focusKeyword: "content-focus-keyword",
  seoKeywords: "content-seo-keywords",
  canonicalUrl: "content-canonical-url",
  robotsSection: "content-seo-overrides",
  robotsIndexListbox: "content-robots-index-listbox",
  robotsIndexFocusTarget: "content-robots-index",
  robotsFollowListbox: "content-robots-follow-listbox",
  robotsFollowFocusTarget: "content-robots-follow",
} satisfies AdminEntitySeoFieldIds;

const TOPIC_SEO_CORRECTION_TARGETS = {
  "seo-title-length": { tabId: "seo", targetId: "content-seo-title" },
  "meta-description-length": {
    tabId: "seo",
    targetId: "content-seo-description",
  },
  "focus-keyword": { tabId: "seo", targetId: "content-focus-keyword" },
  "keyword-title": { tabId: "seo", targetId: "content-seo-title" },
  "keyword-description": {
    tabId: "seo",
    targetId: "content-seo-description",
  },
  "keyword-content": { tabId: "basic", targetId: "topic-content-markdown" },
  "keyword-intro": { tabId: "basic", targetId: "topic-content-markdown" },
  image: { tabId: "seo", targetId: "content-og-image" },
  "image-alt": { tabId: "seo", targetId: "content-og-image-alt" },
  "image-alt-length": { tabId: "seo", targetId: "content-og-image-alt" },
  "keyword-alt": { tabId: "basic", targetId: "topic-image-alt" },
  "seo-keywords": { tabId: "seo", targetId: "content-seo-keywords" },
  slug: { tabId: "basic", targetId: "topic-slug" },
  "keyword-density": { tabId: "basic", targetId: "topic-content-markdown" },
  faq: { tabId: "faq", targetId: "topic-faq-editor" },
} satisfies Record<string, AdminEntitySeoCorrectionTarget>;

function readTopicFaq(form: HTMLFormElement, fallback: FaqItem[]) {
  const questions = Array.from(
    form.querySelectorAll<HTMLInputElement>('[name="faq_question"]'),
  );
  const answers = Array.from(
    form.querySelectorAll<HTMLTextAreaElement>('[name="faq_answer"]'),
  );
  if (!questions.length) return fallback;
  return questions
    .map((question, index) => ({
      question: question.value.trim(),
      answer: answers[index]?.value.trim() ?? "",
    }))
    .filter((item) => item.question || item.answer);
}

function createTopicAnalysisExtension(
  initialFaq: FaqItem[],
): AdminEntitySeoAnalysisExtension<TopicSeoAnalysisState> {
  return {
    initialState: { faq: initialFaq },
    readState: (form, initialState) => ({
      faq: readTopicFaq(form, initialState.faq),
    }),
    resolveFaq: (state) => state.faq,
  };
}

export default function SeoPanel(props: SeoPanelProps) {
  return (
    <AdminEntitySeoPanel
      id="seo-command-center"
      entityLabel="الموضوع"
      publicPathPrefix="/topics"
      slugPlaceholder="your-slug"
      navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}
      sourceFieldNames={{
        title: "title",
        description: "excerpt",
        content: "content",
        slug: "slug",
        image: "image",
        imageAlt: "image_alt",
      }}
      fieldNames={TOPIC_SEO_FIELD_NAMES}
      fieldIds={TOPIC_SEO_FIELD_IDS}
      social={{
        mediaBrowseFolder: "images/topics/seo",
        fieldIds: {
          imageSection: "content-og-image",
          imageAlt: "content-og-image-alt",
        },
      }}
      initial={{
        profile: "article",
        title: props.title,
        description: props.excerpt,
        content: props.content,
        slug: props.slug,
        image: props.image,
        imageAlt: props.imageAlt,
        seoTitle: props.seoTitle,
        seoDescription: props.seoDescription,
        seoKeywords: props.seoKeywords,
        focusKeyword: props.focusKeyword,
        canonicalUrl: props.canonicalUrl,
        robotsIndex: props.robotsIndex,
        robotsFollow: props.robotsFollow,
        ogImage: props.ogImage,
        ogImageAlt: props.ogImageAlt,
        faq: props.faq ?? [],
      }}
      correctionTargets={TOPIC_SEO_CORRECTION_TARGETS}
      controlledValues={
        props.controlledValues
          ? {
              title: props.controlledValues.title,
              description: props.controlledValues.excerpt,
              content: props.controlledValues.content,
              seoTitle: props.controlledValues.seoTitle,
              seoDescription: props.controlledValues.seoDescription,
              focusKeyword: props.controlledValues.focusKeyword,
            }
          : undefined
      }
      onControlledValueChange={props.onControlledValueChange}
      analysisExtension={createTopicAnalysisExtension(props.faq ?? [])}
    />
  );
}
