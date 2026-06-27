import type { ReactNode } from "react";

type FooterSlotCardProps = {
  revealDelay: number;
  immediateReveal?: boolean;
  children: ReactNode;
};

export default function FooterSlotCard({ revealDelay, immediateReveal = false, children }: FooterSlotCardProps) {
  const revealClass = immediateReveal ? "is-revealed" : "";

  return (
    <div
      data-reveal
      data-delay={String(revealDelay)}
      className={`group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05] ${revealClass}`}
    >
      {children}
    </div>
  );
}
