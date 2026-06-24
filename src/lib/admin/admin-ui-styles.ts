/** Shared Admin UI tokens — modals, forms, tables. Import from here for new screens.
 *
 * Admin Design System rule: every new Admin page MUST reuse the shared components
 * (AdminPageHeader, AdminDataGrid, AdminActionButton, AdminStatusPill, AdminBulkActionBar,
 * VenesiaModal) and tokens from this file. Do not create page-specific layout/CSS when a
 * unified component already exists — the goal is one consistent Admin experience.
 */

export const ADMIN_MODAL = {
  zIndex: "z-[100]",
  backdrop: "absolute inset-0 bg-black/72 backdrop-blur-sm",
  panel:
    "relative w-full overflow-hidden rounded-[26px] border border-[#D8B87A]/18 bg-[linear-gradient(180deg,rgba(11,16,22,0.98),rgba(6,9,13,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.05)]",
  header: "flex items-start justify-between gap-5 border-b border-white/8 px-6 py-5",
  body: "px-6 py-5 text-sm text-white/70",
  footer: "flex flex-wrap items-center justify-end gap-3 border-t border-white/8 px-6 py-4",
  eyebrow: "font-en text-[11px] font-semibold tracking-[0.28em] text-[#D8B87A]/80",
  title: "mt-2 text-xl font-bold text-white",
  description: "mt-2 text-sm leading-7 text-white/52",
  closeButton:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-en text-lg text-white/55 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]",
} as const;

export const ADMIN_MODAL_SIZES = {
  sm: "max-w-[420px]",
  md: "max-w-[640px]",
  lg: "max-w-[920px]",
} as const;

export const ADMIN_FORM = {
  grid: "grid gap-4",
  gridTwoCol: "grid gap-4 md:grid-cols-2",
  checkboxRow:
    "flex items-center justify-end gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/70",
} as const;

/** Shared list/table layout — reuse for all Admin listing pages (Pages, Menus, Topics, Projects). */
export const ADMIN_LIST_PAGE = {
  wrapper: "space-y-6 pb-10",
  actionsColumnWidth: "220px",
  bulkBar:
    "flex flex-col gap-4 rounded-[18px] border border-[#D8B87A]/14 bg-[#080B10]/92 px-4 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.035)] md:flex-row md:items-center md:justify-between",
} as const;

export function adminFormFieldClassName(extra = "") {
  return [
    "w-full min-h-11 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D8B87A]/45",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function adminFormLabelClassName() {
  return "block space-y-2 text-right text-xs font-medium text-white/48";
}

export function adminFormHintClassName() {
  return "block text-right text-[11px] leading-5 text-white/32";
}
