import Image from "next/image";
import Link from "next/link";

import type { PublicContentSummary } from "../../lib/content/public-content-read/contract";
import {
  resolveFeaturedItemDisplay,
  type ResolvedFeaturedModule,
} from "../../lib/featured-modules/contract";
import type { ContentDisplayOptions } from "../../lib/page-blocks/configs";
import CollectionSectionHeader from "../collection-modules/CollectionSectionHeader";
import FeaturedCarousel from "./FeaturedCarousel";
import FeaturedContentCard from "./FeaturedContentCard";

function FeaturedEditorialSecondaryCard({
  item,
  display,
}: {
  item: PublicContentSummary;
  display: ContentDisplayOptions;
}) {
  const resolvedDisplay = resolveFeaturedItemDisplay(display, item);
  const showMetadata =
    resolvedDisplay.category || resolvedDisplay.series || resolvedDisplay.date;

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
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/38">
              {resolvedDisplay.category ? (
                <span className="text-[#D8B87A]/75">{item.category}</span>
              ) : null}
              {resolvedDisplay.series ? (
                <span className="text-[#D8B87A]/75">{item.series}</span>
              ) : null}
              {resolvedDisplay.date ? <span>{item.date}</span> : null}
            </div>
          ) : null}
          {resolvedDisplay.title ? (
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-[#D8B87A]">
              {item.title}
            </h3>
          ) : null}
          {resolvedDisplay.excerpt ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/48">
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
