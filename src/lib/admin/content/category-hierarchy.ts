import type { AdminEntityFilterOption } from "../entity-list";

export type AdminContentCategory = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
  status?: string | null;
  color_token?: string | null;
};

export type AdminContentCategoryNode = AdminContentCategory & {
  depth: number;
  children: AdminContentCategoryNode[];
};

export type AdminContentSeriesCategory = {
  category_id: number | null;
};

export const TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE =
  "اختر سلسلة تابعة للتصنيف المحدد أو اترك الحقل فارغًا.";

export function isAdminContentSeriesInCategory(
  series: AdminContentSeriesCategory,
  categoryId: number | null,
) {
  return categoryId !== null && series.category_id === categoryId;
}

export function isAdminContentSeriesSelectionValid(
  series: AdminContentSeriesCategory | null,
  categoryId: number | null,
) {
  return series === null || isAdminContentSeriesInCategory(series, categoryId);
}

export function getAdminContentSeriesCategoryError(
  series: AdminContentSeriesCategory | null,
  categoryId: number | null,
) {
  return isAdminContentSeriesSelectionValid(series, categoryId)
    ? null
    : TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE;
}

export function filterAdminContentSeriesByCategory<
  TSeries extends AdminContentSeriesCategory,
>(series: readonly TSeries[], categoryId: number | null) {
  if (categoryId === null) return [];
  return series.filter((item) =>
    isAdminContentSeriesInCategory(item, categoryId),
  );
}

function compareCategories(a: AdminContentCategory, b: AdminContentCategory) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id;
}

export function buildAdminCategoryTree(categories: AdminContentCategory[]) {
  const nodes = new Map<number, AdminContentCategoryNode>();

  categories.forEach((category) => {
    nodes.set(category.id, { ...category, depth: 0, children: [] });
  });

  const roots: AdminContentCategoryNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parent_id ? nodes.get(node.parent_id) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });

  const visited = new Set<number>();
  function sortAndSetDepth(node: AdminContentCategoryNode, depth: number) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    node.depth = depth;
    node.children.sort(compareCategories);
    node.children.forEach((child) => sortAndSetDepth(child, depth + 1));
  }

  roots.sort(compareCategories);
  roots.forEach((root) => sortAndSetDepth(root, 0));

  // Corrupt cycles are kept visible as roots instead of disappearing.
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      node.parent_id = null;
      roots.push(node);
      sortAndSetDepth(node, 0);
    }
  });

  return roots;
}

export function flattenAdminCategoryTree(nodes: AdminContentCategoryNode[]) {
  return nodes.flatMap((node): AdminContentCategoryNode[] => [
    node,
    ...flattenAdminCategoryTree(node.children),
  ]);
}

export function getCategoryAndDescendantIds(
  categories: AdminContentCategory[],
  categoryId: number,
) {
  const childrenByParent = new Map<number, number[]>();
  categories.forEach((category) => {
    if (!category.parent_id) return;
    const children = childrenByParent.get(category.parent_id) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parent_id, children);
  });

  const ids = new Set<number>();
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return [...ids];
}

/** Project adapter: category tree data -> portable hierarchical filter options. */
export function toAdminCategoryFilterOptions(
  categories: readonly AdminContentCategoryNode[],
): AdminEntityFilterOption[] {
  return categories.map((category) => ({
    value: String(category.id),
    label: category.name,
    depth: category.depth,
    parentValue: category.parent_id ? String(category.parent_id) : undefined,
  }));
}

/**
 * Project adapter for consumers whose selected parent includes its descendants.
 * The portable filter primitive receives only the generic options.
 */
export function buildAdminCategoryFilterModel(
  categories: AdminContentCategory[],
) {
  const flattened = flattenAdminCategoryTree(buildAdminCategoryTree(categories));
  const descendantIdsByValue = Object.fromEntries(
    flattened.map((category) => [
      String(category.id),
      getCategoryAndDescendantIds(categories, category.id),
    ]),
  ) as Record<string, number[]>;

  return {
    options: toAdminCategoryFilterOptions(flattened),
    descendantIdsByValue,
  };
}
