import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SingleIntro from '../../src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor';
import FeaturedModule from '../../src/components/admin/page-blocks/FeaturedModuleEditClient';
import { createDefaultFeaturedModuleConfig, buildFeaturedModuleConfig } from '../../src/lib/featured-modules/config';
import ContentBasicDataPanel from '../../src/components/admin/content/editors/ContentBasicDataPanel';
import SeriesForm from '../../src/app/admin/content/series/SeriesForm';
import CategoryForm from '../../src/app/admin/content/categories/CategoryForm';
import AdminFormRuntime, { AdminFormGrid, AdminFormGridItem } from '../../src/components/admin/ui/AdminFormRuntime';
import AdminCard from '../../src/components/admin/ui/AdminCard';
import { AdminFormField, AdminFormSection } from '../../src/components/admin/ui/AdminForm';
import FeaturedProjects from '../../src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor';
import { asProjectsHubFeaturedConfig } from '../../src/lib/page-blocks/projects-hub-config';
import ContentModule from '../../src/components/admin/page-blocks/ContentModuleEditClient';
import Story from '../../src/components/admin/page-blocks/editors/AboutIntroModuleEditor';
import CtaModule from '../../src/components/admin/page-blocks/CtaModuleEditClient';
import CardsModule from '../../src/components/admin/page-blocks/CardsModuleEditClient';
import AboutCta from '../../src/components/admin/page-blocks/editors/AboutCtaModuleEditor';
import FooterSlots from '../../src/app/admin/pages-blocks/footer/FooterSlotConfigFields';
import FooterLinks from '../../src/app/admin/pages-blocks/footer/FooterLinksDataGrid';
import HeroCta from '../../src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields';
import Hero from '../../src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient';
import Breadcrumb from '../../src/components/admin/page-blocks/editors/BreadcrumbManualItemsField';
import MenuLink from '../../src/app/admin/pages-blocks/menus/MenuItemLinkSection';
import Field from '../../src/components/admin/ui/AdminLinkField';
import Action from '../../src/components/admin/ui/AdminActionButton';
import Gallery from '../../src/components/admin/media/AdminMediaGalleryField';
import ImageField from '../../src/components/admin/media/AdminMediaImageField';
import HomeProjects from '../../src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor';
import { asHomeProjectsConfig, asAboutIntroSingleImageConfig } from '../../src/lib/page-blocks/configs';
import { adminFormLabelClassName, adminFormFieldClassName, adminChoiceButtonClassName } from '../../src/lib/admin/admin-ui-styles';
import { parseAdminLinkFromFormData } from '../../src/lib/admin/links/form-fields';
import Feedback from '../../src/components/admin/AdminFeedbackProvider';
import { mediaContentSlot } from '../../src/lib/media-center/detail-page-config';
const link = { link_kind: 'internal', linked_type: 'pages', linked_id: 42, href: '/about', anchor: 'team', target: '_self' };
const initial = { button: { label: 'تعرف علينا', link, icon: 'arrow', alignment: 'right', iconPosition: 'left' }, images: { main: '/original.png', secondary: '/wide.png', mainAlt: 'الصورة الأولى', secondaryAlt: 'الصورة الثانية' } };
const initialCta = { primaryLabel: 'الرئيسي', primaryLink: link, secondaryLabel: 'الثانوي', secondaryLink: { link_kind: 'external', href: 'https://example.com/long/' + 'destination-segment/'.repeat(18), target: '_blank' }, showDefault: true, alignmentDefault: 'right', boldDefault: false };
const block = { id: 998, name: 'Fixture', slug: 'fixture', variant: 'band', style_preset: null, status: 'unpublished' };
const assignments = { assignments: [], pages: [] };
function forbidSave() { throw Error('No persistence transport permitted'); }
function PixelStoryFixture() {
    function localPendingSave(data) { window.pixelSubmitted=Object.fromEntries(data); return new Promise(resolve=>{window.finishPixelSave=resolve;}); }
    const config = { ...initial, button: { ...initial.button, label: 'عن فينيسيا للتطوير العقاري', alignment: 'left', iconPosition: 'right' } };
    return <main dir="rtl" className="text-white" style={{ marginLeft: 18, marginRight: 27 }} data-family="pixel-story"><ContentModule block={{ id: 25, name: 'قسم القصة', slug: 'home-story', description: '', variant: 'about-intro', style_preset: 'premium-dark', status: 'published', updated_at: 'fixture' }} config={config} assignmentContext={assignments} projectDetailHeroEditorLinks={null} topicCategoryOptions={[]} updateAction={localPendingSave}/></main>;
}

