# Admin UI Lockdown Rules

## Capability Preservation Before Visual Replacement

أي تطوير بصري يحافظ على جميع القدرات والتفاعلات السابقة المنطبقة، ما لم يعتمد المالك إلغاءها صراحة. قبل استبدال Presentation يُراجع المالك الحالي وConsumer والقدرات وحالاتها؛ ثم يتغير العرض داخل المالك أو Port اختياري مع حفظ Defaults لغير المتبنين.

يشمل ذلك Hover/Focus/Animation وReduced Motion، والبحث والفلاتر وReset والفرز، والأعمدة وتفضيلاتها، والتحديد والإجراءات الفردية والجماعية، والقوائم وKeyboard/عودة Focus، وPagination وحجم الصفحة، والصلاحيات وDisabled/Pending/Confirmation/Error والحفظ. لا يمنح اختلاف الموكاب تصريحًا لحذف قدرة أو تبديل Query/Mutation/Auth/Data ownership. تُصلح العيوب المرتبطة بالنطاق عند الجذر؛ لا CSS أو Lifecycle أو Provider موازٍ.

تثبت صيانة التبنّي Source Proof والتحقق المتأثر وDefaults وحالات الفشل، وتفصل دليل Fixture عن المسار الفعلي وCSS الذي يقدمه Next. نجاح الحارس أو المعاينة التقنية لا يمنح Owner Functional/Visual Approval ولا Global Closure.

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

كثافة الترويسة ومحاذاة مستوياتها ومسافة الـdock يملكها `AdminPageContextHeader`؛ يستخدم التكوين المضغوط المشترك دون هوامش محلية أو ارتفاع ثابت. تبقى حالات `minimal` و`badge/status` والروابط والبيانات الوصفية وفق عقدها، بينما هيدر الشركة وDashboard والترويسات الوظيفية داخل الصفحة استثناءات متخصصة.

## 11) Premium Admin Composition

هذه قواعد اختيار وتركيب لقدرات العرض الموجودة، وليست Component أو Variant أو Runtime جديدًا. يختار Composition Owner الحالي التكوين المناسب لطبيعة الوظيفة؛ لا تصبح Premium Card إلزامية لكل حقل، ولا يتغير أي مستهلك دون تبنٍّ مقصود. تبقى Shared Defaults كما هي.

### 11.a) اختيار الملاك

| طبيعة الإعداد | التركيب المعتمد | حدود الملكية |
|---|---|---|
| حقل منفرد يحتاج تجميعًا بصريًا | `AdminCard presentation="premium"`، و`AdminFormControlHeader`، والتحكم المشترك الأصلي | البطاقة تملك السطح فقط؛ تبقى القيم والحدود والتحقق عند Domain Owner |
| مجموعة اختيارات متعددة | `fieldset` بتسميته الدلالية الحالية، مثل `legend` أو ربط `aria-labelledby`، وبطاقة Premium واحدة، وHeader واحد، و`AdminCheckbox` لكل اختيار | تظل `name/value/checked/defaultChecked/onChange` والتسميات وفق العقد الحالي؛ لا تُستبدل Checkboxes بأزرار أو State موازية |
| إعداد Boolean مستقل داخل بطاقة قائمة | `AdminFormSwitch embedded`، مع تمرير العنوان أو الهيدر إلى `label` عند الحاجة | البطاقة الخارجية تملك السطح، والسويتش يملك التحكم والتسمية الأصلية؛ `embedded` اختياري ولا يغيّر فرعي `surface` الحاليين |
| اختيار منفرد | `AdminFormListboxSelect` أو Shared Choice Controls المعتمدة عند ملاءمة عقدها | `adminChoiceButtonClassName` يملك المظهر فقط؛ لا يستبدل دلالات الاختيار أو Keyboard أو State Owner |
| نص له إظهار وتنسيق | `ModuleEditorVisibilityAlignRow presentation="premium"` عند ملاءمته | تبقى أدوات التنسيق والإظهار عند مالكها؛ لا Toolbar مستقل ولا تغيير لنوع النص أو تخزينه |
| حقول مترابطة أو إعداد رئيسي | `AdminFormGrid` الحالي؛ مجموعة بعرض مناسب، وقد يكون كامل العرض | عدد الأعمدة قرار عرض، وعدد الحقول وشروطها قرار العقد؛ لا حقول وهمية لملء الصف |

