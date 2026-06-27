import { DEFAULT_FOOTER_SLOTS } from "./defaults";
import type { FooterBlockType, FooterSlotConfigByType } from "./footer-slot-types";
import {
  parseContactSlotConfig,
  parseCustomLinksSlotConfig,
  parseMediaSlotConfig,
  parseMenuSlotConfig,
  parseTextSlotConfig,
} from "./parse-footer-slots";

export type FooterBlockDefinition<T extends FooterBlockType = FooterBlockType> = {
  type: T;
  version: number;
  label: string;
  parseConfig(raw: unknown, fallback: FooterSlotConfigByType[T]): FooterSlotConfigByType[T];
};

function slotConfigByType<T extends FooterBlockType>(type: T): FooterSlotConfigByType[T] {
  const match = DEFAULT_FOOTER_SLOTS.slots.find((slot) => slot.type === type);
  if (match) {
    return structuredClone(match.config) as FooterSlotConfigByType[T];
  }

  if (type === "custom_links") {
    return { links: [] } as unknown as FooterSlotConfigByType[T];
  }

  throw new Error(`No default footer block config for type: ${type}`);
}

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

export function getFooterBlockDefinition<T extends FooterBlockType>(type: T): FooterBlockDefinition<T> {
  return FOOTER_BLOCK_REGISTRY[type];
}

export function parseFooterSlotConfig<T extends FooterBlockType>(
  type: T,
  raw: unknown,
): FooterSlotConfigByType[T] {
  const definition = getFooterBlockDefinition(type);
  return definition.parseConfig(raw, slotConfigByType(type));
}

export function isRegisteredFooterBlockType(value: string): value is FooterBlockType {
  return value in FOOTER_BLOCK_REGISTRY;
}

export function listFooterBlockTypes(): FooterBlockType[] {
  return Object.keys(FOOTER_BLOCK_REGISTRY) as FooterBlockType[];
}
