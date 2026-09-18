# System-wide Admin Near-Instant Interaction & Performance Contract

تاريخ المرحلة: 2026-09-17. قاعدة المقارنة المقبولة: `78b719aeebecd9ea2e6587836649bfbd8e80c504` بعد PR #165.

كل مسار دليل مختصر مثل `entity-open/…` أو `runtime-readme.md` في هذا التقرير يقع تحت `E:/web/venisia/.tmp-qa/admin-near-instant-2026-09-17/`، ما لم يُذكر مسار آخر كاملًا. مراجع المصدر تبدأ من جذر المشروع `E:/web/venisia/`.

**النتيجة الحالية:** نُفذت تحسينات محددة في فتح المحررات، بيانات المراجع، اختيار الروابط، تحديث كاش وحدات الصفحات، واستعادة استعلام القائمة عند الإغلاق. أدلة الملاك المشتركة تثبت تقليل قراءات أو إزالة انتظار زائد مع حفظ الصحة. هذه النتيجة لا تثبت أن كل رحلة Admin أصبحت Near-Instant.

**حالة التسليم المحلي: PASS للتحسين المحدود المنفذ.** المصفوفة مكتملة، وأُدرجت 40 ملاحظة فتح محرر وأربع ملاحظات tab من المتصفح وحالة عودة Category. البوابة المحلية المجمعة PASS بنسبة 137/137 وAdmin Runtime بنسبة 32/32، عبر تشغيل وإعادة استخدام أدلة صالحة بحسب التبعيات. المرجع `.tmp-qa/admin-near-instant-2026-09-17/final-gate/receipt.json`؛ هذا لا يعني أن جميع الأسطح أصبحت Near-Instant.

قياسات الملاك التالية تستخدم المالك الحقيقي مع نقل معزول وتأخير مضبوط؛ ليست زمن قاعدة البيانات أو الشبكة أو RSC أو رحلة المستخدم الكاملة. قياس المتصفح يستخدم نسختي Next.js 16.3 في وضع التطوير، ويُبقي عينات compilation الباردة والقيم المتطرفة. اختلاف جدولة `requestAnimationFrame`، وتذبذب القراءات البعيدة، وتحذير hydration الذي أحدثته أداة التشخيص تمنع ادعاء تحسن سببي أو regression سببي في زمن الواجهة، أو ادعاء Browser QA نظيف شامل. التفاصيل في `browser-usable-observations.json` و`runtime-readme.md` وملفات التشغيل، ولا تُخلط مع القياسات المعزولة.

## A. Complete Admin Interaction Inventory

الجرد مشتق من مصدر Git المقبول ومن manifests الموجودة، وليس من القائمة الجانبية وحدها. يحتوي على **69 نقطة دخول Route و188 ملف مالك لأسطح تفاعلية متداخلة**، ممثلة في **257 صفًا**. التفاصيل الإضافية تربط 1331 موضع JSX تفاعلي و80 إعلان tab بالمستهلك والرحلة. الأرقام الأخيرة مواضع في المصدر تشمل الفروع الشرطية؛ لا تعني أن 1331 عنصرًا يظهر في وقت واحد أو خضع للقياس.

جرد Collection/Form القائم يضم 34 تسجيل Collection و34 تسجيل Form. سجلات الملاحة الخمسون المحتفظ بها من #165 تتناول مزيجًا من routes وعائلات؛ ليست مقامًا بديلًا لجرد التفاعلات.

الجرد البشري الكامل: [ADMIN_NEAR_INSTANT_INTERACTION_INVENTORY_2026-09-17.md](ADMIN_NEAR_INSTANT_INTERACTION_INVENTORY_2026-09-17.md). الجرد التفصيلي: `.tmp-qa/admin-near-instant-2026-09-17/complete-interaction-inventory.json`. يغطي القوائم، فتح السجل، المحررات، تبويبات الحقول والمراجعة، العلاقات، الوسائط، pickers، dialogs، row actions، الحفظ، التأكيد والعودة. يشمل placeholders بوصفها كذلك، ولا يفترض وجود محرر وحدات عقارية مستقل؛ floor plans/details موجودة داخل محرر المشروع.

## B. Journey Matrix

كل رحلة تتبع: القائمة الصحيحة ← السجل الصحيح ← حقول قابلة للاستخدام ومراجع مكتملة ← تبويبات/اختيارات ← حفظ مؤكد ← عودة إلى السياق السابق. تحديث URL أو ظهور shell أو اختفاء spinner ليس نهاية القياس.

