import {
  DEFAULT_COLLECTION_DETAILS_ACTION,
  type TopicsListingDisplayOverrides,
} from "../../lib/page-blocks/configs";
import { CollectionListingCard } from "../collection-modules/CollectionListingPresenter";
import TopicImage from "./TopicImage";

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
  displayOverrides?: TopicsListingDisplayOverrides;
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
  displayOverrides,
}: TopicCardProps) {
  const href = `/topics/${slug}`;

  return (
    <CollectionListingCard
      href={href}
      title={title}
      excerpt={excerpt}
      date={date}
      supplementalMeta={readingTime}
      category={
        category && categorySlug
          ? {
              label: category,
              href: `/topics?category=${encodeURIComponent(categorySlug)}`,
            }
          : undefined
      }
      series={
        series && seriesSlug
          ? {
              label: series,
              href: `/topics?series=${encodeURIComponent(seriesSlug)}`,
            }
          : undefined
      }
      display={{
        title: displayOverrides?.title ?? true,
        image: displayOverrides?.image ?? true,
        excerpt: displayOverrides?.excerpt ?? true,
        date: displayOverrides?.date ?? showDateOnPage,
        category: displayOverrides?.category ?? showCategoryOnPage,
        series: displayOverrides?.series ?? showSeriesOnPage,
        details: displayOverrides?.details ?? DEFAULT_COLLECTION_DETAILS_ACTION,
      }}
      image={
        <TopicImage
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 250px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      }
    />
  );
}
