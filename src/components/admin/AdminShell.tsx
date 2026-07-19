"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import type {
  AdminNavigationItem,
  ResolvedAdminCompanyConfig,
} from "../../lib/admin/shell/contracts";
import { isAdminNavigationItemActive } from "../../lib/admin/shell/navigation";
import AdminPageContextHeader from "./ui/AdminPageContextHeader";

type AdminShellProps = {
  children: ReactNode;
  company: ResolvedAdminCompanyConfig;
  navigation: AdminNavigationItem[];
};

type AdminNavLinkProps = {
  href: string;
  className: string;
  title?: string;
  children: ReactNode;
  onNavigateStart: (href: string) => void;
};

const ADMIN_SHELL_COLLAPSE_EVENT = "admin-shell-collapse-change";

function usePersistedCollapsed(key: string) {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("storage", onChange);
    window.addEventListener(ADMIN_SHELL_COLLAPSE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(ADMIN_SHELL_COLLAPSE_EVENT, onChange);
    };
  }, []);
  const getSnapshot = useCallback(
    () => window.localStorage.getItem(key) === "true",
    [key],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function AdminNavLink({
  href,
  className,
  title,
  children,
  onNavigateStart,
}: AdminNavLinkProps) {
  const router = useRouter();
  const prefetch = useCallback(() => router.prefetch(href), [href, router]);

  return (
    <Link
      href={href}
      prefetch={null}
      title={title}
      className={className}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      onNavigate={() => onNavigateStart(href)}
    >
      {children}
    </Link>
  );
}

function CompanyMark({
  company,
  compact,
}: {
  company: ResolvedAdminCompanyConfig;
  compact: boolean;
}) {
  const source = compact
    ? company.compactLogoUrl || company.logoUrl
    : company.logoUrl;
  const fallback = company.name.trim().slice(0, 2).toUpperCase() || "AD";

  return (
    <span
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border text-xs font-bold"
      style={{
        borderColor: "color-mix(in srgb, var(--admin-accent) 30%, transparent)",
        color: "var(--admin-accent-strong)",
        background: "color-mix(in srgb, var(--admin-accent) 10%, transparent)",
      }}
      aria-label={company.name}
    >
      {source ? (
        // Configured company media can be local or remote, so the shell does
        // not impose a Next Image host allowlist on company identity.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt="" className="h-full w-full object-contain p-1.5" />
      ) : (
        fallback
      )}
    </span>
  );
}

export default function AdminShell({
  children,
  company,
  navigation,
}: AdminShellProps) {
  const pathname = usePathname();
  const collapseKey = `admin-shell:${company.key}:collapsed`;
  const collapsed = usePersistedCollapsed(collapseKey);
  const [mobileState, setMobileState] = useState({ pathname, open: false });
  const [groupOverride, setGroupOverride] = useState<{
    pathname: string;
    id: string | null;
  } | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{
    pathname: string;
    href: string;
  } | null>(null);
  const mobileOpen = mobileState.pathname === pathname && mobileState.open;
  const pendingHref =
    pendingNavigation?.pathname === pathname ? pendingNavigation.href : null;

  const activeGroupIds = useMemo(
    () =>
      new Set(
        navigation
          .filter((item) => isAdminNavigationItemActive(pathname, item))
          .map((item) => item.id),
      ),
    [navigation, pathname],
  );
  const activeRouteItem = useMemo(() => {
    const candidates = navigation.flatMap((item) => [
      item,
      ...(item.children ?? []),
    ]);
    return candidates
      .filter((item) => isAdminNavigationItemActive(pathname, item))
      .sort((left, right) => right.href.length - left.href.length)[0];
  }, [navigation, pathname]);
  const activeGroup = useMemo(
    () =>
      navigation.find(
        (item) =>
          item.children?.length && isAdminNavigationItemActive(pathname, item),
      ),
    [navigation, pathname],
  );
  const openGroupId =
    groupOverride?.pathname === pathname
      ? groupOverride.id
      : (activeGroup?.id ?? null);

  function toggleCollapsed() {
    window.localStorage.setItem(collapseKey, String(!collapsed));
    window.dispatchEvent(new Event(ADMIN_SHELL_COLLAPSE_EVENT));
  }

  const onNavigateStart = useCallback((href: string) => {
    setPendingNavigation({ pathname, href });
  }, [pathname]);

  function renderSidebar(forceExpanded = false) {
    const compact = forceExpanded ? false : collapsed;
    return (
      <aside
        className={[
          "admin-sidebar-shell relative flex h-full flex-col bg-transparent transition-[width] duration-300 ease-out",
          compact ? "w-[92px]" : "w-[304px]",
        ].join(" ")}
        data-admin-navigation
      >
        <div className="relative p-4">
          <div
            className={[
              "flex min-h-12 items-center gap-3",
              compact ? "justify-center" : "justify-start",
            ].join(" ")}
          >
            <CompanyMark company={company} compact={compact} />
            {!compact ? (
              <div className="min-w-0">
                <p
                  className="truncate font-en text-[10px] tracking-[0.25em]"
                  style={{ color: "var(--admin-accent)" }}
                >
                  {company.cmsLabel}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white/70">
                  {company.name}
                </p>
              </div>
            ) : null}
          </div>

          {!forceExpanded ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="absolute left-2 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-[#05070B]/80 text-sm font-bold shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition hover:scale-105"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--admin-accent) 30%, transparent)",
                color: "var(--admin-accent)",
              }}
              aria-label={compact ? "فتح القائمة" : "طي القائمة"}
              aria-expanded={!compact}
            >
              {compact ? "‹" : "›"}
            </button>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="الإدارة">
          <div className="space-y-1">
            {navigation.map((item) => {
              const active = activeGroupIds.has(item.id);
              const hasChildren = Boolean(item.children?.length);
              const open = openGroupId === item.id || active;
              const itemBase =
                "group relative flex items-center gap-3 rounded-[20px] border px-3 py-2.5 text-sm transition duration-200";
              const itemState = active
                ? "border-white/15 bg-white/[0.075] text-white shadow-[0_12px_34px_rgba(0,0,0,0.22)]"
                : "border-transparent text-white/56 hover:border-white/10 hover:bg-white/[0.045] hover:text-white";

              if (!hasChildren || compact) {
                return (
                  <AdminNavLink
                    key={item.id}
                    href={item.href}
                    title={compact ? item.label : undefined}
                    onNavigateStart={onNavigateStart}
                    className={[
                      itemBase,
                      compact ? "justify-center" : "justify-start",
                      itemState,
                    ].join(" ")}
                  >
                    {active && !compact ? (
                      <span
                        className="absolute right-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-l-full"
                        style={{ backgroundColor: "var(--admin-accent)" }}
                      />
                    ) : null}
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-2xl border bg-white/[0.035] font-en text-base"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--admin-accent) 18%, transparent)",
                        color: "var(--admin-accent)",
                      }}
                    >
                      {item.icon}
                    </span>
                    {!compact ? <span className="truncate">{item.label}</span> : null}
                    {!compact && item.badge ? (
                      <span className="mr-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                        {item.badge}
                      </span>
                    ) : null}
                  </AdminNavLink>
                );
              }

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setGroupOverride({
                        pathname,
                        id: open ? null : item.id,
                      })
                    }
                    className={[itemBase, "w-full justify-between", itemState].join(" ")}
                    aria-expanded={open}
                  >
                    {active ? (
                      <span
                        className="absolute right-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-l-full"
                        style={{ backgroundColor: "var(--admin-accent)" }}
                      />
                    ) : null}
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-2xl border bg-white/[0.035] font-en text-base"
                        style={{
                          borderColor:
                            "color-mix(in srgb, var(--admin-accent) 18%, transparent)",
                          color: "var(--admin-accent)",
                        }}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className={["text-xs transition", open ? "rotate-180" : "text-white/30"].join(" ")}>⌄</span>
                  </button>

                  <div
                    className={[
                      "grid overflow-hidden transition-all duration-300",
                      open ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]",
                    ].join(" ")}
                  >
                    <div className="min-h-0 space-y-1 pr-11">
                      {item.children?.map((child) => {
                        const childActive = isAdminNavigationItemActive(
                          pathname,
                          child,
                        );
                        return (
                          <AdminNavLink
                            key={child.id}
                            href={child.href}
                            onNavigateStart={onNavigateStart}
                            className={[
                              "block rounded-2xl border px-3 py-2.5 text-sm transition duration-200",
                              childActive
                                ? "border-white/15 bg-white/[0.08] text-white"
                                : "border-transparent text-white/40 hover:border-white/10 hover:bg-white/[0.035] hover:text-white/75",
                            ].join(" ")}
                          >
                            {child.label}
                          </AdminNavLink>
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
            href={company.publicWebsiteUrl}
            className={[
              "flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-white/56 transition hover:bg-white/[0.06] hover:text-white",
              compact ? "justify-center" : "justify-start",
            ].join(" ")}
            title="الانتقال للموقع"
          >
            <span className="grid size-8 place-items-center rounded-2xl border border-white/10">↗</span>
            {!compact ? <span>الانتقال للموقع</span> : null}
          </Link>
        </div>
      </aside>
    );
  }

  const themeStyle = {
    "--admin-accent": company.accentColor,
    "--admin-accent-strong": company.accentStrongColor,
    "--admin-surface": company.surfaceColor,
  } as CSSProperties;

  return (
    <section
      dir="rtl"
      className="min-h-screen bg-[linear-gradient(180deg,var(--admin-surface)_0%,var(--admin-surface)_48%,#030407_100%)] text-white"
      style={themeStyle}
      data-admin-shell
      data-admin-shell-route={pathname}
      data-admin-navigation-pending={pendingHref ? "true" : "false"}
      data-admin-company-source={company.source}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-52 right-[-12%] h-[520px] w-[520px] rounded-full bg-[var(--admin-accent)]/10 blur-[140px]" />
        <div className="absolute bottom-[-22%] left-[-16%] h-[560px] w-[560px] rounded-full bg-[var(--admin-accent)]/5 blur-[160px]" />
      </div>

      <div className="relative flex min-h-screen flex-row items-start bg-transparent">
        <div className="sticky top-0 hidden h-screen shrink-0 bg-transparent lg:block">
          {renderSidebar()}
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="قائمة الإدارة">
            <button className="absolute inset-0 bg-black/76" onClick={() => setMobileState({ pathname, open: false })} aria-label="إغلاق القائمة" />
            <div className="absolute right-0 top-0 h-full">{renderSidebar(true)}</div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-7">
          <header className="admin-premium-card mb-5 rounded-[28px] p-4" data-admin-shell-header>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMobileState({ pathname, open: true })} className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-white/70 lg:hidden" aria-label="فتح القائمة">☰</button>
                <CompanyMark company={company} compact={false} />
                <div>
                  <p className="font-en text-[10px] tracking-[0.3em]" style={{ color: "var(--admin-accent)" }}>{company.cmsLabel}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{company.adminLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {pendingHref ? <span className="text-xs text-white/45" role="status">جارٍ الانتقال…</span> : null}
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" });
                    window.location.assign(company.publicWebsiteUrl);
                  }}
                  className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 transition hover:border-white/25 hover:text-white"
                >
                  خروج
                </button>
              </div>
            </div>
          </header>

          <div
            data-admin-route-content
            className="flex flex-col [&:has([data-admin-page-header])>[data-admin-fallback-header]]:hidden"
          >
            <div className="contents" data-admin-page-body>
              {children}
            </div>
            <div data-admin-fallback-header className="order-first mb-7">
              <AdminPageContextHeader
                eyebrow={company.cmsLabel}
                title={activeRouteItem?.label ?? company.adminLabel}
                description="إدارة هذا القسم من خلال نظام لوحة الإدارة الموحد."
                variant="minimal"
              />
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