function SharedPresentationFixtures() {
    const spans = [[6,6],[4,8],[8,4],[3,9],[9,3],[4,4,4],[3,3,3,3],[12]];
    const cardVariants = [['implicit',{}],['default',{presentation:'default'}],['interactive',{interactive:true}],['premium',{presentation:'premium'}],['premium-interactive',{presentation:'premium',interactive:true}]];
    const field = name => <AdminFormField label="حقل مشترك" hint="مساعدة الحقل"><input name={name} defaultValue="نص عربي واضح" className={adminFormFieldClassName()}/></AdminFormField>;
    return <main dir="rtl" className="space-y-5 p-4 text-white" data-family="shared-presentation">
      {spans.map(parts=><section key={parts.join('-')} data-qa-grid-case={parts.join('-')}><AdminFormGrid columns={12}>{parts.map((span,i)=><AdminFormGridItem key={i} span={span}><AdminCard presentation="premium" className="p-3">{field('grid-'+parts.join('-')+'-'+i)}</AdminCard></AdminFormGridItem>)}</AdminFormGrid></section>)}
      <section data-qa-grid-case="6-6" data-qa-nested><AdminFormGrid columns={12}><AdminFormGridItem span={6}><section data-qa-grid-case="4-8"><AdminFormGrid columns={12}><AdminFormGridItem span={4}><AdminCard className="p-3">{field('nested-4')}</AdminCard></AdminFormGridItem><AdminFormGridItem span={8}><AdminCard className="p-3">{field('nested-8')}</AdminCard></AdminFormGridItem></AdminFormGrid></section></AdminFormGridItem><AdminFormGridItem span={6}><AdminCard className="p-3">{field('nested-6')}</AdminCard></AdminFormGridItem></AdminFormGrid></section>
      <div data-qa-choice-states className="flex flex-wrap gap-2">{['selected','unselected','disabled'].map(state=><button key={state} type="button" data-qa-choice={state} disabled={state==='disabled'} className={adminChoiceButtonClassName(state==='selected')} onClick={()=>{window.sharedChoiceClicked=state;}}>{state==='selected'?'مختار':state==='disabled'?'معطل':'متاح'}</button>)}</div>
      <AdminFormGrid columns={2}>{cardVariants.map(([key,props])=><div data-qa-card={key} key={key}><AdminCard {...props} className="p-4">{field('card-'+key)}</AdminCard></div>)}</AdminFormGrid>
      <AdminFormGrid columns={2}><div data-qa-section="implicit"><AdminFormSection title="عنوان مشترك" description="وصف القسم المشترك">{field('section-implicit')}</AdminFormSection></div><div data-qa-section="default"><AdminFormSection variant="default" density="default" title="عنوان مشترك" description="وصف القسم المشترك">{field('section-default')}</AdminFormSection></div></AdminFormGrid>
    </main>;
}

