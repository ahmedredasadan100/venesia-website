import Link from "next/link";
import AdminNotice from "../../../../components/admin/AdminNotice";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import CategoryTreeControls from "./CategoryTreeControls";
import CategoryCreateModal from "./CategoryCreateModal";
import CategoryEditModal from "./CategoryEditModal";
import { flattenCategoryTree } from "../../../../lib/admin/category-tree";
import {
  deleteCategory,
  toggleCategoryStatus,
} from "./actions";

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

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m-8 0 1 12h8l1-12"
      />
      <path strokeLinecap="round" d="M10 11v5M14 11v5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 10.6a2.7 2.7 0 0 0 3.8 3.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.2 7.6C4.1 9.2 2.5 12 2.5 12s3.5 6 9.5 6c1.55 0 2.94-.4 4.16-1.02" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6c6 0 9.5 6 9.5 6a14.7 14.7 0 0 1-2.1 2.65" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
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

function ListIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path strokeLinecap="round" d="M8 6h12M8 12h12M8 18h12" />
      <path strokeLinecap="round" d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex min-w-[56px] justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isActive
          ? "border-emerald-400/18 bg-emerald-500/18 text-emerald-100"
          : "border-red-400/20 bg-red-500/12 text-red-100"
      }`}
    >
      {isActive ? "منشور" : "مخفي"}
    </span>
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

function ActionButtons({
  category,
  parentOptions,
}: {
  category: CategoryNode;
  parentOptions: Array<{ id: number; name: string; level: number }>;
}) {
  const isActive = Boolean(category.is_active);
  const isUsed = category.totalCount > 0 || category.children.length > 0;

  return (
    <div className="flex items-center justify-center gap-1.5" dir="rtl">
      <CategoryEditModal category={category} parentOptions={parentOptions} />
      <form action={toggleCategoryStatus}>
        <input type="hidden" name="id" value={category.id} />
        <button
          className={`flex h-11 w-11 items-center justify-center rounded-[8px] border transition ${
            isActive
              ? "border-emerald-400/22 bg-emerald-500/12 text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-500/18"
              : "border-orange-400/22 bg-orange-500/12 text-orange-100 hover:border-orange-300/40 hover:bg-orange-500/18"
          }`}
          title={isActive ? "إخفاء التصنيف" : "إظهار التصنيف"}
        >
          {isActive ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </form>
      <form action={deleteCategory}>
        <input type="hidden" name="id" value={category.id} />
        <button
          disabled={isUsed}
          className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-red-400/20 bg-[#C9333E] text-white shadow-[0_13px_30px_rgba(201,51,62,0.18)] transition hover:bg-[#E23B46] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.04] disabled:text-white/22 disabled:shadow-none"
          title={
            isUsed
              ? "لا يمكن حذف تصنيف مستخدم أو يحتوي تصنيفات فرعية"
              : "حذف التصنيف"
          }
        >
          <TrashIcon />
        </button>
      </form>
    </div>
  );
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
        className={`grid min-w-[1080px] grid-cols-[1.55fr_1.35fr_150px_120px_150px] items-center gap-4 border-b border-white/[0.075] px-6 py-3.5 transition hover:bg-white/[0.025] ${
          level === 0 ? "bg-white/[0.025]" : "bg-transparent"
        }`}
      >
        <div className="relative">
          <TreeLines category={category} level={level} />
          <CategoryCell category={category} level={level} />
        </div>
        <p className="text-sm leading-7 text-white/62">
          {category.description || "—"}
        </p>
        <p className="text-sm text-white/82">
          <CountLabel category={category} />
        </p>
        <div className="flex justify-center">
          <StatusBadge isActive={Boolean(category.is_active)} />
        </div>
        <ActionButtons category={category} parentOptions={parentOptions} />
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
    <main className="relative space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-6" dir="ltr">
        <CategoryCreateModal parentOptions={parentOptions} />

        <div className="text-right" dir="rtl">
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            إدارة التصنيفات
          </h1>
          <div className="mt-5 flex items-center justify-end gap-3 text-sm text-white/45">
            <Link href="/admin" className="transition hover:text-[#D8B87A]">
              الرئيسية
            </Link>
            <span className="text-white/20">‹</span>
            <Link
              href="/admin/topics"
              className="transition hover:text-[#D8B87A]"
            >
              إدارة المواضيع
            </Link>
            <span className="text-white/20">‹</span>
            <span className="text-[#D8B87A]">التصنيفات</span>
          </div>
        </div>
      </div>

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
            <div className="grid min-w-[1080px] grid-cols-[1.55fr_1.35fr_150px_120px_150px] items-center gap-4 border-b border-[#D8B87A]/12 bg-white/[0.045] px-6 py-4 text-sm font-bold text-white">
              <button type="button" data-category-sort="name" className="text-right transition hover:text-[#D8B87A]">التصنيف الرئيسي</button>
              <span>الوصف</span>
              <button type="button" data-category-sort="count" className="text-right transition hover:text-[#D8B87A]">عدد عناصر الرئيسي</button>
              <button type="button" data-category-sort="status" className="text-center transition hover:text-[#D8B87A]">حالة الرئيسي</button>
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
