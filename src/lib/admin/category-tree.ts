export type CategoryTreeNode = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
  children: CategoryTreeNode[];
};

export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  level = 0,
): Array<{ id: number; name: string; level: number }> {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, level },
    ...flattenCategoryTree(node.children, level + 1),
  ]);
}
