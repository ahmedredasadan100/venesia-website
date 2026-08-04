import Image from "next/image";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";

type MediaContentCardProps = {
  item: MediaContentItem;
  href?: string;
  actionLabel?: string;
};

export default function MediaContentCard({
  item,
  href,
  actionLabel = "قراءة المزيد",
}: MediaContentCardProps) {
  const finalHref = href ?? getMediaHref(item);

  return (
    <Link href={finalHref} className="block h-full">
      <article className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] shadow-[0_18px_70px_rgba(0,0,0,0.28)] transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/35">
        <div className="relative h-56 overflow-hidden">
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/35 to-transparent"
          />

          <div className="absolute right-4 top-4 rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
            {item.category}
          </div>

          {item.duration ? (
            <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-[#05070B]/70 px-3 py-1 text-[11px] text-white/75 backdrop-blur">
              {item.duration}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[245px] flex-col p-6">
          <p className="text-xs text-white/42">{item.date}</p>

          <h3 className="mt-3 text-xl font-semibold leading-8 text-white transition duration-300 group-hover:text-[#D8B87A]">
            {item.title}
          </h3>

          <p className="mt-4 line-clamp-3 text-sm leading-7 text-white/58">
            {item.excerpt}
          </p>

          <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-xs font-medium text-white/78 transition duration-500 group-hover:border-[#D8B87A]/35 group-hover:text-[#D8B87A]">
            {actionLabel}
            <span aria-hidden="true">←</span>
          </span>
        </div>
      </article>
    </Link>
  );
}
