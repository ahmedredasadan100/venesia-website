"use client";

import {
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { AdminFloatingLayerProvider } from "./AdminFloatingLayerContext";

const PRIMARY_SECTION_MARKER_CLASS = "admin-entity-list-primary-section";
const SURFACE_LAYOUT_CLASSES = "flex flex-col gap-7";
const TABLE_REGION_LAYOUT_CLASSES = "flex flex-col gap-4";

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
  children,
  className = "",
  "data-admin-entity-list-pending": queryPending,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  "data-admin-entity-list-pending"?: "true" | "false";
}) {
  return (
    <div
      {...props}
      className={`${PRIMARY_SECTION_MARKER_CLASS} ${TABLE_REGION_LAYOUT_CLASSES} ${className}`.trim()}
      data-admin-entity-list-primary-section=""
      data-admin-entity-list-table-region=""
      data-admin-entity-list-pending={queryPending}
    >
      {queryPending === "true" ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          dir="rtl"
          data-admin-entity-list-query-status=""
          className="sticky top-3 z-20 flex items-center gap-3 rounded-xl border border-[#D8B87A]/25 bg-[#11151B] px-4 py-3 text-sm leading-6 text-[#F4E7C5] shadow-lg"
        >
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-[#D8B87A]/30 border-t-[#D8B87A] motion-reduce:animate-none"
          />
          <p>
            <span className="font-semibold">جارٍ تحديث النتائج… </span>
            <span className="text-[#F4E7C5]/75">
              الصفوف والعدّادات المعروضة تخص النتائج السابقة.
            </span>
          </p>
        </div>
      ) : null}
      {children}
    </div>
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
