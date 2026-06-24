import { AI_VISIBILITY } from "../../config/seo/ai-visibility";
import { SEO_SITE } from "../../config/seo/seo-site";

export function buildAiVisibilityJson() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: AI_VISIBILITY.entityName,
    alternateName: AI_VISIBILITY.arabicEntityName,
    url: SEO_SITE.defaultUrl,
    description:
      "Venesia Developments is an Egyptian real estate developer focused on documented residential and commercial project execution in New Cairo and the Egyptian market.",
    areaServed: AI_VISIBILITY.primaryLocation,
    knowsAbout: AI_VISIBILITY.coreSignals,
    slogan: AI_VISIBILITY.brandPrinciple,
  };
}