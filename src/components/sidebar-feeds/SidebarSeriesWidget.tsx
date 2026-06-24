import Image from "next/image";
import Link from "next/link";

import type { SidebarSeriesItem } from "../../lib/content-feeds/types";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarSeriesWidgetProps = {
  items: SidebarSeriesItem[];
  eyebrow: string;
  title: string;
  linkText: string;
};

export default function SidebarSeriesWidget({
  items,
  eyebrow,
  title,
  linkText,
}: SidebarSeriesWidgetProps) {
  if (!items.length) return null;

  return (
    <SidebarFeedPanel eyebrow={eyebrow} title={title}>
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            scroll={false}
            className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.05]"
          >
            <div className="relative h-28 overflow-hidden">
              <Image
                src={item.image}
                alt={item.title}
                fill
                sizes="(max-width: 1024px) 100vw, 340px"
                className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            </div>

            <div className="p-4">
              <h4 className="text-base font-semibold text-white">{item.title}</h4>

              {item.subtitle ? (
                <p className="mt-2 text-sm leading-6 text-white/50">{item.subtitle}</p>
              ) : null}

              <p className="mt-3 text-xs text-[#D8B87A]/80">{linkText}</p>
            </div>
          </Link>
        ))}
      </div>
    </SidebarFeedPanel>
  );
}
