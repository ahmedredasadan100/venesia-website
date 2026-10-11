import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Gallery from '../../src/components/admin/media/AdminMediaGalleryField';
import ImageField from '../../src/components/admin/media/AdminMediaImageField';
import TopicImage from '../../src/components/admin/content/editors/article/TopicImageField';
import {mediaContentSlot} from '../../src/lib/media-center/detail-page-config';
import {VENESIA_SCROLLBAR_VISUAL_CLASSES} from '../../src/components/venesia-scrollbar-styles';
const root=createRoot(document.getElementById('root'));
function RetainedFixture(){
 const [saved,setSaved]=React.useState(()=>JSON.parse(localStorage.getItem('retained-fixture')||'null')||{url:'/deleted.png',alt:'Retained alt',caption:'Retained caption'});
 const [revision,setRevision]=React.useState(0);
 return <form data-qa="retained" key={revision} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);localStorage.setItem('retained-fixture',JSON.stringify({url:data.get('retained_url'),alt:data.get('retained_alt'),caption:data.get('retained_caption')}));}}>
 <Gallery valueMode="items" label="Retained row" name="retained_url" altName="retained_alt" captionName="retained_caption" defaultItems={[saved]} />
 <button type="submit">Save fixture</button><button type="button" onClick={()=>{setSaved(JSON.parse(localStorage.getItem('retained-fixture')));setRevision(revision+1)}}>Reload fixture</button></form>;
}
function App(){const [variant,setVariant]=React.useState('image');return <main dir="rtl" className="mx-auto max-w-5xl space-y-8 bg-slate-950 p-5 text-white">
<section data-qa="topic"><TopicImage defaultImage="/original.png" defaultAlt={'وصف طويل للصورة\n'.repeat(60)}/></section>
<button onClick={()=>setVariant(variant==='image'?'galleryImage':'image')}>Change presentation</button>
<section data-qa="variant"><ImageField name="fixture" label="Owner change" defaultValue="/original.png" mediaSlot={mediaContentSlot(variant)}/></section>
<section data-qa="gallery"><Gallery label="معرض صور" name="fixture_gallery" defaultPaths={['/original.png','/wide.png','/unknown.png']} mediaSlot={mediaContentSlot('galleryImage')} density="compact"/></section>
<section data-qa="items"><Gallery label="معرض بيانات الصور" valueMode="items" name="gallery_image" altName="gallery_alt" captionName="gallery_caption" focusTargetId="gallery" altFocusTargetId="gallery-alt" defaultItems={[{url:'/original.png',alt:'وصف الأصل',caption:'تعليق محفوظ'}]} /></section>
<section data-qa="deleted-default"><ImageField name="deleted_default" label="Deleted default" defaultValue="/deleted.png" /></section>
<section data-qa="deleted-compact"><ImageField name="deleted_compact" label="Deleted compact" defaultValue="/deleted.png" variant="compact" /></section>
<section data-qa="missing"><ImageField name="missing" label="Missing" defaultValue="/missing.png" /></section>
<RetainedFixture/>
<section data-qa="compact-deleted"><Gallery label="Deleted compact gallery" name="compact_deleted" defaultPaths={["/deleted.png","/missing.png"]} density="compact" /></section>
<div data-qa="scrollbar-owner" className={`h-20 overflow-y-auto ${VENESIA_SCROLLBAR_VISUAL_CLASSES}`}><div className="h-96">Shared owner</div></div>
</main>};flushSync(()=>root.render(<App/>));window.guidanceFixtureReady=true;
