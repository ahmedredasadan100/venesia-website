import type { PageComposition, SlotEntry } from "./page-composition-types";
import type { PageLayoutSlot } from "./layout-slots";

export function getSlotEntries(composition: PageComposition, slot: PageLayoutSlot): SlotEntry[] {
  return composition.slots[slot].filter((entry) => entry.kind !== "hero");
}
