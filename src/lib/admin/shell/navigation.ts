import type { AdminNavigationItem } from "./contracts";

export function isAdminNavigationItemActive(
  pathname: string,
  item: AdminNavigationItem,
): boolean {
  if (item.href === "/admin") return pathname === item.href;
  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    item.children?.some((child) =>
      isAdminNavigationItemActive(pathname, child),
    ) === true
  );
}

export function resolveAdminNavigation(
  items: readonly AdminNavigationItem[],
): AdminNavigationItem[] {
  return items
    .filter((item) => item.enabled)
    .map((item) => ({
      ...item,
      children: item.children
        ? resolveAdminNavigation(item.children)
        : undefined,
    }))
    .sort((left, right) => left.order - right.order);
}
