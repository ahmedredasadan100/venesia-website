import TopicFormSwitch from "./article/TopicFormSwitch";

export default function ContentDisplaySettings({
  showTitle = true,
  showImage = true,
  showExcerpt = true,
  showDate = true,
  showCategory = true,
  showSeries = true,
  showIntroCard = true,
}: {
  showTitle?: boolean | null;
  showImage?: boolean | null;
  showExcerpt?: boolean | null;
  showDate?: boolean | null;
  showCategory?: boolean | null;
  showSeries?: boolean | null;
  showIntroCard?: boolean | null;
}) {
  return (
    <div
      id="content-display-settings"
      className="grid scroll-mt-24 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      data-content-display-settings
    >
      <TopicFormSwitch name="show_title_on_page" label="إظهار العنوان" defaultChecked={showTitle !== false} surface />
      <TopicFormSwitch name="show_image_on_page" label="إظهار الصورة" defaultChecked={showImage !== false} surface />
      <TopicFormSwitch name="show_excerpt_on_page" label="إظهار المقتطف" defaultChecked={showExcerpt !== false} surface />
      <TopicFormSwitch name="show_date_on_page" label="إظهار التاريخ" defaultChecked={showDate !== false} surface />
      <TopicFormSwitch name="show_category_on_page" label="إظهار التصنيف" defaultChecked={showCategory !== false} surface />
      <TopicFormSwitch name="show_series_on_page" label="إظهار السلسلة" defaultChecked={showSeries !== false} surface />
      <TopicFormSwitch name="show_intro_card_on_page" label="إظهار بطاقة مقدمة الموضوع" defaultChecked={showIntroCard !== false} surface />
    </div>
  );
}
