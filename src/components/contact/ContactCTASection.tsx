import Image from "next/image";
import type { ContactCtaContent } from "./contact-cms-mappers";

type ContactCTASectionProps = {
  cmsContent: ContactCtaContent | null;
};

export default function ContactCTASection({ cmsContent }: ContactCTASectionProps) {
  if (!cmsContent) return null;

  const cta = cmsContent;
  const showCopy = Boolean(cta.title.trim() || cta.text.trim() || cta.primaryLabel.trim() || cta.secondaryLabel.trim());

  if (!showCopy && !cta.image.trim()) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
      <div className="group relative overflow-hidden rounded-[28px] border border-[#d2a75a]/25 p-8 transition duration-500 hover:-translate-y-1 hover:border-[#d2a75a]/55 hover:shadow-[0_22px_70px_rgba(0,0,0,0.38)] md:p-12">
        {cta.image.trim() ? (
          <Image
            src={cta.image}
            alt={cta.title || ""}
            fill
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover opacity-35 transition duration-700 group-hover:scale-105"
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-l from-[#03070b] via-[#03070b]/85 to-[#03070b]/30" />

        <div className="absolute inset-x-0 top-0 h-px origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#d2a75a] to-transparent transition duration-700 group-hover:scale-x-100" />

        <div className="absolute -left-32 top-0 h-full w-28 rotate-12 bg-white/10 blur-2xl transition-all duration-700 group-hover:left-full" />

        <div className="relative max-w-2xl">
          {cta.title.trim() ? (
            <h2 className="text-balance text-3xl font-semibold max-[359px]:text-2xl md:text-5xl">
              {cta.title}
            </h2>
          ) : null}

          {cta.text.trim() ? (
            <p className="mt-5 leading-8 text-white/70">
              {cta.text}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-4">
            {cta.primaryLabel.trim() ? (
              <a
                href={cta.primaryHref || "#"}
                className="rounded-xl bg-gradient-to-l from-[#e7b66a] to-[#b98236] px-7 py-4 font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
              >
                {cta.primaryLabel}
              </a>
            ) : null}

            {cta.secondaryLabel.trim() ? (
              <a
                href={cta.secondaryHref || "#"}
                className="rounded-xl border border-white/15 px-7 py-4 font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:border-[#d2a75a]/50 hover:text-[#d2a75a]"
              >
                {cta.secondaryLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
