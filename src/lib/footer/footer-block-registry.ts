
import type { FooterBlockType, FooterSlotConfigByType } from "./footer-slot-types";
import {
  parseContactSlotConfig,
  parseCustomLinksSlotConfig,
  parseMediaSlotConfig,
  parseMenuSlotConfig,
  parseTextSlotConfig,
} from "./parse-footer-slot-config";

export type FooterBlockDefinition<T extends FooterBlockType = FooterBlockType> = {
  type: T;
  version: number;
  label: string;
  parseConfig(raw: unknown, fallback: FooterSlotConfigByType[T]): FooterSlotConfigByType[T];
};

export const FOOTER_BLOCK_REGISTRY: {
  readonly [K in FooterBlockType]: FooterBlockDefinition<K>;
} = {
  text: {
    type: "text",
    version: 1,
    label: "Text Block",
    parseConfig: parseTextSlotConfig,
  },
  menu: {
    type: "menu",
    version: 1,
    label: "Menu Block",
    parseConfig: parseMenuSlotConfig,
  },
  contact: {
    type: "contact",
    version: 1,
    label: "Contact Block",
    parseConfig: parseContactSlotConfig,
  },
  media: {
    type: "media",
    version: 1,
    label: "Media Block",
    parseConfig: parseMediaSlotConfig,
  },
  custom_links: {
    type: "custom_links",
    version: 1,
    label: "Custom Links Block",
    parseConfig: parseCustomLinksSlotConfig,
  },
};

export function isRegisteredFooterBlockType(value: string): value is FooterBlockType {
  return value in FOOTER_BLOCK_REGISTRY;
}

export function listFooterBlockTypes(): FooterBlockType[] {
  return Object.keys(FOOTER_BLOCK_REGISTRY) as FooterBlockType[];
}
