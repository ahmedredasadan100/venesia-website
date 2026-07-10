export type PublicNavigationItem = {
  id?: number;
  label: string;
  href: string;
  target?: "_self" | "_blank";
  cssClass?: string;
  stylePreset?: string;
  submenu?: PublicNavigationItem[];
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function flattenNavigationItems(items: readonly PublicNavigationItem[]): PublicNavigationItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.submenu ? flattenNavigationItems(item.submenu) : []),
  ]);
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";

  const cleanPath = pathname.split("?")[0].split("#")[0];
  const withoutTrailingSlash = cleanPath.replace(/\/+$/, "");

  return withoutTrailingSlash || "/";
}

function getDynamicLabel(pathname: string) {
  if (pathname.startsWith("/projects/")) return "تفاصيل المشروع";
  if (pathname.startsWith("/topics/")) return "تفاصيل الموضوع";
  if (pathname.startsWith("/media-center/news/")) return "تفاصيل الخبر";
  if (pathname.startsWith("/media-center/press/")) return "تفاصيل البيان الصحفي";
  if (pathname.startsWith("/media-center/videos/")) return "تفاصيل الفيديو";
  if (pathname.startsWith("/media-center/gallery/")) return "تفاصيل الصورة";
  if (pathname.startsWith("/media-center/site-updates/")) return "تفاصيل التحديث";

  return undefined;
}

export function getNavigationLabelFromItems(
  items: readonly PublicNavigationItem[],
  pathname: string,
) {
  const normalizedPath = normalizePath(pathname);

  return (
    flattenNavigationItems(items).find(
      (item) => normalizePath(item.href) === normalizedPath,
    )?.label ?? getDynamicLabel(normalizedPath)
  );
}

export function buildBreadcrumbsFromNavigation(
  pathname: string,
  items: readonly PublicNavigationItem[],
): BreadcrumbItem[] {
  const normalizedPath = normalizePath(pathname);
  const homeLabel = getNavigationLabelFromItems(items, "/") ?? "الرئيسية";

  if (normalizedPath === "/") {
    return [{ label: homeLabel }];
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: homeLabel, href: "/" }];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label = getNavigationLabelFromItems(items, href) ?? segment;
    const isLast = index === segments.length - 1;

    breadcrumbs.push(isLast ? { label } : { label, href });
  });

  return breadcrumbs;
}
