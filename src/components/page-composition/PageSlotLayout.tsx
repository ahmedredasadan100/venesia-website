import { type ReactNode } from "react";

import DynamicHeroSection from "../sections/DynamicHeroSection";
import FeedModuleSection from "../feed-modules/FeedModuleSection";
import { MediaSidebarWidget } from "../media-center/MediaSidebar";
import { renderMediaHubSections } from "../media-center/renderMediaHubSections";
import type {
  PageComposition,
  SlotEntry,
} from "../../lib/page-blocks/page-composition-types";
import { getSlotEntries } from "../../lib/page-blocks/page-composition-utils";
import {
  type PageLayoutSlot,
} from "../../lib/page-blocks/layout-slots";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import {
  buildSlotRenderPlan,
  type SlotRenderPlanItem,
} from "./build-slot-render-plan";
import { VENISIA_THEME_REGION_RENDER_ORDER } from "./venisia-theme-regions";
import { renderVenesiaThemeMediaHubNodes } from "./VenesiaThemeMediaHubLayout";

type SlotContentOptions = {
  prefix?: ReactNode;
  suffix?: ReactNode;
  homepageProjects?: HomepageProjectCard[];
  breadcrumbCurrentLabel?: string;
};

function SlotModuleContainer({
  children,
  source,
}: {
  children: ReactNode;
  source: "assignment" | "prefix" | "suffix";
}) {
  return (
    <div
      className="@container/slot-module min-w-0"
      data-slot-module-container={source}
    >
      {children}
    </div>
  );
}

/**
 * One renderer for every non-Hero Page Composition entry. Module renderers
 * provide presentation only; the surrounding Position owns width and geometry.
 */
function renderOrderedSlotEntries(
  entries: SlotEntry[],
  options: SlotContentOptions = {},
) {
  const plan = buildSlotRenderPlan(entries, {
    homepageProjects: options.homepageProjects,
    breadcrumbCurrentLabel: options.breadcrumbCurrentLabel,
  });
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < plan.length) {
    const item = plan[index];

    if (item.kind === "media-hub") {
      const run: Extract<SlotRenderPlanItem, { kind: "media-hub" }>[] = [];
      while (index < plan.length && plan[index].kind === "media-hub") {
        run.push(
          plan[index] as Extract<SlotRenderPlanItem, { kind: "media-hub" }>,
        );
        index += 1;
      }
      nodes.push(
        <SlotModuleContainer
          key={`media-hub-group-${run.map((entry) => entry.assignmentId).join("-")}`}
          source="assignment"
        >
          {renderVenesiaThemeMediaHubNodes(
            renderMediaHubSections(run.map((entry) => entry.module)),
          )}
        </SlotModuleContainer>,
      );
      continue;
    }

    if (item.kind === "feed") {
      nodes.push(
        <SlotModuleContainer key={item.key} source="assignment">
          <FeedModuleSection module={item.module} />
        </SlotModuleContainer>,
      );
      index += 1;
      continue;
    }

    if (item.kind === "media-sidebar") {
      nodes.push(
        <SlotModuleContainer key={item.key} source="assignment">
          <MediaSidebarWidget widget={item.widget} />
        </SlotModuleContainer>,
      );
      index += 1;
      continue;
    }

    nodes.push(
      <SlotModuleContainer key={item.key} source="assignment">
        {item.node}
      </SlotModuleContainer>,
    );
    index += 1;
  }

  return nodes;
}

export function PageSlotContent({
  entries,
  prefix,
  suffix,
  homepageProjects,
  breadcrumbCurrentLabel,
}: {
  entries: SlotEntry[];
} & SlotContentOptions) {
  const nodes = renderOrderedSlotEntries(entries, {
    homepageProjects,
    breadcrumbCurrentLabel,
  });

  if (prefix != null) {
    nodes.unshift(
      <SlotModuleContainer key="slot-prefix" source="prefix">
        {prefix}
      </SlotModuleContainer>,
    );
  }
  if (suffix != null) {
    nodes.push(
      <SlotModuleContainer key="slot-suffix" source="suffix">
        {suffix}
      </SlotModuleContainer>,
    );
  }

  return <>{nodes}</>;
}

type HeroSlotContentProps = {
  composition: PageComposition;
  fallbackHero?: ReactNode;
  breadcrumbCurrentLabel?: string;
};

