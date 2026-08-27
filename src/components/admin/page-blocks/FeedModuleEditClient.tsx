"use client";

import { useState } from "react";

import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../ui";
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
  ModuleEditorTabs,
  ModuleEditorVisibilityAlignRow,
} from "./ModuleEditorPresentation";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";
import type { FeedModuleConfig, TopicsFeedType } from "../../../lib/feed-modules/types";
import {
  FEED_MODULE_PRESENTATION_SUPPORT,
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
  const presentationSupport = FEED_MODULE_PRESENTATION_SUPPORT[feedType];
  const hasPresentationControls = Object.values(presentationSupport).some(Boolean);
  const eyebrowFormat = resolvePageBlockTextFormat(config.presentation, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config.presentation, "title", { bold: true });

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
                      <span className="text-xs font-semibold text-white/55">عدد النتائج</span>
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

                  {hasPresentationControls ? (
                    <AdminFormGrid columns={3}>
                      {presentationSupport.showImage ? (
                        <AdminFormSwitch
                          name="show_image"
                          label="عرض الصورة"
                          value="true"
                          uncheckedValue="false"
                          defaultChecked={config.presentation.showImage}
                          surface
                        />
                      ) : null}
                      {presentationSupport.showDate ? (
                        <AdminFormSwitch
                          name="show_date"
                          label="عرض التاريخ"
                          value="true"
                          uncheckedValue="false"
                          defaultChecked={config.presentation.showDate}
                          surface
                        />
                      ) : null}
                      {presentationSupport.showExcerpt ? (
                        <AdminFormSwitch
                          name="show_excerpt"
                          label="عرض الوصف"
                          value="true"
                          uncheckedValue="false"
                          defaultChecked={config.presentation.showExcerpt}
                          surface
                        />
                      ) : null}
                    </AdminFormGrid>
                  ) : null}

                  <AdminFormGrid>
                    {feedType === "series" ? (
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">نص رابط السلسلة</span>
                        <input name="link_text" defaultValue={config.presentation.linkText ?? ""} className={fieldClassName()} />
                      </label>
                    ) : null}
                  </AdminFormGrid>

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