function ConsistencyFixtures() {
    const createTaxonomy = new URLSearchParams(location.search).get('taxonomy') === 'create';
    const [revision, setRevision] = useState(0);
    const [featured, setFeatured] = useState(() => ({ ...createDefaultFeaturedModuleConfig('market', 'three-cards'), presentation: { ...createDefaultFeaturedModuleConfig('market', 'three-cards').presentation, eyebrow: 'اختياراتنا', title: 'موضوعات مميزة', description: 'اكتشف أحدث الموضوعات' } }));
    const [button, setButton] = useState(initial);
    const categories = [{ id: 17, name: 'السوق العقاري', slug: 'market', depth: 0, is_active: true, status: 'published' }, { id: 18, name: 'نصائح عقارية', slug: 'tips', depth: 0, is_active: true, status: 'published' }];
    const series = [{ id: 187, name: 'السلسلة الأولى', slug: 'first', category_id: 17 }, { id: 188, name: 'سلسلة النصائح', slug: 'second', category_id: 18 }];
    const options = categories.map(c => ({ value: String(c.id), label: c.name }));
    async function saveFeatured(data) { window.consistencyFeatured = Object.fromEntries(data); localStorage.setItem('consistency-featured', JSON.stringify(buildFeaturedModuleConfig(data))); }
    async function saveTopic(previous, data) { window.consistencyTopic = Object.fromEntries(data); return { ...previous, status: 'error', revision: previous.revision + 1, title: 'رفض محلي معزول', message: 'لم يتم إرسال أي بيانات إلى الخادم', fieldErrors: { title: ['فشل حفظ تجريبي'] } }; }
    function saveButton(event) { event.preventDefault(); const data = new FormData(event.currentTarget), fields = Object.fromEntries(data); window.consistencyButton = fields; localStorage.setItem('consistency-button', JSON.stringify({ ...button, button: { ...button.button, label: fields.button_label, alignment: fields.button_alignment, icon: fields.button_icon, iconPosition: fields.button_icon_position, target: fields.button_open_target, link: parseAdminLinkFromFormData(data, 'button') } })); }
    return <main dir="rtl" className="mx-auto max-w-6xl space-y-8 bg-slate-950 p-4 text-white">
      <section data-family="consistency-featured" key={'featured-' + revision}><FeaturedModule block={{ ...block, description: '' }} config={featured} editorOptions={{ categories: [{ id: 17, name: 'السوق العقاري', slug: 'market', scopeSlugs: ['market'] }], items: [] }} assignmentContext={assignments} updateAction={saveFeatured}/><button type="button" onClick={() => { setFeatured(JSON.parse(localStorage.getItem('consistency-featured'))); setRevision(v => v + 1); }}>Reload Featured local</button></section>
      <form data-family="consistency-button" key={'button-' + revision} onSubmit={saveButton}><Story editorMode="home-story" section="cta" config={button}/><button type="submit">Save Button local</button><button type="button" onClick={() => { setButton(JSON.parse(localStorage.getItem('consistency-button'))); setRevision(v => v + 1); }}>Reload Button local</button></form>
      {['edit', 'create'].map(mode => <section data-family={'consistency-topic-' + mode} key={mode + revision}><AdminFormRuntime action={saveTopic} mode={mode} closeHref="/admin/content/topics" formId={'consistency-topic-' + mode}><ContentBasicDataPanel formId={'consistency-topic-' + mode} mode={mode} contentType="article" categories={categories} series={series} values={mode === 'edit' ? { title: 'موضوع الاختبار', slug: 'fixture-topic', categoryId: 17, seriesId: 187 } : undefined} contentEditor={null}/><button type="submit">Reject Topic local</button></AdminFormRuntime></section>)}
      <section data-family="consistency-series"><SeriesForm mode={createTaxonomy ? "create" : "edit"} series={createTaxonomy ? undefined : { id: 187, name: 'السلسلة الأولى', slug: 'first', category_id: 17, status: 'published', updated_at: '2026-10-16T00:00:00Z' }} categoryOptions={options}/></section>
      <section data-family="consistency-existing-aligned"><FeaturedProjects config={{ selectionMode: "latest_published", limit: 6, autoplayMs: 5000 }}/></section>
      <section data-family="consistency-category"><CategoryForm mode={createTaxonomy ? "create" : "edit"} category={createTaxonomy ? undefined : { id: 17, name: 'السوق العقاري', slug: 'market', parent_id: null, status: 'published', color_token: 'gold', updated_at: '2026-10-16T00:00:00Z' }} parentOptions={options.slice(1)}/></section>
    </main>;
}

