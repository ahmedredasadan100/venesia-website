# Admin UI Lockdown Rules

هذه القواعد إلزامية داخل لوحة الإدارة. أي خروج عنها يعتبر Bug وليس اختلاف تصميم.

## 1) Data Grid

أي جدول CRUD داخل الأدمن يجب أن يستخدم مكونات `src/components/admin/ui` فقط:

- `AdminDataGrid`
- `AdminDataGridHeader`
- `AdminDataGridRow`
- `AdminDataGridCheckbox`
- `AdminDataGridActionsCell`
- `AdminDataGridActionButton`
- `AdminBulkActionBar`
- `useAdminGridSelection`

ممنوع بناء جدول جديد بكلاسات محلية إذا كان يؤدي نفس وظيفة الـ Data Grid.

## 2) Selection + Bulk Actions

أي جدول فيه Checkboxes يجب أن يطبق القاعدة التالية:

- Header Checkbox يحدد كل الصفوف الظاهرة.
- Header Checkbox يفك تحديد كل الصفوف عند الضغط عليه مرة أخرى.
- حالة `indeterminate` تظهر عند تحديد بعض الصفوف فقط.
- `AdminBulkActionBar` يظهر فقط عندما `selectedIds.length > 0`.
- زر إلغاء التحديد يجب أن يستدعي `clearSelection`.

## 3) Action Buttons

ترتيب الإجراءات ثابت في كل الصفحات:

1. تعديل `edit`
2. إظهار / إخفاء `visibility`
3. نسخ `duplicate`
4. حذف `delete`

ممنوع رسم أيقونات الإجراءات داخل الصفحات. ممنوع استدعاء SVG أو Lucide مباشرة داخل أي Data Grid.

الصيغة الصحيحة:

```tsx
<AdminDataGridActionButton action="edit" href="..." />
<AdminDataGridActionButton action="visibility" type="submit" />
<AdminDataGridActionButton action="duplicate" type="submit" />
<AdminDataGridActionButton action="delete" type="submit" />
```

كل حجم ولون وأيقونة وHover وCursor يتم التحكم فيه من `AdminDataGridActionButton` فقط.

## 4) Cursor

كل عنصر تفاعلي يجب أن يظهر كمؤشر يد:

- Action Buttons
- Header Checkbox
- Row Checkbox
- Bulk Bar controls
- Sort labels
- Pagination controls

## 5) Dashboard Exclusion

صفحة `/admin` الرئيسية وكروتها تعتبر Pattern مستقل ولا يتم تعديلها ضمن CRUD UI Lockdown.

## 6) Golden Reference

المرجع البصري للجداول هو Topics Grid:

- نفس أحجام أزرار الإجراءات.
- نفس ترتيب الإجراءات.
- نفس ألوان الحالة.
- نفس Bulk Bar.
- نفس Pagination.
- نفس المسافات داخل الصفوف.

## 7) RTL Protection For Actions

Because the admin is RTL, action rows must keep the visual order fixed from the right edge: edit -> visibility -> duplicate -> delete. Use `dir="rtl"` on inline action containers unless the page deliberately uses a two-button pattern like Topics.
This prevents the visual order from flipping between pages.

Mandatory visual order remains:

`edit → visibility → duplicate → delete`

If a module cannot support one of these actions, the missing action must be documented in the page code with a clear reason. Otherwise, the action is considered missing.

## 8) Actions Column Containment

Every actions column must stay inside the table/card bounds. Overflow outside the grid is a bug.

Use the shared helpers from `AdminDataGrid`:

- `AdminDataGridActionsCell` — required wrapper for the actions grid cell.
- `AdminDataGridActions` — inner flex row only (used inside `AdminDataGridActionsCell`); never use `min-w-max`.
- `adminDataGridActionsColumn(count)` or `ADMIN_DATA_GRID_ACTION_COLUMNS` — fixed column width from button count.
- `compact` on `AdminDataGridActionsCell` when a row has 5+ buttons (40px buttons, tighter gap).

Rules:

- Forms wrapping submit buttons must use `className="contents"` so they do not expand the flex row.
- Action buttons always use `shrink-0`.
- Never rely on a wider column than `adminDataGridActionsColumn()` returns.
- Extra reorder/move buttons count toward the total button count.
