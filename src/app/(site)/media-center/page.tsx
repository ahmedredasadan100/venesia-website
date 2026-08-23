import MediaCenterGrid from "../../../components/media-center/MediaCenterGrid";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/media-center" });
}

const CMS_PAGE_SLUG = "media-center" as const;

export default async function MediaCenterPage() {
  const composition = await loadPageCompositionBySlug(CMS_PAGE_SLUG);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10 min-h-[50vh] pb-20">
        <PageSlotLayout
          composition={composition}
          mainAfter={<MediaCenterGrid composition={composition} />}
        />
      </main>
    </div>
  );
}
