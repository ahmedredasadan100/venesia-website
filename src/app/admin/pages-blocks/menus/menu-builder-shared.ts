export type Menu = {
  id: number;
  name: string;
  slug: string;
  location: string;
  is_active: boolean;
};

export type MenuItem = {
  id: number;
  menu_id: number;
  parent_id: number | null;
  label: string;
  item_type: string;
  href: string | null;
  linked_type: string | null;
  linked_id: number | null;
  anchor: string | null;
  target: string;
  css_class: string | null;
  style_preset: string | null;
  is_visible: boolean;
  sort_order: number;
  updated_at: string;
};

export type TreeMenuItem = MenuItem & { children: TreeMenuItem[] };

export type ReferenceOption = {
  id: number;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
};

export type MenuReferences = {
  topics: ReferenceOption[];
  categories: ReferenceOption[];
  projects: ReferenceOption[];
};

export type FlatMenuItemRow = {
  item: MenuItem;
  level: number;
  parentLabel: string | null;
  isLastSibling: boolean;
  /** Tree gutter prefix for hierarchy display (e.g. ├── / └──). */
  treePrefix: string;
  /** Per ancestor depth: true when a vertical guide should continue downward. */
  ancestorLines: boolean[];
};

export const MENU_PAGE_OPTIONS = [
  { label: "الرئيسية", href: "/" },
  { label: "من نحن", href: "/about" },
  { label: "مشروعاتنا", href: "/projects" },
  { label: "تابع مشروعك", href: "/track-your-project" },
  { label: "موضوعات تهمك", href: "/topics" },
  { label: "المركز الإعلامي", href: "/media-center" },
  { label: "الأخبار", href: "/media-center/news" },
  { label: "من أرض التنفيذ", href: "/media-center/site-updates" },
  { label: "الفيديوهات", href: "/media-center/videos" },
  { label: "البيانات الصحفية", href: "/media-center/press" },
  { label: "معرض الصور", href: "/media-center/gallery" },
  { label: "تواصل معنا", href: "/contact" },
] as const;

export function menuFieldClassName(extra = "") {
  return [
    "admin-select min-h-11 rounded-2xl border border-white/10 bg-[#0B0F16] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D8B87A]/45 focus:bg-[#111722]",
    extra,
  ].join(" ");
}

export function menuLabelClassName() {
  return "space-y-2 text-xs font-medium text-white/48";
}

export function buildMenuTree(items: MenuItem[], parentId: number | null = null): TreeMenuItem[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({ ...item, children: buildMenuTree(items, item.id) }));
}

function buildTreePrefix(ancestors: boolean[], isLast: boolean) {
  if (ancestors.length === 0) return "";

  let prefix = "";
  for (const hasSiblingBelow of ancestors) {
    prefix += hasSiblingBelow ? "│   " : "    ";
  }
  prefix += isLast ? "└── " : "├── ";
  return prefix;
}

export function flattenMenuTree(
  items: TreeMenuItem[],
  level = 0,
  parentLabel: string | null = null,
  ancestors: boolean[] = [],
): FlatMenuItemRow[] {
  return items.flatMap((item, index) => {
    const isLastSibling = index === items.length - 1;
    const treePrefix = buildTreePrefix(ancestors, isLastSibling);
    const row: FlatMenuItemRow = {
      item,
      level,
      parentLabel,
      isLastSibling,
      treePrefix,
      ancestorLines: [...ancestors],
    };

    return [row, ...flattenMenuTree(item.children, level + 1, item.label, [...ancestors, !isLastSibling])];
  });
}

export function getMenuItemTypeLabel(type: string) {
  const labels: Record<string, string> = {
    custom: "رابط مخصص",
    page: "صفحة",
    topic: "موضوع",
    topic_category: "تصنيف",
    project: "مشروع",
    external: "خارجي",
    anchor: "Anchor",
    parent: "Parent",
  };

  return labels[type] ?? type;
}

export function referenceOptionTitle(option: ReferenceOption) {
  return option.title ?? option.name ?? option.slug ?? `#${option.id}`;
}

export function selectedReferenceId(item: MenuItem | undefined, type: string) {
  if (!item || item.item_type !== type) return "";
  return item.linked_id ?? "";
}

export function getParentLabel(items: MenuItem[], parentId: number | null) {
  if (!parentId) return null;
  return items.find((item) => item.id === parentId)?.label ?? `#${parentId}`;
}

export function flattenMenuItemsForTable(items: MenuItem[]): FlatMenuItemRow[] {
  const tree = buildMenuTree(items);
  return flattenMenuTree(tree);
}

export function collectMenuItemDescendantIds(
  rootId: number,
  items: readonly Pick<MenuItem, "id" | "parent_id">[],
) {
  const children = new Map<number, number[]>();
  for (const item of items) {
    if (!item.parent_id) continue;
    children.set(item.parent_id, [
      ...(children.get(item.parent_id) ?? []),
      item.id,
    ]);
  }

  const affected = new Set<number>();
  const pending = [rootId];
  while (pending.length) {
    const itemId = pending.pop();
    if (!itemId || affected.has(itemId)) continue;
    affected.add(itemId);
    pending.push(...(children.get(itemId) ?? []));
  }
  return [...affected];
}
