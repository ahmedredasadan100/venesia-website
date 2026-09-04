import type { ResolvedFeaturedModule } from "../../lib/featured-modules/contract";
import CollectionSectionHeader from "../collection-modules/CollectionSectionHeader";
import FeaturedCarousel from "./FeaturedCarousel";
import FeaturedContentCard from "./FeaturedContentCard";

export default function FeaturedModuleSection({
  module,
}: {
  module: ResolvedFeaturedModule;
}) {
  const { items, presentation } = module;
  if (!items.length) return null;

  if (presentation.variant === "editorial") {
    return (
      <section
        className="relative pb-6 pt-12"
        data-featured-module=""
        data-featured-presentation={presentation.variant}
        data-featured-source={module.source.kind}
        data-featured-item-limit={module.itemLimit}
        data-featured-resolved-items={items.length}
        data-featured-items-per-view={module.itemsPerView}
      >
        <div className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] @2xl/slot-module:p-8">
          <CollectionSectionHeader presentation={presentation} />
          <FeaturedCarousel
            items={items}
            display={module.display}
            displayFormatting={module.displayFormatting}
            presentation={presentation}
            navigation={module.navigation}
            itemsPerView={module.itemsPerView}
            mode="editorial"
          />
        </div>
      </section>
    );
  }

  const carouselMode =
    presentation.variant === "carousel"
      ? "legacy"
      : presentation.variant === "single-carousel"
        ? "single"
        : presentation.variant === "group-carousel"
          ? "group"
          : presentation.variant === "list"
            ? "single"
            : presentation.variant;

  return (
    <section
      className="relative pb-4 pt-8"
      data-featured-module=""
      data-featured-presentation={presentation.variant}
      data-featured-source={module.source.kind}
      data-featured-item-limit={module.itemLimit}
      data-featured-resolved-items={items.length}
      data-featured-items-per-view={module.itemsPerView}
    >
      <CollectionSectionHeader presentation={presentation} />
      {presentation.variant === "list" ? (
        <div className="grid gap-5" data-featured-list="">
          {items.slice(0, module.itemsPerView).map((item) => (
            <FeaturedContentCard
              key={item.id}
              item={item}
              display={module.display}
              displayFormatting={module.displayFormatting}
              presentation={presentation}
            />
          ))}
        </div>
      ) : (
        <div
          className={
            presentation.variant === "large-card" ? "mx-auto max-w-5xl" : ""
          }
        >
          <FeaturedCarousel
            items={items}
            display={module.display}
            displayFormatting={module.displayFormatting}
            presentation={presentation}
            navigation={module.navigation}
            itemsPerView={module.itemsPerView}
            mode={carouselMode}
          />
        </div>
      )}
    </section>
  );
}