function FinalVisualFixtures() {
    const [revision, setRevision] = useState(0);
    const [reject, setReject] = useState(true);
    const [status, setStatus] = useState('');
    const [single, setSingle] = useState({ images: { main: '/original.png', mainAlt: 'وصف الصورة' }, imagePosition: 'left', beats: [{ num: '01', title: 'عنوان', text: 'وصف البطاقة' }] });
    const [featured, setFeatured] = useState(asProjectsHubFeaturedConfig({ limit: 6, autoplayMs: 6000 }));
    const [gallery, setGallery] = useState([{ url: '/original.png', alt: 'بديل أول', caption: 'تعليق أول' }, { url: '/wide.png', alt: 'بديل ثان', caption: 'تعليق ثان' }]);
    function save(kind, event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget), fields = Object.fromEntries(data);
        window.finalVisualFields = { ...(window.finalVisualFields || {}), [kind]: fields };
        if (reject) { setStatus('rejected-' + kind); return; }
        const parsed = kind === 'single' ? asAboutIntroSingleImageConfig({ ...fields, beats: [0, 1, 2].map(i => ({ num: data.get('beat_' + i + '_num'), title: data.get('beat_' + i + '_title'), text: data.get('beat_' + i + '_text') })) })
            : kind === 'featured' ? asProjectsHubFeaturedConfig({ ...fields, selectionMode: data.get('selection_mode'), autoplayMs: Number(data.get('autoplay_ms')) })
            : data.getAll('visual_url').map((url, i) => ({ url, alt: data.getAll('visual_alt')[i], caption: data.getAll('visual_caption')[i] }));
        localStorage.setItem('final-visual-' + kind, JSON.stringify(parsed));
        setStatus('saved-' + kind);
    }
    function reload(kind) { const parsed = JSON.parse(localStorage.getItem('final-visual-' + kind)); ({ single: setSingle, featured: setFeatured, gallery: setGallery })[kind](parsed); setRevision(v => v + 1); }
    return <section data-family="final-visual-fixtures" className="space-y-8">
      <button type="button" onClick={() => setReject(false)}>Allow local save</button><button type="button" onClick={() => setReject(true)}>Reject local save</button><output data-visual-save-status>{status}</output>
      <form data-family="image-position" key={'position-' + revision} onSubmit={e => save('single', e)}><SingleIntro config={single}/><button type="submit">Save single</button><button type="button" onClick={() => reload('single')}>Reload single</button></form>
      <form data-family="featured-projects" key={'featured-' + revision} onSubmit={e => save('featured', e)}><FeaturedProjects config={featured}/><button type="submit">Save featured</button><button type="button" onClick={() => reload('featured')}>Reload featured</button></form>
      <form data-family="gallery-fields" key={'gallery-' + revision} onSubmit={e => save('gallery', e)}><Gallery valueMode="items" name="visual_url" altName="visual_alt" captionName="visual_caption" focusTargetId="visual_url" altFocusTargetId="visual_alt" label="معرض الاختبار" defaultItems={gallery}/><button type="submit">Save gallery</button><button type="button" onClick={() => reload('gallery')}>Reload gallery</button></form>
      <section data-family="gallery-failure"><Gallery valueMode="items" name="failed_url" altName="failed_alt" captionName="failed_caption" focusTargetId="failed_url" altFocusTargetId="failed_alt" label="مرجع غير متاح" defaultItems={[{ url: '/missing.png', alt: 'وصف محفوظ', caption: 'تعليق محفوظ' }]}/></section>
      <section data-family="intro-textareas"><Story config={{ ...initial, beats: [{ num: '01', title: 'عنوان البطاقة', text: 'وصف البطاقة' }] }}/></section>
    </section>;
}

