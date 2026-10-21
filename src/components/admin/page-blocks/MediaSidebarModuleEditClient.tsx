"use client";

import { AdminFormPendingFields } from "../ui/AdminFormRuntime";

import { useState } from "react";

import {
  getContentTypeLabel,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../lib/admin/content/content-types";
import type { PublicContentSourceKind } from "../../../lib/content/public-content-read/contract";
import type { Json } from "../../../lib/database.types";
import {
  MEDIA_SIDEBAR_PRESENTATION_LABELS,
  MEDIA_SIDEBAR_WIDGET_LABELS,
} from "../../../lib/media-sidebar-modules/admin-present";
import {
  MEDIA_SIDEBAR_ALL_MEDIA_CONTENT_TYPE,
  MEDIA_SIDEBAR_PRESENTATIONS,
  MEDIA_SIDEBAR_WIDGET_DEFAULTS,
  parseMediaSidebarModuleConfig,
  type MediaSidebarContentSource,
  type MediaSidebarMediaContentType,
  type MediaSidebarModuleConfig,
  type MediaSidebarPresentation,
} from "../../../lib/media-sidebar-modules/parse-config";
import type { MediaSidebarWidgetKey } from "../../../lib/media-sidebar-modules/types";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import ContentDisplaySettings from "../content/editors/ContentDisplaySettings";
import {
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormListboxSelect,
} from "../ui";
import { AdminModuleTabIcon } from "../ui/AdminModuleTabs";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorTabs,
} from "./ModuleEditorPresentation";

type MediaSidebarEditorCategory = {
  slug: string;
  name: string;
  depth: number;
};

type MediaSidebarModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    widget_key: string;
    config: Json;
  };
  categories: readonly MediaSidebarEditorCategory[];
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const WIDGET_KEYS = Object.keys(
  MEDIA_SIDEBAR_WIDGET_LABELS,
) as MediaSidebarWidgetKey[];

function readInitialWidgetKey(value: string): MediaSidebarWidgetKey {
  return value === "sections" || value === "latest" || value === "popular"
    ? value
    : "latest";
}

type MediaSidebarContentConfig = Extract<
  MediaSidebarModuleConfig,
  { source: MediaSidebarContentSource }
>;

function contentConfig(
  config: MediaSidebarModuleConfig,
): MediaSidebarContentConfig {
  if (typeof config.source === "object") return config;
  return MEDIA_SIDEBAR_WIDGET_DEFAULTS.latest
    .config as MediaSidebarContentConfig;
}

