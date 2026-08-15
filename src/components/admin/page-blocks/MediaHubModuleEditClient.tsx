"use client";

import { useState } from "react";

import { AdminFormListboxSelect } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorSettingsComposition,
  ModuleEditorStatusSwitch,
  ModuleEditorTabs,
} from "./ModuleEditorPresentation";
import type { Json } from "../../../lib/database.types";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import {
  MEDIA_HUB_SECTION_LABELS,
} from "../../../lib/media-hub-modules/admin-present";
import {
  MEDIA_HUB_SECTION_DEFAULTS,
  parseMediaHubModuleConfig,
  parseMediaHubSectionKey,
} from "../../../lib/media-hub-modules/parse-config";
import type { MediaHubSectionKey } from "../../../lib/media-hub-modules/types";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

type MediaHubModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    section_key: string;
    config: Json;
  };
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const SECTION_KEYS = Object.keys(MEDIA_HUB_SECTION_LABELS) as MediaHubSectionKey[];

function readInitialSectionKey(value: string): MediaHubSectionKey {
  try {
    return parseMediaHubSectionKey(value);
  } catch {
    return "featured";
  }
}

export default function MediaHubModuleEditClient({
  block,
  assignmentContext,
  saved,
  updateAction,
}: MediaHubModuleEditClientProps) {
  const initialSectionKey = readInitialSectionKey(block.section_key);
  const initialConfig = block.config ?? {};
  const parsedInitial = parseMediaHubModuleConfig(initialConfig, initialSectionKey);

  const [sectionKey, setSectionKey] = useState<MediaHubSectionKey>(initialSectionKey);
  const [limit, setLimit] = useState<number | "">(
    typeof parsedInitial.limit === "number" ? parsedInitial.limit : MEDIA_HUB_SECTION_DEFAULTS[initialSectionKey].defaultLimit ?? "",
  );
  const [sideLimit, setSideLimit] = useState<number | "">(
    typeof parsedInitial.sideLimit === "number" ? parsedInitial.sideLimit : MEDIA_HUB_SECTION_DEFAULTS.featured.defaultSideLimit ?? "",
  );
  const [listLimit, setListLimit] = useState<number | "">(
    typeof parsedInitial.listLimit === "number" ? parsedInitial.listLimit : MEDIA_HUB_SECTION_DEFAULTS.featured.defaultListLimit ?? "",
  );

  function handleSectionChange(nextSectionKey: MediaHubSectionKey) {
    setSectionKey(nextSectionKey);

    if (nextSectionKey === "featured") {
      setSideLimit(MEDIA_HUB_SECTION_DEFAULTS.featured.defaultSideLimit ?? 3);
      setListLimit(MEDIA_HUB_SECTION_DEFAULTS.featured.defaultListLimit ?? 4);
      setLimit("");
      return;
    }

    setLimit(MEDIA_HUB_SECTION_DEFAULTS[nextSectionKey].defaultLimit ?? "");
    setSideLimit("");
    setListLimit("");
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="media-hub"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/media-hub"
        backLabel="الرجوع لكل موديولات المركز الإعلامي"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="data_source" value="topics" />

        <ModuleEditorTabs
          moduleKind="media-hub"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/media-hub" saved={saved} />}
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
                    name="section_key"
                    label="نوع السكشن"
                    value={sectionKey}
                    onChange={(value) => handleSectionChange(readInitialSectionKey(value))}
                    options={SECTION_KEYS.map((key) => ({ value: key, label: MEDIA_HUB_SECTION_LABELS[key] }))}
                  /></ModuleEditorField>

                  <ModuleEditorField nature="standard" span={4}>
                    <div className="space-y-2">
                      <span className="block text-sm font-medium text-white/70">مصدر البيانات</span>
                      <p className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/60">
                        المحتوى الموحّد (topics)
                      </p>
                    </div>
                  </ModuleEditorField>

                  {sectionKey === "featured" ? (
                    <ModuleEditorField nature="standard" span={6}><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">عدد أخبار القائمة المميزة</span>
                        <input
                          name="list_limit"
                          type="number"
                          min={1}
                          value={listLimit}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setListLimit(Number.isFinite(next) && next > 0 ? next : "");
                          }}
                          required
                          className={fieldClassName()}
                          dir="ltr"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">عدد عناصر العرض الجانبي</span>
                        <input
                          name="side_limit"
                          type="number"
                          min={1}
                          value={sideLimit}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setSideLimit(Number.isFinite(next) && next > 0 ? next : "");
                          }}
                          required
                          className={fieldClassName()}
                          dir="ltr"
                        />
                      </label>
                    </div></ModuleEditorField>
                  ) : (
                    <ModuleEditorField nature="standard" span={4}><label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">عدد العناصر</span>
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
                    <ModuleEditorStatusSwitch status={block.status} />
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
