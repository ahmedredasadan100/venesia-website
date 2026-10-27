# قواعد العمل الرسمية مع وكلاء الذكاء الاصطناعي
## Venesia Website/CMS

**الحالة:** مرجع تشغيلي حاكم
**ينطبق على:** Codex وCursor وClaude وأي وكيل برمجي آخر
**المرجع المعماري الأعلى:** `AI_ARCHITECTURE_PRINCIPLES.md`

هذه القواعد ملزمة في كل مرحلة فحص أو تخطيط أو تنفيذ أو مراجعة أو إغلاق. نجاح الكود وحده لا يكفي؛ يجب أن يكون التنفيذ صحيحًا معماريًا، آمنًا، محدود النطاق، ومثبتًا على الحالة الدقيقة للكود.

---

## 1. يبدأ بالفحص، لا بالتنفيذ الأعمى

قبل لمس أي ملف، يثبت الوكيل:

- اسم الـRepository ومساره المحلي.
- الفرع الحالي.
- الـHEAD الحالية.
- الـBaseline المطلوب البناء عليها.
- حالة الـPR إن وجدت.
- حالة الـWorking Tree.
- الملفات المعدلة.
- الملفات والـUntracked المحمية.
- ما الموجود بالفعل.
- من يملك السلوك المطلوب حاليًا.

لا يعتمد على الذاكرة أو ملخص جلسة أو اسم ملف عندما يستطيع إثبات الحقيقة من Git والكود والعقود.

> لا تنفيذ قبل تثبيت الواقع.

Discovery محدودة بالمالك والـConsumers والعقود المتأثرة. يُعاد استخدام الواقع المثبت والأدلة السارية، ولا تُعاد جولة استكشاف شاملة لكل تعديل. عند متابعة Batch محفوظة، يبدأ العمل من فرعها وHEAD الفعلية دون إعادة تنفيذ العمل أو تغيير الفرع تلقائيًا؛ إعادة تقييم الـBaseline تكون عند تغير ذي أثر أو متطلبات إصدار مثبتة.

---

## 2. يقرأ المراجع الملزمة

ترتيب القراءة:

1. `AGENTS.md`
2. `AI_ARCHITECTURE_PRINCIPLES.md`
3. `docs/AI_WORKING_RULES.md`
4. `docs/CURRENT_PROJECT_STATE.md`
5. أي `AGENTS.md` فرعي للمسار
6. عقود الـRuntime والـCapability
7. الـAdapters والـRegistries والـAdoption Manifests
8. الـArchitecture Guards والاختبارات والـMigrations
9. تعليمات Next.js المثبتة داخل `node_modules/next/dist/docs/`

الملفات الحاكمة تُقرأ فقط ما لم يكن نطاق المهمة هو تحديثها صراحة.

---

## 3. يصنّف المهمة قبل التنفيذ

التصنيفات المسموح بها:

- Audit Only
- Plan Only
- Documentation / Policy Update
- UI/UX Consumer Change
- Shared Component Correction
- Runtime Adoption
- Capability Adoption
- Adapter Change
- Domain / Entity Change
- Data / Read Model Change
- Migration
- Security / Auth Change
- New Runtime / System Proposal

ويصنّف كذلك أي اختيار غير محسوم إلى:

- Product Decision: سلوك المستخدم أو العمل المقصود.
- Architecture Decision: المالك أو الـLifecycle أو العقد أو اتجاه الاعتماد أو مصدر الحقيقة.
- Implementation Detail: اختيار محدود حسمته القواعد المعتمدة بالفعل.

الوكيل ينفذ الـImplementation Detail داخل النطاق، لكنه لا يخترع Product Decision ولا يعتمد Architecture Decision ماديًا من تلقاء نفسه.

لا يسمّي Adoption نظامًا جديدًا، ولا يحول عيب شاشة واحدة إلى مرحلة معمارية عامة دون دليل.

---

## 4. التفريق الملزم بين الملكيات

### System

مظلة معمارية تنظم نطاقًا متماسكًا: Runtimes وCapabilities وعقود واختبارات واعتماد وإغلاق.

### Runtime / Motor

يملك Lifecycle مشتركة واحدة وحالتها، مثل:

- Pending
- Dirty state
- Fetch / Cache / Cancellation
- Optimistic mutation / Rollback
- Feedback lifecycle
- Confirmation lifecycle

لا يملك قواعد كيان، ولا يتحول إلى God Runtime.

### Capability

تملك وظيفة منتج قابلة لإعادة الاستخدام، مثل:

- Publishing
- SEO
- Preview / Public View
- Slug
- Media
- Taxonomy
- Revision History
- Visibility
- Permissions

القدرة تُبنى مرة واحدة ثم تتبناها الكيانات.

### Entity / Domain

يملك:

- Validation الخاصة بالكيان
- Business rules
- Domain invariants
- Persistence
- Relations
- Atomic transactions
- Audit semantics

