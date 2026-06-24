import type { TopicsIntroContent } from "./topics-cms-mappers";

const DEFAULT_INTRO: TopicsIntroContent = {
  eyebrow: "Knowledge Hub",
  title: "جميع الموضوعات",
  description: "محتوى يجيب على أسئلتك ويوضح لك كل خطوة في رحلتك العقارية.",
};

type TopicsIntroSectionProps = {
  cmsContent?: TopicsIntroContent;
};

export default function TopicsIntroSection({ cmsContent }: TopicsIntroSectionProps = {}) {
  const intro = cmsContent ?? DEFAULT_INTRO;

  return (
    <div className="text-right">
      {intro.eyebrow ? (
        <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">{intro.eyebrow}</p>
      ) : null}

      <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{intro.title}</h1>

      {intro.description ? (
        <p className="mt-4 max-w-3xl leading-8 text-white/60">{intro.description}</p>
      ) : null}
    </div>
  );
}
