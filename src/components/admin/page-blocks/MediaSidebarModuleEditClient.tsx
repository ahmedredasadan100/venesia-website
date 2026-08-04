"use client";

import { useMemo, useState } from "react";

import AdminModuleTabs from "../ui/AdminModuleTabs";
import BlockEditorContextHeader, { BlockEditorSaveFeedback } from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import {
  getMediaSidebarModuleSummary,
  MEDIA_SIDEBAR_WIDGET_LABELS,
} from "../../../lib/media-sidebar-modules/admin-present";
import {
  MEDIA_SIDEBAR_WIDGET_DEFAULTS,
  parseMediaSidebarModuleConfig,
} from "../../../lib/media-sidebar-modules/parse-config";
import type { MediaSidebarWidgetKey } from "../../../lib/media-sidebar-modules/types";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";

type MediaSidebarModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    widget_key: string;
    config: Record<string, unknown>;
  };
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const WIDGET_KEYS = Object.keys(MEDIA_SIDEBAR_WIDGET_LABELS) as MediaSidebarWidgetKey[];

function readInitialWidgetKey(value: string): MediaSidebarWidgetKey {
  return value === "sections" || value === "latest" || value === "popular" ? value : "latest";
}

function readInitialDataSource(widgetKey: MediaSidebarWidgetKey, config: Record<string, unknown>) {
  const parsed = parseMediaSidebarModuleConfig(config, widgetKey);
  return parsed.source;
}

function readInitialLimit(widgetKey: MediaSidebarWidgetKey, config: Record<string, unknown>) {
  const parsed = parseMediaSidebarModuleConfig(config, widgetKey);
  return typeof parsed.limit === "number" ? parsed.limit : MEDIA_SIDEBAR_WIDGET_DEFAULTS[widgetKey].defaultLimit ?? "";
}

export default function MediaSidebarModuleEditClient({
  block,
  assignmentContext,
  saved,
  updateAction,
}: MediaSidebarModuleEditClientProps) {
  const initialWidgetKey = readInitialWidgetKey(block.widget_key);
  const initialConfig = block.config ?? {};

  const [widgetKey, setWidgetKey] = useState<MediaSidebarWidgetKey>(initialWidgetKey);
  const [dataSource, setDataSource] = useState<"navigation" | "topics">(
    readInitialDataSource(initialWidgetKey, initialConfig),
  );
  const [limit, setLimit] = useState<number | "">(readInitialLimit(initialWidgetKey, initialConfig));

  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);
  const summary = useMemo(
    () => getMediaSidebarModuleSummary(widgetKey, block.description),
    [widgetKey, block.description],
  );

  const dataSourceOptions = useMemo(() => {
    if (widgetKey === "sections") {
      return [{ value: "navigation", label: "navigation / menu — قائمة التنقل" }];
    }

    if (widgetKey === "latest") {
      return [{ value: "topics", label: "topics — type: news" }];
    }

    return [{ value: "topics", label: "topics — isPopular: true" }];
  }, [widgetKey]);

  function handleWidgetChange(nextWidgetKey: MediaSidebarWidgetKey) {
    setWidgetKey(nextWidgetKey);
    setDataSource(MEDIA_SIDEBAR_WIDGET_DEFAULTS[nextWidgetKey].config.source);
    setLimit(MEDIA_SIDEBAR_WIDGET_DEFAULTS[nextWidgetKey].defaultLimit ?? "");
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <BlockEditorContextHeader
        backHref="/admin/pages-blocks/blocks/media-sidebar"
        backLabel="الرجوع لكل Media Sidebar Modules"
        eyebrow="MEDIA SIDEBAR MODULE"
        title={block.name}
        description="ودجت جانبي لصفحات المركز الإعلامي والموضوعات — يُفضّل في فتحة Sidebar."
        status={block.status}
        saved={saved}
        slotContext={getSlotCompatibilityLabel("media-sidebar")}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />

        <AdminModuleTabs
          activePanelContext={<BlockEditorSaveFeedback backHref="/admin/pages-blocks/blocks/media-sidebar" saved={saved} />}
          tabs={[
            {
              id: "content",
              navigationLabel: "المحتوى",
              sectionHeading: "إعدادات الشريط الجانبي",
              sectionDescription: "حدّد نوع الـwidget ومصدر البيانات وعدد العناصر المعروضة.",
              icon: "media",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">اسم الموديول</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">نوع الـ widget</span>
                    <select
                      name="widget_key"
                      value={widgetKey}
                      onChange={(event) => handleWidgetChange(readInitialWidgetKey(event.target.value))}
                      className={fieldClassName()}
                    >
                      {WIDGET_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {MEDIA_SIDEBAR_WIDGET_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">مصدر البيانات</span>
                    <select
                      name="data_source"
                      value={dataSource}
                      onChange={(event) =>
                        setDataSource(event.target.value === "navigation" ? "navigation" : "topics")
                      }
                      className={fieldClassName()}
                      dir="ltr"
                    >
                      {dataSourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {widgetKey === "sections" ? (
                    <p className="text-xs leading-6 text-white/42">Limit غير مطبق على widget أقسام المركز الإعلامي.</p>
                  ) : (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Limit</span>
                      <input
                        name="limit"
                        type="number"
                        min={1}
                        value={limit}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setLimit(Number.isFinite(next) && next > 0 ? next : "");
                        }}
                        required
                        className={fieldClassName()}
                        dir="ltr"
                      />
                    </label>
                  )}

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">وصف قصير</span>
                    <textarea
                      readOnly
                      value={summary}
                      rows={3}
                      className={fieldClassName("cursor-default resize-none text-white/72")}
                    />
                  </label>
                </section>
              ),
            },
            {
              id: "settings",
              navigationLabel: "الإعدادات",
              sectionHeading: "إعدادات الموديول",
              sectionDescription: "أدر الوصف الداخلي وحالة نشر الموديول.",
              icon: "settings",
              content: (
                <div className="space-y-5">
                  <ModuleDependencyHintsPanel moduleKind="media-sidebar" templateSlug={block.slug} />
                  <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">بيانات الموديول</h2>
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
                </div>
              ),
            },
            {
              id: "pages",
              navigationLabel: "الصفحات",
              sectionHeading: "الظهور في الصفحات",
              sectionDescription: "راجع مواضع استخدام الموديول وحدّد الصفحات المرتبطة به.",
              icon: "plans",
              content: (
                <div className="space-y-5">
                  <ModuleCrossPageUsageBanner moduleName={block.name} assignments={assignmentContext.assignments} />
                  <ModulePageAssignmentsField
                    pages={assignmentContext.pages}
                    assignedPageIds={assignedPageIds}
                  />
                </div>
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
