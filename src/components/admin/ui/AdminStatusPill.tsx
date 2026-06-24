import type { ReactNode } from "react";

type AdminStatusPillProps = {
  children: ReactNode;
  tone?: "green" | "gold" | "muted" | "red" | "blue";
};

const tones: Record<NonNullable<AdminStatusPillProps["tone"]>, string> = {
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-400/15",
  gold: "bg-[#D8B87A]/10 text-[#D8B87A] border-[#D8B87A]/20",
  muted: "bg-white/8 text-white/45 border-white/10",
  red: "bg-red-500/10 text-red-300 border-red-400/15",
  blue: "bg-sky-500/10 text-sky-300 border-sky-400/15",
};

export default function AdminStatusPill({ children, tone = "muted" }: AdminStatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
