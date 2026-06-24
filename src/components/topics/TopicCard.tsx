import TopicImage from "./TopicImage";
import Link from "next/link";

type TopicCardProps = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  readingTime: string;
};

export default function TopicCard({
  slug,
  category,
  title,
  excerpt,
  image,
  date,
  readingTime,
}: TopicCardProps) {
  return (
    <Link
      href={`/topics/${slug}`}
      className="group block overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/30 hover:bg-white/[0.04]"
    >
      <article
        dir="ltr"
        className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_250px] md:items-center"
      >
        <div dir="rtl" className="space-y-4 text-right">
          <p className="text-sm font-medium text-[#D8B87A]">{category}</p>

          <h2 className="text-2xl font-semibold leading-relaxed text-white transition-colors duration-300 group-hover:text-[#D8B87A] md:text-[1.65rem]">
            {title}
          </h2>

          <p className="leading-8 text-white/60">{excerpt}</p>

          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-white/45">
            <span>{date}</span>
            <span>•</span>
            <span>{readingTime}</span>
          </div>
        </div>

        <div className="relative h-[190px] overflow-hidden rounded-[1.5rem]">
         <TopicImage
  src={image}
  alt={title}
  fill
  sizes="(max-width: 768px) 100vw, 250px"
  className="object-cover transition-transform duration-700 group-hover:scale-105"
/>
        </div>
      </article>
    </Link>
  );
}