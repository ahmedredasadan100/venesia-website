"use client";

import Link from "next/link";

import AdminModuleTabs from "./AdminModuleTabs";
import FeedModuleFilterFields from "./FeedModuleFilterFields";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import { fieldClassName, statusMeta } from "../../../lib/page-blocks/admin-utils";
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
  const status = statusMeta(block.status);
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/admin/pages-blocks/blocks/feed"
              className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#D8B87A]"
            >
              <span aria-hidden="true">→</span>
              الرجوع لكل Feed Modules
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Feed Module</p>
            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{block.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
              موديول Feed Widget لموضوعات تهمك — يخزّن إعدادات الاستعلام والعرض فقط. المقالات تُجلب دائمًا من Supabase.
            </p>
            {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الموديول بنجاح.</p> : null}
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              status.tone === "green"
                ? "bg-emerald-500/10 text-emerald-300"
                : status.tone === "gold"
                  ? "bg-[#D8B87A]/10 text-[#D8B87A]"
                  : "bg-white/10 text-white/45"
            }`}
          >
            {status.label}
          </span>
        </div>
      </section>

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
