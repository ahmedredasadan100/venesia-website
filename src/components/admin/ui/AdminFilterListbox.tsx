"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ADMIN_FILTER_MENU_ATTR,
  ADMIN_FILTER_MENU_PANEL_CLASSES,
  ADMIN_FILTER_MENU_SCROLLBAR_CLASSES,
} from "./admin-filter-styles";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

export type AdminFilterListboxOption = {
  value: string;
  label: string;
};

export type AdminFilterListboxGroup = {
  label: string;
  options: AdminFilterListboxOption[];
};

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
  onSelect,
}: {
  label: string;
  id: string;
  selected: boolean;
  active: boolean;
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
      {label}
    </button>
  );
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
}: AdminFilterListboxProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeValue, setActiveValue] = useState(value);
  const menuPosition = useAdminFloatingMenuPosition(isOpen, triggerRef);
  const isPlaceholder = value === allValue;
  const flatOptions = useMemo(
    () => [
      { value: allValue, label: placeholder },
      ...(groups.length ? groups.flatMap((group) => group.options) : options),
    ],
    [allValue, groups, options, placeholder],
  );
  const activeIndex = Math.max(0, flatOptions.findIndex((option) => option.value === activeValue));

  function handleToggle() {
    if (!isOpen) setActiveValue(value);
    onToggle();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      onToggle();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setActiveValue(value);
        onToggle();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (activeIndex + direction + flatOptions.length) % flatOptions.length;
      setActiveValue(flatOptions[nextIndex].value);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      onSelect(flatOptions[activeIndex].value);
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
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: 9999,
        }}
        className={`${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} ${ADMIN_FILTER_MENU_PANEL_CLASSES} p-1.5`}
      >
        <ListboxItem
          id={`${id}-option-${allValue}`}
          label={placeholder}
          selected={value === allValue}
          active={activeValue === allValue}
          onSelect={() => onSelect(allValue)}
        />

        {groups.length > 0
          ? groups.map((group) => (
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
                    onSelect={() => onSelect(option.value)}
                  />
                ))}
              </div>
            ))
          : options.map((option) => (
              <ListboxItem
                key={option.value}
                id={`${id}-option-${option.value}`}
                label={option.label}
                selected={value === option.value}
                active={activeValue === option.value}
                onSelect={() => onSelect(option.value)}
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
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-black/25 px-3 text-sm transition hover:border-white/18 focus:border-[#4A8DFF]/35 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${
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
