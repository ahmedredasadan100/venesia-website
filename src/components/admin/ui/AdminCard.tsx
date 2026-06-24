import type { ReactNode } from "react";

type AdminCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export default function AdminCard({
  children,
  className = "",
  interactive = false,
}: AdminCardProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#080B10]/78 shadow-[0_18px_70px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl ${
        interactive
          ? "transition duration-300 hover:-translate-y-0.5 hover:border-[#D8B87A]/28 hover:bg-[#10131A]/82 hover:shadow-[0_24px_90px_rgba(0,0,0,0.3)]"
          : ""
      } ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[#D8B87A]/38 to-transparent" />
      {children}
    </section>
  );
}
