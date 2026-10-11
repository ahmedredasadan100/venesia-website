import React from 'react';
import AdminFormSwitch from '../../src/components/admin/ui/AdminFormSwitch';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Latest from '../../src/components/sidebar-feeds/SidebarLatestArticlesWidget';
import Popular from '../../src/components/sidebar-feeds/SidebarMostReadWidget';
import Series from '../../src/components/sidebar-feeds/SidebarSeriesWidget';
import TopicCard from '../../src/components/topics/TopicCard';
import FeaturedCard from '../../src/components/featured/FeaturedContentCard';
import {FeaturedEditorialSecondaryCard} from '../../src/components/featured/FeaturedCarousel';
import {CollectionListItem,CollectionGridItem} from '../../src/components/media-center/MediaCenterCollectionItems';
import FeaturedCollection from '../../src/components/media-center/MediaCenterHubFeaturedCollection';
import FeaturedHub,{FeaturedPrimaryCard} from '../../src/components/media-center/MediaCenterHubFeatured';
import {MosaicItem} from '../../src/components/media-center/MediaCenterHubMosaic';
import Timeline from '../../src/components/media-center/MediaCenterHubTimeline';
import MediaCard from '../../src/components/media-center/MediaContentCard';
import {SidebarMediaItem} from '../../src/components/media-center/MediaSidebar';
import Related from '../../src/components/media-center/RelatedMediaRail';
import {SearchResultCard} from '../../src/components/search-platform/SearchPlatformModule';
import {resolveCollectionModuleDisplayFormatting} from '../../src/lib/page-blocks/configs';
import {adaptPublicContentToMediaItem} from '../../src/lib/media-center/adapt-topic-row';
import {resolveMediaSidebarItems} from '../../src/lib/media-sidebar-modules/resolve-widget-items';

const root=createRoot(document.getElementById('root'));
const list={showDots:true,itemsPerGroup:3,intervalSeconds:8};
window.renderImageCases=(image,allowed=true)=>{
  window.fixtureImage=image;
  const display=resolveCollectionModuleDisplayFormatting({image:allowed});
  const item={id:1,slug:'fixture-article',href:'/topics/fixture-article',title:'مقال بلا صورة يدعم النص',excerpt:'النص الأصلي يظل ظاهرًا',image,imageAlt:'صورة اختبار',contentType:'news',category:'قسم',categorySlug:'category',series:'سلسلة',seriesSlug:'series',date:'11 أكتوبر',publishedAt:'2026-10-11',viewsCount:2,display:{title:true,image:allowed,excerpt:true,date:true,category:true,series:true},mediaKind:null,mediaProject:'',mediaDuration:'',isFeatured:false,isPopular:false};
  const media=adaptPublicContentToMediaItem(item);
  const presentation={title:'اختبار',eyebrow:null,description:'',ctaText:'المزيد',linkText:'المزيد',showTitle:true,showEyebrow:false,showDescription:false,showLink:true,collectionView:{layout:'grid',itemsPerRow:2},variant:'large-card'};
  const sidebar=resolveMediaSidebarItems([item],{limit:1,display,source:{kind:'media-center',contentType:'news'}})[0];
  const cases=[];const add=(name,node,policy='configurable')=>cases.push({name,node,policy});
  for(const layout of ['grid','list','slider']){
    add('latest-'+layout,<Latest title="Latest" items={[item]} showImage={allowed} presentationVariant={{layout,density:1,showDots:true,showArrows:true,list}}/>);
    add('series-'+layout,<Series title="Series" eyebrow="" linkText="المزيد" items={[{...item,subtitle:item.excerpt}]} showImage={allowed} presentationVariant={{layout,columns:1,showArrows:true,list}}/>);
  }
  for(const layout of ['grid','list'])add('popular-'+layout,<Popular title="Popular" items={[item]} showImage={allowed} presentationVariant={{layout,columns:1,list}}/>);
  add('topic-card',<TopicCard {...item} readingTime="" displayOverrides={display}/>);
  add('featured-card',<FeaturedCard item={item} display={display} displayFormatting={display} presentation={presentation}/>);
  add('featured-editorial',<FeaturedEditorialSecondaryCard item={item} display={display} displayFormatting={display}/>);
  for(const compact of [false,true]){
    add('media-list-'+compact,<CollectionListItem item={media} compact={compact} showDateWhenAvailable={false} displayOverrides={display}/>);
    add('media-grid-'+compact,<CollectionGridItem item={media} compact={compact} showDateWhenAvailable={false} displayOverrides={display}/>);
  }
  add('media-featured-collection',<FeaturedCollection items={[media]} presentation={presentation} display={display} href="/news"/>);
  add('media-featured-primary',<FeaturedPrimaryCard item={media} presentation={presentation} display={display} showDateWhenAvailable={false}/>);
  add('media-featured-secondary',<FeaturedHub items={[media,{...media,id:'2'}]} contentHierarchy={{mode:'featured',secondaryItemCount:1}} sliderEnabled presentation={presentation} display={display}/>);
  for(const primary of [true,false])add('media-mosaic-'+primary,<MosaicItem item={media} primary={primary} showDateWhenAvailable={false} display={display}/>);
  for(const layout of ['timeline','timeline-digest'])add('media-'+layout,<Timeline items={[media]} presentation={{...presentation,collectionView:{...presentation.collectionView,layout}}} display={display}/>);
  add('media-card',<MediaCard item={media} displayOverrides={display}/>);
  for(const layout of ['list','feature','compact'])add('media-sidebar-'+layout,<SidebarMediaItem item={sidebar} layout={layout}/>);
  add('related-media',<Related items={[media]} getHref={i=>'/news/'+i.slug}/>);
  for(const layout of ['full-list','full-grid'])add('search-'+layout,<SearchResultCard item={item} presentation={layout}/>,'always');
  window.imageCasePolicies=cases.map(({name,policy})=>({name,policy}));
  flushSync(()=>root.render(<main dir="rtl" className="space-y-6 bg-slate-950 p-5 text-white"><AdminFormSwitch label="Show image" checked={allowed} onChange={e=>window.renderImageCases(window.fixtureImage,e.currentTarget.checked)}/>{cases.map(c=><section key={c.name+'-'+String(image)+'-'+allowed} data-image-case={c.name} className="@container/slot-module mx-auto w-full max-w-3xl">{c.node}</section>)}</main>));
};
window.imageFixtureReady=true;
