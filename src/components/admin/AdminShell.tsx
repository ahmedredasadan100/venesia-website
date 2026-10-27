"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type {
  AdminNavigationItem,
  ResolvedAdminCompanyConfig,
} from "../../lib/admin/shell/contracts";
import { isAdminNavigationItemActive } from "../../lib/admin/shell/navigation";
import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../venesia-scrollbar-styles";
import AdminPageContextHeader from "./ui/AdminPageContextHeader";
import AdminPageExperience from "./ui/AdminPageExperience";
import { cleanupTopicDraftStorage } from "../../lib/admin/content/topic-revision";
import { ADMIN_CINEMATIC_GOLD_V1, ADMIN_SIDEBAR } from "../../lib/admin/admin-ui-styles";
import { useAdminFloatingMenuPosition } from "./ui/useAdminFloatingMenuPosition";

type AdminShellProps = {
  children: ReactNode;
  company: ResolvedAdminCompanyConfig;
  navigation: AdminNavigationItem[];
  /** System header presentation is independent of the shared Sidebar default. */
  headerPresentation?: "default" | "cinematic";
};

type AdminNavLinkProps = {
  href: string;
  className: string;
  title?: string;
  ariaLabel?: string;
  active?: boolean;
  itemId?: string;
  child?: boolean;
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
  ariaLabel,
  active = false,
  itemId,
  child = false,
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
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      data-admin-nav-item={child ? undefined : itemId}
      data-admin-nav-child={child ? itemId : undefined}
      data-admin-nav-active={active ? "true" : "false"}
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
  cinematic = false,
}: {
  company: ResolvedAdminCompanyConfig;
  compact: boolean;
  cinematic?: boolean;
}) {
  const source = compact
    ? company.compactLogoUrl || company.logoUrl
    : company.logoUrl;
  const fallback = company.name.trim().slice(0, 2).toUpperCase() || "AD";

  return (
    <span
      className={cinematic ? ADMIN_CINEMATIC_GOLD_V1.system.logo : "grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border text-xs font-bold"}
      style={cinematic ? undefined : {
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
  headerPresentation = "default",
}: AdminShellProps) {
  const pathname = usePathname();
  const cinematicHeader = headerPresentation === "cinematic";
  const headerStyles = ADMIN_CINEMATIC_GOLD_V1.system;
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
  const [compactGroupState, setCompactGroupState] = useState<{
    pathname: string;
    id: string | null;
  } | null>(null);
  const mobileDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const compactTriggerRef = useRef<HTMLButtonElement | null>(null);
  const compactPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileOpen = mobileState.pathname === pathname && mobileState.open;
  const compactGroupId = collapsed && compactGroupState?.pathname === pathname
    ? compactGroupState.id
    : null;
  const compactMenuPosition = useAdminFloatingMenuPosition(
    compactGroupId !== null,
    compactTriggerRef,
    {
      minWidth: 240,
      preferredWidth: 240,
      align: "right",
      offset: 8,
      collisionPadding: 12,
      estimatedHeight: 420,
      floatingRef: compactPanelRef,
      zIndex: 60,
    },
  );
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
    // A child sharing its parent's landing URL owns the current-page marker.
    const candidates = navigation.flatMap((item) => [
      ...(item.children ?? []),
      item,
    ]);
    return candidates
      .filter((item) => isAdminNavigationItemActive(pathname, { ...item, children: undefined }))
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
    setCompactGroupState(null);
    window.localStorage.setItem(collapseKey, String(!collapsed));
    window.dispatchEvent(new Event(ADMIN_SHELL_COLLAPSE_EVENT));
  }

  const onNavigateStart = useCallback((href: string) => {
    setPendingNavigation({ pathname, href });
    setMobileState({ pathname, open: false });
    setCompactGroupState(null);
  }, [pathname]);

  useEffect(() => {
    if (!compactGroupId) return;
    const trigger = compactTriggerRef.current;
    const group = trigger?.closest("[data-admin-nav-group]");
    function closeOnOutside(event: Event) {
      if (event.target instanceof Node && !group?.contains(event.target)) {
        setCompactGroupState(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setCompactGroupState(null);
      trigger?.focus({ preventScroll: true });
    }
    const frame = window.requestAnimationFrame(() => {
      compactPanelRef.current?.querySelector<HTMLElement>('[aria-current="page"], a[href]')?.focus({ preventScroll: true });
    });
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("focusin", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("focusin", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [compactGroupId]);

  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = mobileDialogRef.current;
    const returnTarget = mobileTriggerRef.current;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    function closeAtDesktop(event: MediaQueryListEvent) {
      if (event.matches) setMobileState({ pathname, open: false });
    }
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>("[data-admin-drawer-close]")?.focus({ preventScroll: true });
    });
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileState({ pathname, open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'))
        .filter((element) => element.tabIndex >= 0 && !element.closest("[inert], [hidden]") && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", closeAtDesktop);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected && returnTarget.getClientRects().length > 0) {
          returnTarget.focus({ preventScroll: true });
        } else {
          document.querySelector<HTMLElement>('[data-admin-sidebar-mode]:not([data-admin-sidebar-mode="drawer"]) [data-admin-nav-active="true"], [data-admin-sidebar-mode]:not([data-admin-sidebar-mode="drawer"]) button')?.focus({ preventScroll: true });
        }
      });
    };
  }, [mobileOpen, pathname]);

  function renderSidebar(forceExpanded = false) {
    const compact = forceExpanded ? false : collapsed;
    const styles = ADMIN_SIDEBAR;
    const scope = forceExpanded ? "mobile" : "desktop";
    return (
      <aside
        className={[
          styles.shell,
          forceExpanded ? "h-full" : "min-h-screen",
          compact ? "w-[92px]" : "w-[304px]",
        ].join(" ")}
        data-admin-navigation
        data-admin-sidebar-presentation="default-v2"
        data-admin-sidebar-mode={forceExpanded ? "drawer" : compact ? "collapsed" : "expanded"}
      >
        <div className={[styles.identity, compact ? "flex-col justify-center" : "pl-12"].join(" ")}>
          <CompanyMark company={company} compact={compact} />
          {!compact ? (
            <div className="min-w-0 flex-1">
              <p className={styles.brand}>{company.cmsLabel}</p>
              <p className={styles.company}>{company.name}</p>
            </div>
          ) : null}
          {!forceExpanded ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className={styles.toggle}
              style={compact ? { position: "static", transform: "none" } : undefined}
              aria-label={compact ? "فتح القائمة" : "طي القائمة"}
              aria-expanded={!compact}
            >
              {compact ? "‹" : "›"}
            </button>
          ) : (
            <button type="button" data-admin-drawer-close onClick={() => setMobileState({ pathname, open: false })} className={styles.toggle} aria-label="إغلاق قائمة الإدارة">×</button>
          )}
        </div>

        <nav className={`${styles.nav} ${forceExpanded ? "min-h-0 overflow-y-auto " : ""}${VENESIA_SCROLLBAR_VISUAL_CLASSES}`} aria-label="الإدارة">
          <div className={styles.items}>
            {navigation.map((item) => {
              const active = activeGroupIds.has(item.id);
              const hasChildren = Boolean(item.children?.length);
              const open = compact ? compactGroupId === item.id : openGroupId === item.id;
              const panelId = `admin-nav-${scope}-${item.id}`;
              const itemState = active ? styles.itemActive : styles.itemInactive;
              const iconState = active ? styles.iconActive : styles.iconInactive;

              if (!hasChildren) {
                return (
                  <AdminNavLink
                    key={item.id}
                    href={item.href}
                    title={compact ? item.label : undefined}
                    ariaLabel={compact ? item.label : undefined}
                    active={activeRouteItem?.id === item.id}
                    itemId={item.id}
                    onNavigateStart={onNavigateStart}
                    className={[
                      styles.item,
                      compact ? "justify-center" : "justify-start",
                      itemState,
                    ].join(" ")}
                  >
                    {active ? <span className={styles.indicator} aria-hidden="true" /> : null}
                    <span className={[styles.icon, iconState].join(" ")} aria-hidden="true">
                      {item.icon}
                    </span>
                    {!compact ? <span className={styles.label}>{item.label}</span> : <span className={styles.tooltip} aria-hidden="true">{item.label}</span>}
                    {!compact && item.badge ? (
                      <span className={styles.badge}>
                        {item.badge}
                      </span>
                    ) : null}
                  </AdminNavLink>
                );
              }

              return (
                <div key={item.id} className="relative" data-admin-nav-group={item.id} data-admin-nav-open={open ? "true" : "false"}>
                  <button
                    type="button"
                    onClick={(event) => {
                      if (compact) {
                        compactTriggerRef.current = event.currentTarget;
                        setCompactGroupState({ pathname, id: open ? null : item.id });
                        return;
                      }
                      setGroupOverride({
                        pathname,
                        id: open ? null : item.id,
                      });
                    }}
                    className={[styles.item, "w-full", compact ? "justify-center" : "justify-between", itemState].join(" ")}
                    data-admin-nav-item={item.id}
                    data-admin-nav-active={active ? "true" : "false"}
                    aria-label={compact ? item.label : undefined}
                    title={compact ? item.label : undefined}
                    aria-expanded={open}
                    aria-controls={panelId}
                  >
                    {active ? <span className={styles.indicator} aria-hidden="true" /> : null}
                    <span className={[styles.icon, iconState].join(" ")} aria-hidden="true">
                      {item.icon}
                    </span>
                    {!compact ? <><span className={styles.label}>{item.label}</span><span className={[styles.chevron, open ? "rotate-180" : ""].join(" ")} aria-hidden="true">⌄</span></> : <span className={styles.tooltip} aria-hidden="true">{item.label}</span>}
                  </button>

                  {(!compact || open) ? <div
                    id={panelId}
                    ref={compact ? compactPanelRef : undefined}
                    data-admin-nav-submenu={item.id}
                    hidden={!open}
                    className={[compact ? styles.compactSubmenu : styles.submenu, compact ? `overflow-y-auto ${!compactMenuPosition ? "invisible" : ""}` : ""].join(" ")}
                    style={compact ? compactMenuPosition?.style : undefined}
                  >
                    {compact ? <p className="px-3 pb-2 pt-1 text-xs font-semibold text-slate-300">{item.label}</p> : null}
                      {item.children?.map((child) => {
                        const childActive = activeRouteItem?.id === child.id;
                        return (
                          <AdminNavLink
                            key={child.id}
                            href={child.href}
                            active={childActive}
                            itemId={child.id}
                            child
                            onNavigateStart={onNavigateStart}
                            className={[
                              styles.child,
                              childActive ? styles.childActive : styles.childInactive,
                            ].join(" ")}
                          >
                            {childActive ? <span className={styles.indicator} aria-hidden="true" /> : null}
                            <span className={[styles.publicIcon, "size-7 border-slate-600/20 text-base"].join(" ")} aria-hidden="true">{child.icon}</span>
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                          </AdminNavLink>
                        );
                      })}
                  </div> : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div className={styles.footer}>
          <Link
            href={company.publicWebsiteUrl}
            className={[
              styles.publicLink,
              "relative",
              compact ? "justify-center" : "justify-start",
            ].join(" ")}
            title="الانتقال للموقع"
            aria-label={compact ? "الانتقال للموقع" : undefined}
          >
            <span className={styles.publicIcon} aria-hidden="true">↗</span>
            {!compact ? <span>الانتقال للموقع</span> : <span className={styles.tooltip} aria-hidden="true">الانتقال للموقع</span>}
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
        {/* Desktop navigation stretches with the document; the mobile drawer stays bounded. */}
        <div className="hidden shrink-0 self-stretch bg-transparent lg:flex">
          {renderSidebar()}
        </div>

        {mobileOpen ? (
          <div ref={mobileDialogRef} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="قائمة الإدارة" tabIndex={-1}>
            <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/76" onClick={() => setMobileState({ pathname, open: false })} aria-label="إغلاق القائمة" />
            <div className="absolute right-0 top-0 h-full bg-[var(--admin-surface)]">{renderSidebar(true)}</div>
          </div>
        ) : null}

        <main className="flex min-h-screen min-w-0 flex-1 flex-col gap-6 px-4 py-4 sm:px-6 lg:px-7" inert={mobileOpen}>
          <header className={cinematicHeader ? headerStyles.root : "admin-premium-card rounded-[28px] px-4 py-3"} data-admin-shell-header data-admin-shell-header-presentation={headerPresentation}>
            {cinematicHeader ? <><div className={headerStyles.light} aria-hidden="true" /><svg className={headerStyles.ribbon} viewBox="0 0 1200 80" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false"><path d="M-40 103C190 120 260 44 475 59S820 123 1030-20" stroke="currentColor" strokeWidth=".85" /><path d="M200 110C420-5 810 115 1040-12" stroke="currentColor" strokeWidth=".6" opacity=".4" /><path d="M-40 104C190 122 260 45 475 60S820 124 1030-20" stroke="currentColor" strokeWidth="4" opacity=".05" /></svg></> : null}
            <div className={cinematicHeader ? headerStyles.layout : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"}>
              <div className={cinematicHeader ? headerStyles.identity : "flex items-center gap-3"}>
                <button ref={mobileTriggerRef} type="button" onClick={() => setMobileState({ pathname, open: true })} className={cinematicHeader ? headerStyles.menu : "grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-2xl leading-none text-white/70 lg:hidden"} aria-label="فتح القائمة" aria-expanded={mobileOpen}>☰</button>
                <CompanyMark company={company} compact={false} cinematic={cinematicHeader} />
                <div>
                  <p className={cinematicHeader ? headerStyles.eyebrow : "font-en text-[10px] tracking-[0.3em]"} style={cinematicHeader ? undefined : { color: "var(--admin-accent)" }}>{company.cmsLabel}</p>
                  <p className={cinematicHeader ? headerStyles.title : "mt-1 text-2xl font-semibold text-white"}>{company.adminLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {pendingHref ? <span className="text-xs text-white/45" role="status">جارٍ الانتقال…</span> : null}
                <button
                  type="button"
                  onClick={async () => {
                    const response = await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" });
                    if (response.ok) {
                      try { cleanupTopicDraftStorage(window.localStorage); } catch { /* Storage may be unavailable in private or restricted sessions. */ }
                    }
                    window.location.assign(company.publicWebsiteUrl);
                  }}
                  className={cinematicHeader ? headerStyles.logout : "rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 transition hover:border-white/25 hover:text-white"}
                >
                  {cinematicHeader ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h10" /></svg> : null}
                  خروج
                </button>
              </div>
            </div>
          </header>

          <AdminPageExperience
            as="div"
            data-admin-route-content
            className="min-w-0 pb-10 [&:has([data-admin-page-header])>[data-admin-fallback-header]]:hidden [&>[data-admin-page-body]>:has(>[data-admin-page-header])]:contents [&>[data-admin-page-body]>:has(>[data-admin-page-header])>*]:!my-0"
          >
            <div className="contents" data-admin-page-body>
              {children}
            </div>
            <div data-admin-fallback-header className="order-first">
              <AdminPageContextHeader
                eyebrow={company.cmsLabel}
                title={activeRouteItem?.label ?? company.adminLabel}
                description="إدارة هذا القسم من خلال نظام لوحة الإدارة الموحد."
                variant="minimal"
              />
            </div>
          </AdminPageExperience>
          <footer
            data-admin-shell-footer
            className="mt-auto min-w-0 shrink-0 border-t border-white/10 py-5 text-center text-xs leading-6 text-white/45"
          >
            <bdi dir="ltr">© {new Date().getFullYear()} {company.name}.</bdi>{" "}
            <span>جميع الحقوق محفوظة.</span>
          </footer>
        </main>
      </div>
    </section>
  );
}
