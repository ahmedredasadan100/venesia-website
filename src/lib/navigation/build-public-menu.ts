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

type SlugMaps = {
  topics: Map<number, string>;
  topicCategories: Map<number, string>;
  projects: Map<number, string>;
};

function uniqueIds(rows: MenuItemRow[], linkedType: string) {
  return Array.from(
    new Set(
      rows
        .filter((item) => item.linked_type === linkedType && item.linked_id)
        .map((item) => Number(item.linked_id)),
    ),
  );
}

export async function getSlugMaps(
  rows: MenuItemRow[],
  fetchSlugs: (table: "topics" | "topic_categories" | "projects", ids: number[]) => Promise<Map<number, string>>,
): Promise<SlugMaps> {
  const [topics, topicCategories, projects] = await Promise.all([
    fetchSlugs("topics", uniqueIds(rows, "topics")),
    fetchSlugs("topic_categories", uniqueIds(rows, "topic_categories")),
    fetchSlugs("projects", uniqueIds(rows, "projects")),
  ]);

  return { topics, topicCategories, projects };
}

function appendAnchor(href: string, anchor?: string | null) {
  const cleanAnchor = anchor?.trim().replace(/^#/, "");
  if (!cleanAnchor) return href;
  if (href === "#") return `#${cleanAnchor}`;
  return `${href.split("#")[0]}#${cleanAnchor}`;
}

function resolveHref(item: MenuItemRow, maps: SlugMaps) {
  if (item.item_type === "parent") return "#";

  let href = item.href?.trim() || "#";

  if (item.linked_type === "topics" && item.linked_id) {
    const slug = maps.topics.get(Number(item.linked_id));
    if (!slug) return null;
    href = `/topics/${slug}`;
  }

  if (item.linked_type === "topic_categories" && item.linked_id) {
    const slug = maps.topicCategories.get(Number(item.linked_id));
    if (!slug) return null;
    href = `/topics?category=${slug}`;
  }

  if (item.linked_type === "projects" && item.linked_id) {
    const slug = maps.projects.get(Number(item.linked_id));
    if (!slug) return null;
    href = `/projects/${slug}`;
  }

  return appendAnchor(href, item.anchor);
}

export function buildPublicMenuTree(
  rows: MenuItemRow[],
  maps: SlugMaps,
  parentId: number | null = null,
): PublicNavigationItem[] {
  return rows
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .flatMap((item) => {
      const children = buildPublicMenuTree(rows, maps, item.id);
      const href = resolveHref(item, maps);
      if (!href || (item.item_type === "parent" && children.length === 0)) return [];

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
