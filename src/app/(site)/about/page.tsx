import AboutPageContent from "../../../components/about/AboutPageContent";
import RevealAnimations from "../../../components/RevealAnimations";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/about" });
}

export default async function AboutPage() {
  const composition = await loadPageCompositionBySlug("about");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <AboutPageContent composition={composition} />
      <RevealAnimations />
    </div>
  );
}