| الرحلات | السطح المشمول |
|---|---|
| J01–J04 | Topics بجميع أنواع المحتوى القابلة للتحرير؛ Category؛ Series؛ المشروع السكني والتجاري |
| J05–J06 | مستويات Locations الأربعة؛ Tracking profile/stages/items/updates وحقولها المتداخلة |
| J07–J08 | Pages composition/SEO؛ أنواع Blocks التسعة ومحرراتها وتبويباتها |
| J09–J11 | Menus/item builder؛ Footer aggregate؛ Media Library وحقول الوسائط والاختيار |
| J12–J17 | Redirects؛ Global metadata؛ Sitemap؛ Users؛ Activity؛ Reports/details/image report |
| J18–J22 | Integration wizard؛ Vault configuration؛ Company/Maintenance؛ Media recovery/settings؛ Security |
| J23–J27 | Placeholders؛ Login/guidance؛ Dashboard/shell؛ Link picker؛ التفاعلات المحلية المشتركة |

الخطوات والمعيار الوظيفي والمالك لكل رحلة محفوظة في حقل `journeys` بالمصفوفة. معرفة سرعة خطوة ملاحة قديمة لا تغلق فتح المحرر أو الحفظ أو العودة في الرحلة نفسها.

## C. Before Baseline Summary

احتُفظ بأدلة #165: `navigation-eligibility-review/FINAL-DELIVERY.md` و`final-gate.json`، و`system-wide-admin-navigation/final-adoption-matrix.json` و`owner-inventory.json`، وإثبات الإغلاق تحت `pr165-closure/`. لم يُعَد تشغيل benchmarks الملاحة أو bootstrap أو فحص migrations/RLS لمجرد تغيّر مالك Admin غير مرتبط.

الحالة السابقة للملاحة بقيت 4 Active و12 Dormant و31 Not Eligible و3 Decision Required، ضمن نطاق ذلك الدليل فقط. قرارات Pages وMedia Manage/Picker لم تتحول تلقائيًا إلى Active. ملف Build02 المحلي دليل نسب لإيصالات المرحلة السابقة؛ مرجع مساواة المصدر هو Git `78b719a` النهائي، مع حفظ SHA الخام وSHA بعد توحيد CRLF.

Before الخاص بالتغييرات الجديدة حُفظ قبل التعديل عند المالك: Auth؛ taxonomy/project؛ pages؛ picker؛ وفقدان query في روابط edit/close. توجد كل العينات الخام، ويُذكر نوعها ومصدرها بدل تقديمها كقياسات إنتاج.

## D. Root Causes discovered

| السبب المثبت | الإصلاح |
|---|---|
| `getCurrentAdmin` يقرأ هوية المستخدم مرتين في الطلب نفسه | قراءة واحدة حديثة تمر بنفس تحقق الجلسة، دون كاش عبر الطلبات |
| سجل taxonomy ثم مراجع مستقلة ينتظر بعضها بعضًا | جمع القراءات المستقلة بالتوازي عند loader القائم |
| تفاصيل floor plans تنتظر أيضًا children لا تعتمد عليها | انتظار plan IDs فقط، بعد شرط وجود المشروع |
| كل صفحة متأثرة بحفظ block تعيد الاستعلام وإبطال الكاش | تجميع الصفحات عند `admin-revalidate` القائم |
| picker templates يحمل خصائص لا يعرضها | projection صريح للملخص عبر الأنواع التسعة |
| Featured ينتظر references ثم items؛ وبعض المستهلكين لا يحتاجون Series | توازٍ داخل المالك وطلب categories-only عند الحاجة |
| Link picker يؤخر الفتح وتغيير المورد 220ms، وتستطيع نتيجة قديمة استبدال المورد الحالي | إبقاء debounce للكتابة فقط وعزل النتائج القديمة/المغلقة |
| روابط تحرير Category/Series/Project وClose تفقد استعلام القائمة | نقل query الموحّد إلى `return_to` والتحقق منه عند RSC ثم `closeHref` القائم |

## E. Shared Capabilities created/extended

تم تمديد `load-taxonomy-form-data` و`project-entry-data` و`admin-revalidate` و`admin-queries` ومالكي Featured/Feed references، دون مالك بيانات ثانٍ. أُضيفت وظيفتا `resolveAdminFormReturnPath` و`adminFormEditHref` إلى `src/lib/admin/form-runtime.ts`، فوق `resolveSafeInternalPath` القائم؛ ليستا router أو cache جديدًا.

جرى تحسين lifecycle داخل `AdminLinkPicker` نفسه. لا QueryClient إضافي، ولا prefetch/cache محلي عند المستهلك، ولا تغيير TTL/GC عام، ولا تغيير عقد التفويض أو الصلاحيات أو مصدر الحقيقة. نوع المعلومات الجديدة في `.tmp-qa` وdocs هو تقرير ودليل فقط، وليس registry قابلًا للتنفيذ.

