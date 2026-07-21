import Link from "next/link";
import type {
  ChangeEventHandler,
  MouseEventHandler,
  ReactNode,
  Ref,
  RefObject,
} from "react";
import AdminCheckbox from "./AdminCheckbox";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

type SortLabelProps = BaseProps & {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
  direction?: "asc" | "desc";
};

type GridProps = BaseProps & {
  summary?: ReactNode;
  scrollLabel?: string;
};

type GridLineProps = BaseProps & {
  columns: string;
  horizontalScroll?: boolean;
};

type DataGridAction =
  | "activity"
  | "delete"
  | "duplicate"
  | "edit"
  | "feature"
  | "preview"
  | "visibility";

type ActionButtonProps = {
  children?: ReactNode;
  title?: string;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaHasPopup?: "dialog" | "menu";
  ariaPressed?: boolean;
  ariaControls?: string;
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  tone?: "gold" | "green" | "blue" | "red" | "dark";
  action?: DataGridAction;
  isCurrentlyHidden?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  pending?: boolean;
  active?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  size?: "default" | "compact";
};

type CheckboxProps = {
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
};

const actionTones: Record<NonNullable<ActionButtonProps["tone"]>, string> = {
  gold: "border-[#D8B87A]/20 bg-[#D8B87A]/10 text-[#F1C668] hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/16",
  green: "border-emerald-400/20 bg-emerald-500/14 text-emerald-100 hover:border-emerald-300/38 hover:bg-emerald-500/20",
  blue: "border-sky-300/18 bg-sky-500/10 text-sky-100 hover:border-sky-300/38 hover:bg-sky-500/16",
  red: "border-red-300/15 bg-red-500/85 text-white shadow-[0_12px_30px_rgba(220,38,38,0.22)] hover:bg-red-500",
  dark: "border-white/8 bg-white/[0.075] text-white transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]",
};

const actionDefaults: Record<DataGridAction, { tone: NonNullable<ActionButtonProps["tone"]>; title: string }> = {
  edit: { tone: "gold", title: "تعديل" },
  preview: { tone: "dark", title: "معاينة" },
  visibility: { tone: "green", title: "إظهار / إخفاء" },
  feature: { tone: "gold", title: "تمييز" },
  duplicate: { tone: "blue", title: "نسخ" },
  delete: { tone: "red", title: "حذف" },
  activity: { tone: "dark", title: "معلومات النشاط" },
};

export const ADMIN_DATA_GRID_RULES = {
  actionOrder: ["edit", "preview", "visibility", "duplicate", "delete"],
  actionButton: "h-11 w-11 rounded-[8px] cursor-pointer shrink-0",
  actionButtonCompact: "h-10 w-10 rounded-[8px] cursor-pointer shrink-0",
  actionIcon: "h-4 w-4 shrink-0",
  checkbox: "h-4 w-4 accent-[#D8B87A] cursor-pointer",
  rowPadding: "px-5 py-4",
  bulkBarTrigger: "selectedIds.length > 0",
  /** Default gap between action buttons (Tailwind gap-1.5 = 6px). */
  actionGapPx: 6,
  actionGapCompactPx: 4,
  actionButtonPx: 44,
  actionButtonCompactPx: 40,
  /** Official row separator — opt-in via `AdminDataGridRow divided` (matches Topics divide-y). */
  rowDivider: "border-t border-white/8",
} as const;

/** Shared table header surface — Admin Data Grid + manual grid headers (Topics list, Categories tree). */
export const ADMIN_DATA_GRID_HEADER_CLASSES =
  "border-b border-[#D8B87A]/18 bg-[linear-gradient(135deg,rgba(216,184,122,0.14),rgba(56,189,248,0.08),rgba(255,255,255,0.03))] text-sm font-bold text-[#F4E7C5] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";

/** Width in px for a fixed actions column — use in gridTemplateColumns. */
export function getAdminDataGridActionsColumnWidth(
  buttonCount: number,
  size: "default" | "compact" = buttonCount > 4 ? "compact" : "default",
  cellInlinePaddingPx = 0,
) {
  const buttonPx =
    size === "compact" ? ADMIN_DATA_GRID_RULES.actionButtonCompactPx : ADMIN_DATA_GRID_RULES.actionButtonPx;
  const gapPx = size === "compact" ? ADMIN_DATA_GRID_RULES.actionGapCompactPx : ADMIN_DATA_GRID_RULES.actionGapPx;
  const contentWidth = buttonPx * buttonCount + gapPx * Math.max(0, buttonCount - 1);

  // Small buffer so borders never clip at the cell edge.
  return contentWidth + cellInlinePaddingPx * 2 + 4;
}