export function HeroSlotContent({
  composition,
  fallbackHero,
  breadcrumbCurrentLabel,
}: HeroSlotContentProps) {
  const heroEntry = composition.slots.hero.find((entry) => entry.kind === "hero");
  const heroEntries = getSlotEntries(composition, "hero");
  const slotContent = heroEntries.length ? (
    <PageSlotContent
      entries={heroEntries}
      breadcrumbCurrentLabel={breadcrumbCurrentLabel}
    />
  ) : null;

  if (!heroEntry) {
    if (!fallbackHero && !slotContent) return null;
    return (
      <div className="page-layout-slot" data-layout-slot="hero">
        {fallbackHero}
        {slotContent ? (
          <div className="mx-auto w-full max-w-7xl px-6 pt-6">
            {slotContent}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page-layout-slot" data-layout-slot="hero">
      <DynamicHeroSection
        hero={heroEntry.hero}
        compositionFooter={slotContent}
      />
    </div>
  );
}

type PageSlotLayoutProps = {
  composition: PageComposition;
  /** Static hero fallback when CMS hero slot is empty. */
  fallbackHero?: ReactNode;
  /** Content injected into the main region after assigned modules. */
  mainAfter?: ReactNode;
  /** Optional content before assigned sidebar modules. */
  sidebarPrefix?: ReactNode;
  /** Slots already owned by an explicit template shell. */
  skipSlots?: PageLayoutSlot[];
  /** Published homepage projects for the existing home-projects renderer. */
  homepageProjects?: HomepageProjectCard[];
  /** Dynamic detail label consumed by the shared Breadcrumb renderer. */
  breadcrumbCurrentLabel?: string;
};

export default function PageSlotLayout({
  composition,
  fallbackHero,
  mainAfter,
  sidebarPrefix,
  skipSlots = [],
  homepageProjects,
  breadcrumbCurrentLabel,
}: PageSlotLayoutProps) {
  const skip = new Set(skipSlots);
  const sidebarEntries = getSlotEntries(composition, "sidebar");
  const hasSidebarContent =
    !skip.has("sidebar") && Boolean(sidebarEntries.length || sidebarPrefix);
  // Venesia Theme decision only. Page Composition exposes a semantic sidebar
  // Region and remains unaware whether a Theme renders it as a column, drawer,
  // stack, or any other visual treatment.
  const isMainSidebar = hasSidebarContent;

  const renderSlotStack = (slot: PageLayoutSlot) => {
    if (skip.has(slot)) return null;

    if (slot === "hero") {
      return (
        <HeroSlotContent
          key="slot-hero"
          composition={composition}
          fallbackHero={fallbackHero}
          breadcrumbCurrentLabel={breadcrumbCurrentLabel}
        />
      );
    }

    const entries = getSlotEntries(composition, slot);
    const suffix = slot === "main" ? mainAfter : undefined;
    const prefix = slot === "sidebar" ? sidebarPrefix : undefined;
    if (!entries.length && prefix == null && suffix == null) return null;

    return (
      <div
        key={`slot-${slot}`}
        className="page-layout-slot"
        data-layout-slot={slot}
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <PageSlotContent
            entries={entries}
            prefix={prefix}
            suffix={suffix}
            homepageProjects={homepageProjects}
            breadcrumbCurrentLabel={breadcrumbCurrentLabel}
          />
        </div>
      </div>
    );
  };

  if (isMainSidebar) {
    return (
      <div
        className="page-layout page-layout--main-sidebar"
        data-page-layout-contract="slot-owned"
      >
        {!skip.has("hero") ? (
          <HeroSlotContent
            composition={composition}
            fallbackHero={fallbackHero}
            breadcrumbCurrentLabel={breadcrumbCurrentLabel}
          />
        ) : null}

        <div className="mx-auto w-full max-w-7xl px-6 pt-10" data-page-layout-body>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:[direction:ltr]">
            {!skip.has("main") ? (
              <section
                dir="rtl"
                className="page-layout-slot page-layout-slot--main min-w-0"
                data-layout-slot="main"
                aria-label="المحتوى الرئيسي"
              >
                <PageSlotContent
                  entries={getSlotEntries(composition, "main")}
                  suffix={mainAfter}
                  homepageProjects={homepageProjects}
                  breadcrumbCurrentLabel={breadcrumbCurrentLabel}
                />
              </section>
            ) : null}

            {!skip.has("sidebar") ? (
              <aside
                dir="rtl"
                className="page-layout-slot page-layout-slot--sidebar grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-6 xl:block xl:space-y-6"
                data-layout-slot="sidebar"
              >
                <PageSlotContent
                  entries={sidebarEntries}
                  prefix={sidebarPrefix}
                  homepageProjects={homepageProjects}
                  breadcrumbCurrentLabel={breadcrumbCurrentLabel}
                />
              </aside>
            ) : null}
          </div>
        </div>

        {VENISIA_THEME_REGION_RENDER_ORDER.filter(
          (slot) => slot === "bottom" || slot === "footer",
        ).map(renderSlotStack)}
      </div>
    );
  }

  return (
    <div
      className="page-layout page-layout--stack"
      data-page-layout-contract="slot-owned"
    >
      {VENISIA_THEME_REGION_RENDER_ORDER.map(renderSlotStack)}
    </div>
  );
}
