"use client";

import AdminModuleTabs from "./AdminModuleTabs";
import BlockEditorContextHeader from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import FeedModuleFilterFields from "./FeedModuleFilterFields";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { FeedModuleConfig } from "../../../lib/feed-modules/types";
import { TOPICS_FEED_TYPES } from "../../../lib/feed-modules/types";
import type { TopicFilterOptions } from "../../../lib/feed-modules/load-topic-filter-options";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";

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
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <BlockEditorContextHeader
        backHref="/admin/pages-blocks/blocks/feed"
        backLabel="الرجوع لكل Feed Modules"
        eyebrow="FEED MODULE"
        title={block.name}
        description="موديول Feed Widget لموضوعات تهمك — يجلب مقالات منشورة من Supabase."
        status={block.status}
        saved={saved}
        slotContext={getSlotCompatibilityLabel("feed")}
      />

      <ModuleCrossPageUsageBanner moduleName={block.name} assignments={assignmentContext.assignments} />
      <ModuleDependencyHintsPanel moduleKind="feed" templateSlug={block.slug} />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "إعدادات Feed",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Widget Title</span>
                    <input
                      name="widget_title"
                      defaultValue={config.presentation.title}
                      required
                      className={fieldClassName()}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Feed Type</span>
                    <select name="feed_type" defaultValue={block.feed_type} className={fieldClassName()}>
                      {TOPICS_FEED_TYPES.map((feedType) => (
                        <option key={feedType} value={feedType}>
                          {FEED_TYPE_LABELS[feedType] ?? feedType}
                        </option>
                      ))}
                    </select>
                  </label>

                  <FeedModuleFilterFields config={config} filterOptions={filterOptions} />

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Limit</span>
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      defaultValue={config.query.limit}
                      className={fieldClassName()}
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                      <span>Show Image</span>
                      <input type="checkbox" name="show_image" value="true" defaultChecked={config.presentation.showImage} />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                      <span>Show Date</span>
                      <input type="checkbox" name="show_date" value="true" defaultChecked={config.presentation.showDate} />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                      <span>Show Excerpt</span>
                      <input type="checkbox" name="show_excerpt" value="true" defaultChecked={config.presentation.showExcerpt} />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Eyebrow (Categories / Series)</span>
                      <input name="eyebrow" defaultValue={config.presentation.eyebrow ?? ""} className={fieldClassName()} />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Series Link Text</span>
                      <input name="link_text" defaultValue={config.presentation.linkText ?? ""} className={fieldClassName()} />
                    </label>
                  </div>

                  <p className="text-xs leading-6 text-white/42">
                    Empty Behavior: Hide — إذا لا توجد نتائج، لا يظهر الـ widget على الموقع.
                  </p>
                </section>
              ),
            },
            {
              id: "settings",
              label: "الإعدادات",
              content: (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">بيانات الموديول</h2>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">اسم الموديول (Admin)</span>
                      <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Slug</span>
                      <input name="slug" defaultValue={block.slug} required dir="ltr" className={fieldClassName()} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                      <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
                    </label>
                  </section>

                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">حالة النشر</h2>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">حالة الموديول</span>
                      <select name="status" defaultValue={block.status} className={fieldClassName()}>
                        <option value="draft">مسودة</option>
                        <option value="published">منشور</option>
                        <option value="unpublished">مخفي</option>
                        <option value="archived">أرشيف</option>
                      </select>
                    </label>
                    <p className="text-xs leading-6 text-white/42">
                      Slot و Sort Order و Visibility تُدار من Pages Manager لكل صفحة على حدة.
                    </p>
                  </section>
                </div>
              ),
            },
            {
              id: "pages",
              label: "يظهر في الصفحات",
              content: (
                <ModulePageAssignmentsField
                  pages={assignmentContext.pages}
                  assignedPageIds={assignedPageIds}
                />
              ),
            },
          ]}
        />

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            حفظ الموديول
          </button>
        </div>
      </form>
    </div>
  );
}
