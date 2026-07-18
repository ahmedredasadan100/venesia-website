import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminPageContextHeader,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
  CATEGORIES_LIST_VIEW_KEY,
  CATEGORIES_NOTICE_CODE_MAP,
} from "../../../../lib/admin/content/categories-list-config";
import { flattenCategoryTree } from "../../../../lib/admin/category-tree";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import CategoriesListClient from "./CategoriesListClient";
import type { CategoryListRow } from "./categories-columns";

export const dynamic = "force-dynamic";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  parent_id: number | null;
  status: string | null;
  color_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  topics_count?: { count: number }[];
};

type CategoryNode = CategoryRow & {
  children: CategoryNode[];
  ownCount: number;
  totalCount: number;
};

type CategoriesSearchParams = {
  notice?: string;
  error?: string;
};

function getUsageCount(category: CategoryRow) {
  return category.topics_count?.[0]?.count ?? 0;
}

function buildCategoryTree(categories: CategoryRow[]) {
  const nodeMap = new Map<number, CategoryNode>();

  categories.forEach((category) => {
    const ownCount = getUsageCount(category);
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
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id,
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

function flattenTreeRows(
  nodes: CategoryNode[],
  nameById: Map<number, string>,
  depth = 0,
  acc: CategoryListRow[] = [],
): CategoryListRow[] {
  for (const node of nodes) {
    acc.push({
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
      created_at: node.created_at,
      updated_at: node.updated_at,
      ownCount: node.ownCount,
      totalCount: node.totalCount,
      depth,
      childCount: node.children.length,
    });
    if (node.children.length) {
      flattenTreeRows(node.children, nameById, depth + 1, acc);
    }
  }
  return acc;
}

export default async function TopicCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<CategoriesSearchParams>;
}) {
  const actor = await requireAdminSession();
  const query = await searchParams;
  const noticeFeedback = resolveAdminNoticeFeedback(
    CATEGORIES_NOTICE_CODE_MAP,
    query?.error ? "error" : query?.notice,
    query?.error ? decodeURIComponent(query.error) : null,
  );

  const [
    { data: categories, error },
    { data: preference, error: preferenceError },
  ] = await Promise.all([
    getSupabaseAdmin()
      .from("topic_categories")
      .select(
        "id, name, slug, description, sort_order, is_active, parent_id, status, color_token, created_at, updated_at, topics_count:topics(count)",
      )
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    getSupabaseAdmin()
      .from("admin_user_preferences")
      .select("preferences")
      .eq("admin_user_id", actor.id)
      .eq("view_key", CATEGORIES_LIST_VIEW_KEY)
      .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
  ]);

  if (error) {
    return (
      <main className="space-y-7" dir="rtl">
        <AdminPageContextHeader
          eyebrow="CATEGORIES CONTROL"
          title="إدارة التصنيفات"
          description="من هنا تُدار تصنيفات موضوعات تهمك، مع تنظيم الظهور والربط بالمقالات والسلاسل وتحسين بنية المحتوى من مكان واحد."
        />
        <AdminNotice
          variant="danger"
          title="تعذر تحميل التصنيفات"
          message={error.message}
        />
      </main>
    );
  }

  const safeCategories = (categories ?? []) as CategoryRow[];
  const nameById = new Map(
    safeCategories.map((category) => [category.id, category.name]),
  );
  const tree = buildCategoryTree(safeCategories);
  const parentOptions = flattenCategoryTree(tree);
  const rows = flattenTreeRows(tree, nameById);
  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...CATEGORIES_DEFAULT_COLUMN_KEYS];

  return (
    <main className="space-y-7" dir="rtl">
      <AdminPageContextHeader
        eyebrow="CATEGORIES CONTROL"
        title="إدارة التصنيفات"
        description="من هنا تُدار تصنيفات موضوعات تهمك، مع تنظيم الظهور والربط بالمقالات والسلاسل وتحسين بنية المحتوى من مكان واحد."
        actions={
          <>
            <AdminActionButton href="/admin/content/categories/new" variant="primary">
              <PlusIcon />
              إضافة تصنيف جديد
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">
              عرض الموضوعات
            </AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">
              عرض السلاسل
            </AdminActionButton>
          </>
        }
      />

      {noticeFeedback ? (
        <AdminNotice
          variant={noticeFeedback.variant}
          title={noticeFeedback.title || undefined}
          message={noticeFeedback.message}
          layout={noticeFeedback.layout}
          dismissible={noticeFeedback.dismissible}
          dismissSearchParams={noticeFeedback.dismissSearchParams}
        />
      ) : null}
      {preferenceError ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل تفضيلات الأعمدة"
          message={preferenceError.message}
        />
      ) : null}

      <CategoriesListClient
        rows={rows}
        parentOptions={parentOptions}
        initialVisibleColumns={visibleColumns}
      />
    </main>
  );
}