### Adapter / Consumer

يربط الكيان بالعقد المشترك ويترجم الحدود فقط. لا يملك Lifecycle أو Cache أو Pending أو Feedback أو Navigation موازية.

### Shared Component

يملك العرض والتفاعل العام وAccessibility وRTL وResponsive behavior وPresentation-local state فقط. لا يملك Business Logic أو Database rules.

### القاعدة الحاكمة

> الموتور يملك Lifecycle مشتركة واحدة.
> القدرة تُبنى مرة واحدة وتتبناها الكيانات.
> الـAdapter يترجم ولا يملك التشغيل.
> الشاشة لا تعيد اختراع النظام.

> Build once. Adopt everywhere. Fix shared defects at the shared owner.

---

## 5. البحث الإلزامي عن المالك المكرر

قبل التنفيذ يبحث الوكيل عن:

- Form owner مكرر.
- Save owner مكرر.
- Actions متداخلة تحفظ نفس الـPayload.
- Pending أو Dirty state محلية مع وجود Runtime مشتركة.
- Feedback أو Toast أو Notice محلي.
- Confirmation محلية.
- Fetch أو Cache engine موازٍ.
- مصدرين لنفس الحقل.
- Hidden Input وVisible Control غير متزامنين.
- أكثر من عنصر يحمل نفس اسم الحقل.
- `router.refresh()` كحل افتراضي لمسار Instant.
- `window.confirm`.
- Redirect أو Navigation owner موازٍ.
- Runtime أو Manager خاص بالشاشة مع وجود Shared Owner.
- Direct privileged database/storage access من Client Component.
- Entity hard-coding داخل Shared Core.

Adoption غير مكتمل طالما المالك القديم ما زال فعالًا بالتوازي.

---

## 6. بوابة إنشاء مالك جديد

لا تُنشأ Runtime أو Capability أو System أو Global Provider جديدة إلا بعد:

1. إثبات Gap عام حقيقي.
2. شرح لماذا المالك الحالي لا يصلح.
3. إثبات أن Adapter أو Contract Extension أو Domain Service أو Component Variant غير كافٍ.
4. تعريف الـLifecycle أو الوظيفة والحدود والحالة والفشل.
5. تحديد الـReference Consumers.
6. تحديد ما سيُزال من الملكيات القديمة.
7. إعداد ADR.
8. التوقف لأخذ موافقة Project Owner قبل التنفيذ.

الوكيل لا يعتمد تغييرًا معماريًا كبيرًا من تلقاء نفسه.

---

## 7. ينفذ الـReal Delta فقط

بعد Discovery والتصنيف:

- يعدّل الملفات الضرورية فقط.
- لا ينفذ Refactor جانبيًا.
- لا يضيف Library بلا حاجة مثبتة.
- لا يغير Auth أو Permissions أو Database أو Migrations دون تفويض مستقل.
- لا يوسع المرحلة.
- لا يلمس الملفات المحمية أو غير المرتبطة.
- لا يصلح ملاحظات قديمة خارج النطاق.
- لا يحول التصحيح إلى إعادة بناء كاملة.
- لا ينقل Business Logic إلى Shared Component.
- لا يضع Entity-specific logic داخل Shared Core.

الهدف هو أصغر تغيير صحيح داخل المالك الصحيح.

### Delta Recovery

عند التعامل مع PR أو Branch قديم، يطبق نمط Delta Recovery الحاكم في Sections 5.35 و28.8.3 وADR-024 من الدستور: أحدث `main` هو الـBaseline، والسلوك الفعلي هو الدليل، ولا تُستعاد ملكية أو عقود Superseded.

---

## 8. متى ينفذ ومتى يتوقف؟

### ينفذ مباشرة عندما

- الواقع مثبت.
- المالك معروف.
- التغيير Adoption أو Gap Closure أو Shared Correction داخل عقد قائم.
- لا يوجد Product Decision.
- لا توجد Migration خطرة.
- لا يوجد Data-loss risk.
- لا يوجد تغيير Auth أو Permissions.
- لا توجد عدة مسارات صحيحة بنتائج مختلفة.

### يتوقف ويطلب الموافقة عندما

- يحتاج Runtime أو Capability أو System جديدة.
- يوجد أكثر من اختيار UX أو Product Behavior.
- يتغير Domain Rule.
- تظهر Migration غير متوقعة أو مدمرة.
- يوجد خطر فقد بيانات.
- يتغير Auth أو Permissions.
- يوجد تعارض معماري حقيقي.
- يوجد أكثر من مسار صحيح بنتائج مختلفة.
- التنفيذ يحتاج توسعًا خارج النطاق.
- يوجد مصدران للحقيقة قد يحفظان قيمة خاطئة.
- توجد تغييرات قائمة قد تتضرر.

Full Access لا يعني Merge أو Deployment أو توسعًا تلقائيًا.

---

