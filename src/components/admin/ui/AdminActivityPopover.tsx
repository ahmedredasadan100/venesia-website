"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import { useAdminFloatingLayer } from "../entity-list/AdminFloatingLayerContext";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "./admin-scrollbar-styles";
import { AdminDataGridActionButton } from "./AdminDataGrid";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

export type AdminActivityItem = {
  label: string;
  value: string;
};

export type AdminActivityPopoverProps = {
  title: string;
  triggerLabel: string;
  dialogLabel?: string;
  items: AdminActivityItem[];
  loading?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
};

export default function AdminActivityPopover({
  title,
  triggerLabel,
  dialogLabel = title,
  items,
  loading = false,
  errorMessage,
  emptyMessage = "لا توجد بيانات نشاط متاحة.",
}: AdminActivityPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const layerId = `entity-activity:${panelId}`;
  const floating = useAdminFloatingLayer();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = floating
    ? floating.openLayerId === layerId
    : uncontrolledOpen;
  const setIsOpen = useCallback((next: boolean) => {
    if (floating) {
      floating.setOpenLayerId(next ? layerId : null);
      return;
    }
    setUncontrolledOpen(next);
  }, [floating, layerId]);
  const toggleOpen = useCallback(() => {
    if (floating) {
      floating.toggleLayer(layerId);
      return;
    }
    setUncontrolledOpen((current) => !current);
  }, [floating, layerId]);
  const isMounted = useClientMounted();
  const position = useAdminFloatingMenuPosition(isOpen, triggerRef, {
    minWidth: 320,
    preferredWidth: 320,
    offset: 8,
    align: "right",
    collisionPadding: 12,
    estimatedHeight: 310,
    zIndex: 10000,
  });

  useEffect(() => {
    if (!isOpen) return;
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const panel =
    isMounted && isOpen && position
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={dialogLabel}
            dir="rtl"
            data-admin-activity-popover=""
            data-placement={position.placement}
            style={position.style}
            className={`overflow-y-auto overflow-x-hidden overscroll-contain rounded-[18px] border border-[#D8B87A]/22 bg-[#080B10]/98 p-4 text-right shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}
          >
            <p className="mb-3 text-sm font-bold text-white">{title}</p>
            {loading ? (
              <p role="status" className="py-4 text-sm text-white/45">
                جارٍ تحميل النشاط…
              </p>
            ) : errorMessage ? (
              <p role="alert" className="py-4 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : items.length ? (
              <dl className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5"
                  >
                    <dt className="text-[11px] text-white/42">{item.label}</dt>
                    <dd
                      className="mt-1 truncate text-sm font-medium text-white/78"
                      title={item.value}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="py-4 text-sm text-white/45">{emptyMessage}</p>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <AdminDataGridActionButton
        action="activity"
        buttonRef={triggerRef}
        size="compact"
        title={triggerLabel}
        ariaLabel={triggerLabel}
        ariaHasPopup="dialog"
        ariaExpanded={isOpen}
        ariaControls={panelId}
        onClick={toggleOpen}
      />
      {panel}
    </>
  );
}