## F. Consumers adopted

اعتمدت محررات Category/Series/Article/Media/Project القراءات المعدّلة عبر المالك القائم، مع applicability وsource proof على `topic-category-create-edit` و`topic-series-create-edit` و`topic-article-create-edit` و`topic-media-create-edit` و`projects-create-edit`.

استعادة query اعتمدتها Forms الثلاثة الأولى المناسبة: Category وSeries وProject، مع Collections `content-categories` و`content-series` و`projects-residential-commercial`. تشمل ست نقاط title/action لتحرير سجل موجود، وثلاث routes وثلاث Forms. Topics يملك بالفعل مسار return آمنًا؛ لم يُستبدل.

الحفظ المجمّع معتمد مباشرة في ثمانية update actions: breadcrumb/cards/content/cta/feed/featured/media-hub/media-sidebar. ملخص templates يشمل الأنواع التسعة بما فيها Hero. مراجعات Form المسجلة لهذه المستهلكات محفوظة تحت `pages-open/applicability-*.log` و`source-proof-*.log`.

Link picker يصل إليه المستهلكون الحاليون عبر `AdminLinkField`: محررات breadcrumb/cards/content/cta/hero، وFooter، وMenu item builder. التعديل عند shared control لا ينشئ consumer موازيًا؛ manifests الموجودة تظل مالكة حدودهم.

## G. Entity/Editor opening Before/After

| المقطع المقاس | Before median | After median | القراءات |
|---|---:|---:|---:|
| Category record + parent options | 85.39ms | 42.07ms | 2 → 2 |
| Series record + category options | 91.98ms | 45.48ms | 2 → 2 |
| Topic record + category + series | 94.96ms | 47.11ms | 3 → 3 |
| Project aggregate | 198.54ms | 155.27ms | 9 → 9 |

هذه medians لخمس عينات لكل جانب، عند actual loaders مع 35ms لكل قراءة و100ms لقراءة project features في التجربة. النتيجة تثبت إزالة تسلسل غير ضروري؛ لا تشمل Auth/RSC/hydration أو action-to-editor-usable. المصدر والعينات: `entity-open/{before.json,after.json,verification.json}`.

**المتصفح الفعلي، ملاحظات فقط:** وصلت الملاحظات الأربعون إلى نفس السجل المقصود وidentity field ممتلئ ومفعّل، أو Page heading/panel، مع primary controls قابلة للاستخدام. خمس حالات، Before وAfter لكل حالة، وأربع ملاحظات لكل جانب: أولى باردة ثم ثلاث دافئة. استُعملت جلسة موجودة دون login وقراءات GET فقط؛ لا حفظ. الأرقام الدافئة التالية بالمللي ثانية:

| السجل المحدد | Before median (min–max) | After median (min–max) |
|---|---:|---:|
| Topic 1521 | 2244.1 (2175.4–4273.2) | 1309.6 (734.0–5990.5) |
| Category 3 | 2014.3 (774.1–2017.1) | 2008.0 (511.1–2010.4) |
| Project 2 | 1552.8 (1349.9–2295.0) | 3021.1 (1240.3–3023.5) |
| Page 2 | 2519.1 (2409.1–10017.8) | 4241.0 (4239.1–4265.1) |
| Featured 1 | 848.7 (777.1–901.7) | 1981.4 (841.3–2012.3) |

العينات الباردة كلها محفوظة أيضًا، بما فيها Topic الذي كان 8333.7ms قبل و14357.2ms بعد. اختلاف rAF المرصود بين نحو 8 و1019ms، والـremote variance، وتسلسل cohorts، وفرق viewport من 305×629 إلى 306×630 تجعل الأرقام ملاحظات تشغيلية ولا تسمح بنسب تحسن أو استنتاج regression سببي. لا P95 على ثلاث عينات، ولا إسقاط completed outlier. مصدر الأرقام `browser-usable-observations.json`؛ حقول RSC transfer/duration موجودة لكنها لا تمثل SQL CPU أو كامل DB egress.

ملاحظات tab الأربع اقتصرت على Topic وPage قبل/بعد؛ لا تثبت كل hidden fields أو بقية التبويبات. حقول المصفوفة `observedEditorOpen` تحفظ هذه النتائج مستقلة عن `wholeJourneyClassification`، الذي لا يُرقّى إلى A.

## H. Pages/Page Blocks/Modules Before/After

