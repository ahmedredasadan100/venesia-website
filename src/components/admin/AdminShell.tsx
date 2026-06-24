"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type MenuChild = { href: string; label: string; badge?: string };
type MenuItem = { href: string; label: string; icon: string; children?: MenuChild[] };

const menuItems: MenuItem[] = [
  { href: "/admin", label: "الرئيسية", icon: "⌂" },
  {
    href: "/admin/topics",
    label: "المحتوى",
    icon: "✦",
    children: [
      { href: "/admin/topics", label: "المقالات" },
      { href: "/admin/topics/categories", label: "التصنيفات" },
      { href: "/admin/content/series", label: "السلاسل" },
    ],
  },
  {
    href: "/admin/projects",
    label: "المشروعات",
    icon: "▣",
    children: [
      { href: "/admin/projects", label: "كل المشروعات" },
      { href: "/admin/projects/construction-updates", label: "تحديثات التنفيذ" },
    ],
  },
  { href: "/admin/media-center", label: "مكتبة الوسائط", icon: "◉" },
  {
    href: "/admin/pages-blocks/pages",
    label: "الصفحات والبلوكات",
    icon: "▤",
    children: [
      { href: "/admin/pages-blocks/pages", label: "الصفحات" },
      { href: "/admin/pages-blocks/blocks", label: "البلوكات" },
      { href: "/admin/pages-blocks/menus", label: "القوائم" },
      { href: "/admin/pages-blocks/footer", label: "الفوتر" },
    ],
  },
  {
    href: "/admin/seo/meta-manager",
    label: "تحسين محركات البحث",
    icon: "◎",
    children: [
      { href: "/admin/seo/meta-manager", label: "Meta Manager" },
      { href: "/admin/seo/redirects", label: "Redirects" },
      { href: "/admin/seo/sitemap", label: "Sitemap" },
    ],
  },
  { href: "/admin/users-roles", label: "المستخدمون والصلاحيات", icon: "◌" },
  {
    href: "/admin/settings/general",
    label: "الإعدادات",
    icon: "⚙",
    children: [
      { href: "/admin/settings/general", label: "إعدادات عامة" },
      { href: "/admin/settings/theme", label: "الثيم" },
      { href: "/admin/settings/appearance", label: "المظهر" },
      { href: "/admin/settings/integrations", label: "التكاملات" },
    ],
  },
  { href: "/admin/reports", label: "التقارير", icon: "◒" },
  { href: "/admin/activity-log", label: "سجل النشاط", icon: "☷" },
];

