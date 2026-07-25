import type { AdminNavigationItem } from "../../lib/admin/shell/contracts";

const currentAdminAccess = {
  capability: "admin.access",
  mode: "allow-current-admins",
} as const;

export const ADMIN_NAVIGATION_REGISTRY: AdminNavigationItem[] = [
  { id: "home", href: "/admin", label: "الرئيسية", icon: "⌂", order: 10, enabled: true, moduleKey: "dashboard", permission: currentAdminAccess },
  {
    id: "content", href: "/admin/content/topics", label: "المحتوى", icon: "✦", order: 20, enabled: true, moduleKey: "content", permission: currentAdminAccess,
    children: [
      { id: "topics", href: "/admin/content/topics", label: "الموضوعات", icon: "•", order: 10, enabled: true, moduleKey: "topics", permission: currentAdminAccess },
      { id: "categories", href: "/admin/content/categories", label: "التصنيفات", icon: "•", order: 20, enabled: true, moduleKey: "categories", permission: currentAdminAccess },
      { id: "series", href: "/admin/content/series", label: "سلاسل المحتوى", icon: "•", order: 30, enabled: true, moduleKey: "series", permission: currentAdminAccess },
      { id: "media-library", href: "/admin/media-library", label: "مكتبة الصور", icon: "▧", order: 40, enabled: true, moduleKey: "media-library", permission: currentAdminAccess },
    ],
  },
  {
    id: "projects", href: "/admin/projects", label: "المشروعات", icon: "▣", order: 30, enabled: true, moduleKey: "projects", permission: currentAdminAccess,
    children: [
      { id: "projects-all", href: "/admin/projects", label: "كل المشروعات", icon: "•", order: 10, enabled: true, moduleKey: "projects", permission: currentAdminAccess },
      { id: "construction-updates", href: "/admin/projects/construction-updates", label: "تحديثات التنفيذ", icon: "•", order: 20, enabled: true, moduleKey: "construction-updates", permission: currentAdminAccess },
    ],
  },
  {
    id: "pages-blocks", href: "/admin/pages-blocks/pages", label: "الصفحات والبلوكات", icon: "▤", order: 40, enabled: true, moduleKey: "pages-blocks", permission: currentAdminAccess,
    children: [
      { id: "pages", href: "/admin/pages-blocks/pages", label: "الصفحات", icon: "•", order: 10, enabled: true, moduleKey: "pages", permission: currentAdminAccess },
      { id: "blocks", href: "/admin/pages-blocks/blocks", label: "البلوكات", icon: "•", order: 20, enabled: true, moduleKey: "blocks", permission: currentAdminAccess },
      { id: "menus", href: "/admin/pages-blocks/menus", label: "القوائم", icon: "•", order: 30, enabled: true, moduleKey: "menus", permission: currentAdminAccess },
      { id: "footer", href: "/admin/pages-blocks/footer", label: "الفوتر", icon: "•", order: 40, enabled: true, moduleKey: "footer", permission: currentAdminAccess },
    ],
  },
  {
    id: "seo", href: "/admin/seo/meta-manager", label: "تحسين محركات البحث", icon: "◎", order: 50, enabled: true, moduleKey: "seo", permission: currentAdminAccess,
    children: [
      { id: "seo-meta", href: "/admin/seo/meta-manager", label: "إعدادات السيو العامة", icon: "•", order: 10, enabled: true, moduleKey: "seo-meta", permission: currentAdminAccess },
      { id: "seo-redirects", href: "/admin/seo/redirects", label: "Redirects", icon: "•", order: 20, enabled: true, moduleKey: "seo-redirects", permission: currentAdminAccess },
      { id: "seo-sitemap", href: "/admin/seo/sitemap", label: "Sitemap", icon: "•", order: 30, enabled: true, moduleKey: "seo-sitemap", permission: currentAdminAccess },
    ],
  },
  { id: "users", href: "/admin/users-roles", label: "المستخدمون والصلاحيات", icon: "◌", order: 60, enabled: true, moduleKey: "users", permission: currentAdminAccess },
  {
    id: "settings", href: "/admin/settings/general", label: "الإعدادات", icon: "⚙", order: 70, enabled: true, moduleKey: "settings", permission: currentAdminAccess,
    children: [
      { id: "settings-general", href: "/admin/settings/general", label: "إعدادات عامة", icon: "•", order: 10, enabled: true, moduleKey: "settings-general", permission: currentAdminAccess },
      { id: "settings-security", href: "/admin/settings/security", label: "الأمان", icon: "•", order: 20, enabled: true, moduleKey: "settings-security", permission: currentAdminAccess },
      { id: "settings-theme", href: "/admin/settings/theme", label: "الثيم", icon: "•", order: 30, enabled: true, moduleKey: "settings-theme", permission: currentAdminAccess },
      { id: "settings-appearance", href: "/admin/settings/appearance", label: "المظهر", icon: "•", order: 40, enabled: true, moduleKey: "settings-appearance", permission: currentAdminAccess },
      { id: "settings-integrations", href: "/admin/settings/integrations", label: "التكاملات", icon: "•", order: 50, enabled: true, moduleKey: "settings-integrations", permission: currentAdminAccess },
      { id: "settings-media", href: "/admin/settings/media", label: "إعدادات الميديا", icon: "•", order: 60, enabled: true, moduleKey: "settings-media", permission: currentAdminAccess },
    ],
  },
  {
    id: "reports", href: "/admin/reports", label: "التقارير", icon: "◒", order: 80, enabled: true, moduleKey: "reports", permission: currentAdminAccess,
    children: [
      { id: "reports-media-quality", href: "/admin/reports/topics-without-image", label: "موضوعات بلا صورة", icon: "•", order: 10, enabled: true, moduleKey: "reports-media-quality", permission: currentAdminAccess },
    ],
  },
  { id: "activity", href: "/admin/activity-log", label: "سجل النشاط", icon: "☷", order: 90, enabled: true, moduleKey: "activity", permission: currentAdminAccess },
];
