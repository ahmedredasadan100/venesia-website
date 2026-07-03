"use client";

import { useRouter } from "next/navigation";
import {
  ADMIN_DATA_GRID_COLUMNS,
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridSortLabel,
  AdminDataGridStatusCell,
  AdminStatusPill,
  adminDataGridActionsColumn,
  useAdminGridSelection,
} from "../../../../components/admin/ui";
import {
  bulkMediaCategoryAction,
  deleteMediaCategory,
  duplicateMediaCategory,
  moveMediaCategory,
  toggleMediaCategoryStatus,
} from "./actions";

export type MediaCategorySortKey = "name" | "items" | "status";
export type MediaCategorySortDir = "asc" | "desc";

export type MediaCategoryRow = {
  id: number;
  name: string;
  is_active: boolean;
  usage_count: number;
  can_move_up: boolean;
  can_move_down: boolean;
};

// 6 row actions: moveUp · moveDown · edit · visibility · duplicate · delete.
const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryStandard} ${ADMIN_DATA_GRID_COLUMNS.count} ${ADMIN_DATA_GRID_COLUMNS.statusCompact} ${adminDataGridActionsColumn(6, "compact")}`;

const BASE_PATH = "/admin/media-center/categories";

export default function MediaCategoriesTableClient({
  categories,
  totalCount,
  sortKey,
  dir,
  isDefaultSort,
}: {
  categories: MediaCategoryRow[];
  totalCount: number;
  sortKey: MediaCategorySortKey | null;
  dir: MediaCategorySortDir;
  isDefaultSort: boolean;
}) {
  const router = useRouter();
  const selection = useAdminGridSelection(categories.map((category) => category.id));

  // View sorting only — navigates with query params (server re-sorts the whole dataset).
  // It never touches sort_order and never calls moveMediaCategory.
  function handleSort(key: MediaCategorySortKey) {
    if (sortKey === key && dir === "asc") {
      router.push(`${BASE_PATH}?sort=${key}&dir=desc`);
      return;
    }
    if (sortKey === key && dir === "desc") {
      router.push(BASE_PATH); // third click → back to default (sort_order ASC)
      return;
    }
    router.push(`${BASE_PATH}?sort=${key}&dir=asc`);
  }

  function sortProps(key: MediaCategorySortKey) {
    return {
      active: sortKey === key,
      direction: dir,
      onClick: () => handleSort(key),
    } as const;
  }
  const selectionHasUsed = categories.some(
    (category) => selection.selectedSet.has(category.id) && category.usage_count > 0,
  );

  return (
    <div className="space-y-4">
      {selection.hasSelection && selectionHasUsed ? (
        <p className="rounded-[14px] border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-xs font-semibold text-amber-100">
          التحديد يضم تصنيفات مستخدمة داخل عناصر المركز الإعلامي — حذف المحدد سيُرفض. أخفِها بدلًا من ذلك.
        </p>
      ) : null}

      {!isDefaultSort ? (
        <p className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
          هذا فرز عرض مؤقت ولا يغيّر الترتيب المحفوظ. الترتيب اليدوي (الأسهم) متاح فقط في العرض الافتراضي حسب الترتيب.
        </p>
      ) : null}

      <AdminBulkActionBar
        selectedIds={selection.selectedIds}
        entityLabel="تصنيف"
        action={bulkMediaCategoryAction}
        options={[
          { value: "publish", label: "إظهار المحدد" },
          { value: "hide", label: "إخفاء المحدد" },
          { value: "delete", label: "حذف المحدد" },
        ]}
        onClearSelection={selection.clearSelection}
      />

      <AdminDataGrid summary={`${totalCount} تصنيف إجمالًا`}>
        <AdminDataGridHeader columns={columns}>
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              inputRef={selection.selectAllRef}
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
          <AdminDataGridPrimaryCell>
            <AdminDataGridSortLabel {...sortProps("name")} className="justify-end">التصنيف</AdminDataGridSortLabel>
          </AdminDataGridPrimaryCell>
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("items")} className="justify-center">العناصر</AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
          <AdminDataGridStatusCell>
            <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">الحالة</AdminDataGridSortLabel>
          </AdminDataGridStatusCell>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {categories.length ? (
          categories.map((category) => {
            const isActive = category.is_active;
            const isUsed = category.usage_count > 0;

            return (
              <AdminDataGridRow key={category.id} columns={columns}>
                <AdminDataGridCheckboxCell>
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(category.id)}
                    onChange={(event) => selection.toggleOne(category.id, event.currentTarget.checked)}
                    label={`تحديد ${category.name}`}
                  />
                </AdminDataGridCheckboxCell>

                <AdminDataGridPrimaryCell>
                  <span className="block truncate text-sm font-semibold text-white">{category.name}</span>
                </AdminDataGridPrimaryCell>

                <AdminDataGridCenterCell className="font-en text-sm tabular-nums text-white/60">
                  {category.usage_count}
                </AdminDataGridCenterCell>

                <AdminDataGridStatusCell>
                  <AdminStatusPill tone={isActive ? "green" : "muted"}>
                    {isActive ? "ظاهر" : "مخفي"}
                  </AdminStatusPill>
                </AdminDataGridStatusCell>

                <AdminDataGridActionsCell compact>
                  <form action={moveMediaCategory} className="contents">
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="direction" value="up" />
                    <AdminDataGridActionButton
                      tone="dark"
                      type="submit"
                      title={isDefaultSort ? "تحريك لأعلى" : "الترتيب اليدوي متاح في العرض الافتراضي فقط"}
                      disabled={!isDefaultSort || !category.can_move_up}
                    >
                      <span className="text-sm">↑</span>
                    </AdminDataGridActionButton>
                  </form>
                  <form action={moveMediaCategory} className="contents">
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="direction" value="down" />
                    <AdminDataGridActionButton
                      tone="dark"
                      type="submit"
                      title={isDefaultSort ? "تحريك لأسفل" : "الترتيب اليدوي متاح في العرض الافتراضي فقط"}
                      disabled={!isDefaultSort || !category.can_move_down}
                    >
                      <span className="text-sm">↓</span>
                    </AdminDataGridActionButton>
                  </form>
                  <AdminDataGridActionButton
                    action="edit"
                    href={`/admin/media-center/categories/${category.id}`}
                    title="تعديل التصنيف"
                  />
                  <form action={toggleMediaCategoryStatus} className="contents">
                    <input type="hidden" name="id" value={category.id} />
                    <AdminDataGridActionButton
                      action="visibility"
                      type="submit"
                      title={isActive ? "إخفاء" : "إظهار"}
                      hidden={!isActive}
                    />
                  </form>
                  <form action={duplicateMediaCategory} className="contents">
                    <input type="hidden" name="id" value={category.id} />
                    <AdminDataGridActionButton action="duplicate" type="submit" title="نسخ التصنيف" />
                  </form>
                  <form action={deleteMediaCategory} className="contents">
                    <input type="hidden" name="id" value={category.id} />
                    <AdminDataGridActionButton
                      action="delete"
                      type="submit"
                      title={isUsed ? "لا يمكن حذف تصنيف مستخدم" : "حذف"}
                      disabled={isUsed}
                    />
                  </form>
                </AdminDataGridActionsCell>
              </AdminDataGridRow>
            );
          })
        ) : (
          <AdminDataGridEmpty>
            <p className="text-base font-semibold text-white">لا توجد تصنيفات بعد</p>
            <p className="mt-2 text-sm text-white/45">ابدأ بإضافة أول تصنيف من زر «إضافة تصنيف».</p>
          </AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </div>
  );
}
