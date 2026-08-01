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
  badge?: ReactNode;
  status?: AdminPageContextHeaderProps["status"];
  display?: AdminPageContextHeaderProps["variant"];
};

export default function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow = "ADMIN PANEL",
  meta,
  breadcrumb,
  className = "",
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
      badge={badge}
      status={status}
      variant={display}
    />
  );
}
