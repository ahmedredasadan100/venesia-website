import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createJiti } from 'jiti';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
// Existing presentation guard calls this bounded SSR/owner acceptance path.
// It exits before the legacy browser runner and never starts a server.
if (process.argv.includes('--premium-adoption-acceptance-offline') || process.argv.includes('--premium-adoption-validate-visual-only')) {
  await verifyPremiumAdoptionAcceptance();
  process.exit(0);
}
// Opt-in CUA entry point: the existing fixture serves real Admin consumers and
// canonical save parsers without launching a second browser controller.
if (process.argv.includes('--content-premium-serve-only') || process.argv.includes('--content-premium-offline-only') || process.argv.includes('--premium-family-fixture') || process.argv.includes('--premium-family-offline-only') || process.argv.includes('--premium-completion-fixture')) {
  await serveContentPremiumFixture();
  if (process.argv.includes('--content-premium-offline-only') || process.argv.includes('--premium-family-offline-only')) process.exit(0);
  await new Promise(() => {});
}
const root=process.cwd(),require=createRequire(import.meta.url),baseline=process.argv.includes('--baseline'),mediaOnly=process.argv.includes('--media-only'),textOnly=process.argv.includes('--text-only'),ctaOnly=process.argv.includes('--cta-only'),ctaFamilyOnly=process.argv.includes('--cta-family-only'),cardsFamilyOnly=process.argv.includes('--cards-family-only'),searchFamilyOnly=process.argv.includes('--search-family-only'),heroMediaActionsOnly=process.argv.includes('--hero-media-actions-only'),heroFamilyOnly=process.argv.includes('--hero-family-only')||heroMediaActionsOnly,feedFamilyOnly=process.argv.includes('--feed-family-only'),feedToggleOnly=process.argv.includes('--feed-toggle-refinement-only'),feedPremiumOnly=process.argv.includes('--feed-premium-settings-only')||feedToggleOnly,feedLayoutOnly=process.argv.includes('--feed-layout-only')||feedPremiumOnly,feedHeadBaseline=process.argv.includes('--feed-head-baseline'),pagesOnly=process.argv.includes('--pages-only'),aboutOnly=process.argv.includes('--about-only'),aboutRichOnly=process.argv.includes('--about-rich-only'),tabsOnly=process.argv.includes('--tabs-only'),gridOnly=process.argv.includes('--grid-only'),trustOnly=process.argv.includes('--trust-only'),contactOnly=process.argv.includes('--contact-only'),mediaHubOnly=process.argv.includes('--media-hub-only'),mediaSidebarOnly=process.argv.includes('--media-sidebar-only'),featuredCapacityOnly=process.argv.includes('--featured-capacity-only'),featuredOnly=process.argv.includes('--featured-only')||featuredCapacityOnly;
assert.ok([mediaOnly,textOnly,ctaOnly,ctaFamilyOnly,cardsFamilyOnly,feedFamilyOnly,searchFamilyOnly,heroFamilyOnly,pagesOnly,aboutOnly,aboutRichOnly,tabsOnly,gridOnly,trustOnly,contactOnly,mediaHubOnly,mediaSidebarOnly,featuredOnly].filter(Boolean).length<=1,'Choose one affected surface');
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
const {cleanText,parseNumber}=await jiti.import('../src/lib/page-blocks/admin-utils.ts');
const {normalizeRichTextContent}=await jiti.import('../src/lib/rich-text/html-utils.ts');
const {buildPageBlockTextFormattingPatch}=await jiti.import('../src/lib/page-blocks/configs.ts');
const {ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME,ADMIN_FORM}=await jiti.import('../src/lib/admin/admin-ui-styles.ts');
const {linkFieldFromFormData,hasSavedLinkField}=await jiti.import('../src/lib/admin/links/block-save.ts');
const {serializeAdminLink}=await jiti.import('../src/lib/admin/links/serialize.ts');
const actionSource=await readFile('src/app/admin/pages-blocks/blocks/content/actions.ts','utf8');
const ast=ts.createSourceFile('actions.ts',actionSource,ts.ScriptTarget.Latest,true);
const names=new Set(['CONTENT_FORMATTING_FIELDS','optionalImagePath','buildGenericContentConfig','buildAboutIntroConfig','readPrincipleItems','buildAboutPrinciplesConfig','readContacts','buildAboutCtaConfig','mergeSubmittedContentFormatting']);
const selected=ast.statements.filter(n=>ts.isFunctionDeclaration(n)?names.has(n.name?.text):ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(ast))));
assert.equal(selected.length,names.size);
const serializer=ts.transpileModule(selected.map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const saveConfig=new Function('cleanText','parseNumber','normalizeRichTextContent','linkFieldFromFormData','hasSavedLinkField','buildPageBlockTextFormattingPatch',serializer+'\nreturn data => mergeSubmittedContentFormatting(data,data.get("config_schema")==="about-principles"?buildAboutPrinciplesConfig(data):data.get("config_schema")==="about-cta"?buildAboutCtaConfig(data):buildAboutIntroConfig(data));')(cleanText,parseNumber,normalizeRichTextContent,linkFieldFromFormData,hasSavedLinkField,buildPageBlockTextFormattingPatch);

const heroFixture={"rows":[{"id":1,"name":"سلايدر الرئيسية","slug":"hero-home","description":"Hero template assigned to /","section_key":"hero","variant":"home-cinematic","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":1,"status":"published","config":{"title":"الثقة مش وعد…","images":["https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/1-1791639495859-d8d94760-4b6.jpg","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/2-1791639503557-ae551bca-5b9.jpg","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/3-1791639510379-6479125e-504.jpg","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/4-1791639516777-39b338e7-2db.jpg","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/5-1791639523325-789c5342-c04.jpg","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/6-1791639529671-cf26757c-453.jpg","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/7-1791639536378-e99abdd6-137.jpg"],"ctaBold":false,"eyebrow":"من المخطط إلى التنفيذ… الحكاية بتتشاف على الأرض","showCta":true,"subtitle":"فى فينيسيا للتطوير العقارى","highlight":"الثقة فعل.","showTitle":true,"titleBold":true,"description":"<p>إحنا مش بنعرض مشروع وبس. إحنا بنوثّق رحلة تنفيذ كاملة، ونحوّل كل مرحلة على الأرض إلى دليل ثقة يطمن العميل والمستثمر.</p>","eyebrowBold":false,"showEyebrow":true,"ctaAlignment":"right","mobileImages":["https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-1-1791637972605-7c3fa10e-c63.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-2-1791637980681-132274fe-d44.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-3-1791637988135-2d601ee0-b83.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-4-1791637996172-df323180-00f.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-5-1791638004076-3cf4063a-6cf.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-6-1791638011149-6abf7d0b-2e4.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-7-1791638019214-be6901b6-6f3.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-8-1791638027440-653b3e2d-7b5.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-9-1791638035349-14619df0-639.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-10-1791638043104-d306a2a5-96a.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-11-1791638051052-bf47db06-38e.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-13-1791638068835-fcae1eb7-4b0.png","https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/ven-12-1791638059166-9441b960-46b.png"],"showSubtitle":true,"subtitleBold":false,"highlightBold":false,"showHighlight":true,"primaryCtaLink":{"href":"/projects","meta":{"route_key":"projects"},"anchor":null,"target":"_self","link_kind":"static_route","linked_id":null,"linked_type":"static_routes"},"titleAlignment":"right","descriptionBold":false,"primaryCtaLabel":"استكشف المشاريع","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-center","secondaryCtaLink":{"href":"/track-your-project","meta":{"route_key":"track-your-project"},"anchor":null,"target":"_self","link_kind":"static_route","linked_id":null,"linked_type":"static_routes"},"secondaryCtaLabel":"تابع مشروعك","subtitleAlignment":"right","highlightAlignment":"right","projectActionOrder":["download","tracking","reservation"],"descriptionAlignment":"right","showProjectDownloadAction":true,"showProjectTrackingAction":true,"showProjectReservationAction":true},"updated_at":"2026-10-10 13:41:08.384952+00"},{"id":2,"name":"Hero - من نحن","slug":"hero-about","description":"Hero template assigned to /about","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":2,"status":"published","config":{"title":"عن فينيسيا","images":["https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/home/chatgpt-image-oct-17-2026-04-52-21-pm-1792245224528-df41e527-28e.png"],"ctaBold":false,"eyebrow":"About Venesia","showCta":false,"subtitle":"","highlight":"Venesia Developments","showTitle":true,"titleBold":true,"description":"<p>رحلة بدأت برؤية واضحة، وتستمر اليوم بمشروعات تُنفذ على أرض الواقع.</p>","eyebrowBold":false,"showEyebrow":true,"ctaAlignment":"right","mobileImages":[],"showSubtitle":true,"subtitleBold":false,"highlightBold":false,"showHighlight":true,"primaryCtaLink":null,"titleAlignment":"right","descriptionBold":false,"primaryCtaLabel":"باباب","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","secondaryCtaLink":null,"secondaryCtaLabel":"","subtitleAlignment":"right","highlightAlignment":"right","projectActionOrder":["download","tracking","reservation"],"descriptionAlignment":"right","showProjectDownloadAction":true,"showProjectTrackingAction":true,"showProjectReservationAction":true},"updated_at":"2026-10-17 13:54:02.187254+00"},{"id":3,"name":"Hero — Media Center Hub","slug":"hero-media-center","description":"Hero for /media-center hub","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":30,"status":"published","config":{"title":"المركز الإعلامي","images":["/images/venesia-5.png"],"eyebrow":"Media Center","showCta":false,"subtitle":"أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.","highlight":"","titleBold":true,"description":"أحدث الأخبار والتغطيات الإعلامية والمواد المرئية الخاصة بمشروعات فينيسيا.","eyebrowBold":false,"ctaAlignment":"right","subtitleBold":false,"highlightBold":false,"titleAlignment":"right","eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":4,"name":"Hero - موضوعات تهمك","slug":"hero-topics","description":"Hero template assigned to /topics","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":4,"status":"published","config":{"title":"موضوعات تهمك","images":["https://pmqsfqvvekrlujqgurcu.supabase.co/storage/v1/object/public/cms-images/images/venesia/a2-1787619524990-13dc91c8-ce0.png"],"ctaBold":false,"eyebrow":"Knowledge Center","showCta":false,"subtitle":"محتوى عقاري موثوق يجيب عن أهم الأسئلة، ويقدم معلومات تساعدك على اتخاذ قرارك بثقة.","highlight":"كل ما يهمك فى موضوع العقارات والاستثمار العقارى","showTitle":true,"titleBold":true,"description":"<p>مقالات ونصائح ومعلومات عقارية تساعدك على فهم السوق واتخاذ قرارات أكثر وعيًا وثقة، من الشراء وحتى الاستثمار.</p>","eyebrowBold":true,"showEyebrow":true,"ctaAlignment":"right","mobileImages":[],"showSubtitle":false,"subtitleBold":false,"highlightBold":true,"showHighlight":true,"primaryCtaLink":null,"titleAlignment":"right","primaryCtaLabel":"","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-center","secondaryCtaLink":null,"secondaryCtaLabel":"","subtitleAlignment":"right","highlightAlignment":"right","projectActionOrder":["download","tracking","reservation"],"descriptionAlignment":"right","showProjectDownloadAction":true,"showProjectTrackingAction":true,"showProjectReservationAction":true},"updated_at":"2026-09-01 17:59:30.980611+00"},{"id":5,"name":"Hero - تواصل معنا","slug":"hero-contact","description":"Hero template assigned to /contact","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":5,"status":"published","config":{"title":"تواصل معنا","images":["/images/venesia-5.png"],"eyebrow":"Contact Venesia","showCta":false,"subtitle":"ابدأ خطوة واضحة وتواصل مع فريق فينيسيا.","highlight":"","titleBold":true,"description":"فريقنا جاهز للإجابة على أسئلتك ومساعدتك في اختيار الخطوة المناسبة.","eyebrowBold":false,"ctaAlignment":"right","subtitleBold":false,"highlightBold":false,"titleAlignment":"right","eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":6,"name":"Hero — Media Center News","slug":"hero-media-center-news","description":"Hero for media-center-news","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":31,"status":"published","config":{"title":"الأخبار","images":["/images/venesia-5.png"],"eyebrow":"News","showCta":false,"subtitle":"آخر أخبار وتحديثات فينيسيا.","highlight":"","titleBold":true,"description":"آخر أخبار وتحديثات فينيسيا.","eyebrowBold":false,"ctaAlignment":"right","subtitleBold":false,"highlightBold":false,"titleAlignment":"right","eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":7,"name":"Hero — Media Center Videos","slug":"hero-media-center-videos","description":"Hero for media-center-videos","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":32,"status":"published","config":{"title":"الفيديوهات","images":["/images/venesia-5.png"],"eyebrow":"Videos","showCta":false,"subtitle":"لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.","highlight":"","showTitle":true,"titleBold":true,"description":"<p>لقطات وجولات مرئية توثق ما يحدث داخل مشروعات فينيسيا.</p>","eyebrowBold":false,"showEyebrow":true,"ctaAlignment":"right","mobileImages":[],"showSubtitle":true,"subtitleBold":false,"highlightBold":false,"showHighlight":true,"primaryCtaLink":null,"titleAlignment":"right","primaryCtaLabel":"","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","secondaryCtaLink":null,"secondaryCtaLabel":"","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":8,"name":"Hero — Media Center Gallery","slug":"hero-media-center-gallery","description":"Hero for media-center-gallery","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":33,"status":"published","config":{"title":"معرض الصور","images":["/images/venesia-5.png"],"eyebrow":"Gallery","showCta":false,"subtitle":"صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.","highlight":"يسليسليسلسيب","showTitle":true,"titleBold":true,"description":"<p>صور مختارة توثق مراحل التنفيذ والتفاصيل المعمارية داخل مشروعات فينيسيا.</p>","eyebrowBold":false,"showEyebrow":true,"ctaAlignment":"right","mobileImages":[],"showSubtitle":true,"subtitleBold":false,"highlightBold":false,"showHighlight":true,"primaryCtaLink":null,"titleAlignment":"right","primaryCtaLabel":"","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","secondaryCtaLink":null,"secondaryCtaLabel":"","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":9,"name":"Hero — Media Center Press","slug":"hero-media-center-press","description":"Hero for media-center-press","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":34,"status":"published","config":{"title":"البيانات الصحفية","images":["/images/venesia-5.png"],"eyebrow":"Press","showCta":false,"subtitle":"بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.","highlight":"","titleBold":true,"description":"<p>بيانات وتغطيات رسمية تعكس أخبار فينيسيا بلغة واضحة وموثقة.</p>","eyebrowBold":false,"ctaAlignment":"right","mobileImages":[],"subtitleBold":false,"highlightBold":false,"primaryCtaLink":null,"titleAlignment":"right","primaryCtaLabel":"","eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","secondaryCtaLink":null,"secondaryCtaLabel":"","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":10,"name":"Hero — Media Center Site Updates","slug":"hero-media-center-site-updates","description":"Hero for media-center-site-updates","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":35,"status":"published","config":{"title":"تحديثات المواقع","images":["/images/venesia-5.png"],"eyebrow":"Site Updates","showCta":false,"subtitle":"متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.","highlight":"","showTitle":true,"titleBold":true,"description":"<p>متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.</p>","eyebrowBold":false,"showEyebrow":true,"ctaAlignment":"right","mobileImages":[],"showSubtitle":true,"subtitleBold":false,"highlightBold":false,"showHighlight":true,"primaryCtaLink":null,"titleAlignment":"right","primaryCtaLabel":"","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","secondaryCtaLink":null,"secondaryCtaLabel":"","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":28,"name":"Hero — Track Your Project","slug":"hero-track-your-project","description":"Hero لصفحة تابع مشروعك","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":55,"status":"published","config":{"title":"تابع مشروعك","images":["/images/venesia-1.png"],"eyebrow":"Project Tracking","showCta":false,"subtitle":"تابع مراحل التنفيذ أولًا بأول عبر تحديثات واضحة تعكس الواقع على الأرض.","highlight":"","titleBold":true,"description":"","eyebrowBold":false,"ctaAlignment":"right","subtitleBold":false,"highlightBold":false,"titleAlignment":"right","eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","subtitleAlignment":"right","highlightAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-22 09:45:44.210982+00"},{"id":31,"name":"Hero تفاصيل المشروع","slug":"project-detail-hero","description":"Presentation مشتركة لكل صفحات تفاصيل المشاريع؛ البيانات مملوكة لـProjects Domain.","section_key":"hero","variant":"project-detail","style_preset":"cinematic-gold","source_type":"domain-backed","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":0,"status":"published","config":{"ctaBold":false,"showCta":true,"showTitle":true,"titleBold":true,"eyebrowBold":false,"showEyebrow":true,"ctaAlignment":"right","showSubtitle":true,"subtitleBold":true,"highlightBold":false,"showHighlight":false,"titleAlignment":"right","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","subtitle","description","cta"],"imageComposition":"cover-center","subtitleAlignment":"right","highlightAlignment":"right","projectActionOrder":["download","tracking","reservation"],"descriptionAlignment":"right","showProjectDownloadAction":true,"showProjectTrackingAction":true,"showProjectReservationAction":true},"updated_at":"2026-08-27 00:27:24.008208+00"},{"id":33,"name":"Hero — Search","slug":"hero-search","description":"Hero for the CMS-managed /search page","section_key":"hero","variant":"internal-page","style_preset":"cinematic-gold","source_type":"manual","source_id":null,"source_slug":null,"limit_count":1,"is_visible":true,"sort_order":70,"status":"published","config":{"title":"البحث","images":["/images/venesia-5.png"],"eyebrow":"Search","showCta":false,"subtitle":"ابحث في محتوى فينيسيا من مكان واحد.","showTitle":true,"titleBold":true,"description":"المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية.","eyebrowBold":false,"showEyebrow":true,"mobileImages":[],"showSubtitle":true,"subtitleBold":false,"showHighlight":false,"titleAlignment":"right","showDescription":true,"eyebrowAlignment":"right","heroElementOrder":["eyebrow","title","highlight","subtitle","description","cta"],"imageComposition":"cover-upper","subtitleAlignment":"right","descriptionAlignment":"right"},"updated_at":"2026-08-31 08:45:05.486493+00"}],"pages":[{"id":13,"title":"المركز الإعلامي — الأخبار","slug":"media-center-news","path":"/media-center/news"},{"id":14,"title":"المركز الإعلامي — الفيديوهات","slug":"media-center-videos","path":"/media-center/videos"},{"id":15,"title":"المركز الإعلامي — معرض الصور","slug":"media-center-gallery","path":"/media-center/gallery"},{"id":16,"title":"المركز الإعلامي — الصحافة","slug":"media-center-press","path":"/media-center/press"},{"id":17,"title":"المركز الإعلامي — تحديثات المواقع","slug":"media-center-site-updates","path":"/media-center/site-updates"},{"id":24,"title":"تابع مشروعك","slug":"track-your-project","path":"/track-your-project"},{"id":1,"title":"الرئيسية","slug":"home","path":"/"},{"id":2,"title":"من نحن","slug":"about","path":"/about"},{"id":3,"title":"المركز الإعلامي","slug":"media-center","path":"/media-center"},{"id":4,"title":"موضوعات تهمك","slug":"topics","path":"/topics"},{"id":5,"title":"تواصل معنا","slug":"contact","path":"/contact"},{"id":36,"title":"المشروعات","slug":"projects","path":"/projects"},{"id":69,"title":"البحث","slug":"search","path":"/search"}],"assignments":[{"id":149,"hero_id":1,"target_type":"page","target_id":1,"is_active":true,"priority":100},{"id":158,"hero_id":2,"target_type":"page","target_id":2,"is_active":true,"priority":100},{"id":3,"hero_id":3,"target_type":"page","target_id":3,"is_active":true,"priority":990},{"id":138,"hero_id":4,"target_type":"page","target_id":4,"is_active":true,"priority":100},{"id":5,"hero_id":5,"target_type":"page","target_id":5,"is_active":true,"priority":980},{"id":27,"hero_id":6,"target_type":"page","target_id":13,"is_active":true,"priority":990},{"id":83,"hero_id":7,"target_type":"page","target_id":14,"is_active":true,"priority":100},{"id":113,"hero_id":8,"target_type":"page","target_id":15,"is_active":true,"priority":100},{"id":85,"hero_id":9,"target_type":"page","target_id":16,"is_active":true,"priority":100},{"id":82,"hero_id":10,"target_type":"page","target_id":17,"is_active":true,"priority":990},{"id":32,"hero_id":28,"target_type":"page","target_id":24,"is_active":true,"priority":100},{"id":131,"hero_id":33,"target_type":"page","target_id":69,"is_active":true,"priority":1000}]};
const heroBaselineRoot=process.env.HERO_QA_BASELINE_ROOT;if(heroFamilyOnly&&baseline)assert.ok(heroBaselineRoot,'Hero before requires frozen owner sources');
const heroControls=await jiti.import('../src/lib/hero/hero-content-controls.ts'),heroPublicConfig=await jiti.import('../src/lib/page-sections.ts');
const heroLinkForms=await jiti.import('../src/lib/admin/links/form-fields.ts'),heroLinkValidation=await jiti.import('../src/lib/admin/links/validate.ts');
const heroActionSource=await readFile('src/app/admin/pages-blocks/blocks/hero/actions.ts','utf8'),heroAst=ts.createSourceFile('hero-actions.ts',heroActionSource,ts.ScriptTarget.Latest,true),heroPureNames=new Set(['cleanText','splitImages','buildHeroConfig']);
const heroPure=heroAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&heroPureNames.has(n.name?.text));assert.equal(heroPure.length,3);
const heroDeps={parseAdminLinkFromFormData:heroLinkForms.parseAdminLinkFromFormData,serializeAdminLink,isAdminLinkEmpty:heroLinkValidation.isAdminLinkEmpty,resolveHeroContentControlsForVariant:heroControls.resolveHeroContentControlsForVariant,parseHeroContentControlsFormData:heroControls.parseHeroContentControlsFormData,PROJECT_DETAIL_HERO_ELEMENT_KEYS:heroControls.PROJECT_DETAIL_HERO_ELEMENT_KEYS,resolveHeroImageCompositionPreset:heroControls.resolveHeroImageCompositionPreset,isDomainBackedHeroTemplateVariant:heroControls.isDomainBackedHeroTemplateVariant,normalizeRichTextContent};
const saveHeroConfig=new Function(...Object.keys(heroDeps),ts.transpileModule(heroPure.map(n=>n.getText(heroAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';return buildHeroConfig;')(...Object.values(heroDeps));
const heroResolverLoader=heroFamilyOnly?createJiti(import.meta.url,{fsCache:false,moduleCache:true,alias:{'server-only':path.join(root,'node_modules/next/dist/compiled/server-only/empty.js')}}):null;
let heroLinkResolver=heroFamilyOnly?await heroResolverLoader.import('../src/lib/admin/links/hero-config.ts'):null;
const heroTargetBefore=process.argv.includes('--hero-target-baseline'),heroTargetBaselineRoot=process.env.HERO_TARGET_BASELINE_ROOT;
if(heroTargetBefore){assert.ok(heroTargetBaselineRoot);const original=await readFile(path.join(heroTargetBaselineRoot,'src/lib/admin/links/hero-config.ts'),'utf8'),owners=await heroResolverLoader.import('../src/lib/admin/links/index.ts'),fixtureModule={exports:{}};new Function('exports','require','module',ts.transpileModule(original,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(fixtureModule.exports,id=>{assert.equal(id,'./index');return owners;},fixtureModule);heroLinkResolver=fixtureModule.exports;}
if(heroFamilyOnly&&process.argv.includes('--hero-target-compatibility')){const providers=await heroResolverLoader.import('../src/lib/admin/links/providers/index.ts'),registry=await heroResolverLoader.import('../src/lib/admin/links/registry.ts');providers.ensureAdminLinkProvidersRegistered();registry.registerAdminLinkProvider({type:'pages',label:'صفحة اختبار',labelPlural:'صفحات الاختبار',search:async()=>{throw Error('Unexpected public picker search')},resolveMany:async ids=>{assert.deepEqual(ids,[901]);return new Map([[901,'/about']]);}});}
const heroFixtureProject={slug:'fixture-project',englishName:'Fixture Project',arabicName:'مشروع الاختبار',shortDescription:'وصف المشروع من المالك الأصلي',location:{label:'القاهرة الجديدة'},heroImage:{src:'/one.svg',alt:'صورة المشروع'},heroBoxImage:{src:'/two.svg',alt:'معاينة المشروع'},brochureUrl:'/fixture.pdf'};

const searchFixture={"records":[{"id":182,"name":"Search Platform — Results","slug":"search-platform","variant":"search-platform","status":"published","description":"Canonical full Search Platform results module for /search","style_preset":"premium-dark","config":{"scope":"all","title":"ابحث في محتوى فينيسيا","filters":["content-type"],"helpText":"ابحث بالعنوان أو الملخص أو الرابط.","defaultSort":"newest","description":"اكتشف المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية من مكان واحد.","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["article","news","press","site_update","video","gallery"],"presentation":"full-grid"},"updated_at":"2026-08-31 23:56:46.19942+00"},{"id":183,"name":"Search — Topics","slug":"topics-search","variant":"search-platform","status":"published","description":"Compact Search Platform launcher scoped to articles","style_preset":"premium-dark","config":{"scope":"all","title":"ابحث في الموضوعات","filters":["content-type","category","series"],"helpText":"البحث في المقالات والعناوين والتصنيفات والسلاسل.","defaultSort":"newest","description":"انتقل إلى صفحة البحث الموحدة","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["article","news","press","site_update","video","gallery"],"presentation":"full-grid","interfaceDisplay":{"title":{"bold":true,"visible":true,"alignment":"right"},"helpText":{"bold":false,"visible":true,"alignment":"right"},"description":{"bold":false,"visible":true,"alignment":"right"},"emptyResults":{"title":"لا توجد نتائج مطابقة","description":"جرّب كلمة مختلفة أو خفّف الفلاتر الحالية."},"resultsTitle":{"bold":false,"visible":true,"alignment":"right"},"searchAction":{"visible":true}}},"updated_at":"2026-09-27 14:20:54.399753+00"},{"id":184,"name":"Search — Media News","slug":"media-news-search","variant":"search-platform","status":"published","description":"Compact Search Platform launcher scoped to news","style_preset":"premium-dark","config":{"scope":"selected","title":"ابحث في الأخبار","filters":[],"helpText":"البحث داخل الأخبار المنشورة.","defaultSort":"newest","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف أخبار فينيسيا.","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["news"],"presentation":"compact"},"updated_at":"2026-08-31 08:45:05.486493+00"},{"id":185,"name":"Search — Media Press","slug":"media-press-search","variant":"search-platform","status":"published","description":"Compact Search Platform launcher scoped to press releases","style_preset":"premium-dark","config":{"scope":"selected","title":"ابحث في البيانات الصحفية","filters":[],"helpText":"البحث داخل البيانات الصحفية المنشورة.","defaultSort":"newest","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف البيانات الصحفية.","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["press"],"presentation":"compact"},"updated_at":"2026-08-31 08:45:05.486493+00"},{"id":186,"name":"Search — Media Site Updates","slug":"media-site-updates-search","variant":"search-platform","status":"published","description":"Compact Search Platform launcher scoped to site updates","style_preset":"premium-dark","config":{"scope":"selected","title":"ابحث في تحديثات المواقع","filters":[],"helpText":"البحث داخل تحديثات المواقع المنشورة.","defaultSort":"newest","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف تحديثات التنفيذ.","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["site_update"],"presentation":"compact"},"updated_at":"2026-08-31 08:45:05.486493+00"},{"id":187,"name":"Search — Media Videos","slug":"media-videos-search","variant":"search-platform","status":"published","description":"Compact Search Platform launcher scoped to videos","style_preset":"premium-dark","config":{"scope":"selected","title":"ابحث في الفيديوهات","filters":[],"helpText":"البحث داخل الفيديوهات المنشورة.","defaultSort":"newest","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف الفيديوهات.","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["video"],"presentation":"compact"},"updated_at":"2026-08-31 08:45:05.486493+00"},{"id":188,"name":"Search — Media Gallery","slug":"media-gallery-search","variant":"search-platform","status":"published","description":"Compact Search Platform launcher scoped to galleries","style_preset":"premium-dark","config":{"scope":"selected","title":"ابحث في معرض الصور","filters":[],"helpText":"البحث داخل معارض الصور المنشورة.","defaultSort":"newest","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف معارض الصور.","placeholder":"اكتب كلمة البحث...","resultLimit":12,"contentTypes":["gallery"],"presentation":"compact"},"updated_at":"2026-08-31 08:45:05.486493+00"}],"assignments":[{"id":200,"page_id":69,"template_id":182,"slot":"main","sort_order":10,"is_visible":true,"page_title":"البحث","page_slug":"search","page_path":"/search"},{"id":201,"page_id":4,"template_id":183,"slot":"sidebar","sort_order":10,"is_visible":true,"page_title":"موضوعات تهمك","page_slug":"topics","page_path":"/topics"},{"id":202,"page_id":13,"template_id":184,"slot":"sidebar","sort_order":10,"is_visible":true,"page_title":"المركز الإعلامي — الأخبار","page_slug":"media-center-news","page_path":"/media-center/news"},{"id":203,"page_id":16,"template_id":185,"slot":"sidebar","sort_order":10,"is_visible":true,"page_title":"المركز الإعلامي — الصحافة","page_slug":"media-center-press","page_path":"/media-center/press"},{"id":204,"page_id":17,"template_id":186,"slot":"sidebar","sort_order":10,"is_visible":true,"page_title":"المركز الإعلامي — تحديثات المواقع","page_slug":"media-center-site-updates","page_path":"/media-center/site-updates"},{"id":205,"page_id":14,"template_id":187,"slot":"sidebar","sort_order":10,"is_visible":true,"page_title":"المركز الإعلامي — الفيديوهات","page_slug":"media-center-videos","page_path":"/media-center/videos"},{"id":206,"page_id":15,"template_id":188,"slot":"sidebar","sort_order":10,"is_visible":true,"page_title":"المركز الإعلامي — معرض الصور","page_slug":"media-center-gallery","page_path":"/media-center/gallery"}],"pages":[{"id":13,"title":"المركز الإعلامي — الأخبار","slug":"media-center-news","path":"/media-center/news"},{"id":14,"title":"المركز الإعلامي — الفيديوهات","slug":"media-center-videos","path":"/media-center/videos"},{"id":15,"title":"المركز الإعلامي — معرض الصور","slug":"media-center-gallery","path":"/media-center/gallery"},{"id":16,"title":"المركز الإعلامي — الصحافة","slug":"media-center-press","path":"/media-center/press"},{"id":17,"title":"المركز الإعلامي — تحديثات المواقع","slug":"media-center-site-updates","path":"/media-center/site-updates"},{"id":24,"title":"تابع مشروعك","slug":"track-your-project","path":"/track-your-project"},{"id":1,"title":"الرئيسية","slug":"home","path":"/"},{"id":2,"title":"من نحن","slug":"about","path":"/about"},{"id":3,"title":"المركز الإعلامي","slug":"media-center","path":"/media-center"},{"id":4,"title":"موضوعات تهمك","slug":"topics","path":"/topics"},{"id":5,"title":"تواصل معنا","slug":"contact","path":"/contact"},{"id":36,"title":"المشروعات","slug":"projects","path":"/projects"},{"id":69,"title":"البحث","slug":"search","path":"/search"}]};
const searchContract=await jiti.import('../src/lib/page-blocks/search-platform-config.ts'),searchContentTypes=await jiti.import('../src/lib/admin/content/content-types.ts'),searchEditorRegistry=await jiti.import('../src/lib/page-blocks/module-edit-registry.ts');
const searchBuilder=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='buildSearchPlatformConfig');assert.ok(searchBuilder);
const saveSearchConfig=new Function('cleanText','SEARCH_PLATFORM_SCOPES','SEARCH_PLATFORM_RESULT_LIMITS','SEARCH_PLATFORM_PRESENTATIONS','SEARCH_PLATFORM_FILTERS','isContentType','buildSearchPlatformInterfaceDisplayFromFormData',ts.transpileModule(searchBuilder.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';return buildSearchPlatformConfig;')(cleanText,searchContract.SEARCH_PLATFORM_SCOPES,searchContract.SEARCH_PLATFORM_RESULT_LIMITS,searchContract.SEARCH_PLATFORM_PRESENTATIONS,searchContract.SEARCH_PLATFORM_FILTERS,searchContentTypes.isContentType,searchContract.buildSearchPlatformInterfaceDisplayFromFormData);
const searchBaselineRoot=process.env.SEARCH_QA_BASELINE_ROOT;if(searchFamilyOnly&&baseline)assert.ok(searchBaselineRoot,'Search before requires frozen owner sources');
let searchSavedRaw,searchPublicCount=9;
const feedRecords=[{"id":1,"name":"مواضيع تهمك","slug":"topics-feed-categories","feed_type":"categories","status":"published","config":{"query":{"limit":94,"seriesSlugs":[],"categorySlugs":["bait-al-watan"]},"presentation":{"title":"مواضيع تهمك","eyebrow":"Categories","linkText":"عرض كل الموضوعات","showDate":false,"variants":{"latest":{"layout":"slider","density":3,"showDots":true,"showArrows":false},"series":{"layout":"slider","columns":1,"showArrows":true},"popular":{"layout":"list","columns":1},"categories":{"layout":"list","columns":1}},"showImage":false,"showTitle":true,"titleBold":true,"seriesCard":{"seriesBold":true,"showSeries":true,"detailsBold":false,"showDetails":true,"descriptionBold":false,"seriesAlignment":"right","showDescription":false,"detailsAlignment":"left","descriptionAlignment":"right"},"articleCard":{"dateBold":false,"showDate":true,"showTitle":true,"titleBold":false,"excerptBold":false,"showExcerpt":false,"dateAlignment":"right","titleAlignment":"right","excerptAlignment":"right"},"eyebrowBold":false,"showExcerpt":false,"showEyebrow":false,"categoryCard":{"countBold":false,"showCount":true,"categoryBold":false,"showCategory":true,"countAlignment":"left","categoryAlignment":"right"},"emptyBehavior":"hide","titleAlignment":"right","eyebrowAlignment":"right"}},"description":"تصنيفات موضوعات تهمك"},{"id":2,"name":"أحدث الموضوعات","slug":"topics-feed-latest","feed_type":"latest","status":"published","config":{"query":{"limit":30,"seriesSlugs":["ahya-byt-alwtn-baltfsyl","akhta-alshra-fy-byt-alwtn","alardy-bgardn-am-aldwr-almtkrr","alastthmar-fy-byt-alwtn","alskn-fy-byt-alwtn","alaqwd-waltrakhys-fy-byt-alwtn","dlyl-almstthmr-fy-byt-alwtn","shra-shqh-fy-byt-alwtn","kyf-tkhtar-mshrwak-fy-byt-alwtn","mstqbl-byt-alwtn"],"categorySlugs":["bait-al-watan"]},"presentation":{"title":"أحدث الموضوعات1","eyebrow":null,"linkText":"عرض كل الموضوعات","showDate":true,"variants":{"latest":{"list":{"showDots":true,"itemsPerGroup":3,"intervalSeconds":8},"layout":"list","density":1,"showDots":false,"showArrows":true},"series":{"list":{"showDots":true,"itemsPerGroup":30,"intervalSeconds":8},"layout":"slider","columns":1,"showArrows":true},"popular":{"list":{"showDots":true,"itemsPerGroup":30,"intervalSeconds":8},"layout":"list","columns":1},"categories":{"list":{"showDots":true,"itemsPerGroup":30,"intervalSeconds":8},"layout":"list","columns":1}},"showImage":true,"showTitle":true,"titleBold":true,"seriesCard":{"seriesBold":true,"showSeries":true,"detailsBold":false,"showDetails":true,"descriptionBold":false,"seriesAlignment":"right","showDescription":false,"detailsAlignment":"left","descriptionAlignment":"right"},"articleCard":{"dateBold":false,"showDate":true,"showTitle":true,"titleBold":false,"excerptBold":false,"showExcerpt":true,"dateAlignment":"right","titleAlignment":"right","excerptAlignment":"right"},"eyebrowBold":false,"showExcerpt":true,"showEyebrow":true,"categoryCard":{"countBold":false,"showCount":true,"categoryBold":false,"showCategory":true,"countAlignment":"left","categoryAlignment":"right"},"emptyBehavior":"hide","titleAlignment":"right","eyebrowAlignment":"right"}},"description":"أحدث الموضوعات"},{"id":3,"name":"الأكثر قراءة","slug":"topics-feed-popular","feed_type":"popular","status":"published","config":{"query":{"limit":3,"seriesSlugs":["ahya-byt-alwtn-baltfsyl","akhta-alshra-fy-byt-alwtn","aselh-shaeah-an-byt-alwtn","asaar-byt-alwtn","alastthmar-fy-byt-alwtn","alkhdmat-walmrafq-fy-byt-alwtn","aldlyl-alshaml-lbyt-alwtn","alskn-fy-byt-alwtn"],"categorySlugs":["bait-al-watan"]},"presentation":{"title":"الأكثر قراءة","eyebrow":null,"linkText":"عرض كل الموضوعات","showDate":true,"variants":{"latest":{"layout":"slider","density":3,"showDots":true,"showArrows":false},"series":{"layout":"slider","columns":1,"showArrows":true},"popular":{"layout":"grid","columns":3},"categories":{"layout":"list","columns":1}},"showImage":true,"showTitle":true,"titleBold":true,"seriesCard":{"seriesBold":true,"showSeries":true,"detailsBold":false,"showDetails":true,"descriptionBold":false,"seriesAlignment":"right","showDescription":false,"detailsAlignment":"left","descriptionAlignment":"right"},"articleCard":{"dateBold":false,"showDate":true,"showTitle":true,"titleBold":false,"excerptBold":false,"showExcerpt":false,"dateAlignment":"right","titleAlignment":"right","excerptAlignment":"right"},"eyebrowBold":false,"showExcerpt":false,"showEyebrow":true,"categoryCard":{"countBold":false,"showCount":true,"categoryBold":false,"showCategory":true,"countAlignment":"left","categoryAlignment":"right"},"emptyBehavior":"hide","titleAlignment":"right","eyebrowAlignment":"right"}},"description":"الأكثر قراءة"},{"id":4,"name":"سلاسل المحتوى","slug":"topics-feed-series","feed_type":"series","status":"published","config":{"query":{"limit":20,"seriesSlugs":[],"categorySlugs":[]},"presentation":{"title":"سلاسل المحتوى","eyebrow":"Series","linkText":"عرض كل الموضوعات","showDate":false,"variants":{"latest":{"layout":"slider","density":3,"showDots":true,"showArrows":false},"series":{"layout":"slider","columns":1,"showArrows":true},"popular":{"layout":"list","columns":1},"categories":{"layout":"list","columns":1}},"showImage":true,"showTitle":true,"titleBold":true,"seriesCard":{"seriesBold":true,"showSeries":true,"detailsBold":false,"showDetails":true,"descriptionBold":false,"seriesAlignment":"right","showDescription":true,"detailsAlignment":"left","descriptionAlignment":"right"},"articleCard":{"dateBold":false,"showDate":true,"showTitle":true,"titleBold":false,"excerptBold":false,"showExcerpt":false,"dateAlignment":"right","titleAlignment":"right","excerptAlignment":"right"},"eyebrowBold":false,"showExcerpt":true,"showEyebrow":true,"categoryCard":{"countBold":false,"showCount":true,"categoryBold":false,"showCategory":true,"countAlignment":"left","categoryAlignment":"right"},"emptyBehavior":"hide","titleAlignment":"right","eyebrowAlignment":"right"}},"description":"سلاسل المحتوى"},{"id":5,"name":"E2E Test Feed Widget","slug":"e2e-test-feed-widget","feed_type":"latest","status":"published","config":{"query":{"limit":5,"seriesSlug":null,"categorySlugs":["topics","bait-al-watan","media-center"]},"presentation":{"title":"اختبار Feed — أحدث","eyebrow":"يششرشر","linkText":null,"showDate":true,"showImage":true,"showTitle":true,"titleBold":true,"eyebrowBold":false,"showExcerpt":true,"showEyebrow":true,"emptyBehavior":"hide","titleAlignment":"right","eyebrowAlignment":"right"}},"description":"اختبار عملي: category + series filters"}];
const feedActualFilterRows={"categories":[{"id":1313,"name":"اختبار تصنيف اختبار","slug":"akhtbar-tsnyf","parent_id":null,"sort_order":0,"is_active":true,"status":"published"},{"id":1,"name":"اعرف السوق","slug":"know-the-market","parent_id":3,"sort_order":0,"is_active":true,"status":"published"},{"id":2,"name":"بيت الوطن","slug":"bait-al-watan","parent_id":3,"sort_order":0,"is_active":true,"status":"published"},{"id":3,"name":"موضوعات تهمك","slug":"topics","parent_id":null,"sort_order":0,"is_active":true,"status":"published"},{"id":17,"name":"الأخبار","slug":"media-news","parent_id":16,"sort_order":1,"is_active":true,"status":"published"},{"id":18,"name":"من أرض التنفيذ","slug":"media-site-updates","parent_id":16,"sort_order":2,"is_active":true,"status":"published"},{"id":19,"name":"الفيديوهات","slug":"media-videos","parent_id":16,"sort_order":3,"is_active":true,"status":"published"},{"id":20,"name":"البيانات الصحفية","slug":"media-press","parent_id":16,"sort_order":4,"is_active":true,"status":"published"},{"id":21,"name":"معرض الصور","slug":"media-gallery","parent_id":16,"sort_order":5,"is_active":true,"status":"published"},{"id":16,"name":"المركز الإعلامي","slug":"media-center","parent_id":null,"sort_order":20,"is_active":true,"status":"published"}],"series":[{"id":187,"name":"أحياء بيت الوطن بالتفصيل","slug":"ahya-byt-alwtn-baltfsyl","category_id":2},{"id":197,"name":"أخطاء الشراء في بيت الوطن","slug":"akhta-alshra-fy-byt-alwtn","category_id":2},{"id":205,"name":"أسئلة شائعة عن بيت الوطن","slug":"aselh-shaeah-an-byt-alwtn","category_id":2},{"id":189,"name":"أسعار بيت الوطن","slug":"asaar-byt-alwtn","category_id":2},{"id":201,"name":"الأرضي بجاردن أم الدور المتكرر","slug":"alardy-bgardn-am-aldwr-almtkrr","category_id":2},{"id":191,"name":"الاستثمار في بيت الوطن","slug":"alastthmar-fy-byt-alwtn","category_id":2},{"id":193,"name":"الخدمات والمرافق في بيت الوطن","slug":"alkhdmat-walmrafq-fy-byt-alwtn","category_id":2},{"id":186,"name":"الدليل الشامل لبيت الوطن","slug":"aldlyl-alshaml-lbyt-alwtn","category_id":2},{"id":196,"name":"السكن في بيت الوطن","slug":"alskn-fy-byt-alwtn","category_id":2},{"id":203,"name":"العقود والتراخيص في بيت الوطن","slug":"alaqwd-waltrakhys-fy-byt-alwtn","category_id":2},{"id":192,"name":"بيت الوطن أم؟","slug":"byt-alwtn-am","category_id":2},{"id":202,"name":"جاهز للاستلام أم تحت الإنشاء","slug":"gahz-llastlam-am-tht-alensha","category_id":2},{"id":204,"name":"دليل المستثمر في بيت الوطن","slug":"dlyl-almstthmr-fy-byt-alwtn","category_id":2},{"id":206,"name":"سلسلة للاختبار","slug":"slslh-llakhtbar","category_id":1313},{"id":190,"name":"شراء شقة في بيت الوطن","slug":"shra-shqh-fy-byt-alwtn","category_id":2},{"id":194,"name":"طرق ومحاور ومواصلات بيت الوطن","slug":"trq-wmhawr-wmwaslat-byt-alwtn","category_id":2},{"id":199,"name":"كيف تختار المطور العقاري في بيت الوطن","slug":"kyf-tkhtar-almtwr-alaqary-fy-byt-alwtn","category_id":2},{"id":198,"name":"كيف تختار مشروعك في بيت الوطن","slug":"kyf-tkhtar-mshrwak-fy-byt-alwtn","category_id":2},{"id":195,"name":"مستقبل بيت الوطن","slug":"mstqbl-byt-alwtn","category_id":2},{"id":188,"name":"مقارنات أحياء بيت الوطن","slug":"mqarnat-ahya-byt-alwtn","category_id":2},{"id":200,"name":"وحدات ومساحات بيت الوطن","slug":"whdat-wmsahat-byt-alwtn","category_id":2}]};
let feedFilterOptions;
const feedContract=await jiti.import('../src/lib/feed-modules/parse-feed-config.ts'),feedTypes=await jiti.import('../src/lib/feed-modules/types.ts');
const feedActions=await readFile('src/app/admin/pages-blocks/blocks/feed/actions.ts','utf8'),feedAst=ts.createSourceFile('feed-actions.ts',feedActions,ts.ScriptTarget.Latest,true);
const feedPureNames=new Set(['readFeedType','sanitizeFeedModuleConfig']);const feedPure=feedAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&feedPureNames.has(n.name?.text));assert.equal(feedPure.length,2);
const filterSource=await readFile('src/lib/feed-modules/load-topic-filter-options.ts','utf8'),filterAst=ts.createSourceFile('feed-filters.ts',filterSource,ts.ScriptTarget.Latest,true);
const filterPureNames=new Set(['loadTopicFilterOptionsForAdmin','getSeriesOptionsForCategories','filterSeriesSlugsForCategories']);const filterPure=filterAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&filterPureNames.has(n.name?.text));assert.equal(filterPure.length,3);
const categoryTreeOwner=await jiti.import('../src/lib/admin/content/category-hierarchy.ts');
const filterExports={};new Function('exports','getSupabaseAdmin','logError','buildAdminCategoryTree','flattenAdminCategoryTree',ts.transpileModule(filterPure.map(n=>n.getText(filterAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(filterExports,()=>({from(table){assert.ok(['topic_categories','topic_series'].includes(table));const data=table==='topic_categories'?feedActualFilterRows.categories:feedActualFilterRows.series;const query={select:()=>query,eq:()=>query,is:()=>query,order:()=>query,not:()=>query,then:(resolve,reject)=>Promise.resolve({data,error:null}).then(resolve,reject)};return query;}}),message=>{throw Error(message);},categoryTreeOwner.buildAdminCategoryTree,categoryTreeOwner.flattenAdminCategoryTree);
feedFilterOptions=await filterExports.loadTopicFilterOptionsForAdmin();const feedActualFilterOptions=structuredClone(feedFilterOptions);
const feedPureCode=ts.transpileModule(feedPure.map(n=>n.getText(feedAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const feedSaveOwners=new Function('cleanText','TOPICS_FEED_TYPES','loadTopicFilterOptionsForAdmin','filterSeriesSlugsForCategories',feedPureCode+'\nreturn {readFeedType,sanitizeFeedModuleConfig};')(cleanText,feedTypes.TOPICS_FEED_TYPES,async()=>feedFilterOptions,filterExports.filterSeriesSlugsForCategories);
const saveFeedConfig=async data=>{const type=feedSaveOwners.readFeedType(data.get('feed_type'));assert.ok(type,'Actual Feed type parser rejects invalid kind');return feedSaveOwners.sanitizeFeedModuleConfig(feedContract.buildFeedModuleConfig(data,type));};
const feedBaselineRoot=process.env.FEED_QA_BASELINE_ROOT;if(feedFamilyOnly&&baseline)assert.ok(feedBaselineRoot,'Feed before requires original source directory');
const ctaActionSource=await readFile('src/app/admin/pages-blocks/blocks/cta/actions.ts','utf8');
const ctaActionAst=ts.createSourceFile('cta-actions.ts',ctaActionSource,ts.ScriptTarget.Latest,true),ctaBuilderNames=new Set(['buildCtaLink','buildCtaConfig']);
const ctaBuilders=ctaActionAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&ctaBuilderNames.has(n.name?.text));assert.equal(ctaBuilders.length,2);
const ctaBuilderCode=ts.transpileModule(ctaBuilders.map(n=>n.getText(ctaActionAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const saveCtaConfig=new Function('cleanText','linkFieldFromFormData','hasSavedLinkField','buildPageBlockTextFormattingPatch',ctaBuilderCode+'\nreturn buildCtaConfig;')(cleanText,linkFieldFromFormData,hasSavedLinkField,buildPageBlockTextFormattingPatch);
const cardsActionSource=await readFile('src/app/admin/pages-blocks/blocks/cards/actions.ts','utf8');
const cardsActionAst=ts.createSourceFile('cards-actions.ts',cardsActionSource,ts.ScriptTarget.Latest,true),cardsBuilderNames=new Set(['buildCardsItems','assertValidCardsItems','buildCardsConfig']);
const cardsBuilders=cardsActionAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&cardsBuilderNames.has(n.name?.text));assert.equal(cardsBuilders.length,3);
const cardsBuilderCode=ts.transpileModule(cardsBuilders.map(n=>n.getText(cardsActionAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const saveCardsConfig=new Function('cleanText','parseNumber','linkFieldFromFormData','hasSavedLinkField','buildPageBlockTextFormattingPatch',cardsBuilderCode+'\nreturn buildCardsConfig;')(cleanText,parseNumber,linkFieldFromFormData,hasSavedLinkField,buildPageBlockTextFormattingPatch);
const cardsPublicResolver=cardsFamilyOnly?await createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{'server-only':path.join(root,'node_modules/next/dist/compiled/server-only/empty.js')}}).import('../src/lib/admin/links/block-config-links.ts'):null;
const cardsBaselineRoot=process.env.CARDS_QA_BASELINE_ROOT;
if(cardsFamilyOnly&&baseline)assert.ok(cardsBaselineRoot,'Before rendering requires explicitly captured original source directory');
const ctaPublicResolver=ctaFamilyOnly?await createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{'server-only':path.join(root,'node_modules/next/dist/compiled/server-only/empty.js')}}).import('../src/lib/admin/links/block-config-links.ts'):null;

const mediaHubActionSource=await readFile('src/app/admin/pages-blocks/blocks/media-hub/actions.ts','utf8');
const mediaHubActionAst=ts.createSourceFile('media-hub-actions.ts',mediaHubActionSource,ts.ScriptTarget.Latest,true);
const mediaHubUpdate=mediaHubActionAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='updateMediaHubModule');
const mediaHubWrite=mediaHubUpdate.body.statements.findIndex(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(mediaHubActionAst)==='coordinated'));
assert.ok(mediaHubWrite>0);
const mediaHubPure=ts.transpileModule(mediaHubUpdate.body.statements.slice(0,mediaHubWrite).map(n=>n.getText(mediaHubActionAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const {getContentTypeLabel,MEDIA_EDITABLE_CONTENT_TYPES}=await jiti.import('../src/lib/admin/content/content-types.ts');
const mediaSidebarContract=await jiti.import('../src/lib/media-sidebar-modules/parse-config.ts');
const mediaSidebarLabels=await jiti.import('../src/lib/media-sidebar-modules/admin-present.ts');
const displaySaveOwners={};
const displayFixtureFields=[['title','show_title_on_page'],['image','show_image_on_page'],['category','show_category_on_page'],['series','show_series_on_page'],['excerpt','show_excerpt_on_page'],['date','show_date_on_page'],['introCard','show_intro_card_on_page']];
if(mediaSidebarOnly)for(const kind of ['article','media']){
  const file='src/app/admin/content/topics/'+kind+'-actions/helpers.ts',input=await readFile(file,'utf8'),tree=ts.createSourceFile(file,input,ts.ScriptTarget.Latest,true);
  const booleanOwner=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getBoolean');assert.ok(booleanOwner);
  const payload=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getPayload').getText(tree);
  for(const [,name]of displayFixtureFields)assert.ok(payload.includes('getBoolean(formData, "'+name+'")'),'Actual '+kind+' payload owns '+name);
  const ownerExports={};new Function('exports',ts.transpileModule(booleanOwner.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(ownerExports);
  displaySaveOwners[kind]=data=>Object.fromEntries(displayFixtureFields.map(([key,name])=>[key,ownerExports.getBoolean(data,name)]));
}
const featuredContract=await jiti.import('../src/lib/featured-modules/config.ts');
const featuredProfiles=await jiti.import('../src/lib/featured-modules/contract.ts');
const mediaHubContract=await jiti.import('../src/lib/media-hub-modules/parse-config.ts');
const mediaHubViews=await jiti.import('../src/lib/media-hub-modules/presentation-contract.ts');
const mediaHubFormatting=await jiti.import('../src/lib/page-blocks/configs.ts');
const {parseFormStatus}=await jiti.import('../src/lib/page-blocks/admin-utils.ts');
const saveMediaHub=new Function('owners','const {requireAdminSession,cleanText,parseNumber,parseFormStatus,parseMediaHubSectionKey,buildMediaHubModuleConfig,buildMediaHubContentHierarchy,buildMediaHubCollectionView,buildPageBlockTextFormattingPatch,buildCollectionModuleDisplayFormattingFromFormData}=owners;return async function(formData){'+mediaHubPure+'\nreturn {id,...nextRow};}')({...mediaHubContract,...mediaHubViews,...mediaHubFormatting,cleanText,parseNumber,parseFormStatus,requireAdminSession:async()=>({id:'isolated-actor'})});

const initial={eyebrow:'FROM VISION TO EXECUTION',title:'كل وعد يجب أن يسبقه استعداد ويتبعه تنفيذ.',body:'<p><strong>فينيسيا للتطوير العقاري</strong> شركة مساهمة مصرية.</p><p>بدأت رحلتها برؤية واضحة.<br>نبني الثقة على أرض الواقع.</p><p>*حرفي* &lt;tag&gt;</p>',images:{main:'/one.svg',secondary:'/two.svg',mainAlt:'وصف الصورة الأولى',secondaryAlt:'وصف الصورة الثانية'},showEyebrow:true,showTitle:true,showDescription:true,eyebrowBold:true,titleBold:true,descriptionBold:false,eyebrowAlignment:'right',titleAlignment:'right',descriptionAlignment:'right',button:{label:'عن فينيسيا للتطوير العقاري',href:'/about',link:{link_kind:'static_route',linked_type:'static_routes',href:'/about',meta:{route_key:'about'},anchor:'team',target:'_self'},target:'_self',alignment:'left',icon:'arrow',iconPosition:'right'}};
let saved=structuredClone(initial),savedName='من نحن',saves=0,referenceStatus='active',omitDimensions=false;
const consumerTree=ts.createSourceFile('ContentModuleEditClient.tsx',await readFile('src/components/admin/page-blocks/ContentModuleEditClient.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let storyTabs,aboutTabs,trustTabs,contactTabs,aboutCtaTabs;
const findTabs=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(consumerTree)==='homeStoryTabs')storyTabs=node.initializer;if(ts.isVariableDeclaration(node)&&node.name.getText(consumerTree)==='aboutIntroTabs')aboutTabs=node.initializer;if(ts.isVariableDeclaration(node)&&node.name.getText(consumerTree)==='homeTrustTabs')trustTabs=node.initializer;if(ts.isVariableDeclaration(node)&&node.name.getText(consumerTree)==="homeContactTabs")contactTabs=node.initializer;if(ts.isVariableDeclaration(node)&&node.name.getText(consumerTree)==="aboutCtaTabs")aboutCtaTabs=node.initializer;ts.forEachChild(node,findTabs);};findTabs(consumerTree);
assert.ok(storyTabs&&ts.isConditionalExpression(storyTabs)&&ts.isArrayLiteralExpression(storyTabs.whenTrue));
const headerPresentations={};
for(const tab of storyTabs.whenTrue.elements){if(!ts.isObjectLiteralExpression(tab))continue;const properties=Object.fromEntries(tab.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(consumerTree),p.initializer]));const raw=properties.sectionHeaderPresentation,presentation=raw&&ts.isAsExpression(raw)?raw.expression:raw;if(presentation){assert.ok(ts.isStringLiteral(properties.id)&&ts.isStringLiteral(presentation));headerPresentations[properties.id.text]=presentation.text;}}
assert.equal(headerPresentations.pages,'control');
const assignmentSource=await readFile('src/lib/page-blocks/sync-module-page-assignments.ts','utf8');
const assignmentAst=ts.createSourceFile('sync.ts',assignmentSource,ts.ScriptTarget.Latest,true);
const parseNode=assignmentAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='parsePageIdsFromForm');
assert.ok(parseNode);
const parseExports={};new Function('exports',ts.transpileModule(parseNode.getText(assignmentAst),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(parseExports);
const parsePageIds=parseExports.parsePageIdsFromForm;
const fixturePages=[['الرئيسية','/'],['من نحن','/about'],['موضوعات تهمك','/topics'],['تواصل معنا','/contact'],['المشروعات','/projects'],['البحث','/search'],['المركز الإعلامي','/media-center'],['المركز الإعلامي — الأخبار','/media-center/news'],['المركز الإعلامي — الصحافة','/media-center/press'],['المركز الإعلامي — تحديثات الموقع','/media-center/site-updates'],['المركز الإعلامي — الفيديوهات','/media-center/videos'],['المركز الإعلامي — معرض الصور','/media-center/gallery']].map(([title,path],index)=>({id:index+1,title,path,slug:path}));
const ctaFixturePages=[[2,'من نحن','/about'],[4,'موضوعات تهمك','/topics'],[5,'تواصل معنا','/contact'],[24,'تابع مشروعك','/track-your-project']].map(([id,title,path])=>({id,title,path,slug:path}));
let savedPageIds=[1];
const assignmentContext=()=>{if(heroFamilyOnly)return {pages:heroFixture.pages,assignments:savedPageIds.map(page_id=>{const actual=heroFixture.assignments.find(a=>a.hero_id===saved.block.id&&a.target_id===page_id),p=heroFixture.pages.find(p=>p.id===page_id);return {id:actual?.id??1000+page_id,page_id,template_id:saved.block.id,slot:'hero',sort_order:actual?.priority??100,is_visible:actual?.is_active??true,page_title:p.title,page_slug:p.slug,page_path:p.path,region_admin_label:null};})};if(searchFamilyOnly)return {pages:searchFixture.pages,assignments:savedPageIds.map(page_id=>{const actual=searchFixture.assignments.find(a=>a.template_id===saved.block.id&&a.page_id===page_id),p=searchFixture.pages.find(p=>p.id===page_id);return actual||{id:1000+page_id,page_id,template_id:saved.block.id,slot:'main',sort_order:10,is_visible:true,page_title:p.title,page_slug:p.slug,page_path:p.path};})};const pages=ctaFamilyOnly||cardsFamilyOnly||feedFamilyOnly?ctaFixturePages:fixturePages;return {pages,assignments:savedPageIds.map(id=>{const p=pages.find(p=>p.id===id);return {id:100+id,page_id:id,template_id:ctaFamilyOnly||cardsFamilyOnly||feedFamilyOnly?saved.block?.id:25,slot:feedFamilyOnly?'sidebar':ctaFamilyOnly?(id===4?'sidebar':'bottom'):'main',sort_order:cardsFamilyOnly?({3:10,4:50,5:60,6:70}[saved.block?.id]??1):1,is_visible:cardsFamilyOnly?saved.block?.id!==5:true,page_title:p.title,page_slug:p.slug,page_path:p.path,region_admin_label:ctaFamilyOnly?'موضع الموديول':'المحتوى الرئيسي'};})};};
const defaultAssignmentRowClass="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-sm text-white/72 transition hover:border-white/16 hover:bg-white/[0.04] has-[input:checked]:border-[#D8B87A]/38 has-[input:checked]:bg-[#D8B87A]/[0.055]";
assert.ok(aboutTabs&&ts.isConditionalExpression(aboutTabs));
const aboutTabExpression=aboutTabs.whenTrue.getText(consumerTree);
assert.ok(trustTabs&&ts.isConditionalExpression(trustTabs));
const trustTabExpression=trustTabs.whenTrue.getText(consumerTree);
assert.ok(contactTabs&&ts.isConditionalExpression(contactTabs)&&aboutCtaTabs&&ts.isConditionalExpression(aboutCtaTabs));
const contactTabExpression=contactTabs.whenTrue.getText(consumerTree),aboutCtaTabExpression=aboutCtaTabs.whenTrue.getText(consumerTree);
const galleryConsumerCall=async file=>{const text=await readFile(file,'utf8'),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),matches=[];const visit=node=>{if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==='AdminMediaGalleryField')matches.push(node.getText(tree));ts.forEachChild(node,visit);};visit(tree);assert.equal(matches.length,1);return matches[0];};
const galleryItemsCall=await galleryConsumerCall('src/components/admin/content/editors/media/MediaContentForm.tsx'),galleryPathsCall=await galleryConsumerCall('src/components/admin/projects/tracking/TrackingForms.tsx');
const project=root.replaceAll('\\','/');
const source=`import React,{useLayoutEffect}from'react';import{createRoot}from'react-dom/client';
import Editor from '${project}/src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx';
import ContactEditor from '${project}/src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx';
import ContactSection from '${project}/src/components/home/HomeContactSection.tsx';
import {mapHomeContactBlock} from '${project}/src/components/home/home-contact-mappers.ts';
import PrinciplesEditor from '${project}/src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx';
import {AdminFormGrid} from '${project}/src/components/admin/ui/AdminFormRuntime.tsx';
import VisionEditor from '${project}/src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx';
import AboutSection from '${project}/src/components/modules/WhoWeAreModuleSection.tsx';
import {mapAboutIntroBlock,mapAboutIntroBeatsFromBlock} from '${project}/src/components/about/about-cms-mappers.ts';
import TrustSection from '${project}/src/components/home/HomeTrustSection.tsx';
import {mapHomeTrustBlock} from '${project}/src/components/home/home-trust-mappers.ts';
import Section from '${project}/src/components/home/HomeStorySection.tsx';
import{mapHomeStoryBlock}from'${project}/src/components/home/home-cms-mappers.ts';
import{ModuleEditorHeader,ModuleEditorIdentitySection,ModuleEditorTabs,ModuleEditorSaveArea,ModuleEditorPagesTab,ModuleEditorRepeaterCard,ModuleEditorRepeaterGrid}from'${project}/src/components/admin/page-blocks/ModuleEditorPresentation.tsx';
import FeaturedEditor from 'E:/web/venisia/src/components/admin/page-blocks/FeaturedModuleEditClient.tsx';
import FeaturedSection from 'E:/web/venisia/src/components/featured/FeaturedModuleSection.tsx';
import {resolveFeaturedItems} from 'E:/web/venisia/src/lib/featured-modules/resolve-featured-items.ts';
import MediaHubEditor from 'E:/web/venisia/src/components/admin/page-blocks/MediaHubModuleEditClient.tsx';
import MediaSidebarEditor from '${project}/src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx';
import CtaFamilyEditor from '${project}/src/components/admin/page-blocks/CtaModuleEditClient.tsx';
import CardsFamilyEditor from '${project}/src/components/admin/page-blocks/CardsModuleEditClient.tsx';
import FeedFamilyEditor from '${project}/src/components/admin/page-blocks/FeedModuleEditClient.tsx';
import SearchFamilyEditor from '${project}/src/components/admin/page-blocks/ContentModuleEditClient.tsx';
import HeroDefaultCta from '${project}/src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx';
import HeroDefaultOrder from '${project}/src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx';
import ProjectsHubHeroEditor from '${project}/src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx';
import {asProjectsHubHeroConfig} from '${project}/src/lib/page-blocks/projects-hub-config.ts';
import HeroFamilyEditor from '${project}/src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx';
import HeroPublic from '${project}/src/components/sections/DynamicHeroSection.tsx';
import ProjectHeroPublic from '${project}/src/components/projects/details/ProjectDetailsHero.tsx';
import {getHeroConfig as heroConfigForPublic} from '${project}/src/lib/page-sections.ts';
import {HERO_TEMPLATE_VARIANT_OPTIONS_AR} from '${project}/src/lib/hero/hero-content-controls.ts';
import SearchPublic from '${project}/src/components/search-platform/SearchPlatformModule.tsx';
import FeedSection from '${project}/src/components/feed-modules/FeedModuleSection.tsx';
import CardsItems from '${project}/src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx';
import GenericCards from '${project}/src/components/sections/CardsSection.tsx';
import AboutPrinciplesPublic from '${project}/src/components/modules/AboutPrinciplesModuleSection.tsx';
import {mapLegacyPrinciplesCardsBlock} from '${project}/src/components/modules/about-principles-mappers.ts';
import ContactTrustPublic from '${project}/src/components/contact/ContactFloatingTrustCards.tsx';
import ContactReasonsPublic from '${project}/src/components/contact/ContactReasonsSection.tsx';
import ContactDepartmentsPublic from '${project}/src/components/contact/ContactDepartmentsSection.tsx';
import ContactFaqPublic from '${project}/src/components/contact/ContactFAQSection.tsx';
import {mapContactTrustCardsBlock,mapContactReasonsBlock,mapContactDepartmentsBlock,mapContactFaqBlock} from '${project}/src/components/contact/contact-cms-mappers.ts';
import GenericCtaSection from '${project}/src/components/sections/CtaSection.tsx';
import AboutCtaPublic from '${project}/src/components/modules/AboutCtaModuleSection.tsx';
import {mapLegacyProjectsCtaBlock,mapAboutCtaBlock} from '${project}/src/components/modules/about-cta-mappers.ts';
import TopicsCtaPublic from '${project}/src/components/topics/TopicsInsightCtaSection.tsx';
import {mapTopicsInsightCtaBlock} from '${project}/src/components/topics/topics-cms-mappers.ts';
import ContactCtaPublic from '${project}/src/components/contact/ContactCTASection.tsx';
import {mapContactCtaBlock} from '${project}/src/components/contact/contact-cms-mappers.ts';
import ContentDisplaySettings from '${project}/src/components/admin/content/editors/ContentDisplaySettings.tsx';
import TopicsEditor from 'E:/web/venisia/src/components/admin/page-blocks/editors/TopicsListingModuleEditor.tsx';
import TopicFormSwitch from '${project}/src/components/admin/content/editors/article/TopicFormSwitch.tsx';
import Feedback from'${project}/src/components/admin/AdminFeedbackProvider.tsx';
import Media from'${project}/src/components/admin/media/AdminMediaImageField.tsx';
import AdminMediaGalleryField from'${project}/src/components/admin/media/AdminMediaGalleryField.tsx';
import {mediaContentSlot} from'${project}/src/lib/media-center/detail-page-config.ts';
import {TRACKING_MEDIA_SLOT} from'${project}/src/lib/projects/tracking/contract.ts';
import LinkField from'${project}/src/components/admin/ui/AdminLinkField.tsx';
import AdminModuleTabs from'${project}/src/components/admin/ui/AdminModuleTabs.tsx';
import {adminChoiceButtonClassName} from'${project}/src/lib/admin/admin-ui-styles.ts';
import RichTextContent from'${project}/src/components/content/RichTextContent.tsx';
import{SearchParamsContext,PathnameContext}from'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import{AppRouterContext}from'next/dist/shared/lib/app-router-context.shared-runtime.js';
const noNavigation=()=>{throw Error('Unexpected navigation in isolated fixture')};const searchNavigation=(method,args)=>{if(!window.searchFixtureActive)return noNavigation();window.searchNavigations.push({method,href:args[0]});};
const router={back:noNavigation,forward:noNavigation,prefetch:async()=>{},refresh:noNavigation,push:(...args)=>searchNavigation("push",args),replace:(...args)=>searchNavigation("replace",args)};
const root=createRoot(document.getElementById('root'));let generation=0;
window.showHeroPublic=async(data)=>{const config=await window.resolveHeroLinks(data.config);window.mount('hero-public',{...data,config});};window.showSearchPublic=async(data)=>{window.searchFixtureActive=true;window.searchReadRequests=[];window.searchNavigations=[];window.searchPublicElement=await SearchPublic({block:{blockType:'content',template:{config:data.config}},publicPath:data.path,searchParams:data.params||{}});window.mount('search-public',data);};window.showFeedPublic=async(data)=>{window.feedReadRequests=[];const payload=await window.resolveFeed(data);window.feedResolved=payload;window.mount('feed-public',{assignmentId:1,templateId:1,sortOrder:1,feedType:data.type,presentation:data.config.presentation,payload});};window.showFeaturedPublic=async(config=window.initialConfig.config)=>{window.featuredReadRequests=[];const items=await resolveFeaturedItems(config);window.featuredResolvedIds=items.map(item=>item.id);window.mount('featured-public',{...config,assignmentId:1,templateId:2,sortOrder:1,items});};function Ready(){useLayoutEffect(()=>{window.ready=true});return null;}
window.mount=(mode='editor',config=window.initialConfig)=>{const galleryDefaults=config.items||[],update={media:(config.paths||[]).map(public_url=>({public_url,media_kind:'image'}))};const AboutIntroModuleEditor=Editor,AboutPrinciplesModuleEditor=PrinciplesEditor,AboutCtaModuleEditor=ContactEditor,homeContactConfig=config,block={name:window.initialName},assignmentContext=window.assignmentContext,pagesTab={id:"pages",content:<ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext}/>};window.ready=false;root.render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)} key={++generation}><AppRouterContext.Provider value={router}><PathnameContext.Provider value={mode==="hero-family"?"/admin/pages-blocks/blocks/hero/"+config.block.id:mode==="search-family"?"/admin/pages-blocks/blocks/content/"+config.block.id:mode==="search-public"?config.path:mode==="featured"?"/admin/pages-blocks/blocks/featured/2":mode==="media-hub"?"/admin/pages-blocks/blocks/media-hub/11":mode==="media-sidebar"?"/admin/pages-blocks/blocks/media-sidebar/"+config.id:mode==="feed-family"?"/admin/pages-blocks/blocks/feed/"+config.block.id:mode==="cards-family"?"/admin/pages-blocks/blocks/cards/"+config.block.id:mode==="cta-family"?"/admin/pages-blocks/blocks/cta/"+config.block.id:mode.startsWith("contact")?"/admin/pages-blocks/blocks/content/27":mode.startsWith("trust")?"/admin/pages-blocks/blocks/content/26":"/admin/pages-blocks/blocks/content/25"}><Feedback><Ready/>{mode==="hero-family"?<HeroFamilyEditor hero={config.block} config={config.config} imagesText={Array.isArray(config.config.images)?config.config.images.join('\\n'):''} mobileImagesText={Array.isArray(config.config.mobileImages??config.config.mobile_images)?(config.config.mobileImages??config.config.mobile_images).join('\\n'):''} variantOptions={HERO_TEMPLATE_VARIANT_OPTIONS_AR} assignmentContext={assignmentContext} initialTabId={new URLSearchParams(location.search).get('tab')||undefined}/>:mode==="hero-public"?(config.block.variant==="project-detail"?<ProjectHeroPublic project={${JSON.stringify(heroFixtureProject)}} presentation={heroConfigForPublic({...config.block,config:config.config})}/>:<HeroPublic hero={{...config.block,config:config.config}} domainSlides={config.domainSlides}/>):mode==="search-family"?<SearchFamilyEditor block={config.block} config={config.config} assignmentContext={assignmentContext} projectDetailHeroEditorLinks={null} topicCategoryOptions={[]} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="search-public"?window.searchPublicElement:mode==="feed-public"?<div className="@container/slot-module"><FeedSection module={config}/></div>:mode==="feed-family"?<FeedFamilyEditor block={config.block} config={config.config} filterOptions={window.feedFilterOptions} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="cards-public"?<div className="@container/slot-module">{config.renderer==="about"?<AboutPrinciplesPublic cmsContent={mapLegacyPrinciplesCardsBlock({template:{config:config.value}})}/>:config.renderer==="trust"?<ContactTrustPublic cmsCards={mapContactTrustCardsBlock({template:{config:config.value}})}/>:config.renderer==="reasons"?<ContactReasonsPublic cmsContent={mapContactReasonsBlock({template:{config:config.value}})}/>:config.renderer==="departments"?<ContactDepartmentsPublic cmsContent={mapContactDepartmentsBlock({template:{config:config.value}})}/>:config.renderer==="faq"?<ContactFaqPublic cmsContent={mapContactFaqBlock({template:{config:config.value}})}/>:<GenericCards block={{template:{config:config.value,variant:"glass"}}}/>}</div>:mode==="cards-family"?<CardsFamilyEditor block={config.block} config={config.config} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="cta-public"?<div className="@container/slot-module">{config.renderer==="generic"?<GenericCtaSection block={{template:{config:config.value,variant:"band"}}}/>:config.renderer==="about"?<AboutCtaPublic cmsContent={mapLegacyProjectsCtaBlock({template:{config:config.value}})}/>:config.renderer==="about-default"?<AboutCtaPublic cmsContent={mapAboutCtaBlock({template:{config:config.value}})}/>:config.renderer==="topics"?<TopicsCtaPublic cmsContent={mapTopicsInsightCtaBlock({template:{config:config.value}})}/>:config.renderer==="topics-default"?<TopicsCtaPublic/>:<ContactCtaPublic cmsContent={mapContactCtaBlock({template:{config:config.value}})}/>}</div>:mode==="featured-public"?<div className="@container/slot-module"><FeaturedSection module={config}/></div>:mode==="featured"?<FeaturedEditor block={config.block} config={config.config} editorOptions={config.editorOptions} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="cta-family"?<CtaFamilyEditor block={config.block} config={config.config} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="media-sidebar"?<MediaSidebarEditor block={config} categories={[{slug:"fixtures",name:"تصنيف تجريبي",depth:0},{slug:"fixtures-child",name:"تصنيف فرعي",depth:1}]} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="media-hub"?<MediaHubEditor block={config} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==='contact-public'?<div className="@container/slot-module"><ContactSection content={mapHomeContactBlock({template:{config}})}/></div>:mode==='trust-public'?<div className="@container/slot-module"><TrustSection content={mapHomeTrustBlock({template:{config}})}/></div>:mode==='about-public'?<div className="@container/slot-module"><AboutSection cmsIntro={mapAboutIntroBlock({template:{config}})} cmsBeats={mapAboutIntroBeatsFromBlock({template:{config}})}/></div>:mode==='rich-default'?<RichTextContent value={config.body} mode="rich"/>:mode==='public'?<div className="@container/slot-module"><Section content={mapHomeStoryBlock({template:{config}})}/></div>:<><ModuleEditorHeader moduleKind="content" moduleSlug={mode.startsWith('contact')?'home-contact':mode==='about-cta-default'?'about-cta':mode.startsWith('trust')?'home-trust':mode.startsWith('about')?'about-intro':'home-story'} entityName={window.initialName}/><form dir="rtl" onSubmit={async e=>{e.preventDefault();const data=[...new FormData(e.currentTarget)];const result=mode.startsWith("display-default")?await window.persistDisplay(data,mode):await window.persist(data);window.saved=true;window.mount(mode.startsWith("display-default")||mode==='about-premium'||mode==='trust-premium'||mode==='contact-premium'||mode==='about-cta-default'?mode:'editor',result);}}>{mode==="hero-media-card-reference"?<Media name="media_reference" label="صورة مرجعية" defaultValue="/one.svg" altName="media_reference_alt" defaultAlt="وصف مرجعي محفوظ" focusTargetId="media-reference-replace" variant="card" showGuidance={false}/>:mode==="hero-gallery-bare"?<AdminMediaGalleryField name="bare_gallery" label="صور اختبار المظهر المجرد" defaultPaths={["/one.svg","/two.svg"]} actionPresentation="bare" density="compact" showGuidance={false}/>:mode==="hero-gallery-items"?${galleryItemsCall}:mode==="hero-gallery-paths"?${galleryPathsCall}:mode==="hero-default-hub"?<ProjectsHubHeroEditor config={asProjectsHubHeroConfig({})}/>:mode==="hero-default-cta"?<HeroDefaultCta linkSource="project-domain" primaryLabel="فتح المشروع"/>:mode==="hero-default-order"?<HeroDefaultOrder/>:mode==="feed-switch-default"?<><TopicFormSwitch name="default_compact" label="افتراضي مدمج" defaultChecked={config.checked}/><TopicFormSwitch name="default_surface" label="افتراضي بطاقة" defaultChecked={config.checked} surface/><TopicFormSwitch name="default_disabled" label="افتراضي معطل" defaultChecked={config.checked} disabled/></>:mode==="cards-create-default"?<CardsItems items={config.items||[]} minItems={1}/>:mode.startsWith("display-default")?<><ContentDisplaySettings showTitle={config.title} showImage={config.image} showCategory={config.category} showSeries={config.series} showExcerpt={config.excerpt} showDate={config.date} showIntroCard={config.introCard}><input name="fixture_child" aria-label="حقل تابع" defaultValue="قيمة محفوظة"/></ContentDisplaySettings><ModuleEditorSaveArea/></>:mode==="topics-default"?<TopicsEditor config={config} categoryOptions={[]}/>:mode==='contact-premium'||mode==='about-cta-default'?<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-cta"/><ModuleEditorTabs moduleKind="content" moduleSlug={mode==='contact-premium'?'home-contact':'about-cta'} nowrap tabs={mode==='contact-premium'?${contactTabExpression}:${aboutCtaTabExpression}}/><ModuleEditorSaveArea title="حفظ موديول التواصل"/></>:mode==='trust-premium'?<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-principles"/><ModuleEditorTabs moduleKind="content" moduleSlug="home-trust" nowrap tabs={${trustTabExpression}}/><ModuleEditorSaveArea title="حفظ موديول الثقة"/></>:mode==='about-premium'?<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-intro"/><ModuleEditorTabs moduleKind="content" moduleSlug="about-intro" nowrap tabs={${aboutTabExpression}}/><ModuleEditorSaveArea title="حفظ التعديلات"/></>:mode==='trust-grid'||mode==='principles-grid'?<PrinciplesEditor config={config} editorMode={mode==='trust-grid'?'home-trust':'about-principles'}/>:mode==='grid-contract'?<AdminFormGrid columns={config.columns} presentation={config.presentation}>{Array.from({length:12},(_,i)=><input key={i} aria-label={'حقل '+i} defaultValue={'بطاقة '+i}/>)}</AdminFormGrid>:mode==='metadata-tabs'?<ModuleEditorTabs moduleKind={config.kind} moduleSlug={config.slug} tabs={config.ids.map(id=>({id,content:<p>محتوى {id}</p>}))}/>:mode==='vision-default'?<VisionEditor config={{eyebrow:'رؤيتنا',title:'عنوان محفوظ',intro:['نص قديم محفوظ'],image:'/one.svg',vision:{title:'رؤيتنا',items:[{title:'الثقة',text:'نص الرؤية'}]},goals:{title:'أهدافنا',items:[{title:'الجودة',text:'نص الهدف'}]}}}/>:mode==='default-repeater'?<ModuleEditorRepeaterGrid>{[1,2,3].map(i=><ModuleEditorRepeaterCard key={i} title={'بطاقة '+i} actions={<button type="button">إجراء {i}</button>}><input aria-label={'حقل '+i} defaultValue="محفوظ"/></ModuleEditorRepeaterCard>)}</ModuleEditorRepeaterGrid>:mode==='default-pages'||mode==='empty-pages'?<ModuleEditorPagesTab moduleName="قصة فينيسيا" assignmentContext={mode==='empty-pages'?{pages:[],assignments:[]}:window.assignmentContext} presentation={mode==='empty-pages'?'premium':undefined}/>:mode==='default-tabs'?<AdminModuleTabs tabs={[{id:'default',navigationLabel:'افتراضي',sectionHeading:'عنوان افتراضي',sectionDescription:'وصف افتراضي',icon:'media',sectionSummary:<button type="button">إجراء افتراضي</button>,content:null}]}/>:mode==='default-link'?<><LinkField prefix="button" label="رابط الزر" defaultValue={config.button.link} showAnchor/><button type="button" className={adminChoiceButtonClassName(false)}>اختيار افتراضي</button><button type="button" disabled className={adminChoiceButtonClassName(true,"","compact")}>اختيار معطل</button></>:mode==='default-media'||mode==='compact-media'?<Media name="test_image" label="صورة افتراضية" defaultValue="/one.svg" altName="test_alt" defaultAlt="وصف ثابت" variant={mode==='compact-media'?'compact':'default'} showGuidance={false}/>:mode==='about'?<Editor config={config}/>:<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-intro"/><input type="hidden" name="include_story_cta" value="1"/><ModuleEditorTabs moduleKind="content" moduleSlug="home-story" nowrap tabs={['text','images','cta','pages'].map(id=>({id,sectionHeaderPresentation:${JSON.stringify(headerPresentations)}[id],content:id==='pages'?<ModuleEditorPagesTab moduleName="قصة فينيسيا" assignmentContext={window.assignmentContext} presentation="premium"/>:<Editor config={config} editorMode="home-story" section={id}/>}))}/><ModuleEditorSaveArea title="حفظ موديول القصة" description="يُحدّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."/></>}</form></>}</Feedback></PathnameContext.Provider></AppRouterContext.Provider></SearchParamsContext.Provider>)};window.mount(new URLSearchParams(location.search).get('mode')||window.fixtureDefaultMode||'editor');`;
const dataModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
let bundle;
const compiler = webpack({ mode: 'development', target: 'web', context: root, entry: dataModule(source),
  output: { path: path.join(root, '.tmp-qa/story-adoption'), filename: 'fixture.js' }, devtool: false,
  resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { 'server-only': false } },
  plugins: [
    ...(heroFamilyOnly?[new webpack.DefinePlugin({'process.env.__NEXT_IMAGE_OPTS':JSON.stringify({...require('next/dist/shared/lib/image-config').imageConfigDefault,...(await jiti.import('../next.config.ts')).default.images})})]:[]),
    new webpack.NormalModuleReplacementPlugin(/^\.\.\/actions$/, resource=>{if(path.resolve(resource.context)===path.join(root,'src/app/admin/pages-blocks/blocks/hero/[id]'))resource.request=dataModule("export async function updateHeroTemplateDetails(data){await window.persist([...data]);window.saved=true;await new Promise(()=>{});}");}),
    new webpack.NormalModuleReplacementPlugin(/content\/public-content-read\/owner$/, resource => {
      if(path.resolve(resource.context)===path.join(root,'src/components/search-platform')){resource.request=dataModule("export class PublicContentReadError extends Error {\n    code;\n    constructor(code, message) {\n        super(message);\n        this.name = \"PublicContentReadError\";\n        this.code = code;\n    }\n}\nexport async function loadPublicContentCollection(input){window.searchReadRequests.push({kind:'collection',input});return window.searchRead('collection',input);}export async function loadPublicContentFilterOptions(){window.searchReadRequests.push({kind:'filters'});return window.searchRead('filters',{});}");return;}if(path.resolve(resource.context)===path.join(root,'src/lib/feed-modules')){resource.request=dataModule('export async function loadPublicContentCollection(input){window.feedReadRequests.push({kind:"articles",input});return window.feedRead("articles",input);}export async function loadPublicContentFeedCategories(input){window.feedReadRequests.push({kind:"categories",input});return window.feedRead("categories",input);}export async function loadPublicContentFeedSeries(input){window.feedReadRequests.push({kind:"series",input});return window.feedRead("series",input);}');return;}if(path.resolve(resource.context)!==path.join(root,'src/lib/featured-modules'))return;
      resource.request=dataModule('export async function loadPublicContentCollection(input){window.featuredReadRequests.push(input);return window.featuredRead(input);}');
    }),
    new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$/, dataModule(`export async function browseAdminLinksAjax({type}){if(!['pages','static_routes'].includes(type))throw Error('Unrelated resource outside fixture');return window.qaLinkFailure?{ok:false,message:'تعذر تحميل الموارد التجريبية'}:{ok:true,results:[{id:type+':2',resourceId:2,resourceType:type,title:'من نحن',slug:'about',publicPath:'/about',meta:type==='static_routes'?{route_key:'about'}:undefined}]};}export async function resolveAdminLinkAjax(value){const pages=${JSON.stringify(heroFamilyOnly?heroFixture.pages:[])};const match=pages.find(p=>p.path===value.href||p.slug===value.meta?.route_key||p.id===value.linked_id);return {ok:true,display:{kind:value.link_kind,kindLabel:'صفحة',title:match?.title||'من نحن',publicPath:(match?.path||value.href||'/about')+(value.anchor?'#'+value.anchor:''),target:value.target||'_self'}};}export const browseTopicCategoriesPickerAjax=reject,browseMenusPickerAjax=reject,browseMenuItemsPickerAjax=reject;function reject(){throw Error('Unrelated network transport is outside this test')}`)),
    new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') }),
    { apply(c) { c.hooks.shouldEmit.tap('MemoryFixture', () => false);c.hooks.compilation.tap('MemoryFixture', compilation => {
      webpack.NormalModule.getCompilationHooks(compilation).readResource.for(undefined).tapPromise('MemoryFixture', async context => {
        if (/\.[jt]sx?$/.test(context.resourcePath) && !context.resourcePath.includes('node_modules')) {const relative=path.relative(root,context.resourcePath).replaceAll('\\','/');const beforePath=heroTargetBefore&&['src/lib/page-sections.ts','src/components/sections/DynamicHeroSection.tsx'].includes(relative)?path.join(heroTargetBaselineRoot,relative):heroFamilyOnly&&baseline&&(heroMediaActionsOnly?['src/components/admin/media/AdminMediaGalleryField.tsx','src/components/admin/media/AdminMediaImageField.tsx','src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx']:['src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx','src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx','src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx','src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx','src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx','src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx','src/components/admin/page-blocks/ContentModuleEditClient.tsx','src/components/admin/page-blocks/ModuleEditorPresentation.tsx','src/lib/page-composition/module-registry-metadata.ts']).includes(relative)?path.join(heroBaselineRoot,relative):searchFamilyOnly&&baseline&&(process.argv.includes('--search-choice-only')?['src/components/admin/page-blocks/editors/SearchPlatformModuleEditor.tsx','src/components/admin/ui/AdminCheckbox.tsx','src/lib/admin/admin-ui-styles.ts']:['src/components/admin/page-blocks/editors/SearchPlatformModuleEditor.tsx','src/components/admin/page-blocks/ContentModuleEditClient.tsx','src/lib/page-composition/module-registry-metadata.ts']).includes(relative)?path.join(searchBaselineRoot,relative):feedFamilyOnly&&baseline&&(feedLayoutOnly&&!feedHeadBaseline?['src/components/admin/page-blocks/FeedPresentationVariantFields.tsx',...(feedToggleOnly?['src/components/admin/ui/AdminFormSwitch.tsx']:[])]:['src/components/admin/page-blocks/FeedModuleEditClient.tsx','src/components/admin/page-blocks/FeedModuleFilterFields.tsx','src/components/admin/page-blocks/FeedPresentationVariantFields.tsx','src/lib/page-composition/module-registry-metadata.ts']).includes(relative)?path.join(feedBaselineRoot,relative):cardsFamilyOnly&&baseline&&['src/components/admin/page-blocks/CardsModuleEditClient.tsx','src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx','src/lib/page-composition/module-registry-metadata.ts'].includes(relative)?path.join(cardsBaselineRoot,relative):context.resourcePath;return ts.transpileModule(await readFile(beforePath,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;}
      });
    }); } }],
});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>{if(!error&&!stats.hasErrors())bundle=Buffer.from(stats.compilation.assets['fixture.js'].source());compiler.close(closeError=>error||closeError||stats.hasErrors()?reject(error||closeError||Error(stats.toString({all:false,errors:true}))):resolve());}));
const css = (await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile('src/app/globals.css','utf8'),{from:path.join(root,'src/app/globals.css')})).css;
const fontCss=[300,400,500,600,700].map(weight=>'@font-face{font-family:FixtureArabic;src:url(/fonts/ibm-plex-sans-arabic-'+weight+'.woff2);font-weight:'+weight+';font-style:normal;font-display:block;}').join('')+'@font-face{font-family:FixtureInter;src:url(/fonts/inter-variable.woff2);font-weight:100 900;font-display:block;}:root{--font-arabic:FixtureArabic;--font-inter:FixtureInter;}';
const requests=[];
const asset=(name,width,height)=>({id:name,provider:'filesystem',bucket:'public',objectKey:name+'.svg',publicUrl:'/'+name+'.svg',originalFilename:name+'.svg',displayName:'صورة '+name,kind:'image',mimeType:'image/svg+xml',extension:'svg',sizeBytes:1234,width,height,checksum:null,folderPath:'images/home',status:'active',uploadedBy:null,defaultAltText:null,defaultTitle:null,defaultCaption:null,reconciliationState:'synced',missingObject:false,catalogRegistered:true,source:'catalog_storage',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',referenceCount:0});
const assets=[...(heroFamilyOnly?[...new Set(heroFixture.rows.flatMap(row=>[...(row.config.images||[]),...(row.config.mobileImages||[])]))].map((publicUrl,index)=>({...asset('hero-'+index,1600,900),publicUrl})):[]),asset('one',800,600),asset('two',640,800),asset('replacement',900,600),asset('tall',160,1600),asset('wide',3200,160),...(ctaFamilyOnly||cardsFamilyOnly?['/images/about/who-we-are.png','/images/111.png','/images/venesia-1.png'].map((publicUrl,index)=>({...asset('cta-'+index,900,600),publicUrl})):[])];
const server=createServer(async(req,res)=>{const address=new URL(req.url,'http://localhost');if(/^\/fonts\/(ibm-plex-sans-arabic-(300|400|500|600|700)|inter-variable)\.woff2$/.test(address.pathname)){res.setHeader('Content-Type','font/woff2');res.end(await readFile(path.join(root,'src/assets',address.pathname)));return;}if(address.pathname==='/api/admin/media-library'){
  requests.push({method:req.method,query:address.search});res.setHeader('Content-Type','application/json');
  if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);assert.equal(data.operation,'reference_state','No Media mutation is permitted in this fixture');if(referenceStatus==='unavailable'){res.statusCode=503;res.end(JSON.stringify({error:'isolated read failure'}));return;}res.end(JSON.stringify({deleted:referenceStatus==='deleted'?data.assets:[],missing:referenceStatus==='missing'?data.assets:[],originals:data.assets.map(value=>{const a=assets.find(a=>a.publicUrl===value);return {value,width:omitDimensions==='invalid'?-(a?.width??0):omitDimensions?null:a?.width,height:omitDimensions==='invalid'?-(a?.height??0):omitDimensions?null:a?.height};})}));return;}
  assert.equal(req.method,'GET');res.end(JSON.stringify({catalogState:'available',warning:null,assets,folders:[],page:1,pageSize:20,total:assets.length,totalPages:1,summary:{provider:'filesystem',folderCount:0,assetCount:assets.length,imageCount:assets.length,documentCount:0,totalBytes:3702,unknownSizeCount:0,largestAsset:null},readiness:{usageResultsAuthoritative:true,safeDeleteReady:false,reasons:[],warnings:[]}}));return;
}const imagePath=address.pathname==='/_next/image'?address.searchParams.get('url'):address.pathname;if(imagePath==='/window.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(await readFile(path.join(root,'public/window.svg')));return;}const image=assets.find(a=>a.publicUrl===imagePath);if(image){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="'+image.width+'" height="'+image.height+'"><defs><linearGradient id="bg"><stop stop-color="#121c25"/><stop offset="1" stop-color="#b58d4b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><rect x="12" y="12" width="'+(image.width-24)+'" height="'+(image.height-24)+'" fill="none" stroke="#e3c27f" stroke-width="8"/><text x="50%" y="50%" text-anchor="middle" font-size="45" fill="#fff">'+image.id+'</text></svg>');return;}if(address.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>'+css+fontCss+'</style><div class="p-4"><div id="root"></div></div><script>window.fixtureDefaultMode='+JSON.stringify(heroFamilyOnly&&!new URL(req.url,'http://localhost').searchParams.has('mode')?'hero-public':null)+';window.initialConfig='+JSON.stringify(saved).replaceAll('<','\u003c')+';window.feedFilterOptions='+JSON.stringify(feedFilterOptions).replaceAll('<','\u003c')+';window.assignmentContext='+JSON.stringify(assignmentContext()).replaceAll('<','\u003c')+';window.initialName='+JSON.stringify(savedName).replaceAll('<','\u003c')+'</script><script src="/fixture.js"></script></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error: '+e.message)});await page.route('**/*',async r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();if(heroFamilyOnly&&assets.some(asset=>asset.publicUrl===r.request().url()))return r.fulfill({response:await page.request.get(url+'/_next/image?url='+encodeURIComponent(r.request().url()))});return r.abort();});
await page.exposeFunction('persist',async entries=>{const data=new FormData();for(const[k,v]of entries)data.append(k,v);saved=heroFamilyOnly?{...saved,block:{...saved.block,name:cleanText(data.get('name')),status:parseFormStatus(data),variant:heroControls.parseHeroTemplateVariant(data.get('variant'))},config:saveHeroConfig(data,heroControls.parseHeroTemplateVariant(data.get('variant')))}:searchFamilyOnly?{...saved,block:{...saved.block,name:cleanText(data.get('name')),status:parseFormStatus(data)},config:searchContract.asSearchPlatformConfig(searchSavedRaw=saveSearchConfig(data))}:feedFamilyOnly?{...saved,block:{...saved.block,name:cleanText(data.get("name")),description:cleanText(data.get("description"))||null,status:parseFormStatus(data),feed_type:feedSaveOwners.readFeedType(data.get("feed_type"))},config:await saveFeedConfig(data)}:cardsFamilyOnly?{...saved,block:{...saved.block,name:cleanText(data.get("name")),status:parseFormStatus(data)},config:saveCardsConfig(data)}:ctaFamilyOnly?{...saved,block:{...saved.block,name:cleanText(data.get("name")),status:parseFormStatus(data)},config:saveCtaConfig(data)}:featuredOnly?{...saved,block:{...saved.block,name:String(data.get("name")),status:parseFormStatus(data)},config:featuredContract.buildFeaturedModuleConfig(data)}:mediaHubOnly?{...saved,...await saveMediaHub(data)}:mediaSidebarOnly?{...saved,name:String(data.get("name")),description:cleanText(data.get("description")),status:parseFormStatus(data),widget_key:mediaSidebarContract.parseMediaSidebarWidgetKey(String(data.get("widget_key"))),config:mediaSidebarContract.buildMediaSidebarModuleConfig(mediaSidebarContract.parseMediaSidebarWidgetKey(String(data.get("widget_key"))),data)}:saveConfig(data);savedPageIds=parsePageIds(data);if(data.has('name'))savedName=String(data.get('name'));saves++;return saved;});
await page.exposeFunction('resolveHeroLinks',config=>heroLinkResolver.resolveHeroConfigLinks(config));
await page.exposeFunction('persistDisplay',async(entries,mode)=>{assert.ok(mediaSidebarOnly,'Display-default preservation belongs to the affected sidebar scope');const data=new FormData();for(const[k,v]of entries)data.append(k,v);assert.equal(data.get('fixture_child'),'قيمة محفوظة');const kind=mode==='display-default-article'?'article':'media';saved=displaySaveOwners[kind](data);saves++;return saved;});
await page.exposeFunction('searchRead',async(kind,input)=>{assert.ok(searchFamilyOnly,'Search transport stays isolated to its own QA scope');if(kind==='filters')return {categories:[{slug:'fixture-category',name:'تصنيف اختبار'}],series:[{slug:'fixture-series',name:'سلسلة اختبار'}]};assert.equal(kind,'collection');const count=Math.min(searchPublicCount,input.pageSize),items=Array.from({length:count},(_,i)=>({id:i+1,contentType:input.contentTypes[i%input.contentTypes.length],title:'نتيجة '+(i+1),excerpt:'نص نتيجة محفوظ',href:'/topics/articles/result-'+(i+1),image:'/one.svg',imageAlt:'صورة نتيجة',category:'تصنيف اختبار',series:'سلسلة اختبار',date:'19 أكتوبر2026'}));return {featured:null,items,totalCount:searchPublicCount,page:input.page,pageSize:input.pageSize,totalPages:Math.max(1,Math.ceil(searchPublicCount/input.pageSize)),startIndex:(input.page-1)*input.pageSize,endIndex:Math.min(input.page*input.pageSize,searchPublicCount)};});
let feedPayloadCount=9,feedExpectedRead=null;
const feedRead=async(kind,input)=>{assert.ok(feedFamilyOnly,'Feed read is isolated to its own scope');if(feedExpectedRead){assert.equal(kind,feedExpectedRead.kind);assert.deepEqual(input,feedExpectedRead.input);}const count=Math.min(feedPayloadCount,input.pageSize??input.limit);const rows=Array.from({length:count},(_,index)=>({id:index+1,title:'موضوع '+(index+1),name:'عنصر '+(index+1),slug:'fixture-'+(index+1),excerpt:'مقتطف '+(index+1),description:'وصف السلسلة '+(index+1),date:'18 أكتوبر 2026',image:'/one.svg',imageAlt:'صورة '+(index+1),href:'/topics/articles/fixture-'+(index+1),category:'تصنيف',series:'سلسلة',viewsCount:100-index,count:10+index,categoryId:1,representative:{image:'/window.svg',imageAlt:'صورة '+(index+1)}}));return kind==='articles'?{items:rows}:rows;};
const feedResolverSource=await readFile('src/lib/feed-modules/resolve-topics-feed.ts','utf8'),feedResolverAst=ts.createSourceFile('feed-resolver.ts',feedResolverSource,ts.ScriptTarget.Latest,true);
const feedResolverStatements=feedResolverAst.statements.filter(n=>!ts.isImportDeclaration(n));assert.equal(feedResolverStatements.length,7,'Real resolver functions plus DEFAULT_IMAGE');
const localImageOwner=await createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{'server-only':path.join(root,'node_modules/next/dist/compiled/server-only/empty.js')}}).import('../src/lib/media/resolve-local-public-image.ts');
const feedResolverExports={};new Function('exports','loadPublicContentCollection','loadPublicContentFeedCategories','loadPublicContentFeedSeries','resolveLocalPublicImage',ts.transpileModule(feedResolverStatements.map(n=>n.getText(feedResolverAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(feedResolverExports,input=>feedRead('articles',input),input=>feedRead('categories',input),input=>feedRead('series',input),localImageOwner.resolveLocalPublicImage);
await page.exposeFunction('resolveFeed',data=>feedResolverExports.resolveTopicsFeedModule({feed_type:data.type},data.config,data.excludeIds||[]));

let featuredSourceItems=[];
await page.exposeFunction('featuredRead',async input=>{
  assert.ok(featuredCapacityOnly,'Featured public reads require the isolated capacity fixture');
  assert.equal(input.page,1);assert.equal(input.sort,'newest');assert.deepEqual(input.contentTypes,['news']);assert.deepEqual(input.categorySlugs,[]);
  const rows=featuredSourceItems.filter(item=>(!input.includeIds||input.includeIds.includes(item.id))&&(input.featured!=='only'||item.isFeatured)&&(!input.popularOnly||item.isPopular));
  return {items:rows.slice(0,input.pageSize),featured:null,totalCount:rows.length,page:1,pageSize:input.pageSize,totalPages:Math.ceil(rows.length/input.pageSize),startIndex:rows.length?1:0,endIndex:Math.min(rows.length,input.pageSize)};
});
const url='http://127.0.0.1:'+server.address().port,ready=async()=>{await page.waitForFunction(()=>window.ready===true);await page.evaluate(()=>document.fonts.ready);};
const tab=async name=>{await page.getByRole('tab',{name,exact:true}).click();};
const body=page.locator('[data-admin-rich-text-scope]').getByRole('textbox',{name:'الوصف',exact:true});
const scope=page.locator('[data-admin-rich-text-scope]');
const submit=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();await expect(body).toBeVisible();};








async function verifyFeaturedCapacity({base,open,choose,entries,values,save,labels}){
  const {parseFeaturedModuleConfig}=featuredContract;
  const {FEATURED_PRESENTATION_VARIANTS,FEATURED_PRESENTATION_LABELS_AR}=featuredProfiles;
  const modes=[['hero',1,1],['editorial',2,4],['large-card',1,1],['three-cards',1,4],['list',1,12],['carousel',1,1],['single-carousel',1,1],['group-carousel',2,4]];
  assert.deepEqual(modes.map(([v])=>v).sort(),[...FEATURED_PRESENTATION_VARIANTS].sort());
  const allItems=Array.from({length:12},(_,index)=>({id:index+1,contentType:'news',slug:'fixture-'+(index+1),href:'/media-center/news/fixture-'+(index+1),title:'عنصر تجريبي '+String(index+1).padStart(2,'0'),excerpt:'وصف العنصر التجريبي '+(index+1),image:'/one.svg',imageAlt:'صورة العنصر '+(index+1),category:'أخبار تجريبية',categorySlug:'news',series:'سلسلة تجريبية',seriesSlug:'fixture',date:'2026-10-18',publishedAt:'2026-10-'+String(18-index).padStart(2,'0')+'T00:00:00.000Z',isFeatured:true,isPopular:true,mediaProject:'',mediaKind:null,mediaDuration:'',display:{title:true,image:true,excerpt:true,date:true,category:true,series:true,introCard:true}}));
  featuredSourceItems=allItems;
  const publicSection=page.locator('[data-featured-module]');
  const next=()=>page.getByRole('button',{name:'المجموعة التالية',exact:true});
  const previous=()=>page.getByRole('button',{name:'المجموعة السابقة',exact:true});
  const dots=()=>page.locator('[data-feed-carousel-dots]');
  const publicView=async()=>{await page.evaluate(()=>window.showFeaturedPublic());await ready();};
  const editSaved=async()=>{await page.clock.resume();await page.emulateMedia({reducedMotion:'reduce'});await open(saved);};
  const setSwitch=async(label,checked)=>{const control=page.getByRole('switch',{name:label,exact:true});await expect(control).toBeEnabled();await control.focus();await expect(control).toBeFocused();if(await control.isChecked()!==checked)await page.keyboard.press('Space');await expect(control).toBeChecked({checked});};
  const navigation=async(arrows,points,automatic)=>{await setSwitch('إظهار أسهم التنقل',arrows);await setSwitch('إظهار نقاط التنقل',points);await setSwitch('تشغيل التنقل تلقائيًا',automatic);};
  const visibleIds=async()=>{
    const headings=publicSection.getByRole('heading',{name:/^عنصر تجريبي /});const result=[];
    for(const heading of await headings.all()){await heading.scrollIntoViewIfNeeded();await expect(heading).toBeVisible();await expect(heading).toBeInViewport();result.push(Number((await heading.textContent()).match(/\d+$/)[0]));}
    return result.sort((a,b)=>a-b);
  };
  const expectItems=async(ids)=>{await expect(publicSection.getByRole('heading',{name:/^عنصر تجريبي /})).toHaveCount(ids.length);assert.deepEqual(await visibleIds(),[...ids].sort((a,b)=>a-b));};
  const assertDotsUsable=async()=>{
    const failures=await dots().getByRole('button').evaluateAll(buttons=>buttons.flatMap(button=>{
      const b=button.getBoundingClientRect(),p=button.parentElement.getBoundingClientRect();
      return b.left<p.left-1||b.right>p.right+1?[{label:button.getAttribute('aria-label'),button:[b.left,b.right],clip:[p.left,p.right]}]:[];
    }));
    assert.deepEqual(failures,[],'Every rendered dot must fit its clipped navigation surface');
    for(const button of await dots().getByRole('button').all()){
      await button.scrollIntoViewIfNeeded();const hittable=await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});assert.equal(hittable,true,'Dot is reachable by a real pointer');
    }
  };
  const dotFor=index=>dots().getByRole('button',{name:new RegExp(' '+(index+1)+'$')});
  await page.clock.install();
  // Boundary regression: actual dots must remain operable at the supported 12-item cap.
  await page.setViewportSize({width:390,height:1100});await open();
  await page.locator('input[name="item_limit"]').fill('12');await navigation(false,true,false);await save();await publicView();
  await expectItems([1]);
  try{await assertDotsUsable();}catch(error){await dots().screenshot({path:path.join(root,'.tmp-qa/story-adoption/featured-capacity-before-390.png')});throw error;}
  await dots().screenshot({path:path.join(root,'.tmp-qa/story-adoption/featured-capacity-after-390.png')});
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});
    for(const [variant,minimum,maximum]of modes){
      for(const capacity of [1,4,9,12]){
        await page.clock.resume();await page.emulateMedia({reducedMotion:'reduce'});
        const legacy={...base,config:parseFeaturedModuleConfig({...base.config,presentation:{...base.config.presentation,variant:'carousel'}})};
        await open(legacy);const limit=page.locator('input[name="item_limit"]');await limit.fill(String(capacity));
        if(variant==='carousel')await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR.list);
        await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR[variant]);
        await expect(page.locator('[data-featured-variant-settings]')).toHaveAttribute('data-featured-variant-settings',variant);
        const field=page.locator('input[name="items_per_view"]'),min=Math.min(capacity,minimum),max=Math.min(capacity,maximum);
        const perView=variant==='list'?capacity:maximum===1?1:capacity===4?2:max;
        if(maximum===1){await expect(field).toHaveAttribute('type','hidden');await expect(field).toHaveValue('1');}
        else{await expect(field).toBeVisible();await expect(field).toBeEnabled();await expect(field).toHaveAttribute('min',String(min));await expect(field).toHaveAttribute('max',String(max));await field.fill(String(min));await expect(field).toHaveValue(String(min));await field.fill(String(perView));}
        if(variant==='list')await expect(page.getByRole('switch',{name:'تشغيل التنقل تلقائيًا',exact:true})).toHaveCount(0);else await navigation(true,true,capacity===1);
        const authored=values(await entries());for(const label of labels){await tab(label);assert.deepEqual(values(await entries()),authored);}
        await save();assert.equal(saved.config.itemLimit,capacity);assert.equal(saved.config.itemsPerView,perView);assert.equal(saved.config.presentation.variant,variant);
        await publicView();
        const read=await page.evaluate(()=>({requests:window.featuredReadRequests,ids:window.featuredResolvedIds}));
        assert.equal(read.requests.length,1);assert.equal(read.requests[0].pageSize,capacity);assert.equal(read.requests[0].featured,'only');assert.deepEqual(read.ids,Array.from({length:capacity},(_,i)=>i+1));
        assert.equal(await publicSection.evaluate(e=>getComputedStyle(e).direction),'rtl');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const groups=[];for(let i=1;i<=capacity;i+=perView)groups.push(Array.from({length:Math.min(perView,capacity-i+1)},(_,n)=>i+n));
        await expectItems(groups[0]);
        if(variant==='list'){
          await expect(page.locator('[data-featured-carousel],[data-featured-navigation]')).toHaveCount(0);
        }else if(groups.length===1){
          await expect(page.locator('[data-featured-navigation]')).toHaveCount(0);
          await page.clock.fastForward(15201);await expectItems(groups[0]);
        }else{
          const visited=[];
          for(let i=0;i<groups.length;i++){
            await expectItems(groups[i]);visited.push(...groups[i]);await next().focus();await expect(next()).toBeFocused();await page.keyboard.press('Enter');
          }
          assert.deepEqual(visited,Array.from({length:capacity},(_,i)=>i+1));await expectItems(groups[0]);
          await previous().click();await expectItems(groups.at(-1));
          // Walk backwards, then forwards through real buttons, including compact sliding windows.
          for(let i=groups.length-1;i>=0;i--){await assertDotsUsable();await dotFor(i).click();await expectItems(groups[i]);await expect(dotFor(i)).toHaveAttribute('aria-current','true');}
          for(let i=0;i<groups.length;i++){await dotFor(i).focus();await expect(dotFor(i)).toBeFocused();await page.keyboard.press('Space');await expectItems(groups[i]);}
          await page.clock.fastForward(15201);await expectItems(groups.at(-1));
        }
        if(capacity===9&&variant!=='list'){
          await editSaved();await navigation(false,true,true);await save();await page.emulateMedia({reducedMotion:'no-preference'});await publicView();
          await next().count().then(count=>assert.equal(count,0));await assertDotsUsable();
          await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));await expectItems(groups[0]);
          for(let i=1;i<=groups.length;i++){await page.clock.fastForward(7601);await page.clock.runFor(550);await expectItems(groups[i%groups.length]);}
          // Wait for the browser's native media-change event before advancing its fake timers.
          await page.evaluate(()=>{window.featuredMotionChanged=new Promise(resolve=>window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>resolve(),{once:true}));});
          await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.featuredMotionChanged);
          await page.clock.runFor(50);await page.clock.fastForward(15201);await expectItems(groups[0]);
          await dotFor(1).click();await expectItems(groups[1]);
          await editSaved();await navigation(true,false,false);await save();await publicView();await expect(dots()).toHaveCount(0);await next().click();await expectItems(groups[1]);await page.clock.fastForward(15201);await expectItems(groups[1]);
        }
        if(capacity===9&&variant==='list'){
          await editSaved();await page.locator('input[name="items_per_view"]').fill('4');await save();await publicView();
          assert.equal(await publicSection.getAttribute('data-featured-resolved-items'),'9');await expectItems([1,2,3,4]);await expect(page.locator('[data-featured-navigation]')).toHaveCount(0);
        }
      }
      console.log('Featured capacity PASS '+variant+' / '+width+' / counts 1,4,9,12 / UI-save-read-render / arrows+dots+autoplay as applicable');
    }
  }
  await page.clock.resume();assert.deepEqual(errors,[]);
  console.log('PASS Featured capacity: 96 mode/capacity/viewport cases; '+saves+' isolated saves; all carousel identities reachable; intentional static-list truncation; real hooks and reduced-motion preserved; no DB writes.');
}

async function verifyFeatured(){
  const {parseFeaturedModuleConfig,buildFeaturedModuleConfig}=featuredContract;
  const {FEATURED_EDITOR_PRESENTATION_VARIANTS,FEATURED_PRESENTATION_LABELS_AR,featuredPresentationProfile}=featuredProfiles;
  const editorOptions={categories:[{id:1,slug:'parent',name:'تصنيف رئيسي',parentId:null,depth:0,scopeSlugs:['parent','child']},{id:2,slug:'child',name:'تصنيف فرعي',parentId:1,depth:1,scopeSlugs:['child']}],items:[
    {id:701,title:'مقال رئيسي',contentType:'article',categorySlug:'parent',publishedAt:'2026-01-01'},
    {id:503,title:'مقال فرعي',contentType:'article',categorySlug:'child',publishedAt:'2026-01-02'},
    {id:801,title:'خبر منشور',contentType:'news',categorySlug:'news',publishedAt:'2026-01-03'},
    {id:802,title:'فيديو منشور',contentType:'video',categorySlug:'videos',publishedAt:'2026-01-04'},
  ]};
  const base={block:{id:2,slug:'media-featured-content-news',name:'Media Center — News Featured Content',description:'Independent Featured Content module for /media-center/news',status:'published'},config:parseFeaturedModuleConfig({source:{kind:'media-center',contentType:'news'},itemLimit:1,selection:{mode:'automatic'},presentation:{title:'خبر مميز',ctaText:'كل الأخبار',eyebrow:'Featured News',variant:'hero',description:''}}),editorOptions};
  const labels=['مصدر المحتوى','النصوص','تنسيق عناصر المحتوى','الظهور'],ids=['content','text','presentation','pages'];
  const panel=id=>page.getByRole('tabpanel',{name:labels[ids.indexOf(id)],exact:true,includeHidden:true});
  const choose=async(name,value)=>{const field=page.locator('[data-admin-form-listbox]').filter({has:page.locator('select[name="'+name+'"]')});await field.getByRole('combobox').click();await page.getByRole('option',{name:value,exact:true}).click();await expect(field.getByRole('combobox')).toBeFocused();};
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const values=entries=>entries.filter(([k])=>k!=='module_editor_tab'&&!k.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const open=async(row=base,active='content')=>{saved=structuredClone(row);await page.goto(url+'?mode=featured&tab='+active+'&returnPageId=13');await ready();};
  const save=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();};
  const textNames=['eyebrow','show_eyebrow','eyebrow_bold','eyebrow_alignment','title','show_title','title_bold','title_alignment','presentation_description','show_description','description_bold','description_alignment'];
  const displayNames=['show_title_on_page','display_title_bold','display_title_alignment','show_image_on_page','show_category_on_page','display_category_bold','display_category_alignment','show_series_on_page','display_series_bold','display_series_alignment','show_excerpt_on_page','display_excerpt_bold','display_excerpt_alignment','show_date_on_page','display_date_bold','display_date_alignment','show_cta','cta_bold','cta_alignment','cta_text'];
  const sourceNames=['source_kind','content_type','selection_mode','item_limit','presentation_variant','items_per_view','show_navigation_arrows','show_navigation_dots','navigation_autoplay'];
  savedPageIds=[7];
  if(featuredCapacityOnly){await verifyFeaturedCapacity({base,open,choose,entries,values,save,labels});return;}
  // Regression: limits must follow the edited item count, not its saved value.
  await open();
  await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR['group-carousel']);
  const visibleItems=page.getByRole('spinbutton',{name:'العناصر الظاهرة',exact:true});
  await expect(visibleItems).toHaveAttribute('max','1');
  await page.locator('input[name="item_limit"]').fill('6');
  await expect(visibleItems).toHaveAttribute('max','4');
  await visibleItems.focus();await page.keyboard.press('ArrowUp');
  await expect(visibleItems).toHaveValue('3');
  await save();assert.equal(saved.config.itemLimit,6);assert.equal(saved.config.itemsPerView,3);
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await open();
    await expect(page.getByRole('tab')).toHaveText(labels);await expect(page.getByRole('tablist')).toHaveCount(1);
    await expect(page.locator('[data-admin-rich-text-scope],textarea')).toHaveCount(0);
    for(const [id,names]of [['content',sourceNames],['text',textNames],['presentation',displayNames]]){
      for(const name of names){
        const owned=panel(id).locator('[name="'+name+'"]');
        assert.ok(await owned.count()>0,'Field retained: '+name);
        assert.equal(await owned.count(),await page.locator('[name="'+name+'"]').count(),'One tab owns '+name);
        if(!name.includes('navigation'))assert.equal(await owned.count(),1,'No duplicate field '+name);
      }
    }
    const initial=values(await entries());
    for(const [index,label]of labels.entries()){
      await tab(label);assert.deepEqual(values(await entries()),initial,'Inactive fields retained in '+label);
      await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(ids[index]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const button=page.getByRole('tab',{name:label,exact:true});await button.focus();await expect(button).toBeFocused();
    }
    await tab('النصوص');
    const rows=panel('text').locator('[data-module-editor-control-row]');
    await expect(rows).toHaveCount(3);await expect(rows.locator('[data-admin-form-control-header]')).toHaveCount(3);
    for(const row of await rows.all()){await expect(row.locator('[data-admin-form-control-header] svg')).toHaveCount(1);await expect(row.getByRole('switch')).toHaveCount(1);}
    await expect(panel('text').locator('[data-admin-tab-section-heading]')).toHaveCount(0);
    await tab('تنسيق عناصر المحتوى');
    const displayRows=panel('presentation').locator('[data-module-editor-control-row]');
    await expect(displayRows.locator('[data-admin-form-control-header]')).toHaveText(['عنوان العنصر','الصورة','التصنيف','السلسلة','المقتطف','التاريخ','نص الإجراء']);
    await expect(displayRows.nth(1).getByRole('button')).toHaveCount(0);
    const grid=page.locator('[data-featured-display-settings] [data-admin-form-grid]');assert.equal(await grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1280?3:width>=768?2:1);
    for(const button of await displayRows.getByRole('button').all()){await button.focus();await expect(button).toBeFocused();}
    await tab('الظهور');
    await expect(page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})).toHaveText('1 محددة');
    await expect(page.locator('[data-module-page-row="7"]').getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/7');
    const choice=page.locator('[data-module-page-row="2"]').getByRole('checkbox');await choice.focus();await page.keyboard.press('Space');await expect(choice).toBeChecked();await page.keyboard.press('Space');await expect(choice).not.toBeChecked();
    await page.getByRole('tab',{name:'الظهور',exact:true}).focus();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'مصدر المحتوى',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'الظهور',exact:true})).toBeFocused();
    console.log('Featured exact four tabs / field inventory / seven groups / focus / RTL PASS '+width);
  }
  const manual={...base,config:parseFeaturedModuleConfig({...base.config,source:{kind:'categories',categorySlug:'parent'},selection:{mode:'manual',topicIds:[701,999001,503]},itemLimit:6,itemsPerView:3,presentation:{...base.config.presentation,variant:'group-carousel'},navigation:{showArrows:false,showDots:true,autoplay:true}})};
  await page.setViewportSize({width:1440,height:1100});await open(manual);
  await expect(page.locator('[data-featured-resolution="unresolved"]')).toHaveCount(1);
  assert.deepEqual((await entries()).filter(([k])=>k==='manual_topic_ids').map(([,v])=>Number(v)),[701,999001,503]);
  for(const label of ['العناصر المميزة فقط','الأحدث','الأكثر قراءة','اختيار يدوي']){await choose('selection_mode',label);for(const tabLabel of labels)await tab(tabLabel);await tab('مصدر المحتوى');}
  assert.deepEqual((await entries()).filter(([k])=>k==='manual_topic_ids').map(([,v])=>Number(v)),[701,999001,503]);
  await choose('source_kind','المركز الإعلامي');await choose('content_type',getContentTypeLabel('video'));
  await expect(page.getByRole('checkbox',{name:'اختيار فيديو منشور',exact:true})).toBeVisible();await expect(page.getByRole('checkbox',{name:'اختيار خبر منشور',exact:true})).toHaveCount(0);
  await choose('source_kind','التصنيفات');
  await expect(page.getByRole('checkbox',{name:'اختيار مقال رئيسي',exact:true})).toBeVisible();await expect(page.getByRole('checkbox',{name:'اختيار مقال فرعي',exact:true})).toBeVisible();
  await page.locator('input[name="items_per_view"]').fill('2');
  await page.getByText('تشغيل التنقل تلقائيًا',{exact:true}).click();
  await expect(page.getByRole('switch',{name:'تشغيل التنقل تلقائيًا',exact:true})).not.toBeChecked();
  await tab('النصوص');await page.getByRole('textbox',{name:'الوصف',exact:true}).fill('نص محفوظ *حرفي* <tag> & رموز');
  await page.getByRole('textbox',{name:'عنوان القسم',exact:true}).fill('عنوان معدل محفوظ');
  await panel('text').getByRole('button',{name:'تنسيق عريض',exact:true}).first().click();
  await tab('تنسيق عناصر المحتوى');await page.getByRole('textbox',{name:'نص الإجراء',exact:true}).fill('تفاصيل *حرفية* <tag>');
  const rows=panel('presentation').locator('[data-module-editor-control-row]');
  for(const row of await rows.all()){
    await row.getByRole('switch').focus();await page.keyboard.press('Space');
    const bold=row.getByRole('button',{name:'تنسيق عريض',exact:true});if(await bold.count()){await bold.click();await row.getByRole('button',{name:'محاذاة لليسار',exact:true}).click();}
  }
  const dirty=values(await entries());
  for(const label of labels){await tab(label);assert.deepEqual(values(await entries()),dirty);}
  const expected=buildFeaturedModuleConfig(MapFormData(await entries()));
  await tab('الظهور');await page.locator('[data-module-page-row="2"]').getByRole('checkbox').check();
  for(const label of labels){
    await tab(label);await save();assert.deepEqual(saved.config,expected);assert.deepEqual(savedPageIds,[2,7]);assert.equal(saved.block.status,'published');
    assert.equal(new URL(page.url()).searchParams.get('returnPageId'),'13');
  }
  // Drive the real listbox and numeric/switch controls; never preload the tested mode.
  const modes=[
    ['hero',1,1,true],['editorial',2,4,true],['large-card',1,1,true],
    ['three-cards',1,4,true],['list',1,12,false],['carousel',1,1,true],
    ['single-carousel',1,1,true],['group-carousel',2,4,true],
  ];
  assert.deepEqual(modes.map(([v])=>v).sort(),[...FEATURED_EDITOR_PRESENTATION_VARIANTS,'carousel'].sort());
  const navigationFields=[['show_navigation_arrows','إظهار أسهم التنقل','showArrows'],['show_navigation_dots','إظهار نقاط التنقل','showDots'],['navigation_autoplay','تشغيل التنقل تلقائيًا','autoplay']];
  const setNavigation=async(label,checked)=>{
    const control=page.getByRole('switch',{name:label,exact:true});
    await expect(control).toBeEnabled();await control.focus();await expect(control).toBeFocused();
    if(await control.isChecked()!==checked)await page.keyboard.press('Space');
    await expect(control).toBeChecked({checked});
  };
  const rejectedSave=async(input,value)=>{
    await input.fill(value);assert.equal(await input.evaluate(e=>e.checkValidity()),false,'Reject invalid numeric value '+value);
    const count=saves;await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();assert.equal(saves,count,'Invalid input cannot reach save');await expect(input).toBeFocused();
  };
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});
    for(const [variant,min,max,supportsNavigation]of modes){
      const legacy={...base,config:parseFeaturedModuleConfig({...base.config,presentation:{...base.config.presentation,variant:'carousel'}})};
      await open(legacy);
      const limit=page.locator('input[name="item_limit"]');await limit.fill('12');
      if(variant==='carousel')await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR.list);
      await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR[variant]);
      await expect(page.locator('[data-featured-variant-settings]')).toHaveAttribute('data-featured-variant-settings',variant);
      await expect(page.locator('[data-featured-variant-settings]')).toBeVisible();
      const profile=featuredPresentationProfile(variant),field=page.locator('input[name="items_per_view"]');
      assert.equal(profile.supportsNavigation,supportsNavigation);await expect(field).toBeEnabled();
      let selectedCount=1;
      if(min===max){
        await expect(page.getByRole('spinbutton',{name:'العناصر الظاهرة',exact:true})).toHaveCount(0);
        await expect(field).toHaveAttribute('type','hidden');await expect(field).toHaveValue('1');
      }else{
        await expect(field).toBeVisible();assert.equal(await field.evaluate(e=>e.readOnly),false);
        await expect(field).toHaveAttribute('min',String(min));await expect(field).toHaveAttribute('max',String(max));
        for(let count=min;count<=max;count++){await field.fill(String(count));await expect(field).toHaveValue(String(count));assert.equal(await field.evaluate(e=>e.checkValidity()),true);}
        await field.fill(String(min));await field.focus();await page.keyboard.press('ArrowUp');await expect(field).toHaveValue(String(min+1));
        await page.keyboard.press('ArrowDown');await expect(field).toHaveValue(String(min));
        for(const bad of [String(min-1),String(max+1),'','2.5'])await rejectedSave(field,bad);
        await field.fill(String(max));await limit.fill('1');await expect(field).toHaveValue('1');await expect(field).toHaveAttribute('min','1');await expect(field).toHaveAttribute('max','1');
        await limit.fill('2');await expect(field).toHaveAttribute('max','2');await expect(field).toHaveValue(String(Math.min(min,2)));
        await limit.fill('12');await expect(field).toHaveAttribute('max',String(max));
        selectedCount=Math.max(min,3);await field.fill(String(selectedCount));
      }
      if(variant==='list'){
        for(const bad of ['0','13','','2.5'])await rejectedSave(limit,bad);
        await limit.fill('12');await field.fill(String(selectedCount));
      }
      const expectedNavigation={showArrows:false,showDots:false,autoplay:false};
      for(const [name,label,key]of navigationFields){
        const control=page.getByRole('switch',{name:label,exact:true});
        await expect(control).toHaveCount(supportsNavigation?1:0);
        if(supportsNavigation){
          const initial=await control.isChecked();assert.equal(initial,variant==='carousel'?legacy.config.navigation[key]:profile.defaultNavigation[key]);
          await setNavigation(label,!initial);await setNavigation(label,initial);await setNavigation(label,!initial);
          expectedNavigation[key]=!initial;
        }else await expect(page.locator('input[name="'+name+'"]').last()).toHaveValue('false');
      }
      const beforeReselect=values(await entries());await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR[variant]);assert.deepEqual(values(await entries()),beforeReselect,'Reselecting the active mode retains its draft');
      const raw=await entries();assert.equal(raw.find(([k])=>k==='items_per_view')[1],String(selectedCount));
      if(supportsNavigation&&!expectedNavigation.showArrows&&!expectedNavigation.showDots)expectedNavigation.showDots=true;
      const built=buildFeaturedModuleConfig(MapFormData(raw));
      assert.equal(built.itemsPerView,selectedCount);assert.deepEqual(built.navigation,expectedNavigation);
      await tab('النصوص');assert.deepEqual(values(await entries()),values(raw));await save();
      assert.equal(saved.config.presentation.variant,variant);assert.equal(saved.config.itemLimit,12);assert.equal(saved.config.itemsPerView,selectedCount);assert.deepEqual(saved.config,built);
      await tab('مصدر المحتوى');await expect(field).toHaveValue(String(selectedCount));
      for(const [,label,key]of navigationFields)if(supportsNavigation)await expect(page.getByRole('switch',{name:label,exact:true})).toBeChecked({checked:expectedNavigation[key]});
      // Keep the existing contract: a navigable mode cannot lose both handles.
      if(width===1440&&supportsNavigation){
        for(const [,label]of navigationFields)await setNavigation(label,false);
        await save();assert.deepEqual(saved.config.navigation,{showArrows:false,showDots:true,autoplay:false});
        await expect(page.getByRole('switch',{name:'إظهار نقاط التنقل',exact:true})).toBeChecked();
      }
      assert.equal(await page.locator('[data-featured-variant-settings] [disabled]').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(variant==='group-carousel'&&(width===1440||width===390))await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-featured-'+width+'.png')});
      console.log('Featured mode interaction PASS '+variant+' / '+width+' / range '+min+'-'+max+' / navigation '+supportsNavigation);
    }
  }
  // Old links remain valid and every new tab is reachable by the shared query owner.
  for(const [index,id]of ids.entries()){await open(base,id);await expect(page.getByRole('tab',{name:labels[index],exact:true})).toHaveAttribute('aria-selected','true');}
  // Non-adopting Featured consumers retain their three tabs and original card/header presentation.
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await open({...base,block:{...base.block,id:3,slug:'media-featured-content-videos'}},'presentation');
    await expect(page.getByRole('tab')).toHaveText(['المصدر والاختيار','العرض','الظهور']);
    await expect(page.locator('[data-module-editor-control-row] [data-admin-form-control-header]')).toHaveCount(0);
    await expect(page.locator('[data-module-editor-control-row]')).toHaveCount(10);
    await expect(page.locator('[data-featured-variant-settings]')).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await tab('المصدر والاختيار');await page.locator('input[name="item_limit"]').fill('6');await tab('العرض');
    await choose('presentation_variant',FEATURED_PRESENTATION_LABELS_AR['group-carousel']);
    await expect(page.locator('input[name="items_per_view"]')).toHaveAttribute('max','4');
    await page.locator('input[name="items_per_view"]').fill('4');await save();
    assert.equal(saved.config.itemLimit,6);assert.equal(saved.config.itemsPerView,4);
    await expect(page.getByRole('tab')).toHaveText(['المصدر والاختيار','العرض','الظهور']);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Featured actual-component isolated Save/Reload: '+saves+' saves; sources, selection modes, manual unresolved IDs, eight active profiles, inactive tabs, texts, seven display groups and assignments; defaults preserved; no DB writes.');
}

async function verifyCtaPublic(before=false){
  let cases=0;
  for(const width of before?[1440]:[1440,900,390]){
    await page.setViewportSize({width,height:1100});await page.goto(url);await ready();
    for(const [renderer,legacy]of [['generic','600'],['about','500'],['topics','500'],['contact','600']])for(const bold of [undefined,true,false]){
      const value={eyebrow:'عنوان تمهيدي',title:'عنوان CTA',description:'نص محفوظ',primaryCta:{label:'الزر الرئيسي',href:'/projects'},secondaryCta:{label:'الزر الثانوي',href:'https://example.com'},...(bold===undefined?{}:{ctaBold:bold})};
      await page.evaluate(args=>window.mount('cta-public',args),{renderer,value});await ready();const links=page.locator('#root a');await expect(links).toHaveCount(['generic','contact'].includes(renderer)?2:1);
      for(const link of await links.all())assert.equal(await link.evaluate(e=>getComputedStyle(e).fontWeight),before||bold===undefined?legacy:bold?'700':'400',renderer+' '+width+' bold='+bold);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);cases++;
    }
    for(const renderer of ['about-default','topics-default']){await page.evaluate(args=>window.mount('cta-public',args),{renderer,value:{title:'عنوان افتراضي',button:{label:'زر افتراضي',href:'/projects'}}});await ready();await expect(page.locator('#root a')).toHaveCount(1);assert.equal(await page.locator('#root a').evaluate(e=>getComputedStyle(e).fontWeight),'500');cases++;}
  }
  if(!before)for(const width of [1440,900,390]){await page.setViewportSize({width,height:1100});await page.evaluate(()=>window.mount('contact-public',{title:'عنوان افتراضي',description:'وصف محفوظ',button:{label:'تواصل افتراضي',href:'/contact'},ctaBold:true}));await ready();await expect(page.locator('#root a')).toHaveCount(1);assert.equal(await page.locator('#root a').evaluate(e=>getComputedStyle(e).fontWeight),'500');cases++;}
  console.log((before?'BEFORE':'AFTER')+' CTA actual public renderers: '+cases+' weight/legacy/default cases.');
}

async function verifyHeroFamily(){
  const family=heroFixture.rows,widths=[1440,900,390],field=name=>page.locator('[name="'+name+'"]'),entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]),stable=data=>data.filter(([k])=>k!=='module_editor_tab'&&!k.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),canonical=data=>{const form=new FormData();for(const[k,v]of data)form.append(k,v);return saveHeroConfig(form,heroControls.parseHeroTemplateVariant(form.get('variant')));};
  const inventory=[],defaults=[];let records=0,publicRenders=0;
  const open=async(row,active='content')=>{const {config,...block}=row;saved={block:structuredClone(block),config:structuredClone(config)};savedPageIds=heroFixture.assignments.filter(a=>a.hero_id===row.id).map(a=>a.target_id);savedName=row.name;await page.goto(url+'?mode=hero-family&tab='+active+'&returnPageId='+(savedPageIds[0]||36));await ready();};
  const panel=async id=>{await page.locator('[data-admin-tab-id="'+id+'"]').click();await expect(page.locator('[data-admin-tab-id="'+id+'"]').first()).toHaveAttribute('aria-selected','true');};
  const rowControl=key=>page.locator('[data-module-editor-control-row]').filter({has:field('show_'+key)});
  const layout=async()=>{assert.equal(await page.locator('#root').evaluate(e=>getComputedStyle(e).direction),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Hero has no horizontal overflow');};
  const saveReload=async()=>{const expected=canonical(await entries()),before=saves;await page.getByRole('button',{name:'حفظ الهيرو',exact:true}).click();await page.waitForFunction(()=>window.saved===true);assert.equal(saves,before+1);assert.deepEqual(saved.config,expected);await page.reload();await ready();assert.deepEqual(canonical(await entries()),expected,'Canonical saved configuration survives real editor reload');return structuredClone(saved);};
  const publicRender=async(snapshot,weight)=>{await page.evaluate(data=>window.showHeroPublic(data),snapshot);await ready();await expect(page.locator('[data-hero-variant]')).toHaveAttribute('data-hero-variant',snapshot.block.variant);const config=heroPublicConfig.getHeroConfig({...snapshot.block,config:snapshot.config});const h1=page.locator('h1');if(config.showTitle){await expect(h1).toBeVisible();await expect(h1).toContainText(snapshot.block.variant==='project-detail'?heroFixtureProject.englishName:snapshot.config.title||'');if(weight)assert.equal(await h1.evaluate(e=>getComputedStyle(e).fontWeight),weight);}await layout();publicRenders++;};
  if(heroMediaActionsOnly){
    const galleryRows=family.filter(row=>row.variant!=='project-detail'),preservation=[],defaultSignatures=[],referenceSignatures=[],bareSignatures=[];assert.equal(galleryRows.length,12);
    const gallery=name=>page.locator('[data-admin-media-gallery-mode="paths"]').filter({has:field(name)}),card=(owner,index=0)=>owner.locator('[data-admin-media-gallery-card="image"]').nth(index);
    const imageLoaded=async owner=>{for(const img of await owner.locator('img').all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);}};
    const chooseImage=async label=>{const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:new RegExp('^صورة '+label)}).click();await dialog.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await expect(dialog).toHaveCount(0);};
    const actionVisual=async rail=>{await page.mouse.move(0,0);return rail.evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,padding:s.padding,gap:s.gap,radius:s.borderRadius,buttons:[...e.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect(),s=getComputedStyle(button),svg=button.querySelector('svg'),b=svg.getBoundingClientRect();return {className:button.className,width:r.width,height:r.height,border:s.borderColor,background:s.backgroundColor,color:s.color,radius:s.borderRadius,icon:[b.width,b.height],svg:svg.outerHTML};})};});};
    const overlayGeometry=async rail=>{const geometry=await rail.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect(),[replace,remove]=[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect());const gallery=e.closest('[data-admin-media-gallery-card]'),obstacles=gallery?[...gallery.querySelectorAll('[data-admin-media-gallery-action="move-up"],[data-admin-media-gallery-action="move-down"],[data-admin-media-preview-state] > span')]:[];return {left:r.left-p.left,bottom:p.bottom-r.bottom,inside:r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom,gap:replace.left-remove.right,aligned:Math.abs(replace.top-remove.top),overlap:obstacles.some(node=>{const b=node.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;})};});assert.equal(geometry.overlap,false,'Media action rail never overlaps reorder controls or reference-state text');assert.equal(geometry.inside,true);assert.ok(geometry.left>=11&&geometry.left<=14);assert.ok(geometry.bottom>=11&&geometry.bottom<=14);assert.equal(geometry.gap,8);assert.equal(geometry.aligned,0);};
    for(const width of widths){await page.setViewportSize({width,height:1100});await open(family[0]);await page.evaluate(()=>window.mount('hero-media-card-reference',{}));await ready();const reference=page.locator('[data-admin-media-image-field="media_reference"]');await imageLoaded(reference);const referenceRail=reference.locator('[data-admin-media-image-actions]'),referenceVisual=await actionVisual(referenceRail);await overlayGeometry(referenceRail);for(const button of referenceVisual.buttons){assert.equal(button.width,44);assert.equal(button.height,44);assert.deepEqual(button.icon,[18,18]);assert.notEqual(button.border,'rgba(0, 0, 0, 0)');assert.notEqual(button.background,'rgba(0, 0, 0, 0)');}assert.equal(referenceVisual.gap,'8px');referenceSignatures.push({width,markup:await referenceRail.evaluate(e=>e.outerHTML),visual:referenceVisual,fields:stable(await entries())});
      if(!baseline&&width===1440)await reference.locator('[data-admin-media-image-frame]').screenshot({path:path.join(root,'.tmp-qa/story-adoption/reference-hero-media-card-actions-1440.png')});
      if(!baseline){const replace=reference.getByTitle('استبدال',{exact:true});await replace.focus();await page.keyboard.press('Enter');await chooseImage('replacement');await expect(replace).toBeFocused();await expect(field('media_reference')).toHaveValue('/replacement.svg');await expect(field('media_reference_alt')).toHaveValue('وصف مرجعي محفوظ');await reference.getByRole('button',{name:'معاينة صورة مرجعية بالحجم الكبير'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await reference.getByRole('button',{name:'إزالة',exact:true}).focus();await page.keyboard.press('Space');await expect(field('media_reference')).toHaveValue('');await expect(field('media_reference_alt')).toHaveValue('');}
      await page.evaluate(()=>window.mount('hero-gallery-bare',{}));await ready();const bare=page.locator('[data-admin-media-gallery-mode]');await imageLoaded(bare);const bareRail=card(bare).locator('[data-admin-media-gallery-actions="bare"]'),bareVisual=await actionVisual(bareRail);assert.equal(bareVisual.gap,'4px');for(const button of bareVisual.buttons){assert.equal(button.width,44);assert.equal(button.height,44);assert.deepEqual(button.icon,[22,22]);assert.equal(button.border,'rgba(0, 0, 0, 0)');assert.equal(button.background,'rgba(0, 0, 0, 0)');}bareSignatures.push({width,markup:await bare.innerHTML(),visual:bareVisual,fields:stable(await entries())});
      if(!baseline){await card(bare).locator('[data-admin-media-gallery-action="replace"]').focus();await page.keyboard.press('Enter');await chooseImage('replacement');await expect(field('bare_gallery')).toHaveValue('/replacement.svg\n/two.svg');await card(bare).locator('[data-admin-media-gallery-action="remove"]').focus();await page.keyboard.press('Space');await expect(field('bare_gallery')).toHaveValue('/two.svg');}

      for(const row of galleryRows){await open(row,'media');await expect(page.locator('[data-admin-media-gallery-mode="paths"]')).toHaveCount(2);const original=stable(await entries());preservation.push({width,id:row.id,fields:original,config:canonical(original)});await layout();
        for(const name of ['images','mobile_images']){const owner=gallery(name),paths=(await field(name).inputValue()).split('\n').filter(Boolean);await expect(owner.locator('[data-admin-media-gallery-card="image"]')).toHaveCount(paths.length);await expect(owner.locator('input:not([type="hidden"])')).toHaveCount(0);if(!paths.length)continue;await imageLoaded(owner);const first=card(owner);await expect(first.locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled();await expect(card(owner,paths.length-1).locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
          if(!baseline){const rail=first.locator('[data-admin-media-image-actions]');await expect(rail).toHaveCount(1);await expect(first.locator('[data-admin-media-gallery-action="replace"]')).toHaveCount(1);await expect(first.locator('[data-admin-media-gallery-action="remove"]')).toHaveCount(1);assert.deepEqual(await actionVisual(rail),referenceVisual,'Hero card actions exactly adopt the actual ImageField card presentation');await overlayGeometry(rail);}

        }
        await panel('content');assert.deepEqual(stable(await entries()),original);await panel('media');assert.deepEqual(stable(await entries()),original);records++;
        if(row.id===1&&width!==900)await card(gallery('images')).screenshot({path:path.join(root,'.tmp-qa/story-adoption/'+(baseline?'before':'after')+'-hero-media-card-actions-'+width+'.png')});
      }
      await open(family.find(row=>row.id===31),'media');await expect(page.locator('[data-admin-media-gallery-mode]')).toHaveCount(0);
      for(const mode of ['hero-gallery-items','hero-gallery-paths']){await page.evaluate(({mode,config})=>window.mount(mode,config),{mode,config:{items:[{url:'/one.svg',alt:'وصف أول محفوظ',caption:'تعليق أول'},{url:'/two.svg',alt:'وصف ثان محفوظ',caption:'تعليق ثان'}],paths:['/one.svg','/two.svg']}});await ready();const owner=page.locator('[data-admin-media-gallery-mode]');await imageLoaded(owner);await layout();defaultSignatures.push({width,mode,fields:stable(await entries()),markup:await owner.innerHTML()});await expect(owner.locator('[data-admin-media-gallery-action="remove"]').first()).toHaveText('×');await expect(owner.locator('[data-admin-media-gallery-action="replace"]').first()).toHaveText('استبدال');
        if(!baseline){const first=card(owner),name=mode.endsWith('items')?'gallery_image_url':'image_urls';if(mode.endsWith('items')){await field('gallery_image_alt').first().fill('بديل معدل');await field('gallery_image_caption').first().fill('تعليق معدل');}await first.locator('[data-admin-media-gallery-action="replace"]').focus();await page.keyboard.press('Enter');await chooseImage('replacement');if(mode.endsWith('items')){await expect(field(name).first()).toHaveValue('/replacement.svg');await expect(field('gallery_image_alt').first()).toHaveValue('بديل معدل');await expect(field('gallery_image_caption').first()).toHaveValue('تعليق معدل');}else await expect(field(name)).toHaveValue('/replacement.svg\n/two.svg');await first.locator('[data-admin-media-gallery-action="move-down"]').click();if(mode.endsWith('items')){await expect(field(name).last()).toHaveValue('/replacement.svg');await expect(field('gallery_image_alt').last()).toHaveValue('بديل معدل');await expect(field('gallery_image_caption').last()).toHaveValue('تعليق معدل');}else await expect(field(name)).toHaveValue('/two.svg\n/replacement.svg');await card(owner,1).locator('[data-admin-media-gallery-action="remove"]').click();if(mode.endsWith('items')){await expect(field(name)).toHaveCount(1);await expect(field('gallery_image_alt')).toHaveValue('وصف ثان محفوظ');await expect(field('gallery_image_caption')).toHaveValue('تعليق ثان');}else await expect(field(name)).toHaveValue('/two.svg');await layout();}
      }
      if(!baseline){await open(family[0],'media');for(const name of ['images','mobile_images']){const owner=gallery(name),original=(await field(name).inputValue()).split('\n'),first=card(owner),replace=first.locator('[data-admin-media-gallery-action="replace"]');await replace.focus();await expect(replace).toBeFocused();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(replace).toBeFocused();assert.equal(await replace.evaluate(e=>getComputedStyle(e).outlineWidth),'2px');const normalBackground=await replace.evaluate(e=>getComputedStyle(e).backgroundColor);await replace.hover();await expect.poll(()=>replace.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(normalBackground);await page.keyboard.press('Enter');await chooseImage('replacement');await expect(replace).toBeFocused();await first.locator('[data-admin-media-gallery-action="move-down"]').click();const changed=[original[1],'/replacement.svg',...original.slice(2)];await expect(field(name)).toHaveValue(changed.join('\n'));for(const id of ['content','buttons','display','media']){await panel(id);await expect(field(name)).toHaveValue(changed.join('\n'));}const output=await saveReload();assert.deepEqual(output.config[name==='images'?'images':'mobileImages'],changed);await panel('media');await imageLoaded(owner);const remove=card(owner,1).locator('[data-admin-media-gallery-action="remove"]');await remove.focus();await expect(remove).toBeFocused();await page.keyboard.press('Space');const removed=[original[1],...original.slice(2)];await expect(field(name)).toHaveValue(removed.join('\n'));const final=await saveReload();assert.deepEqual(final.config[name==='images'?'images':'mobileImages'],removed);await panel('media');await expect(field(name)).toHaveValue(removed.join('\n'));await layout();}}
      if(!baseline)for(const state of ['missing','deleted','unavailable']){referenceStatus=state;await open(family[0],'media');const data=stable(await entries());for(const name of ['images','mobile_images']){const owner=gallery(name),first=card(owner);await expect(first.locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',state);await expect(first.locator('img')).toHaveCount(0);await expect(first.locator('[data-admin-media-gallery-action="replace"]')).toBeEnabled();await expect(first.locator('[data-admin-media-gallery-action="remove"]')).toBeEnabled();await overlayGeometry(first.locator('[data-admin-media-image-actions]'));}assert.deepEqual(stable(await entries()),data);await layout();}referenceStatus='active';
      console.log('Hero media actions '+(baseline?'BEFORE':'AFTER')+' @'+width+' PASS');
    }
    if(!baseline){const shell=await readFile('src/components/admin/AdminShell.tsx','utf8');assert.ok(shell.includes('compact ? "w-[92px]" : "w-[304px]"'));assert.ok(shell.includes('px-4 py-4 sm:px-6 lg:px-7'));assert.ok(shell.includes('hidden h-screen shrink-0 bg-transparent lg:block'));const minima=[];for(const width of [768,1024,1280])for(const state of width===1024?['active','missing','deleted','unavailable']:['active']){referenceStatus=state;await page.setViewportSize({width,height:1100});await open(family[0],'media');const available=width-(width>=1024?304:0)-(width>=1024?56:48);await page.locator('#root').evaluate((e,width)=>{e.style.width=width+'px';},available);const first=card(gallery('images')),rail=first.locator('[data-admin-media-image-actions]');if(state==='active')await imageLoaded(first);else await expect(first.locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',state);await overlayGeometry(rail);await layout();const dimensions=await rail.evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return {width:r.width,height:r.height};});minima.push({viewport:width,contentWidth:available,state,...dimensions});}referenceStatus='active';console.log('Hero actual-shell-width overlay probes '+JSON.stringify(minima));}
    console.log('Hero media preservation signature '+hash(preservation));console.log('Hero gallery default signature '+hash(defaultSignatures));console.log('Hero ImageField card reference signature '+hash(referenceSignatures));console.log('Hero retained bare signature '+hash(bareSignatures));
    if(!baseline){assert.equal(hash(preservation),'02c81f31a61081677f492bc53996ca2a8e37d334cbcec7be97bab93105752b61');assert.equal(hash(defaultSignatures),'4320c2b6307e84bcbf6d61312009429e0bdc0ae3c679c171e883b5b10ab4733c');assert.equal(hash(referenceSignatures),'af68aa28f31263ff21b79fefc24bef262db9061a8c07539cb41598d9a96af817');assert.equal(hash(bareSignatures),'7a3361a49383d09e5210c19691d331b88ec670af597ac6176d5617e6a1f48b6c');}
    console.log('Hero media scope: '+records+' actual gallery-record cases, 3 detail exclusions, 6 exact default consumer cases, 3 ImageField card references, 3 retained bare cases, '+(baseline?0:9)+' placeholder cases, '+saves+' isolated Hero saves; no public rendering rerun.');assert.deepEqual(errors,[]);return;
  }
  if(process.argv.includes('--hero-target-compatibility')){
    let targetCases=0,domainCases=0,recordCases=0,legacyCases=0;const legacySignature=[];
    const labels=['رابط رئيسي تجريبي','رابط ثانوي تجريبي'];
    const value=(kind,target)=>({...kind,...(target===undefined?{}:{target})});
    const kinds=[{name:'internal',link:{link_kind:'internal',linked_type:'pages',linked_id:901,href:'/stale',anchor:'team'},href:'/about#team'},{name:'external',link:{link_kind:'external',href:'https://example.com/hero'},href:'https://example.com/hero'},{name:'anchor',link:{link_kind:'anchor',href:'#team',anchor:'team'},href:'#team'}];
    const draw=async(variant,config,domainSlides)=>{await page.evaluate(data=>window.showHeroPublic(data),{block:{...family[0],variant},config,domainSlides});await ready();await layout();};
    const verifyLinks=async(hrefs,targets)=>{for(let n=0;n<2;n++){const link=page.getByRole('link',{name:labels[n],exact:true});await expect(link).toHaveAttribute('href',hrefs[n]);assert.equal(await link.getAttribute('target'),targets[n]);if(targets[n]==='_blank'){const rel=(await link.getAttribute('rel')||'').split(/\s+/);assert.ok(rel.includes('noopener'));assert.ok(rel.includes('noreferrer'));}else assert.equal(await link.getAttribute('rel'),null);await link.focus();await expect(link).toBeFocused();}};
    const base={title:'عنوان التحقق',description:'وصف محفوظ',images:['/one.svg'],mobileImages:['/two.svg'],showCta:true,primaryCtaLabel:labels[0],secondaryCtaLabel:labels[1]};
    for(const width of widths){await page.setViewportSize({width,height:1100});await open(family[0]);
      if(!heroTargetBefore)for(const row of family){const snapshot={block:row,config:row.config};await publicRender(snapshot);recordCases++;}
      for(const variant of ['home-cinematic','internal-page']){
        if(!heroTargetBefore)for(const kind of kinds)for(const target of ['_blank','_self',undefined,'_parent']){await draw(variant,{...base,primaryCtaLink:value(kind.link,target),secondaryCtaLink:value(kind.link,target)});const expected=target==='_blank'||target==='_self'?target:null;await verifyLinks([kind.href,kind.href],[expected,expected]);if(kind.name==='internal'&&target==='_blank'){const originalUrl=page.url(),popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:labels[0],exact:true}).focus();await page.keyboard.press('Enter');const popup=await popupPromise;await popup.waitForURL(url+'/about#team');assert.equal(page.url(),originalUrl);await popup.close();}if(kind.name==='internal'&&target==='_self'){const count=page.context().pages().length;await page.getByRole('link',{name:labels[0],exact:true}).focus();await Promise.all([page.waitForURL(url+kind.href),page.keyboard.press('Enter')]);await ready();assert.equal(page.context().pages().length,count);assert.equal(page.url(),url+kind.href);}targetCases++;}
        for(const config of [{...base,primaryCtaHref:'/contact',secondaryCtaHref:'https://example.com/legacy'},{...base,primaryCtaLink:{link_kind:'external',href:'https://example.com/legacy'},secondaryCtaLink:{link_kind:'anchor',href:'#old',anchor:'old'}}]){await draw(variant,config);const hrefs=config.primaryCtaHref?['/contact','https://example.com/legacy']:['https://example.com/legacy','#old'];await verifyLinks(hrefs,[null,null]);legacySignature.push({width,variant,links:await page.locator('a.home-pressable').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),target:e.getAttribute('target'),rel:e.getAttribute('rel'),text:e.textContent})))});legacyCases++;}
      }
      for(const variant of ['projects-hub','home-cinematic','internal-page']){const config={...base,primaryCtaLink:value(kinds[1].link,'_blank'),secondaryCtaLink:value(kinds[1].link,'_blank')},slides=[{id:'one',title:'مشروع أول',desktopImage:'/one.svg',primaryCtaLabel:labels[0],primaryCtaHref:'/projects/one',secondaryCtaLabel:labels[1],secondaryCtaHref:'/contact'},{id:'two',title:'مشروع ثان',desktopImage:'/two.svg',primaryCtaLabel:labels[0],primaryCtaHref:'/projects/two',secondaryCtaLabel:labels[1],secondaryCtaHref:'/about'}];await draw(variant,config,slides);await verifyLinks(['/projects/one','/contact'],[null,null]);if(variant!=='internal-page'){await page.getByRole('button',{name:'الشريحة 2',exact:true}).click();await verifyLinks(['/projects/two','/about'],[null,null]);}legacySignature.push({width,variant,domain:true,links:await page.locator('a.home-pressable').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),target:e.getAttribute('target'),rel:e.getAttribute('rel'),text:e.textContent})))});domainCases++;}
      if(!heroTargetBefore)for(const variant of ['projects-hub','home-cinematic']){const config={...base,primaryCtaLink:value(kinds[1].link,'_blank'),secondaryCtaLink:value(kinds[1].link,'_blank')},slides=[{id:'one',title:'أول',desktopImage:'/one.svg',primaryCtaLabel:labels[0],primaryCtaHref:'/projects/one'},{id:'two',title:'ثان',desktopImage:'/two.svg',secondaryCtaLabel:labels[1],secondaryCtaHref:'/about'}];await draw(variant,config,slides);await verifyLinks(['/projects/one',kinds[1].href],[null,'_blank']);await page.getByRole('button',{name:'الشريحة 2',exact:true}).click();await verifyLinks([kinds[1].href,'/about'],['_blank',null]);domainCases++;}
      if(!heroTargetBefore){for(const targetValue of ['_blank','_self']){await open(family.find(row=>row.id===2),'buttons');for(const prefix of ['primary_cta','secondary_cta']){const owner=page.locator('[data-admin-link-field]').filter({has:field(prefix+'_link_kind')});await owner.getByRole('button',{name:'اختيار الرابط',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'External',exact:true}).click();await dialog.getByLabel('الرابط',{exact:true}).fill('https://example.com/saved-'+prefix);const control=dialog.getByRole('switch',{name:'فتح في تبويب جديد'});await control.focus();if(await control.isChecked()!==(targetValue==='_blank'))await page.keyboard.press('Space');await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(owner.getByRole('button',{name:'اختيار الرابط',exact:true})).toBeFocused();await field(prefix+'_label').fill(labels[prefix==='primary_cta'?0:1]);}const visibility=rowControl('cta').getByRole('switch').first();if(!await visibility.isChecked()){await visibility.focus();await page.keyboard.press('Space');}const snapshot=await saveReload();assert.equal(snapshot.config.primaryCtaLink.target,targetValue);assert.equal(snapshot.config.secondaryCtaLink.target,targetValue);await publicRender(snapshot);await verifyLinks(['https://example.com/saved-primary_cta','https://example.com/saved-secondary_cta'],[targetValue,targetValue]);targetCases++;}}
      console.log('Hero targets '+(heroTargetBefore?'BEFORE legacy':'AFTER')+' @'+width+' PASS');
    }
    console.log('Hero legacy/domain target signature '+hash(legacySignature));if(!heroTargetBefore)assert.equal(hash(legacySignature),'0ed0b7215e69e57e63f29dc4fbaffd818242f0ab67713f91e2101efd6b2b2831');console.log('Hero target scope: '+recordCases+' actual family public cases, '+targetCases+' explicit/missing/malformed+saved target cases, '+legacyCases+' legacy cases, '+domainCases+' domain overrides, '+saves+' isolated saves; '+publicRenders+' publicRender helper calls.');assert.deepEqual(errors,[]);return;
  }
  if(process.argv.includes('--hero-public-target-only')){await page.setViewportSize({width:1440,height:1100});await open(family.find(row=>row.id===2),'buttons');const owner=page.locator('[data-admin-link-field]').filter({has:field('primary_cta_link_kind')});await owner.getByRole('button',{name:'اختيار الرابط',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'External',exact:true}).click();await dialog.getByLabel('الرابط',{exact:true}).fill('https://example.com/hero-target');const target=dialog.getByRole('switch',{name:'فتح في تبويب جديد'});await target.focus();if(!await target.isChecked())await page.keyboard.press('Space');await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await field('primary_cta_label').fill('اختبار نافذة جديدة');const visibility=rowControl('cta').getByRole('switch').first();if(!await visibility.isChecked()){await visibility.focus();await page.keyboard.press('Space');}const output=await saveReload();assert.equal(output.config.primaryCtaLink.target,'_blank');await publicRender(output);const publicLink=page.getByRole('link',{name:'اختبار نافذة جديدة'});await expect(publicLink).toHaveAttribute('href','https://example.com/hero-target');console.log('Hero '+(baseline?'BEFORE':'AFTER')+' target saved='+output.config.primaryCtaLink.target+' actual public target='+await publicLink.getAttribute('target'));await expect(publicLink).toHaveAttribute('target','_blank');return;}
  if(!process.argv.includes('--hero-controls-only')&&!process.argv.includes('--hero-persistence-only'))for(const width of widths){await page.setViewportSize({width,height:1100});for(const row of family){await open(row);const ids=row.variant==='internal-page'?['content','buttons','media','display']:['content','buttons','media','order','display'];assert.deepEqual(await page.getByRole('tab').evaluateAll(es=>es.map(e=>e.dataset.adminTabId)),ids);await expect(page.locator('form')).toHaveCount(1);const original=stable(await entries()),current=canonical(original);if(width===1440)inventory.push({id:row.id,names:[...new Set(original.map(([k])=>k))].sort(),config:current});
      for(const id of ids){await panel(id);await layout();assert.deepEqual(stable(await entries()),original,'Tab switch preserves every original field '+row.id+'/'+id);}
      await panel('content');const firstTab=page.getByRole('tab').first();await firstTab.focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-admin-tab-id="buttons"]')).toBeFocused();await page.keyboard.press('Home');await expect(firstTab).toBeFocused();
      if(width!==900&&[1,2,31].includes(row.id))await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/'+(baseline?'before':'after')+'-hero-'+row.id+'-content-'+width+'.png')});
      if(width===1440&&row.id===1)for(const id of ['buttons','media']){await panel(id);await page.locator('[role="tabpanel"]:visible').screenshot({path:path.join(root,'.tmp-qa/story-adoption/'+(baseline?'before':'after')+'-hero-1-'+id+'-1440.png')});}await panel('content');
      if(!baseline){if(row.variant!=='project-detail')await field('title').fill('عنوان محفوظ '+row.id+' '+width);const control=rowControl('title'),bold=control.locator('[data-admin-text-format-bold]');const desired=width!==900;if((await bold.getAttribute('aria-pressed'))!==String(desired)){await bold.focus();await page.keyboard.press('Space');}await bold.focus();await expect(bold).toHaveAttribute('aria-pressed',String(desired));await expect(bold).toBeFocused();await control.locator('[data-admin-text-alignment="center"]').click();const toggle=control.getByRole('switch');await toggle.focus();const state=await toggle.isChecked();await page.keyboard.press('Space');await expect(toggle).toBeChecked({checked:!state});await page.keyboard.press('Space');if(!state)await page.keyboard.press('Space');await expect(field('show_title')).toHaveValue('true');const draft=stable(await entries());for(const id of ids){await panel(id);assert.deepEqual(stable(await entries()),draft);}const snapshot=await saveReload();assert.equal(snapshot.config.titleBold,desired);assert.equal(snapshot.config.titleAlignment,'center');await publicRender(snapshot,desired?(row.variant==='project-detail'?'600':'700'):'400');}
      records++;
    }console.log('Hero '+(baseline?'BEFORE':'AFTER')+' 13 records, complete tabs/fields @'+width+' PASS');}
  if(inventory.length){console.log('Hero '+(baseline?'BEFORE':'AFTER')+' 13 canonical inventories SHA256 '+hash(inventory));if(!baseline)assert.equal(hash(inventory),'4216c856666c2e9ec20f100e24672a4f6211b9712ef6637f682cebbdf00e33e2');}
  for(const width of widths){await page.setViewportSize({width,height:1100});await open(family[0]);for(const mode of ['hero-default-hub','hero-default-cta','hero-default-order']){await page.evaluate(mode=>window.mount(mode,{}),mode);await ready();const original=stable(await entries());defaults.push({width,mode,fields:original,markup:await page.locator('form').innerHTML()});await layout();if(mode==='hero-default-cta'){await expect(field('primary_cta_label')).toHaveValue('فتح المشروع');await expect(page.locator('[data-hero-cta-row]')).toHaveCount(0);await page.locator('[data-admin-text-format-bold]').click();await expect(field('cta_bold')).toHaveValue('true');}if(mode==='hero-default-order'){const before=JSON.parse(await field('hero_element_order').inputValue());await page.getByRole('button',{name:/تحريك.*لأسفل/}).first().click();assert.deepEqual(JSON.parse(await field('hero_element_order').inputValue()),[before[1],before[0],...before.slice(2)]);}}}
  console.log('Hero non-adopter hub/domain CTA/default order signature '+hash(defaults));if(!baseline)assert.equal(hash(defaults),'634db05b4035d3f4e7b8f732a13dbe1560195de60863c4df5f07216091893e4b');
  if(!baseline&&!process.argv.includes('--hero-persistence-only'))for(const width of widths){
    await page.setViewportSize({width,height:1100});
    const choose=async(name,value)=>{const owner=page.locator('[data-admin-form-listbox]').filter({has:field(name)}),label=await field(name).locator('option[value="'+value+'"]').textContent();await owner.getByRole('combobox').click();await page.getByRole('option',{name:label.trim(),exact:true}).click();await expect(owner.getByRole('combobox')).toBeFocused();};
    const toggle=async(control,value)=>{await control.focus();if(await control.isChecked()!==value)await page.keyboard.press('Space');await expect(control).toBeChecked({checked:value});};
    for(const id of [1,2,31]){await open(family.find(row=>row.id===id));const keys=id===31?['eyebrow','title','subtitle','description']:['eyebrow','title','highlight','subtitle','description'];for(const key of keys){const row=rowControl(key),bold=row.locator('[data-admin-text-format-bold]');await bold.focus();const original=await bold.getAttribute('aria-pressed');await page.keyboard.press('Space');await expect(bold).toHaveAttribute('aria-pressed',String(original!=='true'));await page.keyboard.press('Space');await expect(bold).toHaveAttribute('aria-pressed',original);await row.locator('[data-admin-text-alignment="left"]').click();await expect(field(key+'_alignment')).toHaveValue('left');await toggle(row.getByRole('switch'),false);await toggle(row.getByRole('switch'),true);if(id!==31)await field(key==='description'?'description_editor':key).fill('نص محفوظ '+key+' <حرفي> *رمز* '+width);}
      await panel('buttons');const cta=rowControl('cta'),bold=cta.locator('[data-admin-text-format-bold]');if(await bold.getAttribute('aria-pressed')!=='true')await bold.click();await cta.locator('[data-admin-text-alignment="center"]').click();if(id!==31){await toggle(cta.getByRole('switch'),false);await toggle(cta.getByRole('switch'),true);}else await expect(cta.getByRole('switch')).toHaveCount(3);
      await panel('media');for(const option of heroControls.HERO_IMAGE_COMPOSITION_OPTIONS_AR)await choose('image_composition',option.value);await layout();if(id!==31){await expect(field('images')).toHaveValue(family.find(row=>row.id===id).config.images.join('\n'));await expect(page.locator('[data-admin-media-gallery-mode="paths"]')).toHaveCount(2);}else await expect(field('images')).toHaveCount(0);
      if(id!==2){await panel('order');const before=JSON.parse(await field('hero_element_order').inputValue());await page.getByRole('button',{name:/تحريك.*لأسفل/}).first().click();assert.deepEqual(JSON.parse(await field('hero_element_order').inputValue()),[before[1],before[0],...before.slice(2)]);}
      await panel('display');const assigned=heroFixture.assignments.find(a=>a.hero_id===id);if(assigned)await expect(page.locator('[data-module-page-row="'+assigned.target_id+'"]').getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/'+assigned.target_id);const check=page.locator('[data-module-page-row="2"]').getByRole('checkbox');const was=await check.isChecked();await toggle(check,!was);await toggle(check,was);await toggle(page.locator('input[type="checkbox"][name="status"]'),false);const output=await saveReload();assert.equal(output.block.status,'unpublished');assert.equal(output.config.imageComposition,'cover-upper');for(const key of keys)assert.equal(output.config[key+'Alignment'],'left');await publicRender(output);if(id!==31){for(const key of keys)await expect(page.getByText('نص محفوظ '+key+' <حرفي> *رمز* '+width,{exact:true}).first()).toBeVisible();}else await expect(page.getByRole('heading',{name:heroFixtureProject.englishName,exact:true}).first()).toBeVisible();
    }
    await open(family.find(row=>row.id===1),'buttons');if(width===1440)await page.locator('[role="tabpanel"]:visible').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-hero-1-buttons-1440.png')});
    const link=prefix=>page.locator('[data-admin-link-field]').filter({has:field(prefix+'_link_kind')});
    for(const prefix of ['primary_cta','secondary_cta']){const owner=link(prefix),button=owner.getByRole('button',{name:'اختيار الرابط',exact:true});await button.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(button).toBeFocused();await button.click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Pages',exact:true}).click();await dialog.getByRole('button',{name:'Static Routes',exact:true}).click();await dialog.getByRole('button',{name:/^من نحن/}).click();await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await expect(button).toBeFocused();await owner.getByRole('textbox').fill(prefix+'-anchor');await field(prefix+'_label').fill('زر محفوظ '+prefix);}
    let output=await saveReload();assert.equal(output.config.primaryCtaLink.anchor,'primary_cta-anchor');assert.equal(output.config.secondaryCtaLink.anchor,'secondary_cta-anchor');await publicRender(output);await expect(page.getByRole('link',{name:'زر محفوظ primary_cta'})).toHaveAttribute('href','/about#primary_cta-anchor');await expect(page.getByRole('link',{name:'زر محفوظ secondary_cta'})).toHaveAttribute('href','/about#secondary_cta-anchor');
    await page.reload();await ready();await panel('buttons');await link('secondary_cta').getByRole('button',{name:'مسح',exact:true}).focus();await page.keyboard.press('Space');await expect(field('secondary_cta_link_kind')).toHaveValue('none');output=await saveReload();assert.equal(output.config.secondaryCtaLink,null);await panel('buttons');await link('secondary_cta').getByRole('button',{name:'اختيار الرابط',exact:true}).click();const external=page.getByRole('dialog');await external.getByRole('button',{name:'External',exact:true}).click();await external.getByLabel('الرابط',{exact:true}).fill('https://example.com/hero');await toggle(external.getByRole('switch',{name:'فتح في تبويب جديد'}),true);await external.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();output=await saveReload();assert.equal(output.config.secondaryCtaLink.target,'_blank');assert.equal(output.config.secondaryCtaLink.href,'https://example.com/hero');
    await open(family.find(row=>row.id===1),'media');for(const name of ['images','mobile_images']){const owner=page.locator('[data-admin-media-gallery-mode="paths"]').filter({has:field(name)}),original=(await field(name).inputValue()).split('\n');await owner.locator('[data-admin-media-gallery-action="add"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await expect(field(name)).toHaveValue([...original,'/replacement.svg'].join('\n'));const last=owner.locator('[data-admin-media-gallery-card="image"]').last();await expect.poll(()=>last.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);await last.locator('[data-admin-media-gallery-action="move-up"]').click();await expect(field(name)).toHaveValue([...original.slice(0,-1),'/replacement.svg',original.at(-1)].join('\n'));const moved=owner.locator('[data-admin-media-gallery-card="image"]').nth(original.length-1);await moved.locator('[data-admin-media-gallery-action="replace"]').click();await page.getByRole('button',{name:/^صورة one/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await expect(field(name)).toHaveValue([...original.slice(0,-1),'/one.svg',original.at(-1)].join('\n'));await moved.locator('[data-admin-media-gallery-action="remove"]').focus();await page.keyboard.press('Space');await expect(field(name)).toHaveValue(original.join('\n'));}
    output=await saveReload();assert.deepEqual(output.config.images,family[0].config.images);assert.deepEqual(output.config.mobileImages,family[0].config.mobileImages);await publicRender(output);const dots=page.getByRole('button',{name:/^الشريحة \d+$/});assert.ok(await dots.count()>1);await dots.nth(1).focus();await page.keyboard.press('Enter');await expect(page.locator('.hero-slide-fade.opacity-100')).toHaveCount(1);await expect.poll(()=>page.locator('.hero-slide-fade.opacity-100 img').evaluateAll(es=>es.some(e=>e.complete&&e.naturalWidth>0))).toBe(true);
    await open(family.find(row=>row.id===31),'buttons');if(width!==900)await page.locator('[role="tabpanel"]:visible').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-hero-31-buttons-'+width+'.png')});const projectOrder=JSON.parse(await field('project_action_order').inputValue());await page.locator('[data-project-hero-action-card]').first().getByRole('button',{name:/لأسفل/}).click();assert.deepEqual(JSON.parse(await field('project_action_order').inputValue()),[projectOrder[1],projectOrder[0],...projectOrder.slice(2)]);for(const action of ['download','tracking','reservation']){const box=page.locator('[data-project-hero-action-card="'+action+'"] input[type="checkbox"]');await toggle(box,false);await toggle(box,true);}output=await saveReload();await publicRender(output);assert.deepEqual(await page.locator('[data-project-hero-action]').evaluateAll(es=>es.map(e=>e.dataset.projectHeroAction)),output.config.projectActionOrder);await page.reload();await ready();await panel('buttons');await toggle(page.locator('[data-project-hero-action-card="tracking"] input[type="checkbox"]'),false);output=await saveReload();await publicRender(output);await expect(page.locator('[data-project-hero-action="tracking"]')).toHaveCount(0);await expect(page.locator('[data-project-hero-action="download"]')).toHaveCount(1);await expect(page.locator('[data-project-hero-action="reservation"]')).toHaveCount(1);
    console.log('Hero representative controls '+width+': all text/format, composition, status, pages, link/anchor/target/clear, both galleries, slide navigation, project actions/order PASS');
  }
  if(!baseline&&process.argv.includes('--hero-persistence-only'))for(const width of widths){await page.setViewportSize({width,height:1100});await open(family[0],'media');
    for(const name of ['images','mobile_images']){const owner=page.locator('[data-admin-media-gallery-mode="paths"]').filter({has:field(name)}),original=(await field(name).inputValue()).split('\n');await owner.locator('[data-admin-media-gallery-action="add"]').click();await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await owner.locator('[data-admin-media-gallery-card="image"]').last().locator('[data-admin-media-gallery-action="move-up"]').click();const changed=[...original.slice(0,-1),'/replacement.svg',original.at(-1)];const output=await saveReload();assert.deepEqual(output.config[name==='images'?'images':'mobileImages'],changed);await publicRender(output);await page.reload();await ready();await panel('media');await expect(field(name)).toHaveValue(changed.join('\n'));await owner.locator('[data-admin-media-gallery-card="image"]').nth(original.length-1).locator('[data-admin-media-gallery-action="remove"]').click();const restored=await saveReload();assert.deepEqual(restored.config[name==='images'?'images':'mobileImages'],original);await panel('media');}
    await panel('display');const check=page.locator('[data-module-page-row="2"] input[type="checkbox"]');await check.focus();await page.keyboard.press('Space');await expect(check).toBeChecked();await saveReload();assert.deepEqual(savedPageIds.sort((a,b)=>a-b),[1,2]);await panel('display');await expect(check).toBeChecked();await expect(page.locator('[data-module-page-row="2"]').getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/2');await check.focus();await page.keyboard.press('Space');await saveReload();assert.deepEqual(savedPageIds,[1]);
    await panel('content');const title=rowControl('title');await title.getByRole('switch').focus();await page.keyboard.press('Space');await expect(field('show_title')).toHaveValue('false');let output=await saveReload();await publicRender(output);await expect(page.locator('h1')).toHaveCount(0);await page.reload();await ready();await panel('content');await expect(field('show_title')).toHaveValue('false');await title.getByRole('switch').focus();await page.keyboard.press('Space');output=await saveReload();await publicRender(output);await expect(page.locator('h1')).toBeVisible();console.log('Hero changed galleries/page assignments/hidden-title saved and publicly restored @'+width+' PASS');
  }
  console.log('Hero '+(baseline?'BEFORE':'AFTER')+': '+records+' record/viewport cases, '+saves+' canonical saves, '+publicRenders+' actual public renders; 9 non-adopter cases.');assert.deepEqual(errors,[]);
}

async function verifySearchFamily(){
  const labels=['النصوص','إعدادات البحث','إعدادات العرض','الظهور'],ids=['content','search','presentation','pages'];
  const textNames=['title','description','help_text','placeholder','empty_results_title','empty_results_description'];
  const formatKeys=['title','description','help_text','results_title'];
  const expectedNames=[...textNames,...formatKeys.flatMap(key=>['show_search_'+key,'search_'+key+'_bold','search_'+key+'_alignment']),'show_search_action','search_scope','result_limit','search_presentation','default_sort','content_types','search_filters'].sort();assert.equal(expectedNames.length,25);
  const widths=(process.argv.find(arg=>arg.startsWith('--search-widths='))?.split('=')[1]||'1440,900,390').split(',').map(Number);assert.ok(widths.every(width=>[1440,900,390].includes(width)));
  const family=searchFixture.records,base=family.find(row=>row.id===187),field=name=>page.locator('[name="'+name+'"]'),entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]),stable=data=>data.filter(([key])=>key!=='module_editor_tab'&&!key.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));let records=0,publicRenders=0,modes=0;
  const assigned=row=>searchFixture.assignments.filter(a=>a.template_id===row.id),publicPath=row=>assigned(row)[0].page_path;
  const open=async(row=base,active='content')=>{const {config,...block}=row;saved={block:structuredClone(block),config:searchEditorRegistry.resolveContentModuleEditorConfig({...block,config})};savedPageIds=assigned(row).map(a=>a.page_id);savedName=row.name;await page.goto(url+'?mode=search-family&tab='+active+'&returnPageId='+(savedPageIds[0]||14));await ready();};
  const panel=async id=>{if(baseline&&!process.argv.includes('--search-choice-only')){if(id==='pages')await tab('الظهور');else await page.getByRole('tab').first().click();}else await tab(labels[ids.indexOf(id)]);};
  const choose=async(name,value)=>{const owner=page.locator('[data-admin-form-listbox]').filter({has:field(name)}),native=field(name),label=await native.locator('option[value="'+value+'"]').textContent();await owner.getByRole('combobox').click();await page.getByRole('option',{name:label.trim(),exact:true}).click();await expect(owner.getByRole('combobox')).toBeFocused();};
  const rowControl=key=>page.locator('[data-module-editor-control-row]').filter({has:field('show_search_'+key)});
  const toggle=async(control,value)=>{await control.focus();if(await control.isChecked()!==value)await page.keyboard.press('Space');await expect(control).toBeChecked({checked:value});};
  const checkGroup=async(name,values)=>{for(const input of await page.locator('input[type="checkbox"][name="'+name+'"]').all())await toggle(input,values.includes(await input.inputValue()));};
  const layout=async()=>{assert.equal(await page.locator('#root').evaluate(e=>getComputedStyle(e).direction),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
  const inventory=async()=>{for(const name of expectedNames)await expect(field(name)).toHaveCount(name==='content_types'?searchContentTypes.CONTENT_TYPES.length:name==='search_filters'?searchContract.SEARCH_PLATFORM_FILTERS.length:1);for(const name of textNames){await expect(field(name)).toHaveAttribute('required','');await expect(field(name)).not.toBeDisabled();}await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);const names=await page.locator('form [name]').evaluateAll(inputs=>[...new Set(inputs.map(i=>i.name))].filter(name=>!['id','slug','internal_description','variant','style_preset','config_schema','name','status','page_ids','module_editor_tab','return_page_id','return_to'].includes(name)&&!name.startsWith('$ACTION')).sort());assert.deepEqual(names,expectedNames);await expect(field('return_page_id')).toHaveValue(new URL(page.url()).searchParams.get('returnPageId'));await expect(field('return_to')).toHaveCount(1);};
  const save=async()=>{const data=new MapFormData(await entries()),expected=saveSearchConfig(data),identity=structuredClone(saved.block),pageIds=parsePageIds(data),returnId=new URL(page.url()).searchParams.get('returnPageId');await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();assert.deepEqual(searchSavedRaw,expected);assert.deepEqual(saved.config,searchContract.asSearchPlatformConfig(expected));assert.deepEqual(saveSearchConfig(new MapFormData(await entries())),saved.config);assert.deepEqual(savedPageIds,pageIds);assert.equal(saved.block.status,parseFormStatus(data));for(const key of ['id','slug','description','variant','style_preset','updated_at'])assert.equal(saved.block[key],identity[key]);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),returnId);await inventory();return structuredClone(saved.config);};
  const publicView=async(config,path='/search',count=9)=>{searchPublicCount=count;await page.evaluate(data=>window.showSearchPublic(data),{config,path,params:{q:'عقار'}});await ready();publicRenders++;await layout();const results=path==='/search',display=config.interfaceDisplay;await expect(page.locator('[data-search-platform-module]')).toHaveAttribute('data-search-platform-module',results?'results':'launcher');const requests=await page.evaluate(()=>window.searchReadRequests),collection=requests.find(r=>r.kind==='collection');assert.ok(collection);assert.deepEqual(collection.input.contentTypes,config.scope==='all'?[...searchContentTypes.CONTENT_TYPES]:config.contentTypes);assert.equal(collection.input.pageSize,results?config.resultLimit:8);assert.equal(collection.input.sort,config.defaultSort);for(const key of ['title','description']){const element=page.locator('[data-search-interface-element="'+key+'"]');await expect(element).toHaveCount(display[key].visible?1:0);if(display[key].visible){await expect(element).toHaveText(config[key]);assert.equal(await element.evaluate(e=>getComputedStyle(e).textAlign),display[key].alignment);assert.equal(await element.evaluate(e=>getComputedStyle(e).fontWeight),display[key].bold?(key==='title'?'600':'700'):'400');}}
    const help=page.locator('[data-public-content-search-help]');await expect(help).toHaveCount(display.helpText.visible?1:0);if(display.helpText.visible){await expect(help).toHaveText(config.helpText);assert.equal(await help.evaluate(e=>getComputedStyle(e).textAlign),display.helpText.alignment);assert.equal(await help.evaluate(e=>getComputedStyle(e).fontWeight),display.helpText.bold?'700':'400');}await expect(page.locator('input[role="combobox"]')).toHaveAttribute('placeholder',config.placeholder);await expect(page.locator('[data-public-content-search-action]')).toHaveCount(display.searchAction.visible?1:0);await expect(page.locator('tag')).toHaveCount(0);
    if(results){await expect(page.locator('[data-search-result-type]')).toHaveCount(Math.min(count,config.resultLimit));for(const [key,name]of [['content-type','type'],['category','category'],['series','series']])await expect(page.locator('select[name="'+name+'"]').filter({visible:true})).toHaveCount(config.filters.includes(key)&&(key!=='content-type'||config.contentTypes.length>1)?1:0);await expect(page.locator('select[name="sort"]')).toHaveValue(config.defaultSort);const heading=page.locator('[data-search-interface-element="results-title"]');await expect(heading).toHaveCount(count&&display.resultsTitle.visible?1:0);if(count&&display.resultsTitle.visible){assert.equal(await heading.evaluate(e=>getComputedStyle(e).textAlign),display.resultsTitle.alignment);assert.equal(await heading.evaluate(e=>getComputedStyle(e).fontWeight),display.resultsTitle.bold?'700':'400');}if(!count){await expect(page.locator('[data-search-interface-element="empty-results"] h2')).toHaveText(display.emptyResults.title);await expect(page.locator('[data-search-interface-element="empty-results"] p').last()).toHaveText(display.emptyResults.description);}if(count){const resultsGrid=page.locator('[data-search-result-type]').first().locator('..');assert.equal(await resultsGrid.evaluate(e=>getComputedStyle(e).display),config.presentation==='full-list'?'block':'grid');}}
    return requests;
  };
  const defaults=async()=>{await open();const config=mediaHubFormatting.asTopicsListingConfig({});const block={...base,id:999,name:'مستهلك Topics افتراضي',slug:'topics-listing',variant:'topics-listing'};await page.evaluate(value=>window.mount('search-family',value),{block,config});await ready();await expect(page.getByRole('tab')).toHaveCount(2);await expect(field('config_schema')).toHaveValue('topics-listing');await expect(field('search_scope')).toHaveCount(0);await expect(page.locator('[data-module-editor-control-row]')).toHaveCount(7);const signature=await page.locator('[data-collection-module-editor]').evaluate(e=>({text:e.textContent,classes:[e.className,...e.querySelectorAll('section,[data-admin-form-grid],[data-collection-display-settings],[data-module-editor-control-row]')].map(n=>typeof n==='string'?n:n.className)}));const hash=createHash('sha256').update(JSON.stringify(signature)).digest('hex');assert.equal(hash,'c404445cb1cbf965c1b8b5f3e32868482d9279db4f7dfef7d7cd389326790bad','Canonical Topics default in actual ContentModuleEditClient matches frozen before source');const input=stable(await entries()),initialPresentation=await field('presentation').inputValue();await choose('presentation',initialPresentation==='list'?'grid':'list');await choose('presentation',initialPresentation);const title=page.locator('[data-module-editor-control-row]').filter({has:field('show_title_on_page')}).getByRole('switch'),checked=await title.isChecked();await toggle(title,!checked);await toggle(title,checked);assert.deepEqual(stable(await entries()),input);console.log('Search non-adopter ContentModuleEditClient/Topics '+(baseline?'BEFORE':'AFTER')+' @'+(await page.viewportSize()).width+' signature='+hash+' FormData='+createHash('sha256').update(JSON.stringify(input)).digest('hex'));await layout();};
  if(process.argv.includes('--search-choice-only')){
    for(const width of widths){await page.setViewportSize({width,height:1100});await open(family.find(row=>row.id===182));await panel('search');await inventory();await layout();
      const groupHeights=[];
      for(const [name,values]of [['content-types',searchContentTypes.CONTENT_TYPES],['filters',searchContract.SEARCH_PLATFORM_FILTERS]]){
        const group=page.locator('[data-search-platform-option-group="'+name+'"]');const columns=await group.locator('[data-admin-form-grid]').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,width>=1280?(baseline?2:3):width>=768?2:1);
        assert.deepEqual(await group.locator('input[type="checkbox"]').evaluateAll(inputs=>inputs.map(input=>input.value)),values);groupHeights.push((await group.locator('..').boundingBox()).height);
        if(!baseline)for(const input of await group.locator('input[type="checkbox"]').all()){
          const label=input.locator('xpath=ancestor::label[1]');assert.equal(await label.getAttribute('class'),ADMIN_FORM.checkboxRow);
          const box=await label.evaluate(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return{border:c.borderTopWidth,style:c.borderTopStyle,radius:c.borderTopLeftRadius,px:c.paddingInlineStart,py:c.paddingTop,bg:c.backgroundColor,height:r.height,overflow:e.scrollWidth>e.clientWidth};});assert.deepEqual({border:box.border,style:box.style,radius:box.radius,px:box.px,py:box.py},{border:'1px',style:'solid',radius:'16px',px:'16px',py:'12px'});assert.notEqual(box.bg,'rgba(0, 0, 0, 0)');assert.ok(box.height>=44);assert.equal(box.overflow,false);
        }
      }
      if(width>=768)assert.ok(Math.abs(groupHeights[0]-groupHeights[1])<1,'Shared premium group cards stretch to equal row height');
      if(width!==900)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/'+(baseline?'before':'after')+'-search-choice-'+width+'.png')});
      console.log('Search Content182 choice composition '+(baseline?'BEFORE':'AFTER')+' @'+width+' PASS');
    }
    if(baseline){assert.deepEqual(errors,[]);return;}
  }
  if(process.argv.includes('--search-checkbox-only')){
    let checkedRecords=0,transitions=0,savedStates=0;
    for(const width of widths){
      await page.setViewportSize({width,height:1100});
      for(const record of family){
        await open(record);await panel('search');await inventory();await layout();
        const initial=stable(await entries()),expected=saveSearchConfig(new MapFormData(initial));
        const controls=page.locator('[data-search-platform-option-group] input[type="checkbox"]');await expect(controls).toHaveCount(9);
        for(const input of await controls.all()){
          await expect(input).toBeVisible();await expect(input).not.toBeDisabled();
          const checked=await input.isChecked(),label=input.locator('xpath=ancestor::label[1]'),text=label.locator(':scope > span').last();
          await expect(text).toBeVisible();await expect(label.locator('label')).toHaveCount(0);
          await text.click();await expect(input).toBeChecked({checked:!checked});await expect(input).toBeFocused();
          await text.click();await expect(input).toBeChecked({checked});
          await input.focus();await page.keyboard.press('Space');await expect(input).toBeChecked({checked:!checked});await expect(input).toBeFocused();
          await page.keyboard.press('Space');await expect(input).toBeChecked({checked});transitions+=4;
          if(process.argv.includes('--search-choice-only')){
            assert.equal(await label.getAttribute('class'),ADMIN_FORM.checkboxRow);assert.equal(await input.evaluate(e=>e.matches(':focus-visible')),true);assert.equal(await input.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
            const box=await input.boundingBox();assert.equal(box.width,20);assert.equal(box.height,20);
            await page.keyboard.press('Space');const switched=await input.isChecked();assert.equal(switched,!checked);if(switched)await expect.poll(()=>input.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(216, 184, 122)');else await expect.poll(()=>input.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgb(216, 184, 122)');await page.keyboard.press('Space');await expect(input).toBeChecked({checked});transitions+=2;
          }
        }
        assert.deepEqual(stable(await entries()),initial);assert.deepEqual(saveSearchConfig(new MapFormData(await entries())),expected);checkedRecords++;
      }
      await open();
      for(const state of [{types:[...searchContentTypes.CONTENT_TYPES],filters:[...searchContract.SEARCH_PLATFORM_FILTERS]},{types:['video'],filters:[]},{types:['article'],filters:['category','series']}]){
        await panel('search');await choose('search_scope','selected');await checkGroup('content_types',state.types);await checkGroup('search_filters',state.filters);
        const draft=stable(await entries());for(const id of ids){await panel(id);assert.deepEqual(stable(await entries()),draft);}
        const result=await save();assert.equal(result.scope,'selected');assert.deepEqual(result.contentTypes,state.types);assert.deepEqual(result.filters,state.filters);await publicView(result);savedStates++;
        await page.reload();await ready();
      }
      console.log('Search checkbox native label+Space both directions: actual7 ×9 controls @'+width+' PASS;3 isolated saved selection states/public renders PASS');
    }
    assert.deepEqual(errors,[]);console.log('PASS Search checkbox refinement: '+checkedRecords+' record/viewport; '+transitions+' actual label/Space transitions; '+saves+' isolated saves/reloads; '+savedStates+' selection states; '+publicRenders+' actual public renders; '+widths.join('/')+' RTL.');return;
  }
  if(process.argv.includes('--search-visual-only')){for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await open();for(const id of ['search','presentation']){await panel(id);await layout();await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/review-search-'+id+'-'+width+'.png')});}}assert.deepEqual(errors,[]);console.log('PASS Search settings visual-only review at1440/390');return;}
  if(process.argv.includes('--search-default-only')){for(const width of widths){await page.setViewportSize({width,height:1100});await defaults();}assert.deepEqual(errors,[]);console.log('PASS actual non-Search ContentModuleEditClient defaults');return;}
  if(baseline){for(const row of family){await open(row);await expect(page.getByRole('tab')).toHaveCount(2);await inventory();assert.deepEqual(saveSearchConfig(new MapFormData(await entries())),saved.config);await publicView(saved.config,publicPath(row));records++;}for(const width of widths){await page.setViewportSize({width,height:1100});await open();await layout();if(width!==900)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/before-search-family-'+width+'.png')});await defaults();}assert.deepEqual(errors,[]);console.log('PASS Search BEFORE: '+records+' actual records/25 names +'+publicRenders+' public renders; exact default Topics consumer; screenshots2.');return;}
  for(const width of widths){await page.setViewportSize({width,height:1100});for(const row of family){await open(row);await expect(page.getByRole('tab')).toHaveText(labels);await inventory();const initial=stable(await entries());for(const id of ids){await panel(id);await layout();assert.deepEqual(stable(await entries()),initial);await expect(field('module_editor_tab')).toHaveValue(id);}await expect(page.locator('input[name="page_ids"]:checked')).toHaveCount(1);await expect(page.getByRole('link',{name:'إدارة الموضع',exact:true})).toHaveAttribute('href','/admin/pages-blocks/pages/'+assigned(row)[0].page_id);await panel('content');await save();await publicView(saved.config,publicPath(row));await open(row);
      for(const [index,name]of textNames.entries())await field(name).fill('نص '+row.id+' '+index+' *حرفي* <tag> & '+width);for(const key of formatKeys){const controls=rowControl(key);await toggle(controls.getByRole('switch'),true);const bold=controls.getByRole('button',{name:'تنسيق عريض',exact:true});if(await bold.getAttribute('aria-pressed')!=='true')await bold.click();await controls.getByRole('button',{name:width===1440?'محاذاة للوسط':width===900?'محاذاة لليسار':'محاذاة لليمين',exact:true}).click();}await toggle(rowControl('action').getByRole('switch'),true);const draft=stable(await entries());for(const id of ids){await panel(id);assert.deepEqual(stable(await entries()),draft);}const edited=await save();await publicView(edited,publicPath(row));records++;}
    await open();await panel('content');const tabs=page.getByRole('tab');await tabs.first().focus();await page.keyboard.press('End');await expect(tabs.last()).toBeFocused();await page.keyboard.press('Home');await expect(tabs.first()).toBeFocused();if(width!==900)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-search-family-'+width+'.png')});
    let index=0;for(const scope of searchContract.SEARCH_PLATFORM_SCOPES)for(const presentation of searchContract.SEARCH_PLATFORM_PRESENTATIONS){await open();await panel('search');await choose('search_scope','selected');const type=searchContentTypes.CONTENT_TYPES[index];await checkGroup('content_types',[type]);const selectedDraft=await page.locator('input[name="content_types"]:checked').evaluateAll(inputs=>inputs.map(i=>i.value));await choose('search_scope',scope);assert.deepEqual(await page.locator('input[name="content_types"]:checked').evaluateAll(inputs=>inputs.map(i=>i.value)),selectedDraft);const filters=[[],[...searchContract.SEARCH_PLATFORM_FILTERS],['content-type'],['category'],['series'],[]][index];await checkGroup('search_filters',filters);await panel('presentation');await choose('result_limit',String(searchContract.SEARCH_PLATFORM_RESULT_LIMITS[index%4]));await choose('search_presentation',presentation);await choose('default_sort',index%2?'oldest':'newest');const draft=stable(await entries());for(const id of ids){await panel(id);assert.deepEqual(stable(await entries()),draft);}await panel('search');for(const input of await page.locator('[data-search-platform-option-group] input').all())await expect(input).toBeVisible();await panel('presentation');const grids=await page.locator('[role="tabpanel"]:visible [data-admin-form-grid]').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length));assert.deepEqual(grids,[width>=1280?3:width>=768?2:1]);const result=await save();assert.equal(result.scope,scope);assert.deepEqual(result.contentTypes,scope==='all'?[...searchContentTypes.CONTENT_TYPES]:[type]);assert.equal(result.presentation,presentation);assert.deepEqual(result.filters,filters);await publicView(result);await page.locator('input[role="combobox"]').focus();await page.keyboard.press('Enter');assert.equal(new URL((await page.evaluate(()=>window.searchNavigations)).at(-1).href,url).pathname,'/search');modes++;index++;}
    await open();await panel('content');for(const key of [...formatKeys,'action'])await toggle(rowControl(key).getByRole('switch'),false);await panel('pages');const pageInput=id=>page.locator('input[type="checkbox"][name="page_ids"][value="'+id+'"]');await toggle(pageInput(14),false);await toggle(pageInput(69),true);await toggle(page.locator('input[type="checkbox"][name="status"]'),false);const hidden=await save();assert.deepEqual(savedPageIds,[69]);assert.equal(saved.block.status,'unpublished');await panel('pages');await expect(page.getByRole('link',{name:'إدارة الموضع',exact:true})).toHaveAttribute('href','/admin/pages-blocks/pages/69');await publicView(hidden);await publicView(hidden,'/search',0);await publicView(hidden,'/media-center/videos');await open();await panel('pages');await toggle(pageInput(69),true);await save();await panel('pages');await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'إدارة الموضع',exact:true})).toHaveCount(2);await defaults();console.log('Search actual7/edit/literal/plain formatting +6 scope/presentation combos +alllimits/filteroptions/status/pages/defaults @'+width+' PASS');
  }
  assert.deepEqual(errors,[]);console.log('PASS Search family: '+records+' record/viewport; '+modes+' scope/presentation/viewport; '+saves+' isolated saves/reloads; '+publicRenders+' actual public renders; '+widths.join('/')+' RTL.');
}

async function verifyFeedFamily(){
  const family=feedRecords.map(row=>({block:{id:row.id,name:row.name,slug:row.slug,description:row.description??null,status:row.status,feed_type:row.feed_type},config:row.config,pages:row.id===5?[]:[4]}));
  const labels=['مصدر المحتوى','النصوص','إعدادات العرض','تنسيق عناصر المحتوى','الظهور'],ids=['content','text','presentation','formatting','pages'];
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]),field=name=>page.locator('[name="'+name+'"]');
  const stable=input=>input.filter(([key])=>key!=='module_editor_tab'&&!key.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const open=async(row,active='content',options=feedActualFilterOptions)=>{feedFilterOptions=structuredClone(options);saved={block:structuredClone(row.block),config:feedContract.parseFeedModuleConfig(structuredClone(row.config),row.block.feed_type)};savedName=row.block.name;savedPageIds=[...row.pages];await page.goto(url+'?mode=feed-family&tab='+active+(row.pages[0]?'&returnPageId='+row.pages[0]:''));await ready();};
  const layout=async()=>{assert.equal(await page.locator('#root').evaluate(e=>getComputedStyle(e).direction),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
  const save=async()=>{const data=new MapFormData(await entries()),expected=await saveFeedConfig(data),identity={...saved.block},pages=parsePageIds(data),type=feedSaveOwners.readFeedType(data.get('feed_type')),returnPageId=new URL(page.url()).searchParams.get('returnPageId');await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();assert.deepEqual(saved.config,expected);assert.deepEqual(savedPageIds,pages);assert.equal(saved.block.feed_type,type);assert.equal(saved.block.status,parseFormStatus(data));for(const key of ['id','slug','description'])assert.equal(saved.block[key],identity[key]);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),returnPageId);assert.deepEqual(await saveFeedConfig(new MapFormData(await entries())),expected);assert.deepEqual(feedContract.parseFeedModuleConfig(JSON.parse(JSON.stringify(expected)),type),expected);return structuredClone(expected);};
  const choose=async(name,label)=>{const control=page.locator('[data-admin-form-listbox]').filter({has:field(name)}).getByRole('combobox');await control.click();await page.getByRole('option',{name:label,exact:true}).click();await expect(control).toBeFocused();};
  const rowControl=name=>page.locator('[data-module-editor-control-row]').filter({has:field('show_'+name)});
  const setSwitch=async(locator,value)=>{await locator.focus();if(await locator.isChecked()!==value)await page.keyboard.press('Space');await expect(locator).toBeChecked({checked:value});};
  const publicView=async(type,config,count=9)=>{feedPayloadCount=count;feedExpectedRead={kind:type==='latest'||type==='popular'?'articles':type,input:type==='latest'||type==='popular'?{contentTypes:['article'],categorySlugs:config.query.categorySlugs,seriesSlugs:config.query.seriesSlugs,page:1,pageSize:config.query.limit,sort:type==='popular'?'most-viewed':'newest',excludeIds:[991]}:{limit:config.query.limit,categorySlugs:config.query.categorySlugs,seriesSlugs:config.query.seriesSlugs}};await page.evaluate(data=>window.showFeedPublic(data),{type,config,excludeIds:[991]});await ready();const payload=await page.evaluate(()=>window.feedResolved);assert.equal(payload.kind,feedExpectedRead.kind);assert.equal(payload.items.length,Math.min(count,config.query.limit));await layout();return payload;};
  const snapshot=()=>page.locator('#root').evaluate(e=>({text:e.textContent,links:[...e.querySelectorAll('a')].map(a=>a.getAttribute('href')),images:[...e.querySelectorAll('img')].map(img=>({src:img.getAttribute('src'),alt:img.alt})),presentation:e.querySelector('[data-feed-presentation]')?.getAttribute('data-feed-presentation')}));
  const displayNames={latest:['image','article_title','article_excerpt','article_date'],popular:['image','article_title','article_excerpt','article_date'],categories:['category','count'],series:['image','series','description','details']};
  const allDisplayNames=['image','article_title','article_excerpt','article_date','category','count','series','description','details'];


  if(feedLayoutOnly){
    const canonicalModeHashes={'latest/slider':'8330c1718126ea501f7bff34aed43c0cbc9c99d6e5bca4ccd530df8b6e134f54','latest/grid':'eb60972c8b3491180a02beab8cdbdb03fa267fcef21f61440b66941693e6ed0b','latest/list':'e492c9e62a3dda580238454a47a4aaa93e5cb56d6874d9bf664808502df76a77','popular/grid':'455edddf56886075283aa56e54f75178267e93bb469514ac1ec1a8bc16c76409','popular/list':'87f49179165467ab6f07b4dd8f2b348662c1f5164b04d122a3bfaf00b5d70c88','categories/grid':'995f9166677bff6f0f36e3e630e21927a9a1481ce946aa15485a8915ae0ce084','categories/list':'7e45cb8850bd29243453c0b0071d4501b779815fac18c8ff25da5924f8ce19f6','series/slider':'b76af7c261f0d69e068badfcaaa72e3157f74bf8497bbde2327465d0c719fdff','series/grid':'a8555fe46c2629edc3082cc9b65e4ebccc2b42601bde8906f4fbaf8dab5fc920','series/list':'0bd94f30a32acb87cac7e8d67c7f6cf3c250467637158d144ff8f08fac627e3d'};
    if(!baseline)await page.clock.install();
    const widths=(process.argv.find(arg=>arg.startsWith('--feed-widths='))?.split('=')[1]||'1440,900,390').split(',').map(Number);assert.ok(widths.every(width=>[1440,900,390].includes(width)));let records=0,modes=0,publicRenders=0;
    const publicCards=type=>page.locator(type==='categories'?'[data-feed-category-card]':type==='series'?'[data-feed-series-card]':'[data-feed-article-card="'+type+'"]');
    const switchField=name=>page.locator('input[type="checkbox"][name="'+name+'"]');
    const activeNamedControls=()=>page.locator('[data-feed-presentation-controls]').evaluate(root=>[...root.querySelectorAll('[name]')].flatMap(input=>{const control=input.type==='hidden'?input.closest('[data-admin-form-listbox]'):input;if(!control||!control.getClientRects().length||getComputedStyle(control).visibility==='hidden')return [];return [input.name];}).sort());
    const geometry=()=>page.locator('[data-feed-presentation-controls] [data-admin-form-grid]').evaluateAll(grids=>grids.filter(grid=>grid.getClientRects().length).map(grid=>{const style=getComputedStyle(grid),rect=grid.getBoundingClientRect();function items(node){return [...node.children].flatMap(child=>getComputedStyle(child).display==='contents'?items(child):child.getClientRects().length?[child]:[]);}return {columns:style.gridTemplateColumns.split(' ').length,width:rect.width,gap:parseFloat(style.columnGap),items:items(grid).map(item=>{const r=item.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,tag:item.tagName,classes:item.className,headers:item.querySelectorAll('[data-admin-form-control-header]').length,nestedSections:item.querySelectorAll('section').length};})};}));
    for(const width of process.argv.includes('--feed-default-only')?[]:widths){await page.setViewportSize({width,height:1100});for(const row of family){await open(row,feedHeadBaseline?'content':'presentation');const before=new MapFormData(await entries()),canonical=await saveFeedConfig(before);for(const name of allDisplayNames)await expect(field('show_'+name)).toHaveCount(1);for(const type of feedTypes.TOPICS_FEED_TYPES)await expect(field(type+'_layout')).toHaveCount(1);if(!baseline){const after=await save();assert.deepEqual(after,canonical);await publicView(row.block.feed_type,after);publicRenders++;}records++;}
      for(const type of feedTypes.TOPICS_FEED_TYPES)for(const mode of type==='popular'||type==='categories'?['grid','list']:['slider','grid','list']){await open(family[1]);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);if(!feedHeadBaseline)await tab('إعدادات العرض');await choose(type+'_layout',mode[0].toUpperCase()+mode.slice(1));await field('limit').fill('9');
        const expected=['limit',type+'_layout'];if(mode==='list'){expected.push(type+'_list_items_per_group',type+'_list_show_dots',type+'_list_interval_seconds');await field(type+'_list_items_per_group').fill('2');await field(type+'_list_interval_seconds').fill('7');await setSwitch(switchField(type+'_list_show_dots'),true);}else if(mode==='grid'||type==='latest'){expected.push(type+(type==='latest'?'_density':'_columns'));await choose(type+(type==='latest'?'_density':'_columns'),'2');}if(mode==='slider'){expected.push(type+'_show_arrows');await setSwitch(switchField(type+'_show_arrows'),true);if(type==='latest'){expected.push('latest_show_dots');await setSwitch(switchField('latest_show_dots'),true);}}
        assert.deepEqual(await activeNamedControls(),expected.sort(),type+'/'+mode+' visible controls match pre-adoption contract');await layout();const grids=await geometry();if(!baseline){assert.equal(grids.length,1,'One shared grid owns all specialized controls');for(const grid of grids){assert.equal(grid.columns,width>=1280?3:width>=768?2:1,'Shared3/2/1 responsive contract');const widthPer=(grid.width-(grid.columns-1)*grid.gap)/grid.columns;for(const item of grid.items)assert.ok(Math.abs(item.width-widthPer)<2,'Every visible grid control consumes exactly one configured column');for(let index=1;index<grid.items.length;index++){const prev=grid.items[index-1],current=grid.items[index];if(index%grid.columns){assert.ok(current.y<prev.y+prev.height&&prev.y<current.y+current.height,'No artificial row break before the configured column is filled');assert.ok(current.x<prev.x,'RTL source order remains right to left');}}}}

        if(feedPremiumOnly){for(const name of expected){const numeric=page.locator('input[type="number"][name="'+name+'"]');if(await numeric.count()){await numeric.focus();await expect(numeric).toBeFocused();}const checkbox=page.locator('input[type="checkbox"][name="'+name+'"]');if(await checkbox.count()){const checked=await checkbox.isChecked();await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked({checked:!checked});await page.keyboard.press('Space');await expect(checkbox).toBeChecked({checked});if(!baseline){const label=checkbox.locator('xpath=ancestor::label[1]'),card=checkbox.locator('xpath=ancestor::section[1]'),text=card.locator('[data-admin-form-control-header] .font-semibold');await text.click();await expect(checkbox).toBeChecked({checked:!checked});await text.click();await expect(checkbox).toBeChecked({checked});await expect(card.getByText((await text.textContent()).trim(),{exact:true})).toHaveCount(1);const described=await checkbox.getAttribute('aria-describedby');if(described)await expect(page.locator('[id="'+described+'"]')).toBeVisible();if(feedToggleOnly){const title=(await text.textContent()).trim();await expect(checkbox).toHaveAccessibleName(title);await expect(label).toHaveAttribute('data-admin-form-switch-surface','embedded');if(described)await expect(checkbox).toHaveAccessibleDescription((await page.locator('[id="'+described+'"]').textContent()).trim());const measures=await checkbox.evaluate(input=>{const label=input.closest('label'),card=input.closest('section'),track=input.closest('span.relative'),row=track.parentElement,thumb=track.lastElementChild,header=label.querySelector('[data-admin-form-control-header]'),title=header.querySelector('.font-semibold'),style=getComputedStyle(label),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};return {label:rect(label),card:rect(card),track:rect(track),row:rect(row),thumb:rect(thumb),header:rect(header),font:getComputedStyle(title).fontSize,weight:getComputedStyle(title).fontWeight,border:style.borderWidth,background:style.backgroundColor};});assert.deepEqual([measures.track.width,measures.track.height],[36,20]);assert.deepEqual([measures.thumb.width,measures.thumb.height],[16,16]);assert.equal(measures.font,'14px');assert.equal(measures.weight,'600');assert.equal(measures.border,'0px');assert.equal(measures.background,'rgba(0, 0, 0, 0)');assert.ok(measures.label.width>=44&&measures.label.height>=44,'Native label provides the full card hit area');assert.ok(measures.row.height>=44,'Toggle shares standard control-row height');assert.ok(measures.row.y>=measures.header.bottom,'Header precedes the separate control row');assert.ok(Math.abs(measures.row.bottom-measures.label.bottom)<2,'Control row is bottom aligned inside the card');assert.ok(Math.abs(measures.row.right-measures.label.right)<2,'Control starts at RTL edge');}}}}
          if(!baseline){const scope=page.locator('[data-feed-presentation-controls]');await expect(scope.locator('label label')).toHaveCount(0);const mountedNames=await scope.locator('[name]').evaluateAll(nodes=>new Set(nodes.map(node=>node.name)).size);await expect(scope.locator('[data-admin-form-grid] section')).toHaveCount(mountedNames);await expect(scope.locator('[data-admin-form-control-header]')).toHaveCount(mountedNames);assert.equal(grids[0].items.length,expected.length,'Every actual setting gets exactly one visible shared card');for(const item of grids[0].items){assert.equal(item.tag,'SECTION');for(const token of ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME.split(' '))assert.ok(item.classes.split(' ').includes(token),'Card consumes the exact shared premium surface token');assert.equal(item.headers,1,'Exactly one shared header per setting');assert.equal(item.nestedSections,0,'No nested setting card');}for(let index=1;index<grids[0].items.length;index++){if(index%grids[0].columns)assert.ok(Math.abs(grids[0].items[index].height-grids[0].items[index-1].height)<2,'Cards in each row share natural stretched height');}}
        }
        if(width===1440)console.log('Feed '+(feedHeadBaseline?'HEAD':baseline?'BEFORE':'AFTER')+' '+type+'/'+mode+' controls='+expected.join(',')+' grids='+grids.map(grid=>grid.columns+'cols/'+grid.items.length+'items').join(';'));
        if(!feedHeadBaseline&&type==='latest'&&mode==='list'&&width!==900)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/'+(baseline?'before':'after')+(feedToggleOnly?'-feed-toggle-refinement-':feedPremiumOnly?'-feed-premium-settings-':'-feed-layout-')+width+'.png')});
        if(!feedHeadBaseline)await tab('تنسيق عناصر المحتوى');for(const name of allDisplayNames){await expect(rowControl(name)).toBeVisible({visible:displayNames[type].includes(name)});}if(type==='categories'){for(const name of ['category','count']){await setSwitch(rowControl(name).getByRole('switch'),true);await rowControl(name).getByRole('button',{name:'محاذاة للوسط',exact:true}).click();}}
        const draft=stable(await entries()),canonical=await saveFeedConfig(new MapFormData(draft));const digest=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');assert.equal(digest,canonicalModeHashes[type+'/'+mode],'Exact canonical payload matches actual pre-adoption HEAD interaction');if(width===1440)console.log('Feed reconciliation '+type+'/'+mode+' canonical='+digest);
        if(!baseline){await tab('مصدر المحتوى');await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type==='series'?'latest':'series']);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);assert.deepEqual(stable(await entries()),draft);await tab('الظهور');const config=await save();assert.deepEqual(config,canonical);await publicView(type,config);publicRenders++;await expect(page.locator('[data-feed-presentation]')).toHaveAttribute('data-feed-presentation',mode);const groupSize=mode==='list'?2:mode==='grid'?9:type==='series'?1:2;await expect(publicCards(type)).toHaveCount(groupSize);if(mode==='list'){await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-group-count','5');const last=page.locator('[data-feed-carousel-dots] button').last();await last.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-active-group','4');await expect(publicCards(type)).toHaveCount(1);}if(type==='categories'){await expect(page.locator('[data-feed-category-name]').first()).toBeVisible();await expect(page.locator('[data-feed-category-count]').first()).toBeVisible();assert.equal(await page.locator('[data-feed-category-name]').first().evaluate(e=>getComputedStyle(e).textAlign),'center');assert.equal(await page.locator('[data-feed-category-count]').first().evaluate(e=>getComputedStyle(e).textAlign),'center');}}
        if(feedToggleOnly&&!baseline&&expected.some(name=>name.includes('_show_'))){if(mode==='slider')await expect(page.locator('[data-feed-carousel-navigation]')).toHaveCount(1);if(mode==='list'||type==='latest')await expect(page.locator('[data-feed-carousel-dots]')).toHaveCount(1);await open({block:saved.block,config:saved.config,pages:savedPageIds},'presentation');const toggles=expected.filter(name=>name.includes('_show_'));for(const name of toggles){await expect(switchField(name)).toBeChecked();await setSwitch(switchField(name),false);}const inactiveDraft=stable(await entries());await tab('النصوص');await tab('إعدادات العرض');assert.deepEqual(stable(await entries()),inactiveDraft);const off=await save();for(const name of toggles)await expect(switchField(name)).not.toBeChecked();if(mode==='list')assert.equal(off.presentation.variants[type].list.showDots,false);else {assert.equal(off.presentation.variants[type].showArrows,false);if(type==='latest')assert.equal(off.presentation.variants[type].showDots,false);}await publicView(type,off);publicRenders++;await expect(page.locator('[data-feed-carousel-navigation]')).toHaveCount(0);await expect(page.locator('[data-feed-carousel-dots]')).toHaveCount(0);}
        if(!baseline&&!feedPremiumOnly&&width===1440&&mode==='list'){for(const seconds of [7,3]){await page.clock.resume();await page.emulateMedia({reducedMotion:'reduce'});await open({block:saved.block,config:saved.config,pages:savedPageIds},'presentation');await field(type+'_list_interval_seconds').fill(String(seconds));const timed=await save();assert.equal(timed.presentation.variants[type].list.intervalSeconds,seconds);await page.emulateMedia({reducedMotion:'no-preference'});await publicView(type,timed);publicRenders++;await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));await page.clock.runFor(seconds*1000-300);await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-active-group','0');await page.clock.runFor(500);await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-active-group','1');await page.locator('[data-feed-carousel-dots] button').first().focus();await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-autoplay','stopped');await page.clock.runFor(seconds*1000+100);await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-active-group','1');}await page.clock.resume();await page.emulateMedia({reducedMotion:'reduce'});console.log('Feed '+type+' List saved durations7s/3s change actual autoplay timing; focus stops both PASS');}
        modes++;
      }
    }

    if(feedPremiumOnly){if(process.argv.includes('--feed-default-only'))await open(family[1]);for(const width of widths){await page.setViewportSize({width,height:1100});const topics={collection:{type:'all'},presentation:'grid',itemsPerRow:3,itemLimit:6,display:mediaHubFormatting.resolveCollectionModuleDisplayFormatting({})};await page.evaluate(config=>window.mount('topics-default',config),topics);await ready();const consumer=page.locator('[data-collection-module-editor]'),rows=consumer.locator('[data-module-editor-control-row]');await expect(rows).toHaveCount(7);await expect(consumer.locator('[data-admin-form-control-header]')).toHaveCount(0);await expect(consumer.getByText('إعدادات القائمة',{exact:true})).toHaveCount(1);await expect(consumer.getByText('إعدادات العرض',{exact:true})).toHaveCount(1);assert.equal(await consumer.locator('[data-collection-display-settings]').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=768?3:1);const initial=stable(await entries());await choose('presentation','قائمة');await expect(page.locator('input[name="items_per_row"]')).toHaveValue('3');await choose('presentation','شبكة');await expect(page.locator('select[name="items_per_row"]')).toHaveValue('3');assert.deepEqual(stable(await entries()),initial);const titleSwitch=rows.filter({has:field('show_title_on_page')}).getByRole('switch');await titleSwitch.focus();await page.keyboard.press('Space');await expect(titleSwitch).not.toBeChecked();await page.keyboard.press('Space');await expect(titleSwitch).toBeChecked();assert.deepEqual(stable(await entries()),initial);await layout();const signature=await consumer.evaluate(e=>({text:e.textContent,classes:[e.className,...e.querySelectorAll('section,[data-admin-form-grid],[data-collection-display-settings],[data-module-editor-control-row]')].map(value=>typeof value==='string'?value:value.className)}));const defaultHash=createHash('sha256').update(JSON.stringify(signature)).digest('hex');assert.equal(defaultHash,'901bdd1dfa1bcea1127a231794b2fff10b15393af13af99b9f00b2b27c456425','Actual Topics default composition and text match before baseline');console.log('Feed premium non-adopter Topics '+(baseline?'BEFORE':'AFTER')+' @'+width+' signature='+defaultHash+' default layout + Grid/List + keyboard + FormData PASS');}}
    if(feedToggleOnly){for(const width of widths){await page.setViewportSize({width,height:1100});for(const checked of [true,false]){await page.evaluate(data=>window.mount('feed-switch-default',data),{checked});await ready();const controls=page.locator('input[type="checkbox"]');await expect(controls).toHaveCount(3);const signature=await controls.evaluateAll(inputs=>inputs.map(input=>{const label=input.closest('label'),track=input.closest('span.relative'),style=getComputedStyle(label),box=track.getBoundingClientRect();return {name:input.name,classes:label.className,kind:label.dataset.adminFormSwitchSurface,trackClasses:track.className,track:[box.width,box.height],font:style.fontSize,border:style.borderWidth,background:style.backgroundColor};}));const hash=createHash('sha256').update(JSON.stringify(signature)).digest('hex');assert.equal(hash,'b60144218ea44c582f8dd24bc4adf508b08496985feff4094ab636ab19ce7642','Actual compact/card/disabled switch appearance matches frozen before owner');console.log('Feed shared switch defaults '+(baseline?'BEFORE':'AFTER')+' @'+width+' checked='+checked+' signature='+hash);for(const name of ['default_compact','default_surface']){const control=field(name);await expect(control).toBeChecked({checked});const label=control.locator('xpath=ancestor::label[1]');await label.click();await expect(control).toBeChecked({checked:!checked});await control.focus();await page.keyboard.press('Space');await expect(control).toBeChecked({checked});}await expect(field('default_disabled')).toBeDisabled();const form=new MapFormData(await entries());assert.deepEqual(form.getAll('default_compact'),checked?['on']:[]);assert.deepEqual(form.getAll('default_surface'),checked?['on']:[]);assert.deepEqual(form.getAll('default_disabled'),[]);await layout();}}}
    assert.deepEqual(errors,[]);console.log('PASS Feed layout reconciliation '+(feedHeadBaseline?'HEAD':baseline?'BEFORE':'AFTER')+': '+records+' actual row/viewport + '+modes+' mode/viewport; '+publicRenders+' real public renders; '+saves+' isolated saves; '+widths.join('/')+' RTL.');return;
  }
  if(process.argv.includes('--feed-validation-only')){await open(family[1],baseline?'content':'text');await field('widget_title').fill('');const before=saves;await tab(baseline?'الظهور':'مصدر المحتوى');await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();assert.equal(saves,before);assert.equal(await field('widget_title').evaluate(e=>e.validity.valueMissing),true);const focused=await field('widget_title').evaluate(e=>e===document.activeElement),visible=await field('widget_title').isVisible();console.log('Feed hidden required title '+(baseline?'BEFORE pages':'AFTER content')+': submission blocked='+String(saves===before)+', visible='+visible+', focused='+focused);assert.deepEqual(errors,[]);return;}
  if(baseline){for(const row of family){await open(row);await expect(page.getByRole('tab')).toHaveCount(2);const before=new MapFormData(await entries()),output=await saveFeedConfig(before);assert.equal(output.query.limit,Math.min(60,row.config.query.limit));assert.deepEqual(output.query.seriesSlugs,feedContract.parseFeedModuleConfig(row.config,row.block.feed_type).query.seriesSlugs);for(const type of feedTypes.TOPICS_FEED_TYPES)await expect(field(type+'_layout')).toHaveCount(1);for(const name of allDisplayNames)await expect(field('show_'+name)).toHaveCount(1);console.log('Feed baseline canonical row '+row.block.id+' '+createHash('sha256').update(JSON.stringify(output)).digest('hex'));}for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await open(family[1]);await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/before-feed-family-'+width+'.png')});}assert.deepEqual(errors,[]);console.log('PASS Feed baseline: all5 actual records, all capabilities reachable; raw94 normalizes60 under existing parser; screenshots2; no DB writes.');return;}

  const recordOnly=process.argv.includes('--feed-records-only'),matrixOnly=process.argv.includes('--feed-matrix-only'),extrasOnly=process.argv.includes('--feed-extras-only'),widths=(process.argv.find(arg=>arg.startsWith('--feed-widths='))?.split('=')[1]||'1440,900,390').split(',').map(Number);assert.ok(widths.length&&widths.every(w=>[1440,900,390].includes(w)));
  const beforeHashes=['26db410c11c0fb1aa207bb1d57615e5a6eb0ad0b83b4936167a7d6fe95191152','baa41840db544196f3e292b5b2fd060a2b7333e8e0f2efe5e385c82b2b1b3162','736ea2f89598e98ecfec0eace32521ec818e703253df3801b9d3bbd34488174f','1ab566170401129f67a51a9a06944814511feba938ef12ed4085195a8d45729e','1e2c9472fa4af71a40523eea428bcf3f4cb70236dc58f742e84484081a29727d'];
  const panel=id=>page.getByRole('tabpanel',{name:labels[ids.indexOf(id)],exact:true,includeHidden:true});
  let publicCases=0,modeCases=0,recordCases=0;
  const view=async(type,config,count=9)=>{publicCases++;return publicView(type,config,count);};
  const fieldSwitch=name=>page.locator('input[type="checkbox"][name="'+name+'"]');
  const publicCards=type=>page.locator(type==='categories'?'[data-feed-category-card]':type==='series'?'[data-feed-series-card]':'[data-feed-article-card="'+type+'"]');
  const navigateAll=async(type,config,count)=>{
    const variant=config.presentation.variants[type],mode=variant.layout,visible=mode==='grid'?count:mode==='list'?variant.list.itemsPerGroup:type==='series'?1:variant.density;
    const groups=Math.ceil(count/visible),seen=new Set(),collect=async()=>{for(const href of await publicCards(type).evaluateAll(nodes=>nodes.map(e=>e.matches('a')?e.getAttribute('href'):e.querySelector('a')?.getAttribute('href'))))seen.add(href);};
    await expect(publicCards(type)).toHaveCount(Math.min(count,visible));await collect();
    if(mode==='grid')await expect(page.locator('[data-feed-grid-columns]')).toHaveAttribute('data-feed-grid-columns',String(type==='latest'?variant.density:variant.columns));
    if(mode==='list'){
      await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-group-count',String(groups));
      for(let group=1;group<groups;group++){const dot=page.locator('[data-feed-carousel-dots] button').filter({hasText:''}).nth(group);await dot.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-active-group',String(group));await collect();}
      if(groups>1)await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-autoplay','stopped');
    }else if(mode==='slider'){
      const next=page.getByRole('button',{name:type==='series'?'عرض السلسلة التالية':'عرض المجموعة التالية',exact:true});
      for(let group=1;group<groups;group++){await next.focus();await page.keyboard.press('Enter');await collect();}
      if(groups>1){await page.getByRole('button',{name:type==='series'?'عرض السلسلة السابقة':'عرض المجموعة السابقة',exact:true}).click();await expect(publicCards(type)).toHaveCount(visible);}
      if(type==='series')await expect(page.locator('[data-feed-carousel-dots]')).toHaveCount(0);
      else if(groups>1){await page.locator('[data-feed-carousel-dots] button').first().click();await expect(page.locator('[aria-roledescription="slide"]')).toHaveAttribute('aria-label','مجموعة 1 من '+groups);}
    }
    assert.equal(seen.size,count,'All allowed '+type+' '+mode+' items reached through actual controls');
    for(const img of await page.locator('#root img').all()){await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);}
  };
  for(const width of widths){await page.setViewportSize({width,height:1100});
    if(!matrixOnly&&!extrasOnly)for(const row of family){await open(row);assert.deepEqual(await page.getByRole('tab').allTextContents(),labels);const initial=stable(await entries()),canonical=await saveFeedConfig(new MapFormData(initial));assert.equal(createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),beforeHashes[row.block.id-1]);
      for(const id of ids){await tab(labels[ids.indexOf(id)]);await expect(field('module_editor_tab')).toHaveValue(id);await expect(panel(id)).toBeVisible();assert.deepEqual(stable(await entries()),initial);await layout();}
      for(const id of row.pages){const assigned=page.locator('[data-module-page-row="'+id+'"]');await expect(assigned.getByRole('checkbox')).toBeChecked();await expect(assigned.getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/'+id);}
      await view(row.block.feed_type,canonical);const beforePublic=await snapshot();await open(row,'pages');const noOp=await save();await view(row.block.feed_type,noOp);assert.deepEqual(await snapshot(),beforePublic);
      await open(row,'text');await field('widget_title').fill('عنوان '+row.block.id+' *حرفي* <tag> &');await field('eyebrow').fill('تمهيد '+width);await rowControl('title').getByRole('button',{name:'محاذاة للوسط',exact:true}).click();await tab('إعدادات العرض');await field('limit').fill(String(row.block.id===1?60:row.block.id));await tab('الظهور');const edited=await save();assert.equal(edited.presentation.title,'عنوان '+row.block.id+' *حرفي* <tag> &');assert.equal(edited.presentation.titleAlignment,'center');assert.equal(edited.presentation.eyebrow,'تمهيد '+width);await view(row.block.feed_type,edited);await expect(page.getByRole('heading',{name:edited.presentation.title,exact:true})).toBeVisible();
      if(row.block.id===2&&width!==900){await open(row,'presentation');await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-feed-family-presentation-'+width+'.png')});if(width===1440){await tab('مصدر المحتوى');await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-feed-family-source-1440.png')});await tab('تنسيق عناصر المحتوى');await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-feed-family-formatting-1440.png')});}}
      recordCases++;console.log('Feed record '+row.block.id+' @'+width+' canonical before/after + tabs + 2 saves + public PASS');
    }
    if(!recordOnly&&!extrasOnly)for(const type of feedTypes.TOPICS_FEED_TYPES){for(const mode of type==='popular'||type==='categories'?['grid','list']:['slider','grid','list']){
      await open(family[1]);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);await tab('إعدادات العرض');await expect(page.locator('[data-feed-presentation-controls-active="true"]')).toHaveAttribute('data-feed-presentation-controls-for',type);await choose(type+'_layout',mode[0].toUpperCase()+mode.slice(1));await field('limit').fill('9');
      const variants=page.locator('[data-feed-presentation-controls-for]');await expect(variants).toHaveCount(4);for(const inactive of feedTypes.TOPICS_FEED_TYPES.filter(value=>value!==type))await expect(page.locator('[data-feed-presentation-controls-for="'+inactive+'"]')).toBeHidden();
      if(mode==='list'){await field(type+'_list_items_per_group').fill('2');await field(type+'_list_interval_seconds').fill('3');await setSwitch(fieldSwitch(type+'_list_show_dots'),true);}else if(mode==='grid'||type==='latest'){for(const density of ['1','2','3'])await choose(type+(type==='latest'?'_density':'_columns'),density);}
      if(mode==='slider'){await setSwitch(fieldSwitch(type+'_show_arrows'),true);if(type==='latest')await setSwitch(fieldSwitch('latest_show_dots'),true);await expect(field('series_show_dots')).toHaveCount(0);}
      await expect(page.locator('[data-feed-list-settings-for="'+type+'"]')).toBeVisible({visible:mode==='list'});
      await tab('تنسيق عناصر المحتوى');for(const name of allDisplayNames){await expect(rowControl(name)).toBeVisible({visible:displayNames[type].includes(name)});await expect(rowControl(name)).toHaveCount(1);}
      for(const name of displayNames[type]){await setSwitch(rowControl(name).getByRole('switch'),true);if(name!=='image'){const bold=rowControl(name).getByRole('button',{name:'تنسيق عريض',exact:true});if(await bold.getAttribute('aria-pressed')!=='true')await bold.click();await rowControl(name).getByRole('button',{name:'محاذاة لليسار',exact:true}).click();}}
      if(type==='series')await field('link_text').fill('اقرأ السلسلة');const draft=stable(await entries());await tab('مصدر المحتوى');await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type==='latest'?'series':'latest']);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);assert.deepEqual(stable(await entries()),draft);await tab('الظهور');const config=await save();assert.equal(config.presentation.variants[type].layout,mode);assert.equal(config.query.limit,9);
      for(const count of [1,4,9]){await view(type,config,count);await expect(page.locator('[data-feed-presentation]')).toHaveAttribute('data-feed-presentation',mode);await navigateAll(type,config,count);const markers={article_title:'article-title',article_excerpt:'article-excerpt',article_date:'article-date',category:'category-name',count:'category-count',series:'series-title',description:'series-description',details:'series-details'};for(const name of displayNames[type].filter(name=>name!=='image')){const element=page.locator('[data-feed-'+markers[name]+']').first();await expect(element).toBeVisible();assert.equal(await element.evaluate(e=>getComputedStyle(e).fontWeight),'700');assert.equal(await element.evaluate(e=>getComputedStyle(e).textAlign),'left');}if(type==='series')await expect(page.locator('[data-feed-series-details]').first()).toHaveText('اقرأ السلسلة');}
      modeCases++;console.log('Feed '+type+'/'+mode+' @'+width+' controls + Save/Reload + capacity1/4/9/navigation PASS');
    }}
    if(!recordOnly&&!matrixOnly){
      await open(family[3]);const category=slug=>page.locator('input[type="checkbox"][name="category_slugs"][value="'+slug+'"]');await setSwitch(category('topics'),true);await setSwitch(category('bait-al-watan'),true);await setSwitch(category('akhtbar-tsnyf'),true);const actualSeries=feedActualFilterRows.series;await expect(page.locator('[data-feed-series-option]')).toHaveCount(actualSeries.length);const first=actualSeries.find(item=>item.category_id===2).slug,other=actualSeries.find(item=>item.category_id===1313).slug;await setSwitch(page.locator('[data-feed-series-option="'+first+'"]'),true);await setSwitch(page.locator('[data-feed-series-option="'+other+'"]'),true);await setSwitch(category('bait-al-watan'),false);await expect(page.locator('[data-feed-series-option="'+first+'"]')).toBeChecked();await setSwitch(category('topics'),false);await expect(page.locator('[data-feed-series-option="'+first+'"]')).toHaveCount(0);await expect(page.locator('[data-feed-series-option="'+other+'"]')).toBeChecked();let config=await save();assert.deepEqual(config.query.categorySlugs,['akhtbar-tsnyf']);assert.deepEqual(config.query.seriesSlugs,[other]);await tab('مصدر المحتوى');await setSwitch(page.locator('[data-feed-series-all]'),true);config=await save();assert.deepEqual(config.query.seriesSlugs,[]);await tab('مصدر المحتوى');await setSwitch(category('akhtbar-tsnyf'),false);config=await save();assert.deepEqual(config.query.categorySlugs,[]);assert.deepEqual(config.query.seriesSlugs,[]);await view('series',config);
      for(const type of feedTypes.TOPICS_FEED_TYPES){await open(family[3]);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);await tab('تنسيق عناصر المحتوى');for(const name of displayNames[type])await setSwitch(rowControl(name).getByRole('switch'),false);const hiddenConfig=await save();await view(type,hiddenConfig);await expect(page.locator('[data-feed-article-title],[data-feed-article-excerpt],[data-feed-article-date],[data-feed-category-name],[data-feed-category-count],[data-feed-series-title],[data-feed-series-description],[data-feed-series-details],#root img')).toHaveCount(0);await view(type,hiddenConfig,0);await expect(page.locator('[data-feed-presentation]')).toHaveCount(0);}
      await open({...family[1],pages:[2,4]},'pages');await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'مدير الصفحة',exact:true})).toHaveCount(2);const about=page.locator('[data-module-page-row="2"]').getByRole('checkbox');await about.focus();await page.keyboard.press('Space');await save();assert.deepEqual(savedPageIds,[4]);await tab('الظهور');await about.focus();await page.keyboard.press('Space');await save();assert.deepEqual(savedPageIds,[2,4]);
      await open(family[4],'text');await field('widget_title').focus();await expect(field('widget_title')).toBeFocused();await field('widget_title').fill('');assert.equal(await field('widget_title').evaluate(e=>e.checkValidity()),false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await expect(field('widget_title')).toBeFocused();await field('widget_title').fill('عنوان صالح');await tab('إعدادات العرض');for(const invalid of ['0','61','1.5']){await field('limit').fill(invalid);assert.equal(await field('limit').evaluate(e=>e.checkValidity()),false);const invalidData=new MapFormData(await entries());await assert.rejects(()=>saveFeedConfig(invalidData),/./);}await field('limit').fill('1');await save();assert.equal(saved.config.query.limit,1);await tab('إعدادات العرض');await field('limit').fill('60');await save();assert.equal(saved.config.query.limit,60);
      const tabs=page.getByRole('tab');await tabs.first().focus();await page.keyboard.press('End');await expect(tabs.last()).toBeFocused();await page.keyboard.press('Home');await expect(tabs.first()).toBeFocused();await layout();console.log('Feed filter pruning/dedup/all, all9 formatting off, assignment banner, boundaries + keyboard @'+width+' PASS');
    }
  }

  if(!recordOnly&&!matrixOnly&&widths.includes(1440)){
    await page.setViewportSize({width:1440,height:1100});
    await open(family[3],'content',{categories:[],seriesByCategorySlug:{}});await expect(page.getByText('لا توجد تصنيفات منشورة متاحة.',{exact:true})).toBeVisible();await expect(page.locator('[data-feed-series-option]')).toHaveCount(0);await save();
    for(const type of feedTypes.TOPICS_FEED_TYPES){await open(family[3]);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);await tab('إعدادات العرض');await choose(type+'_layout','List');await field('limit').fill('9');await field(type+'_list_items_per_group').fill('1');await field(type+'_list_interval_seconds').fill('60');await setSwitch(fieldSwitch(type+'_list_show_dots'),false);let config=await save();assert.equal(config.presentation.variants[type].list.intervalSeconds,60);assert.equal(config.presentation.variants[type].list.itemsPerGroup,1);await view(type,config);await expect(page.locator('[data-feed-carousel-dots]')).toHaveCount(0);await expect(publicCards(type)).toHaveCount(1);
      await open({block:saved.block,config,pages:savedPageIds},'presentation');await field(type+'_list_items_per_group').fill('12');await field(type+'_list_interval_seconds').fill('3');await setSwitch(fieldSwitch(type+'_list_show_dots'),true);config=await save();await view(type,config);await expect(publicCards(type)).toHaveCount(9);await expect(page.locator('[data-feed-carousel-dots]')).toHaveCount(0);
      await open({block:saved.block,config,pages:savedPageIds},'presentation');await field(type+'_list_items_per_group').fill('2');config=await save();await page.emulateMedia({reducedMotion:'no-preference'});await view(type,config);await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-active-group','1',{timeout:6000});await page.locator('[data-feed-carousel-dots] button').first().focus();await expect(page.locator('[data-feed-grouped-list]')).toHaveAttribute('data-feed-autoplay','stopped');await page.emulateMedia({reducedMotion:'reduce'});
    }
    for(const type of ['latest','series']){await open(family[3]);await choose('feed_type',feedTypes.TOPICS_FEED_TYPE_LABELS_AR[type]);await tab('إعدادات العرض');await choose(type+'_layout','Slider');await field('limit').fill('9');await setSwitch(fieldSwitch(type+'_show_arrows'),false);if(type==='latest')await setSwitch(fieldSwitch('latest_show_dots'),false);const config=await save();await page.emulateMedia({reducedMotion:'no-preference'});await view(type,config);await expect(page.locator('[data-feed-carousel-navigation],[data-feed-carousel-dots]')).toHaveCount(0);const current=publicCards(type).first();const original=await current.textContent();await expect.poll(()=>current.textContent(),{timeout:11000}).not.toBe(original);await page.emulateMedia({reducedMotion:'reduce'});}
    console.log('Feed empty filters, list grouping1/12, interval3/60, dots/arrows off and all6 autoplay owners PASS');
  }
  assert.deepEqual(errors,[]);console.log('PASS Feed family: '+recordCases+' actual-row viewport cases; '+modeCases+' type/layout viewport cases; '+publicCases+' actual resolver/public renders; '+saves+' isolated saves; widths '+widths.join('/')+' RTL; no DB writes.');

}

async function verifyCardsFamily(){
  // Exact read-only records; persistence uses the actual Cards builder, parser and public resolver in memory.
  const records=[
    ['About — Documentary Beats','about-documentary-beats',{items:[{body:'كل مشروع يبدأ من أصل واضح — أرض مملوكة، وقرار تنفيذي مسؤول.',icon:'01',title:'البداية من الأرض'},{body:'متابعة هندسية حقيقية… ليست صورًا، بل نظامًا يعمل أمام العميل.',icon:'02',title:'الإدارة على الأرض'},{body:'كل خطوة تُسجّل وتُعرض — من الحفر إلى التسليم، بلا فجوات في السرد.',icon:'03',title:'المراحل موثّقة'}],columns:3}],
    ['About — Principles','about-principles',{items:[{body:'بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع.',title:'أراضٍ مملوكة'},{body:'متابعة تنفيذ — نظام يعمل على الأرض، لا في العروض.',title:'إدارة هندسية'},{body:'كل مرحلة لها معنى… وكل خطوة تثبت أن الوعد يتحول لحقيقة.',title:'مراحل موثّقة'}],title:'مبادئ تُحكى بهدوء',columns:3,eyebrow:'What defines us'}],
    ['Contact — Trust Cards','contact-trust-cards',{items:[{body:'01033766876\nمن السبت إلى الخميس',href:'tel:01033766876',icon:'phone',title:'اتصل بنا'},{body:'01033766876\nرد سريع على استفساراتك',href:'https://wa.me/201033766876',icon:'whatsapp',title:'واتساب'},{body:'info@venesia-developments.com\nنرد عليك في أقرب وقت',href:'mailto:info@venesia-developments.com',icon:'mail',title:'البريد الإلكتروني'},{body:'Core Business Mall\nالقاهرة الجديدة',href:'https://maps.google.com',icon:'location',title:'موقعنا'}],columns:4}],
    ['Contact — Reasons','contact-reasons',{items:[{body:'نساعدك تفهم الفرق بين السكن والاستثمار، وتختار بناءً على هدفك الحقيقي.',title:'اختيار أوضح'},{body:'نرتب لك زيارة ميدانية لمتابعة التنفيذ كما هو، بعيدًا عن الوعود الورقية.',title:'معاينة على الأرض'},{body:'نشرح لك الموقع، المساحات، أنظمة السداد، ومراحل التنفيذ قبل أي خطوة.',title:'تفاصيل قبل القرار'}],title:'لماذا تتواصل مع فينيسيا؟',columns:3}],
    ['Contact — Departments','contact-departments',{items:[{body:'مستشارون عقاريون لمساعدتك في اختيار الوحدة المناسبة.',href:'/images/111.png',title:'فريق المبيعات'},{body:'متابعة مستمرة والرد على الاستفسارات بعد التعاقد.',href:'/images/111.png',title:'خدمة العملاء'},{body:'متابعة جودة التنفيذ وتوثيق المراحل على أرض الواقع.',href:'/images/111.png',title:'الإدارة الهندسية'}],title:'الأقسام المتاحة لخدمتك',columns:3}],
    ['Contact — FAQ','contact-faq',{items:[{body:'يمكنك التواصل معنا لمعرفة أحدث الوحدات المتاحة حسب المشروع، المساحة، الدور، ونظام السداد المناسب لك.',title:'ما هي المشاريع المتاحة حاليًا؟'},{body:'نعم، يمكن ترتيب معاينة ميدانية لمتابعة الموقع ومراحل التنفيذ على أرض الواقع.',title:'هل يمكن حجز معاينة للمشروع؟'},{body:'تختلف أنظمة السداد حسب المشروع والوحدة، ويتم شرح الخطة المناسبة لك بوضوح قبل التعاقد.',title:'ما هي طرق السداد المتاحة؟'},{body:'فلسفة فينيسيا قائمة على الأمان قبل البيع، لذلك نوضح للعميل موقف الأرض والمستندات قبل اتخاذ القرار.',title:'هل الأراضي مملوكة وخالصة الثمن؟'},{body:'يمكنك الاتصال مباشرة أو التواصل عبر واتساب، وسيقوم أحد المستشارين بالرد على استفسارك.',title:'كيف أتواصل مع فريق المبيعات؟'},{body:'نعمل من السبت إلى الخميس، من الساعة 9 صباحًا حتى 8 مساءً.',title:'ما هي مواعيد العمل؟'}],title:'الأسئلة الشائعة',columns:2}]
  ];
  const recordOnly=process.argv.includes('--cards-records-only'),interactionOnly=process.argv.includes('--cards-interactions-only'),widths=(process.argv.find(arg=>arg.startsWith('--cards-widths='))?.split('=')[1]||'1440,900,390').split(',').map(Number);assert.ok(widths.length&&widths.every(width=>[1440,900,390].includes(width)));
  const family=records.map(([name,slug,config],index)=>({block:{id:index+1,name,slug,variant:'glass',style_preset:'premium-dark',status:'published'},config,pages:index<2?[]:[5]}));
  const labels=['النصوص','البطاقات','إعدادات العرض','الظهور'],ids=['content','cards','presentation','pages'];
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const stable=input=>input.filter(([key])=>key!=='module_editor_tab'&&!key.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const field=name=>page.locator('[name="'+name+'"]');
  const link=index=>page.locator('[data-admin-link-field]').filter({has:field('item_'+index+'_link_kind')});
  const open=async(row,active='content')=>{saved={block:structuredClone(row.block),config:mediaHubFormatting.asCardsConfig(structuredClone(row.config))};savedName=row.block.name;savedPageIds=[...row.pages];await page.goto(url+'?mode=cards-family&tab='+active+(row.pages[0]?'&returnPageId='+row.pages[0]:''));await ready();};
  const layout=async()=>{assert.equal(await page.locator('#root').evaluate(e=>getComputedStyle(e).direction),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
  const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const save=async()=>{const input=new MapFormData(await entries()),identity={...saved.block},expected=saveCardsConfig(input),pages=parsePageIds(input),returnPageId=new URL(page.url()).searchParams.get('returnPageId');await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();assert.deepEqual(saved.config,expected);assert.deepEqual(savedPageIds,pages);assert.equal(saved.block.status,parseFormStatus(input));for(const key of ['id','slug','variant','style_preset'])assert.equal(saved.block[key],identity[key]);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),returnPageId);assert.deepEqual(saveCardsConfig(new MapFormData(await entries())),expected);return structuredClone(expected);};
  const resolve=async config=>cardsPublicResolver.resolveCardsBlockConfigLinks(mediaHubFormatting.asCardsConfig(JSON.parse(JSON.stringify(config))));
  const projection=config=>(config.items||[]).map(item=>({title:item.title||'',body:item.body||'',icon:item.icon||'',href:item.href||''}));
  const publicView=async(row,config)=>{const renderer=['generic','about','trust','reasons','departments','faq'][row.block.id-1],value=await resolve(config);await page.evaluate(data=>window.mount('cards-public',data),{renderer,value});await ready();const rootNode=page.locator('#root');await layout();
    for(const item of value.items){if(renderer==='faq'){const question=rootNode.getByRole('button').filter({hasText:item.title});await expect(question).toBeVisible();if(!await rootNode.getByText(item.body,{exact:true}).isVisible()){await question.focus();await page.keyboard.press('Enter');}await expect(rootNode.getByText(item.body,{exact:true})).toBeVisible();await question.focus();await page.keyboard.press('Space');await expect(rootNode.getByText(item.body,{exact:true})).toHaveCount(0);}else{await expect(rootNode.getByText(item.title,{exact:true})).toBeVisible();for(const part of renderer==='trust'?item.body.split(/\n+/):[item.body])await expect((renderer==='trust'?rootNode.locator('a').nth(value.items.indexOf(item)):rootNode).getByText(part,{exact:true})).toBeVisible();}}
    if(renderer==='trust'){await expect(rootNode.locator('a')).toHaveCount(value.items.length);for(const [index,item]of value.items.entries())await expect(rootNode.locator('a').nth(index)).toHaveAttribute('href',item.href);}
    if(renderer==='departments'){const images=rootNode.locator('img');await expect(images).toHaveCount(value.items.length);for(const image of await images.all())await expect.poll(()=>image.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);}
    await expect(rootNode.locator('script,[onclick],[onerror]')).toHaveCount(0);return {text:await rootNode.innerText(),links:await rootNode.locator('a').evaluateAll(nodes=>nodes.map(e=>e.getAttribute('href'))),images:await rootNode.locator('img').evaluateAll(nodes=>nodes.map(e=>({alt:e.alt,src:e.getAttribute('src')})))};
  };
  if(baseline){for(const row of family){await open(row);await expect(page.getByRole('tab')).toHaveCount(2);await expect(field('columns')).toHaveValue(String(row.config.columns));await expect(page.locator('[data-module-editor-repeater-card]')).toHaveCount(row.config.items.length);const built=saveCardsConfig(new MapFormData(await entries()));assert.deepEqual(projection(await resolve(built)),projection(await resolve(row.config)));console.log('Cards baseline canonical row '+row.block.id+' '+digest(built));}
    for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await open(family[2]);await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/before-cards-family-'+width+'.png')});}assert.deepEqual(errors,[]);console.log('PASS Cards before: all6 actual records, existing canonical output and 2 screenshots; no writes.');return;}
  const chooseColumns=async value=>{const control=page.locator('[data-admin-form-listbox]').filter({has:field('columns')});await control.getByRole('combobox').click();await page.getByRole('option',{name:String(value),exact:true}).click();await expect(field('columns')).toHaveValue(String(value));};
  const geometry=async(width,count)=>{const boxes=await page.locator('[data-module-editor-repeater-card]').evaluateAll(nodes=>nodes.map(e=>{const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),width:b.width};}));assert.equal(boxes.length,count);const columns=width>=1280?3:width>=768?2:1;assert.equal(new Set(boxes.map(b=>b.x)).size,Math.min(columns,count));for(const box of boxes)assert.ok(box.width>200);if(columns>1)assert.ok(boxes[0].x>boxes[1].x,'RTL first card is rightmost');await layout();};
  let publicCases=0;
  for(const width of widths){
    await page.setViewportSize({width,height:1100});
    for(const row of interactionOnly?[]:family){await open(row);await expect(page.getByRole('tab')).toHaveText(labels);await expect(page.getByRole('tablist')).toHaveCount(1);await expect(page.locator('[data-admin-rich-text-scope],[data-admin-media-image-field]')).toHaveCount(0);await expect(field('columns')).toHaveCount(1);await expect(field('columns')).toHaveValue(String(row.config.columns));
      for(const name of ['eyebrow','title','description'])await expect(field(name)).toHaveValue(row.config[name]||'');for(const [index,item]of row.config.items.entries()){for(const key of ['title','body','icon'])await expect(field('item_'+index+'_'+key)).toHaveValue(item[key]||'');await expect(link(index)).toHaveCount(1);}
      const initial=stable(await entries());for(const [index,label]of labels.entries()){await tab(label);await expect(page.getByRole('tab',{name:label,exact:true})).toHaveAttribute('data-admin-tab-id',ids[index]);await expect(field('module_editor_tab')).toHaveValue(ids[index]);assert.deepEqual(stable(await entries()),initial);await layout();}
      for(const id of row.pages){const assigned=page.locator('[data-module-page-row="'+id+'"]');await expect(assigned.getByRole('checkbox')).toBeChecked();await expect(assigned.getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/'+id);assert.equal(assignmentContext().assignments[0].is_visible,row.block.id!==5);assert.equal(assignmentContext().assignments[0].sort_order,{3:10,4:50,5:60,6:70}[row.block.id]);}
      const noOp=saveCardsConfig(new MapFormData(await entries()));if(width===1440)console.log('Cards after canonical row '+row.block.id+' '+digest(noOp));await save();assert.deepEqual(projection(await resolve(saved.config)),projection(await resolve(row.config)));
      const originalPublic=await publicView(row,row.config),savedPublic=await publicView(row,saved.config);assert.deepEqual(savedPublic,originalPublic,'Exact original public output survives editor roundtrip row '+row.block.id);publicCases+=2;
      await page.reload();await ready();await tab('البطاقات');await geometry(width,row.config.items.length);await expect(page.getByRole('button',{name:'تحريك البطاقة 1 لأعلى',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'تحريك البطاقة '+row.config.items.length+' لأسفل',exact:true})).toBeDisabled();
      if(row.block.id===3&&width!==900){await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-cards-family-cards-'+width+'.png')});console.log('Cards representative '+width+' screenshot ready');}
      await tab('النصوص');for(const [index,name]of ['eyebrow','title','description'].entries()){await field(name).fill('نص '+name+' *حرفي* <tag> & '+row.block.id+(name==='description'?'\nفقرة ثانية':''));const controls=page.locator('[data-module-editor-control-row]').filter({has:field('show_'+name)});await controls.getByRole('switch').focus();await page.keyboard.press('Space');await expect(controls.getByRole('switch')).not.toBeChecked();const bold=controls.getByRole('button',{name:'تنسيق عريض',exact:true});if(await bold.getAttribute('aria-pressed')!==String(index%2===0))await bold.click();for(const [label,value]of [['محاذاة للوسط','center'],['محاذاة لليسار','left'],['محاذاة لليمين','right']]){await controls.getByRole('button',{name:label,exact:true}).click();await expect(field(name+'_alignment')).toHaveValue(value);}}
      await tab('البطاقات');await field('item_0_title').fill('عنوان '+row.block.id+' *حرفي* <tag>');await field('item_0_body').fill('سطر أول *حرفي* <tag> &\nسطر ثانٍ '+row.block.id);await field('item_0_icon').fill('01');const dirty=stable(await entries());for(const label of labels){await tab(label);assert.deepEqual(stable(await entries()),dirty);}await save();assert.equal(saved.config.items[0].body,'سطر أول *حرفي* <tag> &\nسطر ثانٍ '+row.block.id);assert.equal(saved.config.items[0].title,'عنوان '+row.block.id+' *حرفي* <tag>');for(const [index,name]of ['eyebrow','title','description'].entries()){assert.equal(saved.config['show'+name[0].toUpperCase()+name.slice(1)],false);assert.equal(saved.config[name+'Bold'],index%2===0);}
      await publicView(row,saved.config);publicCases++;console.log('Cards row '+row.block.id+' @'+width+': all fields/tabs, original+edited canonical save/reload, specialized public PASS');
    }
    if(recordOnly)continue;
    await open(family[0],'cards');const firstTab=page.getByRole('tab',{name:'النصوص',exact:true});await firstTab.focus();await page.keyboard.press('Home');await expect(firstTab).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'البطاقات',exact:true})).toBeFocused();await expect(field('module_editor_tab')).toHaveValue('cards');await page.keyboard.press('End');await expect(field('module_editor_tab')).toHaveValue('pages');await page.keyboard.press('Home');await expect(field('module_editor_tab')).toHaveValue('content');await tab('البطاقات');
    for(const actionName of ['تحريك البطاقة 1 لأسفل','حذف البطاقة 1']){const button=page.getByRole('button',{name:actionName,exact:true});const box=await button.boundingBox();assert.equal(box.width,44);assert.equal(box.height,44);await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(button).toBeFocused();assert.equal(await button.evaluate(e=>e.matches(':focus-visible')),true);}
    const firstLink=link(0),picker=firstLink.getByRole('button',{name:'اختيار الرابط',exact:true});await picker.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'إلغاء',exact:true}).click();await expect(picker).toBeFocused();await picker.click();let dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Static Routes',exact:true}).click();await dialog.getByRole('button',{name:/^من نحن/}).click();await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await firstLink.getByRole('textbox').fill('cards-anchor');await field('item_0_title').fill('بطاقة تتحرك');const movedLink=Object.fromEntries((await entries()).filter(([key])=>key.startsWith('item_0_link_')).map(([key,value])=>[key.replace('item_0_',''),value]));await page.getByRole('button',{name:'تحريك البطاقة 1 لأسفل',exact:true}).focus();await page.keyboard.press('Space');await expect(field('item_1_title')).toHaveValue('بطاقة تتحرك');assert.deepEqual(Object.fromEntries((await entries()).filter(([key])=>key.startsWith('item_1_link_')).map(([key,value])=>[key.replace('item_1_',''),value])),movedLink);await save();assert.equal(saved.config.items[1].link.anchor,'cards-anchor');
    await tab('البطاقات');await page.getByRole('button',{name:'تحريك البطاقة 2 لأعلى',exact:true}).click();await expect(field('item_0_title')).toHaveValue('بطاقة تتحرك');await link(0).getByRole('button',{name:'اختيار الرابط',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'External',exact:true}).click();await dialog.getByLabel('الرابط',{exact:true}).fill('https://example.com/cards');const target=dialog.getByRole('switch',{name:'فتح في تبويب جديد',exact:true});await target.focus();if(!await target.isChecked())await page.keyboard.press('Space');await expect(target).toBeChecked();await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await save();assert.equal(saved.config.items[0].link.href,'https://example.com/cards');assert.equal(saved.config.items[0].target,'_blank');
    await tab('البطاقات');await link(0).getByRole('button',{name:/^مسح/}).focus();await page.keyboard.press('Space');await expect(field('item_0_link_kind')).toHaveValue('none');await save();assert.equal(saved.config.items[0].link,undefined);
    await tab('البطاقات');await page.getByRole('button',{name:'إضافة بطاقة',exact:true}).click();await field('item_3_title').fill('بطاقة جديدة');await field('item_3_body').fill('وصف جديد');await field('item_3_icon').fill('04');await save();assert.equal(saved.config.items.length,4);await tab('البطاقات');await page.getByRole('button',{name:'حذف البطاقة 2',exact:true}).click();await save();assert.equal(saved.config.items.length,3);assert.equal(saved.config.items[2].title,'بطاقة جديدة');
    for(const columns of [2,3,4]){await tab('إعدادات العرض');await chooseColumns(columns);await save();assert.equal(saved.config.columns,columns);await tab('البطاقات');await geometry(width,3);}
    await tab('الظهور');const about=page.locator('[data-module-page-row="2"] input[type="checkbox"]'),contact=page.locator('[data-module-page-row="5"] input[type="checkbox"]');await about.focus();await page.keyboard.press('Space');await contact.focus();await page.keyboard.press('Space');await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية',exact:true})).toHaveText('2 محددة');await save();assert.deepEqual(savedPageIds,[2,5]);await tab('الظهور');await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toBeVisible();const managers=page.getByRole('link',{name:'مدير الصفحة',exact:true});await expect(managers).toHaveCount(2);await expect(managers.nth(0)).toHaveAttribute('href','/admin/pages-blocks/pages/2');await expect(managers.nth(1)).toHaveAttribute('href','/admin/pages-blocks/pages/5');await expect(page.getByText('المحتوى الرئيسي',{exact:true})).toHaveCount(2);await about.focus();await page.keyboard.press('Space');await save();assert.deepEqual(savedPageIds,[5]);
    const status=page.getByRole('switch',{name:'حالة النشر',exact:true});await status.focus();await page.keyboard.press('Space');await save();assert.equal(saved.block.status,'unpublished');await status.focus();await page.keyboard.press('Space');await save();assert.equal(saved.block.status,'published');
    await page.evaluate(()=>window.mount('cards-create-default',{items:[]}));await ready();await expect(page.locator('[data-module-editor-repeater-card]')).toHaveCount(1);await expect(page.locator('[data-admin-form-control-presentation="leading-icon"]')).toHaveCount(0);await expect(page.locator('[data-admin-link-field]')).toHaveCount(0);const defaultAdd=page.getByRole('button',{name:'إضافة بطاقة',exact:true});await expect(defaultAdd).toHaveClass(/rounded-2xl.*px-4 py-2/);await expect(page.getByRole('button',{name:'حذف البطاقة 1',exact:true})).toBeDisabled();await field('item_0_title').fill('عنوان افتراضي');await field('item_0_body').fill('وصف افتراضي');await defaultAdd.click();await expect(page.locator('[data-module-editor-repeater-card]')).toHaveCount(2);const defaultGrid=page.locator('[data-module-editor-repeater-grid]');assert.equal(await defaultGrid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1280?3:width>=1024?2:1);await expect(defaultGrid).toHaveClass('grid gap-4 lg:grid-cols-2 xl:grid-cols-3');await field('item_1_title').fill('ثانٍ');await field('item_1_body').fill('وصف ثانٍ');if(width!==900)await defaultGrid.locator('..').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-cards-create-default-'+width+'.png')});await page.getByRole('button',{name:'تحريك البطاقة 2 لأعلى',exact:true}).click();await expect(field('item_0_title')).toHaveValue('ثانٍ');await page.getByRole('button',{name:'حذف البطاقة 1',exact:true}).click();await expect(field('item_0_title')).toHaveValue('عنوان افتراضي');await layout();console.log('Cards shared interactions + unchanged create-default @'+width+' PASS');
  }
  if(!recordOnly){await page.setViewportSize({width:1440,height:1100});await open(family[0],'cards');while(await page.locator('[data-module-editor-repeater-card]').count()>1)await page.getByRole('button',{name:'حذف البطاقة 1',exact:true}).click();await expect(page.getByRole('button',{name:'حذف البطاقة 1',exact:true})).toBeDisabled();await save();assert.equal(saved.config.items.length,1);await tab('البطاقات');for(let index=1;index<12;index++){await page.getByRole('button',{name:'إضافة بطاقة',exact:true}).click();await field('item_'+index+'_title').fill('بطاقة '+index);await field('item_'+index+'_body').fill('وصف '+index);}await expect(page.getByRole('button',{name:'إضافة بطاقة',exact:true})).toBeDisabled();await expect(page.locator('[data-module-editor-repeater-card]')).toHaveCount(12);await save();assert.equal(saved.config.items.length,12);
  const complete=await entries();for(const name of ['item_0_title','item_0_body']){const invalid=new MapFormData(complete);invalid.set(name,' ');assert.throws(()=>saveCardsConfig(invalid),/البطاقة 1 تحتاج عنوانًا ووصفًا مختصرًا/);}assert.throws(()=>saveCardsConfig(new FormData()),/أضف بطاقة واحدة على الأقل/);for(const value of ['0','1','5','invalid']){const invalid=new MapFormData(complete);invalid.set('columns',value);assert.equal(saveCardsConfig(invalid).columns,3);}}
  assert.deepEqual(errors,[]);console.log('PASS Cards family scope ('+(recordOnly?'records':interactionOnly?'interactions':'complete')+') @'+widths.join('/')+' RTL; '+saves+' isolated canonical saves/reloads; '+publicCases+' actual public renders; '+(recordOnly?'actual-record preservation complete.':'min1/max12, invalid title/body, columns, real link picker/target/anchor/reorder, defaults preserved.')+' Known active-resource picker and old /images/111.png availability gaps remain outside this test; placeholder media is isolated.');
}

async function verifyCtaFamily(){
  if(process.argv.includes('--cta-public-before')){await verifyCtaPublic(true);return;}
  const family=[
    {block:{id:1,name:'About — Projects CTA',slug:'about-projects-cta',variant:'band',style_preset:'premium-dark',status:'published'},config:{eyebrow:'Venesia Developments',title:'استكشف مشاريعنا',description:'انتقل إلى صفحة المشاريع لمتابعة التنفيذ والتفاصيل.',primaryCta:{href:'/projects',label:'استكشف المشاريع ↗'},backgroundImage:'/images/about/who-we-are.png',backgroundStyle:'dark'},pages:[]},
    {block:{id:2,name:'Contact — Bottom CTA',slug:'contact-cta',variant:'band',style_preset:'premium-dark',status:'published'},config:{title:'هل أنت مستعد لبدء رحلتك العقارية؟',description:'تواصل معنا الآن وخذ أول خطوة نحو قرار عقاري أوضح مع فينيسيا للتطوير العقاري.',primaryCta:{href:'tel:01033766876',label:'اتصل الآن'},secondaryCta:{href:'https://wa.me/201033766876',label:'واتساب'},backgroundImage:'/images/111.png',backgroundStyle:'dark'},pages:[5]},
    {block:{id:3,name:'Topics — Insight CTA',slug:'topics-insight-cta',variant:'band',style_preset:'premium-dark',status:'published'},config:{title:'محتوى موثوق من مطور عقاري يعمل على الأرض.',eyebrow:'Venesia Insight',description:'اسأل، افهم، وقارن قبل أي قرار.',primaryCta:{link:{link_kind:'static_route',linked_type:'static_routes',href:'/contact',meta:{route_key:'contact'},target:'_self'},target:'_self',label:'تواصل معنا'},backgroundImage:'',backgroundStyle:'gold',showEyebrow:true,showTitle:true,showDescription:true,showHighlight:true,showCta:true,eyebrowAlignment:'right',titleAlignment:'right',descriptionAlignment:'right',highlightAlignment:'right',ctaAlignment:'right',descriptionBold:false},pages:[4]},
    {block:{id:4,name:'Track — Contact CTA',slug:'track-contact-cta',variant:'band',style_preset:'premium-dark',status:'published'},config:{title:'هل تحتاج مساعدة في متابعة مشروعك؟',eyebrow:'Venesia Developments',description:'تواصل مع فريق فينيسيا للاستفسار عن مراحل التنفيذ والتحديثات.',primaryCta:{href:'/contact',label:'تواصل معنا ↗'},backgroundImage:'/images/venesia-1.png',backgroundStyle:'dark'},pages:[24]}
  ];
  const open=async(row,active='content')=>{saved={block:structuredClone(row.block),config:mediaHubFormatting.asCtaConfig(row.config)};savedPageIds=[...row.pages];await page.goto(url+'?mode=cta-family&tab='+active+(row.pages[0]?'&returnPageId='+row.pages[0]:''));await ready();};
  if(baseline){
    let imageLoss=0;
    for(const row of family){await open(row);const entries=await page.locator('form').evaluate(e=>[...new FormData(e)]),built=saveCtaConfig(new MapFormData(entries));await expect(page.locator('[name="background_image"]')).toHaveCount(0);if(row.config.backgroundImage){assert.equal(built.backgroundImage,'');imageLoss++;}console.log('CTA before row '+row.block.id+': existing fields reachable; background image omission '+Boolean(row.config.backgroundImage));}
    assert.equal(imageLoss,3);
    for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await open(family[3]);await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/before-cta-family-'+width+'.png')});}
    assert.deepEqual(errors,[]);console.log('CTA BASELINE PASS: existing3 populated images would be cleared by the canonical save builder; no data written.');return;
  }
  const labels=['النصوص','الصور','الزر والرابط','إعدادات العرض','الظهور'],ids=['content','images','cta','presentation','pages'];
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const stable=values=>values.filter(([key])=>key!=='module_editor_tab'&&!key.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const control=field=>page.locator('[data-module-editor-control-row]').filter({has:page.locator('[name="show_'+field+'"]')});
  const linkField=prefix=>page.locator('[data-admin-link-field]').filter({has:page.locator('[name="'+prefix+'_link_kind"]')});
  const layout=async()=>{assert.equal(await page.locator('form').evaluate(e=>getComputedStyle(e).direction),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
  const loaded=async locator=>{await expect(locator).toBeVisible();await expect.poll(()=>locator.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);};
  const save=async()=>{const input=new MapFormData(await entries()),identity={...saved.block},expected=saveCtaConfig(input),pages=parsePageIds(input),returnPageId=new URL(page.url()).searchParams.get('returnPageId');await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();assert.deepEqual(saved.config,expected);assert.deepEqual(savedPageIds,pages);assert.equal(saved.block.status,parseFormStatus(input));for(const key of ['id','slug','variant','style_preset'])assert.equal(saved.block[key],identity[key]);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),returnPageId);assert.deepEqual(saveCtaConfig(new MapFormData(await entries())),expected);return expected;};
  const setSwitch=async(locator,value)=>{await locator.focus();if(await locator.isChecked()!==value)await page.keyboard.press('Space');await expect(locator).toBeChecked({checked:value});};
  const setBold=async(field,value)=>{const button=control(field).getByRole('button',{name:'تنسيق عريض',exact:true});if(await button.getAttribute('aria-pressed')!==String(value))await button.click();await expect(button).toHaveAttribute('aria-pressed',String(value));};
  if(process.argv.includes('--cta-media-unavailable-only')){
    await page.setViewportSize({width:1440,height:1100});
    for(const status of ['missing','deleted','unavailable']){
      referenceStatus=status;await open(family[3],'images');const field=page.locator('[data-admin-media-image-field="background_image"]');await expect(field.locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',status);await expect(field.locator('img')).toHaveCount(0);await expect(field.locator('[name="background_image"]')).toHaveValue(family[3].config.backgroundImage);await save();assert.equal(saved.config.backgroundImage,family[3].config.backgroundImage);await expect(field.locator('[name="background_image"]')).toHaveValue(family[3].config.backgroundImage);await expect(field.locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',status);console.log('CTA unavailable original: '+status+' URL preserved through Save/Reload PASS');
    }
    referenceStatus='active';assert.deepEqual(errors,[]);console.log('PASS CTA unavailable-media scope: '+saves+' isolated saves, 1440 RTL, no data writes.');return;
  }
  for(const width of [1440,900,390]){
    await page.setViewportSize({width,height:1100});
    for(const row of process.argv.includes('--cta-family-interactions-only')?[]:family){
      await open(row);await expect(page.getByRole('tab')).toHaveText(labels);await expect(page.getByRole('tablist')).toHaveCount(1);await expect(page.locator('[data-admin-rich-text-scope],textarea')).toHaveCount(0);await layout();
      for(const name of ['eyebrow','title','description','highlight','primary_cta_label','secondary_cta_label','background_image','background_style','show_cta','cta_alignment'])await expect(page.locator('[name="'+name+'"]')).toHaveCount(1);
      await expect(page.locator('[name="cta_bold"]')).toHaveCount(0);
      for(const name of ['eyebrow','title','description','highlight'])await expect(page.locator('[name="'+name+'"]')).toHaveValue(row.config[name]||'');
      if(row.block.id===4&&width!==900){for(const [label,key]of [['النصوص','content'],['الصور','images'],['الزر والرابط','cta']]){await tab(label);if(key==='images')await loaded(page.locator('[data-admin-media-image-field="background_image"] img'));await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-cta-family-'+key+'-'+width+'.png')});}await tab('النصوص');console.log('CTA representative screenshots available at '+width);}
      const initialValues=stable(await entries());
      for(const [index,label]of labels.entries()){await tab(label);await expect(page.getByRole('tab',{name:label,exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('[name="module_editor_tab"]')).toHaveValue(ids[index]);await expect(page.getByRole('tab',{name:label,exact:true})).toHaveAttribute('data-admin-tab-id',ids[index]);assert.deepEqual(stable(await entries()),initialValues);await layout();}
      await expect(page.locator('[data-module-editor-pages]')).not.toContainText('هذا الموديول مستخدم في');
      for(const id of row.pages){const assigned=page.locator('[data-module-page-row="'+id+'"]');await expect(assigned.getByRole('checkbox')).toBeChecked();await expect(assigned.getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/'+id);}
      await save();assert.equal(saved.config.backgroundImage,row.config.backgroundImage);assert.equal(Object.hasOwn(saved.config,'ctaBold'),false);await expect(page.locator('[name="cta_bold"]')).toHaveCount(0);
      for(const [prefix,key]of [['primary_cta','primaryCta'],['secondary_cta','secondaryCta']]){
        assert.equal(saved.config[key]?.label||'',row.config[key]?.label||'');
        if(row.config[key]?.href)assert.equal(saved.config[key].link.href,row.config[key].href);
        if(row.config[key]?.link)assert.deepEqual(saved.config[key].link,serializeAdminLink(row.config[key].link));
        await expect(page.locator('[name="'+prefix+'_label"]')).toHaveValue(row.config[key]?.label||'');
      }
      await tab('النصوص');
      for(const [index,name]of ['eyebrow','title','description','highlight'].entries()){
        const text='نص '+name+' *حرفي* <tag> & '+row.block.id;await page.locator('[name="'+name+'"]').fill(text);const controls=control(name);await controls.getByRole('switch').focus();await page.keyboard.press('Space');await expect(controls.getByRole('switch')).not.toBeChecked();await setBold(name,index%2===0);
        for(const [label,value]of [['محاذاة للوسط','center'],['محاذاة لليسار','left'],['محاذاة لليمين','right']]){await controls.getByRole('button',{name:label,exact:true}).click();await expect(controls.locator('[name="'+name+'_alignment"]')).toHaveValue(value);}
      }
      const unsaved=stable(await entries());for(const label of labels){await tab(label);assert.deepEqual(stable(await entries()),unsaved);}await save();
      for(const [index,name]of ['eyebrow','title','description','highlight'].entries()){assert.equal(saved.config[name],'نص '+name+' *حرفي* <tag> & '+row.block.id);assert.equal(saved.config['show'+name[0].toUpperCase()+name.slice(1)],false);assert.equal(saved.config[name+'Bold'],index%2===0);}
      await tab('النصوص');for(const name of ['eyebrow','title','description','highlight'])await setSwitch(control(name).getByRole('switch'),true);
      await tab('الزر والرابط');await expect(page.locator('[data-module-editor-control-row]')).toHaveCount(5);await expect(linkField('primary_cta')).toBeVisible();await expect(linkField('secondary_cta')).toBeVisible();
      const cta=control('cta');await cta.getByRole('button',{name:'تنسيق عريض',exact:true}).focus();await page.keyboard.press('Space');await expect(cta.locator('[name="cta_bold"]')).toHaveValue('true');
      await cta.getByRole('button',{name:'محاذاة للوسط',exact:true}).click();await page.locator('[name="primary_cta_label"]').fill('زر رئيسي '+row.block.id);await page.locator('[name="secondary_cta_label"]').fill('زر ثانوي '+row.block.id);await save();assert.equal(saved.config.ctaBold,true);assert.equal(saved.config.ctaAlignment,'center');const authoredBoldOn=structuredClone(saved.config);
      await tab('الزر والرابط');await setBold('cta',false);await cta.getByRole('switch').focus();await page.keyboard.press('Space');await expect(cta.getByRole('switch')).not.toBeChecked();await page.keyboard.press('Space');await expect(cta.getByRole('switch')).toBeChecked();await cta.getByRole('button',{name:'محاذاة لليسار',exact:true}).click();await save();assert.equal(saved.config.ctaBold,false);assert.equal(saved.config.showCta,true);assert.equal(saved.config.ctaAlignment,'left');await tab('الزر والرابط');await expect(cta.locator('[name="cta_bold"]')).toHaveValue('false');await expect(cta.getByRole('switch')).toBeChecked();await layout();
      const renderer=row.block.id===1?'about':row.block.id===3?'topics':'contact';
      for(const authored of [authoredBoldOn,structuredClone(saved.config)]){const resolved=await ctaPublicResolver.resolveCtaBlockConfigLinks(mediaHubFormatting.asCtaConfig(JSON.parse(JSON.stringify(authored))));await page.evaluate(args=>window.mount('cta-public',args),{renderer,value:resolved});await ready();const buttons=page.locator('#root a');await expect(buttons.first()).toHaveText('زر رئيسي '+row.block.id);await expect(buttons).toHaveCount(['about','topics'].includes(renderer)?1:2);for(const button of await buttons.all())assert.equal(await button.evaluate(e=>getComputedStyle(e).fontWeight),authored.ctaBold?'700':'400');}
      for(const bold of [undefined,true,false]){const raw=bold===undefined?row.config:{...row.config,ctaBold:bold};const prepared=mediaHubFormatting.asCtaConfig(raw);await page.evaluate(value=>window.mount('cta-family',value),{block:row.block,config:prepared});await ready();await tab('الزر والرابط');const output=saveCtaConfig(new MapFormData(await entries())),resolved=await ctaPublicResolver.resolveCtaBlockConfigLinks(mediaHubFormatting.asCtaConfig(JSON.parse(JSON.stringify(output))));assert.equal(output.ctaBold,bold);await page.evaluate(args=>window.mount('cta-public',args),{renderer,value:resolved});await ready();const links=page.locator('#root a');await expect(links).toHaveCount(row.block.id===2?2:1);for(const link of await links.all())assert.equal(await link.evaluate(e=>getComputedStyle(e).fontWeight),bold===undefined?(['about','topics'].includes(renderer)?'500':'600'):bold?'700':'400');await expect(links.first()).toHaveText(row.config.primaryCta.label);await expect(links.first()).toHaveAttribute('href',row.config.primaryCta.href||'/contact');}
      console.log('CTA family row '+row.block.id+' '+width+': tabs, inactive FormData, plain copy/formatting, legacy absence and explicit Bold save/reload PASS');
    }
    await open(family[3],'cta');
    for(const prefix of ['primary_cta','secondary_cta']){
      const field=linkField(prefix),choose=field.getByRole('button',{name:'اختيار الرابط',exact:true});await choose.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(choose).toBeFocused();
      await choose.click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:prefix==='primary_cta'?'Pages':'Static Routes',exact:true}).click();await dialog.getByRole('button',{name:/^من نحن/}).click();await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await expect(choose).toBeFocused();await field.getByRole('textbox').fill(prefix+'-anchor');await page.locator('[name="'+prefix+'_label"]').fill('نص '+prefix);
      const clear=field.getByRole('button',{name:'مسح',exact:true});for(const action of [choose,clear]){const box=await action.boundingBox();assert.equal(box.width,44);assert.equal(box.height,44);assert.equal(await action.locator('svg').evaluate(e=>e.getBoundingClientRect().width),22);await action.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(action).toBeFocused();assert.equal(await action.evaluate(e=>e.matches(':focus-visible')),true);}
    }
    await save();assert.equal(saved.config.primaryCta.link.anchor,'primary_cta-anchor');assert.equal(saved.config.secondaryCta.link.anchor,'secondary_cta-anchor');
    await tab('الزر والرابط');const primaryLink=structuredClone(saved.config.primaryCta);await linkField('secondary_cta').getByRole('button',{name:'مسح',exact:true}).focus();await page.keyboard.press('Space');await expect(linkField('secondary_cta').getByRole('textbox')).toHaveCount(0);await save();assert.deepEqual(saved.config.primaryCta,primaryLink);assert.equal(saved.config.secondaryCta.link,undefined);assert.equal(saved.config.secondaryCta.label,'نص secondary_cta');
    await tab('الزر والرابط');await linkField('secondary_cta').getByRole('button',{name:'اختيار الرابط',exact:true}).click();const external=page.getByRole('dialog');await external.getByRole('button',{name:'External',exact:true}).click();await external.getByLabel('الرابط',{exact:true}).fill('https://example.com/cta');await setSwitch(external.getByRole('switch',{name:'فتح في تبويب جديد'}),true);await external.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await save();assert.equal(saved.config.secondaryCta.link.href,'https://example.com/cta');assert.equal(saved.config.secondaryCta.target,'_blank');assert.deepEqual(saved.config.primaryCta,primaryLink);
    await tab('إعدادات العرض');for(const [label,value]of [['ذهبي','gold'],['متدرّج','gradient'],['داكن','dark']]){await page.getByRole('combobox',{name:'نمط الخلفية',exact:true}).click();await page.getByRole('option',{name:label,exact:true}).click();await save();assert.equal(saved.config.backgroundStyle,value);await tab('إعدادات العرض');}
    await tab('الصور');const image=page.locator('[data-admin-media-image-field="background_image"]');await loaded(image.locator('img'));await expect(image.getByRole('textbox')).toHaveCount(0);const preview=image.locator('[data-admin-media-image-preview-trigger]');await preview.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-admin-media-image-expanded]')).toBeVisible();await loaded(page.locator('[data-admin-media-image-expanded] img'));await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).focus();await page.keyboard.press('Enter');await expect(preview).toBeFocused();
    await image.getByRole('button',{name:'استبدال',exact:true}).click();await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await save();assert.equal(saved.config.backgroundImage,'/replacement.svg');await tab('الصور');await loaded(image.locator('img'));await image.getByRole('button',{name:'إزالة',exact:true}).click();await save();assert.equal(saved.config.backgroundImage,'');await tab('الصور');await image.getByRole('button',{name:'اختيار صورة',exact:true}).click();await page.getByRole('button',{name:/^صورة one/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await save();assert.equal(saved.config.backgroundImage,'/one.svg');await tab('الصور');await loaded(image.locator('img'));
    await tab('الظهور');const added=page.locator('[data-module-page-row="2"]').getByRole('checkbox');await added.focus();await page.keyboard.press('Space');await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('2 محددة');await save();assert.deepEqual(savedPageIds,[2,24]);await tab('الظهور');await page.locator('[data-module-page-row="2"]').getByRole('checkbox').uncheck();await save();assert.deepEqual(savedPageIds,[24]);
    await setSwitch(page.getByRole('switch',{name:'حالة النشر',exact:true}),false);await save();assert.equal(saved.block.status,'unpublished');await setSwitch(page.getByRole('switch',{name:'حالة النشر',exact:true}),true);await save();assert.equal(saved.block.status,'published');
    await open(family[3]);const firstTab=page.getByRole('tab',{name:'النصوص',exact:true});await firstTab.focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'الظهور',exact:true})).toBeFocused();await page.keyboard.press('Home');await expect(firstTab).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'الصور',exact:true})).toBeFocused();await page.keyboard.press('Enter');await layout();
    if(width!==900)for(const [label,key]of [['النصوص','content'],['الصور','images'],['الزر والرابط','cta']]){await tab(label);if(key==='images')await loaded(page.locator('[data-admin-media-image-field="background_image"] img'));await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-cta-family-'+key+'-'+width+'.png')});}
    console.log('CTA '+width+': real Link Picker/anchors/external target/clear, image preview/replace/remove/add, backgrounds, status, page counters/position and keyboard PASS');
  }
  await verifyCtaPublic();
  saved=structuredClone(initial);savedPageIds=[];await page.goto(url);await ready();await expect(page.locator('[name="description_bold"]')).toHaveValue('false');await page.evaluate(()=>window.mount('about-cta-default',{title:'عنوان افتراضي',description:'وصف',button:{label:'زر',href:'/projects'}}));await ready();await expect(page.locator('[name="description_bold"]')).toHaveValue('false');await expect(page.locator('[name="cta_bold"]')).toHaveCount(0);
  assert.deepEqual(errors,[]);console.log('PASS CTA family'+(process.argv.includes('--cta-family-interactions-only')?' interactions scope':' 4 actual records × 3 viewports')+': '+saves+' isolated canonical saves/reloads; public weight matrix and outside-family defaults; no DB writes.');
}

async function verifyMediaSidebar(){
  const {parseMediaSidebarModuleConfig,buildMediaSidebarModuleConfig,MEDIA_SIDEBAR_WIDGET_DEFAULTS,MEDIA_SIDEBAR_PRESENTATIONS}=mediaSidebarContract;
  const {MEDIA_SIDEBAR_WIDGET_LABELS,MEDIA_SIDEBAR_PRESENTATION_LABELS}=mediaSidebarLabels;
  const base={id:1,name:'أقسام المركز الإعلامي',slug:'media-sidebar-sections',description:'Navigation links for Media Center sections',status:'published',widget_key:'sections',config:{source:'navigation',menuParent:'/media-center'}};
  const family=[base,{id:2,name:'أحدث الأخبار',slug:'media-sidebar-latest',description:'Latest news items in Media Center sidebar',status:'published',widget_key:'latest',config:{type:'news',limit:3,source:'topics'}},{id:3,name:'الأكثر قراءة',slug:'media-sidebar-popular',description:'Popular media items in Media Center sidebar',status:'published',widget_key:'popular',config:{limit:4,source:'topics',isPopular:true}}];
  const labels=['إعدادات المحتوى','الظهور'],ids=['content','pages'],linked=[7,8,9,10,11,12];
  const flags=[['title','show_title_on_page','إظهار العنوان'],['image','show_image_on_page','إظهار الصورة'],['category','show_category_on_page','إظهار التصنيف'],['series','show_series_on_page','إظهار السلسلة'],['excerpt','show_excerpt_on_page','إظهار المقتطف'],['date','show_date_on_page','إظهار التاريخ']];
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const fields=values=>values.filter(([key])=>key!=='module_editor_tab'&&!key.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const field=name=>page.locator('[data-admin-form-listbox]').filter({has:page.locator('select[name="'+name+'"]')});
  const choose=async(name,label)=>{const control=field(name).getByRole('combobox');await control.click();await page.getByRole('option',{name:label,exact:true}).click();await expect(control).toBeFocused();};
  const open=async(row=base,active='content')=>{saved=structuredClone(row);await page.goto(url+'?mode=media-sidebar&tab='+active+'&returnPageId=13');await ready();};
  const save=async()=>{const identity={...saved},input=new MapFormData(await entries()),status=parseFormStatus(input),widget=mediaSidebarContract.parseMediaSidebarWidgetKey(String(input.get('widget_key'))),expected=buildMediaSidebarModuleConfig(widget,input);await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();assert.equal(saved.widget_key,widget);assert.deepEqual(saved.config,expected);assert.deepEqual(parseMediaSidebarModuleConfig(saved.config,widget),expected);assert.equal(saved.id,identity.id);assert.equal(saved.name,String(input.get('name')));assert.equal(saved.description,identity.description);assert.equal(saved.status,status);assert.equal(saved.slug,identity.slug);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),'13');return expected;};
  const layout=async()=>{assert.equal(await page.locator('form').evaluate(e=>getComputedStyle(e).direction),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
  const flagsValue=async()=>Object.fromEntries(await Promise.all(flags.map(async([key,,label])=>[key,await page.getByRole('switch',{name:label,exact:true,includeHidden:true}).isChecked()])));
  const checkFlags=async expected=>{for(const [key,,label]of flags)await expect(page.getByRole('switch',{name:label,exact:true})).toBeChecked({checked:expected[key]});};
  const displayGeometry=async(width)=>{
    const control=page.locator('[data-content-display-settings]');await expect(control.getByRole('switch')).toHaveCount(6);
    const rects=await control.getByRole('switch').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:r.width,h:r.height};}));
    const columns=width>=1280?3:width>=768?2:1;assert.equal(new Set(rects.map(r=>r.x)).size,columns);assert.equal(new Set(rects.map(r=>r.y)).size,6/columns);
    for(const r of rects)assert.ok(r.w>0&&r.h>0,'Every display switch is rendered');
    await layout();
  };
  let cases=0;
  for(const width of [1440,900,390]){
    savedPageIds=[...linked];await page.setViewportSize({width,height:1100});await open();
    await expect(page.getByRole('tab')).toHaveText(labels);await expect(page.getByRole('tablist')).toHaveCount(1);
    await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue('content');
    await expect(field('widget_key').getByRole('combobox')).toBeVisible();
    await field('widget_key').getByRole('combobox').focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('option')).toHaveText(Object.values(MEDIA_SIDEBAR_WIDGET_LABELS));await page.keyboard.press('Escape');
    await expect(field('widget_key').getByRole('combobox')).toBeFocused();
    await expect(page.getByRole('combobox',{name:'مصدر المحتوى',exact:true})).toHaveCount(0);
    await expect(page.getByRole('switch',{name:/^إظهار /})).toHaveCount(0);
    const initialFields=fields(await entries());
    for(const [index,label]of labels.entries()){
      await tab(label);assert.deepEqual(fields(await entries()),initialFields);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(ids[index]);await layout();
    }
    await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})).toHaveText('6 محددة');
    await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('0 محددة');
    for(const id of linked){const row=page.locator('[data-module-page-row="'+id+'"]');await expect(row.getByRole('checkbox')).toBeChecked();await expect(row.getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/'+id);await row.getByRole('link').focus();await expect(row.getByRole('link')).toBeFocused();}
    const linkedRow=page.locator('[data-module-page-row="12"]');await linkedRow.getByRole('checkbox').focus();await page.keyboard.press('Space');await expect(page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})).toHaveText('5 محددة');await expect(linkedRow.getByRole('link')).toBeVisible();await page.keyboard.press('Space');
    const addedRow=page.locator('[data-module-page-row="2"]');await addedRow.getByRole('checkbox').focus();await page.keyboard.press('Space');await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('1 محددة');await expect(addedRow.getByRole('link')).toHaveCount(0);
    const chosen=fields(await entries());await tab(labels[0]);assert.deepEqual(fields(await entries()),chosen);await tab(labels[1]);await save();assert.deepEqual(savedPageIds,[2,...linked]);await tab(labels[1]);await expect(addedRow.getByRole('link')).toHaveAttribute('href','/admin/pages-blocks/pages/2');
    await addedRow.getByRole('checkbox').uncheck();await save();assert.deepEqual(savedPageIds,linked);await tab(labels[1]);
    if(width!==900)await page.locator('[data-module-editor-pages]').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-media-sidebar-pages-'+width+'.png')});
    await tab(labels[0]);await page.getByRole('tab',{name:labels[0],exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:labels[1],exact:true})).toBeFocused();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:labels[0],exact:true})).toBeFocused();
    for(const widget of ['latest','popular']){
      await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS[widget]);await expect(page.locator('input[name="limit"]')).toHaveValue(String(MEDIA_SIDEBAR_WIDGET_DEFAULTS[widget].defaultLimit));
      for(const source of ['categories','media-center']){
        await choose('source_kind',source==='categories'?'التصنيفات':'المركز الإعلامي');
        if(source==='categories'){
          await expect(field('content_type')).toHaveCount(0);await choose('category_slug','— تصنيف فرعي');await expect(page.locator('select[name="category_slug"]')).toHaveValue('fixtures-child');
        }else{
          await expect(field('category_slug')).toHaveCount(0);await choose('content_type','كل محتوى المركز الإعلامي');
        }
        for(const [index,presentation]of MEDIA_SIDEBAR_PRESENTATIONS.entries()){
          await choose('presentation',MEDIA_SIDEBAR_PRESENTATION_LABELS[presentation]);const limit=[1,4,60][index];await page.locator('input[name="limit"]').fill(String(limit));
          await expect(page.locator('input[name="limit"]')).toHaveAttribute('min','1');await expect(page.locator('input[name="limit"]')).toHaveAttribute('max','60');
          await displayGeometry(width);
          for(const [,,label]of flags){const control=page.getByRole('switch',{name:label,exact:true});await expect(control).toBeEnabled();await control.focus();await expect(control).toBeFocused();await page.keyboard.press('Space');}
          const display=await flagsValue(),dirty=fields(await entries());
          for(const label of labels){await tab(label);assert.deepEqual(fields(await entries()),dirty,'Inactive-tab data remains submitted');await layout();}
          await save();assert.deepEqual(saved.config.source,source==='categories'?{kind:source,categorySlug:'fixtures-child'}:{kind:source,contentType:'all'});assert.equal(saved.config.limit,limit);assert.equal(saved.config.presentation,presentation);assert.deepEqual(saved.config.display,display);assert.deepEqual(savedPageIds,linked);
          await tab(labels[0]);await checkFlags(display);cases++;
        }
      }
    }
    // Selecting sections hides and disables content-only fields but must not reset drafts.
    await choose('source_kind','التصنيفات');await choose('category_slug','— تصنيف فرعي');await choose('presentation','مجموعة متحركة');
    for(const [,,label]of flags){await page.getByRole('switch',{name:label,exact:true}).focus();await page.keyboard.press('Space');}
    const unsavedFlags=await flagsValue();await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS.sections);
    await expect(page.getByRole('switch',{name:/^إظهار /})).toHaveCount(0);for(const [,name]of flags)assert.equal(new Map(await entries()).has(name),false,'Hidden widget settings are inactive');
    await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS.latest);await checkFlags(unsavedFlags);await expect(page.locator('select[name="category_slug"]')).toHaveValue('fixtures-child');await expect(page.locator('select[name="presentation"]')).toHaveValue('group-carousel');await expect(page.locator('input[name="limit"]')).toHaveValue('3');
    await page.locator('input[name="limit"]').fill('60');await save();assert.deepEqual(saved.config.display,unsavedFlags);
    await tab(labels[0]);await layout();
    if(width!==900)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-media-sidebar-content-'+width+'.png')});
    await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS.sections);await save();assert.deepEqual(saved.config,base.config);
    console.log('Media Sidebar actual controls, source/presentation matrix, draft preservation, page assignments, RTL/keyboard PASS '+width);
  }
  await page.setViewportSize({width:1440,height:1100});await open();
  for(const widget of ['latest','popular']){
    await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS[widget]);await choose('source_kind','المركز الإعلامي');
    const expectedTypes=['all',...MEDIA_EDITABLE_CONTENT_TYPES];
    assert.deepEqual(await page.locator('select[name="content_type"] option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean)),expectedTypes);
    for(const type of expectedTypes){await choose('content_type',type==='all'?'كل محتوى المركز الإعلامي':getContentTypeLabel(type));await save();assert.equal(saved.config.source.contentType,type);}
  }
  // Existing input normalization and canonical validation boundaries remain unchanged.
  await page.locator('input[name="limit"]').fill('0');await expect(page.locator('input[name="limit"]')).toHaveValue('1');await save();assert.equal(saved.config.limit,1);
  await page.locator('input[name="limit"]').fill('61');await expect(page.locator('input[name="limit"]')).toHaveValue('60');await save();assert.equal(saved.config.limit,60);
  const valid=new MapFormData(await entries());for(const value of ['0','61','1.5','']){valid.set('limit',value);assert.throws(()=>buildMediaSidebarModuleConfig('popular',valid),/بين 1 و60/);}valid.set('limit','4');valid.set('content_type','article');assert.throws(()=>buildMediaSidebarModuleConfig('popular',valid),/نوع محتوى صالح/);valid.set('content_type','all');valid.set('presentation','unknown');assert.throws(()=>buildMediaSidebarModuleConfig('popular',valid),/شكل عرض صالح/);valid.set('presentation','list');valid.set('source_kind','categories');valid.set('category_slug','');assert.throws(()=>buildMediaSidebarModuleConfig('popular',valid),/اختر تصنيف/);
  for(const [index,id]of ids.entries()){await open(base,id);await expect(page.getByRole('tab',{name:labels[index],exact:true})).toHaveAttribute('aria-selected','true');}await open(base,'unknown');await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue('content');
  // Every live family record adopts the shared composition; legacy data still parses and round-trips through the existing owner.
  for(const width of [1440,900,390]){
    await page.setViewportSize({width,height:1100});
    for(const record of family){
      savedPageIds=[...linked];await open(record);
      await expect(page.getByRole('heading',{name:record.name,exact:true})).toBeVisible();
      await expect(page.getByRole('tab')).toHaveText(labels);await expect(page.getByRole('tablist')).toHaveCount(1);
      await expect(page.locator('input[name="id"]')).toHaveValue(String(record.id));
      const canonical=parseMediaSidebarModuleConfig(record.config,record.widget_key);
      assert.deepEqual(buildMediaSidebarModuleConfig(record.widget_key,new MapFormData(await entries())),canonical);
      await save();assert.deepEqual(saved.config,canonical);assert.deepEqual(savedPageIds,linked);
      await field('widget_key').getByRole('combobox').focus();await page.keyboard.press('Enter');await expect(page.getByRole('option')).toHaveText(Object.values(MEDIA_SIDEBAR_WIDGET_LABELS));await page.keyboard.press('Escape');
      if(record.widget_key==='sections')await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS.latest);
      await displayGeometry(width);await choose('source_kind','التصنيفات');await choose('category_slug','— تصنيف فرعي');await choose('presentation','مجموعة متحركة');await page.locator('input[name="limit"]').fill('60');
      for(const [,,label]of flags){await page.getByRole('switch',{name:label,exact:true}).focus();await page.keyboard.press('Space');}
      const expectedDisplay=await flagsValue();await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS.sections);await expect(page.getByRole('switch',{name:/^إظهار /})).toHaveCount(0);
      await choose('widget_key',MEDIA_SIDEBAR_WIDGET_LABELS[record.widget_key==='sections'?'latest':record.widget_key]);await checkFlags(expectedDisplay);
      await expect(page.locator('select[name="category_slug"]')).toHaveValue('fixtures-child');await expect(page.locator('select[name="presentation"]')).toHaveValue('group-carousel');
      await page.locator('input[name="limit"]').fill('60');const snapshot=fields(await entries());
      await tab(labels[1]);assert.deepEqual(fields(await entries()),snapshot);await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toHaveCount(0);
      await expect(page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})).toHaveText('6 محددة');
      for(const id of linked){const row=page.locator('[data-module-page-row="'+id+'"]');await expect(row.getByRole('checkbox')).toBeChecked();await expect(row.getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/'+id);}
      const changedPage=page.locator('[data-module-page-row="12"]').getByRole('checkbox');await changedPage.focus();await page.keyboard.press('Space');await expect(page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})).toHaveText('5 محددة');
      const publication=page.getByRole('switch',{name:'حالة النشر',exact:true});await publication.focus();await page.keyboard.press('Space');await expect(publication).not.toBeChecked();await save();assert.equal(saved.status,'unpublished');assert.deepEqual(saved.config.display,expectedDisplay);assert.equal(saved.config.limit,60);assert.deepEqual(savedPageIds,[7,8,9,10,11]);
      await publication.focus();await page.keyboard.press('Space');await tab(labels[1]);await changedPage.focus();await page.keyboard.press('Space');await save();assert.equal(saved.status,'published');assert.deepEqual(savedPageIds,linked);
      await tab(labels[0]);await checkFlags(expectedDisplay);await displayGeometry(width);await page.getByRole('tab',{name:labels[0],exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:labels[1],exact:true})).toBeFocused();await page.keyboard.press('Home');
      if(record.id!==1&&width!==900)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-media-sidebar-'+record.id+'-'+width+'.png')});
      console.log('Media Sidebar family '+record.id+': legacy/config roundtrip, dynamic controls, status, assignments, grid/RTL PASS '+width);
    }
  }
  // Outside-family consumers keep the shared PagesTab notice and the original display-settings defaults.
  for(const width of [1440,900,390]){
    savedPageIds=[...linked];await page.setViewportSize({width,height:1100});await open();
    await page.evaluate(()=>window.mount('default-pages'));await ready();await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toHaveCount(1);await expect(page.getByRole('link',{name:'مدير الصفحة',exact:true})).toHaveCount(6);await expect(page.locator('[data-module-page-row="7"]')).toHaveClass(defaultAssignmentRowClass);
    for(const mode of ['display-default-article','display-default-media']){
      saved={title:true,image:true,category:false,series:false,excerpt:true,date:true,introCard:true};await page.goto(url+'?mode='+mode);await ready();
      const shared=page.locator('[data-content-display-settings]'),count=7;
      await expect(shared).toHaveClass('grid scroll-mt-24 gap-3 sm:grid-cols-2 lg:grid-cols-4');await expect(shared.locator('[data-admin-form-grid]')).toHaveCount(0);
      await expect(shared.getByRole('switch')).toHaveCount(count);await expect(page.getByRole('textbox',{name:'حقل تابع'})).toHaveValue('قيمة محفوظة');
      assert.equal(await shared.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1024?4:width>=640?2:1);
      for(const control of await shared.getByRole('switch').all()){const checked=await control.isChecked();await control.focus();await expect(control).toBeFocused();await page.keyboard.press('Space');await expect(control).toBeChecked({checked:!checked});}
      const expected=Object.fromEntries(await Promise.all(displayFixtureFields.map(async([key,name])=>[key,await page.locator('[name="'+name+'"]').isChecked()])));assert.deepEqual(displaySaveOwners[mode==='display-default-article'?'article':'media'](new MapFormData(await entries())),expected);await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();assert.deepEqual(saved,expected);
      for(const [key,,label]of flags)await expect(page.getByRole('switch',{name:label,exact:true})).toBeChecked({checked:expected[key]});
      await expect(page.getByRole('switch',{name:'إظهار بطاقة مقدمة الموضوع',exact:true})).toBeChecked({checked:expected.introCard});
      await expect(page.getByRole('textbox',{name:'حقل تابع'})).toHaveValue('قيمة محفوظة');await layout();
      if(mode==='display-default-article'&&width===1440)await shared.screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-media-sidebar-display-default.png')});
    }
  }
  assert.deepEqual(errors,[]);console.log('PASS Media Sidebar family: three live records across three viewports; '+cases+' shared widget/source/presentation/viewport cases; '+saves+' isolated saves/reloads; all three widget choices, two sources, six media filters, three presentations, six switches, page assignments and defaults preserved; no DB writes.');
}

async function verifyMediaHub(){
  const {parseMediaHubModuleConfig,MEDIA_HUB_SECTION_DEFAULTS}=mediaHubContract;
  const base={id:11,name:'Media Center — News Listing Presentation',slug:'media-listing-presentation-news',description:'Listing presentation for /media-center/news',status:'published',section_key:'featured',config:{placement:'listing',type:'news',source:'topics',presentation:{title:'عنوان محفوظ *حرفي* <tag>',eyebrow:'تمهيد محفوظ',description:'وصف محفوظ & رموز',ctaText:'استكشف',showTitle:false,titleBold:false,titleAlignment:'left',showDescription:false,descriptionAlignment:'center',collectionView:{layout:'editorial',itemsPerRow:2,cardVariant:'default'}},listing:{presentation:'list',itemLimit:6,itemsPerRow:2,display:{title:true,image:true,category:true,series:true,excerpt:true,date:true,details:{visible:true,text:'اقرأ المزيد',bold:true,alignment:'right'}}}}};
  const labels=['إعدادات القائمة','إعدادات العرض','الظهور'],ids=['content','presentation','pages'];
  const listPanel=()=>page.getByRole('tabpanel',{name:'إعدادات القائمة',exact:true,includeHidden:true});
  const displayPanel=()=>page.getByRole('tabpanel',{name:'إعدادات العرض',exact:true,includeHidden:true});
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const fields=values=>values.filter(([key])=>!['module_editor_tab','$ACTION_KEY'].includes(key)&&!key.startsWith('$ACTION')).sort(([a],[b])=>a.localeCompare(b));
  const open=async(row=base,active='content')=>{saved=structuredClone(row);await page.goto(url+'?mode=media-hub&tab='+active+'&returnPageId=13');await ready();};
  const save=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();};
  const choose=async(name,value)=>{const field=page.locator('[data-admin-form-listbox]').filter({has:page.locator('select[name="'+name+'"]')});await field.getByRole('combobox').click();await page.getByRole('option',{name:value,exact:true}).click();await expect(field.getByRole('combobox')).toBeFocused();};
  const rows=()=>page.locator('[data-collection-display-settings] [data-module-editor-control-row]');
  const names=['id','name','description','data_source','placement','section_key','eyebrow','title','presentation_description','cta_text','show_eyebrow','eyebrow_bold','eyebrow_alignment','show_section_title','section_title_bold','section_title_alignment','show_description','description_bold','description_alignment','show_cta','cta_bold','cta_alignment','content_type','presentation','items_per_row','item_limit','show_title_on_page','title_bold','title_alignment','show_image_on_page','show_category_on_page','category_bold','category_alignment','show_series_on_page','series_bold','series_alignment','show_excerpt_on_page','excerpt_bold','excerpt_alignment','show_date_on_page','date_bold','date_alignment','show_details','details_bold','details_alignment','details_text'];
  savedPageIds=[7];
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await open();
    await expect(page.getByRole('tab')).toHaveText(labels);
    await expect(page.getByRole('tablist')).toHaveCount(1);
    await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue('content');
    // The tab owns the configuration header; the display section owns its implicit header.
    const listHeader=listPanel().locator('[data-admin-tab-section-heading="content"]');
    await expect(listPanel().locator('[data-admin-form-control-header]')).toHaveCount(1);
    await expect(listHeader).toHaveCount(1);
    await expect(listHeader.getByRole('heading',{name:'إعدادات موديول المركز الإعلامي',exact:true})).toHaveCount(1);
    await expect(listHeader.getByText('حرّر نصوص السكشن مع بقاء إعدادات العرض في قسمها المستقل.',{exact:true})).toHaveCount(1);
    await expect(listHeader.locator('svg')).toHaveCount(1);
    await expect(listPanel().locator('[data-collection-module-editor] [data-admin-form-control-header]')).toHaveCount(0);
    await expect(displayPanel().locator('[data-admin-tab-section-heading]')).toHaveCount(0);
    const displayHeader=displayPanel().locator('[data-collection-display-settings]').locator('..').locator(':scope > [data-admin-form-control-header]');
    await expect(displayHeader).toHaveCount(1);
    await expect(displayHeader).toHaveText('إعدادات العرض');
    await expect(displayHeader.locator('svg')).toHaveCount(1);
    await expect(listPanel().locator('[data-collection-display-settings]')).toHaveCount(0);
    await expect(displayPanel().locator('[data-collection-display-settings]')).toHaveCount(1);
    for(const name of ['content_type','presentation','items_per_row','item_limit']){
      await expect(listPanel().locator('[name="'+name+'"]')).toHaveCount(1);
      await expect(displayPanel().locator('[name="'+name+'"]')).toHaveCount(0);
    }
    for(const name of names.slice(names.indexOf('show_title_on_page'))){
      await expect(displayPanel().locator('[name="'+name+'"]')).toHaveCount(1);
      await expect(listPanel().locator('[name="'+name+'"]')).toHaveCount(0);
    }
    await expect(rows()).toHaveCount(7);
    await expect(page.locator('[data-admin-rich-text-scope], [data-admin-media-image-field], [data-admin-link-field]')).toHaveCount(0);
    const initialEntries=fields(await entries());
    for(const name of names)assert.equal(initialEntries.filter(([key])=>key===name).length,1,'Exactly one submitted field: '+name);
    await expect(page.locator('input[type="hidden"][name="items_per_row"]')).toHaveValue('2');
    for(const [index,label] of labels.entries()){
      await tab(label);assert.deepEqual(fields(await entries()),initialEntries);
      await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(ids[index]);
      if(label==='إعدادات العرض'){
        await expect(rows().getByRole('switch')).toHaveCount(7);
        await expect(rows().locator('[data-admin-form-control-header]')).toHaveText(['العنوان','الصورة','التصنيف','السلسلة','المقتطف','التاريخ','زر التفاصيل']);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const button=page.getByRole('tab',{name:label,exact:true});await button.focus();await expect(button).toBeFocused();
      await expect(page.locator('#'+await button.getAttribute('aria-controls'))).toBeVisible();
    }
    const assigned=page.locator('[data-module-page-row="7"]');
    await expect(assigned.getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/7');
    await assigned.getByRole('link').focus();await expect(assigned.getByRole('link')).toBeFocused();
    await page.locator('[data-module-page-row="2"]').getByRole('checkbox').focus();await page.keyboard.press('Space');await page.keyboard.press('Space');
    if(!baseline){
      await expect(page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})).toHaveText('1 محددة');
      await expect(page.locator('[data-module-page-groups] [data-admin-form-control-header]')).toHaveCount(2);
    }
    await tab('إعدادات القائمة');await page.getByRole('tab',{name:'إعدادات القائمة',exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'الظهور',exact:true})).toBeFocused();await page.keyboard.press('Home');
    await choose('presentation','شبكة');await expect(page.locator('select[name="items_per_row"]')).toHaveValue('2');
    await choose('items_per_row','4');await choose('presentation','قائمة');await expect(page.locator('input[type="hidden"][name="items_per_row"]')).toHaveValue('4');
    await choose('presentation','شبكة');await expect(page.locator('select[name="items_per_row"]')).toHaveValue('4');
    const unsavedConfiguration=fields(await entries());
    await tab('إعدادات العرض');assert.deepEqual(fields(await entries()),unsavedConfiguration);
    if(!baseline){
      await expect(rows().locator('[data-admin-form-control-header]')).toHaveCount(7);
      const grid=page.locator('[data-collection-display-settings] [data-admin-form-grid]');assert.equal(await grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1280?3:width>=768?2:1);
      for(const header of await rows().locator('[data-admin-form-control-header]').all()){
        assert.equal(await header.locator('svg').count(),1);
        assert.equal(await header.locator('svg').evaluate(e=>e.getBoundingClientRect().width),20);
      }
    }
    for(const button of await rows().getByRole('button').all()){
      const r=await button.boundingBox();assert.ok(r.width>=32&&r.height>=32,'Control target retained');
      await button.focus();await expect(button).toBeFocused();
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await tab('إعدادات القائمة');assert.deepEqual(fields(await entries()),unsavedConfiguration);
    if(width!==1024)await page.locator('#root').screenshot({path:path.join(root,'.tmp-qa/story-adoption/'+(baseline?'before':'after')+'-media-hub-'+width+'.png')});
    console.log('Media Hub three flat tabs / exact field placement / hidden values / keyboard / RTL PASS '+width);
  }
  await page.setViewportSize({width:1440,height:1100});await open();
  const built=await saveMediaHub(new MapFormData(await entries()));await save();
  assert.deepEqual(saved.config,built.config);assert.equal(saved.description,base.description);assert.equal(saved.section_key,'featured');
  const originalPresentation=structuredClone(saved.config.presentation);
  await choose('presentation','شبكة');await choose('items_per_row','4');await choose('item_limit','12');
  await tab('إعدادات العرض');
  await page.getByRole('textbox',{name:'نص زر التفاصيل',exact:true}).fill('تفاصيل محفوظة *حرفي* <tag> &');
  for(const row of await rows().all()){
    const toggle=row.getByRole('switch');await toggle.focus();await page.keyboard.press('Space');
    const bold=row.getByRole('button',{name:'تنسيق عريض',exact:true});
    if(await bold.count()){await bold.click();await row.getByRole('button',{name:'محاذاة لليسار',exact:true}).click();}
  }
  const dirtyValues=fields(await entries());
  for(const label of labels){await tab(label);assert.deepEqual(fields(await entries()),dirtyValues,'Unsubmitted values survive tab navigation');}
  const edited=await saveMediaHub(new MapFormData(await entries()));
  await tab('الظهور');await page.locator('[data-module-page-row="2"]').getByRole('checkbox').check();
  for(const active of ['الظهور','إعدادات العرض','إعدادات القائمة']){await tab(active);await save();assert.deepEqual(saved.config,edited.config);assert.deepEqual(savedPageIds,[2,7]);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),'13');}
  assert.deepEqual(Object.fromEntries(Object.entries(saved.config.presentation).filter(([key])=>key!=="collectionView")),Object.fromEntries(Object.entries(originalPresentation).filter(([key])=>key!=="collectionView")));assert.equal(saved.config.listing.display.details.text,'تفاصيل محفوظة *حرفي* <tag> &');
  for(const [type,label]of [['news','أخبار'],['video','فيديوهات'],['gallery','معرض الصور'],['press','بيانات صحفية'],['site_update','تحديثات الموقع']]){
    await choose('content_type',label);await save();assert.equal(saved.config.type,type);
    assert.deepEqual(parseMediaHubModuleConfig(saved.config,'featured').listing,saved.config.listing);
  }
  await choose('presentation','قائمة');await save();assert.equal(saved.config.listing.itemsPerRow,4);assert.equal(saved.config.listing.presentation,'list');
  await choose('presentation','شبكة');await expect(page.locator('select[name="items_per_row"]')).toHaveValue('4');
  // Required controls still prevent an invalid save, even in the inactive panel.
  await tab('إعدادات العرض');
  await page.getByRole('textbox',{name:'نص زر التفاصيل',exact:true}).fill('');
  await tab('الظهور');const priorSaves=saves;await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();
  assert.equal(await page.locator('input[name="details_text"]').evaluate(e=>e.validity.valueMissing),true);assert.equal(saves,priorSaves);
  // Existing content/pages links retain their IDs; only the new presentation panel is added.
  for(const [index,id] of ids.entries()){
    await open(base,id);await expect(page.getByRole('tab',{name:labels[index],exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(id);
  }
  await open(base,'unknown');await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue('content');
  // Non-adopting Topics Listing and non-listing Hub keep their default presentation.
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});
    const topics={collection:{type:'all'},presentation:'grid',itemsPerRow:3,itemLimit:6,display:mediaHubFormatting.resolveCollectionModuleDisplayFormatting({})};
    await page.evaluate(c=>window.mount('topics-default',c),topics);await ready();
    await expect(rows()).toHaveCount(7);await expect(rows().locator('[data-admin-form-control-header]')).toHaveCount(0);
    await expect(page.locator('[data-collection-module-editor]').getByText('إعدادات القائمة',{exact:true})).toHaveCount(1);
    await expect(page.locator('[data-collection-module-editor]').getByText('إعدادات العرض',{exact:true})).toHaveCount(1);
    assert.equal(await page.locator('[data-collection-display-settings]').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=768?3:1);
    await choose('presentation','قائمة');await expect(page.locator('input[name="items_per_row"]')).toHaveValue('3');
    await choose('presentation','شبكة');await expect(page.locator('select[name="items_per_row"]')).toHaveValue('3');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    for(const section of ['videos','gallery','press','site-updates']){
      await open({...base,id:12,slug:'media-listing-presentation-'+section,section_key:section},'content');
      await expect(page.getByRole('tab')).toHaveText(['المحتوى','الظهور']);
      await expect(page.locator('[data-collection-module-editor]').getByText('إعدادات القائمة',{exact:true})).toHaveCount(1);
      await expect(page.locator('[data-collection-module-editor]').getByText('إعدادات العرض',{exact:true})).toHaveCount(1);
      await expect(rows().getByRole('switch')).toHaveCount(7);
      await expect(page.getByRole('tabpanel',{name:'المحتوى',exact:true}).locator('[data-collection-display-settings]')).toHaveCount(1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await open({...base,id:12,section_key:'gallery',config:MEDIA_HUB_SECTION_DEFAULTS.gallery.config},'presentation');
    await expect(page.getByRole('tab')).toHaveText(['المحتوى','العرض','الظهور']);await expect(rows().locator('[data-admin-form-control-header]')).toHaveCount(0);
    await expect(page.locator('[data-collection-presentation-fields]')).toBeVisible();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Media Hub isolated action Save/Reload: '+saves+' saves, five media types, all seven formatting groups, inactive values, required validation, page assignments; Topics/non-listing Hub defaults preserved; no DB writes.');
}
function MapFormData(entries){const result=new FormData();for(const [key,value]of entries)result.append(key,value);return result;}

async function verifyContact(){
  const contactUrl=url+'?mode=contact-premium',labels=['النصوص','الصور','الزر والرابط','البطاقات','الظهور'],ids=['text','image','cta','contacts','pages'];
  const link={link_kind:'static_route',linked_type:'static_routes',href:'/about',meta:{route_key:'about'},anchor:'team',target:'_self'};
  const base={eyebrow:'تواصل معنا',title:'عنوان أول\nعنوان ثانٍ',description:'نص عادي *حرفي* <tag> & رموز\nسطر ثانٍ\n\nفقرة محفوظة',button:{label:'تواصل الآن',link,target:'_self'},note:'ملاحظة *حرفية* <tag>',image:'/one.svg',imageAlt:'نص بديل محفوظ',contacts:[{label:'واتساب',value:'01000000001',secondaryValue:'01000000002',icon:'whatsapp'},{label:'هاتف',value:'01000000003',icon:'phone',link},{label:'بريد',value:'qa@example.test',icon:'mail',link},{label:'أوقات العمل',value:'من السبت إلى الخميس',icon:'clock',link}],showEyebrow:true,showTitle:true,showDescription:true,eyebrowBold:false,titleBold:true,descriptionBold:false,eyebrowAlignment:'right',titleAlignment:'right',descriptionAlignment:'right'};
  const entries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const canonical=data=>{const fd=new FormData();for(const[k,v]of data)fd.append(k,v);return saveConfig(fd);};
  const contentFields=data=>data.filter(([key])=>key!=='module_editor_tab');
  const open=async(config=base,active='text')=>{saved=structuredClone(config);await page.goto(contactUrl+'&tab='+active+'&returnPageId=1');await ready();};
  const save=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();};
  const cards=()=>page.locator('[data-module-editor-repeater-card]');
  const media=()=>page.locator('[data-admin-media-image-field="image"]');
  const buttonLink=()=>page.locator('[data-admin-link-field]').filter({has:page.locator('input[name="button_link_kind"]')});
  const groups=()=>page.locator('[data-module-page-groups]');
  const row=id=>page.locator('[data-module-page-row="'+id+'"]');
  savedPageIds=[1];
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await open();
    await expect(page.getByRole('tab')).toHaveText(labels);
    await expect(page.locator('[data-admin-rich-text-scope]')).toHaveCount(0);
    await expect(page.getByRole('textbox',{name:'الوصف',exact:true})).toHaveValue(base.description);
    const before=contentFields(await entries());
    for(const [i,label]of labels.entries()){
      await tab(label);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(ids[i]);
      const control=page.getByRole('tab',{name:label,exact:true});await control.focus();await expect(control).toBeFocused();
      await expect(page.locator('#'+await control.getAttribute('aria-controls'))).toBeVisible();
      assert.deepEqual(contentFields(await entries()),before);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await tab('البطاقات');await expect(cards()).toHaveCount(4);await expect(cards().locator('[data-admin-form-control-header]')).toHaveCount(4);
    const grid=page.locator('[data-module-editor-repeater-grid] [data-admin-form-grid]');
    assert.equal(await grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=768?2:1);
    const rects=await Promise.all((await cards().all()).map(c=>c.boundingBox()));
    if(width>=768)assert.ok(rects[0].x>rects[1].x&&Math.abs(rects[0].y-rects[1].y)<1&&rects[2].y>rects[0].y+rects[0].height&&Math.abs(rects[2].y-rects[3].y)<1);
    else for(let i=1;i<4;i++)assert.ok(rects[i].y>rects[i-1].y+rects[i-1].height);
    await expect(cards().getByRole('switch')).toHaveCount(0);await expect(cards().getByRole('button',{name:/^(حذف|إضافة|تكرار)$/})).toHaveCount(0);
    await expect(cards().first().getByRole('button',{name:'تحريك الصف لأعلى',exact:true})).toBeDisabled();
    await expect(cards().last().getByRole('button',{name:'تحريك الصف لأسفل',exact:true})).toBeDisabled();
    for(const b of await cards().getByRole('button',{name:/تحريك الصف/}).all()){const r=await b.boundingBox();assert.equal(r.height,44);assert.equal(r.width,44);}
    await expect(page.locator('input[name="contact_0_secondary_value"]')).toHaveValue(base.contacts[0].secondaryValue);
    await expect(cards().first().locator('[data-admin-link-field]')).toHaveCount(0);
    if(width!==1024)await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-contact-cards-'+width+'.png')});
    await tab('الصور');await expect(media().locator('img')).toBeVisible();assert.equal(await media().locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
    await tab('الزر والرابط');await expect(buttonLink()).toHaveCount(1);
    const actions=buttonLink().locator('[data-admin-link-actions]');await expect(actions).toHaveCount(1);
    for(const b of await actions.getByRole('button').all()){const r=await b.boundingBox();assert.equal(r.width,44);assert.equal(r.height,44);assert.equal(await b.locator('svg').evaluate(e=>e.getBoundingClientRect().width),22);}
    await tab('الظهور');await expect(groups().locator('[data-admin-form-control-header]')).toHaveCount(2);
    await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('1 محددة');
    await row(2).getByRole('checkbox').focus();await page.keyboard.press('Space');await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('2 محددة');await page.keyboard.press('Space');
    const position=row(1).getByRole('link',{name:'إدارة الموضع'});await expect(position).toHaveAttribute('href','/admin/pages-blocks/pages/1');await position.focus();await expect(position).toBeFocused();
    await tab('النصوص');await page.getByRole('tab',{name:'النصوص',exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'الظهور',exact:true})).toBeFocused();await page.keyboard.press('Home');
    console.log('Contact actual tabs / shared premium owners / four fixed contacts / responsive RTL / focus PASS '+width);
  }
  await page.setViewportSize({width:1440,height:1100});await open();const before=canonical(await entries());await save();assert.deepEqual(saved,before);assert.equal(saved.description,base.description);assert.equal(saved.title,base.title);
  await page.getByRole('textbox',{name:'الوصف',exact:true}).fill('نص معدل *حرفي* <tag> &\nسطر ثانٍ\n\nفقرة ثانية');
  await page.getByRole('textbox',{name:'العنوان',exact:true}).fill('عنوان معدل\nسطر ثانٍ');
  await page.getByRole('textbox',{name:'النص التمهيدي',exact:true}).fill('تمهيد معدل');
  for(const field of ['eyebrow','title','description']){
    const control=page.locator('[data-module-editor-control-row]').filter({has:page.locator('input[name="show_'+field+'"]')});
    await control.getByRole('button',{name:'تنسيق عريض',exact:true}).click();
    await control.getByRole('button',{name:'محاذاة للوسط',exact:true}).click();
    await control.getByRole('switch').focus();await page.keyboard.press('Space');
  }
  await tab('الصور');await media().locator('[data-admin-media-image-preview-trigger]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-admin-media-image-expanded]')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(media().locator('[data-admin-media-image-preview-trigger]')).toBeFocused();
  await media().getByRole('button',{name:'استبدال',exact:true}).click();await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await media().getByLabel('وصف الصورة',{exact:true}).fill('بديل محفوظ');
  await tab('الزر والرابط');await page.locator('input[name="button_label"]').fill('زر محفوظ');await page.locator('input[name="note"]').fill('ملاحظة محفوظة');
  await buttonLink().getByRole('button',{name:'مسح الرابط',exact:true}).click();await expect(buttonLink().locator('[data-admin-link-destination]')).toContainText('لم يتم اختيار رابط بعد.');
  await buttonLink().getByRole('button',{name:'اختيار الرابط',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:/^من نحن/}).click();await page.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(buttonLink().getByRole('button',{name:'اختيار الرابط',exact:true})).toBeFocused();
  await buttonLink().getByPlaceholder('team').fill('contact');
  await tab('البطاقات');
  await page.locator('input[name="contact_0_label"]').fill('واتساب محفوظ');await page.locator('input[name="contact_0_secondary_value"]').fill('01000000999');
  await page.locator('input[name="contact_1_label"]').fill('هاتف محفوظ');
  const beforeMove=canonical(await entries()).contacts;
  const move=cards().first().getByRole('button',{name:'تحريك الصف لأسفل',exact:true});await move.focus();await page.keyboard.press('Enter');
  assert.deepEqual(canonical(await entries()).contacts,[beforeMove[1],beforeMove[0],beforeMove[2],beforeMove[3]]);
  await expect(page.locator('input[name="contact_1_secondary_value"]')).toHaveValue('01000000999');
  await cards().nth(1).getByRole('button',{name:'تحريك الصف لأعلى',exact:true}).click();assert.deepEqual(canonical(await entries()).contacts,beforeMove);
  await tab('الظهور');await row(2).getByRole('checkbox').check();await row(7).getByRole('checkbox').check();
  const edited=canonical(await entries());
  for(const active of labels){await tab(active);await save();assert.deepEqual(saved,edited);assert.deepEqual(savedPageIds,[1,2,7]);}
  for(const key of ['Eyebrow','Title','Description'])assert.equal(saved['show'+key],false);
  assert.equal(saved.button.link.anchor,'contact');assert.equal(saved.contacts[0].secondaryValue,'01000000999');assert.equal(saved.image,'/replacement.svg');assert.equal(saved.imageAlt,'بديل محفوظ');
  // Rendering remains plain text: literal tags and Markdown must not become formatting.
  await page.evaluate(c=>window.mount('contact-public',c),saved);await ready();await expect(page.getByText(saved.description,{exact:true})).toBeVisible();await expect(page.locator('#root section').locator('tag,script,.rich-text-content')).toHaveCount(0);
  await open(saved,'image');await media().getByRole('button',{name:'إزالة',exact:true}).click();await save();assert.equal(saved.image,undefined);assert.equal(saved.imageAlt,undefined);
  await tab('الزر والرابط');await buttonLink().getByRole('button',{name:'مسح الرابط',exact:true}).click();await save();assert.equal(saved.button.link,undefined);
  for(const active of ids){await open(base,active);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(active);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),'1');}
  for(const state of ['missing','deleted','unavailable']){
    referenceStatus=state;await open(base,'image');await expect(media().locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',state);
    const expected=canonical(await entries());await save();assert.deepEqual(saved,expected);assert.equal(saved.image,base.image);assert.equal(saved.imageAlt,base.imageAlt);
  }
  referenceStatus='active';
  // The same editor's About CTA mode retains its original three-column/plain owners.
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});saved=structuredClone(base);await page.goto(url+'?mode=about-cta-default');await ready();
    await expect(page.getByRole('tab')).toHaveText(['النصوص','الصور','الزر والرابط','وسائل التواصل','الظهور']);
    await expect(page.locator('input[name="title"]')).toHaveValue(base.title.replaceAll('\n','')); // Existing About CTA title is a single-line input.
    await expect(page.locator('[data-admin-form-control-presentation="leading-icon"]')).toHaveCount(0);
    await tab('وسائل التواصل');await expect(cards()).toHaveCount(4);await expect(cards().locator('[data-admin-form-control-header]')).toHaveCount(0);
    const grid=page.locator('[data-module-editor-repeater-grid]');await expect(grid.locator('[data-admin-form-grid]')).toHaveCount(0);
    assert.equal(await grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1280?3:width>=1024?2:1);
    assert.equal((await cards().first().getByRole('button',{name:'تحريك الصف لأعلى',exact:true}).boundingBox()).height,28);
    await expect(page.locator('input[name="contact_0_secondary_value"]')).toHaveCount(0);
    await tab('الصور');assert.equal(await media().locator('img').evaluate(e=>getComputedStyle(e).objectFit),'cover');
    await tab('الزر والرابط');await expect(buttonLink().locator('[data-admin-link-actions]')).toHaveCount(0);
    await tab('الظهور');await expect(groups().locator('[data-admin-form-grid]')).toHaveCount(0);for(const r of await page.locator('[data-module-page-row]').all())assert.equal(await r.getAttribute('class'),defaultAssignmentRowClass);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);console.log('PASS Contact: '+saves+' isolated saves, plain literals/multiline preservation, inactive fields, links/anchor, media states, four contacts/reorder/WhatsApp and About CTA defaults; no DB or Storage writes.');
}

async function verifyTrust(){
  const trustUrl=url+'?mode=trust-premium',intro=scope.getByRole('textbox',{name:'الفقرة التعريفية',exact:true});
  const base={eyebrow:'الثقة',title:'لماذا يثق السوق العقاري في فينيسيا؟',description:'<p>فقرة قديمة *حرفي* &lt;tag&gt;</p><p><strong>فقرة ثانية</strong> محفوظة.</p>',showEyebrow:true,showTitle:true,showDescription:true,descriptionBold:false,descriptionAlignment:'right',items:Array.from({length:4},(_,i)=>({title:'بطاقة '+(i+1),description:'وصف *حرفي* <tag> '+i+'\nسطر محفوظ',icon:'land',image:i===0?'/one.svg':undefined,imageAlt:'وصف صورة '+i}))};
  const form=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const protectedFields=data=>data.filter(([key])=>!['principles_intro','description_bold','description_alignment','module_editor_tab'].includes(key));
  const canonical=data=>{const fd=new FormData();for(const[k,v]of data)fd.append(k,v);return saveConfig(fd);};
  const open=async(config=base,active='content')=>{saved=structuredClone(config);await page.goto(trustUrl+'&tab='+active+'&returnPageId=1');await ready();};
  const save=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.reload();await ready();};
  const render=async(config=saved)=>{await page.evaluate(c=>window.mount('trust-public',c),config);await ready();};
  const publicIntro=()=>page.locator('.home-trust-intro');
  const grid=()=>page.locator('[data-module-editor-repeater-grid] [data-admin-form-grid]');
  const cards=()=>page.locator('[data-module-editor-repeater-card]');
  const media=i=>page.locator('[data-admin-media-image-field]').filter({has:page.locator('input[name="principle_'+i+'_image"]')});
  const row=id=>page.locator('[data-module-page-row="'+id+'"]');
  const count=label=>page.getByRole('status',{name:label});
  savedPageIds=[1];

  // Use the actual Content 101 toolbar as the adoption reference.
  await page.goto(url+'?mode=about-premium');await ready();
  const toolbar=await scope.getByRole('toolbar').evaluate(e=>({labels:[...e.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),className:e.className,font:getComputedStyle(e.querySelector('button')).fontSize}));
  for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:1100});await open();
    await expect(page.getByRole('tab')).toHaveText(['النصوص','البطاقات','الظهور']);
    assert.deepEqual(await scope.getByRole('toolbar').evaluate(e=>({labels:[...e.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),className:e.className,font:getComputedStyle(e.querySelector('button')).fontSize})),toolbar);
    await expect(scope.getByRole('button',{name:'H1',exact:true})).toHaveCount(0);
    await expect(page.locator('input[name="include_home_trust_intro"]')).toHaveCount(1);
    await expect(page.locator('input[name="principle_count"]')).toHaveCount(1);
    await expect(page.locator('input[name="principle_count"]')).toHaveValue('4');
    const initialFields=protectedFields(await form());
    for(const [id,label]of [['content','النصوص'],['cards','البطاقات'],['pages','الظهور']]){
      await tab(label);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(id);
      const control=page.getByRole('tab',{name:label,exact:true});await control.focus();await expect(control).toBeFocused();
      await expect(page.locator('#'+await control.getAttribute('aria-controls'))).toBeVisible();
      assert.deepEqual(protectedFields(await form()),initialFields);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await tab('البطاقات');
    await expect(cards()).toHaveCount(4);await expect(cards().locator('textarea')).toHaveCount(4);
    await expect(cards().locator('[data-admin-form-control-header]')).toHaveCount(4);
    await expect(cards().locator('[data-admin-rich-text-scope]')).toHaveCount(0);
    assert.equal(await grid().evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=768?2:1);
    const boxes=await Promise.all((await cards().all()).map(c=>c.boundingBox()));
    if(width>=768)assert.ok(boxes[0].x>boxes[1].x&&Math.abs(boxes[0].y-boxes[1].y)<1&&boxes[2].y>boxes[0].y+boxes[0].height&&Math.abs(boxes[2].y-boxes[3].y)<1);
    else for(let i=1;i<4;i++)assert.ok(boxes[i].y>boxes[i-1].y+boxes[i-1].height);
    for(let i=0;i<4;i++){
      await expect(cards().nth(i).getByRole('textbox',{name:'وصف البطاقة',exact:true})).toHaveValue(base.items[i].description);
      await expect(media(i)).toHaveCount(1);
    }
    await expect(page.getByRole('button',{name:/^(إضافة عنصر|حذف|نسخ|↑|↓)$/})).toHaveCount(0);
    if(width===1440||width===390)await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-trust-cards-'+width+'.png')});
    await tab('الظهور');
    await expect(page.locator('[data-module-page-groups] [data-admin-form-grid]')).toHaveCount(1);await expect(page.locator('[data-module-page-groups] [data-admin-form-control-header]')).toHaveCount(2);
    await expect(count('اختيارات الصفحات الرئيسية')).toHaveText('1 محددة');
    await expect(count('اختيارات مجموعات الصفحات')).toHaveText('0 محددة');
    await expect(row(1).getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/1');
    await row(1).getByRole('link').focus();await expect(row(1).getByRole('link')).toBeFocused();
    await row(2).getByRole('checkbox').focus();await page.keyboard.press('Space');
    await expect(count('اختيارات الصفحات الرئيسية')).toHaveText('2 محددة');
    await page.keyboard.press('Space');await expect(count('اختيارات الصفحات الرئيسية')).toHaveText('1 محددة');
    await tab('النصوص');await page.getByRole('tab',{name:'النصوص',exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'الظهور',exact:true})).toBeFocused();await page.keyboard.press('Home');
    await scope.getByRole('button',{name:'تنسيق عريض',exact:true}).focus();await page.keyboard.press('Tab');assert.ok(await scope.evaluate(e=>e.contains(document.activeElement)));
    for(const b of await scope.getByRole('toolbar').getByRole('button').all()){const r=await b.boundingBox(),area=await scope.boundingBox();assert.ok(r.height>=32&&r.x>=area.x&&r.x+r.width<=area.x+area.width+1);}
    if(width===1440)await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-trust-text-1440.png')});
    console.log('Trust actual tabs / full toolbar / four premium cards / optional images / counts / focus / RTL PASS at '+width);
  }
  await page.setViewportSize({width:1440,height:1100});await open();
  await page.locator('input[name="eyebrow"]').fill('نص تمهيدي محفوظ');await page.locator('input[name="title"]').fill('عنوان محفوظ');
  await intro.fill('فقرة معدلة *حرفي* <tag> &');await intro.press('Enter');await page.keyboard.insertText('فقرة ثانية');
  await tab('البطاقات');
  for(let i=0;i<4;i++){await cards().nth(i).getByLabel('عنوان البطاقة',{exact:true}).fill('بطاقة معدلة '+i);await cards().nth(i).getByRole('textbox',{name:'وصف البطاقة',exact:true}).fill('وصف محفوظ '+i+'\n*حرفي* <tag>');}
  await media(0).locator('[data-admin-media-image-preview-trigger]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-admin-media-image-expanded]')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(media(0).locator('[data-admin-media-image-preview-trigger]')).toBeFocused();
  await media(0).getByRole('button',{name:'استبدال',exact:true}).click();await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
  await media(0).getByLabel('النص البديل للصورة — اختياري',{exact:true}).fill('صورة بديلة محفوظة');
  await tab('الظهور');await row(2).getByRole('checkbox').check();await row(7).getByRole('checkbox').check();
  await expect(count('اختيارات الصفحات الرئيسية')).toHaveText('2 محددة');await expect(count('اختيارات مجموعات الصفحات')).toHaveText('1 محددة');
  const edited=canonical(await form());
  for(const active of ['الظهور','البطاقات','النصوص']){await tab(active);await save();assert.deepEqual(saved,edited);assert.deepEqual(savedPageIds,[1,2,7]);assert.equal(new URL(page.url()).searchParams.get('returnPageId'),'1');}
  assert.equal(saved.items[0].image,'/replacement.svg');assert.equal(saved.items[0].imageAlt,'صورة بديلة محفوظة');
  // Existing Media owner clears the alt when the image is explicitly removed.
  await tab('البطاقات');await media(0).getByRole('button',{name:'إزالة',exact:true}).click();await save();assert.equal(saved.items[0].image,undefined);assert.equal(saved.items[0].imageAlt,undefined);
  await render();await expect(page.locator('.home-trust-card')).toHaveCount(4);await expect(page.locator('[data-home-trust-flip-card]')).toHaveCount(0);
  for(const active of ['content','cards','pages']){await open(base,active);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(active);}
  console.log('Trust edited text/cards/media/assignments survive saves from every tab; removal and legacy deep links PASS');

  for(const legacy of ['نص قديم *حرفي* & رموز _ + [نص]\nسطر داخل الفقرة\n\nفقرة ثانية',base.description,'']){
    await open({...base,description:legacy,descriptionBold:true,descriptionAlignment:'center'});
    const canonicalIntro=await scope.locator('input[name="principles_intro"]').inputValue(),before=await intro.innerText(),other=protectedFields(await form());
    assert.equal(canonicalIntro,normalizeRichTextContent(legacy),'The existing serialization contract is unchanged');
    await save();assert.equal(saved.description,canonicalIntro||undefined);assert.equal(await intro.innerText(),before);assert.deepEqual(protectedFields(await form()),other);
    assert.equal(saved.descriptionBold,true);assert.equal(saved.descriptionAlignment,'center');
    if(legacy){await intro.press('Control+A');await scope.getByRole('button',{name:'تنسيق عريض',exact:true}).click();await scope.getByRole('button',{name:'محاذاة لليمين',exact:true}).click();await save();assert.equal(saved.descriptionBold,false);await expect(intro.locator('strong')).toHaveCount(0);await render();assert.equal(await publicIntro().locator('p').first().evaluate(e=>getComputedStyle(e).fontWeight),'400');}
  }
  for(const [button,tag,publicTag]of [['عنوان رئيسي داخل المقال','h2','h3'],['عنوان فرعي داخل المقال','h3','h4'],['تنسيق عريض','strong','strong'],['مائل','em','em'],['تحته خط','u','u'],['قائمة نقطية','ul','ul'],['قائمة مرقمة','ol','ol'],['رابط','a','a']]){
    await open({...base,description:'<p>نص محفوظ</p>'});const other=protectedFields(await form());
    await intro.fill('نص *حرفي* <tag> & [رموز]');await intro.press('Control+A');await scope.getByRole('button',{name:button,exact:true}).click();
    if(tag==='a'){await scope.getByRole('textbox',{name:'عنوان الرابط',exact:true}).fill('/about');await scope.getByRole('button',{name:'تطبيق الرابط',exact:true}).click();}
    await expect(intro.locator(tag)).toHaveText('نص *حرفي* <tag> & [رموز]');await save();await expect(intro.locator(tag)).toHaveText('نص *حرفي* <tag> & [رموز]');assert.deepEqual(protectedFields(await form()),other);assert.deepEqual(saved.items,base.items);
    await render();await expect(publicIntro().locator(publicTag)).toHaveText('نص *حرفي* <tag> & [رموز]');await expect(publicIntro().locator('h1,h2,tag')).toHaveCount(0);
    if(tag==='a'){await expect(publicIntro().locator('a')).toHaveAttribute('href','/about');await expect(publicIntro().locator('a')).toHaveAttribute('rel','noopener noreferrer');}
    if(tag==='h2'||tag==='h3')assert.ok(parseFloat(await publicIntro().locator(publicTag).evaluate(e=>getComputedStyle(e).fontSize))>16);
  }
  for(const [label,align]of [['محاذاة للوسط','center'],['محاذاة لليسار','left'],['ضبط النص من الجانبين','justify'],['محاذاة لليمين','right']]){
    await open();await intro.fill('فقرة أولى');await intro.press('Enter');await page.keyboard.insertText('فقرة ثانية');await intro.press('Shift+Enter');await page.keyboard.insertText('سطر ثالث');await scope.getByRole('button',{name:label,exact:true}).click();await save();await render();
    await expect(publicIntro().locator('p')).toHaveText(['فقرة أولى','فقرة ثانيةسطر ثالث']);await expect(publicIntro().locator('br')).toHaveCount(1);assert.equal(await publicIntro().locator('p').last().evaluate(e=>getComputedStyle(e).textAlign),align);
  }
  await render({...base,description:'<p>نص آمن<script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">رابط</a></p>'});
  await expect(publicIntro().locator('script,img,[onerror],[href^="javascript:"]')).toHaveCount(0);
  await render({...base,showDescription:false});await expect(publicIntro()).toHaveCount(0);
  await render({...base,items:[{image:'/one.svg'},{title:' '},{description:' '},{}]});await expect(page.locator('.home-trust-card')).toHaveCount(0);

  // New heading styling must not change the previous paragraph/card appearance.
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await render(base);
    const legacyMetrics=await publicIntro().evaluate(e=>{
      const measure=()=>[e,...e.querySelectorAll('*')].map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return [n.tagName,n.textContent,s.fontSize,s.lineHeight,s.color,s.fontWeight,s.marginTop,s.marginBottom,r.x,r.y,r.width,r.height];});
      const adopted=measure();e.classList.remove('article-rich-text');const legacy=measure();e.classList.add('article-rich-text');return {adopted,legacy};
    });assert.deepEqual(legacyMetrics.adopted,legacyMetrics.legacy);
    await expect(page.locator('.home-trust-card')).toHaveCount(4);await expect(page.locator('[data-home-trust-flip-card]')).toHaveCount(1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.evaluate(c=>window.mount('principles-grid',c),base);await ready();
    await expect(cards()).toHaveCount(4);await expect(cards().locator('[data-admin-form-control-header]')).toHaveCount(0);await expect(page.getByRole('button',{name:'إضافة عنصر',exact:true})).toBeVisible();
    await expect(page.locator('input[name="include_home_trust_intro"]')).toHaveCount(0);
    const legacyGrid=page.locator('[data-module-editor-repeater-grid]');await expect(legacyGrid.locator('[data-admin-form-grid]')).toHaveCount(0);
    assert.equal(await legacyGrid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1280?3:width>=1024?2:1);
    await page.evaluate(()=>window.mount('default-pages'));await ready();for(const r of await page.locator('[data-module-page-row]').all())assert.equal(await r.getAttribute('class'),defaultAssignmentRowClass);
  }
  assert.deepEqual(errors,[]);console.log('PASS Trust: '+saves+' isolated actual-owner saves; full formats, legacy literals/paragraphs, safe public rendering, unchanged legacy paragraph/card appearance, About Principles/default assignments preserved; no DB or Storage writes.');
}

async function verifyGrid(){
  const countTracks=async grid=>grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
  const readForm=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const config={eyebrow:'الثقة',title:'عنوان محفوظ',description:'فقرة قديمة محفوظة',items:Array.from({length:4},(_,i)=>({title:'بطاقة '+(i+1),description:'وصف محفوظ '+i+'\nسطر ثانٍ',icon:'land',image:i===0?'/one.svg':'',imageAlt:'وصف الصورة '+i}))};
  await page.goto(url);await ready();
  let baselineEntries;
  for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:1100});
    await page.evaluate(c=>window.mount('trust-grid',c),config);await ready();
    const wrapper=page.locator('[data-module-editor-repeater-grid]'),grid=wrapper.locator('[data-admin-form-grid]'),cards=grid.locator('[data-module-editor-repeater-card]');
    await expect(grid).toHaveCount(1);await expect(cards).toHaveCount(4);assert.equal(await countTracks(grid),width>=768?2:1);
    const boxes=await Promise.all((await cards.all()).map(c=>c.boundingBox()));
    if(width>=768){assert.ok(boxes[0].x>boxes[1].x&&Math.abs(boxes[0].y-boxes[1].y)<1&&boxes[2].y>=boxes[0].y+boxes[0].height&&Math.abs(boxes[2].y-boxes[3].y)<1);}else for(let i=1;i<4;i++)assert.ok(boxes[i].y>=boxes[i-1].y+boxes[i-1].height);
    await expect(page.locator('input[name="principle_count"]')).toHaveValue('4');
    const data=await readForm();if(!baselineEntries)baselineEntries=data;else assert.deepEqual(data,baselineEntries);
    for(let i=0;i<4;i++){await expect(cards.nth(i).getByLabel('عنوان البطاقة',{exact:true})).toHaveValue(config.items[i].title);await expect(cards.nth(i).getByRole('textbox',{name:'وصف البطاقة',exact:true})).toHaveValue(config.items[i].description);}
    const title=cards.first().getByLabel('عنوان البطاقة',{exact:true});await title.focus();await expect(title).toBeFocused();await title.fill('عنوان معدل');await expect(page.locator('input[name="principle_0_title"]')).toHaveValue('عنوان معدل');
    await cards.first().getByRole('textbox',{name:'وصف البطاقة',exact:true}).fill('وصف معدل');await expect(page.locator('input[name="principle_0_description"]')).toHaveValue('وصف معدل');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(width===1440||width===390)await wrapper.screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-trust-grid-'+width+'.png')});

    await page.evaluate(c=>window.mount('principles-grid',c),config);await ready();
    const legacy=page.locator('[data-module-editor-repeater-grid]');
    await expect(legacy.locator('[data-admin-form-grid]')).toHaveCount(0);
    assert.equal(await countTracks(legacy),width>=1280?3:width>=1024?2:1);
    await expect(legacy.locator('[data-module-editor-repeater-card]')).toHaveCount(4);
    await expect(page.getByRole('button',{name:'إضافة عنصر',exact:true})).toBeVisible();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  for(const width of [390,639,640,767,768,1023,1024,1279,1280,1440]){
    await page.setViewportSize({width,height:1100});
    for(const columns of [1,2,3,4,5,6,12]){
      await page.evaluate(c=>window.mount('grid-contract',c),{columns});await ready();
      const grid=page.locator('[data-admin-form-grid]');
      const expected=columns===1?1:columns===12?(width>=1280?12:1):columns===6||columns===5?(width>=1280?columns:width>=1024?3:width>=640?2:1):columns===4?(width>=1280?4:width>=640?2:1):columns===3?(width>=1280?3:width>=768?2:1):(width>=768?2:1);
      assert.equal(await countTracks(grid),expected,'columns='+columns+', width='+width);
      await expect(grid.locator(':scope > input')).toHaveCount(12);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.evaluate(()=>window.mount('grid-contract',{columns:3,presentation:'aligned-fields'}));await ready();
    assert.equal(await countTracks(page.locator('[data-admin-form-grid]')),width>=768?3:1);
  }
  assert.deepEqual(errors,[]);console.log('PASS Grid: Content 26 four unchanged cards in 2x2 / RTL / tablet / mobile; About Principles legacy layout preserved; 1,2,3,4,5,6,12 columns and existing breakpoint boundaries; no writes.');
}

async function verifyTabNames(){
  // Direct metadata consumers use the same renderer; distinct functions keep their names.
  const families=[
    {kind:'hero',ids:['content','order','media','buttons','display'],labels:['المحتوى','الترتيب','الصور','الزر والرابط','الظهور']},
    {kind:'hero',slug:'projects-hub-hero',ids:['content','buttons','order','details','display'],labels:['شرائح الهيرو','زر التفاصيل','ترتيب البيانات','Hero التفاصيل','الظهور']},
    ...['home-contact','about-cta'].map(slug=>({kind:'content',slug,ids:['text','image','cta','contacts','pages'],labels:['النصوص','الصور','الزر والرابط',slug==='home-contact'?'البطاقات':'وسائل التواصل','الظهور']})),
    {kind:'breadcrumb',ids:['content','settings','pages'],labels:['المحتوى','الإعدادات','الظهور']},
  ];
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});
    for(const family of families){
      await page.evaluate(c=>window.mount('metadata-tabs',c),family);await ready();await expect(page.getByRole('tab')).toHaveText(family.labels);
      for(const [i,label] of family.labels.entries()){
        await tab(label);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(family.ids[i]);
        const control=page.getByRole('tab',{name:label,exact:true}),r=await control.boundingBox();assert.ok(r.width>0&&r.height>=32);
        assert.equal(await control.evaluate(e=>e.scrollWidth>e.clientWidth),false,'Tab label must not clip: '+label);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(family.kind==='hero'&&!family.slug&&width!==1024)await page.getByRole('tablist').screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-tab-labels-'+width+'.png')});
    }
  }
  console.log('Shared metadata tab families: Hero / Hub / Contact / About CTA / Breadcrumb; labels, distinct functions, IDs and responsive RTL PASS');
  assert.deepEqual(errors,[]);
}

async function verifyAboutRich(){
  const aboutUrl=url+'?mode=about-premium';
  const base={...initial,subtitle:'عنوان فرعي محفوظ',showSubtitle:true,subtitleBold:false,subtitleAlignment:'right',images:{...initial.images,accent:'/replacement.svg',accentAlt:'نص بديل محفوظ'},beats:[{num:'01',title:'بطاقة 1',text:'*نص حرفي* <tag>\nسطر ثانٍ'},{num:'02',title:'بطاقة 2',text:'وصف 2'},{num:'03',title:'بطاقة 3',text:'وصف 3'}]};
  delete base.button;
  const form=()=>page.locator('form').evaluate(e=>Object.fromEntries(new FormData(e)));
  const protectedValues=data=>Object.fromEntries(Object.entries(data).filter(([key])=>!['body','description_bold','description_alignment','module_editor_tab'].includes(key)));
  const publicBody=()=>page.locator('.rich-text-content');
  const open=async(config)=>{saved=structuredClone(config);await page.goto(aboutUrl);await ready();await expect(body).toBeVisible();};
  const render=async()=>{await page.evaluate(c=>window.mount('about-public',c),saved);await ready();};
  savedPageIds=[2];

  // Exact same shared toolbar and scale as Story, with one formatting owner per field.
  await page.goto(url);await ready();const storyToolbar=await scope.getByRole('toolbar').evaluate(e=>({labels:[...e.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),className:e.className,font:getComputedStyle(e.querySelector('button')).fontSize}));
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await open(base);
    await expect(scope.getByRole('toolbar')).toHaveCount(1);
    assert.deepEqual(await scope.getByRole('toolbar').evaluate(e=>({labels:[...e.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),className:e.className,font:getComputedStyle(e.querySelector('button')).fontSize})),storyToolbar);
    const row=page.locator('[data-module-editor-control-row]').filter({has:scope});
    await expect(row.getByRole('button',{name:'تنسيق عريض',exact:true})).toHaveCount(1);
    await expect(scope.getByRole('button',{name:'H1',exact:true})).toHaveCount(0);
    const unchanged=protectedValues(await form());
    for(const [id,label] of [['text','النصوص'],['images','الصور'],['cards','البطاقات'],['pages','الظهور']]){
      await tab(label);await expect(page.locator('input[name="module_editor_tab"]')).toHaveValue(id);
      const control=page.getByRole('tab',{name:label,exact:true});await control.focus();await expect(control).toBeFocused();
      await expect(page.locator('#'+await control.getAttribute('aria-controls'))).toBeVisible();
      assert.deepEqual(protectedValues(await form()),unchanged);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await expect(page.locator('textarea[name^="beat_"]')).toHaveCount(3);
    for(let i=0;i<3;i++)await expect(page.locator('textarea[name="beat_'+i+'_text"]')).toHaveValue(base.beats[i].text);
    await tab('النصوص');await page.getByRole('tab',{name:'النصوص',exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'الظهور',exact:true})).toBeFocused();await page.keyboard.press('Home');
    const bold=scope.getByRole('button',{name:'تنسيق عريض',exact:true});await bold.focus();await expect(bold).toBeFocused();await page.keyboard.press('Tab');assert.ok(await scope.evaluate(e=>e.contains(document.activeElement)));
    for(const button of await scope.getByRole('toolbar').getByRole('button').all()){const b=await button.boundingBox(),t=await scope.boundingBox();assert.ok(b.x>=t.x&&b.x+b.width<=t.x+t.width+1&&b.height>=32);}
    if(width!==1024)await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-about-text-'+width+'.png')});
    await page.goto(aboutUrl+'&tab=cards&returnPageId=2');await ready();await expect(page.getByRole('tab',{name:'البطاقات',exact:true})).toHaveAttribute('aria-selected','true');assert.equal(new URL(page.url()).searchParams.get('returnPageId'),'2');
    console.log('About rich toolbar equivalence / tabs IDs / query / keyboard / fixed textareas / RTL PASS at '+width);
  }

  await page.setViewportSize({width:1440,height:1100});
  for(const legacy of [
    'نص قديم *حرفي* & رموز _ + [نص]\nسطر داخل الفقرة\n\nفقرة ثانية',
    '<p>نص قديم *حرفي* &lt;tag&gt; &amp; رموز</p><p><u>فقرة ثانية</u> <em>مائلة</em></p>',
    '',
  ]){
    await open({...base,body:legacy,descriptionBold:true,descriptionAlignment:'center'});
    const canonical=await scope.locator('input[name="body"]').inputValue(),before=await body.innerText(),other=protectedValues(await form());
    await submit();assert.equal(saved.body,canonical);assert.equal(saved.descriptionBold,true);assert.equal(saved.descriptionAlignment,'center');assert.equal(await body.innerText(),before);assert.deepEqual(protectedValues(await form()),other);
    if(legacy){
      const textBefore=await body.locator('p').allTextContents();
      await body.press('Control+A');await scope.getByRole('button',{name:'تنسيق عريض',exact:true}).click();await scope.getByRole('button',{name:'محاذاة لليمين',exact:true}).click();await submit();
      assert.equal(saved.descriptionBold,false);await expect(body.locator('strong')).toHaveCount(0);await expect(body.locator('p')).toHaveText(textBefore);
      await render();await expect(publicBody().locator('p')).toHaveText(textBefore);assert.equal(await publicBody().locator('p').last().evaluate(e=>getComputedStyle(e).textAlign),'right');assert.equal(await publicBody().locator('p').first().evaluate(e=>getComputedStyle(e).fontWeight),'400');
    }
  }
  for(const [button,tag,publicTag] of [['عنوان رئيسي داخل المقال','h2','h3'],['عنوان فرعي داخل المقال','h3','h4'],['تنسيق عريض','strong','strong'],['مائل','em','em'],['تحته خط','u','u'],['قائمة نقطية','ul','ul'],['قائمة مرقمة','ol','ol'],['رابط','a','a']]){
    await open({...base,body:'<p>نص محفوظ</p>'});const other=protectedValues(await form());
    await body.fill('نص *حرفي* <tag> & [رموز]');await body.press('Control+A');await scope.getByRole('button',{name:button,exact:true}).click();
    if(tag==='a'){await scope.getByRole('textbox',{name:'عنوان الرابط',exact:true}).fill('/about');await scope.getByRole('button',{name:'تطبيق الرابط',exact:true}).click();}
    await expect(body.locator(tag)).toHaveText('نص *حرفي* <tag> & [رموز]');await submit();await expect(body.locator(tag)).toHaveText('نص *حرفي* <tag> & [رموز]');assert.deepEqual(protectedValues(await form()),other);assert.deepEqual(saved.beats,base.beats);assert.deepEqual(saved.images,base.images);
    await render();await expect(publicBody().locator(publicTag)).toHaveText('نص *حرفي* <tag> & [رموز]');await expect(publicBody().locator('h1,tag')).toHaveCount(0);
    if(tag==='a'){await expect(publicBody().locator('a')).toHaveAttribute('href','/about');await expect(publicBody().locator('a')).toHaveAttribute('rel','noopener noreferrer');}
    console.log('About edit / format / isolated save / reload / public '+tag+' PASS');
  }
  for(const [label,alignment] of [['محاذاة للوسط','center'],['محاذاة لليسار','left'],['ضبط النص من الجانبين','justify'],['محاذاة لليمين','right']]){
    await open({...base,body:'<p>فقرة</p>'});await body.fill('فقرة أولى');await body.press('Enter');await page.keyboard.insertText('فقرة ثانية');await body.press('Shift+Enter');await page.keyboard.insertText('سطر ثالث');await scope.getByRole('button',{name:label,exact:true}).click();await submit();
    await expect(body.locator('p')).toHaveText(['فقرة أولى','فقرة ثانيةسطر ثالث']);await expect(body.locator('br')).toHaveCount(1);
    await render();await expect(publicBody().locator('p')).toHaveText(['فقرة أولى','فقرة ثانيةسطر ثالث']);await expect(publicBody().locator('br')).toHaveCount(1);assert.equal(await publicBody().locator('p').last().evaluate(e=>getComputedStyle(e).textAlign),alignment);
  }
  await open({...base,body:'<h2>عنوان ثانٍ</h2><p>فقرة <strong>عريضة</strong> <em>مائلة</em> <u>تحتها خط</u> *حرفي* &lt;tag&gt;</p><h3>عنوان فرعي</h3><ul><li>قائمة</li></ul><ol><li>ترتيب</li></ol><p style="text-align: center"><a href="/about">رابط آمن</a></p>'});
  await body.locator('h2').click();await scope.getByRole('button',{name:'فقرة',exact:true}).click();await expect(body.locator('h2')).toHaveCount(0);await body.press('Control+z');await expect(body.locator('h2')).toHaveText('عنوان ثانٍ');await submit();
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await render();
    await expect(publicBody().locator('h3')).toHaveText('عنوان ثانٍ');await expect(publicBody().locator('h4')).toHaveText('عنوان فرعي');await expect(publicBody().locator('u')).toHaveText('تحتها خط');
    assert.equal(await publicBody().locator('ul').evaluate(e=>getComputedStyle(e).listStyleType),'disc');assert.equal(await publicBody().locator('ol').evaluate(e=>getComputedStyle(e).listStyleType),'decimal');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(width!==1024)await publicBody().screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-about-rich-public-'+width+'.png')});
  }
  const unsafe='<h2 onclick="alert(1)">عنوان</h2><p><a href="javascript:alert(1)">رابط</a><img src=x onerror="alert(1)"><script>alert(1)</script>نص آمن</p>';
  for(const mode of ['about-public','rich-default']){
    await page.evaluate(([mode,c])=>window.mount(mode,c),[mode,{...base,body:unsafe}]);await ready();
    await expect(publicBody().locator('script,img,[onclick],[onerror],[href^="javascript:"]')).toHaveCount(0);await expect(publicBody().locator(mode==='about-public'?'h3':'h2')).toHaveText('عنوان');
  }
  await page.goto(url+'?mode=about');await ready();await expect(scope.getByRole('toolbar')).toHaveCount(0);

  await verifyTabNames();
  assert.deepEqual(errors,[]);console.log('PASS About Rich Text: '+saves+' isolated saves; unchanged card/media/assignment fields, legacy HTML/plain text, safe rendering, shared scale and default consumers. No DB writes.');
}

async function verifyAbout(){
  const aboutInitial={...initial,subtitle:'عنوان فرعي محفوظ',showSubtitle:true,subtitleBold:false,subtitleAlignment:'right',body:'<p>محتوى قديم <strong>محفوظ</strong> *حرفي* &lt;tag&gt;</p><p>فقرة ثانية</p>',images:{...initial.images,accent:'/replacement.svg',accentAlt:'وصف اللمسة'},beats:[{num:'01',title:'البداية من الأرض',text:'سطر أول\nسطر ثانٍ'},{num:'02',title:'الإدارة على الأرض',text:'متابعة التنفيذ'},{num:'03',title:'المراحل موثقة',text:'محتوى ثالث محفوظ'}]};
  delete aboutInitial.button;
  const aboutUrl=url+'?mode=about-premium';
  const readEntries=()=>page.locator('form').evaluate(e=>[...new FormData(e)]);
  const canonical=entries=>{const data=new FormData();for(const [key,value]of entries)data.append(key,value);return saveConfig(data);};
  const save=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الموديول',exact:true}).click();await page.waitForFunction(()=>window.saved===true);await page.goto(aboutUrl);await ready();await expect(body).toBeVisible();};
  const field=name=>page.locator('[name="'+name+'"]'),media=name=>page.locator('[data-admin-media-image-field="'+name+'"]');
  saved=structuredClone(aboutInitial);savedPageIds=[2];await page.goto(url+'?mode=about');await ready();
  const legacyEntries=await readEntries(),legacyContent=canonical(legacyEntries);
  await expect(scope.getByRole('toolbar')).toHaveCount(0);await expect(page.locator('[data-module-editor-repeater-card] textarea')).toHaveCount(3);
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await page.goto(aboutUrl);await ready();
    await expect(page.getByRole('tablist')).toHaveCount(1);await expect(page.getByRole('tab')).toHaveText(['النصوص','الصور','البطاقات','الظهور']);
    const entries=await readEntries();
    for(const [name,value]of legacyEntries){assert.deepEqual(entries.filter(([key])=>key===name),[[name,value]],'Inactive field/value preservation: '+name);}
    assert.deepEqual(canonical(entries),legacyContent);
    await expect(scope.getByRole('toolbar')).toHaveCount(1);
    const rows=page.locator('[data-module-editor-control-row]');await expect(rows).toHaveCount(4);
    const rowBoxes=await Promise.all((await rows.all()).map(r=>r.boundingBox()));
    if(width>=1280){assert.ok(rowBoxes[0].x>rowBoxes[1].x&&Math.abs(rowBoxes[0].y-rowBoxes[1].y)<1);assert.ok(rowBoxes[2].width>rowBoxes[0].width*1.9);}else assert.ok(rowBoxes[1].y>=rowBoxes[0].y+rowBoxes[0].height);
    for(const name of ['النصوص','الصور','البطاقات','الظهور']){
      await tab(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const panel=page.getByRole('tabpanel').filter({visible:true});
      for(const header of await panel.locator('[data-admin-form-control-header]').all()){
        const geometry=await header.evaluate(e=>{const [icon,divider,copy]=e.children;return {icon:icon.getBoundingClientRect().width,glyph:icon.querySelector('svg').getBoundingClientRect().width,divider:divider.getBoundingClientRect().width,right:icon.getBoundingClientRect().x>copy.getBoundingClientRect().x,title:getComputedStyle(copy.children[0]).fontSize};});
        assert.deepEqual(geometry,{icon:40,glyph:20,divider:1,right:true,title:'14px'});
      }
      if(name==='البطاقات'||name==='الصور'){
        const cards=name==='البطاقات'?panel.locator('[data-module-editor-repeater-grid] [data-admin-form-grid] > section'):panel.locator('[data-admin-form-grid] > section');
        await expect(cards).toHaveCount(3);const [a,b,c]=await Promise.all((await cards.all()).map(x=>x.boundingBox()));
        if(width>=1280){assert.ok(a.x>b.x&&b.x>c.x&&Math.abs(a.y-c.y)<1);assert.ok(Math.abs(a.width-c.width)<1&&Math.abs(a.height-c.height)<1);}else if(width>=768){assert.ok(a.x>b.x&&Math.abs(a.y-b.y)<1&&c.y>=a.y+a.height);}else assert.ok(b.y>=a.y+a.height&&c.y>=b.y+b.height);
        await expect(panel.getByRole('switch')).toHaveCount(0);await expect(panel.locator('[contenteditable]')).toHaveCount(0);
        if(name==='البطاقات'){await expect(panel.getByRole('textbox')).toHaveCount(9);await expect(panel.locator('textarea')).toHaveCount(3);await expect(panel.getByRole('button')).toHaveCount(0);if(width!==1024)await panel.screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-about-cards-'+width+'.png')});}
        else {
          await expect(panel.getByRole('button',{name:/نقل إلى الموضع/})).toHaveCount(0);
          for(const slot of ['main','secondary','accent']){
            const f=media('image_'+slot);await expect(f.locator('img')).toBeVisible();
            assert.equal(await f.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
            const frame=await f.locator('[data-admin-media-image-preview-trigger]').boundingBox();
            for(const label of ['استبدال','إزالة']){const button=f.getByRole('button',{name:label,exact:true}),r=await button.boundingBox();assert.equal(r.width,44);assert.equal(r.height,44);assert.equal(await button.locator('svg').evaluate(e=>e.getBoundingClientRect().width),18);assert.ok(r.x>=frame.x&&r.x+r.width<=frame.x+frame.width&&r.y>=frame.y&&r.y+r.height<=frame.y+frame.height);}
          }
        }
      }
      assert.deepEqual(canonical(await readEntries()),legacyContent,'Switching tabs must not drop hidden fields');
      if(width!==1024&&(name==='النصوص'||name==='الصور'))await panel.screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-about-'+(name==='النصوص'?'text':'images')+'-'+width+'.png')});
    }
    await page.getByRole('tab',{name:'الظهور',exact:true}).focus();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'النصوص',exact:true})).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'الصور',exact:true})).toBeFocused();
    console.log('About Intro four flat tabs/complete inactive FormData/premium headers/three fixed cards+media/RTL PASS at '+width);
  }
  await page.setViewportSize({width:1440,height:1100});await page.goto(aboutUrl);await ready();
  await field('eyebrow').fill('نص تمهيدي معدل');await field('title').fill('عنوان معدل');await field('subtitle').fill('عنوان فرعي معدل');
  await body.fill('محتوى طويل معدل *حرفي* <tag>');
  for(const key of ['eyebrow','title','subtitle','description']){
    if(key==='description')await body.press('Control+A');
    const r=page.locator('[data-module-editor-control-row]').filter({has:field('show_'+key)});
    await r.getByRole('button',{name:'تنسيق عريض',exact:true}).click();await r.getByRole('button',{name:'محاذاة للوسط',exact:true}).click();
    await r.getByRole('switch').focus();await page.keyboard.press('Space');
  }
  await tab('الصور');
  for(const [i,slot]of ['main','secondary','accent'].entries()){
    const f=media('image_'+slot);
    await f.locator('[data-admin-media-image-preview-trigger]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-admin-media-image-expanded]')).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(f.locator('[data-admin-media-image-preview-trigger]')).toBeFocused();
    await f.getByRole('button',{name:'استبدال',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();
    await f.getByLabel('النص البديل للصورة '+(i+1),{exact:true}).fill('وصف محفوظ '+slot);
  }
  await media('image_secondary').getByRole('button',{name:'إزالة',exact:true}).click();await expect(field('image_secondary')).toHaveValue('');
  await tab('البطاقات');for(let i=0;i<3;i++){await field('beat_'+i+'_num').fill('A'+i);await field('beat_'+i+'_title').fill('بطاقة معدلة '+i);await field('beat_'+i+'_text').fill('وصف *حرفي* <tag> '+i+'\nسطر محفوظ');}
  await tab('الظهور');const group=page.locator('[data-module-page-groups]');
  await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('1 محددة');
  const position=group.locator('[data-module-page-row="2"]').getByRole('link',{name:'إدارة الموضع'});await expect(position).toHaveAttribute('href','/admin/pages-blocks/pages/2');await position.focus();await expect(position).toBeFocused();
  await group.locator('input[value="3"]').check();await expect(page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'})).toHaveText('2 محددة');
  const edited=canonical(await readEntries());
  for(const active of ['الظهور','النصوص','الصور','البطاقات']){await tab(active);await save();assert.deepEqual(saved,edited);assert.deepEqual(savedPageIds,[2,3]);}
  for(const key of ['Eyebrow','Title','Subtitle','Description'])assert.equal(saved['show'+key],false);
  assert.equal(saved.images.secondary,undefined);assert.equal(saved.images.main,'/replacement.svg');assert.equal(saved.images.accent,'/replacement.svg');
  assert.equal(saved.beats.length,3);assert.ok(saved.beats.every((b,i)=>b.text==='وصف *حرفي* <tag> '+i+'\nسطر محفوظ'));
  await page.evaluate(c=>window.mount('about-public',c),saved);await ready();for(let i=0;i<3;i++)await expect(page.getByRole('heading',{name:'بطاقة معدلة '+i,exact:true})).toBeVisible();
  const {mapAboutIntroBeatsFromBlock}=await jiti.import('../src/components/about/about-cms-mappers.ts');
  for(const beat of [{num:'9'},{title:' '},{text:' '},{}])assert.equal(mapAboutIntroBeatsFromBlock({template:{config:{beats:[beat]}}}),null);
  for(const beat of [{title:'عنوان فقط'},{text:'وصف فقط'}])assert.equal(mapAboutIntroBeatsFromBlock({template:{config:{beats:[beat]}}}).length,1);
  await page.evaluate(c=>window.mount('about-public',{...c,beats:[{num:'9'}]}),saved);await ready();await expect(page.getByRole('heading',{name:/بطاقة معدلة/})).toHaveCount(0);
  for(const state of ['missing','deleted','unavailable']){
    referenceStatus=state;saved={...aboutInitial,images:{...aboutInitial.images}};await page.goto(aboutUrl);await ready();await tab('الصور');
    for(const slot of ['main','secondary','accent']){await expect(media('image_'+slot).locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',state);await expect(field('image_'+slot)).toHaveValue(aboutInitial.images[slot]);}
    const before=canonical(await readEntries());await tab('البطاقات');await save();assert.deepEqual(saved,before);assert.deepEqual(saved.images,aboutInitial.images);
  }
  referenceStatus='active';assert.ok(requests.some(r=>r.method==='GET'&&r.query.includes('folder=images%2Fabout')));
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await page.goto(url+'?mode=default-repeater');await ready();
    await expect(page.locator('[data-module-editor-repeater-card]')).toHaveCount(3);await expect(page.locator('[data-admin-form-control-header]')).toHaveCount(0);
    for(const card of await page.locator('[data-module-editor-repeater-card]').all()){assert.equal(await card.evaluate(e=>e.tagName),'ARTICLE');assert.equal(await card.getByRole('heading').evaluate(e=>getComputedStyle(e).fontSize),'12px');await card.getByRole('button').focus();await expect(card.getByRole('button')).toBeFocused();}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }

  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await page.goto(url+'?mode=vision-default');await ready();
    const cards=page.locator('[data-module-editor-repeater-card]');
    await expect(cards).toHaveCount(6);await expect(cards.locator('[data-admin-form-control-header]')).toHaveCount(0);
    await expect(page.locator('input[name="vision_item_0_title"]')).toHaveValue('الثقة');
    await expect(page.locator('input[name="goals_item_0_title"]')).toHaveValue('الجودة');
    for(const grid of await page.locator('[data-module-editor-repeater-grid]').all()){
      const [a,b,c]=await Promise.all((await grid.locator('article').all()).map(e=>e.boundingBox()));
      if(width>=1280)assert.ok(a.x>b.x&&b.x>c.x&&Math.abs(a.y-c.y)<1);
      else if(width>=1024)assert.ok(a.x>b.x&&Math.abs(a.y-b.y)<1&&c.y>=a.y+a.height);
      else assert.ok(b.y>=a.y+a.height&&c.y>=b.y+b.height);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  console.log('Content 17 actual default repeater / fields / Desktop-Tablet-Mobile-RTL preservation PASS');
  assert.deepEqual(errors,[]);console.log('PASS About Intro: '+saves+' isolated saves; all inactive fields, plain card descriptions, existing rich body, formatting, three image roles, missing references, page assignments and public card conditions preserved. Default repeater unchanged; no DB writes.');
}

async function verifyPages() {
  const groups=page.locator('[data-module-page-groups]'),row=id=>groups.locator('[data-module-page-row="'+id+'"]'),choice=id=>row(id).getByRole('checkbox');
  const counts=()=>[page.getByRole('status',{name:'اختيارات الصفحات الرئيسية'}),page.getByRole('status',{name:'اختيارات مجموعات الصفحات'})];
  for(const width of [1440,1024,390]){
    savedPageIds=[1];await page.setViewportSize({width,height:1100});await page.goto(url);await ready();await tab('الظهور');
    await expect(page.getByRole('heading',{name:'الظهور في الصفحات',exact:true})).toBeVisible();
    await expect(page.getByText('حدد الصفحات التي يظهر بها الموديول.',{exact:true})).toBeVisible();
    await expect(counts()[0]).toHaveText('1 محددة');await expect(counts()[1]).toHaveText('0 محددة');
    const originalData=new FormData();for(const [key,value]of await page.locator('form').evaluate(e=>[...new FormData(e)]))originalData.append(key,value);const expectedContent=saveConfig(originalData);
    await expect(groups.getByRole('checkbox')).toHaveCount(fixturePages.length);
    assert.deepEqual(await groups.locator('input:checked').evaluateAll(es=>es.map(e=>Number(e.value))),[1]);
    assert.deepEqual(await groups.locator('[data-module-page-group]').evaluateAll(es=>es.map(e=>[...e.querySelectorAll('input')].map(e=>Number(e.value)))),[[1,2,3,4,5,6],[7,8,9,10,11,12]]);
    const cards=groups.locator('[data-admin-form-grid] > section');const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();
    if(width>=768){assert.ok(a.x>b.x);assert.ok(Math.abs(a.y-b.y)<1);assert.ok(Math.abs(a.width-b.width)<1);assert.ok(Math.abs(a.height-b.height)<1);}else assert.ok(b.y>=a.y+a.height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    for(const header of await page.locator('[data-admin-form-control-header]:visible').all()){
      const geo=await header.evaluate(e=>{const spans=[...e.children],icon=spans[0],divider=spans[1],copy=spans[2];return {icon:icon.getBoundingClientRect().width,glyph:icon.querySelector('svg').getBoundingClientRect().width,divider:divider.getBoundingClientRect().width,color:getComputedStyle(divider).backgroundImage,right:icon.getBoundingClientRect().x>copy.getBoundingClientRect().x,title:getComputedStyle(copy.children[0]).fontSize,description:getComputedStyle(copy.children[1]).fontSize};});
      assert.equal(geo.icon,40);assert.equal(geo.glyph,20);assert.equal(geo.divider,1);assert.equal(geo.title,'14px');assert.equal(geo.description,'12px');assert.ok(geo.right&&geo.color.includes('gradient'));
    }
    for(const r of await groups.locator('[data-module-page-row]').all()){
      const checkbox=r.getByRole('checkbox'),hit=await checkbox.locator('xpath=ancestor::label').boundingBox(),box=await r.boundingBox(),cb=await checkbox.boundingBox();
      assert.equal(hit.width,44);assert.equal(hit.height,44);const icon=await r.locator('svg').first().boundingBox();assert.equal(icon.width,20);assert.equal(icon.height,20);assert.ok(Math.abs(cb.y+cb.height/2-box.y-box.height/2)<1);assert.equal(await r.locator('[dir="ltr"]').evaluate(e=>getComputedStyle(e).direction),'ltr');
    }
    const selected=await row(1).evaluate(e=>({border:getComputedStyle(e).borderTopColor,bg:getComputedStyle(e).backgroundColor}));
    const neutral=await row(2).evaluate(e=>({border:getComputedStyle(e).borderTopColor,bg:getComputedStyle(e).backgroundColor}));
    assert.notDeepEqual(selected,neutral);await row(2).hover();await expect.poll(()=>row(2).evaluate(e=>getComputedStyle(e).borderTopColor)).not.toBe(neutral.border);
    if(width!==1024)await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:path.join(root,'.tmp-qa/story-adoption/after-pages-'+width+'.png')});
    await row(1).getByText('الرئيسية',{exact:true}).click();await expect(choice(1)).toBeChecked();
    await choice(1).focus();await page.keyboard.press('Space');await expect(choice(1)).not.toBeChecked();await expect(counts()[0]).toHaveText('0 محددة');
    assert.equal(await choice(1).evaluate(e=>getComputedStyle(e).outlineStyle),'solid');assert.notEqual(await row(1).evaluate(e=>getComputedStyle(e).boxShadow),'none');
    await expect(row(1).getByRole('link',{name:'إدارة الموضع'})).toHaveAttribute('href','/admin/pages-blocks/pages/1');
    await choice(2).locator('xpath=ancestor::label').click();await expect(counts()[0]).toHaveText('1 محددة');await expect(row(2).getByRole('link')).toHaveCount(0);
    await choice(7).focus();await page.keyboard.press('Space');await expect(counts()[1]).toHaveText('1 محددة');
    await tab('النصوص');await tab('الظهور');await expect(choice(2)).toBeChecked();await expect(choice(7)).toBeChecked();
    await submit();assert.deepEqual(savedPageIds,[2,7]);assert.deepEqual(saved,expectedContent,'Assignment save must preserve all Story content through the existing serializer');
    await tab('الظهور');await expect(choice(1)).not.toBeChecked();await expect(choice(2)).toBeChecked();await expect(choice(7)).toBeChecked();
    await expect(page.getByText('تنبيه: موديول مشترك بين عدة صفحات',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'مدير الصفحة',exact:true})).toHaveCount(2);
    const position=row(2).getByRole('link',{name:'إدارة الموضع'});await position.focus();await expect(position).toBeFocused();await Promise.all([page.waitForURL(url+'/admin/pages-blocks/pages/2'),page.keyboard.press('Enter')]);await page.goto(url);await ready();await tab('الظهور');
    await choice(3).check();await expect(counts()[0]).toHaveText('2 محددة');await page.locator('form').evaluate(e=>e.reset());await expect(choice(3)).not.toBeChecked();await expect(counts()[0]).toHaveText('1 محددة');await expect(choice(7)).toBeChecked();
    await choice(2).uncheck();await choice(7).uncheck();await submit();assert.deepEqual(savedPageIds,[]);await tab('الظهور');await expect(counts()[0]).toHaveText('0 محددة');await expect(counts()[1]).toHaveText('0 محددة');await expect(groups.getByRole('link')).toHaveCount(0);
    console.log('Pages selection/counts/position links/keyboard/reset/empty and populated isolated save-reload/RTL PASS at '+width);
  }
  savedPageIds=[1];
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});await page.goto(url+'?mode=default-pages');await ready();
    await expect(groups.getByRole('status')).toHaveCount(0);await expect(groups.locator('[data-admin-form-grid]')).toHaveCount(0);
    await expect(groups.locator('[data-admin-form-control-header]')).toHaveCount(0);
    const cards=groups.locator('section'),a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();
    if(width>=1024){assert.ok(a.x>b.x&&Math.abs(a.y-b.y)<1);}else assert.ok(b.y>=a.y+a.height);
    assert.equal(await row(1).getAttribute('class'),defaultAssignmentRowClass);
    await expect(choice(1)).toBeChecked();await choice(2).focus();await page.keyboard.press('Space');await expect(choice(2)).toBeChecked();
    await expect(row(2).getByRole('link')).toHaveCount(0);await page.locator('form').evaluate(e=>e.reset());await expect(choice(2)).not.toBeChecked();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(width!==1024)await groups.screenshot({path:path.join(root,'.tmp-qa/story-adoption/before-pages-'+width+'.png')});
  }
  const data=new FormData();data.append('page_ids','2');data.append('page_ids','2');assert.deepEqual(parsePageIds(data),[2]);
  for(const invalid of ['0','-1','1.5','NaN','9007199254740992']){const bad=new FormData();bad.append('page_ids',invalid);assert.throws(()=>parsePageIds(bad));}
  await page.goto(url+'?mode=empty-pages');await ready();await expect(page.getByText('لا توجد صفحات رئيسية.',{exact:true})).toBeVisible();await expect(page.getByText('لا توجد مجموعات صفحات.',{exact:true})).toBeVisible();await expect(counts()[0]).toHaveText('0 محددة');await expect(counts()[1]).toHaveText('0 محددة');
  assert.deepEqual(errors,[]);console.log('PASS Page Visibility: '+saves+' isolated saves; default assignment presentation/grouping/selection preserved; actual page_ids parser boundaries; no DB writes.');
}

try{
  if(heroFamilyOnly){await verifyHeroFamily();}else if(searchFamilyOnly){await verifySearchFamily();}else if(feedFamilyOnly){await verifyFeedFamily();}else if(cardsFamilyOnly){await verifyCardsFamily();}else if(ctaFamilyOnly){await verifyCtaFamily();}else if(mediaSidebarOnly){await verifyMediaSidebar();}else if(featuredOnly){await verifyFeatured();}else if(mediaHubOnly){await verifyMediaHub();}else if(contactOnly){await verifyContact();}else if(trustOnly){await verifyTrust();}else if(gridOnly){await verifyGrid();}else if(tabsOnly){await page.goto(url);await ready();await verifyTabNames();}else if(aboutRichOnly){await verifyAboutRich();}else if(aboutOnly){await verifyAbout();}else if(pagesOnly){await verifyPages();}else{
  await page.goto(url);await ready();await expect(body).toBeVisible();
  for(const name of (ctaOnly?['الزر والرابط']:['النصوص','الصور','الزر والرابط'])){
    await tab(name);console.log((baseline?'BEFORE':'AFTER')+' '+name+' '+JSON.stringify(await page.getByRole('tabpanel').filter({visible:true}).evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth}})));
  }
  if(!baseline&&!process.argv.includes('--visual-only')){
    if(!mediaOnly&&!ctaOnly){
    await tab('النصوص');await expect(scope.getByRole('button',{name:'عنوان رئيسي داخل المقال'})).toBeVisible();
    assert.equal(await scope.getByRole('button',{name:'H1',exact:true}).count(),0);

    await expect(page.getByRole('heading',{name:'من نحن',exact:true})).toBeVisible();
    await page.locator('input[name="name"]').fill('اسم قسم محفوظ');
    await submit();
    await expect(page.getByRole('heading',{name:'اسم قسم محفوظ',exact:true})).toBeVisible();
    savedName='';await page.goto(url);await ready();
    await expect(page.getByRole('heading',{name:'قصة فينيسيا',exact:true})).toBeVisible();
    savedName='من نحن';await page.goto(url);await ready();await tab('النصوص');
    const descriptionRow=page.locator('[data-module-editor-control-row]').filter({has:scope});
    assert.equal(await descriptionRow.getByRole('button',{name:'تنسيق عريض',exact:true}).count(),1);
    assert.equal(await descriptionRow.getByRole('button',{name:'محاذاة للوسط',exact:true}).count(),1);
    await descriptionRow.getByRole('switch').focus();await page.keyboard.press('Space');await submit();
    assert.equal(saved.showDescription,false);
    await descriptionRow.getByRole('switch').focus();await page.keyboard.press('Space');await submit();
    assert.equal(saved.showDescription,true);
    for(const legacyBody of ['<p>نص قديم *حرفي* &lt;tag&gt;</p><p><em>فقرة ثانية</em></p>','<p>نص قديم</p>','']){
      saved={...initial,body:legacyBody,descriptionBold:true,descriptionAlignment:'center'};
      await page.goto(url);await ready();await expect(body).toBeVisible();
      const canonical=await scope.locator('input[name="body"]').inputValue();
      await expect(scope.locator('input[name="description_bold"]')).toHaveValue('true');
      if(legacyBody){assert.equal(await body.locator('p').first().evaluate(e=>getComputedStyle(e).textAlign),'center');assert.ok(await body.locator('strong').count()>0);}
      await submit();assert.equal(saved.body,canonical);assert.equal(saved.descriptionBold,true);assert.equal(saved.descriptionAlignment,'center');
      await body.focus();
      if(!legacyBody){await page.keyboard.insertText('نص جديد');await expect(body.locator('strong')).toHaveText('نص جديد');}
      else {await body.press('Control+A');await scope.getByRole('button',{name:'تنسيق عريض',exact:true}).click();await expect(body.locator('strong')).toHaveCount(0);}
      await scope.getByRole('button',{name:'محاذاة لليمين',exact:true}).click();
      await submit();assert.equal(saved.descriptionBold,false);assert.equal(saved.descriptionAlignment,'center');
      if(legacyBody)await expect(body.locator('strong')).toHaveCount(0);else await expect(body.locator('strong')).toHaveText('نص جديد');
      assert.equal(await body.locator('p').last().evaluate(e=>getComputedStyle(e).textAlign),'right');
      await page.evaluate(c=>window.mount('public',c),saved);await ready();
      assert.equal(await page.locator('.rich-text-content p').last().evaluate(e=>getComputedStyle(e).textAlign),'right');
      if(legacyBody){assert.equal(await page.locator('.rich-text-content p').first().evaluate(e=>getComputedStyle(e).fontWeight),'400');assert.equal(await page.locator('.rich-text-content strong').count(),0);}
      else await expect(page.locator('.rich-text-content strong')).toHaveText('نص جديد');
    }

    saved={...initial,body:'<p>فقرة أولى</p><p><u>فقرة ثانية</u> *حرفي* &lt;tag&gt;</p>',descriptionBold:true,descriptionAlignment:'left'};
    await page.goto(url);await ready();await expect(body).toBeVisible();
    await body.locator('p').first().click();await body.press('Home');await body.press('Shift+End');
    await scope.getByRole('button',{name:'تنسيق عريض',exact:true}).click();
    await expect(body.locator('p').first().locator('strong')).toHaveCount(0);
    await expect(body.locator('p').last().locator('strong')).toContainText('فقرة ثانية');
    await body.press('Control+z');await expect(body.locator('p').first().locator('strong')).toHaveText('فقرة أولى');
    await body.press('Control+Shift+z');await expect(body.locator('p').first().locator('strong')).toHaveCount(0);
    await submit();assert.equal(saved.descriptionBold,false);assert.equal(saved.descriptionAlignment,'left');
    await expect(body.locator('p')).toHaveText(['فقرة أولى','فقرة ثانية *حرفي* <tag>']);
    await expect(body.locator('u')).toHaveText('فقرة ثانية');
    await page.evaluate(c=>window.mount('public',c),saved);await ready();
    await expect(page.locator('.rich-text-content p')).toHaveText(['فقرة أولى','فقرة ثانية *حرفي* <tag>']);
    await expect(page.locator('.rich-text-content p').last().locator('strong')).toContainText('فقرة ثانية');
    assert.equal(await page.locator('.rich-text-content p').first().evaluate(e=>getComputedStyle(e).fontWeight),'400');
    console.log('Partial inherited bold, literal text, underline and undo/redo preservation PASS');
    saved=structuredClone(initial);await page.goto(url);await ready();
    console.log('Dynamic saved header/fallback, sole editor formatting, visibility and inherited bold/alignment preservation PASS');
    const firstText=await body.innerText();await submit();assert.equal(await body.innerText(),firstText);
    const preservedButton=structuredClone(saved.button);
    for(const [name,key] of [['eyebrow','Eyebrow'],['title','Title']]){
      const row=page.locator('[data-module-editor-control-row]').filter({has:page.locator('input[name="'+name+'"]')});
      await row.getByRole('switch').focus();await page.keyboard.press('Space');
      await row.getByRole('button',{name:'تنسيق عريض',exact:true}).click();
      await row.getByRole('button',{name:'محاذاة للوسط',exact:true}).click();await submit();
      assert.equal(saved['show'+key],false);assert.equal(saved[name+'Bold'],false);assert.equal(saved[name+'Alignment'],'center');
      assert.equal(saved[name],initial[name]);await expect(row.getByRole('switch')).not.toBeChecked();
      await row.getByRole('switch').focus();await page.keyboard.press('Space');await submit();assert.equal(saved['show'+key],true);
    }
    assert.deepEqual(saved.button,preservedButton);console.log('Short-copy visibility/bold/alignment/keyboard/save preservation PASS');
    saved=structuredClone(initial);
    for(const [button,tag,publicTag]of [['عنوان رئيسي داخل المقال','h2','h3'],['عنوان فرعي داخل المقال','h3','h4'],['تنسيق عريض','strong','strong'],['مائل','em','em'],['تحته خط','u','u'],['قائمة نقطية','ul','ul'],['قائمة مرقمة','ol','ol'],['رابط','a','a']]){
      saved={...saved,body:'<p>نص محفوظ</p>'};await page.goto(url);await ready();await expect(body).toBeVisible();await body.fill('نص *حرفي* <tag>');await body.press('Control+A');await scope.getByRole('button',{name:button,exact:true}).click();
      if(tag==='a'){await scope.getByRole('textbox',{name:'عنوان الرابط',exact:true}).fill('/about');await scope.getByRole('button',{name:'تطبيق الرابط',exact:true}).click();}
      await expect(body.locator(tag)).toHaveText('نص *حرفي* <tag>');await submit();await expect(body.locator(tag)).toHaveText('نص *حرفي* <tag>');
      await page.evaluate(c=>window.mount('public',c),saved);await ready();await expect(page.locator('.rich-text-content '+publicTag)).toHaveText('نص *حرفي* <tag>');assert.equal(await page.locator('.rich-text-content h1').count(),0);console.log('Story edit/save/reload/public '+tag+' PASS');
    }
    for(const [button,align]of [['محاذاة للوسط','center'],['محاذاة لليسار','left'],['ضبط النص من الجانبين','justify'],['محاذاة لليمين','right']]){
      saved={...saved,body:'<p>فقرة أولى</p>'};await page.goto(url);await ready();await expect(body).toBeVisible();await body.fill('فقرة أولى');await body.press('Enter');await page.keyboard.insertText('فقرة ثانية');await body.press('Shift+Enter');await page.keyboard.insertText('سطر تالٍ');await scope.getByRole('button',{name:button,exact:true}).click();await submit();
      await expect(body.locator('p')).toHaveText(['فقرة أولى','فقرة ثانيةسطر تالٍ']);assert.equal(await body.locator('p').last().evaluate(e=>getComputedStyle(e).textAlign),align);await page.evaluate(c=>window.mount('public',c),saved);await ready();await expect(page.locator('.rich-text-content p')).toHaveText(['فقرة أولى','فقرة ثانيةسطر تالٍ']);assert.equal(await page.locator('.rich-text-content p').last().evaluate(e=>getComputedStyle(e).textAlign),align);
    }
    saved={...initial,body:'فقرة قديمة *حرفي*\nسطر داخل الفقرة\n\nفقرة قديمة ثانية'};
    await page.goto(url);await ready();const legacyText=await body.innerText();await submit();assert.equal(await body.innerText(),legacyText);
    await page.evaluate(c=>window.mount('public',c),saved);await ready();await expect(page.locator('.rich-text-content p')).toHaveText(['فقرة قديمة *حرفي*سطر داخل الفقرة','فقرة قديمة ثانية']);
    const unsafe='<h2 onclick="alert(1)">عنوان</h2><p><a href="javascript:alert(1)">رابط</a><img src=x onerror="alert(1)"><script>alert(1)</script>نص آمن</p>';
    for(const mode of ['public','rich-default']){await page.evaluate(([mode,body])=>window.mount(mode,{...window.initialConfig,body}),[mode,unsafe]);await ready();const rendered=page.locator('.rich-text-content');assert.equal(await rendered.locator('script,img,[onclick],[onerror],[href^="javascript:"]').count(),0);await expect(rendered.locator(mode==='public'?'h3':'h2')).toHaveText('عنوان');}
    console.log('Legacy plain text, safe HTML rendering and default heading semantics PASS');
    }
    if(!textOnly&&!ctaOnly){
    saved=structuredClone(initial);await page.goto(url);await ready();await tab('الصور');
    const first=page.locator('[data-admin-media-image-field="image_main"]'),second=page.locator('[data-admin-media-image-field="image_secondary"]');
    await expect(first.locator('img')).toBeVisible();await expect(second.locator('img')).toBeVisible();
    await expect(first.locator('[data-media-original]')).toContainText('800 × 600');await expect(second.locator('[data-media-original]')).toContainText('640 × 800');

    for(const field of [first,second]){
      for(const label of ['استبدال','إزالة']){
        const button=field.getByRole('button',{name:label,exact:true});await expect(button).toHaveAttribute('title',label);
        assert.equal((await button.innerText()).trim(),'');const rect=await button.boundingBox();assert.equal(rect.width,44);assert.equal(rect.height,44);
        assert.equal(await button.locator('svg').evaluate(e=>e.getBoundingClientRect().width),18);
        assert.equal(await button.evaluate(e=>Boolean(e.closest('[data-admin-media-image-preview-trigger]'))),false);
        assert.equal(await field.getByRole('button',{name:label,exact:true}).count(),1);
        await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(button).toBeFocused();assert.equal(await button.evaluate(e=>e.matches(':focus-visible')),true);
        assert.notEqual(await button.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      }
    }
    await first.getByRole('button',{name:'استبدال',exact:true}).focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('[data-admin-media-image-expanded]')).toHaveCount(0);await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);await expect(first.getByRole('button',{name:'استبدال',exact:true})).toBeFocused();
    await first.getByRole('button',{name:'معاينة الصورة الرئيسية بالحجم الكبير'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(first.getByRole('button',{name:'معاينة الصورة الرئيسية بالحجم الكبير'})).toBeFocused();
    await first.getByRole('button',{name:'استبدال',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:/^صورة replacement/}).click();await page.getByRole('button',{name:'تأكيد الاختيار',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(first.locator('input[name="image_main"]')).toHaveValue('/replacement.svg');
    await first.getByLabel('النص البديل للصورة (Alt Text)',{exact:true}).fill('وصف بديل محفوظ');
    await page.getByRole('button',{name:'نقل إلى الموضع الثاني',exact:true}).focus();await page.keyboard.press('Enter');await expect(second.locator('input[name="image_secondary"]')).toHaveValue('/replacement.svg');await expect(second.getByLabel('النص البديل للصورة (Alt Text)',{exact:true})).toHaveValue('وصف بديل محفوظ');
    await submit();assert.equal(saved.images.main,'/two.svg');assert.equal(saved.images.mainAlt,'وصف الصورة الثانية');assert.equal(saved.images.secondary,'/replacement.svg');assert.equal(saved.images.secondaryAlt,'وصف بديل محفوظ');
    await tab('الصور');await second.getByRole('button',{name:'إزالة',exact:true}).focus();await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(second.getByLabel('النص البديل للصورة (Alt Text)',{exact:true})).toHaveValue('');await submit();assert.equal(saved.images.secondary,undefined);assert.equal(saved.images.secondaryAlt,undefined);
    for(const status of ['deleted','missing','unavailable']){referenceStatus=status;await page.goto(url);await ready();await tab('الصور');await expect(first.locator('[data-admin-media-preview-state]')).toHaveAttribute('data-admin-media-preview-state',status);await expect(first.locator('img')).toHaveCount(0);await expect(first.locator('input[name="image_main"]')).toHaveValue('/two.svg');}
    referenceStatus='active';
    assert.ok(requests.some(r=>r.method==='GET'&&r.query.includes('folder=images%2Fhome')));console.log('Actual Media Picker replace/remove/reorder/alt/preview/save/reload PASS; transport is isolated');
    }
  }
  if(!baseline&&!process.argv.includes('--visual-only')&&!mediaOnly&&!textOnly){
    saved=structuredClone(initial);await page.goto(url);await ready();await tab('الزر والرابط');
    const field=page.locator('[data-home-story-button-panel="data"] [data-admin-link-field]');
    const choose=field.getByRole('button',{name:'اختيار الرابط',exact:true}),clear=field.getByRole('button',{name:'مسح الرابط',exact:true});
    const saveCta=async()=>{await submit();await tab('الزر والرابط');};
    const originalText={eyebrow:initial.eyebrow,title:initial.title,body:initial.body,images:{...initial.images,accent:undefined,accentAlt:undefined}};
    await expect(field.locator('[data-admin-link-destination]')).toContainText('من نحن');
    for(const [group,choices,key] of [
      ['محاذاة الزر',[['يمين','right'],['وسط','center'],['يسار','left']],'alignment'],
      ['موضع الأيقونة',[['يسار النص','left'],['يمين النص','right']],'iconPosition']
    ])for(const [label,value] of choices){
      const radio=page.getByRole('radiogroup',{name:group,exact:true}).getByRole('radio',{name:label,exact:true});
      await radio.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(radio).toBeFocused();
      assert.equal(await radio.evaluate(e=>e.matches(':focus-visible')),true);assert.notEqual(await radio.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      await page.keyboard.press('Space');await expect(radio).toBeChecked();await saveCta();assert.equal(saved.button[key],value);await expect(radio).toBeChecked();
    }
    const icons=page.getByRole('radiogroup',{name:'أيقونة الزر',exact:true});
    await icons.getByRole('radio',{name:'بدون أيقونة',exact:true}).click();await expect(page.getByRole('radiogroup',{name:'موضع الأيقونة',exact:true})).toHaveCount(0);
    await saveCta();assert.equal(saved.button.icon,'none');assert.equal(saved.button.iconPosition,'right');
    await icons.getByRole('radio',{name:'سهم',exact:true}).focus();await page.keyboard.press('Enter');await saveCta();assert.equal(saved.button.icon,'arrow');await expect(page.getByRole('radiogroup',{name:'موضع الأيقونة',exact:true})).toBeVisible();
    const target=page.locator('[data-home-story-button-card="target"]').getByRole('combobox');await target.click();await page.getByRole('option',{name:'نافذة جديدة',exact:true}).click();await saveCta();assert.equal(saved.button.target,'_blank');
    const selectedLink=structuredClone(saved.button.link);
    await choose.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(choose).toBeFocused();
    await saveCta();assert.deepEqual(saved.button.link,selectedLink);
    await choose.click();await page.getByRole('dialog').getByRole('button',{name:/^من نحن/}).click();await page.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(choose).toBeFocused();
    await field.getByRole('textbox').fill('team-new');await saveCta();assert.equal(saved.button.link.anchor,'team-new');await expect(field.getByRole('textbox')).toHaveValue('team-new');await expect(field.locator('[data-admin-link-destination]')).toContainText('/about#team-new');
    await clear.focus();await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(field.getByRole('textbox')).toHaveCount(0);await expect(field.locator('input[name="button_link_kind"]')).toHaveValue('none');await saveCta();assert.equal(saved.button.link,undefined);await expect(clear).toHaveCount(0);await expect(field.locator('[data-admin-link-destination]')).toContainText('لم يتم اختيار رابط بعد.');
    await page.evaluate(()=>window.qaLinkFailure=true);await choose.click();await expect(page.getByText('تعذر تحميل الموارد التجريبية',{exact:true})).toBeVisible();await page.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(field.locator('input[name="button_link_kind"]')).toHaveValue('none');await expect(choose).toBeFocused();await page.evaluate(()=>window.qaLinkFailure=false);
    await choose.click();await page.getByRole('dialog').getByRole('button',{name:/^من نحن/}).click();await page.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();await field.getByRole('textbox').fill('restored');await saveCta();assert.equal(saved.button.link.link_kind,'internal');assert.equal(saved.button.link.linked_id,2);assert.equal(saved.button.link.anchor,'restored');
    assert.deepEqual({eyebrow:saved.eyebrow,title:saved.title,body:saved.body,images:saved.images},originalText);
    console.log('Story CTA selections / conditional icon position / target / keyboard / real Link Picker / cancel / error / clear / Anchor / save-reload PASS; persistence and reads are isolated');
  }
  saved=structuredClone(initial);await page.goto(url);await ready();await expect(body).toBeVisible();
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});for(const name of (ctaOnly?['الزر والرابط']:['النصوص','الصور','الزر والرابط'])){await tab(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('form').evaluate(e=>getComputedStyle(e).direction),'rtl');
      if(name==='النصوص'&&!baseline){
        const rows=page.locator('[data-module-editor-control-row]');const a=await rows.nth(0).boundingBox(),b=await rows.nth(1).boundingBox(),description=await rows.nth(2).boundingBox();
        if(width===1440){assert.ok(Math.abs(a.y-b.y)<2);assert.ok(Math.abs(a.width-b.width)<2);assert.ok(a.x>b.x);assert.ok(description.width>a.width*1.8);}else if(width===390)assert.ok(b.y>=a.y+a.height);
        for(const row of await rows.all()){
          const header=row.locator('[data-admin-form-control-header]');
          await expect(header).toHaveAttribute('data-admin-form-control-presentation','leading-icon');
          assert.equal(await header.locator('svg').count(),1,'Exactly one original decorative icon per text header');
          assert.equal(await header.locator('svg').evaluate(e=>e.getBoundingClientRect().width),20);
          const parts=header.locator(':scope > span');assert.equal(await parts.count(),3);
          const icon=await parts.nth(0).boundingBox(),divider=await parts.nth(1).boundingBox(),copy=await parts.nth(2).boundingBox();
          const headerBox=await header.boundingBox(),visibility=row.getByRole('toolbar',{name:/^إظهار /}),toggleBox=await visibility.boundingBox(),rowBox=await row.boundingBox();
          assert.equal(icon.width,40);assert.equal(icon.height,40);assert.equal(divider.width,1);assert.equal(divider.height,32);
          assert.ok(copy.x+copy.width<=divider.x && divider.x+divider.width<icon.x,'RTL order is icon, gold divider, copy');
          assert.ok(Math.abs(icon.x+icon.width-rowBox.x-rowBox.width)<1,'Icon sits at the far right');
          assert.ok(Math.abs(toggleBox.x-rowBox.x)<1 && toggleBox.x+toggleBox.width<headerBox.x,'Visibility stays at the far left without overlapping copy');
          assert.ok(Math.abs(toggleBox.y+toggleBox.height/2-headerBox.y-headerBox.height/2)<1,'Visibility is vertically centered with the header');
          assert.ok(Math.abs(icon.y+icon.height/2-copy.y-copy.height/2)<1,'Icon and title/description are vertically centered');
          assert.equal(await parts.nth(2).locator(':scope > span').nth(0).evaluate(e=>getComputedStyle(e).fontSize),'14px');
          assert.equal(await parts.nth(2).locator(':scope > span').nth(1).evaluate(e=>getComputedStyle(e).fontSize),'12px');
          assert.ok(await header.evaluate(e=>e.scrollWidth<=e.clientWidth),'Header text fits its available width');
          await row.getByRole('switch').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(row.getByRole('switch')).toBeFocused();
        }
        console.log('Story headers: single leading icon / gold divider / centered copy and visibility / official scale / keyboard PASS at '+width);
      }
      if(!baseline){
        const panel=page.getByRole('tabpanel').filter({visible:true}),headers=panel.locator('[data-admin-form-control-header]');
        assert.equal(await headers.count(),name==='النصوص'?3:name==='الصور'?3:5);
        for(const header of await headers.all()){
          await expect(header).toHaveAttribute('data-admin-form-control-presentation','leading-icon');
          assert.equal(await header.locator('svg').count(),1);const parts=header.locator(':scope > span');assert.equal(await parts.count(),3);
          const icon=await parts.nth(0).boundingBox(),divider=await parts.nth(1).boundingBox(),copy=await parts.nth(2).boundingBox();
          assert.equal(icon.width,40);assert.equal(icon.height,40);assert.equal(await parts.nth(0).locator('svg').evaluate(e=>e.getBoundingClientRect().width),20);
          assert.equal(divider.width,1);assert.equal(divider.height,32);assert.ok(copy.x+copy.width<=divider.x&&divider.x+divider.width<icon.x);
          assert.ok(Math.abs(icon.y+icon.height/2-copy.y-copy.height/2)<1);assert.equal(await parts.nth(2).locator(':scope > span').first().evaluate(e=>getComputedStyle(e).fontSize),'14px');
          const description=parts.nth(2).locator(':scope > span').nth(1);if(await description.count())assert.equal(await description.evaluate(e=>getComputedStyle(e).fontSize),'12px');
          assert.equal(await header.evaluate(e=>getComputedStyle(e).columnGap),'12px');assert.ok(await header.evaluate(e=>e.scrollWidth<=e.clientWidth));
        }
        if(name==='النصوص')await expect(panel.locator('[data-admin-tab-section-heading]')).toHaveCount(0);
        else await expect(panel.getByRole('heading',{name:name==='الصور'?'صور قسم القصة':'زر قسم القصة',exact:true})).toBeVisible();
        if(name==='الصور')for(const [fieldName,label]of [['image_main','الصورة الرئيسية'],['image_secondary','الصورة الثانوية']]){
          const card=panel.locator('[data-admin-media-image-field="'+fieldName+'"]').locator('..');const header=card.locator('[data-admin-form-control-header]');await expect(header).toHaveText(label);
          const order=card.getByRole('button',{name:/^نقل إلى الموضع/}),action=await order.boundingBox(),headerBox=await header.boundingBox();assert.ok(action.x+action.width<headerBox.x);assert.ok(Math.abs(action.y+action.height/2-headerBox.y-headerBox.height/2)<1);
        }
        console.log('Shared single-icon headers, gold dividers, official type/spacing and preserved metadata PASS: '+name+' at '+width);
      }if(name==='الصور'&&!textOnly){await expect(page.locator('[data-admin-media-image-field="image_main"] img')).toBeVisible();if(!baseline){const firstCard=page.locator('[data-admin-media-image-field="image_main"]'),secondCard=page.locator('[data-admin-media-image-field="image_secondary"]');const a=await firstCard.boundingBox(),b=await secondCard.boundingBox();if(width>=768){assert.ok(Math.abs(a.y-b.y)<2);assert.ok(Math.abs(a.width-b.width)<2);assert.ok(a.x>b.x);assert.ok(Math.abs(a.height-b.height)<2);}else assert.ok(b.y>=a.y+a.height);

        for(const field of [firstCard,secondCard]){
          const frame=field.locator('[data-admin-media-image-frame]');
          await expect.poll(async()=>frame.evaluate(e=>{
            const img=e.querySelector('img'),r=e.getBoundingClientRect();
            return img?.naturalWidth ? Math.abs(r.width/r.height-img.naturalWidth/img.naturalHeight) : 1;
          })).toBeLessThan(0.01);
          const frameBox=await frame.boundingBox();assert.ok(frameBox.height<=Math.min(1100*0.4,384)+2);
          const rail=field.locator('[data-admin-media-image-actions]'),railBox=await rail.boundingBox();
          assert.ok(railBox.x>=frameBox.x && railBox.x-frameBox.x<20);
          assert.ok(railBox.y>=frameBox.y && frameBox.y+frameBox.height-railBox.y-railBox.height<20);
          const railColors=await rail.evaluate(e=>{
            const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
            const rgba=css=>{context.clearRect(0,0,1,1);context.fillStyle=css;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data];};
            return {background:rgba(getComputedStyle(e).backgroundColor),buttons:[...e.querySelectorAll('button')].map(button=>({background:rgba(getComputedStyle(button).backgroundColor),foreground:rgba(getComputedStyle(button.querySelector('svg')).color)}))};
          });
          [8,11,16,242].forEach((channel,index)=>assert.ok(Math.abs(railColors.background[index]-channel)<=1));
          const blend=(front,back)=>front.slice(0,3).map((c,i)=>c*front[3]/255+back[i]*(1-front[3]/255));
          const luminance=rgb=>rgb.map(c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
          for(const button of railColors.buttons)for(const underlying of [[0,0,0],[255,255,255]]){
            const back=luminance(blend(button.background,blend(railColors.background,underlying))),front=luminance(button.foreground.slice(0,3));
            assert.ok((Math.max(front,back)+0.05)/(Math.min(front,back)+0.05)>=4.5,'Media icon contrast over both dark and light images');
          }
          const replace=await field.getByRole('button',{name:'استبدال',exact:true}).boundingBox(),remove=await field.getByRole('button',{name:'إزالة',exact:true}).boundingBox();assert.ok(remove.x<replace.x);
          for(const label of ['استبدال','إزالة']){const button=field.getByRole('button',{name:label,exact:true}),r=await button.boundingBox();assert.ok(r.x>=frameBox.x && r.x+r.width<=frameBox.x+frameBox.width);assert.ok(r.y>=frameBox.y && r.y+r.height<=frameBox.y+frameBox.height);}
          assert.equal(await frame.locator('[data-admin-media-image-actions]').count(),1);
        }
        if(width>=768){const a=await firstCard.locator('[data-admin-media-image-alt-field]').boundingBox(),b=await secondCard.locator('[data-admin-media-image-alt-field]').boundingBox();assert.ok(Math.abs(a.y-b.y)<2);}
        const images=page.locator('[data-admin-media-image-field] [data-admin-media-image-preview-trigger] img');for(const img of await images.all())assert.equal(await img.evaluate(e=>getComputedStyle(e).objectFit),'contain');}}
      if(name==='الزر والرابط'&&!baseline){
        const data=await page.locator('[data-home-story-button-panel="data"]').boundingBox(),appearance=await page.locator('[data-home-story-button-panel="appearance"]').boundingBox();
        if(width>=1280){assert.ok(data.x>appearance.x);assert.ok(Math.abs(appearance.width/data.width-2)<0.1);assert.ok(Math.abs(data.y-appearance.y)<1);assert.ok(Math.abs(data.height-appearance.height)<1);}else assert.ok(appearance.y>=data.y+data.height);
        const cards=page.locator('[data-home-story-button-card]');assert.equal(await cards.count(),4);
        for(const card of await cards.all()){
          const header=card.locator('[data-admin-form-control-header]');assert.equal(await header.getAttribute('data-admin-form-control-presentation'),'leading-icon');
          const icon=header.locator(':scope > span').first();assert.equal(await icon.count(),1);assert.equal((await icon.boundingBox()).width,40);assert.equal(await icon.locator('svg').evaluate(e=>e.getBoundingClientRect().width),20);assert.notEqual(await icon.evaluate(e=>getComputedStyle(e).borderStyle),'none');
        }
        if(width>=1024){const rects=await cards.evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().toJSON()));assert.ok(rects[0].x>rects[1].x&&rects[2].x>rects[3].x);assert.ok(Math.abs(rects[0].y-rects[1].y)<1&&Math.abs(rects[2].y-rects[3].y)<1);assert.ok(rects[2].y>=rects[0].bottom);}
        for(const radio of await page.getByRole('radio').all()){const r=await radio.boundingBox();assert.ok(r.height>=36&&r.height<=40);assert.equal(await radio.evaluate(e=>getComputedStyle(e).fontSize),'14px');}
        for(const group of await page.getByRole('radiogroup').all()){assert.equal(await group.locator('[aria-checked="true"]').count(),1);}
        const field=page.locator('[data-admin-link-field]');const destination=await field.locator('[data-admin-link-destination]').boundingBox();
        const actions=await field.getByRole('button').all();assert.equal(actions.length,2);
        const right=await actions[0].boundingBox(),left=await actions[1].boundingBox();assert.equal(right.x-left.x-left.width,4);
        for(const action of actions){
          const r=await action.boundingBox();assert.equal(r.width,44);assert.equal(r.height,44);assert.equal(await action.locator('svg').evaluate(e=>e.getBoundingClientRect().width),22);
          assert.ok(r.x+r.width<=destination.x);assert.ok(Math.abs(r.y+r.height/2-destination.y-destination.height/2)<1);
          await page.mouse.move(0,0);await expect.poll(()=>action.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');assert.equal(await action.evaluate(e=>getComputedStyle(e).borderTopColor),'rgba(0, 0, 0, 0)');
          await action.hover();await expect.poll(()=>action.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');await page.mouse.move(0,0);
          await action.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(action).toBeFocused();assert.equal(await action.evaluate(e=>e.matches(':focus-visible')),true);assert.notEqual(await action.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
        }
        await page.evaluate(()=>document.activeElement?.blur());
        if(ctaOnly&&width!==1024)await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:'.tmp-qa/story-adoption/after-cta-'+width+'.png'});
        console.log('CTA 4/8 / original card icons / compact choices / bare 22px actions with 44px hit areas and 4px gap / hover and focus / RTL PASS at '+width);
      }
      if(width!==1024&&name!=='الزر والرابط'&&(!mediaOnly||name==='الصور')&&(!textOnly||name==='النصوص'))await page.getByRole('tabpanel').filter({visible:true}).screenshot({path:'.tmp-qa/story-adoption/'+(baseline?'before':'after')+'-'+(name==='النصوص'?'text':'images')+'-'+width+'.png'});
    }
  }

  if(!textOnly&&!ctaOnly){
  for(const dimensionsMode of ['missing','invalid']){omitDimensions=dimensionsMode;saved={...initial,images:{...initial.images,main:'/replacement.svg'}};
  await page.goto(url);await ready();await tab('الصور');
  await expect.poll(()=>page.locator('[data-admin-media-image-field="image_main"] [data-admin-media-image-frame]').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-1.5);})).toBeLessThan(0.01);
  await expect(page.locator('input[name="image_main"]')).toHaveValue('/replacement.svg');
  }omitDimensions=false;
  console.log('Natural landscape/portrait ratios, image-load fallback, aligned footers and official icon sizes PASS');

  if(!baseline){
    saved={...initial,images:{...initial.images,main:'/tall.svg',secondary:'/wide.svg'}};
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:800});await page.goto(url);await ready();await tab('الصور');
      for(const name of ['image_main','image_secondary']){
        const field=page.locator('[data-admin-media-image-field="'+name+'"]'),frame=field.locator('[data-admin-media-image-frame]');
        await expect(frame.locator('img')).toBeVisible();const rect=await frame.boundingBox();assert.ok(rect.height<=322);
        assert.equal(await frame.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
        for(const label of ['استبدال','إزالة']){
          const button=field.getByRole('button',{name:label,exact:true});
          const geometry=await button.evaluate(e=>{const r=e.getBoundingClientRect(),frame=e.closest('[data-admin-media-image-frame]').getBoundingClientRect();return {inside:r.x>=frame.x && r.right<=frame.right && r.y>=frame.y && r.bottom<=frame.bottom,button:r.toJSON(),frame:frame.toJSON()};});
          assert.ok(geometry.inside,'Extreme aspect ratio keeps complete action hit areas in frame: '+JSON.stringify({name,width,...geometry}));
          await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(button).toBeFocused();
        }
        await field.locator('[data-admin-media-image-preview-trigger]').click({position:{x:5,y:5}});
        await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('[data-admin-media-image-expanded] img')).toHaveAttribute('src',name==='image_main'?'/tall.svg':'/wide.svg');
        await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(field.locator('[data-admin-media-image-preview-trigger]')).toBeFocused();
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    console.log('Extreme portrait/panorama retain complete images and accessible, independent overlay controls PASS');
  }
  }
  for(const mode of (ctaOnly?[]:textOnly?['about']:['default-media','compact-media','about'])){await page.goto(url+'?mode='+mode);await ready();if(mode!=='about'){await expect(page.locator('[data-admin-media-image-field] img')).toBeVisible();const card=page.locator('[data-admin-media-image-field] img').first();assert.equal(await card.evaluate(e=>getComputedStyle(e).objectFit),'cover');if(mode==='default-media')assert.ok((await card.boundingBox()).width<=384);}else {await expect(body).toBeVisible();assert.equal(await scope.getByRole('toolbar').count(),0);assert.equal(await page.locator('[data-admin-form-control-presentation="leading-icon"]').count(),0);}}
  if(!ctaOnly){
    for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.goto(url+'?mode=default-tabs');await ready();
      const header=page.locator('[data-admin-tab-section-heading]');assert.equal(await header.locator('[data-admin-form-control-header]').count(),0);assert.equal(await header.locator('svg').count(),1);await expect(header.getByRole('heading',{name:'عنوان افتراضي',exact:true})).toBeVisible();
      assert.equal(await header.getByRole('heading').evaluate(e=>getComputedStyle(e).fontSize),width===1440?'20px':'18px');assert.equal(await header.locator(':scope > span').first().evaluate(e=>e.getBoundingClientRect().width),width===1440?48:44);
      await header.getByRole('button',{name:'إجراء افتراضي',exact:true}).focus();await expect(header.getByRole('button')).toBeFocused();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }console.log('Default tab section headers and summary control remain unchanged on Desktop/Mobile PASS');
  }
  if(ctaOnly){
    for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.goto(url+'?mode=default-link');await ready();
      const field=page.locator('[data-admin-link-field]');for(const button of await field.getByRole('button').all()){assert.equal((await button.boundingBox()).width,44);assert.equal(await button.locator('svg').evaluate(e=>e.getBoundingClientRect().width),20);assert.notEqual(await button.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');assert.notEqual(await button.evaluate(e=>getComputedStyle(e).borderTopColor),'rgba(0, 0, 0, 0)');}
      assert.equal((await page.getByRole('button',{name:'اختيار افتراضي',exact:true}).boundingBox()).height,44);await expect(page.getByRole('button',{name:'اختيار معطل',exact:true})).toBeDisabled();assert.equal(await page.getByRole('button',{name:'اختيار معطل',exact:true}).evaluate(e=>getComputedStyle(e).cursor),'not-allowed');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }console.log('Default Link Field frames / 20px icons / 44px choices and compact disabled state preserved PASS');
  }
  assert.deepEqual(errors,[]);console.log('PASS Story '+(ctaOnly?'CTA':textOnly?'text headers':'presentation')+': '+saves+' isolated saves; '+(ctaOnly?'default Link Field and Choice':textOnly?'default CTA/image headers and About':'default Media/About')+' consumers preserved; no DB or Storage writes.');
}
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

/** Observe real SSR ancestry. HTML visibility here is not computed Browser geometry. */
function premiumRenderedObservation(html) {
  const decode = value => value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/gi, match => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" }[match.toLowerCase()] ?? match));
  const tree = { tag: '#document', attrs: {}, children: [], parent: null }, stack = [tree], nodes = [];
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w-]+\b[^>]*>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--') || text.startsWith('<!')) continue;
    if (text.startsWith('</')) {
      const tag = text.slice(2).match(/^[\w-]+/)[0].toLowerCase(), index = stack.findLastIndex(node => node.tag === tag);
      assert.ok(index > 0, 'Balanced SSR HTML required'); stack.length = index;
    } else if (text.startsWith('<')) {
      const tag = text.slice(1).match(/^[\w-]+/)[0].toLowerCase();
      const attrs = Object.fromEntries([...text.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(([, key, double, single, bare]) => [key.toLowerCase(), decode(double ?? single ?? bare ?? '')]));
      const node = { tag, attrs, children: [], parent: stack.at(-1) }; stack.at(-1).children.push(node); nodes.push(node);
      if (!voids.has(tag) && !text.endsWith('/>')) stack.push(node);
    } else stack.at(-1).children.push(decode(text));
  }
  const textOf = node => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join('');
  const ancestors = node => { const values = []; for (let current = node; current; current = current.parent) values.push(current); return values; };
  const hidden = node => ancestors(node).some(current => 'hidden' in current.attrs || /(?:^|;)\s*display\s*:\s*none(?:;|$)/i.test(current.attrs.style ?? '') || (current.attrs.class ?? '').split(/\s+/).includes('hidden'));
  const disabled = node => ancestors(node).some(current => current === node ? 'disabled' in current.attrs : current.tag === 'fieldset' && 'disabled' in current.attrs);
  const groupName = node => node.attrs['data-home-story-button-panel'] || node.attrs['data-premium-cta-panel'] || node.attrs['data-blind-campaign-panel'];
  const panels = nodes.filter(groupName);
  const controls = nodes.filter(node => ['input', 'textarea', 'select'].includes(node.tag) && node.attrs.name).map(node => {
    const type = node.attrs.type || node.tag, checked = 'checked' in node.attrs;
    let value = node.tag === 'textarea' ? textOf(node) : node.attrs.value ?? '';
    if (node.tag === 'select') {
      const options = nodes.filter(option => option.tag === 'option' && ancestors(option).includes(node));
      const chosen = options.find(option => 'selected' in option.attrs) ?? options[0]; value = chosen ? chosen.attrs.value ?? textOf(chosen) : '';
    }
    const panel = ancestors(node).find(groupName), enabled = !disabled(node);
    return { name: node.attrs.name, type, value, checked, mounted: true, visible: type !== 'hidden' && node.attrs['aria-hidden'] !== 'true' && !hidden(node), enabled, submitted: enabled && (!['checkbox', 'radio'].includes(type) || checked), group: panel ? groupName(panel) : null };
  });
  return { controls, groupOrder: panels.map(groupName), groups: Object.fromEntries(panels.map(panel => [groupName(panel), controls.filter(control => control.group === groupName(panel)).map(control => control.name)])), headings: panels.map(panel => ({ group: groupName(panel), headings: nodes.filter(node => /^h[1-6]$/.test(node.tag) && ancestors(node).includes(panel)).map(textOf), descriptions: nodes.filter(node => node.tag === 'p' && ancestors(node).includes(panel)).map(textOf), directControlHeaders: nodes.filter(node => 'data-admin-form-control-header' in node.attrs && node.parent?.parent === panel).map(node => nodes.filter(child => child.tag === 'span' && ancestors(child).includes(node) && child !== node && !child.children.some(value => typeof value !== 'string')).map(textOf).filter(value => value.trim())), renderedText: textOf(panel) })) };
}

async function verifyPremiumAdoptionAcceptance() {
  const fixtureRoot = process.cwd(), fixtureRequire = createRequire(import.meta.url);
  const { mkdir, writeFile } = await import('node:fs/promises'), { existsSync } = await import('node:fs');
  const { createRemainingContentOwnerHarness } = await import('./fixtures/remaining-content-owner-harness.mjs');
  const React = fixtureRequire('react'), { renderToStaticMarkup } = fixtureRequire('react-dom/server');
  const outputArg = process.argv.find(value => value.startsWith('--content-premium-output-dir='));
  const outputDirectory = path.resolve(fixtureRoot, outputArg ? outputArg.slice('--content-premium-output-dir='.length) : '.tmp-qa/adoption-intelligence');
  assert.ok(outputDirectory.startsWith(path.join(fixtureRoot, '.tmp-qa') + path.sep)); await mkdir(outputDirectory, { recursive: true });
  if (process.argv.includes('--premium-adoption-validate-visual-only')) {
    const visualArg = process.argv.find(value => value.startsWith('--premium-adoption-visual-receipt='));
    assert.ok(visualArg, 'Validate-only requires a concrete visual receipt');
    const technicalBytes = await readFile(path.join(outputDirectory, 'acceptance.json')), technical = JSON.parse(technicalBytes);
    const validation = await validatePremiumVisualReceipt(JSON.parse(await readFile(path.resolve(fixtureRoot, visualArg.slice('--premium-adoption-visual-receipt='.length)), 'utf8')), technical, { fixtureRoot, outputDirectory, technicalSha256: createHash('sha256').update(technicalBytes).digest('hex') });
    await writeFile(path.join(outputDirectory, 'visual-validation.json'), JSON.stringify(validation, null, 2) + '\n');
    console.log('PASS current source-bound Browser evidence; Owner approval pending.'); return;
  }
  const previousFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error('Acceptance forbids network'); };
  try {
    const noAction = async () => { throw Error('Unexpected SSR transport'); };
    const ports = new Map([
      ['next/navigation', { useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch: async () => {} }), usePathname: () => '/admin/pages-blocks/blocks/content/28', useSearchParams: () => new URLSearchParams('tab=cta'), redirect: noAction }],
      ['next/link', { __esModule: true, default: ({ href, children, ...props }) => { delete props.prefetch; return React.createElement('a', { ...props, href }, children); } }],
      ['next/image', { __esModule: true, default: input => { const props = { ...input }; for (const key of ['fill', 'priority', 'unoptimized', 'quality', 'loader']) delete props[key]; return React.createElement('img', props); } }],
      ['src/lib/admin/links/actions', { browseAdminLinksAjax: noAction, resolveAdminLinkAjax: noAction, browseTopicCategoriesPickerAjax: noAction, browseMenusPickerAjax: noAction, browseMenuItemsPickerAjax: noAction }],
    ]);
    const owners = createRemainingContentOwnerHarness(fixtureRoot, { additionalPorts: ports });
    const registry = owners.load(path.join(fixtureRoot, 'src/lib/page-blocks/module-edit-registry.ts'));
    const metadata = owners.load(path.join(fixtureRoot, 'src/lib/page-composition/module-registry-metadata.ts'));
    const resolved = metadata.resolveModuleEditorCompositionApplicability('home-projects', 'cta');
    assert.ok(resolved && resolved.applicability.role === 'adopter' && resolved.reference.role === 'reference');
    const referenceSlug = resolved.applicability.reference.moduleSlug;
    const reference = { ...resolved.reference.source, slug: referenceSlug };
    const specs = [
      { id: 25, slug: referenceSlug, file: reference.sourceFile, exportName: reference.exportName, props: reference.mode, section: reference.section, prefix: 'button', data: ['button_label'], appearance: ['button_open_target', 'button_alignment', 'button_icon', 'button_icon_position'] },
      { id: 28, slug: 'home-projects', file: resolved.applicability.source.sourceFile, exportName: resolved.applicability.source.exportName, props: resolved.applicability.source.mode, section: resolved.applicability.source.section, prefix: 'footer_cta', data: ['footer_cta_label'], appearance: ['show_footer_cta', 'footer_cta_open_target', 'footer_cta_alignment'] },
    ];
    const link = { link_kind: 'static_route', linked_type: 'static_routes', href: '/about', anchor: 'retained-anchor', target: '_self', meta: { route_key: 'about' } };
    const inputs = {
      25: { title: 'Retained Story title', body: '<p>Retained body.</p>', images: { main: '/one.svg', secondary: '/two.svg' }, button: { label: 'Story action', link, target: '_blank', alignment: 'left', icon: 'arrow', iconPosition: 'left' } },
      28: { title: 'Retained Projects title', intro: 'Retained intro', projectsLimit: 4, cardCtaLabel: 'Card action', cardCtaAlignment: 'right', showFooterCta: true, footerCta: { label: 'Projects action', link, target: '_blank', alignment: 'left' } },
    };
    const render = (file, props, exportName = 'default') => {
      const component = owners.load(path.join(fixtureRoot, file))[exportName]; assert.equal(typeof component, 'function', 'Declared export is executable');
      return renderToStaticMarkup(React.createElement(component, props));
    };
    const negativeProbes = [];
    const reject = (name, operation) => { assert.throws(operation, undefined, name); negativeProbes.push({ name, rejected: true }); };
    const assertGroups = (observation, spec) => {
      assert.deepEqual(observation.groupOrder, ['data', 'appearance'], spec.id + ': ordered functional groups');
      const names = observation.controls.map(control => control.name);
      for (const name of new Set(names)) {
        const fields = observation.controls.filter(control => control.name === name);
        if (name === spec.uncheckedFallback) assert.deepEqual(fields.map(field => [field.type, field.value]), [['hidden', 'off'], ['checkbox', 'on']], 'Only canonical explicit unchecked fallback may duplicate its switch name');
        else assert.equal(fields.length, 1, 'Native field occurs exactly once: ' + name);
      }
      for (const name of spec.data) assert.ok(observation.groups.data.includes(name), name + ': data membership');
      for (const name of spec.appearance) assert.ok(observation.groups.appearance.includes(name), name + ': appearance membership');
      for (const control of observation.controls) { assert.equal(control.group, spec.appearance.includes(control.name) ? 'appearance' : 'data', control.name + ': group membership'); assert.ok(control.enabled, control.name + ': dormant value remains enabled'); }
      assert.ok(observation.controls.filter(control => control.name.startsWith(spec.prefix + '_') && !spec.appearance.includes(control.name) && !spec.data.includes(control.name)).length >= 4, 'Actual canonical link fields mounted');
      if (spec.sharedControlHeader) {
        assert.ok(observation.headings.every(group => group.directControlHeaders.length === 1 && group.directControlHeaders[0].length >= 2), 'Each group has one direct shared header with title and description');
      } else assert.ok(observation.headings.every(group => group.headings.length && group.descriptions.some(value => value.trim())), 'Both functional groups have heading and helper');
    };
    const dataFor = (observation, spec) => {
      const data = new FormData(); for (const control of observation.controls) if (control.submitted) data.append(control.name, control.value);
      data.set('config_schema', spec.id === 25 ? 'about-intro' : 'home-projects'); if (spec.id === 25) data.set('include_story_cta', '1'); return data;
    };
    const cloneData = data => { const copy = new FormData(); for (const [name, value] of data) copy.append(name, value); return copy; };
    const cases = [];
    for (const spec of specs) {
      assert.equal(registry.getContentModuleEditorKey(spec.slug, ''), spec.slug, 'Actual selector branch');
      assert.notEqual(registry.getContentModuleEditorKey('wrong-unknown-consumer', ''), spec.slug);
      for (const state of spec.id === 25 ? ['cta-populated', 'cta-icon-none'] : ['cta-populated', 'cta-inactive', 'cta-empty-label']) {
        const input = structuredClone(inputs[spec.id]); if (state === 'cta-icon-none') input.button.icon = 'none'; if (state === 'cta-inactive') input.showFooterCta = false; if (state === 'cta-empty-label') input.footerCta.label = '';
        const config = registry.resolveContentModuleEditorConfig({ slug: spec.slug, variant: null, config: input }), props = { config, ...spec.props, section: spec.section };
        const html = render(spec.file, props, spec.exportName), observation = premiumRenderedObservation(html); assertGroups(observation, spec);
        assertGroups(premiumRenderedObservation(html.replace(/class="[^"]*"/g, 'class="qa-layout-variation"')), spec);
        const data = dataFor(observation, spec), saved = await owners.content.buildContentConfig(data, spec.slug, input), action = saved[spec.id === 25 ? 'button' : 'footerCta'];
        assert.ok(action, 'Actual canonical action branch'); assert.equal(action.target, '_blank'); assert.equal(action.link.target, '_self'); assert.equal(action.link.anchor, 'retained-anchor'); assert.equal(action.alignment, 'left');
        if (spec.id === 28) assert.equal(saved.showFooterCta, state !== 'cta-inactive');
        const remounted = premiumRenderedObservation(render(spec.file, { ...props, config: registry.resolveContentModuleEditorConfig({ slug: spec.slug, variant: null, config: saved }) }, spec.exportName));
        assert.deepEqual(remounted.controls, observation.controls, 'Actual serializer/remount preserves CTA field state');
        if (spec.id === 25) assert.equal((html.match(/data-home-story-button-card="button_icon_position"/g) ?? []).length, state === 'cta-icon-none' ? 0 : 1, 'Conditional visual icon position retains hidden native value');
        cases.push({ consumerId: spec.id, state, editor: { sourceFile: spec.file, exportName: spec.exportName, mode: spec.props, section: spec.section, slug: spec.slug }, observation, savedAction: action, layoutVariationAccepted: true, persistedVia: 'actual buildContentConfig -> actual normalization -> actual editor remount', transition: 'populated/state configuration -> render -> submit -> serialize -> remount', boundary: 'Observed state projection and canonical serialization; no executed Browser event or DB persistence' });
        if (state === 'cta-populated') {
          reject(spec.id + ': missing group', () => assertGroups(premiumRenderedObservation(html.replace(/data-(?:home-story-button|premium-cta)-panel="appearance"/, 'data-removed="appearance"')), spec));
          reject(spec.id + ': duplicate field', () => assertGroups(premiumRenderedObservation(html + '<input name="' + spec.data[0] + '" value="duplicate"/>'), spec));
          reject(spec.id + ': wrong section', () => assertGroups(premiumRenderedObservation(render(spec.file, { ...props, section: 'text' })), spec));
          const wrongData = cloneData(data); wrongData.delete('config_schema'); wrongData.delete('include_story_cta');
          const wrong = await owners.content.buildContentConfig(wrongData, 'wrong-unknown-consumer', input);
          reject(spec.id + ': wrong serializer branch', () => assert.ok(wrong[spec.id === 25 ? 'button' : 'footerCta']));
          if (spec.id === 25) {
            const missing = cloneData(data); missing.delete('include_story_cta'); const wrongStory = await owners.content.buildContentConfig(missing, spec.slug, input);
            reject('25: missing Story save marker', () => assert.ok(wrongStory.button));
            reject('25: wrong mode', () => assertGroups(premiumRenderedObservation(render(spec.file, { ...props, editorMode: 'about-intro' })), spec));
            reject('25: wrong reachable editor source', () => assertGroups(premiumRenderedObservation(render(specs[1].file, props)), spec));
          }
        }
      }
    }
    const routeFile = 'src/app/admin/pages-blocks/blocks/content/[id]/page.tsx', actionFile = 'src/app/admin/pages-blocks/blocks/content/actions.ts';
    function assertSaveBinding(routeText, actionText) {
      const route = ts.createSourceFile(routeFile, routeText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), action = ts.createSourceFile(actionFile, actionText, ts.ScriptTarget.Latest, true);
      const named = route.statements.filter(ts.isImportDeclaration).find(node => node.moduleSpecifier.text === '../actions')?.importClause?.namedBindings;
      assert.ok(named && ts.isNamedImports(named) && named.elements.some(item => item.name.text === 'updateContentBlock' && !item.propertyName));
      let clientBound = false;
      function visit(node) { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(route) === 'ContentModuleEditClient') clientBound = node.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.text === 'updateAction' && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression?.getText(route) === 'updateContentBlock'); ts.forEachChild(node, visit); } visit(route); assert.ok(clientBound, 'Actual route binds updateContentBlock');
      const update = action.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'updateContentBlock'); let builds = false;
      function calls(node) { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'buildContentConfig') builds = node.arguments.length === 3 && node.arguments[0].getText(action) === 'formData' && node.arguments[1].getText(action) === 'slug' && node.arguments[2].getText(action) === 'existing.config'; ts.forEachChild(node, calls); }
      assert.ok(update); calls(update); assert.ok(builds, 'Actual mutation action invokes canonical builder with existing config');
    }
    const routeText = await readFile(path.join(fixtureRoot, routeFile), 'utf8'), actionText = await readFile(path.join(fixtureRoot, actionFile), 'utf8'); assertSaveBinding(routeText, actionText);
    reject('wrong route action', () => assertSaveBinding(routeText.replace('updateAction={updateContentBlock}', 'updateAction={createContentBlock}'), actionText));
    reject('wrong mutation serializer', () => assertSaveBinding(routeText, actionText.replace('await buildContentConfig(formData, slug, existing.config)', 'await buildGenericContentConfig(formData)')));
    const Tabs = owners.load(path.join(fixtureRoot, 'src/components/admin/ui/AdminModuleTabs.tsx')).default;
    const tabHtml = renderToStaticMarkup(React.createElement(Tabs, { initialTabId: 'first', tabs: [{ id: 'first', navigationLabel: 'First', content: React.createElement('input', { name: 'first', defaultValue: 'one' }) }, { id: 'second', navigationLabel: 'Second', content: React.createElement('input', { name: 'retained', defaultValue: 'dormant' }) }] }));
    const retained = premiumRenderedObservation(tabHtml).controls.find(field => field.name === 'retained'); assert.ok(retained?.mounted && !retained.visible && retained.enabled && retained.submitted, 'Actual tabs retain hidden enabled fields');
    const inherited = premiumRenderedObservation('<fieldset hidden disabled><input name="disabled_descendant" value="retained"/></fieldset>').controls[0]; assert.ok(inherited.mounted && !inherited.visible && !inherited.enabled && !inherited.submitted);
    const submissionProxy = premiumRenderedObservation('<select name="proxy" aria-hidden="true" tabindex="-1"><option value="kept" selected>Kept</option></select>').controls[0]; assert.ok(submissionProxy.mounted && !submissionProxy.visible && submissionProxy.enabled && submissionProxy.submitted, 'Native listbox submission proxy is distinct from its visible shared trigger');
    const sidebarFile = 'src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx', Sidebar = owners.load(path.join(fixtureRoot, sidebarFile)).default, Feedback = owners.load(path.join(fixtureRoot, 'src/components/admin/AdminFeedbackProvider.tsx')).default, sidebarStates = [];
    for (const widget of ['latest', 'sections']) {
      const html = renderToStaticMarkup(React.createElement(Feedback, null, React.createElement(Sidebar, { block: { id: 9001, name: 'Isolated sidebar', slug: 'isolated-sidebar', description: null, status: 'unpublished', widget_key: widget, config: {} }, categories: [], assignmentContext: { pages: [], assignments: [] }, updateAction: noAction })));
      const observation = premiumRenderedObservation(html), display = observation.controls.filter(field => field.name === 'presentation' || /^show_(?:title|image|category|series|excerpt|date)_on_page$/.test(field.name)); assert.equal(display.length, 7, 'Actual sidebar presentation and six display fields');
      if (widget === 'sections') { assert.ok(display.every(field => field.mounted && !field.visible && !field.enabled && !field.submitted)); assert.ok(!observation.controls.some(field => field.name === 'source_kind')); } else assert.ok(display.every(field => field.enabled));
      sidebarStates.push({ widget, display, sourceMounted: observation.controls.some(field => field.name === 'source_kind') });
    }
    const blindFile = '.tmp-qa/adoption-intelligence-20261019/blind-consumer.tsx'; let blind = null;
    if (existsSync(path.join(fixtureRoot, blindFile))) {
      const initialState = { campaign_action_label: 'Blind action', campaign_action: link, campaign_action_open_target: '_blank', campaign_action_alignment: 'left', show_campaign_action: false }, observation = premiumRenderedObservation(render(blindFile, { initialState }));
      assertGroups(observation, { id: 'blind', prefix: 'campaign_action', data: ['campaign_action_label'], appearance: ['campaign_action_open_target', 'campaign_action_alignment', 'show_campaign_action'], uncheckedFallback: 'show_campaign_action', sharedControlHeader: true });
      assert.ok(observation.controls.filter(field => field.name !== 'show_campaign_action').every(field => field.enabled && field.submitted));
      const selectionFile = '.tmp-qa/adoption-intelligence-20261019/blind-selection.json', selection = JSON.parse(await readFile(path.join(fixtureRoot, selectionFile), 'utf8'));
      assert.deepEqual({ sourceFile: selection.selectedReference.source, exportName: selection.selectedReference.export, mode: { [selection.selectedReference.modeProp]: selection.selectedReference.mode }, section: selection.selectedReference.section }, resolved.reference.source, 'Independent frozen decision matches the applicable reference');
      assert.equal(selection.independence.promptSuppliedReferenceIdentity, false);
      blind = { sourceFile: blindFile, selectionFile, selectionSha256: createHash('sha256').update(await readFile(path.join(fixtureRoot, selectionFile))).digest('hex'), observation };
    }
    const sourceFiles = new Set([...owners.files, ...(blind ? [blind.selectionFile] : []), routeFile, actionFile, 'src/components/admin/ui/ADMIN_UI_RULES.md', 'src/components/admin/page-blocks/ContentModuleEditClient.tsx', 'src/lib/page-blocks/module-editor-presentation-contract.ts', 'src/lib/page-composition/module-registry-metadata.ts', 'scripts/qa-home-story-presentation.mjs', 'scripts/fixtures/remaining-content-owner-harness.mjs', 'scripts/verify-page-block-editor-presentation.mts', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs', 'src/app/globals.css']);
    const sourceHashes = Object.fromEntries(await Promise.all([...sourceFiles].sort().map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')])));
    const visualCases = [25, 28].flatMap(consumerId => [[1440, 900], [390, 844]].map(([width, height]) => ({ role: consumerId === 25 ? 'reference' : 'adopter', consumerId, state: 'cta-populated', viewport: { width, height }, direction: 'rtl', required: true, completeGroups: ['data', 'appearance'] })));
    if (blind) visualCases.push(...[[1440, 900], [390, 844]].map(([width, height]) => ({ role: 'blind', consumerId: 'blind', state: 'cta-inactive', viewport: { width, height }, direction: 'rtl', required: false })));
    const receipt = { schemaVersion: 1, technicalStatus: 'PASS', visualStatus: 'pending-captured-evidence', ownerApproval: 'pending-human-review', reference, sourceHashes, cases, visualCases, negativeProbes, hiddenStateContrast: { actualTabs: retained, observerAncestorDisabledProbe: inherited, actualMediaSidebar: { sourceFile: sidebarFile, states: sidebarStates } }, blind, saveRoute: { routeFile, client: 'src/components/admin/page-blocks/ContentModuleEditClient.tsx', actionFile, exportName: 'updateContentBlock', serializer: 'buildContentConfig', mutationExecuted: false }, boundary: { browser: false, network: false, database: false, server: false, computedVisibility: false, eventTransitions: false } };
    const technicalPath = path.join(outputDirectory, 'acceptance.json'); await writeFile(technicalPath, JSON.stringify(receipt, null, 2) + '\n');
    const technicalSha256 = createHash('sha256').update(await readFile(technicalPath)).digest('hex');
    const context = { fixtureRoot, outputDirectory, technicalSha256 }, visualArg = process.argv.find(value => value.startsWith('--premium-adoption-visual-receipt='));
    const template = { schemaVersion: 1, technicalReceipt: path.relative(fixtureRoot, technicalPath).replaceAll('\\', '/'), technicalReceiptSha256: technicalSha256, sourceHashes, reference, captures: [], ownerApproval: { status: 'pending' } };
    const evidenceNegativeProbes = [];
    const rejectEvidence = async (name, mutate, message) => {
      const input = structuredClone(template);
      // Deliberately unobserved descriptors for rejection tests only. No pixels or
      // visual PASS are manufactured from SSR observations.
      input.captures = visualCases.filter(value => value.required).map(value => {
        const observed = cases.find(item => item.consumerId === value.consumerId && item.state === value.state).observation;
        return { ...structuredClone(value), ready: true, loading: false, screenshot: '__not_a_browser_capture__.png', screenshotSha256: 'unobserved', observed: { groupOrder: [...observed.groupOrder], groups: structuredClone(observed.groups), mountedFields: observed.controls.map(field => field.name), visibleFields: observed.controls.filter(field => field.visible).map(field => field.name), enabledFields: observed.controls.filter(field => field.enabled).map(field => field.name), submittedFields: observed.controls.filter(field => field.submitted).map(field => field.name) } };
      });
      mutate(input); await assert.rejects(() => validatePremiumVisualReceipt(input, receipt, context), message, name); evidenceNegativeProbes.push({ name, rejected: true });
    };
    await rejectEvidence('stale technical receipt', value => { value.technicalReceiptSha256 = 'stale'; }, /Stale technical/);
    await rejectEvidence('stale source set', value => { value.sourceHashes[specs[0].file] = 'stale'; }, /Stale source/);
    await rejectEvidence('reference mismatch', value => { value.reference.mode.editorMode = 'about-intro'; }, /Reference mismatch/);
    await rejectEvidence('unobserved state', value => { value.captures[0].state = 'loading'; }, /Unobserved state/);
    await rejectEvidence('wrong viewport', value => { value.captures[0].viewport.width = 1024; }, /Wrong viewport/);
    await rejectEvidence('loading screenshot', value => { value.captures[0].loading = true; }, /Loading screenshot/);
    await rejectEvidence('source-only claim', value => { value.captures = []; }, /Source-only/);
    await rejectEvidence('SSR descriptor without Browser pixels', () => {}, /ENOENT/);
    const { default: sharp } = await import('sharp');
    const wrongViewportPixels = await sharp({ create: { width: 1440, height: 900, channels: 3, background: '#13202b' } }).png().toBuffer();
    await assert.rejects(() => assertPremiumCaptureRaster(wrongViewportPixels, { viewport: { width: 390, height: 844 }, captureStrategy: 'cua-viewport', observed: { viewport: { width: 390, height: 844, clientWidth: 375 } } }), /Screenshot viewport pixels/u);
    evidenceNegativeProbes.push({ name: 'Desktop pixels relabeled Mobile', rejected: true });
    const coverageCase = visualCases.find(value => value.required);
    assert.throws(() => assertPremiumVisualCoverage([coverageCase], [{ ...coverageCase, geometry: [{ group: 'data', y: 0, width: 300, height: 200 }, { group: 'appearance', y: 1000, width: 300, height: 200 }] }]), /Functional group missing/u);
    evidenceNegativeProbes.push({ name: 'Mounted groups outside captured frame', rejected: true });
    await writeFile(path.join(outputDirectory, 'evidence-negative-probes.json'), JSON.stringify({ status: 'PASS', probes: evidenceNegativeProbes, boundary: 'Intentionally invalid descriptors/pixels, never visual proof' }, null, 2) + '\n');
    const validation = visualArg ? await validatePremiumVisualReceipt(JSON.parse(await readFile(path.resolve(fixtureRoot, visualArg.slice('--premium-adoption-visual-receipt='.length)), 'utf8')), receipt, context) : { status: 'pending', reason: 'No Browser captures supplied; technical success is not visual proof', ownerApproval: 'pending-human-review' };
    await writeFile(path.join(outputDirectory, 'visual-validation.json'), JSON.stringify(validation, null, 2) + '\n');
    await writeFile(path.join(outputDirectory, 'visual-receipt-template.json'), JSON.stringify({ ...template, visualCases, captureContract: { requiredCaptureFields: ['role', 'consumerId', 'state', 'viewport', 'direction', 'ready', 'loading', 'screenshot', 'screenshotSha256', 'observed.groupOrder', 'observed.groups', 'observed.mountedFields', 'observed.visibleFields', 'observed.enabledFields', 'observed.submittedFields'], screenshot: 'relative to output directory', observation: 'Actual Browser DOM. Native hidden fields are mounted/submitted, not physically visible.' } }, null, 2) + '\n');
    assert.equal(owners.state.writes, 0); console.log('PASS Premium adoption acceptance: ' + cases.length + ' actual rendered states; ' + negativeProbes.length + ' rejected wrong composition/route/serializer probes. Visual ' + validation.status + '; Owner pending. ' + path.relative(fixtureRoot, technicalPath));
  } finally { globalThis.fetch = previousFetch; }
}

/** Validate evidence provenance and observation; never grant human Owner approval. */
async function validatePremiumVisualReceipt(visual, technical, { fixtureRoot, outputDirectory, technicalSha256 }) {
  assert.equal(technical.technicalStatus, 'PASS', 'Technical acceptance must pass independently');
  assert.equal(visual.schemaVersion, 1); assert.equal(visual.technicalReceiptSha256, technicalSha256, 'Stale technical receipt'); assert.deepEqual(visual.sourceHashes, technical.sourceHashes, 'Stale source inputs'); assert.deepEqual(visual.reference, technical.reference, 'Reference mismatch');
  for (const [file, expected] of Object.entries(technical.sourceHashes)) assert.equal(createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex'), expected, 'Stale current source: ' + file);
  assert.ok(Array.isArray(technical.visualCases) && technical.visualCases.some(value => value.required), 'Explicit fixture visual cases required');
  assert.ok(Array.isArray(visual.captures) && visual.captures.length >= technical.visualCases.filter(value => value.required).length, 'Source-only proof or missing paired captures');
  const checked = [];
  for (const capture of visual.captures) {
    const identityCases = technical.visualCases.filter(value => value.role === capture.role && value.consumerId === capture.consumerId && value.state === capture.state);
    assert.ok(identityCases.length, 'Unobserved state or consumer identity');
    const declared = identityCases.find(value => value.viewport.width === capture.viewport?.width && value.viewport.height === capture.viewport?.height);
    assert.ok(declared, 'Wrong viewport'); assert.equal(capture.direction, declared.direction); assert.equal(capture.ready, true); assert.equal(capture.loading, false, 'Loading screenshot');
    const state = technical.cases.find(value => value.consumerId === capture.consumerId && value.state === capture.state), expected = state?.observation ?? technical.blind?.observation; assert.ok(expected, 'Unobserved rendered state');
    assert.deepEqual(capture.observed?.groupOrder, expected.groupOrder, 'Wrong rendered grouping');
    for (const group of ['data', 'appearance']) assert.deepEqual([...capture.observed.groups[group]].sort(), [...expected.groups[group]].sort(), 'Wrong group membership');
    const all = expected.controls.map(value => value.name).sort(); assert.deepEqual([...capture.observed.mountedFields].sort(), all, 'Mounted mismatch');
    for (const [field, predicate] of [['enabledFields', value => value.enabled], ['submittedFields', value => value.submitted]]) assert.deepEqual([...capture.observed[field]].sort(), expected.controls.filter(predicate).map(value => value.name).sort(), field + ' mismatch');
    assert.ok(capture.observed.visibleFields.every(value => all.includes(value)));
    // Native switch inputs may be sr-only while their shared visual control is
    // visible. Never convert SSR ancestry into a computed visibility assertion.
    assert.ok(expected.controls.filter(value => value.visible && !['checkbox', 'radio'].includes(value.type)).every(value => capture.observed.visibleFields.includes(value.name)), 'Visible text field missing');
    const screenshot = path.resolve(outputDirectory, capture.screenshot); assert.ok(screenshot.startsWith(outputDirectory + path.sep)); const bytes = await readFile(screenshot); assert.ok(bytes.length > 1000);
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes[0] === 255 && bytes[1] === 216, 'Screenshot pixels required'); assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.screenshotSha256, 'Screenshot mismatch');
    const raster = await assertPremiumCaptureRaster(bytes, capture);
    checked.push({ role: capture.role, state: capture.state, viewport: capture.viewport, screenshot: capture.screenshot, sha256: capture.screenshotSha256, raster });
  }
  assertPremiumVisualCoverage(technical.visualCases, visual.captures);
  assert.notEqual(visual.ownerApproval?.status, 'approved', 'Programmatic receipt cannot grant human Owner approval'); return { status: 'PASS', sourceBound: true, captures: checked, ownerApproval: 'pending-human-review', boundary: 'Capture provenance/DOM validity; visual judgment stays with Owner' };
}

function assertPremiumVisualCoverage(cases, captures) {
  for (const expected of cases.filter(value => value.required)) {
    const frames = captures.filter(value => value.role === expected.role && value.consumerId === expected.consumerId && value.state === expected.state && value.viewport.width === expected.viewport.width && value.viewport.height === expected.viewport.height && value.direction === expected.direction);
    assert.ok(frames.length, 'Missing paired state/viewport');
    for (const group of expected.completeGroups ?? []) assert.ok(frames.some(frame => frame.geometry?.some(panel => panel.group === group && panel.width > 0 && panel.height > 0 && panel.y >= -1 && panel.y + panel.height <= expected.viewport.height + 1)), 'Functional group missing from screenshot frame: ' + group);
  }
}

/** CUA may normalize viewport pixels to the document client width, retaining aspect. */
async function assertPremiumCaptureRaster(bytes, capture) {
  const { default: sharp } = await import('sharp'), raster = await sharp(bytes).metadata();
  assert.equal(capture.captureStrategy, 'cua-viewport', 'Declare the actual screenshot strategy');
  const frame = capture.observed?.viewport;
  assert.ok(frame && frame.width === capture.viewport.width && frame.height === capture.viewport.height, 'Observed viewport mismatch');
  assert.ok(frame.clientWidth > 0 && frame.clientWidth <= frame.width && frame.width - frame.clientWidth <= 24, 'Invalid observed client width');
  const exact = raster.width === frame.width && raster.height === frame.height;
  const normalized = raster.width === frame.clientWidth && Math.abs(raster.height - Math.round(frame.height * frame.clientWidth / frame.width)) <= 1;
  assert.ok(exact || normalized, 'Screenshot viewport pixels do not match the observed frame');
  return { width: raster.width, height: raster.height, strategy: capture.captureStrategy, normalized: !exact };
}

/** Serve the existing isolated owner fixture for browser interaction through CUA. */
async function serveContentPremiumFixture() {
  const fixtureRoot = process.cwd(), fixtureRequire = createRequire(import.meta.url);
  const completionMode = process.argv.includes('--premium-completion-fixture');
  const familyMode = completionMode || process.argv.includes('--premium-family-fixture') || process.argv.includes('--premium-family-offline-only');
  assert.ok(!familyMode || !process.argv.includes('--content-premium-offline-only'), 'Family and Content offline modes are distinct fixture selections');
  const onlyArgument = process.argv.find(argument => argument.startsWith('--content-premium-only='));
  const onlyIds = onlyArgument ? new Set(onlyArgument.slice('--content-premium-only='.length).split(',').map(Number)) : null;
  if (onlyIds) assert.ok(onlyIds.size > 0 && [...onlyIds].every(Number.isInteger), 'Explicit fixture IDs must be integers');
  const outputArgument = process.argv.find(argument => argument.startsWith('--content-premium-output-dir='));
  const outputDirectory = path.resolve(fixtureRoot, outputArgument ? outputArgument.slice('--content-premium-output-dir='.length) : '.tmp-qa/content-premium-20261019');
  assert.ok(outputDirectory.startsWith(path.join(fixtureRoot, '.tmp-qa') + path.sep), 'QA evidence must stay inside .tmp-qa');
  const beforeMode = process.argv.includes('--content-premium-before');
  const fixtureOverrides = new Map();
  if (beforeMode) {
    const baselineArgument = process.argv.find(argument => argument.startsWith('--baseline-file='));
    assert.ok(baselineArgument, 'Before fixture requires an explicit captured baseline');
    const snapshot = JSON.parse(await readFile(baselineArgument.slice('--baseline-file='.length), 'utf8'));
    const captured = familyMode && !Array.isArray(snapshot) ? snapshot.entries : snapshot;
    if (familyMode) {
      assert.ok(Array.isArray(captured), 'Before fixture requires captured source entries');
      for (const row of captured) if (row.path.replaceAll('\\', '/').startsWith('src/')) fixtureOverrides.set(row.path.replaceAll('\\', '/'), Buffer.from(row.content, 'base64').toString('utf8'));
      const { execFileSync } = await import('node:child_process');
      for (const file of completionMode ? [] : ['src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx', 'src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx']) {
        if (!fixtureOverrides.has(file)) fixtureOverrides.set(file, execFileSync('git', ['show', `HEAD:${file}`], { cwd: fixtureRoot, encoding: 'utf8', windowsHide: true, maxBuffer: 2000000 }));
      }
    } else {
      for (const name of ['AboutIntroSingleImageModuleEditor', 'VisionGoalsModuleEditor', 'HomeProjectsPlacementEditor']) {
        const file = `src/components/admin/page-blocks/editors/${name}.tsx`, row = captured.find(value => value.path.replaceAll('\\', '/') === file);
        assert.ok(row, `Before fixture baseline missing ${file}`); fixtureOverrides.set(file, Buffer.from(row.content, 'base64').toString('utf8'));
      }
    }
  }
  const { createRemainingContentOwnerHarness } = await import('./fixtures/remaining-content-owner-harness.mjs');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('Unexpected fixture owner network request'); };
  let parseAssignmentIds;
  const hubMemory = { active: null, capture: null, fail: false };
  const hubPorts = completionMode ? new Map([
    ['src/lib/page-blocks/sync-module-page-assignments', {
      parsePageIdsFromForm(data) { assert.ok(parseAssignmentIds); return parseAssignmentIds(data); },
      async saveModuleTemplateWithPageAssignments(kind, id, template, pageIds, actor) {
        assert.equal(kind, 'media-hub'); assert.equal(id, hubMemory.active); assert.ok(actor?.id);
        if (hubMemory.fail) throw Error('isolated_media_hub_save_failure');
        hubMemory.capture = { kind, id, template: structuredClone(template), pageIds: [...pageIds] };
        return { id, affectedPageIds: [...pageIds], updatedAt: new Date().toISOString() };
      },
    }],
    ['src/lib/page-blocks/admin-revalidate', { async revalidateBlockModulePaths() {}, async revalidateCommittedPageBlockAction(result, work) { await work(); return result; } }],
  ]) : new Map();
  const owners = createRemainingContentOwnerHarness(fixtureRoot, familyMode ? { sourceOverrides: fixtureOverrides, additionalPorts: hubPorts } : undefined);
  const breadcrumbOwner = familyMode && !completionMode ? owners.load(path.join(fixtureRoot, 'src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts'), ['buildBreadcrumbConfig']) : null;
  const featuredOwner = familyMode && !completionMode ? owners.load(path.join(fixtureRoot, 'src/lib/featured-modules/config.ts')) : null;
  const heroOwner = familyMode && !completionMode ? owners.load(path.join(fixtureRoot, 'src/lib/hero/hero-content-controls.ts')) : null;
  const fixtureJiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const registry = await fixtureJiti.import('../src/lib/page-blocks/module-edit-registry.ts');
  const { parseFormStatus: statusFromForm } = await fixtureJiti.import('../src/lib/page-blocks/admin-utils.ts');
  const assignmentText = await readFile(path.join(fixtureRoot, 'src/lib/page-blocks/sync-module-page-assignments.ts'), 'utf8');
  const assignmentTree = ts.createSourceFile('assignments.ts', assignmentText, ts.ScriptTarget.Latest, true);
  const assignmentNode = assignmentTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'parsePageIdsFromForm');
  assert.ok(assignmentNode);
  const assignmentExports = {};
  new Function('exports', ts.transpileModule(assignmentNode.getText(assignmentTree), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(assignmentExports);
  parseAssignmentIds = assignmentExports.parsePageIdsFromForm;
  const hubOwner = completionMode ? owners.load(path.join(fixtureRoot, 'src/app/admin/pages-blocks/blocks/media-hub/actions.ts'), ['updateMediaHubModule']) : null;
  let heroPageIdsFromForm;
  if (familyMode && !completionMode) {
    const file = 'src/app/admin/pages-blocks/blocks/hero/actions.ts', source = fixtureOverrides.get(file) ?? await readFile(path.join(fixtureRoot, file), 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true), action = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'updateHeroTemplateDetails');
    const declaration = action?.body?.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => ts.isIdentifier(node.name) && node.name.text === 'pageIds');
    assert.ok(declaration?.initializer, 'Hero assignment parser must resolve from the actual update action');
    heroPageIdsFromForm = new Function('formData', `return ${declaration.initializer.getText(tree)};`);
  }
  const text = { eyebrow: 'تمهيد معزول', title: 'عنوان الاختبار المحفوظ', subtitle: 'عنوان فرعي محفوظ', body: '<p>نص محفوظ <strong>وتنسيق موجود</strong>.</p><p>فقرة ثانية.</p>', showEyebrow: true, showTitle: true, showSubtitle: false, showDescription: true, titleBold: true, titleAlignment: 'right', descriptionAlignment: 'right' };
  const beats = Array.from({ length: 3 }, (_, i) => ({ num: String(i + 1), title: `بطاقة ${i + 1}`, text: `وصف البطاقة ${i + 1}` }));
  const intro = { ...text, images: { main: '/one.svg', secondary: '/two.svg', accent: '/replacement.svg', mainAlt: 'الصورة الرئيسية', secondaryAlt: 'الصورة الثانية', accentAlt: 'الصورة الثالثة' }, beats };
  const homeStory = { ...intro, button: { label: 'عن فينيسيا', href: '/about', link: { link_kind: 'static_route', linked_type: 'static_routes', href: '/about', anchor: 'story-anchor', target: '_self', meta: { route_key: 'about' } }, target: '_self', alignment: 'right', icon: 'arrow', iconPosition: 'left' } };
  const legacyFooter = { label: '', href: '/legacy-projects#legacy-anchor', link: { link_kind: 'legacy', href: '/legacy-projects#legacy-anchor', anchor: 'legacy-anchor', target: '_blank', meta: { route_key: 'legacy-projects', retained_legacy_note: 'Existing deserializer owns metadata normalization' } }, target: '_self', alignment: 'left' };
  const legacyCta = process.argv.includes('--content-premium-cta-legacy');
  if (legacyCta) assert.ok(onlyIds?.has(28), 'Legacy CTA fixture requires an explicit selection containing 28');
  const definitions = [
    ...(familyMode || onlyIds?.has(25) ? [[25, 'قصة فينيسيا — المرجع', 'home-story', homeStory]] : []),
    [115, 'محتوى وصورة واحدة', 'about-intro-single-image', { ...text, images: { main: '/one.svg', mainAlt: 'صورة واحدة' }, beats, imagePosition: 'left' }],
    [174, 'قائمة الموضوعات', 'topics-listing', { collection: { type: 'all' }, presentation: 'grid', itemsPerRow: 3, itemLimit: 9, display: { title: true, image: true, category: true, series: true, excerpt: true, date: true, details: { visible: true, text: 'اقرأ المزيد', bold: false, alignment: 'right' } } }],
    [17, 'الرؤية والأهداف', 'vision-goals', { ...text, intro: ['فقرة أولى محفوظة.', 'فقرة ثانية محفوظة.'], image: '/one.svg', imageAlt: 'صورة الرؤية', vision: { title: 'رؤيتنا', items: beats.map(item => ({ title: item.title, text: item.text })) }, goals: { title: 'أهدافنا', items: beats.map(item => ({ title: item.title, text: item.text })) } }],
    [3, 'محتوى الرؤية العام', 'about-vision', text],
    [102, 'نسخة غلاف معرض الصور', 'fixture-gallery-shell-copy', text],
    [4, 'منهجنا', 'about-approach', { eyebrow: text.eyebrow, title: text.title, showTitle: true, showEyebrow: true, titleAlignment: 'right' }],
    [101, 'مقدمة من نحن', 'about-intro', intro],
    [28, 'مشروعات الرئيسية', 'home-projects', { eyebrow: text.eyebrow, title: text.title, intro: 'وصف مشروعات محفوظ', projectsLimit: 4, cardCtaLabel: 'التفاصيل', cardCtaAlignment: 'right', footerCta: { label: 'كل المشروعات', href: '/about', link: { link_kind: 'static_route', linked_type: 'static_routes', href: '/about', meta: { route_key: 'about' }, target: '_self' }, alignment: 'center', target: '_self' } }],
    [78, 'مقدمة المتابعة العامة', 'track-intro', text],
  ].filter(([id]) => !onlyIds || onlyIds.has(id));
  if (onlyIds) assert.equal(definitions.length, onlyIds.size, 'Each selected fixture must exist');
  if (legacyCta) {
    const target = definitions.find(([id]) => id === 28);
    target[3] = { ...target[3], showFooterCta: false, footerCta: structuredClone(legacyFooter) };
  }
  const rows = new Map(definitions.filter(([id]) => !familyMode || completionMode || id === 25).map(([id, name, slug, config]) => [familyMode ? `content:${id}` : id, { ...(familyMode ? { kind: 'content', fixtureKey: `content:${id}`, ...(id === 25 ? { referenceScope: 'pages' } : {}) } : {}), block: { id, name: `${name} — بيانات معزولة`, slug, description: 'Synthetic isolated fixture', variant: null, style_preset: 'premium-dark', status: 'unpublished', updated_at: '2026-10-19T00:00:00.000Z' }, config: structuredClone(config), pages: [id === 28 || familyMode ? 1 : 2], saves: 0, failures: 0 }]));
  const editorOptions = { categories: [{ id: 1, slug: 'reference-category', name: 'تصنيف معزول', parentId: null, depth: 0, scopeSlugs: ['reference-category', 'child-category'] }], items: [{ id: 701, contentType: 'article', title: 'موضوع متاح', categorySlug: 'child-category', publishedAt: '2026-10-20T00:00:00Z' }, ...['news', 'press', 'site_update', 'video', 'gallery'].map((contentType, index) => ({ id: 801 + index, contentType, title: contentType, categorySlug: '', publishedAt: '2026-10-20T00:00:00Z' }))] };
  if (completionMode) {
    assert.ok(!onlyIds && !legacyCta, 'Completion fixture uses explicit kind:id keys');
    for (const [kind, file] of [['content', 'content-fixture-definitions.json'], ['media-hub', 'hub-fixture-definitions.json']]) {
      const added = JSON.parse(await readFile(path.join(fixtureRoot, '.tmp-qa/premium-completion-20261020', file), 'utf8'));
      assert.ok(Array.isArray(added) && added.length === (kind === 'content' ? 5 : 4), 'Completion fixture requires captured consumer seed definitions');
      for (const row of added) {
        assert.ok(Number.isSafeInteger(row.id) && row.slug && row.name && row.config);
        const key = `${kind}:${row.id}`; assert.ok(!rows.has(key), 'Fixture identities must remain unique');
        rows.set(key, { kind, fixtureKey: key, block: { id: row.id, name: row.name, slug: row.slug, description: 'Synthetic isolated completion fixture', variant: null, style_preset: 'premium-dark', status: 'unpublished', updated_at: '2026-10-20T00:00:00.000Z', ...(kind === 'media-hub' ? { section_key: row.section_key } : {}) }, config: structuredClone(row.config), pages: [1], saves: 0, failures: 0 });
      }
    }
  } else if (familyMode) {
    assert.ok(!onlyIds && !legacyCta, 'Family fixture uses explicit kind:id keys rather than Content-only flags');
    const link = { link_kind: 'static_route', linked_type: 'static_routes', href: '/about', anchor: 'retained-anchor', target: '_blank', meta: { route_key: 'about' } };
    const add = (kind, id, name, slug, config, extra = {}) => rows.set(`${kind}:${id}`, { kind, fixtureKey: `${kind}:${id}`, block: { id, name, slug, description: 'Synthetic isolated fixture', variant: null, style_preset: 'premium-dark', status: 'unpublished', updated_at: '2026-10-20T00:00:00.000Z', ...extra }, config, pages: [1], saves: 0, failures: 0 });
    add('breadcrumb', 3, 'مسار التنقل — بيانات معزولة', 'fixture-breadcrumb', { source: 'navigation', showHome: true, currentLabelOverride: 'الموقع الحالي', manualItems: [{ label: 'من نحن', link }, { label: 'العنصر الحالي' }] });
    add('featured', 3, 'موضوعات مختارة — بيانات معزولة', 'fixture-featured-categories', featuredOwner.parseFeaturedModuleConfig({ source: { kind: 'categories', categorySlug: 'reference-category' }, selection: { mode: 'manual', topicIds: [701, 999001, 503, 999002] }, itemLimit: 6, presentation: { variant: 'list', eyebrow: 'موضوعات', title: 'اختياراتنا', description: 'وصف محفوظ', ctaText: 'التفاصيل' } }));
    add('featured', 6, 'أخبار مختارة — بيانات معزولة', 'fixture-featured-media', featuredOwner.parseFeaturedModuleConfig({ source: { kind: 'media-center', contentType: 'news' }, selection: { mode: 'manual', topicIds: [801, 999001] }, itemLimit: 6, itemsPerView: 3, presentation: { variant: 'group-carousel', title: 'أحدث الأخبار' }, navigation: { showArrows: true, showDots: false, autoplay: false } }));
    add('hero', 1, 'هيرو الرئيسية — بيانات معزولة', 'fixture-home-hero', { eyebrow: 'الرئيسية', title: 'عنوان هيرو محفوظ', highlight: 'تمييز محفوظ', subtitle: 'عنوان فرعي', description: '<p>محتوى هيرو محفوظ</p>', images: ['/one.svg', '/replacement.svg'], mobileImages: ['/two.svg'], showEyebrow: true, showTitle: true, showSubtitle: false, showDescription: true, showCta: true, primaryCtaLabel: 'من نحن', primaryCtaLink: link, secondaryCtaLabel: 'تعرف علينا', secondaryCtaLink: { ...link, anchor: 'secondary-anchor', target: '_self' }, heroElementOrder: ['title', 'eyebrow', 'subtitle', 'highlight', 'description', 'cta'] }, { variant: 'home-cinematic', style_preset: 'cinematic-gold' });
  }
  const pages = [{ id: 1, title: 'الرئيسية', path: '/', slug: '/' }, { id: 2, title: 'من نحن', path: '/about', slug: '/about' }, { id: 4, title: 'الموضوعات', path: '/topics', slug: '/topics' }, { id: 24, title: 'تابع مشروعك', path: '/track-your-project', slug: '/track-your-project' }];
  if (process.argv.includes('--premium-family-offline-only')) {
    await verifyPremiumFamilyNativeFields({ fixtureRoot, fixtureRequire, createRemainingContentOwnerHarness, rows, editorOptions, assignmentExports, heroPageIdsFromForm, outputDirectory });
    globalThis.fetch = previousFetch;
    return;
  }
  if (process.argv.includes('--content-premium-offline-only')) {
    await verifyContentPremiumNativeFields({ fixtureRoot, fixtureRequire, rows, registry, owners, createRemainingContentOwnerHarness, outputDirectory, focused: Boolean(onlyIds), legacyFooter });
    globalThis.fetch = previousFetch;
    return;
  }
  const project = fixtureRoot.replaceAll('\\', '/');
  const blindFile = '.tmp-qa/adoption-intelligence-20261019/blind-consumer.tsx';
  const { existsSync } = await import('node:fs');
  const hasBlindFixture = !completionMode && existsSync(path.join(fixtureRoot, blindFile));
  const blindImport = hasBlindFixture ? "import Blind from '" + project + "/" + blindFile + "';" : 'const Blind=()=>null;';
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import Content from '${project}/src/components/admin/page-blocks/ContentModuleEditClient.tsx';
${completionMode ? `import MediaHub from '${project}/src/components/admin/page-blocks/MediaHubModuleEditClient.tsx';` : ''}
${familyMode && !completionMode ? `import Breadcrumb from '${project}/src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx';import Featured from '${project}/src/components/admin/page-blocks/FeaturedModuleEditClient.tsx';import Hero from '${project}/src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx';` : ''}
${familyMode ? `import{withModuleEditorReturnContextFromForm}from'${project}/src/lib/page-blocks/admin-utils.ts';` : ''}
${blindImport}
import Feedback from '${project}/src/components/admin/AdminFeedbackProvider.tsx';
import{SearchParamsContext,PathnameContext}from'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import{AppRouterContext}from'next/dist/shared/lib/app-router-context.shared-runtime.js';
import{RedirectBoundary}from'next/dist/client/components/redirect-boundary.js';
import{getRedirectError}from'next/dist/client/components/redirect.js';
import{isRedirectError}from'next/dist/client/components/redirect-error.js';
const row=window.fixtureRow;
${familyMode ? "const saved=new URLSearchParams(location.search).get('saved')==='1';" : ''}
const router={back(){},forward(){},prefetch:async()=>{},refresh(){location.reload()},push(href){location.assign(href)},replace(href){location.replace(href)}};
async function persist(data){const response=await fetch('/fixture-save?fixture='+encodeURIComponent(row.fixtureKey||row.block.id)+'&failure='+new URLSearchParams(location.search).get('failure'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([...data].filter(([,value])=>typeof value==='string'))});const result=await response.json();if(!response.ok)throw Error(result.message);${familyMode ? "const destination=new URLSearchParams({fixture:row.fixtureKey,saved:'1'});const failure=new URLSearchParams(location.search).get('failure');if(failure!==null)destination.set('failure',failure);throw getRedirectError(withModuleEditorReturnContextFromForm('/?'+destination.toString(),data),'replace');" : "throw getRedirectError(location.href,'replace');"}}
window.fixturePersist=persist;
const content=<Content block={row.block} config={row.config} assignmentContext={window.assignmentContext} projectDetailHeroEditorLinks={null} topicCategoryOptions={[{id:1,slug:'proof-category',name:'تصنيف معزول',parentId:null,depth:0}]} saved={${familyMode ? 'saved' : 'undefined'}} updateAction={persist}/>;
${completionMode ? `const editor=row.kind==='media-hub'?<MediaHub block={{...row.block,config:row.config}} assignmentContext={window.assignmentContext} saved={saved} updateAction={persist}/>:content;` : familyMode ? `const editor=row.kind==='breadcrumb'?<Breadcrumb block={row.block} config={row.config} assignmentContext={window.assignmentContext} saved={saved} updateAction={persist}/>:row.kind==='featured'?<Featured block={row.block} config={row.config} editorOptions={window.fixtureEditorOptions} assignmentContext={window.assignmentContext} saved={saved} updateAction={persist}/>:row.kind==='hero'?<Hero hero={row.block} config={row.config} imagesText={(row.config.images||[]).join('\\n')} mobileImagesText={(row.config.mobileImages||[]).join('\\n')} variantOptions={window.fixtureHeroVariants} initialTabId="display" assignmentContext={window.assignmentContext} saved={saved}/>:content;` : 'const editor=content;'}
createRoot(document.getElementById('root'),{onCaughtError(error){if(!isRedirectError(error))console.error(error)}}).render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)}><AppRouterContext.Provider value={router}><PathnameContext.Provider value={'/admin/pages-blocks/blocks/'+(row.kind||'content')+'/'+row.block.id}><RedirectBoundary><Feedback>{window.fixtureBlind?<form data-blind-fixture-form="" onSubmit={event=>event.preventDefault()}><Blind initialState={window.fixtureBlindState}/></form>:editor}</Feedback></RedirectBoundary></PathnameContext.Provider></AppRouterContext.Provider></SearchParamsContext.Provider>);`;
  const moduleData = sourceText => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(sourceText, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
  const loadedSources = new Map();
  if (familyMode) for (const file of owners.files) loadedSources.set(file, fixtureOverrides.get(file) ?? await readFile(path.join(fixtureRoot, file), 'utf8'));
  if (familyMode) loadedSources.set('src/lib/page-blocks/sync-module-page-assignments.ts', assignmentText);
  const webpack = fixtureRequire('next/dist/compiled/webpack/webpack').webpack;
  const compiler = webpack({ mode: 'development', target: 'web', context: fixtureRoot, entry: moduleData(entry), output: { path: path.join(fixtureRoot, '.tmp-qa/content-premium'), filename: 'fixture.js' }, devtool: false,
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { 'server-only': false } },
    plugins: [new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$/, moduleData(`export async function browseAdminLinksAjax(){return {ok:true,results:[{id:'static_routes:about',resourceId:'about',resourceType:'static_routes',title:'من نحن',slug:'about',publicPath:'/about',meta:{route_key:'about'}}]};}export async function resolveAdminLinkAjax(value){return {ok:true,display:{kind:value.link_kind,kindLabel:'صفحة',title:'من نحن',publicPath:(value.href||'/about')+(value.anchor?'#'+value.anchor:''),target:value.target||'_self'}};}export const browseTopicCategoriesPickerAjax=async()=>({ok:true,results:[]}),browseMenusPickerAjax=async()=>({ok:true,results:[]}),browseMenuItemsPickerAjax=async()=>({ok:true,results:[]});`)),
      ...(familyMode ? [new webpack.NormalModuleReplacementPlugin(/^\.\.\/actions$/, resource => { if (resource.context.replaceAll('\\', '/').endsWith('/src/app/admin/pages-blocks/blocks/hero/[id]')) resource.request = moduleData('export async function updateHeroTemplateDetails(data){return window.fixturePersist(data);}'); })] : []),
      new webpack.ProvidePlugin({ process: fixtureRequire.resolve('next/dist/build/polyfills/process') }),
      { apply(c) { c.hooks.shouldEmit.tap('MemoryFixture', () => false); c.hooks.compilation.tap('MemoryFixture', compilation => { webpack.NormalModule.getCompilationHooks(compilation).readResource.for(undefined).tapPromise('MemoryFixture', async context => { if (/\.[jt]sx?$/.test(context.resourcePath) && !context.resourcePath.includes('node_modules')) { const relative = path.relative(fixtureRoot, context.resourcePath).replaceAll('\\', '/'); const source = fixtureOverrides.get(relative) ?? await readFile(context.resourcePath, 'utf8'); if (familyMode) loadedSources.set(relative, source); return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText; } }); }); } }],
  });
  let bundle;
  await new Promise((resolve, reject) => compiler.run((error, stats) => { if (!error && !stats.hasErrors()) bundle = Buffer.from(stats.compilation.assets['fixture.js'].source()); compiler.close(closeError => error || closeError || stats.hasErrors() ? reject(error || closeError || Error(stats.toString({ all: false, errors: true }))) : resolve()); }));
  const css = (await fixtureRequire('postcss')([fixtureRequire('@tailwindcss/postcss')({ base: fixtureRoot })]).process(await readFile(path.join(fixtureRoot, 'src/app/globals.css'), 'utf8'), { from: path.join(fixtureRoot, 'src/app/globals.css') })).css;
  const fontCss = [300, 400, 500, 600, 700].map(weight => '@font-face{font-family:FixtureArabic;src:url(/fonts/ibm-plex-sans-arabic-' + weight + '.woff2);font-weight:' + weight + ';font-display:block;}').join('') + ':root{--font-arabic:FixtureArabic;--font-inter:Arial;}';
  const assetNames = completionMode ? ['one', 'two', 'replacement', 'map'] : ['one', 'two', 'replacement'];
  const assets = assetNames.map((name, index) => ({ id: name, provider: 'filesystem', bucket: 'public', objectKey: name + '.svg', publicUrl: completionMode && name === 'map' ? '/images/projects/fixture-map.svg' : '/' + name + '.svg', originalFilename: name + '.svg', displayName: 'صورة ' + name, kind: 'image', mimeType: 'image/svg+xml', extension: 'svg', sizeBytes: 1234, width: 800 + index * 100, height: 600, folderPath: name === 'map' ? 'images/projects' : 'images/home', status: 'active', missingObject: false, catalogRegistered: true, source: 'catalog_storage', createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z', referenceCount: 0 }));
  const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  const fixtureKeyFor = address => familyMode ? address.searchParams.get('fixture') || (address.searchParams.has('kind') && address.searchParams.has('id') ? `${address.searchParams.get('kind')}:${address.searchParams.get('id')}` : completionMode ? 'content:4' : 'breadcrumb:3') : Number(address.searchParams.get('fixture') || address.searchParams.get('id') || definitions[0][0]);
  const sourceIdentity = familyMode ? { familyFixture: true, completionFixture: completionMode, ...(completionMode ? { processId: process.pid, blindFixtureImported: false } : {}), keys: [...rows.keys()], referenceScope: { 'content:25': 'pages' }, transport: 'isolated-memory; real editors/config builders/page-id parsing; no auth, DB, assignment-conflict, storage mutation or public rendering proof', builders: completionMode ? { content: 'src/app/admin/pages-blocks/blocks/content/actions.ts#buildContentConfig', mediaHub: 'src/app/admin/pages-blocks/blocks/media-hub/actions.ts#updateMediaHubModule (real action with isolated auth/audit/cache/media coordination/composition save ports)', assignments: 'src/lib/page-blocks/sync-module-page-assignments.ts#parsePageIdsFromForm' } : { breadcrumb: 'src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts#buildBreadcrumbConfig', featured: 'src/lib/featured-modules/config.ts#buildFeaturedModuleConfig', hero: 'src/app/admin/pages-blocks/blocks/hero/actions.ts#buildHeroConfig', assignments: 'src/lib/page-blocks/sync-module-page-assignments.ts#parsePageIdsFromForm', heroAssignments: 'src/app/admin/pages-blocks/blocks/hero/actions.ts#updateHeroTemplateDetails.pageIds' }, sources: [...loadedSources].sort(([a], [b]) => a.localeCompare(b)).map(([file, source]) => ({ file, sha256: createHash('sha256').update(source).digest('hex') })) } : {};
  if (completionMode) {
    const files = ['scripts/qa-home-story-presentation.mjs', 'scripts/fixtures/remaining-content-owner-harness.mjs', 'package.json', 'package-lock.json', 'postcss.config.mjs', 'src/app/globals.css', ...[300, 400, 500, 600, 700].map(weight => `src/assets/fonts/ibm-plex-sans-arabic-${weight}.woff2`), '.tmp-qa/premium-completion-20261020/content-fixture-definitions.json', '.tmp-qa/premium-completion-20261020/hub-fixture-definitions.json'];
    for (const specifier of ['next/dist/compiled/webpack/webpack', '@tailwindcss/postcss', 'postcss', 'typescript', 'jiti']) files.push(path.relative(fixtureRoot, fixtureRequire.resolve(specifier)).replaceAll('\\', '/'));
    const referenceAsset = 'docs/references/admin/compact-inline-settings.png'; if (existsSync(path.join(fixtureRoot, referenceAsset))) files.push(referenceAsset);
    sourceIdentity.buildInputs = await Promise.all(files.map(async file => { const bytes = await readFile(path.join(fixtureRoot, file)); return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...(file === 'postcss.config.mjs' ? { role: 'context; fixture invokes @tailwindcss/postcss inline' } : {}) }; }));
    sourceIdentity.bundle = { bytes: bundle.length, sha256: createHash('sha256').update(bundle).digest('hex') };
    sourceIdentity.css = { bytes: Buffer.byteLength(css + fontCss), sha256: createHash('sha256').update(css + fontCss).digest('hex') };
    sourceIdentity.runtime = { node: process.version, args: process.argv.slice(2), capturedAt: new Date().toISOString() };
    sourceIdentity.memoryPorts = [...hubPorts.keys()];
  }
  const server = createServer(async (request, response) => {
    try {
      const address = new URL(request.url, 'http://127.0.0.1');
      if (address.pathname === '/fixture.js') { response.setHeader('content-type', 'application/javascript'); response.end(bundle); return; }
      if (/^\/fonts\/ibm-plex-sans-arabic-(300|400|500|600|700)\.woff2$/.test(address.pathname)) { response.setHeader('content-type', 'font/woff2'); response.end(await readFile(path.join(fixtureRoot, 'src/assets', address.pathname))); return; }
      if (address.pathname === '/fixture-state') { response.setHeader('content-type', 'application/json'); response.end(json(familyMode && (address.searchParams.has('fixture') || address.searchParams.has('kind')) ? (assert.ok(rows.has(fixtureKeyFor(address))), rows.get(fixtureKeyFor(address))) : [...rows.values()])); return; }
      if (address.pathname === '/fixture-source') { response.setHeader('content-type', 'application/json'); response.end(json({ mode: beforeMode ? 'before' : 'after', ids: [...rows.keys()], ctaLegacy: legacyCta, ...sourceIdentity, overrides: [...fixtureOverrides].map(([file, source]) => ({ file, sha256: createHash('sha256').update(source).digest('hex') })) })); return; }
      if (address.pathname === '/fixture-save') {
        assert.equal(request.method, 'POST'); const row = rows.get(fixtureKeyFor(address)); assert.ok(row);
        let body = ''; for await (const chunk of request) body += chunk; assert.ok(body.length < 200000);
        const entries = JSON.parse(body); assert.ok(Array.isArray(entries));
        const data = new FormData(); for (const [key, value] of entries) { assert.equal(typeof key, 'string'); assert.equal(typeof value, 'string'); data.append(key, value); }
        if (row.kind === 'media-hub') {
          assert.ok(hubOwner); assert.equal(hubMemory.active, null, 'Isolated Hub saves are sequential');
          hubMemory.active = row.block.id; hubMemory.capture = null; hubMemory.fail = address.searchParams.get('failure') === '1';
          let capture, canonicalRedirectHref;
          try {
            try { await hubOwner.updateMediaHubModule(data); throw Error('Expected canonical Hub redirect after save'); }
            catch (error) { if (typeof error.href !== 'string') throw error; canonicalRedirectHref = error.href; }
            capture = hubMemory.capture;
            assert.ok(capture && capture.id === row.block.id && canonicalRedirectHref, 'Actual Hub action must capture a complete save and redirect');
          } catch (error) {
            if (!hubMemory.fail) throw error;
            assert.equal(hubMemory.capture, null); row.failures++;
            response.statusCode = 503; response.setHeader('content-type', 'application/json'); response.end(json({ message: 'تعذر الحفظ في الاختبار المعزول. القيم لم تُحفظ.', canonicalError: error.message })); return;
          } finally { hubMemory.active = null; hubMemory.capture = null; hubMemory.fail = false; }
          const nextTemplate = JSON.parse(JSON.stringify(capture.template)), config = nextTemplate.config; delete nextTemplate.config;
          row.block = { ...row.block, ...nextTemplate, updated_at: new Date().toISOString() }; row.config = config; row.pages = capture.pageIds; row.saves++;
          row.lastAction = { owner: 'updateMediaHubModule', canonicalRedirectHref, capturedKind: capture.kind, isolatedCompositionSave: true };
          response.setHeader('content-type', 'application/json'); response.end(json({ ok: true, saves: row.saves, canonicalRedirectHref })); return;
        }
        if (address.searchParams.get('failure') === '1') { row.failures++; response.statusCode = 503; response.setHeader('content-type', 'application/json'); response.end(json({ message: 'تعذر الحفظ في الاختبار المعزول. القيم لم تُحفظ.' })); return; }
        const variant = row.kind === 'hero' ? heroOwner.parseHeroTemplateVariant(data.get('variant')) : row.block.variant;
        const config = row.kind === 'breadcrumb' ? breadcrumbOwner.buildBreadcrumbConfig(data) : row.kind === 'featured' ? featuredOwner.buildFeaturedModuleConfig(data) : row.kind === 'hero' ? owners.hero.buildHeroConfig(data, variant) : await owners.content.buildContentConfig(data, row.block.slug, row.config);
        const pageIds = row.kind === 'hero' ? heroPageIdsFromForm(data) : assignmentExports.parsePageIdsFromForm(data);
        row.config = JSON.parse(JSON.stringify(config)); row.block.name = String(data.get('name') || row.block.name).trim(); row.block.status = statusFromForm(data); row.block.updated_at = new Date().toISOString(); row.pages = pageIds; row.saves++;
        if (familyMode) { row.block.description = String(data.get(row.kind === 'hero' ? 'template_description' : 'description') ?? row.block.description ?? '').trim() || null; if (data.has('slug')) row.block.slug = String(data.get('slug')).trim(); if (row.kind === 'hero') { row.block.variant = variant; row.block.style_preset = String(data.get('style_preset') || 'cinematic-gold'); } }
        response.setHeader('content-type', 'application/json'); response.end(json({ ok: true, saves: row.saves })); return;
      }
      if (address.pathname === '/api/admin/media-library') {
        response.setHeader('content-type', 'application/json');
        if (request.method === 'POST') { let body = ''; for await (const chunk of request) body += chunk; const input = JSON.parse(body); assert.equal(input.operation, 'reference_state', 'Storage mutations are outside this fixture'); response.end(json({ deleted: [], missing: [], originals: input.assets.map(value => ({ value, width: 800, height: 600 })) })); return; }
        assert.equal(request.method, 'GET'); response.end(json({ catalogState: 'available', warning: null, assets, folders: [], page: 1, pageSize: 20, total: assets.length, totalPages: 1, summary: { provider: 'filesystem', folderCount: 0, assetCount: assets.length, imageCount: assets.length, documentCount: 0, totalBytes: 3702, unknownSizeCount: 0, largestAsset: null }, readiness: { usageResultsAuthoritative: true, safeDeleteReady: false, reasons: [], warnings: [] } })); return;
      }
      const imagePath = address.pathname === '/_next/image' ? address.searchParams.get('url') : address.pathname;
      if (assets.some(asset => asset.publicUrl === imagePath)) { response.setHeader('content-type', 'image/svg+xml'); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="bg"><stop stop-color="#121c25"/><stop offset="1" stop-color="#b58d4b"/></linearGradient></defs><rect width="800" height="600" fill="url(#bg)"/><text x="400" y="300" text-anchor="middle" font-size="45" fill="white">' + imagePath + '</text></svg>'); return; }
      assert.equal(address.pathname, '/');
      const isBlind = address.searchParams.get('fixture') === 'blind';
      if (isBlind) assert.ok(hasBlindFixture, 'Independent blind fixture must exist');
      assert.ok(!familyMode || !isBlind, 'Independent blind Content fixture is outside the family scope');
      const row = rows.get(isBlind ? definitions[0][0] : fixtureKeyFor(address)); assert.ok(row);
      const normalized = { ...row, config: !familyMode || row.kind === 'content' ? registry.resolveContentModuleEditorConfig({ ...row.block, config: row.config }) : row.config };
      const assignmentContext = { pages, assignments: row.pages.map(page_id => { const page = pages.find(value => value.id === page_id); return { id: row.block.id * 100 + page_id, page_id, template_id: row.block.id, slot: 'main', sort_order: 10, is_visible: true, page_title: page.title, page_slug: page.slug, page_path: page.path }; }) };
      const links = [...rows].map(([key, entry]) => '<a href="/?fixture=' + encodeURIComponent(key) + '&returnPageId=' + (familyMode ? '1' : '2') + (entry.referenceScope ? '&tab=pages' : '') + '">' + key + ' ' + entry.block.name + '</a>').join(' · ');
      const failure = address.searchParams.get('failure') === '1';
      response.setHeader('content-type', 'text/html'); response.setHeader('content-security-policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'");
      const blindState = { campaign_action_label: 'Blind action', campaign_action: { link_kind: 'static_route', linked_type: 'static_routes', href: '/about', anchor: 'retained-anchor', target: '_self', meta: { route_key: 'about' } }, campaign_action_open_target: '_blank', campaign_action_alignment: 'left', show_campaign_action: false };
      response.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>' + css + fontCss + '</style><aside style="padding:12px;background:#161616;color:#fff;font:14px Arial" data-fixture-save-count="' + row.saves + '" data-fixture-failure-count="' + row.failures + '"><p>بيانات معزولة: لا توجد اتصالات أو كتابة لقاعدة بيانات. الحفظ وإعادة التحميل يستخدمان ' + (familyMode ? 'المحررات وConfig Builders الأصلية داخل الذاكرة؛ مرجع Content25 للصفحات فقط. قياس Hero العام غير ممثل.' : 'buildContentConfig الحقيقي داخل الذاكرة. التجربة المستقلة تعرض القسم فقط دون مسار حفظ.') + '</p><nav>' + links + '</nav><p>الحفظ الناجح: ' + row.saves + ' · الفشل: ' + row.failures + ' · <a href="/?fixture=' + encodeURIComponent(row.fixtureKey || row.block.id) + '&returnPageId=' + (familyMode ? '1' : '2') + (row.referenceScope ? '&tab=pages' : '') + '&failure=' + (failure ? '0' : '1') + '">' + (failure ? 'إلغاء فشل الحفظ' : 'تفعيل فشل الحفظ') + '</a> · <button type="button" onclick="location.reload()">إعادة تحميل المحفوظ</button></p></aside><div class="p-4"><div id="root"></div></div><script>window.fixtureRow=' + json(normalized) + ';window.assignmentContext=' + json(assignmentContext) + ';window.fixtureBlind=' + json(isBlind) + ';window.fixtureBlindState=' + json(blindState) + ';window.fixtureEditorOptions=' + json(editorOptions) + ';window.fixtureHeroVariants=' + json(heroOwner?.HERO_TEMPLATE_VARIANT_OPTIONS_AR ?? []) + '</script><script src="/fixture.js"></script></html>');
    } catch (error) { response.statusCode = 400; response.setHeader('content-type', 'application/json'); response.end(json({ message: String(error.message || error) })); }
  });
  const portArgument = process.argv.find(argument => argument.startsWith('--port='));
  const port = portArgument ? Number(portArgument.slice(7)) : 4177;
  assert.ok(Number.isInteger(port) && port >= 1024 && port < 65536);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  if (completionMode) {
    const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(outputDirectory, { recursive: true });
    const mode = beforeMode ? 'before' : 'after';
    await writeFile(path.join(outputDirectory, `fixture-${mode}-source.json`), JSON.stringify({ mode, port, ...sourceIdentity, overrides: [...fixtureOverrides].map(([file, source]) => ({ file, sha256: createHash('sha256').update(source).digest('hex') })) }, null, 2) + '\n');
    await writeFile(path.join(outputDirectory, `fixture-${mode}-initial-state.json`), JSON.stringify([...rows.values()], null, 2) + '\n');
  }
  process.once('SIGINT', () => { globalThis.fetch = previousFetch; server.close(() => process.exit(0)); });
  console.log('CUA isolated ' + (completionMode ? 'Premium completion' : familyMode ? 'Premium family' : 'Content') + ' fixture (' + (beforeMode ? 'before' : 'after') + '): http://127.0.0.1:' + port + '/?fixture=' + (completionMode ? 'content:4&returnPageId=1' : familyMode ? 'breadcrumb:3&returnPageId=1' : definitions[0][0] + '&returnPageId=2'));
  console.log(rows.size + ' synthetic target records; real ' + (completionMode ? 'Content/MediaHub clients, canonical Content builder and actual isolated MediaHub action' : familyMode ? 'Breadcrumb/Featured/Hero/Content clients, canonical config builders and page-id parser' : 'ContentModuleEditClient/AdminFormRuntime/buildContentConfig') + '. Media/link reads are isolated. No browser launched, DB writes, Auth claims or public-page proof.');
}

/** Extend the existing native-control/real-owner proof; no browser or domain writes. */
async function verifyPremiumFamilyNativeFields({ fixtureRoot, fixtureRequire, createRemainingContentOwnerHarness, rows, editorOptions, assignmentExports, heroPageIdsFromForm, outputDirectory }) {
  const React = fixtureRequire('react'), { renderToStaticMarkup } = fixtureRequire('react-dom/server');
  const baselineArgument = process.argv.find(argument => argument.startsWith('--baseline-file='));
  assert.ok(baselineArgument, 'Family native comparison requires its explicit pre-edit baseline');
  const snapshot = JSON.parse(await readFile(baselineArgument.slice('--baseline-file='.length), 'utf8'));
  const captured = Array.isArray(snapshot) ? snapshot : snapshot.entries;
  assert.ok(Array.isArray(captured));
  const sourceOverrides = new Map(captured.filter(row => row.path.replaceAll('\\', '/').startsWith('src/')).map(row => [row.path.replaceAll('\\', '/'), Buffer.from(row.content, 'base64').toString('utf8')]));
  const { execFileSync } = await import('node:child_process');
  for (const file of ['src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx', 'src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx']) if (!sourceOverrides.has(file)) sourceOverrides.set(file, execFileSync('git', ['show', `HEAD:${file}`], { cwd: fixtureRoot, encoding: 'utf8', windowsHide: true, maxBuffer: 2000000 }));
  const noAction = async () => { throw Error('Unexpected static fixture transport'); };
  const additionalPorts = new Map([
    ['next/navigation', { useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch: async () => {} }), usePathname: () => '/admin/pages-blocks/blocks/hero/1', useSearchParams: () => new URLSearchParams('tab=display'), redirect: noAction }],
    ['next/link', { __esModule: true, default: ({ href, children, ...props }) => { delete props.prefetch; return React.createElement('a', { ...props, href }, children); } }],
    ['next/image', { __esModule: true, default: input => { const props = { ...input }; for (const key of ['fill', 'priority', 'unoptimized', 'quality', 'loader']) delete props[key]; return React.createElement('img', props); } }],
    ['src/app/admin/pages-blocks/blocks/hero/actions', { updateHeroTemplateDetails: noAction }],
    ['src/lib/admin/links/actions', { browseAdminLinksAjax: noAction, resolveAdminLinkAjax: noAction, browseTopicCategoriesPickerAjax: noAction, browseMenusPickerAjax: noAction, browseMenuItemsPickerAjax: noAction }],
  ]);
  const before = createRemainingContentOwnerHarness(fixtureRoot, { sourceOverrides, additionalPorts }), after = createRemainingContentOwnerHarness(fixtureRoot, { additionalPorts });
  const paths = { breadcrumb: 'src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx', featured: 'src/components/admin/page-blocks/FeaturedModuleEditClient.tsx', hero: 'src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx' };
  const dataFor = fields => { const data = new FormData(); for (const field of fields) if (!field.disabled && (!['checkbox', 'radio'].includes(field.type) || field.checked)) data.append(field.name, field.value); return data; };
  const assignments = { pages: [{ id: 1, title: 'الرئيسية', path: '/', slug: '/' }, { id: 2, title: 'من نحن', path: '/about', slug: '/about' }], assignments: [{ id: 11, page_id: 1, template_id: 3, slot: 'main', sort_order: 20, is_visible: true, page_title: 'الرئيسية', page_slug: '/', page_path: '/' }] };
  const builderFor = (harness, kind) => kind === 'breadcrumb' ? harness.load(path.join(fixtureRoot, 'src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts'), ['buildBreadcrumbConfig']).buildBreadcrumbConfig : kind === 'featured' ? harness.load(path.join(fixtureRoot, 'src/lib/featured-modules/config.ts')).buildFeaturedModuleConfig : data => harness.hero.buildHeroConfig(data, 'home-cinematic');
  const render = (harness, row, config) => {
    const heroControls = harness.load(path.join(fixtureRoot, 'src/lib/hero/hero-content-controls.ts'));
    const props = row.kind === 'hero' ? { hero: row.block, config, assignmentContext: assignments, imagesText: (config.images || []).join('\n'), mobileImagesText: (config.mobileImages || []).join('\n'), variantOptions: heroControls.HERO_TEMPLATE_VARIANT_OPTIONS_AR, initialTabId: 'display' } : { block: row.block, config, assignmentContext: assignments, editorOptions, updateAction: noAction };
    const Feedback = harness.load(path.join(fixtureRoot, 'src/components/admin/AdminFeedbackProvider.tsx')).default;
    return readPremiumFixtureNativeControls(renderToStaticMarkup(React.createElement(Feedback, null, React.createElement(harness.load(path.join(fixtureRoot, paths[row.kind])).default, props))), { preserveOrder: true });
  };
  const evidence = [];
  for (const row of [...rows.values()].filter(value => value.kind !== 'content')) {
    const cases = row.kind === 'breadcrumb' ? ['navigation', 'manual'].flatMap(source => [true, false].map(showHome => [`${source}-home-${showHome}`, { ...row.config, source, showHome }])) : row.kind === 'featured' ? [['manual', row.config], ['automatic', { ...row.config, selection: { mode: 'automatic' } }]] : [['assigned', row.config]];
    for (const [state, config] of cases) {
      const original = render(before, row, config), current = render(after, row, config);
      const sorted = fields => [...fields].sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
      assert.deepEqual(sorted(current), sorted(original), `${row.fixtureKey}/${state}: native fields, values and enabled states remain identical`);
      const saved = builderFor(after, row.kind)(dataFor(current)), expected = builderFor(before, row.kind)(dataFor(original));
      assert.deepEqual(saved, expected, `${row.fixtureKey}/${state}: canonical save parity`);
      const readBack = row.kind === 'featured' ? after.load(path.join(fixtureRoot, 'src/lib/featured-modules/config.ts')).parseFeaturedModuleConfig(saved) : saved;
      assert.deepEqual(builderFor(after, row.kind)(dataFor(render(after, row, readBack))), builderFor(before, row.kind)(dataFor(render(before, row, readBack))), `${row.fixtureKey}/${state}: canonical save/reload parity`);
      const pageIds = row.kind === 'hero' ? heroPageIdsFromForm(dataFor(current)) : assignmentExports.parsePageIdsFromForm(dataFor(current));
      assert.deepEqual(pageIds, [1], `${row.fixtureKey}/${state}: page assignments survive all mounted tabs`);
      assert.equal(dataFor(current).get('status'), row.block.status, `${row.fixtureKey}/${state}: native publication status preserved`);
      if (row.kind === 'breadcrumb') assert.deepEqual(saved.manualItems, expected.manualItems, 'Manual items remain submitted while navigation is active');
      if (row.kind === 'featured' && state === 'manual') assert.deepEqual(saved.selection.topicIds, config.selection.topicIds, 'Unavailable authored selections remain present');
      if (row.kind === 'hero') {
        for (const key of ['images', 'mobileImages', 'eyebrow', 'title', 'highlight', 'subtitle', 'description', 'primaryCtaLabel', 'secondaryCtaLabel', 'heroElementOrder']) assert.deepEqual(saved[key], config[key], `Hero visibility save retains authored ${key}`);
        for (const key of ['primaryCtaLink', 'secondaryCtaLink']) for (const part of ['href', 'anchor', 'target']) assert.equal(saved[key][part], config[key][part], `Hero visibility save retains ${key}.${part}`);
        assert.deepEqual(JSON.parse(dataFor(current).get('hero_element_order')), config.heroElementOrder, 'Hero editor actually mounts the nondefault authored order');
      }
      evidence.push({ fixture: row.fixtureKey, state, nativeFieldCount: current.length, fields: current.map(field => field.name), canonicalSaveParity: true, saveReloadParity: true, assignments: pageIds, status: row.block.status });
    }
  }
  const breadcrumb = builderFor(after, 'breadcrumb'), featured = builderFor(after, 'featured');
  // Use the exact successful native field contract for a link with its label removed.
  const linked = dataFor(render(after, rows.get('breadcrumb:3'), rows.get('breadcrumb:3').config)); linked.set('manual_item_0_label', '');
  assert.throws(() => breadcrumb(linked), /تسمية عنصر المسار/u);
  const invalidFeatured = dataFor(render(after, rows.get('featured:3'), rows.get('featured:3').config)); invalidFeatured.delete('manual_topic_ids');
  assert.throws(() => featured(invalidFeatured), /اختر عنصرًا/u);
  invalidFeatured.set('selection_mode', 'automatic'); invalidFeatured.set('item_limit', '13'); assert.throws(() => featured(invalidFeatured), /عدد العناصر/u);
  const invalidPages = new FormData(); invalidPages.append('page_ids', '0'); assert.throws(() => assignmentExports.parsePageIdsFromForm(invalidPages), /غير صالحة/u);
  const returnContext = after.load(path.join(fixtureRoot, 'src/lib/page-blocks/admin-utils.ts'));
  const contextualForm = new FormData(); contextualForm.set(returnContext.MODULE_EDITOR_RETURN_PAGE_FORM_FIELD, '1'); contextualForm.set(returnContext.MODULE_EDITOR_TAB_FORM_FIELD, 'pages');
  const returned = new URL(returnContext.withModuleEditorReturnContextFromForm('/?fixture=breadcrumb%3A3&failure=0&saved=1', contextualForm), 'http://fixture.invalid');
  for (const [key, value] of Object.entries({ fixture: 'breadcrumb:3', failure: '0', saved: '1', returnPageId: '1', tab: 'pages' })) assert.equal(returned.searchParams.get(key), value, `Canonical fixture redirect retains ${key}`);
  assert.equal(before.state.writes, 0); assert.equal(after.state.writes, 0); assert.equal(before.state.actorCalls, 0); assert.equal(after.state.actorCalls, 0);
  const hashes = async harness => Promise.all([...harness.files].sort().map(async file => ({ file, sha256: createHash('sha256').update(harness === before ? sourceOverrides.get(file) ?? await readFile(path.join(fixtureRoot, file), 'utf8') : await readFile(path.join(fixtureRoot, file), 'utf8')).digest('hex') })));
  const result = { evidenceScope: 'technical native SSR and actual canonical builders; own-input disabled attributes only, no inherited-fieldset/visibility transitions or Browser/visual/auth/DB/public proof', cases: evidence, redirectContext: { canonicalOwner: 'withModuleEditorReturnContextFromForm', saved: true, fixture: true, failure: true, returnPage: true, activeTab: true }, negativeCases: ['breadcrumb linked item without label', 'featured manual selection empty', 'featured item limit outside contract', 'invalid page identity'], sourceIdentity: { before: await hashes(before), after: await hashes(after) }, writes: 0 };
  const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(outputDirectory, { recursive: true }); await writeFile(path.join(outputDirectory, 'family-native-proof.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`PASS Premium family: ${evidence.length} actual-client native/save/reload cases, 4 negative cases, zero domain writes; ${path.join(outputDirectory, 'family-native-proof.json')}`);
}

function readPremiumFixtureNativeControls(html, { preserveOrder = false, observeAncestors = false } = {}) {
  const decode = value => value.replace(/&(?:amp|lt|gt|quot|#x27|#39|#x([0-9a-f]+)|#([0-9]+));/gi, (match, hex, decimal) => hex ? String.fromCodePoint(parseInt(hex, 16)) : decimal ? String.fromCodePoint(Number(decimal)) : ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" }[match.toLowerCase()] ?? match));
  const ancestorStates = new Map();
  if (observeAncestors) {
    const stack = [], voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const token of html.matchAll(/<(\/?)([a-z][a-z0-9:-]*)\b([^>]*)>/gi)) {
      const tag = token[2].toLowerCase();
      if (token[1]) { const index = stack.findLastIndex(entry => entry.tag === tag); if (index >= 0) stack.splice(index); continue; }
      const attributes = Object.fromEntries([...token[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key.toLowerCase(), decode(value ?? '')]));
      if (['input', 'textarea', 'select'].includes(tag)) {
        const inheritedDisabled = stack.some(entry => entry.tag === 'fieldset' && 'disabled' in entry.attributes && !stack.some(legend => legend.exemptFieldset === entry));
        const ancestorHtmlHidden = stack.some(entry => 'hidden' in entry.attributes || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(entry.attributes.style ?? ''));
        ancestorStates.set(token.index, { inheritedDisabled, ancestorHtmlHidden });
      }
      if (!voidTags.has(tag) && !/\/\s*$/.test(token[3])) {
        const parent = stack.at(-1), entry = { tag, attributes };
        if (tag === 'legend' && parent?.tag === 'fieldset' && !parent.firstLegendSeen) { parent.firstLegendSeen = true; entry.exemptFieldset = parent; }
        stack.push(entry);
      }
    }
  }
  function nativeControls(html) {
    const fields = [];
    for (const tag of html.matchAll(/<(input|textarea|select)\b([^>]*)(?:>([\s\S]*?)<\/\1>|\/?>)/gi)) {
      const attributes = Object.fromEntries([...tag[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, decode(value ?? '')]));
      if (!attributes.name || ['config_schema', 'include_story_cta'].includes(attributes.name)) continue;
      const type = attributes.type || tag[1].toLowerCase();
      let value = tag[1].toLowerCase() === 'textarea' ? decode(tag[3] ?? '') : attributes.value ?? '';
      if (tag[1].toLowerCase() === 'select') {
        const options = [...(tag[3] ?? '').matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(option => {
          const attrs = Object.fromEntries([...option[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, item]) => [key, decode(item ?? '')]));
          return { value: attrs.value ?? decode(option[2]), selected: 'selected' in attrs };
        });
        value = (options.find(option => option.selected) ?? options[0])?.value ?? '';
      }
      const inherited = ancestorStates.get(tag.index) ?? { inheritedDisabled: false, ancestorHtmlHidden: false };
      fields.push({ name: attributes.name, type, disabled: 'disabled' in attributes || inherited.inheritedDisabled, checked: 'checked' in attributes, value, ...(observeAncestors ? inherited : {}) });
    }
    return preserveOrder ? fields : fields.sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
  }
  return nativeControls(html);
}

/** Real React SSR native controls and canonical-parser parity; never Browser proof. */
async function verifyContentPremiumNativeFields({ fixtureRoot, fixtureRequire, rows, registry, owners, createRemainingContentOwnerHarness, outputDirectory, focused, legacyFooter }) {
  const React = fixtureRequire('react');
  const { renderToStaticMarkup } = fixtureRequire('react-dom/server');
  const { execFileSync } = await import('node:child_process');
  const { isDeepStrictEqual } = await import('node:util');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const baselineArgument = process.argv.find(argument => argument.startsWith('--baseline-file='));
  assert.ok(baselineArgument, 'Explicit captured baseline file is required');
  const captured = JSON.parse(await readFile(baselineArgument.slice(16), 'utf8'));
  assert.ok(Array.isArray(captured));
  const baselineSources = new Map(captured.map(row => [row.path.replaceAll('\\', '/'), Buffer.from(row.content, 'base64').toString('utf8')]));
  const specs = [
    [25, 'AboutIntroModuleEditor', ['text', 'images', 'cta'], { editorMode: 'home-story' }],
    [115, 'AboutIntroSingleImageModuleEditor', ['text', 'images', 'cards'], {}],
    [174, 'TopicsListingModuleEditor', ['configuration', 'display'], { categoryOptions: [{ id: 1, slug: 'proof-category', name: 'Proof category', parentId: null, depth: 0 }] }],
    [17, 'VisionGoalsModuleEditor', ['text', 'images', 'vision', 'goals'], {}],
    [3, 'GenericContentModuleEditor', null, {}],
    [102, 'GenericContentModuleEditor', null, {}],
    [4, 'AboutApproachModuleEditor', null, {}],
    [101, 'AboutIntroModuleEditor', ['text', 'images', 'cards'], { editorMode: 'about-intro', presentation: 'premium', descriptionToolbar: 'full' }],
    [28, 'HomeProjectsPlacementEditor', ['text', 'projects', 'cta'], {}],
    [78, 'GenericContentModuleEditor', null, {}],
  ].filter(([id]) => rows.has(id));
  if (focused) {
    const consumerFiles = new Set(specs.map(([, name]) => `src/components/admin/page-blocks/editors/${name}.tsx`));
    for (const file of baselineSources.keys()) if (!consumerFiles.has(file)) baselineSources.delete(file);
  }
  for (const [, name] of specs) {
    const file = `src/components/admin/page-blocks/editors/${name}.tsx`;
    if (!baselineSources.has(file)) baselineSources.set(file, execFileSync('git', ['show', `HEAD:${file}`], { cwd: fixtureRoot, encoding: 'utf8', windowsHide: true, maxBuffer: 2000000 }));
  }
  const noAction = async () => { throw Error('Unexpected static fixture transport'); };
  const additionalPorts = new Map([
    ['next/navigation', { useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch: async () => {} }), usePathname: () => '/admin/pages-blocks/blocks/content/115', useSearchParams: () => new URLSearchParams(), redirect: noAction }],
    ['next/link', { __esModule: true, default: ({ href, children, ...props }) => { delete props.prefetch; return React.createElement('a', { ...props, href }, children); } }],
    ['next/image', { __esModule: true, default: input => { const props = { ...input }; for (const key of ['fill', 'priority', 'unoptimized', 'quality', 'loader']) delete props[key]; return React.createElement('img', props); } }],
    ['src/lib/admin/links/actions', { browseAdminLinksAjax: noAction, resolveAdminLinkAjax: noAction, browseTopicCategoriesPickerAjax: noAction, browseMenusPickerAjax: noAction, browseMenuItemsPickerAjax: noAction }],
  ]);
  const before = createRemainingContentOwnerHarness(fixtureRoot, { sourceOverrides: baselineSources, additionalPorts });
  const after = createRemainingContentOwnerHarness(fixtureRoot, { additionalPorts });
  const nativeControls = readPremiumFixtureNativeControls;
  const render = (harness, name, config, props) => renderToStaticMarkup(React.createElement(harness.load(path.join(fixtureRoot, `src/components/admin/page-blocks/editors/${name}.tsx`)).default, { config, ...props }));
  const dataFor = (controls, key) => {
    const data = new FormData();
    for (const field of controls) if (!field.disabled && (!['checkbox', 'radio'].includes(field.type) || field.checked)) data.append(field.name, field.value);
    data.set('config_schema', key === 'home-story' ? 'about-intro' : key);
    if (key === 'home-story') data.set('include_story_cta', '1');
    return data;
  };
  const evidence = [];
  for (const [id, name, sections, props] of specs) {
    const row = rows.get(id), key = registry.getContentModuleEditorKey(row.block.slug, row.block.variant ?? '');
    if (id === 25 || id === 28) assert.equal(key, id === 25 ? 'home-story' : 'home-projects', `${id}: canonical editor identity must not fall through to generic`);
    const cases = [
      ['populated', row.config],
      ['legacy-hidden', { ...row.config, showTitle: false, showEyebrow: false, showDescription: false, showIntro: false, titleAlignment: 'left', descriptionAlignment: 'center' }],
      ['empty', {}],
      ...(id === 28 && focused ? [
        ['cta-legacy-href', { ...row.config, showFooterCta: true, footerCta: { label: '', href: 'https://legacy.example.test/projects#legacy-anchor', target: '_blank', alignment: 'left' } }],
        ['cta-inactive-structured', { ...row.config, showFooterCta: false, footerCta: structuredClone(legacyFooter) }],
        ['cta-empty-label-active', { ...row.config, showFooterCta: true, footerCta: { ...structuredClone(legacyFooter), target: '_blank' } }],
        ['cta-empty-label-inactive', { ...row.config, showFooterCta: false, footerCta: { ...structuredClone(legacyFooter), target: '_blank' } }],
        ['cta-empty-without-link', { ...row.config, showFooterCta: false, footerCta: { label: '', href: '', target: '_blank', alignment: 'left' } }],
        ['cta-nondefault-open-alignment', { ...row.config, showFooterCta: true, footerCta: { ...structuredClone(legacyFooter), label: 'زر معزول', target: '_blank', alignment: 'left', link: { ...legacyFooter.link, target: '_self' } } }],
      ] : []),
    ];
    for (const [variant, input] of cases) {
      const config = registry.resolveContentModuleEditorConfig({ ...row.block, config: input });
      const original = nativeControls(render(before, name, config, props));
      const whole = nativeControls(render(after, name, config, props));
      assert.deepEqual(whole, original, `${id} ${variant}: every native field, initial value and enabled state is preserved`);
      const composed = sections ? nativeControls(sections.map(section => render(after, name, config, { ...props, section })).join('')) : whole;
      assert.deepEqual(composed, whole, `${id} ${variant}: split sections keep every native field exactly once`);
      if (name === 'GenericContentModuleEditor') assert.deepEqual(nativeControls(render(after, name, config, { ...props, presentation: 'premium' })), whole, `${id} ${variant}: default and premium have identical native controls`);
      const expected = await before.content.buildContentConfig(dataFor(original, key), row.block.slug, input);
      const saved = await owners.content.buildContentConfig(dataFor(composed, key), row.block.slug, input);
      assert.deepEqual(saved, expected, `${id} ${variant}: unchanged canonical save payload`);
      if (id === 25) assert.ok(saved.button, `${id} ${variant}: exercise the actual Story CTA parser`);
      if (id === 28) {
        assert.ok('showFooterCta' in saved && 'projectsLimit' in saved, `${id} ${variant}: exercise the actual Home Projects parser`);
        if (variant !== 'empty' && variant !== 'cta-empty-without-link') assert.ok(saved.footerCta, `${id} ${variant}: retained CTA content must be present`);
      }
      if (id === 28 && variant.startsWith('cta-')) {
        assert.equal(saved.showFooterCta, input.showFooterCta, `${variant}: CTA visibility is preserved`);
        assert.deepEqual(saved.footerCta, expected.footerCta, `${variant}: inactive fields retain canonical baseline semantics`);
        if (variant !== 'cta-empty-without-link') {
          assert.equal(saved.footerCta.target, config.footerCta.target, `${variant}: explicit opening target takes precedence over link target`);
          assert.equal(saved.footerCta.alignment, config.footerCta.alignment, `${variant}: nondefault alignment is preserved`);
          assert.equal(saved.footerCta.link.anchor, expected.footerCta.link.anchor, `${variant}: hidden anchor retains canonical baseline value`);
        }
        for (const field of ['eyebrow', 'title', 'intro', 'projectsLimit', 'cardCtaLabel', 'cardCtaAlignment', 'showProjectLocation']) assert.deepEqual(saved[field], expected[field], `${variant}: unrelated ${field} is preserved`);
      }
      const readBack = registry.resolveContentModuleEditorConfig({ ...row.block, config: JSON.parse(JSON.stringify(saved)) });
      const reloadedFields = nativeControls(render(after, name, readBack, props));
      const secondSave = await owners.content.buildContentConfig(dataFor(reloadedFields, key), row.block.slug, saved);
      const originalReloadedFields = nativeControls(render(before, name, readBack, props));
      const originalSecondSave = await before.content.buildContentConfig(dataFor(originalReloadedFields, key), row.block.slug, expected);
      assert.deepEqual(secondSave, originalSecondSave, `${id} ${variant}: canonical save/reload/save behavior is preserved`);
      evidence.push({ id, editor: name, variant, nativeFieldCount: original.length, fields: original.map(field => field.name), fieldParity: true, splitParity: true, canonicalSaveParity: true, saveReloadParity: true, unchangedLegacyNormalization: !isDeepStrictEqual(secondSave, saved) });
      console.log(`PASS Content ${id} ${variant}: ${original.length} native fields, split/default parity, canonical save/reload`);
    }
  }
  const negativeCases = [];
  if (rows.has(174)) {
    const listing = new FormData(); listing.set('config_schema', 'topics-listing'); listing.set('collection', 'category:proof-category'); listing.set('presentation', 'list'); listing.set('items_per_row', '3'); listing.set('item_limit', '9'); listing.set('details_text', 'اقرأ المزيد');
    assert.deepEqual((await owners.content.buildContentConfig(listing, 'topics-listing')).collection, { type: 'category', categorySlug: 'proof-category' });
    listing.set('collection', 'category:unavailable'); await assert.rejects(() => owners.content.buildContentConfig(listing, 'topics-listing'), /غير متاح/u); negativeCases.push('invalid category');
  }
  if (rows.has(17)) { const invalidRich = new FormData(); invalidRich.set('config_schema', 'vision-goals'); invalidRich.set('intro_content_format', 'html'); await assert.rejects(() => owners.content.buildContentConfig(invalidRich, 'vision-goals'), /غير مدعومة/u); negativeCases.push('unsupported rich text format'); }
  assert.equal(owners.state.writes, 0); assert.equal(before.state.writes, 0); assert.equal(after.state.writes, 0);
  const output = outputDirectory; await mkdir(output, { recursive: true });
  const sourceHashes = [];
  for (const file of [...new Set([...before.files, ...after.files])].sort()) { const current = await readFile(path.join(fixtureRoot, file)); sourceHashes.push({ file, before: createHash('sha256').update(baselineSources.get(file) ?? current).digest('hex'), after: createHash('sha256').update(current).digest('hex') }); }
  await writeFile(path.join(output, 'native-field-parity.json'), JSON.stringify({ status: 'PASS', cases: evidence, negativeCases, sourceHashes, boundary: 'Real React SSR editor controls and canonical parsers. Captured original source plus HEAD fallback for previously clean editors; current shared controls retained. No effects, browser behavior, authenticated session, live DB/storage or public-page proof.' }, null, 2) + '\n');
  console.log(`PASS Content native preservation: ${evidence.length} cases, ${rows.size} records, ${new Set(specs.map(([, name]) => name)).size} actual editor families; zero DB writes.`);
}