| المقطع | Before → After | المعنى وحدود القياس |
|---|---|---|
| Revalidation بعد الحفظ | 100.03 → 62.01ms؛ 11 → 9 قراءات؛ 103 → 39 استدعاء إبطال | المجموعة الفريدة نفسها من paths/tags/update؛ ليس الحفظ كاملًا |
| Template summary | 3612 → 701 bytes؛ 18 → 18 قراءة | payload صناعي للملخص؛ ليس حجم RSC الحقيقي |
| Featured editor options | 98.71 → 61.50ms؛ 14 → 13 قراءة | إزالة waterfall ومراجع Series غير المطلوبة |
| Categories-only options | 2 → 1 قراءة | التصنيف والترتيب والهرمية نفسها؛ Feed يحتفظ بالبيانات الكاملة |

المصدر `pages-open/summary.json`، بخمس عينات وتأخير 20ms اصطناعي لكل قراءة. تحسين payload لا يثبت تحسن latency مستقلًا؛ زمن التشخيص له كان 32.00 → 31.90ms. لم تتغير assignments أو authored SEO أو معنى اختيار Template.

تبويبات `AdminModuleTabs` تبقى mounted لحفظ inputs/drafts؛ لا يوجد lazy render غير مثبت. assignment usage warning له cancellation flag، ولا يدّعي abort/dedup. إنشاء assignment ما زال يستخدم refresh، وحفظ بعض blocks يعيد route عبر redirect. هذه حدود واضحة للرحلة، حتى عندما يتحسن جزء revalidation.

في cohort المتصفح المحدد، Page 2 صار أبطأ أيضًا عند server endpoint: median الطلب الدافئ 2024.17 → 2852.27ms، رغم انخفاض قراءاته من 23 إلى 22. لذلك لا نُرجع كل التفاوت إلى rAF؛ تذبذب النقل البعيد ظاهر كذلك، ولا تكفي cohorts المتتابعة لإثبات تحسن أو regression سببي. تفاصيل النقل المطابقة في L.

## I. Pickers/Relations/Reference Data findings

في actual mounted `AdminLinkPicker` و`VenesiaModal` مع actions معزولة 40ms: فتح picker تحسن تشخيصيًا 346.6 → 123.0ms، وتغيير المورد 337.2 → 112.4ms، بخمس عينات وقراءة واحدة لكل فعل. اختفى سيناريو النتيجة المتأخرة الخاطئة: 1 → 0. المقاييس مرتبطة بتعديل الجدولة الأول `0b4e3b54…`؛ التصحيح النهائي لإتاحة أوضاع الروابط المحلية أثناء انتظار browse متأخر له proof مستقل `e8f094aa…` وسبعة assertions، دون إعادة timing. لذلك لا نقدّم الأرقام كقياس timing على final source.

التحقق النهائي يشمل المورد/query القديم، الفتح بعد الإغلاق، debounce الكتابة، رفض النقل، هوية العنصر المؤكدة، وإتاحة أوضاع external / anchor / download أثناء read قديم. الأدلة: `link-picker/{before,after,verify}/result.json`. لا يشمل ذلك Next/Auth/DB transport أو كل محرر يستخدم picker.

المراجع المحفوظة غير المنشورة تظل متاحة في سياق السجل، والخطأ لا يتحول إلى قائمة فارغة ناجحة. لم يُنشأ cache للمراجع عبر المحررات؛ استمرار استعمال المالك دون كاش قرار محدود إلى الأدلة المتاحة، وليس وعدًا بأن كل تكرار مرجعي ضروري.

## J. Save/Reconcile/Back Before/After

تغيير الحفظ يخص تكرار الاستعلام والإبطال بعد commit. لا optimistic success قبل تأكيد المالك، ولا إسقاط failure/warning، ولا تعديل لمسار domain write أو audit. عند فشل lookup غير مرتبط تبقى invalidations المعروفة للصفحات المتأثرة، ثم يُعاد الخطأ الأصلي إلى سياسة retry/warning القائمة. إذا فشل fallback نفسه يُحتفظ بالخطأين مع السبب الأصلي في `AggregateError`.

قبل إصلاح Return كانت روابط التحرير/الإغلاق المباشرة تفقد query. بعده يحمل title/action canonical query إلى `return_to`، ثم لا يقبل RSC إلا نفس list base المطابق لنوع الكيان. `closeHref` يمر إلى `AdminFormRuntime` الحالي، بما فيه confirmation عند dirty draft. proof المالك 129 assertions، وactual mounted Close 18 assertions تشمل clean/dirty/cancel/confirm لأربع list bases. أرقام 129 و18 أحجام suites، وليست كلها اختبارات جديدة.

