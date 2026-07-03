import type { ReactNode } from "react";
import { AdminPageHeader as UnifiedAdminPageHeader } from "./ui";

type AdminPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
  variant?: "default" | "context";
  contextLine?: ReactNode;
};

/**
 * Legacy compatibility wrapper.
 *
 * Keep this file only so older admin pages do not break while CRUD pages are
 * migrated. The actual visual source of truth is components/admin/ui/AdminPageHeader.
 */
export default function AdminPageHeader({
  eyebrow = "Admin Panel",
  title,
  description,
  actions,
  meta,
  breadcrumb,
  className,
  variant,
  contextLine,
}: AdminPageHeaderProps) {
  return (
    <UnifiedAdminPageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      meta={meta}
      breadcrumb={breadcrumb}
      className={className}
      variant={variant}
      contextLine={contextLine}
    />
  );
}
