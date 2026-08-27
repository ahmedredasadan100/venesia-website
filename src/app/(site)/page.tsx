import HomePageContent from "../../components/home/HomePageContent";
import RevealAnimations from "../../components/RevealAnimations";
import PageSlotLayout, { HeroSlotContent } from "../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/" });
}

export default async function HomePage() {
  const composition = await loadPageCompositionBySlug("home");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <RevealAnimations />

      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />

      <HeroSlotContent composition={composition} />

      <HomePageContent composition={composition} />

      <PageSlotLayout composition={composition} skipSlots={["hero", "main"]} />
    </div>
  );
}
