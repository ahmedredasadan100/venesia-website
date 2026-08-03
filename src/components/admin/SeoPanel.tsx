"use client";

import {
  analyzeTopicSeo,
  type EntitySeoScoreInput,
  type FaqItem,
} from "../../lib/admin/seo-score";
import AdminEntitySeoPanel, {
  type AdminEntitySeoAnalysisExtension,
  type AdminEntitySeoCorrectionTarget,
  type AdminEntitySeoFieldIds,
  type AdminEntitySeoFieldNames,
} from "./seo/AdminEntitySeoPanel";
import { ENTITY_SEO_FIELD_NAMES } from "../../lib/seo/entity-seo-types";
import { TOPIC_EDITOR_NAVIGATION_EVENT } from "./content/editors/article/topic-editor-navigation";

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
};

type TopicSeoAnalysisState = {
  faq: FaqItem[];
};

const TOPIC_SEO_FIELD_NAMES = ENTITY_SEO_FIELD_NAMES satisfies AdminEntitySeoFieldNames;

const TOPIC_SEO_FIELD_IDS = {
  seoTitle: "topic-seo-title",
  seoDescription: "topic-seo-description",
  focusKeyword: "topic-focus-keyword",
  seoKeywords: "topic-seo-keywords",
  canonicalUrl: "topic-canonical-url",
  robotsSection: "topic-seo-overrides",
  robotsIndexListbox: "topic-robots-index-listbox",
  robotsIndexFocusTarget: "topic-robots-index",
  robotsFollowListbox: "topic-robots-follow-listbox",
  robotsFollowFocusTarget: "topic-robots-follow",
} satisfies AdminEntitySeoFieldIds;

const TOPIC_SEO_CORRECTION_TARGETS = {
  "seo-title-length": { tabId: "seo", targetId: "topic-seo-title" },
  "meta-description-length": {
    tabId: "seo",
    targetId: "topic-seo-description",
  },
  "focus-keyword": { tabId: "seo", targetId: "topic-focus-keyword" },
  "keyword-title": { tabId: "seo", targetId: "topic-seo-title" },
  "keyword-description": {
    tabId: "seo",
    targetId: "topic-seo-description",
  },
  "keyword-content": { tabId: "basic", targetId: "topic-content-markdown" },
  "keyword-intro": { tabId: "basic", targetId: "topic-content-markdown" },
  image: { tabId: "seo", targetId: "topic-og-image" },
  "image-alt": { tabId: "seo", targetId: "topic-og-image-alt" },
  "image-alt-length": { tabId: "seo", targetId: "topic-og-image-alt" },
  "keyword-alt": { tabId: "basic", targetId: "topic-image-alt" },
  "seo-keywords": { tabId: "seo", targetId: "topic-seo-keywords" },
  slug: { tabId: "basic", targetId: "topic-slug" },
  "keyword-density": { tabId: "basic", targetId: "topic-content-markdown" },
  faq: { tabId: "faq", targetId: "topic-faq-editor" },
} satisfies Record<string, AdminEntitySeoCorrectionTarget>;

const TOPIC_EXTENSION_ISSUE_IDS = new Set([
  "keyword-intro",
  "image-alt-length",
  "keyword-alt",
  "keyword-density",
]);

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
    analyze: (input: EntitySeoScoreInput, state) => {
      const topicAnalysis = analyzeTopicSeo({
        title: input.title,
        excerpt: input.description,
        slug: input.slug,
        content: input.content,
        image: input.image,
        imageAlt: input.imageAlt,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        seoKeywords: input.seoKeywords,
        focusKeyword: input.focusKeyword,
        faq: state.faq,
      });
      const extensionIssues = topicAnalysis.issues.seo.filter((issue) =>
        TOPIC_EXTENSION_ISSUE_IDS.has(issue.id ?? ""),
      );
      const faqIssue = topicAnalysis.issues.content.find(
        (issue) => issue.id === "faq",
      );

      return {
        score: topicAnalysis.seoScore,
        label: "تحليل SEO للموضوع",
        issues: faqIssue
          ? [...extensionIssues, faqIssue]
          : extensionIssues,
        issueOrder: [
          "seo-title-length",
          "meta-description-length",
          "focus-keyword",
          "keyword-title",
          "keyword-description",
          "keyword-intro",
          "keyword-content",
          "image",
          "image-alt",
          "image-alt-length",
          "keyword-alt",
          "seo-keywords",
          "slug",
          "keyword-density",
          "faq",
        ],
        metrics: [
          {
            id: "keyword-density",
            label: "كثافة الكلمة المفتاحية",
            value: input.focusKeyword.trim()
              ? `${topicAnalysis.keywordDensity}%`
              : "غير متاح",
          },
          {
            id: "faq-count",
            label: "أسئلة FAQ المكتملة",
            value: String(topicAnalysis.faqCount),
          },
        ],
      };
    },
  };
}

export default function SeoPanel(props: SeoPanelProps) {
  return (
    <AdminEntitySeoPanel
      id="seo-command-center"
      entityLabel="الموضوع"
      publicPathPrefix="/topics"
      slugPlaceholder="your-slug"
      navigationEventName={TOPIC_EDITOR_NAVIGATION_EVENT}
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
          imageSection: "topic-og-image",
          imageAlt: "topic-og-image-alt",
        },
      }}
      initial={{
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
      }}
      correctionTargets={TOPIC_SEO_CORRECTION_TARGETS}
      analysisExtension={createTopicAnalysisExtension(props.faq ?? [])}
    />
  );
}
