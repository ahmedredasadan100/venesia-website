import HomePageContent from "../../components/home/HomePageContent";
import RevealAnimations from "../../components/RevealAnimations";
import DynamicHeroSection from "../../components/sections/DynamicHeroSection";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { findHeroInComposition } from "../../lib/page-blocks/page-composition-utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const composition = await loadPageCompositionBySlug("home", "stack");
  const heroEntry = findHeroInComposition(composition);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <RevealAnimations />

      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />

      {heroEntry ? <DynamicHeroSection hero={heroEntry.hero} /> : null}

      <HomePageContent composition={composition} />
    </div>
  );
}
