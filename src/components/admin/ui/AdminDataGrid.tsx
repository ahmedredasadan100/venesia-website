import Link from "next/link";
import type {
  ChangeEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  Ref,
  RefObject,
} from "react";
import AdminCheckbox from "./AdminCheckbox";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "./admin-scrollbar-styles";

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

type GridActionLineProps = GridLineProps & {
  /** Keep the final actions track visible inside the shared horizontal-scroll owner. */
  stickyActions?: boolean;
};

export type AdminDataGridAction =
  | "activity"
  | "archive"
  | "copy-link"
  | "delete"
  | "duplicate"
  | "edit"
  | "feature"
  | "more"
  | "preview"
  | "restore"
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
  action?: AdminDataGridAction;
  isCurrentlyHidden?: boolean;
  visibilityEntityLabel?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
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

const actionDefaults: Record<AdminDataGridAction, { tone: NonNullable<ActionButtonProps["tone"]>; title: string }> = {
  edit: { tone: "gold", title: "تعديل" },
  preview: { tone: "dark", title: "معاينة" },
  visibility: { tone: "green", title: "إظهار / إخفاء" },
  feature: { tone: "gold", title: "تمييز" },
  duplicate: { tone: "blue", title: "نسخ" },
  more: { tone: "dark", title: "المزيد" },
  archive: { tone: "dark", title: "أرشفة" },
  "copy-link": { tone: "dark", title: "نسخ الرابط العام" },
  restore: { tone: "dark", title: "استعادة" },
  delete: { tone: "red", title: "حذف" },
  activity: { tone: "dark", title: "معلومات النشاط" },
};

export function resolveAdminDataGridVisibilityAction(
  isCurrentlyHidden: boolean,
  entityLabel = "العنصر",
) {
  return isCurrentlyHidden
    ? {
        tone: "dark" as const,
        title: `إظهار ${entityLabel}`,
        ariaLabel: `إظهار ${entityLabel}`,
        ariaPressed: false,
      }
    : {
        tone: "green" as const,
        title: `إخفاء ${entityLabel}`,
        ariaLabel: `إخفاء ${entityLabel}`,
        ariaPressed: true,
      };
}

export const ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT = {
  buttonCount: 3,
  buttonPx: 40,
  gapPx: 4,
  cellInlinePaddingPx: 6,
  borderSafetyPx: 4,
} as const;

export const ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH =
  ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.buttonPx *
    ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.buttonCount +
  ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.gapPx *
    (ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.buttonCount - 1) +
  ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.cellInlinePaddingPx * 2 +
  ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.borderSafetyPx;

/** Canonical width for `DD MMM YYYY, hh:mm A` Admin timestamp columns. */
export const ADMIN_DATA_GRID_DATE_TIME_COLUMN_WIDTH = 196;

export const ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT = {
  textBudgetPx: 200,
  cellInlinePaddingPx: ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.cellInlinePaddingPx,
  itemGapPx: 12,
  hierarchyDepthStepPx: 28,
  hierarchyRootIconPx: 36,
  hierarchyChildIconPx: 24,
  hierarchyConnectorPx: 28,
  hierarchyLinkInlinePaddingPx: 6,
  hierarchyLabelInlinePaddingPx: 10,
  hierarchyLabelBorderPx: 1,
} as const;

type AdminDataGridPrimaryColumnWidthOptions = {
  iconPx: number;
  gapCount?: number;
  extraDecorationPx?: number;
  maxVisibleDepth?: number;
};

function normalizeAdminDataGridHierarchyDepth(depth: number) {
  return Number.isFinite(depth) ? Math.max(0, Math.trunc(depth)) : 0;
}

export function getAdminDataGridPrimaryColumnWidth({
  iconPx,
  gapCount = 1,
  extraDecorationPx = 0,
  maxVisibleDepth = 0,
}: AdminDataGridPrimaryColumnWidthOptions) {
  const contract = ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT;
  return (
    contract.textBudgetPx +
    contract.cellInlinePaddingPx * 2 +
    iconPx +
    contract.itemGapPx * gapCount +
    extraDecorationPx +
    contract.hierarchyDepthStepPx *
      normalizeAdminDataGridHierarchyDepth(maxVisibleDepth)
  );
}

