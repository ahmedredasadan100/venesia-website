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
import TopicsListingContent from "../topics/TopicsListingContent";
import { ContentIntroPresentation } from "../sections/ContentSection";
import { mapTopicsInsightCtaBlock } from "../topics/topics-cms-mappers";
import { mapAboutCtaBlock, mapLegacyProjectsCtaBlock } from "../modules/about-cta-mappers";
import { mapLegacyPrinciplesCardsBlock } from "../modules/about-principles-mappers";
import type {
  ListingRenderContext,
} from "../../lib/page-blocks/page-composition-types";
import type {
  PageBlockType,
  ResolvedPageBlock,
} from "../../lib/page-blocks/types";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import { mapVisionGoalsBlock } from "../modules/vision-goals-mappers";
import {
  asBreadcrumbConfig,
  asContentConfig,
  isAboutApproachTemplate,
  isAboutCtaTemplate,
  isAboutIntroSingleImageTemplate,
  isAboutIntroTemplate,
  isAboutPrinciplesTemplate,
  isHomeContactTemplate,
  isHomeProjectsTemplate,
  isHomeStoryTemplate,
  isHomeTrustTemplate,
  isTopicsListingTemplate,
  isVisionGoalsTemplate,
} from "../../lib/page-blocks/configs";
import SectionRenderer from "../sections/SectionRenderer";
import SearchPlatformModule, {
  type SearchPlatformSearchParams,
} from "../search-platform/SearchPlatformModule";
import { isSearchPlatformTemplate } from "../../lib/page-blocks/search-platform-config";
import { comparePageAssignmentOrder } from "../../lib/page-composition/page-assignment-contract";

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
  moduleKind: PageBlockType;
  assignmentId: number;
  sortOrder: number;
  node: ReactNode;
};

export type ContactFormPair = {
  office: ResolvedPageBlock;
  form: ResolvedPageBlock;
};

function sortBlocks(blocks: ResolvedPageBlock[]) {
  return [...blocks].sort((left, right) =>
    comparePageAssignmentOrder(
      {
        sortOrder: left.sortOrder,
        moduleKind: left.blockType,
        assignmentId: left.assignmentId,
      },
      {
        sortOrder: right.sortOrder,
        moduleKind: right.blockType,
        assignmentId: right.assignmentId,
      },
    ),
  );
}

