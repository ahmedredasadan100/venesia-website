/** Shared Admin filter / dropdown surface tokens — reuse across listing filter bars. */

export const ADMIN_FILTER_MENU_ATTR = "data-admin-filter-menu";

export const ADMIN_FILTER_MENU_SCROLLBAR_CLASSES =
  "max-h-[260px] overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.24)_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30";

export const ADMIN_FILTER_MENU_PANEL_CLASSES =
  "rounded-[14px] border border-white/10 bg-[#080B10]/95 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl";

export const ADMIN_FILTER_SHELL_CLASSES =
  "group relative overflow-visible rounded-[26px] border border-white/10 bg-[#080B10]/70 px-3 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:px-4";

export const ADMIN_FILTER_SHELL_GLOW_STYLE = {
  background: "radial-gradient(circle at 85% 12%, rgba(74,141,255,0.16), transparent 40%)",
} as const;

export const ADMIN_FILTER_ROW_CLASSES =
  "flex flex-wrap items-center gap-2 overflow-visible lg:flex-nowrap";

export function isInsideAdminFilterMenu(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return false;
  return Boolean(element.closest(`[${ADMIN_FILTER_MENU_ATTR}]`));
}
