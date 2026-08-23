import Image from "next/image";
import Link from "next/link";
import type { MediaContentItem } from "../../lib/media-center/types";

type RelatedMediaRailProps = {
  title?: string;
  eyebrow?: string;
  items: MediaContentItem[];
  getHref: (item: MediaContentItem) => string;
  actionLabel?: string;
};

export default function RelatedMediaRail({
  title = "محتوى ذو صلة",
  eyebrow = "Related",
  items,
  getHref,
  actionLabel = "قراءة المزيد",
}: RelatedMediaRailProps) {
  if (!items.length) return null;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">
          {eyebrow}
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @3xl/slot-module:grid @3xl/slot-module:grid-cols-3 @3xl/slot-module:overflow-visible @3xl/slot-module:pb-0">
        {items.slice(0, 3).map((item) => (
          <Link
            key={item.id}
            href={getHref(item)}
            className="group min-w-[260px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/30 @3xl/slot-module:min-w-0"
          >
            <div className="relative h-36 overflow-hidden">
              <Image
                src={item.image}
                alt={item.title}
                fill
                sizes="(min-width: 1024px) 280px, 260px"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/70 to-transparent" />

              {item.showCategoryOnPage && item.category ? (
                <span className="absolute right-3 top-3 rounded-full border border-[#D8B87A]/30 bg-[#05070B]/70 px-3 py-1 text-[10px] text-[#D8B87A] backdrop-blur">
                  {item.category}
                </span>
              ) : null}

              {item.showSeriesOnPage && item.series ? (
                <span className="absolute left-3 top-3 rounded-full border border-[#D8B87A]/30 bg-[#05070B]/70 px-3 py-1 text-[10px] text-[#D8B87A] backdrop-blur">
                  {item.series}
                </span>
              ) : null}
            </div>

            <div className="p-4">
              {item.showDateOnPage && item.date ? (
                <p className="text-xs text-white/38">{item.date}</p>
              ) : null}

              <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
                {item.title}
              </h3>

              <span className="mt-4 inline-flex text-xs font-medium text-white/55 transition group-hover:text-[#D8B87A]">
                {actionLabel}
                <span aria-hidden="true" className="mr-2">
                  ←
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