هذا يصلح **edit-existing → explicit Close**. لا يشمل create→edit origin، scroll أو selection/tree expansion، ولا يضيف state إلى History. Browser Back يبقى وفق السلوك الموجود. Pages يعيد `returnPageId` لسياق Modules لكنه لا يحفظ كامل query/scroll للقائمة. ملاحظة فقد query القديمة في `entity-open/verification.json` سبقت هذا الإصلاح؛ الدليل الأحدث `return-state/verification.json` هو المرجع لهذا الجانب.

أُضيفت حالة متصفح فعلية واحدة على المصدر النهائي: كتابة بحث «موضوعات» في Categories ← فتح Category 3 «موضوعات تهمك» عبر `return_to` ← الضغط على «إغلاق» دون تعديل ← رجوع نفس query ونص البحث والصف الصحيح. الحالة PASS في `return-state/browser-query-return.json`، دون timing أو save أو إثبات scroll. اختبارات dirty/cancel/confirm والأربع list bases تظل الأدلة المعزولة المذكورة؛ لا نعمم هذه الحالة البعيدة الواحدة عليها.

## K. Auth/RSC/read-shape/render findings

Auth actual-owner diagnostic، خمس عينات وتأخير 40ms/قراءة: **93.34 → 46.06ms و2 → 1 قراءة**. ما زالت كل دعوة تتحقق من signed token الحالي، expiration، active/revoked state، failure، وهوية المستخدم من قراءة حديثة خالية من credential projection. لا reuse عبر invocation أو مستخدم.

لم تُنقل بيانات هوية حساسة إلى العميل، ولم تُرخَّص Auth gates لتسريع RSC. Public unauthenticated branch يصل إلى return قبل المالك المعدّل، ويُراجع ذلك بمساواة tested-path، لا باستنتاج من اسم Admin وحده. تقرير `public11-equivalence.json` منفصل عن تشغيل tests جديد.

تبويبات المشاريع والمحتوى التي تشارك full-form serialization لم تُفكك؛ ذلك قد يظل مكلفًا لكنه ليس سببًا كافيًا لتغيير draft/mount semantics. لم تُثبت render bottleneck كميّة على جميع الأسطح.

## L. Network/read cost

التخفيض المباشر المثبت: Auth قراءة واحدة أقل؛ حفظ blocks قراءتان أقل في fixture؛ Featured قراءة أقل؛ categories-only قراءة أقل؛ payload templates أصغر بالحقول المستخدمة. التوازي في taxonomy/projects يقلل critical path دون خفض عدد القراءات الطبيعي. Link picker يلغي انتظارًا محليًا زائدًا دون prefetch أو قراءة إضافية للفعل المقاس.

للتوازي تكلفة خطأ محدودة: غياب/فشل سجل Category أو Series قد يبدأ قراءة مرجع إضافية؛ Topic قد يبدأ مرجعين. فشل sibling بمشروع قد يتداخل مع قراءة details كانت لن تبدأ سابقًا. شرط غياب/فشل المشروع، أو plans فارغة/فاشلة، لا يزال يمنع القراءات التابعة له. لا تُخفى هذه التكاليف خلف median النجاح.

لا توجد أرقام حقيقية مثبتة لتكلفة DB CPU أو egress أو RSC لكل سطح؛ القيم غير المقاسة محفوظة كـ `null` مع سببها.

رُبطت الملاحظات الأربعون بمعرفات طلبات server الفعلية في `browser-server-cohort-bindings.json`، مع أصل/effective manifests منفصلة عن instrumentation. المقارنة التالية تخص ثلاث قراءات RSC دافئة لكل سجل على الجانبين؛ ليست مجموع رحلة أو كل traffic النظام:

| السجل | عدد القراءات البعيدة Before → After | median server request Before → After |
|---|---:|---:|
| Topic 1521 | 6 → 5 | 993.11 → 720.40ms |
| Category 3 | 5 → 4 | 542.97 → 378.55ms |
| Project 2 | 12 → 11 | 1034.09 → 767.67ms |
| Page 2 | 23 → 22 | 2024.17 → 2852.27ms |
| Featured 1 | 6 → 5 | 641.70 → 543.41ms |

العدد ثابت في العينات الثلاث لكل cohort ويظهر خفض القراءة عند Auth في المسار الكامل. هذه الأعداد ليست بديلًا عن fixtures التي تختبر فروع بيانات أخرى. قيم server وbrowser نهايات مختلفة؛ لا تُجمع فترات reads المتداخلة، ولا يُحسب response size كلي من قياسات body جزئية. طلب Topic cold الإضافي الناتج عن HMR محفوظ منفصلًا. سجل النقل المربوط لا يحتوي correlated fetch failures؛ الحارس منع عشر POSTs لتشخيص Next stack frames (خمس لكل جانب)، ولم يسمح بها كـdomain writes. بقيت reads غير المنسوبة والتغطية الجزئية معلنة في ملف الربط.