function isItemActive(pathname: string, item: MenuItem) {
  if (item.href === "/admin") return pathname === "/admin";
  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ||
    false
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeGroups = useMemo(
    () =>
      Object.fromEntries(
        menuItems
          .filter((item) => item.children?.length && isItemActive(pathname, item))
          .map((item) => [item.href, true]),
      ),
    [pathname],
  );
  const [pathnameKey, setPathnameKey] = useState(pathname);
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean> | null>(null);

  if (pathname !== pathnameKey) {
    setPathnameKey(pathname);
    setToggledGroups(null);
  }

  const openGroups = toggledGroups ?? activeGroups;

  const sidebar = (
    <aside
      className={[
        "admin-sidebar-shell relative flex flex-col bg-transparent transition-[width] duration-300 ease-out",
        collapsed ? "w-[92px]" : "w-[304px]",
      ].join(" ")}
    >
      <div className="relative overflow-visible p-4">
        <div className={["relative flex min-h-11 items-center", collapsed ? "justify-center" : "justify-end"].join(" ")}>
          {!collapsed ? (
            <div className="min-w-0 pr-1">
              <p className="font-en text-[10px] tracking-[0.34em] text-[#D8B87A]/75">Admin Panel</p>
              <p className="mt-1 truncate text-sm font-semibold text-white/70">لوحة إدارة المحتوى</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute left-2 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#D8B87A]/25 bg-[#05070B]/80 text-sm font-bold text-[#D8B87A] shadow-[0_10px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:scale-105 hover:border-[#D8B87A]/55 hover:bg-[#D8B87A] hover:text-[#05070B]"
          aria-label={collapsed ? "فتح القائمة" : "طي القائمة"}
          title={collapsed ? "فتح القائمة" : "طي القائمة"}
        >
          {collapsed ? "‹" : "›"}
        </button>
      </div>

      <nav className="px-3 py-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const active = isItemActive(pathname, item);
            const hasChildren = Boolean(item.children?.length);
            const open = openGroups[item.href] ?? active;
            const itemBase = "group relative flex items-center gap-3 rounded-[20px] border px-3 py-2.5 text-sm transition duration-200";
            const itemState = active
              ? "border-[#D8B87A]/32 bg-[linear-gradient(135deg,rgba(216,184,122,0.16),rgba(216,184,122,0.045))] text-[#F4D99A] shadow-[0_12px_34px_rgba(216,184,122,0.10),inset_0_1px_0_rgba(255,255,255,0.05)]"
              : "border-transparent text-white/56 hover:border-[#D8B87A]/18 hover:bg-white/[0.045] hover:text-white";

            if (!hasChildren || collapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={[itemBase, collapsed ? "justify-center" : "justify-start", itemState].join(" ")}
                >
                  {active && !collapsed ? <span className="absolute right-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-l-full bg-[#D8B87A] shadow-[0_0_18px_rgba(216,184,122,0.55)]" /> : null}
                  <span className="grid size-9 shrink-0 place-items-center rounded-2xl border border-[#D8B87A]/14 bg-[radial-gradient(circle,rgba(216,184,122,0.18),rgba(255,255,255,0.035)_72%)] font-en text-base text-[#D8B87A] transition group-hover:border-[#D8B87A]/35">
                    {item.icon}
                  </span>
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            }

            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setToggledGroups(open ? {} : { [item.href]: true })}
                  className={[itemBase, "w-full justify-between", itemState].join(" ")}
                >
                  {active ? <span className="absolute right-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-l-full bg-[#D8B87A] shadow-[0_0_18px_rgba(216,184,122,0.55)]" /> : null}
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-2xl border border-[#D8B87A]/14 bg-[radial-gradient(circle,rgba(216,184,122,0.18),rgba(255,255,255,0.035)_72%)] font-en text-base text-[#D8B87A]">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className={["text-xs transition", open ? "rotate-180 text-[#D8B87A]" : "text-white/30"].join(" ")}>⌄</span>
                </button>

                <div className={["grid overflow-hidden transition-all duration-300", open ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]"].join(" ")}>
                  <div className="min-h-0 space-y-1 pr-11">
                    {item.children?.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={[
                            "block rounded-2xl border px-3 py-2.5 text-sm transition duration-200",
                            childActive
                              ? "border-[#D8B87A]/28 bg-[#D8B87A]/12 text-[#F4D99A]"
                              : "border-transparent text-white/40 hover:border-[#D8B87A]/12 hover:bg-white/[0.035] hover:text-white/75",
                          ].join(" ")}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="p-3">
        <Link
          href="/topics"
          className={[
            "flex items-center gap-3 rounded-[18px] border border-[#D8B87A]/14 bg-white/[0.035] px-3 py-3 text-sm text-white/56 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/8 hover:text-[#D8B87A]",
            collapsed ? "justify-center" : "justify-start",
          ].join(" ")}
          title="الانتقال للموقع"
        >
          <span className="grid size-8 place-items-center rounded-2xl border border-[#D8B87A]/12">↗</span>
          {!collapsed ? <span>الانتقال للموقع</span> : null}
        </Link>
      </div>
    </aside>
  );

  return (
    <section dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#05070B_0%,#05070B_48%,#030407_100%)] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-52 right-[-12%] h-[520px] w-[520px] rounded-full bg-[#D8B87A]/10 blur-[140px]" />
        <div className="absolute bottom-[-22%] left-[-16%] h-[560px] w-[560px] rounded-full bg-[#D8B87A]/6 blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(216,184,122,0.025)_100%)]" />
      </div>

      <div className="relative flex min-h-screen flex-row items-start bg-transparent">
        <div className="hidden shrink-0 bg-transparent lg:block">{sidebar}</div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/76" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />
            <div className="absolute right-0 top-0 h-full">{sidebar}</div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-7">
          <header className="admin-premium-card mb-5 rounded-[28px] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="grid size-11 place-items-center rounded-2xl border border-[#D8B87A]/18 bg-white/[0.045] text-white/70 lg:hidden"
                  aria-label="فتح القائمة"
                >
                  ☰
                </button>
                <div>
                  <p className="font-en text-[10px] tracking-[0.34em] text-[#D8B87A]/72">VENESIA CMS</p>
                  <h1 className="mt-1 text-2xl font-semibold text-white">Admin Panel</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="grid size-11 place-items-center rounded-2xl border border-[#D8B87A]/14 bg-white/[0.045] text-white/62 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">
                  🔔
                </button>
                <div className="flex items-center gap-3 rounded-2xl border border-[#D8B87A]/14 bg-white/[0.045] px-3 py-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-[linear-gradient(135deg,#F0D493,#D8B87A)] font-en text-xs font-bold text-[#05070B]">AR</span>
                  <span className="text-sm text-white/72">أحمد رضا</span>
                </div>
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>
    </section>
  );
}
