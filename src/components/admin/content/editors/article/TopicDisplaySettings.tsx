import TopicFormSwitch, { TOPIC_SETTINGS_SURFACE_CLASS_NAME } from "./TopicFormSwitch";

type TopicDisplaySettingsProps = {
  showTitle?: boolean | null;
  showImage?: boolean | null;
  showExcerpt?: boolean | null;
};

export default function TopicDisplaySettings({
  showTitle = true,
  showImage = true,
  showExcerpt = true,
}: TopicDisplaySettingsProps) {
  return (
    <section className={TOPIC_SETTINGS_SURFACE_CLASS_NAME}>
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-[#E2B84F]">▣</span>
        <h3 className="text-sm font-semibold text-white">إعدادات العرض داخل صفحة الموضوع</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <TopicFormSwitch name="show_title_on_page" label="إظهار العنوان" defaultChecked={showTitle !== false} />
        <TopicFormSwitch name="show_image_on_page" label="إظهار الصورة" defaultChecked={showImage !== false} />
        <TopicFormSwitch name="show_excerpt_on_page" label="إظهار المقتطف" defaultChecked={showExcerpt !== false} />
      </div>
    </section>
  );
}
