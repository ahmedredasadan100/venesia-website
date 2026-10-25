import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../../components/venesia-scrollbar-styles";

/** Shared Admin UI tokens — modals, forms, tables. Import from here for new screens.
 *
 * Admin Design System rule: every new Admin page MUST reuse the shared components
 * (AdminPageHeader, AdminPageContextHeader, AdminTablePagination, AdminDataGrid, AdminActionButton, AdminStatusPill, AdminBulkActionBar,
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

/** Explicit compact presentation; existing modal consumers retain ADMIN_MODAL. */
export const ADMIN_MODAL_COMPACT = {
  header: "flex items-start justify-between gap-4 border-b border-white/8 px-4 py-3 sm:px-5",
  body: "px-4 py-2.5 text-sm text-white/70 sm:px-5",
  footer: "flex flex-wrap items-center justify-end gap-2 border-t border-white/8 px-4 py-3 sm:px-5",
  eyebrow: ADMIN_MODAL.eyebrow,
  title: "mt-1 text-xl font-bold text-white",
  description: "mt-1 text-xs leading-6 text-white/52",
  headerIcon: "flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-[#D8B87A]/18 bg-[#D8B87A]/5 text-[#D8B87A]",
} as const;

export const ADMIN_MODAL_SIZES = {
  sm: "max-w-[420px]",
  md: "max-w-[640px]",
  lg: "max-w-[920px]",
  xl: "max-w-[1500px]",
} as const;

/** Opt-in surface only; each composition retains its shared layout and control scale. */
export const ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME =
  "rounded-2xl border border-white/14 bg-[linear-gradient(125deg,#080b10_0%,#0e151a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_30px_rgba(0,0,0,0.12)]";

/** Cinematic Gold v1.1 is the official Admin presentation; prior names remain compatible aliases.
 * Reference raster: rich black #000810, warm button gold near #D8B068.
 * Semantic highlights compensate for raster antialiasing on the live dark surface.
 */
export type AdminCollectionPresentation = "default" | "cinematic";

/** Both public names resolve to the official Admin presentation. */
export function resolveAdminCollectionPresentation(
  presentation: AdminCollectionPresentation = "default",
): "cinematic" {
  return presentation === "default" ? "cinematic" : presentation;
}

