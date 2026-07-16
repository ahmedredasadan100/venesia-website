import { Fragment, type ReactNode } from "react";

import BreadcrumbModuleSection from "../modules/BreadcrumbModuleSection";
import DynamicHeroSection from "../sections/DynamicHeroSection";
import FeedModuleSection from "../feed-modules/FeedModuleSection";
import type { PageComposition, SlotEntry } from "../../lib/page-blocks/page-composition-types";
import { getSlotBlocks, getSlotEntries } from "../../lib/page-blocks/page-composition-utils";
import { PAGE_LAYOUT_SLOT_ORDER, type PageLayoutSlot } from "../../lib/page-blocks/layout-slots";
import { asBreadcrumbConfig } from "../../lib/page-blocks/configs";
import { getHeroConfig } from "../../lib/page-sections";
import type { HomepageProjectCard } from "../../lib/projects/types";
import { buildSlotRenderPlan } from "./build-slot-render-plan";

type HeroSlotContentProps = {
  composition: PageComposition;
  fallbackHero?: React.ReactNode;
};

export function HeroSlotContent({ composition, fallbackHero }: HeroSlotContentProps) {
  const heroEntry = composition.slots.hero.find((entry) => entry.kind === "hero");
  const breadcrumbBlock = getSlotBlocks(composition, "hero").find(
    (block) =>
      block.blockType === "breadcrumb" && (block.template.variant ?? "hero-inline") !== "standalone",
  );

  if (!heroEntry && fallbackHero) {
    return <>{fallbackHero}</>;
  }

  if (!heroEntry) return null;

  const heroConfig = getHeroConfig(heroEntry.hero);
  const breadcrumbNode = breadcrumbBlock ? (
    <BreadcrumbModuleSection
      config={asBreadcrumbConfig(breadcrumbBlock.template.config)}
      alignment={heroConfig.breadcrumbAlignment}
      bold={heroConfig.breadcrumbBold}
      currentLabelOverride={heroConfig.breadcrumbCurrentLabel || undefined}
      className=""
      compact
    />
  ) : null;

  return (
    <DynamicHeroSection
      hero={heroEntry.hero}
      belowTitle={breadcrumbNode}
    />
  );
}

/**
 * Render slot entries via an explicit plan:
 * blocks are batched so composite peer lookup works; feeds keep their sort_order.
 */
function renderOrderedSlotEntries(
  entries: SlotEntry[],
  homepageProjects?: HomepageProjectCard[],
) {
  const plan = buildSlotRenderPlan(entries, { homepageProjects });
  const nodes: ReactNode[] = [];

  for (const item of plan) {
    if (item.kind === "feed") {
      nodes.push(<FeedModuleSection key={item.key} module={item.module} />);
      continue;
    }

    nodes.push(<Fragment key={item.key}>{item.node}</Fragment>);
  }

  return nodes;
}

function renderSlotContent(
  entries: SlotEntry[],
  options?: { prefix?: ReactNode; suffix?: ReactNode; homepageProjects?: HomepageProjectCard[] },
) {
  const nodes = renderOrderedSlotEntries(entries, options?.homepageProjects);

  if (options?.prefix != null) {
    nodes.unshift(<Fragment key="slot-prefix">{options.prefix}</Fragment>);
  }

  if (options?.suffix != null) {
    nodes.push(<Fragment key="slot-suffix">{options.suffix}</Fragment>);
  }

  return nodes;
}

type PageSlotLayoutProps = {
  composition: PageComposition;
  /** Static hero fallback when CMS hero slot is empty */
  fallbackHero?: React.ReactNode;
  /** Content injected into the main column (e.g. topics listing grid) */
  mainAfter?: React.ReactNode;
  /** Optional prefix before sidebar slot entries (e.g. topics search panel) */
  sidebarPrefix?: React.ReactNode;
  /** Slots to skip (e.g. hero rendered by parent shell) */
  skipSlots?: PageLayoutSlot[];
  /** Published homepage projects for home-projects placement module */
  homepageProjects?: HomepageProjectCard[];
};

export default function PageSlotLayout({
  composition,
  fallbackHero,
  mainAfter,
  sidebarPrefix,
  skipSlots = [],
  homepageProjects,
}: PageSlotLayoutProps) {
  const skip = new Set(skipSlots);
  const isMainSidebar = composition.layoutMode === "main-sidebar";

  const renderSlotStack = (slot: PageLayoutSlot) => {
    if (skip.has(slot)) return null;

    if (slot === "hero") {
      return <HeroSlotContent key="slot-hero" composition={composition} fallbackHero={fallbackHero} />;
    }

    const entries = getSlotEntries(composition, slot);
    const showMainAfter = slot === "main" && mainAfter;
    if (!entries.length && !showMainAfter) return null;

    return (
      <div key={`slot-${slot}`} className="page-layout-slot" data-layout-slot={slot}>
        {renderSlotContent(entries, {
          suffix: showMainAfter ? mainAfter : undefined,
          homepageProjects,
        })}
      </div>
    );
  };

  if (isMainSidebar) {
    const sidebarEntries = getSlotEntries(composition, "sidebar");

    return (
      <div className="page-layout page-layout--main-sidebar">
        {!skip.has("hero") ? <HeroSlotContent composition={composition} fallbackHero={fallbackHero} /> : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:[direction:ltr]">
          <div dir="rtl" className="page-layout-slot page-layout-slot--main space-y-10" data-layout-slot="main">
            {renderSlotContent(getSlotEntries(composition, "main"), {
              suffix: mainAfter,
              homepageProjects,
            })}
          </div>

          <div dir="rtl" className="page-layout-slot page-layout-slot--sidebar space-y-6" data-layout-slot="sidebar">
            {renderSlotContent(sidebarEntries, { prefix: sidebarPrefix, homepageProjects })}
          </div>
        </div>

        {PAGE_LAYOUT_SLOT_ORDER.filter((slot) => slot === "bottom" || slot === "footer").map(renderSlotStack)}
      </div>
    );
  }

  return (
    <div className="page-layout page-layout--stack">
      {PAGE_LAYOUT_SLOT_ORDER.map(renderSlotStack)}
    </div>
  );
}
