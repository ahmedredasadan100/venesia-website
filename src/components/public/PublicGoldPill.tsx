import Link from "next/link";
import type { ReactNode } from "react";

export const PUBLIC_GOLD_PILL_CLASS_NAME =
  "rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur transition hover:border-[#D8B87A]/60";

type PublicGoldPillProps = {
  children: ReactNode;
  href?: string;
  current?: boolean;
};

export default function PublicGoldPill({ children, href, current = false }: PublicGoldPillProps) {
  const resolvedHref = href?.trim();

  if (resolvedHref) {
    return (
      <Link href={resolvedHref} className={PUBLIC_GOLD_PILL_CLASS_NAME}>
        {children}
      </Link>
    );
  }

  return (
    <span className={PUBLIC_GOLD_PILL_CLASS_NAME} aria-current={current ? "page" : undefined}>
      {children}
    </span>
  );
}
