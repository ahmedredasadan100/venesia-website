import type { ContentBlockConfig } from "../../lib/page-blocks/configs";
import { ContentIntroPresentation } from "../sections/ContentSection";

const DEFAULT_INTRO: ContentBlockConfig = {
  eyebrow: "Knowledge Hub",
  title: "جميع الموضوعات",
  subtitle: "محتوى يجيب على أسئلتك ويوضح لك كل خطوة في رحلتك العقارية.",
};

type TopicsIntroSectionProps = {
  config?: ContentBlockConfig;
};

/** Topics supplies fallback copy only; the shared Content owner renders Intro. */
export default function TopicsIntroSection({
  config = DEFAULT_INTRO,
}: TopicsIntroSectionProps = {}) {
  return <ContentIntroPresentation config={config} />;
}
