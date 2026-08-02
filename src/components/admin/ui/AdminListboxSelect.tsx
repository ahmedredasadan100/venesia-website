"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import {
  ADMIN_FILTER_MENU_ATTR,
  ADMIN_FILTER_MENU_PANEL_CLASSES,
  ADMIN_FILTER_MENU_SCROLLBAR_CLASSES,
  isInsideAdminFilterMenu,
} from "./admin-filter-styles";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

export type AdminListboxSelectOption = {
  value: string;
  label: string;
  depth?: number;
  disabled?: boolean;
};

export type AdminListboxSelectProps = {
  id?: string;
  triggerId?: string;
  value: string;
  options: readonly AdminListboxSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  showPlaceholderForEmptyValue?: boolean;
  allowEmptySelection?: boolean;
  sizing?: "full" | "content" | "content-relaxed" | "medium" | "wide";
  /** Registers with exclusive floating layer when provided. */
  layerId?: string;
  openLayerId?: string | null;
  onOpenLayer?: (id: string | null) => void;
  inline?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  dir?: "rtl" | "ltr";
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Shared Admin listbox select (portal + fixed + dark surface).
 * Replaces native <select> for bulk actions and similar controls.
 */
export default function AdminListboxSelect({
  id,
  triggerId,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  placeholder,
  showPlaceholderForEmptyValue = false,
  allowEmptySelection = false,
  sizing = "full",
  layerId,
  openLayerId,
  onOpenLayer,
  inline = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid = false,
  dir = "rtl",
  searchable = false,
  searchPlaceholder = "ابحث في الخيارات",
  emptyMessage = "لا توجد خيارات مطابقة.",
}: AdminListboxSelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const resolvedTriggerId = triggerId ?? `${controlId}-trigger`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useClientMounted();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value);
  const [search, setSearch] = useState("");
  const resolvedOptions = useMemo(
    () =>
      allowEmptySelection && placeholder && !options.some((option) => option.value === "")
        ? [{ value: "", label: placeholder }, ...options]
        : options,
    [allowEmptySelection, options, placeholder],
  );
  const compactSized = sizing !== "full";
  const contentSized = sizing === "content" || sizing === "content-relaxed";
  const triggerSizingClassName =
    sizing === "content"
      ? "w-fit max-w-full ps-4 pe-4"
      : sizing === "content-relaxed"
        ? "min-w-32 w-fit max-w-full ps-4 pe-4"
        : sizing === "medium"
          ? "min-w-60 w-full max-w-full ps-4 pe-4"
          : sizing === "wide"
            ? "min-w-64 w-full max-w-full ps-4 pe-4"
            : "w-full px-4";
  const containerSizingClassName = contentSized
    ? "inline-block w-fit max-w-full"
    : compactSized
      ? "block w-full max-w-full"
      : "";

  const isControlled = typeof openLayerId !== "undefined" && Boolean(layerId);
  const isOpen = isControlled
    ? openLayerId === layerId
    : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (disabled && next) return;
    if (!next) setSearch("");
    if (isControlled && layerId && onOpenLayer) {
      onOpenLayer(next ? layerId : null);
      return;
    }
    setUncontrolledOpen(next);
  }

  const menuPosition = useAdminFloatingMenuPosition(isOpen, triggerRef, {
    minWidth: 180,
    preferredWidth: 180,
    align: dir === "rtl" ? "right" : "left",
    offset: 6,
    collisionPadding: 12,
    estimatedHeight: searchable ? 320 : 280,
    floatingRef: menuRef,
  });

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    if (!query) return resolvedOptions;
    return resolvedOptions.filter((option) =>
      option.label.toLocaleLowerCase("ar").includes(query),
    );
  }, [resolvedOptions, search]);
  const selectableOptions = useMemo(
    () => visibleOptions.filter((option) => !option.disabled),
    [visibleOptions],
  );

  const selected = useMemo(
    () => resolvedOptions.find((option) => option.value === value),
    [resolvedOptions, value],
  );
  const emptyValueUsesPlaceholder =
    showPlaceholderForEmptyValue && value === "" && Boolean(placeholder);
  const displayValue = emptyValueUsesPlaceholder
    ? placeholder
    : selected?.label ?? placeholder ?? "اختر";
  const activeIndex = Math.max(
    0,
    selectableOptions.findIndex((option) => option.value === activeValue),
  );
  const resolvedActiveValue = selectableOptions[activeIndex]?.value;
  const inlineTabStopValue =
    selectableOptions.find((option) => option.value === value)?.value ??
    selectableOptions[0]?.value;

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (isInsideAdminFilterMenu(target)) return;
      setSearch("");
      if (isControlled && layerId && onOpenLayer) onOpenLayer(null);
      else setUncontrolledOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSearch("");
      if (isControlled && layerId && onOpenLayer) onOpenLayer(null);
      else setUncontrolledOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isControlled, isOpen, layerId, onOpenLayer]);

  useEffect(() => {
    if (!isOpen || !searchable || !menuPosition) return;
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, menuPosition, searchable]);

  useEffect(() => {
    if (!isOpen || resolvedActiveValue === undefined) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`${controlId}-option-${resolvedActiveValue}`)
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [controlId, isOpen, resolvedActiveValue]);

  function handleSelect(next: string) {
    if (resolvedOptions.find((option) => option.value === next)?.disabled) return;
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab" && isOpen) {
      setOpen(false);
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!selectableOptions.length) return;
      if (!isOpen) {
        setActiveValue(value);
        setOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (activeIndex + direction + selectableOptions.length) %
        selectableOptions.length;
      setActiveValue(selectableOptions[nextIndex].value);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!selectableOptions.length) return;
      setActiveValue(
        selectableOptions[event.key === "Home" ? 0 : selectableOptions.length - 1].value,
      );
      if (!isOpen) setOpen(true);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      if (!selectableOptions.length) return;
      handleSelect(selectableOptions[activeIndex].value);
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!selectableOptions.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (activeIndex + direction + selectableOptions.length) %
        selectableOptions.length;
      setActiveValue(selectableOptions[nextIndex].value);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!selectableOptions.length) return;
      setActiveValue(
        selectableOptions[event.key === "Home" ? 0 : selectableOptions.length - 1].value,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!selectableOptions.length) return;
      handleSelect(selectableOptions[activeIndex].value);
    }
  }

  function handleInlineKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    optionValue: string,
  ) {
    if (!selectableOptions.length) return;
    const index = selectableOptions.findIndex(
      (option) => option.value === optionValue,
    );
    if (index < 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      onChange(
        selectableOptions[
          (index + direction + selectableOptions.length) % selectableOptions.length
        ].value,
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(selectableOptions[index].value);
    }
  }

  const menu =
    isMounted &&
    isOpen &&
    menuPosition &&
    createPortal(
      <div
        ref={menuRef}
        {...{ [ADMIN_FILTER_MENU_ATTR]: "" }}
        id={`${controlId}-popover`}
        dir={dir}
        data-admin-listbox-menu=""
        data-admin-listbox-popover=""
        data-placement={menuPosition.placement}
        style={menuPosition.style}
        className={`${ADMIN_FILTER_MENU_PANEL_CLASSES} overflow-hidden p-1.5`}
      >
        {searchable ? (
          <div className="p-1 pb-2">
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={`${controlId}-listbox`}
              aria-activedescendant={
                resolvedActiveValue !== undefined
                  ? `${controlId}-option-${resolvedActiveValue}`
                  : undefined
              }
              data-admin-listbox-search=""
              className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D8B87A]/45"
            />
          </div>
        ) : null}

        <div
          id={`${controlId}-listbox`}
          role="listbox"
          aria-labelledby={resolvedTriggerId}
          className={`${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} p-0.5`}
        >
          {visibleOptions.length ? (
            visibleOptions.map((option) => {
              const selectedOption = option.value === value;
              const active = option.value === resolvedActiveValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  id={`${controlId}-option-${option.value}`}
                  role="option"
                  aria-selected={selectedOption}
                  aria-disabled={option.disabled || undefined}
                  tabIndex={-1}
                  disabled={option.disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option.value)}
                  className={`block w-full rounded-[8px] px-2.5 py-2 text-right text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${
                    option.disabled
                      ? "cursor-not-allowed bg-white/[0.02] text-white/28"
                      : selectedOption
                      ? "bg-[#D8B87A]/14 font-medium text-[#E6C882]"
                      : active
                        ? "bg-[#D8B87A]/[0.09] text-[#F2D99B]"
                        : "cursor-pointer text-white/78 hover:bg-[#D8B87A]/[0.07] hover:text-[#F2D99B]"
                  }`}
                >
                  <span className="flex min-w-0 items-center">
                    {option.depth ? (
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-white/28"
                      >
                        {"— ".repeat(option.depth)}
                      </span>
                    ) : null}
                    <span
                      className={
                        compactSized
                          ? "min-w-0 whitespace-normal break-words text-start leading-5"
                          : "truncate"
                      }
                    >
                      {option.label}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p role="status" className="px-3 py-4 text-center text-xs text-white/45">
              {emptyMessage}
            </p>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={`relative overflow-visible ${containerSizingClassName} ${className}`}>
      {inline ? (
        <div
          dir={dir}
          data-admin-listbox-menu=""
          className="rounded-2xl border border-white/10 bg-black/25 p-1.5"
        >
          {searchable ? (
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={`${controlId}-listbox`}
              aria-activedescendant={
                resolvedActiveValue !== undefined
                  ? `${controlId}-option-${resolvedActiveValue}`
                  : undefined
              }
              data-admin-listbox-search=""
              className="mb-2 h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D8B87A]/45"
            />
          ) : null}
          <div
            id={`${controlId}-listbox`}
            role="listbox"
            aria-label={ariaLabel ?? placeholder}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid || undefined}
            className={`${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} max-h-44 overflow-y-auto p-0.5`}
          >
            {visibleOptions.length ? (
              visibleOptions.map((option) => {
                const selectedOption = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    id={`${controlId}-option-${option.value}`}
                    role="option"
                    aria-selected={selectedOption}
                    aria-disabled={option.disabled || undefined}
                    disabled={option.disabled}
                    tabIndex={option.value === inlineTabStopValue ? 0 : -1}
                    onClick={() => handleSelect(option.value)}
                    onKeyDown={(event) => handleInlineKeyDown(event, option.value)}
                    className={`block w-full rounded-[8px] px-2.5 py-2 text-right text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${
                      option.disabled
                        ? "cursor-not-allowed bg-white/[0.02] text-white/28"
                        : selectedOption
                        ? "bg-[#D8B87A]/14 font-medium text-[#E6C882]"
                        : "cursor-pointer text-white/78 hover:bg-[#D8B87A]/[0.07] hover:text-[#F2D99B]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center">
                      {option.depth ? (
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-white/28"
                        >
                          {"— ".repeat(option.depth)}
                        </span>
                      ) : null}
                      <span className="truncate">{option.label}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p role="status" className="px-3 py-4 text-center text-xs text-white/45">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      ) : null}
      {!inline ? (
        <button
          ref={triggerRef}
          type="button"
          id={resolvedTriggerId}
          role="combobox"
          aria-label={ariaLabel ?? placeholder}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${controlId}-listbox`}
          aria-activedescendant={
            isOpen && resolvedActiveValue !== undefined
              ? `${controlId}-option-${resolvedActiveValue}`
              : undefined
          }
          disabled={disabled}
          onClick={() => {
            setActiveValue(value);
            setOpen(!isOpen);
          }}
          onKeyDown={handleKeyDown}
          className={`flex h-11 cursor-pointer items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/28 text-sm text-white outline-none transition hover:border-white/18 focus:border-[#D8B87A]/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-55 ${triggerSizingClassName}`}
        >
          <span className={`min-w-0 truncate ${selected && !emptyValueUsesPlaceholder ? "text-white/78" : "text-white/35"}`}>
            {displayValue}
          </span>
          <span
            className={`shrink-0 text-white/45 transition ${isOpen ? "rotate-180" : ""}`}
          >
            <ChevronDownIcon />
          </span>
        </button>
      ) : null}
      {menu}
    </div>
  );
}
