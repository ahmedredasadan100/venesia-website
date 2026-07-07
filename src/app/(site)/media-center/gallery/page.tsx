import MediaListingPage from "../../../../components/media-center/MediaListingPage";
import { MEDIA_LISTING_PAGE_CONFIG } from "../../../../lib/media-center/listing-page-config";
import { buildMetadata } from "../../../../lib/seo/build-metadata";

export const revalidate = 300;
export const metadata = buildMetadata({ path: MEDIA_LISTING_PAGE_CONFIG.gallery.metadataPath });

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    sort?: string;
  }>;
};

export default function Page(props: PageProps) {
  return <MediaListingPage configKey="gallery" {...props} />;
}
