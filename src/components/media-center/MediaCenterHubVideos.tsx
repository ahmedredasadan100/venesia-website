import Image from "next/image";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";

type MediaCenterHubVideosProps = {
  items: MediaContentItem[];
};

export default function MediaCenterHubVideos({
  items,
}: MediaCenterHubVideosProps) {
  const [featuredVideo, ...smallVideos] = items;

  if (!featuredVideo) return null;

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/70">
            Videos
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            الفيديوهات
          </h2>
        </div>

        <Link
          href="/media-center/videos"
          className="text-sm font-medium text-[#D8B87A] transition hover:text-white"
        >
          استكشف القسم
        </Link>
      </div>

      <div className="grid gap-4">
        <Link
          href={getMediaHref(featuredVideo)}
          className="group block"
        >
          <article className="relative min-h-[300px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035]">
            <Image
              src={featuredVideo.image}
              alt={featuredVideo.title}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover transition duration-1000 group-hover:scale-105"
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/45 to-transparent"
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-black/35 text-xl text-white backdrop-blur transition group-hover:border-[#D8B87A]/60 group-hover:text-[#D8B87A]">
                ▶
              </span>
            </div>

            {featuredVideo.duration ? (
              <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-[#05070B]/75 px-3 py-1 text-xs text-white/75 backdrop-blur">
                {featuredVideo.duration}
              </span>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 p-6">
              <h3 className="text-xl font-semibold leading-8 text-white">
                {featuredVideo.title}
              </h3>

              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/58">
                {featuredVideo.excerpt}
              </p>
            </div>
          </article>
        </Link>

        <div className="grid gap-3">
          {smallVideos.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={getMediaHref(item)}
              className="group grid grid-cols-[96px_1fr] gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3 transition duration-500 hover:border-[#D8B87A]/35"
            >
              <div className="relative min-h-[72px] overflow-hidden rounded-xl">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="96px"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />

                <span className="absolute inset-0 flex items-center justify-center text-sm text-white">
                  ▶
                </span>
              </div>

              <div>
                <div className="flex items-center gap-3">
                  {item.duration ? (
                    <span className="text-xs text-[#D8B87A]/70">
                      {item.duration}
                    </span>
                  ) : null}

                  <span className="text-xs text-white/35">{item.date}</span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-[#D8B87A]">
                  {item.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
