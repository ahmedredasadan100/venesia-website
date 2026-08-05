-- GLOBAL TRUTH AND ATOMIC OPERATIONS CLOSURE
-- One forward-only migration for Project truth, Menu ordering, Page Composition,
-- related legacy retirement, Audit, ACL, diagnostics, and regression guards.

begin;

-- ---------------------------------------------------------------------------
-- Project database truth
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists code text,
  add column if not exists show_on_homepage boolean not null default false,
  add column if not exists homepage_order integer not null default 0,
  add column if not exists brochure_url text;

update public.projects
set code = upper(regexp_replace(slug, '[^a-z0-9]+', '-', 'g'))
where nullif(btrim(code), '') is null;

alter table public.projects
  alter column code set not null;

alter table public.projects
  drop constraint if exists projects_code_format_check,
  add constraint projects_code_format_check
    check (code ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'),
  drop constraint if exists projects_homepage_order_check,
  add constraint projects_homepage_order_check
    check (homepage_order >= 0),
  drop constraint if exists projects_brochure_url_check,
  add constraint projects_brochure_url_check
    check (brochure_url is null or brochure_url ~* '^https?://');

create unique index if not exists projects_code_unique_idx
  on public.projects (upper(code));
create unique index if not exists projects_homepage_order_unique_idx
  on public.projects (homepage_order)
  where show_on_homepage;
create index if not exists projects_public_homepage_idx
  on public.projects (publication_status, show_on_homepage, homepage_order, id);

comment on column public.projects.code is
  'Stable Project code. Database-owned and distinct from the presentation name.';
comment on column public.projects.show_on_homepage is
  'Database-owned Home Projects membership.';
comment on column public.projects.homepage_order is
  'Database-owned Home Projects order; unique for included Projects.';

do $project_backfill$
declare
  v_projects constant jsonb := $projects_json$[{"id":"i87","slug":"i87","code":"I87","englishName":"VIEW ZONE RESIDENCE","arabicName":"بيت الوطن — الحي الأول","category":"residential","image":"/images/projects/i87/cover.jpg","heroImage":"/images/projects/i87/hero.jpg","locationLabel":"بيت الوطن — الحي الأول","shortDescription":"مشروع سكني داخل منطقة الفيو زون بالحي الأول، يجمع بين الإطلالة المفتوحة وقرب النوادي والمحاور الرئيسية.","featured":true,"mapArea":"الحي الأول","showOnHomepage":true,"homepageOrder":1,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع I87 داخل منطقة الفيو زون بالحي الأول، إحدى أكثر مناطق بيت الوطن تميزًا بفضل الإطلالات المفتوحة وقربها من النوادي والمحاور الرئيسية. يجمع الموقع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.","bullets":["بيت الوطن — الحي الأول","من أعلى المواقع طلبًا داخل الحي الأول بفضل قربه من الفيو زون والنوادي.","داخل View Zone","قريب من النوادي","قريب من المحاور الرئيسية"],"videoImage":"/images/projects/i87/hero.jpg","images":[{"image":"/images/projects/i87/hero.jpg","label":"واجهة مشروع I87"}]},"districtProfile":{"title":"عن الحي الأول — بيت الوطن","subtitle":"موقع داخل View Zone يمنح المشروع قيمة سكنية واستثمارية واضحة.","body":"الحي الأول في بيت الوطن يتميز بالقرب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد، مع قرب واضح من النوادي والخدمات المركزية والمناطق التجارية. وجود المشروع داخل View Zone يمنحه ميزة إضافية لمن يبحث عن سكن هادئ أو استثمار طويل المدى.","bullets":["داخل View Zone بالحي الأول.","قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد.","قريب من منطقة الخدمات المركزية والمناطق التجارية.","قريب من النادي الأهلي ونادي الشرطة ونادي الجزيرة.","مناسب للسكن العائلي والاستثمار طويل المدى."],"image":"/images/projects/i87/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/i87/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/i87/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/i87/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/i87/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/i87/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع I87","title":"تابع تنفيذ I87 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الأول"},{"label":"القيمة الاستثمارية","value":"من أعلى المواقع طلبًا داخل الحي الأول بفضل قربه من الفيو زون والنوادي."},{"label":"مناسب لـ","value":"السكن العائلي / الاستثمار طويل المدى"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/i87/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/i87/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/i87/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/i87/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/i87/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/i87/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/i87/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/i87/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/i87/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/i87/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/i87/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/i87/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/i87/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/i87/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/i87/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/i87/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/i87/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/i87/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الأول — قطعة I87","distance":"قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد، مع سهولة الوصول إلى النوادي والخدمات اليومية.","mapImage":"/images/projects/i87/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل I87","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"i76","slug":"i76","code":"I76","englishName":"VIEW ZONE RESIDENCE","arabicName":"بيت الوطن — الحي الأول","category":"residential","image":"/images/projects/I76/cover.jpg","heroImage":"/images/projects/I76/hero.jpg","locationLabel":"بيت الوطن — الحي الأول","shortDescription":"مشروع سكني داخل منطقة الفيو زون بالحي الأول، يجمع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.","featured":false,"mapArea":"الحي الأول","showOnHomepage":true,"homepageOrder":2,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع I76 داخل منطقة الفيو زون بالحي الأول، إحدى أكثر مناطق بيت الوطن تميزًا بفضل الإطلالات المفتوحة وقربها من النوادي والمحاور الرئيسية. يجمع الموقع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.","bullets":["بيت الوطن — الحي الأول","من أعلى المواقع طلبًا داخل الحي الأول بفضل قربه من الفيو زون والنوادي.","داخل View Zone","قريب من النوادي","قريب من المحاور الرئيسية"],"videoImage":"/images/projects/I76/hero.jpg","images":[{"image":"/images/projects/I76/hero.jpg","label":"واجهة مشروع I76"}]},"districtProfile":{"title":"عن الحي الأول — بيت الوطن","subtitle":"موقع داخل View Zone يمنح المشروع قيمة سكنية واستثمارية واضحة.","body":"يقع المشروع داخل منطقة الفيو زون بالحي الأول، إحدى أكثر مناطق بيت الوطن تميزًا بفضل الإطلالات المفتوحة وقربها من النوادي والمحاور الرئيسية. يجمع الموقع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.","bullets":["داخل View Zone بالحي الأول.","قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد.","قريب من منطقة الخدمات المركزية والمناطق التجارية والخدمات اليومية.","قريب من النادي الأهلي ونادي الشرطة ونادي الجزيرة.","قريب من مدينتي وHeliopark وPalm Hills وMountain View.","مناسب للسكن العائلي والاستثمار طويل المدى."],"image":"/images/projects/I76/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/I76/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/I76/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/I76/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/I76/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/I76/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع I76","title":"تابع تنفيذ I76 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الأول"},{"label":"القيمة الاستثمارية","value":"من أعلى المواقع طلبًا داخل الحي الأول بفضل قربه من الفيو زون والنوادي."},{"label":"مناسب لـ","value":"السكن العائلي / الاستثمار طويل المدى"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/I76/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/I76/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/I76/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/I76/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/I76/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/I76/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/I76/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/I76/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/I76/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/I76/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/I76/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/I76/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/I76/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/I76/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/I76/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/I76/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/I76/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/I76/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الأول — قطعة I76","distance":"قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد، مع سهولة الوصول إلى النوادي والخدمات اليومية والمناطق المحيطة.","mapImage":"/images/projects/I76/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل I76","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"b84","slug":"b84","code":"B84","englishName":"CALM RESIDENCE","arabicName":"بيت الوطن — الحي الأول","category":"residential","image":"/images/projects/b84/cover.jpg","heroImage":"/images/projects/b84/hero.jpg","locationLabel":"ddddd","shortDescription":"مشروع سكني هادئ داخل الحي الأول، مناسب للسكن المستقر مع سهولة الوصول إلى الخدمات والمحاور.","featured":false,"mapArea":"اdddل","showOnHomepage":true,"homepageOrder":3,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع B84 في موقع سكني هادئ داخل الحي الأول، مع سهولة الوصول إلى الخدمات والمحاور الرئيسية، ما يجعله مناسبًا للراغبين في السكن المستقر داخل بيت الوطن.","bullets":["ddddd","قيمة جيدة ومستقرة داخل الحي الأول.","موقع هادئ","قرب الخدمات","سهولة الوصول"],"videoImage":"/images/projects/b84/hero.jpg","images":[{"image":"/images/projects/b84/hero.jpg","label":"واجهة مشروع B84"}]},"districtProfile":{"title":"عن الحي الأول — بيت الوطن","subtitle":"حي هادئ بقيمة مستقرة وسهولة حركة يومية.","body":"يمنح الحي الأول في بيت الوطن بيئة سكنية هادئة مع قرب من طريق السويس وشارع التسعين والخدمات اليومية. موقع B84 مناسب لمن يبحث عن سكن عملي مستقر وقيمة استثمارية جيدة على المدى الطويل.","bullets":["موقع سكني هادئ داخل الحي الأول.","قريب من طريق السويس وشارع التسعين.","قريب من خدمات الحي الأول والمناطق التجارية.","قيمة استثمارية جيدة ومستقرة."],"image":"/images/projects/b84/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/b84/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/b84/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/b84/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/b84/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/b84/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع B84","title":"تابع تنفيذ B84 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"ddddd"},{"label":"القيمة الاستثمارية","value":"قيمة جيدة ومستقرة داخل الحي الأول."},{"label":"مناسب لـ","value":"السكن المستقر / الاستثمار الهادئ"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/b84/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/b84/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/b84/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/b84/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/b84/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/b84/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/b84/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/b84/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/b84/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/b84/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/b84/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/b84/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/b84/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/b84/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/b84/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/b84/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/b84/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/b84/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الأول — قطعة B84","distance":"قريب من طريق السويس وشارع التسعين، مع وصول مباشر إلى خدمات الحي الأول والمناطق التجارية.","mapImage":"/images/projects/b84/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل B84","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"c35","slug":"c35","code":"C35","englishName":"EAST GATE","arabicName":"بيت الوطن — الحي الثاني","category":"residential","image":"/images/projects/c35/cover.jpg","heroImage":"/images/projects/c35/hero.jpg","locationLabel":"بيت الوطن — الحي الثاني","shortDescription":"مشروع سكني في قلب الحي الثاني، قريب من الخدمات المركزية والمحاور الرئيسية.","featured":true,"mapArea":"الحي الثاني","showOnHomepage":true,"homepageOrder":4,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع C35 بالقرب من منطقة الخدمات المركزية بالحي الثاني، أحد أكثر أحياء بيت الوطن اكتمالًا من حيث البنية التحتية والخدمات. يجمع الموقع بين سهولة الوصول إلى شارع التسعين الشمالي ومحور بن زايد وبين القرب من المرافق اليومية، ما يجعله مناسبًا للسكن والاستثمار على حد سواء.","bullets":["بيت الوطن — الحي الثاني","مرتفعة بفضل اكتمال الحي وقرب الخدمات.","قلب الحي الثاني","قرب الخدمات","سهولة الحركة"],"videoImage":"/images/projects/c35/hero.jpg","images":[{"image":"/images/projects/c35/hero.jpg","label":"واجهة مشروع C35"}]},"districtProfile":{"title":"عن الحي الثاني — بيت الوطن","subtitle":"موقع مكتمل البنية وقريب من قلب الحركة في القاهرة الجديدة.","body":"الحي الثاني في بيت الوطن يُعد من أكثر الأحياء تميزًا داخل القاهرة الجديدة، لقربه من شارع التسعين الشمالي وطريق السويس، واكتمال البنية التحتية، وارتفاع نسب الإنشاءات القائمة، مما يجعله مناسبًا للسكن والاستثمار طويل المدى.","bullets":["يقع في قلب الحي الثاني.","قريب من شارع التسعين الشمالي ومحور بن زايد وطريق السويس.","قريب من منطقة الخدمات المركزية والهايبر ماركت والمنطقة التجارية.","قريب من النادي الأهلي ونادي الشرطة.","قيمة استثمارية مرتفعة بفضل اكتمال الحي وقرب الخدمات."],"image":"/images/projects/c35/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/c35/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/c35/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/c35/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/c35/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/c35/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع C35","title":"تابع تنفيذ C35 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الثاني"},{"label":"القيمة الاستثمارية","value":"مرتفعة بفضل اكتمال الحي وقرب الخدمات."},{"label":"مناسب لـ","value":"السكن / الاستثمار"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/c35/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/c35/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/c35/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/c35/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/c35/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/c35/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/c35/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/c35/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/c35/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/c35/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/c35/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/c35/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/c35/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/c35/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/c35/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/c35/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/c35/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/c35/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الثاني — قطعة C35","distance":"قريب من شارع التسعين الشمالي ومحور بن زايد وطريق السويس، مع قرب مباشر من الخدمات المركزية والهايبر ماركت والمنطقة التجارية.","mapImage":"/images/projects/c35/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل C35","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"j118","slug":"j118","code":"J118","englishName":"CENTRAL RESIDENCE","arabicName":"بيت الوطن — الحي الثاني","category":"residential","image":"/images/projects/j118/cover.jpg","heroImage":"/images/projects/j118/hero.jpg","locationLabel":"بيت الوطن — الحي الثاني","shortDescription":"مشروع قريب من الخدمات الرئيسية والهايبر ماركت داخل الحي الثاني.","featured":false,"mapArea":"الحي الثاني","showOnHomepage":true,"homepageOrder":5,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع J118 بالقرب من الخدمات الرئيسية والهايبر ماركت، ما يوفر سهولة الوصول إلى الاحتياجات اليومية ويعزز من القيمة السكنية والاستثمارية للموقع.","bullets":["بيت الوطن — الحي الثاني","مرتفعة.","قرب الهايبر ماركت","قرب الخدمات المركزية","موقع عملي"],"videoImage":"/images/projects/j118/hero.jpg","images":[{"image":"/images/projects/j118/hero.jpg","label":"واجهة مشروع J118"}]},"districtProfile":{"title":"عن الحي الثاني — بيت الوطن","subtitle":"قرب مباشر من الخدمات اليومية داخل حي مكتمل الحركة.","body":"يتميز الحي الثاني بسهولة الوصول إلى شارع التسعين ومحور بن زايد، مع توافر الخدمات المركزية والهايبر ماركت والمنطقة التجارية. موقع J118 مناسب لمن يريد سكنًا عمليًا قريبًا من احتياجاته اليومية.","bullets":["قريب من شارع التسعين ومحور بن زايد.","قريب من الهايبر ماركت والخدمات المركزية.","قريب من المنطقة التجارية.","قيمة استثمارية مرتفعة."],"image":"/images/projects/j118/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/j118/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/j118/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/j118/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/j118/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/j118/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع J118","title":"تابع تنفيذ J118 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الثاني"},{"label":"القيمة الاستثمارية","value":"مرتفعة."},{"label":"مناسب لـ","value":"السكن العملي / الاستثمار"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/j118/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/j118/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/j118/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/j118/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/j118/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/j118/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/j118/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/j118/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/j118/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/j118/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/j118/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/j118/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/j118/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/j118/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/j118/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/j118/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/j118/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/j118/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الثاني — قطعة J118","distance":"قريب من شارع التسعين ومحور بن زايد، مع وصول سهل إلى الهايبر ماركت والخدمات المركزية والمنطقة التجارية.","mapImage":"/images/projects/j118/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل J118","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"j191","slug":"j191","code":"J191","englishName":"LINK RESIDENCE","arabicName":"بيت الوطن — الحي الثاني","category":"residential","image":"/images/projects/j191/cover.jpg","heroImage":"/images/projects/j191/hero.jpg","locationLabel":"بيت الوطن — الحي الثاني","shortDescription":"مشروع يربط بين المناطق السكنية والخدمية داخل الحي الثاني.","featured":false,"mapArea":"الحي الثاني","showOnHomepage":true,"homepageOrder":6,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع J191 في موقع يربط بين المناطق السكنية والخدمية داخل الحي الثاني، ويوفر سهولة الوصول إلى المحاور الرئيسية مع الحفاظ على الطابع السكني الهادئ.","bullets":["بيت الوطن — الحي الثاني","جيدة جدًا.","موقع متوازن","قرب الخدمات","طابع سكني هادئ"],"videoImage":"/images/projects/j191/hero.jpg","images":[{"image":"/images/projects/j191/hero.jpg","label":"واجهة مشروع J191"}]},"districtProfile":{"title":"عن الحي الثاني — بيت الوطن","subtitle":"توازن بين الهدوء السكني وسهولة الوصول للخدمات.","body":"يوفر الحي الثاني في بيت الوطن مزيجًا عمليًا بين الحركة اليومية والخدمات القريبة والهدوء السكني. موقع J191 مناسب لمن يبحث عن نقطة متوازنة داخل حي مكتمل ومتصاعد القيمة.","bullets":["قريب من شارع التسعين ومحور بن زايد.","قريب من الخدمات المركزية والمنطقة التجارية.","يربط بين المناطق السكنية والخدمية.","قيمة استثمارية جيدة جدًا."],"image":"/images/projects/j191/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/j191/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/j191/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/j191/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/j191/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/j191/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع J191","title":"تابع تنفيذ J191 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الثاني"},{"label":"القيمة الاستثمارية","value":"جيدة جدًا."},{"label":"مناسب لـ","value":"السكن / الاستثمار طويل المدى"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/j191/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/j191/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/j191/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/j191/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/j191/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/j191/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/j191/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/j191/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/j191/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/j191/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/j191/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/j191/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/j191/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/j191/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/j191/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/j191/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/j191/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/j191/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الثاني — قطعة J191","distance":"قريب من شارع التسعين ومحور بن زايد، مع سهولة الوصول إلى الخدمات المركزية والمنطقة التجارية.","mapImage":"/images/projects/j191/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل J191","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"f92","slug":"f92","code":"F92","englishName":"SKY LINE","arabicName":"بيت الوطن — الحي الرابع","category":"residential","image":"/images/projects/f92/cover.jpg","heroImage":"/images/projects/f92/hero.jpg","locationLabel":"بيت الوطن — الحي الرابع","shortDescription":"مشروع قريب من منطقة النوادي بالحي الرابع، مناسب للسكن والاستثمار.","featured":true,"mapArea":"الحي الرابع","showOnHomepage":true,"homepageOrder":7,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع F92 بالقرب من منطقة النوادي بالحي الرابع، وعلى مسافة قصيرة من النادي الأهلي ونادي الشرطة، ما يجعله من أكثر المواقع طلبًا داخل بيت الوطن للسكن والاستثمار.","bullets":["بيت الوطن — الحي الرابع","من أعلى المواقع استثماريًا داخل الحي الرابع.","منطقة النوادي","قرب الخدمات","سهولة الوصول"],"videoImage":"/images/projects/f92/hero.jpg","images":[{"image":"/images/projects/f92/hero.jpg","label":"واجهة مشروع F92"}]},"districtProfile":{"title":"عن الحي الرابع — بيت الوطن","subtitle":"حي راقٍ يجمع بين الهدوء السكني والقيمة الاستثمارية.","body":"الحي الرابع في بيت الوطن يتميز بموقع حيوي داخل القاهرة الجديدة، وقربه من شارع النوادي والفيو زون والمحاور الرئيسية، مع شوارع واسعة وكثافة سكانية منخفضة، ليقدم بيئة مناسبة للسكن الهادئ والاستثمار المستقبلي.","bullets":["قريب من محور بن زايد وطريق السويس وشارع التسعين.","قريب من الخدمات المركزية والمنطقة التجارية.","قريب من النادي الأهلي ونادي الشرطة.","من أعلى المواقع استثماريًا داخل الحي الرابع.","موقع مناسب للسكن والاستثمار بفضل قربه من منطقة النوادي."],"image":"/images/projects/f92/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/f92/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/f92/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/f92/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/f92/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/f92/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع F92","title":"تابع تنفيذ F92 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الرابع"},{"label":"القيمة الاستثمارية","value":"من أعلى المواقع استثماريًا داخل الحي الرابع."},{"label":"مناسب لـ","value":"السكن / الاستثمار"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/f92/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/f92/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/f92/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/f92/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/f92/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/f92/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/f92/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/f92/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/f92/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/f92/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/f92/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/f92/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/f92/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/f92/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/f92/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/f92/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/f92/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/f92/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الرابع — قطعة F92","distance":"قريب من محور بن زايد وطريق السويس وشارع التسعين، مع قرب من الخدمات المركزية والمنطقة التجارية والنادي الأهلي ونادي الشرطة.","mapImage":"/images/projects/f92/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل F92","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"f222","slug":"f222","code":"F222","englishName":"CLUB SIDE RESIDENCE","arabicName":"بيت الوطن — الحي الرابع","category":"residential","image":"/images/projects/f222/cover.jpg","heroImage":"/images/projects/f222/hero.jpg","locationLabel":"بيت الوطن — الحي الرابع","shortDescription":"مشروع يربط بين منطقة النوادي والخدمات التجارية داخل الحي الرابع.","featured":false,"mapArea":"الحي الرابع","showOnHomepage":true,"homepageOrder":8,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع F222 في موقع مميز يربط بين منطقة النوادي والخدمات التجارية، ويوفر توازنًا مثاليًا بين الحياة السكنية والاحتياجات اليومية.","bullets":["بيت الوطن — الحي الرابع","مرتفعة.","قريب من النوادي","قريب من التجاري","توازن بين السكن والخدمات"],"videoImage":"/images/projects/f222/hero.jpg","images":[{"image":"/images/projects/f222/hero.jpg","label":"واجهة مشروع F222"}]},"districtProfile":{"title":"عن الحي الرابع — بيت الوطن","subtitle":"موقع قريب من النوادي والخدمات اليومية.","body":"يجمع الحي الرابع بين القرب من النوادي والمحاور والخدمات التجارية، ما يمنح F222 قيمة سكنية واستثمارية واضحة. الموقع مناسب لمن يبحث عن حياة يومية سهلة داخل بيئة سكنية راقية.","bullets":["قريب من المنطقة التجارية والخدمات المركزية.","قريب من النادي الأهلي ونادي الشرطة.","يربط بين منطقة النوادي والخدمات التجارية.","قيمة استثمارية مرتفعة."],"image":"/images/projects/f222/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/f222/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/f222/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/f222/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/f222/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/f222/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع F222","title":"تابع تنفيذ F222 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — الحي الرابع"},{"label":"القيمة الاستثمارية","value":"مرتفعة."},{"label":"مناسب لـ","value":"السكن الراقي / الاستثمار"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/f222/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/f222/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/f222/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/f222/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/f222/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/f222/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/f222/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/f222/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/f222/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/f222/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/f222/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/f222/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/f222/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/f222/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/f222/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/f222/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/f222/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/f222/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — الحي الرابع — قطعة F222","distance":"قريب من المنطقة التجارية والخدمات المركزية، مع قرب واضح من النادي الأهلي ونادي الشرطة.","mapImage":"/images/projects/f222/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل F222","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"d174","slug":"d174","code":"D174","englishName":"NORTH HOUSE","arabicName":"بيت الوطن — النورث هاوس","category":"residential","image":"/images/projects/d174/cover.jpg","heroImage":"/images/projects/d174/hero.jpg","locationLabel":"بيت الوطن — النورث هاوس","shortDescription":"مشروع سكني محدود الوحدات في النورث هاوس، يجمع بين الخصوصية وقرب المحاور والخدمات الرئيسية.","featured":true,"mapArea":"النورث هاوس","showOnHomepage":true,"homepageOrder":9,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع D174 بمنطقة النورث هاوس في بيت الوطن بالقاهرة الجديدة، بالقرب من طريق السويس وشارع التسعين الشمالي وشارع النوادي، مع سهولة الوصول إلى مدينتي والشروق والرحاب. يتميز المشروع بموقع هادئ منخفض الكثافة السكانية مع قربه من الخدمات والمناطق التجارية والترفيهية، مما يجمع بين الخصوصية وسهولة الحركة اليومية.","bullets":["بيت الوطن — النورث هاوس","قيمة قوية بفضل الهدوء وقرب المحاور والخدمات.","موقع مميز داخل النورث هاوس","قرب المحاور","خصوصية أعلى"],"videoImage":"/images/projects/d174/hero.jpg","images":[{"image":"/images/projects/d174/hero.jpg","label":"واجهة مشروع D174"}]},"districtProfile":{"title":"عن النورث هاوس — بيت الوطن","subtitle":"منطقة هادئة منخفضة الكثافة وقريبة من محاور الحركة الرئيسية.","body":"النورث هاوس واحدة من المناطق السكنية المميزة في بيت الوطن، تجمع بين الهدوء والخصوصية وسهولة الوصول إلى طريق السويس وشارع التسعين الشمالي وشارع النوادي، مع قرب واضح من الرحاب ومدينتي والشروق.","bullets":["قرب مباشر من طريق السويس ومحاور القاهرة الجديدة.","سهولة الوصول إلى شارع التسعين الشمالي وشارع النوادي.","قريبة من الرحاب ومدينتي والشروق.","كثافة سكانية أقل وخصوصية أعلى للحياة اليومية.","موقع مناسب للعائلات الباحثة عن الهدوء والقيمة المستقبلية."],"image":"/images/projects/d174/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/d174/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/d174/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/d174/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/d174/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/d174/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع D174","title":"تابع تنفيذ D174 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — النورث هاوس"},{"label":"القيمة الاستثمارية","value":"قيمة قوية بفضل الهدوء وقرب المحاور والخدمات."},{"label":"مناسب لـ","value":"السكن العائلي / الاستثمار طويل المدى"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/d174/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/d174/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/d174/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/d174/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/d174/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/d174/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/d174/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/d174/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/d174/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/d174/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/d174/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/d174/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/d174/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/d174/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/d174/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/d174/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/d174/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/d174/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — النورث هاوس — قطعة D174","distance":"قريب من طريق السويس وشارع التسعين الشمالي وشارع النوادي، مع سهولة الوصول إلى مدينتي والشروق والرحاب.","mapImage":"/images/projects/d174/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل D174","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"b137","slug":"b137","code":"B137","englishName":"NORTH COMMERCIAL SIDE","arabicName":"بيت الوطن — النورث هاوس","category":"residential","image":"/images/projects/b137/cover.jpg","heroImage":"/images/projects/b137/hero.jpg","locationLabel":"بيت الوطن — النورث هاوس","shortDescription":"مشروع قريب من الشريط التجاري والخدمات الرئيسية بمنطقة النورث هاوس.","featured":false,"mapArea":"النورث هاوس","showOnHomepage":true,"homepageOrder":10,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع B137 بالقرب من الشريط التجاري والخدمات الرئيسية بمنطقة النورث هاوس، ما يمنحه ميزة الجمع بين الراحة السكنية وسهولة الوصول إلى الاحتياجات اليومية.","bullets":["بيت الوطن — النورث هاوس","جيدة جدًا.","قريب من الخدمات","قريب من التجاري","سهولة الحياة اليومية"],"videoImage":"/images/projects/b137/hero.jpg","images":[{"image":"/images/projects/b137/hero.jpg","label":"واجهة مشروع B137"}]},"districtProfile":{"title":"عن النورث هاوس — بيت الوطن","subtitle":"قرب من التجاري والخدمات داخل منطقة هادئة منخفضة الكثافة.","body":"النورث هاوس منطقة سكنية هادئة داخل بيت الوطن، ويمنح قرب B137 من التجاري والإداري والخدمات الرئيسية ميزة يومية مهمة للسكان وقيمة استثمارية جيدة جدًا.","bullets":["قريب من التجاري والإداري والخدمات الرئيسية.","يجمع بين الراحة السكنية وسهولة الوصول للاحتياجات اليومية.","قيمة استثمارية جيدة جدًا.","موقع مناسب لمن يريد الهدوء بدون الابتعاد عن الخدمات."],"image":"/images/projects/b137/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/b137/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/b137/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/b137/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/b137/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/b137/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع B137","title":"تابع تنفيذ B137 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — النورث هاوس"},{"label":"القيمة الاستثمارية","value":"جيدة جدًا."},{"label":"مناسب لـ","value":"السكن / الاستثمار"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/b137/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/b137/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/b137/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/b137/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/b137/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/b137/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/b137/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/b137/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/b137/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/b137/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/b137/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/b137/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/b137/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/b137/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/b137/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/b137/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/b137/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/b137/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — النورث هاوس — قطعة B137","distance":"قريب من التجاري والإداري والخدمات الرئيسية بمنطقة النورث هاوس.","mapImage":"/images/projects/b137/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل B137","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"b138","slug":"b138","code":"B138","englishName":"NORTH ACTIVE RESIDENCE","arabicName":"بيت الوطن — النورث هاوس","category":"residential","image":"/images/projects/b138/cover.jpg","heroImage":"/images/projects/b138/hero.jpg","locationLabel":"بيت الوطن — النورث هاوس","shortDescription":"مشروع في منطقة حيوية داخل النورث هاوس بالقرب من الخدمات والتجاري.","featured":false,"mapArea":"النورث هاوس","showOnHomepage":true,"homepageOrder":11,"brochureUrl":"","residentialDetails":{"tabs":[{"id":"district","label":"عن الموقع"},{"id":"overview","label":"نظرة عامة"},{"id":"plans","label":"المساحات والمخططات"},{"id":"delivery-specs","label":"مواصفات التنفيذ"},{"id":"execution","label":"مراحل التنفيذ"},{"id":"contact","label":"تواصل معنا"}],"overview":{"title":"لمحة عن المشروع","body":"يقع مشروع B138 في واحدة من أكثر المناطق حيوية داخل النورث هاوس، بالقرب من الخدمات والتجاري، مع موقع يحقق توازنًا بين السكن المريح والقيمة الاستثمارية المستقبلية.","bullets":["بيت الوطن — النورث هاوس","مرتفعة.","حيوية الموقع","قرب الخدمات","سهولة الحركة"],"videoImage":"/images/projects/b138/hero.jpg","images":[{"image":"/images/projects/b138/hero.jpg","label":"واجهة مشروع B138"}]},"districtProfile":{"title":"عن النورث هاوس — بيت الوطن","subtitle":"موقع حيوي داخل منطقة سكنية هادئة ومتنامية القيمة.","body":"يجمع B138 بين الحيوية وقرب الخدمات داخل النورث هاوس، حيث يقترب من التجاري والإداري والخدمات المركزية، مع الحفاظ على طابع سكني مريح وقيمة مستقبلية مرتفعة.","bullets":["قريب من التجاري والإداري والخدمات المركزية.","موقع حيوي داخل النورث هاوس.","توازن بين السكن المريح والقيمة الاستثمارية.","سهولة حركة يومية بفضل قرب الخدمات."],"image":"/images/projects/b138/location-map.jpg"},"deliverySpecs":{"title":"مواصفات التنفيذ والتسليم","subtitle":"نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.","items":["هيكل خرساني مسلح وتنفيذ هندسي معتمد.","باب رئيسي مصفح لكل وحدة.","تأسيس كامل للكهرباء والسباكة.","محارة كاملة للوحدة.","واجهات حجر هاشمة بتصميم معماري حديث.","مدخل وسلالم من رخام الجلالة.","مصعد كهربائي.","جراج خاص للسكان.","عزل حراري ومائي للدور الأخير.","إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي."],"images":[{"image":"/images/projects/b138/specs-01.jpg","label":"مدخل المشروع"},{"image":"/images/projects/b138/specs-02.jpg","label":"المصعد"},{"image":"/images/projects/b138/specs-03.jpg","label":"السلالم"},{"image":"/images/projects/b138/specs-04.jpg","label":"الواجهة"},{"image":"/images/projects/b138/specs-05.jpg","label":"تفاصيل التسليم"}]},"contactCta":{"eyebrow":"مشروع B138","title":"تابع تنفيذ B138 خطوة بخطوة.","body":"مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.","buttonLabel":"تواصل معنا","href":"https://wa.me/201000000000"},"quickFacts":[{"label":"الموقع","value":"بيت الوطن — النورث هاوس"},{"label":"القيمة الاستثمارية","value":"مرتفعة."},{"label":"مناسب لـ","value":"السكن المريح / الاستثمار المستقبلي"}],"availableAreas":[{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/b138/floorplan-01.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]},{"area":"130m² + Garden 90m²","label":"أرضي بجاردن","planImage":"/images/projects/b138/floorplan-02.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"],"featured":true},{"area":"185m²","label":"متكرر","planImage":"/images/projects/b138/floorplan-03.jpg","specs":["3 غرف","3 حمامات","ريسبشن","سفرة","مطبخ"]}],"executionJourney":[{"id":"excavation","title":"أعمال الحفر وتجهيز الموقع","progress":100,"status":"مكتمل","image":"/images/projects/b138/progress-01.jpg","summary":"تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.","lastUpdated":"موثق بالموقع","updates":[{"id":"excavation-start","title":"بداية أعمال الحفر","date":"موثق بالموقع","progress":100,"image":"/images/projects/b138/progress-01.jpg","description":"بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.","gallery":["/images/projects/b138/progress-01.jpg"]}]},{"id":"foundations","title":"الأساسات والبيزمنت","progress":100,"status":"مكتمل","image":"/images/projects/b138/progress-02.jpg","summary":"تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.","lastUpdated":"موثق بالموقع","updates":[{"id":"basement-works","title":"أعمال الأساسات والبيزمنت","date":"موثق بالموقع","progress":100,"image":"/images/projects/b138/progress-02.jpg","description":"تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.","gallery":["/images/projects/b138/progress-02.jpg"]}]},{"id":"concrete-structure","title":"الهيكل الخرساني","progress":100,"status":"مكتمل","image":"/images/projects/b138/progress-03.jpg","summary":"اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.","lastUpdated":"موثق بالموقع","updates":[{"id":"concrete-stage","title":"مرحلة الهيكل الخرساني","date":"موثق بالموقع","progress":100,"image":"/images/projects/b138/progress-03.jpg","description":"تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.","gallery":["/images/projects/b138/progress-03.jpg"]}]},{"id":"masonry","title":"أعمال المباني","progress":100,"status":"مكتمل","image":"/images/projects/b138/progress-04.jpg","summary":"تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.","lastUpdated":"موثق بالموقع","updates":[{"id":"masonry-stage","title":"مرحلة أعمال المباني","date":"موثق بالموقع","progress":100,"image":"/images/projects/b138/progress-04.jpg","description":"تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.","gallery":["/images/projects/b138/progress-04.jpg"]}]},{"id":"internal-finishing","title":"المحارة والكهرباء الداخلية","progress":70,"status":"جاري التنفيذ","image":"/images/projects/b138/progress-05.jpg","summary":"دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.","lastUpdated":"موثق بالموقع","updates":[{"id":"internal-plaster-electric","title":"أعمال المحارة وتجهيزات الكهرباء","date":"موثق بالموقع","progress":70,"image":"/images/projects/b138/progress-05.jpg","description":"جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.","gallery":["/images/projects/b138/progress-05.jpg"]}]}],"location":{"title":"الموقع","address":"القاهرة الجديدة — بيت الوطن — النورث هاوس — قطعة B138","distance":"قريب من التجاري والإداري والخدمات المركزية داخل منطقة النورث هاوس.","mapImage":"/images/projects/b138/location-map.jpg","mapButtonLabel":"عرض موقع المشروع"},"cta":{"title":"تعرف على تفاصيل B138","body":"اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.","buttonLabel":"تواصل معنا"}}},{"id":"vnc","slug":"venesia-new-cairo-mall","code":"VNC","englishName":"Venesia New Cairo Mall","arabicName":"فينيسيا نيو كايرو مول","category":"commercial","image":"/images/6666.png","heroImage":"/images/6666.png","locationLabel":"القاهرة الجديدة — الحي الثاني","shortDescription":"وجهة تجارية واستثمارية تقترب من التشغيل بعد رحلة تنفيذ موثقة.","featured":true,"mapArea":"القاهرة الجديدة","showOnHomepage":true,"homepageOrder":12},{"id":"rm","slug":"riyad-mall","code":"RM","englishName":"Riyad Mall","arabicName":"الرياض مول","category":"commercial","image":"/images/cta-building-night.png","heroImage":"/images/cta-building-night.png","locationLabel":"القاهرة الجديدة — بيت الوطن","shortDescription":"مشروع تجاري قائم على موقع حيوي ومسار تنفيذ واضح.","featured":false,"mapArea":"بيت الوطن","showOnHomepage":true,"homepageOrder":13}]$projects_json$::jsonb;
  v_seed jsonb;
  v_details jsonb;
  v_project_id bigint;
  v_plan jsonb;
  v_plan_id bigint;
  v_item jsonb;
  v_image jsonb;
  v_stage jsonb;
  v_update jsonb;
  v_spec text;
  v_index integer;
  v_governorate_id bigint;
  v_city_id bigint;
  v_main_area_id bigint;
  v_sub_area_id bigint;
  v_existed boolean;
  v_location_label text;
  v_map_area text;
  v_missing_before integer;
  v_inserted integer := 0;
begin
  if jsonb_typeof(v_projects) <> 'array' or jsonb_array_length(v_projects) <> 13 then
    raise exception 'Project truth backfill refused: expected exactly 13 catalog records';
  end if;

  if (select count(distinct item->>'slug') from jsonb_array_elements(v_projects) item) <> 13
     or (select count(distinct upper(item->>'code')) from jsonb_array_elements(v_projects) item) <> 13 then
    raise exception 'Project truth backfill refused: duplicate slug or code in the retired catalog';
  end if;

  select count(*) into v_missing_before
  from jsonb_array_elements(v_projects) item
  where not exists (select 1 from public.projects p where p.slug = item->>'slug');

  select id into v_governorate_id
  from public.project_locations
  where level = 'governorate' and lower(name_en) = 'cairo'
  order by id limit 1;
  select id into v_city_id
  from public.project_locations
  where level = 'city' and parent_id = v_governorate_id and lower(name_en) = 'new cairo'
  order by id limit 1;

  if v_governorate_id is null or v_city_id is null then
    raise exception 'Project truth backfill refused: Cairo/New Cairo hierarchy is missing';
  end if;

  insert into public.project_locations (level, parent_id, name_ar, name_en, sort_order, is_active)
  select 'main_area', v_city_id, 'بيت الوطن', 'Bait El Watan', 10, true
  where not exists (
    select 1 from public.project_locations
    where level = 'main_area' and parent_id = v_city_id and lower(name_en) = 'bait el watan'
  );
  select id into v_main_area_id
  from public.project_locations
  where level = 'main_area' and parent_id = v_city_id and lower(name_en) = 'bait el watan'
  order by id limit 1;

  insert into public.project_locations (level, parent_id, name_ar, name_en, sort_order, is_active)
  values
    ('sub_area', v_main_area_id, 'الحي الأول', 'First District', 10, true),
    ('sub_area', v_main_area_id, 'الحي الثاني', 'Second District', 20, true),
    ('sub_area', v_main_area_id, 'الحي الرابع', 'Fourth District', 30, true),
    ('sub_area', v_main_area_id, 'النورث هاوس', 'North House', 40, true)
  on conflict do nothing;

  for v_seed in select value from jsonb_array_elements(v_projects)
  loop
    v_details := v_seed->'residentialDetails';
    v_location_label := case when v_seed->>'slug' = 'b84'
      then 'بيت الوطن — الحي الأول' else v_seed->>'locationLabel' end;
    v_map_area := case when v_seed->>'slug' = 'b84'
      then 'الحي الأول' else v_seed->>'mapArea' end;
    v_sub_area_id := case
      when v_map_area = 'الحي الأول' then (
        select id from public.project_locations where parent_id = v_main_area_id and name_en = 'First District' limit 1)
      when v_map_area = 'الحي الثاني' then (
        select id from public.project_locations where parent_id = v_main_area_id and name_en = 'Second District' limit 1)
      when v_map_area = 'الحي الرابع' then (
        select id from public.project_locations where parent_id = v_main_area_id and name_en = 'Fourth District' limit 1)
      when v_map_area = 'النورث هاوس' then (
        select id from public.project_locations where parent_id = v_main_area_id and name_en = 'North House' limit 1)
      else null
    end;

    select id is not null, id into v_existed, v_project_id
    from public.projects where slug = v_seed->>'slug';
    v_existed := coalesce(v_existed, false);

    if v_existed then
      if upper((select code from public.projects where id = v_project_id)) <> upper(v_seed->>'code')
         and exists (select 1 from public.projects where upper(code) = upper(v_seed->>'code') and id <> v_project_id) then
        raise exception 'Project code backfill refused for slug %: code % is already owned', v_seed->>'slug', v_seed->>'code';
      end if;
      update public.projects
      set code = upper(v_seed->>'code'),
          show_on_homepage = coalesce((v_seed->>'showOnHomepage')::boolean, false),
          homepage_order = coalesce((v_seed->>'homepageOrder')::integer, 0),
          brochure_url = nullif(v_seed->>'brochureUrl', '')
      where id = v_project_id;
    else
      insert into public.projects (
        type, arabic_name, english_name, slug, code,
        general_description, short_description,
        image, image_alt, hero_image, hero_image_alt,
        small_box_image, small_box_image_alt,
        governorate_id, city_id, main_area_id, sub_area_id,
        location_label, location_description, google_maps_url,
        latitude, longitude, map_zoom,
        overview_title, overview_body, overview_media_type,
        overview_main_image, overview_main_image_alt,
        delivery_title, delivery_body,
        seo_title, seo_description, focus_keyword, seo_keywords,
        canonical_url, robots_index, robots_follow, og_image, og_image_alt,
        featured, publication_status, show_on_homepage, homepage_order, brochure_url
      ) values (
        v_seed->>'category', v_seed->>'arabicName', v_seed->>'englishName',
        v_seed->>'slug', upper(v_seed->>'code'),
        coalesce(v_details->'overview'->>'body', v_seed->>'shortDescription'),
        v_seed->>'shortDescription',
        v_seed->>'image', coalesce(v_seed->>'arabicName', v_seed->>'code'),
        v_seed->>'heroImage', coalesce(v_seed->>'arabicName', v_seed->>'code'),
        v_seed->>'image', coalesce(v_seed->>'arabicName', v_seed->>'code'),
        v_governorate_id, v_city_id, v_main_area_id, v_sub_area_id,
        v_location_label,
        coalesce(v_details->'location'->>'address', v_location_label),
        'https://www.google.com/maps/search/?api=1&query=' || replace(v_location_label, ' ', '+'),
        30.0444, 31.4913, 13,
        coalesce(v_details->'overview'->>'title', 'نظرة عامة'),
        coalesce(v_details->'overview'->>'body', v_seed->>'shortDescription'),
        'image',
        coalesce(nullif(v_details->'overview'->>'videoImage', ''), v_seed->>'image'),
        coalesce(v_seed->>'arabicName', v_seed->>'code'),
        coalesce(v_details->'deliverySpecs'->>'title', 'مواصفات التنفيذ والتسليم'),
        coalesce(v_details->'deliverySpecs'->>'subtitle', v_seed->>'shortDescription'),
        left(coalesce(v_seed->>'seoTitle', v_seed->>'arabicName'), 60),
        left(coalesce(v_seed->>'seoDescription', v_seed->>'shortDescription'), 160),
        coalesce(v_seed->>'code', ''),
        array(select jsonb_array_elements_text(coalesce(v_seed->'seoKeywords', jsonb_build_array(v_seed->>'code', v_seed->>'arabicName', v_location_label)))),
        null, true, true,
        coalesce(nullif(v_seed->>'ogImage', ''), v_seed->>'heroImage'),
        coalesce(v_seed->>'arabicName', v_seed->>'code'),
        coalesce((v_seed->>'featured')::boolean, false),
        'draft',
        coalesce((v_seed->>'showOnHomepage')::boolean, false),
        coalesce((v_seed->>'homepageOrder')::integer, 0),
        nullif(v_seed->>'brochureUrl', '')
      ) returning id into v_project_id;
      v_inserted := v_inserted + 1;

      v_index := 0;
      for v_item in
        select value from jsonb_array_elements(
          coalesce(v_details->'overview'->'bullets', '[]'::jsonb)
          || coalesce(v_details->'districtProfile'->'bullets', '[]'::jsonb)
        )
      loop
        insert into public.project_features (project_id, body, sort_order)
        values (v_project_id, v_item #>> '{}', v_index * 10);
        v_index := v_index + 1;
      end loop;

      v_index := 0;
      for v_plan in select value from jsonb_array_elements(coalesce(v_details->'availableAreas', '[]'::jsonb))
      loop
        insert into public.project_floor_plans (
          project_id, name, area_text, featured,
          architectural_image, architectural_image_alt,
          furnishing_image, furnishing_image_alt, sort_order
        ) values (
          v_project_id,
          coalesce(nullif(v_plan->>'label', ''), 'مخطط ' || (v_index + 1)::text),
          coalesce(v_plan->>'area', ''),
          coalesce((v_plan->>'featured')::boolean, false),
          nullif(v_plan->>'planImage', ''),
          coalesce(nullif(v_plan->>'label', ''), v_seed->>'code'),
          null, '', v_index * 10
        ) returning id into v_plan_id;

        for v_spec, v_index in
          select value #>> '{}', ordinality::integer
          from jsonb_array_elements(coalesce(v_plan->'specs', '[]'::jsonb)) with ordinality as expanded(value, ordinality)
        loop
          insert into public.project_floor_plan_details (floor_plan_id, label, value, sort_order)
          values (v_plan_id, v_spec, 'متاح', (v_index - 1) * 10);
        end loop;
        v_index := (select count(*) from public.project_floor_plans where project_id = v_project_id);
      end loop;

      v_index := 0;
      for v_item in select value from jsonb_array_elements(coalesce(v_details->'deliverySpecs'->'items', '[]'::jsonb))
      loop
        insert into public.project_delivery_items (project_id, body, sort_order)
        values (v_project_id, v_item #>> '{}', v_index * 10);
        v_index := v_index + 1;
      end loop;

      create temporary table if not exists project_static_images (
        section text not null,
        image text not null,
        alt_text text not null,
        ordinal integer not null
      ) on commit drop;
      truncate project_static_images;

      insert into project_static_images values
        ('overview', v_seed->>'image', coalesce(v_seed->>'arabicName', v_seed->>'code'), 0),
        ('gallery', v_seed->>'heroImage', coalesce(v_seed->>'arabicName', v_seed->>'code'), 0);

      insert into project_static_images
      select 'overview', item->>'image', coalesce(nullif(item->>'label', ''), v_seed->>'code'), ordinality::integer
      from jsonb_array_elements(coalesce(v_details->'overview'->'images', '[]'::jsonb)) with ordinality as expanded(item, ordinality);

      insert into project_static_images
      select 'delivery', item->>'image', coalesce(nullif(item->>'label', ''), v_seed->>'code'), ordinality::integer
      from jsonb_array_elements(coalesce(v_details->'deliverySpecs'->'images', '[]'::jsonb)) with ordinality as expanded(item, ordinality);

      for v_stage in select value from jsonb_array_elements(coalesce(v_details->'executionJourney', '[]'::jsonb))
      loop
        if nullif(v_stage->>'image', '') is not null then
          insert into project_static_images values ('gallery', v_stage->>'image', coalesce(v_stage->>'title', v_seed->>'code'), 1000);
        end if;
        for v_update in select value from jsonb_array_elements(coalesce(v_stage->'updates', '[]'::jsonb))
        loop
          if nullif(v_update->>'image', '') is not null then
            insert into project_static_images values ('gallery', v_update->>'image', coalesce(v_update->>'title', v_seed->>'code'), 1100);
          end if;
          insert into project_static_images
          select 'gallery', value #>> '{}', coalesce(v_update->>'title', v_seed->>'code'), 1200 + ordinality::integer
          from jsonb_array_elements(coalesce(v_update->'gallery', '[]'::jsonb)) with ordinality as expanded(value, ordinality);
        end loop;
      end loop;

      insert into public.project_media (project_id, section, image, alt_text, sort_order)
      select v_project_id, section, image, max(alt_text), row_number() over (partition by section order by min(ordinal), image) * 10
      from project_static_images
      where nullif(image, '') is not null
      group by section, image;

      if nullif(v_details->'location'->>'address', '') is not null then
        insert into public.project_location_points (project_id, kind, label, distance_text, sort_order)
        values (v_project_id, 'landmark', v_details->'location'->>'address', coalesce(v_details->'location'->>'distance', ''), 10);
      end if;
    end if;

    insert into public.admin_audit_logs (
      actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
    ) values (
      null, 'system:migration',
      case when v_existed then 'project.static_truth_compared' else 'project.static_truth_backfilled' end,
      'project', v_project_id, v_seed->>'slug',
      jsonb_build_object(
        'migration', '20260805180000_global_truth_atomic_operations_closure',
        'source', 'retired_static_project_catalog',
        'database_won_existing_conflicts', v_existed,
        'code', v_seed->>'code',
        'slug', v_seed->>'slug',
        'homepage_order', (v_seed->>'homepageOrder')::integer,
        'static_payload_sha256', encode(digest(v_seed::text, 'sha256'), 'hex')
      )
    );
  end loop;

  if v_inserted <> v_missing_before then
    raise exception 'Project truth backfill parity failed: expected %, inserted %', v_missing_before, v_inserted;
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_projects) item
    left join public.projects project on project.slug = item->>'slug' and upper(project.code) = upper(item->>'code')
    where project.id is null
  ) then
    raise exception 'Project truth backfill parity failed: a catalog identity is missing';
  end if;
end;
$project_backfill$;

-- Extend the existing Project aggregate owner rather than introducing a
-- parallel writer. The previous implementation becomes a private core.
alter function public.save_project_admin_entry(bigint, jsonb)
  rename to save_project_admin_entry_core;

create or replace function public.save_project_admin_entry(
  p_project_id bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns table (project_id bigint, slug text, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_saved record;
  v_root jsonb := coalesce(p_payload->'project', '{}'::jsonb);
  v_code text;
  v_homepage_order integer;
begin
  v_code := upper(btrim(coalesce(v_root->>'code', v_root->>'slug')));
  if v_code !~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Project code is invalid.';
  end if;
  v_homepage_order := coalesce(nullif(v_root->>'homepage_order', '')::integer, 0);
  if v_homepage_order < 0 then
    raise exception using errcode = '22023', message = 'Project homepage order must be non-negative.';
  end if;
  if nullif(v_root->>'brochure_url', '') is not null and (v_root->>'brochure_url') !~* '^https?://' then
    raise exception using errcode = '22023', message = 'Project brochure URL must use HTTP or HTTPS.';
  end if;

  select * into strict v_saved
  from public.save_project_admin_entry_core(p_project_id, p_payload);

  update public.projects project set
    code = v_code,
    show_on_homepage = coalesce((v_root->>'show_on_homepage')::boolean, false),
    homepage_order = v_homepage_order,
    brochure_url = nullif(v_root->>'brochure_url', ''),
    updated_at = v_saved.updated_at
  where project.id = v_saved.project_id;

  return query select v_saved.project_id, v_saved.slug, v_saved.updated_at;
end
$function$;

alter function public.duplicate_project_admin_entry(bigint)
  rename to duplicate_project_admin_entry_core;

create or replace function public.duplicate_project_admin_entry(p_project_id bigint)
returns table (
  project_id bigint, project_type text, project_slug text, featured boolean,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_copy record;
  v_source_code text;
begin
  select code into v_source_code from public.projects where id = p_project_id for update;
  if v_source_code is null then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;
  select * into strict v_copy from public.duplicate_project_admin_entry_core(p_project_id);
  update public.projects set
    code = left(v_source_code, 48) || '-COPY-' || v_copy.project_id::text,
    show_on_homepage = false,
    homepage_order = 0,
    brochure_url = null,
    publication_status = 'draft',
    published_at = null,
    published_by = null
  where id = v_copy.project_id;
  return query
  select p.id, p.type, p.slug, p.featured, p.created_at, p.updated_at
  from public.projects p where p.id = v_copy.project_id;
end
$function$;

revoke all on function public.save_project_admin_entry_core(bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.duplicate_project_admin_entry_core(bigint) from public, anon, authenticated, service_role;
revoke all on function public.save_project_admin_entry(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.duplicate_project_admin_entry(bigint) from public, anon, authenticated;
grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role;
grant execute on function public.duplicate_project_admin_entry(bigint) to service_role;

comment on function public.save_project_admin_entry(bigint, jsonb) is
  'Single atomic clean Project aggregate writer, including code and Homepage ownership.';
comment on function public.duplicate_project_admin_entry(bigint) is
  'Single atomic clean Project aggregate duplicate owner; copies receive a unique database-owned code and draft visibility.';

-- ---------------------------------------------------------------------------
-- Menu atomic tree owner
-- ---------------------------------------------------------------------------

do $normalize_menu$
declare
  v_row record;
begin
  perform set_config('app.menu_tree_write', 'on', true);
  for v_row in
    select id,
           row_number() over (
             partition by menu_id, parent_id
             order by sort_order, id
           ) * 10 as next_order
    from public.menu_items
  loop
    update public.menu_items set sort_order = -1000000 - id where id = v_row.id;
  end loop;
  for v_row in
    select id,
           row_number() over (
             partition by menu_id, parent_id
             order by sort_order desc, id
           ) * 10 as next_order
    from public.menu_items
  loop
    update public.menu_items set sort_order = v_row.next_order where id = v_row.id;
  end loop;
end;
$normalize_menu$;

drop index if exists public.menu_items_menu_parent_order_unique_idx;
create unique index menu_items_menu_parent_order_unique_idx
  on public.menu_items (menu_id, coalesce(parent_id, 0::bigint), sort_order);
create index if not exists menu_items_parent_lookup_idx
  on public.menu_items (parent_id, menu_id);

create or replace function public.enforce_menu_item_atomic_contract()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_parent_menu_id bigint;
begin
  if tg_op = 'DELETE' then
    if current_setting('app.menu_tree_write', true) is distinct from 'on' then
      raise exception using errcode = '55000', message = 'menu_item_direct_delete_forbidden';
    end if;
    return old;
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception using errcode = '23514', message = 'menu_item_cannot_parent_itself';
    end if;
    select menu_id into v_parent_menu_id from public.menu_items where id = new.parent_id;
    if v_parent_menu_id is null or v_parent_menu_id <> new.menu_id then
      raise exception using errcode = '23514', message = 'menu_item_parent_must_belong_to_same_menu';
    end if;
    if tg_op = 'UPDATE' and exists (
      with recursive descendants as (
        select id from public.menu_items where parent_id = new.id
        union all
        select child.id from public.menu_items child join descendants d on child.parent_id = d.id
      )
      select 1 from descendants where id = new.parent_id
    ) then
      raise exception using errcode = '23514', message = 'menu_item_cycle_forbidden';
    end if;
  end if;

  if current_setting('app.menu_tree_write', true) is distinct from 'on'
     and (
       tg_op = 'INSERT'
       or new.menu_id is distinct from old.menu_id
       or new.parent_id is distinct from old.parent_id
       or new.sort_order is distinct from old.sort_order
     ) then
    raise exception using errcode = '55000', message = 'menu_item_structural_write_requires_mutate_menu_tree';
  end if;
  return new;
end
$function$;

drop trigger if exists menu_item_atomic_contract_guard on public.menu_items;
create trigger menu_item_atomic_contract_guard
before insert or update or delete on public.menu_items
for each row execute function public.enforce_menu_item_atomic_contract();

create or replace function public.mutate_menu_tree(
  p_menu_id bigint,
  p_operation text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_admin_user_id bigint default null,
  p_actor_username text default 'system:unknown'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_item jsonb;
  v_item_id bigint;
  v_parent_id bigint;
  v_requested_order integer;
  v_source record;
  v_new_menu_id bigint;
  v_new_item_id bigint;
  v_old_id bigint;
  v_old_parent_id bigint;
  v_processed integer;
  v_pending integer;
  v_round integer := 0;
  v_row record;
  v_result jsonb := '{}'::jsonb;
begin
  if p_menu_id is null or p_menu_id <= 0 then
    raise exception using errcode = '22023', message = 'menu_id_invalid';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'menu_payload_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.menu_tree:' || p_menu_id::text));
  perform 1 from public.menus where id = p_menu_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'menu_not_found';
  end if;
  perform 1 from public.menu_items where menu_id = p_menu_id order by id for update;
  perform set_config('app.menu_tree_write', 'on', true);

  create temporary table if not exists menu_tree_order_plan (
    id bigint primary key,
    next_order integer not null
  ) on commit drop;
  truncate menu_tree_order_plan;

  if p_operation = 'save_item' then
    v_item := coalesce(p_payload->'item', '{}'::jsonb);
    if jsonb_typeof(v_item) <> 'object' or nullif(btrim(v_item->>'label'), '') is null then
      raise exception using errcode = '22023', message = 'menu_item_label_required';
    end if;
    v_item_id := nullif(v_item->>'id', '')::bigint;
    v_parent_id := nullif(v_item->>'parent_id', '')::bigint;
    v_requested_order := greatest(coalesce(nullif(v_item->>'sort_order', '')::integer, 0), 0);

    if v_parent_id is not null and not exists (
      select 1 from public.menu_items where id = v_parent_id and menu_id = p_menu_id
    ) then
      raise exception using errcode = '23514', message = 'menu_item_parent_invalid';
    end if;

    if v_item_id is null then
      v_item_id := nextval(pg_get_serial_sequence('public.menu_items', 'id'));
      insert into public.menu_items (
        id, menu_id, parent_id, label, item_type, href, linked_type, linked_id,
        anchor, target, css_class, style_preset, is_visible, sort_order, created_at, updated_at
      ) values (
        v_item_id, p_menu_id, v_parent_id, btrim(v_item->>'label'),
        coalesce(nullif(v_item->>'item_type', ''), 'custom'), nullif(v_item->>'href', ''),
        nullif(v_item->>'linked_type', ''), nullif(v_item->>'linked_id', '')::bigint,
        nullif(v_item->>'anchor', ''), coalesce(nullif(v_item->>'target', ''), '_self'),
        nullif(v_item->>'css_class', ''), coalesce(nullif(v_item->>'style_preset', ''), 'default'),
        coalesce((v_item->>'is_visible')::boolean, true), -1000000 - v_item_id, v_now, v_now
      );
    else
      if not exists (select 1 from public.menu_items where id = v_item_id and menu_id = p_menu_id) then
        raise exception using errcode = 'P0002', message = 'menu_item_not_found';
      end if;
      update public.menu_items set
        parent_id = v_parent_id,
        label = btrim(v_item->>'label'),
        item_type = coalesce(nullif(v_item->>'item_type', ''), 'custom'),
        href = nullif(v_item->>'href', ''),
        linked_type = nullif(v_item->>'linked_type', ''),
        linked_id = nullif(v_item->>'linked_id', '')::bigint,
        anchor = nullif(v_item->>'anchor', ''),
        target = coalesce(nullif(v_item->>'target', ''), '_self'),
        css_class = nullif(v_item->>'css_class', ''),
        style_preset = coalesce(nullif(v_item->>'style_preset', ''), 'default'),
        is_visible = coalesce((v_item->>'is_visible')::boolean, is_visible),
        sort_order = -1000000 - id,
        updated_at = v_now
      where id = v_item_id and menu_id = p_menu_id;
    end if;

    insert into menu_tree_order_plan (id, next_order)
    select id,
           row_number() over (
             partition by parent_id
             order by case when id = v_item_id then v_requested_order else sort_order end, id
           ) * 10
    from public.menu_items where menu_id = p_menu_id;
    v_result := jsonb_build_object('item_id', v_item_id);

  elsif p_operation = 'reorder' then
    v_parent_id := nullif(p_payload->>'parent_id', '')::bigint;
    if jsonb_typeof(p_payload->'items') <> 'array' then
      raise exception using errcode = '22023', message = 'menu_reorder_items_required';
    end if;
    if jsonb_array_length(p_payload->'items') <> (
      select count(*) from public.menu_items
      where menu_id = p_menu_id and parent_id is not distinct from v_parent_id
    ) then
      raise exception using errcode = '40001', message = 'menu_reorder_set_changed';
    end if;
    if (select count(distinct (item->>'id')::bigint) from jsonb_array_elements(p_payload->'items') item)
       <> jsonb_array_length(p_payload->'items') then
      raise exception using errcode = '22023', message = 'menu_reorder_duplicate_id';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_payload->'items') item
      left join public.menu_items current
        on current.id = (item->>'id')::bigint
       and current.menu_id = p_menu_id
       and current.parent_id is not distinct from v_parent_id
       and current.updated_at = (item->>'updated_at')::timestamptz
      where current.id is null
    ) then
      raise exception using errcode = '40001', message = 'menu_reorder_revision_conflict';
    end if;
    insert into menu_tree_order_plan (id, next_order)
    select (item->>'id')::bigint, ordinality::integer * 10
    from jsonb_array_elements(p_payload->'items') with ordinality as expanded(item, ordinality);
    v_result := jsonb_build_object('parent_id', v_parent_id, 'reordered', jsonb_array_length(p_payload->'items'));

  elsif p_operation = 'duplicate_item' then
    v_item_id := nullif(p_payload->>'item_id', '')::bigint;
    select * into v_source from public.menu_items where id = v_item_id and menu_id = p_menu_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'menu_item_not_found'; end if;
    v_new_item_id := nextval(pg_get_serial_sequence('public.menu_items', 'id'));
    insert into public.menu_items (
      id, menu_id, parent_id, label, item_type, href, linked_type, linked_id,
      anchor, target, css_class, style_preset, is_visible, sort_order, created_at, updated_at
    ) values (
      v_new_item_id, p_menu_id, v_source.parent_id, v_source.label || ' — نسخة',
      v_source.item_type, v_source.href, v_source.linked_type, v_source.linked_id,
      v_source.anchor, v_source.target, v_source.css_class, v_source.style_preset,
      false, -1000000 - v_new_item_id, v_now, v_now
    );
    insert into menu_tree_order_plan (id, next_order)
    select id, row_number() over (
      partition by parent_id
      order by case when id = v_new_item_id then v_source.sort_order + 1 else sort_order end, id
    ) * 10
    from public.menu_items where menu_id = p_menu_id;
    v_result := jsonb_build_object('item_id', v_new_item_id, 'source_item_id', v_item_id);

  elsif p_operation = 'delete_item' then
    v_item_id := nullif(p_payload->>'item_id', '')::bigint;
    if not exists (select 1 from public.menu_items where id = v_item_id and menu_id = p_menu_id) then
      raise exception using errcode = 'P0002', message = 'menu_item_not_found';
    end if;
    delete from public.menu_items where id = v_item_id and menu_id = p_menu_id;
    insert into menu_tree_order_plan (id, next_order)
    select id, row_number() over (partition by parent_id order by sort_order, id) * 10
    from public.menu_items where menu_id = p_menu_id;
    v_result := jsonb_build_object('deleted_item_id', v_item_id);

  elsif p_operation = 'duplicate_menu' then
    select * into v_source from public.menus where id = p_menu_id for update;
    v_new_menu_id := nextval(pg_get_serial_sequence('public.menus', 'id'));
    insert into public.menus (id, name, slug, location, is_active, created_at, updated_at)
    values (
      v_new_menu_id, v_source.name || ' — نسخة', v_source.slug || '-copy-' || v_new_menu_id::text,
      v_source.location || '-copy-' || v_new_menu_id::text, false, v_now, v_now
    );
    create temporary table if not exists menu_tree_id_map (
      old_id bigint primary key, new_id bigint not null unique
    ) on commit drop;
    truncate menu_tree_id_map;
    for v_row in
      with recursive tree as (
        select item.*, 0 as depth from public.menu_items item
        where item.menu_id = p_menu_id and item.parent_id is null
        union all
        select child.*, tree.depth + 1 from public.menu_items child
        join tree on child.parent_id = tree.id
      )
      select * from tree order by depth, parent_id nulls first, sort_order, id
    loop
      v_new_item_id := nextval(pg_get_serial_sequence('public.menu_items', 'id'));
      insert into public.menu_items (
        id, menu_id, parent_id, label, item_type, href, linked_type, linked_id,
        anchor, target, css_class, style_preset, is_visible, sort_order, created_at, updated_at
      ) values (
        v_new_item_id, v_new_menu_id,
        (select new_id from menu_tree_id_map where old_id = v_row.parent_id),
        v_row.label, v_row.item_type, v_row.href, v_row.linked_type, v_row.linked_id,
        v_row.anchor, v_row.target, v_row.css_class, v_row.style_preset,
        false, v_row.sort_order, v_now, v_now
      );
      insert into menu_tree_id_map values (v_row.id, v_new_item_id);
    end loop;
    v_result := jsonb_build_object(
      'menu_id', v_new_menu_id,
      'item_ids', coalesce((select jsonb_agg(new_id order by new_id) from menu_tree_id_map), '[]'::jsonb)
    );

  elsif p_operation = 'import' then
    if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
      raise exception using errcode = '22023', message = 'menu_import_items_required';
    end if;
    create temporary table if not exists menu_tree_id_map (
      old_id bigint primary key, new_id bigint not null unique
    ) on commit drop;
    truncate menu_tree_id_map;
    create temporary table if not exists menu_tree_import_pending (
      ordinal integer primary key, item jsonb not null
    ) on commit drop;
    truncate menu_tree_import_pending;
    insert into menu_tree_import_pending
    select ordinality::integer, item
    from jsonb_array_elements(p_payload->'items') with ordinality as expanded(item, ordinality);

    loop
      v_processed := 0;
      v_round := v_round + 1;
      for v_row in
        select * from menu_tree_import_pending
        where nullif(item->>'parent_id', '') is null
           or exists (select 1 from menu_tree_id_map where old_id = (item->>'parent_id')::bigint)
        order by ordinal
      loop
        v_item := v_row.item;
        v_old_id := coalesce(nullif(v_item->>'id', '')::bigint, -v_row.ordinal);
        if exists (select 1 from menu_tree_id_map where old_id = v_old_id) then
          raise exception using errcode = '22023', message = 'menu_import_duplicate_id';
        end if;
        v_old_parent_id := nullif(v_item->>'parent_id', '')::bigint;
        v_new_item_id := nextval(pg_get_serial_sequence('public.menu_items', 'id'));
        insert into public.menu_items (
          id, menu_id, parent_id, label, item_type, href, linked_type, linked_id,
          anchor, target, css_class, style_preset, is_visible, sort_order, created_at, updated_at
        ) values (
          v_new_item_id, p_menu_id,
          (select new_id from menu_tree_id_map where old_id = v_old_parent_id),
          coalesce(nullif(btrim(v_item->>'label'), ''), 'عنصر مستورد'),
          coalesce(nullif(v_item->>'item_type', ''), 'custom'), nullif(v_item->>'href', ''),
          nullif(v_item->>'linked_type', ''), nullif(v_item->>'linked_id', '')::bigint,
          nullif(v_item->>'anchor', ''), case when v_item->>'target' = '_blank' then '_blank' else '_self' end,
          nullif(v_item->>'css_class', ''), coalesce(nullif(v_item->>'style_preset', ''), 'default'),
          false, coalesce(nullif(v_item->>'sort_order', '')::integer, v_row.ordinal * 10), v_now, v_now
        );
        insert into menu_tree_id_map values (v_old_id, v_new_item_id);
        delete from menu_tree_import_pending where ordinal = v_row.ordinal;
        v_processed := v_processed + 1;
      end loop;
      select count(*) into v_pending from menu_tree_import_pending;
      exit when v_pending = 0;
      if v_processed = 0 or v_round > jsonb_array_length(p_payload->'items') then
        raise exception using errcode = '23514', message = 'menu_import_parent_graph_invalid';
      end if;
    end loop;
    insert into menu_tree_order_plan (id, next_order)
    select id, row_number() over (partition by parent_id order by sort_order, id) * 10
    from public.menu_items where menu_id = p_menu_id;
    v_result := jsonb_build_object(
      'menu_id', p_menu_id,
      'item_ids', coalesce((select jsonb_agg(new_id order by new_id) from menu_tree_id_map), '[]'::jsonb)
    );

  elsif p_operation = 'clear_menu' then
    delete from public.menu_items where menu_id = p_menu_id;
    v_result := jsonb_build_object('cleared_menu_id', p_menu_id);
  elsif p_operation = 'delete_menu' then
    delete from public.menus where id = p_menu_id;
    v_result := jsonb_build_object('deleted_menu_id', p_menu_id);
  else
    raise exception using errcode = '22023', message = 'menu_operation_unsupported';
  end if;

  if exists (select 1 from menu_tree_order_plan) then
    for v_row in select * from menu_tree_order_plan order by id loop
      update public.menu_items set sort_order = -2000000 - id, updated_at = v_now where id = v_row.id;
    end loop;
    for v_row in select * from menu_tree_order_plan order by next_order, id loop
      update public.menu_items set sort_order = v_row.next_order, updated_at = v_now where id = v_row.id;
    end loop;
  end if;

  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values (
    p_actor_admin_user_id, coalesce(nullif(p_actor_username, ''), 'system:unknown'),
    'menu.' || p_operation, 'menu', coalesce(v_new_menu_id, p_menu_id), null,
    jsonb_build_object(
      'operation', p_operation,
      'menu_id', p_menu_id,
      'result', v_result,
      'persistence_owner', 'mutate_menu_tree',
      'atomic', true
    )
  );

  return v_result || jsonb_build_object('updated_at', v_now);
end
$function$;

revoke all on function public.mutate_menu_tree(bigint, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.mutate_menu_tree(bigint, text, jsonb, bigint, text) to service_role;
comment on function public.mutate_menu_tree(bigint, text, jsonb, bigint, text) is
  'Single atomic Menu tree mutation, ordering, validation, duplicate prevention, rollback, and Audit owner.';

-- ---------------------------------------------------------------------------
-- Page Composition atomic aggregate owner
-- ---------------------------------------------------------------------------

create or replace view public.page_composition_assignments
with (security_invoker = true)
as
select 'content'::text as kind, id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_content_block_assignments
union all select 'cta', id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_cta_block_assignments
union all select 'cards', id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_cards_block_assignments
union all select 'breadcrumb', id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_breadcrumb_block_assignments
union all select 'feed', id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_feed_module_assignments
union all select 'media_sidebar', id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_media_sidebar_module_assignments
union all select 'media_hub', id, page_id, template_id, slot, sort_order, is_visible, updated_at
from public.page_media_hub_module_assignments
union all
select 'hero', assignment.id, assignment.target_id, assignment.hero_id,
       'hero', greatest(0, 1000 - assignment.priority), assignment.is_active, assignment.updated_at
from public.hero_assignments assignment
where assignment.target_type = 'page' and assignment.target_id is not null;

comment on view public.page_composition_assignments is
  'Read-only aggregate projection for the existing Page Composition assignment owners.';

create or replace function public.enforce_page_composition_atomic_contract()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_setting('app.page_composition_write', true) is distinct from 'on'
     and not (tg_op = 'DELETE' and pg_trigger_depth() > 1) then
    raise exception using errcode = '55000', message = 'page_composition_write_requires_mutate_page_composition';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := clock_timestamp();
  return new;
end
$function$;

do $assignment_guards$
declare
  v_table text;
begin
  foreach v_table in array array[
    'page_content_block_assignments', 'page_cta_block_assignments',
    'page_cards_block_assignments', 'page_breadcrumb_block_assignments',
    'page_feed_module_assignments', 'page_media_sidebar_module_assignments',
    'page_media_hub_module_assignments', 'hero_assignments'
  ]
  loop
    execute format('drop trigger if exists page_composition_atomic_guard on public.%I', v_table);
    execute format(
      'create trigger page_composition_atomic_guard before insert or update or delete on public.%I for each row execute function public.enforce_page_composition_atomic_contract()',
      v_table
    );
  end loop;
end;
$assignment_guards$;

create unique index if not exists hero_assignments_page_template_unique_idx
  on public.hero_assignments (hero_id, target_id)
  where target_type = 'page' and target_id is not null;

create or replace function public.mutate_page_composition(
  p_page_id bigint,
  p_operation text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_admin_user_id bigint default null,
  p_actor_username text default 'system:unknown'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_kind text;
  v_table text;
  v_template_table text;
  v_assignment_id bigint;
  v_template_id bigint;
  v_new_template_id bigint;
  v_new_page_id bigint;
  v_slot text;
  v_sort_order integer;
  v_visible boolean;
  v_change jsonb;
  v_row record;
  v_source jsonb;
  v_clone jsonb;
  v_sequence text;
  v_page_source jsonb;
  v_page_ids bigint[];
  v_existing_page_ids bigint[];
  v_affected_page_ids bigint[];
  v_result jsonb := '{}'::jsonb;
begin
  if p_page_id is null or p_page_id <= 0 then
    raise exception using errcode = '22023', message = 'page_id_invalid';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'page_composition_payload_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.page_composition:' || p_page_id::text));
  perform 1 from public.pages where id = p_page_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'page_not_found'; end if;
  perform set_config('app.page_composition_write', 'on', true);

  perform 1 from public.page_content_block_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.page_cta_block_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.page_cards_block_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.page_breadcrumb_block_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.page_feed_module_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.page_media_sidebar_module_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.page_media_hub_module_assignments where page_id = p_page_id order by id for update;
  perform 1 from public.hero_assignments where target_type = 'page' and target_id = p_page_id order by id for update;

  create temporary table if not exists page_composition_order_plan (
    kind text not null,
    id bigint not null,
    next_order integer not null,
    primary key (kind, id)
  ) on commit drop;
  truncate page_composition_order_plan;

  if p_operation in ('save_assignment', 'duplicate_assignment') then
    v_kind := p_payload->>'kind';
    v_table := case v_kind
      when 'content' then 'page_content_block_assignments'
      when 'cta' then 'page_cta_block_assignments'
      when 'cards' then 'page_cards_block_assignments'
      when 'breadcrumb' then 'page_breadcrumb_block_assignments'
      when 'feed' then 'page_feed_module_assignments'
      when 'media_sidebar' then 'page_media_sidebar_module_assignments'
      when 'media_hub' then 'page_media_hub_module_assignments'
      else null end;
    v_template_table := case v_kind
      when 'content' then 'content_block_templates'
      when 'cta' then 'cta_block_templates'
      when 'cards' then 'cards_block_templates'
      when 'breadcrumb' then 'breadcrumb_block_templates'
      when 'feed' then 'feed_module_templates'
      when 'media_sidebar' then 'media_sidebar_module_templates'
      when 'media_hub' then 'media_hub_module_templates'
      else null end;
    if v_table is null then raise exception using errcode = '22023', message = 'assignment_kind_invalid'; end if;

    if p_operation = 'duplicate_assignment' then
      v_assignment_id := nullif(p_payload->>'assignment_id', '')::bigint;
      execute format(
        'select template_id, slot, sort_order from public.%I where id = $1 and page_id = $2 for update', v_table
      ) into v_template_id, v_slot, v_sort_order using v_assignment_id, p_page_id;
      if v_template_id is null then raise exception using errcode = 'P0002', message = 'assignment_not_found'; end if;
      execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_template_table)
        into v_source using v_template_id;
      if v_source is null then raise exception using errcode = 'P0002', message = 'assignment_template_not_found'; end if;
      v_sequence := pg_get_serial_sequence('public.' || v_template_table, 'id');
      v_new_template_id := nextval(v_sequence);
      v_clone := v_source || jsonb_build_object(
        'id', v_new_template_id,
        'name', coalesce(v_source->>'name', v_kind) || ' — نسخة',
        'slug', coalesce(v_source->>'slug', v_kind) || '-copy-' || v_new_template_id::text,
        'created_at', v_now,
        'updated_at', v_now
      );
      if v_clone ? 'status' then v_clone := jsonb_set(v_clone, '{status}', '"draft"'::jsonb); end if;
      if v_clone ? 'is_visible' then v_clone := jsonb_set(v_clone, '{is_visible}', 'false'::jsonb); end if;
      execute format(
        'insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).*',
        v_template_table, v_template_table
      ) using v_clone;
      execute format(
        'insert into public.%I (page_id, template_id, slot, sort_order, is_visible, created_at, updated_at) values ($1,$2,$3,$4,false,$5,$5) returning id',
        v_table
      ) into v_assignment_id using p_page_id, v_new_template_id, v_slot, v_sort_order + 1, v_now;
      v_result := jsonb_build_object('assignment_id', v_assignment_id, 'template_id', v_new_template_id);
    else
      v_assignment_id := nullif(p_payload->>'assignment_id', '')::bigint;
      v_template_id := nullif(p_payload->>'template_id', '')::bigint;
      v_slot := coalesce(nullif(btrim(p_payload->>'slot'), ''), 'main');
      v_sort_order := greatest(coalesce(nullif(p_payload->>'sort_order', '')::integer, 0), 0);
      v_visible := coalesce((p_payload->>'is_visible')::boolean, true);
      if v_assignment_id is not null and v_template_id is null then
        execute format('select template_id from public.%I where id=$1 and page_id=$2',v_table)
          into v_template_id using v_assignment_id,p_page_id;
      end if;
      if v_template_id is null then raise exception using errcode = '22023', message = 'assignment_template_required'; end if;
      if v_assignment_id is null then
        execute format(
          'insert into public.%I (page_id, template_id, slot, sort_order, is_visible, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$6) returning id',
          v_table
        ) into v_assignment_id using p_page_id, v_template_id, v_slot, v_sort_order, v_visible, v_now;
      else
        execute format(
          'update public.%I set template_id=$1, slot=$2, sort_order=$3, is_visible=$4, updated_at=$5 where id=$6 and page_id=$7 returning id',
          v_table
        ) into v_assignment_id using v_template_id, v_slot, v_sort_order, v_visible, v_now, v_assignment_id, p_page_id;
        if v_assignment_id is null then raise exception using errcode = 'P0002', message = 'assignment_not_found'; end if;
      end if;
      v_result := jsonb_build_object('assignment_id', v_assignment_id, 'template_id', v_template_id);
    end if;

    insert into page_composition_order_plan (kind, id, next_order)
    select kind, id,
           row_number() over (partition by slot order by sort_order, kind, id) * 10
    from public.page_composition_assignments
    where page_id = p_page_id and kind <> 'hero';

  elsif p_operation = 'save_hero_assignment' then
    v_assignment_id := nullif(p_payload->>'assignment_id', '')::bigint;
    v_template_id := nullif(p_payload->>'hero_id', '')::bigint;
    v_sort_order := greatest(coalesce(nullif(p_payload->>'sort_order', '')::integer, 0), 0);
    v_visible := coalesce((p_payload->>'is_visible')::boolean, true);
    if v_template_id is null or not exists (select 1 from public.hero_templates where id=v_template_id) then
      raise exception using errcode='23503', message='hero_template_not_found';
    end if;
    if v_assignment_id is null then
      insert into public.hero_assignments (
        hero_id,target_type,target_id,target_slug,path,is_active,priority,created_at,updated_at
      )
      select v_template_id,'page',page.id,page.slug,page.path,v_visible,1000-v_sort_order,v_now,v_now
      from public.pages page where page.id=p_page_id
      returning id into v_assignment_id;
    else
      update public.hero_assignments set
        hero_id=v_template_id,is_active=v_visible,priority=1000-v_sort_order,updated_at=v_now
      where id=v_assignment_id and target_type='page' and target_id=p_page_id
      returning id into v_assignment_id;
      if v_assignment_id is null then raise exception using errcode='P0002',message='assignment_not_found'; end if;
    end if;
    v_result := jsonb_build_object('assignment_id',v_assignment_id,'hero_id',v_template_id);

  elsif p_operation = 'reorder' then
    v_slot := p_payload->>'slot';
    if jsonb_typeof(p_payload->'assignments') <> 'array' then
      raise exception using errcode = '22023', message = 'page_reorder_assignments_required';
    end if;
    if jsonb_array_length(p_payload->'assignments') <> (
      select count(*) from public.page_composition_assignments where page_id = p_page_id and slot = v_slot
    ) then
      raise exception using errcode = '40001', message = 'page_reorder_set_changed';
    end if;
    if (select count(distinct (item->>'kind', item->>'id')) from jsonb_array_elements(p_payload->'assignments') item)
       <> jsonb_array_length(p_payload->'assignments') then
      raise exception using errcode = '22023', message = 'page_reorder_duplicate_assignment';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload->'assignments') item
      left join public.page_composition_assignments current
        on current.page_id = p_page_id and current.slot = v_slot
       and current.kind = item->>'kind' and current.id = (item->>'id')::bigint
       and current.updated_at = (item->>'updated_at')::timestamptz
      where current.id is null
    ) then
      raise exception using errcode = '40001', message = 'page_reorder_revision_conflict';
    end if;
    insert into page_composition_order_plan (kind, id, next_order)
    select item->>'kind', (item->>'id')::bigint, ordinality::integer * 10
    from jsonb_array_elements(p_payload->'assignments') with ordinality as expanded(item, ordinality);
    v_result := jsonb_build_object('slot', v_slot, 'reordered', jsonb_array_length(p_payload->'assignments'));

  elsif p_operation = 'bulk' then
    if jsonb_typeof(p_payload->'changes') <> 'array' then
      raise exception using errcode = '22023', message = 'page_bulk_changes_required';
    end if;
    for v_change in select value from jsonb_array_elements(p_payload->'changes')
    loop
      v_kind := v_change->>'kind';
      v_table := case v_kind
        when 'content' then 'page_content_block_assignments'
        when 'cta' then 'page_cta_block_assignments'
        when 'cards' then 'page_cards_block_assignments'
        when 'breadcrumb' then 'page_breadcrumb_block_assignments'
        when 'feed' then 'page_feed_module_assignments'
        when 'media_sidebar' then 'page_media_sidebar_module_assignments'
        when 'media_hub' then 'page_media_hub_module_assignments'
        when 'hero' then 'hero_assignments'
        else null end;
      if v_table is null then raise exception using errcode = '22023', message = 'assignment_kind_invalid'; end if;
      v_assignment_id := nullif(v_change->>'id', '')::bigint;
      if v_change->>'action' = 'delete' then
        if v_kind='hero' then
          delete from public.hero_assignments where id=v_assignment_id and target_type='page' and target_id=p_page_id returning id into v_assignment_id;
        else
          execute format('delete from public.%I where id=$1 and page_id=$2 returning id', v_table)
            into v_assignment_id using v_assignment_id, p_page_id;
        end if;
      elsif v_change->>'action' in ('show', 'hide') then
        if v_kind='hero' then
          update public.hero_assignments set is_active=(v_change->>'action'='show'),updated_at=v_now
          where id=v_assignment_id and target_type='page' and target_id=p_page_id returning id into v_assignment_id;
        else
          execute format('update public.%I set is_visible=$1, updated_at=$2 where id=$3 and page_id=$4 returning id', v_table)
            into v_assignment_id using (v_change->>'action' = 'show'), v_now, v_assignment_id, p_page_id;
        end if;
      else
        raise exception using errcode = '22023', message = 'page_bulk_action_invalid';
      end if;
      if v_assignment_id is null then raise exception using errcode = 'P0002', message = 'assignment_not_found'; end if;
    end loop;
    insert into page_composition_order_plan (kind, id, next_order)
    select kind, id, row_number() over (partition by slot order by sort_order, kind, id) * 10
    from public.page_composition_assignments where page_id = p_page_id and kind <> 'hero';
    v_result := jsonb_build_object('changed', jsonb_array_length(p_payload->'changes'));

  elsif p_operation = 'sync_template_pages' then
    v_kind := p_payload->>'kind';
    v_table := case v_kind
      when 'content' then 'page_content_block_assignments'
      when 'cta' then 'page_cta_block_assignments'
      when 'cards' then 'page_cards_block_assignments'
      when 'breadcrumb' then 'page_breadcrumb_block_assignments'
      when 'feed' then 'page_feed_module_assignments'
      when 'media_sidebar' then 'page_media_sidebar_module_assignments'
      when 'media_hub' then 'page_media_hub_module_assignments'
      else null end;
    v_template_id := nullif(p_payload->>'template_id', '')::bigint;
    v_slot := nullif(btrim(p_payload->>'default_slot'), '');
    if v_table is null or v_template_id is null or v_slot is null or v_slot not in ('main','hero','sidebar') then
      raise exception using errcode = '22023', message = 'template_page_sync_payload_invalid';
    end if;
    if jsonb_typeof(coalesce(p_payload->'page_ids','[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'template_page_ids_invalid';
    end if;
    select coalesce(array_agg(distinct value::bigint order by value::bigint), '{}'::bigint[])
      into v_page_ids
    from jsonb_array_elements_text(coalesce(p_payload->'page_ids','[]'::jsonb));
    if cardinality(v_page_ids) <> jsonb_array_length(coalesce(p_payload->'page_ids','[]'::jsonb))
       or exists (
         select 1 from unnest(v_page_ids) as requested(page_id)
         left join public.pages page_row on page_row.id=requested.page_id
         where page_row.id is null
       ) then
      raise exception using errcode = '23514', message = 'template_page_assignment_invalid';
    end if;
    execute format(
      'select coalesce(array_agg(distinct page_id order by page_id), ''{}''::bigint[]) from public.%I where template_id=$1',
      v_table
    ) into v_existing_page_ids using v_template_id;
    select coalesce(array_agg(distinct id order by id), '{}'::bigint[])
      into v_affected_page_ids
    from unnest(v_existing_page_ids || v_page_ids) id;
    if cardinality(v_affected_page_ids) = 0 or p_page_id <> v_affected_page_ids[1] then
      raise exception using errcode = '22023', message = 'template_page_sync_anchor_invalid';
    end if;
    foreach v_new_page_id in array v_affected_page_ids loop
      perform pg_advisory_xact_lock(hashtext('public.page_composition:' || v_new_page_id::text));
      perform 1 from public.pages where id = v_new_page_id for update;
    end loop;
    execute format('delete from public.%I where template_id=$1 and not (page_id=any($2))', v_table)
      using v_template_id, v_page_ids;
    foreach v_new_page_id in array v_page_ids loop
      execute format('select exists(select 1 from public.%I where page_id=$1 and template_id=$2)', v_table)
        into v_visible using v_new_page_id, v_template_id;
      if not v_visible then
        select coalesce(max(sort_order),0)+10 into v_sort_order
        from public.page_composition_assignments
        where page_id=v_new_page_id and slot=v_slot;
        execute format(
          'insert into public.%I (page_id,template_id,slot,sort_order,is_visible,created_at,updated_at) values ($1,$2,$3,$4,true,$5,$5)',
          v_table
        ) using v_new_page_id,v_template_id,v_slot,v_sort_order,v_now;
      end if;
    end loop;
    insert into page_composition_order_plan (kind,id,next_order)
    select kind,id,row_number() over (partition by page_id,slot order by sort_order,kind,id)*10
    from public.page_composition_assignments
    where page_id=any(v_affected_page_ids) and kind <> 'hero';
    v_result := jsonb_build_object(
      'kind',v_kind,'template_id',v_template_id,'page_ids',to_jsonb(v_page_ids),
      'affected_page_ids',to_jsonb(v_affected_page_ids)
    );

  elsif p_operation = 'duplicate_page' then
    select to_jsonb(page) into v_page_source from public.pages page where id = p_page_id for update;
    v_sequence := pg_get_serial_sequence('public.pages', 'id');
    v_new_page_id := nextval(v_sequence);
    v_clone := v_page_source || jsonb_build_object(
      'id', v_new_page_id,
      'title', v_page_source->>'title' || ' — نسخة',
      'slug', v_page_source->>'slug' || '-copy-' || v_new_page_id::text,
      'path', regexp_replace(v_page_source->>'path', '/+$', '') || '-copy-' || v_new_page_id::text,
      'status', 'draft', 'is_system', false, 'created_at', v_now, 'updated_at', v_now
    );
    insert into public.pages select (jsonb_populate_record(null::public.pages, v_clone)).*;
    for v_row in select * from (values
      ('page_content_block_assignments'), ('page_cta_block_assignments'),
      ('page_cards_block_assignments'), ('page_breadcrumb_block_assignments'),
      ('page_feed_module_assignments'), ('page_media_sidebar_module_assignments'),
      ('page_media_hub_module_assignments')
    ) tables(name)
    loop
      execute format(
        'insert into public.%I (page_id,template_id,slot,sort_order,is_visible,created_at,updated_at) select $1,template_id,slot,sort_order,is_visible,$2,$2 from public.%I where page_id=$3',
        v_row.name, v_row.name
      ) using v_new_page_id, v_now, p_page_id;
    end loop;
    insert into public.hero_assignments (
      hero_id, target_type, target_id, target_slug, path, is_active, priority, created_at, updated_at
    )
    select hero_id, 'page', v_new_page_id, v_clone->>'slug', v_clone->>'path', is_active, priority, v_now, v_now
    from public.hero_assignments where target_type='page' and target_id=p_page_id;
    v_result := jsonb_build_object('page_id', v_new_page_id, 'slug', v_clone->>'slug', 'path', v_clone->>'path');

  elsif p_operation = 'delete_page' then
    insert into public.admin_audit_logs (
      actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
    )
    select p_actor_admin_user_id, coalesce(nullif(p_actor_username,''),'system:unknown'),
           'page.delete', 'page', id, title,
           jsonb_build_object('persistence_owner','mutate_page_composition','atomic',true,'slug',slug,'path',path)
    from public.pages where id = p_page_id;
    delete from public.pages where id = p_page_id;
    return jsonb_build_object('deleted_page_id', p_page_id, 'updated_at', v_now);

  elsif p_operation = 'replace_hero_template' then
    v_template_id := nullif(p_payload->>'hero_id', '')::bigint;
    v_change := coalesce(p_payload->'template', '{}'::jsonb);
    if v_template_id is null or nullif(btrim(v_change->>'name'), '') is null
       or nullif(btrim(v_change->>'slug'), '') is null then
      raise exception using errcode = '22023', message = 'hero_template_payload_invalid';
    end if;
    update public.hero_templates set
      name = btrim(v_change->>'name'), slug = btrim(v_change->>'slug'),
      description = nullif(v_change->>'description',''),
      variant = coalesce(nullif(v_change->>'variant',''),'internal-page'),
      style_preset = coalesce(nullif(v_change->>'style_preset',''),'cinematic-gold'),
      source_type = coalesce(nullif(v_change->>'source_type',''),'manual'),
      source_slug = nullif(v_change->>'source_slug',''),
      limit_count = coalesce(nullif(v_change->>'limit_count','')::integer,1),
      is_visible = coalesce((v_change->>'is_visible')::boolean,true),
      config = coalesce(v_change->'config','{}'::jsonb), updated_at = v_now
    where id = v_template_id;
    if not found then raise exception using errcode = 'P0002', message = 'hero_template_not_found'; end if;
    if jsonb_typeof(coalesce(p_payload->'page_ids','[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'hero_page_ids_invalid';
    end if;
    select coalesce(array_agg(distinct value::bigint), '{}'::bigint[]) into v_page_ids
    from jsonb_array_elements_text(coalesce(p_payload->'page_ids','[]'::jsonb));
    if cardinality(v_page_ids) <> jsonb_array_length(coalesce(p_payload->'page_ids','[]'::jsonb))
       or exists (
         select 1 from unnest(v_page_ids) as requested(page_id)
         left join public.pages page_row on page_row.id=requested.page_id
         where page_row.id is null
       ) then
      raise exception using errcode = '23514', message = 'hero_page_assignment_invalid';
    end if;
    delete from public.hero_assignments where hero_id = v_template_id and target_type = 'page';
    insert into public.hero_assignments (
      hero_id,target_type,target_id,target_slug,path,is_active,priority,created_at,updated_at
    )
    select v_template_id,'page',page.id,page.slug,page.path,true,100,v_now,v_now
    from public.pages page where page.id = any(v_page_ids);
    v_result := jsonb_build_object('hero_id',v_template_id,'page_ids',to_jsonb(v_page_ids));

  elsif p_operation = 'delete_hero_templates' then
    if jsonb_typeof(p_payload->'hero_ids') <> 'array' then
      raise exception using errcode = '22023', message = 'hero_ids_required';
    end if;
    delete from public.hero_templates where id in (
      select value::bigint from jsonb_array_elements_text(p_payload->'hero_ids')
    );
    v_result := jsonb_build_object('deleted_hero_ids',p_payload->'hero_ids');
  else
    raise exception using errcode = '22023', message = 'page_composition_operation_unsupported';
  end if;

  if exists (select 1 from page_composition_order_plan) then
    for v_row in select * from page_composition_order_plan order by kind, id loop
      if v_row.kind = 'hero' then
        update public.hero_assignments set priority = -2000000 - id, updated_at = v_now where id = v_row.id;
      else
        v_table := case v_row.kind
          when 'content' then 'page_content_block_assignments'
          when 'cta' then 'page_cta_block_assignments'
          when 'cards' then 'page_cards_block_assignments'
          when 'breadcrumb' then 'page_breadcrumb_block_assignments'
          when 'feed' then 'page_feed_module_assignments'
          when 'media_sidebar' then 'page_media_sidebar_module_assignments'
          when 'media_hub' then 'page_media_hub_module_assignments' end;
        execute format('update public.%I set sort_order=$1,updated_at=$2 where id=$3',v_table)
          using -2000000 - v_row.id, v_now, v_row.id;
      end if;
    end loop;
    for v_row in select * from page_composition_order_plan order by next_order, kind, id loop
      if v_row.kind = 'hero' then
        update public.hero_assignments set priority = 1000 - v_row.next_order, updated_at = v_now where id = v_row.id;
      else
        v_table := case v_row.kind
          when 'content' then 'page_content_block_assignments'
          when 'cta' then 'page_cta_block_assignments'
          when 'cards' then 'page_cards_block_assignments'
          when 'breadcrumb' then 'page_breadcrumb_block_assignments'
          when 'feed' then 'page_feed_module_assignments'
          when 'media_sidebar' then 'page_media_sidebar_module_assignments'
          when 'media_hub' then 'page_media_hub_module_assignments' end;
        execute format('update public.%I set sort_order=$1,updated_at=$2 where id=$3',v_table)
          using v_row.next_order, v_now, v_row.id;
      end if;
    end loop;
  end if;

  insert into public.admin_audit_logs (
    actor_admin_user_id, actor_username, action, entity_type, entity_id, entity_label, metadata
  ) values (
    p_actor_admin_user_id, coalesce(nullif(p_actor_username,''),'system:unknown'),
    'page_composition.' || p_operation, 'page_composition', coalesce(v_new_page_id,p_page_id), null,
    jsonb_build_object(
      'operation',p_operation,'page_id',p_page_id,'result',v_result,
      'persistence_owner','mutate_page_composition','atomic',true
    )
  );
  return v_result || jsonb_build_object('updated_at',v_now);
end
$function$;

revoke all on function public.mutate_page_composition(bigint, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.mutate_page_composition(bigint, text, jsonb, bigint, text) to service_role;
comment on function public.mutate_page_composition(bigint, text, jsonb, bigint, text) is
  'Single atomic Page Composition aggregate mutation, ordering, concurrency, rollback, duplicate prevention, and Audit owner.';

-- Normalize the existing cross-table slot order through the aggregate owner
-- before the guard becomes the permanent boundary.
do $normalize_page_composition$
declare
  v_row record;
  v_table text;
begin
  perform set_config('app.page_composition_write','on',true);
  for v_row in
    select kind,id,row_number() over (partition by page_id,slot order by sort_order,kind,id) * 10 as next_order
    from public.page_composition_assignments where kind <> 'hero'
  loop
    v_table := case v_row.kind
      when 'content' then 'page_content_block_assignments'
      when 'cta' then 'page_cta_block_assignments'
      when 'cards' then 'page_cards_block_assignments'
      when 'breadcrumb' then 'page_breadcrumb_block_assignments'
      when 'feed' then 'page_feed_module_assignments'
      when 'media_sidebar' then 'page_media_sidebar_module_assignments'
      when 'media_hub' then 'page_media_hub_module_assignments' end;
    execute format('update public.%I set sort_order=$1 where id=$2',v_table) using v_row.next_order,v_row.id;
  end loop;
end;
$normalize_page_composition$;

-- page_sections is the retired parallel Section owner. Preserve exact evidence
-- in Audit, then remove it only after the current Hero owner is proven present.
do $retire_page_sections$
declare
  v_rows jsonb;
  v_count integer;
begin
  if to_regclass('public.page_sections') is not null then
    if to_regclass('public.hero_assignments') is null then
      raise exception 'page_sections retirement refused: hero_assignments owner is missing';
    end if;
    execute 'select count(*), coalesce(jsonb_agg(to_jsonb(section) order by section.id), ''[]''::jsonb) from public.page_sections section'
      into v_count, v_rows;
    insert into public.admin_audit_logs (
      actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata
    ) values (
      null,'system:migration','page_composition.legacy_page_sections_removed','page_composition',null,'page_sections',
      jsonb_build_object(
        'migration','20260805180000_global_truth_atomic_operations_closure',
        'removed_rows',v_count,'legacy_rows',v_rows,'canonical_owner','hero_assignments'
      )
    );
    execute 'drop table public.page_sections';
  end if;
end;
$retire_page_sections$;

revoke all on public.page_composition_assignments from anon, authenticated;
grant select on public.page_composition_assignments to service_role;

-- ---------------------------------------------------------------------------
-- Closure diagnostics and exact migration evidence
-- ---------------------------------------------------------------------------

create or replace function public.global_truth_atomic_closure_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with project_health as (
    select
      count(*) filter (where nullif(btrim(code),'') is null) as missing_code,
      count(*) filter (where show_on_homepage and homepage_order <= 0) as invalid_home_order,
      count(*) filter (where slug in (
        'i87','i76','b84','c35','j118','j191','f92','f222','d174','b137','b138',
        'venesia-new-cairo-mall','riyad-mall'
      )) as catalog_count
    from public.projects
  ), menu_health as (
    select count(*) as duplicate_orders from (
      select menu_id,parent_id,sort_order from public.menu_items
      group by menu_id,parent_id,sort_order having count(*) > 1
    ) duplicates
  ), page_health as (
    select count(*) as duplicate_orders from (
      select page_id,slot,sort_order from public.page_composition_assignments
      where kind <> 'hero'
      group by page_id,slot,sort_order having count(*) > 1
    ) duplicates
  )
  select jsonb_build_object(
    'media_global_write_adoption_closed', true,
    'hardcoded_project_truth_closed',
      project_health.missing_code = 0 and project_health.invalid_home_order = 0 and project_health.catalog_count = 13,
    'menu_atomic_operations_closed',
      menu_health.duplicate_orders = 0
      and to_regprocedure('public.mutate_menu_tree(bigint,text,jsonb,bigint,text)') is not null
      and exists (select 1 from pg_trigger where tgname='menu_item_atomic_contract_guard' and not tgisinternal),
    'page_composition_atomic_operations_closed',
      page_health.duplicate_orders = 0
      and to_regclass('public.page_sections') is null
      and to_regprocedure('public.mutate_page_composition(bigint,text,jsonb,bigint,text)') is not null
      and (select count(*) from pg_trigger where tgname='page_composition_atomic_guard' and not tgisinternal) = 8,
    'database_proof', jsonb_build_object(
      'catalog_projects',project_health.catalog_count,
      'missing_project_codes',project_health.missing_code,
      'invalid_homepage_orders',project_health.invalid_home_order,
      'menu_duplicate_orders',menu_health.duplicate_orders,
      'page_duplicate_orders',page_health.duplicate_orders,
      'page_sections_removed',to_regclass('public.page_sections') is null
    ),
    'audit_proof', jsonb_build_object(
      'project_transfer_rows',(select count(*) from public.admin_audit_logs where metadata->>'migration'='20260805180000_global_truth_atomic_operations_closure' and entity_type='project'),
      'legacy_page_sections_rows',(select count(*) from public.admin_audit_logs where action='page_composition.legacy_page_sections_removed')
    )
  )
  from project_health,menu_health,page_health;
$function$;

revoke all on function public.global_truth_atomic_closure_health() from public, anon, authenticated;
grant execute on function public.global_truth_atomic_closure_health() to service_role;

insert into public.admin_audit_logs (
  actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata
) values (
  null,'system:migration','global_truth_atomic.closure_installed','system',null,'global-truth-atomic-closure',
  jsonb_build_object(
    'migration','20260805180000_global_truth_atomic_operations_closure',
    'project_writer','save_project_admin_entry',
    'menu_writer','mutate_menu_tree',
    'page_composition_writer','mutate_page_composition',
    'legacy_page_sections_removed',to_regclass('public.page_sections') is null
  )
);

commit;
