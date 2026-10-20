"use client";

import { AdminFormPendingFields } from "../ui/AdminFormRuntime";

import { useMemo, useState } from "react";

import {
  AdminCheckbox,
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminStatusPill,
} from "../ui";
import { AdminModuleTabIcon } from "../ui/AdminModuleTabs";
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
  resolveFeaturedManualEditorSelection,
  resolveFeaturedItemsPerView,
  updateFeaturedManualSelection,
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
  ModuleEditorTabs,
  ModuleEditorVisibilityAlignRow,
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
  variant,
  profile,
  value,
  itemLimit,
  onChange,
}: {
  variant: FeaturedPresentationVariant;
  profile: FeaturedPresentationProfile;
  value: string;
  itemLimit: number;
  onChange: (value: string) => void;
}) {
  const policy = profile.itemsPerView;

  if (policy.mode === "configurable") {
    return (
      <label className="flex min-h-10 items-center justify-between gap-2">
        <AdminFormControlHeader title="العناصر الظاهرة" presentation="leading-icon" icon={<AdminModuleTabIcon name="overview" />} />
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-[#E6C98D]">
          <input
            name="items_per_view"
            type="number"
            min={resolveFeaturedItemsPerView(variant, policy.min, itemLimit)}
            max={resolveFeaturedItemsPerView(variant, policy.max, itemLimit)}
            required
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
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
        <AdminFormControlHeader title="العناصر الظاهرة" presentation="leading-icon" icon={<AdminModuleTabIcon name="overview" />} />
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
  const [itemLimit, setItemLimit] = useState(String(config.itemLimit));
  const [itemsPerView, setItemsPerView] = useState(String(config.itemsPerView));
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
  const manualSelectionEntries = useMemo(() => {
    return resolveFeaturedManualEditorSelection(manualIds, manualOptions);
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
  const navigation = usesPersistedPresentation
    ? config.navigation
    : presentationProfile.defaultNavigation;

  function toggleManualItem(id: number, checked: boolean) {
    setManualIds((current) =>
      updateFeaturedManualSelection(current, id, checked),
    );
  }


  const variantControls = (<>
    <AdminCard
      presentation="premium"
      className="h-full p-3"
      data-featured-items-per-view-control={
        presentationProfile.itemsPerView.mode
      }
    >
      <FeaturedItemsPerViewControl
        variant={presentationVariant}
        profile={presentationProfile}
        value={itemsPerView}
        itemLimit={Number(itemLimit)}
        onChange={setItemsPerView}
      />
    </AdminCard>
    {presentationProfile.supportsNavigation ? (
      <>
        <AdminCard presentation="premium" className="h-full p-3">
        <AdminFormSwitch
          name="show_navigation_arrows"
          label={<AdminFormControlHeader title="إظهار أسهم التنقل" presentation="leading-icon" icon={<AdminModuleTabIcon name="settings" />} />}
          value="true"
          uncheckedValue="false"
          defaultChecked={navigation.showArrows}
          embedded
        />
        </AdminCard>
        <AdminCard presentation="premium" className="h-full p-3">
        <AdminFormSwitch
          name="show_navigation_dots"
          label={<AdminFormControlHeader title="إظهار نقاط التنقل" presentation="leading-icon" icon={<AdminModuleTabIcon name="settings" />} />}
          value="true"
          uncheckedValue="false"
          defaultChecked={navigation.showDots}
          embedded
        />
        </AdminCard>
        <AdminCard presentation="premium" className="h-full p-3">
        <AdminFormSwitch
          name="navigation_autoplay"
          label={<AdminFormControlHeader title="تشغيل التنقل تلقائيًا" presentation="leading-icon" icon={<AdminModuleTabIcon name="settings" />} />}
          value="true"
          uncheckedValue="false"
          defaultChecked={navigation.autoplay}
          embedded
        />
        </AdminCard>
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
  </>);
  const displayControls = (<>
    <ModuleEditorVisibilityAlignRow
      presentation="premium"
      icon={<AdminModuleTabIcon name="content" />}
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
      presentation="premium"
      icon={<AdminModuleTabIcon name="media" />}
      label="الصورة"
      showName="show_image_on_page"
      showDefault={config.display.image}
      controlMode="visibility-only"
    />
    <ModuleEditorVisibilityAlignRow
      presentation="premium"
      icon={<AdminModuleTabIcon name="section" />}
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
      presentation="premium"
      icon={<AdminModuleTabIcon name="plans" />}
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
      presentation="premium"
      icon={<AdminModuleTabIcon name="content" />}
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
      presentation="premium"
      icon={<AdminModuleTabIcon name="overview" />}
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
      presentation="premium"
      icon={<AdminModuleTabIcon name="publish" />}
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
  </>);
  const sourceFields = (<div className="space-y-4">

    <AdminFormGrid columns={2}>
      <AdminCard presentation="premium" className="h-full p-3">
        <AdminFormListboxSelect
          name="source_kind"
          label={<AdminFormControlHeader title="مصدر المحتوى" presentation="leading-icon" icon={<AdminModuleTabIcon name="content" />} />}
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
      </AdminCard>
      <AdminCard presentation="premium" className="h-full p-3">
        {sourceKind === "categories" ? (
          <AdminFormListboxSelect
            name="category_slug"
            label={<AdminFormControlHeader title="التصنيف" presentation="leading-icon" icon={<AdminModuleTabIcon name="section" />} />}
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
            label={<AdminFormControlHeader title="نوع محتوى المركز الإعلامي" presentation="leading-icon" icon={<AdminModuleTabIcon name="media" />} />}
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
      </AdminCard>
      <AdminCard presentation="premium" className="h-full p-3">
        <AdminFormListboxSelect
          name="selection_mode"
          label={<AdminFormControlHeader title="طريقة الاختيار" presentation="leading-icon" icon={<AdminModuleTabIcon name="settings" />} />}
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
      </AdminCard>
      <AdminCard presentation="premium" className="h-full p-3">
        <label className="block space-y-2">
          <AdminFormControlHeader title="العدد المسموح به" presentation="leading-icon" icon={<AdminModuleTabIcon name="specifications" />} />
          <input
            name="item_limit"
            type="number"
            min={1}
            max={12}
            required
            value={itemLimit}
            onChange={(event) => {
              const input = event.currentTarget;
              setItemLimit(input.value);
              if (input.validity.valid) {
                const limit = input.valueAsNumber;
                setItemsPerView((current) => String(
                  resolveFeaturedItemsPerView(presentationVariant, current, limit),
                ));
              }
            }}
            className={fieldClassName(
              "h-11 [color-scheme:dark]",
            )}
            dir="ltr"
          />
        </label>
      </AdminCard>
    </AdminFormGrid>

    {selectionMode === "manual" ? (
      <fieldset className="min-w-0">
        <legend className="sr-only">
          العناصر اليدوية
        </legend>
        <AdminCard presentation="premium" className="p-4">
        <div
          data-featured-manual-heading=""
          className="mb-4"
        >
          <AdminFormControlHeader
            title="العناصر اليدوية"
            description="يظل ترتيب كل المعرّفات المحفوظة ثابتًا. العنصر غير المتاح حاليًا يبقى محفوظًا حتى تزيله صراحةً."
            presentation="leading-icon"
            icon={<AdminModuleTabIcon name="section" />}
          />
        </div>
        {manualIds.map((id) => (
          <input
            key={id}
            type="hidden"
            name="manual_topic_ids"
            value={id}
          />
        ))}
        {manualSelectionEntries.length ? (
          <div className="mb-4 space-y-2">
            <div className="text-xs font-semibold text-white/55">
              ترتيب الاختيار المحفوظ
            </div>
            <ol
              data-featured-manual-selection-order=""
              className="space-y-2"
            >
              {manualSelectionEntries.map((entry, index) => (
                <li
                  key={entry.id}
                  data-featured-manual-selection-item=""
                  data-featured-manual-item=""
                  data-featured-item-id={entry.id}
                  data-featured-resolution={entry.state}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-3 text-sm text-white/70"
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 font-en text-xs text-white/55"
                    aria-label={`الترتيب ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {entry.state === "resolved" ? (
                      <>
                        <span className="block break-words text-white/80">
                          {entry.item.title}
                        </span>
                        <span className="font-en text-[11px] text-white/35">
                          ID {entry.id}
                        </span>
                      </>
                    ) : (
                      <span
                        data-featured-manual-tombstone=""
                        className="block"
                      >
                        <span className="block text-amber-100/80">
                          عنصر محفوظ غير متاح حاليًا
                        </span>
                        <span className="font-en text-[11px] text-white/40">
                          ID {entry.id}
                        </span>
                      </span>
                    )}
                  </span>
                  {entry.state === "unresolved" ? (
                    <AdminStatusPill tone="gold">
                      غير متاح
                    </AdminStatusPill>
                  ) : null}
                  <button
                    type="button"
                    data-featured-manual-remove={entry.id}
                    onClick={() =>
                      toggleManualItem(entry.id, false)
                    }
                    className="shrink-0 rounded-lg border border-red-400/20 px-3 py-1.5 text-xs font-semibold text-red-200/75 transition hover:border-red-300/40 hover:text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300/60"
                    aria-label={`إزالة ${entry.state === "resolved" ? entry.item.title : `المعرّف ${entry.id}`}`}
                  >
                    إزالة
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p
            data-featured-manual-selection-empty=""
            className="mb-4 text-sm text-white/40"
          >
            لم يتم اختيار عناصر بعد.
          </p>
        )}
        {manualOptions.length ? (
          <>
            <div className="mb-2 text-xs font-semibold text-white/55">
              العناصر المتاحة
            </div>
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
          </>
        ) : (
          <p className="text-sm text-amber-200/70">
            لا توجد عناصر منشورة مطابقة لهذا المصدر.
          </p>
        )}
        </AdminCard>
      </fieldset>
    ) : null}
  </div>);
  const variantFields = (<><div className="space-y-4">
    <ModuleEditorFieldGrid>
      <ModuleEditorField nature="standard" span={4}>
        <AdminCard presentation="premium" className="h-full p-3">
          <AdminFormListboxSelect
            name="presentation_variant"
            label={<AdminFormControlHeader title="طريقة العرض" presentation="leading-icon" icon={<AdminModuleTabIcon name="section" />} />}
            value={presentationVariant}
            onChange={(value) => {
              const variant = value as FeaturedPresentationVariant;
              if (variant === presentationVariant) return;
              setPresentationVariant(variant);
              setItemsPerView(String(resolveFeaturedItemsPerView(
                variant,
                variant === config.presentation.variant ? config.itemsPerView : undefined,
                Number(itemLimit),
              )));
            }}
            options={presentationOptions.map(
              (value) => ({
                value,
                label: FEATURED_PRESENTATION_LABELS_AR[value],
              }),
            )}
            sizing="full"
          />
        </AdminCard>
      </ModuleEditorField>
    </ModuleEditorFieldGrid>
  </div>
    <div className="space-y-4">
      <AdminFormControlHeader title="إعدادات النمط المختار" icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />
      <div
        key={presentationVariant}
        className="space-y-4"
        data-featured-variant-settings={presentationVariant}
      >
        <p className="text-sm leading-6 text-white/58">
          {presentationProfile.summaryAr}
        </p>
        <AdminFormGrid columns={4}>{variantControls}</AdminFormGrid>
      </div>
    </div></>);
  const textFields = (<div className="space-y-4">
    <AdminFormGrid columns={1} className="mt-4">
      <ModuleEditorVisibilityAlignRow
        presentation="premium"
        icon={<AdminModuleTabIcon name="content" />}
        description={"نص قصير يقدم القسم ويظهر فوق العنوان."}
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
        presentation="premium"
        icon={<AdminModuleTabIcon name="content" />}
        description={"العنوان الرئيسي للقسم كما يظهر في الصفحة."}
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
        presentation="premium"
        icon={<AdminModuleTabIcon name="content" />}
        description={"وصف القسم كما يظهر في الصفحة."}
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
    </AdminFormGrid>
  </div>);
  const displayFields = (<div className="space-y-4">
    <AdminFormControlHeader title="تنسيق عناصر المحتوى" icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />
    <div
      data-featured-display-settings=""
    ><AdminFormGrid columns={3}>{displayControls}</AdminFormGrid></div>
  </div>);

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
        <AdminFormPendingFields>
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
            moduleSlug={block.slug}
            activePanelContext={
              <ModuleEditorFeedback
                backHref="/admin/pages-blocks/blocks/featured"
                saved={saved}
              />
            }
            tabs={[
              {
                id: "content",
                sectionHeaderPresentation: "control",
                content: (<div className="space-y-6">{sourceFields}{variantFields}</div>),
              },
              { id: "text", content: textFields },
              {
                id: "presentation",
                content: (<div className="space-y-6" data-featured-editor-presentation="">{displayFields}</div>),
              },
              {
                id: "pages",
                sectionHeaderPresentation: "control",
                content: (<ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} presentation="premium" />),
              },
            ]}
          />
          <ModuleEditorSaveArea />
        </AdminFormPendingFields>
      </form>
    </div>
  );
}
