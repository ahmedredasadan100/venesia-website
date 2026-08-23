"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { buildBreadcrumbsFromNavigation } from "../../lib/public-navigation";
import { asBreadcrumbConfig } from "../../lib/page-blocks/configs";
import type { BreadcrumbBlockConfig } from "../../lib/page-blocks/configs";
import { usePublicNavigation } from "../PublicNavigationProvider";
import PublicGoldPill from "../public/PublicGoldPill";

type BreadcrumbModuleSectionProps = {
  config?: BreadcrumbBlockConfig | unknown | null;
  className?: string;
  compact?: boolean;
  /**
   * Highest-priority override for the current (last) crumb — e.g. hero.breadcrumbCurrentLabel.
   * Falls back to Breadcrumb module config.currentLabelOverride, then navigation-derived label.
   */
  currentLabelOverride?: string;
};

type BreadcrumbNavItem = {
  label: string;
  href?: string;
};

function withoutHome(items: BreadcrumbNavItem[]) {
  if (!items.length) return items;
  const [first, ...rest] = items;
  if (first.href === "/" || first.label === "الرئيسية") {
    return rest;
  }
  return items;
}

export default function BreadcrumbModuleSection({
  config: rawConfig,
  className,
  compact = false,
  currentLabelOverride,
}: BreadcrumbModuleSectionProps) {
  const pathname = usePathname();
  const navItems = usePublicNavigation();
  const config = useMemo(() => asBreadcrumbConfig(rawConfig), [rawConfig]);

  const items = useMemo(() => {
    const labelOverride =
      currentLabelOverride?.trim() || config.currentLabelOverride?.trim() || "";

    if (config.source === "manual") {
      let manual: BreadcrumbNavItem[] = (config.manualItems ?? [])
        .filter((item) => item.label?.trim())
        .map((item) => ({ label: item.label!.trim(), href: item.href || undefined }));

      if (config.showHome === false) {
        manual = withoutHome(manual);
      }

      if (labelOverride && manual.length) {
        return [...manual.slice(0, -1), { label: labelOverride }];
      }

      return manual;
    }

    let fromNav = buildBreadcrumbsFromNavigation(pathname ?? "/", navItems);

    if (config.showHome === false) {
      fromNav = withoutHome(fromNav);
    }

    if (labelOverride && fromNav.length) {
      return [...fromNav.slice(0, -1), { label: labelOverride }];
    }

    return fromNav;
  }, [config, pathname, navItems, currentLabelOverride]);

  if (!items.length) return null;

  const navClassName = className ?? (compact ? "" : "mt-6");

  return (
    <nav className={[navClassName, "text-right"].filter(Boolean).join(" ")} aria-label="مسار التنقل">
      <ol
        className="flex flex-wrap items-center justify-start gap-2 text-sm text-white/62"
      >
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            <PublicGoldPill href={item.href} current={index === items.length - 1}>
              {item.label}
            </PublicGoldPill>

            {index < items.length - 1 ? <span className="text-[#D8B87A]/45">•</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
