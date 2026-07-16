import { type ReactNode } from "react";

import AboutIntroSingleImageModuleSection from "../modules/AboutIntroSingleImageModuleSection";
import AboutApproachModuleSection from "../modules/AboutApproachModuleSection";
import AboutPrinciplesModuleSection from "../modules/AboutPrinciplesModuleSection";
import AboutCtaModuleSection from "../modules/AboutCtaModuleSection";
import WhoWeAreModuleSection from "../modules/WhoWeAreModuleSection";
import HomeContactSection from "../home/HomeContactSection";
import HomeProjectsSection from "../home/HomeProjectsSection";
import HomeStorySection from "../home/HomeStorySection";
import HomeTrustSection from "../home/HomeTrustSection";
import VisionGoalsModuleSection from "../modules/VisionGoalsModuleSection";
import BreadcrumbModuleSection from "../modules/BreadcrumbModuleSection";
import {
  mapAboutApproachBlock,
  mapAboutDocumentaryBeatsBlock,
  mapAboutIntroBeatsFromBlock,
  mapAboutIntroBlock,
  mapAboutIntroSingleImageBlock,
  mapAboutPrinciplesBlock,
} from "../about/about-cms-mappers";
import { mapHomeContactBlock } from "../home/home-contact-mappers";
import { mapHomeProjectsBlock } from "../home/home-projects-mappers";
import { mapHomeStoryBlock } from "../home/home-cms-mappers";
import { mapHomeTrustBlock } from "../home/home-trust-mappers";
import ContactCTASection from "../contact/ContactCTASection";
import ContactDepartmentsSection from "../contact/ContactDepartmentsSection";
import ContactFAQSection from "../contact/ContactFAQSection";
import ContactFloatingTrustCards from "../contact/ContactFloatingTrustCards";
import ContactFormSection from "../contact/ContactFormSection";
import ContactMapSection from "../contact/ContactMapSection";
import ContactReasonsSection from "../contact/ContactReasonsSection";
import {
  isContactStyleCtaBlock,
  mapContactCtaBlock,
  mapContactDepartmentsBlock,
  mapContactFaqBlock,
  mapContactFormBlock,
  mapContactFormOfficeBlock,
  mapContactMapBlock,
  mapContactReasonsBlock,
  mapContactTrustCardsBlock,
} from "../contact/contact-cms-mappers";
import TopicsInsightCtaSection from "../topics/TopicsInsightCtaSection";
import TopicsIntroSection from "../topics/TopicsIntroSection";
import { mapTopicsInsightCtaBlock, mapTopicsIntroBlock } from "../topics/topics-cms-mappers";
import { mapAboutCtaBlock, mapLegacyProjectsCtaBlock } from "../modules/about-cta-mappers";
import { mapLegacyPrinciplesCardsBlock } from "../modules/about-principles-mappers";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import type { HomepageProjectCard } from "../../lib/projects/types";
import { mapVisionGoalsBlock } from "../modules/vision-goals-mappers";
import {
  asBreadcrumbConfig,
  isAboutApproachTemplate,
  isAboutCtaTemplate,
  isAboutIntroSingleImageTemplate,
  isAboutIntroTemplate,
  isAboutPrinciplesTemplate,
  isHomeContactTemplate,
  isHomeProjectsTemplate,
  isHomeStoryTemplate,
  isHomeTrustTemplate,
  isVisionGoalsTemplate,
} from "../../lib/page-blocks/configs";
import SectionRenderer from "../sections/SectionRenderer";

function isWhoWeAreContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isAboutIntroTemplate(block.template.slug, block.template.variant);
}

function isAboutIntroSingleImageContentBlock(block: ResolvedPageBlock) {
  return (
    block.blockType === "content" &&
    isAboutIntroSingleImageTemplate(block.template.slug, block.template.variant)
  );
}

function isHomeStoryContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isHomeStoryTemplate(block.template.slug, block.template.variant);
}

function isHomeTrustContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isHomeTrustTemplate(block.template.slug, block.template.variant);
}

function isHomeContactContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isHomeContactTemplate(block.template.slug, block.template.variant);
}

function isHomeProjectsContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isHomeProjectsTemplate(block.template.slug, block.template.variant);
}

function isVisionGoalsContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isVisionGoalsTemplate(block.template.slug, block.template.variant);
}

function isAboutCtaContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isAboutCtaTemplate(block.template.slug, block.template.variant);
}

function isAboutPrinciplesContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isAboutPrinciplesTemplate(block.template.slug, block.template.variant);
}

function isAboutApproachContentBlock(block: ResolvedPageBlock) {
  return block.blockType === "content" && isAboutApproachTemplate(block.template.slug, block.template.variant);
}

export type SlotModuleNode = {
  key: string;
  sortOrder: number;
  node: ReactNode;
};

