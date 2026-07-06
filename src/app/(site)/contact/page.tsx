import ContactPageContent from "../../../components/contact/ContactPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { buildMetadata } from "../../../lib/seo/build-metadata";

export const revalidate = 300;
export const metadata = buildMetadata({ path: "/contact" });

export default async function ContactPage() {
  const composition = await loadPageCompositionBySlug("contact", "stack");

  return <ContactPageContent composition={composition} />;
}
