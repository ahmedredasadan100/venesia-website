import { asHomeProjectsConfig } from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type HomeProjectsContent = {
  eyebrow: string;
  title: string;
  intro: string;
  showEyebrow: boolean;
  showTitle: boolean;
  showIntro: boolean;
  showFooterCta: boolean;
  projectsLimit?: number;
  footerCta: {
    label: string;
    href: string;
  };
};

export function mapHomeProjectsBlock(block: ResolvedPageBlock): HomeProjectsContent {
  const config = asHomeProjectsConfig(block.template.config);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    intro: config.intro ?? "",
    showEyebrow: config.showEyebrow !== false,
    showTitle: config.showTitle !== false,
    showIntro: config.showIntro !== false,
    showFooterCta: config.showFooterCta !== false,
    projectsLimit: config.projectsLimit,
    footerCta: {
      label: config.footerCta?.label ?? "",
      href: config.footerCta?.href ?? "",
    },
  };
}
