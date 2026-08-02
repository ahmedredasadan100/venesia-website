import TopicFormSwitch from "./TopicFormSwitch";
import { AdminFormSwitchGroup } from "../../../ui/AdminFormSwitch";

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
  const switches = (
    <>
      <TopicFormSwitch name="show_title_on_page" label="إظهار العنوان" defaultChecked={showTitle !== false} surface />
      <TopicFormSwitch name="show_image_on_page" label="إظهار الصورة" defaultChecked={showImage !== false} surface />
      <TopicFormSwitch name="show_excerpt_on_page" label="إظهار المقتطف" defaultChecked={showExcerpt !== false} surface />
    </>
  );

  return (
    <AdminFormSwitchGroup layout="equal-grid">{switches}</AdminFormSwitchGroup>
  );
}
