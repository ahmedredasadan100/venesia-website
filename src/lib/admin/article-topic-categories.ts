export type ArticleTopicCategoryRecord = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type ArticleTopicCategoryGroup = {
  label: string;
  options: Array<{ id: number; slug: string; name: string }>;
};

type CategoryNode = ArticleTopicCategoryRecord & {
  children: CategoryNode[];
};

function buildCategoryTree(categories: ArticleTopicCategoryRecord[]) {
  const nodeMap = new Map<number, CategoryNode>();
  categories
    .filter((category) => category.is_active !== false)
    .forEach((category) => nodeMap.set(category.id, { ...category, children: [] }));

  const roots: CategoryNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return { roots, nodeMap };
}

function flattenNodes(nodes: CategoryNode[], depth = 0): Array<{ id: number; slug: string; name: string }> {
  return nodes.flatMap((node) => [
    { id: node.id, slug: node.slug, name: `${"— ".repeat(depth)}${node.name}` },
    ...flattenNodes(node.children, depth + 1),
  ]);
}

/**
 * Builds editor choices entirely from the current database hierarchy.
 * Root names and slugs are data, never editor configuration.
 */
export function buildArticleTopicCategoryFilterGroups(
  categories: ArticleTopicCategoryRecord[],
): ArticleTopicCategoryGroup[] {
  const { roots } = buildCategoryTree(categories);
  return roots.map((root) => ({
    label: root.name,
    options: flattenNodes([root]),
  }));
}

export function resolveArticleTopicCategory(
  categorySlug: string,
  categories: ArticleTopicCategoryRecord[],
):
  | { ok: true; category: { id: number; name: string; slug: string } }
  | { ok: false; message: string } {
  const trimmedSlug = categorySlug.trim();
  if (!trimmedSlug) return { ok: false, message: "التصنيف مطلوب." };

  const category = categories.find(
    (item) => item.slug === trimmedSlug && item.is_active !== false,
  );
  if (!category) {
    return { ok: false, message: "التصنيف المختار غير موجود أو غير مفعل." };
  }
  return {
    ok: true,
    category: { id: category.id, name: category.name, slug: category.slug },
  };
}
