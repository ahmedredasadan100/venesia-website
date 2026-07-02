import type { ResolvedFooterContactSlot } from "../../../lib/footer/resolved-footer-types";
import FooterBlockHeader from "../FooterBlockHeader";
import FooterSlotCard from "../FooterSlotCard";

type FooterContactSlotProps = {
  slot: ResolvedFooterContactSlot;
  immediateReveal?: boolean;
};

function contactValueDir(value: string, href?: string) {
  if (href?.startsWith("tel:") || href?.startsWith("mailto:")) return "ltr";
  if (/^[\d+\-().\s]+$/.test(value.trim())) return "ltr";
  return undefined;
}

function FooterContactItemBlock({
  icon,
  label,
  value,
  href,
}: {
  icon?: string;
  label: string;
  value: string;
  href?: string;
}) {
  const iconText = icon?.trim() || null;
  const labelText = label.trim();
  const valueText = value.trim();
  const valueDir = valueText ? contactValueDir(valueText, href) : undefined;

  const row = (
    <div className="flex items-center gap-2.5">
      {iconText ? <span className="shrink-0 text-[#D8B87A]/50">{iconText}</span> : null}
      <div className="min-w-0 flex-1">
        {labelText ? <span className="text-[11px] font-medium text-white/45">{labelText}</span> : null}
        {labelText && valueText ? " " : null}
        {valueText && href?.trim() ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
            className="break-words text-white/55 transition-colors duration-300 hover:text-[#D8B87A]"
            dir={valueDir}
          >
            {valueText}
          </a>
        ) : valueText ? (
          <span className="break-words text-white/55" dir={valueDir}>
            {valueText}
          </span>
        ) : null}
      </div>
    </div>
  );

  return row;
}

export default function FooterContactSlot({ slot, immediateReveal }: FooterContactSlotProps) {
  const hasHeading = Boolean(slot.heading?.trim());

  return (
    <FooterSlotCard revealDelay={slot.revealDelay} immediateReveal={immediateReveal}>
      <FooterBlockHeader eyebrow={slot.heading} className={hasHeading ? "mb-5" : "mb-0"} />

      <ul className="space-y-4 text-[13px] text-white/50">
        {slot.items.map((item, index) => (
          <li key={`${slot.index}-contact-${index}-${item.label}-${item.value}-${item.icon ?? ""}`}>
            <FooterContactItemBlock
              icon={item.icon}
              label={item.label}
              value={item.value}
              href={item.href}
            />
          </li>
        ))}
      </ul>
    </FooterSlotCard>
  );
}