function App() {
    const [story, setStory] = useState(() => JSON.parse(localStorage.getItem('story') || 'null') || initial);
    const [revision, setRevision] = useState(0);
    const [footer, setFooter] = useState(link);
    const [footerText, setFooterText] = useState({ type: 'text', config: { title: 'نص Footer', body: '', showBrandIcon: false, cta: { enabled: true, label: 'اعرف المزيد', link, target: '_self' } } });
    const [footerMedia, setFooterMedia] = useState({ type: 'media', config: { source: 'main_submenu', parentLink: link, parentHref: '', menuId: null, manualLinks: [], maxItems: 5 } });
    const [footerLinks, setFooterLinks] = useState([{ label: 'من نحن', link, href: '/about', target: '_self', visible: true, sortOrder: 0 }]);
    const [cta, setCta] = useState(initialCta);
    const [ctaRevision, setCtaRevision] = useState(0);
    const [home, setHome] = useState({ projectsLimit: 6, cardCtaLabel: 'استكشف المشروع', cardCtaAlignment: 'right', footerCta: { label: 'كل المشاريع', link } });
    const [homeRevision, setHomeRevision] = useState(0);
    function saveHome(event) { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); window.homeSaved = fields; localStorage.setItem('home-projects', JSON.stringify(asHomeProjectsConfig(fields))); }
    function save(e) { e.preventDefault(); const d = new FormData(e.currentTarget); const config = { ...story, button: { ...story.button, label: d.get('button_label'), alignment: d.get('button_alignment'), icon: d.get('button_icon'), iconPosition: d.get('button_icon_position'), target: d.get('button_open_target'), link: parseAdminLinkFromFormData(d, 'button') }, images: { main: d.get('image_main'), secondary: d.get('image_secondary'), mainAlt: d.get('image_main_alt'), secondaryAlt: d.get('image_secondary_alt') } }; localStorage.setItem('story', JSON.stringify(config)); window.layoutSaved = Object.fromEntries(d); }
    function saveCta(e) { e.preventDefault(); const data = new FormData(e.currentTarget); const config = { primaryLabel: data.get('primary_cta_label'), secondaryLabel: data.get('secondary_cta_label'), primaryLink: parseAdminLinkFromFormData(data, 'primary_cta'), secondaryLink: parseAdminLinkFromFormData(data, 'secondary_cta'), showDefault: data.get('show_cta') === 'true', alignmentDefault: data.get('cta_alignment'), boldDefault: data.get('cta_bold') === 'true' }; localStorage.setItem('hero-cta', JSON.stringify(config)); window.ctaSaved = { config, fields: Object.fromEntries(data) }; }
    return <main dir="rtl" className="mx-auto max-w-6xl space-y-8 bg-slate-950 p-4 text-white">
 <form data-family="home-projects" key={`home-projects-${homeRevision}`} onSubmit={saveHome}><HomeProjects config={home}/><button type="submit">Save Home fixture</button><button type="button" onClick={() => { setHome(JSON.parse(localStorage.getItem('home-projects'))); setHomeRevision(value => value + 1); }}>Reload Home fixture</button></form>
 <section data-family="shared-labels"><label className={adminFormLabelClassName()}><span>اسم الحقل المشترك</span><input name="shared_label" className={adminFormFieldClassName()}/><span>مساعدة الحقل</span></label></section>
 <section data-family="media-states" className="grid gap-4 md:grid-cols-3">{[['existing', '/original.png'], ['deleted', '/deleted.png'], ['missing', '/missing.png'], ['unavailable', '/unavailable.png'], ['empty', '']].map(([state, value]) => <ImageField key={state} name={`state_${state}`} label={`صورة ${state}`} defaultValue={value} altName={`state_${state}_alt`} altLabel="النص البديل للصورة — اختياري" defaultAlt="وصف محفوظ"/>)}<ImageField variant="compact" appearance="light" name="compact_alt" label="صورة صغيرة" defaultValue="/original.png" altName="compact_alt_text"/></section>
 <form data-family="story" key={`story-${revision}`} onSubmit={save}><Story editorMode="home-story" config={story}/><button type="submit">Save story</button><button type="button" onClick={() => { setStory(JSON.parse(localStorage.getItem('story'))); setRevision(x => x + 1); }}>Reload story</button></form>
 <section data-family="about"><Story config={initial} section="images"/></section>
 <form data-family="hero-cta" key={`hero-cta-${ctaRevision}`} onSubmit={saveCta}><HeroCta {...cta}/><button type="submit">Save CTA fixture</button><button type="button" onClick={() => { setCta(JSON.parse(localStorage.getItem('hero-cta'))); setCtaRevision(value => value + 1); }}>Reload CTA fixture</button></form>
 <form data-family="hero-domain"><HeroCta linkSource="project-domain" primaryLabel="تفاصيل المشروع"/></form>
 <section data-family="empty-link"><Field prefix="empty" label="رابط فارغ" showAnchor/></section>
 <fieldset data-family="disabled-link" disabled><Field prefix="disabled" label="رابط معطل" defaultValue={link} showAnchor/></fieldset>
 <section data-family="default-actions"><Action>إجراء نصي عادي</Action><Action disabled>إجراء نصي معطل</Action></section>
 <form data-family="breadcrumb"><Breadcrumb items={[{ label: 'من نحن', link }]}/></form>
 <form data-family="menu"><MenuLink item={{ item_type: 'link', link_kind: 'internal', linked_type: 'pages', linked_id: 42, href: '/about', target: '_self' }}/></form>
 <section data-family="footer"><Field prefix="footer" label="رابط Footer" controlledValue={footer} onControlledChange={setFooter} showAnchor/><output className="block break-all">{JSON.stringify(footer)}</output></section>
 <section data-family="cta-module"><CtaModule block={block} config={{ primaryCta: { label: 'الرئيسي', link }, secondaryCta: { label: 'الثانوي', link: initialCta.secondaryLink } }} assignmentContext={assignments} updateAction={forbidSave}/></section>
 <section data-family="cards-module"><CardsModule block={{ ...block, variant: 'glass' }} config={{ items: [{ title: 'كارت', link }] }} assignmentContext={assignments} updateAction={forbidSave}/></section>
 {['about-cta', 'home-contact'].map(mode => <React.Fragment key={mode}><section data-family={mode}><AboutCta editorMode={mode} section="cta" config={{ button: { label: 'تواصل معنا', link } }}/></section><section data-family={mode + '-contacts'}><AboutCta editorMode={mode} section="contacts" config={{ contacts: [{ label: 'رابط التواصل', value: 'من نحن', link }] }}/></section></React.Fragment>)}
 <section data-family="footer-text"><FooterSlots slot={footerText} onChange={setFooterText} footerMenuId={null} quickLinks={[]} menuOptions={[]}/></section>
 <section data-family="footer-media"><FooterSlots slot={footerMedia} onChange={setFooterMedia} footerMenuId={null} quickLinks={[]} menuOptions={[]}/></section>
 <section data-family="footer-links"><FooterLinks links={footerLinks} onChange={setFooterLinks}/></section>
 <section data-family="gallery"><Gallery valueMode="items" label="معرض الصور" name="image" altName="alt" captionName="caption" defaultItems={[{ url: '/original.png', alt: 'بديل', caption: 'تعليق' }, { url: '/wide.png', alt: 'عرض', caption: 'وصف' }]} mediaSlot={mediaContentSlot('galleryImage')}/></section>
 <section data-family="compact-gallery"><Gallery density="compact" label="صور Hero/Tracking" name="images" defaultPaths={['/original.png', '/wide.png']}/></section>
 <section data-family="single"><ImageField name="single" label="صورة المحتوى" defaultValue="/original.png" altName="single_alt" defaultAlt="وصف" mediaSlot={mediaContentSlot('image')}/></section>
 <section data-family="hero"><Hero hero={{ id: 999, name: 'Fixture', slug: 'fixture', description: null, variant: 'home-cinematic', style_preset: null, updated_at: 'fixture', status: 'published' }} config={{ image_composition: 'center' }} imagesText="/original.png" mobileImagesText="/wide.png" variantOptions={[{ value: 'home-cinematic', label: 'Home' }]} assignmentContext={{ assignments: [{ is_visible: true, page_path: "/preview-hero" }], pages: [] }} initialTabId="media"/></section>
 <FinalVisualFixtures/>
 </main>;
}
createRoot(document.getElementById('root')).render(<Feedback>{new URLSearchParams(location.search).get('scope') === 'shared-presentation' ? <SharedPresentationFixtures/> : new URLSearchParams(location.search).get('scope') === 'pixel' ? <PixelStoryFixture/> : new URLSearchParams(location.search).get('scope') === 'consistency' ? <ConsistencyFixtures/> : <App/>}</Feedback>);