export type SlotModuleRenderContext = {
  homepageProjects?: HomepageProjectCard[];
  breadcrumbCurrentLabel?: string;
  publicPath?: string;
  searchParams?: SearchPlatformSearchParams;
  listingContext?: ListingRenderContext;
  suppressFeaturedDuringSearch?: boolean;
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
  contactFormPairs: readonly ContactFormPair[] = [],
): SlotModuleNode[] {
  const sorted = sortBlocks(blocks);
  const nodes: SlotModuleNode[] = [];

  const push = (
    block: ResolvedPageBlock,
    id: string,
    node: ReactNode,
    sortOrder = block.sortOrder,
  ) => {
    nodes.push({
      key: id,
      moduleKind: block.blockType,
      assignmentId: block.assignmentId,
      sortOrder,
      node,
    });
  };

  for (const block of sorted) {
    const slug = block.template.slug;

    if (isHomeStoryContentBlock(block)) {
      push(
        block,
        `home-story-${block.assignmentId}`,
        <HomeStorySection content={mapHomeStoryBlock(block)} />,
      );
      continue;
    }

    if (isHomeTrustContentBlock(block)) {
      push(
        block,
        `home-trust-${block.assignmentId}`,
        <HomeTrustSection content={mapHomeTrustBlock(block)} />,
      );
      continue;
    }

    if (isHomeContactContentBlock(block)) {
      push(
        block,
        `home-contact-${block.assignmentId}`,
        <HomeContactSection content={mapHomeContactBlock(block)} />,
      );
      continue;
    }

    if (isHomeProjectsContentBlock(block)) {
      if (!context.homepageProjects?.length) continue;
      push(
        block,
        `home-projects-${block.assignmentId}`,
        <HomeProjectsSection
          projects={context.homepageProjects}
          content={mapHomeProjectsBlock(block)}
        />,
      );
      continue;
    }

    if (isWhoWeAreContentBlock(block)) {
      const embeddedBeats = mapAboutIntroBeatsFromBlock(block);
      const moduleKey = `about-intro-${block.assignmentId}`;
      const cmsIntro = mapAboutIntroBlock(block);
      push(
        block,
        moduleKey,
        <WhoWeAreModuleSection
          cmsIntro={cmsIntro}
          cmsBeats={embeddedBeats}
        />,
      );
      continue;
    }

    if (isAboutIntroSingleImageContentBlock(block)) {
      push(
        block,
        `about-intro-single-image-${block.assignmentId}`,
        <AboutIntroSingleImageModuleSection content={mapAboutIntroSingleImageBlock(block)} />,
      );
      continue;
    }

    if (isVisionGoalsContentBlock(block)) {
      push(
        block,
        `vision-goals-${block.assignmentId}`,
        <VisionGoalsModuleSection cmsContent={mapVisionGoalsBlock(block)} />,
      );
      continue;
    }

    if (isAboutCtaContentBlock(block)) {
      push(
        block,
        `about-cta-${block.assignmentId}`,
        <AboutCtaModuleSection cmsContent={mapAboutCtaBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-projects-cta") {
      push(
        block,
        `about-cta-legacy-${block.assignmentId}`,
        <AboutCtaModuleSection cmsContent={mapLegacyProjectsCtaBlock(block)} />,
      );
      continue;
    }

    if (isAboutApproachContentBlock(block)) {
      push(
        block,
        `about-approach-${block.assignmentId}`,
        <AboutApproachModuleSection cmsContent={mapAboutApproachBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-approach" && block.blockType === "content") {
      push(
        block,
        `about-approach-legacy-${block.assignmentId}`,
        <AboutApproachModuleSection cmsContent={mapAboutApproachBlock(block)} />,
      );
      continue;
    }

    if (isAboutPrinciplesContentBlock(block)) {
      push(
        block,
        `about-principles-${block.assignmentId}`,
        <AboutPrinciplesModuleSection cmsContent={mapAboutPrinciplesBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-principles" && block.blockType === "cards") {
      push(
        block,
        `about-principles-legacy-${block.assignmentId}`,
        <AboutPrinciplesModuleSection cmsContent={mapLegacyPrinciplesCardsBlock(block)} />,
      );
      continue;
    }

    if (slug === "about-vision") {
      push(
        block,
        `about-vision-${block.assignmentId}`,
        <VisionGoalsModuleSection cmsContent={mapVisionGoalsBlock(block)} />,
      );
      continue;
    }

    if (slug === "contact-trust-cards") {
      push(
        block,
        `contact-trust-${block.assignmentId}`,
        <ContactFloatingTrustCards cmsCards={mapContactTrustCardsBlock(block)} />,
      );
      continue;
    }

    if (slug === "contact-form-office" || slug === "contact-form") {
      const pair = contactFormPairs.find(
        ({ office, form }) => office === block || form === block,
      );
      const office = pair?.office ?? (slug === "contact-form-office" ? block : undefined);
      const form = pair?.form ?? (slug === "contact-form" ? block : undefined);
      const anchor = pair ? sortBlocks([pair.office, pair.form])[0] : block;
      if (anchor !== block) continue;
      push(
        anchor,
        `contact-form-${office?.assignmentId ?? "none"}-${form?.assignmentId ?? "none"}`,
        <ContactFormSection
          cmsOffice={office ? mapContactFormOfficeBlock(office) : null}
          cmsForm={form ? mapContactFormBlock(form) : null}
        />,
        Math.min(
          office?.sortOrder ?? anchor.sortOrder,
          form?.sortOrder ?? anchor.sortOrder,
        ),
      );
      continue;
    }

    if (slug === "contact-map") {
      push(block, `contact-map-${block.assignmentId}`, <ContactMapSection cmsContent={mapContactMapBlock(block)} />);
      continue;
    }

    if (slug === "contact-reasons") {
      push(block, `contact-reasons-${block.assignmentId}`, <ContactReasonsSection cmsContent={mapContactReasonsBlock(block)} />);
      continue;
    }

    if (slug === "contact-departments") {
      push(
        block,
        `contact-departments-${block.assignmentId}`,
        <ContactDepartmentsSection cmsContent={mapContactDepartmentsBlock(block)} />,
      );
      continue;
    }

    if (slug === "contact-faq") {
      push(block, `contact-faq-${block.assignmentId}`, <ContactFAQSection cmsContent={mapContactFaqBlock(block)} />);
      continue;
    }

    if (isContactStyleCtaBlock(block)) {
      push(
        block,
        `contact-style-cta-${block.assignmentId}`,
        <ContactCTASection cmsContent={mapContactCtaBlock(block)} />,
      );
      continue;
    }

    if (slug === "topics-intro") {
      push(
        block,
        `topics-intro-${block.assignmentId}`,
        <ContentIntroPresentation
          config={asContentConfig(block.template.config)}
        />,
      );
      continue;
    }

    if (isTopicsListingTemplate(slug, block.template.variant)) {
      if (context.listingContext) {
        push(
          block,
          `topics-listing-${block.assignmentId}`,
          <TopicsListingContent
            block={block}
            context={context.listingContext}
          />,
        );
      }
      continue;
    }

    if (
      block.blockType === "content" &&
      isSearchPlatformTemplate(block.template.slug, block.template.variant)
    ) {
      push(
        block,
        `search-platform-${block.assignmentId}`,
        <SearchPlatformModule
          block={block}
          publicPath={context.publicPath}
          searchParams={context.searchParams}
        />,
      );
      continue;
    }

    if (slug === "topics-insight-cta") {
      push(
        block,
        `topics-insight-${block.assignmentId}`,
        <TopicsInsightCtaSection cmsContent={mapTopicsInsightCtaBlock(block)} />,
      );
      continue;
    }

    if (block.blockType === "breadcrumb") {
      push(
        block,
        `breadcrumb-${block.assignmentId}`,
        <BreadcrumbModuleSection
          config={asBreadcrumbConfig(block.template.config)}
          currentLabelOverride={context.breadcrumbCurrentLabel}
        />,
      );
      continue;
    }

    push(block, `block-${block.assignmentId}`, <SectionRenderer block={block} />);
  }

  nodes.sort(
    (left, right) => comparePageAssignmentOrder(left, right),
  );
  return nodes;
}
