import Link from "next/link";
import type { MediaContentItem } from "../../lib/media-center";
import MediaContentCard from "./MediaContentCard";

type MediaCenterHubRailProps = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  items: MediaContentItem[];
  actionLabel: string;
};

export default function MediaCenterHubRail({
  eyebrow,
  title,
  description,
  href,
  items,
  actionLabel,
}: MediaCenterHubRailProps) {
  return (
    <section className="relative">
      <div className="mb-6 flex flex-col gap-5 border-t border-white/10 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/70">
            {eyebrow}
          </p>

          <h3 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
            {title}
          </h3>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52">
            {description}
          </p>
        </div>

        <Link
          href={href}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.035] px-5 py-2.5 text-xs font-medium text-white/72 transition duration-500 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
        >
          استكشف القسم
          <span aria-hidden="true">←</span>
        </Link>
      </div>

      {items.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <MediaContentCard
              key={item.id}
              item={item}
              actionLabel={actionLabel}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-8 text-center">
          <p className="text-sm text-white/50">
            لم يتم إضافة محتوى لهذا القسم بعد.
          </p>
        </div>
      )}
    </section>
  );
}