import type { PageComposition, SlotEntry } from "./page-composition-types";
import type { PageLayoutSlot } from "./layout-slots";
import type { ResolvedPageBlock } from "./types";

export function getSlotEntries(composition: PageComposition, slot: PageLayoutSlot): SlotEntry[] {
  return composition.slots[slot].filter((entry) => entry.kind !== "hero");
}

export function getSlotBlocks(composition: PageComposition, slot: PageLayoutSlot): ResolvedPageBlock[] {
  return composition.slots[slot]
    .filter((entry) => entry.kind === "block")
    .map((entry) => entry.block);
}

export function findHeroInlineBreadcrumb(composition: PageComposition) {
  return (
    getSlotBlocks(composition, "hero").find(
      (block) =>
        block.blockType === "breadcrumb" && (block.template.variant ?? "hero-inline") !== "standalone",
    ) ?? null
  );
}

export function findBreadcrumbInComposition(composition: PageComposition) {
  return findHeroInlineBreadcrumb(composition);
}

export function findHeroInComposition(composition: PageComposition) {
  return composition.slots.hero.find((entry) => entry.kind === "hero") ?? null;
}
