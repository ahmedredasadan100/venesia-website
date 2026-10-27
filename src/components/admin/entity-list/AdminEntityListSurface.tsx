"use client";

import {
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { AdminFloatingLayerProvider } from "./AdminFloatingLayerContext";
import {
  ADMIN_CINEMATIC_GOLD_V1, resolveAdminCollectionPresentation,
  type AdminCollectionPresentation,
} from "../../../lib/admin/admin-ui-styles";

const PRIMARY_SECTION_MARKER_CLASS = "admin-entity-list-primary-section";
const SURFACE_LAYOUT_CLASSES = "flex flex-col gap-7";
const TABLE_REGION_LAYOUT_CLASSES = "flex flex-col gap-4";

/** Shared join between a standalone collection toolbar and its table card. */
export const ADMIN_ENTITY_LIST_JOINED_TABLE_CLASS = "!rounded-t-none !border-t-0";

export function AdminEntityListTableFrame({
  toolbar,
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"section"> & { toolbar?: ReactNode }) {
  return (
    <section
      {...props}
      className={`scroll-mt-6 flex min-w-0 flex-col ${toolbar ? "gap-0" : "gap-7"} ${className}`.trim()}
      data-admin-entity-list-table-frame=""
    >
      {toolbar}
      {children}
    </section>
  );
}

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
 * Groups the table owner and its pagination footer as one visible primary
 * section. The collection surface keeps the 28px section cadence while this
 * region owns the 16px internal table-to-footer rhythm.
 */
export function AdminEntityListTableRegion({
  className = "",
  presentation: requestedPresentation = "default",
  edgeMotion = "entry",
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  /** The region owns the joined frame; child owners retain scroll and layers. */
  presentation?: AdminCollectionPresentation;
  /** Entry is the official default; explicit continuous keeps its existing contract. */
  edgeMotion?: "continuous" | "entry";
}) {
  const presentation = resolveAdminCollectionPresentation(requestedPresentation);
  return (
    <div
      {...props}
      className={`${PRIMARY_SECTION_MARKER_CLASS} ${presentation === "cinematic" ? ADMIN_CINEMATIC_GOLD_V1.collection.frame : TABLE_REGION_LAYOUT_CLASSES} ${className}`.trim()}
      data-admin-entity-list-primary-section=""
      data-admin-entity-list-table-region=""
      data-admin-entity-list-table-region-presentation={presentation}
      data-admin-edge-motion={presentation === "cinematic" ? edgeMotion : undefined}
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
