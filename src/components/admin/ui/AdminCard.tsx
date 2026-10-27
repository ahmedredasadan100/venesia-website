import type { ReactNode } from "react";
import { ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME } from "../../../lib/admin/admin-ui-styles";

type AdminCardProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  /** @deprecated Cards use the shared system surface; retained for existing callers. */
  presentation?: "default" | "premium";
};

export default function AdminCard({
  id,
  children,
  className = "",
  interactive = false,
}: AdminCardProps) {
  return (
    <section
      id={id}
      className={`relative ${ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME} ${
        interactive
          ? "transition duration-300 hover:-translate-y-0.5 hover:border-[#D8B87A]/28 hover:bg-[#10131A]/82 hover:shadow-[0_24px_90px_rgba(0,0,0,0.3)]"
          : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}