export function adminDataGridActionsColumn(
  buttonCount: number,
  size?: "default" | "compact",
): string {
  return `${getAdminDataGridActionsColumnWidth(buttonCount, size)}px`;
}

/** Presets aligned with Topics golden reference and common action counts. */
export const ADMIN_DATA_GRID_ACTION_COLUMNS = {
  /** 4 standard actions — Topics reference (edit, visibility, duplicate, delete). */
  four: adminDataGridActionsColumn(4, "default"),
  /** 3 standard actions. */
  three: adminDataGridActionsColumn(3, "default"),
  /** 5 compact actions — reorder + CRUD rows. */
  fiveCompact: adminDataGridActionsColumn(5, "compact"),
  /** 6 compact actions — reorder + edit + visibility + duplicate + delete. */
  sixCompact: adminDataGridActionsColumn(6, "compact"),
  /** 1 standard action. */
  one: adminDataGridActionsColumn(1, "default"),
} as const;

/**
 * Official column-width presets for admin Data Grids (Admin Data Grid Contract).
 * Pages must build `gridTemplateColumns` from these presets + `ADMIN_DATA_GRID_ACTION_COLUMNS`.
 * A raw literal width is only allowed with an inline comment explaining why no preset fits.
 */
export const ADMIN_DATA_GRID_COLUMNS = {
  /** Checkbox column — fixed, matches Topics golden reference. */
  checkbox: "46px",
  /** Primary column for content-heavy tables (Topic / Template / Series). */
  primaryStandard: "minmax(320px,1fr)",
  /** Primary column for multi-column tables that need room for the rest (Pages / Menus). */
  primaryCompact: "minmax(260px,1fr)",
  /** Short status labels (ظاهر / منشور). */
  statusCompact: "88px",
  /** Longer status labels or general tables (منشورة / غير منشورة) — safer default for Arabic. */
  statusStandard: "96px",
  /** Numeric count column (tabular-nums). */
  count: "72px",
  /** Slug / short code column. */
  slug: "150px",
  /** Compact slug / short-code column for dense multi-column tables (Menus). */
  slugCompact: "120px",
} as const;

function GridIcon({
  action,
  isCurrentlyHidden = false,
  active = false,
}: {
  action: DataGridAction;
  isCurrentlyHidden?: boolean;
  active?: boolean;
}) {
  if (action === "edit") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20h4.8L19.2 9.6a2.4 2.4 0 0 0-3.4-3.4L5.4 16.6 4 20Z" />
        <path d="m14.5 7.5 2 2" />
      </svg>
    );
  }

  if (action === "visibility") {
    return isCurrentlyHidden ? (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.2 5.6A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.4 3.6" />
        <path d="M6.5 6.9C4.5 8.2 3 10.4 2.5 12c1 2.5 4.5 7 9.5 7 1.2 0 2.3-.25 3.3-.7" />
      </svg>
    ) : (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </svg>
    );
  }

  if (action === "duplicate") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 8h10v12H8z" />
        <path d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      </svg>
    );
  }

  if (action === "feature") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={ADMIN_DATA_GRID_RULES.actionIcon}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          fill={active ? "currentColor" : "none"}
          d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88L12 3Z"
        />
      </svg>
    );
  }

  if (action === "preview") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 3h7v7" />
        <path d="M10 14 21 3" />
        <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
      </svg>
    );
  }

  if (action === "activity") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={ADMIN_DATA_GRID_RULES.actionIcon}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7" />
        <path
          d="M4 4v4.7h4.7M12 7.5V12l3 1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function AdminDataGrid({ children, summary, scrollLabel, className = "" }: GridProps) {
  return (
    <section
      className={`rounded-[20px] border border-[#D8B87A]/12 bg-[#080B10]/86 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl ${className}`}
    >
      <div
        dir={scrollLabel ? "rtl" : undefined}
        role={scrollLabel ? "region" : undefined}
        aria-label={scrollLabel}
        tabIndex={scrollLabel ? 0 : undefined}
        data-admin-data-grid-scroll={scrollLabel ? "" : undefined}
        className={`overflow-x-auto overflow-y-hidden rounded-[14px] border border-white/8 bg-black/14 ${scrollLabel ? "overscroll-x-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.24)_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70" : ""}`}
      >
        {children}
      </div>
      {summary ? (
        <div className="mt-4 rounded-[12px] border border-white/8 bg-black/14 px-5 py-5 text-center text-sm font-semibold text-white/48">
          {summary}
        </div>
      ) : null}
    </section>
  );
}

