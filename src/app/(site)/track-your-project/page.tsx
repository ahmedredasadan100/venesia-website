import TrackPageContent from "../../../components/track/TrackPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/track-your-project" });
}

export default async function TrackYourProjectPage() {
  const composition = await loadPageCompositionBySlug("track-your-project", "stack");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <TrackPageContent composition={composition} />
    </div>
  );
}
