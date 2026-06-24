"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePublicNavigation } from "./PublicNavigationProvider";

type DynamicNavItem = {
  id?: number;
  label: string;
  href: string;
  target?: "_self" | "_blank";
  cssClass?: string;
  stylePreset?: string;
  submenu?: DynamicNavItem[];
};

function isExternalHref(href: string) {
  return (
    /^https?:\/\//i.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function getItemKey(item: DynamicNavItem) {
  return String(item.id ?? `${item.label}-${item.href}`);
}

function isActivePath(pathname: string, href: string) {
  if (!href || href === "#") return false;
  const cleanHref = href.split("#")[0] || "/";
  if (cleanHref === "/") return pathname === "/";
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

function MenuLink({
  item,
  children,
  className,
  onClick,
}: {
  item: DynamicNavItem;
  children: React.ReactNode;
  className: string;
  onClick?: () => void;
}) {
  const target = item.target === "_blank" ? "_blank" : undefined;
  const rel = target ? "noreferrer" : undefined;
  const finalClassName = [className, item.cssClass].filter(Boolean).join(" ");

  if (isExternalHref(item.href) || target || item.href === "#") {
    return (
      <a
        href={item.href}
        target={target}
        rel={rel}
        className={finalClassName}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={item.href} className={finalClassName} onClick={onClick}>
      {children}
    </Link>
  );
}

export default function SiteNavbar() {
  const pathname = usePathname();
  const navItems = usePublicNavigation() as DynamicNavItem[];
  const [navScrolled, setNavScrolled] = useState(false);
  const [pathnameKey, setPathnameKey] = useState(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  if (pathname !== pathnameKey) {
    setPathnameKey(pathname);
    setMobileOpen(false);
    setOpenSubmenu(null);
  }

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setNavScrolled((prev) => (prev ? y > 20 : y > 40));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-5 py-5 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-8 sm:py-5 md:px-10 md:py-5">
        <div
          className={`mx-auto flex max-w-[82rem] items-center justify-between rounded-2xl border px-5 py-3 shadow-[0_1px_0_0_rgba(216,184,122,0.07)_inset,0_2px_18px_rgba(0,0,0,0.12)] transition-[background-color,backdrop-filter,border-color,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-saturate-[1.6] sm:px-6 sm:py-3 md:px-8 ${
            navScrolled
              ? "border-[#D8B87A]/[0.10] bg-[#05070B]/55 shadow-[0_4px_28px_rgba(0,0,0,0.24),0_0_16px_rgba(216,184,122,0.06),0_1px_0_0_rgba(216,184,122,0.22)_inset,1px_0_0_0_rgba(216,184,122,0.09)_inset,-1px_0_0_0_rgba(216,184,122,0.09)_inset,0_-1px_0_0_rgba(216,184,122,0.04)_inset] backdrop-blur-[22px]"
              : "border-[#D8B87A]/[0.13] bg-[#05070B]/[0.08] backdrop-blur-[8px]"
          }`}
        >
          <Link
            href="/"
            className="flex h-10 min-w-0 shrink-0 items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-white/[0.03]">
                <span className="text-xs leading-none text-[#D8B87A]">◆</span>
              </div>
            </div>

            <div className="min-h-10 min-w-[10.5rem] shrink-0">
              <p className="truncate whitespace-nowrap text-[15px] font-medium leading-5 tracking-wide text-white/90">
                Venesia Developments
              </p>
              <p className="truncate whitespace-nowrap text-[11px] leading-4 tracking-wide text-white/35">
                Trust Built On Ground
              </p>
            </div>
          </Link>

          <nav className="mr-1 hidden items-center gap-3 text-[13px] font-semibold tracking-wide text-white/45 lg:flex xl:gap-6">
            {navItems.map((item) => {
              const hasSubmenu =
                Array.isArray(item.submenu) && item.submenu.length > 0;
              const active = isActivePath(pathname, item.href);

              if (!hasSubmenu) {
                return (
                  <MenuLink
                    key={getItemKey(item)}
                    item={item}
                    className={`group/link relative cursor-pointer transition-colors duration-500 ease-out ${
                      active
                        ? "text-[#D8B87A]"
                        : "text-white/45 hover:text-white/85"
                    }`}
                  >
                    {item.label}
                    <span className="absolute -bottom-0.5 right-0 h-px w-0 bg-gradient-to-l from-[#D8B87A]/55 to-transparent transition-[width] duration-500 ease-out group-hover/link:w-full" />
                  </MenuLink>
                );
              }

              return (
                <div key={getItemKey(item)} className="group/media relative">
                  <MenuLink
                    item={item}
                    className={`group/link relative inline-flex items-center gap-1.5 transition-colors duration-500 ease-out hover:text-white/85 ${
                      active ? "text-[#D8B87A]" : ""
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className="translate-y-px text-[10px] text-[#D8B87A]/55 transition-transform duration-500 ease-out group-hover/media:rotate-180"
                      aria-hidden
                    >
                      ▾
                    </span>
                    <span className="absolute -bottom-0.5 right-0 h-px w-0 bg-gradient-to-l from-[#D8B87A]/55 to-transparent transition-[width] duration-500 ease-out group-hover/link:w-full" />
                  </MenuLink>

                  <div className="absolute left-1/2 top-full h-8 w-72 -translate-x-1/2" />

                  <div className="invisible absolute left-1/2 top-[calc(100%+1rem)] w-72 -translate-x-1/2 translate-y-2 rounded-2xl border border-[#D8B87A]/[0.14] bg-[#05070B]/72 p-2 opacity-0 shadow-[0_18px_60px_rgba(0,0,0,0.38),0_1px_0_0_rgba(216,184,122,0.12)_inset] backdrop-blur-[24px] transition-[opacity,transform,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/media:visible group-hover/media:translate-y-0 group-hover/media:opacity-100">
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#D8B87A]/35 to-transparent" />
                    <div className="space-y-1">
                      {item.submenu?.map((subItem) => (
                        <MenuLink
                          key={getItemKey(subItem)}
                          item={subItem}
                          className="group/item flex flex-row-reverse items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-right transition-[background-color,border-color,transform] duration-300 ease-out hover:-translate-x-1 hover:border-[#D8B87A]/[0.12] hover:bg-white/[0.035]"
                        >
                          <span className="text-[11px] text-[#D8B87A]/50 transition-colors duration-300 group-hover/item:text-[#D8B87A]/80">
                            ←
                          </span>
                          <span className="text-[13px] font-medium text-white/70 transition-colors duration-300 group-hover/item:text-white/78">
                            {subItem.label}
                          </span>
                        </MenuLink>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/201033766876"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-[#D8B87A] px-5 py-2 text-sm font-medium text-[#06101C] transition-[background-color] duration-300 ease-out hover:bg-[#cca85a] active:bg-[#c09540] sm:px-6 sm:py-2.5"
            >
              واتساب ↗
            </a>

            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={mobileOpen}
              className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-xl border border-[#D8B87A]/20 bg-white/[0.04] transition-colors duration-300 hover:bg-white/[0.08] lg:hidden"
            >
              <span
                className={`block h-px w-5 bg-white/70 transition-transform duration-300 ${mobileOpen ? "translate-y-[6px] rotate-45" : ""}`}
              />
              <span
                className={`block h-px w-5 bg-white/70 transition-opacity duration-300 ${mobileOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block h-px w-5 bg-white/70 transition-transform duration-300 ${mobileOpen ? "-translate-y-[6px] -rotate-45" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <div
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-[#05070B]/70 backdrop-blur-sm transition-opacity duration-500 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      <aside
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-[min(88vw,340px)] flex-col bg-[#05070B] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="القائمة الرئيسية"
      >
        <div className="flex items-center justify-between border-b border-[#D8B87A]/10 px-5 py-5">
          <Link
            href="/"
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D8B87A]/25 bg-white/[0.03]">
              <span className="text-[10px] leading-none text-[#D8B87A]">◆</span>
            </div>
            <span className="text-[14px] font-medium text-white/85">
              Venesia
            </span>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق القائمة"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const hasSubmenu =
                Array.isArray(item.submenu) && item.submenu.length > 0;
              const active = isActivePath(pathname, item.href);
              const itemKey = getItemKey(item);
              const isSubmenuOpen = openSubmenu === itemKey;

              if (!hasSubmenu) {
                return (
                  <li key={itemKey}>
                    <MenuLink
                      item={item}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-[14px] font-medium transition-colors duration-200 ${
                        active
                          ? "bg-[#D8B87A]/10 text-[#D8B87A]"
                          : "text-white/65 hover:bg-white/[0.05] hover:text-white/90"
                      }`}
                    >
                      {item.label}
                      {active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D8B87A]" />
                      ) : null}
                    </MenuLink>
                  </li>
                );
              }

              return (
                <li key={itemKey}>
                  <button
                    onClick={() =>
                      setOpenSubmenu(isSubmenuOpen ? null : itemKey)
                    }
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[14px] font-medium text-white/65 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white/90"
                  >
                    {item.label}
                    <span
                      className={`text-[10px] text-[#D8B87A]/55 transition-transform duration-300 ${isSubmenuOpen ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>

                  {isSubmenuOpen ? (
                    <ul className="mt-1 space-y-0.5 pr-3">
                      {item.submenu?.map((sub) => (
                        <li key={getItemKey(sub)}>
                          <MenuLink
                            item={sub}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] transition-colors duration-200 ${
                              isActivePath(pathname, sub.href)
                                ? "text-[#D8B87A]"
                                : "text-white/50 hover:text-white/80"
                            }`}
                          >
                            <span className="text-[10px] text-[#D8B87A]/40">
                              ←
                            </span>
                            {sub.label}
                          </MenuLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[#D8B87A]/10 px-4 py-5">
          <a
            href="https://wa.me/201033766876"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#D8B87A] py-3 text-sm font-medium text-[#06101C] transition-colors hover:bg-[#cca85a]"
          >
            تواصل عبر واتساب ↗
          </a>
        </div>
      </aside>
    </>
  );
}
