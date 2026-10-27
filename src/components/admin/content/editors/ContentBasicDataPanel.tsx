import type { ReactNode } from "react";
import {
  getContentEditorAdapter,
  type ContentType,
} from "../../../../lib/admin/content/content-types";
import TopicContentTypeControl from "./TopicContentTypeControl";
import TopicCharacterField from "./article/TopicCharacterField";
import TopicImageField from "./article/TopicImageField";
import TopicSeriesFields from "./article/TopicSeriesFields";
import TopicSlugInput from "./article/TopicSlugInput";
import AdminCard from "../../ui/AdminCard";
import {
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminFormLayout,
} from "../../ui/AdminForm";
import { AdminFormGrid } from "../../ui/AdminFormRuntime";
import { AdminModuleSectionHeader } from "../../ui/AdminModuleTabs";
import {
  ADMIN_FORM,
  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../../../lib/admin/admin-ui-styles";
import ContentCategorySelect, {
  type ContentEditorCategoryOption,
} from "./ContentCategorySelect";

type ContentBasicDataPanelProps = {
  presentation?: "default" | "panel";
  heading?: ReactNode;
  description?: ReactNode;
  formId: string;
  contentType: ContentType;
  mode: "create" | "edit";
  categories: ContentEditorCategoryOption[];
  series: Array<{
    id: number;
    name: string;
    slug: string;
    category_id: number | null;
  }>;
  contentEditor: ReactNode;
  displaySettings?: ReactNode;
  controlledValues?: {
    title: string;
    excerpt: string;
  };
  onControlledValueChange?: (
    field: "title" | "excerpt",
    value: string,
  ) => void;
  onImageValueChange?: (value: string) => void;
  slugDraftRestored?: boolean;
  values?: {
    title?: string | null;
    slug?: string | null;
    excerpt?: string | null;
    image?: string | null;
    imageAlt?: string | null;
    categoryId?: number | null;
    seriesId?: number | null;
    series?: string | null;
    seriesSlug?: string | null;
  };
};

export default function ContentBasicDataPanel({
  presentation = "default",
  heading = "بيانات الموضوع والمحتوى",
  description,
  formId,
  contentType,
  mode,
  categories,
  series,
  contentEditor,
  displaySettings,
  controlledValues,
  onControlledValueChange,
  onImageValueChange,
  slugDraftRestored = false,
  values,
}: ContentBasicDataPanelProps) {
  const panel = presentation === "panel";
  const labelClassName = panel ? adminFormLabelClassName({ textInset: true }) : undefined;
  const displaySection = displaySettings ? (
    panel ? (
      <AdminCard presentation="premium" className="min-w-0 p-3">
        <AdminModuleSectionHeader
          id="content-display-settings-heading"
          sectionHeading="إعدادات العرض"
          icon="settings"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
        {displaySettings}
      </AdminCard>
    ) : (
      <section>
        <AdminModuleSectionHeader
          id="content-display-settings-heading"
          sectionHeading="إعدادات العرض"
          icon="settings"
        />
        {displaySettings}
      </section>
    )
  ) : null;
  const imageCard = (
    <AdminCard
      id={panel ? "content-image-field" : undefined}
      presentation="premium"
      className={panel ? "min-w-0 scroll-mt-24 p-3" : "min-w-0 p-3"}
    >
      {panel ? <AdminModuleSectionHeader
        id="content-main-image"
        sectionHeading="الصورة الرئيسية"
        icon="media"
        sectionHeaderPresentation="premium"
        sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
      /> : null}
      <TopicImageField
        defaultImage={values?.image}
        onValueChange={onImageValueChange}
        defaultAlt={values?.imageAlt}
        formId={formId}
        labelClassName={labelClassName}
        guidanceClassName={panel ? adminFormHintClassName({ textInset: true }) : undefined}
        originalDimensionsClassName={panel ? ADMIN_FORM.helperTextInset : undefined}
      />
    </AdminCard>
  );

  return (
    <div
      className={ADMIN_FORM_STACK_CLASS_NAME}
      data-content-basic-panel
      data-content-basic-presentation={panel ? "panel" : "editor"}
    >
      <AdminFormLayout
        aside={panel ? imageCard : (
          <section
            id="content-image-field"
            className="h-full min-w-0 scroll-mt-24"
          >
            <AdminModuleSectionHeader
              id="content-main-image"
              sectionHeading="الصورة الرئيسية"
              icon="media"
            />
            {imageCard}
          </section>
        )}
        presentation={panel ? "panel" : undefined}
        renderGrid={panel && !displaySection ? ({ children, className }) => (
          <AdminFormGrid columns={1} presentation="equal-height-columns" className={className}>
            {children}
          </AdminFormGrid>
        ) : undefined}
        secondary={panel ? displaySection : undefined}
        className={panel ? undefined : "items-stretch"}
        asideClassName={panel ? undefined : "h-full"}
      >
        <AdminCard presentation="premium" className={panel ? "min-w-0 p-3" : "h-full min-w-0 p-3"}>
          {panel ? <AdminModuleSectionHeader
            id="content-basic-data"
            sectionHeading={heading}
            sectionDescription={description}
            icon="content"
            sectionHeaderPresentation="premium"
            sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          /> : null}
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
            <AdminFormGrid columns={2} presentation="aligned-fields">
              <TopicCharacterField
                id="content-title"
                name="title"
                label="العنوان"
                labelClassName={labelClassName}
                required
                defaultValue={values?.title}
                value={controlledValues?.title}
                onValueChange={(value) =>
                  onControlledValueChange?.("title", value)
                }
                placeholder="اكتب عنوان المحتوى"
              />
              <TopicSlugInput
                draftRestored={slugDraftRestored}
                labelClassName={labelClassName}
                defaultValue={values?.slug}
                titleValue={controlledValues?.title}
                contentType={contentType}
              />
            </AdminFormGrid>

            <TopicCharacterField
              id="content-excerpt"
              as="textarea"
              rows={panel ? 5 : 2}
              textareaSizing={panel ? "rows" : undefined}
              name="excerpt"
              label="الوصف الخارجي (المقتطف)"
              labelClassName={labelClassName}
              defaultValue={values?.excerpt}
              value={controlledValues?.excerpt}
              onValueChange={(value) =>
                onControlledValueChange?.("excerpt", value)
              }
              placeholder="اكتب مقتطفًا مختصرًا للمحتوى"
            />

            <AdminFormGrid columns={3} presentation="aligned-fields" fieldContainers={panel}>
              <TopicContentTypeControl
                labelClassName={labelClassName}
                value={contentType}
                mode={mode}
              />
              <label className={labelClassName ?? "inline-grid min-w-0 max-w-full shrink-0 space-y-1.5"}>
                <span data-admin-form-label-text className={labelClassName === undefined ? "text-xs font-medium text-white/58" : undefined}>
                  التصنيف <span className="text-red-400">*</span>
                </span>
                <ContentCategorySelect
                  categories={categories}
                  defaultValue={values?.categoryId}
                  persistedSelectionId={
                    mode === "edit" ? values?.categoryId : null
                  }
                />
              </label>
              <TopicSeriesFields
                labelClassName={labelClassName}
                options={series}
                defaultCategoryId={values?.categoryId}
                defaultSeriesId={values?.seriesId}
                defaultSeries={values?.series}
                defaultSeriesSlug={values?.seriesSlug}
              />
            </AdminFormGrid>
          </div>
        </AdminCard>
      </AdminFormLayout>

      {panel ? null : displaySection}

      {contentEditor ? (panel && getContentEditorAdapter(contentType).body === "markdown" ? contentEditor : <section>
        {getContentEditorAdapter(contentType).body === "markdown" ? (
          <AdminModuleSectionHeader
            id="content-body"
            sectionHeading="المحتوى"
            icon="content"
          />
        ) : null}
        <AdminCard presentation="premium" className="min-w-0 p-3">{contentEditor}</AdminCard>
      </section>) : null}
    </div>
  );
}
