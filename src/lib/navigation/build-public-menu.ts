import type { PublicNavigationItem } from "../public-navigation";

export type MenuItemRow = {
  id: number;
  parent_id: number | null;
  label: string;
  item_type: string;
  href: string | null;
  linked_type: string | null;
  linked_id: number | null;
  anchor: string | null;
  target: "_self" | "_blank" | string | null;
  css_class: string | null;
  style_preset: string | null;
  is_visible: boolean;
  sort_order: number | null;
};

export type NavigationTargetTable = "topics" | "topic_categories" | "projects" | "pages" | "topic_series";
export type PublicNavigationTargetMaps = Record<NavigationTargetTable, Map<number, string>>;

function uniqueIds(rows: MenuItemRow[], linkedType: string) {
  return Array.from(
    new Set(
      rows
        .filter((item) => item.linked_type === linkedType && item.linked_id)
        .map((item) => Number(item.linked_id)),
    ),
  );
}

export async function getNavigationTargetMaps(
  rows: MenuItemRow[],
  fetchPaths: (table: NavigationTargetTable, ids: number[]) => Promise<Map<number, string>>,
): Promise<PublicNavigationTargetMaps> {
  const [topics, topicCategories, projects, pages, topicSeries] = await Promise.all([
    fetchPaths("topics", uniqueIds(rows, "topics")),
    fetchPaths("topic_categories", uniqueIds(rows, "topic_categories")),
    fetchPaths("projects", uniqueIds(rows, "projects")),
    fetchPaths("pages", uniqueIds(rows, "pages")),
    fetchPaths("topic_series", uniqueIds(rows, "topic_series")),
  ]);

  return { topics, topic_categories: topicCategories, projects, pages, topic_series: topicSeries };
}

function appendAnchor(href: string, anchor?: string | null) {
  const cleanAnchor = anchor?.trim().replace(/^#/, "");
  if (!cleanAnchor) return href;
  if (href === "#") return `#${cleanAnchor}`;
  return `${href.split("#")[0]}#${cleanAnchor}`;
}

function resolveHref(item: MenuItemRow, maps: PublicNavigationTargetMaps): string | null {
  if (item.item_type === "parent") return "#";

  let href = item.href?.trim() || "#";

  if (item.linked_type && Object.hasOwn(maps, item.linked_type)) {
    if (!item.linked_id) return null;
    const resolved = maps[item.linked_type as NavigationTargetTable].get(Number(item.linked_id));
    if (!resolved) return null;
    href = resolved;
  }

  return appendAnchor(href, item.anchor);
}

export function buildPublicMenuTree(
  rows: MenuItemRow[],
  maps: PublicNavigationTargetMaps,
  parentId: number | null = null,
): PublicNavigationItem[] {
  return rows
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .flatMap((item) => {
      const children = buildPublicMenuTree(rows, maps, item.id);
      const href = resolveHref(item, maps);
      if (href === null || (item.item_type === "parent" && children.length === 0)) {
        return [];
      }

      return [{
        id: item.id,
        label: item.label,
        href,
        target: item.target === "_blank" ? "_blank" : "_self",
        cssClass: item.css_class || undefined,
        stylePreset: item.style_preset || undefined,
        submenu: children.length ? children : undefined,
      }];
    });
}
