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
if (process.argv.includes('--cinematic-admin-only') || process.argv.includes('--cinematic-datagrid-only') || process.argv.includes('--cinematic-datagrid-v11-only') || process.argv.includes('--cinematic-final-alignment-only') || process.argv.includes('--cinematic-sidebar-selection-only') || process.argv.includes('--cinematic-systemwide-adoption-only') || process.argv.includes('--cinematic-kpi-adoption-only') || process.argv.includes('--cinematic-module-title-shimmer-only') || process.argv.includes('--cinematic-module-title-shimmer-before')) {
  const { verifyCinematicAdminPresentation } = await import('./fixtures/cinematic-admin-browser.mjs');
  await verifyCinematicAdminPresentation();
  // The established CI entry retains its original suite and reaches the new
  // bounded delta. Explicit historical/delta selectors still run only their scope.
  if (process.argv.includes('--cinematic-admin-only') && process.argv.filter(value => value.startsWith('--cinematic-')).every(value => value === '--cinematic-admin-only')) {
    await verifyCinematicAdminPresentation({ sidebarSelectionOnly: true });
    await verifyCinematicAdminPresentation({ systemwideAdoptionOnly: true });
    await verifyCinematicAdminPresentation({ kpiAdoptionOnly: true });
    await verifyCinematicAdminPresentation({ moduleTitleShimmerOnly: true });
  }
  process.exit(0);
}
// Bounded Content-tab regression: real Topic consumers and local browser memory.
// Slug QA captures its targeted visual evidence; no path writes hosted data.
if (process.argv.includes('--topic-content-only') || process.argv.includes('--topic-review-only') || process.argv.includes('--topic-seo-only') || process.argv.includes('--video-panel-only') || process.argv.includes('--media-tabs-only') || process.argv.includes('--slug-audit-only') || process.argv.includes('--slug-system-only') || process.argv.includes('--full-form-draft-only') || process.argv.includes('--content-panel-gallery-only') || process.argv.includes('--draft-notice-only') || process.argv.includes('--unified-image-only')) {
  await verifyTopicContentPresentation();
  process.exit(0);
}
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
window.mount=(mode='editor',config=window.initialConfig)=>{const galleryDefaults=config.items||[],update={media:(config.paths||[]).map(public_url=>({public_url,media_kind:'image'}))};const AboutIntroModuleEditor=Editor,AboutPrinciplesModuleEditor=PrinciplesEditor,AboutCtaModuleEditor=ContactEditor,homeContactConfig=config,block={name:window.initialName},assignmentContext=window.assignmentContext,pagesTab={id:"pages",content:<ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext}/>};window.ready=false;root.render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)} key={++generation}><AppRouterContext.Provider value={router}><PathnameContext.Provider value={mode==="hero-family"?"/admin/pages-blocks/blocks/hero/"+config.block.id:mode==="search-family"?"/admin/pages-blocks/blocks/content/"+config.block.id:mode==="search-public"?config.path:mode==="featured"?"/admin/pages-blocks/blocks/featured/2":mode==="media-hub"?"/admin/pages-blocks/blocks/media-hub/11":mode==="media-sidebar"?"/admin/pages-blocks/blocks/media-sidebar/"+config.id:mode==="feed-family"?"/admin/pages-blocks/blocks/feed/"+config.block.id:mode==="cards-family"?"/admin/pages-blocks/blocks/cards/"+config.block.id:mode==="cta-family"?"/admin/pages-blocks/blocks/cta/"+config.block.id:mode.startsWith("contact")?"/admin/pages-blocks/blocks/content/27":mode.startsWith("trust")?"/admin/pages-blocks/blocks/content/26":"/admin/pages-blocks/blocks/content/25"}><Feedback><Ready/>{mode==="hero-family"?<HeroFamilyEditor hero={config.block} config={config.config} imagesText={Array.isArray(config.config.images)?config.config.images.join('\\n'):''} mobileImagesText={Array.isArray(config.config.mobileImages??config.config.mobile_images)?(config.config.mobileImages??config.config.mobile_images).join('\\n'):''} variantOptions={HERO_TEMPLATE_VARIANT_OPTIONS_AR} assignmentContext={assignmentContext} initialTabId={new URLSearchParams(location.search).get('tab')||undefined}/>:mode==="hero-public"?(config.block.variant==="project-detail"?<ProjectHeroPublic project={${JSON.stringify(heroFixtureProject)}} presentation={heroConfigForPublic({...config.block,config:config.config})}/>:<HeroPublic hero={{...config.block,config:config.config}} domainSlides={config.domainSlides}/>):mode==="search-family"?<SearchFamilyEditor block={config.block} config={config.config} assignmentContext={assignmentContext} projectDetailHeroEditorLinks={null} topicCategoryOptions={[]} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="search-public"?window.searchPublicElement:mode==="feed-public"?<div className="@container/slot-module"><FeedSection module={config}/></div>:mode==="feed-family"?<FeedFamilyEditor block={config.block} config={config.config} filterOptions={window.feedFilterOptions} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="cards-public"?<div className="@container/slot-module">{config.renderer==="about"?<AboutPrinciplesPublic cmsContent={mapLegacyPrinciplesCardsBlock({template:{config:config.value}})}/>:config.renderer==="trust"?<ContactTrustPublic cmsCards={mapContactTrustCardsBlock({template:{config:config.value}})}/>:config.renderer==="reasons"?<ContactReasonsPublic cmsContent={mapContactReasonsBlock({template:{config:config.value}})}/>:config.renderer==="departments"?<ContactDepartmentsPublic cmsContent={mapContactDepartmentsBlock({template:{config:config.value}})}/>:config.renderer==="faq"?<ContactFaqPublic cmsContent={mapContactFaqBlock({template:{config:config.value}})}/>:<GenericCards block={{template:{config:config.value,variant:"glass"}}}/>}</div>:mode==="cards-family"?<CardsFamilyEditor block={config.block} config={config.config} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="cta-public"?<div className="@container/slot-module">{config.renderer==="generic"?<GenericCtaSection block={{template:{config:config.value,variant:"band"}}}/>:config.renderer==="about"?<AboutCtaPublic cmsContent={mapLegacyProjectsCtaBlock({template:{config:config.value}})}/>:config.renderer==="about-default"?<AboutCtaPublic cmsContent={mapAboutCtaBlock({template:{config:config.value}})}/>:config.renderer==="topics"?<TopicsCtaPublic cmsContent={mapTopicsInsightCtaBlock({template:{config:config.value}})}/>:config.renderer==="topics-default"?<TopicsCtaPublic/>:<ContactCtaPublic cmsContent={mapContactCtaBlock({template:{config:config.value}})}/>}</div>:mode==="featured-public"?<div className="@container/slot-module"><FeaturedSection module={config}/></div>:mode==="featured"?<FeaturedEditor block={config.block} config={config.config} editorOptions={config.editorOptions} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="cta-family"?<CtaFamilyEditor block={config.block} config={config.config} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="media-sidebar"?<MediaSidebarEditor block={config} categories={[{slug:"fixtures",name:"تصنيف تجريبي",depth:0},{slug:"fixtures-child",name:"تصنيف فرعي",depth:1}]} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==="media-hub"?<MediaHubEditor block={config} assignmentContext={assignmentContext} updateAction={async data=>{await window.persist([...data]);window.saved=true;}}/>:mode==='contact-public'?<div className="@container/slot-module"><ContactSection content={mapHomeContactBlock({template:{config}})}/></div>:mode==='trust-public'?<div className="@container/slot-module"><TrustSection content={mapHomeTrustBlock({template:{config}})}/></div>:mode==='about-public'?<div className="@container/slot-module"><AboutSection cmsIntro={mapAboutIntroBlock({template:{config}})} cmsBeats={mapAboutIntroBeatsFromBlock({template:{config}})}/></div>:mode==='rich-default'?<RichTextContent value={config.body} mode="rich"/>:mode==='public'?<div className="@container/slot-module"><Section content={mapHomeStoryBlock({template:{config}})}/></div>:<><ModuleEditorHeader moduleKind="content" moduleSlug={mode.startsWith('contact')?'home-contact':mode==='about-cta-default'?'about-cta':mode.startsWith('trust')?'home-trust':mode.startsWith('about')?'about-intro':'home-story'} entityName={window.initialName}/><form dir="rtl" onSubmit={async e=>{e.preventDefault();const data=[...new FormData(e.currentTarget)];const result=mode.startsWith("display-default")?await window.persistDisplay(data,mode):await window.persist(data);window.saved=true;window.mount(mode.startsWith("display-default")||mode==='about-premium'||mode==='trust-premium'||mode==='contact-premium'||mode==='about-cta-default'?mode:'editor',result);}}>{mode==="hero-media-card-reference"?<Media name="media_reference" label="صورة مرجعية" defaultValue="/one.svg" altName="media_reference_alt" defaultAlt="وصف مرجعي محفوظ" focusTargetId="media-reference-replace" variant="card" showGuidance={false}/>:mode==="hero-gallery-bare"?<AdminMediaGalleryField name="bare_gallery" label="صور اختبار المظهر المجرد" defaultPaths={["/one.svg","/two.svg"]} actionPresentation="bare" density="compact" showGuidance={false}/>:mode==="hero-gallery-items"?${galleryItemsCall}:mode==="hero-gallery-paths"?${galleryPathsCall}:mode==="hero-default-hub"?<ProjectsHubHeroEditor config={asProjectsHubHeroConfig({})}/>:mode==="hero-default-cta"?<HeroDefaultCta linkSource="project-domain" primaryLabel="فتح المشروع"/>:mode==="hero-default-order"?<HeroDefaultOrder/>:mode==="feed-switch-default"?<><TopicFormSwitch name="default_compact" label="افتراضي مدمج" defaultChecked={config.checked}/><TopicFormSwitch name="default_surface" label="افتراضي بطاقة" defaultChecked={config.checked} surface/><TopicFormSwitch name="default_disabled" label="افتراضي معطل" defaultChecked={config.checked} disabled/></>:mode==="cards-create-default"?<CardsItems items={config.items||[]} minItems={1}/>:mode.startsWith("display-default")?<><ContentDisplaySettings showTitle={config.title} showImage={config.image} showCategory={config.category} showSeries={config.series} showExcerpt={config.excerpt} showDate={config.date} showIntroCard={config.introCard}><input name="fixture_child" aria-label="حقل تابع" defaultValue="قيمة محفوظة"/></ContentDisplaySettings><ModuleEditorSaveArea/></>:mode==="topics-default"?<TopicsEditor config={config} categoryOptions={[]}/>:mode==='contact-premium'||mode==='about-cta-default'?<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-cta"/><ModuleEditorTabs moduleKind="content" moduleSlug={mode==='contact-premium'?'home-contact':'about-cta'} nowrap tabs={mode==='contact-premium'?${contactTabExpression}:${aboutCtaTabExpression}}/><ModuleEditorSaveArea/></>:mode==='trust-premium'?<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-principles"/><ModuleEditorTabs moduleKind="content" moduleSlug="home-trust" nowrap tabs={${trustTabExpression}}/><ModuleEditorSaveArea/></>:mode==='about-premium'?<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-intro"/><ModuleEditorTabs moduleKind="content" moduleSlug="about-intro" nowrap tabs={${aboutTabExpression}}/><ModuleEditorSaveArea/></>:mode==='trust-grid'||mode==='principles-grid'?<PrinciplesEditor config={config} editorMode={mode==='trust-grid'?'home-trust':'about-principles'}/>:mode==='grid-contract'?<AdminFormGrid columns={config.columns} presentation={config.presentation}>{Array.from({length:12},(_,i)=><input key={i} aria-label={'حقل '+i} defaultValue={'بطاقة '+i}/>)}</AdminFormGrid>:mode==='metadata-tabs'?<ModuleEditorTabs moduleKind={config.kind} moduleSlug={config.slug} tabs={config.ids.map(id=>({id,content:<p>محتوى {id}</p>}))}/>:mode==='vision-default'?<VisionEditor config={{eyebrow:'رؤيتنا',title:'عنوان محفوظ',intro:['نص قديم محفوظ'],image:'/one.svg',vision:{title:'رؤيتنا',items:[{title:'الثقة',text:'نص الرؤية'}]},goals:{title:'أهدافنا',items:[{title:'الجودة',text:'نص الهدف'}]}}}/>:mode==='default-repeater'?<ModuleEditorRepeaterGrid>{[1,2,3].map(i=><ModuleEditorRepeaterCard key={i} title={'بطاقة '+i} actions={<button type="button">إجراء {i}</button>}><input aria-label={'حقل '+i} defaultValue="محفوظ"/></ModuleEditorRepeaterCard>)}</ModuleEditorRepeaterGrid>:mode==='default-pages'||mode==='empty-pages'?<ModuleEditorPagesTab moduleName="قصة فينيسيا" assignmentContext={mode==='empty-pages'?{pages:[],assignments:[]}:window.assignmentContext}/>:mode==='default-tabs'?<AdminModuleTabs tabs={[{id:'default',navigationLabel:'افتراضي',sectionHeading:'عنوان افتراضي',sectionDescription:'وصف افتراضي',icon:'media',sectionSummary:<button type="button">إجراء افتراضي</button>,content:null}]}/>:mode==='default-link'?<><LinkField prefix="button" label="رابط الزر" defaultValue={config.button.link} showAnchor/><button type="button" className={adminChoiceButtonClassName(false)}>اختيار افتراضي</button><button type="button" disabled className={adminChoiceButtonClassName(true,"","compact")}>اختيار معطل</button></>:mode==='default-media'||mode==='compact-media'?<Media name="test_image" label="صورة افتراضية" defaultValue="/one.svg" altName="test_alt" defaultAlt="وصف ثابت" variant={mode==='compact-media'?'compact':'default'} showGuidance={false}/>:mode==='about'?<Editor config={config}/>:<><ModuleEditorIdentitySection name={window.initialName} status="published"/><input type="hidden" name="config_schema" value="about-intro"/><input type="hidden" name="include_story_cta" value="1"/><ModuleEditorTabs moduleKind="content" moduleSlug="home-story" nowrap tabs={['text','images','cta','pages'].map(id=>({id,sectionHeaderPresentation:${JSON.stringify(headerPresentations)}[id],content:id==='pages'?<ModuleEditorPagesTab moduleName="قصة فينيسيا" assignmentContext={window.assignmentContext}/>:<Editor config={config} editorMode="home-story" section={id}/>}))}/><ModuleEditorSaveArea/></>}</form></>}</Feedback></PathnameContext.Provider></AppRouterContext.Provider></SearchParamsContext.Provider>)};window.mount(new URLSearchParams(location.search).get('mode')||window.fixtureDefaultMode||'editor');`;
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
      const header=page.locator('[data-admin-tab-section-heading]'),identity=header.locator('[data-admin-form-control-header][data-admin-form-control-presentation="leading-icon"]'),title=header.getByRole('heading',{level:2,name:'عنوان افتراضي',exact:true});assert.equal(await header.locator('[data-admin-form-control-header]').count(),1);assert.equal(await identity.count(),1);assert.equal(await header.locator('svg').count(),1);await expect(title).toBeVisible();
      assert.deepEqual(await title.evaluate(e=>({size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight})),{size:'14px',weight:'600'});assert.equal(await identity.locator(':scope > span').first().evaluate(e=>e.getBoundingClientRect().width),40);assert.equal(await identity.locator(':scope > span').first().evaluate(e=>e.getBoundingClientRect().height),40);assert.equal(await identity.locator('svg').evaluate(e=>e.getBoundingClientRect().width),20);assert.equal(await identity.locator('svg').evaluate(e=>e.getBoundingClientRect().height),20);assert.equal(await identity.locator(':scope > span').last().locator(':scope > span').nth(1).evaluate(e=>getComputedStyle(e).fontSize),'12px');
      await header.getByRole('button',{name:'إجراء افتراضي',exact:true}).focus();await expect(header.getByRole('button')).toBeFocused();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }console.log('Default tab section headers share the canonical leading-icon identity and preserve summary controls on Desktop/Mobile PASS');
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

async function verifyContentPanelGalleryAdoption(context) {
  const { fixtureRoot, page, browser, open, errors, forbidden, seoReads, iframeReads, panelGalleryEvidenceRoot: output, panelGallerySourceHashesAtStart: sourceHashesAtStart, readPanelGallerySourceHashes, recordPanelGallerySourceIdentity, getHarness, setHarness, setMode, savedSlugRows, slugSaveResults } = context;
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { createTopicSlugSaveHarness, createRemainingContentOwnerHarness } = await import('./fixtures/remaining-content-owner-harness.mjs');
  await mkdir(output, { recursive: true });
  const cases = [], referenceCases = [], defaultCases = [], publicCases = [], noticeCases = [], screenshots = [];
  const form = page.locator('form[data-admin-form-runtime]'), tab = id => form.locator('[data-admin-tab-id="' + id + '"]');
  const native = () => form.evaluate(form => [...new FormData(form)].filter(([name]) => !['id', 'expected_updated_at'].includes(name)).sort(([a], [b]) => a.localeCompare(b)));
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const records = () => page.evaluate(() => Object.keys(localStorage).flatMap(key => { try { const draft = JSON.parse(localStorage.getItem(key)); return draft?.version === 2 && draft.fields ? [{ key, draft }] : []; } catch { return []; } }));
  const reload = async () => { const leave = dialog => dialog.accept(); page.on('dialog', leave); try { await page.reload(); } finally { page.off('dialog', leave); } await expect(form.locator('input[name="title"]')).toBeEditable(); await settle(); };
  const cancelLeave = async () => { const dialog = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await expect(dialog).toBeVisible(); await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0); };
  const imageChoice = async (opener, asset, keyboard = false) => {
    if (keyboard) { await opener.focus(); await opener.press('Enter'); await expect(page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); }
    await opener.click(); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible();
    await picker.locator('button[aria-pressed="false"]').filter({ hasText: asset }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0);
  };
  const chooseSingle = async (name, asset) => { const owner = form.locator('[data-admin-media-image-field="' + name + '"]'), add = owner.locator('[data-admin-media-image-card="add"]'); await imageChoice(await add.count() ? add : owner.getByRole('button', { name: 'استبدال', exact: true }), asset); };
  const fresh = async mode => {
    await getHarness()?.close(); setHarness(undefined); setMode(mode); savedSlugRows.clear(); await open(mode); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await reload();
    const seed = await page.evaluate(() => window.topicFixtureSeed), type = await form.locator('[name="content_type"]').inputValue();
    setHarness(await createTopicSlugSaveHarness(fixtureRoot, { rows: mode.endsWith('edit') ? [{ ...seed, content_type: type }] : [], categories: [{ id: 17, name: 'تصنيف تجريبي', slug: 'fixture', parent_id: null, is_active: true, status: 'published', deleted_at: null }], series: [{ id: 187, name: 'سلسلة تجريبية', slug: 'fixture-series', category_id: 17, status: 'published', deleted_at: null }] }));
  };
  const shot = async (owner, type, mode, width, state) => { const file = path.join(output, `${type}-${mode}-${width}-${state}.png`); await owner.screenshot({ path: file }); screenshots.push({ type, mode, width, state, path: file }); };
  const verifyPanels = async (type, mode, width) => {
    await tab('seo').click(); const seo = form.locator('[data-admin-entity-seo-panel]'); await expect(seo).toHaveAttribute('data-admin-entity-seo-presentation', 'panel');
    for (const name of await page.evaluate(() => Object.values(window.seoFixture.names))) await expect(form.locator('[name="' + name + '"]')).toHaveCount(1);
    const seoGeometry = await seo.evaluate(root => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom }; }, social = root.querySelector('[data-admin-entity-seo-social-fields]'), grid = social.querySelector('[data-admin-form-grid]');
      return { direction: getComputedStyle(root).direction, overflow: document.documentElement.scrollWidth > innerWidth + 1, grid: grid.dataset.adminFormGrid, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, gap: parseFloat(getComputedStyle(grid).columnGap), info: box(grid.children[0]), image: box(grid.children[1]), headers: [...social.querySelectorAll('[data-admin-tab-section-heading]')].map(node => ({ title: node.querySelector('[role="heading"]').textContent.trim(), presentation: node.dataset.adminTabSectionPresentation, font: getComputedStyle(node.querySelector('[role="heading"]')).fontSize, icon: box(node.querySelector('svg')) })), labels: [...root.querySelectorAll('[data-admin-form-label-text]')].map(node => ({ text: node.textContent.trim(), inset: getComputedStyle(node).paddingInlineStart })), right: [...grid.children[0].querySelectorAll('[name]')].map(node => node.name), left: [...grid.children[1].querySelectorAll('[name]')].map(node => node.name) };
    });
    assert.equal(seoGeometry.direction, 'rtl'); assert.equal(seoGeometry.overflow, false); assert.equal(seoGeometry.grid, 'equal-height-columns'); assert.equal(seoGeometry.columns, width >= 1280 ? 12 : 1); assert.deepEqual(seoGeometry.right, ['robots_index', 'robots_follow', 'canonical_url', 'og_image_alt']); assert.deepEqual(seoGeometry.left, ['og_image']); assert.deepEqual(seoGeometry.headers.map(row => row.title), ['إعدادات المشاركة الاجتماعية (Open Graph)', 'صورة المشاركة']);
    for (const header of seoGeometry.headers) { assert.equal(header.presentation, 'premium'); assert.equal(header.font, '14px'); assert.equal(header.icon.w, 20); }
    for (const label of seoGeometry.labels) assert.equal(label.inset, '12px');
    if (width >= 1280) { assert.ok(seoGeometry.info.x > seoGeometry.image.x); assert.ok(Math.abs(seoGeometry.info.h - seoGeometry.image.h) <= 1); assert.ok(Math.abs((seoGeometry.info.w + seoGeometry.gap) / (seoGeometry.image.w + seoGeometry.gap) - 2) < 0.01); } else assert.ok(seoGeometry.image.y >= seoGeometry.info.bottom + seoGeometry.gap - 1);
    await shot(seo, type, mode, width, 'seo-panel'); await tab('publish').click();
    const visible = page.getByRole('tabpanel').filter({ visible: true }), review = visible.locator('[data-admin-entity-review="content"]'); await expect(review).toHaveAttribute('data-admin-entity-review-presentation', 'panel');
    const reviewGeometry = await visible.evaluate(root => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, headers = [...root.querySelectorAll('[data-admin-tab-section-heading]')], summary = root.querySelector('[data-admin-entity-review-status-summary]');
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, headers: headers.map(node => ({ id: node.dataset.adminTabSectionHeading, presentation: node.dataset.adminTabSectionPresentation, font: getComputedStyle(node.querySelector('[role="heading"]')).fontSize, icon: box(node.querySelector('svg')) })), summary: [...summary.querySelectorAll('ol > li')].map(node => ({ title: node.firstElementChild.textContent.trim(), ...box(node) })), decisions: [...root.querySelectorAll('[data-admin-entity-review-decision]')].map(node => ({ id: node.dataset.adminEntityReviewDecision, ...box(node) })), guidance: [...root.querySelectorAll('[data-admin-entity-review-analysis-tier="guidance"]')].map(node => node.dataset.adminEntityReviewAnalysis) };
    });
    assert.equal(reviewGeometry.overflow, false); assert.equal(reviewGeometry.headers.length, 12); assert.equal(new Set(reviewGeometry.headers.map(row => row.id)).size, 12); assert.deepEqual(reviewGeometry.decisions.map(row => row.id), ['score', 'publication-schedule', 'featured-popular', 'display-settings']); assert.deepEqual(reviewGeometry.guidance, ['content', 'image', 'seo']); assert.deepEqual(reviewGeometry.summary.map(row => row.title), ['آخر حفظ', 'حالة النشر الحالية', 'تاريخ النشر']);
    for (const header of reviewGeometry.headers) { assert.equal(header.presentation, 'premium'); assert.equal(header.font, '14px'); assert.equal(header.icon.w, 20); }
    for (const rows of [reviewGeometry.summary, reviewGeometry.decisions]) for (let index = 1; index < rows.length; index++) { if (width >= 1280) { assert.ok(Math.abs(rows[index].y - rows[0].y) <= 1); assert.ok(rows[index - 1].x > rows[index].x); } else assert.ok(rows[index].y >= rows[index - 1].y + rows[index - 1].h - 1); }
    for (const id of ['content', 'image', 'seo', 'validation']) { const analysis = review.locator('[data-admin-entity-review-analysis="' + id + '"]'); await analysis.getByRole('button', { name: 'عرض التفاصيل', exact: true }).click(); await expect(analysis).toHaveAttribute('data-admin-entity-review-expanded', 'true'); await analysis.getByRole('button', { name: 'إخفاء التفاصيل', exact: true }).click(); await expect(analysis).toHaveAttribute('data-admin-entity-review-expanded', 'false'); }
    const before = await native(); for (const name of ['content_publication_toggle', 'is_featured', 'is_popular']) { const control = form.locator('[name="' + name + '"]'), checked = await control.isChecked(); await control.focus(); await control.press('Space'); await expect(control).toBeChecked({ checked: !checked }); await control.press('Space'); await expect(control).toBeChecked({ checked }); } assert.deepEqual(await native(), before);
    await review.getByRole('button', { name: 'تعديل الإعدادات', exact: true }).click(); await expect(tab('display')).toHaveAttribute('aria-selected', 'true'); await expect(form.locator('[name="show_title_on_page"]')).toBeFocused(); await expect(form.locator('[data-content-display-settings] [data-admin-form-switch-surface="premium-inline"]')).toHaveCount(7); await tab('publish').click(); await shot(visible, type, mode, width, 'review-publish-panel');
    return { seo: seoGeometry, review: reviewGeometry, actualSharedRoots: true, publishingKeyboardAndDisplayNavigation: true };
  };
  const galleryNative = () => form.evaluate(form => { const data = new FormData(form), urls = data.getAll('gallery_image_url'); return urls.map((url, index) => ({ url, alt: data.getAll('gallery_image_alt')[index], caption: data.getAll('gallery_image_caption')[index] })); });
  const exerciseGallery = async (mode, width) => {
    await tab('gallery').click(); const gallery = form.locator('[data-admin-media-gallery-mode="items"]'), cards = gallery.locator('[data-admin-media-gallery-card="image"]'), add = gallery.locator('[data-admin-media-gallery-card="add"]'); await expect(gallery).toHaveAttribute('data-admin-media-gallery-presentation', 'panel'); await expect(gallery).toHaveAttribute('data-admin-media-gallery-drag-drop', 'html5');
    if (mode === 'create') { await imageChoice(add, 'SEO fixture original', true); await imageChoice(add, 'SEO fixture replacement'); } await imageChoice(add, 'SEO fixture absent dimensions'); await imageChoice(add, 'SEO fixture fourth'); await expect(cards).toHaveCount(4);
    for (let index = 0; index < 4; index++) { await cards.nth(index).locator('[name="gallery_image_alt"]').fill('Alt ' + index); await cards.nth(index).locator('[name="gallery_image_caption"]').fill('Caption ' + index); }
    const original = await galleryNative(); await expect(cards.first().locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled(); await expect(cards.last().locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
    if (width === 390) await cards.first().locator('[data-admin-media-gallery-action="move-down"]').tap(); else await cards.first().locator('[data-admin-media-gallery-action="move-down"]').click(); assert.deepEqual(await galleryNative(), [original[1], original[0], ...original.slice(2)]); if (width === 390) await cards.nth(1).locator('[data-admin-media-gallery-action="move-up"]').tap(); else await cards.nth(1).locator('[data-admin-media-gallery-action="move-up"]').click(); assert.deepEqual(await galleryNative(), original);
    const handle = index => cards.nth(index).locator('[data-admin-grid-reorder-handle]');
    await handle(0).focus(); await handle(0).press('ArrowUp'); await handle(0).press('Home'); assert.deepEqual(await galleryNative(), original);
    await handle(0).press('End'); assert.deepEqual(await galleryNative(), [...original.slice(1), original[0]]); await handle(3).press('ArrowDown'); assert.deepEqual(await galleryNative(), [...original.slice(1), original[0]]); await handle(3).press('Home'); assert.deepEqual(await galleryNative(), original);
    await handle(0).press('ArrowDown'); assert.deepEqual(await galleryNative(), [original[1], original[0], ...original.slice(2)]); await handle(1).press('ArrowUp'); assert.deepEqual(await galleryNative(), original);
    if (width >= 1280) {
    await page.evaluate(() => { window.galleryDragTrace = []; for (const type of ['dragstart', 'dragenter', 'dragover', 'drop', 'dragend']) document.addEventListener(type, event => { const target = event.target instanceof Element ? event.target : null, row = target?.closest('[data-admin-media-gallery-card="image"]'); const record = { type, trusted: event.isTrusted, target: target?.tagName, targetName: target?.getAttribute('name'), row: row?.getAttribute('data-admin-media-gallery-index'), clientX: event.clientX, clientY: event.clientY, scrollY, dragging: [...document.querySelectorAll('[data-gallery-item-dragging]')].map(node => node.getAttribute('data-admin-media-gallery-index')), defaultPrevented: event.defaultPrevented }; window.galleryDragTrace.push(record); queueMicrotask(() => { record.defaultPrevented = event.defaultPrevented; }); }, true); });
    const dragGeometry = await gallery.evaluate(root => { const box = node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { x: r.x, y: r.y, width: r.width, height: r.height, centerHit: hit?.tagName, centerHitName: hit?.getAttribute('name'), centerHitRow: hit?.closest('[data-admin-media-gallery-card]')?.getAttribute('data-admin-media-gallery-index') }; }; return { scrollY, viewport: { width: innerWidth, height: innerHeight }, cards: [...root.querySelectorAll('[data-admin-media-gallery-card="image"]')].map(node => ({ card: box(node), handle: box(node.querySelector('[data-admin-grid-reorder-handle]')) })) }; });
    await handle(0).dragTo(handle(3), { sourcePosition: { x: 16, y: 16 }, targetPosition: { x: 16, y: 16 } }); await settle(); const dragAfter = await galleryNative(), dragTrace = await page.evaluate(() => window.galleryDragTrace);
    assert.ok(dragTrace.some(event => event.type === 'dragstart' && event.trusted)); assert.ok(dragTrace.some(event => event.type === 'drop' && event.trusted)); assert.deepEqual(dragAfter, [...original.slice(1), original[0]], 'Trusted native HTML5 drop moves the whole URL/Alt/Caption tuple');
    await writeFile(path.join(output, `gallery-drag-${mode}-${width}.json`), JSON.stringify({ status: 'PASS', actualTrustedNativeMouseDrag: true, before: original, after: dragAfter, geometry: dragGeometry, events: dragTrace }, null, 2));
    }
    const dropped = await galleryNative();
    const assetNames = { '/fixture.svg': 'SEO fixture original', '/fixture-replacement.svg': 'SEO fixture replacement', '/fixture-no-dimensions.svg': 'SEO fixture absent dimensions', '/fixture-fourth.svg': 'SEO fixture fourth' };
    await cards.nth(1).locator('[data-admin-media-gallery-action="remove"]').click(); await expect(cards).toHaveCount(3); await imageChoice(cards.first().locator('[data-admin-media-gallery-action="replace"]'), assetNames[dropped[1].url]); await expect(cards.first().locator('[name="gallery_image_alt"]')).toHaveValue(dropped[0].alt); await expect(cards.first().locator('[name="gallery_image_caption"]')).toHaveValue(dropped[0].caption);
    await imageChoice(add, assetNames[dropped[0].url]); await expect(cards).toHaveCount(4); await cards.last().locator('[name="gallery_image_alt"]').fill('Alt added'); await cards.last().locator('[name="gallery_image_caption"]').fill('Caption added'); assert.equal(new Set((await galleryNative()).map(item => item.url)).size, 4, 'The final four persisted tuples use distinct media URLs');
    const measureGallery = () => gallery.evaluate(root => ({ direction: getComputedStyle(root).direction, columns: getComputedStyle(root.querySelector('[data-admin-media-gallery-density]')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth > innerWidth + 1, cards: [...root.querySelectorAll('[data-admin-media-gallery-card="image"]')].map(node => { const r = node.getBoundingClientRect(), image = node.querySelector('img')?.parentElement?.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, imageRatio: image?.width / image?.height, outside: r.left < -1 || r.right > innerWidth + 1, dimensions: node.textContent.includes('394 × 80 px') || node.textContent.includes('غير متاحة') }; }) }));
    const checkCards = (geometry, columns) => { assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.columns, columns); assert.equal(geometry.overflow, false); assert.equal(geometry.cards.length, 4); for (const card of geometry.cards) { assert.equal(card.outside, false); assert.ok(Math.abs(card.width - geometry.cards[0].width) <= 1); } if (columns === 4) for (let index = 1; index < 4; index++) { assert.ok(Math.abs(geometry.cards[index].y - geometry.cards[0].y) <= 1); assert.ok(geometry.cards[index - 1].x > geometry.cards[index].x); } };
    const geometry = await measureGallery(); checkCards(geometry, width >= 1280 ? 4 : 1); let tablet = null;
    if (width >= 1280) { const beforeResize = await galleryNative(); await page.setViewportSize({ width: 1024, height: 1100 }); tablet = await measureGallery(); checkCards(tablet, 2); assert.deepEqual(await galleryNative(), beforeResize); await shot(gallery, 'gallery', mode, 1024, 'gallery-tablet-two-columns'); await page.setViewportSize({ width, height: 1100 }); checkCards(await measureGallery(), 4); }
    await shot(gallery, 'gallery', mode, width, 'gallery-panel'); return { items: await galleryNative(), geometry, tablet, pickerAddReplaceRemove: true, altCaption: true, fourDistinctUrls: true, arrowsAndFirstLastBounds: true, keyboard: ['ArrowUp', 'ArrowDown', 'Home', 'End'], actualTrustedNativeHtml5Drop: width >= 1280, atomicTuple: true, touch: width === 390 ? 'Touch-capable context and actual arrow taps passed; HTML5 mouse drop is covered at Desktop. No shared pointer/touch drag runtime exists.' : 'Actual native mouse HTML5 drop passed; no shared pointer/touch drag runtime exists.' };
  };
  const actualFs = createRequire(import.meta.url)('node:fs'), finitePublicAssets = new Set(['/fixture.svg', '/fixture-replacement.svg', '/fixture-no-dimensions.svg', '/fixture-fourth.svg'].map(value => path.join(fixtureRoot, 'public', value.slice(1))));
  const projectionOwner = createRemainingContentOwnerHarness(fixtureRoot, { additionalPorts: new Map([['src/lib/admin/media-catalog/deleted-reference-state', {}], ['src/lib/cache/public-cache-generation', {}], ['node:fs', { ...actualFs, existsSync: file => finitePublicAssets.has(String(file)) || actualFs.existsSync(file) }]]) });
  const { mapDetailRow } = projectionOwner.load(path.join(fixtureRoot, 'src/lib/content/public-content-read/owner.ts'), ['mapDetailRow']);
  const { adaptPublicContentToMediaItem } = projectionOwner.load(path.join(fixtureRoot, 'src/lib/media-center/adapt-topic-row.ts'));
  const progress = () => writeFile(path.join(output, 'browser-progress.json'), JSON.stringify({ status: 'IN_PROGRESS', recordedAt: new Date().toISOString(), cases, referenceCases, defaultCases, publicCases, noticeCases, screenshots, sourceSaveResults: slugSaveResults, sourceHashesAtStart, globalClosed: false }, null, 2));
  for (const width of [1440, 390]) for (const type of ['news', 'press', 'site_update', 'gallery']) for (const mode of ['create', 'edit']) {
    console.log('Content Panel/Gallery case ' + type + ' ' + mode + ' RTL ' + width); await page.setViewportSize({ width, height: 1100 }); await fresh(`${type}-${mode}`); const savesBefore = slugSaveResults.length;
    await tab('basic').click(); const title = `اعتماد ${type} ${mode}`, slug = `panel-${type.replaceAll('_', '-')}-${mode}`; await form.locator('[name="title"]').fill(title); await form.locator('[name="slug"]').fill('manual-'); await expect(form.locator('[name="slug"]')).toHaveValue('manual-'); await form.locator('[name="slug"]').fill(slug); await form.locator('[name="title"]').fill(title + ' محفوظ'); await expect(form.locator('[name="slug"]')).toHaveValue(slug); await form.locator('[name="excerpt"]').fill('مقتطف ثابت لاختبار الحفاظ على بيانات النموذج.');
    await form.locator('#content-category-listbox').press('Home'); await form.locator('#content-category-listbox').press('Enter'); await chooseSingle('image', 'SEO fixture replacement'); await form.locator('[name="image_alt"]').fill('Explicit cover alt'); if (type !== 'gallery') await page.getByRole('textbox', { name: 'نص المقال', exact: true }).fill('محتوى Markdown محفوظ عند اعتماد التبويبات.');
    if (['news', 'site_update'].includes(type)) await form.locator('[name="media_project"]').fill('PRESERVED TEXT');
    await tab('seo').click(); await form.locator('[name="seo_title"]').fill('عنوان بحث ' + type); await form.locator('[name="seo_description"]').fill('وصف بحث ثابت مع مشاركة اجتماعية محفوظة.'); await form.locator('[name="canonical_url"]').fill('https://example.test/panel-' + type); await chooseSingle('og_image', 'SEO fixture original'); await form.locator('[name="og_image_alt"]').fill('OG alt ' + type);
    const gallery = type === 'gallery' ? await exerciseGallery(mode, width) : null; const panels = await verifyPanels(type, mode, width); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await form.locator('[data-admin-form-action="close"]').click(); await cancelLeave(); await page.locator('[data-slug-navigation]').click(); await cancelLeave(); assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true);
    const before = await native(); await expect.poll(async () => (await records()).some(({ draft }) => draft.fields.title?.[0] === title + ' محفوظ')).toBe(true); await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await reload(); const notice = page.locator('[data-topic-form-draft]').first(); await expect(notice).toHaveAttribute('data-topic-form-draft', 'pending'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); const recoveredDraftKey = await notice.getAttribute('data-topic-form-draft-key'); assert.ok(recoveredDraftKey, 'Capture the exact selected pending snapshot before Restore replaces its notice'); await notice.locator('[data-topic-form-draft-restore]').click(); await expect(notice).toHaveAttribute('data-topic-form-draft', 'restored'); await settle(); assert.deepEqual(await native(), before, 'Full Draft restores all panel/media fields without changing the native contract'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await tab('seo').click(); await expect(form.locator('[data-admin-entity-seo-search-preview] p').first()).toHaveText('https://example.test/panel-' + type); await expect(form.locator('[name="slug"]')).toHaveValue(slug); if (gallery) assert.deepEqual(await galleryNative(), gallery.items); assert.equal(slugSaveResults.length, savesBefore, 'Panels, reorder, draft and navigation never auto-save');
    await page.evaluate(() => { window.topicSourceSaveOutcome = 'database-error'; }); await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(savesBefore + 1); assert.equal(slugSaveResults.at(-1).result.status, 'error'); await expect(form.locator('[name="title"]')).toBeEnabled(); assert.deepEqual(await native(), before); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.ok((await records()).length > 0);
    await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(savesBefore + 2); assert.equal(slugSaveResults.at(-1).result.status, 'success');
    if (mode === 'create') { const editHref = slugSaveResults.at(-1).result.editHref; assert.ok(editHref, 'Create returns the canonical Edit handoff destination'); await expect.poll(() => page.evaluate(() => window.topicNavigations ?? [])).toContain(editHref); await expect(form).toHaveAttribute('aria-busy', 'true'); await expect(form.locator('[data-admin-form-action="save"]')).toBeDisabled(); }
    else await expect(form).toHaveAttribute('data-admin-form-dirty', 'false');
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), recoveredDraftKey)).toBe(null);
    const saved = slugSaveResults.at(-1).row; assert.equal(saved.slug, slug); assert.equal(saved.canonical_url, 'https://example.test/panel-' + type); assert.equal(saved.image, '/fixture-replacement.svg', 'Explicit cover retains priority over Gallery first image'); if (gallery) assert.deepEqual(saved.media_payload.images, gallery.items);
    setMode(`${type}-edit`); await open(`${type}-edit`); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await native(), before, 'Actual save and persisted PGlite readback hydrate real Edit fields');
    if (gallery) {
      const detail = mapDetailRow(saved), item = adaptPublicContentToMediaItem(detail); assert.equal(detail.metadataImage, '/fixture-replacement.svg', 'The explicitly saved image retains its existing metadata role'); assert.equal(item.image, gallery.items[0].url, 'The public Gallery summary retains its existing payload-first cover priority'); assert.deepEqual(item.galleryImages, gallery.items); const fallback = mapDetailRow({ ...saved, image: null, media_gallery_cover: null }); assert.equal(fallback.image, gallery.items[0].url, 'Without an explicit image the same public first-image cover applies');
      await page.evaluate(item => window.mountGalleryPublicProjection(item), item); const publicGallery = page.locator('[data-public-media-gallery]'); await expect(publicGallery).toHaveAttribute('data-public-media-gallery-count', '4'); const rendered = await publicGallery.locator('[data-public-media-gallery-item]').evaluateAll(nodes => nodes.map(node => ({ url: node.dataset.publicMediaGalleryUrl, alt: node.querySelector('img').getAttribute('alt'), caption: node.querySelector('[data-public-media-gallery-caption]')?.textContent.trim() ?? '' }))); assert.deepEqual(rendered, gallery.items, 'Actual public read projection, Media adapter and mounted renderer preserve persisted order/Alt/Caption'); await shot(publicGallery, type, mode, width, 'public-gallery'); publicCases.push({ mode, width, persistedImages: gallery.items, renderedImages: rendered, actualSourceMapperAdapterAndMountedRenderer: true, coverPriorityAndFallback: true, boundary: 'Persisted isolated row projected by real public owner; no authenticated/public hosted request or publication.' });
    }
    cases.push({ type, mode, width, status: 'PASS', panels, gallery, nativeFieldCount: before.length, dirtyCloseNavigationBeforeUnload: true, draftExplicitRestoreAndNativeParity: true, slugCanonicalAndSeoPreview: true, actualSaveFailureRetainsDraft: true, actualSaveRetryReadback: true, noAutosave: true, mediaProjectPreserved: ['news', 'site_update'].includes(type) }); await progress(); console.log('PASS Content Panel/Gallery ' + type + ' ' + mode + ' RTL ' + width);
  }
  for (const { type, mode, width } of [{ type: 'article', mode: 'create', width: 1440 }, { type: 'article', mode: 'edit', width: 390 }, { type: 'gallery', mode: 'create', width: 390 }, { type: 'gallery', mode: 'edit', width: 1440 }]) {
    console.log('Compact Draft notice case ' + type + ' ' + mode + ' RTL ' + width); await page.setViewportSize({ width, height: 1100 }); const fixtureMode = type === 'article' ? mode : `${type}-${mode}`; await fresh(fixtureMode); const baseline = await native(), title = `اختبار الإشعار ${type} ${mode}`, savesBefore = slugSaveResults.length;
    await form.locator('[name="title"]').fill(title); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); const changed = await native(); await expect.poll(async () => (await records()).some(({ draft }) => draft.fields.title?.[0] === title)).toBe(true); await reload();
    const candidate = page.locator('[data-topic-form-draft-key]').first(), frame = candidate.locator('[data-admin-notice-dismissible="true"]'), restore = candidate.locator('[data-topic-form-draft-restore]'); await expect(frame).toBeVisible(); const key = await candidate.getAttribute('data-topic-form-draft-key'); assert.ok(key); const raw = await page.evaluate(key => localStorage.getItem(key), key); assert.ok(raw);
    const geometry = await frame.evaluate(root => {
      const row = root.querySelector('[data-admin-notice-row]'), message = row.querySelector('[data-admin-notice-message]'), time = row.querySelector('time'), actions = [...row.querySelectorAll('button')], close = root.querySelector('button[aria-label="إغلاق الإشعار"]'), box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; }, closeBox = box(close), controls = [message, time, ...actions].map(box);
      return { direction: getComputedStyle(row).direction, rowDirection: getComputedStyle(row).flexDirection, overflow: document.documentElement.scrollWidth > innerWidth + 1, cardCount: root.querySelectorAll('section').length, frame: box(root), close: closeBox, controls, overlapClose: controls.some(rect => rect.x < closeBox.right && rect.right > closeBox.x && rect.y < closeBox.bottom && rect.bottom > closeBox.y), textOverflow: getComputedStyle(message).textOverflow, whiteSpace: getComputedStyle(message).whiteSpace, fullTextInTitle: message.title === message.textContent, actionLabels: actions.map(node => node.textContent.trim()) };
    });
    assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.overflow, false); assert.equal(geometry.cardCount, 0); assert.equal(geometry.overlapClose, false); assert.ok(geometry.close.x < Math.min(...geometry.controls.map(rect => rect.x)), 'Close stays on the physical left, clear of message, timestamp and both decisions'); assert.ok(geometry.close.x >= geometry.frame.x && geometry.close.right <= geometry.frame.right); assert.deepEqual(geometry.actionLabels, ['استعادة المسودة', 'تجاهل المسودة']);
    if (width >= 1280) { assert.equal(geometry.rowDirection, 'row'); assert.equal(geometry.textOverflow, 'ellipsis'); assert.equal(geometry.whiteSpace, 'nowrap'); assert.equal(geometry.fullTextInTitle, true); const centers = geometry.controls.map(rect => rect.y + rect.height / 2); assert.ok(Math.max(...centers) - Math.min(...centers) <= 2); } else { assert.equal(geometry.rowDirection, 'column'); assert.equal(geometry.whiteSpace, 'normal'); }
    await shot(frame, type, mode, width, 'compact-draft-pending'); const storageBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))), nativeBeforeClose = await native(), dirtyBeforeClose = await form.getAttribute('data-admin-form-dirty'); await frame.getByRole('button', { name: 'إغلاق الإشعار', exact: true }).click(); await expect(candidate).toHaveAttribute('data-topic-form-draft-dismissed', 'true'); await expect(frame).toHaveCount(0); assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))), storageBefore); assert.deepEqual(await native(), nativeBeforeClose); await expect(form).toHaveAttribute('data-admin-form-dirty', dirtyBeforeClose); await shot(form, type, mode, width, 'compact-draft-closed');
    await tab('publish').click(); await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await settle(); const beforeRevealScrollY = await page.evaluate(() => scrollY), beforeRevealTop = await candidate.evaluate(node => node.getBoundingClientRect().top); assert.ok(beforeRevealTop < 0, 'The unresolved candidate starts above the viewport when Save is attempted from the end of the form'); const attemptsBefore = await page.evaluate(() => window.topicSaveAttempts ?? 0); await form.evaluate(form => form.requestSubmit()); await expect(frame).toBeVisible(); await expect(restore).toBeFocused(); await expect(frame).toBeInViewport({ ratio: 1 }); await expect(restore).toBeInViewport({ ratio: 1 }); assert.equal(await page.evaluate(() => window.topicSaveAttempts ?? 0), attemptsBefore); assert.equal(slugSaveResults.length, savesBefore); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw); assert.deepEqual(await native(), baseline);
    await frame.getByRole('button', { name: 'إغلاق الإشعار', exact: true }).click(); await reload(); await expect(frame).toBeVisible(); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw); await restore.click(); await expect(page.locator('[data-topic-form-draft="restored"]')).toBeVisible(); await settle(); assert.deepEqual(await native(), changed); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await fresh(fixtureMode); const discardBaseline = await native(); await form.locator('[name="title"]').fill(title + ' تجاهل'); await expect.poll(async () => (await records()).some(({ draft }) => draft.fields.title?.[0] === title + ' تجاهل')).toBe(true); await page.evaluate(() => localStorage.setItem('unrelated-notice-probe', 'retain-exact-unrelated-byte-string')); await reload(); assert.deepEqual(await native(), discardBaseline); const discardCandidate = page.locator('[data-topic-form-draft-key]').first(), discardKey = await discardCandidate.getAttribute('data-topic-form-draft-key'); assert.ok(discardKey); await form.locator('[name="title"]').fill(title + ' بيانات حالية مستقلة'); const currentBeforeDiscard = await native(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); await discardCandidate.locator('[data-topic-form-draft-discard]').click(); await expect.poll(() => page.evaluate(key => localStorage.getItem(key), discardKey)).toBe(null); assert.deepEqual(await native(), currentBeforeDiscard); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-notice-probe')), 'retain-exact-unrelated-byte-string'); assert.equal(slugSaveResults.length, savesBefore);
    noticeCases.push({ type, mode, width, status: 'PASS', geometry, compactDesktopRow: width >= 1280, physicalLeftClose: true, mobileNoOverflow: width === 390, closeNoStorageOrFieldMutation: true, closeRetainsDirtyState: true, saveRevealsUnresolvedChoiceWithoutSave: true, saveRevealsChoiceFromBottom: true, beforeRevealScrollY, restoreActionFocusedAfterBlockedSave: true, wholeNoticeAndRestoreVisibleAfterBlockedSave: true, reopenStillRecoverable: true, restoreAndDiscardDistinct: true, explicitRestoreNativeParityAndDirty: true, discardOnlyEligibleSnapshotKeepsCurrentFields: true }); await progress(); console.log('PASS Compact Draft notice ' + type + ' ' + mode + ' RTL ' + width);
  }
  for (const width of [1440, 390]) for (const type of ['article', 'video']) {
    await page.setViewportSize({ width, height: 1100 }); await fresh(type === 'article' ? 'edit' : 'video-edit'); const before = await native(); const panels = await verifyPanels(type, 'reference-edit', width); assert.deepEqual(await native(), before); if (type === 'video') { await tab('video').click(); const owner = form.locator('[data-admin-media-video-presentation="panel"]'); await expect(owner).toBeVisible(); await expect(form.locator('[name="video_url"]')).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await page.evaluate(() => { window.metaReadOutcome = 'ready'; }); await owner.getByRole('option', { name: 'Facebook', exact: true }).click(); await owner.locator('[name="video_url"]').fill('https://www.facebook.com/watch?v=10153231379946729'); await expect(owner.locator('[data-meta-video-embed] iframe')).toHaveCount(1); const pauses = await page.evaluate(() => window.metaSdkStats.pauses); await tab('seo').click(); await expect(owner.locator('[data-meta-video-embed] iframe')).toHaveCount(0); await expect.poll(() => page.evaluate(() => window.metaSdkStats.pauses)).toBeGreaterThan(pauses); await tab('video').click(); await expect(owner.locator('[data-meta-video-embed] iframe')).toHaveCount(1); }
    referenceCases.push({ type, mode: 'edit', width, status: 'PASS', panels, actualReferenceConsumer: true, retainedNativeValuesAcrossPanels: true, metaHidePauseRemountNoAutoplay: type === 'video' }); await progress();
  }
  for (const variant of ['hero', 'items']) {
    await page.evaluate(variant => window.mountGalleryDefaults(variant), variant); const root = page.locator('[data-gallery-default-probe="' + variant + '"]'), gallery = root.locator('[data-admin-media-gallery-mode]'); await expect(gallery).not.toHaveAttribute('data-admin-media-gallery-presentation', 'panel'); await expect(gallery.locator('[data-admin-grid-reorder-handle]')).toHaveCount(0); await expect(gallery.locator('[data-admin-media-gallery-card="image"]')).toHaveCount(2); await expect(gallery.locator('[data-admin-media-gallery-action="replace"]')).toHaveCount(2); await expect(gallery.locator('[data-admin-media-gallery-action="remove"]')).toHaveCount(2); await expect(gallery.locator('[data-admin-media-gallery-action="move-up"]')).toHaveCount(2); await expect(gallery.locator('[data-admin-media-gallery-card="add"]')).toHaveCount(1);
    const nativeBefore = await root.evaluate(form => [...new FormData(form)]); await gallery.locator('[data-admin-media-gallery-card="image"]').first().locator('[data-admin-media-gallery-action="move-down"]').click(); const nativeAfter = await root.evaluate(form => [...new FormData(form)]); assert.notDeepEqual(nativeAfter, nativeBefore); defaultCases.push({ variant, status: 'PASS', defaultPresentationPreserved: true, defaultActionsRetained: true, oldPathsOrItemsSerialization: true, dragDefaultOff: true });
  }
  const portCases = [['allowAdd', '[data-admin-media-gallery-card="add"]'], ['allowReplace', '[data-admin-media-gallery-action="replace"]'], ['allowRemove', '[data-admin-media-gallery-action="remove"]'], ['allowReorder', '[data-admin-media-gallery-action="move-up"],[data-admin-media-gallery-action="move-down"],[data-admin-grid-reorder-handle]'], ['showAlt', 'input:not([type="hidden"])[name="default_alt"]'], ['showCaption', 'input:not([type="hidden"])[name="default_caption"],textarea[name="default_caption"]'], ['enableDragDrop', '[data-admin-grid-reorder-handle]']];
  for (const [port, selector] of portCases) { await page.evaluate(({ port }) => window.mountGalleryDefaults('items', { presentation: 'panel', enableDragDrop: true, [port]: false }), { port }); const root = page.locator('[data-gallery-default-probe="items"]'); await expect(root.locator(selector)).toHaveCount(0); assert.deepEqual(await root.evaluate(form => { const data = new FormData(form); return { urls: data.getAll('default_gallery'), alt: data.getAll('default_alt'), caption: data.getAll('default_caption') }; }), { urls: ['/fixture.svg', '/fixture-replacement.svg'], alt: ['Alt A', 'Alt B'], caption: ['Caption A', 'Caption B'] }); defaultCases.push({ port, status: 'PASS', hiddenIndependently: true, serializedFullTuplesPreserved: true }); }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); const sourceHashesAtEnd = await readPanelGallerySourceHashes(); assert.deepEqual(sourceHashesAtEnd, sourceHashesAtStart); await recordPanelGallerySourceIdentity(sourceHashesAtEnd);
  const receipt = { status: 'PASS', browser: 'Chromium ' + browser.version(), browserCases: cases, referenceCases, defaultCases, publicCases, noticeCases, sourceSaveResults: slugSaveResults, screenshots, screenshotCount: screenshots.length, finiteMediaReads: seoReads, finiteIframeReads: iframeReads, sourceHashesAtStart, sourceHashesAtEnd, sourceIdentity: path.join(output, 'browser-source-identity.json'), transport: 'Existing actual-editor browser memory fixture and source save owners with disposable PGlite; actual public projection/adapter/renderer; finite media/Auth/cache/SDK ports only.', serverStarted: false, hostedDatabaseWrites: 0, globalClosed: false };
  await writeFile(path.join(output, 'content-panel-gallery-browser.json'), JSON.stringify(receipt, null, 2)); console.log('PASS Final Content Panel/Gallery ' + JSON.stringify({ cases: cases.length, references: referenceCases.length, defaults: defaultCases.length, public: publicCases.length, sourceSaves: slugSaveResults.length, screenshots: screenshots.length }));
}

async function verifyUnifiedImageSystem(context) {
  const { fixtureRoot, page, browser, open, errors, forbidden, seoReads, output, sourceHashesAtStart, readSourceHashes, recordSourceIdentity, getHarness, setHarness, setMode, savedSlugRows, slugSaveResults, holdReferences, releaseReferences } = context;
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { createTopicSlugSaveHarness } = await import('./fixtures/remaining-content-owner-harness.mjs');
  await mkdir(output, { recursive: true });
  const cases = [], defaults = [], noticeCases = [], screenshots = [], form = page.locator('form[data-admin-form-runtime]'), tab = id => form.locator('[data-admin-tab-id="' + id + '"]');
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const native = (owner = form) => owner.evaluate(form => [...new FormData(form)].filter(([name]) => !['id', 'expected_updated_at'].includes(name)).sort(([a], [b]) => a.localeCompare(b)));
  const tuples = (owner = form, names = ['gallery_image_url', 'gallery_image_alt', 'gallery_image_caption']) => owner.evaluate((form, names) => { const data = new FormData(form); return data.getAll(names[0]).map((url, index) => ({ url, alt: data.getAll(names[1])[index], caption: data.getAll(names[2])[index] })); }, names);
  const records = () => page.evaluate(() => Object.keys(localStorage).flatMap(key => { try { const draft = JSON.parse(localStorage.getItem(key)); return draft?.version === 2 && draft.fields ? [{ key, draft }] : []; } catch { return []; } }));
  const reload = async () => { const leave = dialog => dialog.accept(); page.on('dialog', leave); try { await page.reload(); } finally { page.off('dialog', leave); } await expect(form.locator('[name="title"]')).toBeEditable(); await settle(); };
  const shot = async (owner, type, mode, width, state) => { await owner.scrollIntoViewIfNeeded(); const file = path.join(output, `${type}-${mode}-${width}-${state}.png`); await owner.screenshot({ path: file }); screenshots.push({ type, mode, width, state, path: file }); };
  const fresh = async mode => {
    await getHarness()?.close(); setHarness(undefined); setMode(mode); savedSlugRows.clear(); await open(mode); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await reload();
    const seed = await page.evaluate(() => window.topicFixtureSeed), type = await form.locator('[name="content_type"]').inputValue();
    setHarness(await createTopicSlugSaveHarness(fixtureRoot, { rows: mode.endsWith('edit') ? [{ ...seed, content_type: type }] : [], categories: [{ id: 17, name: 'تصنيف تجريبي', slug: 'fixture', parent_id: null, is_active: true, status: 'published', deleted_at: null }], series: [{ id: 187, name: 'سلسلة تجريبية', slug: 'fixture-series', category_id: 17, status: 'published', deleted_at: null }] }));
  };
  const imageChoice = async (opener, asset, keyboard = false) => {
    if (keyboard) { await opener.focus(); await opener.press('Enter'); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); }
    await opener.click(); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible(); await picker.locator('button[aria-pressed="false"]').filter({ hasText: asset }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0);
  };
  const chooseSingle = async (owner, asset, keyboard = false) => { const add = owner.locator('[data-admin-media-image-card="add"]'); await imageChoice(await add.count() ? add : owner.getByRole('button', { name: 'استبدال', exact: true }), asset, keyboard); };
  const dimensionProof = async (owner, recommended, originalText) => {
    const before = await native(), recommendedDetail = owner.locator('[data-admin-media-dimension="recommended"]'), originalDetail = owner.locator('[data-admin-media-dimension="original"]');
    await expect(recommendedDetail).toHaveCount(1); await expect(originalDetail).toHaveCount(1);
    for (const detail of [recommendedDetail, originalDetail]) { if (await detail.getAttribute('open') !== null) await detail.locator('summary').click(); await expect(detail).not.toHaveAttribute('open'); }
    await recommendedDetail.locator('summary').focus(); await recommendedDetail.locator('summary').press('Enter'); await expect(recommendedDetail).toHaveAttribute('open'); await expect(originalDetail).not.toHaveAttribute('open'); await expect(recommendedDetail.locator('p')).toHaveAttribute('aria-label', recommended);
    await originalDetail.locator('summary').focus(); await originalDetail.locator('summary').press('Space'); await expect(originalDetail).toHaveAttribute('open'); await expect(originalDetail.locator('p')).toHaveAttribute('aria-label', originalText);
    for (const detail of [recommendedDetail, originalDetail]) await expect(detail.locator('p')).toHaveAttribute('title', 'الأبعاد بوحدة البكسل (px)');
    const geometry = await owner.evaluate(root => { const details = [...root.querySelectorAll('[data-admin-media-dimension]')], box = node => { const r = node.getBoundingClientRect(), css = getComputedStyle(node); return { x: r.x, y: r.y, width: r.width, right: r.right, bottom: r.bottom, color: css.color, fontSize: css.fontSize, border: css.borderColor, whiteSpace: css.whiteSpace, scrollOverflow: node.scrollWidth > node.clientWidth + 1, text: node.textContent.trim() }; }; return { details: details.map(node => ({ kind: node.dataset.adminMediaDimension, ...box(node), summary: box(node.querySelector('summary')), value: box(node.querySelector('p')) })), overflow: document.documentElement.scrollWidth > innerWidth + 1, direction: getComputedStyle(root).direction }; });
    assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.overflow, false); assert.equal(geometry.details[0].summary.text, 'الموصى به'); assert.equal(geometry.details[1].summary.text, 'الأبعاد الأصلية'); assert.equal(geometry.details[0].summary.fontSize, geometry.details[1].summary.fontSize); assert.equal(geometry.details[0].summary.color, geometry.details[1].summary.color); for (const detail of geometry.details) { assert.equal(detail.summary.whiteSpace, 'nowrap'); assert.equal(detail.summary.scrollOverflow, false, 'Both dimension labels remain one line inside the actual card width'); assert.equal(detail.value.whiteSpace, 'nowrap'); assert.equal(detail.value.scrollOverflow, false, 'Dimension numbers fit on one line inside four-column cards and Mobile'); } assert.ok(Math.abs(geometry.details[0].y - geometry.details[1].y) <= 1, 'Dimension disclosures remain adjacent at the consumer width'); assert.deepEqual(await native(), before, 'Dimensions disclosure only changes presentation');
    return geometry;
  };
  const metadataProof = async (owner, names, rows) => {
    const proof = [];
    for (const name of names) {
      const field = owner.locator('[name="' + name + '"]'); await expect(field).toHaveCount(1); await expect(field).toHaveJSProperty('tagName', rows > 1 ? 'TEXTAREA' : 'INPUT'); if (rows > 1) await expect(field).toHaveAttribute('rows', String(rows)); else await expect(field).not.toHaveAttribute('rows');
      const geometry = await field.evaluate(node => { const label = node.closest('label'), title = label?.querySelector('[data-admin-form-label-text]'), css = getComputedStyle(node), rect = node.getBoundingClientRect(); return { name: node.name, font: css.fontSize, background: css.backgroundColor, border: css.borderColor, radius: css.borderRadius, minHeight: css.minHeight, padding: css.padding, label: Boolean(title), inset: title ? getComputedStyle(title).paddingInlineStart : null, extraContainer: Boolean(node.closest('[data-admin-form-field-container]')), x: rect.x, right: rect.right }; });
      assert.equal(geometry.font, '14px'); assert.equal(geometry.minHeight, rows > 1 ? '64px' : '44px'); assert.equal(geometry.label, true); assert.equal(geometry.inset, '12px'); assert.equal(geometry.extraContainer, false, 'Shared image metadata retains direct-label presentation without nested field containers'); proof.push(geometry);
    }
    return proof;
  };
  const actionProof = async owner => {
    const rails = owner.locator('[data-admin-media-image-actions]'); await expect(rails).toHaveCount(1); const buttons = rails.locator('button'); await expect(buttons).toHaveCount(2);
    const result = await buttons.evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), title: node.getAttribute('title'), text: node.textContent.trim(), svg: node.querySelectorAll('svg').length, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, color: getComputedStyle(node).color, type: node.type })));
    for (const button of result) { assert.ok(button.label && button.title); assert.equal(button.text, ''); assert.equal(button.svg, 1); assert.equal(button.width, 44); assert.equal(button.height, 44); assert.equal(button.type, 'button'); } return result;
  };
  if (process.argv.includes('--unified-image-draft-before-only')) {
    console.log('UNIFIED_IMAGE_BEFORE_BUNDLE_FROZEN'); await fresh('edit'); await form.locator('[name="title"]').fill('Duplicate logical draft baseline'); await expect.poll(async () => (await records()).length).toBe(1); const first = (await records())[0];
    const second = await page.evaluate(({ draft }) => { const { api } = window.topicDraftFixture, next = { ...draft, writerId: 'duplicate-baseline-writer', savedAt: new Date(Date.now() + 60000).toISOString() }, key = api.getTopicFormDraftKey(next.scope, next.writerId), raw = JSON.stringify(next); localStorage.setItem(key, raw); return { key, raw }; }, first);
    await reload(); const notices = page.locator('[data-topic-form-draft-key]'); await expect(notices).toHaveCount(2); const before = { status: 'REPRODUCED', expectedDefect: 'Two exact logical drafts under different writer keys render duplicate decision notices', pendingNotices: await notices.count(), storageRecords: await records(), first, second, native: await native(), sourceHashesAtStart, hostedDatabaseWrites: 0, sourceSaves: slugSaveResults.length, globalClosed: false }; await shot(form, 'draft', 'before', 1440, 'two-identical-pending-notices'); await writeFile(path.join(output, 'draft-duplicate-before.json'), JSON.stringify({ ...before, screenshots }, null, 2)); console.log('PASS BEFORE duplicate logical drafts reproduced: notices=2; saves=0'); return;
  }
  const recordDefault = async result => { defaults.push(result); await writeFile(path.join(output, 'remaining-progress.json'), JSON.stringify({ status: 'IN_PROGRESS', defaults, noticeCases, screenshots, sourceSaveResults: slugSaveResults, sourceHashesAtStart, globalClosed: false }, null, 2)); console.log('PASS Unified Image default ' + JSON.stringify(result)); };
  if (process.argv.includes('--unified-image-post-consumer-only') || process.argv.includes('--unified-image-draft-after-only')) await fresh('edit');
  for (const width of process.argv.includes('--unified-image-draft-after-only') || process.argv.includes('--unified-image-post-consumer-only') ? [] : [1440, 390]) for (const type of ['article', 'gallery']) for (const mode of ['create', 'edit']) {
    console.log(`Unified Image case ${type} ${mode} RTL ${width}`); await page.setViewportSize({ width, height: 1100 }); const fixtureMode = type === 'article' ? mode : `${type}-${mode}`; await fresh(fixtureMode); const saveStart = slugSaveResults.length;
    await tab('basic').click(); await form.locator('[name="title"]').fill(`توحيد الصور ${type} ${mode}`); await form.locator('[name="slug"]').fill(`image-${type}-${mode}`); await form.locator('[name="excerpt"]').fill('مقتطف محفوظ لاختبار توحيد الصورة وبياناتها.'); await form.locator('#content-category-listbox').press('Home'); await form.locator('#content-category-listbox').press('Enter');
    const main = form.locator('[data-admin-media-image-field="image"]'); await chooseSingle(main, 'SEO fixture original', true); await form.locator('[name="image_alt"]').fill('وصف الصورة الرئيسية المستقل');
    if (type === 'article') await page.getByRole('textbox', { name: 'نص المقال', exact: true }).fill('محتوى المقال المحفوظ لاختبار بيانات الصورة.');
    await tab('seo').click(); await form.locator('[name="canonical_url"]').fill(`https://example.test/image-${type}-${mode}`); await expect(form.locator('[data-admin-entity-seo-search-preview] p').first()).toHaveText(`https://example.test/image-${type}-${mode}`); await tab('basic').click();
    let target = main, gallery = null, cards = null;
    if (type === 'gallery') {
      await tab('gallery').click(); gallery = form.locator('[data-admin-media-gallery-mode="items"]'); cards = gallery.locator('[data-admin-media-gallery-card="image"]'); const add = gallery.locator('[data-admin-media-gallery-card="add"]');
      if (mode === 'create') { await imageChoice(add, 'SEO fixture original'); await imageChoice(add, 'SEO fixture replacement'); }
      await imageChoice(add, 'SEO fixture absent dimensions'); await imageChoice(add, 'SEO fixture fourth'); await expect(cards).toHaveCount(4);
      for (let index = 0; index < 4; index++) { await cards.nth(index).locator('[name="gallery_image_alt"]').fill('Alt image ' + index); await cards.nth(index).locator('[name="gallery_image_caption"]').fill('Caption image ' + index); }
      target = cards.first();
    } else await expect(main.locator('[name*="caption"]')).toHaveCount(0);
    const metadata = await metadataProof(target, type === 'article' ? ['image_alt'] : ['gallery_image_alt', 'gallery_image_caption'], type === 'article' ? 2 : 1); const actions = await actionProof(target); const dimensions = await dimensionProof(target, type === 'article' ? '3840 × 2560 px' : '2560 × 1920 px', '394 × 80 px');
    const referencePolicy = await target.locator('span[dir="ltr"]').count(); if (type === 'gallery') assert.ok(referencePolicy > 0);
    await shot(type === 'gallery' ? gallery : main, type, mode, width, 'unified-known-dimensions');
    if (type === 'article') { await main.locator('[data-admin-media-image-preview-trigger]').click(); await expect(page.getByRole('dialog')).toHaveCount(1); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await main.getByRole('button', { name: 'إزالة', exact: true }).click(); await expect(main.locator('[name="image"]')).toHaveValue(''); await expect(main.locator('[name="image_alt"]')).toHaveValue('وصف الصورة الرئيسية المستقل'); await chooseSingle(main, 'SEO fixture original'); await expect(main.locator('[name="image_alt"]')).toHaveValue('وصف الصورة الرئيسية المستقل'); }
    const replace = type === 'gallery' ? cards.first().locator('[data-admin-media-gallery-action="replace"]') : main.getByRole('button', { name: 'استبدال', exact: true });
    holdReferences(); await imageChoice(replace, 'SEO fixture absent dimensions'); const originalDetail = target.locator('[data-admin-media-dimension="original"]'); await expect(originalDetail).toContainText('جارٍ قراءة أبعاد الأصل…'); await shot(target, type, mode, width, 'dimensions-loading'); await releaseReferences(); await expect(originalDetail).toContainText('غير متاحة');
    await imageChoice(type === 'gallery' ? cards.first().locator('[data-admin-media-gallery-action="replace"]') : main.getByRole('button', { name: 'استبدال', exact: true }), 'SEO fixture unavailable'); await expect(target.locator('[data-admin-media-preview-state="unavailable"]')).toHaveCount(1); await expect(originalDetail).toContainText('غير متاحة'); await expect(target.locator('details').filter({ hasText: 'تفاصيل المرجع المحفوظ' })).toHaveCount(type === 'gallery' ? 1 : 0); await shot(target, type, mode, width, 'dimensions-unavailable');
    await imageChoice(type === 'gallery' ? cards.first().locator('[data-admin-media-gallery-action="replace"]') : main.getByRole('button', { name: 'استبدال', exact: true }), 'SEO fixture original');
    let reorder = null;
    if (type === 'gallery') {
      const before = await tuples(), handle = index => cards.nth(index).locator('[data-admin-grid-reorder-handle]'), surface = index => cards.nth(index).locator('[data-admin-media-gallery-drag-surface]');
      const handleColor = await handle(0).evaluate(node => getComputedStyle(node).color); assert.equal(handleColor, 'rgb(216, 184, 122)', 'Gallery grip uses the existing Warm Gold identity');
      await page.evaluate(() => { window.unifiedClickDragStarts = 0; document.addEventListener('dragstart', () => { window.unifiedClickDragStarts++; }, { once: true }); }); await surface(0).click(); assert.deepEqual(await tuples(), before); assert.equal(await page.evaluate(() => window.unifiedClickDragStarts), 0, 'A plain image click never begins native drag'); await expect(page.getByRole('dialog')).toHaveCount(0);
      await handle(0).focus(); await handle(0).press('End'); assert.deepEqual(await tuples(), [...before.slice(1), before[0]]); await handle(3).press('Home'); assert.deepEqual(await tuples(), before); await expect(cards.first().locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled(); await expect(cards.last().locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
      if (width === 390) { await cards.first().locator('[data-admin-media-gallery-action="move-down"]').tap(); assert.deepEqual(await tuples(), [before[1], before[0], ...before.slice(2)]); await cards.nth(1).locator('[data-admin-media-gallery-action="move-up"]').tap(); assert.deepEqual(await tuples(), before); }
      if (width >= 1280) {
        await page.evaluate(() => { window.unifiedImageDragTrace = []; for (const type of ['dragstart', 'dragenter', 'dragover', 'drop', 'dragend']) document.addEventListener(type, event => { const target = event.target instanceof Element ? event.target : null; window.unifiedImageDragTrace.push({ type, trusted: event.isTrusted, surface: Boolean(target?.closest('[data-admin-media-gallery-drag-surface]')), dragging: [...document.querySelectorAll('[data-gallery-item-dragging]')].map(node => node.getAttribute('data-admin-media-gallery-index')), dropTargets: [...document.querySelectorAll('[data-gallery-item-drop-target]')].map(node => ({ index: node.getAttribute('data-admin-media-gallery-index'), border: getComputedStyle(node).borderColor })) }); }, true); });
        await gallery.scrollIntoViewIfNeeded(); const sourceBox = await surface(0).boundingBox(), targetBox = await surface(3).boundingBox(); assert.ok(sourceBox && targetBox); await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2); await page.mouse.down(); await page.mouse.move(sourceBox.x + sourceBox.width / 2 - 18, sourceBox.y + sourceBox.height / 2, { steps: 4 }); await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 18 }); await expect(gallery.locator('[data-gallery-item-drop-target="true"]')).toHaveCount(1); const dragShot = path.join(output, `${type}-${mode}-${width}-image-area-drag-active-gold-drop.png`); await page.screenshot({ path: dragShot }); screenshots.push({ type, mode, width, state: 'image-area-drag-active-gold-drop', path: dragShot }); await page.mouse.up(); await settle(); const trace = await page.evaluate(() => window.unifiedImageDragTrace); assert.ok(trace.some(event => event.type === 'dragstart' && event.trusted && event.surface), 'Trusted drag begins from image area, not only grip'); assert.ok(trace.some(event => event.type === 'drop' && event.trusted)); assert.ok(trace.some(event => event.dragging.length > 0)); assert.ok(trace.some(event => event.dropTargets.length > 0)); assert.deepEqual(await tuples(), [...before.slice(1), before[0]], 'Image area drop preserves complete URL/Alt/Caption tuples'); reorder = { trace, before, after: await tuples(), trustedImageAreaDrag: true };
      }
      const final = await tuples(); await cards.last().locator('[data-admin-media-gallery-action="remove"]').click(); await expect(cards).toHaveCount(3); await imageChoice(gallery.locator('[data-admin-media-gallery-card="add"]'), final[3].url === '/fixture.svg' ? 'SEO fixture original' : 'SEO fixture fourth'); await cards.last().locator('[name="gallery_image_alt"]').fill(final[3].alt); await cards.last().locator('[name="gallery_image_caption"]').fill(final[3].caption); assert.deepEqual(await tuples(), final);
      const geometry = await gallery.evaluate(root => ({ direction: getComputedStyle(root).direction, columns: getComputedStyle(root.querySelector('[data-admin-media-gallery-density]')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth > innerWidth + 1, cards: [...root.querySelectorAll('[data-admin-media-gallery-card="image"]')].map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, right: r.right }; }) })); assert.equal(geometry.columns, width >= 1280 ? 4 : 1); assert.equal(geometry.overflow, false); if (width >= 1280) for (const card of geometry.cards) assert.ok(Math.abs(card.y - geometry.cards[0].y) <= 1); reorder = { ...reorder, keyboardHomeEnd: true, mobileArrowTaps: width === 390, normalImageClickNoReorderOrPicker: true, layout: geometry }; await shot(gallery, type, mode, width, 'after-image-area-reorder');
    }
    await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); for (const trigger of [form.locator('[data-admin-form-action="close"]'), page.locator('[data-slug-navigation]')]) { await trigger.click(); const dialog = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await expect(dialog).toBeVisible(); await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0); }
    assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true);
    const beforeSave = await native(), savedImages = type === 'gallery' ? await tuples() : null; await expect.poll(async () => (await records()).some(({ draft }) => draft.fields.title?.[0] === `توحيد الصور ${type} ${mode}`)).toBe(true); await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await reload(); const draft = page.locator('[data-topic-form-draft-key]').first(); await expect(draft).toHaveAttribute('data-topic-form-draft', 'pending'); const draftKey = await draft.getAttribute('data-topic-form-draft-key'); await draft.locator('[data-topic-form-draft-restore]').click(); await expect(page.locator('[data-topic-form-draft="restored"]')).toBeVisible(); await settle(); assert.deepEqual(await native(), beforeSave); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.equal(slugSaveResults.length, saveStart, 'Image editing, dimensions, reorder and recovery do not autosave');
    await page.evaluate(() => { window.topicSourceSaveOutcome = 'database-error'; }); await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(saveStart + 1); assert.equal(slugSaveResults.at(-1).result.status, 'error'); assert.deepEqual(await native(), beforeSave); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.ok((await records()).length > 0);
    await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(saveStart + 2); const saved = slugSaveResults.at(-1); assert.equal(saved.result.status, 'success'); assert.equal(saved.row.slug, `image-${type}-${mode}`); assert.equal(saved.row.canonical_url, `https://example.test/image-${type}-${mode}`); if (savedImages) assert.deepEqual(saved.row.media_payload.images, savedImages); await expect.poll(() => page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(null);
    const editMode = type === 'article' ? 'edit' : 'gallery-edit'; setMode(editMode); await open(editMode); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await native(), beforeSave, 'Actual source save and disposable PGlite readback hydrate real Edit fields');
    cases.push({ type, mode, width, status: 'PASS', metadata, dimensions, actions, reorder, dimensionsLoadingUnavailable: true, sharedImageOwner: true, nativeFieldParity: true, explicitDraftRestore: true, dirtyCloseNavigation: true, noAutosave: true, actualSourceFailedSaveRetainsDraftAndFields: true, actualSourceSuccessfulSaveReadback: true, slugCanonicalPreserved: true }); await writeFile(path.join(output, 'browser-progress.json'), JSON.stringify({ status: 'IN_PROGRESS', cases, defaults, screenshots, sourceSaveResults: slugSaveResults, globalClosed: false }, null, 2)); console.log(`PASS Unified Image ${type} ${mode} RTL ${width}`);
  }
  for (const width of process.argv.includes('--unified-image-draft-after-only') ? [] : [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const variant of ['default', 'compact', 'card']) {
      await page.evaluate(variant => window.mountImageDefaults({ variant }), variant); const owner = page.locator('[data-image-default-probe]'); await expect(owner.locator('[name="default_image"]')).toHaveValue('/fixture.svg'); await expect(owner.locator('[name="default_image_alt"]')).toHaveValue('Default alt'); await expect(owner.locator('[data-admin-media-dimension]')).toHaveCount(0); await expect(owner.locator('[data-admin-media-image-metadata="panel"]')).toHaveCount(0); await shot(owner, 'default-image', variant, width, 'omitted-ports'); await chooseSingle(owner, 'SEO fixture replacement'); await expect(owner.locator('[name="default_image"]')).toHaveValue('/fixture-replacement.svg'); await owner.getByRole('button', { name: 'إزالة', exact: true }).click(); await expect(owner.locator('[name="default_image"]')).toHaveValue(''); await expect(owner.locator('[name="default_image_alt"]')).toHaveValue(''); await recordDefault({ owner: 'AdminMediaImageField', variant, width, status: 'PASS', omittedDisclosureAndArticleMetadata: true, originalNativeFields: true, pickerReplaceAndLegacyRemoveClearsAlt: true });
    }
    for (const variant of ['hero', 'items']) for (const actionPresentation of ['default', 'bare', 'card']) {
      await page.evaluate(({ variant, actionPresentation }) => window.mountGalleryDefaults(variant, { actionPresentation }), { variant, actionPresentation }); const owner = page.locator('[data-gallery-default-probe]'), cards = owner.locator('[data-admin-media-gallery-card="image"]'); await expect(cards).toHaveCount(2); await expect(owner.locator('[data-admin-grid-reorder-handle]')).toHaveCount(0); await expect(owner.locator('[data-admin-media-gallery-action="replace"]')).toHaveCount(2); await expect(owner.locator('[data-admin-media-gallery-action="remove"]')).toHaveCount(2); await expect(owner.locator('[data-admin-media-dimension]')).toHaveCount(0); const before = await native(owner); await cards.first().locator('[data-admin-media-gallery-action="move-down"]').click(); assert.notDeepEqual(await native(owner), before); await shot(owner, 'default-gallery', variant + '-' + actionPresentation, width, 'omitted-ports'); await recordDefault({ owner: 'AdminMediaGalleryField', variant, actionPresentation, width, status: 'PASS', nativeAndActionsPreserved: true, dragDefaultOff: true, noDisclosureOrArticleMetadata: true });
    }
  }
  for (const port of process.argv.includes('--unified-image-draft-after-only') ? [] : ['showAlt', 'showCaption', 'allowReplace', 'allowRemove', 'allowReorder', 'allowAdd', 'enableDragDrop']) {
    await page.evaluate(port => window.mountGalleryDefaults('items', { presentation: 'panel', actionPresentation: 'card', enableDragDrop: true, [port]: false }), port); const owner = page.locator('[data-gallery-default-probe]'); assert.deepEqual(await tuples(owner, ['default_gallery', 'default_alt', 'default_caption']), [{ url: '/fixture.svg', alt: 'Alt A', caption: 'Caption A' }, { url: '/fixture-replacement.svg', alt: 'Alt B', caption: 'Caption B' }]); const selectors = { showAlt: 'textarea[name="default_alt"],input:not([type="hidden"])[name="default_alt"]', showCaption: 'textarea[name="default_caption"],input:not([type="hidden"])[name="default_caption"]', allowReplace: '[data-admin-media-gallery-action="replace"]', allowRemove: '[data-admin-media-gallery-action="remove"]', allowReorder: '[data-admin-media-gallery-action="move-up"],[data-admin-media-gallery-action="move-down"],[data-admin-grid-reorder-handle]', allowAdd: '[data-admin-media-gallery-card="add"]', enableDragDrop: '[data-admin-grid-reorder-handle],[data-admin-media-gallery-drag-surface][draggable="true"]' }; await expect(owner.locator(selectors[port])).toHaveCount(0); await recordDefault({ port, status: 'PASS', hiddenCapabilityKeepsSerializedTuples: true });
  }
  if (!process.argv.includes('--unified-image-draft-after-only')) {
    await page.setViewportSize({ width: 390, height: 1100 }); await fresh('gallery-edit'); const seed = await page.evaluate(() => window.topicFixtureSeed), rawItems = [{ url: '/fixture.svg', alt: 'Alt first line\nAlt second line', caption: 'Caption first line\r\nCaption second line' }, { url: '/fixture-replacement.svg', alt: 'Other alt', caption: 'Other caption' }]; savedSlugRows.set('gallery-edit', { ...seed, content_type: 'gallery', media_payload: { kind: 'gallery', images: rawItems } }); await open('gallery-edit'); await tab('gallery').click(); const gallery = form.locator('[data-admin-media-gallery-mode="items"]'), first = gallery.locator('[data-admin-media-gallery-card="image"]').first(), alt = first.locator('[data-admin-media-image-input-name="gallery_image_alt"]'), caption = first.locator('[data-admin-media-image-input-name="gallery_image_caption"]');
    await expect(alt).toHaveJSProperty('tagName', 'INPUT'); await expect(caption).toHaveJSProperty('tagName', 'INPUT'); assert.deepEqual(await tuples(), rawItems, 'Untouched stored line breaks retain one exact native tuple through the single-line presentation'); await expect(first.locator('[name="gallery_image_alt"]')).toHaveCount(1); await expect(first.locator('[name="gallery_image_caption"]')).toHaveCount(1); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await tab('seo').click(); await tab('gallery').click(); assert.deepEqual(await tuples(), rawItems); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await shot(gallery, 'gallery', 'raw-metadata', 390, 'single-line-retains-stored-line-breaks'); await alt.fill('Explicit edited alt'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.deepEqual((await tuples())[0], { ...rawItems[0], alt: 'Explicit edited alt' }); await caption.fill('Explicit edited caption'); assert.deepEqual((await tuples())[0], { ...rawItems[0], alt: 'Explicit edited alt', caption: 'Explicit edited caption' }); await expect(first.locator('[name="gallery_image_alt"]')).toHaveCount(1); await expect(first.locator('[name="gallery_image_caption"]')).toHaveCount(1); await recordDefault({ owner: 'AdminMediaImageField', probe: 'existing-gallery-raw-multiline-metadata', status: 'PASS', singleLineVisibleControls: true, unchangedRawNativeValuesUntilExplicitEdit: true, tabNavigationRetainsRawWithoutDirty: true, explicitEditUpdatesOneNativeValueAndDirty: true });
  }
  const seedLogicalDrafts = async (title, mutation = {}) => {
    await fresh('edit'); await form.locator('[name="title"]').fill(title); await expect.poll(async () => (await records()).length).toBe(1); const first = (await records())[0];
    const second = await page.evaluate(({ draft, mutation }) => { const { api } = window.topicDraftFixture, next = { ...draft, ...mutation, writerId: 'same-logical-other-writer', savedAt: new Date(Date.now() + 60000).toISOString() }, key = api.getTopicFormDraftKey(next.scope, next.writerId), raw = JSON.stringify(next); localStorage.setItem(key, raw); return { key, raw }; }, { ...first, mutation }); await reload(); await expect(page.locator('[data-topic-form-draft-owner]')).toHaveCount(1); return { first, second };
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 }); const seed = await seedLogicalDrafts('One logical recovery choice'), candidates = page.locator('[data-topic-form-draft-key]'); await expect(candidates).toHaveCount(1); await expect(candidates).toHaveAttribute('data-topic-form-draft-alias-count', '2'); await expect(candidates.locator('[data-admin-notice-presentation="compact"]')).toHaveCount(1);
    const storageBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))), nativeBefore = await native(); await shot(candidates, 'draft', 'after', width, 'one-group-two-writers'); await candidates.getByRole('button', { name: 'إغلاق الإشعار', exact: true }).click(); await expect(candidates.locator('[data-admin-notice-presentation="compact"]')).toHaveCount(0); assert.deepEqual(await native(), nativeBefore); assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))), storageBefore); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false');
    await reload(); await expect(candidates).toHaveCount(1); await candidates.locator('[data-topic-form-draft-restore]').click(); await expect(form.locator('[name="title"]')).toHaveValue('One logical recovery choice'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await reload(); await expect(candidates).toHaveCount(1); assert.equal((await records()).length, 2, 'Restoring equivalent writer snapshots never creates another identical writer snapshot'); const beforeDiscard = await native(); await candidates.locator('[data-topic-form-draft-discard]').click(); await expect(candidates).toHaveCount(0); assert.equal((await records()).length, 0); assert.deepEqual(await native(), beforeDiscard);
    const race = await seedLogicalDrafts('CAS logical recovery choice'); await expect(candidates).toHaveCount(1); const newer = await page.evaluate(({ key, draft }) => { const next = { ...draft, savedAt: new Date(Date.now() + 120000).toISOString(), fields: { ...draft.fields, title: ['Newer raw survives logical discard'] } }, raw = JSON.stringify(next); localStorage.setItem(key, raw); return raw; }, race.first); const nativeBeforeRaceDiscard = await native(); await candidates.locator('[data-topic-form-draft-discard]').click(); assert.equal(await page.evaluate(key => localStorage.getItem(key), race.first.key), newer); assert.equal(await page.evaluate(key => localStorage.getItem(key), race.second.key), race.second.raw, 'A changed member blocks the stale logical discard before any exact member is removed'); assert.deepEqual(await native(), nativeBeforeRaceDiscard);
    await seedLogicalDrafts('Distinct payload one', { fields: { ...seed.first.draft.fields, title: ['Distinct payload two'] } }); await expect(candidates).toHaveCount(2); await shot(form, 'draft', 'after', width, 'distinct-payloads-two-choices');
    await seedLogicalDrafts('Distinct baseline revision', { baselineRevision: '2026-10-23T01:00:00Z' }); await expect(candidates).toHaveCount(2);
    await seedLogicalDrafts('Distinct baseline fields', { baselineFields: { ...seed.first.draft.baselineFields, title: ['Other saved baseline'] } }); await expect(candidates).toHaveCount(2);
    noticeCases.push({ width, status: 'PASS', oneOwner: true, identicalWriterSnapshotsOneChoice: true, differentPayloadsTwoChoices: true, differentBaselineRevisionTwoChoices: true, differentBaselineFieldsTwoChoices: true, closeOnlyVisualAndReloadAvailable: true, restoreAndReloadNoIdenticalClone: true, discardAllEligibleExactSnapshots: true, newerRawCasRetained: true, noSourceSave: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); const sourceHashesAtEnd = await readSourceHashes(); assert.deepEqual(sourceHashesAtEnd, sourceHashesAtStart); await recordSourceIdentity(sourceHashesAtEnd);
  const receipt = { status: 'PASS', browser: 'Chromium ' + browser.version(), cases, defaults, noticeCases, sourceSaveResults: slugSaveResults, screenshots, screenshotCount: screenshots.length, sourceHashesAtStart, sourceHashesAtEnd, finiteMediaReads: seoReads, transport: 'Existing actual Article/Gallery consumers compiled in memory; existing source save owners and disposable PGlite; finite media read responses only.', hostedDatabaseWrites: 0, serverStarted: false, ownerApproval: 'PENDING', globalClosed: false };
  await writeFile(path.join(output, 'unified-image-browser.json'), JSON.stringify(receipt, null, 2)); console.log('PASS Unified Image System ' + JSON.stringify({ cases: cases.length, defaults: defaults.length, sourceSaves: slugSaveResults.length, screenshots: screenshots.length }));
}

async function verifyDraftNoticeUnification(context) {
  const { page, browser, open, errors, forbidden, output, sourceHashesAtStart, readSourceHashes, recordSourceIdentity, slugSaveResults } = context;
  const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(output, { recursive: true });
  const cases = [], defaults = [], screenshots = [], form = page.locator('form[data-admin-form-runtime]');
  const compact = wrapper => wrapper.locator('[data-admin-notice-presentation="compact"]');
  const pending = () => page.locator('[data-topic-form-draft-key]').first();
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const storage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
  const records = () => page.evaluate(() => Object.keys(localStorage).flatMap(key => { try { const record = JSON.parse(localStorage.getItem(key)); return record?.version === 2 && record.fields ? [{ key, record }] : []; } catch { return []; } }));
  const snapshot = async (target = form) => ({ storage: await storage(), native: await target.evaluate(form => [...new FormData(form)].map(([name, value]) => [name, typeof value === 'string' ? value : { name: value.name, size: value.size, type: value.type }]).sort(([a], [b]) => a.localeCompare(b))), dirty: await target.getAttribute('data-admin-form-dirty'), url: page.url(), saves: await page.evaluate(() => window.topicSaveAttempts ?? 0) });
  const reload = async () => { const leave = dialog => dialog.accept(); page.on('dialog', leave); try { await page.reload(); } finally { page.off('dialog', leave); } await expect(form).toHaveCount(1); await settle(); };
  const fresh = async () => { await page.clock.setFixedTime('2026-10-24T12:00:00.000Z'); await open('edit'); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await reload(); await expect(form.locator('[name="title"]')).toBeEditable(); };
  const seedPending = async (title = 'Local notice candidate') => { await fresh(); await form.locator('[name="title"]').fill(title); await expect.poll(async () => (await records()).some(({ record }) => record.fields.title?.[0] === title)).toBe(true); const candidate = (await records()).find(({ record }) => record.fields.title?.[0] === title); await reload(); await expect(pending()).toHaveAttribute('data-topic-form-draft', 'pending'); return candidate; };
  const shot = async (notice, state, width) => { await notice.scrollIntoViewIfNeeded(); const file = path.join(output, `${state}-${width}-rtl.png`); await notice.screenshot({ path: file }); screenshots.push({ state, width, direction: 'rtl', path: file }); };
  const geometry = async (notice, state, width) => {
    await expect(notice).toBeVisible(); await expect(notice.locator('[data-admin-notice-icon]')).toHaveCount(1); await expect(notice.locator('[data-admin-notice-message]')).toHaveCount(1);
    const result = await notice.evaluate(root => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, cy: r.y + r.height / 2 }; }, row = root.querySelector('[data-admin-notice-row]'), message = root.querySelector('[data-admin-notice-message]'), icon = root.querySelector('[data-admin-notice-icon]'), close = root.querySelector('button[aria-label="إغلاق الإشعار"]'), actions = [...root.querySelectorAll('[data-admin-notice-actions] button, [data-admin-notice-actions] time')];
      return { direction: getComputedStyle(root).direction, box: box(root), row: box(row), message: box(message), icon: box(icon), close: box(close), actions: actions.map(box), messageWhiteSpace: getComputedStyle(message).whiteSpace, noticeOverflow: root.scrollWidth > root.clientWidth + 1, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1, messageText: message.textContent, closeLabel: close.getAttribute('aria-label') };
    });
    assert.equal(result.direction, 'rtl'); assert.equal(result.noticeOverflow, false, state + ' notice has no horizontal overflow'); assert.equal(result.documentOverflow, false); assert.ok(result.box.x >= -1 && result.box.right <= width + 1); assert.ok(result.close.x < result.message.x, state + ' Close remains at the physical left'); assert.ok(result.message.x >= result.close.right - 1 || result.message.y >= result.close.bottom - 1, state + ' message does not overlap Close');
    for (const control of result.actions) assert.ok(control.x >= result.box.x - 1 && control.right <= result.box.right + 1 && !(control.x < result.close.right && control.right > result.close.x && control.y < result.close.bottom && control.bottom > result.close.y), state + ' actions fit without Close overlap');
    if (width >= 1024) { assert.equal(result.messageWhiteSpace, 'nowrap'); for (const control of [result.icon, result.message, ...result.actions, result.close]) assert.ok(Math.abs(control.cy - result.row.cy) <= 2, state + ' Desktop icon/message/actions/Close share one horizontal row'); assert.ok(result.row.height <= 44, state + ' Desktop main row is compact'); }
    await shot(notice, state, width); return result;
  };
  const closeOnly = async (notice, target = form) => { const before = await snapshot(target); await notice.getByRole('button', { name: 'إغلاق الإشعار', exact: true }).click(); await expect(notice).toHaveCount(0); await settle(); assert.deepEqual(await snapshot(target), before, 'Visual Close does not mutate local bytes, native values, Dirty, URL or save attempts'); return true; };
  const record = async (state, width, notice, extra = {}, target = form) => { console.log('Draft notice targeted ' + state + ' RTL ' + width); const measured = await geometry(notice, state, width); await closeOnly(notice, target); cases.push({ state, width, direction: 'rtl', status: 'PASS', geometry: measured, closeOnlyPreservesStorageNativeDirtyUrlAndSaveAttempts: true, ...extra }); await writeFile(path.join(output, 'browser-progress.json'), JSON.stringify({ status: 'IN_PROGRESS', cases, defaults, screenshots, sourceHashesAtStart, globalClosed: false }, null, 2)); };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    const candidate = await seedPending(); await record('pending', width, compact(pending()), { identityBoundCandidate: true });
    await expect(pending()).toHaveAttribute('data-topic-form-draft-dismissed', 'true'); await form.evaluate(form => form.requestSubmit()); await expect(compact(pending())).toBeVisible(); await expect(pending().locator('[data-topic-form-draft-restore]')).toBeFocused(); assert.equal(await page.evaluate(() => window.topicSaveAttempts ?? 0), 0, 'A hidden unresolved candidate still blocks save and reveals the choice'); await reload(); await expect(compact(pending())).toBeVisible(); assert.equal((await storage())[candidate.key], JSON.stringify(candidate.record));
    await pending().locator('[data-topic-form-draft-restore]').click(); const restored = page.locator('[data-topic-form-draft="restored"]'); await expect(form.locator('[name="title"]')).toHaveValue('Local notice candidate'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); await record('restored', width, compact(restored), { explicitRestoreUpdatesFormAndDirty: true });
    const discardable = await seedPending('Eligible discard notice title'), beforeValidDiscard = await snapshot(); await pending().locator('[data-topic-form-draft-discard]').click(); await expect(page.locator('[data-topic-form-draft-key]')).toHaveCount(0); assert.equal((await storage())[discardable.key], undefined); const afterValidDiscard = await snapshot(); assert.deepEqual(afterValidDiscard.native, beforeValidDiscard.native); assert.equal(afterValidDiscard.dirty, beforeValidDiscard.dirty); cases.find(row => row.width === width && row.state === 'pending').eligibleDiscardRemovesExactSelectedSnapshotOnly = true;

    await seedPending('Conflicting local notice title'); await open('edit', { 'server-revision': '2026-10-24T13:00:00Z', 'server-title': 'Newer saved notice title' }); await expect(pending()).toHaveAttribute('data-topic-form-draft', 'conflict'); await expect(page.locator('[data-topic-form-draft-field-conflict="title"]')).toHaveCount(1); await record('conflict', width, compact(pending()), { canonicalConflictChoiceRetained: true }); await reload(); await expect(form.locator('[name="title"]')).toHaveValue('Newer saved notice title'); await pending().locator('[data-topic-form-draft-restore]').click(); await expect(form.locator('[name="title"]')).toHaveValue('Newer saved notice title'); await record('retained-conflict-restored', width, compact(page.locator('[data-topic-form-draft="restored"]')), { savedDefaultAndOriginalDraftRetained: true });

    for (const kind of ['legacy', 'unsupported']) {
      await fresh(); const opaqueRecord = await page.evaluate(kind => { const { api, session } = window.topicDraftFixture, scope = { ...session, contentType: 'article', entity: '991' }, key = kind === 'legacy' ? 'venesia-topic-editor-draft:topic:article:991' : api.getTopicFormDraftKey(scope, 'future-notice-writer'), raw = kind === 'legacy' ? 'OPAQUE_PRIVATE_LEGACY_BODY_NEVER_EXPOSE' : JSON.stringify({ version: 77, fieldVersion: 9, scope, fields: { title: ['OPAQUE_PRIVATE_FUTURE_TITLE_NEVER_EXPOSE'] } }); localStorage.setItem(key, raw); return { key, raw }; }, kind); await reload();
      const opaque = page.locator('[data-topic-form-draft-opaque]'); await expect(opaque).toHaveCount(1); await expect(opaque.locator('[data-topic-form-draft-restore]')).toHaveCount(0); assert.equal((await page.locator('body').innerText()).includes('OPAQUE_PRIVATE'), false); await record('opaque-' + kind, width, compact(opaque), { noPayloadExposureOrRestore: true }); await expect(opaque).toHaveAttribute('data-topic-form-draft-dismissed', 'true'); await reload(); await expect(compact(opaque)).toBeVisible(); assert.equal((await storage())[opaqueRecord.key], opaqueRecord.raw); const beforeDiscard = await snapshot(); await opaque.locator('[data-topic-form-draft-discard]').click(); await expect(opaque).toHaveCount(0); assert.equal((await storage())[opaqueRecord.key], undefined); const afterDiscard = await snapshot(); assert.deepEqual(afterDiscard.native, beforeDiscard.native); assert.equal(afterDiscard.dirty, beforeDiscard.dirty);
      await fresh(); await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), opaqueRecord); await reload(); await page.evaluate(({ key }) => localStorage.setItem(key, 'NEWER_PRIVATE_OPAQUE_RAW_NEVER_EXPOSE'), opaqueRecord); await opaque.locator('[data-topic-form-draft-discard]').click(); await expect(page.locator('[data-topic-form-draft="unavailable"]')).toHaveCount(1); assert.equal((await storage())[opaqueRecord.key], 'NEWER_PRIVATE_OPAQUE_RAW_NEVER_EXPOSE'); assert.equal((await page.locator('body').innerText()).includes('NEWER_PRIVATE_OPAQUE'), false); cases.at(-1).exactRawDiscardFence = true; cases.at(-1).eligibleDiscardRemovesOnlyExactOpaqueSnapshot = true; cases.at(-1).remountRevealsRetainedOpaque = true;
    }
    await record('unavailable', width, compact(page.locator('[data-topic-form-draft="unavailable"]')), { newerRawPreserved: true });

    await fresh(); await form.locator('[name="title"]').fill('Current notice title'); await form.locator('[data-admin-tab-id="seo"]').click(); await form.locator('[name="canonical_url"]').fill('https://example.test/temporary?token=NEVER_STORE_NOTICE_SECRET'); const excluded = page.locator('[data-topic-form-draft-excluded]'); await expect(excluded).toHaveAttribute('data-topic-form-draft-excluded', /canonical_url/); assert.equal(JSON.stringify(await storage()).includes('NEVER_STORE_NOTICE_SECRET'), false); await record('excluded', width, compact(excluded), { sensitiveUrlValueNotStored: true });

    await seedPending('File guarded notice title'); await form.evaluate(form => { const input = document.createElement('input'); input.type = 'file'; input.name = 'image'; input.dataset.noticeFixtureFile = ''; form.append(input); }); await form.locator('[data-notice-fixture-file]').setInputFiles({ name: 'finite-notice.txt', mimeType: 'text/plain', buffer: Buffer.from('UNSTORED_NOTICE_FILE') }); await pending().locator('[data-topic-form-draft-restore]').click(); const blocked = page.locator('[data-topic-form-draft-restore-blocked]'); await expect(blocked).toHaveCount(1); await record('restore-blocked', width, compact(blocked), { selectedFilePreservedAndNotStored: true }); assert.equal(await form.locator('[data-notice-fixture-file]').evaluate(input => input.files.length), 1); assert.equal(JSON.stringify(await storage()).includes('UNSTORED_NOTICE_FILE'), false);

    await fresh(); await form.locator('[name="title"]').fill('Expiring notice title'); await expect.poll(async () => (await records()).length).toBe(1); const expires = await page.evaluate(() => window.topicDraftFixture.session.expiresAt); await page.clock.setFixedTime(expires + 1); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect.poll(async () => (await records()).length).toBe(0); const expired = page.locator('[data-topic-form-draft-owner]').locator('[data-admin-notice-presentation="compact"]').filter({ hasText: 'انتهت الجلسة' }); await record('expired', width, expired, { sessionEndCleanupAndNoIdentityBypass: true });

    // Exercise the same file's retained Markdown-only mode, with its real
    // read-only editor and native submit gate, without a second draft owner.
    await fresh(); const legacyKey = 'venesia-topic-editor-draft:notice-legacy-991'; await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, content: 'مسودة Markdown قديمة', baselineRevision: 'old-revision', savedAt: '2026-10-22T00:00:00Z' })), legacyKey); await page.evaluate(() => window.mountLegacyDraftNoticeFixture()); const legacyForm = page.locator('[data-legacy-draft-notice-fixture]'), legacy = page.locator('[data-topic-draft-conflict]'); await expect(legacy).toHaveCount(1); await expect(page.getByRole('textbox', { name: 'نص المقال', exact: true })).toHaveAttribute('contenteditable', 'false'); await record('legacy-markdown-pending', width, compact(legacy), { originalMarkdownRecoveryContract: true }, legacyForm); const blockedSubmit = await legacyForm.evaluate(form => !form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); assert.equal(blockedSubmit, true); await expect(compact(legacy)).toBeVisible(); await expect(legacy.locator('[data-topic-draft-restore]')).toBeFocused(); await legacy.locator('[data-topic-draft-restore]').click(); await expect(page.getByRole('textbox', { name: 'نص المقال', exact: true })).toBeEditable(); await expect(legacyForm.locator('[name="content"]')).toHaveValue(/مسودة Markdown قديمة/); await record('legacy-markdown-restored', width, legacyForm.locator('[data-admin-notice-presentation="compact"]'), { explicitRestoreRetainsMarkdown: true }, legacyForm);

    await fresh(); await open('edit', { 'notice-probes': '1', 'notice-direction': 'rtl' }); const probes = page.locator('[data-topic-notice-probes]'); await expect(probes).toBeVisible(); await expect(probes.locator('[data-admin-notice-presentation="compact"]')).toHaveCount(0); await expect(probes.locator('[data-admin-notice-icon]')).toHaveCount(0); for (const id of ['stacked-dismissible', 'inline-dismissible', 'stacked-nondismissible']) { const probe = probes.locator('[data-topic-notice-probe="' + id + '"]'), notice = probe.locator('[data-admin-notice-dismissible]'); await expect(notice).toHaveAttribute('data-admin-notice-layout', id.startsWith('inline') ? 'inline' : 'stacked'); await expect(notice).toHaveAttribute('data-admin-notice-dismissible', String(!id.endsWith('nondismissible'))); defaults.push({ id, width, status: 'PASS', omittedPresentationKeepsExistingLayoutAndNoIcon: true }); } await shot(probes, 'admin-notice-unchanged-defaults', width);
  }
  assert.equal(cases.length, 24); assert.equal(defaults.length, 6); assert.equal(slugSaveResults.length, 0); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); const sourceHashesAtEnd = await readSourceHashes(); assert.deepEqual(sourceHashesAtEnd, sourceHashesAtStart, 'Notice sources remain frozen from pre-webpack capture'); await recordSourceIdentity(sourceHashesAtEnd);
  const receipt = { status: 'PASS', browser: 'Chromium/Chrome ' + browser.version(), browserCases: cases, defaultCases: defaults, screenshots, screenshotCount: screenshots.length, sourceSaveResults: slugSaveResults, sourceHashesAtStart, sourceHashesAtEnd, sourceIdentity: path.join(output, 'browser-source-identity.json'), transport: 'Existing canonical in-memory fixture mounts actual Article Edit and the retained Markdown-only mode from TopicMarkdownEditor. Browser storage and finite media reads only; no save transport invoked, no DB writes, no Auth/RLS changes.', serverStarted: false, hostedDatabaseWrites: 0, fullDraftMatrixRerun: false, globalClosed: false };
  await writeFile(path.join(output, 'draft-notice-browser.json'), JSON.stringify(receipt, null, 2)); console.log('PASS Draft notice unification ' + JSON.stringify({ cases: cases.length, defaults: defaults.length, screenshots: screenshots.length, sourceSaves: slugSaveResults.length }));
}

async function verifyTopicContentPresentation() {
  const fixtureRoot = process.cwd(), fixtureRequire = createRequire(import.meta.url), project = fixtureRoot.replaceAll('\\', '/');
  const fieldsOnly = process.argv.includes('--topic-content-fields-only');
  const reviewOnly = process.argv.includes('--topic-review-only');
  const seoOnly = process.argv.includes('--topic-seo-only');
  const fullFormDraftOnly = process.argv.includes('--full-form-draft-only');
  const contentPanelGalleryOnly = process.argv.includes('--content-panel-gallery-only');
  const draftNoticeOnly = process.argv.includes('--draft-notice-only');
  const unifiedImageOnly = process.argv.includes('--unified-image-only');
  const recoveryFixture = fullFormDraftOnly || contentPanelGalleryOnly || draftNoticeOnly || unifiedImageOnly;
  const draftFirstCaseOnly = fullFormDraftOnly && process.argv.includes('--draft-first-case');
  const draftBoundariesOnly = fullFormDraftOnly && process.argv.includes('--draft-boundaries-only');
  const videoOnly = process.argv.includes('--video-panel-only'), mediaTabsOnly = process.argv.includes('--media-tabs-only'), slugAuditOnly = process.argv.includes('--slug-audit-only') || process.argv.includes('--slug-system-only'), videoTransport = videoOnly || mediaTabsOnly || slugAuditOnly || recoveryFixture, mediaFixture = seoOnly || videoTransport;
  const slugRegressionProbe = process.argv.find(value => value.startsWith('--slug-regression-probe='))?.slice('--slug-regression-probe='.length);
  const slugMountedSaveOnly = process.argv.includes('--slug-mounted-save-probe');
  if (slugRegressionProbe) assert.ok(slugAuditOnly && ['typing', 'observers', 'conflict', 'finalization'].includes(slugRegressionProbe), 'Choose an existing Slug regression probe');
  // Bind evidence to the owner/helper bytes present before webpack reads them.
  const slugOwnerFiles = ['scripts/qa-home-story-presentation.mjs', 'scripts/fixtures/remaining-content-owner-harness.mjs', 'src/lib/admin/slug.ts', 'src/lib/admin/content/topic-write-errors.ts', 'src/components/admin/content/editors/article/TopicSlugInput.tsx', 'src/components/admin/content/editors/ContentEditorShell.tsx', 'src/components/admin/content/editors/ContentBasicDataPanel.tsx', 'src/components/admin/content/editors/ArticleCreateEditor.tsx', 'src/components/admin/content/editors/ArticleEditor.tsx', 'src/components/admin/content/editors/media/MediaContentForm.tsx', 'src/components/admin/ui/AdminFormRuntime.tsx', 'src/components/admin/seo/AdminEntitySeoPanel.tsx', 'src/lib/admin/content/topic-revision.ts', 'src/app/admin/content/topics/article-actions/helpers.ts', 'src/app/admin/content/topics/article-actions/save.ts', 'src/app/admin/content/topics/article-actions/create-domain.ts', 'src/app/admin/content/topics/article-actions/validation.ts', 'src/app/admin/content/topics/media-actions/helpers.ts', 'src/app/admin/content/topics/media-actions/save.ts', 'src/app/admin/content/topics/media-actions/validation.ts'];
  const readSlugSourceHashes = async () => Object.fromEntries(await Promise.all(slugOwnerFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')])));
  const slugSourceHashesAtStart = slugAuditOnly ? await readSlugSourceHashes() : undefined;
  const slugSourceIdentityRoot = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/slug-system-repair-20261023');
  const slugSourceIdentityPath = path.join(slugSourceIdentityRoot, (slugRegressionProbe ? 'negative-' + slugRegressionProbe : slugMountedSaveOnly ? 'mounted-save' : 'positive') + '-source-identity.json');
  const slugStartedAt = new Date().toISOString();
  const recordSlugSourceIdentity = async end => {
    const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(slugSourceIdentityRoot, { recursive: true });
    const stable = end ? JSON.stringify(end) === JSON.stringify(slugSourceHashesAtStart) : null;
    await writeFile(slugSourceIdentityPath, JSON.stringify({ status: end ? stable ? 'STABLE' : 'SOURCE_CHANGED' : 'STARTED_BEFORE_WEBPACK', startedAt: slugStartedAt, endedAt: end ? new Date().toISOString() : null, mutation: slugRegressionProbe ?? null, sourceHashesAtStart: slugSourceHashesAtStart, sourceHashesAtEnd: end ?? null, sourceIdentityStable: stable, globalClosed: false }, null, 2));
  };
  if (slugAuditOnly) await recordSlugSourceIdentity();
  const draftEvidenceRoot = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/full-form-draft-recovery-20261024');
  const draftOwnerFiles = [...new Set([...slugOwnerFiles, 'src/components/admin/content/editors/article/TopicMarkdownEditor.tsx', 'src/components/admin/content/editors/media/MediaVideoFields.tsx', 'src/components/admin/media/AdminMediaGalleryField.tsx', 'src/components/admin/content/editors/article/FaqEditor.tsx', 'src/components/admin/content/editors/article/TopicDateLabelField.tsx', 'src/components/admin/content/editors/ContentPublishingOptions.tsx', 'src/components/admin/content/editors/content-form-definition.ts', 'src/components/admin/content-workflow/ContentReviewPanel.tsx', 'src/components/admin/AdminShell.tsx', 'src/lib/admin/content/topic-draft-session.ts', 'src/components/admin/AdminNotice.tsx', 'src/components/admin/AdminNoticeDismissibleFrame.tsx', 'package.json', 'scripts/verify-unified-content-editors-adoption.mts'])];
  const readDraftSourceHashes = async () => Object.fromEntries(await Promise.all(draftOwnerFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')])));
  const draftStartedAt = new Date().toISOString(), draftSourceHashesAtStart = fullFormDraftOnly ? await readDraftSourceHashes() : null;
  const recordDraftSourceIdentity = async end => {
    const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(draftEvidenceRoot, { recursive: true });
    const stable = end ? JSON.stringify(end) === JSON.stringify(draftSourceHashesAtStart) : null;
    await writeFile(path.join(draftEvidenceRoot, draftFirstCaseOnly ? 'draft-first-case-source-identity.json' : draftBoundariesOnly ? 'draft-boundaries-source-identity.json' : 'draft-browser-source-identity.json'), JSON.stringify({ status: end ? stable ? 'STABLE' : 'SOURCE_CHANGED' : 'STARTED_BEFORE_WEBPACK', startedAt: draftStartedAt, endedAt: end ? new Date().toISOString() : null, sourceHashesAtStart: draftSourceHashesAtStart, sourceHashesAtEnd: end ?? null, sourceIdentityStable: stable, globalClosed: false }, null, 2));
  };
  if (fullFormDraftOnly) await recordDraftSourceIdentity();
  const panelGalleryEvidenceRoot = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/content-panel-gallery-final-20261024');
  const panelGalleryOwnerFiles = [...new Set([...draftOwnerFiles, 'src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx', 'src/components/admin/review/AdminEntityReviewPanel.tsx', 'src/components/admin/ui/AdminDataGrid.tsx', 'src/components/admin/media/AdminMediaImageField.tsx', 'src/components/admin/media/AdminMediaPickerModal.tsx', 'src/lib/admin/media-topic-payload.ts', 'src/lib/content/public-content-read/owner.ts', 'src/lib/media-center/adapt-topic-row.ts', 'src/components/media-center/MediaDetailArticle.tsx', 'src/components/media-center/MediaVideoPlayback.tsx', 'src/components/admin/page-blocks/AdminImagePathListField.tsx', 'src/components/admin/projects/tracking/TrackingForms.tsx', 'src/app/globals.css'])];
  const readPanelGallerySourceHashes = async () => Object.fromEntries(await Promise.all(panelGalleryOwnerFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')])));
  const panelGalleryStartedAt = new Date().toISOString(), panelGallerySourceHashesAtStart = contentPanelGalleryOnly ? await readPanelGallerySourceHashes() : null;
  const recordPanelGallerySourceIdentity = async end => {
    const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(panelGalleryEvidenceRoot, { recursive: true });
    await writeFile(path.join(panelGalleryEvidenceRoot, 'browser-source-identity.json'), JSON.stringify({ status: end ? JSON.stringify(end) === JSON.stringify(panelGallerySourceHashesAtStart) ? 'STABLE' : 'SOURCE_CHANGED' : 'STARTED_BEFORE_WEBPACK', startedAt: panelGalleryStartedAt, endedAt: end ? new Date().toISOString() : null, sourceHashesAtStart: panelGallerySourceHashesAtStart, sourceHashesAtEnd: end ?? null, globalClosed: false }, null, 2));
  };
  if (contentPanelGalleryOnly) await recordPanelGallerySourceIdentity();
  const draftNoticeEvidenceRoot = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/draft-notice-unification-20261024');
  const draftNoticeOwnerFiles = [...new Set([...draftOwnerFiles, 'src/lib/admin/form-system/adoption-manifest.ts', 'scripts/verify-admin-form-system.mts', 'scripts/verify-admin-entity-list.mjs'])];
  const readDraftNoticeSourceHashes = async () => Object.fromEntries(await Promise.all(draftNoticeOwnerFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')])));
  const draftNoticeStartedAt = new Date().toISOString(), draftNoticeSourceHashesAtStart = draftNoticeOnly ? await readDraftNoticeSourceHashes() : null;
  const recordDraftNoticeSourceIdentity = async end => {
    const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(draftNoticeEvidenceRoot, { recursive: true });
    await writeFile(path.join(draftNoticeEvidenceRoot, 'browser-source-identity.json'), JSON.stringify({ status: end ? JSON.stringify(end) === JSON.stringify(draftNoticeSourceHashesAtStart) ? 'STABLE' : 'SOURCE_CHANGED' : 'STARTED_BEFORE_WEBPACK', startedAt: draftNoticeStartedAt, endedAt: end ? new Date().toISOString() : null, sourceHashesAtStart: draftNoticeSourceHashesAtStart, sourceHashesAtEnd: end ?? null, globalClosed: false }, null, 2));
  };
  if (draftNoticeOnly) await recordDraftNoticeSourceIdentity();
  const unifiedImageEvidenceRoot = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/unified-image-system-20261024', ...(process.argv.includes('--unified-image-draft-before-only') ? ['draft-duplicate-before'] : []));
  const unifiedImageOwnerFiles = [...new Set([...panelGalleryOwnerFiles, 'src/components/admin/content/editors/article/TopicImageField.tsx', 'src/components/admin/media/AdminMediaSlotGuidance.tsx', 'src/components/admin/media/AdminDeletedMediaNotice.tsx', 'src/lib/media/media-slot-contract.ts', 'src/lib/media-center/detail-page-config.ts', 'src/lib/admin/admin-ui-styles.ts', 'scripts/verify-page-block-editor-presentation.mts', 'scripts/verify-topic-editor-basic-data.mjs'])];
  const readUnifiedImageSourceHashes = async () => Object.fromEntries(await Promise.all(unifiedImageOwnerFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')])));
  const unifiedImageStartedAt = new Date().toISOString(), unifiedImageSourceHashesAtStart = unifiedImageOnly ? await readUnifiedImageSourceHashes() : null;
  const recordUnifiedImageSourceIdentity = async end => {
    const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(unifiedImageEvidenceRoot, { recursive: true });
    await writeFile(path.join(unifiedImageEvidenceRoot, 'browser-source-identity.json'), JSON.stringify({ status: end ? JSON.stringify(end) === JSON.stringify(unifiedImageSourceHashesAtStart) ? 'STABLE' : 'SOURCE_CHANGED' : 'STARTED_BEFORE_WEBPACK', startedAt: unifiedImageStartedAt, endedAt: end ? new Date().toISOString() : null, sourceHashesAtStart: unifiedImageSourceHashesAtStart, sourceHashesAtEnd: end ?? null, globalClosed: false }, null, 2));
  };
  if (unifiedImageOnly) await recordUnifiedImageSourceIdentity();
  const dataModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import Create from '${project}/src/components/admin/content/editors/ArticleCreateEditor.tsx';
import Edit from '${project}/src/components/admin/content/editors/ArticleEditor.tsx';
import Media from '${project}/src/components/admin/content/editors/media/MediaContentForm.tsx';
import Rich from '${project}/src/components/admin/AdminRichTextEditor.tsx';
import Display from '${project}/src/components/admin/content/editors/ContentDisplaySettings.tsx';
import{buildContentReviewChecks}from'${project}/src/lib/admin/content-workflow/content-review-capability.ts';
import{parseVideoPayloadFromForm,parseMediaPayloadFromForm}from'${project}/src/lib/admin/media-topic-payload.ts';
import{getEntityReviewScore}from'${project}/src/lib/admin/review/entity-review-presentation.ts';
import{formatAdminDateTime}from'${project}/src/lib/content-dates.ts';
import * as topicDraftApi from '${project}/src/lib/admin/content/topic-revision.ts';
import{ENTITY_SEO_FIELD_NAMES,readEntitySeoFormData}from'${project}/src/lib/seo/entity-seo-types.ts';
import{AdminModuleSectionHeader}from'${project}/src/components/admin/ui/AdminModuleTabs.tsx';
import Feedback from '${project}/src/components/admin/AdminFeedbackProvider.tsx';
import Notice from '${project}/src/components/admin/AdminNotice.tsx';
import Markdown from '${project}/src/components/admin/content/editors/article/TopicMarkdownEditor.tsx';
import Gallery from '${project}/src/components/admin/media/AdminMediaGalleryField.tsx';
import ImageField from '${project}/src/components/admin/media/AdminMediaImageField.tsx';
import HeroGallery from '${project}/src/components/admin/page-blocks/AdminImagePathListField.tsx';
import MediaDetailArticle from '${project}/src/components/media-center/MediaDetailArticle.tsx';
import {MEDIA_DETAIL_PAGE_CONFIG} from '${project}/src/lib/media-center/detail-page-config.ts';
import{SearchParamsContext,PathnameContext}from'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import{AppRouterContext}from'next/dist/shared/lib/app-router-context.shared-runtime.js';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'create';
const draftProps=params.has('full-form-draft')?{draftSession:{actorId:Number(params.get('actor')??1),sessionVersion:Number(params.get('session')??1),expiresAt:Number(params.get('expires')??${Date.parse('2026-10-24T13:00:00.000Z')})}}:{};
const isVideo=mode.startsWith('video-'),isGallery=mode.startsWith('gallery-'),isEdit=mode.endsWith('edit'),textMediaType=['news','press','site_update'].find(type=>mode.startsWith(type+'-')),mediaType=isVideo?'video':isGallery?'gallery':textMediaType||'news';
const categories=[{id:17,name:'تصنيف تجريبي',slug:'fixture',parent_id:null,depth:0,sort_order:1,is_active:true,status:'published'},{id:18,name:'تصنيف غير متاح',slug:'disabled-fixture',parent_id:null,depth:0,sort_order:2,is_active:false,status:'draft'}],series=[{id:187,name:'سلسلة تجريبية',slug:'fixture-series',category_id:17}];
const topic={id:991,title:'موضوع الاختبار',slug:'fixture-topic',excerpt:'مقتطف محفوظ',content:'نص المقال المحفوظ',image:null,image_alt:null,category_id:17,category_slug:'fixture',series_id:187,series:'سلسلة تجريبية',series_slug:'fixture-series',date_label:null,faq:[],seo_title:null,seo_description:null,seo_keywords:[],focus_keyword:null,status:'unpublished',published_at:null,updated_at:'2026-10-23T00:00:00Z',is_featured:false,is_popular:false,show_title_on_page:false,show_image_on_page:true,show_category_on_page:false,show_series_on_page:true,show_excerpt_on_page:true,show_date_on_page:false,show_intro_card_on_page:false};
if(params.get('review-state')==='published')Object.assign(topic,{status:'published',published_at:'2026-10-20T11:22:00Z',date_label:'2026-10-19'});
if(params.has('seo-fixture'))Object.assign(topic,{og_image:'/fixture.svg',og_image_alt:'وصف صورة المشاركة المحفوظ',robots_index:false,robots_follow:true,canonical_url:'https://example.test/fixture-topic',seo_keywords:['عقارات']});
if(params.has('slug-audit'))topic.canonical_url=null;
if(params.has('full-form-draft')){topic.id=Number(params.get('record')??991);if(params.has('server-revision'))topic.updated_at=params.get('server-revision');if(params.has('server-title'))topic.title=params.get('server-title');}
if(isVideo)Object.assign(topic,{content:'',media_payload:{kind:'video',provider:'youtube',video_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',duration:'3:45',thumbnail:'/fixture.svg'}});
if(isGallery)Object.assign(topic,{content:'',media_payload:{kind:'gallery',images:[{url:'/fixture.svg',alt:'وصف الصورة المحفوظة',caption:'تعليق محفوظ'},{url:'/fixture-replacement.svg',alt:'وصف الصورة الثانية',caption:'تعليق ثان'}]}});
// Slug readback seeds model canonical persisted rich-media covers. The existing
// save owner already fills these from video thumbnail / first gallery image.
if((params.has('slug-audit')||params.has('full-form-draft'))&&isVideo)topic.image=topic.media_payload.thumbnail;
if((params.has('slug-audit')||params.has('full-form-draft'))&&isGallery)Object.assign(topic,{image:topic.media_payload.images[0].url,image_alt:topic.media_payload.images[0].alt});
if(window.topicMemorySaved){const saved=new FormData();window.topicMemorySaved.forEach(([name,value])=>saved.append(name,value));Object.assign(topic,Object.fromEntries(saved),{content_type:isVideo?'video':'gallery',category_id:Number(saved.get('category_id'))||null,series_id:Number(saved.get('series_id'))||null,media_payload:parseMediaPayloadFromForm(isVideo?'video':'gallery',saved)});for(const name of Object.keys(topic).filter(name=>name.startsWith('show_')||name==='is_featured'||name==='is_popular'))topic[name]=saved.has(name);}
if(window.topicSlugSaved)Object.assign(topic,window.topicSlugSaved);
window.topicFixtureSeed=topic;
if(params.has('full-form-draft'))window.topicDraftFixture={api:topicDraftApi,session:draftProps.draftSession};
window.seoFixture={names:ENTITY_SEO_FIELD_NAMES,read:()=>readEntitySeoFormData(new FormData(document.querySelector('form[data-admin-form-runtime]')))};
window.reviewFixture={savedAt:formatAdminDateTime(topic.updated_at),publishedAt:topic.published_at?formatAdminDateTime(topic.published_at):null,analysis(){const form=document.querySelector('form[data-admin-form-runtime]'),data=new FormData(form),field=name=>String(data.get(name)??''),checks=buildContentReviewChecks({contentType:isVideo?'video':'article',title:field('title'),slug:field('slug'),excerpt:field('excerpt'),content:field('content'),image:field('image'),imageAlt:field('image_alt'),categorySlug:field('category_id'),seoTitle:field('seo_title'),seoDescription:field('seo_description'),focusKeyword:field('focus_keyword'),canonicalUrl:field('canonical_url'),ogImage:field('og_image'),ogImageAlt:field('og_image_alt'),faq:[...form.querySelectorAll('input[name="faq_question"]')].map((question,index)=>({question:question.value,answer:form.querySelectorAll('textarea[name="faq_answer"]')[index]?.value??''})),mediaPayload:isVideo?parseVideoPayloadFromForm(data):null});return{score:getEntityReviewScore(checks),checks}}};
const blocked=href=>{if(params.has('capture-navigation')){window.topicNavigations??=[];window.topicNavigations.push(href);return;}throw Error('Topic fixture forbids navigation')},router={push:blocked,replace:blocked,refresh:blocked,back:blocked,forward:blocked,prefetch:async()=>{}};
const headerDefaults=<div className="space-y-4">{['default','control','panel'].map(presentation=><AdminModuleSectionHeader key={presentation} id={'fixture-'+presentation} sectionHeading={'عنوان '+presentation} sectionDescription="وصف الهيدر الافتراضي" icon="content" sectionHeaderPresentation={presentation} sectionSummary={<button type="button" onClick={()=>{window.ownerSummaryClicks=(window.ownerSummaryClicks||0)+1}}>{'إجراء '+presentation}</button>}/>)}</div>;
const noticeProbeMessage='استُعيدت المسودة محليًا. راجع التغييرات ثم احفظها عند الاستعداد. هذه رسالة طويلة للتحقق من التفاف النص وسلامة زر الإغلاق في الواجهات العربية والإنجليزية. Recovery keeps current local values until explicit save.';
const noticeProbes=<div data-topic-notice-probes="" dir={params.get('notice-direction')||'rtl'} className="space-y-4"><section data-topic-notice-probe="stacked-dismissible"><Notice title="مراجعة استعادة المسودة" message={noticeProbeMessage} lifecycle="manual" dismissSearchParams={[]}/></section><section data-topic-notice-probe="inline-dismissible"><Notice title="تنبيه" message={noticeProbeMessage} layout="inline" lifecycle="manual" dismissSearchParams={[]}/></section><section data-topic-notice-probe="stacked-nondismissible"><Notice title="مراجعة ثابتة" message={noticeProbeMessage} dismissible={false}/></section></div>;
const fixtureReactRoot=createRoot(document.getElementById('root'));window.mountLegacyDraftNoticeFixture=()=>fixtureReactRoot.render(<Feedback><form data-legacy-draft-notice-fixture=""><Markdown presentation="panel" defaultValue="نص Markdown المحفوظ" draftIdentity="notice-legacy-991" baselineRevision="2026-10-23T00:00:00Z"/></form></Feedback>);const renderTopicFixture=()=>fixtureReactRoot.render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)}><AppRouterContext.Provider value={router}><PathnameContext.Provider value={isEdit?'/admin/content/topics/991':'/admin/content/topics/new'}><Feedback>{params.has('full-form-draft')&&params.has('notice-probes')?noticeProbes:mode==='header-defaults'?headerDefaults:mode.startsWith('media-')||textMediaType||isVideo||isGallery?<Media {...draftProps} mode={isEdit?'edit':'create'} contentType={mediaType} values={isEdit?topic:undefined} categories={categories.map(c=>({...c,depth:0}))} series={series.map(s=>({...s,status:'published',deleted_at:null}))}/>:mode==='edit'?<Edit {...draftProps} topic={topic} categories={categories} series={series}/>:mode==='default-rich'?<Rich name="default_content" label="المحرر الافتراضي" defaultValue="نص محفوظ"/>:mode==='default-bounded-rich'?<Rich name="default_content" label="المحرر الافتراضي" defaultValue={'<p>'+('نص افتراضي محفوظ '.repeat(300))+'</p>'} minHeight={300} maxHeight={300}/>:mode==='keyboard-baseline'?<><div style={{height:Number(params.get('before'))}}/><div style={{width:Number(params.get('width'))}}><Rich name="baseline_content" label="نص المقال" defaultValue={params.get('html')||''} minHeight={300} maxHeight={300} showLabel={false} enableArticleStructure/></div><div style={{height:Number(params.get('after'))}}/></>:mode==='default-display'?<Display/>:mode==='premium-display'?<Display presentation="premium" columns={3}/>:<Create {...draftProps} categories={categories} series={series}/>}</Feedback></PathnameContext.Provider></AppRouterContext.Provider></SearchParamsContext.Provider>);renderTopicFixture();if(params.has('full-form-draft'))window.rerenderDraftFixtureSession=next=>{draftProps.draftSession={...next};window.topicDraftFixture.session=draftProps.draftSession;renderTopicFixture();};window.mountGalleryPublicProjection=item=>fixtureReactRoot.render(<MediaDetailArticle item={item} content={item.content||''} config={MEDIA_DETAIL_PAGE_CONFIG.gallery} relatedItems={[]}/>);window.mountGalleryDefaults=(variant,ports={})=>{const Owner=variant==='hero'?HeroGallery:Gallery;fixtureReactRoot.render(<Feedback><form key={variant+JSON.stringify(ports)} data-gallery-default-probe={variant}><Owner name="default_gallery" label="صور افتراضية" {...(variant==='items'?{valueMode:'items',altName:'default_alt',captionName:'default_caption',focusTargetId:'default_gallery',altFocusTargetId:'default_alt',defaultItems:[{url:'/fixture.svg',alt:'Alt A',caption:'Caption A'},{url:'/fixture-replacement.svg',alt:'Alt B',caption:'Caption B'}]}:{defaultPaths:['/fixture.svg','/fixture-replacement.svg']})} {...ports}/></form></Feedback>);};window.mountImageDefaults=(ports={})=>fixtureReactRoot.render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)}><AppRouterContext.Provider value={router}><PathnameContext.Provider value="/admin/content/topics/991"><Feedback><form key={JSON.stringify(ports)} data-image-default-probe=""><ImageField name="default_image" label="الصورة الافتراضية" defaultValue="/fixture.svg" altName="default_image_alt" defaultAlt="Default alt" {...ports}/></form></Feedback></PathnameContext.Provider></AppRouterContext.Provider></SearchParamsContext.Provider>);`;
  const webpack = fixtureRequire('next/dist/compiled/webpack/webpack').webpack, moduleCss = new Map();
  const compiler = webpack({ mode: 'development', target: 'web', context: fixtureRoot, entry: dataModule(entry), output: { path: path.join(fixtureRoot, '.tmp-qa/story-adoption'), filename: 'fixture.js' }, devtool: false,
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { 'server-only': false } },
    plugins: [new webpack.NormalModuleReplacementPlugin(/editor-actions\/save$/, dataModule(`export async function saveContentForm(previous,data){window.topicSaveAttempts=(window.topicSaveAttempts||0)+1;window.topicSubmitted=Object.fromEntries(data);window.topicSubmittedEntries=[...data];if(window.topicDeferSave)await new Promise(resolve=>{window.topicReleaseSave=resolve});if(window.topicSourceSave)return window.topicSourceSave(previous,[...data],window.topicSourceSaveOutcome??'success');if(window.topicSaveOutcome==='success'&&window.topicMemoryPersist)await window.topicMemoryPersist(new URLSearchParams(location.search).get('mode'),[...data]);return window.topicSaveOutcome==='success'?{...previous,status:'success',revision:previous.revision+1,title:'حفظ معزول',fieldErrors:{}}:{...previous,status:'error',revision:previous.revision+1,title:'رفض معزول',message:'لم ترسل بيانات للخادم',fieldErrors:window.topicFixtureFieldErrors??{title:['فشل حفظ تجريبي']}}}`)),
      new webpack.NormalModuleReplacementPlugin(/media-actions\/validation$/, dataModule(`export async function readMediaVideoEmbed(payload){window.metaReads??=[];window.metaReads.push({...payload});let result;if(window.metaDeferReads){window.metaPendingReads??=[];result=await new Promise(resolve=>window.metaPendingReads.push({payload:{...payload},resolve}));}else{const outcome=window.metaReadOutcome??'denied';if(outcome==='throw')throw Error('Finite Meta read failure');result=outcome==='ready'||outcome==='mismatch'?{status:'ready',provider:payload.provider,sourceUrl:outcome==='mismatch'?'https://www.facebook.com/reel/456':payload.video_url}:{status:'unavailable',reason:'denied'};}return result;}`)),
      new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$/, dataModule('export const browseAdminLinksAjax=blocked,resolveAdminLinkAjax=blocked,browseTopicCategoriesPickerAjax=blocked,browseMenusPickerAjax=blocked,browseMenuItemsPickerAjax=blocked;function blocked(){throw Error("Unrelated picker transport outside Topic fixture")}')),
      new webpack.ProvidePlugin({ process: fixtureRequire.resolve('next/dist/build/polyfills/process') }),
      { apply(c) { c.hooks.shouldEmit.tap('TopicContentMemory', () => false); c.hooks.compilation.tap('TopicContentMemory', compilation => { webpack.NormalModule.getCompilationHooks(compilation).readResource.for(undefined).tapPromise('TopicContentMemory', async context => {
        const file = context.resourcePath;
        if (file.endsWith('.module.css')) {
          const scope = fixtureRequire('next/dist/compiled/postcss-modules-scope'), { getCssModuleLocalIdent } = fixtureRequire('next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent');
          const result = await fixtureRequire('postcss')([fixtureRequire('next/dist/compiled/postcss-modules-values'), fixtureRequire('next/dist/compiled/postcss-modules-local-by-default')({ mode: 'local' }), fixtureRequire('next/dist/compiled/postcss-modules-extract-imports')(), scope({ generateScopedName: name => getCssModuleLocalIdent({ rootContext: fixtureRoot, resourcePath: file }, null, name, { context: fixtureRoot }) })]).process(await readFile(file, 'utf8'), { from: file });
          const locals = {}; result.root.walkRules(':export', rule => { rule.walkDecls(decl => { locals[decl.prop] = decl.value; }); rule.remove(); }); moduleCss.set(file, result.root.toString()); return 'export default ' + JSON.stringify(locals) + ';';
        }
        if (/\.[jt]sx?$/.test(file) && !file.includes('node_modules')) {
          let source = await readFile(file, 'utf8');
          // Negative proof changes only this in-memory bundle. These restore the
          // observed defects and must fail the ordinary consumer assertions.
          if (file.replaceAll('\\', '/').endsWith('/article/TopicSlugInput.tsx')) {
            if (slugRegressionProbe === 'typing') { assert.equal(source.split('setValue(event.target.value);').length, 2); source = source.replace('setValue(event.target.value);', 'setValue(slugifyFromTitle(event.target.value));'); }
            if (slugRegressionProbe === 'observers') { const dispatch = 'inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));'; assert.equal(source.split(dispatch).length, 2); source = source.replace(dispatch, 'void inputRef.current;'); }
          }
          if (slugRegressionProbe === 'finalization' && file.replaceAll('\\', '/').endsWith('/editors/ContentEditorShell.tsx')) { const optIn = '      finalizeFieldsOnSubmit'; assert.equal(source.split(optIn).length, 2); source = source.replace(optIn, ''); }
          return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
        }
      }); }); } }], module: { rules: [{ test: /\.module\.css$/, type: 'javascript/auto' }] },
  });
  let bundle;
  await new Promise((resolve, reject) => compiler.run((error, stats) => { if (!error && !stats.hasErrors()) bundle = Buffer.from(stats.compilation.assets['fixture.js'].source()); compiler.close(closeError => error || closeError || stats.hasErrors() ? reject(error || closeError || Error(stats.toString({ all: false, errors: true }))) : resolve()); }));
  console.log('Topic Content fixture: actual Article/Media consumers compiled in memory');
  const css = (await fixtureRequire('postcss')([fixtureRequire('@tailwindcss/postcss')({ base: fixtureRoot })]).process(await readFile(path.join(fixtureRoot, 'src/app/globals.css'), 'utf8'), { from: path.join(fixtureRoot, 'src/app/globals.css') })).css;
  const fonts = [300, 400, 500, 600, 700].map(weight => `@font-face{font-family:FixtureArabic;src:url('/font-${weight}.woff2');font-weight:${weight};font-display:block}`).join('') + ':root{--font-arabic:FixtureArabic;--font-inter:Arial}';
  const iframeReads = [], seoReads = [], existingSeoAsset = mediaFixture ? await readFile(path.join(fixtureRoot, 'public/next.svg')) : null;
  const seoAsset = (id, url, displayName, dimensions = true) => ({ id, provider: 'filesystem', bucket: 'public', objectKey: url.slice(1), publicUrl: url, originalFilename: url.slice(1), displayName, kind: 'image', mimeType: 'image/svg+xml', extension: 'svg', sizeBytes: existingSeoAsset.length, width: dimensions ? 394 : null, height: dimensions ? 80 : null, checksum: createHash('sha256').update(existingSeoAsset).digest('hex'), folderPath: 'images/topics/seo', status: 'active', uploadedBy: null, defaultAltText: null, defaultTitle: null, defaultCaption: null, reconciliationState: 'synced', missingObject: false, catalogRegistered: true, source: 'catalog', createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z', referenceCount: 0 });
  const seoAssets = mediaFixture ? [seoAsset('original', '/fixture.svg', 'SEO fixture original'), seoAsset('replacement', '/fixture-replacement.svg', 'SEO fixture replacement'), seoAsset('no-dimensions', '/fixture-no-dimensions.svg', 'SEO fixture absent dimensions', false), seoAsset('unavailable', '/fixture-unavailable.svg', 'SEO fixture unavailable'), ...(contentPanelGalleryOnly || unifiedImageOnly ? [seoAsset('fourth', '/fixture-fourth.svg', 'SEO fixture fourth')] : [])] : [];
  const seoCatalog = { catalogState: 'available', warning: null, assets: seoAssets, folders: [], page: 1, pageSize: 10, total: seoAssets.length, totalPages: 1, summary: { provider: 'filesystem', folderCount: 0, assetCount: seoAssets.length, storageAssetCount: seoAssets.length, managedStorageAssetCount: 0, readOnlyAssetCount: seoAssets.length, catalogRegisteredCount: seoAssets.length, imageCount: seoAssets.length, documentCount: 0, missingObjectCount: 0, unreconciledAssetCount: 0, usageUnknownCount: 0, totalBytes: (existingSeoAsset?.length ?? 0) * seoAssets.length, unknownSizeCount: 0, largestAsset: null }, readiness: { context: { provider: 'filesystem', environment: 'local', identity: 'finite-memory-fixture' }, catalogAvailable: true, managedStorageAvailable: false, runtimeContextMatches: true, runtimeDatasetMatches: true, providerRegistryMatches: true, catalogCoverageComplete: true, assetReconciliationComplete: true, usageResultsAuthoritative: true, safeDeleteReady: false, managedStorageAssetCount: 0, catalogAssetCount: seoAssets.length, unregisteredAssetCount: 0, missingObjectCount: 0, unreconciledAssetCount: 0, unscannedAssetCount: 0, lastScanAt: null, lastCompletedScanAt: null, reasons: [], warnings: [] } };
  // Show Chrome's native scrollbar in headless mode so clientLeft proves its physical side.
  const draftUseBundledChromium = recoveryFixture && Boolean(process.env.CI), draftBrowserProduct = draftUseBundledChromium ? 'Chromium' : 'Chrome';
  const browser = await chromium.launch({ ...(draftUseBundledChromium ? {} : { channel: 'chrome' }), headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] }), draftBrowserContext = recoveryFixture ? await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', ...(contentPanelGalleryOnly || unifiedImageOnly ? { hasTouch: true } : {}) }) : null, page = draftBrowserContext ? await draftBrowserContext.newPage() : await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' }), errors = [], forbidden = [];
  // Unpublished rows retain a null publication date. Their native date control
  // defaults to today's date on each mount, so hold Date stable across midnight
  // while leaving browser timers and the actual source save/PGlite clock real.
  const slugBrowserDate = slugAuditOnly ? '2026-10-23T12:00:00.000Z' : recoveryFixture ? '2026-10-24T12:00:00.000Z' : null;
  if (recoveryFixture) await page.clock.install({ time: new Date(slugBrowserDate) });
  else if (slugBrowserDate) await page.clock.setFixedTime(slugBrowserDate);
  const delayedMetaSdkRoutes = [];
  if (videoTransport) await page.addInitScript(() => {
    window.metaReadOutcome = 'denied'; window.metaReads = []; window.metaPendingReads = [];
    window.metaSdkMode = 'allow'; window.metaSdkStats = { loads: [], mounts: [], pauses: 0, releases: 0, unsubscribes: 0 };
  });
  const finiteMetaSdk = provider => `(()=>{
    const provider=${JSON.stringify(provider)},stats=window.metaSdkStats;stats.loads.push(provider);
    const readyCallbacks=new Set(),errorCallbacks=new Set();
    const mount=media=>{
      if(window.metaSdkMode==='parse-error')throw Error('Finite SDK parse failure');
      const iframe=document.createElement('iframe');iframe.dataset.fixtureMetaProvider=provider;iframe.title='Finite '+provider+' transport';iframe.style.width='100%';iframe.style.height='220px';iframe.srcdoc='<!doctype html><html><body><video controls preload="none"></video></body></html>';
      stats.mounts.push({provider,source:media.dataset.href??media.dataset.instgrmPermalink,autoplay:media.dataset.autoplay??null,ignoreWrapper:provider==='facebook'?Boolean(media.querySelector('.fb-xfbml-parse-ignore')):null});media.replaceChildren(iframe);
      if(provider==='facebook'){const instance={pause(){stats.pauses++},subscribe(event,callback){if(event==='error')errorCallbacks.add(callback);return{release(){stats.releases++;errorCallbacks.delete(callback)}}}};queueMicrotask(()=>readyCallbacks.forEach(callback=>callback({type:'video',id:media.id,instance})));}
    };
    window.metaSdkTriggerError=()=>errorCallbacks.forEach(callback=>callback());
    if(provider==='facebook'){
      window.FB={Event:{subscribe(_event,callback){readyCallbacks.add(callback)},unsubscribe(_event,callback){stats.unsubscribes++;readyCallbacks.delete(callback)}},XFBML:{parse(container){container.querySelectorAll('.fb-video').forEach(mount)}}};
      queueMicrotask(()=>window.fbAsyncInit?.());
    }else window.instgrm={Embeds:{process(){document.querySelectorAll('blockquote.instagram-media:not(:has(iframe))').forEach(mount)}}};
  })();`;
  const nativeVideoFixture = videoTransport && !slugAuditOnly && !recoveryFixture ? await page.evaluate(async () => {
    const canvas=document.createElement('canvas'); canvas.width=32; canvas.height=18;
    const stream=canvas.captureStream(10), chunks=[], recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
    recorder.ondataavailable=event=>chunks.push(event.data);
    const stopped=new Promise(resolve=>recorder.onstop=resolve); recorder.start();
    const context=canvas.getContext('2d'), timer=setInterval(()=>{context.fillStyle='#080d16';context.fillRect(0,0,32,18);},100);
    await new Promise(resolve=>setTimeout(resolve,1600)); recorder.stop(); await stopped; clearInterval(timer); stream.getTracks().forEach(track=>track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
  }) : [];
  const savedMediaRows = new Map();
  const savedSlugRows = new Map(), slugSaveResults = [];
  let slugHarness, slugMode;
  if (slugAuditOnly || recoveryFixture) await page.exposeBinding('topicSourceSave', async (_source, previousState, entries, outcome) => {
    assert.ok(slugHarness, 'Slug saves use the existing source-owner harness');
    const receipt = await slugHarness.save({ contentType: new Map(entries).get('content_type'), mode: previousState.mode, previousState, entries, outcome });
    slugSaveResults.push({ mode: slugMode, outcome, ...receipt });
    if (receipt.result.status === 'success') {
      assert.ok(receipt.row, 'Successful actual adapter save returns a persisted isolated row');
      savedSlugRows.set(slugMode.replace(/create$/, 'edit'), receipt.row);
    }
    return receipt.result;
  });
  if (mediaTabsOnly) await page.exposeBinding('topicMemoryPersist', (_source, mode, entries) => { savedMediaRows.set(mode.replace(/create$/, 'edit'), entries); });
  page.on('pageerror', error => { errors.push(error.message); if (fullFormDraftOnly) console.log('DRAFT_BROWSER_PAGEERROR ' + error.stack); if (unifiedImageOnly) console.log('UNIFIED_IMAGE_PAGEERROR ' + error.stack); });
  const unifiedImageHeldReferences = []; let unifiedImageHoldReferences = false;
  const releaseUnifiedImageReferences = async () => { unifiedImageHoldReferences = false; await Promise.all(unifiedImageHeldReferences.splice(0).map(release => release())); };
  const routeTopicFixture = async route => {
    const address = new URL(route.request().url());
    if (videoTransport && ((address.origin === 'https://connect.facebook.net' && address.pathname === '/en_US/sdk.js') || (address.origin === 'https://www.instagram.com' && address.pathname === '/embed.js'))) {
      const mode = await page.evaluate(() => window.metaSdkMode);
      if (mode === 'blocked') return route.abort('blockedbyclient');
      if (mode === 'deferred') return new Promise(resolve => delayedMetaSdkRoutes.push(async () => { await route.fulfill({ contentType: 'application/javascript', body: finiteMetaSdk(address.hostname === 'connect.facebook.net' ? 'facebook' : 'instagram') }); resolve(); }));
      return route.fulfill({ contentType: 'application/javascript', body: finiteMetaSdk(address.hostname === 'connect.facebook.net' ? 'facebook' : 'instagram') });
    }
    if (videoTransport && ((address.origin === 'https://www.youtube.com' && address.pathname === '/embed/dQw4w9WgXcQ' && [...address.searchParams.keys()].every(key => key === 'start')) || (address.origin === 'https://player.vimeo.com' && address.pathname === '/video/76979871') || (address.origin === 'https://www.tiktok.com' && address.pathname === '/player/v1/6718335390845095173' && address.searchParams.get('autoplay') === '0'))) { iframeReads.push({ url: address.href, method: route.request().method() }); return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Finite playback fixture</body></html>' }); }
    if (videoTransport && address.origin === 'https://cdn.venesia-fixture.com' && address.pathname === '/video.webm') {
      const bytes = Buffer.from(nativeVideoFixture), range = route.request().headers().range;
      // Native temporal fragments require a seekable source; emulate the finite CDN's byte-range contract.
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range); assert.ok(match, 'Native fixture requests one finite byte range');
        const start = Number(match[1]), end = Math.min(match[2] ? Number(match[2]) : bytes.length - 1, bytes.length - 1);
        assert.ok(start >= 0 && start <= end && end < bytes.length);
        return route.fulfill({status:206,headers:{'content-type':'video/webm','accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});
      }
      return route.fulfill({contentType:'video/webm',headers:{'accept-ranges':'bytes'},body:bytes});
    }
    if (address.origin !== 'http://topic-content.fixture') { forbidden.push(route.request().url()); return route.abort(); }
    if (mediaFixture && address.pathname === '/api/admin/media-library') { const request = route.request(); if (request.method() === 'GET') { seoReads.push({ operation: 'catalog_browse', folder: address.searchParams.get('folder') }); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(seoCatalog) }); } if (request.method() === 'POST') { const body = request.postDataJSON(); assert.equal(body.operation, 'reference_state'); assert.ok(body.assets.every(value => seoAssets.some(asset => asset.publicUrl === value))); seoReads.push(body); if (unifiedImageOnly && unifiedImageHoldReferences) await new Promise(resolve => unifiedImageHeldReferences.push(resolve)); return route.fulfill(body.assets.includes('/fixture-unavailable.svg') ? { status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'finite_read_unavailable' }) } : { contentType: 'application/json', body: JSON.stringify({ deleted: [], missing: [], originals: body.assets.map(value => ({ value, width: value.includes('no-dimensions') ? null : 394, height: value.includes('no-dimensions') ? null : 80 })) }) }); } }
    if (mediaFixture && address.pathname === '/api/admin/media-usage' && route.request().method() === 'GET') { seoReads.push({ operation: 'usage_read' }); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ hits: [], scanComplete: true, unusedAuthoritative: true, warning: null }) }); }
    if (mediaFixture && ['/fixture.svg', '/fixture-replacement.svg', '/fixture-no-dimensions.svg', ...(contentPanelGalleryOnly || unifiedImageOnly ? ['/fixture-fourth.svg'] : [])].includes(address.pathname)) return route.fulfill({ contentType: 'image/svg+xml', body: existingSeoAsset });
    if (mediaFixture && address.pathname === '/fixture-unavailable.svg') return route.fulfill({ status: 404, body: '' });
    if (address.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: bundle });
    const font = address.pathname.match(/^\/font-(300|400|500|600|700)\.woff2$/);
    if (font) return route.fulfill({ contentType: 'font/woff2', body: await readFile(path.join(fixtureRoot, `src/assets/fonts/ibm-plex-sans-arabic-${font[1]}.woff2`)) });
    if (address.pathname !== '/' || route.request().method() !== 'GET') { forbidden.push(route.request().url()); return route.abort(); }
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}${fonts}${[...moduleCss.values()].join('\n')}</style><main class="p-4 text-white">${slugAuditOnly || recoveryFixture ? '<a href="/admin/content/topics" data-slug-navigation>الانتقال إلى المحتوى</a>' : ''}<div id="root"></div></main><script>window.topicMemorySaved=${JSON.stringify(savedMediaRows.get(address.searchParams.get('mode')) ?? null).replaceAll('<', '\u003c')};window.topicSlugSaved=${JSON.stringify(savedSlugRows.get(address.searchParams.get('mode')) ?? null).replaceAll('<', '\u003c')}</script><script src="/fixture.js"></script></html>` });
  };
  await page.route('**/*', routeTopicFixture);
  const open = async (mode, draftOptions = {}) => {
    const params = new URLSearchParams(draftOptions), leave = async dialog => { assert.equal(dialog.type(), 'beforeunload'); await dialog.accept(); };
    if (recoveryFixture) page.on('dialog', leave);
    try { await page.goto('http://topic-content.fixture/?mode=' + mode + (mediaFixture ? '&seo-fixture=1' : '') + (mediaTabsOnly || slugAuditOnly || recoveryFixture ? '&capture-navigation=1' : '') + (slugAuditOnly ? '&slug-audit=1' : '') + (recoveryFixture ? '&full-form-draft=1&' + params.toString() : '')); await page.evaluate(() => document.fonts.ready); }
    finally { if (recoveryFixture) page.off('dialog', leave); }
  };
  const editor = () => page.getByRole('textbox', { name: 'نص المقال', exact: true });
  const content = () => page.locator('input[type="hidden"][name="content"]');
  const draftKey = mode => 'venesia-topic-editor-draft:topic:' + (mode.startsWith('media-') ? 'news:' : 'article:') + (mode.endsWith('create') ? 'create' : '991');
  const headers = ['بيانات الموضوع والمحتوى', 'الصورة الرئيسية', 'إعدادات العرض', 'المحتوى'];
  const fields = ['show_title_on_page', 'show_image_on_page', 'show_category_on_page', 'show_series_on_page', 'show_excerpt_on_page', 'show_date_on_page', 'show_intro_card_on_page'];
  const fieldLabels = ['إظهار العنوان', 'إظهار الصورة', 'إظهار التصنيف', 'إظهار السلسلة', 'إظهار المقتطف', 'إظهار التاريخ', 'إظهار بطاقة مقدمة الموضوع'];
  const results = [];
  const scrollGeometry = () => page.locator('.admin-rich-text-editor').evaluate(element => {
    const content = element.querySelector('[role="textbox"]'), wrapper = content.parentElement, paragraph = content.querySelector('p'), style = getComputedStyle(element);
    const borderLeft = parseFloat(style.borderLeftWidth), borderRight = parseFloat(style.borderRightWidth), totalGutter = element.offsetWidth - element.clientWidth - borderLeft - borderRight, leftGutter = element.clientLeft - borderLeft;
    return { viewportDirection: style.direction, editableViewport: element.isContentEditable, wrapperDirection: getComputedStyle(wrapper).direction, contentDirection: getComputedStyle(content).direction, paragraphDirection: paragraph ? getComputedStyle(paragraph).direction : null, contentAlign: getComputedStyle(content).textAlign, paragraphAlign: paragraph ? getComputedStyle(paragraph).textAlign : null, leftGutter, rightGutter: totalGutter - leftGutter, horizontalOverflow: element.scrollWidth > element.clientWidth + 1, contentOverflow: content.scrollWidth > content.clientWidth + 1, nested: [...element.querySelectorAll('*')].filter(child => /(auto|scroll)/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight + 1).length };
  });
  const assertRightRtl = async () => {
    const observed = await scrollGeometry();
    assert.equal(observed.viewportDirection, 'ltr'); assert.equal(observed.editableViewport, false); assert.equal(observed.wrapperDirection, 'rtl'); assert.equal(observed.contentDirection, 'rtl'); assert.equal(observed.paragraphDirection, 'rtl'); assert.ok(['start', 'right'].includes(observed.contentAlign)); assert.ok(['start', 'right'].includes(observed.paragraphAlign)); assert.equal(observed.leftGutter, 0); assert.ok(observed.rightGutter > 0); assert.equal(observed.horizontalOverflow, false); assert.equal(observed.contentOverflow, false); assert.equal(observed.nested, 0);
    return observed;
  };
  const caretGeometry = () => editor().evaluate(element => {
    const selection = getSelection(), walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    const caret = selection.getRangeAt(0).getBoundingClientRect(), viewport = element.closest('.admin-rich-text-editor').getBoundingClientRect();
    return { collapsed: selection.isCollapsed, atStart: selection.anchorNode === nodes[0] && selection.anchorOffset === 0, atEnd: selection.anchorNode === nodes.at(-1) && selection.anchorOffset === nodes.at(-1).length, visible: caret.top >= viewport.top - 1 && caret.bottom <= viewport.bottom + 1 };
  });
  const keyboardScroll = async () => {
    const scroll = page.locator('.admin-rich-text-editor'), toolbar = page.getByRole('toolbar', { name: 'شريط أدوات نص المقال', exact: true }), positions = [];
    const record = async step => { await expect(toolbar).toBeInViewport(); positions.push({ step, caretVisible: (await caretGeometry()).visible, ...await scroll.evaluate(element => ({ pageY: window.scrollY, scrollTop: element.scrollTop })) }); };
    await editor().focus(); await editor().press('Control+Home'); await expect.poll(caretGeometry).toEqual({ collapsed: true, atStart: true, atEnd: false, visible: true }); await record('home');
    await editor().press('PageDown'); await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(positions[0].scrollTop);
    // Observe Chrome's PageDown caret placement for parity with auto/RTL; Home/End remain strict.
    await expect.poll(async () => (await caretGeometry()).visible).toBe(true).catch(() => false); await record('pageDown');
    await editor().press('Control+End'); await expect.poll(caretGeometry).toEqual({ collapsed: true, atStart: false, atEnd: true, visible: true }); await record('end');
    await editor().press('Control+Home'); await expect.poll(caretGeometry).toEqual({ collapsed: true, atStart: true, atEnd: false, visible: true }); await record('homeAgain');
    return positions;
  };
  const verifySelectFields = async (mode, width) => {
    const form = page.locator('form[data-admin-form-runtime]'), grid = page.locator('[data-content-basic-panel] [data-admin-form-grid="aligned-fields"]').filter({ has: page.locator('#topic-content-type-popover-trigger') });
    const type = page.locator('#topic-content-type-popover-trigger'), category = page.locator('#content-category-listbox'), series = page.locator('#content-series-listbox');
    const canonicalBorderColor = await page.evaluate(() => { const probe = document.createElement('span'); probe.className = 'border border-white/10'; document.body.append(probe); const value = getComputedStyle(probe).borderTopColor; probe.remove(); return value; });
    const values = () => form.evaluate(form => { const data = new FormData(form); return { type: data.get('content_type'), category: data.get('category_id'), series: data.get('series_id') }; });
    const measure = () => grid.evaluate(grid => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const parentStyle = getComputedStyle(grid.closest('section'));
      return { columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, gap: parseFloat(getComputedStyle(grid).columnGap), overflow: document.documentElement.scrollWidth > innerWidth + 1, parentSurface: { color: parentStyle.backgroundColor, image: parentStyle.backgroundImage }, fields: [...grid.children].map(field => { const style = getComputedStyle(field), label = field.querySelector('[data-admin-form-label-text]'), trigger = field.querySelector('[role="combobox"]'), text = getComputedStyle(label), frame = box(field), title = box(label), control = box(trigger), supporting = [...field.querySelectorAll('[role="alert"],[role="status"]')].map(node => ({ ...box(node), role: node.getAttribute('role'), text: node.textContent.trim() })), contentBottom = Math.max(title.y + title.h, control.y + control.h, ...supporting.map(node => node.y + node.h)); return { ...frame, label: label.textContent.trim(), surface: style.backgroundColor, surfaceImage: style.backgroundImage, display: style.display, flexDirection: style.flexDirection, gridRowEnd: style.gridRowEnd, border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth], borderColor: style.borderTopColor, radius: style.borderTopRightRadius, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], rowGap: style.rowGap, labelInset: text.paddingInlineStart, font: text.fontSize, weight: text.fontWeight, lineHeight: text.lineHeight, labelControlGap: control.y - title.y - title.h, trigger: { ...control, background: getComputedStyle(trigger).backgroundColor, backgroundImage: getComputedStyle(trigger).backgroundImage }, supporting, trailingSpace: frame.y + frame.h - contentBottom, controlsInside: control.x >= frame.x && control.x + control.w <= frame.x + frame.w && control.y >= frame.y && control.y + control.h <= frame.y + frame.h, errorClipped: supporting.some(error => error.x < frame.x || error.x + error.w > frame.x + frame.w || error.y < frame.y || error.y + error.h > frame.y + frame.h) }; }) };
    });
    const checkGeometry = geometry => {
      assert.equal(geometry.columns, width >= 768 ? 3 : 1); assert.equal(geometry.gap, 16); assert.equal(geometry.overflow, false); assert.equal(geometry.fields.length, 3);
      assert.deepEqual(geometry.fields.map(field => field.label), ['نوع المحتوى', 'التصنيف *', 'السلسلة (اختياري)']);
      assert.ok(geometry.parentSurface.image.includes('linear-gradient'), 'Transparent field frames expose the existing canonical main-Card Charcoal surface');
      for (const field of geometry.fields) { assert.equal(field.surface, 'rgba(0, 0, 0, 0)'); assert.equal(field.surfaceImage, 'none'); assert.equal(field.display, 'flex'); assert.equal(field.flexDirection, 'column'); assert.equal(field.gridRowEnd, 'auto'); assert.deepEqual(field.border, ['1px', '1px', '1px', '1px']); assert.equal(field.borderColor, canonicalBorderColor); assert.equal(field.radius, '16px'); assert.deepEqual(field.padding, ['12px', '12px', '12px', '12px']); assert.equal(field.rowGap, '8px'); assert.equal(field.labelInset, '12px'); assert.equal(field.font, '12px'); assert.equal(field.weight, '500'); assert.equal(field.trigger.h, 44); assert.ok(Math.abs(field.labelControlGap - 8) <= 1, 'Label-control gap stays8px: ' + JSON.stringify(field)); assert.equal(field.controlsInside, true); assert.equal(field.errorClipped, false); assert.ok(Math.abs(field.w - geometry.fields[0].w) <= 1); }
      assert.ok(Math.abs(Math.min(...geometry.fields.map(field => field.trailingSpace)) - 13) <= 1, 'Longest real field content ends at balanced12px padding plus1px border with no reserved empty row');
      if (width >= 768) { for (const field of geometry.fields) { assert.ok(Math.abs(field.h - geometry.fields[0].h) <= 1); assert.ok(Math.abs(field.y - geometry.fields[0].y) <= 1); } assert.ok(geometry.fields[0].x > geometry.fields[1].x && geometry.fields[1].x > geometry.fields[2].x); }
      else for (let index = 0; index < geometry.fields.length; index++) { assert.ok(Math.abs(geometry.fields[index].trailingSpace - 13) <= 1); if (index) assert.ok(geometry.fields[index].y >= geometry.fields[index - 1].y + geometry.fields[index - 1].h + 15); }
    };
    const before = await measure(); if (mode === 'create' && width === 1440) console.log('SELECT_FIELD_GEOMETRY ' + JSON.stringify(before)); checkGeometry(before);
    if (mode.endsWith('create')) { assert.equal(before.fields[2].supporting.length, 1); assert.equal(before.fields[2].supporting[0].role, 'status'); assert.equal(before.fields[2].supporting[0].h, 16); }
    const portal = async trigger => {
      await trigger.scrollIntoViewIfNeeded(); await trigger.focus(); await trigger.press('ArrowDown'); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const menu = page.locator('[data-admin-listbox-popover]').filter({ visible: true }); await expect(menu).toHaveCount(1); await expect(menu.getByRole('listbox')).toBeVisible();
      const geometry = await menu.evaluate(menu => { const r = menu.getBoundingClientRect(); return { outsideFieldGrid: !menu.closest('[data-admin-form-grid]'), position: getComputedStyle(menu).position, direction: getComputedStyle(menu).direction, insideViewport: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, unobstructed: [...menu.querySelectorAll('[role="option"]')].filter(option => !option.disabled).some(option => { const r = option.getBoundingClientRect(), x = Math.max(1, Math.min(innerWidth - 1, r.left + r.width / 2)), y = Math.max(1, Math.min(innerHeight - 1, r.top + r.height / 2)); return r.width > 0 && r.height > 0 && menu.contains(document.elementFromPoint(x, y)); }) }; });
      assert.deepEqual(geometry, { outsideFieldGrid: true, position: 'fixed', direction: 'rtl', insideViewport: true, unobstructed: true });
      return geometry;
    };
    const initialValues = await values(); if (mode.endsWith('edit')) await expect(type).toBeDisabled(); else await expect(type).toBeEnabled();
    const portals = [];
    if (!mode.endsWith('edit')) { portals.push(await portal(type)); await type.press('End'); await type.press('Escape'); await expect(type).toBeFocused(); assert.deepEqual(await values(), initialValues, 'Type keyboard inspection closes without navigation or value changes'); await expect(series).toBeDisabled(); }
    portals.push(await portal(category)); await expect(page.getByRole('option', { name: 'تصنيف غير متاح', exact: true })).toBeDisabled(); await category.press('Home'); await category.press('Enter'); await expect(category).toBeFocused(); await expect(page.locator('select[name="category_id"]')).toHaveValue('17'); await expect(series).toBeEnabled();
    portals.push(await portal(series)); await series.press('End'); await series.press('Enter'); await expect(series).toBeFocused(); await expect(page.locator('select[name="series_id"]')).toHaveValue('187');
    await expect(grid.locator('[role="status"]')).toHaveCount(0);
    await page.locator('input[name="title"]').fill('عنوان صالح لاختبار حاويات الحقول'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    const chosenValues = await values(); await page.locator('[data-admin-tab-id="display"]').click(); await page.locator('[data-admin-tab-id="basic"]').click(); assert.deepEqual(await values(), chosenValues); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.evaluate(() => { window.topicDeferSave = true; window.topicFixtureFieldErrors = { content_type: ['خطأ تجريبي لنوع المحتوى'], category_id: ['خطأ تجريبي للتصنيف مع بقاء القيمة المختارة'], series_id: ['خطأ تجريبي للسلسلة'] }; }); await form.evaluate(form => form.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function');
    for (const trigger of [type, category, series]) await expect(trigger).toBeDisabled();
    assert.deepEqual(await page.evaluate(() => ({ type: window.topicSubmitted.content_type ?? null, category: window.topicSubmitted.category_id ?? null, series: window.topicSubmitted.series_id ?? null })), chosenValues);
    await page.evaluate(() => window.topicReleaseSave()); await expect(category).toBeEnabled();
    for (const message of ['خطأ تجريبي لنوع المحتوى', 'خطأ تجريبي للتصنيف مع بقاء القيمة المختارة', 'خطأ تجريبي للسلسلة']) await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(type).toHaveAttribute('aria-invalid', 'true'); const error = await measure(); checkGeometry(error); assert.deepEqual(await values(), chosenValues); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.evaluate(() => { window.topicDeferSave = false; window.topicSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await expect(page.getByText('خطأ تجريبي للتصنيف مع بقاء القيمة المختارة', { exact: true })).toHaveCount(0); assert.deepEqual(await values(), chosenValues); if (mode.endsWith('edit')) await expect(type).toBeDisabled(); else await expect(type).toBeEnabled();
    return { before, error, portals, selectedValues: chosenValues, disabledAndErrorStates: true, keyboard: true, dirtyAndMemorySave: true, navigationAndValuesRetained: true };
  };
  const verifyVideoFields = async (mode, width) => {
    const form = page.locator('form[data-admin-form-runtime]'), panel = form.locator('[data-admin-media-video-presentation="panel"]'), url = panel.locator('input[name="video_url"]'), duration = panel.locator('input[name="video_duration"]'), thumbnail = panel.locator('[data-admin-media-image-field="video_thumbnail"]'), provider = panel.locator('[data-admin-form-listbox]').filter({ has: page.locator('select[name="video_provider"]') }).getByRole('option', { name: 'YouTube', exact: true }), previewState = panel.locator('[data-admin-media-video-preview-state]');
    const initialDuration = mode.endsWith('edit') ? '3:45' : '';
    assert.deepEqual(await form.locator('[data-admin-tab-id]').evaluateAll(tabs => tabs.map(tab => tab.dataset.adminTabId)), ['basic', 'video', 'display', 'seo', 'publish']);
    await expect(panel).toHaveCount(1); await expect(form.locator('select[name="video_provider"]')).toHaveValue('youtube'); await expect(url).toHaveValue(mode.endsWith('edit') ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : ''); await expect(duration).toHaveAttribute('type', 'hidden'); await expect(duration).toHaveValue(initialDuration); await expect(panel.getByText('المدة (اختياري)', { exact: true })).toHaveCount(0); await expect(form.locator('input[name="video_thumbnail"]')).toHaveValue(mode.endsWith('edit') ? '/fixture.svg' : ''); await expect(form.locator('input[name="content"]')).toHaveValue('');
    const values = () => form.evaluate(form => Object.fromEntries(['video_provider', 'video_url', 'video_start_seconds', 'video_duration', 'video_thumbnail', 'content'].map(name => [name, new FormData(form).get(name)])));
    const measure = () => panel.evaluate(root => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; }, grid = root.querySelector('[data-admin-form-grid]');
      const headers = [...root.querySelectorAll('[data-admin-tab-section-heading]')].map(header => { const identity = header.querySelector('[data-admin-form-control-header]'), frame = identity.querySelector(':scope > span[aria-hidden="true"]'), accent = header.querySelector('[data-admin-tab-section-accent]'), heading = header.querySelector('[role="heading"]'); return { id: header.dataset.adminTabSectionHeading, ...box(header), title: heading.textContent.trim(), presentation: header.dataset.adminTabSectionPresentation, font: getComputedStyle(heading).fontSize, weight: getComputedStyle(heading).fontWeight, icon: box(frame.querySelector('svg')), frame: box(frame), accent: box(accent), background: getComputedStyle(header).backgroundImage }; });
      const cards = ['video-settings', 'video-preview', 'video-thumbnail'].map(id => { const marker = root.querySelector('[data-admin-tab-section-heading="' + id + '"]'), card = marker.closest('section'); return { id, ...box(card), border: parseFloat(getComputedStyle(card).borderTopWidth), radius: parseFloat(getComputedStyle(card).borderTopRightRadius) }; });
      return { direction: getComputedStyle(root).direction, headers, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, cards, labels: [...root.querySelectorAll('[data-admin-form-label-text]')].map(node => ({ text: node.textContent.trim(), inset: getComputedStyle(node).paddingInlineStart })), containers: [...root.querySelectorAll('[data-admin-form-grid]')].filter(grid => grid.className.includes('[&>*]:rounded-2xl')).flatMap(grid => [...grid.children].map(node => ({ border: parseFloat(getComputedStyle(node).borderTopWidth), radius: parseFloat(getComputedStyle(node).borderTopRightRadius), padding: getComputedStyle(node).paddingTop }))), fields: [...root.querySelectorAll('input:not([type="hidden"])')].map(node => ({ name: node.name, naturalHeight: Math.max(parseFloat(getComputedStyle(node).minHeight), ['lineHeight', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].map(key => parseFloat(getComputedStyle(node)[key])).reduce((sum, value) => sum + value, 0)), ...box(node) })), overflow: document.documentElement.scrollWidth > innerWidth + 1, clipped: [...root.querySelectorAll('input:not([type="hidden"]),button,[role="heading"]')].filter(node => node.getBoundingClientRect().width > 0).map(box).some(node => node.x < -1 || node.right > innerWidth + 1) };
    });
    const check = geometry => {
      assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.overflow, false); assert.equal(geometry.clipped, false); assert.deepEqual(geometry.headers.map(header => header.id), ['content-video-fields', 'video-settings', 'video-preview', 'video-thumbnail']); assert.equal(geometry.headers[0].title, 'الفيديو والصورة المصغّرة');
      for (const header of geometry.headers) { assert.equal(header.presentation, 'premium'); assert.equal(header.font, '14px'); assert.equal(header.weight, '600'); assert.equal(header.icon.w, 20); assert.equal(header.icon.h, 20); assert.equal(header.frame.w, 40); assert.equal(header.frame.h, 40); assert.equal(header.accent.w, 8); assert.ok(header.accent.x > header.frame.x); assert.ok(header.background.includes('linear-gradient')); }
      assert.ok(geometry.labels.some(label => label.text === 'مزود الفيديو')); assert.ok(geometry.labels.some(label => label.text === 'رابط فيديو YouTube')); for (const label of geometry.labels) assert.equal(label.inset, label.text === 'مزود الفيديو' ? '0px' : '12px'); assert.equal(geometry.columns, width >= 768 ? 2 : 1); assert.ok(geometry.containers.length >= 2); for (const cell of geometry.containers) { assert.equal(cell.border, 1); assert.equal(cell.radius, 16); assert.equal(cell.padding, '12px'); }
      const [settings, preview, thumb] = geometry.cards; for (const card of geometry.cards) { assert.equal(card.border, 1); assert.equal(card.radius, 16); } if (width >= 768) { assert.ok(Math.abs(settings.y - preview.y) <= 1); assert.ok(settings.x > preview.x, 'Settings stay at physical right in RTL'); } else assert.ok(preview.y >= settings.bottom, 'Mobile naturally stacks settings before preview'); assert.ok(thumb.y >= preview.bottom, 'Thumbnail is beneath preview'); for (const field of geometry.fields) assert.ok(Math.abs(field.h - field.naturalHeight) <= 1, 'Fields retain natural shared control height: ' + JSON.stringify(field));
    };
    const before = await measure(); check(before); const initialValues = await values(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false');
    const menu=panel.getByRole('listbox'), start=panel.locator('input[name="video_start_seconds"]');
    await expect(menu.getByRole('option')).toHaveCount(6);
    await provider.focus(); await provider.press('ArrowLeft'); await expect(menu.getByRole('option',{name:'Vimeo',exact:true})).toBeFocused(); await expect(form.locator('select[name="video_provider"]')).toHaveValue('vimeo');
    await menu.getByRole('option',{name:'Vimeo',exact:true}).press('ArrowLeft'); await expect(menu.getByRole('option',{name:'Facebook',exact:true})).toBeFocused();
    await menu.getByRole('option',{name:'Facebook',exact:true}).press('End'); await expect(menu.getByRole('option',{name:'رابط فيديو مباشر',exact:true})).toBeFocused();
    await menu.getByRole('option',{name:'رابط فيديو مباشر',exact:true}).press('Home'); await expect(provider).toBeFocused();
    const providerPortal = await menu.evaluate(node => { const r=node.getBoundingClientRect();return{x:r.x,right:r.right}; }); assert.ok(providerPortal.x>=-1&&providerPortal.right<=width+1);
    const providerCases = [
      {label:'YouTube',provider:'youtube',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',mode:'embed',src:'https://www.youtube.com/embed/dQw4w9WgXcQ',start:true},
      {label:'Vimeo',provider:'vimeo',url:'https://vimeo.com/76979871',mode:'embed',src:'https://player.vimeo.com/video/76979871',start:true},
      {label:'Facebook',provider:'facebook',url:'https://www.facebook.com/watch?v=10153231379946729',mode:'external',start:false},
      {label:'TikTok',provider:'tiktok',url:'https://www.tiktok.com/@scout2015/video/6718335390845095173',mode:'embed',src:'https://www.tiktok.com/player/v1/6718335390845095173?autoplay=0',start:false},
      {label:'Instagram',provider:'instagram',url:'https://www.instagram.com/reel/DIpN0oC1234/',mode:'external',start:false},
      {label:'رابط فيديو مباشر',provider:'direct',url:'https://cdn.venesia-fixture.com/video.webm',mode:'direct',start:true}
    ];
    const urlContexts = {
      youtube:['رابط فيديو YouTube','https://www.youtube.com/watch?v=...'],vimeo:['رابط فيديو Vimeo','https://vimeo.com/...'],facebook:['رابط فيديو Facebook','https://www.facebook.com/watch?v=...'],tiktok:['رابط فيديو TikTok','https://www.tiktok.com/@account/video/...'],instagram:['رابط فيديو Instagram','https://www.instagram.com/reel/...'],direct:['رابط ملف الفيديو المباشر','https://example.com/video.mp4']
    };
    const protectedValues = () => form.evaluate(form => [...new FormData(form)].filter(([name]) => !['video_provider','video_url','video_start_seconds'].includes(name)));
    const protectedBefore = await protectedValues();
    if(mode==='video-create'&&width===1440){
      for(const from of providerCases)for(const to of providerCases){
        await menu.getByRole('option',{name:from.label,exact:true}).click();await url.fill(from.url);
        await menu.getByRole('option',{name:to.label,exact:true}).click();
        await expect(url).toHaveValue(from.provider===to.provider?from.url:'');
        await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state',from.provider===to.provider?'ready':'empty');
        await expect(panel.getByText(urlContexts[to.provider][0],{exact:true})).toBeVisible();await expect(url).toHaveAttribute('placeholder',urlContexts[to.provider][1]);
        assert.deepEqual(await protectedValues(),protectedBefore,'Provider switching preserves all other native fields');
      }
    }
    for(const test of providerCases){
      await menu.getByRole('option',{name:test.label,exact:true}).click(); await expect(form.locator('select[name="video_provider"]')).toHaveValue(test.provider);
      await expect(panel.getByText(urlContexts[test.provider][0],{exact:true})).toBeVisible();await expect(url).toHaveAttribute('placeholder',urlContexts[test.provider][1]);
      await url.fill(test.url);await menu.getByRole('option',{name:test.label,exact:true}).click();await expect(url).toHaveValue(test.url);
      await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state','ready');
      if(test.start) await expect(start).toBeEnabled(); else await expect(start).toBeDisabled();
      if(test.mode==='embed'){await expect(panel.locator('iframe')).toHaveAttribute('src',test.src); const box=await panel.locator('iframe').boundingBox();assert.ok(Math.abs(box.width/box.height-(test.provider==='tiktok'?9/16:16/9))<0.02);}
      else if(test.mode==='external'){await expect(panel.locator('iframe')).toHaveCount(0);await expect(panel.getByRole('link',{name:'فتح مصدر الفيديو',exact:true})).toHaveAttribute('href',test.url);}
      else {const video=panel.locator('video');await expect(video).toHaveAttribute('src',test.url);assert.equal(await video.evaluate(node=>node.autoplay),false);assert.equal(await video.evaluate(node=>getComputedStyle(node).objectFit),'contain');await start.fill('1');await expect(video).toHaveAttribute('src',test.url+'#t=1');await video.evaluate(node=>node.load());await expect.poll(()=>video.evaluate(node=>node.readyState)).toBeGreaterThanOrEqual(2);assert.equal(await video.evaluate(node=>node.paused),true);assert.equal(await video.evaluate(node=>Number.isFinite(node.duration)&&node.duration>1),true,'The native test source has finite duration beyond the requested start');await expect.poll(()=>video.evaluate(node=>node.seekable.length?node.seekable.end(node.seekable.length-1):0)).toBeGreaterThan(1);await expect.poll(()=>video.evaluate(node=>node.currentTime)).toBeGreaterThanOrEqual(0.8);}
      await page.locator('[data-admin-tab-id="display"]').click();await page.locator('[data-admin-tab-id="video"]').click();await expect(form.locator('select[name="video_provider"]')).toHaveValue(test.provider);await expect(url).toHaveValue(test.url);
      assert.deepEqual(await protectedValues(),protectedBefore);
    }
    await provider.click();await url.fill(mode.endsWith('edit')?'https://www.youtube.com/watch?v=dQw4w9WgXcQ':'');await start.fill('');await expect(form).toHaveAttribute('data-admin-form-dirty','false');assert.deepEqual(await values(),initialValues);
    await url.fill(''); await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state', 'empty'); await expect(panel.locator('iframe')).toHaveCount(0);
    for (const invalid of ['https://example.invalid/not-video', 'https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/@channel']) { await url.fill(invalid); await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state', 'invalid'); await expect(url).toHaveAttribute('aria-invalid', 'true'); await expect(panel.locator('iframe')).toHaveCount(0); }
    for (const valid of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ']) { await url.fill(valid); await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state', 'ready'); await expect(panel.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ'); assert.equal(await url.evaluate(node => node.validity.valid), true); const frame = await panel.locator('iframe').boundingBox(); assert.ok(Math.abs(frame.width / frame.height - 16 / 9) < 0.02); }
    const select = async (name, field = thumbnail) => { const add = field.locator('[data-admin-media-image-card="add"]'), opener = await add.count() ? add : field.getByRole('button',{name:/^(?:صورة مصغّرة \(اختياري\)|اختيار بديل|استبدال)$/}); await opener.focus(); await opener.press('Enter'); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); await opener.click(); await expect(picker).toBeVisible(); await picker.locator('button[aria-pressed="false"]').filter({ hasText: name }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0); };
    if (mode.endsWith('create')) await select('SEO fixture original'); await expect(thumbnail.locator('[data-media-original]')).toContainText('394 × 80 px'); assert.equal(await thumbnail.locator('[data-media-original]').evaluate(node => getComputedStyle(node).paddingInlineStart), '12px');
    const imagePreview = thumbnail.locator('[data-admin-media-image-preview-trigger]'); await imagePreview.focus(); await imagePreview.press('Enter'); await expect(page.getByRole('dialog').filter({ has: page.locator('[data-admin-media-image-expanded]') })).toBeVisible(); await page.keyboard.press('Escape'); await expect(imagePreview).toBeFocused();
    await select('SEO fixture replacement'); await expect(form.locator('input[name="video_thumbnail"]')).toHaveValue('/fixture-replacement.svg'); await thumbnail.getByRole('button', { name: 'إزالة', exact: true }).click(); await expect(form.locator('input[name="video_thumbnail"]')).toHaveValue(''); await expect(thumbnail.locator('[data-admin-media-image-card="add"]')).toBeVisible();
    const mainImageField = form.locator('[data-admin-media-image-field="image"]');
    await page.locator('[data-admin-tab-id="basic"]').click(); await select('SEO fixture replacement',mainImageField); await page.locator('[data-admin-tab-id="video"]').click();
    await menu.getByRole('option',{name:'رابط فيديو مباشر',exact:true}).click();await url.fill('https://cdn.venesia-fixture.com/video.webm');
    await expect(panel.locator('video')).toHaveAttribute('poster','/fixture-replacement.svg');
    await select('SEO fixture original');await expect(panel.locator('video')).toHaveAttribute('poster','/fixture.svg');
    await thumbnail.getByRole('button',{name:'إزالة',exact:true}).click();await expect(panel.locator('video')).toHaveAttribute('poster','/fixture-replacement.svg');
    await page.locator('[data-admin-tab-id="basic"]').click(); await mainImageField.getByRole('button',{name:'إزالة',exact:true}).click(); await page.locator('[data-admin-tab-id="video"]').click();await expect(panel.locator('video')).not.toHaveAttribute('poster',/./);
    await select('SEO fixture original');await expect(panel.locator('video')).toHaveAttribute('poster','/fixture.svg');await provider.click();
    const image = thumbnail.locator('[data-admin-media-image-frame] img'); await image.evaluate(node => node.complete && node.naturalWidth > 0 ? undefined : new Promise(resolve => node.addEventListener('load', resolve, { once: true }))); const imageGeometry = await image.evaluate(image => { const frame = image.closest('[data-admin-media-image-frame]'), r = frame.getBoundingClientRect(); return { w: r.width, h: r.height, min: getComputedStyle(frame).minHeight, ratio: getComputedStyle(frame).aspectRatio.split('/').map(Number).reduce((value, divisor) => value / divisor), fit: getComputedStyle(image).objectFit }; }); assert.equal(imageGeometry.fit, 'contain'); assert.equal(imageGeometry.min, '80px'); assert.ok(Math.abs(imageGeometry.h - Math.max(imageGeometry.w / imageGeometry.ratio, 80)) <= 2);
    await url.fill('https://youtu.be/dQw4w9WgXcQ'); await expect(duration).toHaveValue(initialDuration); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); const changed = await values();
    await page.locator('[data-admin-tab-id="display"]').click(); await expect(form.locator('[data-admin-form-switch-surface="premium-inline"]')).toHaveCount(7); await expect(form.locator('[data-admin-tab-section-heading="content-display-settings-heading"]')).toHaveAttribute('data-admin-tab-section-presentation', 'premium'); await page.locator('[data-admin-tab-id="video"]').click(); assert.deepEqual(await values(), changed); await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state', 'ready');
    await page.locator('[data-admin-tab-id="basic"]').click(); await form.locator('input[name="title"]').fill('عنوان صالح لاختبار حقول الفيديو'); if (mode.endsWith('create')) { const category = form.locator('#content-category-listbox'); await category.press('Home'); await category.press('Enter'); }
    await page.locator('[data-admin-tab-id="video"]').click(); await page.evaluate(() => { window.topicDeferSave = true; window.topicFixtureFieldErrors = { video_url: ['رفض تجريبي لرابط الفيديو'], video_thumbnail: ['رفض تجريبي للصورة المصغرة'] }; }); await form.evaluate(form => form.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function'); await expect(url).toBeDisabled(); await expect(provider).toBeDisabled(); for (const control of await thumbnail.getByRole('button').all()) await expect(control).toBeDisabled(); await page.evaluate(() => window.topicReleaseSave()); await expect(url).toBeEnabled(); for (const message of ['رفض تجريبي لرابط الفيديو', 'رفض تجريبي للصورة المصغرة']) await expect(page.getByText(message, { exact: true })).toBeVisible(); await expect(url).toHaveAttribute('aria-invalid', 'true'); const error = await measure(); check(error); assert.deepEqual(await values(), changed); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.equal(await page.evaluate(() => window.topicSubmitted.video_duration), initialDuration);
    const attemptsBeforeSwitch=await page.evaluate(()=>window.topicSaveAttempts),unchangedOtherValues=await protectedValues();
    await provider.click();await expect(url).toHaveValue(changed.video_url);await expect(page.getByText('رفض تجريبي لرابط الفيديو',{exact:true})).toBeVisible();
    await menu.getByRole('option',{name:'Facebook',exact:true}).click();await expect(url).toHaveValue('');await expect(previewState).toHaveAttribute('data-admin-media-video-preview-state','empty');await expect(page.getByText('رفض تجريبي لرابط الفيديو',{exact:true})).toHaveCount(0);await expect(url).not.toHaveAttribute('aria-invalid','true');await expect(page.getByText('رفض تجريبي للصورة المصغرة',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>window.topicSaveAttempts),attemptsBeforeSwitch);assert.deepEqual(await protectedValues(),unchangedOtherValues);await expect(form).toHaveAttribute('data-admin-form-dirty','true');
    await provider.click();await expect(url).toHaveValue('');await url.fill(changed.video_url);await start.fill(changed.video_start_seconds??'');
    await page.evaluate(()=>{window.topicDeferSave=false});await form.evaluate(form=>form.requestSubmit());await expect(page.getByText('رفض تجريبي لرابط الفيديو',{exact:true})).toBeVisible();assert.deepEqual(await values(),changed,'Fresh server errors return without restoring an earlier provider context');
    await page.evaluate(() => { window.topicDeferSave = false; window.topicSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await values(), changed); assert.equal(await page.evaluate(() => window.topicSubmitted.video_duration), initialDuration); const final = await measure(); check(final); await expect(page.locator('[data-admin-form-action="save"]')).toHaveCount(1); await expect(page.locator('[data-admin-form-action="close"]')).toHaveCount(1);
    return { before, error, final, imageGeometry, changedValues: changed, providerPortal, noFaq: true, panelColumnsAndLabelInset: true, supportedProviderKeyboardAndDisabledStates: true, sixProviderBindingsAndPreviewModes: true, providerContextAndLabels: true, allThirtyProviderTransitions:mode==='video-create'&&width===1440, oldFieldErrorClearedAndFreshErrorRestored:true, liveThumbnailMainPosterPriority:true, nativeVideoDecodeAndStart: true, liveEmptyInvalidValidPreview: true, historicalDurationRetained: initialDuration, mediaPreviewPickerReplaceRemove: true, pendingErrorSuccessAndRetainedValues: true, unchangedDisplayAndActions: true };
  };
  const verifyMetaVideoFields = async (mode, width) => {
    const form = page.locator('form[data-admin-form-runtime]'), panel = form.locator('[data-admin-media-video-presentation="panel"]'), url = panel.locator('input[name="video_url"]');
    const option = name => panel.getByRole('option', { name, exact: true });
    const player = () => panel.locator('[data-public-media-video-provider]');
    const fallback = () => player().locator('a[target="_blank"]').last();
    const sourceA = 'https://www.facebook.com/watch?v=10153231379946729', sourceB = 'https://www.facebook.com/watch?v=10153231379946730', sourceC = 'https://www.facebook.com/reel/3305054673010377', instagram = 'https://www.instagram.com/reel/DGOSAUyC903/';
    const stats = () => page.evaluate(() => structuredClone(window.metaSdkStats));
    const fresh = async () => { await open(mode); await page.locator('[data-admin-tab-id="video"]').click(); await expect(url).toBeEditable(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); };
    const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    const sourceAction = async expected => { await expect(fallback()).toHaveAttribute('href', expected); await expect(fallback()).toHaveAttribute('rel', 'noopener noreferrer'); await expect(fallback()).toHaveAttribute('target', '_blank'); await expect(fallback()).toBeVisible(); };
    await fresh();
    const protectedBefore = await form.evaluate(form => [...new FormData(form)].filter(([name]) => !['video_provider', 'video_url', 'video_start_seconds'].includes(name)));
    await option('Facebook').click(); await url.fill(sourceA);
    await expect(player()).toHaveAttribute('data-meta-embed-state', 'unavailable'); await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); assert.deepEqual((await stats()).loads, []); await sourceAction(sourceA);
    await page.evaluate(() => { window.metaReadOutcome = 'mismatch'; }); await url.fill(sourceB);
    await expect(player()).toHaveAttribute('data-meta-embed-state', 'unavailable'); assert.deepEqual((await stats()).loads, []); await sourceAction(sourceB);
    await page.evaluate(() => { window.metaReadOutcome = 'throw'; }); await url.fill(sourceC);
    await expect(player()).toHaveAttribute('data-meta-embed-state', 'unavailable'); await sourceAction(sourceC);
    await page.evaluate(() => { window.metaReadOutcome = 'ready'; }); await url.fill(sourceA);
    await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted'); await expect(player()).toHaveAttribute('data-public-media-video-mode', 'meta-sdk'); await sourceAction(sourceA);
    const approvedFacebook = await stats(); assert.deepEqual(approvedFacebook.loads, ['instagram', 'facebook'], 'The official Meta initialization order prevents a later provider collision'); assert.equal(approvedFacebook.mounts.at(-1).autoplay, 'false'); assert.equal(approvedFacebook.mounts.at(-1).ignoreWrapper, true); assert.equal(approvedFacebook.mounts.at(-1).source, sourceA);
    const frame = panel.locator('[data-meta-video-embed] iframe'); await expect(frame).toHaveCount(1); assert.equal(await frame.evaluate(iframe => iframe.hasAttribute('autoplay') || (iframe.getAttribute('allow') ?? '').includes('autoplay')), false); await expect.poll(() => frame.evaluate(iframe => iframe.contentDocument?.querySelector('video')?.paused)).toBe(true); await noOverflow();
    assert.deepEqual(await form.evaluate(form => [...new FormData(form)].filter(([name]) => !['video_provider', 'video_url', 'video_start_seconds'].includes(name))), protectedBefore, 'oEmbed/SDK reads leave all unrelated native fields untouched'); assert.equal(await page.evaluate(() => window.topicSaveAttempts ?? 0), 0, 'Meta checks never submit or autosave');
    const metaFailureGeometry = () => player().evaluate(node => ({ hostWidth: node.getBoundingClientRect().width, viewportWidth: innerWidth, clientWidth: document.documentElement.clientWidth, documentHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight, state: node.dataset.metaEmbedState, iframeCount: node.querySelectorAll('[data-meta-video-embed] iframe').length, sdk: structuredClone(window.metaSdkStats) }));
    const beforeSdkError = await metaFailureGeometry(); await page.evaluate(() => window.metaSdkTriggerError()); await expect(player()).toHaveAttribute('data-meta-embed-state', 'unavailable');
    try { await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); } catch (error) { console.error('META_SDK_ERROR_DIAGNOSTIC ' + JSON.stringify({ mode, width, before: beforeSdkError, after: await metaFailureGeometry() })); throw error; }
    assert.ok((await stats()).pauses > approvedFacebook.pauses, 'SDK error pauses a hidden or failed Facebook instance'); await sourceAction(sourceA);
    const failedIdentityStats = await stats(), failedIdentityValues = await form.evaluate(form => [...new FormData(form)]);
    for (const size of ['200px', '']) { await player().evaluate((node, size) => { node.style.width = size; }, size); await expect(player()).toHaveAttribute('data-meta-embed-state', size ? 'narrow' : 'unavailable'); await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.equal((await stats()).mounts.length, failedIdentityStats.mounts.length, 'Width changes cannot retry the failed media identity'); }
    await page.locator('[data-admin-tab-id="basic"]').click(); await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); await page.locator('[data-admin-tab-id="video"]').click(); await expect(player()).toHaveAttribute('data-meta-embed-state', 'unavailable'); await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); assert.equal((await stats()).mounts.length, failedIdentityStats.mounts.length, 'Tab hide and return cannot retry the failed media identity'); assert.deepEqual(await form.evaluate(form => [...new FormData(form)]), failedIdentityValues); await sourceAction(sourceA);
    await url.fill(sourceB); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted'); await url.fill(sourceA); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted'); assert.equal((await stats()).mounts.at(-1).source, sourceA, 'A to B to A is a deliberate media identity transition');
    await option('YouTube').click(); await expect(url).toHaveValue(''); await option('Facebook').click(); await url.fill(sourceA); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted'); assert.equal((await stats()).mounts.at(-1).source, sourceA, 'Changing provider away and back permits a deliberate fresh attempt');
    await url.fill(sourceB); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted'); const beforeCleanup = await stats();
    await option('YouTube').click(); await expect(url).toHaveValue(''); await expect(panel.locator('[data-meta-video-embed]')).toHaveCount(0); const afterCleanup = await stats(); assert.ok(afterCleanup.pauses > beforeCleanup.pauses); assert.ok(afterCleanup.unsubscribes > beforeCleanup.unsubscribes); assert.ok(afterCleanup.releases > beforeCleanup.releases);

    await fresh(); await page.evaluate(() => { window.metaDeferReads = true; }); await option('Facebook').click(); await url.fill(sourceA); await expect.poll(() => page.evaluate(() => window.metaPendingReads.length)).toBe(1);
    await url.fill(sourceB); await expect.poll(() => page.evaluate(() => window.metaPendingReads.length)).toBe(2);
    await page.evaluate(() => { const pending = window.metaPendingReads[0]; pending.resolve({ status: 'ready', provider: pending.payload.provider, sourceUrl: pending.payload.video_url }); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.deepEqual((await stats()).loads, [], 'A late previous URL approval cannot load or mount an SDK'); await sourceAction(sourceB);
    await page.evaluate(() => { const pending = window.metaPendingReads[1]; pending.resolve({ status: 'ready', provider: pending.payload.provider, sourceUrl: pending.payload.video_url }); }); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted');
    await url.fill(sourceC); await expect.poll(() => page.evaluate(() => window.metaPendingReads.length)).toBe(3); const loadsBeforeInstagram = (await stats()).loads; await option('Instagram').click(); await url.fill(instagram); await expect.poll(() => page.evaluate(() => window.metaPendingReads.length)).toBe(4);
    await page.evaluate(() => { const pending = window.metaPendingReads[2]; pending.resolve({ status: 'ready', provider: pending.payload.provider, sourceUrl: pending.payload.video_url }); }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.equal((await stats()).mounts.some(mount => mount.source === sourceC), false, 'Late Facebook approval cannot replace a newer Instagram context'); await sourceAction(instagram);
    await page.evaluate(() => { const pending = window.metaPendingReads[3]; pending.resolve({ status: 'ready', provider: pending.payload.provider, sourceUrl: pending.payload.video_url }); });
    const instagramWidth = await player().evaluate(node => node.getBoundingClientRect().width);
    await expect(player()).toHaveAttribute('data-meta-embed-state', instagramWidth >= 326 ? 'mounted' : 'narrow'); await sourceAction(instagram); await noOverflow();
    if (instagramWidth >= 326) { await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(1); assert.equal((await stats()).mounts.at(-1).provider, 'instagram'); } else { await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); assert.deepEqual((await stats()).loads, loadsBeforeInstagram, 'An undersized Instagram container makes no additional SDK request'); assert.equal((await stats()).mounts.some(mount => mount.provider === 'instagram'), false, 'An undersized Instagram container never initializes an embed'); }

    const sdkFailureStates = [];
    for (const failure of ['blocked', 'parse-error']) {
      await fresh(); await page.evaluate(failure => { window.metaReadOutcome = 'ready'; window.metaSdkMode = failure; }, failure); await option('Facebook').click(); await url.fill(sourceA); await expect(player()).toHaveAttribute('data-meta-embed-state', 'unavailable'); await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); await sourceAction(sourceA); await noOverflow(); sdkFailureStates.push(failure);
    }
    await fresh(); await page.evaluate(() => { window.metaReadOutcome = 'ready'; window.metaSdkMode = 'deferred'; }); await option('Facebook').click(); await url.fill(sourceA); await expect.poll(() => delayedMetaSdkRoutes.length).toBe(1);
    await option('YouTube').click(); await expect(url).toHaveValue(''); await page.evaluate(() => { window.metaSdkMode = 'allow'; }); await delayedMetaSdkRoutes.shift()(); await expect.poll(async () => (await stats()).loads).toEqual(['instagram', 'facebook']); await expect(panel.locator('[data-meta-video-embed]')).toHaveCount(0); assert.deepEqual((await stats()).mounts, [], 'A late SDK completion cannot recreate an obsolete Meta player');
    await fresh(); await page.evaluate(() => { window.metaReadOutcome = 'ready'; }); await option('Facebook').click(); await url.fill(sourceC); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted');
    await player().evaluate(node => { node.style.width = '200px'; }); await expect(player()).toHaveAttribute('data-meta-embed-state', 'narrow'); await expect(panel.locator('[data-meta-video-embed] iframe')).toHaveCount(0); await sourceAction(sourceC);
    await player().evaluate(node => { node.style.width = ''; }); await expect(player()).toHaveAttribute('data-meta-embed-state', 'mounted'); await noOverflow();
    const result = { mode, width, officialSdkTransport: 'finite mock; actual official playback proven separately', officialSdkOrder: approvedFacebook.loads, deniedAndMismatchedIdentitySourceFallback: true, rejectedReadSourceFallback: true, approvedFacebookNoAutoplay: true, sdkErrorPausesAndClears: true, failedIdentityStaysInertAcrossResizeAndTabReturn: true, explicitSourceAndProviderIdentityRetry: true, lateUrlAndProviderResponsesIgnored: true, lateSdkCompletionIgnored: true, cleanupPauseReleaseUnsubscribe: true, sdkFailureStates, instagramWidth, instagramState: instagramWidth >= 326 ? 'mounted' : 'narrow', narrowProviderFallbackAndResizeRecovery: true, noOverflow: true, noFormMutationOrAutosave: true };
    console.log('PASS finite Meta SDK failure/race/cleanup/no-autoplay/RTL ' + mode + ' ' + width); return result;
  };
  const verifyMediaTabs = async (mode, width) => {
    const video = mode.startsWith('video-'), type = video ? 'video' : 'gallery', editMode = mode.endsWith('edit');
    const form = page.locator('form[data-admin-form-runtime]'), tab = id => form.locator('[data-admin-tab-id="' + id + '"]');
    const panel = id => page.locator('[id="' + id + '"]');
    const basic = panel(await tab('basic').getAttribute('aria-controls')), media = panel(await tab(type).getAttribute('aria-controls'));
    const specialized = video ? media.locator('[data-admin-media-video-presentation="panel"]') : media.locator('[data-admin-media-gallery-mode="items"]');
    const snapshot = () => form.evaluate(form => [...new FormData(form)]);
    const nativeMedia = () => form.evaluate((form, video) => [...new FormData(form)].filter(([name]) => video ? name.startsWith('video_') || name === 'content' : name.startsWith('gallery_') || name === 'content'), video);
    const selectImage = async (opener, name, keyboard = false) => {
      if (keyboard) { await opener.focus(); await opener.press('Enter'); await expect(page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); }
      await opener.click(); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible();
      await picker.locator('button[aria-pressed="false"]').filter({ hasText: name }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0);
    };
    await expect(form).toHaveCount(1); assert.deepEqual(await form.locator('[data-admin-tab-id]').evaluateAll(nodes => nodes.map(node => node.dataset.adminTabId)), ['basic', type, 'display', 'seo', 'publish']);
    await expect(tab(video ? 'gallery' : 'video')).toHaveCount(0); await expect(tab('basic')).toHaveAttribute('aria-selected', 'true');
    await expect(basic.locator('[data-admin-media-video-presentation],[data-admin-media-gallery-mode],.admin-rich-text-editor')).toHaveCount(0);
    await expect(form.locator(video ? '[name^="gallery_image_"]' : '[name^="video_"]')).toHaveCount(0);
    await expect(specialized).toHaveCount(1); await expect(specialized).toBeHidden(); await expect(form.locator('input[name="content"]')).toHaveCount(1); await expect(form.locator('input[name="content"]')).toHaveValue('');
    await expect(form.locator('[name="media_project"]')).toHaveCount(1); await expect(form.locator('[data-admin-form-action="save"]')).toHaveCount(1); await expect(form.locator('[data-admin-form-action="close"]')).toHaveCount(1);
    const initial = await snapshot(); await form.evaluate((form, type) => { window.topicMediaNode = form.querySelector(type === 'video' ? '[data-admin-media-video-presentation]' : '[data-admin-media-gallery-mode]'); }, type);
    for (const id of [type, 'display', 'seo', 'publish', 'basic']) { await tab(id).click(); await expect(tab(id)).toHaveAttribute('aria-selected', 'true'); assert.deepEqual(await snapshot(), initial, 'Tab switching preserves every mounted native field'); assert.equal(await specialized.evaluate(node => node === window.topicMediaNode), true, 'Canonical media owner retains its node across tabs'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); }
    await form.locator('input[name="title"]').fill('عنوان محلي لفصل تبويب ' + type); if (!editMode) { await form.locator('#content-category-listbox').press('Home'); await form.locator('#content-category-listbox').press('Enter'); }
    await tab(type).focus(); await tab(type).press('Enter'); await expect(specialized).toBeVisible();
    let galleryBehavior = null, metaLifecycle = null, videoGeometry = null;
    if (video) {
      const url = specialized.locator('input[name="video_url"]'), provider = name => specialized.getByRole('option', { name, exact: true });
      await expect(specialized.getByRole('listbox', { name: 'مزود الفيديو', exact: true })).toBeVisible(); await expect(specialized.locator('select[name="video_provider"]')).toHaveValue('youtube');
      await expect(specialized.locator('span.sr-only').filter({ hasText: 'مزود الفيديو' })).toHaveCount(1); await expect(specialized).not.toContainText('اختر المزود الذي يستضيف الفيديو، ثم أضف رابطه الكامل.');
      await url.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await specialized.locator('input[name="video_start_seconds"]').fill('13'); await expect(specialized.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=13');
      await expect(specialized.locator('input[name="video_duration"]')).toHaveValue(editMode ? '3:45' : '');
      const thumbnail = specialized.locator('[data-admin-media-image-field="video_thumbnail"]'), opener = thumbnail.locator('[data-admin-media-image-card="add"]');
      if (await opener.count()) await selectImage(opener, 'SEO fixture original', true);
      await expect(form.locator('input[name="video_thumbnail"]')).toHaveValue('/fixture.svg');
      videoGeometry = await specialized.evaluate(root => { const header = root.querySelector('[data-admin-tab-section-heading="content-video-fields"]'), card = header.closest('section'), label = root.querySelector('#video-provider-label'); return { direction: getComputedStyle(root).direction, columns: getComputedStyle(root.querySelector('[data-admin-form-grid]')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth > innerWidth + 1, topHeaderPresentation: header.dataset.adminTabSectionPresentation, tabId: root.closest('[role="tabpanel"]').id, providerLabel: { text: label.textContent.trim(), position: getComputedStyle(label).position, width: label.getBoundingClientRect().width, height: label.getBoundingClientRect().height }, topHeaderCard: { className: card.className, padding: getComputedStyle(card).paddingTop, border: getComputedStyle(card).borderTopWidth, containsSpecializedOwner: card.contains(root), surface: getComputedStyle(card).backgroundImage } }; });
      assert.equal(videoGeometry.direction, 'rtl'); assert.equal(videoGeometry.columns, width >= 768 ? 2 : 1); assert.equal(videoGeometry.overflow, false); assert.equal(videoGeometry.topHeaderPresentation, 'premium'); assert.ok(videoGeometry.tabId.endsWith('-panel-video')); assert.deepEqual(videoGeometry.providerLabel, { text: 'مزود الفيديو', position: 'absolute', width: 1, height: 1 }); assert.equal(videoGeometry.topHeaderCard.padding, '12px'); assert.equal(videoGeometry.topHeaderCard.border, '1px'); assert.equal(videoGeometry.topHeaderCard.containsSpecializedOwner, true); assert.ok(videoGeometry.topHeaderCard.surface.includes('linear-gradient'));
      await page.evaluate(() => { window.metaReadOutcome = 'ready'; }); await provider('Facebook').click(); await url.fill('https://www.facebook.com/watch?v=10153231379946729');
      const player = specialized.locator('[data-public-media-video-provider]'); await expect(player).toHaveAttribute('data-meta-embed-state', 'mounted'); await expect(specialized.locator('[data-meta-video-embed] iframe')).toHaveCount(1);
      const beforeHide = await page.evaluate(() => structuredClone(window.metaSdkStats)), beforeHideValues = await nativeMedia(); await tab('basic').click();
      await expect(specialized.locator('[data-meta-video-embed] iframe')).toHaveCount(0); await expect.poll(() => page.evaluate(() => window.metaSdkStats.pauses)).toBeGreaterThan(beforeHide.pauses); assert.deepEqual(await nativeMedia(), beforeHideValues);
      await tab(type).click(); await expect(player).toHaveAttribute('data-meta-embed-state', 'mounted'); await expect(specialized.locator('[data-meta-video-embed] iframe')).toHaveCount(1);
      const afterShow = await page.evaluate(() => structuredClone(window.metaSdkStats)); assert.ok(afterShow.mounts.length > beforeHide.mounts.length); assert.equal(afterShow.mounts.at(-1).autoplay, 'false'); assert.deepEqual(await nativeMedia(), beforeHideValues);
      metaLifecycle = { hidePausesAndClears: true, showRemountsNoAutoplay: true, fieldsRetained: true, transport: 'finite SDK and oEmbed ports; official provider playback outside this fixture' };
      await provider('YouTube').click(); await url.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await specialized.locator('input[name="video_start_seconds"]').fill('13');
    } else {
      const cards = specialized.locator('[data-admin-media-gallery-card="image"]'), add = specialized.locator('[data-admin-media-gallery-card="add"]');
      if (!editMode) { await selectImage(add, 'SEO fixture original', true); await selectImage(add, 'SEO fixture replacement'); }
      await expect(cards).toHaveCount(2); await cards.nth(0).locator('[name="gallery_image_alt"]').fill('وصف أول محلي'); await cards.nth(0).locator('[name="gallery_image_caption"]').fill('تعليق أول محلي'); await cards.nth(1).locator('[name="gallery_image_alt"]').fill('وصف ثان محلي'); await cards.nth(1).locator('[name="gallery_image_caption"]').fill('تعليق ثان محلي');
      const ordered = await nativeMedia(); await expect(cards.nth(0).locator('[data-admin-media-gallery-action="move-up"]')).toBeDisabled(); await expect(cards.nth(1).locator('[data-admin-media-gallery-action="move-down"]')).toBeDisabled();
      await cards.nth(0).locator('[data-admin-media-gallery-action="move-down"]').click(); await expect(cards.nth(0).locator('[name="gallery_image_url"]')).toHaveValue('/fixture-replacement.svg'); await expect(cards.nth(0).locator('[name="gallery_image_alt"]')).toHaveValue('وصف ثان محلي'); await expect(cards.nth(0).locator('[name="gallery_image_caption"]')).toHaveValue('تعليق ثان محلي');
      await cards.nth(1).locator('[data-admin-media-gallery-action="move-up"]').click(); assert.deepEqual(await nativeMedia(), ordered, 'Reordering moves each canonical URL/alt/caption tuple intact');
      await selectImage(cards.nth(0).locator('[data-admin-media-gallery-action="replace"]'), 'SEO fixture absent dimensions'); await expect(cards.nth(0).locator('[name="gallery_image_url"]')).toHaveValue('/fixture-no-dimensions.svg'); await expect(cards.nth(0).locator('[name="gallery_image_alt"]')).toHaveValue('وصف أول محلي'); await expect(cards.nth(0).locator('[name="gallery_image_caption"]')).toHaveValue('تعليق أول محلي');
      await cards.nth(1).locator('[data-admin-media-gallery-action="remove"]').click(); await expect(cards).toHaveCount(1); await selectImage(add, 'SEO fixture replacement'); await expect(cards).toHaveCount(2); await cards.nth(1).locator('[name="gallery_image_alt"]').fill('وصف الصورة المضافة'); await cards.nth(1).locator('[name="gallery_image_caption"]').fill('تعليق الصورة المضافة');
      galleryBehavior = { canonicalPicker: true, keyboardEscapeFocus: !editMode, altCaption: true, reorderTuplesAndBoundaries: true, replacePreservesMetadata: true, removeAndAdd: true, captionFieldError: 'Existing owner has no independent caption error output or focus target' };
    }
    const changed = await nativeMedia(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    for (const id of ['basic', 'display', 'seo', 'publish', type]) { await tab(id).click(); assert.deepEqual(await nativeMedia(), changed); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); }
    await form.locator('[data-admin-form-action="close"]').click(); const leave = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await expect(leave).toBeVisible(); await leave.locator('[data-admin-confirm-cancel]').click(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.deepEqual(await nativeMedia(), changed);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), [], 'Video/Gallery retain existing absence of Markdown-only local draft storage');
    const errorName = video ? 'video_url' : 'gallery_image_url', errorText = 'رفض معزول لحقل الوسائط';
    await page.evaluate(({ name, text }) => { window.topicDeferSave = true; window.topicFixtureFieldErrors = { [name]: [text] }; }, { name: errorName, text: errorText }); await tab('publish').click(); await form.evaluate(form => form.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function');
    await expect(form).toHaveAttribute('aria-busy', 'true'); await expect(form.locator('[data-admin-form-action="save"]')).toBeDisabled(); await expect(form.locator('[data-admin-form-action="close"]')).toBeDisabled();
    for (const control of await specialized.locator('input:not([type="hidden"]),button,[role="option"]').all()) await expect(control).toBeDisabled();
    const submittedMedia = await page.evaluate(video => window.topicSubmittedEntries.filter(([name]) => video ? name.startsWith('video_') || name === 'content' : name.startsWith('gallery_') || name === 'content'), video); assert.deepEqual(submittedMedia, changed);
    await page.evaluate(() => window.topicReleaseSave()); await expect(tab(type)).toHaveAttribute('aria-selected', 'true'); await expect(specialized.getByText(errorText, { exact: true })).toBeVisible(); await expect(form.locator(video ? '#video_url' : '#gallery_image_url')).toBeFocused(); assert.deepEqual(await nativeMedia(), changed); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    if (!video) { await page.evaluate(() => { window.topicDeferSave = false; window.topicFixtureFieldErrors = { gallery_image_alt: ['رفض معزول للنص البديل'] }; }); await tab('seo').click(); await form.evaluate(form => form.requestSubmit()); await expect(tab(type)).toHaveAttribute('aria-selected', 'true'); await expect(specialized.locator('#gallery_image_alt')).toBeFocused(); await expect(specialized.getByText('رفض معزول للنص البديل', { exact: true })).toBeVisible(); }
    await page.evaluate(() => { window.topicDeferSave = false; window.topicSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await nativeMedia(), changed); await expect(specialized.getByText(errorText, { exact: true })).toHaveCount(0);
    await form.locator('[data-admin-form-action="close"]').click(); await expect.poll(() => page.evaluate(() => window.topicNavigations ?? [])).toEqual(['/admin/content/topics']);
    await open(type + '-edit'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await nativeMedia(), changed, 'Successful memory save rehydrates actual Edit via canonical media payload parser'); await expect(form.locator('input[name="title"]')).toHaveValue('عنوان محلي لفصل تبويب ' + type); savedMediaRows.delete(type + '-edit');
    await tab(type).click(); const geometry = await specialized.evaluate(root => ({ direction: getComputedStyle(root).direction, width: root.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth + 1, outside: [...root.querySelectorAll('input:not([type="hidden"]),button')].filter(node => node.getBoundingClientRect().width > 0).some(node => { const r = node.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }) })); assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.overflow, false); assert.equal(geometry.outside, false);
    return { mode, width, type, tabOrder: ['basic', type, 'display', 'seo', 'publish'], singleFormAndActions: true, basicAndCrossTypeIsolation: true, mountedFieldsAndNodeIdentity: true, dirtyAcrossTabsAndCloseCancel: true, localDraft: 'Markdown-only local draft remains absent for Video/Gallery; values survive mounted tab navigation', pendingDisabledAndErrorFocus: true, inMemorySaveReloadAndCleanClose: true, videoGeometry, metaLifecycle, galleryBehavior, geometry };
  };
  const verifyReview = async (mode, width) => {
    const form = page.locator('form[data-admin-form-runtime]'), publish = page.locator('[data-admin-tab-id="publish"]');
    await publish.click(); const tabPanel = page.getByRole('tabpanel').filter({ visible: true }), review = tabPanel.locator('[data-admin-entity-review="content"]');
    await expect(review).toHaveAttribute('data-admin-entity-review-presentation', 'panel'); await expect(form).toHaveCount(1);
    const removedPanelCopy = ['تحكم مباشر في المميز والشائع.', 'حالة المحتوى وموعد ظهوره العام.', '7 خيارات', '7 حالات', 'اكتمال مادة المحتوى والمتطلبات الخاصة بنوعها.', 'توفر الصورة ووصفها البديل للعرض وإتاحة الوصول.', 'سلامة بيانات البحث والمشاركة والربط الداخلي.', 'ما سيظهر داخل صفحة المحتوى.', 'أهم مشكلة', 'الدرجة إرشادية ولا تمنع النشر وحدها.'];
    for (const text of removedPanelCopy) await expect(tabPanel).not.toContainText(text);
    const snapshot = () => form.evaluate(form => [...new FormData(form)].map(([name, value]) => [name, typeof value === 'string' ? value : { name: value.name, size: value.size }]));
    const measure = () => tabPanel.evaluate(root => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const card = marker => { const nearest = marker.closest('section'); return box(nearest === marker && nearest.parentElement.tagName === 'SECTION' ? nearest.parentElement : nearest); };
      const headers = [...root.querySelectorAll('[data-admin-tab-section-heading]')].map(header => { const identity = header.querySelector('[data-admin-form-control-header]'), frame = identity.querySelector(':scope > span[aria-hidden="true"]'), heading = header.querySelector('[role="heading"]'), accent = header.querySelector('[data-admin-tab-section-accent]'), style = getComputedStyle(heading); return { id: header.dataset.adminTabSectionHeading, title: heading.textContent.trim(), presentation: header.dataset.adminTabSectionPresentation, font: style.fontSize, weight: style.fontWeight, icon: box(frame.querySelector('svg')), frame: box(frame), header: box(header), accent: box(accent), clipped: [...header.querySelectorAll('[role="heading"],button')].some(node => { const r = node.getBoundingClientRect(), h = header.getBoundingClientRect(); return r.left < h.left - 1 || r.right > h.right + 1; }) }; });
      const topHeader = root.querySelector('[data-admin-tab-section-heading$="-review-publish"]'), topCard = topHeader.closest('section'), top = box(topHeader), outer = box(topCard);
      return { headers, overflow: document.documentElement.scrollWidth > innerWidth + 1, topHeaderCard: { header: top, card: outer, bottomSpace: outer.y + outer.h - top.y - top.h, marginBottom: getComputedStyle(topHeader).marginBottom, padding: getComputedStyle(topCard).paddingBottom, childCount: topCard.children.length, followingGap: box(topCard.nextElementSibling).y - outer.y - outer.h }, root: box(root.querySelector('[data-admin-entity-review]')), notes: card(root.querySelector('[data-admin-entity-review-notes]')), summary: card(root.querySelector('[data-admin-entity-review-status-summary]')), decisions: [...root.querySelectorAll('[data-admin-entity-review-decision]')].map(node => ({ id: node.dataset.adminEntityReviewDecision, ...card(node) })), guidance: [...root.querySelectorAll('[data-admin-entity-review-analysis-tier="guidance"]')].map(node => ({ id: node.dataset.adminEntityReviewAnalysis, ...card(node), detailsButton: box(node.querySelector('button[aria-expanded]')) })), validation: card(root.querySelector('[data-admin-entity-review-analysis="validation"]')), entries: [...root.querySelectorAll('[data-admin-entity-review-status-summary] ol > li')].map(node => ({ ...box(node), title: node.firstElementChild.textContent.trim(), value: node.lastElementChild.textContent.trim() })) };
    });
    const geometry = await measure(); assert.equal(geometry.overflow, false); assert.equal(geometry.headers.length, 12); assert.equal(new Set(geometry.headers.map(header => header.id)).size, 12);
    assert.ok(geometry.topHeaderCard.bottomSpace >= 0 && geometry.topHeaderCard.bottomSpace <= 1, 'Standalone Header fills its Card without an empty body below'); assert.equal(geometry.topHeaderCard.marginBottom, '0px'); assert.equal(geometry.topHeaderCard.padding, '0px'); assert.equal(geometry.topHeaderCard.childCount, 1); assert.equal(geometry.topHeaderCard.followingGap, 20);
    for (const header of geometry.headers) { assert.equal(header.presentation, 'premium'); assert.equal(header.font, '14px'); assert.equal(header.weight, '600'); assert.equal(header.icon.w, 20); assert.equal(header.icon.h, 20); assert.equal(header.frame.w, 40); assert.equal(header.frame.h, 40); assert.equal(header.accent.w, 8); assert.equal(header.clipped, false); assert.ok(header.accent.x > header.frame.x && header.frame.x > header.header.x, 'Gold accent and icon retain physical RTL order'); }
    assert.deepEqual(geometry.decisions.map(card => card.id), ['score', 'publication-schedule', 'featured-popular', 'display-settings']); assert.deepEqual(geometry.guidance.map(card => card.id), ['content', 'image', 'seo']);
    for (const card of geometry.guidance) assert.ok(Math.abs(card.detailsButton.x - card.x - 13) <= 1, 'Guidance details button aligns left within the existing12px Card padding and1px border in RTL');
    assert.deepEqual(geometry.entries.map(entry => entry.title), ['آخر حفظ', 'حالة النشر الحالية', 'تاريخ النشر']);
    const row = cards => { if (width >= 1280) { for (let index = 1; index < cards.length; index++) { assert.ok(Math.abs(cards[index].y - cards[0].y) <= 1); assert.ok(cards[index - 1].x > cards[index].x); } } else for (let index = 1; index < cards.length; index++) assert.ok(cards[index].y >= cards[index - 1].y + cards[index - 1].h - 1); };
    row([geometry.notes, geometry.summary]); row(geometry.decisions); row(geometry.guidance); row(geometry.entries); assert.ok(geometry.decisions[0].y > geometry.notes.y); assert.ok(geometry.guidance[0].y > geometry.decisions[0].y); assert.ok(geometry.validation.y > geometry.guidance[0].y); assert.ok(Math.abs(geometry.validation.w - geometry.root.w) <= 1);
    assert.equal(geometry.entries[0].value, mode.endsWith('create') ? 'لم يُحفظ بعد' : await page.evaluate(() => window.reviewFixture.savedAt)); assert.equal(geometry.entries[1].value, 'غير منشور');
    const oracle = await page.evaluate(() => window.reviewFixture.analysis()), blocked = oracle.checks.filter(item => item.blocksPublish && item.status === 'fail'), notes = oracle.checks.filter(item => item.status === 'warn' || item.status === 'info');
    await expect(review.locator('[data-admin-entity-review-decision="score"] [aria-label]')).toHaveAttribute('aria-label', 'درجة جاهزية النشر ' + oracle.score + ' من 100');
    const notesCard = review.locator('[data-admin-entity-review-notes]'); await expect(notesCard.locator('li')).toHaveCount(notes.length); for (const note of notes) await expect(notesCard).toContainText(note.hint);
    for (const id of ['content', 'image', 'seo']) { const issues = oracle.checks.filter(item => item.group === id && item.status !== 'pass'), topIssue = issues.find(item => item.status === 'fail') ?? issues[0], card = review.locator('[data-admin-entity-review-analysis="' + id + '"]'); if (topIssue) { await expect(card).toContainText(topIssue.label); await expect(card).toContainText(topIssue.hint); } else await expect(card).toContainText('لا توجد مشكلات حالية.'); }
    const analyses = ['content', 'image', 'seo', 'validation']; const retained = await snapshot();
    for (const id of analyses) { const card = review.locator('[data-admin-entity-review-analysis="' + id + '"]'), toggle = card.getByRole('button', { name: 'عرض التفاصيل', exact: true }); await toggle.focus(); await toggle.press('Enter'); await expect(card).toHaveAttribute('data-admin-entity-review-expanded', 'true'); const items = id === 'validation' ? blocked : oracle.checks.filter(item => item.group === id && item.status !== 'pass'); await expect(card.locator('[data-admin-entity-review-issue]')).toHaveCount(items.length); for (const item of items) { const issue = card.locator('[data-admin-entity-review-issue="' + item.id + '"]'); await expect(issue).toHaveAttribute('data-admin-entity-review-severity', item.severity); await expect(issue).toContainText(item.label); await expect(issue).toContainText(item.hint); } }
    for (const id of analyses) await expect(review.locator('[data-admin-entity-review-analysis="' + id + '"]')).toHaveAttribute('data-admin-entity-review-expanded', 'true');
    for (const id of analyses) { const card = review.locator('[data-admin-entity-review-analysis="' + id + '"]'); await card.getByRole('button', { name: 'إخفاء التفاصيل', exact: true }).press('Space'); await expect(card).toHaveAttribute('data-admin-entity-review-expanded', 'false'); }
    assert.deepEqual(await snapshot(), retained, 'Inline details retain every submitted value');
    const scoreDetails = review.locator('[data-admin-entity-review-score-details]'), analysisId = await scoreDetails.getAttribute('aria-controls'); await scoreDetails.click(); await expect(page.locator('[id="' + analysisId + '"]')).toBeInViewport();
    const publication = form.locator('input[name="content_publication_toggle"]'), featured = form.locator('input[name="is_featured"]'), popular = form.locator('input[name="is_popular"]');
    for (const control of [publication, featured, popular]) { const original = await control.isChecked(); await control.focus(); await control.press('Space'); await expect(control).toBeChecked({ checked: !original }); await control.press('Space'); await expect(control).toBeChecked({ checked: original }); }
    const date = form.locator('input[name="published_at"]'); await expect(date).toBeEnabled(); await expect(date).toHaveAttribute('type', 'date'); assert.equal(await form.locator('[data-topic-date-picker-trigger] > span').first().evaluate(node => getComputedStyle(node).paddingInlineStart), '12px'); assert.equal(await form.locator('#content-publication-hint').evaluate(node => getComputedStyle(node).paddingInlineStart), '12px'); const initialDate = await date.inputValue(); await date.fill('2026-10-22'); await expect(date).toHaveValue('2026-10-22'); await date.fill(''); await expect(review.locator('[data-admin-entity-review-status-summary]')).toContainText('سيُحدد عند أول نشر'); await date.fill(initialDate);
    await featured.focus(); await featured.press('Space'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    const displayBefore = await form.locator('input[type="checkbox"][name^="show_"]').evaluateAll(nodes => nodes.filter(node => !node.name.includes('faq')).map(node => ({ name: node.name, checked: node.checked })));
    await review.getByRole('button', { name: 'تعديل الإعدادات', exact: true }).click(); await expect(page.locator('[data-admin-tab-id="display"]')).toHaveAttribute('aria-selected', 'true'); const firstDisplay = form.locator('input[name="show_title_on_page"]'); await expect(firstDisplay).toBeFocused(); await firstDisplay.press('Space'); const changedDisplay = await firstDisplay.isChecked(); await publish.click(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); const displaySummary = review.locator('[data-admin-entity-review-decision="display-settings"]'); await expect(displaySummary.locator('dl').filter({ has: page.getByText('إظهار العنوان', { exact: true }) }).locator('dd')).toHaveText(changedDisplay ? 'ظاهر' : 'مخفي'); assert.equal(displayBefore.length, 7); await expect(displaySummary.locator('dt')).toHaveCount(7); await expect(displaySummary.locator('input')).toHaveCount(0);
    await page.locator('[data-admin-form-action="close"]').click(); const leave = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await expect(leave).toBeVisible(); await leave.locator('[data-admin-confirm-cancel]').click(); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.locator('[data-admin-tab-id="basic"]').click(); await form.locator('input[name="title"]').fill('عنوان صالح لاختبار مراجعة النشر'); if (mode.endsWith('create')) { const category = form.locator('#content-category-listbox'); await category.press('Home'); await category.press('Enter'); await expect(form.locator('select[name="category_id"]')).toHaveValue('17'); } await publish.click(); const submitted = await snapshot();
    await page.evaluate(() => { window.topicDeferSave = true; window.topicFixtureFieldErrors = { status: ['رفض تجريبي لحالة النشر'] }; }); await form.evaluate(form => form.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function'); for (const control of [publication, featured, popular, date]) await expect(control).toBeDisabled(); await page.evaluate(() => window.topicReleaseSave()); await expect(featured).toBeEnabled(); await expect(page.getByText('رفض تجريبي لحالة النشر', { exact: true })).toBeVisible(); assert.deepEqual(await snapshot(), submitted); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.evaluate(() => { window.topicDeferSave = false; window.topicSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await snapshot(), submitted);
    let lockedPublishedDate = null;
    if (mode.endsWith('edit')) { await page.goto('http://topic-content.fixture/?mode=' + mode + '&review-state=published' + (mediaFixture ? '&seo-fixture=1' : '')); await page.evaluate(() => document.fonts.ready); await publish.click(); await expect(date).toBeDisabled(); await expect(form.locator('[data-topic-date-picker-trigger]')).toBeDisabled(); await expect(publication).toBeChecked(); await expect(review.locator('[data-admin-entity-review-status-summary]')).toContainText(await page.evaluate(() => window.reviewFixture.publishedAt)); lockedPublishedDate = await date.inputValue(); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    return { width, mode, geometry, removedPanelCopy, actualIssueMessagesRetained: true, score: oracle.score, blocking: blocked.length, notes: notes.length, independentInlineDetails: true, scoreDetailsScroll: true, togglesDateAndPublishedLock: true, lockedPublishedDate, singleFormDisplayNavigationDirtyAndMemorySave: true };
  };
  const verifySeo = async (mode, width) => {
    const form = page.locator('form[data-admin-form-runtime]'), seoTab = page.locator('[data-admin-tab-id="seo"]'); await seoTab.click();
    const seo = page.locator('[data-admin-entity-seo-panel]'), social = seo.locator('[data-admin-entity-seo-social-fields]'), media = social.locator('[data-admin-media-image-field="og_image"]'), alt = social.locator('input[name="og_image_alt"]');
    await expect(form).toHaveCount(1); await expect(seo).toHaveAttribute('data-admin-entity-seo-presentation', 'panel'); await expect(social).toHaveCount(1); await expect(seo.locator('[data-admin-entity-seo-overrides]')).toHaveCount(1);
    const names = await page.evaluate(() => Object.values(window.seoFixture.names)); assert.equal(names.length, 9); for (const name of names) await expect(form.locator('[name="' + name + '"]')).toHaveCount(1);
    const read = () => page.evaluate(() => window.seoFixture.read()), before = await read(); assert.equal(before.robotsIndex, mode.endsWith('edit') ? false : null); assert.equal(before.robotsFollow, mode.endsWith('edit') ? true : null); assert.equal(before.ogImage, mode.endsWith('edit') ? '/fixture.svg' : '');
    const measure = () => social.evaluate(root => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; }, grid = root.querySelector('[data-admin-form-grid]'), info = grid.children[0], image = grid.children[1], field = root.querySelector('[data-admin-media-image-field="og_image"]'), frame = field.querySelector('[data-admin-media-image-frame]'), bitmap = frame?.querySelector('img'), bitmapBox = bitmap ? box(bitmap) : null, natural = bitmap ? { w: bitmap.naturalWidth, h: bitmap.naturalHeight } : null, scale = natural?.w && bitmapBox ? Math.min(bitmapBox.w / natural.w, bitmapBox.h / natural.h) : null;
      const index = root.querySelector('[name="robots_index"]').closest('[data-admin-form-listbox]').querySelector('[role="combobox"]'), follow = root.querySelector('[name="robots_follow"]').closest('[data-admin-form-listbox]').querySelector('[role="combobox"]'), robots = index.closest('[data-admin-form-grid]');
      const canonical = root.querySelector('[name="canonical_url"]'), imageAlt = root.querySelector('[name="og_image_alt"]'), imageCard = field.closest('section'), imageBody = field.parentElement, add = field.querySelector('[data-admin-media-image-card="add"]');
      const infoCards = [index.closest('section'), canonical.closest('section'), imageAlt.closest('section')].map((card, position) => { const style = getComputedStyle(card), firstField = position === 0 ? index.closest('[data-admin-form-listbox]') : [canonical, imageAlt][position - 1].closest('label'); return { ...box(card), labels: [...card.querySelectorAll('[data-admin-form-label-text]')].map(label => label.textContent.trim()), headers: card.querySelectorAll('[data-admin-tab-section-heading]').length, topContentInset: firstField.getBoundingClientRect().top - card.getBoundingClientRect().top, paddingTop: parseFloat(style.paddingTop), borderTop: parseFloat(style.borderTopWidth), radius: parseFloat(style.borderTopRightRadius), background: style.backgroundImage }; });
      const headers = [...root.querySelectorAll('[data-admin-tab-section-heading]')].map(header => { const title = header.querySelector('[role="heading"]'), icon = header.querySelector('svg'), accent = header.querySelector('[data-admin-tab-section-accent]'); return { id: header.dataset.adminTabSectionHeading, title: title.textContent.trim(), font: getComputedStyle(title).fontSize, weight: getComputedStyle(title).fontWeight, icon: box(icon), iconFrame: box(icon.parentElement), accent: box(accent), presentation: header.dataset.adminTabSectionPresentation }; });
      const labels = [...document.querySelector('[data-admin-entity-seo-panel]').querySelectorAll('[data-admin-form-label-text]')].map(node => ({ text: node.textContent.trim(), inset: getComputedStyle(node).paddingInlineStart }));
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id), duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
      return { direction: getComputedStyle(root).direction, gridPresentation: grid.dataset.adminFormGrid, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, gap: parseFloat(getComputedStyle(grid).columnGap), info: box(info), image: box(image), infoCards, imageCard: { ...box(imageCard), childCount: imageCard.children.length, paddingBottom: parseFloat(getComputedStyle(imageCard).paddingBottom), borderBottom: parseFloat(getComputedStyle(imageCard).borderBottomWidth) }, imageBody: box(imageBody), canonicalSupport: canonical.closest('label').querySelector(':scope > span:last-of-type').textContent.trim(), add: add ? box(add) : null, rightOwnerNames: [...info.querySelectorAll('[name]')].map(node => node.name), leftOwnerNames: [...image.querySelectorAll('[name]')].map(node => node.name), robots: { columns: getComputedStyle(robots).gridTemplateColumns.split(' ').length, gap: parseFloat(getComputedStyle(robots).columnGap), index: box(index), follow: box(follow) }, headers, labels, duplicateIds, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1, overflowControls: [...document.querySelector('[data-admin-entity-seo-panel]').querySelectorAll('input:not([type="hidden"]),textarea,button,[role="combobox"]')].filter(node => !node.matches('[aria-hidden="true"]') && node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden').map(node => ({ name: node.name || node.getAttribute('aria-label'), ...box(node) })).filter(node => node.x < -1 || node.right > innerWidth + 1), frame: frame ? box(frame) : null, frameMinHeight: frame ? getComputedStyle(frame).minHeight : null, frameAspectRatio: frame ? getComputedStyle(frame).aspectRatio.split('/').map(Number).reduce((value, divisor) => value / divisor) : null, imageFit: bitmap ? getComputedStyle(bitmap).objectFit : null, bitmapBox, natural, containedBitmap: scale ? { w: natural.w * scale, h: natural.h * scale } : null };
    });
    const checkLayout = geometry => {
      assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.documentOverflow, false); assert.deepEqual(geometry.overflowControls, []); assert.deepEqual(geometry.duplicateIds, []); assert.deepEqual(geometry.rightOwnerNames, ['robots_index', 'robots_follow', 'canonical_url', 'og_image_alt']); assert.deepEqual(geometry.leftOwnerNames, ['og_image']);
      assert.equal(geometry.gridPresentation, 'equal-height-columns'); assert.equal(geometry.headers.length, 2); assert.deepEqual(geometry.headers.map(header => header.title), ['إعدادات المشاركة الاجتماعية (Open Graph)', 'صورة المشاركة']);
      for (const header of geometry.headers) { assert.equal(header.presentation, 'premium'); assert.equal(header.font, '14px'); assert.equal(header.weight, '600'); assert.equal(header.icon.w, 20); assert.equal(header.icon.h, 20); assert.equal(header.iconFrame.w, 40); assert.equal(header.iconFrame.h, 40); assert.equal(header.accent.w, 8); }
      assert.equal(geometry.labels.length, 9); for (const label of geometry.labels) assert.equal(label.inset, '12px');
      assert.deepEqual(geometry.infoCards.map(card => card.labels), [['الفهرسة', 'تتبع الروابط'], ['الرابط الأساسي (Canonical URL)'], ['النص البديل لصورة المشاركة']]);
      for (const card of geometry.infoCards) { assert.equal(card.headers, 0); assert.equal(card.borderTop, 1); assert.ok(card.radius > 0); assert.ok(card.background.includes('linear-gradient')); assert.ok(Math.abs(card.topContentInset - card.paddingTop - card.borderTop) <= 1, 'Information boxes start at normal padding without reserved header space'); }
      assert.ok(Math.abs(geometry.infoCards[1].y - geometry.infoCards[0].bottom - geometry.gap) <= 1); assert.ok(Math.abs(geometry.infoCards[2].y - geometry.infoCards[1].bottom - geometry.gap) <= 1); assert.ok(geometry.canonicalSupport.includes('اتركه فارغًا لاستخدام رابط ' + (mode.startsWith('video-') ? 'فيديو' : 'الموضوع') + ' العام تلقائيًا.')); assert.match(geometry.canonicalSupport, /\d+ حرف/);
      assert.equal(geometry.imageCard.childCount, 2, 'Only the retained media header and normal-flow media body occupy the outer Card'); assert.ok(Math.abs(geometry.imageCard.y - geometry.image.y) <= 1); assert.ok(Math.abs(geometry.imageCard.bottom - geometry.image.bottom) <= 1); assert.ok(geometry.imageCard.w <= geometry.image.w + 1, 'Outer image Card stays within its media column: ' + JSON.stringify({ card: geometry.imageCard, column: geometry.image, frame: geometry.frame }));
      if (geometry.add) assert.ok(Math.abs(geometry.add.h - geometry.add.w * 9 / 16) <= 1, 'Empty picker keeps its existing aspect-video size');
      if (geometry.frame) { assert.equal(geometry.frameMinHeight, '80px'); assert.ok(Math.abs(geometry.frame.h - Math.max(geometry.frame.w / geometry.frameAspectRatio, 80)) <= 2, 'Inner frame follows its existing ratio/minimum rather than the outer Card height'); }
      if (width >= 1280) {
        assert.equal(geometry.columns, 12); assert.ok(geometry.info.x > geometry.image.x); assert.ok(Math.abs(geometry.info.y - geometry.image.y) <= 1); assert.ok(Math.abs((geometry.info.w + geometry.gap) / (geometry.image.w + geometry.gap) - 2) < 0.01); assert.ok(Math.abs(geometry.imageCard.bottom - geometry.infoCards[2].bottom) <= 1, 'Outer media Card ends exactly with the Alt Text box'); assert.ok(Math.abs(geometry.imageCard.h - geometry.info.h) <= 1); assert.ok(geometry.imageCard.bottom - geometry.imageBody.bottom > geometry.imageCard.paddingBottom + geometry.imageCard.borderBottom, 'Remaining outer Card area stays outside normal-flow media content'); assert.equal(geometry.robots.columns, 2); assert.ok(geometry.robots.index.x > geometry.robots.follow.x); assert.ok(Math.abs(geometry.robots.index.y - geometry.robots.follow.y) <= 1);
      } else {
        assert.equal(geometry.columns, 1); assert.ok(geometry.image.y >= geometry.info.bottom + geometry.gap - 1); assert.ok(Math.abs(geometry.info.w - geometry.image.w) <= 1); assert.ok(Math.abs(geometry.imageCard.bottom - geometry.imageBody.bottom - geometry.imageCard.paddingBottom - geometry.imageCard.borderBottom) <= 1, 'Stacked media Card returns to its content height without a reserved desktop gap'); assert.equal(geometry.robots.columns, 1); assert.ok(geometry.robots.follow.y >= geometry.robots.index.bottom + geometry.robots.gap - 1);
      }
    };
    const initialGeometry = await measure(); checkLayout(initialGeometry);
    const selectAsset = async (name, cancelFirst = false) => { const opener = await media.locator('[data-admin-media-image-card="add"]').count() ? media.locator('[data-admin-media-image-card="add"]') : media.getByRole('button', { name: 'استبدال', exact: true }); await opener.focus(); await opener.press('Enter'); let picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible(); if (cancelFirst) { await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); await opener.click(); picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); } await picker.locator('button[aria-pressed="false"]').filter({ hasText: name }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0); };
    if (mode.endsWith('create')) { await expect(media.locator('[data-admin-media-image-card="add"]')).toBeVisible(); await selectAsset('SEO fixture original', true); }
    await expect(media.locator('[data-admin-media-image-preview-trigger]')).toBeVisible(); await expect(media.locator('[data-media-original]')).toContainText('394 × 80 px'); assert.equal(await media.locator('[data-media-original]').evaluate(node => getComputedStyle(node).paddingInlineStart), '12px');
    const waitBitmap = () => media.locator('[data-admin-media-image-frame] img').evaluate(image => image.complete && image.naturalWidth > 0 ? undefined : new Promise(resolve => image.addEventListener('load', resolve, { once: true })));
    await waitBitmap(); const selectedGeometry = await measure(); checkLayout(selectedGeometry);
    const checkBitmap = geometry => { assert.equal(geometry.imageFit, 'contain'); assert.ok(geometry.natural.w > 0 && geometry.natural.h > 0); assert.ok(Math.abs(geometry.natural.h - geometry.natural.w * (80 / 394)) <= 1, 'SVG viewBox394x80 has no intrinsic pixel dimensions; decoded natural fallback keeps that ratio within1px rounding'); assert.equal(geometry.frameMinHeight, '80px'); assert.ok(Math.abs(geometry.frame.h - Math.max(geometry.frame.w / (394 / 80), 80)) <= 2); assert.ok(geometry.frame.w <= geometry.image.w + 1); assert.ok(geometry.containedBitmap.w <= geometry.bitmapBox.w + 0.1 && geometry.containedBitmap.h <= geometry.bitmapBox.h + 0.1); assert.ok(Math.abs(geometry.containedBitmap.w / geometry.containedBitmap.h - geometry.natural.w / geometry.natural.h) < 0.001, 'Object containment preserves the actual decoded bitmap ratio without cropping or stretching'); };
    checkBitmap(selectedGeometry); const preview = media.locator('[data-admin-media-image-preview-trigger]'); await preview.focus(); await preview.press('Enter'); await expect(page.getByRole('dialog', { name: 'معاينة صورة المشاركة', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(preview).toBeFocused();
    await alt.fill('وصف بديل مستقل محفوظ للاختبار'); await selectAsset('SEO fixture absent dimensions', true); await expect(media.locator('[data-media-original]')).toContainText('غير متاحة'); await waitBitmap(); const absentDimensions = await measure(); checkLayout(absentDimensions); checkBitmap(absentDimensions); await expect(alt).toHaveValue('وصف بديل مستقل محفوظ للاختبار');
    await selectAsset('SEO fixture unavailable'); await expect(media.locator('[data-admin-media-preview-state="unavailable"]')).toBeVisible(); await expect(form.locator('input[name="og_image"]')).toHaveValue('/fixture-unavailable.svg'); await expect(media.locator('[data-admin-media-image-preview-trigger]')).toHaveCount(0); await expect(media.getByRole('button', { name: 'استبدال', exact: true })).toBeEnabled(); await expect(media.getByRole('button', { name: 'إزالة', exact: true })).toBeEnabled(); const unavailableGeometry = await measure(); checkLayout(unavailableGeometry); assert.ok(Math.abs(unavailableGeometry.frameAspectRatio - 16 / 9) < 0.001);
    await media.getByRole('button', { name: 'إزالة', exact: true }).click(); await expect(form.locator('input[name="og_image"]')).toHaveValue(''); await expect(alt).toHaveValue('وصف بديل مستقل محفوظ للاختبار'); await expect(media.locator('[data-admin-media-image-card="add"]')).toBeVisible(); const emptyGeometry = await measure(); checkLayout(emptyGeometry); await selectAsset('SEO fixture replacement'); await expect(form.locator('input[name="og_image"]')).toHaveValue('/fixture-replacement.svg'); await expect(alt).toHaveValue('وصف بديل مستقل محفوظ للاختبار');
    await form.locator('input[name="seo_title"]').fill('عنوان محركات البحث المعدل للاختبار'); await form.locator('textarea[name="seo_description"]').fill('وصف تعريفي محفوظ لاختبار بقاء حقول البحث والمشاركة دون تغيير أثناء التنقل والحفظ المحدود.'); await form.locator('input[name="focus_keyword"]').fill('اختبار'); await form.locator('#content-seo-keywords input[type="text"]').fill('تحقق'); await form.locator('#content-seo-keywords input[type="text"]').press('Enter'); await form.locator('input[name="canonical_url"]').fill('https://example.test/seo-fixture');
    for (const [id, option, field] of [['content-robots-index', 'Noindex', 'robots_index'], ['content-robots-follow', 'Nofollow', 'robots_follow']]) { const trigger = form.locator('#' + id); await trigger.focus(); await trigger.press('ArrowDown'); await expect(page.getByRole('listbox')).toBeVisible(); await page.getByRole('option', { name: option, exact: true }).click(); await expect(form.locator('select[name="' + field + '"]')).toHaveValue('false'); }
    const edited = await read(); assert.equal(edited.robotsIndex, false); assert.equal(edited.robotsFollow, false); assert.ok(edited.seoKeywords.includes('تحقق')); assert.equal(edited.ogImageAlt, 'وصف بديل مستقل محفوظ للاختبار'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.locator('[data-admin-tab-id="display"]').click(); await seoTab.click(); assert.deepEqual(await read(), edited); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.locator('[data-admin-tab-id="basic"]').click(); await form.locator('input[name="title"]').fill('عنوان صالح لاختبار تكوين المشاركة الاجتماعية'); if (mode.endsWith('create')) { const category = form.locator('#content-category-listbox'); await category.press('Home'); await category.press('Enter'); await expect(form.locator('select[name="category_id"]')).toHaveValue('17'); } await seoTab.click();
    await page.evaluate(() => { window.topicDeferSave = true; window.topicFixtureFieldErrors = { canonical_url: ['رفض تجريبي للرابط الأساسي'], og_image_alt: ['رفض تجريبي للنص البديل'] }; }); await form.evaluate(form => form.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function'); await expect(form.locator('input[name="seo_title"]')).toBeDisabled(); await expect(form.locator('#content-robots-index')).toBeDisabled(); await page.evaluate(() => window.topicReleaseSave()); await expect(form.locator('input[name="seo_title"]')).toBeEnabled(); await expect(page.getByText('رفض تجريبي للرابط الأساسي', { exact: true })).toBeVisible(); await expect(page.getByText('رفض تجريبي للنص البديل', { exact: true })).toBeVisible(); assert.deepEqual(await read(), edited); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
    await page.evaluate(() => { window.topicDeferSave = false; window.topicSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await read(), edited); for (const name of names) assert.equal(await form.locator('[name="' + name + '"]').count(), 1); const finalGeometry = await measure(); checkLayout(finalGeometry); checkBitmap(finalGeometry);
    return { mode, width, initialGeometry, selectedGeometry, absentDimensions, unavailableGeometry, emptyGeometry, finalGeometry, initialValues: before, editedValues: edited, uniqueNineFields: true, retainedTwoPremiumHeadersAndThreePlainLabelBoxes: true, equalOuterDesktopAndNaturalMobileCards: true, unchangedInnerImageGeometry: true, mediaPreviewPickerReplaceRemove: true, knownAbsentAndUnavailableDimensions: true, independentAlt: true, dirtyNavigationPendingErrorAndMemorySave: true };
  };
  try {
    if (unifiedImageOnly) {
      await verifyUnifiedImageSystem({ fixtureRoot, page, browser, open, errors, forbidden, seoReads, output: unifiedImageEvidenceRoot, sourceHashesAtStart: unifiedImageSourceHashesAtStart, readSourceHashes: readUnifiedImageSourceHashes, recordSourceIdentity: recordUnifiedImageSourceIdentity, getHarness: () => slugHarness, setHarness: value => { slugHarness = value; }, setMode: value => { slugMode = value; }, savedSlugRows, slugSaveResults, holdReferences: () => { unifiedImageHoldReferences = true; }, releaseReferences: releaseUnifiedImageReferences });
      return;
    }
    if (draftNoticeOnly) {
      await verifyDraftNoticeUnification({ page, browser, open, errors, forbidden, output: draftNoticeEvidenceRoot, sourceHashesAtStart: draftNoticeSourceHashesAtStart, readSourceHashes: readDraftNoticeSourceHashes, recordSourceIdentity: recordDraftNoticeSourceIdentity, slugSaveResults });
      return;
    }
    if (contentPanelGalleryOnly) {
      await verifyContentPanelGalleryAdoption({ fixtureRoot, page, browser, open, errors, forbidden, seoReads, iframeReads, panelGalleryEvidenceRoot, panelGallerySourceHashesAtStart, readPanelGallerySourceHashes, recordPanelGallerySourceIdentity, getHarness: () => slugHarness, setHarness: value => { slugHarness = value; }, setMode: value => { slugMode = value; }, savedSlugRows, slugSaveResults });
      return;
    }
    if (fullFormDraftOnly) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      const { createTopicSlugSaveHarness } = await import('./fixtures/remaining-content-owner-harness.mjs');
      await mkdir(draftEvidenceRoot, { recursive: true });
      const draftCases = [], screenshots = [], boundaryCases = [], noticeCases = [];
      const form = page.locator('form[data-admin-form-runtime]');
      const notice = () => page.locator('[data-topic-form-draft]').first();
      const tab = id => form.locator('[data-admin-tab-id="' + id + '"]');
      const native = () => form.evaluate(form => [...new FormData(form)].filter(([name]) => !['id', 'expected_updated_at'].includes(name)).sort(([a], [b]) => a.localeCompare(b)));
      const allStorage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
      const records = () => page.evaluate(() => Object.keys(localStorage).flatMap(key => { try { const record = JSON.parse(localStorage.getItem(key)); return record?.version === 2 && record.fields ? [{ key, record }] : []; } catch { return []; } }));
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const reload = async () => {
        const accept = async dialog => { assert.equal(dialog.type(), 'beforeunload'); await dialog.accept(); };
        const debugSnapshot = () => page.evaluate(() => { const { api, session } = window.topicDraftFixture, scope = { ...session, contentType: new FormData(document.querySelector('form')).get('content_type'), entity: String(window.topicFixtureSeed.id) }; return { now: new Date().toISOString(), scope, records: Object.keys(localStorage).map(key => { const raw = localStorage.getItem(key); let record; try { record = JSON.parse(raw); } catch {} return { key, recordScope: record?.scope, parseStatus: api.parseTopicFormDraft(raw, scope).status, title: record?.fields?.title, baselineTitle: record?.baselineFields?.title }; }), owner: document.querySelector('[data-topic-form-draft-owner]')?.outerHTML }; });
        if (draftFirstCaseOnly) console.log('DRAFT_BEFORE_RELOAD ' + JSON.stringify(await debugSnapshot()));
        page.on('dialog', accept); try { await page.reload(); } finally { page.off('dialog', accept); }
        await expect(form).toHaveCount(1); await settle();
        if (draftFirstCaseOnly) console.log('DRAFT_AFTER_RELOAD ' + JSON.stringify(await debugSnapshot()));
      };
      const restore = async () => { await expect(notice()).toHaveAttribute('data-topic-form-draft', /pending|conflict/); const selectedKey = await notice().getAttribute('data-topic-form-draft-key'); await notice().locator('[data-topic-form-draft-restore]').first().click(); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'restored'); await settle(); return selectedKey; };
      const discard = async () => { await expect(notice()).toHaveAttribute('data-topic-form-draft', /pending|conflict/); await notice().locator('[data-topic-form-draft-discard]').first().click(); await settle(); };
      const cancelLeave = async () => { const dialog = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await expect(dialog).toBeVisible(); await dialog.locator('[data-admin-confirm-cancel]').click(); await expect(dialog).toHaveCount(0); };
      const selectImage = async (owner, asset) => {
        const add = owner.locator('[data-admin-media-image-card="add"]'), thumbnailControl = owner.locator('#video_thumbnail_control'), opener = await add.count() ? add : await thumbnailControl.count() ? thumbnailControl : owner.getByRole('button', { name: 'استبدال', exact: true });
        await opener.click(); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible();
        await picker.locator('button[aria-pressed="false"]').filter({ hasText: asset }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0);
      };
      const selectGalleryImage = async asset => {
        await form.locator('[data-admin-media-gallery-card="add"]').click(); const picker = page.getByRole('dialog', { name: 'اختيار صورة من المكتبة', exact: true }); await expect(picker).toBeVisible();
        await picker.locator('button[aria-pressed="false"]').filter({ hasText: asset }).click(); await picker.getByRole('button', { name: 'تأكيد الاختيار', exact: true }).click(); await expect(picker).toHaveCount(0);
      };
      const setSwitch = async (name, checked) => { const control = form.locator('input[type="checkbox"][name="' + name + '"]'); await control.evaluate((input, checked) => { if (input.checked !== checked) input.click(); }, checked); await expect(control).toBeChecked({ checked }); };
      const fresh = async mode => {
        await slugHarness?.close(); slugHarness = undefined; slugMode = mode; savedSlugRows.clear();
        await open(mode); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload(); await expect(form.locator('input[name="title"]')).toBeEditable(); await settle();
        const seed = await page.evaluate(() => window.topicFixtureSeed);
        slugHarness = await createTopicSlugSaveHarness(fixtureRoot, { rows: mode.endsWith('edit') ? [{ ...seed, content_type: await form.locator('[name="content_type"]').inputValue() }] : [], categories: [{ id: 17, name: 'تصنيف تجريبي', slug: 'fixture', parent_id: null, is_active: true, status: 'published', deleted_at: null }], series: [{ id: 187, name: 'سلسلة تجريبية', slug: 'fixture-series', category_id: 17, status: 'published', deleted_at: null }] });
      };
      const populate = async (type, actionMode) => {
        const title = 'مسودة كاملة ' + type + ' ' + actionMode, slug = 'recovered-' + type.replaceAll('_', '-') + '-' + actionMode;
        if (draftFirstCaseOnly) console.log('DRAFT_STAGE populate basic');
        await tab('basic').click(); await form.locator('input[name="title"]').fill(title); await form.locator('input[name="slug"]').fill(slug); await form.locator('textarea[name="excerpt"]').fill('مقتطف المسودة الكاملة ' + type);
        const category = form.locator('#content-category-listbox'); await category.press('Home'); await category.press('Enter'); await expect(form.locator('select[name="category_id"]')).toHaveValue('17');
        const series = form.locator('#content-series-listbox'); await series.press('End'); await series.press('Enter'); await expect(form.locator('select[name="series_id"]')).toHaveValue('187');
        if (draftFirstCaseOnly) console.log('DRAFT_STAGE populate image');
        await selectImage(form.locator('[data-admin-media-image-field="image"]'), 'SEO fixture original'); await form.locator('[name="image_alt"]').fill('وصف الصورة الرئيسية في المسودة');
        if (!['video', 'gallery'].includes(type)) { await editor().fill('نص Markdown محفوظ في المسودة الكاملة ' + type); await expect(content()).toHaveValue(/Markdown/); }
        if (['news', 'site_update'].includes(type)) await form.locator('[name="media_project"]').fill('D174');
        if (type === 'video') {
          await tab('video').click(); await form.getByRole('option', { name: 'Vimeo', exact: true }).click(); await form.locator('input[name="video_url"]').fill('https://vimeo.com/76979871'); await form.locator('input[name="video_start_seconds"]').fill('19');
          await selectImage(form.locator('[data-admin-media-image-field="video_thumbnail"]'), 'SEO fixture replacement');
        }
        if (type === 'gallery') {
          await tab('gallery').click(); const cards = form.locator('[data-admin-media-gallery-card="image"]');
          if (actionMode === 'create') { await selectGalleryImage('SEO fixture original'); await selectGalleryImage('SEO fixture replacement'); }
          await expect(cards).toHaveCount(2);
          await cards.nth(0).locator('[name="gallery_image_alt"]').fill('Alt الأول'); await cards.nth(0).locator('[name="gallery_image_caption"]').fill('Caption الأول');
          await cards.nth(1).locator('[name="gallery_image_alt"]').fill('Alt الثاني'); await cards.nth(1).locator('[name="gallery_image_caption"]').fill('Caption الثاني');
          await cards.nth(0).locator('[data-admin-media-gallery-action="move-down"]').click(); await expect(cards.nth(0).locator('[name="gallery_image_url"]')).toHaveValue('/fixture-replacement.svg');
        }
        if (draftFirstCaseOnly) console.log('DRAFT_STAGE populate display');
        await tab('display').click(); for (const name of fields) await setSwitch(name, !['show_image_on_page', 'show_series_on_page'].includes(name));
        if (type === 'article') { await tab('faq').click(); await form.getByRole('button', { name: 'إضافة سؤال جديد', exact: true }).click(); await form.locator('input[name="faq_question"]').fill('هل تستعاد الأسئلة؟'); await form.locator('textarea[name="faq_answer"]').fill('نعم، مع ترتيبها وبياناتها.'); await setSwitch('show_faq_on_page', false); await setSwitch('show_faq_title_on_page', false); }
        if (draftFirstCaseOnly) console.log('DRAFT_STAGE populate seo');
        await tab('seo').click(); await form.locator('input[name="seo_title"]').fill('عنوان SEO للمسودة ' + type); await form.locator('textarea[name="seo_description"]').fill('وصف البحث للمسودة الكاملة مع بيانات المشاركة والحقول الاختيارية.'); await form.locator('input[name="focus_keyword"]').fill('مسودة');
        const keywords = form.locator('#content-seo-keywords input[type="text"]'); await keywords.fill('استعادة'); await keywords.press('Enter'); await form.locator('input[name="canonical_url"]').fill('https://example.test/recovered-canonical-' + type);
        for (const [id, option] of [['content-robots-index', 'Noindex'], ['content-robots-follow', 'Nofollow']]) { await form.locator('#' + id).press('ArrowDown'); await page.getByRole('option', { name: option, exact: true }).click(); }
        await selectImage(form.locator('[data-admin-media-image-field="og_image"]'), 'SEO fixture replacement'); await form.locator('input[name="og_image_alt"]').fill('وصف صورة مشاركة المسودة');
        if (draftFirstCaseOnly) console.log('DRAFT_STAGE populate publishing');
        await tab('publish').click(); await setSwitch('content_publication_toggle', true); await setSwitch('is_featured', true); await setSwitch('is_popular', true); await form.locator('input[name="published_at"]').fill('2026-10-20');
        await tab('basic').click(); await expect(form.locator('input[name="slug"]')).toHaveValue(slug); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
        return { title, slug };
      };
      const writeProgress = async () => { await writeFile(path.join(draftEvidenceRoot, draftBoundariesOnly ? 'draft-boundaries-progress.json' : 'draft-matrix-progress.json'), JSON.stringify({ status: 'IN_PROGRESS', browser: draftBrowserProduct + ' ' + browser.version(), recordedAt: new Date().toISOString(), browserCases: draftCases, boundaryCases, noticeCases, sourceSaveResults: slugSaveResults, screenshots, sourceHashesAtStart: draftSourceHashesAtStart, globalClosed: false }, null, 2)); };
      for (const width of draftBoundariesOnly ? [] : draftFirstCaseOnly ? [1440] : [1440, 390]) for (const type of draftFirstCaseOnly ? ['article'] : ['article', 'news', 'press', 'site_update', 'video', 'gallery']) for (const actionMode of draftFirstCaseOnly ? ['edit'] : ['create', 'edit']) {
        console.log('Full Draft fixture case ' + type + ' ' + actionMode + ' RTL ' + width);
        const mode = type === 'article' ? actionMode : `${type}-${actionMode}`; await page.setViewportSize({ width, height: 1100 }); await fresh(mode);
        const sourceSavesBeforeAuthoring = slugSaveResults.length, sourceAttemptsBeforeAuthoring = await page.evaluate(() => window.topicSaveAttempts ?? 0), baseline = await native(), values = await populate(type, actionMode), before = await native();
        await expect.poll(async () => (await records()).some(({ record }) => record.fields.title?.[0] === values.title)).toBe(true);
        const saved = (await records()).find(({ record }) => record.fields.title?.[0] === values.title); assert.equal(saved.record.version, 2); assert.equal(saved.record.fieldVersion, 1); assert.equal(saved.record.scope.actorId, 1); assert.equal(saved.record.scope.contentType, type); assert.equal(saved.record.scope.entity, actionMode === 'edit' ? '991' : 'create');
        // Closing without an application save persists synchronously; reload then
        // renders the saved source baseline until the user explicitly restores.
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await reload(); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'pending'); assert.deepEqual(await native(), baseline, 'Pending draft never silently replaces saved/default fields'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false');
        await form.evaluate(form => form.requestSubmit()); await settle(); assert.equal(await page.evaluate(() => window.topicSaveAttempts ?? 0), sourceAttemptsBeforeAuthoring, 'Unresolved recovery choices do not invoke the action'); assert.equal(slugSaveResults.length, sourceSavesBeforeAuthoring, 'Unresolved recovery choices block saving until an explicit decision');
        const pendingShot = path.join(draftEvidenceRoot, `${type}-${actionMode}-${width}-pending.png`); await notice().screenshot({ path: pendingShot }); screenshots.push({ type, mode: actionMode, width, state: 'Explicit Restore/Discard choice', path: pendingShot });
        await restore(); assert.deepEqual(await native(), before, 'Restore rehydrates every applicable native field and repeated metadata tuple'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
        await form.locator('input[name="title"]').fill(values.title + ' تعديل'); await expect(form.locator('input[name="slug"]')).toHaveValue(values.slug); await form.locator('input[name="title"]').fill(values.title); assert.deepEqual(await native(), before, 'Restored manual Slug remains protected from title-only edits');
        await form.locator('[data-admin-form-action="close"]').click(); await cancelLeave(); await page.locator('[data-slug-navigation]').click(); await cancelLeave(); assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true);
        await tab('seo').click(); await expect(page.locator('[data-admin-entity-seo-search-preview] p').first()).toHaveText('https://example.test/recovered-canonical-' + type); await expect(page.locator('[data-admin-entity-seo-search-preview] p').nth(1)).toHaveText('عنوان SEO للمسودة ' + type + ' | الموقع'); await tab('publish').click(); await expect(form.locator('input[name="content_publication_toggle"]')).toBeChecked();
        const restoredShot = path.join(draftEvidenceRoot, `${type}-${actionMode}-${width}-restored.png`); await notice().screenshot({ path: restoredShot }); screenshots.push({ type, mode: actionMode, width, state: 'Restored full form is dirty', path: restoredShot });
        // Publish-field recovery is proved above. Retain the repository's draft
        // save policy: explicitly return to Unpublished before the isolated save.
        await setSwitch('content_publication_toggle', false); await form.locator('input[name="published_at"]').fill('2026-10-24'); await tab('basic').click(); const saveValues = await native();
        assert.equal(slugSaveResults.length, sourceSavesBeforeAuthoring, 'Authoring/Restore/Close/navigation never automatically save to the database'); await page.evaluate(() => { window.topicSourceSaveOutcome = 'database-error'; }); const beforeFailure = slugSaveResults.length; await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(beforeFailure + 1); assert.equal(slugSaveResults.at(-1).result.status, 'error'); await expect(form.locator('input[name="title"]')).toBeEnabled(); assert.deepEqual(await native(), saveValues); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); assert.ok((await records()).length > 0, 'Failure preserves the full-form draft');
        await reload(); const recoveredAfterFailure = await restore(); assert.deepEqual(await native(), saveValues, 'Failed-save draft survives another reload'); const beforeSuccessStorage = await allStorage(), beforeSuccessRecords = await records();
        await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; }); const beforeSuccess = slugSaveResults.length; await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(beforeSuccess + 1); const accepted = slugSaveResults.at(-1); assert.equal(accepted.result.status, 'success', JSON.stringify(accepted.result)); assert.equal(accepted.row.slug, values.slug); assert.equal(accepted.row.canonical_url, 'https://example.test/recovered-canonical-' + type);
        await expect.poll(async () => Object.hasOwn(await allStorage(), recoveredAfterFailure)).toBe(false);
        const afterSuccessStorage = await allStorage(); for (const { key } of beforeSuccessRecords) if (key !== recoveredAfterFailure && Object.hasOwn(afterSuccessStorage, key)) assert.equal(afterSuccessStorage[key], beforeSuccessStorage[key], 'A successful save preserves every unselected draft byte');
        const editMode = mode.replace(/create$/, 'edit'); slugMode = editMode; await open(editMode); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); assert.deepEqual(await native(), saveValues, 'Actual source save and PGlite row rehydrate the Edit consumer');
        // Older unselected snapshots remain explicit user choices. Discard them
        // through the owner UI before creating an independent discard-only case.
        while (await page.locator('[data-topic-form-draft-key]').count()) await page.locator('[data-topic-form-draft-key]').first().locator('[data-topic-form-draft-discard]').click();
        const retainedForeignStorage = await allStorage(); await tab('basic').click(); await form.locator('input[name="title"]').fill('مسودة للتجاهل ' + type); await expect.poll(async () => Object.keys(await allStorage()).length).toBeGreaterThan(Object.keys(retainedForeignStorage).length); await reload(); await discard(); await expect(form.locator('input[name="title"]')).toHaveValue(values.title); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await expect.poll(allStorage).toEqual(retainedForeignStorage);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); assert.equal(await form.evaluate(node => getComputedStyle(node).direction), 'rtl');
        draftCases.push({ type, mode: actionMode, width, actualConsumer: await form.locator('[name="content_type"]').inputValue(), baselineFieldCount: baseline.length, recoveredFieldCount: before.length, recoveredNames: [...new Set(before.map(([name]) => name))], explicitChoiceBeforeHydration: true, fullNativeParity: true, manualSlugAndCanonicalPreserved: true, dirtyCloseNavigationBeforeUnload: true, seoObserved: true, publicationFieldsRecovered: true, pagehideAndTwoReloads: true, failedActualSavePreservesDraft: true, successfulActualSaveClearsRecoveredDraftAndReadback: true, discardKeepsSavedBaselineClean: true, galleryOrderMetadata: type === 'gallery', videoProviderUrlStartThumbnail: type === 'video' });
        await writeProgress();
        console.log('PASS Full Draft ' + type + ' ' + actionMode + ' RTL ' + width);
      }
      if (!draftBoundariesOnly && !draftFirstCaseOnly) { const sourceHashesAtEnd = await readDraftSourceHashes(); assert.deepEqual(sourceHashesAtEnd, draftSourceHashesAtStart); await writeFile(path.join(draftEvidenceRoot, 'full-form-draft-matrix.json'), JSON.stringify({ status: 'PASS', browser: draftBrowserProduct + ' ' + browser.version(), browserDate: slugBrowserDate, browserCases: draftCases, sourceSaveResults: slugSaveResults, screenshots, sourceHashesAtStart: draftSourceHashesAtStart, sourceHashesAtEnd, sourceIdentityStable: true, capturedBeforeBoundaryTests: true, globalClosed: false }, null, 2)); }
      // These focused integration boundaries use the same mounted recovery
      // owner as the six-type matrix; no replacement recovery hook is used.
      if (!draftFirstCaseOnly) {
      await page.setViewportSize({ width: 1440, height: 1100 }); await fresh('edit');
      await form.locator('input[name="title"]').fill('Private actor one local draft'); await expect.poll(async () => (await records()).length).toBe(1); const scoped = (await records())[0]; let scopedRawAfterOwnerExit;
      for (const [name, targetMode, options] of [
        ['actor', 'edit', { actor: '2' }], ['session-version', 'edit', { session: '2' }], ['record', 'edit', { record: '992' }], ['content-type', 'news-edit', {}], ['session-expiry-identity', 'edit', { expires: String(Date.parse('2026-10-24T12:00:00.000Z') + 7200000) }],
      ]) {
        await open(targetMode, options); await expect(page.locator('[data-topic-form-draft-restore]')).toHaveCount(0); assert.equal((await page.locator('body').innerText()).includes('Private actor one local draft'), false); const currentRaw = (await allStorage())[scoped.key]; if (!scopedRawAfterOwnerExit) { scopedRawAfterOwnerExit = currentRaw; assert.deepEqual(JSON.parse(currentRaw).fields, scoped.record.fields, 'The previous owner flush preserves its editable values'); } else assert.equal(currentRaw, scopedRawAfterOwnerExit, 'Foreign scope remains opaque and unmodified');
        boundaryCases.push({ name: 'scope-' + name, status: 'PASS', foreignPayloadVisible: false, foreignBytesPreserved: true }); await writeProgress();
      }
      await open('edit'); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'pending'); await restore(); await expect(form.locator('input[name="title"]')).toHaveValue('Private actor one local draft');
      await fresh('edit'); await form.locator('input[name="title"]').fill('Actor one mounted state'); await expect.poll(async () => (await records()).length).toBe(1);
      await page.evaluate(() => window.rerenderDraftFixtureSession({ ...window.topicDraftFixture.session, actorId: 2 })); await expect(form.locator('input[name="title"]')).toHaveValue('موضوع الاختبار'); await expect(page.locator('[data-topic-form-draft-restore]')).toHaveCount(0); const actorOneBytes = await allStorage(); await form.locator('input[name="title"]').fill('Actor two mounted state'); await expect.poll(async () => (await records()).some(({ record }) => record.scope.actorId === 2)).toBe(true);
      await page.evaluate(() => window.rerenderDraftFixtureSession({ ...window.topicDraftFixture.session, actorId: 1 })); await expect(form.locator('input[name="title"]')).toHaveValue('موضوع الاختبار'); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'pending'); for (const [key, raw] of Object.entries(actorOneBytes)) assert.equal((await allStorage())[key], raw); await restore(); await expect(form.locator('input[name="title"]')).toHaveValue('Actor one mounted state');
      boundaryCases.push({ name: 'mounted-actor-session-prop-change-remounts-owner-state', status: 'PASS', previousActorStateDoesNotLeak: true, scopedVersionsPreserved: true }); await writeProgress();
      // Record the existing shared notice layout without changing its defaults.
      // Visual findings are separate from recovery's behavioral PASS cases.
      const noticeVisualFindings = [];
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1100 }); await settle();
        const restoredNotice = page.locator('[data-topic-form-draft="restored"] [data-admin-notice-layout="stacked"]'); await expect(restoredNotice).toBeVisible();
        const geometry = await restoredNotice.evaluate(node => {
          const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
          const button = node.querySelector('button'), paragraph = node.querySelector('p'), range = document.createRange(); range.selectNodeContents(paragraph);
          const buttonBox = box(button), textRects = [...range.getClientRects()].map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom })), style = getComputedStyle(node);
          return { direction: style.direction, className: node.className, paddingInlineStart: style.paddingInlineStart, paddingInlineEnd: style.paddingInlineEnd, box: box(node), button: buttonBox, textRects, closeOverlapsMessage: textRects.some(r => r.x < buttonBox.right && r.right > buttonBox.x && r.y < buttonBox.bottom && r.bottom > buttonBox.y) };
        });
        const image = path.join(draftEvidenceRoot, `restored-notice-geometry-${width}-rtl.png`); await restoredNotice.screenshot({ path: image }); screenshots.push({ width, direction: 'rtl', state: 'Existing canonical restored notice visual diagnostic', path: image });
        assert.equal(geometry.closeOverlapsMessage, false, 'Canonical restored notice reserves the physical close-button side in RTL');
        noticeVisualFindings.push({ width, fixtureCssIncludesPs14: css.includes('.ps-14'), geometry });
      }
      const noticeSources = {}; for (const file of ['src/components/admin/AdminNotice.tsx', 'src/components/admin/AdminNoticeDismissibleFrame.tsx']) noticeSources[file] = createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex');
      await writeFile(path.join(draftEvidenceRoot, 'restored-notice-visual-diagnostic.json'), JSON.stringify({ status: 'OBSERVED', observations: noticeVisualFindings, sourceHashes: noticeSources, productEdited: false, boundary: 'Actual computed styles and text-range geometry; preexisting shared AdminNotice default, Owner visual assessment remains required.' }, null, 2));
      await page.setViewportSize({ width: 1440, height: 1100 });
      await fresh('edit'); await form.locator('input[name="title"]').fill('Original pending local draft'); await expect.poll(async () => (await records()).length).toBe(1); const pendingOriginal = (await records())[0]; await reload(); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'pending'); const pendingOriginalRaw = (await allStorage())[pendingOriginal.key];
      await form.locator('input[name="title"]').fill('New current edits while older choice pending'); await expect.poll(async () => (await records()).some(({ record }) => record.fields.title?.[0] === 'New current edits while older choice pending')).toBe(true); assert.equal((await allStorage())[pendingOriginal.key], pendingOriginalRaw); await reload(); await expect(page.locator('[data-topic-form-draft-key]')).toHaveCount(2); await expect(form.locator('input[name="title"]')).toHaveValue('موضوع الاختبار'); await restore(); await expect(form.locator('input[name="title"]')).toHaveValue('New current edits while older choice pending');
      boundaryCases.push({ name: 'new-pending-choice-edits-survive-abrupt-reload', status: 'PASS', originalDraftBytesPreserved: true, newWriterVersionRecoverable: true }); await writeProgress();
      // Unknown-provenance body drafts and future schemas must remain opaque.
      await fresh('edit');
      await page.evaluate(() => {
        const { api, session } = window.topicDraftFixture, scope = { ...session, contentType: 'article', entity: '991' };
        localStorage.setItem('venesia-topic-editor-draft:topic:article:991', 'LEGACY_PRIVATE_BODY_DO_NOT_EXPOSE');
        localStorage.setItem(api.getTopicFormDraftKey(scope, 'future-writer'), JSON.stringify({ version: 77, fieldVersion: 9, scope, fields: { title: ['FUTURE_PRIVATE_TITLE_DO_NOT_EXPOSE'] } }));
      });
      await reload(); await expect(page.locator('[data-topic-form-draft-opaque]')).toHaveCount(2); await expect(page.locator('[data-topic-form-draft-restore]')).toHaveCount(0); assert.equal((await page.locator('body').innerText()).includes('LEGACY_PRIVATE_BODY_DO_NOT_EXPOSE'), false); assert.equal((await page.locator('body').innerText()).includes('FUTURE_PRIVATE_TITLE_DO_NOT_EXPOSE'), false); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false');
      await page.locator('[data-topic-form-draft-opaque]').first().locator('[data-topic-form-draft-discard]').click(); await expect(page.locator('[data-topic-form-draft-opaque]')).toHaveCount(1); await page.locator('[data-topic-form-draft-opaque]').first().locator('[data-topic-form-draft-discard]').click(); await expect(page.locator('[data-topic-form-draft-opaque]')).toHaveCount(0);
      boundaryCases.push({ name: 'legacy-and-future-version-opaque', status: 'PASS', noPayloadExposure: true, noAutomaticRestore: true, explicitDiscardOnly: true }); await writeProgress();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1100 }); await fresh('edit'); const opaqueKey = 'venesia-topic-editor-draft:topic:article:991'; await page.evaluate(key => localStorage.setItem(key, 'OLDER_OPAQUE_PRIVATE_BODY'), opaqueKey); await reload(); const opaque = page.locator('[data-topic-form-draft-opaque]'); await expect(opaque).toHaveCount(1); const beforeImage = path.join(draftEvidenceRoot, `opaque-choice-${width}-rtl.png`); await opaque.screenshot({ path: beforeImage }); screenshots.push({ width, direction: 'rtl', state: 'Opaque legacy choice with no payload exposure', path: beforeImage });
        await page.evaluate(key => localStorage.setItem(key, 'NEWER_UNSEEN_OPAQUE_BODY'), opaqueKey); await opaque.locator('[data-topic-form-draft-discard]').click(); await expect(page.locator('[data-topic-form-draft="unavailable"]')).toHaveCount(1); assert.equal((await allStorage())[opaqueKey], 'NEWER_UNSEEN_OPAQUE_BODY', 'Opaque discard fences the exact displayed raw snapshot'); await expect(form.locator('input[name="title"]')).toHaveValue('موضوع الاختبار'); assert.equal((await page.locator('body').innerText()).includes('NEWER_UNSEEN_OPAQUE_BODY'), false); const afterImage = path.join(draftEvidenceRoot, `opaque-replacement-protected-${width}-rtl.png`); await page.locator('[data-topic-form-draft="unavailable"]').screenshot({ path: afterImage }); screenshots.push({ width, direction: 'rtl', state: 'Unseen newer opaque version is preserved', path: afterImage });
        boundaryCases.push({ name: 'opaque-discard-unseen-newer-version-' + width, status: 'PASS', newerRawBytesPreserved: true, payloadNeverExposed: true }); await writeProgress();
      }
      await page.setViewportSize({ width: 1440, height: 1100 });
      // Native unregistered sensitive controls are excluded by the real owner.
      await fresh('edit');
      await form.evaluate(form => { for (const [name, value, type] of [['password', 'NEVER_STORE_PASSWORD', 'password'], ['access_token', 'NEVER_STORE_AUTH_TOKEN', 'hidden']]) { const input = document.createElement('input'); input.name = name; input.value = value; input.type = type; input.dataset.fixtureSensitive = ''; form.append(input); } });
      await form.locator('input[name="title"]').fill('Safe draft title'); await tab('seo').click(); await form.locator('input[name="canonical_url"]').fill('https://example.test/private?token=NEVER_STORE_URL_TOKEN');
      await expect(page.locator('[data-topic-form-draft-excluded]')).toHaveAttribute('data-topic-form-draft-excluded', /canonical_url/); await expect.poll(async () => JSON.stringify(await allStorage()).includes('NEVER_STORE')).toBe(false); const safeRecord = (await records())[0]; assert.equal(Object.hasOwn(safeRecord.record.fields, 'password'), false); assert.equal(Object.hasOwn(safeRecord.record.fields, 'access_token'), false); assert.equal(Object.hasOwn(safeRecord.record.fields, 'canonical_url'), false); await expect(form.locator('input[name="canonical_url"]')).toHaveValue('https://example.test/private?token=NEVER_STORE_URL_TOKEN');
      boundaryCases.push({ name: 'sensitive-native-and-url-values-excluded', status: 'PASS', warningWithoutSecrets: true, liveInputUnchanged: true }); await writeProgress();
      await fresh('edit'); await form.locator('input[name="title"]').fill('Restore selected local title with current reference'); await expect.poll(async () => (await records()).length).toBe(1); await reload(); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'pending'); await tab('seo').click(); const transientUrl = 'https://example.test/current?token=TRANSIENT_REFERENCE_NEVER_STORE'; await form.locator('input[name="canonical_url"]').fill(transientUrl); await expect(page.locator('[data-topic-form-draft-excluded]')).toHaveAttribute('data-topic-form-draft-excluded', /canonical_url/); await restore(); await expect(form.locator('input[name="canonical_url"]')).toHaveValue(transientUrl); await expect(form.locator('input[name="title"]')).toHaveValue('Restore selected local title with current reference'); assert.equal(JSON.stringify(await allStorage()).includes('TRANSIENT_REFERENCE_NEVER_STORE'), false);
      boundaryCases.push({ name: 'restore-retains-current-excluded-reference-only-in-memory', status: 'PASS', currentUrlNotSilentlyReverted: true, secretReferenceNotStored: true }); await writeProgress();
      await fresh('edit'); await form.locator('input[name="title"]').fill('File guarded local draft'); await expect.poll(async () => (await records()).length).toBe(1); await reload(); await form.evaluate(form => { const input = document.createElement('input'); input.type = 'file'; input.name = 'image'; input.dataset.draftFixtureFile = ''; form.append(input); }); await form.locator('[data-draft-fixture-file]').setInputFiles({ name: 'finite-local.txt', mimeType: 'text/plain', buffer: Buffer.from('UNSTORED_LOCAL_FILE_CONTENT') }); await page.locator('[data-topic-form-draft-restore]').first().click(); await expect(page.locator('[data-topic-form-draft-restore-blocked]')).toHaveCount(1); await expect(form.locator('input[name="title"]')).toHaveValue('موضوع الاختبار'); assert.equal(await form.locator('[data-draft-fixture-file]').evaluate(input => input.files.length), 1); assert.equal(JSON.stringify(await allStorage()).includes('UNSTORED_LOCAL_FILE_CONTENT'), false);
      boundaryCases.push({ name: 'selected-file-blocks-remount-without-copying-or-loss', status: 'PASS', selectedFileRetainedInCurrentControl: true, fileBytesNotStored: true }); await writeProgress();
      // A later saved row only replaces its own changed fields. Conflicting
      // same-field local edits stay available for an explicit owner choice.
      await fresh('edit'); await form.locator('textarea[name="excerpt"]').fill('Local excerpt survives newer server title'); await expect.poll(async () => (await records()).length).toBe(1); const nonOverlap = (await records())[0];
      await open('edit', { 'server-revision': '2026-10-24T13:00:00Z', 'server-title': 'Newer saved server title' }); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'conflict'); await expect(page.locator('[data-topic-form-draft-field-conflict]')).toHaveCount(0); await restore(); await expect(form.locator('input[name="title"]')).toHaveValue('Newer saved server title'); await expect(form.locator('textarea[name="excerpt"]')).toHaveValue('Local excerpt survives newer server title'); assert.ok((await allStorage())[nonOverlap.key], 'Original candidate survives until successful save');
      boundaryCases.push({ name: 'new-server-revision-non-overlap-merge', status: 'PASS', newerSavedFieldPreserved: true, independentDraftFieldRecovered: true }); await writeProgress();
      await fresh('edit'); await form.locator('input[name="title"]').fill('Conflicting local title'); await expect.poll(async () => (await records()).length).toBe(1); const conflictRecord = (await records())[0];
      await open('edit', { 'server-revision': '2026-10-24T13:00:00Z', 'server-title': 'Newer saved conflicting title' }); await expect(notice()).toHaveAttribute('data-topic-form-draft', 'conflict'); const titleConflict = page.locator('[data-topic-form-draft-field-conflict="title"]'); await expect(titleConflict).toHaveCount(1); await expect(titleConflict.getByRole('combobox')).toHaveText('الاحتفاظ بالبيانات الحالية');
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1100 }); await notice().scrollIntoViewIfNeeded(); const geometry = await titleConflict.getByRole('combobox').evaluate(element => { const r = element.getBoundingClientRect(); return { direction: getComputedStyle(element).direction, x: r.x, right: r.right, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; }); assert.equal(geometry.direction, 'rtl'); assert.equal(geometry.overflow, false); assert.ok(geometry.x >= -1 && geometry.right <= width + 1);
        const closed = path.join(draftEvidenceRoot, `field-conflict-closed-${width}-rtl.png`); await notice().screenshot({ path: closed }); screenshots.push({ width, direction: 'rtl', state: 'Three-way conflict defaults to current saved field', path: closed }); await titleConflict.getByRole('combobox').focus(); await titleConflict.getByRole('combobox').press('ArrowDown'); const listbox = page.getByRole('listbox'); await expect(listbox).toBeVisible(); const menu = await listbox.boundingBox(); assert.ok(menu.x >= -1 && menu.x + menu.width <= width + 1); const openImage = path.join(draftEvidenceRoot, `field-conflict-open-${width}-rtl.png`); await page.screenshot({ path: openImage }); screenshots.push({ width, direction: 'rtl', state: 'Canonical conflict Listbox keyboard-open options', path: openImage }); await page.keyboard.press('Escape'); await expect(titleConflict.getByRole('combobox')).toBeFocused(); boundaryCases.push({ name: 'canonical-conflict-listbox-visual-keyboard-' + width, status: 'PASS', geometry, keyboardEscapeReturnsFocus: true }); await writeProgress();
      }
      await page.setViewportSize({ width: 1440, height: 1100 }); const conflictRaw = (await allStorage())[conflictRecord.key]; await restore(); await expect(form.locator('input[name="title"]')).toHaveValue('Newer saved conflicting title'); assert.equal((await allStorage())[conflictRecord.key], conflictRaw, 'Saved-default choice retains unresolved original candidate');
      boundaryCases.push({ name: 'same-field-conflict-default-keeps-saved-and-original', status: 'PASS' }); await writeProgress();
      await open('edit', { 'server-revision': '2026-10-24T13:00:00Z', 'server-title': 'Newer saved conflicting title' }); await page.locator('[data-topic-form-draft-field-conflict="title"]').getByRole('combobox').click(); await page.getByRole('option', { name: 'استعادة تعديل المسودة لهذا الحقل', exact: true }).click(); await restore(); await expect(form.locator('input[name="title"]')).toHaveValue('Conflicting local title');
      boundaryCases.push({ name: 'same-field-conflict-explicit-draft-choice', status: 'PASS' }); await writeProgress();
      await fresh('edit'); await open('edit', { 'review-state': 'published' }); const publishedOriginal = { slug: await form.locator('input[name="slug"]').inputValue(), canonical: await form.locator('input[name="canonical_url"]').inputValue(), date: await form.locator('input[name="published_at"]').inputValue() }; await form.locator('input[name="title"]').fill('Published title local recovery'); await expect.poll(async () => (await records()).length).toBe(1); await reload(); await restore(); await expect(form.locator('input[name="slug"]')).toHaveValue(publishedOriginal.slug); await expect(form.locator('input[name="canonical_url"]')).toHaveValue(publishedOriginal.canonical); await expect(form.locator('input[name="published_at"]')).toHaveValue(publishedOriginal.date); await expect(form.locator('input[name="published_at"]')).toBeDisabled(); await expect(form.locator('input[name="status"]')).toHaveValue('published');
      boundaryCases.push({ name: 'published-identity-canonical-and-disabled-date-preserved', status: 'PASS', noAutomaticPublishedSlugRewrite: true, disabledServerOwnedDatePreserved: true, saveBoundaryReusedFromPriorSlugEvidence: true }); await writeProgress();
      await fresh('edit'); await form.locator('input[name="slug"]').fill(''); await form.locator('input[name="title"]').fill('Current title with manually empty Slug'); await expect(form.locator('input[name="slug"]')).toHaveValue(''); await expect.poll(async () => (await records()).some(({ record }) => record.fields.slug?.[0] === '')).toBe(true); await reload(); await restore(); await expect(form.locator('input[name="slug"]')).toHaveValue(''); await form.locator('input[name="title"]').fill('Title after restored empty Slug'); await expect(form.locator('input[name="slug"]')).toHaveValue(''); await form.locator('[data-topic-slug-field] button').click(); await expect(form.locator('input[name="slug"]')).toHaveValue('title-after-restored-empty-slug');
      boundaryCases.push({ name: 'explicit-empty-manual-slug-recovers-without-title-overwrite', status: 'PASS', explicitAutoStillWorks: true }); await writeProgress();
      // A background writer owns a separate key. Successful save of the
      // selected candidate cannot remove or overwrite that newer local copy.
      await fresh('edit'); await form.locator('input[name="title"]').fill('Selected writer title'); await expect.poll(async () => (await records()).length).toBe(1); const writerOne = (await records())[0];
      const writerTwo = await page.evaluate(({ record }) => { const { api } = window.topicDraftFixture, next = { ...record, writerId: 'newer-other-writer', savedAt: new Date(Date.now() + 60000).toISOString(), fields: { ...record.fields, title: ['Newer independent writer title'] } }; const key = api.getTopicFormDraftKey(next.scope, next.writerId), raw = JSON.stringify(next); localStorage.setItem(key, raw); return { key, raw }; }, writerOne); assert.ok(Date.parse(JSON.parse(writerTwo.raw).savedAt) > Date.parse(writerOne.record.savedAt));
      await reload(); await expect(page.locator('[data-topic-form-draft-key]')).toHaveCount(2); const selectedCard = page.locator('[data-topic-form-draft-key]').filter({ has: page.locator('[data-topic-form-draft-restore]') }).filter({ hasText: 'توجد مسودة' }); assert.equal(await selectedCard.count(), 2);
      await page.locator('[data-topic-form-draft-key]').filter({ has: page.locator('[data-topic-form-draft-restore]') }).evaluateAll((nodes, key) => { const node = nodes.find(node => node.dataset.topicFormDraftKey === key); if (!node) throw Error('Selected candidate missing'); node.querySelector('[data-topic-form-draft-restore]').click(); }, writerOne.key);
      await expect(form.locator('input[name="title"]')).toHaveValue('Selected writer title'); await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; }); const priorWriterSave = slugSaveResults.length; await form.evaluate(form => form.requestSubmit()); await expect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(priorWriterSave + 1); assert.equal(slugSaveResults.at(-1).result.status, 'success'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await expect(form.locator('input[name="title"]')).toBeEnabled(); await expect.poll(async () => Object.hasOwn(await allStorage(), writerOne.key)).toBe(false); assert.equal((await allStorage())[writerTwo.key], writerTwo.raw, 'Newer independent local draft is not deleted by another writer save');
      boundaryCases.push({ name: 'independent-writers-success-clears-selected-only', status: 'PASS', newerOtherWriterBytesPreserved: true }); await writeProgress();
      // If the same stored candidate changes between UI selection and Restore,
      // its captured raw bytes fence prevents stale recovery/deletion.
      await fresh('edit'); await form.locator('input[name="title"]').fill('Old visible candidate'); await expect.poll(async () => (await records()).length).toBe(1); await reload(); const stale = (await records())[0];
      const replaced = await page.evaluate(({ key, record }) => { const raw = JSON.stringify({ ...record, savedAt: new Date(Date.now() + 120000).toISOString(), fields: { ...record.fields, title: ['Newer same-key version'] } }); localStorage.setItem(key, raw); return raw; }, stale); assert.ok(Date.parse(JSON.parse(replaced).savedAt) > Date.parse(stale.record.savedAt));
      await page.locator('[data-topic-form-draft-restore]').first().click(); await expect(page.locator('[data-topic-form-draft="unavailable"]')).toHaveCount(1); await expect(form.locator('input[name="title"]')).toHaveValue('موضوع الاختبار'); assert.equal((await allStorage())[stale.key], replaced);
      boundaryCases.push({ name: 'changed-candidate-raw-fence', status: 'PASS', noStaleRestoreOrDelete: true }); await writeProgress();
      // Storage rejection is visible and leaves the user's current fields/Dirty
      // state intact. This changes only the isolated browser Storage prototype.
      await fresh('edit'); await page.evaluate(() => { window.fixtureStorageSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('Finite storage quota denied', 'QuotaExceededError'); }; }); await form.locator('input[name="title"]').fill('Current title survives storage failure'); await expect(page.locator('[data-topic-form-draft="unavailable"]')).toHaveCount(1); await expect(form.locator('input[name="title"]')).toHaveValue('Current title survives storage failure'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true'); await page.evaluate(() => { Storage.prototype.setItem = window.fixtureStorageSetItem; });
      boundaryCases.push({ name: 'storage-quota-failure-visible-retains-fields', status: 'PASS' }); await writeProgress();
      // Known expiry is enforced by the owner on focus/visibility, without
      // inventing an auth polling/revocation mechanism.
      await fresh('edit'); await form.locator('input[name="title"]').fill('Expiring local draft'); await expect.poll(async () => (await records()).length).toBe(1); const expiresAt = await page.evaluate(() => window.topicDraftFixture.session.expiresAt); await page.clock.setFixedTime(expiresAt + 1); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect.poll(async () => (await records()).length).toBe(0); await expect(page.locator('[data-topic-form-draft-restore]')).toHaveCount(0); await form.locator('input[name="title"]').fill('No new local writes after expiry'); await settle(); assert.equal((await records()).length, 0);
      boundaryCases.push({ name: 'known-session-expiry-prunes-and-stops-writes', status: 'PASS', remoteRevocationClaim: false }); await writeProgress();
      await page.clock.setFixedTime(slugBrowserDate); await fresh('edit'); await form.locator('input[name="title"]').fill('Logout cleanup draft'); await expect.poll(async () => (await records()).length).toBe(1);
      const otherWriterPage = await page.context().newPage(); await otherWriterPage.clock.install({ time: new Date(slugBrowserDate) });
      try {
        otherWriterPage.on('pageerror', error => errors.push(error.message)); await otherWriterPage.route('**/*', routeTopicFixture); await otherWriterPage.goto('http://topic-content.fixture/?mode=edit&seo-fixture=1&capture-navigation=1&full-form-draft=1'); await expect(otherWriterPage.locator('input[name="title"]')).toBeEditable(); await otherWriterPage.locator('input[name="title"]').fill('Other tab current draft before logout'); await expect.poll(async () => (await records()).length).toBeGreaterThan(1);
        const logoutCleanup = await page.evaluate(() => { localStorage.setItem('unrelated-preference', 'keep'); localStorage.setItem('venesia-topic-editor-draft:topic:article:create', 'opaque legacy'); const count = window.topicDraftFixture.api.cleanupTopicDraftStorage(localStorage); window.dispatchEvent(new Event('pagehide')); return { count, remaining: Object.keys(localStorage), preference: localStorage.getItem('unrelated-preference') }; }); assert.ok(logoutCleanup.count >= 3); assert.equal(logoutCleanup.preference, 'keep'); assert.equal(logoutCleanup.remaining.some(key => key.startsWith('venesia-topic-editor-draft:')), false);
        await otherWriterPage.locator('input[name="title"]').fill('Must not persist in other tab after logout'); await otherWriterPage.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('focus')); }); await form.locator('input[name="title"]').fill('Must not persist in this tab after logout'); await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await settle(); assert.equal((await records()).length, 0); assert.equal((await allStorage())['unrelated-preference'], 'keep');
        boundaryCases.push({ name: 'actual-namespace-logout-cleanup-and-two-mounted-writers', status: 'PASS', samePageHideCannotRecreate: true, otherTabInputAndPageHideCannotRecreate: true, metadataOnlySessionEndMarkers: true, unrelatedStoragePreserved: true, authenticationFlowClaim: false }); await writeProgress();
      } finally { await otherWriterPage.close(); }
      // Mounted canonical owner probes cover the changed default and both
      // unaffected modes without changing real form controls or Product props.
      for (const width of [320, 390, 1440]) for (const direction of ['ltr', 'rtl']) {
        await page.setViewportSize({ width, height: 1100 }); await open('edit', { 'notice-probes': '1', 'notice-direction': direction });
        const probes = page.locator('[data-topic-notice-probes]'); await expect(probes).toBeVisible();
        const geometry = await probes.evaluate(root => {
          const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
          return [...root.querySelectorAll('[data-topic-notice-probe]')].map(probe => {
            const notice = probe.firstElementChild, button = notice.querySelector('button'), buttonBox = button ? box(button) : null, style = getComputedStyle(notice), textRects = [...notice.querySelectorAll('p')].flatMap(p => { const range = document.createRange(); range.selectNodeContents(p); const clip = p.getBoundingClientRect(), clipped = getComputedStyle(p).overflowX === 'hidden'; return [...range.getClientRects()].map(r => ({ x: clipped ? Math.max(r.x, clip.x) : r.x, y: r.y, right: clipped ? Math.min(r.right, clip.right) : r.right, bottom: r.bottom })).filter(r => r.right > r.x); });
            const message = notice.querySelectorAll('p')[1];
            return { id: probe.dataset.topicNoticeProbe, direction: style.direction, layout: notice.dataset.adminNoticeLayout, dismissible: notice.dataset.adminNoticeDismissible, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, display: style.display, box: box(notice), button: buttonBox, textRects, textOverlapsButton: buttonBox ? textRects.some(r => r.x < buttonBox.right && r.right > buttonBox.x && r.y < buttonBox.bottom && r.bottom > buttonBox.y) : false, messageOverflow: getComputedStyle(message).textOverflow, messageWhiteSpace: getComputedStyle(message).whiteSpace, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
          });
        });
        assert.equal(geometry.length, 3);
        for (const row of geometry) { assert.equal(row.direction, direction); assert.equal(row.documentOverflow, false); assert.equal(row.textOverlapsButton, false, `${row.id} text remains clear of close button at ${width} ${direction}`); if (row.button) { assert.ok(row.button.x >= row.box.x && row.button.right <= row.box.right); } }
        const stacked = geometry.find(row => row.id === 'stacked-dismissible'), inline = geometry.find(row => row.id === 'inline-dismissible'), fixed = geometry.find(row => row.id === 'stacked-nondismissible');
        assert.equal(stacked.paddingLeft, '56px'); assert.equal(stacked.paddingRight, '20px'); assert.equal(stacked.dismissible, 'true'); assert.equal(stacked.layout, 'stacked');
        assert.equal(inline.display, 'flex'); assert.equal(inline.layout, 'inline'); assert.equal(inline.paddingLeft, '16px'); assert.equal(inline.paddingRight, '16px'); assert.equal(inline.messageOverflow, 'ellipsis'); assert.equal(inline.messageWhiteSpace, 'nowrap');
        assert.equal(fixed.dismissible, 'false'); assert.equal(fixed.button, null); assert.equal(fixed.paddingLeft, '20px'); assert.equal(fixed.paddingRight, '20px');
        const image = path.join(draftEvidenceRoot, `canonical-notice-${width}-${direction}.png`); await probes.screenshot({ path: image }); screenshots.push({ width, direction, state: 'Actual shared Notice stacked, inline and nondismissible defaults', path: image });
        for (const id of ['stacked-dismissible', 'inline-dismissible']) { await probes.locator('[data-topic-notice-probe="' + id + '"]').getByRole('button', { name: 'إغلاق الإشعار', exact: true }).click(); await expect(probes.locator('[data-topic-notice-probe="' + id + '"] [data-admin-notice-dismissible]')).toHaveCount(0); }
        await expect(probes.locator('[data-topic-notice-probe="stacked-nondismissible"] [data-admin-notice-dismissible="false"]')).toBeVisible();
        noticeCases.push({ width, direction, status: 'PASS', actualCanonicalOwner: 'AdminNotice', geometry, dismissBehavior: true, unaffectedInlineAndNondismissible: true }); await writeProgress();
      }
      await page.setViewportSize({ width: 1440, height: 1100 }); await open('edit');
      }
      assert.equal(draftCases.length, draftBoundariesOnly ? 0 : draftFirstCaseOnly ? 1 : 24); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      const sourceHashesAtEnd = await readDraftSourceHashes(); assert.deepEqual(sourceHashesAtEnd, draftSourceHashesAtStart, 'Draft owners changed after pre-webpack capture');
      const receipt = { status: 'PASS', browser: draftBrowserProduct + ' ' + browser.version(), browserDate: slugBrowserDate, browserCases: draftCases, boundaryCases, noticeCases, sourceSaveResults: slugSaveResults, screenshots, screenshotCount: screenshots.length, sourceHashesAtStart: draftSourceHashesAtStart, sourceHashesAtEnd, sourceIdentity: path.join(draftEvidenceRoot, draftFirstCaseOnly ? 'draft-first-case-source-identity.json' : draftBoundariesOnly ? 'draft-boundaries-source-identity.json' : 'draft-browser-source-identity.json'), transport: 'Actual six Create/Edit React consumers, current recovery owner and source Article/Media save adapters; disposable PGlite with finite Auth/cache/media ports. No hosted persistence or provider network.', serverStarted: false, hostedDatabaseWrites: 0, globalClosed: false };
      const output = path.join(draftEvidenceRoot, draftFirstCaseOnly ? 'full-form-draft-first-case.json' : draftBoundariesOnly ? 'full-form-draft-boundaries.json' : 'full-form-draft-browser.json');
      await writeFile(output, JSON.stringify(receipt, null, 2));
      console.log(JSON.stringify({ status: receipt.status, cases: draftCases.length, boundaryCases: boundaryCases.length, realAdapterSaves: slugSaveResults.length, screenshots: screenshots.length, output, globalClosed: false }));
      return;
    }
    if (slugAuditOnly) {
      let assertionCount = 0;
      const countedMatchers = value => new Proxy(value, { get(target, key) { const member = Reflect.get(target, key); if (key === 'not') return countedMatchers(member); return typeof member === 'function' ? (...args) => { assertionCount++; return Reflect.apply(member, target, args); } : member; } });
      const slugAssert = new Proxy(assert, { get(target, key) { const member = Reflect.get(target, key); return typeof member === 'function' ? (...args) => { assertionCount++; return Reflect.apply(member, target, args); } : member; } });
      const slugExpect = Object.assign((...args) => countedMatchers(expect(...args)), { poll: (...args) => countedMatchers(expect.poll(...args)) });
      const { createTopicSlugSaveHarness } = await import('./fixtures/remaining-content-owner-harness.mjs');
      const auditResults = [], evidenceRoot = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/slug-system-repair-20261023');
      const { mkdir, writeFile } = await import('node:fs/promises'); await mkdir(evidenceRoot, { recursive: true });
      const screenshots = [];
      const beforePath = path.join(fixtureRoot, '.tmp-qa/admin-development-batch-01/media-tabs-slug-audit-20261023/slug-audit.json');
      const immutableBefore = await readFile(beforePath), beforeHash = createHash('sha256').update(immutableBefore).digest('hex');
      const sourceOverrides = new Map();
      if (slugRegressionProbe === 'conflict') {
        const file = 'src/lib/admin/content/topic-write-errors.ts', source = await readFile(path.join(fixtureRoot, file), 'utf8'), boundary = 'if (!error || error.code !== "23505") return false;';
        slugAssert.equal(source.split(boundary).length, 2, 'Conflict mutation targets the current source classifier');
        sourceOverrides.set(file, source.replace(boundary, 'return false;'));
      }
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const reloadAcceptingUnload = async () => { const accept = async dialog => { slugAssert.equal(dialog.type(), 'beforeunload'); await dialog.accept(); }; page.on('dialog', accept); try { await page.reload(); } finally { page.off('dialog', accept); } };
      const nativeValues = () => page.locator('form[data-admin-form-runtime]').evaluate(form => [...new FormData(form)].filter(([name]) => !['id', 'expected_updated_at'].includes(name)));
      const cancelLeave = async () => { const dialog = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await slugExpect(dialog).toBeVisible(); await dialog.locator('[data-admin-confirm-cancel]').click(); await slugExpect(dialog).toHaveCount(0); };
      const fresh = async mode => {
        await slugHarness?.close(); slugHarness = undefined; slugMode = mode; savedSlugRows.clear();
        await open(mode); await page.evaluate(() => localStorage.clear()); await page.reload(); await slugExpect(page.locator('input[name="title"]')).toBeEditable(); await settle();
        const seed = await page.evaluate(() => window.topicFixtureSeed);
        slugHarness = await createTopicSlugSaveHarness(fixtureRoot, { sourceOverrides, rows: mode.endsWith('edit') ? [{ ...seed, content_type: await page.locator('[name="content_type"]').inputValue() }] : [], categories: [{ id: 17, name: 'تصنيف تجريبي', slug: 'fixture', parent_id: null, is_active: true, status: 'published', deleted_at: null }], series: [{ id: 187, name: 'سلسلة تجريبية', slug: 'fixture-series', category_id: 17, status: 'published', deleted_at: null }] });
      };
      for (const width of slugMountedSaveOnly ? [1440] : [1440, 390]) for (const type of slugMountedSaveOnly ? ['article'] : ['article', 'news', 'press', 'site_update', 'video', 'gallery']) for (const actionMode of slugMountedSaveOnly ? ['edit'] : ['create', 'edit']) {
        const firstAssertion = assertionCount;
        const mode = type === 'article' ? actionMode : type === 'news' ? `media-${actionMode}` : `${type}-${actionMode}`;
        const editing = actionMode === 'edit';
        console.log('Slug fixture case ' + type + ' ' + actionMode + ' RTL ' + width);
        await page.setViewportSize({ width, height: 1100 }); await fresh(mode);
        const form = page.locator('form[data-admin-form-runtime]'), title = form.locator('input[name="title"]'), slug = form.locator('input[name="slug"]');
        const auto = form.locator('[data-topic-slug-field] button');
        const result = { type, mode: actionMode, width, actualConsumer: await form.locator('[name="content_type"]').inputValue() };
        slugAssert.equal(result.actualConsumer, type);
        await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false');
        if (editing) {
          await slugExpect(slug).toHaveValue('fixture-topic'); await title.fill('Changed Existing Title'); await slugExpect(slug).toHaveValue('fixture-topic');
          result.persistedSlugProtected = true;
        } else {
          await auto.click(); await slugExpect(slug).toHaveValue(''); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false');
          result.emptyNoopAutoKeepsClean = true;
        }
        await title.fill('Hello World & Venesia'); await auto.click(); await slugExpect(slug).toHaveValue('hello-world-and-venesia');
        await title.fill('مدينة المستقبل'); await slugExpect(slug).toHaveValue('mdynh-almstqbl');
        result.englishTitle = 'hello-world-and-venesia'; result.arabicTitle = 'mdynh-almstqbl';
        await slug.fill('chosen-manual-link'); await title.fill('Title Changed After Manual Slug'); await slugExpect(slug).toHaveValue('chosen-manual-link');
        result.manualPreservedAfterTitleChange = true;
        await slug.fill(''); await slug.pressSequentially('custom-slug');
        await slugExpect(slug).toHaveValue('custom-slug'); await slug.press('End'); await slug.pressSequentially('-'); await slugExpect(slug).toHaveValue('custom-slug-');
        await slug.pressSequentially('tail'); await slugExpect(slug).toHaveValue('custom-slug-tail');
        for (let i = 0; i < 5; i++) await slug.press('Backspace'); await slugExpect(slug).toHaveValue('custom-slug');
        await slug.press('Home'); await slug.press('Delete'); await slugExpect(slug).toHaveValue('ustom-slug'); await slug.pressSequentially('c'); await slugExpect(slug).toHaveValue('custom-slug');
        await slug.press('ControlOrMeta+A'); await page.keyboard.insertText('  MiXeD & Link -- Test  '); await slugExpect(slug).toHaveValue('  MiXeD & Link -- Test  '); await title.focus(); await slugExpect(slug).toHaveValue('mixed-and-link-test');
        await slug.fill(''); await title.fill('Title Changed After Manual Delete'); await slugExpect(slug).toHaveValue('');
        await auto.focus(); await page.keyboard.press('Enter'); await slugExpect(slug).toHaveValue('title-changed-after-manual-delete');
        await title.fill('Automatic Follow After Reset'); await slugExpect(slug).toHaveValue('automatic-follow-after-reset');
        await slug.fill('manual-focused-slug-'); await auto.click(); await slugExpect(slug).toHaveValue('automatic-follow-after-reset');
        result.naturalTypingPasteMiddleEditDeleteAndBlurNormalization = true; result.explicitMouseAndKeyboardAutoResetAndTitleFollow = true;
        const geometry = await slug.evaluate(input => { const field = input.closest('[data-topic-slug-field]'), button = field.querySelector('button'), r = field.getBoundingClientRect(), b = button.getBoundingClientRect(); return { direction: getComputedStyle(field).direction, inputDirection: getComputedStyle(input).direction, overflow: document.documentElement.scrollWidth > innerWidth + 1, buttonInside: b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom, controlsInViewport: r.left >= 0 && r.right <= innerWidth }; });
        slugAssert.equal(geometry.direction, 'rtl'); slugAssert.equal(geometry.inputDirection, 'ltr'); slugAssert.equal(geometry.overflow, false); slugAssert.equal(geometry.buttonInside, true); slugAssert.equal(geometry.controlsInViewport, true); result.geometry = geometry;
        if (!slugRegressionProbe && !slugMountedSaveOnly) {
          await page.locator('[data-admin-tab-id="seo"]').click();
          const preview = page.locator('[data-admin-entity-seo-search-preview]'); await slugExpect(preview.locator('p').first()).toHaveText(/\/automatic-follow-after-reset$/);
          const screenshot = path.join(evidenceRoot, `${type}-${actionMode}-${width}-seo.png`); await preview.screenshot({ path: screenshot }); screenshots.push({ type, mode: actionMode, width, direction: 'rtl', state: 'Immediate SEO after explicit Auto', path: screenshot });
          await page.locator('[data-admin-tab-id="basic"]').click();
        }
        if (!['video', 'gallery'].includes(type)) {
          await slug.fill('unsaved-manual-draft-slug'); await editor().fill('Slug audit recovered body'); await slugExpect(content()).toHaveValue(/Slug audit recovered body/); const canonicalDraftBody = await content().inputValue();
          const key = `venesia-topic-editor-draft:topic:${type}:${editing ? '991' : 'create'}`;
          await slugExpect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).not.toBeNull();
          const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
          slugAssert.equal(stored.content, canonicalDraftBody); slugAssert.equal(Object.hasOwn(stored, 'slug'), false);
          await reloadAcceptingUnload(); await slugExpect(content()).toHaveValue(canonicalDraftBody); await slugExpect(slug).toHaveValue(editing ? 'fixture-topic' : '');
          result.localDraft = { recoveredContent: true, persistedSlugProtected: editing, unsavedSlugRecovered: false, storedKeys: Object.keys(stored).sort(), capabilityBoundary: 'Existing content-only local draft; no title/slug record' };
        } else result.localDraft = { markdownDraftConsumer: false, capabilityBoundary: 'No Markdown body adapter or full-form title/slug local draft in this consumer' };
        await title.fill('Valid System Save Title'); await slug.fill('saved-manual-slug');
        if (!editing) { const category = form.locator('#content-category-listbox'); await category.press('Home'); await category.press('Enter'); await slugExpect(form.locator('select[name="category_id"]')).toHaveValue('17'); }
        if (type === 'video' && !editing) { await page.locator('[data-admin-tab-id="video"]').click(); await form.locator('[name="video_url"]').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); }
        await page.locator('[data-admin-tab-id="basic"]').click(); await slug.fill('☃'); await title.focus(); await slugExpect(slug).toHaveValue('☃'); const invalidValues = await nativeValues(), beforeInvalidSave = slugSaveResults.length;
        await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; }); await form.evaluate(form => form.requestSubmit()); await slugExpect.poll(() => slugSaveResults.length).toBe(beforeInvalidSave + 1);
        const invalid = slugSaveResults.at(-1); slugAssert.equal(invalid.result.status, 'error'); slugAssert.ok(invalid.result.fieldErrors?.slug?.length); slugAssert.equal(invalid.writeAttempts, 0, 'A nonempty invalid Slug must fail existing validation before a database write'); slugAssert.deepEqual(invalid.afterRows, invalid.beforeRows);
        await slugExpect(slug).toBeEnabled(); await slugExpect(slug).toHaveValue('☃'); await slugExpect(slug).toBeFocused(); slugAssert.deepEqual(await nativeValues(), invalidValues); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'true'); result.invalidNonemptySlugRejectedWithoutWrite = true;
        await slug.fill('saved-manual-slug'); await title.focus();
        const submittedValues = await nativeValues();
        await form.locator('[data-admin-form-action="close"]').click(); await cancelLeave(); slugAssert.deepEqual(await nativeValues(), submittedValues);
        await page.locator('[data-slug-navigation]').click(); await cancelLeave(); slugAssert.deepEqual(await nativeValues(), submittedValues);
        const unloadPromise = page.waitForEvent('dialog');
        // A dismissed beforeunload cancels the navigation, so no commit follows.
        // Chrome may report the canceled commit wait as a navigation timeout.
        const reloadAttempt = page.reload({ waitUntil: 'commit', timeout: 2000 }).catch(error => slugAssert.match(error.message, /ERR_ABORTED|Navigation.*canceled|net::ERR_FAILED|Timeout 2000ms exceeded/));
        const unload = await unloadPromise; slugAssert.equal(unload.type(), 'beforeunload'); await unload.dismiss(); await reloadAttempt; slugAssert.deepEqual(await nativeValues(), submittedValues);
        result.closeLinkAndNativeBeforeUnloadGuarded = true;
        for (const outcome of ['slug-conflict', 'database-error']) {
          await page.evaluate(outcome => { window.topicDeferSave = true; window.topicSourceSaveOutcome = outcome; delete window.topicReleaseSave; }, outcome);
          await page.locator('[data-admin-tab-id="seo"]').click(); await form.evaluate(form => form.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function');
          await slugExpect(form).toHaveAttribute('aria-busy', 'true'); await slugExpect(slug).toBeDisabled(); await slugExpect(auto).toBeDisabled(); await slugExpect(form.locator('[data-admin-form-action="save"]')).toBeDisabled(); await slugExpect(form.locator('[data-admin-form-action="close"]')).toBeDisabled();
          await page.locator('[data-slug-navigation]').click(); await slugExpect(page.locator('[data-admin-unsaved-dialog]')).toHaveCount(0);
          slugAssert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true);
          slugAssert.deepEqual(await page.evaluate(() => window.topicSubmittedEntries.filter(([name]) => !['id', 'expected_updated_at'].includes(name))), submittedValues);
          await page.evaluate(() => window.topicReleaseSave()); await slugExpect(slug).toBeEnabled(); await slugExpect(form).not.toHaveAttribute('aria-busy', 'true'); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'true'); slugAssert.deepEqual(await nativeValues(), submittedValues);
          const receipt = slugSaveResults.at(-1); slugAssert.equal(receipt.result.status, 'error'); slugAssert.ok(receipt.writeAttempts > 0, 'Actual adapter reaches the declared write port');
          if (outcome === 'slug-conflict') { slugAssert.ok(receipt.writeErrors.some(error => error.code === '23505' && error.postgresConstraint === 'topics_slug_key')); slugAssert.ok(receipt.result.fieldErrors?.slug?.length, 'Actual PostgreSQL23505 must map to the Slug field'); slugAssert.equal(receipt.result.focusTarget, 'slug'); await slugExpect(page.locator('[data-admin-tab-id="basic"]')).toHaveAttribute('aria-selected', 'true'); await slugExpect(slug).toBeFocused(); }
          else slugAssert.equal(Boolean(receipt.result.fieldErrors?.slug?.length), false, 'Unrelated database error is not reported as a Slug conflict');
          if (outcome === 'slug-conflict' && !slugRegressionProbe && !slugMountedSaveOnly) { const screenshot = path.join(evidenceRoot, `${type}-${actionMode}-${width}-slug-error.png`); await form.locator('[data-topic-slug-field]').locator('..').screenshot({ path: screenshot }); screenshots.push({ type, mode: actionMode, width, direction: 'rtl', state: 'Actual SQL23505 mapped field error and focus', path: screenshot }); }
          await slugHarness.clearInjectedRows();
        }
        result.realSql23505AndGenericFailureKeepValuesAndDirty = true;
        await page.evaluate(() => { window.topicDeferSave = false; window.topicSourceSaveOutcome = 'success'; }); const beforeSuccessfulSave = slugSaveResults.length; await form.evaluate(form => form.requestSubmit()); await slugExpect.poll(() => slugSaveResults.length, { timeout: 30000 }).toBe(beforeSuccessfulSave + 1); slugAssert.equal(slugSaveResults.at(-1).result.status, 'success', JSON.stringify(slugSaveResults.at(-1).result));
        const saved = slugSaveResults.at(-1); slugAssert.equal(saved.result.status, 'success'); slugAssert.equal(saved.row.slug, 'saved-manual-slug');
        if (editing) { await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.deepEqual(await nativeValues(), submittedValues); }
        else { await slugExpect.poll(() => page.evaluate(() => window.topicNavigations ?? [])).toContain(saved.result.editHref); await slugExpect(form).toHaveAttribute('aria-busy', 'true'); }
        const editMode = mode.replace(/create$/, 'edit'); slugMode = editMode; await open(editMode); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.deepEqual(await nativeValues(), submittedValues, 'Actual persisted row rehydrates the matching Edit consumer');
        const seoPreview = page.locator('[data-admin-entity-seo-search-preview] p').first(), seoBefore = (await seoPreview.textContent()).trim();
        await auto.click(); await slugExpect(slug).toHaveValue('valid-system-save-title'); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'true'); await slugExpect(seoPreview).toHaveText(/\/valid-system-save-title$/); slugAssert.notEqual((await seoPreview.textContent()).trim(), seoBefore);
        await form.locator('[data-admin-form-action="close"]').click(); await cancelLeave();
        await page.evaluate(() => { window.topicSourceSaveOutcome = 'database-error'; }); const beforeAutoFailure = slugSaveResults.length; await form.evaluate(form => form.requestSubmit()); await slugExpect.poll(() => slugSaveResults.length).toBe(beforeAutoFailure + 1); slugAssert.equal(slugSaveResults.at(-1).result.status, 'error'); await slugExpect(slug).toBeEnabled();
        await title.fill('Automatic Mode Survives Failed Save'); await slugExpect(slug).toHaveValue('automatic-mode-survives-failed-save'); await title.fill('Valid System Save Title'); await slugExpect(slug).toHaveValue('valid-system-save-title'); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'true'); result.failedSavePreservesAutomaticMode = true;
        await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; });
        await form.evaluate(form => form.requestSubmit()); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false');
        const persistedAutoSlug = await slug.inputValue();
        await title.fill('Title Only After Successful Auto Slug Save'); await slugExpect(slug, 'An actual successful Edit save protects its persisted Slug during a later title-only edit in the same mounted component').toHaveValue(persistedAutoSlug);
        await title.fill('Valid System Save Title'); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false');
        result.sameMountedTitleOnlyAfterSuccessfulAutoSaveProtected = true;
        // A live Next action refreshes the accepted source revision. Rehydrate
        // from the actual isolated row before another edit, instead of forging
        // the server-owned expected_updated_at control in the browser.
        await open(editMode); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false');
        let inputEvents = await slug.evaluate(input => { window.slugInputEvents = 0; input.addEventListener('input', () => window.slugInputEvents++); return window.slugInputEvents; }); slugAssert.equal(inputEvents, 0);
        await auto.focus(); await page.keyboard.press('Enter'); await settle(); await slugExpect(slug).toHaveValue('valid-system-save-title'); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.equal(await page.evaluate(() => window.slugInputEvents), 0, 'No-op Auto emits no value mutation event');
        slugAssert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), false);
        await form.locator('[data-admin-form-action="close"]').click(); await slugExpect(page.locator('[data-admin-unsaved-dialog]')).toHaveCount(0);
        result.successReadbackActualAutoDirtySeoAndNoopAutoClean = true;
        // Raw text is preserved during editing. Explicit Save asks the canonical
        // field owner to finalize its value before the Runtime captures a snapshot.
        const rawSlug = '  Final Raw & Slug  ', finalizedSlug = 'final-raw-and-slug';
        await slug.fill(rawSlug); await slugExpect(slug).toHaveValue(rawSlug); const rawValues = await nativeValues(), finalizedValues = rawValues.map(([name, value]) => [name, name === 'slug' ? finalizedSlug : value]);
        await page.evaluate(() => { window.topicSourceSaveOutcome = 'slug-conflict'; }); const beforeRawFailure = slugSaveResults.length; await form.evaluate(form => form.requestSubmit()); await slugExpect.poll(() => slugSaveResults.length).toBe(beforeRawFailure + 1);
        slugAssert.equal(await page.evaluate(() => window.topicSubmitted.slug), finalizedSlug, 'Explicit Save must finalize the active Slug before capturing native values');
        slugAssert.deepEqual(await page.evaluate(() => window.topicSubmittedEntries.filter(([name]) => !['id', 'expected_updated_at'].includes(name))), finalizedValues, 'Submit finalization preserves every unrelated field');
        slugAssert.ok(slugSaveResults.at(-1).result.fieldErrors?.slug?.length, JSON.stringify(slugSaveResults.at(-1).result)); await slugExpect(slug).toBeEnabled(); await slugExpect(slug).toHaveValue(finalizedSlug); await slugExpect(slug).toBeFocused(); slugAssert.deepEqual(await nativeValues(), finalizedValues); await slugHarness.clearInjectedRows();
        await slug.fill(rawSlug); await slugExpect(slug).toHaveValue(rawSlug); await page.evaluate(() => { window.topicSourceSaveOutcome = 'success'; }); const beforeEnterSave = slugSaveResults.length; await slug.press('Enter'); await slugExpect.poll(() => slugSaveResults.length).toBe(beforeEnterSave + 1);
        await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.equal(slugSaveResults.at(-1).row.slug, finalizedSlug); await slugExpect(slug).toHaveValue(finalizedSlug); await slugExpect(page.locator('[data-admin-entity-seo-search-preview] p').first()).toHaveText(/\/final-raw-and-slug$/); slugAssert.deepEqual(await nativeValues(), finalizedValues);
        await slug.focus(); await title.focus(); await slugExpect(slug).toHaveValue(finalizedSlug); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false');
        await open(editMode); await slugExpect(slug).toHaveValue(finalizedSlug); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.deepEqual(await nativeValues(), finalizedValues);
        result.rawEditingSaveFinalizationFailureRetentionAndActualEnterCanonicalClean = true;
        await slug.fill(''); await title.focus(); await slugExpect(slug).toHaveValue(''); await slugExpect(title).toBeFocused(); const emptyValues = await nativeValues(), fallbackSlug = 'valid-system-save-title', fallbackValues = emptyValues.map(([name, value]) => [name, name === 'slug' ? fallbackSlug : value]), beforeEmptySave = slugSaveResults.length;
        await form.evaluate(form => form.requestSubmit()); await slugExpect.poll(() => slugSaveResults.length).toBe(beforeEmptySave + 1); slugAssert.equal(slugSaveResults.at(-1).result.status, 'success'); slugAssert.equal(await page.evaluate(() => window.topicSubmitted.slug), fallbackSlug, 'An empty manual Slug must finalize from the current title even after it has blurred'); slugAssert.equal(slugSaveResults.at(-1).row.slug, fallbackSlug);
        await slugExpect(slug).toHaveValue(fallbackSlug); await slugExpect(page.locator('[data-admin-entity-seo-search-preview] p').first()).toHaveText(/\/valid-system-save-title$/); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.deepEqual(await nativeValues(), fallbackValues);
        await slug.focus(); await title.focus(); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await open(editMode); await slugExpect(slug).toHaveValue(fallbackSlug); await slugExpect(form).toHaveAttribute('data-admin-form-dirty', 'false'); slugAssert.deepEqual(await nativeValues(), fallbackValues); result.unfocusedEmptyManualSlugFinalizesFromTitleAndReadsBackClean = true;
        result.assertionCount = assertionCount - firstAssertion; auditResults.push(result); console.log('PASS Slug ' + type + ' ' + actionMode + ' RTL ' + width + ' assertions=' + result.assertionCount);
      }
      slugAssert.deepEqual(errors, []); slugAssert.deepEqual(forbidden, []);
      const sourceHashes = await readSlugSourceHashes();
      slugAssert.deepEqual(sourceHashes, slugSourceHashesAtStart, 'Slug owners changed after pre-webpack capture; compiled evidence is invalid');
      slugAssert.equal(createHash('sha256').update(await readFile(beforePath)).digest('hex'), beforeHash, 'Historical Before audit is immutable');
      const audit = { status: 'PASS', browser: 'Chrome ' + browser.version(), browserDate: slugBrowserDate, viewports: [...new Set(auditResults.map(result => result.width))].map(width => ({ width, height: 1100, direction: 'rtl' })), historicalBefore: { path: beforePath, sha256: beforeHash, status: JSON.parse(immutableBefore).status }, sourceHashes, sourceHashesAtStart: slugSourceHashesAtStart, sourceHashesAtEnd: sourceHashes, sourceIdentity: slugSourceIdentityPath, assertions: { total: assertionCount, perCase: auditResults.map(({ type, mode, width, assertionCount }) => ({ type, mode, width, count: assertionCount })), scope: 'Executed logical Node assertions and Playwright matchers in this Slug branch; source-harness internal checks and bridge infrastructure assertions are separate.' }, browserCases: auditResults, sourceSaveResults: slugSaveResults, scope: (slugMountedSaveOnly ? 'Actual Article Edit mounted-save probe' : 'Actual six eligible editor consumers Create/Edit') + ' in the existing browser memory fixture, with actual Article/Media save adapters and shared harness PostgreSQL in-memory constraints. Authentication/cache/media coordination are finite infrastructure ports. No hosted persistence, public request, new runtime, or published URL change.', existingCapabilityBoundary: 'Local Draft Recovery retains Markdown content/revision only; unsaved title/slug recovery is absent. Video/Gallery retain no Markdown draft adapter.', screenshots, screenshotCount: screenshots.length, serverStarted: false, hostedDatabaseWrites: 0, productSlugChanges: false, globalClosed: false };
      const evidence = path.join(evidenceRoot, slugMountedSaveOnly ? 'slug-mounted-save.json' : 'slug-system-browser.json'); await writeFile(evidence, JSON.stringify(audit, null, 2));
      console.log(JSON.stringify({ status: audit.status, browserCases: auditResults.length, assertions: assertionCount, realAdapterSaves: slugSaveResults.length, evidence, screenshots: screenshots.length, hostedDatabaseWrites: 0, globalClosed: false }));
      return;
    }
    if (!fieldsOnly && !reviewOnly && !seoOnly && !videoOnly && !mediaTabsOnly) for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1100 }); await open('header-defaults'); await expect(page.locator('[data-admin-tab-section-heading]')).toHaveCount(3);
      const defaults = await page.locator('[data-admin-tab-section-heading]').evaluateAll(elements => elements.map(header => { const identity = header.querySelector('[data-admin-form-control-header]'), frame = identity.querySelector(':scope > span[aria-hidden="true"]'), title = header.querySelector('[role="heading"]'), s = getComputedStyle(header), t = getComputedStyle(title), r = header.getBoundingClientRect(); return { id: header.dataset.adminTabSectionHeading, presentation: header.dataset.adminTabSectionPresentation ?? null, accents: header.querySelectorAll('[data-admin-tab-section-accent]').length, direction: s.direction, font: t.fontSize, weight: t.fontWeight, icon: frame.querySelector('svg').getBoundingClientRect().width, frame: frame.getBoundingClientRect().width, description: getComputedStyle(identity.lastElementChild.lastElementChild).fontSize, backgroundImage: s.backgroundImage, shadow: s.boxShadow, radius: s.borderTopRightRadius, border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth], padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft], minHeight: s.minHeight, clipped: [...header.querySelectorAll('[role="heading"], button')].some(element => { const e = element.getBoundingClientRect(); return e.left < r.left - 1 || e.right > r.right + 1 || e.top < r.top - 1 || e.bottom > r.bottom + 1; }) }; }));
      for (const row of defaults) {
        assert.equal(row.accents, 0); assert.equal(row.direction, 'rtl'); assert.equal(row.font, '14px'); assert.equal(row.weight, '600'); assert.equal(row.icon, 20); assert.equal(row.frame, 40); assert.equal(row.description, '12px'); assert.equal(row.clipped, false);
        if (row.id === 'fixture-panel') { assert.equal(row.presentation, 'panel'); assert.equal(row.backgroundImage, 'none'); assert.equal(row.shadow, 'none'); assert.equal(row.radius, '0px'); assert.deepEqual(row.border, ['0px', '0px', '1px', '0px']); assert.deepEqual(row.padding, ['0px', '0px', '6px', '0px']); assert.equal(row.minHeight, '0px'); }
        else { assert.equal(row.presentation, null); assert.ok(row.backgroundImage.includes('linear-gradient')); assert.notEqual(row.shadow, 'none'); assert.equal(row.radius, '16px'); assert.deepEqual(row.border, ['1px', '1px', '1px', '1px']); assert.deepEqual(row.padding, ['12px', width < 640 ? '16px' : '20px', '12px', width < 640 ? '16px' : '20px']); assert.equal(row.minHeight, '76px'); }
        const action = page.getByRole('button', { name: 'إجراء ' + row.id.slice('fixture-'.length), exact: true }); await action.focus(); await expect(action).toBeFocused(); await page.keyboard.press('Enter');
      }
      assert.equal(await page.evaluate(() => window.ownerSummaryClicks), 3); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); console.log('PASS default/control/panel Section Headers remain unchanged RTL ' + width);
    }
    for (const width of [1440, 390]) for (const mode of mediaTabsOnly ? ['video-create', 'video-edit', 'gallery-create', 'gallery-edit'] : videoOnly ? ['video-create', 'video-edit'] : reviewOnly || seoOnly ? ['create', 'edit'] : ['create', 'edit', 'media-create', 'media-edit']) {
      await page.setViewportSize({ width, height: 1100 }); await open(mode); if (videoOnly) await page.locator('[data-admin-tab-id="video"]').click(); await expect(mediaTabsOnly ? page.locator('input[name="title"]') : videoOnly ? page.locator('input[name="video_url"]') : editor()).toBeEditable();
      await page.evaluate(() => localStorage.clear()); await page.reload(); if (videoOnly) await page.locator('[data-admin-tab-id="video"]').click(); await expect(mediaTabsOnly ? page.locator('input[name="title"]') : videoOnly ? page.locator('input[name="video_url"]') : editor()).toBeEditable();
      if (mediaTabsOnly) { const result = await verifyMediaTabs(mode, width); results.push(result); console.log('PASS Media tab separation ' + mode + ' RTL ' + width + ' ' + JSON.stringify(result)); continue; }
      if (videoOnly) {
        const video = await verifyVideoFields(mode, width), meta = await verifyMetaVideoFields(mode, width); await open(mode); const seo = await verifySeo(mode, width); await open(mode); const review = await verifyReview(mode, width);
        results.push({ width, mode, video, meta, seo, review }); console.log('PASS Video canonical panel ' + mode + ' RTL ' + width + ' ' + JSON.stringify({ specializedFields: video.before.labels.length, seoHeaders: seo.selectedGeometry.headers.length, equalOuterHeights: [seo.selectedGeometry.info.h, seo.selectedGeometry.imageCard.h], reviewHeaders: review.geometry.headers.length, score: review.score })); continue;
      }
      if (reviewOnly) { const result = await verifyReview(mode, width); results.push(result); console.log('PASS Article Review panel ' + mode + ' RTL ' + width + ' ' + JSON.stringify({ headers: result.geometry.headers.length, score: result.score, blocking: result.blocking, notes: result.notes })); continue; }
      if (seoOnly) { const result = await verifySeo(mode, width); results.push(result); console.log('PASS Article SEO composition ' + mode + ' RTL ' + width + ' ' + JSON.stringify({ columns: result.selectedGeometry.columns, info: result.selectedGeometry.info.w, image: result.selectedGeometry.image.w, gap: result.selectedGeometry.gap, labels: result.selectedGeometry.labels.length, fields: 9 })); continue; }
      const expectedCharcoalGradient = await page.evaluate(() => { const probe = document.createElement('span'); probe.style.backgroundImage = 'linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))'; document.body.append(probe); const value = getComputedStyle(probe).backgroundImage; probe.remove(); return value; });
      await expect(page.locator('[data-topic-stat]')).toHaveCount(6); await expect(page.getByText('نص المقال', { exact: true })).toHaveCount(0);
      const measurePresentation = (root, names) => {
        const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const identity = [...root.querySelectorAll('[data-admin-tab-section-heading]')].map(header => {
          const heading = header.querySelector('[role="heading"]'), title = heading.closest('span'), identity = header.querySelector('[data-admin-form-control-header]'), [frame, divider] = identity.querySelectorAll(':scope > span[aria-hidden="true"]'), accent = header.querySelector('[data-admin-tab-section-accent]'), card = header.closest('section'), summary = header.querySelector('[data-admin-tab-section-summary]'), s = getComputedStyle(title), h = getComputedStyle(header), a = getComputedStyle(accent), c = getComputedStyle(card);
          return { id: header.dataset.adminTabSectionHeading, title: heading.textContent, font: s.fontSize, weight: s.fontWeight, icon: box(frame.querySelector('svg')), frame: box(frame), divider: box(divider), text: box(title), direction: h.direction, presentation: header.dataset.adminTabSectionPresentation, header: box(header), card: box(card), cardBorder: [parseFloat(c.borderTopWidth), parseFloat(c.borderRightWidth), parseFloat(c.borderLeftWidth)], background: h.backgroundColor, backgroundImage: h.backgroundImage, shadow: h.boxShadow, padding: [h.paddingTop, h.paddingRight, h.paddingBottom, h.paddingLeft], radius: [h.borderTopLeftRadius, h.borderTopRightRadius, h.borderBottomRightRadius, h.borderBottomLeftRadius], border: [h.borderTopWidth, h.borderRightWidth, h.borderBottomWidth, h.borderLeftWidth], accent: { ...box(accent), firstChild: header.firstElementChild === accent, hidden: accent.getAttribute('aria-hidden'), pointerEvents: a.pointerEvents, position: a.position, background: a.backgroundColor, backgroundImage: a.backgroundImage, shadow: a.boxShadow }, shadowOutsideAccent: [...header.querySelectorAll('*')].some(element => element !== accent && getComputedStyle(element).boxShadow !== 'none'), clipped: [...header.querySelectorAll('[role="heading"], [data-topic-stat]')].some(element => { const r = element.getBoundingClientRect(), parent = header.getBoundingClientRect(); return r.left < parent.left - 1 || r.right > parent.right + 1 || r.top < parent.top - 1 || r.bottom > parent.bottom + 1; }), summary: summary ? { ...box(summary), counters: [...summary.querySelectorAll('[data-topic-stat]')].map(box), columns: getComputedStyle(summary.querySelector('[data-topic-editor-stats]')).gridTemplateColumns.split(' ').length } : null };
        });
        const switches = [...root.querySelectorAll('[data-admin-form-switch-surface="premium-inline"]')].map(label => { const glyph = label.querySelector(':scope > [aria-hidden="true"] svg'), card = label.parentElement, s = getComputedStyle(label), p = getComputedStyle(card); return { name: label.querySelector('[role="switch"]').name, label: label.textContent.trim(), icon: box(glyph), card: box(card), font: s.fontSize, padding: [p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft] }; });
        const displayGrid = root.querySelector('[data-content-display-settings] [data-admin-form-grid]');
        const excerpt = root.querySelector('textarea[name="excerpt"]');
        const scroll = root.querySelector('.admin-rich-text-editor'), rich = scroll?.closest('[data-admin-rich-text-scope]');
        const nested = [...(rich?.querySelectorAll('*') ?? [])].filter(element => { const s = getComputedStyle(element); return /(auto|scroll)/.test(s.overflowY) && element.scrollHeight > element.clientHeight + 1; });
        const layout = root.querySelector('[data-admin-form-layout="panel"], [data-admin-form-grid="equal-height-columns"]'), layoutBox = layout?.getBoundingClientRect(), childrenBottom = layout ? Math.max(...[...layout.children].map(child => child.getBoundingClientRect().bottom)) : null;
        const equalHeightGrid = root.querySelector('[data-admin-form-grid="equal-height-columns"]'), equalHeightCards = equalHeightGrid ? [...equalHeightGrid.children] : [];
        const equalHeight = equalHeightGrid ? { ...box(equalHeightGrid), columns: getComputedStyle(equalHeightGrid).gridTemplateColumns.split(' ').map(Number.parseFloat), gap: parseFloat(getComputedStyle(equalHeightGrid).columnGap), cards: equalHeightCards.map(card => ({ ...box(card), tag: card.tagName, id: card.id, self: getComputedStyle(card).alignSelf, header: card.querySelector('[data-admin-tab-section-heading]')?.dataset.adminTabSectionHeading })), innerControls: [...equalHeightGrid.querySelectorAll('input[name="title"],input[name="image_alt"]')].map(input => ({ name: input.name, ...box(input) })) } : null;
        return { headings: identity, switches, equalHeight, displayColumns: displayGrid ? getComputedStyle(displayGrid).gridTemplateColumns.split(' ').length : null, excerpt: excerpt ? { ...box(excerpt), rows: excerpt.rows, lineHeight: getComputedStyle(excerpt).lineHeight, verticalInsets: ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].map(name => parseFloat(getComputedStyle(excerpt)[name])), resize: getComputedStyle(excerpt).resize, overflowY: getComputedStyle(excerpt).overflowY } : null, viewport: scroll ? box(scroll) : null, overflow: scroll ? getComputedStyle(scroll).overflowY : null, scrollbar: scroll ? getComputedStyle(scroll).scrollbarWidth : null, classes: scroll?.className, nested: nested.length, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1, trailingLayoutGap: layoutBox ? layoutBox.bottom - childrenBottom : null, expected: names };
      };
      const form = page.locator('form[data-admin-form-runtime]'), basicTab = page.locator('[data-admin-tab-id="basic"]'), displayTab = page.locator('[data-admin-tab-id="display"]');
      await expect(form).toHaveCount(1);
      assert.deepEqual(await form.locator('[data-admin-tab-id]').evaluateAll(tabs => tabs.map(tab => tab.dataset.adminTabId)), mode.startsWith('media-') ? ['basic', 'display', 'seo', 'publish'] : ['basic', 'display', 'faq', 'seo', 'publish']);
      const geometry = await page.locator('[data-content-basic-panel]').evaluate(measurePresentation, headers);
      assert.equal(geometry.switches.length, 0, 'Content tab contains no duplicate display fields');
      assert.equal(geometry.headings.length, 3, 'Content retains Basic, Image and Body section headers');
      assert.ok(geometry.equalHeight, 'Content opts into the canonical equal-height Grid');
      assert.deepEqual(geometry.equalHeight.cards.map(card => card.tag), ['SECTION', 'SECTION']); assert.deepEqual(geometry.equalHeight.cards.map(card => card.header), ['content-basic-data', 'content-main-image']);
      assert.equal(geometry.equalHeight.gap, 12); assert.equal(geometry.equalHeight.cards[1].id, 'content-image-field');
      const [basicCard, imageCard] = geometry.equalHeight.cards;
      if (width >= 1280) { assert.equal(geometry.equalHeight.columns.length, 2); assert.ok(Math.abs(basicCard.w / imageCard.w - 1.85) <= 0.01, 'Shared Layout retains its original Desktop width ratio'); assert.ok(Math.abs(basicCard.h - imageCard.h) <= 1, 'Only the two outer cards share Desktop height'); assert.ok(Math.abs(basicCard.y - imageCard.y) <= 1); assert.ok(basicCard.x > imageCard.x, 'Content retains Basic right and Image left in RTL'); }
      else { assert.equal(geometry.equalHeight.columns.length, 1); assert.ok(imageCard.y >= basicCard.y + basicCard.h + 11); assert.ok(Math.abs(basicCard.h - imageCard.h) > 1, 'Stacked Mobile cards retain their independent natural heights'); }
      for (const control of geometry.equalHeight.innerControls) assert.equal(control.h, 44, 'Equal-height presentation leaves native inner controls at canonical height');
      if (fieldsOnly) {
        assert.equal(geometry.excerpt.rows, 5); assert.equal(geometry.excerpt.h, 146);
        const selectFields = await verifySelectFields(mode, width);
        results.push({ width, mode, contentGeometry: geometry.equalHeight, trailingLayoutGap: geometry.trailingLayoutGap, excerpt: geometry.excerpt, selectFields });
        console.log('PASS Topic selector containers ' + mode + ' RTL ' + width + ' ' + JSON.stringify({ contentWidths: geometry.equalHeight.cards.map(card => card.w), contentHeights: geometry.equalHeight.cards.map(card => card.h), fieldWidths: selectFields.before.fields.map(field => field.w), fieldHeights: selectFields.before.fields.map(field => field.h), errorHeights: selectFields.error.fields.map(field => field.h), labelControlGap: selectFields.before.fields.map(field => field.labelControlGap), triggerHeights: selectFields.before.fields.map(field => field.trigger.h), portals: selectFields.portals.length }));
        continue;
      }
      await displayTab.click();
      const displayGeometry = await page.getByRole('tabpanel').filter({ visible: true }).evaluate(measurePresentation, ['إعدادات العرض']);
      assert.deepEqual(displayGeometry.headings.map(row => row.title), ['إعدادات العرض']);
      assert.equal(displayGeometry.documentOverflow, false);
      assert.equal(displayGeometry.displayColumns, width >= 1280 ? 4 : 1);
      assert.deepEqual(displayGeometry.switches.map(row => row.label), fieldLabels);
      const displayCards = displayGeometry.switches.map(row => row.card), displayRows = [...new Set(displayCards.map(row => row.y))];
      for (const card of displayCards) assert.ok(Math.abs(card.w - displayCards[0].w) <= 1, 'Every display control occupies one equal-width cell');
      assert.deepEqual(displayRows.map(y => displayCards.filter(card => card.y === y).length), width >= 1280 ? [4, 3] : fields.map(() => 1));
      if (width >= 1280) { assert.ok(displayCards[0].x > displayCards[1].x && displayCards[1].x > displayCards[2].x && displayCards[2].x > displayCards[3].x, 'Display controls follow physical RTL columns'); for (let index = 0; index < 3; index++) assert.ok(Math.abs(displayCards[index].x - displayCards[index + 4].x) <= 1, 'The second row retains three cells and one natural empty cell'); }
      assert.equal(geometry.excerpt.rows, 5); assert.equal(geometry.excerpt.lineHeight, '24px'); assert.equal(geometry.excerpt.resize, 'vertical'); assert.equal(geometry.excerpt.overflowY, 'auto'); assert.ok(Math.abs(geometry.excerpt.h - (geometry.excerpt.rows * parseFloat(geometry.excerpt.lineHeight) + geometry.excerpt.verticalInsets.reduce((sum, value) => sum + value, 0))) <= 1, 'Panel excerpt honors five native rows and actual canonical padding/borders: ' + JSON.stringify(geometry.excerpt));
      geometry.headings.splice(2, 0, ...displayGeometry.headings);
      geometry.switches = displayGeometry.switches;
      await basicTab.click();
      console.log('DISPLAY_TRANSFER_GEOMETRY ' + JSON.stringify({ mode, width, contentHeaders: 3, displayHeaders: 1, trailingLayoutGap: geometry.trailingLayoutGap, contentCardWidths: geometry.equalHeight.cards.map(card => card.w), contentCardHeights: geometry.equalHeight.cards.map(card => card.h), displayColumns: displayGeometry.displayColumns, displayRowCounts: displayRows.map(y => displayCards.filter(card => card.y === y).length), excerptHeight: geometry.excerpt.h }));
      assert.deepEqual(geometry.headings.map(row => row.title), mode.startsWith('media-') ? ['البيانات الأساسية والمحتوى', ...headers.slice(1)] : headers);
      for (const row of geometry.headings) {
        assert.equal(row.font, '14px'); assert.equal(row.weight, '600'); assert.equal(row.icon.w, 20); assert.equal(row.icon.h, 20); assert.equal(row.frame.w, 40); assert.equal(row.frame.h, 40); assert.equal(row.direction, 'rtl'); assert.equal(row.presentation, 'premium');
        if (row.id === 'content-body') { assert.equal(row.background, 'rgb(8, 13, 16)'); assert.equal(row.backgroundImage, 'none'); }
        else { assert.ok(['content-basic-data', 'content-main-image', 'content-display-settings-heading'].includes(row.id)); assert.equal(row.background, 'rgba(8, 13, 22, 0.82)'); assert.equal((row.backgroundImage.match(/linear-gradient\(/g) ?? []).length, 1); assert.equal(row.backgroundImage, expectedCharcoalGradient, 'Both approved gradient stops retain their actual browser-computed colors'); assert.equal(row.backgroundImage.includes('radial-gradient'), false); }
        assert.equal(row.shadow, 'none'); assert.equal(row.shadowOutsideAccent, false); assert.deepEqual(row.padding, ['12px', '24px', '12px', '12px']); assert.deepEqual(row.radius, ['16px', '16px', '0px', '0px']); assert.deepEqual(row.border, ['0px', '0px', '1px', '0px']); assert.equal(row.clipped, false);
        assert.equal(row.accent.firstChild, true); assert.equal(row.accent.hidden, 'true'); assert.equal(row.accent.pointerEvents, 'none'); assert.equal(row.accent.position, 'absolute'); assert.equal(row.accent.w, 8); assert.equal(row.accent.background, 'rgb(242, 203, 120)'); assert.equal(row.accent.backgroundImage, 'none'); assert.notEqual(row.accent.shadow, 'none'); assert.ok(Math.abs(row.header.x + row.header.w - row.accent.x - row.accent.w - 8) <= 1); assert.ok(Math.abs(row.accent.y - row.header.y - 8) <= 1); assert.ok(Math.abs(row.header.y + row.header.h - row.accent.y - row.accent.h - 9) <= 1);
        assert.ok(row.accent.x >= row.frame.x + row.frame.w + 7, 'Gold edge precedes the icon in physical RTL order'); assert.equal(row.divider.w, 1); assert.equal(row.divider.h, 32); assert.ok(row.frame.x >= row.divider.x + row.divider.w + 11); assert.ok(row.divider.x >= row.text.x + row.text.w + 11, 'Internal divider remains between icon and title');
        assert.ok(Math.abs(row.header.x - row.card.x - row.cardBorder[2]) <= 1); assert.ok(Math.abs(row.header.x + row.header.w - row.card.x - row.card.w + row.cardBorder[1]) <= 1); assert.ok(Math.abs(row.header.y - row.card.y - row.cardBorder[0]) <= 1, 'Premium header is integrated with its canonical Card border');
        if (row.summary) { assert.equal(row.summary.counters.length, 6); assert.equal(row.summary.columns, width < 640 ? 3 : 6); for (const counter of row.summary.counters) { assert.ok(counter.x >= row.summary.x - 1); assert.ok(counter.x + counter.w <= row.summary.x + row.summary.w + 1); assert.ok(counter.y >= row.summary.y - 1); assert.ok(counter.y + counter.h <= row.summary.y + row.summary.h + 1); } }
      }
      assert.deepEqual(geometry.switches.map(row => row.name), fields); for (const row of geometry.switches) { assert.equal(row.icon.w, 16); assert.equal(row.icon.h, 16); assert.equal(row.font, '12px'); assert.deepEqual(row.padding, ['10px', '10px', '10px', '10px']); }
      assert.equal(geometry.viewport.h, 300); assert.equal(geometry.overflow, 'auto'); assert.equal(geometry.scrollbar, 'thin'); assert.ok(geometry.classes.includes('venesia-scrollbar')); assert.ok(geometry.classes.includes('overscroll-y-contain')); assert.equal(geometry.documentOverflow, false); assert.ok(geometry.nested <= 1);
      await editor().click(); await expect(editor()).toBeFocused(); await editor().press('Control+A'); await editor().press('Backspace'); await expect(content()).toHaveValue(''); assert.equal(await page.locator('.admin-rich-text-editor').evaluate(element => element.scrollHeight - element.clientHeight), 0, 'An empty bounded editor has no unnecessary internal scroll');
      await displayTab.click();
      const before = await page.locator('[data-admin-form-switch-surface="premium-inline"] input[role="switch"]').evaluateAll(elements => elements.map(input => ({ name: input.name, checked: input.checked })));
      assert.deepEqual(before.map(item => item.name), fields);
      assert.deepEqual(before.map(item => item.checked), mode.endsWith('edit') ? [false, true, false, true, true, false, false] : fields.map(() => true), 'Create visible-safe defaults and Edit stored flags survive tab transfer');
      const switchControl = page.locator('[data-admin-form-switch-surface="premium-inline"] input[role="switch"]').first(); await switchControl.focus(); await page.keyboard.press('Space'); await expect(switchControl).toBeFocused(); await page.keyboard.press('Space'); assert.deepEqual(await page.locator('[data-admin-form-switch-surface="premium-inline"] input[role="switch"]').evaluateAll(elements => elements.map(input => ({ name: input.name, checked: input.checked }))), before);
      await page.evaluate(names => { window.displayFieldNodes = names.map(name => document.querySelector('input[type="checkbox"][name="' + name + '"]')); }, fields);
      await switchControl.press('Space'); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
      const switched = await switchControl.isChecked();
      await basicTab.click();
      assert.equal(await page.evaluate(names => names.every((name, index) => { const node = document.querySelector('input[type="checkbox"][name="' + name + '"]'); return node === window.displayFieldNodes[index] && node.isConnected && node.form === document.querySelector('form[data-admin-form-runtime]') && document.querySelectorAll('input[type="checkbox"][name="' + name + '"]').length === 1; }), fields), true, 'The seven original nodes remain mounted once in the same form while inactive');
      await page.locator('[data-admin-tab-id="publish"]').click();
      await page.getByRole('button', { name: 'تعديل الإعدادات', exact: true }).click();
      await expect(displayTab).toHaveAttribute('aria-selected', 'true'); await expect(switchControl).toBeFocused(); await expect(switchControl).toBeChecked({ checked: switched });
      await displayTab.focus(); await displayTab.press('Home'); await expect(basicTab).toBeFocused(); await basicTab.press('End'); await expect(page.locator('[data-admin-tab-id="publish"]')).toBeFocused(); await displayTab.click();
      await page.locator('[data-admin-form-action="close"]').click(); const leave = page.getByRole('dialog', { name: 'إغلاق دون حفظ؟', exact: true }); await expect(leave).toBeVisible(); await leave.locator('[data-admin-confirm-cancel]').click(); await expect(leave).toHaveCount(0); await expect(switchControl).toBeChecked({ checked: switched });
      await basicTab.click(); await page.locator('input[name="title"]').fill('عنوان صالح لاختبار نقل إعدادات العرض');
      const displayPayload = await form.evaluate((element, names) => { const data = new FormData(element); return Object.fromEntries(names.map(name => [name, data.get(name)])); }, fields);
      await page.evaluate(() => { window.topicDeferSave = true; }); await form.evaluate(element => element.requestSubmit()); await page.waitForFunction(() => typeof window.topicReleaseSave === 'function');
      await expect(switchControl).toBeDisabled(); assert.deepEqual(await page.evaluate(names => Object.fromEntries(names.map(name => [name, window.topicSubmitted[name] ?? null])), fields), displayPayload);
      await page.evaluate(() => window.topicReleaseSave()); await expect(switchControl).toBeEnabled(); await expect(basicTab).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('input[name="title"]')).toBeFocused();
      await displayTab.click(); await expect(switchControl).toBeChecked({ checked: switched }); await expect(form).toHaveAttribute('data-admin-form-dirty', 'true');
      await page.evaluate(() => { window.topicDeferSave = false; window.topicSaveOutcome = 'success'; }); await form.evaluate(element => element.requestSubmit()); await expect(form).toHaveAttribute('data-admin-form-dirty', 'false'); await expect(switchControl).toBeChecked({ checked: switched });
      assert.deepEqual(await page.evaluate(names => Object.fromEntries(names.map(name => [name, window.topicSubmitted[name] ?? null])), fields), displayPayload);
      await basicTab.click();
      await editor().click(); await editor().press('Control+A'); await page.keyboard.insertText('نص قابل للتنسيق'); await expect(content()).toHaveValue('نص قابل للتنسيق'); await expect(editor()).toBeFocused(); await editor().press('Control+A'); assert.equal(await page.evaluate(() => getSelection().toString()), 'نص قابل للتنسيق');
      const bold = page.getByRole('toolbar', { name: 'شريط أدوات نص المقال', exact: true }).locator('[data-admin-text-format-bold]'); await bold.focus(); await expect(bold).toBeFocused(); await page.keyboard.press('Enter'); await expect(content()).toHaveValue('**نص قابل للتنسيق**'); await expect(editor()).toBeFocused(); assert.equal(await page.evaluate(() => getSelection().toString()), 'نص قابل للتنسيق');
      await editor().press('ArrowRight'); await editor().press('Control+End'); await page.keyboard.insertText(' إضافة'); assert.ok((await content().inputValue()).includes('إضافة')); assert.equal(await page.evaluate(() => getSelection().isCollapsed), true);
      const mixed = 'نص عربي English 123 و٤٥٦'; await editor().press('Control+A'); await page.keyboard.insertText(mixed); await editor().press('Control+A'); assert.equal(await page.evaluate(() => getSelection().toString()), mixed);
      await page.getByRole('button', { name: 'قائمة نقطية', exact: true }).click(); await expect(editor().locator('li')).toHaveText(mixed); assert.equal(await editor().locator('li').evaluate(element => getComputedStyle(element).direction), 'rtl');
      await page.getByRole('button', { name: 'رابط', exact: true }).click(); await page.getByRole('textbox', { name: 'عنوان الرابط', exact: true }).fill('https://example.com/rtl-123'); await page.getByRole('textbox', { name: 'عنوان الرابط', exact: true }).press('Enter'); await expect(editor().locator('a')).toHaveText(mixed); await expect(editor().locator('a')).toHaveAttribute('href', 'https://example.com/rtl-123'); await expect(editor()).toBeFocused();
      await editor().click(); await editor().press('Control+A'); await page.keyboard.insertText('فقرة طويلة لاختبار مساحة الكتابة والتمرير المستقل. '.repeat(120)); await expect.poll(async () => (await content().inputValue()).length).toBeGreaterThan(1000);
      const scroll = page.locator('.admin-rich-text-editor'), toolbar = page.getByRole('toolbar', { name: 'شريط أدوات نص المقال', exact: true }); await toolbar.scrollIntoViewIfNeeded(); const toolbarBefore = await toolbar.boundingBox();
      const physicalScrollbar = await assertRightRtl();
      const scrollState = await scroll.evaluate(element => { element.scrollTop = 0; const before = window.scrollY; element.scrollTop = element.scrollHeight; return { scrollTop: element.scrollTop, client: element.clientHeight, total: element.scrollHeight, pageBefore: before, pageAfter: window.scrollY, nested: [...element.querySelectorAll('*')].filter(child => /(auto|scroll)/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight + 1).length }; });
      assert.ok(scrollState.scrollTop > 0); assert.equal(scrollState.client, 300); assert.ok(scrollState.total > scrollState.client); assert.equal(scrollState.pageAfter, scrollState.pageBefore); assert.equal(scrollState.nested, 0); assert.deepEqual(await toolbar.boundingBox(), toolbarBefore); await expect(toolbar).toBeInViewport();
      await scroll.evaluate(element => { element.scrollTop = 0; }); const wheelPageY = await page.evaluate(() => window.scrollY); await scroll.hover(); await page.mouse.wheel(0, 180); await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0); assert.equal(await page.evaluate(() => window.scrollY), wheelPageY); assert.deepEqual(await toolbar.boundingBox(), toolbarBefore);
      const keyboardStart = await scroll.evaluate(element => ({ pageY: window.scrollY, scrollTop: element.scrollTop })); const keyboardPositions = await keyboardScroll(); await assertRightRtl();
      const expected = await content().inputValue(); await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.content, draftKey(mode))).toBe(expected);
      // Compare native ancestor positioning against the same untouched auto/RTL owner and content.
      const layout = await scroll.evaluate(element => { const frame = element.parentElement, r = frame.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width, documentHeight: document.documentElement.scrollHeight, html: element.querySelector('[role="textbox"]').innerHTML }; });
      const baselineParams = new URLSearchParams({ mode: 'keyboard-baseline', before: String(layout.top - 16), after: String(Math.max(0, layout.documentHeight - layout.bottom - 16)), width: String(layout.width), html: layout.html });
      await page.goto('http://topic-content.fixture/?' + baselineParams); await page.evaluate(() => document.fonts.ready); await expect(editor()).toBeEditable(); const baselineTop = await scroll.evaluate(element => element.parentElement.getBoundingClientRect().top + scrollY); assert.ok(Math.abs(baselineTop - layout.top) <= 1, 'Native keyboard control has matching viewport placement'); await editor().focus(); await editor().press('Control+End'); await scroll.evaluate((element, state) => { element.scrollTop = state.scrollTop; scrollTo(0, state.pageY); }, keyboardStart); const baselinePositions = await keyboardScroll();
      // Browser caret navigation may also reposition ancestors; compare the supported outcomes,
      // already asserted above for each key, rather than decoration-dependent page pixels.
      const nativeAncestorMovement = positions => positions.some(position => position.pageY !== positions[0].pageY); assert.equal(nativeAncestorMovement(keyboardPositions), nativeAncestorMovement(baselinePositions), 'Right scrollbar retains native ancestor positioning behavior');
      assert.deepEqual(keyboardPositions.map(position => ({ step: position.step, caretVisible: position.caretVisible })), baselinePositions.map(position => ({ step: position.step, caretVisible: position.caretVisible })), 'Right scrollbar retains native keyboard caret visibility');
      await open(mode); await expect(content()).toHaveValue(expected); const restoredNotice = page.getByText('تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال.', { exact: true }); await expect(restoredNotice).toBeVisible();
      const noticeState = () => page.locator('form[data-admin-form-runtime]').evaluate(form => ({ entries: [...new FormData(form)].map(([name, value]) => [name, typeof value === 'string' ? value : { name: value.name, size: value.size, type: value.type }]), storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])), dirty: form.dataset.adminFormDirty, href: location.href }));
      const beforeDismiss = await noticeState(), dismissNotice = page.getByRole('button', { name: 'إغلاق الإشعار', exact: true }); await dismissNotice.focus(); await expect(dismissNotice).toBeFocused(); await dismissNotice.press(mode.endsWith('edit') ? 'Space' : 'Enter'); await expect(restoredNotice).toHaveCount(0); await expect(dismissNotice).toHaveCount(0); await expect(page.locator('#topic-content-editor')).toBeFocused(); await expect(content()).toHaveValue(expected); assert.deepEqual(await noticeState(), beforeDismiss, 'Notice dismissal preserves all form values, local draft, dirty state and URL'); await page.keyboard.press('Tab'); assert.equal(await page.locator('#topic-content-editor').evaluate(section => section.contains(document.activeElement)), true, 'Keyboard continuation remains inside the same editor section');
      await page.evaluate(({ key }) => localStorage.setItem(key, JSON.stringify({ version: 1, content: 'مسودة من نسخة قديمة', baselineRevision: 'old-revision', savedAt: '2026-10-22T00:00:00Z' })), { key: draftKey(mode) }); await page.reload(); await expect(page.locator('[data-topic-draft-conflict]')).toBeVisible(); await expect(editor()).toHaveAttribute('contenteditable', 'false');
      await page.locator('input[name="title"]').fill('عنوان صالح للتحقق المحلي'); await page.locator('form').evaluate(form => form.requestSubmit()); await expect(page.locator('[data-topic-draft-restore]')).toBeFocused(); assert.equal(await page.evaluate(() => window.topicSaveAttempts || 0), 0);
      await page.keyboard.press('Enter'); await expect(editor()).toBeEditable(); await expect(content()).toHaveValue('مسودة من نسخة قديمة');
      await page.evaluate(({ key }) => localStorage.setItem(key, JSON.stringify({ version: 1, content: 'مسودة يجب تجاهلها', baselineRevision: 'old-revision', savedAt: '2026-10-22T00:00:00Z' })), { key: draftKey(mode) }); await page.reload(); const discard = page.locator('[data-topic-draft-discard]'); await discard.focus(); await page.keyboard.press('Enter'); await expect(editor()).toBeEditable(); await expect(page.locator('[data-topic-draft-conflict]')).toHaveCount(0); assert.equal((await content().inputValue()).includes('مسودة يجب تجاهلها'), false);
      await page.evaluate(() => localStorage.clear()); results.push({ width, mode, headers: 4, premiumIntegratedHeaders: true, rightGoldAccent: true, preservedIdentityAndDivider: true, switches: 7, displayColumns: displayGeometry.displayColumns, displayRowCounts: displayRows.map(y => displayCards.filter(card => card.y === y).length), excerptRows: geometry.excerpt.rows, excerptHeight: geometry.excerpt.h, counters: 6, viewport: 300, rightScrollbar: physicalScrollbar.rightGutter, leftScrollbar: physicalScrollbar.leftGutter, keyboard: true, keyboardCaretVisibility: keyboardPositions.map(position => ({ step: position.step, visible: position.caretVisible })), nativeKeyboardAncestorPositioning: nativeAncestorMovement(keyboardPositions), mouseWheel: true, selection: true, mixedArabicListAndLink: true, formatting: true, independentWheelScroll: true, draftRestoreAndConflict: true, draftNoticeDismissal: { key: mode.endsWith('edit') ? 'Space' : 'Enter', sharedOwner: true, contentFormDataStorageDirtyAndUrlPreserved: true, editorFocus: true } }); console.log('PASS Topic Content ' + mode + ' RTL ' + width);
    }
    if (!fieldsOnly && !reviewOnly && !seoOnly && !videoOnly && !mediaTabsOnly) {
    await open('default-rich'); const defaultEditor = page.getByRole('textbox', { name: 'المحرر الافتراضي', exact: true }); await expect(defaultEditor).toBeEditable(); await expect(page.getByText('المحرر الافتراضي', { exact: true })).toBeVisible(); assert.deepEqual(await page.locator('.admin-rich-text-editor').evaluate(element => ({ min: element.style.minHeight, max: element.style.maxHeight, overflow: element.style.overflowY })), { min: '220px', max: '', overflow: '' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1100 }); await open('default-bounded-rich'); await expect(defaultEditor).toBeEditable(); const unchanged = await scrollGeometry(); assert.equal(unchanged.viewportDirection, 'rtl'); assert.equal(unchanged.contentDirection, 'rtl'); assert.equal(unchanged.wrapperDirection, 'rtl'); assert.ok(unchanged.leftGutter > 0); assert.equal(unchanged.rightGutter, 0); assert.equal(unchanged.horizontalOverflow, false); assert.equal(unchanged.contentOverflow, false); assert.equal(unchanged.nested, 0); console.log('PASS default bounded Rich Text retains native left scrollbar RTL ' + width);
    }
    await open('default-display'); await expect(page.getByRole('switch')).toHaveCount(7); await expect(page.locator('[data-admin-form-switch-surface="premium-inline"]')).toHaveCount(0); await expect(page.locator('[data-admin-form-switch-surface="premium"]')).toHaveCount(0);
    await open('premium-display'); await expect(page.locator('[data-admin-form-switch-surface="premium"]')).toHaveCount(7); await expect(page.locator('[data-admin-form-switch-surface="premium-inline"]')).toHaveCount(0);
    }
    if (videoOnly) {
      await page.setViewportSize({ width: 1440, height: 1100 }); await open('media-edit'); await page.locator('[data-admin-tab-id="seo"]').click(); await expect(page.locator('[data-admin-entity-seo-panel]')).toHaveAttribute('data-admin-entity-seo-presentation', 'premium'); await expect(page.locator('[data-admin-tab-section-heading="seo"]')).toHaveCount(1); await page.locator('[data-admin-tab-id="publish"]').click(); await expect(page.locator('[data-admin-entity-review="content"]')).toHaveAttribute('data-admin-entity-review-presentation', 'dashboard');
      await open('edit'); await page.locator('[data-admin-tab-id="seo"]').click(); await expect(page.locator('[data-admin-entity-seo-panel]')).toHaveAttribute('data-admin-entity-seo-presentation', 'panel'); await page.locator('[data-admin-tab-id="publish"]').click(); await expect(page.locator('[data-admin-entity-review="content"]')).toHaveAttribute('data-admin-entity-review-presentation', 'panel'); console.log('PASS News omitted defaults and Article canonical reference preserved; no expanded Browser matrix');
    }
    const sourceFiles = ['src/components/admin/content/editors/ArticleCreateEditor.tsx', 'src/components/admin/content/editors/ArticleEditor.tsx', 'src/components/admin/content/editors/media/MediaContentForm.tsx', 'src/components/admin/content/editors/ContentBasicDataPanel.tsx', 'src/components/admin/ui/AdminFormRuntime.tsx', 'src/components/admin/ui/AdminForm.tsx', 'src/components/admin/content/editors/TopicContentTypeControl.tsx', 'src/components/admin/content/editors/ContentCategorySelect.tsx', 'src/components/admin/content/editors/article/TopicSeriesFields.tsx', 'src/components/admin/ui/AdminListboxSelect.tsx', 'src/components/admin/ui/AdminFormListboxSelect.tsx', 'src/lib/admin/admin-ui-styles.ts', 'src/app/globals.css', 'scripts/qa-home-story-presentation.mjs', ...(reviewOnly || videoTransport ? ['src/components/admin/ui/AdminModuleTabs.tsx', 'src/components/admin/ui/AdminCard.tsx', 'src/components/admin/review/AdminEntityReviewPanel.tsx', 'src/components/admin/content-workflow/ContentReviewPanel.tsx', 'src/components/admin/content/editors/ContentPublishingOptions.tsx', 'src/components/admin/content/editors/article/TopicDateLabelField.tsx', 'src/components/admin/content/editors/ContentEditorShell.tsx', 'src/lib/admin/content-workflow/content-review-capability.ts', 'src/lib/admin/review/entity-review-presentation.ts'] : [])];
    if (mediaFixture) sourceFiles.push('src/components/admin/SeoPanel.tsx', 'src/components/admin/seo/AdminEntitySeoPanel.tsx', 'src/components/admin/ui/AdminModuleTabs.tsx', 'src/components/admin/ui/AdminCard.tsx', 'src/components/admin/ui/AdminSingleOpenAccordion.tsx', 'src/components/admin/media/AdminMediaImageField.tsx', 'src/components/admin/media/AdminMediaPickerModal.tsx', 'src/components/admin/media/MediaLibraryCore.tsx', 'src/components/admin/media/AdminDeletedMediaNotice.tsx', 'src/lib/seo/entity-seo-types.ts');
    if (videoTransport) sourceFiles.push(
      'src/components/admin/media/AdminMediaGalleryField.tsx',
      'src/components/admin/content/editors/article/TopicImageField.tsx',
      'src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx',
      'src/components/admin/content/editors/media/MediaVideoFields.tsx',
      'src/components/admin/content/editors/content-form-definition.ts',
      'src/lib/admin/form-system/adoption-manifest.ts',
      'src/lib/admin/media-topic-payload.ts',
      'src/lib/admin/content-workflow/media-publish-validation.ts',
      'src/lib/content/public-content-read/owner.ts',
      'src/lib/media-center/types.ts',
      'src/lib/media-center/adapt-topic-row.ts',
      'src/components/media-center/MediaDetailArticle.tsx',
      'src/components/media-center/MediaVideoPlayback.tsx',
      'src/components/media-center/MediaDetailPage.tsx',
      'src/app/admin/content/topics/media-actions/helpers.ts',
      'src/app/admin/content/topics/media-actions/save.ts',
      'src/app/admin/content/topics/media-actions/validation.ts',
      'src/app/admin/content/topics/[id]/preview/page.tsx',
      'src/lib/seo/run-global-seo-health.ts',
      'scripts/verify-unified-content-editors-adoption.mts',
      'scripts/verify-admin-form-system.mts',
      'scripts/verify-public-media-truth.mts',
      'scripts/verify-public-media-truth-db.mjs',
      'scripts/verify-public-content-delivery.mts',
      'scripts/verify-content-publish-validation-truth.mts',
      'scripts/verify-seo-foundation.mts',
    );
    const sourceHashes = fieldsOnly || reviewOnly || mediaFixture ? Object.fromEntries(await Promise.all([...new Set(sourceFiles)].map(async file => [file, createHash('sha256').update(await readFile(path.join(fixtureRoot, file))).digest('hex')]))) : undefined;
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); console.log(JSON.stringify({ status: 'PASS', browser: 'Chrome ' + browser.version(), scope: mediaTabsOnly ? 'Actual Video/Gallery Create/Edit at1440/390 RTL: dedicated ordered tabs, cross-type absence, retained mounted native fields, dirty/close/pending/error-focus/success and isolated reload parity; existing gallery picker/alt/caption/reorder/replace/remove, Meta hide/remount lifecycle; finite media/SDK transports and in-memory save substitutions only, no screenshots or real writes' : videoOnly ? 'Actual Video Create/Edit panel only at Desktop/MobileRTL: two RTL columns, shared provider selection, six canonical provider bindings and honest embed/native/source preview modes, native video decode/start and12px labels, hidden historical duration preserved, existing thumbnail owner picker/preview/replace/remove, retained finalOG composition and natural media dimensions, Review score/issues/details/toggles/date/display navigation, dirty/pending/error/success in-memory saves; News omitted defaults and Article reference checked once, finite media reads only; no screenshots or real writes' : seoOnly ? 'Actual Article Create/Edit SEO panel only: shared RTL2:1 information/media composition, nine unique fields and12px labels, native values/navigation/dirty/pending/error/success memory save, existing real media picker/preview/replace/remove plus known/absent dimensions and empty/unavailable states; finite read responses only, no real writes' : reviewOnly ? 'Actual Article Create/Edit Review panel only: current RTL12headers/rows, summaries, production scores/issues, independent inline details, publication/date/featured/popular, read-onlyDisplay navigation and dirty/pending/error/success memory save; defaults verified separately by SSR' : fieldsOnly ? 'Actual Article/Media Create/Edit: three canonical aligned Field Containers, current Content outer-height/ratio/excerpt geometry, shared Listbox portals/keyboard/disabled/errors and retained single-form dirty/value/memory-save behavior; earlier unchanged RichText/Display/Draft proof reused separately' : 'Actual Article/Media Create/Edit Content and independent Display tabs: shared premium composition, retained single-form fields/navigation/dirty/validation/memory-save behavior, panel excerpt and draft-notice refinements, native right scrollbar and omitted defaults', sourceHashes, results, ...(mediaFixture ? { finiteMediaReads: seoReads } : {}), ...(videoTransport ? { finiteIframeReads: iframeReads } : {}), screenshots: 0, filesWritten: 0, serverStarted: false, persistenceTransportExecuted: false, globalClosed: false }));
  } catch (error) {
    if (fullFormDraftOnly) console.log('DRAFT_ORIGINAL_FAILURE ' + error.stack);
    throw error;
  } finally {
    try { await slugHarness?.close(); await browser.close(); } finally {
      if (unifiedImageOnly) { const end = await readUnifiedImageSourceHashes(); await recordUnifiedImageSourceIdentity(end); assert.deepEqual(end, unifiedImageSourceHashesAtStart, 'Unified Image sources changed after pre-webpack source capture'); }
      if (draftNoticeOnly) { const end = await readDraftNoticeSourceHashes(); await recordDraftNoticeSourceIdentity(end); assert.deepEqual(end, draftNoticeSourceHashesAtStart, 'Draft notice sources changed after pre-webpack source capture'); }
      if (contentPanelGalleryOnly) { const end = await readPanelGallerySourceHashes(); await recordPanelGallerySourceIdentity(end); assert.deepEqual(end, panelGallerySourceHashesAtStart, 'Panel/Gallery sources changed after pre-webpack source capture'); }
      if (fullFormDraftOnly) { const end = await readDraftSourceHashes(); await recordDraftSourceIdentity(end); assert.deepEqual(end, draftSourceHashesAtStart, "Draft owners changed after pre-webpack source capture"); }
      if (slugAuditOnly) { const end = await readSlugSourceHashes(); await recordSlugSourceIdentity(end); assert.deepEqual(end, slugSourceHashesAtStart, "Slug source identity changed during this run"); }
    }
  }
}

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
