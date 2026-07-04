import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_HEADER_CLASSES,
  AdminActionButton,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import CategoryTreeControls from "./CategoryTreeControls";
import CategoryRowActions from "./CategoryRowActions";
import { flattenCategoryTree } from "../../../../lib/admin/category-tree";

export const dynamic = "force-dynamic";

/** RTL tree grid: التصنيف (1fr) → … → الإجراءات (ثابت، شمال). */
const TREE_GRID_COLUMNS = `minmax(260px, 1fr) minmax(160px, 1fr) 96px 96px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  parent_id: number | null;
  status: string | null;
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

function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء التصنيف بنجاح.";
  if (notice === "updated") return "تم تحديث التصنيف بنجاح.";
  if (notice === "deleted") return "تم حذف التصنيف بنجاح.";
  if (notice === "shown") return "تم إظهار التصنيف بنجاح.";
  if (notice === "hidden") return "تم إخفاء التصنيف بنجاح.";
  return null;
}

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

function FolderIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={large ? "h-9 w-9" : "h-6 w-6"}
      fill="none"
    >
      <path
        d="M3.4 7.9A2.4 2.4 0 0 1 5.8 5.5h4.6c.5 0 .98.18 1.36.51l1.35 1.16c.38.33.86.51 1.36.51h3.73a2.4 2.4 0 0 1 2.4 2.4v.57H3.4V7.9Z"
        fill="#F1C668"
      />
      <path
        d="M3.4 9.9h17.2v6.35a2.55 2.55 0 0 1-2.55 2.55H5.95a2.55 2.55 0 0 1-2.55-2.55V9.9Z"
        fill="#D9A93B"
      />
      <path
        d="M4 10.35h16"
        stroke="#FFE49A"
        strokeOpacity=".45"
        strokeWidth=".8"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="6.2" />
      <path strokeLinecap="round" d="m16 16 4 4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M7 12h10M10 18h4"
      />
    </svg>
  );
}

function CountLabel({ category }: { category: CategoryNode }) {
  const count = category.totalCount;
  if (category.children.length > 0 && count === 0)
    return <>{category.children.length} فرعي</>;
  if (count === 1) return <>عنصر</>;
  if (count <= 10 && category.slug !== "topics") return <>{count} عناصر</>;
  return <>{count} مقال</>;
}

function TreeLines({
  category,
  level,
}: {
  category: CategoryNode;
  level: number;
}) {
  if (level === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-[62px] top-1/2 hidden h-px w-7 border-t border-dashed border-white/25 xl:block"
    />
  );
}

function CategoryCell({
  category,
  level,
}: {
  category: CategoryNode;
  level: number;
}) {
  const hasChildren = category.children.length > 0;

  return (
    <button
      type="button"
      data-category-toggle={hasChildren ? "true" : undefined}
      className="relative flex w-full items-center justify-start gap-4 rounded-[10px] py-1 text-right transition hover:bg-white/[0.025]"
      style={{ paddingInlineStart: level ? `${level * 34}px` : 0 }}
    >
      {level > 0 ? (
        <span
          aria-hidden="true"
          className="hidden h-px w-7 border-t border-dashed border-white/25 xl:block"
        />
      ) : null}
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/8 bg-white/[0.035] font-en text-xs text-[#D8B87A]"
        data-category-state-icon
      >
        {hasChildren ? "▼" : ""}
      </span>
      <span
        data-category-folder
        className="transition duration-200 data-[open=false]:opacity-70"
      >
        <FolderIcon large={level === 0} />
      </span>
      <span className="min-w-0">
        <span
          className={
            level === 0
              ? "block truncate text-base font-bold text-white"
              : "block truncate text-base font-bold text-white/94"
          }
        >
          {category.name}
        </span>
        <span className="mt-1 block truncate font-en text-xs text-white/45">
          slug: {category.slug}
        </span>
      </span>
    </button>
  );
}

function CategoryRowView({
  category,
  level,
  parentOptions,
  parentId,
}: {
  category: CategoryNode;
  level: number;
  parentOptions: Array<{ id: number; name: string; level: number }>;
  parentId?: number | null;
}) {
  return (
    <div
      className="relative"
      data-category-row
      data-category-id={category.id}
      data-parent-id={parentId ?? ""}
      data-category-level={level}
      data-has-children={category.children.length > 0 ? "true" : "false"}
      data-open="true"
      data-status={Boolean(category.is_active) ? "published" : "hidden"}
      data-search={`${category.name} ${category.slug} ${category.description || ""}`}
      data-sort-name={category.name}
      data-sort-status={Boolean(category.is_active) ? "published" : "hidden"}
      data-sort-count={category.totalCount}
      data-sort-order={category.sort_order ?? 0}
    >
      <div
        className={`grid min-w-[980px] items-center gap-4 border-b border-white/[0.075] px-6 py-3.5 transition hover:bg-white/[0.025] ${
          level === 0 ? "bg-white/[0.025]" : "bg-transparent"
        }`}
        style={{ gridTemplateColumns: TREE_GRID_COLUMNS }}
      >
        <div className="relative">
          <TreeLines category={category} level={level} />
          <CategoryCell category={category} level={level} />
        </div>
        <p className="text-sm leading-7 text-white/62">
          {category.description || "—"}
        </p>
        <p className="text-center text-sm text-white/82">
          <CountLabel category={category} />
        </p>
        <div className="flex justify-center">
          <AdminStatusPill tone={Boolean(category.is_active) ? "green" : "gold"}>
            {Boolean(category.is_active) ? "منشور" : "مخفي"}
          </AdminStatusPill>
        </div>
        <CategoryRowActions category={category} parentOptions={parentOptions} />
      </div>
    </div>
  );
}

function CategoryRows({
  nodes,
  parentOptions,
  level = 0,
  parentId = null,
}: {
  nodes: CategoryNode[];
  parentOptions: Array<{ id: number; name: string; level: number }>;
  level?: number;
  parentId?: number | null;
}) {
  return (
    <div className="contents" data-category-level-container data-parent-id={parentId ?? "root"}>
      {nodes.map((node) => (
        <div
          key={node.id}
          className="contents"
          data-category-item
          data-category-id={node.id}
          data-parent-id={parentId ?? "root"}
        >
          <CategoryRowView
            category={node}
            level={level}
            parentOptions={parentOptions}
            parentId={parentId}
          />
          {node.children.length > 0 ? (
            <CategoryRows
              nodes={node.children}
              parentOptions={parentOptions}
              level={level + 1}
              parentId={node.id}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default async function TopicCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<CategoriesSearchParams>;
}) {
  const query = await searchParams;
  const notice = getNoticeText(query?.notice);
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  const { data: categories } = await getSupabaseAdmin()
    .from("topic_categories")
    .select(
      "id, name, slug, description, sort_order, is_active, parent_id, status, topics_count:topics(count)",
    )
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const safeCategories = (categories ?? []) as CategoryRow[];
  const tree = buildCategoryTree(safeCategories);
  const parentOptions = flattenCategoryTree(tree);
  const totalCount = safeCategories.length;

  return (
    <main className="space-y-7" dir="rtl">
      <AdminPageHeader
        variant="context"
        eyebrow="Admin Panel"
        title="إدارة التصنيفات"
        contextLine="أنت الآن تدير: تصنيفات الموضوعات"
        description="نظّم تصنيفات الموضوعات في شجرة هرمية. عدّل أي تصنيف أو تحكّم في ظهوره وحذفه من الجدول أدناه."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <AdminActionButton href="/admin/topics/categories/new" variant="primary">
              <PlusIcon />
              إضافة تصنيف
            </AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">عرض المقالات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
          </div>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? (
        <AdminNotice
          variant="danger"
          title="تعذر تنفيذ العملية"
          message={errorMessage}
        />
      ) : null}

      <section className="rounded-[18px] border border-[#D8B87A]/12 bg-[linear-gradient(180deg,rgba(10,15,21,0.92),rgba(6,9,13,0.96))] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.34)]">
        <div
          className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center"
          dir="rtl"
        >
          <label className="relative block max-w-[330px] lg:order-last">
            <input
              type="search"
              data-category-search
              placeholder="ابحث في التصنيفات..."
              className="h-12 w-full rounded-[8px] border border-white/10 bg-black/20 pr-11 pl-4 text-sm text-white outline-none placeholder:text-white/36 focus:border-[#D8B87A]/35"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/58">
              <SearchIcon />
            </span>
          </label>

          <CategoryTreeControls />

          <button type="button" data-category-sort="name" className="flex h-12 items-center justify-center gap-3 rounded-[8px] border border-white/10 bg-black/18 px-5 text-sm text-white/78 transition hover:border-[#D8B87A]/28 hover:text-white">
            ترتيب الرئيسية بالاسم
          </button>
          <button type="button" data-category-sort="sort_order" className="flex h-12 items-center justify-center gap-3 rounded-[8px] border border-white/10 bg-black/18 px-5 text-sm text-white/78 transition hover:border-[#D8B87A]/28 hover:text-white">
            <FilterIcon />
            ترتيب الرئيسية
          </button>
          <label className="relative flex h-12 min-w-[150px] items-center rounded-[8px] border border-white/10 bg-black/18 px-4 text-sm text-white/78 transition focus-within:border-[#D8B87A]/28">
            <select
              data-category-status-filter
              defaultValue="all"
              className="h-full w-full appearance-none bg-transparent pr-2 pl-7 text-right outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="published">منشور</option>
              <option value="hidden">مخفي</option>
            </select>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
              <ChevronDownIcon />
            </span>
          </label>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-white/8 bg-[#080C10]/72">
          <div className="overflow-x-auto">
            <div
              className={`grid min-w-[980px] items-center gap-4 px-6 py-4 ${ADMIN_DATA_GRID_HEADER_CLASSES}`}
              style={{ gridTemplateColumns: TREE_GRID_COLUMNS }}
            >
              <button type="button" data-category-sort="name" className="text-right transition hover:text-[#D8B87A]">التصنيف</button>
              <span>الوصف</span>
              <button type="button" data-category-sort="count" className="text-center transition hover:text-[#D8B87A]">العدد</button>
              <button type="button" data-category-sort="status" className="text-center transition hover:text-[#D8B87A]">الحالة</button>
              <span className="text-center">الإجراءات</span>
            </div>

            {tree.length > 0 ? <CategoryRows nodes={tree} parentOptions={parentOptions} /> : null}
            <div data-category-empty-filter hidden className="p-8 text-center text-sm text-white/45">لا توجد نتائج مطابقة للبحث أو الفلتر.</div>
            {tree.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/45">
                لا توجد تصنيفات بعد.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 rounded-[10px] border border-white/8 bg-white/[0.025] px-6 py-4 text-sm text-white/70">
          <FolderIcon />
          <span>إجمالي التصنيفات: {totalCount}</span>
        </div>
      </section>
    </main>
  );
}
