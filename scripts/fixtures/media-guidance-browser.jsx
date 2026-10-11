import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Gallery from '../../src/components/admin/media/AdminMediaGalleryField';
import ImageField from '../../src/components/admin/media/AdminMediaImageField';
import TopicImage from '../../src/components/admin/content/editors/article/TopicImageField';
import {mediaContentSlot} from '../../src/lib/media-center/detail-page-config';
import {VENESIA_SCROLLBAR_VISUAL_CLASSES} from '../../src/components/venesia-scrollbar-styles';
const root=createRoot(document.getElementById('root'));
function App(){const [variant,setVariant]=React.useState('image');return <main dir="rtl" className="mx-auto max-w-5xl space-y-8 bg-slate-950 p-5 text-white">
<section data-qa="topic"><TopicImage defaultImage="/original.png" defaultAlt={'وصف طويل للصورة\n'.repeat(60)}/></section>
<button onClick={()=>setVariant(variant==='image'?'galleryImage':'image')}>Change presentation</button>
<section data-qa="variant"><ImageField name="fixture" label="Owner change" defaultValue="/original.png" mediaSlot={mediaContentSlot(variant)}/></section>
<section data-qa="gallery"><Gallery label="معرض صور" name="fixture_gallery" defaultPaths={['/original.png','/wide.png','/unknown.png']} mediaSlot={mediaContentSlot('galleryImage')} density="compact"/></section>
<section data-qa="items"><Gallery label="معرض بيانات الصور" valueMode="items" name="gallery_image" altName="gallery_alt" captionName="gallery_caption" focusTargetId="gallery" altFocusTargetId="gallery-alt" defaultItems={[{url:'/original.png',alt:'وصف الأصل',caption:'تعليق محفوظ'}]} /></section>
<div data-qa="scrollbar-owner" className={`h-20 overflow-y-auto ${VENESIA_SCROLLBAR_VISUAL_CLASSES}`}><div className="h-96">Shared owner</div></div>
</main>};flushSync(()=>root.render(<App/>));window.guidanceFixtureReady=true;
