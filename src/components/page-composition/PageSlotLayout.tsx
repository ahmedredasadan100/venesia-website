import { type ReactNode } from "react";

import DynamicHeroSection from "../sections/DynamicHeroSection";
import FeedModuleSection from "../feed-modules/FeedModuleSection";
import FeaturedModuleSection from "../featured/FeaturedModuleSection";
import { MediaSidebarWidget } from "../media-center/MediaSidebar";
import { renderMediaHubSections } from "../media-center/renderMediaHubSections";
import type {
  ListingRenderContext,
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
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import { isSearchPlatformTemplate } from "../../lib/page-blocks/search-platform-config";
import {
  resolveSlotModuleRegistration,
  type SlotModuleRendererKey,
} from "../../lib/page-composition/slot-module-registry";

export type SlotContentOptions = {
  prefix?: ReactNode;
  suffix?: ReactNode;
  homepageProjects?: HomepageProjectCard[];
  breadcrumbCurrentLabel?: string;
  publicPath?: string;
  searchParams?: SearchPlatformSearchParams;
  listingContext?: ListingRenderContext;
  suppressFeaturedDuringSearch?: boolean;
};

type SlotRendererInput = {
  item?: SlotRenderPlanItem;
  hero?: Extract<SlotEntry, { kind: "hero" }>;
  compositionFooter?: ReactNode;
  options?: SlotContentOptions;
};

type SlotRenderer = (input: SlotRendererInput) => ReactNode;

/**
 * Venisia Theme implementation for every renderer key declared by the
 * canonical Slot Module Registry. The registry chooses capability; this map
 * supplies the actual React renderer without redefining module inventory.
 */
export const SLOT_RENDERER_REGISTRY: Readonly<
  Record<SlotModuleRendererKey, SlotRenderer>
> = Object.freeze({
  hero: ({ hero, compositionFooter }) =>
    hero
      ? (
        <DynamicHeroSection
          hero={hero.hero}
          compositionFooter={compositionFooter}
        />
      )
      : null,
  block: ({ item }) => item?.kind === "module" ? item.node : null,
  feed: ({ item }) =>
    item?.kind === "feed" ? <FeedModuleSection module={item.module} /> : null,
  featured: ({ item }) =>
    item?.kind === "featured" ? (
      <FeaturedModuleSection module={item.module} />
    ) : null,
  "media-sidebar": ({ item }) =>
    item?.kind === "media-sidebar" ? (
      <MediaSidebarWidget widget={item.widget} />
    ) : null,
  "media-hub": ({ item, options }) =>
    item?.kind === "media-hub"
      ? renderMediaHubSections([item.module], {
          listingContext: options?.listingContext,
        })[0] ?? null
      : null,
});

function resolvePlanItemRendererKey(
  item: SlotRenderPlanItem,
): SlotModuleRendererKey | null {
  return resolveSlotModuleRegistration(item.moduleKind)?.rendererKey ?? null;
}

function renderPlanItem(
  item: SlotRenderPlanItem,
  options: SlotContentOptions,
) {
  const rendererKey = resolvePlanItemRendererKey(item);
  return rendererKey
    ? SLOT_RENDERER_REGISTRY[rendererKey]({ item, options })
    : null;
}

function buildContextualSlotRenderPlan(
  entries: SlotEntry[],
  options: SlotContentOptions,
) {
  return buildSlotRenderPlan(entries, {
    homepageProjects: options.homepageProjects,
    breadcrumbCurrentLabel: options.breadcrumbCurrentLabel,
    publicPath: options.publicPath,
    searchParams: options.searchParams,
    listingContext: options.listingContext,
    suppressFeaturedDuringSearch: options.suppressFeaturedDuringSearch,
  });
}

export function hasRenderableSlotEntries(
  entries: SlotEntry[],
  options: SlotContentOptions = {},
) {
  return buildContextualSlotRenderPlan(entries, options).length > 0;
}

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
 * The current Venisia Theme renderer for every non-Hero Page Composition
 * entry. Page Composition supplies semantic Position/order/visibility, this
 * Theme renderer owns outer width and geometry, and Module renderers own their
 * internal presentation.
 */
function renderOrderedPlanItems(
  plan: SlotRenderPlanItem[],
  options: SlotContentOptions,
) {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < plan.length) {
    const item = plan[index];
    const rendererKey = resolvePlanItemRendererKey(item);

    if (rendererKey === "media-hub") {
      const run: Extract<SlotRenderPlanItem, { kind: "media-hub" }>[] = [];
      while (
        index < plan.length &&
        resolvePlanItemRendererKey(plan[index]) === "media-hub"
      ) {
        run.push(
          plan[index] as Extract<SlotRenderPlanItem, { kind: "media-hub" }>,
        );
        index += 1;
      }
      const mediaNodes = run.flatMap((entry) => {
        const node = renderPlanItem(entry, options);
        return node == null ? [] : [node];
      });
      if (mediaNodes.length) {
        nodes.push(
          <SlotModuleContainer
            key={`media-hub-group-${run.map((entry) => entry.assignmentId).join("-")}`}
            source="assignment"
          >
            {renderVenesiaThemeMediaHubNodes(mediaNodes)}
          </SlotModuleContainer>,
        );
      }
      continue;
    }

    const node = renderPlanItem(item, options);
    if (node != null) {
      nodes.push(
        <SlotModuleContainer key={item.key} source="assignment">
          {node}
        </SlotModuleContainer>,
      );
    }
    index += 1;
  }

  return nodes;
}

