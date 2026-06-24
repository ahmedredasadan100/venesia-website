import type { VisionGoalsModuleConfig } from "../../lib/page-blocks/configs";
import { asVisionGoalsConfig } from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type VisionGoalsItem = {
  title: string;
  text: string;
};

export type VisionGoalsColumn = {
  title: string;
  items: VisionGoalsItem[];
};

export type VisionGoalsContent = {
  eyebrow: string;
  title: string;
  intro: string[];
  image?: string;
  imageAlt: string;
  vision: VisionGoalsColumn;
  goals: VisionGoalsColumn;
};

function normalizePublicImageSrc(path?: string | null) {
  const value = (path ?? "").trim();
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\/+/, "")}`;
}

function mapColumn(column?: VisionGoalsModuleConfig["vision"]): VisionGoalsColumn {
  return {
    title: column?.title ?? "",
    items: (column?.items ?? []).map((item) => ({
      title: item.title ?? "",
      text: item.text ?? "",
    })),
  };
}

export function mapVisionGoalsBlock(block: ResolvedPageBlock): VisionGoalsContent {
  const config = asVisionGoalsConfig(block.template.config);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    intro: config.intro ?? [],
    image: normalizePublicImageSrc(config.image),
    imageAlt: config.imageAlt ?? "",
    vision: mapColumn(config.vision),
    goals: mapColumn(config.goals),
  };
}
