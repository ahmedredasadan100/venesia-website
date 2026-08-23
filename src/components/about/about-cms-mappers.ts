import type { AboutIntroModuleConfig } from "../../lib/page-blocks";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import { asAboutIntroConfig, asAboutIntroSingleImageConfig } from "../../lib/page-blocks/configs";
import { mapAboutApproachBlock as mapAboutApproachModuleBlock } from "../modules/about-approach-mappers";
import type { AboutApproachModuleContent } from "../modules/about-approach-mappers";
import {
  mapAboutPrinciplesBlock as mapAboutPrinciplesModuleBlock,
  mapLegacyPrinciplesCardsBlock,
} from "../modules/about-principles-mappers";
import type { AboutPrinciplesModuleContent } from "../modules/about-principles-mappers";

export type AboutIntroImages = {
  main?: string;
  secondary?: string;
  accent?: string;
  mainAlt?: string;
  secondaryAlt?: string;
  accentAlt?: string;
};

export type AboutIntroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Raw body — legacy plain text or sanitized rich HTML. */
  description: string;
  images?: AboutIntroImages;
  button?: {
    label: string;
    href: string;
  };
};

export type AboutDocumentaryBeat = {
  num: string;
  title: string;
  text: string;
};

export type AboutApproachContent = AboutApproachModuleContent;

export type AboutPrinciplesContent = AboutPrinciplesModuleContent;

function isFilledBeat(beat: { title?: string; text?: string }) {
  return Boolean(beat.title?.trim() || beat.text?.trim());
}

function normalizePublicImageSrc(path?: string | null) {
  const value = (path ?? "").trim();
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\/+/, "")}`;
}

function mapImagesFromConfig(images?: AboutIntroModuleConfig["images"]): AboutIntroImages | undefined {
  if (!images) return undefined;

  const mapped: AboutIntroImages = {};
  const main = normalizePublicImageSrc(images.main);
  const secondary = normalizePublicImageSrc(images.secondary);
  const accent = normalizePublicImageSrc(images.accent);

  if (main) {
    mapped.main = main;
    if (images.mainAlt?.trim()) mapped.mainAlt = images.mainAlt.trim();
  }
  if (secondary) {
    mapped.secondary = secondary;
    if (images.secondaryAlt?.trim()) mapped.secondaryAlt = images.secondaryAlt.trim();
  }
  if (accent) {
    mapped.accent = accent;
    if (images.accentAlt?.trim()) mapped.accentAlt = images.accentAlt.trim();
  }

  return mapped.main || mapped.secondary || mapped.accent ? mapped : undefined;
}

export function mapAboutIntroBlock(block: ResolvedPageBlock): AboutIntroContent {
  const config = asAboutIntroConfig(block.template.config);
  const mappedImages = mapImagesFromConfig(config.images);
  const buttonLabel = config.button?.label?.trim() ?? "";
  const buttonHref = config.button?.href?.trim() ?? "";

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    subtitle: config.subtitle ?? "",
    description: config.body ?? "",
    images: mappedImages,
    button:
      buttonLabel || buttonHref
        ? {
            label: buttonLabel,
            href: buttonHref,
          }
        : undefined,
  };
}

export function mapAboutIntroBeatsFromBlock(block: ResolvedPageBlock): AboutDocumentaryBeat[] | null {
  const config = asAboutIntroConfig(block.template.config);
  if (!config.beats?.length) return null;

  const beats = config.beats
    .map((beat, index) => ({
      num: beat.num?.trim() || String(index + 1).padStart(2, "0"),
      title: beat.title?.trim() ?? "",
      text: beat.text?.trim() ?? "",
    }))
    .filter(isFilledBeat);

  return beats.length ? beats : null;
}

export function mapAboutIntroSingleImageBlock(block: ResolvedPageBlock) {
  const config = asAboutIntroSingleImageConfig(block.template.config);
  const main = normalizePublicImageSrc(config.images?.main);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    subtitle: config.subtitle ?? "",
    description: config.body ?? "",
    image: main,
    imageAlt: config.images?.mainAlt?.trim() || undefined,
    imagePosition: config.imagePosition === "right" ? ("right" as const) : ("left" as const),
    beats: (config.beats ?? [])
      .map((beat, index) => ({
        num: beat.num?.trim() || String(index + 1).padStart(2, "0"),
        title: beat.title?.trim() ?? "",
        text: beat.text?.trim() ?? "",
      }))
      .filter(isFilledBeat),
  };
}

export function mapAboutApproachBlock(block: ResolvedPageBlock): AboutApproachContent {
  return mapAboutApproachModuleBlock(block);
}

export function mapAboutPrinciplesBlock(block: ResolvedPageBlock): AboutPrinciplesContent {
  if (block.blockType === "cards") {
    return mapLegacyPrinciplesCardsBlock(block);
  }
  return mapAboutPrinciplesModuleBlock(block);
}