## M. Correctness/invalidation proof

أدلة taxonomy تحرس revision الخام، not-found/error priority، scope للمراجع والربط الحالي غير المنشور. Project proof يحرس parent prerequisite وempty/error plans وحفظ نفس mapping أثناء تداخل القراءات.

راجع التحقق النهائي أولوية أخطاء Project باستخدام PostgREST SDK المثبت فعليًا: عشر حالات احتفظت بنفس error class/message وأولوية sibling قبل/بعد (`entity-open/project-error-priority-sdk.json`). لم يلزم تعديل runtime؛ قياسات مسار النجاح تظل مرتبطة بالمصدر المجمد نفسه.

Pages proof يقارن المجموعة الفريدة الكاملة من paths/tags/update قبل/بعد، مع الصفحات المنفصلة والمضافة وSEO والخيارات. Picker proof يمنع استبدال request حالي بنتيجة قديمة. Return proof يرفض external/protocol/control-character/mismatched-list وarray inputs، ويحفظ query المصرح به عبر الإغلاق العادي والمحروس.

هذه guards منفذة على المالك الحالي. لم يُختبر Production save/login أو mutation حقيقي لأغراض الأداء. صحة الحفظ البعيد والرحلة الكاملة لا تُستنتج من source proof وحده.

## N. Performance Adoption Contract

العقد ممدد عند الملاك والـverifiers الموجودين: المستهلك يستعمل Canonical Data/Form/Module owner مباشرة؛ query identity من writer المشترك؛ return path مرتبط بالكيان/list base؛ reads مستقلة تتوازى فقط مع حفظ prerequisites والأخطاء؛ options تطلب ما تحتاجه؛ hydration/draft/save لا يُختصر إلى success مبكر؛ invalidation يغطي نفس المعنى؛ picker لا يقبل استجابة obsolete.

تستمر manifests الحالية في اشتقاق applicability لكل محور من Current Shared Capability Set. لا تُنسخ قائمة capabilities ثابتة. guards الموجودة ضد parallel QueryClient/runtime وconsumer-local cache/prefetch وbypass تبقى جزءًا من البوابة، مع source proof للمستهلكين المتأثرين. إضافات المرحلة تختبر read scheduling/shape وAuth freshness وpicker ordering وreturn semantics وblock revalidation عند أصحابها.

لا threshold زمني هش داخل CI. التوقيت diagnostic منفصل؛ CI يحرس invariants قابلة للإعادة. ليس هناك ادعاء بأن كل overfetch محتمل أو كل reference reuse في النظام صار محروسًا بقانون جديد شامل.

## O. Regression Guards

| نطاق التغيير | مالك التحقق |
|---|---|
| Auth freshness/read duplication | `scripts/verify-platform-performance-contracts.mts` |
| Taxonomy loader/relations/revisions | `scripts/verify-taxonomy-admin-load-truth.mts` و`verify-topic-series-category-integrity.mts` |
| Project dependencies/read topology | `scripts/verify-project-admin-data-entry.mts` و`scripts/lib/verify-project-entry-read-scheduling.mts` |
| Return query وForm lifecycle | `scripts/verify-admin-form-system.mts` و`qa-admin-form-guarded-navigation.mts` |
| Project title/row Edit query | `scripts/verify-admin-instant-projects.mts`؛ يحافظ على تعريف actions القديم ويختبر الرابط الحقيقي عبر مالك Form |
| Pages summary/revalidation | `scripts/verify-page-composition-platform-contract.mts` و`scripts/fixtures/page-block-performance-harness.mjs` |
| Featured/reference scope | `scripts/verify-featured-module.mts` |
| Picker actual mounted lifecycle | `scripts/qa-admin-link-picker.mjs` مع modal accessibility guard القائم |

تم تسجيل picker QA في سلسلة التحقق الحالية؛ ليس runner تطبيق جديدًا. صُحح matcher الحوكمة ليتحقق من error predicate الفعلي، ومرّ تحقق الحوكمة؛ لم يُخفف منع المالك الموازي. صُحح أيضًا افتراض literal edit URL القديم في Project guard ليقبل الاستدعاء المباشر للمالك ويضيف إثبات query فعليًا؛ إيصال البوابة هو مرجع المصدر النهائي.

## P. Complete Final Adoption Matrix

الملف النهائي ذو **257 صفًا** هو `.tmp-qa/admin-near-instant-2026-09-17/interaction-journey-adoption-matrix.json`. لكل صف: Surface، Journey، Owner، Before، Bottleneck، Classification، Fix/Capability، Adopted، After، Network/read cost، Correctness proof، Regression guard، Remaining gap. وتوجد source callsite IDs وtabs والـmanifest IDs والمقاييس المقيّدة بسياقها.

