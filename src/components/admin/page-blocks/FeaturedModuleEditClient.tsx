"use client";

import { useMemo, useState } from "react";

import { AdminCheckbox, AdminFormGrid, AdminFormListboxSelect } from "../ui";
import ContentDisplaySettings from "../content/editors/ContentDisplaySettings";
import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../../venesia-scrollbar-styles";
import {
  getContentTypeLabel,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../lib/admin/content/content-types";
import type {
  FeaturedEditorOptions,
  FeaturedModuleConfig,
  FeaturedPresentationVariant,
  FeaturedSelectionMode,
  FeaturedSourceKind,
} from "../../../lib/featured-modules/contract";
import {
  FEATURED_PRESENTATION_LABELS_AR,
  FEATURED_EDITOR_PRESENTATION_VARIANTS,
  FEATURED_SELECTION_LABELS_AR,
  FEATURED_SELECTION_MODES,
} from "../../../lib/featured-modules/contract";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { resolvePageBlockTextFormat } from "../../../lib/page-blocks/configs";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";
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
  MODULE_EDITOR_CONTROL_CARD_CLASS_NAME,
} from "./ModuleEditorPresentation";

type FeaturedModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  };
  config: FeaturedModuleConfig;
  editorOptions: FeaturedEditorOptions;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function FeaturedModuleEditClient({
  block,
  config,
  editorOptions,
  assignmentContext,
  saved,
  updateAction,
}: FeaturedModuleEditClientProps) {
  const [sourceKind, setSourceKind] = useState<FeaturedSourceKind>(
    config.source.kind,
  );
  const [categorySlug, setCategorySlug] = useState(
    config.source.kind === "categories"
      ? config.source.categorySlug
      : (editorOptions.categories[0]?.slug ?? ""),
  );
  const [contentType, setContentType] = useState(
    config.source.kind === "media-center" ? config.source.contentType : "news",
  );
  const [selectionMode, setSelectionMode] = useState<FeaturedSelectionMode>(
    config.selection.mode,
  );
  const [manualIds, setManualIds] = useState<number[]>(
    config.selection.mode === "manual" ? config.selection.topicIds : [],
  );
  const [presentationVariant, setPresentationVariant] =
    useState<FeaturedPresentationVariant>(config.presentation.variant);
  const presentationOptions = useMemo(
    () =>
      config.presentation.variant === "carousel"
        ? ([
            "carousel",
            ...FEATURED_EDITOR_PRESENTATION_VARIANTS,
          ] as const)
        : FEATURED_EDITOR_PRESENTATION_VARIANTS,
    [config.presentation.variant],
  );
  const category = editorOptions.categories.find(
    (item) => item.slug === categorySlug,
  );
  const manualOptions = useMemo(
    () =>
      editorOptions.items.filter((item) =>
        sourceKind === "categories"
          ? item.contentType === "article" &&
            Boolean(category?.scopeSlugs.includes(item.categorySlug))
          : item.contentType === contentType,
      ),
    [category?.scopeSlugs, contentType, editorOptions.items, sourceKind],
  );
  const submittedManualIds = useMemo(() => {
    const availableIds = new Set(manualOptions.map((item) => item.id));
    return manualIds.filter((id) => availableIds.has(id));
  }, [manualIds, manualOptions]);
  const eyebrowFormat = resolvePageBlockTextFormat(
    config.presentation,
    "eyebrow",
  );
  const titleFormat = resolvePageBlockTextFormat(config.presentation, "title", {
    bold: true,
  });
  const descriptionFormat = resolvePageBlockTextFormat(
    config.presentation,
    "description",
  );
  const ctaFormat = resolvePageBlockTextFormat(config.presentation, "cta");

  function toggleManualItem(id: number, checked: boolean) {
    setManualIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((candidate) => candidate !== id),
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="featured"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/featured"
        backLabel="الرجوع إلى Featured"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="slug" value={block.slug} />
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
          moduleKind="featured"
          activePanelContext={
            <ModuleEditorFeedback
              backHref="/admin/pages-blocks/blocks/featured"
              saved={saved}
            />
          }
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorSectionHeading intent="settings">
                    مصدر المحتوى
                  </ModuleEditorSectionHeading>

                  <AdminFormGrid columns={4} className="mt-4">
                    <div
                      className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}
                    >
                      <AdminFormListboxSelect
                        name="source_kind"
                        label="مصدر المحتوى"
                        value={sourceKind}
                        onChange={(value) =>
                          setSourceKind(value as FeaturedSourceKind)
                        }
                        options={[
                          { value: "categories", label: "التصنيفات" },
                          { value: "media-center", label: "المركز الإعلامي" },
                        ]}
                        sizing="full"
                      />
                    </div>
                    <div
                      className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}
                    >
                      {sourceKind === "categories" ? (
                        <AdminFormListboxSelect
                          name="category_slug"
                          label="التصنيف"
                          value={categorySlug}
                          onChange={setCategorySlug}
                          searchable
                          options={editorOptions.categories.map((item) => ({
                            value: item.slug,
                            label: `${"— ".repeat(item.depth)}${item.name}`,
                          }))}
                          sizing="full"
                        />
                      ) : (
                        <AdminFormListboxSelect
                          name="content_type"
                          label="نوع محتوى المركز الإعلامي"
                          value={contentType}
                          onChange={(value) =>
                            setContentType(value as typeof contentType)
                          }
                          options={MEDIA_EDITABLE_CONTENT_TYPES.map(
                            (value) => ({
                              value,
                              label: getContentTypeLabel(value),
                            }),
                          )}
                          sizing="full"
                        />
                      )}
                    </div>
                    <div
                      className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}
                    >
                      <AdminFormListboxSelect
                        name="selection_mode"
                        label="طريقة الاختيار"
                        value={selectionMode}
                        onChange={(value) =>
                          setSelectionMode(value as FeaturedSelectionMode)
                        }
                        options={FEATURED_SELECTION_MODES.map((value) => ({
                          value,
                          label: FEATURED_SELECTION_LABELS_AR[value],
                        }))}
                        sizing="full"
                      />
                    </div>
                    <div
                      className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}
                    >
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-white/70">
                          عدد العناصر
                        </span>
                        <input
                          name="item_limit"
                          type="number"
                          min={1}
                          max={12}
                          required
                          defaultValue={config.itemLimit}
                          className={fieldClassName("h-11")}
                          dir="ltr"
                        />
                      </label>
                    </div>
                  </AdminFormGrid>

                  {selectionMode === "manual" ? (
                    <fieldset className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <legend className="px-2 text-sm font-semibold text-white">
                        العناصر اليدوية
                      </legend>
                      <p className="mb-4 text-xs leading-6 text-white/45">
                        تظهر هنا العناصر المنشورة المطابقة للمصدر فقط، ويظل
                        ترتيب الاختيار محفوظًا.
                      </p>
                      {submittedManualIds.map((id) => (
                        <input
                          key={id}
                          type="hidden"
                          name="manual_topic_ids"
                          value={id}
                        />
                      ))}
                      {manualOptions.length ? (
                        <div
                          data-featured-manual-items-scroll=""
                          className={`grid max-h-[28rem] gap-2 overflow-y-auto md:grid-cols-2 ${VENESIA_SCROLLBAR_VISUAL_CLASSES}`}
                        >
                          {manualOptions.map((item) => {
                            const checked = manualIds.includes(item.id);
                            return (
                              <label
                                key={item.id}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-black/15 p-3 text-sm text-white/70"
                              >
                                <AdminCheckbox
                                  label={`اختيار ${item.title}`}
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleManualItem(
                                      item.id,
                                      event.currentTarget.checked,
                                    )
                                  }
                                />
                                <span>{item.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-amber-200/70">
                          لا توجد عناصر منشورة مطابقة لهذا المصدر.
                        </p>
                      )}
                    </fieldset>
                  ) : null}
                </ModuleEditorSection>
              ),
            },
            {
              id: "presentation",
              content: (
                <div className="space-y-6" data-featured-editor-presentation="">
                  <ModuleEditorSection>
                    <ModuleEditorFieldGrid>
                      <ModuleEditorField nature="standard" span={4}>
                        <div
                          className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}
                        >
                          <AdminFormListboxSelect
                            name="presentation_variant"
                            label="طريقة العرض"
                            value={presentationVariant}
                            onChange={(value) =>
                              setPresentationVariant(
                                value as FeaturedPresentationVariant,
                              )
                            }
                            options={presentationOptions.map(
                              (value) => ({
                                value,
                                label: FEATURED_PRESENTATION_LABELS_AR[value],
                              }),
                            )}
                            sizing="full"
                          />
                        </div>
                      </ModuleEditorField>
                      <ModuleEditorField nature="short-text" span={4}>
                        <ModuleEditorVisibilityAlignRow
                          label={MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr}
                          showName="show_title"
                          boldName="title_bold"
                          alignmentName="title_alignment"
                          showDefault={titleFormat.visible}
                          boldDefault={titleFormat.bold}
                          alignmentDefault={titleFormat.alignment}
                          className="h-full"
                        >
                          <input
                            name="title"
                            aria-label={
                              MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr
                            }
                            defaultValue={config.presentation.title}
                            className={fieldClassName()}
                          />
                        </ModuleEditorVisibilityAlignRow>
                      </ModuleEditorField>
                      <ModuleEditorField nature="short-text" span={4}>
                        <ModuleEditorVisibilityAlignRow
                          label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}
                          showName="show_eyebrow"
                          boldName="eyebrow_bold"
                          alignmentName="eyebrow_alignment"
                          showDefault={eyebrowFormat.visible}
                          boldDefault={eyebrowFormat.bold}
                          alignmentDefault={eyebrowFormat.alignment}
                          className="h-full"
                        >
                          <input
                            name="eyebrow"
                            aria-label={
                              MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr
                            }
                            defaultValue={config.presentation.eyebrow ?? ""}
                            className={fieldClassName()}
                          />
                        </ModuleEditorVisibilityAlignRow>
                      </ModuleEditorField>
                      <ModuleEditorField nature="short-text" span={4}>
                        <ModuleEditorVisibilityAlignRow
                          label="الوصف"
                          showName="show_description"
                          boldName="description_bold"
                          alignmentName="description_alignment"
                          showDefault={descriptionFormat.visible}
                          boldDefault={descriptionFormat.bold}
                          alignmentDefault={descriptionFormat.alignment}
                          className="h-full"
                        >
                          <input
                            name="presentation_description"
                            aria-label="الوصف"
                            defaultValue={config.presentation.description}
                            className={fieldClassName("h-11")}
                          />
                        </ModuleEditorVisibilityAlignRow>
                      </ModuleEditorField>
                    </ModuleEditorFieldGrid>
                  </ModuleEditorSection>

                  <ModuleEditorSection>
                    <ModuleEditorSectionHeading intent="settings">
                      إعدادات العرض
                    </ModuleEditorSectionHeading>
                    <div className="mt-4">
                      <ContentDisplaySettings
                        showTitle={config.display.title}
                        showImage={config.display.image}
                        showCategory={config.display.category}
                        showSeries={config.display.series}
                        showExcerpt={config.display.excerpt}
                        showDate={config.display.date}
                        includeIntroCard={false}
                      >
                        <ModuleEditorVisibilityAlignRow
                          label="نص الإجراء"
                          showName="show_cta"
                          boldName="cta_bold"
                          alignmentName="cta_alignment"
                          showDefault={ctaFormat.visible}
                          boldDefault={ctaFormat.bold}
                          alignmentDefault={ctaFormat.alignment}
                          className="h-full sm:col-span-2 lg:col-start-3 lg:row-start-1 lg:row-span-2"
                        >
                          <input
                            name="cta_text"
                            aria-label="نص الإجراء"
                            defaultValue={config.presentation.ctaText}
                            className={fieldClassName("h-10")}
                          />
                        </ModuleEditorVisibilityAlignRow>
                      </ContentDisplaySettings>
                    </div>
                  </ModuleEditorSection>
                </div>
              ),
            },
            {
              id: "pages",
              content: (
                <ModuleEditorPagesTab
                  moduleName={block.name}
                  assignmentContext={assignmentContext}
                />
              ),
            },
          ]}
        />
        <ModuleEditorSaveArea />
      </form>
    </div>
  );
}
