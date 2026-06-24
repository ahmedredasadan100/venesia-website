import Image from "next/image";
import Link from "next/link";
import type { MediaContentItem } from "../../lib/media-center";

type MediaCenterHubTimelineProps = {
  items: MediaContentItem[];
};

export default function MediaCenterHubTimeline({
  items,
}: MediaCenterHubTimelineProps) {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/70">
            Site Updates
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            من أرض التنفيذ
          </h2>
        </div>

        <Link
          href="/media-center/site-updates"
          className="text-sm font-medium text-[#D8B87A] transition hover:text-white"
        >
          استكشف القسم
        </Link>
      </div>

      <div className="relative space-y-5 before:absolute before:right-[13px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#D8B87A]/20">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/media-center/site-updates/${item.slug}`}
            className="group relative grid grid-cols-[32px_1fr] gap-4"
          >
            <span className="relative z-10 mt-2 h-7 w-7 rounded-full border border-[#D8B87A]/35 bg-[#05070B] shadow-[0_0_0_6px_rgba(216,184,122,0.06)]" />

            <article className="grid gap-4 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4 transition duration-500 hover:border-[#D8B87A]/35 md:grid-cols-[130px_1fr]">
              <div className="relative min-h-[105px] overflow-hidden rounded-[1rem]">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="160px"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-[#D8B87A]/75">
                    {item.project ?? item.category}
                  </span>

                  <span className="text-xs text-white/35">{item.date}</span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
                  {item.title}
                </h3>

                <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/50">
                  {item.excerpt}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}