توزيع التصنيف الحالي: H=1، B=11، C=4، I=241؛ A=0. B/C يصنفان المشكلة المحدودة في السطح، ولا يصفان الرحلة كاملة بأنها سريعة. I هنا تعني **نقص دليل timing كامل**، ولا تعني 241 قرار Product أو Architecture. التصنيفات A–I متاحة كما طلبت؛ عدم وجود صف في D/E/F/G لا يعني غياب تلك الأسباب من النظام. مثلًا F مثبت لمقطع block revalidation في delta PB-1، لكنه لا يغيّر كل owner row يستهلكه إلى حكم شامل.

كل الأسطح التي لم تحتج تعديلًا باقية. مسار baseline source لا يُستبدل بمصدر بعدي مجهول؛ `sourceIdentity` و`final-report-source-identity.json` يربطان التقرير بالـfrozen after manifest `2330d9450ec77fb26aaee953b41f468f97ec334b8f8813bdfad10dd5225d496a`، مع baseline exact Git. هوية البوابة النهائية تتقدم على لقطة التقرير الأولية عند تغيير verifier فقط.

## Q. Files changed

القائمة الدقيقة مع before/after hashes محفوظة في `final-report-source-identity.json`، ويتولى إيصال البوابة إدراج final source. مجموعات runtime المعدلة:

- Auth: `src/lib/admin/auth/admin-users.ts`؛ shared picker: `src/components/admin/ui/AdminLinkPicker.tsx`.
- Entity reads: `src/lib/admin/content/load-taxonomy-form-data.ts`؛ `src/lib/admin/projects/project-entry-data.ts`؛ routes `[id]/page.tsx` تحت categories/series/topics/projects.
- Return: `src/lib/admin/form-runtime.ts`؛ Category `CategoriesListClient.tsx` و`categories-columns.tsx` و`CategoryRowActions.tsx` و`CategoryForm.tsx`؛ Series `SeriesTableClient.tsx` و`series-columns.tsx` و`SeriesForm.tsx`؛ Project `ProjectsTableClient.tsx` و`projects-table/ReferenceProjectsTable.tsx` و`ProjectEditForm.tsx`، بجانب routes المذكورة.
- Pages: `src/lib/page-blocks/admin-revalidate.ts` و`admin-queries.ts`؛ actions للأنواع الثمانية المذكورة؛ Content وMedia Sidebar `[id]/page.tsx`؛ `src/lib/featured-modules/load-editor-options.ts` و`src/lib/feed-modules/load-topic-filter-options.ts`.
- التحقق: ملفات guards في O، و`package.json` لتوصيل الاختبار، والأدلة/docs الحالية. `safe-internal-path.ts` لم يتغير. manifests وDB schema/migrations/RLS لم تُنشأ لها مصادر بديلة.

الجرد المنطقي لهذه المرحلة: 43 ملفًا قائمًا عُدّل، وثلاثة ملفات تحقق جديدة، وتقريران. بصورة منفصلة، أُعيدت bytes ملفّي `scripts/fixtures/isolated-supabase/compose.test.yml` و`scripts/lib/isolated-supabase-transport.mjs` إلى LF المطابق تمامًا لـHEAD والـbuild lock؛ قد يظهران في working-tree status، لكن لا تغيير منطقي أو lock أو سياسة فيهما. الدليل `pinned-byte-normalization.json`. ليست هذه عملية كتابة Git.

## R. Tests / Final Gate

**PASS: 137/137، وFull Admin Runtime 32/32، دون pending أو blocked.** الإيصال النهائي `final-gate/receipt.json`، SHA256 `0717f4d3bf8f4c5a14fc5c06db1f1bd334840b54df2d2a77f381345b4b10f04c`، مرتبط بـfinal source manifest hash `0a7506423aab91d44f1dd5de1b68fa018adeed3a96946e157fa773d7b00e24c3`.

التغطية: **61 تنفيذًا و76 إعادة استخدام**. التنفيذ يشمل 58 leaf في المرحلة وثلاث بوابات final isolated Build. إعادة الاستخدام تشمل 70 من أدلة #165 المقبولة (منها واحدة من merge CI)، وست نتائج سابقة صالحة من المرحلة الحالية. الرسم يضيف migration-history-compatibility واختبار picker إلى الفهرس التاريخي 135. لا تعني تغطية Admin Runtime أنه أُعيد تشغيل جميع أوراقه.

