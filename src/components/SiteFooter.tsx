"use client";

import FooterSocialBar from "./FooterSocialBar";
import FooterSlotRenderer from "./footer/FooterSlotRenderer";
import { useFooterComposition } from "./FooterSettingsProvider";

type SiteFooterProps = {
  immediateReveal?: boolean;
};

function footerGridClass(count: number) {
  if (count >= 4) return "grid gap-5 sm:grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
  if (count === 2) return "grid gap-5 sm:grid-cols-2 lg:grid-cols-2";
  return "grid gap-5 lg:grid-cols-1";
}

export default function SiteFooter({ immediateReveal = false }: SiteFooterProps) {
  const { slots } = useFooterComposition();

  return (
    <footer className="relative z-10 mt-13 border-t border-white/[0.06] bg-[#05070B]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right,transparent,rgba(216,184,122,0.35) 35%,rgba(216,184,122,0.35) 65%,transparent)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(30,58,95,0.18),transparent)]" />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className={footerGridClass(slots.length)}>
          {slots.map((slot) => (
            <FooterSlotRenderer key={slot.index} slot={slot} immediateReveal={immediateReveal} />
          ))}
        </div>

        <FooterSocialBar immediateReveal={immediateReveal} />
      </div>
    </footer>
  );
}
