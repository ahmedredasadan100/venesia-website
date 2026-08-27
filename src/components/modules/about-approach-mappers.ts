import {
  asAboutApproachConfig,
  resolvePageBlockTextFormattingMap,
  type PageBlockTextFormattingMap,
} from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type AboutApproachModuleContent = {
  eyebrow: string;
  text: string;
  highlightedText: string;
  formatting: PageBlockTextFormattingMap;
};

function splitApproachTitle(title?: string) {
  const value = (title ?? "").trim();
  if (!value) return { text: "", highlightedText: "" };

  const dashIndex = value.indexOf(" — ");
  if (dashIndex === -1) {
    return { text: value, highlightedText: "" };
  }

  return {
    text: `${value.slice(0, dashIndex)} —`,
    highlightedText: value.slice(dashIndex + 3).trim(),
  };
}

export function mapAboutApproachBlock(block: ResolvedPageBlock): AboutApproachModuleContent {
  const config = asAboutApproachConfig(block.template.config);
  const { text, highlightedText } = splitApproachTitle(config.title);

  return {
    eyebrow: config.eyebrow ?? "",
    text,
    highlightedText,
    formatting: resolvePageBlockTextFormattingMap(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
    ]),
  };
}