/** Current AdminShell navigation presentation; navigation data and state stay in their owners. */
export const ADMIN_SIDEBAR = {
  shell: "admin-sidebar-shell relative flex flex-col transition-[width] duration-300 ease-out motion-reduce:transition-none",
  identity: "relative flex min-h-20 items-center gap-3 px-4 py-4",
  brand: "truncate font-en text-[10px] font-semibold tracking-[0.2em] text-[var(--admin-accent-strong)]",
  company: "mt-1 truncate text-xs font-medium text-slate-300",
  toggle: "absolute left-2 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-slate-500/25 bg-[#080D14] text-2xl leading-none text-slate-300 shadow-lg transition-colors hover:border-[var(--admin-accent)]/50 hover:text-[var(--admin-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] motion-reduce:transition-none",
  nav: "flex-1 px-3 py-3",
  items: "space-y-2",
  item: "group relative flex min-h-14 items-center gap-3 rounded-[16px] border px-3 py-2.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] motion-reduce:transition-none",
  itemActive: "border-[var(--admin-accent)]/45 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--admin-accent)_13%,transparent),#0A1018_72%)] text-[var(--admin-accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  itemInactive: "border-slate-600/20 bg-slate-950/20 text-slate-300 hover:border-slate-500/40 hover:bg-slate-800/35 hover:text-slate-100",
  icon: "grid size-9 shrink-0 place-items-center rounded-[12px] border font-en text-[28px] leading-none",
  iconActive: "border-[var(--admin-accent)]/40 bg-[var(--admin-accent)]/10 text-[var(--admin-accent-strong)] shadow-[0_0_16px_color-mix(in_srgb,var(--admin-accent)_9%,transparent)]",
  iconInactive: "border-slate-500/25 bg-slate-900/35 text-slate-400 group-hover:text-slate-200",
  label: "min-w-0 flex-1 truncate text-right",
  badge: "mr-auto rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]",
  chevron: "font-en text-base leading-none text-slate-400 transition-transform duration-200 motion-reduce:transition-none",
  submenu: "mt-2 space-y-1 rounded-[16px] border border-slate-600/15 bg-[#0B1119]/70 p-1.5",
  compactSubmenu: "fixed z-40 w-60 rounded-[18px] border border-slate-500/30 bg-[#090F17] p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)]",
  child: "group relative flex min-h-11 items-center gap-2 rounded-[11px] border px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] motion-reduce:transition-none",
  childActive: "border-[var(--admin-accent)]/25 bg-[linear-gradient(100deg,color-mix(in_srgb,var(--admin-accent)_15%,transparent),color-mix(in_srgb,var(--admin-accent)_5%,transparent))] font-semibold text-[var(--admin-accent-strong)]",
  childInactive: "border-transparent text-slate-400 hover:border-slate-500/20 hover:bg-slate-800/40 hover:text-slate-100",
  indicator: "absolute inset-y-2 right-0 w-[3px] rounded-l-full bg-[var(--admin-accent)]",
  footer: "mt-auto px-3 pb-5 pt-5",
  publicLink: "group flex min-h-12 items-center gap-3 rounded-[16px] border border-slate-500/30 bg-slate-900/30 px-3 py-2.5 text-sm text-slate-300 transition-colors hover:border-slate-400/50 hover:bg-slate-800/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] motion-reduce:transition-none",
  publicIcon: "grid size-8 shrink-0 place-items-center rounded-[11px] border border-slate-500/25 text-xl leading-none",
  tooltip: "pointer-events-none absolute right-full top-1/2 z-50 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-500/30 bg-[#101720] px-3 py-2 text-xs text-slate-100 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
} as const;

/** Shared selection chrome for semantic Entity List tables in both presentations. */
export const ADMIN_DATA_GRID_SELECTION = {
  table: [
    "[&_tbody_tr[data-selected=true]>td]:bg-[var(--admin-grid-selected,#102033)] [&_tbody_tr[data-selected=true]>td]:bg-[linear-gradient(180deg,rgba(120,189,250,0.035),rgba(120,189,250,0.012))]",
    "[&_tbody_tr[data-selected=true]:hover>td]:bg-[var(--admin-grid-selected-hover,#14283D)] [&_tbody_tr[data-selected=true]:hover>td]:bg-[linear-gradient(180deg,rgba(120,189,250,0.035),rgba(120,189,250,0.012))]",
    "[&_tbody_tr[data-selected=true]>td:first-child]:before:pointer-events-none [&_tbody_tr[data-selected=true]>td:first-child]:before:absolute [&_tbody_tr[data-selected=true]>td:first-child]:before:inset-y-0 [&_tbody_tr[data-selected=true]>td:first-child]:before:start-0 [&_tbody_tr[data-selected=true]>td:first-child]:before:w-0.5 [&_tbody_tr[data-selected=true]>td:first-child]:before:bg-[var(--admin-accent,#D8B068)] [&_tbody_tr[data-selected=true]>td:first-child]:before:content-['']",
    "[&_tbody_tr:has(:focus-visible)>td]:border-[var(--admin-grid-focus,#78BDFA)]/35 [&_tbody_tr:has(:focus-visible)>td]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--admin-grid-focus,#78BDFA)_45%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--admin-grid-focus,#78BDFA)_45%,transparent)]",
    "[&_tbody_td]:transition-[background-color,border-color,box-shadow] [&_tbody_td]:duration-250 [&_tbody_td]:ease-out motion-reduce:[&_tbody_td]:transition-none motion-reduce:[&_tbody_tr]:transition-none",
  ].join(" "),
  checkbox: "rounded-[4px] border-[var(--admin-accent,#D8B068)]/45 accent-[var(--admin-accent,#D8B068)] focus-visible:outline-[var(--admin-grid-focus,#78BDFA)] motion-reduce:transition-none",
  bulk: "border-slate-400/25 bg-[linear-gradient(115deg,var(--admin-grid-selected,#102033),#07111D_72%)] text-slate-200 shadow-[inset_0_1px_0_rgba(148,163,184,0.08),0_8px_24px_rgba(0,0,0,0.18)]",
  bulkSummary: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-300",
  bulkCount: "inline-flex min-w-9 items-center justify-center rounded-lg border border-[var(--admin-accent,#D8B068)]/30 bg-[var(--admin-accent,#D8B068)]/8 px-2.5 py-1 font-en text-sm font-bold tabular-nums text-[var(--admin-accent-strong,#EDC878)]",
  bulkControls: "flex min-w-0 flex-wrap items-center gap-2.5",
  bulkDanger: "border-red-400/45 bg-red-950/75 text-red-100 shadow-[inset_0_1px_0_rgba(248,113,113,0.08)] hover:border-red-300/65 hover:bg-red-900/75 motion-reduce:transition-none",
  bulkClear: "border-slate-500/20 bg-slate-950/25 text-slate-400 hover:border-slate-400/35 hover:bg-slate-800/45 hover:text-slate-100 motion-reduce:transition-none",
} as const;

