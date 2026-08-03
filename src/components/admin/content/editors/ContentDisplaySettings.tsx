import TopicFormSwitch from "./article/TopicFormSwitch";

export default function ContentDisplaySettings({
  showTitle = true,
  showImage = true,
  showExcerpt = true,
}: {
  showTitle?: boolean | null;
  showImage?: boolean | null;
  showExcerpt?: boolean | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-content-display-settings>
      <TopicFormSwitch name="show_title_on_page" label="إظهار العنوان" defaultChecked={showTitle !== false} surface />
      <TopicFormSwitch name="show_image_on_page" label="إظهار الصورة" defaultChecked={showImage !== false} surface />
      <TopicFormSwitch name="show_excerpt_on_page" label="إظهار المقتطف" defaultChecked={showExcerpt !== false} surface />
    </div>
  );
}
