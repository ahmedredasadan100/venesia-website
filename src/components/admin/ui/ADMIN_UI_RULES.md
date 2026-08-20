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

### 1.e) Entity List Primary Presentation Contract

Every `AdminEntityList` primary column must declare all three identity properties: `primary: true`, `sticky: "start"`, and one explicit `primaryPresentation` value.

The supported shared variants are `text-only`, `compact-icon`, `standard-icon`, and `hierarchy`. Column `minWidth` and `width` values control track sizing only; they must never be used to infer padding, icon, hierarchy, or any other presentation behavior. Consumers may select a shared variant, but must not recreate its cell inset with local CSS or wrappers.

The executable presentation guards inspect every `primary: true` declaration. A valid sibling declaration in the same source file cannot mask a missing or invalid declaration.

### 1.f) Admin Data Grid Bulk Actions Rule

- لا يتم استخدام checkbox كديكور فقط داخل أي Data Grid.
- أي جدول يحتوي checkbox يجب أن يملك selection behavior واضحًا (عبر `useAdminGridSelection` أو `useAdminTable`).
- إذا كان الجدول يدعم إجراءات جماعية، يظهر **Bulk Actions Bar** (`AdminBulkActionBar`) عند تحديد صف أو أكثر فقط.
- Bulk Actions يجب أن تتبع النمط الموجود في الأدمن (`AdminBulkActionBar`) **بدون UI جديد** أو تعديل المكوّن المشترك.
- حماية الحذف أو أي قيود على البيانات تظل **server-side** ولا يتم تجاوزها في bulk actions (التلميح client-side مسموح لكنه لا يغني عن حماية السيرفر).

## 2) Selection + Bulk Actions

أي جدول فيه Checkboxes يجب أن يطبق القاعدة التالية:

- Header Checkbox يحدد كل الصفوف الظاهرة.
- Header Checkbox يفك تحديد كل الصفوف عند الضغط عليه مرة أخرى.
- حالة `indeterminate` تظهر عند تحديد بعض الصفوف فقط.
- `AdminBulkActionBar` يظهر فقط عندما `selectedIds.length > 0`.
- زر إلغاء التحديد يجب أن يستدعي `clearSelection`.

## 3) Action Buttons

كل Management Collection تعلن الإجراءات عبر `AdminDataGridRowActions` والعقد المشترك فقط:

- Quick Actions: `edit` ثم `preview` حيث يدعمهما الـDomain، ثم زر `more` العمودي.
- More Actions: `information` ثم `copyPublicLink` ثم `visibility` ثم `featured` ثم `duplicate` ثم `archive`/`restore` ثم `delete`.
- كل Entity تعلن صراحة `allowed` أو `hidden` أو `disabled`; لا تنشئ action rail أو SVG محليًا.
- أيقونة More يملكها `AdminDataGridActionIcon` وتبقى عمودية (`⋮`) في كل Consumers.

### 3.a) Manual Reorder

Reorder ليس Row Action ولا يُوضع داخل More. عندما يملك الـDomain عقد mutation ذريًا مع rollback، يستخدم surface عنصر Grip/Drag Handle مشتركًا في عمود مستقل مع keyboard equivalent. لا يجوز تمثيل السحب الحر بسلسلة adjacent writes غير ذرية؛ تبقى تلك الهجرة متوقفة حتى يعتمد Domain owner العقد المطلوب.

### 3.b) View Sorting vs Manual Reorder

يجب التمييز بوضوح بين نوعين مختلفين ولا يُخلط بينهما:

- **Table Sorting (View Sorting):** فرز عرض فقط عبر الضغط على عنوان العمود. يعيد ترتيب **الصفوف كاملةً كوحدة واحدة** (وليس خلية/عمودًا منفردًا). **لا يغيّر أي بيانات ولا يغيّر `sort_order`.** في الجداول المقسّمة لصفحات (paginated) يكون الفرز **server-side على كامل البيانات قبل الـ pagination** عبر query params (`?sort=...&dir=asc|desc`)، وليس فرز عميل للصفحة الظاهرة فقط. النقر: أول ضغطة `asc`، ثانية `desc`، ثالثة رجوع للـ default.
- **Manual Reorder:** يغيّر `sort_order` الحقيقي فقط عبر Domain mutation ذري مع rollback؛ الـpresentation لا يملك writes.
- **العزل بينهما إلزامي:** الـdefault view يكون حسب `sort_order ASC`. عند تفعيل فرز عرض مختلف، يُعطّل reorder بينما تبقى الإجراءات المعلنة عبر Row Actions فعّالة.

## 4) Cursor

كل عنصر تفاعلي يجب أن يظهر كمؤشر يد:

- Action Buttons
- Header Checkbox
- Row Checkbox
- Bulk Bar controls
- Sort labels
- Pagination controls

## 5) Empty / Loading / Error states

List empty states should use `AdminListEmptyState` for consistent title, helper copy, and primary action rhythm. Data grids may wrap it inside `AdminDataGridEmpty` when the table shell is shared.

## 6) Dashboard Exclusion

صفحة `/admin` الرئيسية وكروتها تعتبر Pattern مستقل ولا يتم تعديلها ضمن CRUD UI Lockdown.

## 7) Golden Reference

المرجع البصري للجداول هو Topics Grid:

- نفس أحجام أزرار الإجراءات.
- نفس ترتيب الإجراءات.
- نفس ألوان الحالة.
- نفس Bulk Bar.
- نفس Pagination.
- نفس المسافات داخل الصفوف.

## 8) RTL Protection For Actions

The Actions column is the last logical `inline-end` column and therefore the visual far-left column in RTL. The outer grid/table cell alone owns its sticky inset, separator, background, edge-flush placement, and full header/row height; the inner Row Actions rail only owns button order and spacing. Quick Actions keep `edit → preview → more`; unsupported actions are declared hidden or disabled in the capability contract.

## 9) Actions Column Containment

Every actions column must stay inside the table/card bounds. Overflow outside the grid is a bug.

Use the shared helpers from `AdminDataGrid`:

- `AdminDataGridRowActions` — the only Collection row-actions renderer.
- `AdminDataGridStickyActionsCell` / `AdminDataGridStickyActionsHeaderCell` — required table wrappers at logical `inline-end`.
- `ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact` — canonical fixed track for Edit, Preview, and More.

Rules:

- Action buttons always use `shrink-0`.
- Never rely on a wider column than the shared action-column contract.
- Reorder owns a separate track outside Row Actions and does not change the three-button width.

## 10) Page Context Header (`AdminPageHeader`)

`AdminPageHeader` و`AdminPageContextHeader` يعرضان ترويسة موحّدة من ثلاثة مستويات منطقية فقط:

1. **Engine Label** عبر `eyebrow`، ويُكتب بالإنجليزية Uppercase.
2. **Page Title** عبر `title`.
3. **Page Description** عبر `description`.

أي معلومة سياقية ضرورية تُدمج داخل `description` أو تُنقل إلى موضع وظيفي مناسب. لا يوجد سطر سياقي مستقل ولا نمط سياقي موازٍ. تبقى الإجراءات والبيانات الوصفية داخل الـdock المشترك، ويلتف المحتوى والأزرار دون overflow على الشاشات الضيقة.
