"use client";

import { useMemo, useState } from "react";

import { AdminFormListboxSelect } from "../ui";
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
} from "./ModuleEditorPresentation";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import {
  MEDIA_SIDEBAR_WIDGET_LABELS,
} from "../../../lib/media-sidebar-modules/admin-present";
import {
  MEDIA_SIDEBAR_WIDGET_DEFAULTS,
  parseMediaSidebarModuleConfig,
} from "../../../lib/media-sidebar-modules/parse-config";
import type { MediaSidebarWidgetKey } from "../../../lib/media-sidebar-modules/types";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

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
      <ModuleEditorHeader
        moduleKind="media-sidebar"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/media-sidebar"
        backLabel="الرجوع لكل Media Sidebar Modules"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />

        <ModuleEditorTabs
          moduleKind="media-sidebar"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/media-sidebar" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                  <ModuleEditorField nature="standard" span={4}><label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">اسم الموديول</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label></ModuleEditorField>

                  <ModuleEditorField nature="standard" span={4}><AdminFormListboxSelect
                    name="widget_key"
                    label="نوع الـ widget"
                    value={widgetKey}
                    onChange={(value) => handleWidgetChange(readInitialWidgetKey(value))}
                    options={WIDGET_KEYS.map((key) => ({ value: key, label: MEDIA_SIDEBAR_WIDGET_LABELS[key] }))}
                  /></ModuleEditorField>

                  <ModuleEditorField nature="standard" span={4}><AdminFormListboxSelect
                    name="data_source"
                    label="مصدر البيانات"
                    value={dataSource}
                    onChange={(value) => setDataSource(value === "navigation" ? "navigation" : "topics")}
                    options={dataSourceOptions}
                    dir="ltr"
                  /></ModuleEditorField>

                  {widgetKey === "sections" ? (
                    <ModuleEditorField nature="standard" span={4}><p className="rounded-xl border border-white/10 bg-black/16 px-4 py-3 text-xs leading-6 text-white/42">عدد العناصر غير مطبق على أقسام المركز الإعلامي.</p></ModuleEditorField>
                  ) : (
                    <ModuleEditorField nature="standard" span={4}><label className="block space-y-2">
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
                    </label></ModuleEditorField>
                  )}
                  </ModuleEditorFieldGrid>
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
