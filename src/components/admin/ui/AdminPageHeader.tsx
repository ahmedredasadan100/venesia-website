import type { ReactNode } from "react";

import AdminPageContextHeader from "./AdminPageContextHeader";
import type { AdminPageContextHeaderProps } from "./AdminPageContextHeader";

type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
  /** Compatibility name; both values now use the single shared header core. */
  variant?: "default" | "context";
  contextLine?: ReactNode;
  badge?: ReactNode;
  status?: AdminPageContextHeaderProps["status"];
  display?: AdminPageContextHeaderProps["variant"];
};

export default function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow = "Admin Panel",
  meta,
  breadcrumb,
  className = "",
  contextLine,
  badge,
  status,
  display,
}: AdminPageHeaderProps) {
  return (
    <AdminPageContextHeader
      title={title}
      description={description}
      actions={actions}
      eyebrow={eyebrow}
      meta={meta}
      breadcrumb={breadcrumb}
      className={className}
      contextLine={contextLine}
      badge={badge}
      status={status}
      variant={display}
    />
  );
}