function renderOrderedSlotEntries(
  entries: SlotEntry[],
  options: SlotContentOptions = {},
) {
  return renderOrderedPlanItems(
    buildContextualSlotRenderPlan(entries, options),
    options,
  );
}

export function PageSlotContent({
  entries,
  prefix,
  suffix,
  homepageProjects,
  breadcrumbCurrentLabel,
  publicPath,
  searchParams,
  listingContext,
  suppressFeaturedDuringSearch,
}: {
  entries: SlotEntry[];
} & SlotContentOptions) {
  const nodes = renderOrderedSlotEntries(entries, {
    homepageProjects,
    breadcrumbCurrentLabel,
    publicPath,
    searchParams,
    listingContext,
    suppressFeaturedDuringSearch,
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
  homepageProjects?: HomepageProjectCard[];
  breadcrumbCurrentLabel?: string;
  publicPath?: string;
  searchParams?: SearchPlatformSearchParams;
  listingContext?: ListingRenderContext;
  suppressFeaturedDuringSearch?: boolean;
};

export function HeroSlotContent({
  composition,
  fallbackHero,
  homepageProjects,
  breadcrumbCurrentLabel,
  publicPath,
  searchParams,
  listingContext,
  suppressFeaturedDuringSearch,
}: HeroSlotContentProps) {
  const resolvedHomepageProjects = homepageProjects
    ?? composition.homepageProjects
    ?? undefined;
  const resolvedListingContext = listingContext
    ? {
        ...listingContext,
        excludeContentIds: composition.featuredModules.flatMap((module) =>
          module.items.map((item) => item.id),
        ),
        showCompositionError: composition.hasCompositionError,
      }
    : undefined;
  const slotContentOptions = {
    homepageProjects: resolvedHomepageProjects,
    breadcrumbCurrentLabel,
    publicPath,
    searchParams,
    listingContext: resolvedListingContext,
    suppressFeaturedDuringSearch,
  } satisfies SlotContentOptions;
  const heroEntry = composition.slots.hero.find((entry) => entry.kind === "hero");
  const peerNodes = renderOrderedSlotEntries(
    getSlotEntries(composition, "hero"),
    slotContentOptions,
  );
  const peerContent = peerNodes.length ? <>{peerNodes}</> : undefined;
  const usesStandaloneHeroPresentation =
    heroEntry?.hero.variant === "home-cinematic" ||
    heroEntry?.hero.variant === "projects-hub";
  const renderPeersInHeroFooter = Boolean(
    heroEntry && !usesStandaloneHeroPresentation,
  );
  const heroNode = heroEntry
    ? SLOT_RENDERER_REGISTRY.hero({
        hero: heroEntry,
        compositionFooter: renderPeersInHeroFooter ? peerContent : undefined,
        options: slotContentOptions,
      })
    : composition.heroVisibility === "none"
      ? fallbackHero
      : null;
  const renderPeersAfterHero =
    !renderPeersInHeroFooter && peerNodes.length > 0;
  if (!heroNode && !peerNodes.length) return null;

  return (
    <div
      className="page-layout-slot"
      data-layout-slot="hero"
      data-page-fixed-hero={heroEntry ? "singleton" : undefined}
    >
      {heroNode}
      {renderPeersAfterHero ? (
        <div
          className="mx-auto w-full max-w-7xl px-6 pt-6"
          data-hero-composition-peers="ordered-below-fixed-hero"
        >
          {peerNodes}
        </div>
      ) : null}
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
  /** Exact public path consumed by structural modules such as Search. */
  publicPath?: string;
  /** Request URL state consumed by structural modules without changing Composition. */
  searchParams?: SearchPlatformSearchParams;
  /** Intrinsic request context required by assigned collection/listing modules. */
  listingContext?: ListingRenderContext;
};

export function hasActiveSearchPlatformQuery(
  composition: PageComposition,
  searchParams: SearchPlatformSearchParams | undefined,
) {
  const rawQuery = searchParams?.q;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
  if (!query?.trim()) return false;

  return Object.values(composition.slots).some((entries) =>
    entries.some(
      (entry) =>
        entry.kind === "block" &&
        isSearchPlatformTemplate(
          entry.block.template.slug,
          entry.block.template.variant,
        ),
    ),
  );
}

export default function PageSlotLayout({
  composition,
  fallbackHero,
  mainAfter,
  sidebarPrefix,
  skipSlots = [],
  homepageProjects,
  breadcrumbCurrentLabel,
  publicPath,
  searchParams,
  listingContext,
}: PageSlotLayoutProps) {
  const skip = new Set(skipSlots);
  const suppressFeaturedDuringSearch = hasActiveSearchPlatformQuery(
    composition,
    searchParams,
  );
  const resolvedHomepageProjects = homepageProjects
    ?? composition.homepageProjects
    ?? undefined;
  const resolvedListingContext = listingContext
    ? {
        ...listingContext,
        excludeContentIds: composition.featuredModules.flatMap((module) =>
          module.items.map((item) => item.id),
        ),
        showCompositionError: composition.hasCompositionError,
      }
    : undefined;
  const sidebarEntries = getSlotEntries(composition, "sidebar");
  const slotContentOptions = {
    homepageProjects: resolvedHomepageProjects,
    breadcrumbCurrentLabel,
    publicPath,
    searchParams,
    listingContext: resolvedListingContext,
    suppressFeaturedDuringSearch,
  } satisfies SlotContentOptions;
  const hasSidebarContent =
    !skip.has("sidebar") &&
    Boolean(
      hasRenderableSlotEntries(sidebarEntries, slotContentOptions) ||
      sidebarPrefix,
    );
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
          homepageProjects={resolvedHomepageProjects}
          breadcrumbCurrentLabel={breadcrumbCurrentLabel}
          publicPath={publicPath}
          searchParams={searchParams}
          listingContext={listingContext}
          suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
        />
      );
    }

    const entries = getSlotEntries(composition, slot);
    const suffix = slot === "main" ? mainAfter : undefined;
    const prefix = slot === "sidebar" ? sidebarPrefix : undefined;
    if (
      !hasRenderableSlotEntries(entries, slotContentOptions) &&
      prefix == null &&
      suffix == null
    ) return null;

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
            homepageProjects={resolvedHomepageProjects}
            breadcrumbCurrentLabel={breadcrumbCurrentLabel}
            publicPath={publicPath}
            searchParams={searchParams}
            listingContext={resolvedListingContext}
            suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
          />
        </div>
      </div>
    );
  };

  if (isMainSidebar) {
    return (
      <div
        className="page-layout page-layout--main-sidebar"
        data-page-layout-contract="theme-owned"
      >
        {!skip.has("hero") ? (
          <HeroSlotContent
            composition={composition}
            fallbackHero={fallbackHero}
            homepageProjects={resolvedHomepageProjects}
            breadcrumbCurrentLabel={breadcrumbCurrentLabel}
            publicPath={publicPath}
            searchParams={searchParams}
            listingContext={listingContext}
            suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
          />
        ) : null}

        <div className="mx-auto w-full max-w-7xl px-6 pt-10" data-page-layout-body>
          <div className="page-layout-main-sidebar-grid grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:[direction:ltr]">
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
                  homepageProjects={resolvedHomepageProjects}
                  breadcrumbCurrentLabel={breadcrumbCurrentLabel}
                  publicPath={publicPath}
                  searchParams={searchParams}
                  listingContext={resolvedListingContext}
                  suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
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
                  homepageProjects={resolvedHomepageProjects}
                  breadcrumbCurrentLabel={breadcrumbCurrentLabel}
                  publicPath={publicPath}
                  searchParams={searchParams}
                  listingContext={resolvedListingContext}
                  suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
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
      data-page-layout-contract="theme-owned"
    >
      {VENISIA_THEME_REGION_RENDER_ORDER.map(renderSlotStack)}
    </div>
  );
}