## 9. أوضاع Audit وPlan

عندما تكون المهمة Audit أو Review أو Inventory أو Classification أو Plan فقط:

- لا تعديل ملفات.
- لا Branch.
- لا Commit أو Push.
- لا Migration.
- لا Database أو Storage mutation.
- لا Fixtures.
- لا Browser QA حي إلا بطلب مستقل.
- لا انتقال تلقائي للتنفيذ بعد اكتشاف المشكلة.

ينتهي العمل بتقرير وخطة وقرارات مطلوبة فقط.

نتيجة التحقيق Read-only لا تمنح تصريحًا ضمنيًا للتنفيذ. كما أن Architecture Review لا تمنح تلقائيًا تصريح Ready أو Merge أو Deployment أو Migration أو Production Mutation.

---

## 10. Development Verification وBatch Release Verification

وفق Section 25.4 وADR-028 من الدستور، نفصل تطوير كل تعديل عن إصدار المجموعة.

### 10.1 Development Verification — لكل تعديل محدود

1. تحديد الـOwner الحالي والـConsumers والعقود المتأثرة.
2. التنفيذ الصحيح عند المالك الحالي؛ تظل Applicability وSource Proof إلزاميتين عند إنشاء أو توسيع Admin Consumer ماديًا، بمحاور مشتقة من Current Shared Capability Set.
3. اختيار Targeted Typecheck / Lint / Guards حسب الأثر، مع تغطية المتبنين المتأثرين عند تغيير Shared Owner.
4. إثبات السلوك والحفظ وإعادة القراءة والفشل حيث تتأثر هذه المسارات.
5. تحديد التحقق اللازم حسب أثر تعديل UI على Desktop / Mobile / RTL وAccessibility، مع إعادة استخدام الأدلة السارية للسلوك غير المتأثر.
6. Focused Correction Pass عند وجود عيب حقيقي، ثم إعادة الفحوص المستهدفة المتأثرة فقط.
7. اعتماد المالك للشكل والوظيفة على Local (Owner Visual Approval / Local Product Review).
8. Local Commit مصرح به بعد نجاح التحقق المستهدف ومراجعة الـDiff.

لا Full Quality Gate تلقائية بعد كل تعديل صغير. Local Product Review تأتي بعد Source Proof والتحقق المستهدف ولا تنتظر CI البعيد. لا نحتاج Vercel Preview أثناء التطوير. التعديل الوثائقي فقط يكتفي بفحوص اتساق وثائقية مستهدفة ولا يحتاج Browser QA أو اعتماد UI.

تظل Architecture Review Matrix في Sections 27.2 و29.4.1 ملزمة للسلوك المتأثر؛ لا عبور للبوابة التالية مع Blocking Issues. نجاح التحقق المحلي أو الاعتماد البصري لا يعني نجاح الإصدار أو Global Closure.

### 10.1.1 حماية Shared UI من الانحدار البصري

قاعدة المالك الدائمة لكل تعديل حالي أو مستقبلي على Shared UI هي عقد QA
Section 3.2.1 في `docs/QA_RELEASE_CLOSURE.md`: تحديد المالك والمستهلكين
المباشرين وغير المباشرين والشاشات المتأثرة قبل التعديل، ثم Targeted Visual
Regression على Desktop / Mobile / RTL مع حفظ السلوك والقدرات والبيانات.
TypeScript وArchitecture Guards ونجاح الوظائف لا تثبت السلامة البصرية.
عند تعذر شاشة حية، تُستخدم المكونات الفعلية في Fixture معزولة ويُذكر مسار
الشاشة صراحة لمراجعة المالك. توثيق الأثر وإعادة استخدام الأدلة السارية وفق
Section 3.4 إلزاميان؛ لا نظام QA موازٍ ولا Full QA متكررة أو توسع خارج النطاق.

### 10.1.2 صيانة سلسلة التحقق ضمن مهمة التطوير المحلي

كل تطوير محلي يجب أن يشمل اكتشاف واختبار وصيانة جميع المستهلكين المباشرين وغير المباشرين وProduct Tests وGuards وسكريبتات الاختبار والـFixtures وCI Workflows المتأثرة، ضمن المهمة نفسها وفق أثر التغيير وعند ملاكها الحاليين. يُصحَّح التوقع القديم المثبت بالرجوع إلى العقد المعتمد الحالي، مع الحفاظ على قوة Assertions والتغطية الإيجابية والسلبية والحدّية؛ لا يُغيَّر الاختبار لمجرد مطابقته للكود أو الحصول على PASS.

عقد QA في `docs/QA_RELEASE_CLOSURE.md` Section 3.2.2 يملك تفاصيل جرد الأثر وتصنيف أسباب الفشل والتصحيح والإثبات. لا يجوز حذف Assertions أو إضعافها أو تحويل الفشل إلى Skip لإمرار التحقق، ولا تأجيل الصيانة المتأثرة إلى مرحلة الإصدار أو إعلان اكتمال محلي مع فحص Development Verification إلزامي متأثر لم ينجح أو لم يُثبت.

