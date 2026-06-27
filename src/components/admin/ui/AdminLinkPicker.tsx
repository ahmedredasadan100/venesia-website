"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  browseAdminLinksAjax,
  browseMenuItemsPickerAjax,
  browseMenusPickerAjax,
  browseTopicCategoriesPickerAjax,
  resolveAdminLinkAjax,
  type PickerMenuItemRow,
  type PickerMenuSummary,
} from "../../../lib/admin/links/actions";
import { menuItemToAdminLink } from "../../../lib/admin/links/menu-bridge";
import { adminLinkFromSearchResult } from "../../../lib/admin/links/serialize";
import { pushRecentAdminLink, readRecentAdminLinks } from "../../../lib/admin/links/recent";
import type { AdminLinkDisplay, AdminLinkValue, LinkSearchResult, LinkedResourceType } from "../../../lib/admin/links/types";
import { AdminMediaPickerModal } from "../media";
import {
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../VenesiaModal";
import VenesiaModal from "../VenesiaModal";

type ExplorerResourceId =
  | LinkedResourceType
  | "menus"
  | "external"
  | "anchor"
  | "download";

type AdminLinkPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (value: AdminLinkValue) => void;
  initialValue?: AdminLinkValue;
};

const RESOURCE_SIDEBAR: Array<{ id: ExplorerResourceId; label: string }> = [
  { id: "pages", label: "Pages" },
  { id: "menus", label: "Menus" },
  { id: "projects", label: "Projects" },
  { id: "topics", label: "Topics" },
  { id: "topic_categories", label: "Categories" },
  { id: "topic_series", label: "Series" },
  { id: "media_items", label: "Media" },
  { id: "static_routes", label: "Static Routes" },
  { id: "external", label: "External" },
  { id: "anchor", label: "Anchor" },
  { id: "download", label: "Download" },
];

const RESOURCE_LABELS: Record<LinkedResourceType, string> = {
  pages: "صفحة",
  projects: "مشروع",
  topics: "موضوع",
  topic_categories: "تصنيف",
  topic_series: "سلسلة",
  media_items: "وسيط",
  static_routes: "مسار ثابت",
};

const BROWSEABLE_TYPES = new Set<LinkedResourceType>([
  "pages",
  "projects",
  "topics",
  "topic_series",
  "media_items",
  "static_routes",
]);

function defaultResourceForValue(value: AdminLinkValue | undefined): ExplorerResourceId {
  if (!value || value.link_kind === "none") return "pages";
  if (value.link_kind === "anchor") return "anchor";
  if (value.link_kind === "download") return "download";
  if (value.link_kind === "external" || value.link_kind === "email" || value.link_kind === "phone") return "external";
  if (value.link_kind === "static_route") return "static_routes";
  if (value.link_kind === "internal" && value.linked_type) return value.linked_type;
  return "pages";
}

function isFormResource(resource: ExplorerResourceId) {
  return resource === "external" || resource === "anchor" || resource === "download";
}

function menuItemIsSelectable(item: PickerMenuItemRow) {
  if (item.item_type === "parent") return false;
  const link = menuItemToAdminLink(item);
  return link.link_kind !== "none";
}