### 11.b) السطح والهيدر والتوزيع

- سطح بصري واحد لكل وظيفة أو مجموعة: عند استخدام `AdminCard` لا تضف إطارًا داخليًا يؤدي الوظيفة نفسها. استخدم `embedded` للسويتش المستقل عند ملاءمته، مع الحفاظ على تركيبات الإظهار والتنسيق الحالية.
- Header واحد للوظيفة، من مالكها المنطبق، بعنوان يعرّف الوظيفة؛ الوصف اختياري حسب الحاجة. يحتفظ هيدر الحقل أو المحتوى الداخلي بعقد الأيقونة الاختيارية الحالي. الهيدر التابع للتبويب لا يُعاد داخل محتوى القسم. `legend` الدلالي أو التسمية المخفية لا يضيفان عنوانًا بصريًا ثانيًا.
- يجب التمييز بين هيدر الحقل أو المحتوى الداخلي [AdminFormControlHeader](./AdminForm.tsx)، وهيدر القسم الكامل [AdminModuleSectionHeader](./AdminModuleTabs.tsx) المتاح من مالك `AdminModuleTabs`، بعروض `sectionHeaderPresentation` القائمة `default` و`control` و`panel`. يُستخدم `default` أو `control` للقسم المستقل مع سطحه المؤطّر الحالي، و`panel` للقسم المضمّن داخل `AdminCard` القائمة؛ تملك البطاقة سطح الوظيفة ويملك الهيدر الفاصل الداخلي دون إطار ثانٍ. اختلاف العرض يحدد السطح والتركيب، ولا ينشئ هوية هندسية مختلفة للعنوان والأيقونة. استخدام الهيدر الداخلي وحده لا يحقق تبنّي هيدر القسم الكامل عندما ينطبق عقده، وتبقى قاعدة عدم تكرار هيدر التبويب داخل محتواه سارية.
- عند Premium Adoption تجب مراجعة تركيب الصفحة كاملًا وفق `Page → Section → Header → Fields → Actions → Save Bar`، وتحديد الـCanonical Owner والـVariant الحالي المنطبق لكل مستوى، أو توضيح عدم انطباقه ضمن المراجعة الحالية. هذه سلسلة مراجعة لمسؤوليات التركيب؛ قد توجد Actions داخل Save Bar وفق مالكها، ولا يثبت استخدام Shared Fields أو Cards وحده اكتمال Premium UI Adoption؛ يشمل الحكم الـLayout والـHeaders والـActions والـSave Bar المنطبقة.
- تُسجّل المراجع وقرارات Required/Optional/Not Applicable وحدود العناصر المحفوظة خارج التنفيذ وفق [AI Working Rules Section 10.1.4](../../../../docs/AI_WORKING_RULES.md#1014-adoption-completeness-before-delivery--شرط-دائم-للتعميم)؛ ينطبق ذلك على الأقسام الفرعية والإجراءات وField States أيضًا. طلب Section محدود لا يمنح Whole Form Approval، واختلاف الوظيفة لا يُسقط Presentation المطلوبة لها؛ يبقى التنفيذ ضمن التفويض الحالي.
- ملكية المسافات: يحدد المالك المسؤول المسافات داخل القسم، ويُحتسب الفاصل بين الهيدر ومحتواه مرة واحدة؛ لا يُجمع تباعد الهيدر مع Gap من Layout آخر لنفس الفاصل. يحدد Shared Layout/Stack المعتمد المسافات بين الأقسام وشريط الحفظ، ويُطبَّق على العناصر الفعلية التي يرتبها. يلتف العنوان والوصف والمحتوى المساند طبيعيًا، ولا يُفرض ارتفاع متساوٍ للهيدرات بسبب وجود وصف أو اختلاف طوله. ممنوع استخدام Local CSS أو Tailwind أو Inline Styles أو قيم Margin/Gap مستقلة لترقيع خلل التوزيع بدل تصحيح التركيب عند مالكه المنطبق.
- Central Ownership: لكل قدرة مشتركة Canonical Owner واحد؛ تنعكس التعديلات المصرّح بها في المالك أو الـVariant المعتمد مركزيًا على جميع المستهلكين المتبنين لنفس العقد والـVariant، مع مراجعة أثرها عليهم. لا يجوز إنشاء تنفيذ محلي موازٍ عندما توجد قدرة مشتركة مناسبة. تُحفظ الاستثناءات المتخصصة الصحيحة وفق عقودها؛ لا يعني هذا تغيير اختيار الـVariant لغير المتبنين أو تجاوز قواعد Shared Defaults والتفويض الحالية.
- تُراجع الصفحة عند [AdminPageContextHeader](./AdminPageContextHeader.tsx) بعرضيه الحاليين `default` و`minimal`، والقسم عند مالكه المنطبق، والحقول عند [AdminFormGrid](./AdminFormRuntime.tsx) و[AdminFormField](./AdminForm.tsx) و[AdminCard](./AdminCard.tsx) بعرض `premium` حيث يلائم العقد. إجراءات نماذج `AdminFormRuntime` تبقى عند [AdminFormActions](./AdminFormRuntime.tsx) الذي يستخدم [AdminStickyFormBar](./AdminForm.tsx)، مع حفظ Save وDirty وPending وDisabled وFeedback والعودة. يبقى `ModuleEditorSaveArea` في [مالك محررات Blocks](../page-blocks/ModuleEditorPresentation.tsx) ضمن عقده المتخصص.
- هذه إحالات إلى الملاك والـVariants والتسجيلات الحالية؛ لا تنشئ Registry أو Manifest جديدًا لمجرد تبنّي قدرة موجودة. لا يُفرض هيدر أو Save Bar على مستهلك لا ينطبق عليه عقده، ولا تُغيَّر Shared Defaults أو دورة الحفظ لتحقيق التبنّي البصري.
- الخطوط والأيقونات وأبعاد التحكم وHover/Focus/Selected/Disabled تأتي من الملاك والتوكنز المشتركة، دون مقاييس أو CSS خاص بالمستهلك. تتبنى جميع هيدرات الأقسام المتكافئة في `default` و`control` و`panel` هوية `leading-icon` الحالية نفسها: أيقونة SVG بمقاس `20px` داخل إطار `40px`، وعنوان `14px` بوزن `600`، بالترتيب المنطقي أيقونة ثم فاصل رأسي ثم عنوان مع حفظ RTL، ومسافة `12px` بين العناصر ومحاذاة رأسية وسطية والتفاف طبيعي. لا تُقبل تجاوزات هندسية محلية لهيدر قسم مؤهل دون استثناء موثّق؛ تبقى Page Headers وField Headers والاستثناءات المتخصصة الصحيحة وفق عقود ملاكها.
- استخدم `AdminFormGrid` العادي حول بطاقات Premium القائمة. لا تجمعه مع `presentation="control-cards"` لإعادة رسم سطح البطاقة؛ و`aligned-fields` مخصص لبنية الحقول المتوافقة معه، وليس بديلًا عامًا لشبكة البطاقات.
- اختر `columns` وفق مساحة الحقول وعلاقتها؛ `columns={3}` يوفر توزيع Desktop/Tablet/Mobile ‏3/2/1 الحالي عندما يناسب المحتوى. ليس مطلوبًا فرضه على مجموعات الاختيارات أو كل شاشة. Nested Grids مسموحة من المالك نفسه عند وجود علاقة وظيفية. لتركيب عمودين بنسبة60/40، يتاح المنفذ الاختياري `columnRatio="3:2"` مع `columns={2}` عند المالك نفسه؛ يستخدم من `md` مساري `minmax(0,3fr)` و`minmax(0,2fr)`، ويعود إلى عمود واحد على Mobile مع ترتيب DOM الأصلي. Plain ratio يبقى `items-start`؛ وعند اختيار `presentation="equal-height-columns"` الموجود، تتمدد حاويتا العمودين طبيعيًا إلى الارتفاع الخارجي نفسه، دون ارتفاع ثابت أو تمديد المحتوى الداخلي، ولا يُجمع معه `items-start` المتعارض. حذف المنفذ أو اختيار عدد أعمدة آخر يحفظ العقد السابق؛ لا تُكرر النسبة بـCSS محلي. عند تكديس Sections أو Panels داخل Grid، اختر منفذ `density="sections"` للحصول على `gap-5` والمسافة canonical ‏20px؛ يبقى `default` و`compact` على مسافات الحقول الحالية دون تغيير.
- اترك الصف الأخير بعدد عناصره الفعلي؛ تساوي ارتفاع البطاقات المتجاورة يأتي من التمدد الطبيعي دون ارتفاع ثابت أو قص. يبقى RTL وترتيب الوظائف وفق العقد الحالي.

- كروت الإحصائيات تستخدم `AdminMetricCardsGrid` و`AdminMetricCard`؛ يمرّر المستهلك الأيقونة الدلالية من المالك الموجود، وتبقى القيمة والتسمية والحالة والتفاعل هي المصدر الوظيفي. يلتف الـgrid عند نقص المساحة دون فرض صف بعرض ثابت أو تمرير خاص بالكروت، مع الحفاظ على مساحة الـhover/focus. كروت Dashboard المباشرة تحتفظ بتكوينها المتخصص.
- هوية أي scrollbar ضروري داخل Admin تأتي من `VENESIA_SCROLLBAR_VISUAL_CLASSES` والـutility البصري المشترك نفسه، بما فيه تمرير الوثيقة والقوائم. يبقى قرار `overflow` وأبعاد الحاوية عند مالكها؛ لا إخفاء شامل للأشرطة ولا قص للمحتوى لعلاج تجاوز العرض، ويحتفظ الجدول بتمريره الأفقي المسمّى والقابل للوصول بلوحة المفاتيح.

### 11.c) الدلالات والحفظ والتبنّي

- الاختيارات المتعددة تحتفظ بالتجميع والتسمية الدلاليين الحاليين وNative Labels؛ في Search يبقى `fieldset/legend` الأصلي. النقر على نص الاختيار وKeyboard/Focus يستخدمان التحكم الأصلي. لا تجعل البطاقة كلها قابلة للنقر بإضافة معالج موازٍ.
- اربط الوصف والتسمية بالتحكم دون تكرار الاسم المقروء. لا تعتمد على الأيقونة أو اللون وحدهما للتعريف بالحالة.
- يبقى الإعداد الرئيسي في مجموعة واضحة، وقد يُعرض بعرض كامل عندما يحسن القراءة. لا تستنتج شروط إظهار أو تعطيل جديدة من الصورة أو من حجم البطاقة.
- يحافظ المالك الحالي على شروط الحقول وقيمها غير النشطة. تبقى تبويبات الإدارة المركّبة ضمن FormData وفق عقد `AdminModuleTabs`؛ لا State أو Serializer أو Save Lifecycle موازٍ.
- لا يتغير Storage أو Validation أو Public Rendering أو الصلاحيات أو Status أو Page Assignments بسبب تبنّي العرض. أي نقص مشترك يُثبت أولًا ويُعالج عند مالكه، مع Opt-in عند اختلاف متطلبات المستهلكين.
- تستخدم اختبارات التبنّي والحراس الحاليين فقط: جرد القدرات قبل/بعد، الحالات الشرطية، اختيار وإلغاء الاختيار، Keyboard/Focus، حفظ وقراءة معزولان، عرض عام، وDesktop/Tablet/Mobile/RTL. يُراجع أثر المستهلكين، وتُعاد الفحوص المتأثرة فقط وفق [QA_RELEASE_CLOSURE.md](../../../../docs/QA_RELEASE_CLOSURE.md)؛ الاعتماد البصري النهائي للمالك.

### 11.d) تطبيق Search Platform

التبنّي عند `SearchPlatformModuleEditor` لكل مستهلك يحله سجل المحررات إلى `search-platform`، دون قائمة IDs محلية:

- تبقى التبويبات `content / search / presentation / pages` وتسمياتها الوظيفية الحالية؛ التبويبان القديمان `content/pages` محفوظان.
- النصوص وأدواتها داخل `content`؛ نطاق البحث بعرض كامل داخل `search`، يليه Grid مشترك لمجموعتي أنواع المحتوى والفلاتر، مع بطاقة Premium وهيدر واحد لكل مجموعة و`AdminCheckbox` الأصلي.
- عدد النتائج وطريقة العرض والترتيب تبقى داخل `presentation`؛ تعيين الصفحات وروابط إدارة الموضع تبقى عند `ModulePageAssignmentsField` داخل `pages`. تحرير الموضع والترتيب يظل عند Page Composition.
- تظل الحقول الـ25 وشروطها وقيمها عند عقد Search الحالي. لا يُخفى اختيار الأنواع أو الفلاتر تلقائيًا بسبب النطاق أو `compact`، ولا يتغير تطبيع `all` أو مسار واجهة النتائج العامة بسبب هذا التركيب.

أمثلة الملاك القائمة: [SearchPlatformModuleEditor](../page-blocks/editors/SearchPlatformModuleEditor.tsx) و[FeedPresentationVariantFields](../page-blocks/FeedPresentationVariantFields.tsx). المرجع هو تركيب الملاك، وليس نسخ حقول عائلة إلى أخرى.

### 11.e) مرجع تركيب تحرير الزر (CTA)

مرجع تبنّي تحرير زر مستقل يجمع النص والرابط وإعدادات المظهر والسلوك هو [AboutIntroModuleEditor](../page-blocks/editors/AboutIntroModuleEditor.tsx)، عبر `default export` مع `editorMode="home-story"` و`section="cta"`. هوية المرجع هي هذا المسار والتصدير والوضع والقسم؛ رقم سجل الموديول في بيئة معينة ليس هوية للعقد.

- يتبنّى المحرر مجموعتين وظيفيتين واضحتين: **بيانات الزر** للنص والوجهة عبر `AdminLinkField`، و**مظهر وسلوك الزر** للإعدادات التي يدعمها عقده. استخدام المكونات نفسها، أو جمع النص والرابط وحدهما، لا يثبت تبنّي هذا التركيب الكامل. نسب `4/8` أو توزيع `2×2` ليست شروطًا ثابتة؛ يُختار التوزيع من الشبكات الحالية وفق الحقول الفعلية.
- يُسجَّل المرجع المختار والفروق المقصودة في جرد القدرات القائم قبل التنفيذ. اختلاف العقد، مثل زرَّي Hero الأساسي والثانوي أو خيارات نمط CTA، يُراجع عند المحرر الحالي ويُوثَّق؛ لا يبرر نسخ حقول Story أو تغيير أسماء الحقول وDefaults أو إضافة قدرات لإكمال الشكل.
- يُعلن انطباق هذا المرجع داخل `composition` في بيانات قسم المحرر الحالية في [module-registry-metadata.ts](../../../lib/page-composition/module-registry-metadata.ts)، بعلاقة `reference` أو `adopter` وهوية المصدر والتصدير والوضع والقسم، مع سبب الاختيار والفروق العقدية. يحل المالك الحالي العلاقة صراحةً؛ غياب التعريف لا يعني اعتمادًا أو استثناءً، وهذه العلاقة لا تثبت اكتمال التبنّي أو الاعتماد البصري.
- يراجع QA القائم المرجع والمستهلك معًا على Desktop/Mobile/RTL والتفاعل ذي الصلة؛ تسجّل حالة القبول هوية المصدر والمرجع، وحالة العقد/الوضع، والـviewport، والدليل الحالي.
  تُثبت دلالات `Mounted / Visible / Enabled / Submitted / Persisted` عند الـEditor والـSerializer ومسار الحفظ الفعلي، مع بقاء القيم والشروط المعتمدة.
  تبقى `TechnicalVisualVerification` مستقلة عن `OwnerApproval`؛ نجاح Source Guards لا يحل محلهما، وتُراجع [صلاحية الدليل](../../../../docs/QA_RELEASE_CLOSURE.md#34-evidence-validity-after-a-head-change) عند تغير المدخلات. لا ينشأ سجل أو Runtime أو Capability جديدة لهذا الغرض.

### 11.f) Compact Inline Settings

المالك هو `ModuleEditorVisibilityAlignRow presentation="premium"` القائم. المرجع الوظيفي المحدود هو صفّا النص في [AboutApproachModuleEditor](../page-blocks/editors/AboutApproachModuleEditor.tsx)، عبر `default export` داخل تبويب `content` دون وضع إضافي. تسجّل `composition` الحالية هذا المصدر وهوية [الصورة المقدمة](../../../../docs/references/admin/compact-inline-settings.png) `Premium Arabic Inline Settings UI Guide.png` ومسار نسختها المطابقة داخل المستودع وبصمتها؛ التسجيل يحدد مرجع المقارنة ولا يمنح اعتمادًا بصريًا لبقية المستهلكين.

- يجمع الصف الأول الأيقونة والعنوان، ثم أدوات التنسيق المدعومة، ثم الإظهار في RTL. تستخدم الهيدر والأدوات والسويتش ملاكها الحاليين؛ لا Toolbar محلي ولا أدوات تكميلية للشكل. صف بلا مدخل يبقى مضغوطًا دون ارتفاع ثابت أو مساحة بطاقة فارغة.
- إن وجد مدخل، يأتي في صف تالٍ بعرض البطاقة الداخلي كاملًا، بما فيه المساحة أسفل الأيقونة والخط؛ لا عمود أو Spacer محجوز للأيقونة. هذا النص يتقدم على ملاحظة الإزاحة داخل الصورة. تبقى الأوصاف وتسميات الحقول متاحة، ويلتف الهيدر عند ضيق المساحة الفعلي دون overflow.
- تختار خصائص العقد الحالية الإظهار والتنسيق: لا `bold` أو محاذاة بلا دعم أصلي، ولا تغيير إلى Rich Text لإكمال الأدوات. تبقى Rich Text وMarkdown وMedia وRepeaters والحقول المركبة عند ملاكها المتخصصين؛ لا تُفرض عليها هندسة صف نص عادي. اختلاف الوظيفة يُوثّق بدل نسخ أدوات المرجع.
- تبقى أسماء الحقول وDefaults وState وHidden Inputs والشروط والحفظ كما هي. لا تتغير عروض `card/plain` أو `AdminFormControlHeader` و`AdminTextFormatControls` و`AdminFormSwitch` الافتراضية؛ الاختيارات المضافة صريحة ومحدودة.
- يثبت الحارس المصدر الفعلي، وأصل التحكم، واحتواء الأدوات في الهيدر والمدخل في الجسم التابع له، ويرفض الأدوات المفقودة أو غير المدعومة والتجميع الخاطئ وSpacer المدخل باختبارات سلبية. هذا إثبات بنيوي وسلوكي محدود؛ عرض المدخل الفعلي، والارتفاع والالتفاف وRTL وKeyboard/Focus تتطلب Browser QA الحالي على Desktop/Tablet/Mobile، ثم `OwnerApproval` المستقلة.
