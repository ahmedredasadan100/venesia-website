"use client";

import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import FeedModuleFilterFields from "./FeedModuleFilterFields";
import {
  MODULE_EDITOR_STATUS_OPTIONS,
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorSettingsComposition,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
} from "./ModuleEditorPresentation";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";
import type { FeedModuleConfig } from "../../../lib/feed-modules/types";
import { TOPICS_FEED_TYPES } from "../../../lib/feed-modules/types";
import type { TopicFilterOptions } from "../../../lib/feed-modules/load-topic-filter-options";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

type FeedModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    feed_type: string;
  };
  config: FeedModuleConfig;
  filterOptions: TopicFilterOptions;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const FEED_TYPE_LABELS: Record<string, string> = {
  latest: "Latest Topics",
  popular: "Popular Topics",
  categories: "Categories",
  series: "Series",
};

export default function FeedModuleEditClient({
  block,
  config,
  filterOptions,
  assignmentContext,
  saved,
  updateAction,
}: FeedModuleEditClientProps) {
  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="feed"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/feed"
        backLabel="الرجوع لكل Feed Modules"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />

        <ModuleEditorTabs
          moduleKind="feed"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/feed" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                  <ModuleEditorField nature="standard" span={4}><label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.internalModuleName.labelAr}</span>
                    <input
                      name="widget_title"
                      defaultValue={config.presentation.title}
                      required
                      className={fieldClassName()}
                    />
                  </label></ModuleEditorField>

                  <ModuleEditorField nature="standard" span={4}><AdminFormListboxSelect
                    name="feed_type"
                    label="Feed Type"
                    defaultValue={block.feed_type}
                    options={TOPICS_FEED_TYPES.map((feedType) => ({
                      value: feedType,
                      label: FEED_TYPE_LABELS[feedType] ?? feedType,
                    }))}
                  /></ModuleEditorField>

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

                  <AdminFormGrid columns={3}>
                    <AdminFormSwitch name="show_image" label="Show Image" value="true" defaultChecked={config.presentation.showImage} surface />
                    <AdminFormSwitch name="show_date" label="Show Date" value="true" defaultChecked={config.presentation.showDate} surface />
                    <AdminFormSwitch name="show_excerpt" label="Show Excerpt" value="true" defaultChecked={config.presentation.showExcerpt} surface />
                  </AdminFormGrid>

                  <AdminFormGrid>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} (التصنيفات / السلاسل)</span>
                      <input name="eyebrow" defaultValue={config.presentation.eyebrow ?? ""} className={fieldClassName()} />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Series Link Text</span>
                      <input name="link_text" defaultValue={config.presentation.linkText ?? ""} className={fieldClassName()} />
                    </label>
                  </AdminFormGrid>

                </ModuleEditorSection>
              ),
            },
            {
              id: "settings",
              content: (
                <ModuleEditorSettingsComposition
                  primary={
                  <ModuleEditorSection>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">اسم الموديول (Admin)</span>
                      <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                    </label>
                    <ModuleEditorTechnicalIdentity mode="editable" value={block.slug} inputClassName={fieldClassName()} />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                      <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
                    </label>
                  </ModuleEditorSection>
                  }

                  secondary={
                  <ModuleEditorSection>
                    <ModuleEditorSectionHeading intent="settings" className="text-lg">حالة النشر</ModuleEditorSectionHeading>
                    <AdminFormListboxSelect name="status" label="حالة الموديول" defaultValue={block.status} options={MODULE_EDITOR_STATUS_OPTIONS} />
                  </ModuleEditorSection>
                  }
                />
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
