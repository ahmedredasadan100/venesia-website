import Image from "next/image";
import Link from "next/link";

import type { PublicContentSummary } from "../../lib/content/public-content-read/contract";
import {
  resolveFeaturedItemDisplay,
  type FeaturedPresentation,
  type ResolvedFeaturedModule,
} from "../../lib/featured-modules/contract";
import {
  type ContentDisplayOptions,
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  resolvePageBlockTextFormat,
} from "../../lib/page-blocks/configs";
import CollectionSectionHeader from "../collection-modules/CollectionSectionHeader";
import PublicGoldPill from "../public/PublicGoldPill";
import FeaturedCarousel from "./FeaturedCarousel";
import FeaturedContentCard from "./FeaturedContentCard";

function FeaturedEditorialSecondaryCard({
  item,
  display,
  presentation,
}: {
  item: PublicContentSummary;
  display: ContentDisplayOptions;
  presentation: FeaturedPresentation;
}) {
  const resolvedDisplay = resolveFeaturedItemDisplay(display, item);
  const showTaxonomy = resolvedDisplay.category || resolvedDisplay.series;
  const showMetadata =
    showTaxonomy || resolvedDisplay.date;
  const categoryFormat = resolvePageBlockTextFormat(presentation, "category");
  const seriesFormat = resolvePageBlockTextFormat(presentation, "series");
  const excerptFormat = resolvePageBlockTextFormat(presentation, "excerpt");
  const dateFormat = resolvePageBlockTextFormat(presentation, "date");

  return (
    <Link href={item.href} className="group block h-full">
      <article
        className={`grid h-full gap-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-3 transition duration-500 hover:border-[#D8B87A]/30 ${
          resolvedDisplay.image
            ? "grid-cols-[112px_minmax(0,1fr)]"
            : "grid-cols-1"
        }`}
      >
        {resolvedDisplay.image ? (
          <div className="relative min-h-[98px] overflow-hidden rounded-[1rem]">
            <Image
              src={item.image}
              alt={item.imageAlt || item.title}
              fill
              sizes="112px"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          </div>
        ) : null}

        <div className="min-w-0 self-center">
          {showMetadata ? (
            <div
              data-featured-metadata-area=""
              className="grid gap-1.5 text-sm font-medium leading-5 text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
            >
              {showTaxonomy ? (
                <div
                  data-featured-taxonomy-stack=""
                  className="grid -translate-y-2 gap-1"
                >
                  {resolvedDisplay.category ? (
                    <span
                      className={`block w-full ${pageBlockTextAlignClass(categoryFormat.alignment)}`}
                    >
                      <PublicGoldPill>
                        <span
                          className={`text-sm leading-5 ${categoryFormat.bold ? "font-bold" : "font-medium"}`}
                        >
                          {item.category}
                        </span>
                      </PublicGoldPill>
                    </span>
                  ) : null}
                  {resolvedDisplay.series ? (
                    <span
                      className={`block w-full text-sm leading-5 text-[#D8B87A] ${seriesFormat.bold ? "font-bold" : "font-medium"} ${pageBlockTextAlignClass(seriesFormat.alignment)}`.trim()}
                    >
                      {item.series}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {resolvedDisplay.date ? (
                <span
                  className={`block w-full ${showTaxonomy ? "border-t border-white/10 pt-1.5" : ""} leading-5 ${dateFormat.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(dateFormat.alignment)}`.trim()}
                >
                  {item.date}
                </span>
              ) : null}
            </div>
          ) : null}
          {resolvedDisplay.title ? (
            <h3 className="mt-2 min-h-12 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-[#D8B87A]">
              {item.title}
            </h3>
          ) : null}
          {resolvedDisplay.excerpt ? (
            <p
              className={`mt-2 min-h-10 line-clamp-2 text-xs leading-5 text-white/48 ${excerptFormat.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(excerptFormat.alignment)} ${pageBlockTextPlacementClass(excerptFormat.alignment)}`}
            >
              {item.excerpt}
            </p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

export default function FeaturedModuleSection({
  module,
}: {
  module: ResolvedFeaturedModule;
}) {
  const { items, presentation } = module;
  if (!items.length) return null;
  const [primary, ...secondary] = items;

  if (presentation.variant === "editorial") {
    return (
      <section
        className="relative py-12"
        data-featured-module=""
        data-featured-presentation={presentation.variant}
        data-featured-source={module.source.kind}
      >
        <div className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] @2xl/slot-module:p-8">
          <CollectionSectionHeader presentation={presentation} />
          <div className="grid items-stretch gap-x-5 gap-y-3 @2xl/slot-module:grid-cols-[0.9fr_1.1fr]">
            {secondary.length ? (
              <div className="order-2 grid h-full auto-rows-fr gap-3 @2xl/slot-module:col-start-1 @2xl/slot-module:row-start-1">
                {secondary.slice(0, 3).map((item) => (
                  <FeaturedEditorialSecondaryCard
                    key={item.id}
                    item={item}
                    display={module.display}
                    presentation={presentation}
                  />
                ))}
              </div>
            ) : null}
            <div className="order-1 h-full @2xl/slot-module:col-start-2 @2xl/slot-module:row-start-1">
              <FeaturedContentCard
                item={primary}
                display={module.display}
                presentation={presentation}
                size="large"
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative py-8"
      data-featured-module=""
      data-featured-presentation={presentation.variant}
      data-featured-source={module.source.kind}
    >
      <CollectionSectionHeader presentation={presentation} />
      {presentation.variant === "carousel" ? (
        <FeaturedCarousel
          items={items}
          display={module.display}
          presentation={presentation}
          mode="legacy"
        />
      ) : presentation.variant === "single-carousel" ? (
        <FeaturedCarousel
          items={items}
          display={module.display}
          presentation={presentation}
          mode="single"
        />
      ) : presentation.variant === "group-carousel" ? (
        <FeaturedCarousel
          items={items}
          display={module.display}
          presentation={presentation}
          mode="group"
        />
      ) : presentation.variant === "list" ? (
        <div className="grid gap-5" data-featured-list="">
          {items.map((item) => (
            <FeaturedContentCard
              key={item.id}
              item={item}
              display={module.display}
              presentation={presentation}
            />
          ))}
        </div>
      ) : presentation.variant === "three-cards" ? (
        <div className="grid gap-5 @xl/slot-module:grid-cols-3">
          {items.slice(0, 3).map((item) => (
            <FeaturedContentCard
              key={item.id}
              item={item}
              display={module.display}
              presentation={presentation}
            />
          ))}
        </div>
      ) : presentation.variant === "hero" ? (
        <FeaturedContentCard
          item={primary}
          display={module.display}
          presentation={presentation}
          size="large"
        />
      ) : presentation.variant === "large-card" ? (
        <div className="mx-auto max-w-5xl">
          <FeaturedContentCard
            item={primary}
            display={module.display}
            presentation={presentation}
            size="large"
          />
        </div>
      ) : null}
    </section>
  );
}
