import type { ResolvedFooterCustomLinksSlot, ResolvedFooterMenuSlot } from "../../../lib/footer/resolved-footer-types";
import FooterBlockHeader from "../FooterBlockHeader";
import FooterSlotCard from "../FooterSlotCard";

type FooterMenuSlotProps = {
  slot: ResolvedFooterMenuSlot | ResolvedFooterCustomLinksSlot;
  immediateReveal?: boolean;
};

export default function FooterMenuSlot({ slot, immediateReveal }: FooterMenuSlotProps) {
  const hasHeading = Boolean(slot.heading?.trim());

  return (
    <FooterSlotCard revealDelay={slot.revealDelay} immediateReveal={immediateReveal}>
      <FooterBlockHeader eyebrow={slot.heading} className={hasHeading ? "mb-5" : "mb-0"} />

      <ul className={hasHeading ? "space-y-3" : "-mt-1 space-y-3"}>
        {slot.links.map(({ label, href, target }) => (
          <li key={`${slot.index}-${href}-${label}`}>
            <a
              href={href}
              target={target === "_blank" ? "_blank" : undefined}
              rel={target === "_blank" ? "noreferrer" : undefined}
              className="group/link flex cursor-pointer items-center gap-2 text-[13px] text-white/45 transition-colors duration-300 hover:text-white/80"
            >
              <span className="h-px w-3 shrink-0 bg-white/20 transition-all duration-300 group-hover/link:w-5 group-hover/link:bg-[#D8B87A]/60" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </FooterSlotCard>
  );
}