صيانة سلسلة التحقق الناتجة مباشرة عن التغيير جزء من النطاق؛ منع تحسينات QA الجانبية في Section 10.3 يظل خاصًا بالأعمال غير المرتبطة. تُعاد الفحوص المتأثرة فقط، وتُحفظ الأدلة غير المتأثرة وفق عقد QA Section 3.4. لا Full Quality Gate لكل تعديل، ولا انتظار remote CI قبل Local Product Review؛ صيانة Workflow تشمل التحقق المحلي المناسب، وتبقى Required GitHub CI بوابة إصدار على رأس الـPR الحالي.

تبقى Ownership وContracts وSource of Truth وشروط التوقف والتفويضات في Sections 6–9 و14 والدستور دون تغيير. هذا الالتزام لا يجيز تغيير Product أو Architecture أو Auth أو Permissions أو Database أو Migrations أو إعدادات CI المحمية خارج التفويض القائم، ولا يُسقط بوابة إلزامية عند تعذر الفحص. التعديل الوثائقي فقط يتبع فحوص الاتساق المناسبة في عقد QA Section 15.

### 10.1.3 التوثيق المستمر للملاك والمستهلكين والقدرات — شرط تسليم دائم

هذه قاعدة دائمة على مستوى المشروع لكل تطوير أو إصلاح أو توحيد أو تبنٍّ أو
تغيير في النظام أو Presentation، وتطبق حتى دون تكليف منفصل أو تذكير بتحديث
التوثيق. المرجع الحالي هو [Venesia Admin System Registry](VENESIA_ADMIN_SYSTEM_REGISTRY.md)؛
تبقى Adoption Manifests وعقود الملاك الحالية مصادر الحقيقة التنفيذية. السجل
يوضحها ولا يستبدلها أو ينشئ Registry أو Runtime أو مصدر حقيقة موازيًا.

**Before:** اقرأ الجزء المتأثر من السجل وحدد المالك وقدراته والمستهلكين
المباشرين وغير المباشرين وحالة التبنّي والعرض والأدلة والفجوات الحالية.
Discovery محدودة بنطاق المهمة؛ لا جرد شامل متكرر للنظام.

**During:** سجّل وصنّف أي قدرة غير موثقة أو اختلاف قديم أو تنفيذ مكرر أو فجوة
مرتبطة تُكتشف، مع مصدر الدليل وحدوده. ميّز تطوير قدرة موجودة من إنشاء قدرة
جديدة، ولا تفترض أن تنفيذًا غير مستخدم أو أن Component مشترك متبنّى دون دليل.
اكتشاف خارج النطاق لا يمنح تصريح تغيير Product أو Production أو توسيع المهمة.

**After:** قبل تسليم المهمة، حدّث الجزء المتأثر من السجل بحيث يوضح:

1. المالك وقدراته والمستهلكين المرتبطين به، وما أضيف أو تغير أو ألغي أو ثبت
   أنه أصبح غير مستخدم، ونوع التغيير: تطوير قدرة موجودة أم قدرة جديدة.
2. التبنّي الفعلي لكل مستهلك متأثر وفق الدليل؛ فرّق Adopted وPartial وNot
   Applicable وPending Review، ولا تستنتج اكتمالًا من وجود Component مشترك.
3. الفروق الوظيفية المشروعة والاستثناءات وأسبابها، والقدرات القديمة المحفوظة؛
   افتح فجوة واضحة لأي قدرة فُقدت أو تراجعت وحدد ما بقي للإصلاح أو القرار.
4. الأدلة والاختبارات وحدود التحقق وإعادة استخدام الأدلة وحالة اعتماد المالك؛
   لا يساوي نجاح المصدر أو Fixture اعتمادًا وظيفيًا أو بصريًا.
5. تاريخًا مختصرًا يوضح الحالة السابقة والحالية وسبب الانتقال، مع الفصل الصريح
   بين Historical وCurrent. لا تحذف قرارات أو أدلة سابقة أو تعيد نسبتها لحالة
   جديدة؛ اربط الحالة الحالية بتاريخها وحدودها.

تُحدّث Adoption Manifests التنفيذية والعقود عند تغير عقودها أو حالة تبنّيها
الفعلية، وليس لمجرد تعديل الشرح. لا تُنسخ محاور Current Shared Capability Set
أو أعدادها الثابتة إلى قاعدة بديلة. توثيق الفجوة لا يغني عن البوابات المطلوبة
ولا يضعف Assertions أو شروط Approval أو حدود التفويض.