export const ADMIN_CINEMATIC_GOLD_V1 = {
  palette: {
    black: "#000810", surface: "#050A10", gold: "#EDC878", goldButton: "#D8B068",
    blue: "#78BDFA", teal: "#56DBC4", emerald: "#44DFBF", purple: "#BE8BEE", red: "#F5787B",
  },
  system: {
    root: "admin-cinematic-edge relative isolate overflow-hidden rounded-[22px] border border-[#D8B068]/35 bg-[linear-gradient(115deg,#080B0D_0%,#000810_58%,#080C12_100%)] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(237,200,120,0.10)]",
    layout: "relative z-10 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-3",
    identity: "flex min-w-0 items-center gap-2 sm:gap-3",
    logo: "grid size-11 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-[#D8B068]/45 bg-black/65 text-xs font-bold text-[#EDC878] shadow-[inset_0_1px_0_rgba(237,200,120,0.12)] sm:size-14",
    eyebrow: "font-en text-[9px] font-semibold tracking-[0.22em] text-[#EDC878] sm:text-[11px] sm:tracking-[0.3em]",
    title: "mt-1 text-lg font-semibold leading-tight text-[#F6F7FA] sm:text-[28px]",
    logout: "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#D8B068]/40 bg-[linear-gradient(180deg,rgba(237,200,120,0.08),rgba(0,0,0,0.5))] px-4 text-xs font-semibold text-[#EDC878] transition-colors hover:border-[#EDC878]/70 hover:bg-[#D8B068]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EDC878]",
    menu: "grid size-10 shrink-0 place-items-center rounded-xl border border-[#D8B068]/25 bg-black/30 text-xl text-[#EDC878] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EDC878] lg:hidden",
    light: "pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_6%_0%,rgba(216,176,104,0.22),transparent_30%),radial-gradient(ellipse_at_43%_100%,rgba(216,176,104,0.15),transparent_31%),radial-gradient(ellipse_at_78%_0%,rgba(216,176,104,0.06),transparent_22%)]",
    ribbon: "pointer-events-none absolute inset-0 -z-10 size-full text-[#EDC878]/45 [mask-image:linear-gradient(90deg,transparent,#000_16%,#000_84%,transparent)]",
  },
  module: {
    root: "@container/admin-module relative isolate overflow-hidden rounded-[20px] border border-[rgba(216,176,104,0.025)] bg-[linear-gradient(110deg,#10100C_0%,#000810_45%,#090D12_100%)] px-4 py-3 shadow-[inset_0_2px_0_rgba(237,200,120,0.52),inset_0_5px_12px_rgba(216,176,104,0.045),0_9px_18px_rgba(0,0,0,0.48),0_24px_48px_rgba(0,0,0,0.56),0_18px_45px_rgba(216,176,104,0.105),0_36px_75px_rgba(216,176,104,0.055)] sm:px-5",
    layout: "relative z-10 flex min-w-0 flex-col gap-4 @min-[64rem]/admin-module:flex-row @min-[64rem]/admin-module:items-center @min-[64rem]/admin-module:justify-between",
    identity: "flex min-w-0 items-center gap-4 @min-[64rem]/admin-module:flex-1",
    icon: "grid size-14 shrink-0 place-items-center rounded-2xl border border-[#D8B068]/65 bg-[linear-gradient(140deg,rgba(216,176,104,0.22),rgba(216,176,104,0.03))] text-[#EDC878] shadow-[inset_0_1px_0_rgba(255,230,172,0.15),0_0_18px_rgba(216,176,104,0.08)] [&>svg]:size-8",
    eyebrow: "font-en text-[10px] font-semibold uppercase tracking-[0.22em] text-[#EDC878] sm:text-[11px]",
    title: "mt-2 break-words text-[26px] font-bold leading-tight text-[#F6F7FA] sm:text-[32px]",
    description: "mt-2 max-w-2xl text-xs leading-6 text-[#BEC4CE] sm:text-sm",
    dock: `relative isolate flex w-fit min-w-0 max-w-full flex-wrap items-center gap-2 overflow-x-auto overscroll-x-contain rounded-[20px] border border-[#D8B068]/15 bg-black/35 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EDC878]/70 [&>*]:max-w-full [&>a]:min-w-0 [&>button]:min-w-0 @min-[64rem]/admin-module:max-w-[58%] @min-[64rem]/admin-module:shrink-0 @min-[64rem]/admin-module:[&>a]:px-3 @min-[64rem]/admin-module:[&>a]:text-xs`,
    light: "pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_0%_30%,rgba(216,176,104,0.17),transparent_38%),radial-gradient(ellipse_at_100%_100%,rgba(216,176,104,0.10),transparent_30%)]",
    ribbon: "pointer-events-none absolute inset-0 -z-10 size-full text-[#EDC878]/50 opacity-70 [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]",
    watermark: "pointer-events-none absolute inset-y-0 start-[36%] -z-10 hidden w-[34%] max-w-[330px] text-[#D8B068] opacity-65 sm:block [&>svg]:size-full",
  },
  action: {
    primary: "border-[#F2CF86]/65 bg-[linear-gradient(135deg,#E8C478,#D8B068)] text-[#100D06] shadow-[inset_0_1px_0_rgba(255,241,207,0.35),0_4px_14px_rgba(216,176,104,0.10)] hover:brightness-105 motion-reduce:transition-none",
    secondary: "border-[#D8B068]/20 bg-[linear-gradient(180deg,#0A0F13,#03070A)] text-[#E4E7EC] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#D8B068]/45 hover:text-[#EDC878] motion-reduce:transition-none",
  },
  collection: {
    // One official collection frame. Framing never clips the scroll owner or portals.
    frame: [
      "admin-cinematic-edge relative isolate flex min-w-0 flex-col gap-0 overflow-visible rounded-[20px] border border-[rgba(216,176,104,0.045)] bg-[linear-gradient(115deg,#131C25,#050C14_55%,#080F17)] p-3 shadow-[inset_0_2px_0_rgba(237,200,120,0.52),inset_0_6px_14px_rgba(216,176,104,0.035),0_12px_24px_rgba(0,0,0,0.55),0_28px_58px_rgba(0,0,0,0.42)]",
      "[&_[data-admin-collection-toolbar-owner]]:rounded-none [&_[data-admin-collection-toolbar-owner]]:border-0 [&_[data-admin-collection-toolbar-owner]]:shadow-none [&_[data-admin-collection-toolbar-controls]]:px-0 [&_[data-admin-collection-toolbar-controls]]:pt-0",
      "[&_[data-admin-collection-context-row]]:px-0 [&_[data-admin-collection-context-row]]:border-[#D8B068]/15",
      "[&_[data-admin-data-grid-presentation=cinematic]]:rounded-none [&_[data-admin-data-grid-presentation=cinematic]]:border-0 [&_[data-admin-data-grid-presentation=cinematic]]:bg-none [&_[data-admin-data-grid-presentation=cinematic]]:p-0 [&_[data-admin-data-grid-presentation=cinematic]]:shadow-none",
      "[&_[data-admin-table-pagination]]:rounded-none [&_[data-admin-table-pagination]]:border-x-0 [&_[data-admin-table-pagination]]:border-b-0 [&_[data-admin-table-pagination]]:border-t-0 [&_[data-admin-table-pagination]]:bg-none [&_[data-admin-table-pagination]]:px-0 [&_[data-admin-table-pagination]]:pb-0 [&_[data-admin-table-pagination]]:shadow-none",
    ].join(" "),
    toolbarSurface: "border-[#D8B068]/35 bg-[linear-gradient(115deg,#131E29,#07111B)] text-[#E4E7EC] shadow-[inset_0_1px_0_rgba(237,200,120,0.10),0_6px_22px_rgba(0,0,0,0.20)]",
    control: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border-[#D8B068]/28 bg-[linear-gradient(165deg,#121619,#03070A)] text-[#E4E7EC] shadow-[inset_0_1px_0_rgba(237,200,120,0.06)] duration-200 hover:border-[#D8B068]/60 hover:text-[#EDC878] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    controlOpen: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border-[#D8B068]/60 bg-[#D8B068]/10 text-[#EDC878] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    searchInput: "focus:ring-2 focus:ring-[#D8B068]/10 border-[#D8B068]/28 bg-[#020609] bg-[linear-gradient(180deg,#05090C,#020609)] text-[#E4E7EC] shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] duration-200 placeholder:text-[#A7AEB8] hover:border-[#D8B068]/45 focus:border-[#D8B068]/65 focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    menu: "border-[#D8B068]/35 bg-[linear-gradient(145deg,#101419,#03070A)] text-[#E4E7EC] shadow-[0_16px_50px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(237,200,120,0.08)]",
    option: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 text-[#D1D6DF] hover:bg-[#D8B068]/10 hover:text-[#EDC878] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    optionActive: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-[#D8B068]/15 text-[#EDC878] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    chip: "border-[#D8B068]/30 bg-[#D8B068]/10 text-[#EDC878] hover:border-[#D8B068]/60 hover:bg-[#D8B068]/15 motion-reduce:transition-none",
    subtleAction: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 text-[#BEC4CE] hover:bg-[#D8B068]/10 hover:text-[#EDC878] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    filterField: "border-[#D8B068]/20 bg-[#03080D] text-[#E4E7EC] focus-within:border-[#D8B068]/55",
    footer: "border-[#D8B068]/35 bg-[linear-gradient(110deg,#0D1013,#03080D)] text-[#BEC4CE] shadow-[inset_0_1px_0_rgba(237,200,120,0.06)]",
    page: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border-[#D8B068]/22 bg-[linear-gradient(180deg,#11161A,#020609)] text-[#D1D6DF] shadow-[inset_0_1px_0_rgba(237,200,120,0.05)] duration-200 hover:border-[#D8B068]/60 hover:text-[#EDC878] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    pageActive: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border-[#F2CF86]/80 bg-[linear-gradient(145deg,#F3D18A,#DDB469)] text-[#100D06] shadow-[inset_0_1px_0_rgba(255,244,216,0.45),0_0_12px_rgba(216,176,104,0.22)] focus-visible:outline-[#EDC878] motion-reduce:transition-none",
    pageDisabled: "border-white/[0.06] bg-[linear-gradient(180deg,#0B0E10,#040709)] text-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
  },
  dataGrid: {
    legacyHeader: "border-b border-[#D8B068]/20 bg-[linear-gradient(180deg,#1A1D1E_0%,#091119_65%,#050B10_100%)] text-sm font-bold text-[#E8D6AD] shadow-[inset_0_1px_0_rgba(237,200,120,0.10),inset_0_-1px_0_rgba(216,176,104,0.22)]",
    legacyRow: [
      "bg-[#03080D] text-[#D1D6DF] [&:nth-child(even)]:bg-[#080E13] [&>*]:bg-[#03080D] [&:nth-child(even)>*]:bg-[#080E13] [&>*]:py-3 [&>*]:border-[#D8B068]/10",
      "[&:hover>*]:bg-[var(--admin-grid-hover,#0D151D)] [&:hover>*]:bg-[linear-gradient(180deg,rgba(216,176,104,0.035),rgba(216,176,104,0.008))]",
      "[&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*]:bg-[var(--admin-grid-selected,#102033)] [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*]:bg-[linear-gradient(180deg,rgba(120,189,250,0.035),rgba(120,189,250,0.012))] [&:has(>[data-admin-grid-checkbox-cell]_input:checked):hover>*]:bg-[var(--admin-grid-selected-hover,#14283D)]",
      "[&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child:not([data-admin-grid-sticky])]:relative [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:absolute [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:inset-y-0 [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:start-0 [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:w-0.5 [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:bg-[var(--admin-accent,#D8B068)] [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:pointer-events-none [&:has(>[data-admin-grid-checkbox-cell]_input:checked)>*:first-child]:before:content-['']",
      "[&:has(:focus-visible)>*]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--admin-grid-focus,#78BDFA)_45%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--admin-grid-focus,#78BDFA)_45%,transparent)] [&>*]:transition-[background-color,border-color,box-shadow] [&>*]:duration-250 motion-reduce:[&>*]:transition-none",
    ].join(" "),
    surface: "rounded-[20px] border border-[#D8B068]/35 bg-[linear-gradient(120deg,#0A0F13,#02070B_60%,#0B0E10)] p-3 shadow-[0_0_16px_rgba(216,176,104,0.07),inset_0_1px_0_rgba(237,200,120,0.08)]",
    scroll: "rounded-[14px] border border-[#D8B068]/15 bg-[#020609]",
    table: [
      "[&_th[aria-sort=ascending]_button]:text-[#EDC878] [&_th[aria-sort=descending]_button]:text-[#EDC878] [&_th[aria-sort=ascending]_a]:text-[#EDC878] [&_th[aria-sort=descending]_a]:text-[#EDC878]",
      "[&_thead_th]:border-[#D8B068]/20 [&_thead_th]:bg-[linear-gradient(180deg,#1A1D1E_0%,#091119_65%,#050B10_100%)] [&_thead_th]:text-[#E8D6AD] [&_thead_th]:shadow-[inset_0_1px_0_rgba(237,200,120,0.10),inset_0_-1px_0_rgba(216,176,104,0.22)] [&_thead_th]:py-3 [&_thead_th[aria-sort=ascending]]:text-[#EDC878] [&_thead_th[aria-sort=descending]]:text-[#EDC878]",
      "[&_tbody_td]:border-[#D8B068]/10 [&_tbody_td]:bg-[#03080D] [&_tbody_td]:text-[#D1D6DF] [&_tbody_td]:py-3 [&_tbody_tr:nth-child(even)>td]:bg-[#080E13]",
      "[&_tbody_tr:hover>td]:bg-[var(--admin-grid-hover,#0D151D)] [&_tbody_tr:hover>td]:bg-[linear-gradient(180deg,rgba(216,176,104,0.035),rgba(216,176,104,0.008))]",
      ADMIN_DATA_GRID_SELECTION.table,
    ].join(" "),
    action: "duration-250 ease-out motion-reduce:transition-none",
    actionGold: "border-[#D8B068]/35 bg-[linear-gradient(160deg,#211D12,#080D10)] text-[#EDC878] shadow-[inset_0_1px_0_rgba(237,200,120,0.10)] hover:border-[#EDC878]/65 hover:text-[#F4DDA7] hover:shadow-[inset_0_1px_0_rgba(237,200,120,0.15),0_0_10px_rgba(216,176,104,0.16)]",
    actionDark: "border-[#D8B068]/16 bg-[linear-gradient(180deg,#14191E,#060A0E)] text-[#D7DCE4] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#D8B068]/45 hover:text-[#EDC878] hover:shadow-[0_0_8px_rgba(216,176,104,0.08)]",
    checkbox: ADMIN_DATA_GRID_SELECTION.checkbox,
    bulk: ADMIN_DATA_GRID_SELECTION.bulk,
  },
  metric: {
    artworkClassName: "pointer-events-none absolute inset-0 z-0 size-full text-[color:var(--admin-metric-color)] opacity-[0.11] [mask-image:linear-gradient(120deg,#000,rgba(0,0,0,0.45))]",
    activeClassName: "ring-1 ring-[color:var(--admin-metric-color)] border-[color:var(--admin-metric-color)]",
    surfaceClassName: "admin-cinematic-edge admin-cinematic-metric group relative isolate flex min-h-[132px] min-w-0 flex-col justify-center overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--admin-metric-color)_25%,transparent)] bg-[radial-gradient(ellipse_at_4%_0%,color-mix(in_srgb,var(--admin-metric-color)_22%,transparent),transparent_74%),linear-gradient(135deg,#050A10,#020609)] p-3 shadow-[inset_0_2px_0_color-mix(in_srgb,var(--admin-metric-color)_60%,transparent),inset_0_8px_18px_color-mix(in_srgb,var(--admin-metric-color)_9%,transparent),0_0_18px_color-mix(in_srgb,var(--admin-metric-color)_8%,transparent),0_20px_45px_rgba(0,0,0,0.65)] hover:border-[color:color-mix(in_srgb,var(--admin-metric-color)_75%,transparent)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_color-mix(in_srgb,var(--admin-metric-color)_12%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EDC878]",
    iconClassName: "absolute end-3 top-3 z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--admin-metric-color)_60%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--admin-metric-color)_20%,transparent),transparent)] text-[color:var(--admin-metric-color)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_14px_color-mix(in_srgb,var(--admin-metric-color)_8%,transparent)] [&>svg]:size-6 2xl:size-12 2xl:[&>svg]:size-7",
    contentClassName: "relative z-10 flex w-full min-w-0 flex-1 flex-col items-start justify-between gap-4 text-right",
    labelClassName: "min-h-11 min-w-0 pe-11 text-[13px] font-semibold leading-5 text-[#E4E7EC] [font-family:var(--font-arabic)] [text-wrap:pretty] 2xl:pe-14",
    valueClassName: "font-en inline-flex max-w-full items-baseline whitespace-nowrap text-[32px] font-bold tabular-nums leading-none tracking-tight text-[color:var(--admin-metric-color)] 2xl:text-[36px]",
    descriptionClassName: "min-w-0 text-xs leading-5 text-white/45 [text-wrap:pretty]",
    gridClassName: "grid min-w-0 auto-rows-fr grid-cols-[repeat(var(--admin-metric-cols,2),minmax(0,1fr))] gap-3 md:grid-cols-[repeat(var(--admin-metric-cols-md,3),minmax(0,1fr))] xl:grid-cols-[repeat(var(--admin-metric-cols-xl,6),minmax(0,1fr))]",
  },
  tones: {
    gold: "[--admin-metric-color:#EDC878]", amber: "[--admin-metric-color:#EDC878]",
    blue: "[--admin-metric-color:#78BDFA]", teal: "[--admin-metric-color:#56DBC4]",
    green: "[--admin-metric-color:#44DFBF]", emerald: "[--admin-metric-color:#44DFBF]",
    violet: "[--admin-metric-color:#BE8BEE]", cyan: "[--admin-metric-color:#69D2EE]",
    red: "[--admin-metric-color:#F5787B]",
    neutral: "[--admin-metric-color:#E4E7EC]",
  },
} as const;

export const ADMIN_FORM = {
  // Column gaps work for inline labels and ignore hidden form inputs.
  labelStack: "flex min-w-0 flex-col gap-2",
  /** Opt-in helper alignment only; preserve each helper owner's typography. */
  helperTextInset: "min-w-0 ps-3",
  grid: "grid gap-4",
  gridTwoCol: "grid gap-4 md:grid-cols-2",
  choiceGroup: "flex min-w-0 flex-wrap gap-2",
  checkboxRow:
    "flex min-h-11 min-w-0 items-center justify-end gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm text-white/70",
} as const;

/** Neutral color layers from the current Admin shell header, composed through sectionHeaderClassName. */
export const ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME =
  "[--admin-section-header-surface:rgba(8,13,22,0.82)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))]";

/** Canonical premium section chrome; each semantic owner supplies its own outer layout. */
export const ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME =
  "overflow-hidden rounded-t-2xl border-b border-white/10 bg-[color:var(--admin-section-header-surface,#080D10)] p-3 ps-6";
export const ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME =
  "flex min-w-0 flex-wrap items-center justify-between gap-3";
export const ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME =
  `relative -mx-3 -mt-3 mb-3 ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME} ${ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME}`;
export const ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME =
  "pointer-events-none absolute inset-y-2 right-2 w-2 rounded-r-xl bg-[#F2CB78] shadow-[0_0_12px_rgba(242,203,120,0.45)]";

/** Presentation only; the consuming control owns its state and selection semantics. */
export function adminChoiceButtonClassName(active: boolean, extra = "", density: "default" | "compact" = "default") {
  return [
    `inline-flex ${density === "compact" ? "min-h-9" : "min-h-11"} cursor-pointer items-center justify-center ${density === "compact" ? "rounded-[10px]" : "rounded-2xl"} border ${density === "compact" ? "px-3 py-1.5" : "px-4 py-2"} text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45`,
    active
      ? "border-[#D8B87A] bg-[linear-gradient(135deg,rgba(216,184,122,0.17),rgba(216,184,122,0.08))] text-[#F2D99B] shadow-[inset_0_1px_0_rgba(216,184,122,0.08)]"
      : "border-white/10 bg-white/[0.035] text-white/70 hover:border-[#D8B87A]/30 hover:text-[#F2D99B]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Shared list/table layout — reuse for all Admin listing pages (Pages, Menus, Topics, Projects). */
export const ADMIN_LIST_PAGE = {
  wrapper: "space-y-6 pb-10",
  /** 4 standard CRUD actions — matches Topics golden reference. */
  actionsColumnWidth: "198px",
  bulkBar:
    "flex flex-col gap-4 rounded-[18px] border border-[#D8B87A]/14 bg-[#080B10]/92 px-4 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.035)] md:flex-row md:items-center md:justify-between",
} as const;

export function adminFormFieldClassName(extra = "") {
  return [
    "w-full min-w-0 min-h-11 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D8B87A]/45",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Opt-in 12px logical inset for marked title rows only; control and card padding stay unchanged. */
export function adminFormLabelClassName({ textInset = false }: { textInset?: boolean } = {}) {
  const label = `${ADMIN_FORM.labelStack} text-right text-xs font-medium text-white/48`;
  return textInset
    ? `${label} [&>[data-admin-form-label-text]]:min-w-0 [&>[data-admin-form-label-text]]:ps-3`
    : label;
}

export function adminFormHintClassName({ textInset = false }: { textInset?: boolean } = {}) {
  const hint = "block text-right text-[11px] leading-5 text-white/32";
  return textInset ? `${hint} ${ADMIN_FORM.helperTextInset}` : hint;
}

/** Optional image dimension disclosures; plain guidance/dimension defaults stay unchanged. */
export const ADMIN_MEDIA_DIMENSION_DISCLOSURE = {
  root: "@container/media-dimension min-w-0 rounded-xl border border-white/10 bg-white/[0.025] text-xs leading-6 text-white/55",
  summary: "cursor-pointer whitespace-nowrap rounded-xl px-2 py-1.5 font-medium transition hover:text-[#D8B87A] focus-visible:outline-2 focus-visible:outline-[#D8B87A]",
  value: "whitespace-nowrap px-2 pb-2 text-white/65",
} as const;

/** Shared textarea adapter; scroll geometry remains owned by the field. */
export function adminFormTextareaClassName(extra = "") {
  return adminFormFieldClassName(`${VENESIA_SCROLLBAR_VISUAL_CLASSES} ${extra}`);
}
