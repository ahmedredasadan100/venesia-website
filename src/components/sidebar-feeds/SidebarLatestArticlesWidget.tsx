import Image from "next/image";
import Link from "next/link";

import type { SidebarArticleItem } from "../../lib/content-feeds/types";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarLatestArticlesWidgetProps = {
  items: SidebarArticleItem[];
  title: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
};

export default function SidebarLatestArticlesWidget({
  items,
  title,
  showImage = true,
  showDate = true,
  showExcerpt = false,
}: SidebarLatestArticlesWidgetProps) {
  if (!items.length) return null;

  return (
    <SidebarFeedPanel title={title}>
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.title}`}
            href={item.href}
            className="group flex gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0"
          >
            {showImage ? (
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="80px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            ) : null}

            <div>
              <h4 className="line-clamp-2 text-sm leading-6 text-white/70 transition group-hover:text-[#D8B87A]">
                {item.title}
              </h4>

              {showDate && item.date ? <p className="mt-1 text-xs text-white/35">{item.date}</p> : null}

              {showExcerpt && item.excerpt ? (
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-white/45">{item.excerpt}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </SidebarFeedPanel>
  );
}
