import Image from "next/image";

import type { PublicProject } from "../../../lib/projects/public-types";
import RichTextContent from "../../content/RichTextContent";

type ProjectDistrictSectionProps = Pick<PublicProject, "location" | "cardImage" | "englishName">;

export default function ProjectDistrictSection({
  location,
  cardImage,
  englishName,
}: ProjectDistrictSectionProps) {
  const hierarchy = [
    location.governorate,
    location.city,
    location.mainArea,
    location.subArea,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <section id="district" className="scroll-mt-24 border-b border-white/10 bg-[#05070B] px-6 py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="order-2 min-w-0 lg:order-1">
          <p className="mb-3 text-sm font-medium tracking-[0.28em] text-[#D8B87A]/70">عن الموقع</p>
          <h2 className="text-3xl font-semibold leading-tight text-[#D8B87A] md:text-4xl">
            {location.label}
          </h2>

          {hierarchy.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {hierarchy.map((item) => (
                <span key={item.id} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/65">
                  {item.nameAr}
                </span>
              ))}
            </div>
          ) : null}

          {location.description ? (
            <RichTextContent value={location.description} mode="rich" className="mt-6 max-w-2xl text-sm leading-8 text-white/62" />
          ) : null}

          {location.points.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {location.points.map((point) => (
                <div key={point.id} className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                  <p className="text-sm text-white/80">{point.label}</p>
                  {point.distanceText ? <p className="mt-1 text-xs text-white/45">{point.distanceText}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <a
            href={location.googleMapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition hover:bg-[#D8B87A] hover:text-[#111]"
          >
            عرض على خرائط Google
          </a>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-[#D8B87A]/20 bg-white/[0.025] shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
            <Image src={cardImage.src} alt={cardImage.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/80 via-[#05070B]/20 to-transparent" />
            <div className="absolute bottom-5 right-5 rounded-2xl border border-[#D8B87A]/25 bg-[#05070B]/75 px-5 py-4 backdrop-blur-md">
              <p className="text-xs tracking-[0.22em] text-[#D8B87A]/70">VENESIA DEVELOPMENTS</p>
              <p className="mt-1 font-en text-xl font-semibold text-white">{englishName}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
