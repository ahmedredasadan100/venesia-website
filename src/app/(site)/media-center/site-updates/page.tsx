import MediaListingPage from "../../../../components/media-center/MediaListingPage";
import { MEDIA_LISTING_PAGE_CONFIG } from "../../../../lib/media-center/listing-page-config";
import { resolvePublicContentPageRoute } from "../../../../lib/content/public-content-path";
import { generatePublicMetadata } from "../../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

const PAGE_IDENTITY = resolvePublicContentPageRoute(
  MEDIA_LISTING_PAGE_CONFIG["site-updates"].mediaType,
);

export async function generateMetadata() {
  return generatePublicMetadata({ path: PAGE_IDENTITY.href });
}

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    sort?: string;
    q?: string;
  }>;
};

export default function Page(props: PageProps) {
  return <MediaListingPage configKey="site-updates" {...props} />;
}
