import { FOOTER_BLOCK_REGISTRY } from "../../../../lib/footer/footer-block-registry";
import { DEFAULT_FOOTER_SLOTS } from "../../../../lib/footer/defaults";
import type {
  FooterBlockType,
  FooterSlot,
  FooterSlotIndex,
  FooterSlotsConfig,
} from "../../../../lib/footer/footer-slot-types";
import { FOOTER_SLOT_INDICES, FOOTER_SLOTS_CONFIG_VERSION } from "../../../../lib/footer/footer-slot-types";

export function getSlotByIndex(slots: FooterSlot[], index: FooterSlotIndex): FooterSlot {
  const slot = slots.find((item) => item.index === index);
  if (!slot) throw new Error(`Missing footer slot index ${index}`);
  return slot;
}

export function updateSlot(slots: FooterSlot[], index: FooterSlotIndex, patch: Partial<FooterSlot>): FooterSlot[] {
  return slots.map((slot) => (slot.index === index ? ({ ...slot, ...patch } as FooterSlot) : slot));
}

function defaultSlotForType(type: FooterBlockType): FooterSlot {
  const match = DEFAULT_FOOTER_SLOTS.slots.find((slot) => slot.type === type);
  if (match) return structuredClone(match) as FooterSlot;
  if (type === "custom_links") {
    return {
      index: 1,
      enabled: true,
      type: "custom_links",
      heading: null,
      config: { links: [] },
    };
  }
  throw new Error(`No default footer block for type: ${type}`);
}

export function changeSlotType(slots: FooterSlot[], index: FooterSlotIndex, type: FooterBlockType): FooterSlot[] {
  const current = getSlotByIndex(slots, index);
  const template = defaultSlotForType(type);
  const config = FOOTER_BLOCK_REGISTRY[type].parseConfig(undefined, template.config as never);

  return updateSlot(slots, index, {
    type,
    config,
    heading: current.heading,
    enabled: current.enabled,
  });
}

export function duplicateSlotConfig(
  slots: FooterSlot[],
  fromIndex: FooterSlotIndex,
  toIndex: FooterSlotIndex,
): FooterSlot[] {
  if (fromIndex === toIndex) return slots;
  const source = getSlotByIndex(slots, fromIndex);
  return updateSlot(slots, toIndex, {
    type: source.type,
    heading: source.heading,
    config: structuredClone(source.config),
  });
}

/** Swaps full slot content between two visual positions (indices stay fixed). */
export function swapFooterSlotPositions(
  slots: FooterSlot[],
  indexA: FooterSlotIndex,
  indexB: FooterSlotIndex,
): FooterSlot[] {
  if (indexA === indexB) return slots;

  const slotA = getSlotByIndex(slots, indexA);
  const slotB = getSlotByIndex(slots, indexB);

  return slots.map((slot) => {
    if (slot.index === indexA) return { ...slotB, index: indexA };
    if (slot.index === indexB) return { ...slotA, index: indexB };
    return slot;
  });
}

export function moveFooterSlotInOrder(
  slots: FooterSlot[],
  index: FooterSlotIndex,
  direction: "earlier" | "later",
): FooterSlot[] {
  const position = FOOTER_SLOT_INDICES.indexOf(index);
  if (position === -1) return slots;

  if (direction === "earlier" && position > 0) {
    return swapFooterSlotPositions(slots, index, FOOTER_SLOT_INDICES[position - 1]);
  }

  if (direction === "later" && position < FOOTER_SLOT_INDICES.length - 1) {
    return swapFooterSlotPositions(slots, index, FOOTER_SLOT_INDICES[position + 1]);
  }

  return slots;
}

export function normalizeSlotHeading(heading: string | null | undefined): string | null {
  if (heading == null) return null;
  const text = heading.trim();
  return text || null;
}

export function normalizeSlotsForSave(slots: FooterSlot[]): FooterSlotsConfig {
  return {
    version: FOOTER_SLOTS_CONFIG_VERSION,
    slots: slots
      .map((slot) => ({
        ...slot,
        heading: normalizeSlotHeading(slot.heading),
      }))
      .sort((a, b) => a.index - b.index),
  };
}