const hierarchyLabelChromePx =
  (ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.hierarchyLinkInlinePaddingPx +
    ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.hierarchyLabelInlinePaddingPx +
    ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.hierarchyLabelBorderPx) *
  2;

export const ADMIN_DATA_GRID_HIERARCHY_LABEL_MAX_WIDTH =
  ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textBudgetPx +
  hierarchyLabelChromePx;

export function getAdminDataGridHierarchyPrimaryColumnWidth(
  maxVisibleDepth: number,
) {
  // One width is derived from the deepest row in the current visible tree
  // snapshot; rows never calculate or mutate their own column width.
  const depth = normalizeAdminDataGridHierarchyDepth(maxVisibleDepth);
  const contract = ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT;

  if (depth === 0) {
    return getAdminDataGridPrimaryColumnWidth({
      iconPx: contract.hierarchyRootIconPx,
      extraDecorationPx: hierarchyLabelChromePx,
    });
  }

  return getAdminDataGridPrimaryColumnWidth({
    iconPx: contract.hierarchyChildIconPx,
    gapCount: 2,
    extraDecorationPx:
      contract.hierarchyConnectorPx + hierarchyLabelChromePx,
    maxVisibleDepth: depth,
  });
}

export const ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS = {
  textOnly: ADMIN_DATA_GRID_PRIMARY_COLUMN_CONTRACT.textBudgetPx,
  compactIcon: getAdminDataGridPrimaryColumnWidth({ iconPx: 28 }),
  standardIcon: getAdminDataGridPrimaryColumnWidth({ iconPx: 40 }),
} as const;

export const ADMIN_DATA_GRID_RULES = {
  actionOrder: ["edit", "preview", "more"],
  actionButton: "h-11 w-11 rounded-[8px] cursor-pointer shrink-0",
  actionButtonCompact: "h-10 w-10 rounded-[8px] cursor-pointer shrink-0",
  actionIcon: "h-4 w-4 shrink-0",
  checkbox: "h-4 w-4 accent-[#D8B87A] cursor-pointer",
  /** Shared cell inset matches the compact Row Actions column. */
  cellInlinePadding: "px-1.5",
  cellBlockPadding: "py-4",
  bulkBarTrigger: "selectedIds.length > 0",
  /** Default gap between action buttons (Tailwind gap-1.5 = 6px). */
  actionGapPx: 6,
  actionGapCompactPx: ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.gapPx,
  actionButtonPx: 44,
  actionButtonCompactPx: ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.buttonPx,
  actionCellInlinePadding: "px-1.5",
  /** Official row separator — opt-in via `AdminDataGridRow divided` (matches Topics divide-y). */
  rowDivider: "border-t border-white/8",
} as const;

const ADMIN_DATA_GRID_CELL_BASE_CLASSES =
  "[&>*]:min-w-0 [&>*]:self-stretch [&>*]:px-1.5 [&>*]:py-4 [&>*]:content-center [&>*+*]:border-s";

/** Shared header-cell geometry for CSS Grid rows and semantic table rows. */
export const ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES =
  `${ADMIN_DATA_GRID_CELL_BASE_CLASSES} [&>*+*]:border-[#D8B87A]/18`;

/** Shared body-cell geometry for CSS Grid rows and semantic table rows. */
export const ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES =
  `${ADMIN_DATA_GRID_CELL_BASE_CLASSES} [&>*+*]:border-white/8`;

/** Shared table header surface — Admin Data Grid + manual grid headers (Topics list, Categories tree). */
export const ADMIN_DATA_GRID_HEADER_CLASSES =
  "border-b border-[#D8B87A]/18 bg-[linear-gradient(135deg,rgba(216,184,122,0.14),rgba(56,189,248,0.08),rgba(255,255,255,0.03))] text-sm font-bold text-[#F4E7C5] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";

