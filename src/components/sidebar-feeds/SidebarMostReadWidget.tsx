import Image from "next/image";
import Link from "next/link";

import type { SidebarArticleItem } from "../../lib/content-feeds/types";
import {
  DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
  type FeedArticleCardPresentation,
} from "../../lib/feed-modules/types";
import { pageBlockTextAlignClass } from "../../lib/page-blocks/configs";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarMostReadWidgetProps = {
  items: SidebarArticleItem[];
  eyebrow?: string | null;
  title: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
  cardFormatting?: FeedArticleCardPresentation;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
};

export default function SidebarMostReadWidget({
  items,
  eyebrow,
  title,
  showImage = true,
  showDate = true,
  showExcerpt = false,
  cardFormatting,
  formatting,
}: SidebarMostReadWidgetProps) {
  if (!items.length) return null;

  const resolvedCardFormatting = cardFormatting ?? {
    ...DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
    showDate,
    showExcerpt,
  };

  return (
    <SidebarFeedPanel eyebrow={eyebrow ?? undefined} title={title} formatting={formatting}>
      <div className="space-y-4">
        {items.map((item, index) => {
          const hasDate =
            resolvedCardFormatting.showDate && Boolean(item.date?.trim());
          const hasExcerpt =
            resolvedCardFormatting.showExcerpt && Boolean(item.excerpt?.trim());
          const hasText =
            resolvedCardFormatting.showTitle || hasDate || hasExcerpt;

          return (
            <Link
              key={`${item.href}-${item.title}`}
              href={item.href}
              className="group flex items-center gap-3"
              data-feed-article-card="popular"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/25 text-xs text-[#D8B87A]">
                {index + 1}
              </span>

              {showImage ? (
                <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="64px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ) : null}

              {hasText ? (
                <div className="min-w-0 flex-1 space-y-1">
                  {resolvedCardFormatting.showTitle ? (
                    <h4
                      className={`line-clamp-2 text-sm leading-6 text-white/65 transition group-hover:text-[#D8B87A] ${resolvedCardFormatting.titleBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.titleAlignment)}`.trim()}
                      data-feed-article-title=""
                    >
                      {item.title}
                    </h4>
                  ) : null}

                  {hasDate ? (
                    <p
                      className={`text-xs text-white/35 ${resolvedCardFormatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.dateAlignment)}`.trim()}
                      data-feed-article-date=""
                    >
                      {item.date}
                    </p>
                  ) : null}

                  {hasExcerpt ? (
                    <p
                      className={`line-clamp-2 text-xs leading-6 text-white/45 ${resolvedCardFormatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.excerptAlignment)}`.trim()}
                      data-feed-article-excerpt=""
                    >
                      {item.excerpt}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </SidebarFeedPanel>
  );
}
