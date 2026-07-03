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

### 1.a) Cell Contract (إلزامي)

كل خلية داخل أي Data Grid يجب أن تستخدم الغلاف الرسمي المخصص لنوعها. أي wrapper محلي يكسر هذه القواعد يعتبر Bug وليس اختلاف تصميم.

- ممنوع أي wrapper محلي للـ checkbox (مثل `flex justify-center` أو `xl:block`). أي checkbox — في الهيدر أو الصف — يجب أن يكون داخل `AdminDataGridCheckboxCell` (الذي يستخدم دائمًا `flex items-center justify-center`). يُسمح داخله بـ `AdminDataGridCheckbox` أو `<input>` خام (لحالة الـ bulk بـ data-attrs).
- أي **primary column** (العمود الرئيسي: الصفحة / الموضوع / القالب / القائمة / السلسلة) يجب أن يستخدم `AdminDataGridPrimaryCell`.
- أي **secondary / centered column** (النوع / التصنيف / العدد / Slug / تاريخ النشر) يجب أن يستخدم `AdminDataGridCenterCell`.
- أي **status pill** (حالة النشر أو الظهور) يجب أن يكون داخل `AdminDataGridStatusCell`.

### 1.b) Column Presets (إلزامي)

أي عرض عمود يجب أن يأتي من `ADMIN_DATA_GRID_COLUMNS` أو `ADMIN_DATA_GRID_ACTION_COLUMNS`. ممنوع رقم columns محلي جديد **إلا** مع تعليق واضح يشرح لماذا لا يكفي أي preset.

Presets المتاحة في `ADMIN_DATA_GRID_COLUMNS`:

- `checkbox` = `46px`
- `primaryStandard` = `minmax(320px,1fr)` — للجداول التي عمودها الرئيسي نص طويل/مركز الجدول.
- `primaryCompact` = `minmax(260px,1fr)` — للجداول متعددة الأعمدة (Pages / Menus).
- `statusCompact` = `88px` — لحالات قصيرة (ظاهر / منشور).
- `statusStandard` = `96px` — لحالات أطول أو جداول عامة (default الأأمن مع العربية).
- `count` = `72px`
- `slug` = `150px`
- `slugCompact` = `120px` — عمود slug/كود مختصر للجداول الكثيفة (Menus).

### 1.c) Row Separators

فواصل الصفوف جزء من الـ Contract وتُفعّل عبر `AdminDataGridRow divided` (يطبّق `divide-y`-equivalent مطابقًا لـ Topics). تطبيقها على الجداول القديمة يكون تدريجيًا/باعتماد بصري منفصل، وليس بكلاسات محلية.

### 1.d) Admin Data Grid Contract V1 — Usage Pattern

الاستخدام القياسي لأي Data Grid يتبع النمط التالي (توثيق مرجعي سريع):

- **عرّف الأعمدة** من `ADMIN_DATA_GRID_COLUMNS` للأعمدة، ومن `ADMIN_DATA_GRID_ACTION_COLUMNS` لعمود الإجراءات.
- **الـ checkbox** (هيدر وصفوف) داخل `AdminDataGridCheckboxCell`.
- **العمود الأساسي** داخل `AdminDataGridPrimaryCell`.
- **الأعمدة الثانوية** داخل `AdminDataGridCenterCell`.
- **الحالة (status pill)** داخل `AdminDataGridStatusCell`.
- **الإجراءات** بعرض من `ADMIN_DATA_GRID_ACTION_COLUMNS`، وداخل `AdminDataGridActionsCell`.
- **ممنوع** أي wrapper محلي (مثل `flex justify-center` أو `xl:block`) أو أي column width عشوائي بدون preset رسمي أو استثناء موثّق بتعليق.

مثال مرجعي:

```tsx
const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

<AdminDataGrid summary={...}>
  <AdminDataGridHeader columns={columns}>
    <AdminDataGridCheckboxCell>{/* AdminDataGridCheckbox */}</AdminDataGridCheckboxCell>
    <AdminDataGridPrimaryCell>{/* العمود الأساسي */}</AdminDataGridPrimaryCell>
    <AdminDataGridStatusCell>{/* عنوان الحالة */}</AdminDataGridStatusCell>
    <div className="text-center">الإجراءات</div>
  </AdminDataGridHeader>

  {rows.map((row) => (
    <AdminDataGridRow key={row.id} columns={columns}>
      <AdminDataGridCheckboxCell>{/* AdminDataGridCheckbox */}</AdminDataGridCheckboxCell>
      <AdminDataGridPrimaryCell>{/* المحتوى */}</AdminDataGridPrimaryCell>
      <AdminDataGridStatusCell>{/* AdminStatusPill */}</AdminDataGridStatusCell>
      <AdminDataGridActionsCell compact>{/* AdminDataGridActionButton */}</AdminDataGridActionsCell>
    </AdminDataGridRow>
  ))}
</AdminDataGrid>
```

النطاق المعتمد لـ V1: `Pages` · `Menus` · `PageBlocks` فقط. أي توسيع لاحق يتم عبر جلسة `Admin Data Grid Contract Rollout — Batch 1`.

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
