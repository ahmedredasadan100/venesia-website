import Link from "next/link";

import type { TopicsInsightCtaContent } from "./topics-cms-mappers";

const DEFAULT_CTA: TopicsInsightCtaContent = {
  eyebrow: "Venesia Insight",
  title: "محتوى موثوق من مطور عقاري يعمل على الأرض.",
  description: "اسأل، افهم، وقارن قبل أي قرار.",
  buttonLabel: "تواصل معنا",
  buttonHref: "/contact",
};

type TopicsInsightCtaSectionProps = {
  cmsContent?: TopicsInsightCtaContent;
};

export default function TopicsInsightCtaSection({ cmsContent }: TopicsInsightCtaSectionProps = {}) {
  const cta = cmsContent ?? DEFAULT_CTA;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#D8B87A]/20 bg-[#D8B87A]/[0.08] p-6">
      {cta.eyebrow ? (
        <p className="text-xs uppercase tracking-[0.25em] text-[#D8B87A]/80">{cta.eyebrow}</p>
      ) : null}

      <h3 className="mt-3 text-xl font-semibold leading-8 text-white">{cta.title}</h3>

      {cta.description ? (
        <p className="mt-3 text-sm leading-7 text-white/55">{cta.description}</p>
      ) : null}

      {cta.buttonLabel ? (
        <Link
          href={cta.buttonHref}
          className="mt-5 inline-flex rounded-full bg-[#D8B87A] px-5 py-3 text-sm font-medium text-[#06101C] transition hover:bg-[#c9a762]"
        >
          {cta.buttonLabel}
        </Link>
      ) : null}
    </section>
  );
}