اكتمال التوثيق المتأثر **شرط لتسليم المهمة** ضمن دورة التنفيذ نفسها. يوضح
التسليم ما كان موجودًا وما تغير وما بقي مفتوحًا وما لم يُعتمد بعد. لا تعاد
الاختبارات لمجرد تحديث التوثيق؛ التغيير الفعلي يحدد التحقق وفق Sections
10.1.1 و10.1.2 وعقد QA، والتوثيق وحده يتبع QA Section 15.

### 10.1.4 Adoption Completeness Before Delivery — شرط دائم للتعميم

تطبق هذه القاعدة تلقائيًا عند طلب تعميم أي Component أو Presentation أو
Capability، حتى دون تذكير من المالك. تكمل قاعدة التوثيق في 10.1.3 ولا تنشئ
Registry أو Manifest أو مصدر حقيقة موازيًا.

**Shared Component Adoption ≠ Complete Presentation Adoption ≠ Verified Functional Adoption.**
يبقى Owner Approval مستوى مستقلًا عن هذه الأدلة.

1. **Before:** استخرج قائمة المستهلكين الفعليين من المصدر وAdoption Manifests
   الحالية قبل التنفيذ؛ اربط الاستعمال الفعلي بالملاك المباشرين وغير المباشرين
   وطرق العرض، وافحص التنفيذ القديم أو الموازي والفجوات المرتبطة في النطاق.
2. حدّد قدرات كل مستهلك المنطبقة والفروق الوظيفية المشروعة وأسباب عدم الانطباق؛
   لا تنقل وظائف أو بيانات أو صلاحيات مستهلك مرجعي إلى بقية المستهلكين.
   عند طلب Presentation معتمدة، ثبّت المرجع البصري والوظيفي وعقد العرض وحدود
   التفويض قبل التنفيذ، وسجّل لكل عنصر وحالة منطبقة المالك والعرض المطلوب
   وقرار **Required / Optional / Not Applicable** وسببه ودليله أو حالته
   المعلقة في المانيفست والسجل والأدلة القائمة. اختيارية Port تقنيًا لا تحسم
   القرار لهذا المستهلك. العنصر المنطبق المحفوظ أو المؤجل خارج التنفيذ ليس
   Not Applicable ولا يثبت له تبنٍّ جديد. عند طلب Section محدد، يقتصر التنفيذ
   وادعاء الاكتمال عليه مع إعلان بقية الحدود؛ لا يصبح Whole Form Approval.
   أما طلب التبنّي الكامل فيشمل جميع العناصر والحالات المنطبقة، بما فيها
   الأقسام الفرعية والإجراءات، دون تحويل المراجعة إلى تفويض تغيير أوسع.
3. نفّذ التبنّي من الملاك المشتركة الحالية، ووسّع القدرة الناقصة عند مالكها
   ضمن التفويض؛ لا تنشئ مسار عرض أو Runtime موازيًا لتجاوز فجوة.
4. **Before Delivery:** طابق القائمة الأصلية مع التنفيذ النهائي، مستهلكًا
   بمستهلك، وسجّل المالك والقدرات والعرض الحالي وحالة التبنّي والأدلة وحدودها
   والفروق والاستثناءات وأي فجوة غير معالجة في السجل الحالي.
5. لا تعلن التعميم مكتملًا مع وجود مستهلك منطبق لم يُعالج أو يُصنّف بوضوح.
   أي مستهلك لم يثبت تبنّيه يبقى **Pending** ولا يُحسب **Adopted**. وجود
   Shared Component أو نجاح Source Proof لا يكفي لإثبات اكتمال العرض؛ ميّز
   إثبات المصدر والسلوك والمشاهدة البصرية واعتماد المالك.
   طابق العقد البصري المعتمد أيضًا: الأيقونات وArtwork والهندسة والخطوط
   والألوان والإطار/Glow وحالات Hover/Focus/Motion بحسب انطباقها. اختيارية
   Port تقنيًا لا تجعل غيابها مقبولًا إذا كانت عنصرًا معتمدًا لهذا المستهلك؛
   وفي المقابل يلزم سبب وظيفي للتطبيق ولا تضاف زخارف عشوائية لسطح متخصص.
   افصل في السجل والأدلة بين **Component Adoption** و**Capability Adoption**
   و**Visual Presentation Adoption** و**Behavioral Verification** و**Owner
   Approval**؛ نجاح مستوى لا يثبت المستويات التالية. صُن متطلبات العرض
   المنطبقة وحالات عدم الانطباق في Adoption Manifests والحراس الحالية، دون
   Visual Registry أو Manifest أو QA Engine موازية.
6. عند اكتشاف فجوة، أصلح السبب داخل النطاق المصرح به أو وثّقها كفجوة مفتوحة
   تحتاج قرار المالك. لا يبيح اكتشاف عائلة مجاورة تعميمها تلقائيًا، ولا تحوّل
   استثناءً وظيفيًا مشروعًا إلى نقص تبنٍّ.
