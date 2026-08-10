import Image from "next/image";
import Link from "next/link";

import type { SidebarArticleItem } from "../../lib/content-feeds/types";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarMostReadWidgetProps = {
  items: SidebarArticleItem[];
  eyebrow?: string | null;
  title: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
};

export default function SidebarMostReadWidget({
  items,
  eyebrow,
  title,
  showImage = true,
  showDate = true,
  showExcerpt = false,
}: SidebarMostReadWidgetProps) {
  if (!items.length) return null;

  return (
    <SidebarFeedPanel eyebrow={eyebrow ?? undefined} title={title}>
      <div className="space-y-4">
        {items.map((item, index) => (
          <Link
            key={`${item.href}-${item.title}`}
            href={item.href}
            className="group flex items-center gap-3"
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

            <div>
              <h4 className="line-clamp-2 text-sm leading-6 text-white/65 transition group-hover:text-[#D8B87A]">
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
