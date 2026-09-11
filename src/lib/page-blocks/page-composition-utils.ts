import type { PageComposition, SlotEntry } from "./page-composition-types";
import type { PageLayoutSlot } from "./layout-slots";

export function getSlotEntries(composition: PageComposition, slot: PageLayoutSlot): SlotEntry[] {
  return composition.slots[slot].filter((entry) => entry.kind !== "hero");
}

/**
 * Entries that may accompany a route-owned intrinsic Hero without rendering
 * the page assignment's Hero a second time. Ordering remains assignment-owned
 * and is applied later by the shared slot render plan.
 */
export function getHeroSlotPeerEntries(composition: PageComposition): SlotEntry[] {
  return getSlotEntries(composition, "hero");
}