7. صُن الحراس والاختبارات والـFixtures المتأثرة بحيث تكشف عدم التبنّي، مع
   تحقق ممثل لكل عائلة متأثرة وفق QA 3.2.1 و3.2.2؛ لا تضعف التوقعات لإخفاء
   فجوة أو تعتمد على اكتشاف المالك البصري للنواقص بعد التسليم. الاختبارات
   المستهدفة تحددها التغييرات الفعلية، ولا تُعاد Full QA لمجرد التوثيق.
   إذا كشف Owner Review فجوة بعد ادعاء Full/Complete أو No Missing Adoption،
   راجع سبب الفجوة وسبب عدم اكتشافها مستقلين، مع حفظ نطاق الطلب والأدلة السابقة
   والتمييز بين **Confirmed Root Cause / Contributing Factor / Unproven
   Hypothesis**. صحّح داخل التفويض أو سجّل الفجوة المفتوحة، وأضف Regression
   في الحماية الحالية يكشف نمط النقص في العنصر أو الحالة المنطبقة حتى مع بقاء
   المالك المشترك وProp العرض؛ مجرد وجود Import أو Literal Presentation لا
   يكفي. قيّد ادعاء No Missing/Full بالتغطية المثبتة، واترك غير المختبر Pending.
8. اجعل الحالة الحالية سهلة الوصول في المرجع القائم مع حفظ التاريخ، وأوضح
   في التسليم ما اكتمل وما بقي Partial/Pending/Not Applicable أو مفتوحًا،
   وحالة Owner Approval. لا تعلن System-Wide Adoption مكتملًا مع فجوات
   منطبقة مفتوحة، ولا تستبدل المراجعة البصرية الإلزامية بأدلة المصدر.

### 10.2 Batch Release Verification — عند اكتمال المجموعة

1. تثبيت Final HEAD المجمعة بعد الـLocal Commits ومراجعة نطاق الإصدار كله، بما فيه أي إصلاحات QA مضمنة.
2. تحديد مخاطر النطاق المجمّع وفق Constitution Section 25.4 وعقد QA Section 3.3.1. النطاق A (UI/CSS/Presentation) أو B (Shared Presentation) المثبت الحصر يستخدم الفحوص المتأثرة وTypeScript وESLint والإثبات البصري/السلوكي المتأثر، مع Final Build وProduct Surface وPlatform Contracts وPublic E2E؛ لا Full Local Gate تلقائية له. يضيف B إثبات المالك والمستهلكين المباشرين وغير المباشرين وAdoption وSource Proof والعقود وFailure Paths المتأثرة. C (Domain/Contracts/Data) وD (Auth/RLS/Permissions/Migrations) يلزمان Full Local Gate والفحوص المتخصصة المتأثرة. E (Unknown/Mixed/Architecture/Verification Infrastructure) يتبع أعلى خطر؛ تعذر الحصر أو تعارض الاعتماد، وتغيير كود المعمارية أو آلية التحقق، يلزم Full Local Gate. لا تكرار لخطوة يشملها الأمر نفسه.
3. Cleanup وإثبات سلامة البيئة والموارد الأصلية مع الاحتفاظ بأدلة الاختبار.
4. Push ثم PR عند التصريح، ثم Required GitHub CI على رأس الـPR الحالي.
5. Ready وStandard Merge بتفويض مستقل لكل منهما، ثم Automatic Production عبر الربط الحالي.

يُسجّل التصنيف وإثبات الحصر والـOwners والعقود والمستهلكون والفحوص المختارة وأسباب إعادة استخدام الأدلة داخل أدلة QA القائمة، لا Registry أو QA Engine موازية. تستخدم Manifests وRegistries وExecutable Graph الحالية؛ غياب رابط لا يثبت عدم التأثر، خصوصًا CSS والصور وSQL والـFixtures. كل Test/Guard/Fixture متأثر يُصان ويُنفذ ضمن المهمة، وتغييره يبطل الأدلة المتأثرة؛ PASS سابق لا يُعاد استخدامه دون إثبات صلاحية المدخلات والعقود. إذا لم يملك الفحص مدخلًا موثوقًا لحصر أثره، تُشغّل المجموعة القائمة كاملة.

التغيير يخص اختيار التحقق المحلي فقط: Required GitHub CI كاملة على Exact HEAD وBranch Protection وPost-Merge CI وسياسة Vercel وAssertions وSecurity Coverage وFailure Paths وحدود Ready/Merge دون تغيير. يبقى Standard Merge Commit محميًا بـExpected Head SHA. لا Skip أو نجاح شكلي لعبور بوابة مطلوبة. يظل استثناء الوثائق فقط في QA Section 15 قائمًا؛ تصنيف المخاطر لا يوسّع تفويض المهمة المحلية إلى إصدار.

إذا تغير Final HEAD، يسجل الفرق ومدى صلاحية الأدلة ويعاد ما تأثر فقط وفق `docs/QA_RELEASE_CLOSURE.md` Section 3.4؛ يعاد Full Gate عندما يتعذر تغطية الأثر بالأدلة السارية والفحوص المتأثرة. لا تُنسب أدلة SHA قديمة إلى HEAD جديدة، ولا تعتبر البوابة المتوقفة Passed.

