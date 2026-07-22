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
    dateLabel?: string | null; publishedAt?: string | null; showTitle?: boolean | null; showImage?: boolean | null; showExcerpt?: boolean | null;
  };
};

export default function TopicBasicDataPanel({ formId, contentType, contentTypeMode, categoryGroups, series, contentEditor, values }: TopicBasicDataPanelProps) {
  return (
    <div className="space-y-4" data-topic-basic-content-panel>
      <section className="rounded-2xl border border-white/10 bg-[#090D12]/76 p-4 md:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(150px,0.55fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-end" data-topic-primary-fields>
          <TopicContentTypeControl value={contentType} mode={contentTypeMode} />
          <TopicCharacterField id="topic-title" name="title" label="العنوان" required defaultValue={values?.title} placeholder="اكتب عنوان الموضوع" />
          <TopicSlugInput defaultValue={values?.slug} contentType={contentType} />
        </div>

        <div className="mt-3">
          <TopicCharacterField id="topic-excerpt" as="textarea" rows={2} name="excerpt" label="المقتطف" defaultValue={values?.excerpt} placeholder="اكتب مقتطفًا مختصرًا للموضوع" />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
          <TopicDisplaySettings showTitle={values?.showTitle} showImage={values?.showImage} showExcerpt={values?.showExcerpt} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-white/58">التصنيف <span className="text-red-400">*</span></span>
              <ArticleTopicCategorySelect groups={categoryGroups} defaultValue={values?.categorySlug ?? ""} />
            </label>
            <TopicSeriesFields options={series} defaultSeriesId={values?.seriesId} defaultSeries={values?.series} defaultSeriesSlug={values?.seriesSlug} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#090D12]/76 p-3 md:p-4">
          {contentEditor}
        </section>
        <section id="topic-image-field" className="min-w-0 scroll-mt-24 rounded-2xl border border-white/10 bg-[#090D12]/76 p-3 md:p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#D8B87A]">صورة الموضوع</h3>
          <TopicImageField defaultImage={values?.image} defaultAlt={values?.imageAlt} formId={formId} />
        </section>
      </div>
    </div>
  );
}
