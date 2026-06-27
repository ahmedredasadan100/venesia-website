import type { ResolvedFooterContactSlot } from "../../../lib/footer/resolved-footer-types";
import FooterBlockHeader from "../FooterBlockHeader";
import FooterSlotCard from "../FooterSlotCard";

type FooterContactSlotProps = {
  slot: ResolvedFooterContactSlot;
  immediateReveal?: boolean;
};

export default function FooterContactSlot({ slot, immediateReveal }: FooterContactSlotProps) {
  const hasHeading = Boolean(slot.heading?.trim());

  return (
    <FooterSlotCard revealDelay={slot.revealDelay} immediateReveal={immediateReveal}>
      <FooterBlockHeader eyebrow={slot.heading} className={hasHeading ? "mb-5" : "mb-0"} />

      <ul className="space-y-3 text-[13px] text-white/50">
        {slot.items.map(({ icon, label, value, href }) => (
          <li key={`${label}-${value}`} className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-[#D8B87A]/50">{icon ?? "•"}</span>

            {href ? (
              <a
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="cursor-pointer transition-colors duration-300 hover:text-[#D8B87A]"
                dir={label.includes("رقم") || label.includes("موبايل") ? "ltr" : undefined}
              >
                <span className="block text-[11px] text-white/30">{label}</span>
                <span className="break-all">{value}</span>
              </a>
            ) : (
              <div dir={label.includes("رقم") || label.includes("موبايل") ? "ltr" : undefined}>
                <span className="block text-[11px] text-white/30">{label}</span>
                <span className="break-all">{value}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </FooterSlotCard>
  );
}