/** Width in px for a fixed actions column — use in gridTemplateColumns. */
export function getAdminDataGridActionsColumnWidth(
  buttonCount: number,
  size: "default" | "compact" = buttonCount > 4 ? "compact" : "default",
  cellInlinePaddingPx =
    ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.cellInlinePaddingPx,
) {
  const buttonPx =
    size === "compact" ? ADMIN_DATA_GRID_RULES.actionButtonCompactPx : ADMIN_DATA_GRID_RULES.actionButtonPx;
  const gapPx = size === "compact" ? ADMIN_DATA_GRID_RULES.actionGapCompactPx : ADMIN_DATA_GRID_RULES.actionGapPx;
  const contentWidth = buttonPx * buttonCount + gapPx * Math.max(0, buttonCount - 1);

  // Small buffer so borders never clip at the cell edge.
  return (
    contentWidth +
    cellInlinePaddingPx * 2 +
    ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.borderSafetyPx
  );
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
  /** Canonical Row Actions track — edit, preview, more. */
  threeCompact: `${ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}px`,
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

export function AdminDataGridActionIcon({
  action,
  isCurrentlyHidden = false,
  active = false,
}: {
  action: AdminDataGridAction;
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

  if (action === "copy-link") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10.6 13.4a4 4 0 0 0 5.66 0l2.14-2.14a4 4 0 0 0-5.66-5.66l-1.22 1.22" />
        <path d="M13.4 10.6a4 4 0 0 0-5.66 0L5.6 12.74a4 4 0 0 0 5.66 5.66l1.22-1.22" />
      </svg>
    );
  }

  if (action === "more") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={ADMIN_DATA_GRID_RULES.actionIcon}
        fill="currentColor"
      >
        <circle cx="12" cy="5" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="12" cy="19" r="1.7" />
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

  if (action === "archive") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7h18" />
        <path d="M5 7l1 12h12l1-12" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    );
  }

  if (action === "restore") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12a9 9 0 0 1 15-6.7" />
        <path d="M18 3v4h-4" />
        <path d="M21 12a9 9 0 0 1-15 6.7" />
        <path d="M6 21v-4H2" />
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

