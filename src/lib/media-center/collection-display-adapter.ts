import type { MediaContentItem } from "./types";
import {
  resolveCollectionModuleItemDisplay,
  type CollectionDisplayOverrides,
} from "../page-blocks/configs";

/** Domain adapter only: maps canonical Media item visibility into the shared
 * Collection Modules Display Formatting Capability without owning defaults,
 * parsing, controls, or presentation behavior. */
export function resolveMediaCollectionItemDisplay(
  display: CollectionDisplayOverrides,
  item: MediaContentItem,
  options: { showDateWhenAvailable?: boolean } = {},
) {
  return resolveCollectionModuleItemDisplay(
    display,
    {
      title: item.showTitleOnPage,
      image: item.showImageOnPage,
      excerpt: item.showExcerptOnPage,
      date: item.showDateOnPage || Boolean(options.showDateWhenAvailable),
      category: item.showCategoryOnPage,
      series: item.showSeriesOnPage,
    },
    {
      title: item.title,
      image: item.image,
      excerpt: item.excerpt,
      date: item.date,
      category: item.category,
      series: item.series ?? "",
    },
  );
}
