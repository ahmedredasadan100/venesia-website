"use client";

import { forwardRef } from "react";
import {
  ADMIN_FILTER_ROW_CLASSES,
  ADMIN_FILTER_SHELL_CLASSES,
  ADMIN_FILTER_SHELL_GLOW_STYLE,
} from "./admin-filter-styles";

export type AdminFiltersShellProps = {
  children: React.ReactNode;
  className?: string;
  rowClassName?: string;
};

const AdminFiltersShell = forwardRef<HTMLElement, AdminFiltersShellProps>(function AdminFiltersShell(
  { children, className = "", rowClassName = "" },
  ref,
) {
  return (
    <section ref={ref} dir="rtl" className={`${ADMIN_FILTER_SHELL_CLASSES} ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[26px] opacity-70 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={ADMIN_FILTER_SHELL_GLOW_STYLE}
      />

      <div className={`${ADMIN_FILTER_ROW_CLASSES} ${rowClassName}`}>{children}</div>
    </section>
  );
});

export default AdminFiltersShell;
