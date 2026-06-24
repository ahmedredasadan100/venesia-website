import type { AboutPrinciplesModuleConfig, CardsBlockConfig } from "../../lib/page-blocks/configs";
import { asAboutPrinciplesConfig } from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type AboutPrinciplesItem = {
  icon: string;
  title: string;
  description: string;
};

export type AboutPrinciplesModuleContent = {
  eyebrow: string;
  title: string;
  description: string;
  items: AboutPrinciplesItem[];
};

function mapItems(items?: AboutPrinciplesModuleConfig["items"]): AboutPrinciplesItem[] {
  return (items ?? [])
    .map((item) => ({
      icon: item.icon ?? "land",
      title: item.title ?? "",
      description: item.description ?? "",
    }))
    .filter((item) => item.title.trim() || item.description.trim());
}

export function mapAboutPrinciplesBlock(block: ResolvedPageBlock): AboutPrinciplesModuleContent {
  const config = asAboutPrinciplesConfig(block.template.config);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.description ?? "",
    items: mapItems(config.items),
  };
}

/** Legacy cards_block_templates slug about-principles. */
export function mapLegacyPrinciplesCardsBlock(block: ResolvedPageBlock): AboutPrinciplesModuleContent {
  const config = block.template.config as CardsBlockConfig;
  const iconCycle = ["land", "engineering", "timeline"];

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: "",
    items: (config.items ?? []).map((item, index) => ({
      icon: item.icon?.trim() || iconCycle[index % iconCycle.length],
      title: item.title ?? "",
      description: item.body ?? "",
    })),
  };
}
