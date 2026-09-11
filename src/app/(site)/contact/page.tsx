import ContactPageContent from "../../../components/contact/ContactPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../../components/search-platform/SearchPlatformModule";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/contact" });
}

type ContactPageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug("contact"),
    searchParams ?? Promise.resolve({}),
  ]);

  return (
    <ContactPageContent
      composition={composition}
      searchParams={resolvedSearchParams}
    />
  );
}
