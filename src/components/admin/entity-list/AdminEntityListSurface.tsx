"use client";

import type { ReactNode } from "react";
import { AdminFloatingLayerProvider } from "./AdminFloatingLayerContext";

/**
 * Owns exclusive floating-layer state for an entire entity list surface
 * (filters, columns, bulk, pagination page-size).
 */
export default function AdminEntityListSurface({
  children,
  className = "",
  consumer,
}: {
  children: ReactNode;
  className?: string;
  /** Optional consumer marker for QA. */
  consumer?: string;
}) {
  return (
    <AdminFloatingLayerProvider>
      <div
        className={className}
        data-admin-entity-list-surface=""
        data-admin-entity-list-consumer={consumer}
      >
        {children}
      </div>
    </AdminFloatingLayerProvider>
  );
}