function sortBlocks(blocks: ResolvedPageBlock[]) {
  return [...blocks].sort((a, b) => a.sortOrder - b.sortOrder || a.assignmentId - b.assignmentId);
}

function indexBySlug(blocks: ResolvedPageBlock[]) {
  const map = new Map<string, ResolvedPageBlock>();
  for (const block of blocks) {
    map.set(block.template.slug, block);
  }
  return map;
}

function findWhoWeAreContentBlock(blocks: ResolvedPageBlock[]) {
  return blocks.find(isWhoWeAreContentBlock);
}

export type SlotModuleRenderContext = {
  homepageProjects?: HomepageProjectCard[];
};

/**
 * Builds ordered React nodes for modules assigned to a single layout slot.
 * Specialized slugs render their full visual section; unknown slugs use generic block renderers.
 * Duplicate assignments in the same slot render sequentially by sort_order.
 *
 * Slug inventory: see `src/lib/page-composition/slot-module-registry.ts`.
 */
export function buildSlotModuleNodes(
  blocks: ResolvedPageBlock[],
  context: SlotModuleRenderContext = {},
): SlotModuleNode[] {
  const sorted = sortBlocks(blocks);
  const bySlug = indexBySlug(sorted);
  const consumed = new Set<number>();
  const nodes: SlotModuleNode[] = [];

  const mark = (block?: ResolvedPageBlock) => {
    if (block) consumed.add(block.assignmentId);
  };

  const push = (id: string, sortOrder: number, node: ReactNode) => {
    nodes.push({ key: id, sortOrder, node });
  };

  for (const block of sorted) {
    if (consumed.has(block.assignmentId)) continue;

    const slug = block.template.slug;

    if (isHomeStoryContentBlock(block)) {
      mark(block);
      push(
        `home-story-${block.assignmentId}`,
        block.sortOrder,
        <HomeStorySection content={mapHomeStoryBlock(block)} />,
      );
      continue;
    }

    if (isHomeTrustContentBlock(block)) {
      mark(block);
      push(
        `home-trust-${block.assignmentId}`,
        block.sortOrder,
        <HomeTrustSection content={mapHomeTrustBlock(block)} />,
      );
      continue;
    }

    if (isHomeContactContentBlock(block)) {
      mark(block);
      push(
        `home-contact-${block.assignmentId}`,
        block.sortOrder,
        <HomeContactSection content={mapHomeContactBlock(block)} />,
      );
      continue;
    }

    if (isHomeProjectsContentBlock(block)) {
      mark(block);
      push(
        `home-projects-${block.assignmentId}`,
        block.sortOrder,
        <HomeProjectsSection
          projects={context.homepageProjects ?? []}
          content={mapHomeProjectsBlock(block)}
        />,
      );
      continue;
    }

    if (isWhoWeAreContentBlock(block)) {
      const beatsBlock = bySlug.get("about-documentary-beats");
      const embeddedBeats = mapAboutIntroBeatsFromBlock(block);
      const moduleKey = `about-intro-${block.assignmentId}`;
      const cmsIntro = mapAboutIntroBlock(block);
      mark(block);
      if (!embeddedBeats?.length && beatsBlock) {
        mark(beatsBlock);
      }
      push(
        moduleKey,
        block.sortOrder,
        <WhoWeAreModuleSection
          cmsIntro={cmsIntro}
          cmsBeats={embeddedBeats ?? (beatsBlock ? mapAboutDocumentaryBeatsBlock(beatsBlock) : null)}
        />,
      );
      continue;
    }

    if (isAboutIntroSingleImageContentBlock(block)) {
      mark(block);
      push(
        `about-intro-single-image-${block.assignmentId}`,
        block.sortOrder,
        <AboutIntroSingleImageModuleSection content={mapAboutIntroSingleImageBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-documentary-beats") {
      const introBlock = findWhoWeAreContentBlock(sorted);
      // Peer of about-intro: always defer to the intro composite when intro exists
      // (embedded beats or peer lookup). Prevents a second WhoWeAre when beats
      // sort before intro. Standalone beats-only section only when no intro.
      if (introBlock) {
        mark(block);
        continue;
      }
      mark(block);
      push(
        `about-beats-${block.assignmentId}`,
        block.sortOrder,
        <WhoWeAreModuleSection cmsIntro={null} cmsBeats={mapAboutDocumentaryBeatsBlock(block)} />,
      );
      continue;
    }

    if (isVisionGoalsContentBlock(block)) {
      mark(block);
      push(
        `vision-goals-${block.assignmentId}`,
        block.sortOrder,
        <VisionGoalsModuleSection cmsContent={mapVisionGoalsBlock(block)} />,
      );
      continue;
    }

    if (isAboutCtaContentBlock(block)) {
      mark(block);
      push(
        `about-cta-${block.assignmentId}`,
        block.sortOrder,
        <AboutCtaModuleSection cmsContent={mapAboutCtaBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-projects-cta") {
      mark(block);
      push(
        `about-cta-legacy-${block.assignmentId}`,
        block.sortOrder,
        <AboutCtaModuleSection cmsContent={mapLegacyProjectsCtaBlock(block)} />,
      );
      continue;
    }

    if (isAboutApproachContentBlock(block)) {
      mark(block);
      push(
        `about-approach-${block.assignmentId}`,
        block.sortOrder,
        <AboutApproachModuleSection cmsContent={mapAboutApproachBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-approach" && block.blockType === "content") {
      mark(block);
      push(
        `about-approach-legacy-${block.assignmentId}`,
        block.sortOrder,
        <AboutApproachModuleSection cmsContent={mapAboutApproachBlock(block)} />,
      );
      continue;
    }

    if (isAboutPrinciplesContentBlock(block)) {
      mark(block);
      push(
        `about-principles-${block.assignmentId}`,
        block.sortOrder,
        <AboutPrinciplesModuleSection cmsContent={mapAboutPrinciplesBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-principles" && block.blockType === "cards") {
      mark(block);
      push(
        `about-principles-legacy-${block.assignmentId}`,
        block.sortOrder,
        <AboutPrinciplesModuleSection cmsContent={mapLegacyPrinciplesCardsBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-vision") {
      mark(block);
      push(
        `about-vision-${block.assignmentId}`,
        block.sortOrder,
        <VisionGoalsModuleSection cmsContent={mapVisionGoalsBlock(block)} />,
      );
      continue;
    }

    if (slug === "contact-trust-cards") {
      mark(block);
      push(
        `contact-trust-${block.assignmentId}`,
        block.sortOrder,
        <ContactFloatingTrustCards cmsCards={mapContactTrustCardsBlock(block)} />,
      );
      continue;
    }

    if (slug === "contact-form-office" || slug === "contact-form") {
      const office = bySlug.get("contact-form-office");
      const form = bySlug.get("contact-form");
      mark(office);
      mark(form);
      push(
        `contact-form-${block.assignmentId}`,
        Math.min(office?.sortOrder ?? block.sortOrder, form?.sortOrder ?? block.sortOrder),
        <ContactFormSection
          cmsOffice={office ? mapContactFormOfficeBlock(office) : null}
          cmsForm={form ? mapContactFormBlock(form) : null}
        />,
      );
      continue;
    }

    if (slug === "contact-map") {
      mark(block);
      push(`contact-map-${block.assignmentId}`, block.sortOrder, <ContactMapSection cmsContent={mapContactMapBlock(block)} />);
      continue;
    }

    if (slug === "contact-reasons") {
      mark(block);
      push(`contact-reasons-${block.assignmentId}`, block.sortOrder, <ContactReasonsSection cmsContent={mapContactReasonsBlock(block)} />);
      continue;
    }

    if (slug === "contact-departments") {
      mark(block);
      push(
        `contact-departments-${block.assignmentId}`,
        block.sortOrder,
        <ContactDepartmentsSection cmsContent={mapContactDepartmentsBlock(block)} />,
      );
      continue;
    }

    if (slug === "contact-faq") {
      mark(block);
      push(`contact-faq-${block.assignmentId}`, block.sortOrder, <ContactFAQSection cmsContent={mapContactFaqBlock(block)} />);
      continue;
    }

    if (isContactStyleCtaBlock(block)) {
      mark(block);
      push(
        `contact-style-cta-${block.assignmentId}`,
        block.sortOrder,
        <ContactCTASection cmsContent={mapContactCtaBlock(block)} />,
      );
      continue;
    }

    if (slug === "topics-intro") {
      mark(block);
      push(`topics-intro-${block.assignmentId}`, block.sortOrder, <TopicsIntroSection cmsContent={mapTopicsIntroBlock(block)} />);
      continue;
    }

    if (slug === "topics-insight-cta") {
      mark(block);
      push(
        `topics-insight-${block.assignmentId}`,
        block.sortOrder,
        <TopicsInsightCtaSection cmsContent={mapTopicsInsightCtaBlock(block)} />,
      );
      continue;
    }

    if (block.blockType === "breadcrumb") {
      if ((block.template.variant ?? "hero-inline") === "standalone") {
        mark(block);
        push(
          `breadcrumb-${block.assignmentId}`,
          block.sortOrder,
          <BreadcrumbModuleSection config={asBreadcrumbConfig(block.template.config)} className="mb-2" />,
        );
      } else {
        mark(block);
      }
      continue;
    }

    mark(block);
    push(`block-${block.assignmentId}`, block.sortOrder, <SectionRenderer block={block} />);
  }

  nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  return nodes;
}
