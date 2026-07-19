"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AdminEntityFilterGroup,
  AdminEntityFilterOption,
} from "../../../lib/admin/entity-list";
import {
  ADMIN_FILTER_MENU_ATTR,
  ADMIN_FILTER_MENU_PANEL_CLASSES,
  ADMIN_FILTER_MENU_SCROLLBAR_CLASSES,
  isInsideAdminFilterMenu,
} from "./admin-filter-styles";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

export type AdminFilterListboxOption = AdminEntityFilterOption;
export type AdminFilterListboxGroup = AdminEntityFilterGroup;

export type AdminFilterListboxProps = {
  id: string;
  isMounted: boolean;
  placeholder: string;
  value: string;
  displayValue: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  options?: AdminFilterListboxOption[];
  groups?: AdminFilterListboxGroup[];
  className?: string;
  allValue?: string;
  disabled?: boolean;
  /** Exclusive floating-layer registration (shared surface). */
  layerId?: string;
  openLayerId?: string | null;
  onOpenLayer?: (id: string | null) => void;
};

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ListboxItem({
  label,
  id,
  selected,
  active,
  depth = 0,
  onSelect,
}: {
  label: string;
  id: string;
  selected: boolean;
  active: boolean;
  depth?: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={`block w-full cursor-pointer rounded-[8px] px-2.5 py-2 text-right text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${
        selected
          ? "bg-[#D8B87A]/14 font-medium text-[#E6C882]"
          : active
            ? "bg-white/[0.07] text-white"
            : "text-white/78 hover:bg-white/[0.05]"
      }`}
    >
      <span className="flex min-w-0 items-center">
        {depth ? (
          <span aria-hidden="true" className="shrink-0 text-white/28">
            {"— ".repeat(depth)}
          </span>
        ) : null}
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
}

function withoutAllValue(
  items: AdminFilterListboxOption[],
  allValue: string,
): AdminFilterListboxOption[] {
  return items.filter((option) => option.value !== allValue);
}

export default function AdminFilterListbox({
  id,
  isMounted,
  placeholder,
  value,
  displayValue,
  isOpen,
  onToggle,
  onSelect,
  options = [],
  groups = [],
  className = "",
  allValue = "all",
  disabled = false,
  layerId,
  onOpenLayer,
}: AdminFilterListboxProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeValue, setActiveValue] = useState(value);
  const menuPosition = useAdminFloatingMenuPosition(isOpen, triggerRef, {
    minWidth: 220,
    collisionPadding: 12,
    estimatedHeight: 340,
  });
  const isPlaceholder = value === allValue;

  const safeOptions = useMemo(
    () => withoutAllValue(options, allValue),
    [allValue, options],
  );
  const safeGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          options: withoutAllValue(group.options, allValue),
        }))
        .filter((group) => group.options.length > 0),
    [allValue, groups],
  );

  const flatOptions = useMemo(
    () => [
      { value: allValue, label: placeholder },
      ...(safeGroups.length
        ? safeGroups.flatMap((group) => group.options)
        : safeOptions),
    ],
    [allValue, placeholder, safeGroups, safeOptions],
  );
  const activeIndex = Math.max(
    0,
    flatOptions.findIndex((option) => option.value === activeValue),
  );

  function closeAndFocus() {
    if (layerId && onOpenLayer) onOpenLayer(null);
    else if (isOpen) onToggle();
    // Defer focus until after portal teardown / React commit.
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleToggle() {
    if (disabled) return;
    if (!isOpen) setActiveValue(value);
    if (layerId && onOpenLayer) {
      onOpenLayer(isOpen ? null : layerId);
      return;
    }
    onToggle();
  }

  function handleSelect(next: string) {
    onSelect(next);
    if (layerId && onOpenLayer) onOpenLayer(null);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (isInsideAdminFilterMenu(target)) return;
      closeAndFocus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeAndFocus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // closeAndFocus closes via latest props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, layerId, onOpenLayer, onToggle]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeAndFocus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setActiveValue(value);
        handleToggle();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (activeIndex + direction + flatOptions.length) % flatOptions.length;
      setActiveValue(flatOptions[nextIndex].value);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      handleSelect(flatOptions[activeIndex].value);
    }
  }

  const menu =
    isMounted &&
    isOpen &&
    menuPosition &&
    createPortal(
      <div
        {...{ [ADMIN_FILTER_MENU_ATTR]: "" }}
        id={`${id}-listbox`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
        dir="rtl"
        data-admin-filter-listbox=""
        data-placement={menuPosition.placement}
        style={menuPosition.style}
        className={`${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} ${ADMIN_FILTER_MENU_PANEL_CLASSES} p-1.5`}
      >
        <ListboxItem
          id={`${id}-option-${allValue}`}
          label={placeholder}
          selected={value === allValue}
          active={activeValue === allValue}
          onSelect={() => handleSelect(allValue)}
        />

        {safeGroups.length > 0
          ? safeGroups.map((group) => (
              <div key={group.label} className="mt-1">
                <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
                  {group.label}
                </p>
                {group.options.map((option) => (
                  <ListboxItem
                    key={option.value}
                    id={`${id}-option-${option.value}`}
                    label={option.label}
                    selected={value === option.value}
                    active={activeValue === option.value}
                    depth={option.depth}
                    onSelect={() => handleSelect(option.value)}
                  />
                ))}
              </div>
            ))
          : safeOptions.map((option) => (
              <ListboxItem
                key={option.value}
                id={`${id}-option-${option.value}`}
                label={option.label}
                selected={value === option.value}
                active={activeValue === option.value}
                depth={option.depth}
                onSelect={() => handleSelect(option.value)}
              />
            ))}
      </div>,
      document.body,
    );

  return (
    <div className={`relative overflow-visible ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={isOpen ? `${id}-option-${activeValue}` : undefined}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-black/25 px-3 text-sm transition hover:border-white/18 focus:border-[#4A8DFF]/35 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-55 ${
          isPlaceholder ? "text-white/45" : "font-medium text-white"
        }`}
      >
        <span className="truncate">{displayValue}</span>
        <span className={`shrink-0 text-white/45 transition ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDownIcon />
        </span>
      </button>

      {menu}
    </div>
  );
}
