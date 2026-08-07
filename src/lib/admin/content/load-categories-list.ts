import "server-only";

import { z } from "zod";

import { flattenCategoryTree } from "../category-tree";
import { getSupabaseAdmin } from "../../supabase-admin";

export const categoryListRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().nullable(),
  is_active: z.boolean().nullable(),
  parent_id: z.number().int().positive().nullable(),
  parent_name: z.string().nullable(),
  status: z.string().nullable(),
  color_token: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  ownCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative(),
  childCount: z.number().int().nonnegative(),
});

export type CategoryListRow = z.infer<typeof categoryListRowSchema>;

type CategoryRow = Omit<
  CategoryListRow,
  "parent_name" | "ownCount" | "totalCount" | "depth" | "childCount"
> & {
  topics_count?: { count: number }[];
};

type CategoryNode = CategoryRow & {
  children: CategoryNode[];
  ownCount: number;
  totalCount: number;
};

function buildCategoryTree(categories: CategoryRow[]) {
  const nodeMap = new Map<number, CategoryNode>();
  categories.forEach((category) => {
    const ownCount = category.topics_count?.[0]?.count ?? 0;
    nodeMap.set(category.id, {
      ...category,
      children: [],
      ownCount,
      totalCount: ownCount,
    });
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
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.id - right.id,
    );
    nodes.forEach((node) => sortNodes(node.children));
  };
  const calculateTotals = (node: CategoryNode): number => {
    node.totalCount =
      node.ownCount +
      node.children.reduce((sum, child) => sum + calculateTotals(child), 0);
    return node.totalCount;
  };
  sortNodes(roots);
  roots.forEach(calculateTotals);
  return roots;
}

function flattenRows(
  nodes: CategoryNode[],
  nameById: Map<number, string>,
  depth = 0,
  rows: CategoryListRow[] = [],
) {
  for (const node of nodes) {
    rows.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description,
      sort_order: node.sort_order,
      is_active: node.is_active,
      parent_id: node.parent_id,
      parent_name: node.parent_id
        ? (nameById.get(node.parent_id) ?? null)
        : null,
      status: node.status,
      color_token: node.color_token,
      published_at: node.published_at,
      created_at: node.created_at,
      updated_at: node.updated_at,
      ownCount: node.ownCount,
      totalCount: node.totalCount,
      depth,
      childCount: node.children.length,
    });
    flattenRows(node.children, nameById, depth + 1, rows);
  }
  return rows;
}

export async function loadCategoriesListData() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select(
      "id, name, slug, description, sort_order, is_active, parent_id, status, color_token, published_at, created_at, updated_at, topics_count:topics(count)",
    )
    .is("topics.deleted_at", null)
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  const categories = (data ?? []) as CategoryRow[];
  const nameById = new Map(categories.map((category) => [category.id, category.name]));
  const tree = buildCategoryTree(categories);
  return {
    rows: flattenRows(tree, nameById),
    parentOptions: flattenCategoryTree(tree),
  };
}
