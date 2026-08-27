import type { AboutIntroImages } from "../about/about-cms-mappers";
import {
  asAboutIntroConfig,
  resolvePageBlockTextFormattingMap,
  type PageBlockTextFormattingMap,
} from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

/**
 * Home story CMS content — independent module identity (slug: home-story),
 * reuses About Intro config shape + optional button. Rendered only by HomeStorySection.
 *
 * `body` stays as the stored config key and may be legacy plain text or sanitized rich HTML.
 */
export type HomeStoryButtonAlignment = "right" | "center" | "left";
export type HomeStoryButtonIcon = "none" | "arrow";
export type HomeStoryButtonIconPosition = "right" | "left";

export type HomeStoryContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  formatting: PageBlockTextFormattingMap;
  images?: AboutIntroImages;
  button?: {
    label: string;
    href: string;
    target?: "_self" | "_blank";
    alignment: HomeStoryButtonAlignment;
    icon: HomeStoryButtonIcon;
    iconPosition: HomeStoryButtonIconPosition;
  };
};

function normalizePublicImageSrc(path?: string | null) {
  const value = (path ?? "").trim();
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\/+/, "")}`;
}

function mapImages(images?: ReturnType<typeof asAboutIntroConfig>["images"]): AboutIntroImages | undefined {
  if (!images) return undefined;

  const mapped: AboutIntroImages = {};
  const main = normalizePublicImageSrc(images.main);
  const secondary = normalizePublicImageSrc(images.secondary);

  if (main) {
    mapped.main = main;
    if (images.mainAlt?.trim()) mapped.mainAlt = images.mainAlt.trim();
  }
  if (secondary) {
    mapped.secondary = secondary;
    if (images.secondaryAlt?.trim()) mapped.secondaryAlt = images.secondaryAlt.trim();
  }

  return mapped.main || mapped.secondary ? mapped : undefined;
}

function mapButtonAlignment(value: unknown): HomeStoryButtonAlignment {
  if (value === "center" || value === "left" || value === "right") return value;
  return "right";
}

function mapButtonIcon(value: unknown): HomeStoryButtonIcon {
  return value === "arrow" ? "arrow" : "none";
}

function mapButtonIconPosition(value: unknown): HomeStoryButtonIconPosition {
  return value === "left" ? "left" : "right";
}

export function mapHomeStoryBlock(block: ResolvedPageBlock): HomeStoryContent {
  const config = asAboutIntroConfig(block.template.config);
  const buttonLabel = config.button?.label?.trim() ?? "";
  const buttonHref = config.button?.href?.trim() ?? "";

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    subtitle: config.subtitle ?? "",
    body: config.body ?? "",
    formatting: resolvePageBlockTextFormattingMap(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
    images: mapImages(config.images),
    button:
      buttonLabel || buttonHref
        ? {
            label: buttonLabel,
            href: buttonHref,
            ...(config.button?.target ? { target: config.button.target } : {}),
            alignment: mapButtonAlignment(config.button?.alignment),
            icon: mapButtonIcon(config.button?.icon),
            iconPosition: mapButtonIconPosition(config.button?.iconPosition),
          }
        : undefined,
  };
}