### 10.3 كفاءة التنفيذ

لا تكرار لاختبارات ناجحة دون أثر أو فشل أو دليل جديد، ولا Status Polling متكرر، ولا تحسينات QA جانبية. لا Full Audit إلا بطلب المالك أو متطلبات إصدار مثبتة. تكون تقارير العمل موجزة عند عائق حقيقي أو التسليم.

عندما يراجع المالك الموقع مباشرة على Local المفتوح بالفعل:

- خارج تعديلات Shared UI الخاضعة لـSection 10.1.1، لا تُفتح Browser Automation تلقائيًا، ولا تُنشأ Screenshots أو Visual Reports دون طلب. إذا تعذر إثبات السلوك بفحوص الكود، يُنفذ الحد الأدنى الضروري من Browser Verification؛ ويجوز استخدامها أيضًا بطلب صريح.
- يُستخدم Dev Server الجاري دون إعادة تشغيله أو إنشاء نسخة إضافية لأجل التحقق المعتاد.
- لا تكرار Browser QA ناجح دون سبب مرتبط بالتعديل؛ تُحفظ صلاحية الأدلة وفق عقد QA Section 3.4.
- يُكتفى بأقل فحوص كود مستهدفة لازمة حسب الأثر، مع Browser Verification الضروري لإثبات السلوك فقط؛ وتبقى المراجعة البصرية النهائية للمالك مباشرة على Local.
- يقتصر التسليم المحلي على الملفات المعدلة ونتيجة التحقق والـLocal Commit وحالة Git، ثم التوقف عند حدود التفويض، دون تكرار رابط localhost.

لا تُلغي هذه القواعد أي تحقق تفرضه العقود المعمارية أو طبيعة التعديل أو عقد الإصدار.

للوكيل حرية اختيار أفضل Implementation Detail داخل الـOwners والعقود المعتمدة دون Micro-approvals. تبقى قرارات المنتج والمعمارية والأمان والبيانات غير المحسومة ضمن بواباتها الحالية.

---

## 11. Browser QA

عند تعديل Shared UI وفق Section 10.1.1، أو تعذر إثبات السلوك بفحوص الكود، أو بطلب صريح، يُنفذ الحد الأدنى الضروري مما يتأثر بالتعديل وفق Section 10.3؛ لا تُعاد القائمة تلقائيًا لكل تغيير بصري:

- استخدام Dev Server الجاري؛ خادم واحد فقط دون إعادة تشغيله لمجرد جولة تحقق.
- Browser Automation آمنة، مع بقاء التحقق الإلزامي حسب العقود والأثر.
- لا Windows Computer Use إذا كانت هوية النافذة غير مؤكدة.
- اختبار Desktop.
- اختبار قرابة 390px عند تغيير Responsive UI.
- اختبار RTL.
- Keyboard وFocus وTab وShift+Tab.
- ظهور الخطأ في الـVisible Control.
- فتح التاب الصحيح قبل Focus.
- Console errors وWarnings.
- Failed requests.
- Network counts عند ادعاء السرعة.
- عدم حدوث Full Document Reload في المسار الـInstant.
- إغلاق العمليات المؤقتة بعد الجولة.

لا تُحذف `.next` إلا عند وجود دليل على فساد Cache أو Build State.

---

## 12. بيانات QA والأمان

- Fixtures مؤقتة فقط.
- لا تعديل بيانات Production الحقيقية لمجرد الاختبار.
- لا Production Admin User لمجرد Smoke.
- لا Password أو Secret داخل Git أو PR أو Logs أو Screenshots أو Source.
- لا Service Role في Client.
- لا Production filesystem للـRuntime uploads.

بعد QA تُحذف:

- المستخدمون المؤقتون.
- السجلات التجريبية.
- Audit rows.
- Preferences.
- الملفات المرفوعة.
- Fixture relations.
- العمليات المؤقتة.

ويُثبت الرجوع إلى صفر أو إلى الـBaseline الأصلية.

---

## 13. Git Safety

ممنوع دون تصريح صريح:

- العمل المباشر على `main`.
- `reset --hard`.
- Stash أو Drop لشغل غير مرتبط.
- Force Push.
- حذف فروع.
- Blind `git add .`.
- Stage شامل عشوائي.
- Commit ملفات Untracked محمية.
- Merge.
- Auto-merge.
- Production Deployment.
- Manual Production Deployment.

قبل Commit:

1. `git status`
2. مراجعة Staged Diff
3. مراجعة Unstaged Diff
4. التأكد أن الملفات المقصودة فقط تغيرت
5. `git diff --check`

بعد Commit يسجل SHA. وعند Push المصرح به لاحقًا يثبت `Local HEAD = Remote Branch HEAD`؛ لا يشترط Push لحفظ Local Commit.

