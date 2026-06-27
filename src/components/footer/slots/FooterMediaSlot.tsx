import type { ResolvedFooterMediaSlot } from "../../../lib/footer/resolved-footer-types";
import FooterBlockHeader from "../FooterBlockHeader";
import FooterSlotCard from "../FooterSlotCard";

type FooterMediaSlotProps = {
  slot: ResolvedFooterMediaSlot;
  immediateReveal?: boolean;
};

export default function FooterMediaSlot({ slot, immediateReveal }: FooterMediaSlotProps) {
  const hasHeading = Boolean(slot.heading?.trim());

  return (
    <FooterSlotCard revealDelay={slot.revealDelay} immediateReveal={immediateReveal}>
      <FooterBlockHeader eyebrow={slot.heading} className={hasHeading ? "mb-5" : "mb-0"} />

      <ul className="space-y-3 text-[13px] text-white/45">
        {slot.links.map(({ label, href, target }) => (
          <li key={`${slot.index}-${href}-${label}`}>
            <a
              href={href}
              target={target === "_blank" ? "_blank" : undefined}
              rel={target === "_blank" ? "noreferrer" : undefined}
              className="flex cursor-pointer items-center gap-2 transition-colors duration-300 hover:text-white/80"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-[9px] text-[#D8B87A]">
                ◆
              </span>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </FooterSlotCard>
  );
}
