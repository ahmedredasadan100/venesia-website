import { asHomeProjectsConfig } from "../../lib/page-blocks/configs";
import {
  resolvePageBlockTextFormattingMap,
  type PageBlockTextFormattingMap,
} from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type HomeProjectsButtonAlignment = "right" | "center" | "left";

export type HomeProjectsContent = {
  eyebrow: string;
  title: string;
  intro: string;
  formatting: PageBlockTextFormattingMap;
  showEyebrow: boolean;
  showTitle: boolean;
  showIntro: boolean;
  showProjectLocation: boolean;
  showFooterCta: boolean;
  projectsLimit?: number;
  cardCtaLabel: string;
  /** Physical alignment of in-card CTA. Legacy default: right. */
  cardCtaAlignment: HomeProjectsButtonAlignment;
  /** Plain-text eyebrow weight. Legacy default: true. */
  eyebrowBold: boolean;
  /** Eyebrow text alignment inside the heading column. Legacy default: right. */
  eyebrowAlignment: HomeProjectsButtonAlignment;
  footerCta: {
    label: string;
    href: string;
    target?: "_self" | "_blank";
    alignment: HomeProjectsButtonAlignment;
  };
};

function mapFooterAlignment(value: unknown): HomeProjectsButtonAlignment {
  if (value === "right" || value === "left" || value === "center") return value;
  // Legacy public CTA was hard-centered.
  return "center";
}

function mapCardCtaAlignment(value: unknown): HomeProjectsButtonAlignment {
  if (value === "right" || value === "left" || value === "center") return value;
  // Legacy in-card CTA was inline-flex at RTL start (= physical right).
  return "right";
}

function mapEyebrowAlignment(value: unknown): HomeProjectsButtonAlignment {
  if (value === "right" || value === "left" || value === "center") return value;
  // Legacy heading column used text-right.
  return "right";
}

export function mapHomeProjectsBlock(
  block: ResolvedPageBlock,
): HomeProjectsContent {
  const config = asHomeProjectsConfig(block.template.config);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    intro: config.intro ?? "",
    formatting: resolvePageBlockTextFormattingMap(config, [
      { field: "eyebrow", defaults: { bold: true } },
      { field: "title", defaults: { bold: true } },
      { field: "intro" },
    ]),
    showEyebrow: config.showEyebrow !== false,
    showTitle: config.showTitle !== false,
    showIntro: config.showIntro !== false,
    showProjectLocation: config.showProjectLocation !== false,
    showFooterCta: config.showFooterCta !== false,
    projectsLimit: config.projectsLimit,
    cardCtaLabel: config.cardCtaLabel ?? "استكشف المشروع",
    cardCtaAlignment: mapCardCtaAlignment(config.cardCtaAlignment),
    eyebrowBold: config.eyebrowBold !== false,
    eyebrowAlignment: mapEyebrowAlignment(config.eyebrowAlignment),
    footerCta: {
      label: config.footerCta?.label ?? "",
      href: config.footerCta?.href ?? "",
      ...(config.footerCta?.target ? { target: config.footerCta.target } : {}),
      alignment: mapFooterAlignment(config.footerCta?.alignment),
    },
  };
}
