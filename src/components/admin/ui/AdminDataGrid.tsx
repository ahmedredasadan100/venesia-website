import Link from "next/link";
import type { ChangeEventHandler, MouseEventHandler, ReactNode, RefObject } from "react";

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
};

type GridLineProps = BaseProps & {
  columns: string;
};

type DataGridAction = "edit" | "visibility" | "duplicate" | "delete";

type ActionButtonProps = {
  children?: ReactNode;
  title?: string;
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  tone?: "gold" | "green" | "blue" | "red" | "dark";
  action?: DataGridAction;
  hidden?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
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
  visibility: { tone: "green", title: "إظهار / إخفاء" },
  duplicate: { tone: "blue", title: "نسخ" },
  delete: { tone: "red", title: "حذف" },
};

export const ADMIN_DATA_GRID_RULES = {
  actionOrder: ["edit", "visibility", "duplicate", "delete"],
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
} as const;

/** Width in px for a fixed actions column — use in gridTemplateColumns. */
export function getAdminDataGridActionsColumnWidth(
  buttonCount: number,
  size: "default" | "compact" = buttonCount > 4 ? "compact" : "default",
) {
  const buttonPx =
    size === "compact" ? ADMIN_DATA_GRID_RULES.actionButtonCompactPx : ADMIN_DATA_GRID_RULES.actionButtonPx;
  const gapPx = size === "compact" ? ADMIN_DATA_GRID_RULES.actionGapCompactPx : ADMIN_DATA_GRID_RULES.actionGapPx;
  const contentWidth = buttonPx * buttonCount + gapPx * Math.max(0, buttonCount - 1);

  // Small buffer so borders never clip at the cell edge.
  return contentWidth + 4;
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
  /** 1 standard action. */
  one: adminDataGridActionsColumn(1, "default"),
} as const;

function GridIcon({ action, hidden = false }: { action: DataGridAction; hidden?: boolean }) {
  if (action === "edit") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20h4.8L19.2 9.6a2.4 2.4 0 0 0-3.4-3.4L5.4 16.6 4 20Z" />
        <path d="m14.5 7.5 2 2" />
      </svg>
    );
  }

  if (action === "visibility") {
    return hidden ? (
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

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function AdminDataGrid({ children, summary, className = "" }: GridProps) {
  return (
    <section
      className={`rounded-[20px] border border-[#D8B87A]/12 bg-[#080B10]/86 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl ${className}`}
    >
      <div className="overflow-x-auto overflow-y-hidden rounded-[14px] border border-white/8 bg-black/14">
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

export function AdminDataGridHeader({ children, columns, className = "" }: GridLineProps) {
  return (
    <div
      className={`grid items-center gap-4 border-b border-[#D8B87A]/12 bg-white/[0.045] px-5 py-4 text-sm font-bold text-white max-xl:hidden ${className}`}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}

export function AdminDataGridRow({ children, columns, className = "" }: GridLineProps) {
  return (
    <article
      className={`grid gap-4 px-5 py-4 transition hover:bg-white/[0.035] xl:items-center ${className}`}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </article>
  );
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

export function AdminDataGridCheckbox({ checked, onChange, label, inputRef }: CheckboxProps) {
  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={ADMIN_DATA_GRID_RULES.checkbox}
      aria-label={label}
    />
  );
}

type AdminDataGridActionsProps = BaseProps & {
  /** Use compact buttons (40px) when a row has 5+ actions. */
  compact?: boolean;
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
export function AdminDataGridActionsCell({ children, className = "", compact = false }: AdminDataGridActionsProps) {
  return (
    <div className={`min-w-0 w-full overflow-hidden ${className}`}>
      <AdminDataGridActions compact={compact}>{children}</AdminDataGridActions>
    </div>
  );
}

export function AdminDataGridActionButton({
  children,
  title,
  href,
  target,
  rel,
  type = "button",
  tone,
  action,
  hidden = false,
  className = "",
  onClick,
  disabled = false,
  size = "default",
}: ActionButtonProps) {
  const resolvedTone = tone ?? (action ? actionDefaults[action].tone : "dark");
  const resolvedTitle = title ?? (action ? actionDefaults[action].title : "إجراء");
  const content = action ? <GridIcon action={action} hidden={hidden} /> : children;
  const sizeClass = size === "compact" ? ADMIN_DATA_GRID_RULES.actionButtonCompact : ADMIN_DATA_GRID_RULES.actionButton;
  const classes = `flex ${sizeClass} items-center justify-center border transition ${actionTones[resolvedTone]} ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noreferrer" : undefined)}
        title={resolvedTitle}
        aria-label={resolvedTitle}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  return (
    <button type={type} title={resolvedTitle} aria-label={resolvedTitle} onClick={onClick} disabled={disabled} className={`${classes} disabled:cursor-not-allowed disabled:opacity-50`}>
      {content}
    </button>
  );
}

export function AdminDataGridEmpty({ children }: BaseProps) {
  return <div className="px-6 py-14 text-center text-sm text-white/45">{children}</div>;
}
