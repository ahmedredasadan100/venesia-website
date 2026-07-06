import AboutPageContent from "../../../components/about/AboutPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { buildMetadata } from "../../../lib/seo/build-metadata";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/about" });

export default async function AboutPage() {
  const composition = await loadPageCompositionBySlug("about", "stack");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <AboutPageContent composition={composition} />
    </div>
  );
}
