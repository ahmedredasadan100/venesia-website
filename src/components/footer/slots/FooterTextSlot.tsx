import type { ResolvedFooterTextSlot } from "../../../lib/footer/resolved-footer-types";
import FooterBlockHeader from "../FooterBlockHeader";
import FooterSlotCard from "../FooterSlotCard";

type FooterTextSlotProps = {
  slot: ResolvedFooterTextSlot;
  immediateReveal?: boolean;
};

export default function FooterTextSlot({ slot, immediateReveal }: FooterTextSlotProps) {
  return (
    <FooterSlotCard revealDelay={slot.revealDelay} immediateReveal={immediateReveal}>
      <FooterBlockHeader
        eyebrow={slot.heading}
        title={slot.title}
        icon={slot.showBrandIcon ? "brand" : "none"}
        className="mb-5"
      />

      {slot.body ? <p className="text-[13px] leading-6 text-white/40">{slot.body}</p> : null}

      {slot.cta.enabled && slot.cta.label && slot.cta.href ? (
        <a
          href={slot.cta.href}
          target={slot.cta.target === "_blank" ? "_blank" : undefined}
          rel={slot.cta.target === "_blank" ? "noreferrer" : undefined}
          className="mt-4 inline-flex text-[13px] text-[#D8B87A] transition-colors duration-300 hover:text-[#e5c98d]"
        >
          {slot.cta.label}
        </a>
      ) : null}

      {slot.showBrandIcon ? <div className="mt-6 h-px w-10 bg-[#D8B87A]/30" /> : null}
    </FooterSlotCard>
  );
}
