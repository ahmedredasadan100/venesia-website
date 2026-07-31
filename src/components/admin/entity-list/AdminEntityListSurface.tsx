"use client";

import {
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { AdminFloatingLayerProvider } from "./AdminFloatingLayerContext";

const PRIMARY_SECTION_MARKER_CLASS = "admin-entity-list-primary-section";
const SURFACE_LAYOUT_CLASSES = "flex flex-col gap-7";

/**
 * Page-level cadence for list pages whose header and list surface are direct
 * siblings. Every direct child is a visible primary section, so the shared
 * 28px gap can be applied without affecting feedback or operational blocks.
 */
export function AdminEntityListPageLayout({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`flex flex-col gap-7 ${className}`.trim()}
      data-admin-entity-list-page-layout=""
    />
  );
}

/**
 * Marks a visible top-level list section. The parent surface owns the shared
 * 28px cadence so child sections never add competing margins.
 */
export function AdminEntityListPrimarySection({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`${PRIMARY_SECTION_MARKER_CLASS} ${className}`.trim()}
      data-admin-entity-list-primary-section=""
    />
  );
}

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
  const surfaceRef = useRef<HTMLDivElement>(null);

  return (
    <AdminFloatingLayerProvider fallbackFocusRef={surfaceRef}>
      <div
        ref={surfaceRef}
        tabIndex={-1}
        className={`${SURFACE_LAYOUT_CLASSES} ${className}`.trim()}
        data-admin-entity-list-surface=""
        data-admin-entity-list-consumer={consumer}
      >
        {children}
      </div>
    </AdminFloatingLayerProvider>
  );
}