export default function AdminLinkPicker({ open, onClose, onSelect, initialValue }: AdminLinkPickerProps) {
  const [resource, setResource] = useState<ExplorerResourceId>(() => defaultResourceForValue(initialValue));
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LinkSearchResult[]>([]);
  const [menus, setMenus] = useState<PickerMenuSummary[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<PickerMenuItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLink, setPendingLink] = useState<AdminLinkValue | null>(null);
  const [preview, setPreview] = useState<AdminLinkDisplay | null>(null);
  const [recentLinks] = useState<AdminLinkValue[]>(() => readRecentAdminLinks());

  const [externalHref, setExternalHref] = useState(() => {
    if (
      initialValue?.link_kind === "external" ||
      initialValue?.link_kind === "email" ||
      initialValue?.link_kind === "phone"
    ) {
      return initialValue.href ?? "https://";
    }
    return "https://";
  });
  const [externalTarget, setExternalTarget] = useState<"_self" | "_blank">(
    initialValue?.target === "_blank" ? "_blank" : "_blank",
  );
  const [externalMode, setExternalMode] = useState<"https" | "http" | "mailto" | "tel">(() => {
    if (initialValue?.link_kind === "email") return "mailto";
    if (initialValue?.link_kind === "phone") return "tel";
    if (initialValue?.href?.startsWith("http://")) return "http";
    return "https";
  });

  const [anchorValue, setAnchorValue] = useState(
    () => initialValue?.anchor ?? initialValue?.href?.replace(/^#/, "") ?? "",
  );
  const [downloadHref, setDownloadHref] = useState(
    () => (initialValue?.link_kind === "download" ? initialValue.href ?? "" : ""),
  );
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const selectedMenu = useMemo(
    () => menus.find((menu) => menu.id === selectedMenuId) ?? null,
    [menus, selectedMenuId],
  );

  const filteredMenus = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return menus;
    return menus.filter((menu) =>
      [menu.name, menu.location].some((part) => part.toLowerCase().includes(normalized)),
    );
  }, [menus, query]);

  const resetBrowseState = useCallback(() => {
    setQuery("");
    setItems([]);
    setMenus([]);
    setSelectedMenuId(null);
    setMenuItems([]);
    setError(null);
  }, []);

  const updatePreview = useCallback(async (link: AdminLinkValue | null) => {
    if (!link || link.link_kind === "none") {
      setPreview(null);
      return;
    }
    const response = await resolveAdminLinkAjax(link);
    if (response.ok) setPreview(response.display);
  }, []);

  const loadBrowseItems = useCallback(async () => {
    if (!open || isFormResource(resource)) return;

    setLoading(true);
    setError(null);

    if (resource === "menus") {
      if (!selectedMenuId) {
        const response = await browseMenusPickerAjax();
        setLoading(false);
        if (!response.ok) {
          setError(response.message);
          setMenus([]);
          return;
        }
        setMenus(response.menus);
        return;
      }

      const response = await browseMenuItemsPickerAjax({ menuId: selectedMenuId, query });
      setLoading(false);
      if (!response.ok) {
        setError(response.message);
        setMenuItems([]);
        return;
      }
      setMenuItems(response.items);
      return;
    }

    if (resource === "topic_categories") {
      const response = await browseTopicCategoriesPickerAjax({ query });
      setLoading(false);
      if (!response.ok) {
        setError(response.message);
        setItems([]);
        return;
      }
      setItems(response.items);
      return;
    }

    if (BROWSEABLE_TYPES.has(resource)) {
      const response = await browseAdminLinksAjax({ type: resource, query, limit: 100 });
      setLoading(false);
      if (!response.ok) {
        setError(response.message);
        setItems([]);
        return;
      }
      setItems(response.results);
    }

    setLoading(false);
  }, [open, resource, query, selectedMenuId]);

  useEffect(() => {
    if (!open || isFormResource(resource)) return;

    if (resource === "menus" && !selectedMenuId) {
      void loadBrowseItems();
      return;
    }

    const timer = window.setTimeout(() => {
      void loadBrowseItems();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, resource, selectedMenuId, query, loadBrowseItems]);

  useEffect(() => {
    if (!open) return;
    resetBrowseState();
    setResource(defaultResourceForValue(initialValue));
    setPendingLink(null);
    setPreview(null);
  }, [open, initialValue, resetBrowseState]);

  useEffect(() => {
    if (!open || !isFormResource(resource)) return;

    if (resource === "external") {
      void updatePreview(buildExternalLink());
      return;
    }
    if (resource === "anchor") {
      const anchor = anchorValue.trim().replace(/^#/, "");
      void updatePreview(
        anchor ? { link_kind: "anchor", href: `#${anchor}`, anchor, target: "_self" } : null,
      );
      return;
    }
    if (resource === "download") {
      const href = downloadHref.trim();
      void updatePreview(href ? { link_kind: "download", href, target: "_blank" } : null);
    }
  }, [open, resource, externalHref, externalMode, externalTarget, anchorValue, downloadHref, updatePreview]);

  function handleResourceChange(next: ExplorerResourceId) {
    setResource(next);
    setPendingLink(null);
    setPreview(null);
    setQuery("");
    setItems([]);
    setMenus([]);
    setSelectedMenuId(null);
    setMenuItems([]);
    setError(null);
  }

  function handleSelectBrowseResult(result: LinkSearchResult) {
    const link = adminLinkFromSearchResult(result);
    setPendingLink(link);
    void updatePreview(link);
  }

  function handleSelectMenuItem(item: PickerMenuItemRow) {
    if (!menuItemIsSelectable(item)) return;
    const link = menuItemToAdminLink(item);
    setPendingLink(link);
    void updatePreview(link);
  }

  function buildExternalLink(): AdminLinkValue | null {
    const href = externalHref.trim();
    if (!href) return null;

    if (externalMode === "mailto") {
      const normalized = href.startsWith("mailto:") ? href : `mailto:${href}`;
      return { link_kind: "email", href: normalized, target: "_self" };
    }

    if (externalMode === "tel") {
      const normalized = href.startsWith("tel:") ? href : `tel:${href}`;
      return { link_kind: "phone", href: normalized, target: "_self" };
    }

    const normalized =
      href.startsWith("http://") || href.startsWith("https://")
        ? href
        : `https://${href.replace(/^\/+/, "")}`;
    return { link_kind: "external", href: normalized, target: externalTarget };
  }

  function resolvePendingLink(): AdminLinkValue | null {
    if (isFormResource(resource)) {
      if (resource === "external") return buildExternalLink();
      if (resource === "anchor") {
        const anchor = anchorValue.trim().replace(/^#/, "");
        if (!anchor) return null;
        return { link_kind: "anchor", href: `#${anchor}`, anchor, target: "_self" };
      }
      if (resource === "download") {
        const href = downloadHref.trim();
        if (!href) return null;
        return { link_kind: "download", href, target: "_blank" };
      }
    }
    return pendingLink;
  }

  function confirmSelection() {
    const link = resolvePendingLink();
    if (!link || link.link_kind === "none") {
      setError("اختر عنصرًا أو أكمل بيانات الرابط.");
      return;
    }
    pushRecentAdminLink(link);
    onSelect(link);
    onClose();
  }

  function renderBrowseItem(result: LinkSearchResult) {
    const selected =
      pendingLink?.link_kind === "internal" &&
      pendingLink.linked_type === result.resourceType &&
      pendingLink.linked_id === result.resourceId;

    const isStatic =
      result.resourceType === "static_routes" &&
      pendingLink?.link_kind === "static_route" &&
      pendingLink.meta?.route_key === result.meta?.route_key;

    const isActive = selected || isStatic;

    return (
      <button
        key={result.id}
        type="button"
        onClick={() => handleSelectBrowseResult(result)}
        className={`block w-full rounded-xl border px-3 py-2.5 text-right transition ${
          isActive
            ? "border-[#D8B87A]/35 bg-[#D8B87A]/10"
            : "border-white/8 bg-[#05070B] hover:border-[#D8B87A]/25 hover:bg-[#D8B87A]/5"
        }`}
        style={{ marginInlineStart: `${(result.level ?? 0) * 18}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{result.title}</p>
            {result.subtitle ? <p className="mt-0.5 text-xs text-white/45">{result.subtitle}</p> : null}
            <p className="mt-1 truncate font-en text-[11px] text-[#D8B87A]/75" dir="ltr">
              {result.publicPath}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-white/55">
            {RESOURCE_LABELS[result.resourceType as LinkedResourceType] ?? result.resourceType}
          </span>
        </div>
      </button>
    );
  }

  function renderItemsPanel() {
    if (isFormResource(resource)) {
      if (resource === "external") {
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["https", "http", "mailto", "tel"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setExternalMode(mode);
                    if (mode === "mailto") setExternalHref("mailto:");
                    else if (mode === "tel") setExternalHref("tel:");
                    else setExternalHref(`${mode}://`);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    externalMode === mode ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "bg-white/5 text-white/50"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <label className={adminFormLabelClassName()}>
              <span>الرابط</span>
              <input
                value={externalHref}
                onChange={(event) => setExternalHref(event.target.value)}
                dir="ltr"
                className={adminFormFieldClassName("text-left font-en")}
              />
            </label>
            {externalMode === "https" || externalMode === "http" ? (
              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                <span>فتح في تبويب جديد</span>
                <input
                  type="checkbox"
                  checked={externalTarget === "_blank"}
                  onChange={(event) => setExternalTarget(event.target.checked ? "_blank" : "_self")}
                />
              </label>
            ) : null}
          </div>
        );
      }

      if (resource === "anchor") {
        return (
          <label className={adminFormLabelClassName()}>
            <span>Anchor ID</span>
            <input
              value={anchorValue}
              onChange={(event) => setAnchorValue(event.target.value)}
              placeholder="section-id"
              dir="ltr"
              className={adminFormFieldClassName("text-left font-en")}
            />
            <span className={adminFormHintClassName()}>يُستخدم للانتقال إلى عنصر داخل نفس الصفحة.</span>
          </label>
        );
      }

      return (
        <div className="space-y-4">
          <label className={adminFormLabelClassName()}>
            <span>ملف التنزيل</span>
            <div className="flex flex-wrap gap-2">
              <input
                value={downloadHref}
                readOnly
                placeholder="/files/projects/brochure.pdf"
                dir="ltr"
                className={adminFormFieldClassName("min-w-0 flex-1 text-left font-en")}
              />
              <button
                type="button"
                onClick={() => setMediaPickerOpen(true)}
                className="rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A]/12 px-4 py-2 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/18"
              >
                اختر من المكتبة
              </button>
            </div>
          </label>
          <AdminMediaPickerModal
            open={mediaPickerOpen}
            onClose={() => setMediaPickerOpen(false)}
            onSelect={(path) => {
              setDownloadHref(path);
              setMediaPickerOpen(false);
            }}
            initialFolder="files"
            mode="pdf"
          />
        </div>
      );
    }

    if (resource === "menus") {
      if (!selectedMenuId) {
        return (
          <div className="space-y-2">
            {filteredMenus.map((menu) => (
              <button
                key={menu.id}
                type="button"
                onClick={() => {
                  setSelectedMenuId(menu.id);
                  setQuery("");
                  setMenuItems([]);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-[#05070B] px-4 py-3 text-right transition hover:border-[#D8B87A]/25 hover:bg-[#D8B87A]/5"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{menu.name}</p>
                  <p className="mt-1 text-xs text-white/45">{menu.location}</p>
                </div>
                <span className="text-xs text-[#D8B87A]/70">→</span>
              </button>
            ))}
            {!loading && !filteredMenus.length ? <p className="text-sm text-white/45">لا توجد قوائم.</p> : null}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          {menuItems.map((item) => {
            const selectable = menuItemIsSelectable(item);
            const link = menuItemToAdminLink(item);
            const active =
              selectable &&
              pendingLink?.link_kind === link.link_kind &&
              pendingLink?.linked_type === link.linked_type &&
              pendingLink?.linked_id === link.linked_id &&
              pendingLink?.href === link.href;

            return (
              <button
                key={item.id}
                type="button"
                disabled={!selectable}
                onClick={() => handleSelectMenuItem(item)}
                className={`block w-full rounded-xl border px-3 py-2.5 text-right transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  active
                    ? "border-[#D8B87A]/35 bg-[#D8B87A]/10"
                    : "border-white/8 bg-[#05070B] hover:border-[#D8B87A]/25 hover:bg-[#D8B87A]/5"
                }`}
                style={{ marginInlineStart: `${item.level * 18}px` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 truncate font-en text-[11px] text-white/45" dir="ltr">
                      {item.href ?? (selectable ? "—" : "عنصر أب بدون رابط")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-white/55">
                    {item.is_visible ? "ظاهر" : "مخفي"}
                  </span>
                </div>
              </button>
            );
          })}
          {!loading && !menuItems.length ? <p className="text-sm text-white/45">لا توجد عناصر مطابقة.</p> : null}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((item) => renderBrowseItem(item))}
        {!loading && !items.length ? <p className="text-sm text-white/45">لا توجد عناصر في هذا المورد.</p> : null}
      </div>
    );
  }

  const searchPlaceholder =
    resource === "menus"
      ? selectedMenuId
        ? "ابحث داخل عناصر هذه القائمة..."
        : "ابحث باسم القائمة..."
      : `ابحث داخل ${RESOURCE_SIDEBAR.find((item) => item.id === resource)?.label ?? "المورد"}...`;

  const showSearch = !isFormResource(resource);

  return (
    <VenesiaModal
      open={open}
      title="اختيار رابط"
      description="اختر نوع المورد ثم العنصر — Browse CMS Resources."
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-4">
          <section className="rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/5 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8B87A]/70">معاينة</p>
            {preview ? (
              <>
                <p className="mt-2 text-sm font-semibold text-white">{preview.title}</p>
                <p className="mt-1 text-xs text-white/50">{preview.kindLabel}</p>
                <p className="mt-2 truncate font-en text-xs text-white/70" dir="ltr">
                  {preview.publicPath}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/45">اختر عنصرًا لعرض المعاينة.</p>
            )}
          </section>
          <div className="flex flex-wrap justify-end gap-3">
            <AdminModalCancelButton onClick={onClose}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="button" onClick={confirmSelection}>
              اعتماد الرابط
            </AdminModalPrimaryButton>
          </div>
        </div>
      }
    >
      <div className="flex h-[min(520px,62vh)] min-h-[420px] flex-col gap-4 overflow-hidden">
        {error ? (
          <p className="shrink-0 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/8 bg-[#05070B]/80 p-2">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Resource Types</p>
            <div className="space-y-1">
              {RESOURCE_SIDEBAR.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleResourceChange(item.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-right text-sm font-semibold transition ${
                    resource === item.id
                      ? "bg-[#D8B87A]/15 text-[#D8B87A] ring-1 ring-[#D8B87A]/30"
                      : "text-white/60 hover:bg-white/5 hover:text-white/85"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#05070B]/50">
            {showSearch ? (
              <div className="shrink-0 space-y-2 border-b border-white/8 p-3">
                {resource === "menus" && selectedMenu ? (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMenuId(null);
                        setMenuItems([]);
                        setQuery("");
                        setPendingLink(null);
                        setPreview(null);
                      }}
                      className="text-xs font-semibold text-[#D8B87A] hover:underline"
                    >
                      ← كل القوائم
                    </button>
                    <p className="truncate text-xs text-white/50">{selectedMenu.name}</p>
                  </div>
                ) : null}
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className={adminFormFieldClassName()}
                />
                <p className={adminFormHintClassName()}>
                  البحث داخل{" "}
                  {resource === "menus"
                    ? selectedMenu
                      ? `عناصر «${selectedMenu.name}»`
                      : "القوائم"
                    : RESOURCE_SIDEBAR.find((item) => item.id === resource)?.label}{" "}
                  فقط.
                </p>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? <p className="text-sm text-white/45">جاري التحميل...</p> : renderItemsPanel()}
            </div>

            {recentLinks.length && !isFormResource(resource) ? (
              <div className="shrink-0 border-t border-white/8 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">روابط حديثة</p>
                <div className="flex flex-wrap gap-2">
                  {recentLinks.slice(0, 4).map((link) => (
                    <button
                      key={`${link.link_kind}-${link.linked_type}-${link.linked_id}-${link.href}`}
                      type="button"
                      onClick={() => {
                        setPendingLink(link);
                        void updatePreview(link);
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
                    >
                      {link.linked_type ?? link.link_kind}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </VenesiaModal>
  );
}

export { emptyAdminLink } from "../../../lib/admin/links/serialize";
