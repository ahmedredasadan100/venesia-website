import ContactPageContent from "../../../components/contact/ContactPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../../components/search-platform/SearchPlatformModule";
import { getPublicPageRoute } from "../../../lib/admin/links/static-routes";

export const revalidate = 300;
const PAGE_IDENTITY = getPublicPageRoute("contact");

export async function generateMetadata() {
  return generatePublicMetadata({ path: PAGE_IDENTITY.href });
}

type ContactPageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug(PAGE_IDENTITY.cmsPageSlug),
    searchParams ?? Promise.resolve({}),
  ]);

  return (
    <ContactPageContent
      composition={composition}
      searchParams={resolvedSearchParams}
    />
  );
}
