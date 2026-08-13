import type { ReactNode } from "react";
import type { ContentType } from "../../../../lib/admin/content/content-types";
import TopicContentTypeControl from "./TopicContentTypeControl";
import TopicCharacterField from "./article/TopicCharacterField";
import TopicImageField from "./article/TopicImageField";
import TopicSeriesFields from "./article/TopicSeriesFields";
import TopicSlugInput from "./article/TopicSlugInput";
import { AdminFormLayout, AdminFormSection } from "../../ui/AdminForm";
import ContentCategorySelect, {
  type ContentEditorCategoryOption,
} from "./ContentCategorySelect";

type ContentBasicDataPanelProps = {
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
  formId,
  contentType,
  mode,
  categories,
  series,
  contentEditor,
  displaySettings,
  values,
}: ContentBasicDataPanelProps) {
  return (
    <div
      className="space-y-7"
      data-content-basic-panel
      data-content-basic-presentation="editor"
    >
      <AdminFormLayout
        aside={
          <AdminFormSection
            id="content-image-field"
            title="الصورة الرئيسية"
            compactHeader
            className="h-full min-w-0 scroll-mt-24"
          >
            <TopicImageField
              defaultImage={values?.image}
              defaultAlt={values?.imageAlt}
              formId={formId}
            />
          </AdminFormSection>
        }
        className="items-stretch"
        asideClassName="h-full"
      >
        <AdminFormSection className="h-full min-w-0">
          <div className="space-y-7">
            <div className="grid gap-5 lg:grid-cols-2 lg:items-end">
              <TopicCharacterField
                id="content-title"
                name="title"
                label="العنوان"
                required
                defaultValue={values?.title}
                placeholder="اكتب عنوان المحتوى"
              />
              <TopicSlugInput
                defaultValue={values?.slug}
                contentType={contentType}
              />
            </div>

            <TopicCharacterField
              id="content-excerpt"
              as="textarea"
              rows={2}
              name="excerpt"
              label="الوصف الخارجي (المقتطف)"
              defaultValue={values?.excerpt}
              placeholder="اكتب مقتطفًا مختصرًا للمحتوى"
            />

            <div className="grid gap-5 lg:grid-cols-[max-content_minmax(15rem,1fr)_minmax(16rem,1.08fr)] lg:items-end">
              <TopicContentTypeControl
                value={contentType}
                mode={mode}
              />
              <label className="inline-grid min-w-0 max-w-full shrink-0 space-y-1.5">
                <span className="text-xs font-medium text-white/58">
                  التصنيف <span className="text-red-400">*</span>
                </span>
                <ContentCategorySelect
                  categories={categories}
                  defaultValue={values?.categoryId}
                />
              </label>
              <TopicSeriesFields
                options={series}
                defaultCategoryId={values?.categoryId}
                defaultSeriesId={values?.seriesId}
                defaultSeries={values?.series}
                defaultSeriesSlug={values?.seriesSlug}
              />
            </div>
          </div>
        </AdminFormSection>
      </AdminFormLayout>

      {displaySettings ? (
        <AdminFormSection
          title="إعدادات العرض"
          compactHeader
          density="compact"
        >
          {displaySettings}
        </AdminFormSection>
      ) : null}

      <AdminFormSection className="min-w-0">{contentEditor}</AdminFormSection>
    </div>
  );
}
