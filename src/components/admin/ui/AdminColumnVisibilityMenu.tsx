"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import { useAdminFloatingLayer } from "../entity-list/AdminFloatingLayerContext";
import AdminCheckbox from "./AdminCheckbox";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

export type AdminColumnVisibilityItem<Key extends string = string> = {
  key: Key;
  label: string;
  hideable: boolean;
};

type PersistResult = {
  ok: boolean;
  message?: string;
};

type AdminColumnVisibilityMenuProps<Key extends string> = {
  columns: readonly AdminColumnVisibilityItem<Key>[];
  visibleColumns: readonly Key[];
  defaultColumns: readonly Key[];
  onChange: (columns: Key[]) => void;
  onPersist: (columns: Key[]) => Promise<PersistResult>;
  onRestore?: () => Promise<PersistResult>;
  onPersisted?: (columns: Key[]) => void;
  label?: string;
  scrollAreaClassName?: string;
};

export default function AdminColumnVisibilityMenu<Key extends string>({
  columns,
  visibleColumns,
  defaultColumns,
  onChange,
  onPersist,
  onRestore,
  onPersisted,
  label = "الأعمدة",
  scrollAreaClassName = "",
}: AdminColumnVisibilityMenuProps<Key>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusMenuOnOpenRef = useRef(false);
  const menuId = useId();
  const layerId = `entity-columns:${menuId}`;
  const floating = useAdminFloatingLayer();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = floating
    ? floating.openLayerId === layerId
    : uncontrolledOpen;

  function setIsOpen(next: boolean) {
    if (floating) {
      floating.setOpenLayerId(next ? layerId : null);
      return;
    }
    setUncontrolledOpen(next);
  }

  const [error, setError] = useState("");
  // Manual pending counter instead of useTransition: persist success triggers
  // onPersisted (router.refresh). React entangles concurrently pending
  // transitions, so if that refresh transition is superseded/aborted (e.g. by
  // router prefetch churn) and never commits, a useTransition-based isPending
  // would stay true forever and strand the trigger spinner.
  const [pendingSaves, setPendingSaves] = useState(0);
  const isPending = pendingSaves > 0;
  const saveQueueRef = useRef<Promise<PersistResult>>(Promise.resolve({ ok: true }));
  const latestColumnsRef = useRef<Key[]>([...visibleColumns]);
  const isMounted = useClientMounted();
  const menuPosition = useAdminFloatingMenuPosition(isOpen, triggerRef, {
    minWidth: 280,
    preferredWidth: 280,
    offset: 8,
    align: "left",
    collisionPadding: 12,
    estimatedHeight: 458,
    zIndex: 10000,
  });

  useEffect(() => {
    if (!isOpen) return;
    function close(event: MouseEvent) {
      const target = event.target as Node;
      const element =
        target instanceof Element ? target : target.parentElement;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        element?.closest("[data-admin-column-menu]")
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, layerId, floating]);

  useEffect(() => {
    if (
      !isOpen ||
      !menuPosition ||
      !focusMenuOnOpenRef.current
    ) {
      return;
    }
    focusMenuOnOpenRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLInputElement>('input:not([disabled])')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, menuPosition]);

  function persist(
    next: Key[],
    persistOverride?: () => Promise<PersistResult>,
  ) {
    latestColumnsRef.current = next;
    flushSync(() => onChange(next));
    setError("");
    // Promise.resolve() wrapping keeps a synchronous throw from the handler
    // inside the promise lifecycle, so pendingSaves always unwinds and the
    // queue chain keeps resolving.
    const invokePersist = () =>
      Promise.resolve()
        .then(() => (persistOverride ? persistOverride() : onPersist(next)))
        .catch(() => ({
          ok: false,
          message: "تعذر حفظ تفضيلات الأعمدة.",
        }));
    // Every save — including Restore Defaults — chains on the same serial
    // queue. Writes therefore commit in user-action order and an older
    // in-flight save can never land in the database after a newer one
    // (latestColumnsRef only gates onPersisted, not the write itself).
    const resultPromise = saveQueueRef.current.then(invokePersist);
    saveQueueRef.current = resultPromise;
    setPendingSaves((count) => count + 1);
    void resultPromise.then((result) => {
      setPendingSaves((count) => count - 1);
      if (!result.ok) {
        setError(result.message || "تعذر حفظ تفضيلات الأعمدة.");
      } else if (
        latestColumnsRef.current.length === next.length &&
        latestColumnsRef.current.every((key, index) => key === next[index])
      ) {
        onPersisted?.(next);
      }
    });
    return resultPromise;
  }

  function toggle(key: Key) {
    const column = columns.find((item) => item.key === key);
    if (!column?.hideable) return;
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((item) => item !== key)
      : [...visibleColumns, key];
    persist(next);
  }

  const menu =
    isMounted &&
    isOpen &&
    menuPosition &&
    createPortal(
      <div
        ref={panelRef}
        id={menuId}
        role="menu"
        dir="rtl"
        data-admin-column-menu=""
        onMouseDown={(event) => event.stopPropagation()}
        data-placement={menuPosition.placement}
        style={menuPosition.style}
        className="flex flex-col overflow-hidden rounded-[16px] border border-[#D8B87A]/20 bg-[#080B10]/98 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <p className="shrink-0 px-2 py-2 text-xs font-semibold text-white/45">
          الأعمدة الظاهرة
        </p>
        <div
          data-admin-column-scroll-area
          className={`min-h-0 max-h-[340px] flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain ${scrollAreaClassName}`}
        >
          {columns.map((column) => {
            const checked = visibleColumns.includes(column.key);
            return (
              <label
                key={column.key}
                className={`flex items-center justify-between gap-3 rounded-[9px] border border-transparent px-2.5 py-2 text-sm transition focus-within:border-[#D8B87A]/35 focus-within:bg-[#D8B87A]/8 ${
                  column.hideable
                    ? `cursor-pointer hover:bg-white/[0.05] ${
                        checked ? "text-[#F4E7C5]" : "text-white/76"
                      }`
                    : "cursor-not-allowed text-white/38"
                }`}
              >
                <span>{column.label}</span>
                <AdminCheckbox
                  checked={checked}
                  disabled={!column.hideable}
                  onChange={() => toggle(column.key)}
                  label={`${checked ? "إخفاء" : "إظهار"} عمود ${column.label}`}
                />
              </label>
            );
          })}
        </div>
        <button
          type="button"
          data-default-columns={defaultColumns.join(",")}
          onClick={async () => {
            const result = await persist([...defaultColumns], onRestore);
            if (!result.ok) return;
            setIsOpen(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
          className="mt-2 w-full shrink-0 cursor-pointer rounded-[9px] border border-white/10 px-3 py-2.5 text-sm font-semibold text-[#D8B87A] transition hover:border-[#D8B87A]/30 hover:bg-[#D8B87A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          استعادة الأعمدة الافتراضية
        </button>
        {error ? (
          <p role="alert" className="shrink-0 px-2 pt-2 text-xs text-red-200">
            {error}
          </p>
        ) : null}
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (
            event.key !== "ArrowDown" &&
            event.key !== "ArrowUp"
          ) {
            return;
          }
          event.preventDefault();
          focusMenuOnOpenRef.current = true;
          setIsOpen(true);
        }}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white/72 transition hover:border-[#D8B87A]/30 hover:bg-white/[0.04] hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
      >
        <span aria-hidden="true">▥</span>
        {label}
        {isPending ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : null}
      </button>

      {menu}
    </div>
  );
}
