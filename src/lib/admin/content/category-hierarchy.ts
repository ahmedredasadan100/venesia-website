export type AdminContentCategory = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
  color_token?: string | null;
};

export type AdminContentCategoryNode = AdminContentCategory & {
  depth: number;
  children: AdminContentCategoryNode[];
};

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

export function getSelectableAdminCategories(categories: AdminContentCategory[]) {
  return flattenAdminCategoryTree(buildAdminCategoryTree(categories)).filter(
    (category) => category.is_active !== false,
  );
}
