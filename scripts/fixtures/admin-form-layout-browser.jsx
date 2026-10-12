import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Story from '../../src/components/admin/page-blocks/editors/AboutIntroModuleEditor';
import HeroCta from '../../src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields';
import Hero from '../../src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient';
import Breadcrumb from '../../src/components/admin/page-blocks/editors/BreadcrumbManualItemsField';
import MenuLink from '../../src/app/admin/pages-blocks/menus/MenuItemLinkSection';
import Field from '../../src/components/admin/ui/AdminLinkField';
import Gallery from '../../src/components/admin/media/AdminMediaGalleryField';
import ImageField from '../../src/components/admin/media/AdminMediaImageField';
import { parseAdminLinkFromFormData } from '../../src/lib/admin/links/form-fields';
import Feedback from '../../src/components/admin/AdminFeedbackProvider';
import { mediaContentSlot } from '../../src/lib/media-center/detail-page-config';
const link = { link_kind: 'internal', linked_type: 'pages', linked_id: 42, href: '/about', anchor: 'team', target: '_self' };
const initial = { button: { label: 'تعرف علينا', link, icon: 'arrow', alignment: 'right', iconPosition: 'left' }, images: { main: '/original.png', secondary: '/wide.png', mainAlt: 'الصورة الأولى', secondaryAlt: 'الصورة الثانية' } };
function App() {
    const [story, setStory] = useState(() => JSON.parse(localStorage.getItem('story') || 'null') || initial);
    const [revision, setRevision] = useState(0);
    const [footer, setFooter] = useState(link);
    function save(e) { e.preventDefault(); const d = new FormData(e.currentTarget); const config = { ...story, button: { ...story.button, label: d.get('button_label'), alignment: d.get('button_alignment'), icon: d.get('button_icon'), iconPosition: d.get('button_icon_position'), target: d.get('button_open_target'), link: parseAdminLinkFromFormData(d, 'button') }, images: { main: d.get('image_main'), secondary: d.get('image_secondary'), mainAlt: d.get('image_main_alt'), secondaryAlt: d.get('image_secondary_alt') } }; localStorage.setItem('story', JSON.stringify(config)); window.layoutSaved = Object.fromEntries(d); }
    return <main dir="rtl" className="mx-auto max-w-6xl space-y-8 bg-slate-950 p-4 text-white">
 <form data-family="story" key={revision} onSubmit={save}><Story editorMode="home-story" config={story}/><button type="submit">Save story</button><button type="button" onClick={() => { setStory(JSON.parse(localStorage.getItem('story'))); setRevision(x => x + 1); }}>Reload story</button></form>
 <section data-family="about"><Story config={initial} section="images"/></section>
 <form data-family="hero-cta"><HeroCta primaryLabel="الرئيسي" primaryLink={link} secondaryLabel="الثانوي" secondaryLink={{ link_kind: 'external', href: 'https://example.com/long/path', target: '_blank' }}/></form>
 <form data-family="breadcrumb"><Breadcrumb items={[{ label: 'من نحن', link }]}/></form>
 <form data-family="menu"><MenuLink item={{ item_type: 'link', link_kind: 'internal', linked_type: 'pages', linked_id: 42, href: '/about', target: '_self' }}/></form>
 <section data-family="footer"><Field prefix="footer" label="رابط Footer" controlledValue={footer} onControlledChange={setFooter} showAnchor/><output className="block break-all">{JSON.stringify(footer)}</output></section>
 <section data-family="gallery"><Gallery valueMode="items" label="معرض الصور" name="image" altName="alt" captionName="caption" defaultItems={[{ url: '/original.png', alt: 'بديل', caption: 'تعليق' }, { url: '/wide.png', alt: 'عرض', caption: 'وصف' }]} mediaSlot={mediaContentSlot('galleryImage')}/></section>
 <section data-family="compact-gallery"><Gallery density="compact" label="صور Hero/Tracking" name="images" defaultPaths={['/original.png', '/wide.png']}/></section>
 <section data-family="single"><ImageField name="single" label="صورة المحتوى" defaultValue="/original.png" altName="single_alt" defaultAlt="وصف" mediaSlot={mediaContentSlot('image')}/></section>
 <section data-family="hero"><Hero hero={{ id: 999, name: 'Fixture', slug: 'fixture', description: null, variant: 'home-cinematic', style_preset: null, updated_at: 'fixture', status: 'published' }} config={{ image_composition: 'center' }} imagesText="/original.png" mobileImagesText="/wide.png" variantOptions={[{ value: 'home-cinematic', label: 'Home' }]} assignmentContext={{ assignments: [{ is_visible: true, page_path: "/preview-hero" }], pages: [] }} initialTabId="media"/></section>
 </main>;
}
createRoot(document.getElementById('root')).render(<Feedback><App /></Feedback>);
