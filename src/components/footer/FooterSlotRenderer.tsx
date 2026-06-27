import type { ResolvedFooterSlot } from "../../lib/footer/resolved-footer-types";
import FooterContactSlot from "./slots/FooterContactSlot";
import FooterMediaSlot from "./slots/FooterMediaSlot";
import FooterMenuSlot from "./slots/FooterMenuSlot";
import FooterTextSlot from "./slots/FooterTextSlot";

type FooterSlotRendererProps = {
  slot: ResolvedFooterSlot;
  immediateReveal?: boolean;
};

export default function FooterSlotRenderer({ slot, immediateReveal }: FooterSlotRendererProps) {
  switch (slot.type) {
    case "text":
      return <FooterTextSlot slot={slot} immediateReveal={immediateReveal} />;
    case "contact":
      return <FooterContactSlot slot={slot} immediateReveal={immediateReveal} />;
    case "menu":
    case "custom_links":
      return <FooterMenuSlot slot={slot} immediateReveal={immediateReveal} />;
    case "media":
      return <FooterMediaSlot slot={slot} immediateReveal={immediateReveal} />;
    default:
      return null;
  }
}
