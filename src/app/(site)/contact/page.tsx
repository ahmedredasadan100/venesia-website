import ContactPageContent from "../../../components/contact/ContactPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/contact" });
}

export default async function ContactPage() {
  const composition = await loadPageCompositionBySlug("contact");

  return <ContactPageContent composition={composition} />;
}
