"use client";

import { useState } from "react";

import { AdminFormListboxSelect } from "../ui";
import FeedModuleFilterFields from "./FeedModuleFilterFields";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorTabs,
  ModuleEditorVisibilityAlignRow,
} from "./ModuleEditorPresentation";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";
import type { FeedModuleConfig, TopicsFeedType } from "../../../lib/feed-modules/types";
import {
  DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
  DEFAULT_FEED_CATEGORY_CARD_PRESENTATION,
  DEFAULT_FEED_SERIES_CARD_PRESENTATION,
  DEFAULT_FEED_SERIES_LINK_TEXT,
  FEED_MODULE_DISPLAY_FORMATTING_CAPABILITY,
  TOPICS_FEED_TYPE_LABELS_AR,
  TOPICS_FEED_TYPES,
} from "../../../lib/feed-modules/types";
import type { TopicFilterOptions } from "../../../lib/feed-modules/load-topic-filter-options";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { resolvePageBlockTextFormat } from "../../../lib/page-blocks/configs";

type FeedModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    feed_type: TopicsFeedType;
  };
  config: FeedModuleConfig;
  filterOptions: TopicFilterOptions;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function FeedModuleEditClient({
  block,
  config,
  filterOptions,
  assignmentContext,
  saved,
  updateAction,
}: FeedModuleEditClientProps) {
  const [feedType, setFeedType] = useState<TopicsFeedType>(block.feed_type);
  const displayCapability = FEED_MODULE_DISPLAY_FORMATTING_CAPABILITY.variants[feedType];
  const isArticleVariant = feedType === "latest" || feedType === "popular";
  const isCategoryVariant = feedType === "categories";
  const isSeriesVariant = feedType === "series";
  const eyebrowFormat = resolvePageBlockTextFormat(config.presentation, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config.presentation, "title", { bold: true });
  const articleCard =
    config.presentation.articleCard ?? DEFAULT_FEED_ARTICLE_CARD_PRESENTATION;
  const categoryCard =
    config.presentation.categoryCard ?? DEFAULT_FEED_CATEGORY_CARD_PRESENTATION;
  const seriesCard =
    config.presentation.seriesCard ?? DEFAULT_FEED_SERIES_CARD_PRESENTATION;

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="feed"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/feed"
        backLabel="الرجوع إلى موديولات المحتوى"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="slug" value={block.slug} />
        <input type="hidden" name="description" value={block.description ?? ""} />

        <ModuleEditorIdentitySection
          name={block.name}
          status={block.status}
          inputClassName={fieldClassName("h-11")}
        >
          <AdminFormListboxSelect
            name="feed_type"
            label="نوع موديول المحتوى"
            value={feedType}
            onChange={(nextFeedType) => {
              if (TOPICS_FEED_TYPES.includes(nextFeedType as TopicsFeedType)) {
                setFeedType(nextFeedType as TopicsFeedType);
              }
            }}
            options={TOPICS_FEED_TYPES.map((feedType) => ({
              value: feedType,
              label: TOPICS_FEED_TYPE_LABELS_AR[feedType],
            }))}
          />
        </ModuleEditorIdentitySection>

        <ModuleEditorTabs
          moduleKind="feed"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/feed" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="short-text" span={4}>
                      <ModuleEditorVisibilityAlignRow label={MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
                        <input
                          name="widget_title"
                          aria-label={MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr}
                          defaultValue={config.presentation.title}
                          required
                          className={fieldClassName()}
                        />
                      </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>

                    <ModuleEditorField nature="short-text" span={4}>
                      <ModuleEditorVisibilityAlignRow label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
                        <input name="eyebrow" aria-label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} defaultValue={config.presentation.eyebrow ?? ""} className={fieldClassName()} />
                      </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>

                    <ModuleEditorField nature="standard" span={4}><label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">عدد العناصر المعروضة</span>
                      <input
                        name="limit"
                        type="number"
                        min={1}
                        defaultValue={config.query.limit}
                        className={fieldClassName()}
                      />
                    </label></ModuleEditorField>
                  </ModuleEditorFieldGrid>

                  <FeedModuleFilterFields config={config} filterOptions={filterOptions} />

                  <div className="mt-6 space-y-3">
                    <ModuleEditorSectionHeading intent="settings">
                      تنسيق عناصر الـFeed
                    </ModuleEditorSectionHeading>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <ModuleEditorVisibilityAlignRow
                        label="الصورة"
                        className={"image" in displayCapability ? "" : "hidden"}
                        showName="show_image"
                        showDefault={config.presentation.showImage}
                        controlMode="visibility-only"
                      />

                      <ModuleEditorVisibilityAlignRow
                        label="عنوان الموضوع"
                        className={isArticleVariant ? "" : "hidden"}
                        showName="show_article_title"
                        boldName="article_title_bold"
                        alignmentName="article_title_alignment"
                        showDefault={articleCard.showTitle}
                        boldDefault={articleCard.titleBold}
                        alignmentDefault={articleCard.titleAlignment}
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="المقتطف"
                        className={isArticleVariant ? "" : "hidden"}
                        showName="show_article_excerpt"
                        boldName="article_excerpt_bold"
                        alignmentName="article_excerpt_alignment"
                        showDefault={articleCard.showExcerpt}
                        boldDefault={articleCard.excerptBold}
                        alignmentDefault={articleCard.excerptAlignment}
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="التاريخ"
                        className={isArticleVariant ? "" : "hidden"}
                        showName="show_article_date"
                        boldName="article_date_bold"
                        alignmentName="article_date_alignment"
                        showDefault={articleCard.showDate}
                        boldDefault={articleCard.dateBold}
                        alignmentDefault={articleCard.dateAlignment}
                      />

                      <ModuleEditorVisibilityAlignRow
                        label="اسم التصنيف"
                        className={isCategoryVariant ? "" : "hidden"}
                        showName="show_category"
                        boldName="category_bold"
                        alignmentName="category_alignment"
                        showDefault={categoryCard.showCategory}
                        boldDefault={categoryCard.categoryBold}
                        alignmentDefault={categoryCard.categoryAlignment}
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="عدد الموضوعات"
                        className={isCategoryVariant ? "" : "hidden"}
                        showName="show_count"
                        boldName="count_bold"
                        alignmentName="count_alignment"
                        showDefault={categoryCard.showCount}
                        boldDefault={categoryCard.countBold}
                        alignmentDefault={categoryCard.countAlignment}
                      />

                      <ModuleEditorVisibilityAlignRow
                        label="اسم السلسلة"
                        className={isSeriesVariant ? "" : "hidden"}
                        showName="show_series"
                        boldName="series_bold"
                        alignmentName="series_alignment"
                        showDefault={seriesCard.showSeries}
                        boldDefault={seriesCard.seriesBold}
                        alignmentDefault={seriesCard.seriesAlignment}
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="الوصف"
                        className={isSeriesVariant ? "self-start" : "hidden"}
                        showName="show_description"
                        boldName="description_bold"
                        alignmentName="description_alignment"
                        showDefault={seriesCard.showDescription}
                        boldDefault={seriesCard.descriptionBold}
                        alignmentDefault={seriesCard.descriptionAlignment}
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="زر عرض كل الموضوعات"
                        className={isSeriesVariant ? "" : "hidden"}
                        showName="show_details"
                        boldName="details_bold"
                        alignmentName="details_alignment"
                        showDefault={seriesCard.showDetails}
                        boldDefault={seriesCard.detailsBold}
                        alignmentDefault={seriesCard.detailsAlignment}
                      >
                        <input
                          name="link_text"
                          aria-label="نص زر عرض كل الموضوعات"
                          defaultValue={
                            config.presentation.linkText ??
                            DEFAULT_FEED_SERIES_LINK_TEXT
                          }
                          className={fieldClassName()}
                        />
                      </ModuleEditorVisibilityAlignRow>
                    </div>
                  </div>

                </ModuleEditorSection>
              ),
            },
            {
              id: "pages",
              content: <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} />,
            },
          ]}
        />

        <ModuleEditorSaveArea />
      </form>
    </div>
  );
}
