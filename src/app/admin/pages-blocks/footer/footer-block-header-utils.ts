import type { FooterSlot, FooterTextSlotConfig } from "../../../../lib/footer/footer-slot-types";

export function getFooterSlotBlockTitle(slot: FooterSlot): string | null {
  if (slot.type === "text") {
    const title = (slot.config as FooterTextSlotConfig).title?.trim();
    return title || null;
  }
  return null;
}

export function getFooterSlotBrandIcon(slot: FooterSlot): boolean {
  return slot.type === "text" && Boolean((slot.config as FooterTextSlotConfig).showBrandIcon);
}