هذه بوابة محلية مجمعة وفق dependency graph؛ لم يُشغّل أمر `ci:check` حرفيًا، ولم تُشغّل GitHub CI جديدة. Build02 وproduct identity وplatform contracts مرت على المصدر النهائي، وانتهى cleanup. كل محاولة فاشلة محفوظة ومرتبطة بالنتيجة النهائية التي عالجتها، ولا تُعاد تسميتها نجاحًا. إيصالات hashes ونطاق كل reuse موجودة داخل البوابة.

TypeScript وESLint: PASS. Public 11: دليل مقبول أعيد استخدامه بعد مراجعة tested-path، ولم يُعَد تشغيله. انتهى cleanup لبيئة Build ولنسختي القياس 3005/3006، وبقي تشغيل 3000 الأصلي محفوظًا.

الأدلة الموجهة المتاحة: taxonomy 57/57، integrity 19/19، Project 119/119؛ Form 129/129؛ mounted Close 18/18؛ Project row/query guard 44/44؛ Pages/Featured parity مع source proof؛ picker النهائي سبعة invariants. تنطبق نتيجة كل ملف على hashes ونطاقه المذكور، ولا تغني عن final Build/TypeScript/ESLint/architecture gates المتأثرة.

خطة الإعادة في `final-gate-dependency-reuse-plan.json`. فُحصت 32 حالة dynamic scope يدويًا مع projection hashes: **29 محتفظ بها و3 تحتاج current proof** (5،111،121). الدليل `dynamic-scope-review.json` يغطي scopes الفعلية وtemplate expansion وAST predicates وmounted fixture imports، فلا تتقرر الإعادة بسبب barrel كامل غير منفذ. Public 11 له مراجعة منفصلة `public11-equivalence.json`. لا تعني هذه الملفات تشغيل checks جديدًا أو PASS آليًا.

لم تُفتح Git delivery في هذه المرحلة. لا Commit/Push/PR/Ready/Merge/Deploy، ولا Production write أو login أو migration أو تغيير RLS. النسخ المحلية وأدوات القياس محكومة بنطاق القراءة المصرح به.

## S. Owner & Source-of-Truth Alert

لا تنبيه جديد لمالك موازٍ في التغييرات المنفذة: استُخدمت Owners وCollection/Form manifests الحالية. الجرد والتقرير وملفات `.tmp-qa` إسقاطات أدلة وليست مصادر حقيقة تشغيلية. لا توجد دعوى إغلاق معماري عالمي؛ بلوغ بوابة source proof لا يغلق تلقائيًا كل journey أو قرار قديم.

## T. Remaining opportunities / Decision Required

يبقى إثبات live action-to-usable لكل الأسطح، وsave-confirmed/back-restored لكامل الرحلة، وrender/DB/network attribution على بيئة قياس مستقرة. اختبارات التطوير المعزولة أو session القراءة الموجودة لا تبيح تلقائيًا mutations إنتاجية لاختبار ذلك.

فرص محددة: create→edit return origin؛ scroll/selection/tree expansion؛ Pages query/scroll وrefresh/redirect round trips؛ dedup/abort لusage references؛ reference reuse عبر المحررات؛ تخفيف full-form mount/read بعد إثبات draft semantics. هذه فرص منفصلة، لا تغييرات ضمنية في cache TTL أو public visibility أو Auth.

قرارات #165 الخاصة بـPages وMedia Manage/Picker باقية؛ لا يُعاد فتحها كتطوير واسع دون دليل جديد في نطاقها. فجوات التصنيف I ليست طلبات موافقة جماعية. لا تُخفي المصفوفة أي سطح لغياب التحسين أو الدليل.

لم تظهر في نطاق التغييرات المنفذة بوابة قرار جديدة تتطلب موافقة مستخدم؛ القرارات التقنية المحدودة موثقة عند المالك. حالات Decision Required الثلاث المحتفظ بها من #165 تبقى ضمن حدودها السابقة.

## U. Exact Closure Claim

الادعاء النهائي: **PASS للتحسين المحدود المنفذ عند الملاك المشتركين، مع أدلة قبل/بعد للمقاطع المعزولة، وتخفيض قراءات موثق في خمسة مسارات RSC فعلية، وتصحيح استعادة query عند إغلاق تحرير سجل موجود، وحراس صحة وتبنٍّ وبوابة محلية 137/137.** نتائج الواجهة المتذبذبة لا تسمح بادعاء تحسن سببي أو Near-Instant لكل الرحلة.

لا ندّعي إثبات سرعة جميع تفاعلات الإدارة. انتهى العمل عند التقرير والتغييرات المحلية؛ توقفت قبل Commit/Push/PR/Ready/Merge/Deploy، دون بدء مرحلة أخرى. أي Git Delivery يحتاج تصريحًا منفصلًا.
