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

### 10.2 Batch Release Verification — عند اكتمال المجموعة

1. تثبيت Final HEAD المجمعة بعد الـLocal Commits ومراجعة نطاق الإصدار كله، بما فيه أي إصلاحات QA مضمنة.
2. Full Quality Gate مرة واحدة على النسخة المجمعة، مع Final Build وPublic E2E حسب عقد الإصدار الحالي دون تكرار خطوات يشملها الأمر نفسه.
3. Cleanup وإثبات سلامة البيئة والموارد الأصلية مع الاحتفاظ بأدلة الاختبار.
4. Push ثم PR عند التصريح، ثم Required GitHub CI على رأس الـPR الحالي.
5. Ready وStandard Merge بتفويض مستقل لكل منهما، ثم Automatic Production عبر الربط الحالي.

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
5. Batch Final Quality Gate وFinal Build/Public E2E حسب العقد ثم Cleanup
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
