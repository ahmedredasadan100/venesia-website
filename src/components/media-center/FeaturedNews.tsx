import Image from "next/image";
import Link from "next/link";
import type { MediaNewsItem } from "../../lib/media-center";

type FeaturedNewsProps = {
  item: MediaNewsItem;
};

export default function FeaturedNews({ item }: FeaturedNewsProps) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[0_25px_90px_rgba(0,0,0,0.32)]">
      <div className="relative h-[420px] overflow-hidden">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(min-width: 1024px) 900px, 100vw"
          className="object-cover transition duration-1000 group-hover:scale-105"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/40 to-[#05070B]/10"
        />

        <div className="absolute inset-x-0 bottom-0 p-8 md:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
              {item.category}
            </span>

            <span className="text-xs text-white/60">{item.date}</span>
          </div>

          <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-white md:text-4xl">
            {item.title}
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-8 text-white/70 md:text-base">
            {item.excerpt}
          </p>

          <Link
            href={`/media-center/news/${item.slug}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-6 py-3 text-sm font-medium text-[#D8B87A] transition duration-500 hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/15"
          >
            اقرأ الخبر الكامل
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