export function AdminDataGridHeader({ children, columns, horizontalScroll = false, className = "" }: GridLineProps) {
  return (
    <div
      className={`grid items-center gap-4 px-5 py-4 ${horizontalScroll ? "w-max min-w-full" : "max-xl:hidden"} ${ADMIN_DATA_GRID_HEADER_CLASSES} ${className}`}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}

export function AdminDataGridRow({ children, columns, horizontalScroll = false, className = "", divided = false }: GridLineProps & { divided?: boolean }) {
  return (
    <article
      className={`grid gap-4 px-5 py-4 transition hover:bg-white/[0.035] ${horizontalScroll ? "w-max min-w-full items-center" : "xl:items-center"} ${divided ? ADMIN_DATA_GRID_RULES.rowDivider : ""} ${className}`}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </article>
  );
}

/**
 * Official cell wrappers (Admin Data Grid Contract).
 * These are the ONLY allowed wrappers for their cell type inside a Data Grid.
 * Local wrappers (e.g. `flex justify-center`, `xl:block`) are a bug, not a design choice.
 */

/** Checkbox cell — the only allowed wrapper for header/row checkboxes. */
export function AdminDataGridCheckboxCell({ children, className = "" }: BaseProps) {
  return <div className={`flex items-center justify-center ${className}`}>{children}</div>;
}

/** Primary column cell — content-heavy, right-aligned (RTL), truncate-safe. */
export function AdminDataGridPrimaryCell({ children, className = "" }: BaseProps) {
  return <div className={`min-w-0 text-right ${className}`}>{children}</div>;
}

/** Secondary column cell — centered, truncate-safe (type / category / count / slug). */
export function AdminDataGridCenterCell({ children, className = "" }: BaseProps) {
  return <div className={`min-w-0 text-center ${className}`}>{children}</div>;
}

/** Status cell — centers an `AdminStatusPill`. */
export function AdminDataGridStatusCell({ children, className = "" }: BaseProps) {
  return <div className={`flex items-center justify-center ${className}`}>{children}</div>;
}

export function AdminDataGridSortLabel({ children, onClick, active = false, direction = "asc", className = "" }: SortLabelProps) {
  const indicator = active ? (direction === "asc" ? "↑" : "↓") : "↕";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-2 py-1 transition hover:bg-white/[0.055] hover:text-[#D8B87A] ${active ? "text-[#D8B87A]" : ""} ${className}`}
    >
      <span>{children}</span>
      <span className={`font-en text-[11px] ${active ? "text-[#D8B87A]" : "text-white/25"}`}>{indicator}</span>
    </button>
  );
}

type SortLinkProps = BaseProps & {
  href: string;
  active?: boolean;
  direction?: "asc" | "desc";
};

/** Server-rendered sort header link — URL params drive sort state (no client onClick). */
export function AdminDataGridSortLink({ children, href, active = false, direction = "asc", className = "" }: SortLinkProps) {
  const indicator = active ? (direction === "asc" ? "↑" : "↓") : "↕";

  return (
    <Link
      href={href}
      // Sort permutations are dynamic list URLs; prefetching every header
      // combination floods the router queue on grid remounts (see row-action
      // links above).
      prefetch={false}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-2 py-1 transition hover:bg-white/[0.055] hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${active ? "text-[#D8B87A]" : ""} ${className}`}
    >
      <span>{children}</span>
      <span className={`font-en text-[11px] ${active ? "text-[#D8B87A]" : "text-white/25"}`}>{indicator}</span>
    </Link>
  );
}

export function AdminDataGridCheckbox({ checked, onChange, label, inputRef }: CheckboxProps) {
  return (
    <AdminCheckbox
      inputRef={inputRef}
      checked={checked}
      onChange={onChange}
      label={label}
    />
  );
}

type AdminDataGridActionsProps = BaseProps & {
  /** Use compact buttons (40px) when a row has 5+ actions. */
  compact?: boolean;
  /** Keep the actions track visible at logical inline-end while horizontally scrolling. */
  sticky?: boolean;
};

export function AdminDataGridActions({ children, className = "", compact = false }: AdminDataGridActionsProps) {
  return (
    <div
      dir="rtl"
      className={`flex w-full min-w-0 max-w-full flex-nowrap items-center justify-center overflow-hidden ${compact ? "gap-1 [&_a]:!h-10 [&_a]:!w-10 [&_button]:!h-10 [&_button]:!w-10 [&_summary]:!h-10 [&_summary]:!w-10" : "gap-1.5"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Grid cell wrapper — keeps action buttons inside the table/card bounds. */
export function AdminDataGridActionsCell({ children, className = "", compact = false, sticky = false }: AdminDataGridActionsProps) {
  return (
    <div
      data-admin-grid-actions={sticky ? "sticky" : undefined}
      className={`min-w-0 w-full overflow-hidden ${sticky ? "xl:sticky xl:end-0 xl:z-20 xl:bg-[#080B10]" : ""} ${className}`}
    >
      <AdminDataGridActions compact={compact}>{children}</AdminDataGridActions>
    </div>
  );
}

export function AdminDataGridActionsHeaderCell({ children, className = "", sticky = false }: BaseProps & { sticky?: boolean }) {
  return (
    <div
      data-admin-grid-actions-header={sticky ? "sticky" : undefined}
      className={`min-w-0 text-center ${sticky ? "xl:sticky xl:end-0 xl:z-30 xl:bg-[#10151C]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

type StickyActionsTableCellProps = BaseProps & {
  width: number | string;
};

const stickyActionsWidth = (width: number | string) => ({
  width,
  minWidth: width,
  maxWidth: width,
});

/** Logical inline-end sticky header cell; RTL places it at the visual far left. */
export function AdminDataGridStickyActionsHeaderCell({
  children,
  width,
  className = "",
}: StickyActionsTableCellProps) {
  return (
    <th
      scope="col"
      data-admin-grid-sticky="inline-end"
      style={stickyActionsWidth(width)}
      className={`sticky end-0 z-40 whitespace-nowrap border-s border-[#D8B87A]/18 bg-[#10151C] px-3 py-4 text-center ${className}`}
    >
      {children}
    </th>
  );
}

/** Logical inline-end sticky body cell; use with a fixed actions-column width. */
export function AdminDataGridStickyActionsCell({
  children,
  width,
  className = "",
}: StickyActionsTableCellProps) {
  return (
    <td
      data-admin-grid-sticky="inline-end"
      style={stickyActionsWidth(width)}
      className={`sticky end-0 z-30 whitespace-nowrap border-s border-white/8 bg-[#080B10] px-3 py-3 transition group-hover:bg-[#0D1117] ${className}`}
    >
      {children}
    </td>
  );
}

export function AdminDataGridActionButton({
  children,
  title,
  ariaLabel,
  ariaExpanded,
  ariaHasPopup,
  ariaPressed,
  ariaControls,
  href,
  target,
  rel,
  type = "button",
  tone,
  action,
  isCurrentlyHidden = false,
  className = "",
  onClick,
  disabled = false,
  pending = false,
  active = false,
  buttonRef,
  size = "default",
}: ActionButtonProps) {
  const resolvedTone = tone ?? (action ? actionDefaults[action].tone : "dark");
  const resolvedTitle = title ?? (action ? actionDefaults[action].title : "إجراء");
  const resolvedAriaLabel = ariaLabel ?? resolvedTitle;
  const content = pending ? (
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  ) : action ? (
    <GridIcon
      action={action}
      isCurrentlyHidden={isCurrentlyHidden}
      active={active}
    />
  ) : (
    children
  );
  const sizeClass = size === "compact" ? ADMIN_DATA_GRID_RULES.actionButtonCompact : ADMIN_DATA_GRID_RULES.actionButton;
  const classes = `flex ${sizeClass} items-center justify-center border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${actionTones[resolvedTone]} ${className}`;

  if (href && !disabled && !pending) {
    return (
      <Link
        href={href}
        // Row-action links point at per-row dynamic routes. Prefetching all of
        // them floods the router queue on every grid remount, and that churn
        // can cancel an in-flight router.refresh() and strand pending
        // transitions (stuck spinners).
        prefetch={false}
        target={target}
        rel={rel ?? (target === "_blank" ? "noreferrer" : undefined)}
        title={resolvedTitle}
        aria-label={resolvedAriaLabel}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={buttonRef}
      type={type}
      title={resolvedTitle}
      aria-label={resolvedAriaLabel}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-pressed={ariaPressed}
      aria-controls={ariaControls}
      aria-busy={pending || undefined}
      onClick={onClick}
      disabled={disabled || pending}
      className={`${classes} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {content}
    </button>
  );
}

export function AdminDataGridEmpty({ children }: BaseProps) {
  return <div className="px-6 py-14 text-center text-sm text-white/45">{children}</div>;
}