---

## 14. Ready وMerge منفصلان

التسلسل الرسمي:

1. Local Implementation
2. Impact-Based Targeted QA والتصحيح المحدود عند الحاجة
3. Owner Visual Approval على Local
4. Local Commits
5. Risk-Selected Local Release Verification حسب Section 10.2، مع البوابات المحلية المطلوبة ثم Cleanup
6. Push ثم PR بتفويض يشملهما
7. Required GitHub CI على الـPR HEAD الحالية وتقرير أدلة الإصدار
8. Ready بتصريح مستقل بعد استيفاء عقد الإصدار
9. مراجعة نهائية وStandard Merge بتصريح منفصل مع حماية Expected HEAD
10. Automatic Production Deployment
11. Production Smoke آمن عند وجود جلسة موثوقة، ثم Formal Closure بحسب الأدلة

Ready لا تعني Merge، وLocal Visual Approval لا تعني Release Approval. Preview ليست شرطًا للتطوير المحلي. لا تغيير CI أو Branch Protection أو Vercel Settings بموجب تحديث السياسة، ولا Manual Production Deployment.

إذا غابت جلسة Admin موثوقة، يُسجل Production Admin Smoke كـ`Skipped` بسبب غياب الجلسة، لا كفشل برمجي.

---

## 15. طريقة الدمج المعتمدة

عند التصريح فقط:

- Standard Merge Commit
- Expected Head SHA protection
- No Squash
- No Rebase
- No Auto-merge
- No Manual Production Deployment

بعد الدمج يُثبت:

- Head قبل الدمج
- Base قبل الدمج
- Merge Commit SHA
- `local main`
- `origin/main`
- GitHub main
- GitHub Checks
- Quality Gate
- Vercel Production
- Production Smoke أو سبب Skip

---

## 16. Migrations وProduction

أي Migration تحتاج:

- المشكلة الدقيقة.
- دليل Repository وRemote.
- تصنيف Additive أو Destructive.
- Target environment.
- Data impact.
- Lock/compatibility risk.
- Rollback أو Forward-fix.
- Approval قبل التطبيق.
- تحقق مستقل من Schema behavior وMigration registry.

وجود ملف Migration لا يثبت التطبيق. ووجود Remote behavior لا يثبت Registry provenance.

---

## 17. التقرير الإلزامي

### A. Proven Facts

- Baseline
- Branch
- Final HEAD
- PR state
- الملفات المتغيرة
- المالك المعماري المستخدم
- هل أُنشئ مالك جديد
- الاختبارات
- Browser QA
- Failure paths
- Migration state
- Checks / Deployment
- Cleanup
- Local / Remote alignment

### B. Gaps

كل ما لم يكتمل أو لم يثبت أو بقي Debt أو Exception أو Adoption Gap.

### C. Assumptions

أي استنتاج غير مثبت مباشرة.

### D. Skipped

كل إجراء لم يُنفذ وسببه.

### E. Required Proof

ما يلزم قبل Ready أو Merge أو Production Closure أو Global Closure أوسع.

ثم Exact Closure Claim بلا مبالغة. في تسليم Local فقط يُتبع ملخص Section 10.3: الملفات المعدلة ونتيجة التحقق والـLocal Commit وحالة Git؛ تبقى أدلة التحقق محفوظة دون فتح بوابات الإصدار أو إعادة QA لإكمال قالب التقرير.

> Reference Consumer لا تعني Global Closure.
> Preview Success لا تعني Production Closure.
> Remote Behavior لا تثبت Migration Provenance وحدها.

---

## 18. السلسلة الرسمية

التسلسل المحلي يبدأ بـDiscover المحدود → Consumer Capability Adoption Audit (Applicability عند انطباقها) → Architecture → Implementation → Source Proof → Development Verification → Owner Visual Approval → Local Commit.

ثم، عند اكتمال المجموعة، يُتبع تسلسل Batch Release Verification والتسليم في Sections 10.2 و14. تبقى Required GitHub CI وReady وMerge وProduction Verification بوابات إصدار؛ لا تعاد قبل كل Local Commit.

---

## 19. معيار التقييم

لا يُقاس الوكيل بحجم الـDiff.

يُقاس بـ:

- هل أثبت الواقع؟
- هل وجد المالك الصحيح؟
- هل تبنى الموجود؟
- هل منع الازدواجية؟
- هل حافظ على البيانات؟
- هل أثبت Failure Path؟
- هل احترم Git Safety؟
- هل قدم Closure Claim صادقة؟

الكود الذي يعمل لكنه ينشئ مالكًا ثانيًا أو مصدر حقيقة ثانيًا تنفيذ خاطئ.

> التنفيذ الصحيح: أقل تغيير ممكن، داخل المالك الصحيح، بإثبات كامل، وبدون مبالغة في الإغلاق.
