import Link from "next/link";

import type { SidebarCategoryItem } from "../../lib/content-feeds/types";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarCategoriesWidgetProps = {
  items: SidebarCategoryItem[];
  eyebrow: string;
  title: string;
};

export default function SidebarCategoriesWidget({
  items,
  eyebrow,
  title,
}: SidebarCategoriesWidgetProps) {
  if (!items.length) return null;

  return (
    <SidebarFeedPanel eyebrow={eyebrow} title={title}>
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.name}`}
            href={item.href}
            scroll={false}
            className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/65 transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.06] hover:text-white"
          >
            <span>{item.name}</span>

            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/35 transition group-hover:border-[#D8B87A]/35 group-hover:text-[#D8B87A]">
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </SidebarFeedPanel>
  );
}
