import MediaListingPage from "../../../../components/media-center/MediaListingPage";
import { MEDIA_LISTING_PAGE_CONFIG } from "../../../../lib/media-center/listing-page-config";
import { generatePublicMetadata } from "../../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: MEDIA_LISTING_PAGE_CONFIG.news.metadataPath });
}

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    sort?: string;
    q?: string;
  }>;
};

export default function Page(props: PageProps) {
  return <MediaListingPage configKey="news" {...props} />;
}
