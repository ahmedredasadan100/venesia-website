import TopicImage from "./TopicImage";
import Link from "next/link";
import PublicGoldPill from "../public/PublicGoldPill";

type TopicCardProps = {
  slug: string;
  category: string;
  categorySlug: string;
  series?: string;
  seriesSlug?: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  readingTime: string;
  showDateOnPage?: boolean;
  showCategoryOnPage?: boolean;
  showSeriesOnPage?: boolean;
};

export default function TopicCard({
  slug,
  category,
  categorySlug,
  series,
  seriesSlug,
  title,
  excerpt,
  image,
  date,
  readingTime,
  showDateOnPage = true,
  showCategoryOnPage = true,
  showSeriesOnPage = true,
}: TopicCardProps) {
  const showCategory = showCategoryOnPage && Boolean(category && categorySlug);
  const showSeries = showSeriesOnPage && Boolean(series && seriesSlug);
  const showDate = showDateOnPage && Boolean(date);

  return (
    <article
      className="group block overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/30 hover:bg-white/[0.04]"
    >
      <div
        dir="ltr"
        className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_250px] md:items-center"
      >
        <div dir="rtl" className="text-right">
          {showCategory || showSeries ? (
            <div className="mb-4 flex items-center justify-between gap-3">
              {showCategory ? (
                <PublicGoldPill
                  href={`/topics?category=${encodeURIComponent(categorySlug)}`}
                >
                  {category}
                </PublicGoldPill>
              ) : <span />}

              {showSeries ? (
                <PublicGoldPill
                  href={`/topics?series=${encodeURIComponent(seriesSlug ?? "")}`}
                >
                  {series}
                </PublicGoldPill>
              ) : null}
            </div>
          ) : null}

          <Link href={`/topics/${slug}`} className="block space-y-4">
            <h2 className="text-2xl font-semibold leading-relaxed text-white transition-colors duration-300 group-hover:text-[#D8B87A] md:text-[1.25rem]">
              {title}
            </h2>

            <p className="leading-8 text-white/60">{excerpt}</p>

            {showDate || readingTime ? (
              <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-white/45">
                {showDate ? <span>{date}</span> : null}
                {showDate && readingTime ? <span>•</span> : null}
                {readingTime ? <span>{readingTime}</span> : null}
              </div>
            ) : null}
          </Link>
        </div>

        <Link
          href={`/topics/${slug}`}
          aria-label={`فتح موضوع ${title}`}
          className="relative block h-[190px] overflow-hidden rounded-[1.5rem]"
        >
          <TopicImage
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 250px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>
      </div>
    </article>
  );
}
