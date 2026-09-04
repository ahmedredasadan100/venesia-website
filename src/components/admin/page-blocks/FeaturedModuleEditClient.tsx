"use client";

import { useMemo, useState } from "react";

import {
  AdminCheckbox,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME,
} from "../ui";
import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../../venesia-scrollbar-styles";
import {
  getContentTypeLabel,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../lib/admin/content/content-types";
import type {
  FeaturedEditorOptions,
  FeaturedModuleConfig,
  FeaturedPresentationProfile,
  FeaturedPresentationVariant,
  FeaturedSelectionMode,
  FeaturedSourceKind,
} from "../../../lib/featured-modules/contract";
import {
  FEATURED_PRESENTATION_LABELS_AR,
  FEATURED_EDITOR_PRESENTATION_VARIANTS,
  FEATURED_SELECTION_LABELS_AR,
  FEATURED_SELECTION_MODES,
  featuredPresentationProfile,
  resolveFeaturedItemsPerView,
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

function FeaturedItemsPerViewControl({
  profile,
  value,
  itemLimit,
}: {
  profile: FeaturedPresentationProfile;
  value: number;
  itemLimit: number;
}) {
  const policy = profile.itemsPerView;

  if (policy.mode === "configurable") {
    return (
      <label className="flex min-h-10 items-center justify-between gap-2">
        <span className="whitespace-nowrap text-sm font-medium text-white/70">
          العناصر الظاهرة
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-[#E6C98D]">
          <input
            name="items_per_view"
            type="number"
            min={Math.min(policy.min, itemLimit)}
            max={Math.min(policy.max, itemLimit)}
            required
            defaultValue={value}
            className={fieldClassName(
              "h-9 !w-14 !px-2 text-center [color-scheme:dark]",
            )}
            dir="ltr"
            aria-label="العناصر الظاهرة"
          />
          <span>عنصر</span>
        </span>
      </label>
    );
  }

  return (
    <>
      <input type="hidden" name="items_per_view" value={value} />
      <div className="flex min-h-10 items-center justify-between gap-3">
        <span className="text-sm font-medium text-white/70">
          العناصر الظاهرة
        </span>
        <strong className="shrink-0 text-base text-[#E6C98D]">
          {value} عنصر
        </strong>
      </div>
    </>
  );
}

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
  const presentationProfile = featuredPresentationProfile(presentationVariant);
  const usesPersistedPresentation =
    presentationVariant === config.presentation.variant;
  const itemsPerView = usesPersistedPresentation
    ? config.itemsPerView
    : resolveFeaturedItemsPerView(
        presentationVariant,
        undefined,
        config.itemLimit,
      );
  const navigation = usesPersistedPresentation
    ? config.navigation
    : presentationProfile.defaultNavigation;

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
                        <span className="block text-sm font-medium text-white/70">
                          العدد المسموح به
                        </span>
                        <input
                          name="item_limit"
                          type="number"
                          min={1}
                          max={12}
                          required
                          defaultValue={config.itemLimit}
                          className={fieldClassName(
                            "h-11 [color-scheme:dark]",
                          )}
                          dir="ltr"
                        />
                      </label>
                    </div>
                  </AdminFormGrid>

                  {selectionMode === "manual" ? (
                    <fieldset className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <legend className="sr-only">
                        العناصر اليدوية
                      </legend>
                      <div
                        data-featured-manual-heading=""
                        className="mb-2 text-sm font-semibold text-white"
                      >
                        العناصر اليدوية
                      </div>
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
                    </ModuleEditorFieldGrid>
                  </ModuleEditorSection>

                  <ModuleEditorSection>
                    <ModuleEditorSectionHeading intent="settings">
                      إعدادات النمط المختار
                    </ModuleEditorSectionHeading>
                    <div
                      key={presentationVariant}
                      className="mt-4 space-y-4 rounded-2xl border border-[#D8B87A]/15 bg-[#D8B87A]/[0.035] p-4"
                      data-featured-variant-settings={presentationVariant}
                    >
                      <p className="text-sm leading-6 text-white/58">
                        {presentationProfile.summaryAr}
                      </p>
                      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div
                          className={`${ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME} min-h-16`}
                          data-featured-items-per-view-control={
                            presentationProfile.itemsPerView.mode
                          }
                        >
                          <FeaturedItemsPerViewControl
                            profile={presentationProfile}
                            value={itemsPerView}
                            itemLimit={config.itemLimit}
                          />
                        </div>
                        {presentationProfile.supportsNavigation ? (
                          <>
                            <AdminFormSwitch
                              name="show_navigation_arrows"
                              label="إظهار أسهم التنقل"
                              value="true"
                              uncheckedValue="false"
                              defaultChecked={navigation.showArrows}
                              surface
                              className="min-h-16"
                            />
                            <AdminFormSwitch
                              name="show_navigation_dots"
                              label="إظهار نقاط التنقل"
                              value="true"
                              uncheckedValue="false"
                              defaultChecked={navigation.showDots}
                              surface
                              className="min-h-16"
                            />
                            <AdminFormSwitch
                              name="navigation_autoplay"
                              label="تشغيل التنقل تلقائيًا"
                              value="true"
                              uncheckedValue="false"
                              defaultChecked={navigation.autoplay}
                              surface
                              className="min-h-16"
                            />
                          </>
                        ) : (
                          <>
                            <input
                              type="hidden"
                              name="show_navigation_arrows"
                              value="false"
                            />
                            <input
                              type="hidden"
                              name="show_navigation_dots"
                              value="false"
                            />
                            <input
                              type="hidden"
                              name="navigation_autoplay"
                              value="false"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </ModuleEditorSection>

                  <ModuleEditorSection>
                    <ModuleEditorSectionHeading intent="settings">
                      عنوان الموديول
                    </ModuleEditorSectionHeading>
                    <div className="mt-4 grid items-start gap-4 md:grid-cols-3">
                      <ModuleEditorVisibilityAlignRow
                        label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}
                        showName="show_eyebrow"
                        boldName="eyebrow_bold"
                        alignmentName="eyebrow_alignment"
                        showDefault={eyebrowFormat.visible}
                        boldDefault={eyebrowFormat.bold}
                        alignmentDefault={eyebrowFormat.alignment}
                      >
                        <input
                          name="eyebrow"
                          aria-label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}
                          defaultValue={config.presentation.eyebrow ?? ""}
                          className={fieldClassName("h-10")}
                        />
                      </ModuleEditorVisibilityAlignRow>
                      <ModuleEditorVisibilityAlignRow
                        label="العنوان"
                        showName="show_title"
                        boldName="title_bold"
                        alignmentName="title_alignment"
                        showDefault={titleFormat.visible}
                        boldDefault={titleFormat.bold}
                        alignmentDefault={titleFormat.alignment}
                      >
                        <input
                          name="title"
                          aria-label={
                            MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr
                          }
                          defaultValue={config.presentation.title}
                          className={fieldClassName("h-10")}
                        />
                      </ModuleEditorVisibilityAlignRow>
                      <ModuleEditorVisibilityAlignRow
                        label="الوصف"
                        showName="show_description"
                        boldName="description_bold"
                        alignmentName="description_alignment"
                        showDefault={descriptionFormat.visible}
                        boldDefault={descriptionFormat.bold}
                        alignmentDefault={descriptionFormat.alignment}
                      >
                        <input
                          name="presentation_description"
                          aria-label="الوصف"
                          defaultValue={config.presentation.description}
                          className={fieldClassName("h-10")}
                        />
                      </ModuleEditorVisibilityAlignRow>
                    </div>
                  </ModuleEditorSection>

                  <ModuleEditorSection>
                    <ModuleEditorSectionHeading intent="settings">
                      تنسيق عناصر المحتوى
                    </ModuleEditorSectionHeading>
                    <div
                      className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
                      data-featured-display-settings=""
                    >
                      <ModuleEditorVisibilityAlignRow
                        label="عنوان العنصر"
                        showName="show_title_on_page"
                        boldName="display_title_bold"
                        alignmentName="display_title_alignment"
                        showDefault={config.display.title}
                        boldDefault={config.displayFormatting.titleBold}
                        alignmentDefault={
                          config.displayFormatting.titleAlignment
                        }
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="الصورة"
                        showName="show_image_on_page"
                        showDefault={config.display.image}
                        controlMode="visibility-only"
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="التصنيف"
                        showName="show_category_on_page"
                        boldName="display_category_bold"
                        alignmentName="display_category_alignment"
                        showDefault={config.display.category}
                        boldDefault={config.displayFormatting.categoryBold}
                        alignmentDefault={
                          config.displayFormatting.categoryAlignment
                        }
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="السلسلة"
                        showName="show_series_on_page"
                        boldName="display_series_bold"
                        alignmentName="display_series_alignment"
                        showDefault={config.display.series}
                        boldDefault={config.displayFormatting.seriesBold}
                        alignmentDefault={
                          config.displayFormatting.seriesAlignment
                        }
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="المقتطف"
                        showName="show_excerpt_on_page"
                        boldName="display_excerpt_bold"
                        alignmentName="display_excerpt_alignment"
                        showDefault={config.display.excerpt}
                        boldDefault={config.displayFormatting.excerptBold}
                        alignmentDefault={
                          config.displayFormatting.excerptAlignment
                        }
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="التاريخ"
                        showName="show_date_on_page"
                        boldName="display_date_bold"
                        alignmentName="display_date_alignment"
                        showDefault={config.display.date}
                        boldDefault={config.displayFormatting.dateBold}
                        alignmentDefault={
                          config.displayFormatting.dateAlignment
                        }
                      />
                      <ModuleEditorVisibilityAlignRow
                        label="نص الإجراء"
                        showName="show_cta"
                        boldName="cta_bold"
                        alignmentName="cta_alignment"
                        showDefault={ctaFormat.visible}
                        boldDefault={ctaFormat.bold}
                        alignmentDefault={ctaFormat.alignment}
                      >
                        <input
                          name="cta_text"
                          aria-label="نص الإجراء"
                          defaultValue={config.presentation.ctaText}
                          className={fieldClassName("h-10")}
                        />
                      </ModuleEditorVisibilityAlignRow>
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
