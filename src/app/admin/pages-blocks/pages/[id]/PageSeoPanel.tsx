"use client";

import { AdminFormPendingFields } from "../../../../../components/admin/ui/AdminFormRuntime";

import { AdminFeedbackRegion } from "../../../../../components/admin/AdminFeedbackProvider";
import AdminEntitySeoPanel, {
  type AdminEntitySeoFieldIds,
  type AdminEntitySeoFieldNames,
} from "../../../../../components/admin/seo/AdminEntitySeoPanel";
import { ENTITY_SEO_FIELD_NAMES } from "../../../../../lib/seo/entity-seo-types";
import { savePageSeoAction } from "../page-seo-actions";
import { adminFormEditHref } from "../../../../../lib/admin/form-runtime";

const PAGE_SEO_FIELD_IDS = {
  seoTitle: "page-seo-title",
  seoDescription: "page-seo-description",
  focusKeyword: "page-focus-keyword",
  seoKeywords: "page-seo-keywords",
  canonicalUrl: "page-canonical-url",
  robotsSection: "page-seo-robots",
  robotsIndexListbox: "page-robots-index-listbox",
  robotsIndexFocusTarget: "page-robots-index",
  robotsFollowListbox: "page-robots-follow-listbox",
  robotsFollowFocusTarget: "page-robots-follow",
} satisfies AdminEntitySeoFieldIds;

type PageSeoPanelProps = {
  returnTo?: string;
  pageId: number;
  pageTitle: string;
  path: string;
  content: string;
  titleSuffix: string;
  resolvedFallback: {
    title: string;
    description: string;
    image: string;
    imageAlt: string;
  };
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  seoKeywords: string[];
  canonicalUrl: string;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  ogImage: string;
  ogImageAlt: string;
  notice?: string | null;
  error?: string | null;
};

export default function PageSeoPanel(props: PageSeoPanelProps) {
  const publicSlug = props.path === "/" ? "" : props.path.replace(/^\/+/, "");

  return (
    <section className="space-y-5" dir="rtl">
      <AdminFeedbackRegion
        channel={`page-seo:${props.pageId}`}
        label="نتيجة حفظ إعدادات السيو"
        feedback={
          props.error
            ? {
                variant: "danger",
                title: "تعذر حفظ السيو",
                message: props.error,
                layout: "inline",
                dismissible: true,
                lifecycle: "manual",
                dismissSearchParams: ["error"],
              }
            : props.notice === "saved"
              ? {
                  variant: "success",
                  title: "تم الحفظ",
                  message: "تم حفظ إعدادات السيو للصفحة.",
                  layout: "inline",
                  dismissible: true,
                  lifecycle: "manual",
                  dismissSearchParams: ["notice"],
                }
              : null
        }
      />

      <form
        action={savePageSeoAction}
        className="space-y-5"
      >
        <AdminFormPendingFields className="space-y-5">
          <input type="hidden" name="page_id" value={props.pageId} />
          <input type="hidden" name="redirect_to" value={adminFormEditHref(`/admin/pages-blocks/pages/${props.pageId}?tab=seo`, props.returnTo, "/admin/pages-blocks/pages")} />
          <input type="hidden" name="page_title" value={props.pageTitle} />
          <input type="hidden" name="page_description" value="" />
          <input type="hidden" name="page_content" value={props.content} />
          <input type="hidden" name="page_slug" value={publicSlug} />
          <input type="hidden" name="page_image" value="" />
          <input type="hidden" name="page_image_alt" value="" />

          <AdminEntitySeoPanel
            id="page-entity-seo-panel"
            entityLabel="الصفحة"
            publicPathPrefix=""
            slugPlaceholder=""
            navigationEventName="admin-page-blocks-navigation"
            sourceFieldNames={{
              title: "page_title",
              description: "page_description",
              content: "page_content",
              slug: "page_slug",
              image: "page_image",
              imageAlt: "page_image_alt",
            }}
            fieldNames={ENTITY_SEO_FIELD_NAMES satisfies AdminEntitySeoFieldNames}
            fieldIds={PAGE_SEO_FIELD_IDS}
            social={{
              mediaBrowseFolder: "images/pages/seo",
              fieldIds: {
                imageSection: "page-og-image",
                imageAlt: "page-og-image-alt",
              },
            }}
            seoTitleSuffix={props.titleSuffix}
            resolvedFallback={props.resolvedFallback}
            initial={{
              profile: "entity",
              title: props.pageTitle,
              description: "",
              content: props.content,
              slug: publicSlug,
              image: "",
              imageAlt: "",
              seoTitle: props.seoTitle,
              seoDescription: props.seoDescription,
              focusKeyword: props.focusKeyword,
              seoKeywords: props.seoKeywords,
              canonicalUrl: props.canonicalUrl,
              robotsIndex: props.robotsIndex,
              robotsFollow: props.robotsFollow,
              ogImage: props.ogImage,
              ogImageAlt: props.ogImageAlt,
              faq: [],
            }}
            correctionTargets={{
              "seo-title-length": { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.seoTitle },
              "meta-description-length": { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.seoDescription },
              "focus-keyword": { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.focusKeyword },
              "keyword-title": { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.seoTitle },
              "keyword-description": { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.seoDescription },
              image: { tabId: "seo", targetId: "page-og-image" },
              "image-alt": { tabId: "seo", targetId: "page-og-image-alt" },
              slug: { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.canonicalUrl },
              "seo-keywords": { tabId: "seo", targetId: PAGE_SEO_FIELD_IDS.seoKeywords },
            }}
          />

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-2xl bg-[#D8B87A] px-6 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              حفظ إعدادات السيو
            </button>
          </div>
        </AdminFormPendingFields>
      </form>
    </section>
  );
}
