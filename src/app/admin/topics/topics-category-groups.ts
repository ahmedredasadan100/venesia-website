import { isTestTopicCategory } from "../../../lib/admin/cms-test-data";

export type TopicCategoryRecord = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type TopicCategoryGroup = {
  label: string;
  options: Array<{ id: number; slug: string; name: string }>;
};

type CategoryNode = TopicCategoryRecord & {
  children: CategoryNode[];
};

function buildCategoryTree(categories: TopicCategoryRecord[]) {
  const nodeMap = new Map<number, CategoryNode>();

  categories.forEach((category) => {
    nodeMap.set(category.id, { ...category, children: [] });
  });

  const roots: CategoryNode[] = [];

  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id,
    );
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function collectSelectableCategories(
  nodes: CategoryNode[],
): Array<{ id: number; slug: string; name: string }> {
  return nodes.flatMap((node) => {
    if (node.children.length === 0) {
      return [{ id: node.id, slug: node.slug, name: node.name }];
    }

    return collectSelectableCategories(node.children);
  });
}

export function buildTopicCategoryFilterGroups(
  categories: TopicCategoryRecord[],
): TopicCategoryGroup[] {
  const safeCategories = categories.filter(
    (category) =>
      category.is_active !== false &&
      !isTestTopicCategory(category.slug, category.name),
  );

  return buildCategoryTree(safeCategories)
    .map((root) => ({
      label: root.name,
      options: root.children.length
        ? collectSelectableCategories(root.children)
        : [{ id: root.id, slug: root.slug, name: root.name }],
    }))
    .filter((group) => group.options.length > 0);
}
