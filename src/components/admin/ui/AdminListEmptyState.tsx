import Link from "next/link";
import type { ReactNode } from "react";

type AdminListEmptyStateProps = {
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
  children?: ReactNode;
};

export default function AdminListEmptyState({
  title,
  description,
  action,
  children,
}: AdminListEmptyStateProps) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      {description ? <p className="mt-3 text-sm text-white/45">{description}</p> : null}
      {children}
      {action ? (
        <Link
          href={action.href}
          className="mt-6 inline-flex rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
