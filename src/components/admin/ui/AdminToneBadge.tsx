import type { ReactNode } from "react";

type AdminToneBadgeProps = {
  children: ReactNode;
  /** Tone classes — border/background/text colors supplied by caller. */
  toneClassName: string;
  className?: string;
};

export default function AdminToneBadge({ children, toneClassName, className = "" }: AdminToneBadgeProps) {
  return (
    <span
      className={["inline-flex items-center justify-center rounded-full border font-semibold", toneClassName, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
