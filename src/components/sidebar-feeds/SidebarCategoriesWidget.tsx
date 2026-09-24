import Link from "next/link";

import type { SidebarCategoryItem } from "../../lib/content-feeds/types";
import {
  DEFAULT_FEED_CATEGORY_CARD_PRESENTATION,
  type FeedCategoryCardPresentation,
  type FeedCategoriesPresentationVariant,
} from "../../lib/feed-modules/types";
import {
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
} from "../../lib/page-blocks/configs";
import { SidebarFeedPanel } from "./SidebarFeedPanel";
import FeedGroupedList from "../feed-modules/FeedGroupedList";
import { feedGridColumnsClass } from "../feed-modules/feed-presentation-layout";

type SidebarCategoriesWidgetProps = {
  items: SidebarCategoryItem[];
  eyebrow: string;
  title: string;
  cardFormatting?: FeedCategoryCardPresentation;
  presentationVariant: FeedCategoriesPresentationVariant;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
};

export default function SidebarCategoriesWidget({
  items,
  eyebrow,
  title,
  cardFormatting,
  presentationVariant,
  formatting,
}: SidebarCategoriesWidgetProps) {
  if (!items.length) return null;
  const resolvedCardFormatting =
    cardFormatting ?? DEFAULT_FEED_CATEGORY_CARD_PRESENTATION;
  if (!resolvedCardFormatting.showCategory && !resolvedCardFormatting.showCount) {
    return null;
  }
  const cards = items.map((item) => (
    <Link
      key={`${item.href}-${item.name}`}
      href={item.href}
      scroll={false}
      className="group grid h-full min-w-0 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/65 transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.06] hover:text-white"
      data-feed-category-card=""
    >
      {resolvedCardFormatting.showCategory ? (
        <span
          className={`${resolvedCardFormatting.categoryBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.categoryAlignment)}`.trim()}
          data-feed-category-name=""
        >
          {item.name}
        </span>
      ) : null}
      {resolvedCardFormatting.showCount ? (
        <span
          className={`w-fit rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/35 transition group-hover:border-[#D8B87A]/35 group-hover:text-[#D8B87A] ${resolvedCardFormatting.countBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.countAlignment)} ${pageBlockTextPlacementClass(resolvedCardFormatting.countAlignment)}`.trim()}
          data-feed-category-count=""
        >
          {item.count}
        </span>
      ) : null}
    </Link>
  ));

  return (
    <SidebarFeedPanel eyebrow={eyebrow} title={title} formatting={formatting}>
      {presentationVariant.layout === "list" ? (
        <FeedGroupedList
          itemsPerGroup={presentationVariant.list.itemsPerGroup}
          showDots={presentationVariant.list.showDots}
          intervalSeconds={presentationVariant.list.intervalSeconds}
          itemLabel="التصنيفات"
          className="space-y-3"
        >
          {cards}
        </FeedGroupedList>
      ) : (
        <div
          className={`grid gap-3 ${feedGridColumnsClass(presentationVariant.columns)}`}
          data-feed-presentation="grid"
          data-feed-grid-columns={presentationVariant.columns}
        >
          {cards}
        </div>
      )}
    </SidebarFeedPanel>
  );
}
