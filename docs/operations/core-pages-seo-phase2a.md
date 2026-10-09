# Core Pages SEO Optimization — Phase 2A

Execution and manual handoff record, 2026-10-09. Baseline main: `0f6c201ef89a793698853dcb286229f801ee91c1` (PR #202 closed; local/origin/GitHub main matched; clean worktree). Uses the existing Phase 2A proposal and owner decisions; no new keyword research.

This document is an editorial snapshot, not application configuration, a seed, migration, runtime registry, or alternative source of truth. All business/SEO values remain editable in `public.pages` through the existing CMS SEO form. No runtime code changed.

## 1. SEO Applied

### Home — /

- Primary Target Query: فينيسيا للتطوير العقاري
- Final `seo_title`: فينيسيا للتطوير العقاري
- Final `seo_description`: فينيسيا للتطوير العقاري توثق مشروعاتها على أرض الواقع، من مراحل التنفيذ إلى التسليم، برؤية هندسية واضحة وثقة تُبنى بالفعل.
- Rendered `<title>`: فينيسيا للتطوير العقاري | Venesia Developments
- Rendered meta description: matches final saved description.
- Canonical: https://www.venesia-developments.net/ (derived self canonical; stored `canonical_url` remains NULL).
- Robots: index, follow (stored inheritance/overrides unchanged).
- SEO-owned fields changed: seo_title, focus_keyword; description KEEP.
- Production proof: HTTP 200, authenticated Admin save/reload, Admin search-preview title/description equal public output; OG/Twitter title and description inherit the same output. Images and image metadata unchanged.

### About — /about

- Primary Target Query: UNASSIGNED — `focus_keyword` cleared. Existing evidence does not establish a defensible distinct query; do not invent one or compete with Home for the generic brand query.
- Final `seo_title`: عن فينيسيا
- Final `seo_description`: تعرّف على فينيسيا للتطوير العقاري، قصة بدايتها ورؤيتها وقيمها، ونهجها في متابعة التنفيذ وتوثيق مراحل العمل وبناء علاقة واضحة مع عملائها.
- Rendered `<title>`: عن فينيسيا | فينيسيا للتطوير العقاري - Venesia Developments
- Rendered meta description: matches final saved description.
- Canonical: https://www.venesia-developments.net/about (derived self canonical; stored `canonical_url` remains NULL).
- Robots: index, follow (stored inheritance/overrides unchanged).
- SEO-owned fields changed: seo_description, focus_keyword; title KEEP.
- Production proof: HTTP 200, authenticated Admin save/reload, Admin search-preview title/description equal public output; OG/Twitter title and description inherit the same output. Images and image metadata unchanged.

### Projects — /projects

- Primary Target Query: مشروعات فينيسيا في بيت الوطن
- Final `seo_title`: مشروعات فينيسيا في بيت الوطن
- Final `seo_description`: استكشف مشروعات فينيسيا السكنية في بيت الوطن بالقاهرة الجديدة، وتعرّف على مواقعها وتفاصيل كل مشروع، وانتقل إلى صفحته لمتابعة مراحل التنفيذ.
- Rendered `<title>`: مشروعات فينيسيا في بيت الوطن | فينيسيا للتطوير العقاري - Venesia…
- Rendered meta description: matches final saved description.
- Canonical: https://www.venesia-developments.net/projects (derived self canonical; stored `canonical_url` remains NULL).
- Robots: index, follow (stored inheritance/overrides unchanged).
- SEO-owned fields changed: seo_title, seo_description, focus_keyword.
- Production proof: HTTP 200, authenticated Admin save/reload, Admin search-preview title/description equal public output; OG/Twitter title and description inherit the same output. Images and image metadata unchanged.

### Contact — /contact

- Primary Target Query: التواصل مع فينيسيا للتطوير العقاري
- Final `seo_title`: تواصل معنا
- Final `seo_description`: تواصل مع فريق فينيسيا للتطوير العقاري للاستفسار عن المشروعات أو ترتيب معاينة، عبر الهاتف وواتساب أو نموذج التواصل، واطّلع على عنوان المكتب.
- Rendered `<title>`: تواصل معنا | فينيسيا للتطوير العقاري - Venesia Developments
- Rendered meta description: matches final saved description.
- Canonical: https://www.venesia-developments.net/contact (derived self canonical; stored `canonical_url` remains NULL).
- Robots: index, follow (stored inheritance/overrides unchanged).
- SEO-owned fields changed: seo_description, focus_keyword; title KEEP.
- Production proof: HTTP 200, authenticated Admin save/reload, Admin search-preview title/description equal public output; OG/Twitter title and description inherit the same output. Images and image metadata unchanged.

### Ownership and interpretation

`PageSeoPanel → savePageSeoAction → public.pages → loadPageSeoByPath → generatePublicMetadata → resolveSeoMetadata → buildMetadataFromResolved`. The existing save owner recomputed the derived score tuple, wrote the normal audit, and invalidated the existing page SEO/public caches. Score is not the optimization goal. No direct SQL writes or global settings changes were used.

Home stores the Arabic brand as its title; the existing editor strips the brand-only page segment on reload, and the shared resolver supplies the existing global brand title. This produces the brand-first public/preview title without duplicate suffixes. Projects retains the owner-approved authored title; the existing output-length policy truncates the suffix in rendered output. The title policy was not changed.

The exact generic brand query belongs to Home. Projects owns branded residential project discovery; Contact owns branded contact/conversion. About serves company/entity/trust with no manufactured primary query. No new primary-query duplication was introduced between these pages. This is intent ownership, not a claim of measured ranking cannibalization. The existing Projects H1 conflict and Topic 1577 remain manual/separate-scope issues.

Legacy `seo_keywords` are unchanged, including About; no new keyword list was inferred. The existing field remains an analysis input; this phase uses `focus_keyword` editorially as Primary Target Query without changing shared Admin analysis semantics.

### Verification and preservation

- Four native SEO-only saves and reloads; submitted form deltas restricted to the three approved fields.
- Database comparison: only approved page fields, derived score provenance and normal `updated_at` changed on IDs 1, 2, 36 and 5. Nine other page records unchanged.
- Twenty-one protected content/template/assignment/layout/project/settings tables unchanged.
- Public visible text, H1/H2/H3, links, JSON-LD, Canonical, Robots, OG/Twitter images and image alt values unchanged. Next streamed `<title>` text was excluded from the visible-body comparison, not from metadata verification.
- `npm run verify:global-seo` PASS, including Foundation, adoption, fallback, diagnostics, organization, cache invalidation and public consumers. No new hard-coded manageable SEO values in application code: ZERO.
- The delivery PR records this CMS execution and handoff only. CI, standard merge and automatic Git-triggered Vercel deployment are required; final task evidence verifies the same four public outputs after deployment. No manual deployment.

## 2. Manual Content Handoff

All items below are owner-operated future CMS edits, NOT implemented by this phase. A content mismatch with a proposed future improvement is not a failed metadata check.

### Home

#### 1. فينيسا للتطوير العقارى

- المكان: H2 في قسم التعريف بالشركة أسفل مقدمة Home
- المشكلة: خطأ في كتابة الاسم الرسمي
- التعديل المقترح: تصحيح العنوان فقط من CMS
- النص البديل: فينيسيا للتطوير العقاري
- السبب: اتساق هوية العلامة مع Home owner وMetadata
- الأولوية: P1

#### 2. استثمار يبدأ من اليوم الأول / إدارة هندسية متكاملة / شفافية في التنفيذ / تمويل ذاتي — تظهر النصوص مرتين في DOM

- المكان: قسم نبدأ الاستثمار قبل أن ندعوك إليه
- المشكلة: تكرار محتمل بين نسخ العرض؛ لا يكفي DOM وحده لإثبات تكرار مرئي
- التعديل المقترح: راجع العرض على الكمبيوتر والموبايل ثم احذف النسخة الزائدة فقط إن كانت تكرارًا فعليًا، مع حفظ الوظيفة المتجاوبة
- النص البديل: نسخة واحدة من كل بطاقة عند ثبوت التكرار؛ دون إعادة كتابة
- السبب: وضوح القراءة وتجنب حذف نسخة مطلوبة للعرض
- الأولوية: P2

#### 3. السبت – الخميس 10ص – ٦م

- المكان: بيانات التواصل قرب نهاية Home
- المشكلة: تختلف عن Contact: 9:00 ص إلى 8:00 م
- التعديل المقترح: المالك يحسم المواعيد الصحيحة ويوحد مواضعها من CMS
- النص البديل: OWNER TO EDIT MANUALLY — لا بديل قبل اعتماد المواعيد
- السبب: منع إرباك الزائر قبل التواصل أو الزيارة
- الأولوية: P1

#### 4. الأرض مملوكة بالكامل قبل الطرح / تمويل ذاتي / لا ينتظر تمويل العملاء ليبدأ

- المكان: قسم فلسفة الاستثمار وبطاقات الثقة
- المشكلة: Claims كلية تحتاج إثباتًا لكل نطاق تنطبق عليه
- التعديل المقترح: مراجعة سند الملكية والتمويل ثم الإبقاء أو تقييد العبارة بدقة؛ لا إضافة ادعاء بديل
- النص البديل: يحدده المالك بعد التوثيق
- السبب: دقة الادعاءات وبناء الثقة
- الأولوية: P1

#### 5. من نجن

- المكان: رابط التعريف بالشركة في Footer المشترك
- المشكلة: خطأ كتابي ظاهر في النص المستخرج
- التعديل المقترح: تصحيح label من مالك Footer في CMS مع الحفاظ على الوجهة
- النص البديل: من نحن
- السبب: جودة اللغة؛ تعديل مشترك ينفذه المالك لاحقًا
- الأولوية: P2

### About

#### 1. فينيسيا والبداية التي صنعت الطريق — قسم كامل مكرر مرتين

- المكان: أول أقسام القصة بعد Hero
- المشكلة: تكرار القصة والعنوان في HTML العام
- التعديل المقترح: مراجعة النسختين على أحجام الشاشة ثم إبقاء نسخة العرض الصحيحة وإزالة التكرار الفعلي من التعيين/المحتوى
- النص البديل: فينيسيا والبداية التي صنعت الطريق — نسخة واحدة من القصة الحالية
- السبب: قراءة واضحة وتسلسل قصة الشركة
- الأولوية: P1

#### 2. سلايلاسلا / سلالاسي، وسيلاسلا / سلاسيلاس

- المكان: بطاقتا الاختبار بعد قسم القصة
- المشكلة: نصوص اختبار لا تخدم التعريف بالشركة
- التعديل المقترح: إخراج البطاقتين من العرض يدويًا دون اختراع بدائل أو حذف ملفات
- النص البديل: لا بديل مطلوب إلا إذا اعتمد المالك محتوى حقيقيًا
- السبب: مصداقية الصفحة المؤسسية
- الأولوية: P1

#### 3. بدأنا من القطاع التجاري… فينيسيا نيو كايرو مول وفينيسيا العاصمة الإدارية / أرض مملوكة

- المكان: قصة البداية وقسم البداية من الأرض
- المشكلة: التاريخ التجاري وملكية الأرض يحتاجان توثيقًا؛ لا يعنيان وجود مخزون تجاري منشور حاليًا
- التعديل المقترح: توثيق الأسماء والتاريخ والملكية وضبط نطاق الصياغة إذا لزم
- النص البديل: لا صياغة factual جديدة قبل مستندات المالك
- السبب: منع الخلط بين قصة الشركة والمشروعات المتاحة
- الأولوية: P1

#### 4. احجز استشارتك العقارية المجانية

- المكان: CTA بعد قسم استكشف مشاريعنا قرب نهاية About
- المشكلة: النص قائم لكن وجهة تواصل فعلية غير مثبتة في روابط المحتوى المستخرجة
- التعديل المقترح: تحقق من نوع CTA ووجهته في CMS واربطه بـ /contact إذا كان الغرض طلب استشارة؛ راجع وصف مجانية قبل الإبقاء عليه
- النص البديل: تواصل مع فريق فينيسيا → /contact عند اعتماد الوظيفة
- السبب: تحويل النية إلى إجراء مفهوم دون وعد غير موثق
- الأولوية: P1

### Projects

#### 1. Project I87

- المكان: H1 داخل Hero بوابة /projects
- المشكلة: عنوان مشروع تفصيلي يقوم بدور H1 لبوابة كل مشروعات الشركة
- التعديل المقترح: اجعل H1 مستقبلًا عنوان البوابة مع إبقاء I87 اسم المشروع المميز في مستواه المناسب؛ راجع إعداد Hero من CMS
- النص البديل: مشروعات فينيسيا في بيت الوطن
- السبب: فصل نية البوابة عن صفحة I87 وتوضيح وظيفة /projects
- الأولوية: P1

#### 2. الانتقال من عرض المشروع المميز إلى جميع المشروعات

- المكان: بداية قسم جميع المشروعات
- المشكلة: توجد فرصة اختيارية لتعريف وظيفة البوابة في نص مرئي مستقل
- التعديل المقترح: إضافة مقدمة قصيرة فقط إذا رأى المالك حاجة لذلك، دون تغيير الفلاتر أو الخريطة أو البطاقات
- النص البديل: تعرّف على مشروعات فينيسيا السكنية في بيت الوطن بالقاهرة الجديدة، واختر المشروع للاطلاع على موقعه وتفاصيله ومراحل تنفيذه.
- السبب: مساعدة الزائر على الاختيار؛ ليس شرطًا لإغلاق Metadata
- الأولوية: P2

#### 3. روابط بطاقات المشاريع والخريطة إلى التفاصيل

- المكان: قائمة المشروعات والخريطة
- المشكلة: لا عيب مثبت يستدعي شبكة روابط جديدة
- التعديل المقترح: KEEP؛ إن احتاج المالك CTA للاستفسار فليكن مرة واحدة بعد القائمة
- النص البديل: استفسر عن مشروع → /contact، اختياري
- السبب: حفظ الروابط الطبيعية دون Exact Match stuffing
- الأولوية: P3

### Contact

#### 1. من السبت إلى الخميس - 9:00 ص إلى 8:00 م

- المكان: معلومات التواصل، وإجابة مواعيد العمل في FAQ
- المشكلة: تختلف عن Home التي تعرض 10ص–6م
- التعديل المقترح: Working Hours = OWNER TO EDIT MANUALLY؛ حسم ساعات المكتب وقنوات الرد ثم توحيد النصوص المرتبطة
- النص البديل: لا بديل قبل اعتماد المواعيد
- السبب: دقة الزيارة والتواصل
- الأولوية: P1

#### 2. https://maps.google.com

- المكان: بطاقة موقعنا وزر فتح في خرائط جوجل
- المشكلة: رابط عام لا يحدد المكتب المعروض
- التعديل المقترح: Google Maps destination = OWNER TO EDIT MANUALLY؛ يزوّد المالك رابط دبوس المكتب الصحيح ويختبره
- النص البديل: رابط المكتب المعتمد فقط؛ لا تخمين لإحداثيات أو عنوان
- السبب: تسهيل الوصول ومنع وجهة مضللة
- الأولوية: P1

#### 3. 01033766876 في Contact؛ Home تعرض أيضًا 01050046385 والخط الساخن 15875

- المكان: بطاقات الهاتف ومعلومات التواصل مقابل بيانات Home
- المشكلة: اختلاف تغطية القنوات؛ لا دليل أن أحد الأرقام خطأ
- التعديل المقترح: المالك يؤكد وظيفة وصلاحية كل قناة ويقرر ما يظهر في كل موضع دون تغيير آلي
- النص البديل: القنوات المعتمدة وتسمياتها بعد مراجعة المالك
- السبب: وضوح قنوات التواصل واتساقها
- الأولوية: P2

#### 4. رد سريع على استفساراتك / نرد عليك في أقرب وقت

- المكان: بطاقتا واتساب والبريد
- المشكلة: توقعات استجابة لا تثبت Availability محددة
- التعديل المقترح: مراجعة الوعود وفق القدرة الفعلية؛ عدم إضافة 24/7 أو زمن استجابة محدد بلا اعتماد
- النص البديل: تواصل عبر واتساب / أرسل استفسارك بالبريد، إذا اختار المالك وصف القناة فقط
- السبب: ضبط توقعات العميل
- الأولوية: P2

### Separate decisions / exclusions

- `RealEstateAgent → REVIEW as separate Entity Schema phase`. Venesia is presented as a developer; this global entity decision was not changed. No new FAQPage/AboutPage/ContactPage/CollectionPage, no @id change.
- `SEO / OG Images = DEFERRED_BY_OWNER`; not a blocker.
- No Project Detail SEO, Media Center SEO, Topics optimization, 37 Content Decisions, clusters, articles, dateModified, visible content changes or new internal-link network. Keep natural existing links.
- Manual handoff completion is owned by the site owner and does not prevent closing this metadata-only Phase 2A after release proof.
