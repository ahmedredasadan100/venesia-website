import { mapAboutCtaBlock } from "../modules/about-cta-mappers";
import type { AboutCtaContact } from "../modules/about-cta-mappers";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type HomeContactContent = {
  eyebrow: string;
  title: string;
  description: string;
  button: {
    label: string;
    href: string;
  };
  note: string;
  image: string;
  contacts: AboutCtaContact[];
};

/**
 * Home contact CMS content — independent module identity (slug: home-contact),
 * reuses About CTA config shape. Rendered only by HomeContactSection.
 */
export function mapHomeContactBlock(block: ResolvedPageBlock): HomeContactContent {
  const mapped = mapAboutCtaBlock(block);

  return {
    eyebrow: mapped.eyebrow,
    title: mapped.title,
    description: mapped.description,
    button: mapped.button,
    note: mapped.note,
    image: mapped.image ?? "",
    contacts: mapped.contacts,
  };
}
