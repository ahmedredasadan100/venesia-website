import type { ReactNode } from "react";
import type { ArticleTopicCategoryGroup } from "../../../../../lib/admin/article-topic-categories";
import type { ContentType } from "../../../../../lib/admin/content/content-types";
import TopicContentTypeControl from "../TopicContentTypeControl";
import ArticleTopicCategorySelect from "./ArticleTopicCategorySelect";
import TopicCharacterField from "./TopicCharacterField";
import TopicDisplaySettings from "./TopicDisplaySettings";
import TopicImageField from "./TopicImageField";
import TopicSeriesFields from "./TopicSeriesFields";
import TopicSlugInput from "./TopicSlugInput";
import { AdminFormLayout, AdminFormSection } from "../../../ui/AdminForm";

type TopicBasicDataPanelProps = {
  formId: string;
  contentType: ContentType;
  contentTypeMode: "create" | "edit";
  categoryGroups: ArticleTopicCategoryGroup[];
  series: Array<{ id: number; name: string; slug: string }>;
  contentEditor: ReactNode;
  values?: {
    title?: string | null; slug?: string | null; excerpt?: string | null; image?: string | null; imageAlt?: string | null;
    categorySlug?: string | null; seriesId?: number | null; series?: string | null; seriesSlug?: string | null;
    showTitle?: boolean | null; showImage?: boolean | null; showExcerpt?: boolean | null;
  };
};

export default function TopicBasicDataPanel({ formId, contentType, contentTypeMode, categoryGroups, series, contentEditor, values }: TopicBasicDataPanelProps) {
  const titleField = (
    <TopicCharacterField id="topic-title" name="title" label="العنوان" required defaultValue={values?.title} placeholder="اكتب عنوان الموضوع" />
  );
  const slugField = <TopicSlugInput defaultValue={values?.slug} contentType={contentType} />;
  const contentTypeField = (
    <TopicContentTypeControl
      value={contentType}
      mode={contentTypeMode}
      presentation="compact"
    />
  );
  const excerptField = (
    <TopicCharacterField id="topic-excerpt" as="textarea" rows={2} name="excerpt" label="الوصف الخارجي (المقتطف)" defaultValue={values?.excerpt} placeholder="اكتب مقتطفًا مختصرًا للموضوع" />
  );
  const categoryField = (
    <label className="inline-grid min-w-0 max-w-full shrink-0 space-y-1.5">
      <span className="text-xs font-medium text-white/58">التصنيف <span className="text-red-400">*</span></span>
      <ArticleTopicCategorySelect
        groups={categoryGroups}
        defaultValue={values?.categorySlug ?? ""}
      />
    </label>
  );
  const seriesField = (
    <TopicSeriesFields
      options={series}
      defaultSeriesId={values?.seriesId}
      defaultSeries={values?.series}
      defaultSeriesSlug={values?.seriesSlug}
    />
  );
  const displaySettings = (
    <TopicDisplaySettings
      showTitle={values?.showTitle}
      showImage={values?.showImage}
      showExcerpt={values?.showExcerpt}
    />
  );
  const displaySection = (
    <AdminFormSection title="إعدادات العرض داخل صفحة الموضوع" compactHeader density="compact">
      {displaySettings}
    </AdminFormSection>
  );
  const imageField = (
    <TopicImageField
      defaultImage={values?.image}
      defaultAlt={values?.imageAlt}
      formId={formId}
    />
  );
  const contentBody = <>{contentEditor}</>;
  const imageSection = (
    <AdminFormSection
      id="topic-image-field"
      title="صورة الموضوع"
      compactHeader
      className="h-full min-w-0 scroll-mt-24"
    >
      {imageField}
    </AdminFormSection>
  );
  const contentSection = (
    <AdminFormSection className="min-w-0">
      {contentBody}
    </AdminFormSection>
  );

  return (
    <div className="space-y-7" data-topic-basic-content-panel data-topic-basic-presentation="editor">
      <AdminFormLayout aside={imageSection} className="items-stretch" asideClassName="h-full">
        <AdminFormSection className="h-full min-w-0">
          <div className="space-y-7">
            <div
              className="grid gap-5 lg:grid-cols-2 lg:items-end"
              data-topic-primary-fields
            >
              {titleField}
              {slugField}
            </div>

            {excerptField}

            <div
              className="grid gap-5 lg:grid-cols-[max-content_minmax(15rem,1fr)_minmax(16rem,1.08fr)] lg:items-end"
              data-topic-compact-select-row
            >
              {contentTypeField}
              {categoryField}
              {seriesField}
            </div>
          </div>
        </AdminFormSection>
      </AdminFormLayout>

      {displaySection}

      {contentSection}
    </div>
  );
}