export default function MediaSidebarModuleEditClient({
  block,
  categories,
  assignmentContext,
  saved,
  updateAction,
}: MediaSidebarModuleEditClientProps) {
  const initialWidgetKey = readInitialWidgetKey(block.widget_key);
  const initialConfig = parseMediaSidebarModuleConfig(
    block.config ?? {},
    initialWidgetKey,
  );
  const initialContentConfig = contentConfig(initialConfig);

  const [widgetKey, setWidgetKey] =
    useState<MediaSidebarWidgetKey>(initialWidgetKey);
  const [sourceKind, setSourceKind] = useState<PublicContentSourceKind>(
    initialContentConfig.source.kind,
  );
  const [categorySlug, setCategorySlug] = useState(
    initialContentConfig.source.kind === "categories"
      ? initialContentConfig.source.categorySlug
      : (categories[0]?.slug ?? ""),
  );
  const [contentType, setContentType] =
    useState<MediaSidebarMediaContentType>(
      initialContentConfig.source.kind === "media-center"
        ? initialContentConfig.source.contentType
        : "news",
    );
  const [limit, setLimit] = useState<number>(initialContentConfig.limit);
  const [presentation, setPresentation] =
    useState<MediaSidebarPresentation>(initialContentConfig.presentation);

  function handleWidgetChange(nextWidgetKey: MediaSidebarWidgetKey) {
    setWidgetKey(nextWidgetKey);
    if (nextWidgetKey === "sections") return;
    setLimit(
      MEDIA_SIDEBAR_WIDGET_DEFAULTS[nextWidgetKey].defaultLimit ?? limit,
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="media-sidebar"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/media-sidebar"
        backLabel="الرجوع لكل موديولات الشريط الإعلامي الجانبي"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <AdminFormPendingFields>
          <input type="hidden" name="id" value={block.id} />
          <input
            type="hidden"
            name="description"
            value={block.description ?? ""}
          />

          <ModuleEditorIdentitySection
            name={block.name}
            status={block.status}
            inputClassName={fieldClassName("h-11")}
          />

          <ModuleEditorTabs
            moduleKind="media-sidebar"
            activePanelContext={
              <ModuleEditorFeedback
                backHref="/admin/pages-blocks/blocks/media-sidebar"
                saved={saved}
              />
            }
            tabs={[
              {
                id: "content",
                sectionHeaderPresentation: "control",
                content: (
                  <div className="space-y-6">
                    <AdminCard
                      presentation="premium"
                      className="space-y-4 p-4"
                    >
                      <AdminFormControlHeader
                        title="اختيار المحتوى"
                        icon={<AdminModuleTabIcon name="content" />}
                        presentation="leading-icon"
                      />

                      <ModuleEditorFieldGrid>
                        <ModuleEditorField nature="standard" span={12}>
                          <AdminFormGrid columns={2}>
                            {widgetKey !== "sections" ? (
                              <>
                                <AdminCard
                                  presentation="premium"
                                  className="h-full p-3"
                                >
                                  <AdminFormListboxSelect
                                    name="source_kind"
                                    label="مصدر المحتوى"
                                    value={sourceKind}
                                    onChange={(value) =>
                                      setSourceKind(value as PublicContentSourceKind)
                                    }
                                    options={[
                                      { value: "categories", label: "التصنيفات" },
                                      {
                                        value: "media-center",
                                        label: "المركز الإعلامي",
                                      },
                                    ]}
                                    sizing="full"
                                  />
                                </AdminCard>

                                <AdminCard
                                  presentation="premium"
                                  className="h-full p-3"
                                >
                                  {sourceKind === "categories" ? (
                                    <AdminFormListboxSelect
                                      name="category_slug"
                                      label="التصنيف"
                                      value={categorySlug}
                                      onChange={setCategorySlug}
                                      searchable
                                      required
                                      options={categories.map((category) => ({
                                        value: category.slug,
                                        label: `${"— ".repeat(category.depth)}${category.name}`,
                                      }))}
                                      sizing="full"
                                    />
                                  ) : (
                                    <AdminFormListboxSelect
                                      name="content_type"
                                      label="نوع محتوى المركز الإعلامي"
                                      value={contentType}
                                      onChange={(value) =>
                                        setContentType(
                                          value as MediaSidebarMediaContentType,
                                        )
                                      }
                                      options={[
                                        {
                                          value:
                                            MEDIA_SIDEBAR_ALL_MEDIA_CONTENT_TYPE,
                                          label: "كل محتوى المركز الإعلامي",
                                        },
                                        ...MEDIA_EDITABLE_CONTENT_TYPES.map(
                                          (value) => ({
                                            value,
                                            label: getContentTypeLabel(value),
                                          }),
                                        ),
                                      ]}
                                      sizing="full"
                                    />
                                  )}
                                </AdminCard>
                              </>
                            ) : null}

                            <AdminCard
                              presentation="premium"
                              className="h-full p-3"
                            >
                              <AdminFormListboxSelect
                                name="widget_key"
                                label="طريقة الاختيار"
                                value={widgetKey}
                                onChange={(value) =>
                                  handleWidgetChange(
                                    readInitialWidgetKey(value),
                                  )
                                }
                                options={WIDGET_KEYS.map((key) => ({
                                  value: key,
                                  label: MEDIA_SIDEBAR_WIDGET_LABELS[key],
                                }))}
                                sizing="full"
                              />
                            </AdminCard>

                            {widgetKey !== "sections" ? (
                              <AdminCard
                                presentation="premium"
                                className="h-full p-3"
                              >
                                <label className="block space-y-2">
                                  <span className="text-sm font-medium text-white/70">
                                    عدد العناصر
                                  </span>
                                  <input
                                    name="limit"
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={limit}
                                    onChange={(event) => {
                                      const next = Number(event.target.value);
                                      setLimit(
                                        Number.isFinite(next) && next > 0
                                          ? Math.min(60, next)
                                          : 1,
                                      );
                                    }}
                                    required
                                    className={fieldClassName("h-11")}
                                    dir="ltr"
                                  />
                                </label>
                              </AdminCard>
                            ) : null}
                          </AdminFormGrid>
                        </ModuleEditorField>
                      </ModuleEditorFieldGrid>
                    </AdminCard>

                    <fieldset
                      hidden={widgetKey === "sections"}
                      disabled={widgetKey === "sections"}
                      className="min-w-0"
                    >
                      <AdminCard
                        presentation="premium"
                        className="space-y-4 p-4"
                      >
                        <AdminFormControlHeader
                          title="إعدادات العرض"
                          icon={<AdminModuleTabIcon name="settings" />}
                          presentation="leading-icon"
                        />
                        <AdminFormGrid columns={3} className="mt-4">
                          <AdminCard
                            presentation="premium"
                            className="h-full p-3"
                          >
                            <AdminFormListboxSelect
                              name="presentation"
                              label="شكل العرض"
                              value={presentation}
                              onChange={(value) =>
                                setPresentation(value as MediaSidebarPresentation)
                              }
                              options={MEDIA_SIDEBAR_PRESENTATIONS.map(
                                (value) => ({
                                  value,
                                  label: MEDIA_SIDEBAR_PRESENTATION_LABELS[value],
                                }),
                              )}
                              sizing="full"
                            />
                          </AdminCard>
                        </AdminFormGrid>
                        <div className="mt-4">
                          <ContentDisplaySettings
                            columns={3}
                            showTitle={initialContentConfig.display.title}
                            showImage={initialContentConfig.display.image}
                            showCategory={initialContentConfig.display.category}
                            showSeries={initialContentConfig.display.series}
                            showExcerpt={initialContentConfig.display.excerpt}
                            showDate={initialContentConfig.display.date}
                            includeIntroCard={false}
                          />
                        </div>
                      </AdminCard>
                    </fieldset>
                  </div>
                ),
              },
              {
                id: "pages",
                sectionHeaderPresentation: "control",
                content: (
                  <ModuleEditorPagesTab
                    moduleName={block.name}
                    assignmentContext={assignmentContext}
                    presentation="premium"
                    showUsageBanner={false}
                  />
                ),
              },
            ]}
          />

          <ModuleEditorSaveArea />
        </AdminFormPendingFields>
      </form>
    </div>
  );
}