export function AdminDataGrid({
  children,
  summary,
  scrollLabel = "منطقة بيانات الإدارة",
  className = "",
}: GridProps) {
  return (
    <section
      className={`rounded-[20px] border border-[#D8B87A]/12 bg-[#080B10]/86 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl ${className}`}
    >
      <div
        dir="rtl"
        role="region"
        aria-label={scrollLabel}
        tabIndex={0}
        data-admin-data-grid-scroll=""
        className={`overflow-x-auto overflow-y-hidden rounded-[14px] border border-white/8 bg-black/14 overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}
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

export function AdminDataGridHeader({
  children,
  columns,
  horizontalScroll = false,
  stickyActions = true,
  className = "",
}: GridActionLineProps) {
  return (
    <div
      className={`grid gap-0 ${ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES} ${horizontalScroll ? "w-max min-w-full" : "max-xl:hidden"} ${stickyActions ? "[&>*:last-child]:sticky [&>*:last-child]:end-0 [&>*:last-child]:z-40 [&>*:last-child]:bg-[#10151C]" : ""} ${ADMIN_DATA_GRID_HEADER_CLASSES} ${className}`}
      style={{ gridTemplateColumns: columns, columnGap: 0 }}
    >
      {children}
    </div>
  );
}

export function AdminDataGridRow({
  children,
  columns,
  horizontalScroll = false,
  stickyActions = true,
  className = "",
  divided = false,
}: GridActionLineProps & { divided?: boolean }) {
  return (
    <article
      className={`grid gap-0 ${ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES} transition hover:bg-white/[0.035] ${horizontalScroll ? "w-max min-w-full" : ""} ${stickyActions ? "[&>*:last-child]:sticky [&>*:last-child]:end-0 [&>*:last-child]:z-30 [&>*:last-child]:bg-[#080B10] hover:[&>*:last-child]:bg-[#0D1117]" : ""} ${divided ? ADMIN_DATA_GRID_RULES.rowDivider : ""} ${className}`}
      style={{ gridTemplateColumns: columns, columnGap: 0 }}
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
export function AdminDataGridCheckboxCell({
  children,
  className = "",
  sticky = false,
  surface = "body",
}: BaseProps & {
  sticky?: boolean;
  surface?: "header" | "body";
}) {
  return (
    <div
      data-admin-grid-sticky={sticky ? "inline-start" : undefined}
      className={`flex items-center justify-center ${
        sticky
          ? `sticky start-0 ${
              surface === "header"
                ? "z-30 bg-[#10151C]"
                : "z-20 bg-[#080B10]"
            }`
          : ""
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
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
      className={`min-w-0 w-full overflow-hidden ${sticky ? "sticky end-0 z-20 bg-[#080B10]" : ""} ${className}`}
    >
      <AdminDataGridActions compact={compact}>{children}</AdminDataGridActions>
    </div>
  );
}

export function AdminDataGridActionsHeaderCell({ children, className = "", sticky = false }: BaseProps & { sticky?: boolean }) {
  return (
    <div
      data-admin-grid-actions-header={sticky ? "sticky" : undefined}
      className={`min-w-0 text-center ${sticky ? "sticky end-0 z-30 bg-[#10151C]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

type StickyActionsTableCellProps = BaseProps & {
  width: number | string;
  columnKey?: string;
};

export const getAdminDataGridFixedColumnStyle = (width: number | string) => ({
  width,
  minWidth: width,
  maxWidth: width,
});

/** Logical inline-end sticky header cell; RTL places it at the visual far left. */
export function AdminDataGridStickyActionsHeaderCell({
  children,
  width,
  columnKey,
  className = "",
}: StickyActionsTableCellProps) {
  return (
    <th
      scope="col"
      data-admin-grid-sticky="inline-end"
      data-admin-column-key={columnKey}
      style={getAdminDataGridFixedColumnStyle(width)}
      className={`sticky end-0 z-40 whitespace-nowrap border-s border-[#D8B87A]/18 bg-[#10151C] ${ADMIN_DATA_GRID_RULES.actionCellInlinePadding} py-4 text-center ${className}`}
    >
      {children}
    </th>
  );
}

/** Logical inline-end sticky body cell; use with a fixed actions-column width. */
export function AdminDataGridStickyActionsCell({
  children,
  width,
  columnKey,
  className = "",
}: StickyActionsTableCellProps) {
  return (
    <td
      data-admin-grid-sticky="inline-end"
      data-admin-column-key={columnKey}
      style={getAdminDataGridFixedColumnStyle(width)}
      className={`sticky end-0 z-30 whitespace-nowrap border-s border-white/8 bg-[#080B10] ${ADMIN_DATA_GRID_RULES.cellInlinePadding} ${ADMIN_DATA_GRID_RULES.cellBlockPadding} transition group-hover:bg-[#0D1117] ${className}`}
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
  visibilityEntityLabel,
  className = "",
  onClick,
  onKeyDown,
  disabled = false,
  pending = false,
  active = false,
  buttonRef,
  size = "default",
}: ActionButtonProps) {
  const visibilityPresentation =
    action === "visibility"
      ? resolveAdminDataGridVisibilityAction(
          isCurrentlyHidden,
          visibilityEntityLabel,
        )
      : null;
  const resolvedTone =
    tone ??
    visibilityPresentation?.tone ??
    (action ? actionDefaults[action].tone : "dark");
  const resolvedTitle =
    title ??
    visibilityPresentation?.title ??
    (action ? actionDefaults[action].title : "إجراء");
  const resolvedAriaLabel =
    ariaLabel ?? visibilityPresentation?.ariaLabel ?? resolvedTitle;
  const resolvedAriaPressed =
    ariaPressed ?? visibilityPresentation?.ariaPressed;
  const content = pending ? (
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  ) : action ? (
    <AdminDataGridActionIcon
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
        data-admin-data-grid-action={action}
        data-admin-visibility-state={
          action === "visibility"
            ? isCurrentlyHidden
              ? "hidden"
              : "visible"
            : undefined
        }
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
      aria-pressed={resolvedAriaPressed}
      aria-controls={ariaControls}
      aria-busy={pending || undefined}
      data-admin-data-grid-action={action}
      data-admin-visibility-state={
        action === "visibility"
          ? isCurrentlyHidden
            ? "hidden"
            : "visible"
          : undefined
      }
      onClick={onClick}
      onKeyDown={onKeyDown}
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
