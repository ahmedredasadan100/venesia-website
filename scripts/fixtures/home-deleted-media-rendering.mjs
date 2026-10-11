import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

export function verifyHomeDeletedMediaRendering(){
 const root=process.cwd(),native=createRequire(path.join(root,'package.json')),cache=new Map();
 function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const source=readFileSync(file,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const req=key=>{if(key==='server-only')return {};if(!key.startsWith('.'))return native(key);const base=path.resolve(path.dirname(file),key),p=[base,base+'.ts',base+'.tsx',base+'.js',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>existsSync(p)&&/\.(tsx?|js)$/.test(p));if(!p)throw Error('Missing fixture dependency: '+base);return load(p);};Function('require','module','exports',js)(req,m,m.exports);return m.exports;}
 const {mapPageBlockImageSources,asAboutIntroConfig,asAboutCtaConfig}=load('src/lib/page-blocks/configs.ts');
 const {mapHomeStoryBlock}=load('src/components/home/home-cms-mappers.ts');
 const {mapHomeContactBlock}=load('src/components/home/home-contact-mappers.ts');
 const Story=load('src/components/home/HomeStorySection.tsx').default,Contact=load('src/components/home/HomeContactSection.tsx').default;
 const image='/fixture-home.png';
 const story={template:{config:asAboutIntroConfig({title:'Story title',body:'Preserved story body',images:{main:image,secondary:image},button:{label:'Story CTA',href:'/about'}})}};
 const contact={template:{config:asAboutCtaConfig({title:'Contact title',description:'Preserved contact body',image,button:{label:'Contact CTA',href:'/contact'},contacts:[{icon:'phone',label:'Phone',value:'123'}]})}};
 const cases=[];let geometry;const geometryCases=[];
 for(const spec of [{name:'valid',main:image,secondary:image},{name:'deleted-main',main:'',secondary:image},{name:'deleted-secondary',main:image,secondary:''},{name:'deleted-all',main:'',secondary:''},{name:'whitespace',main:' ',secondary:' '}]){
 const config={...story.template.config,images:{main:spec.main,secondary:spec.secondary}};const html=renderToStaticMarkup(React.createElement(Story,{content:mapHomeStoryBlock({template:{config}})}));assert(html.includes('Story title')&&html.includes('Preserved story body')&&html.includes('Story CTA'),spec.name+' must retain content');const count=(html.match(/<img\b/g)||[]).length;assert.equal(count,Number(!!spec.main.trim())+Number(!!spec.secondary.trim()),spec.name);assert(!/src="\s*"/.test(html));const frames=[...html.matchAll(/class="(home-story-frame group[^"]*)"/g)].map(m=>m[1]);assert.equal(frames.length,2);if(geometry)assert.deepEqual(frames,geometry);else geometry=frames;cases.push({name:spec.name,images:count});if(spec.name==='valid'||spec.name==='deleted-all')geometryCases.push({name:'story-'+spec.name,html});
 }
 const original=JSON.stringify(contact);const projected={template:{config:mapPageBlockImageSources(contact.template.config,()=> '')}};
 for(const [name,block,count] of [['valid',contact,2],['deleted',projected,0]]){const html=renderToStaticMarkup(React.createElement(Contact,{content:mapHomeContactBlock(block)}));assert(html.includes('Contact title')&&html.includes('Preserved contact body')&&html.includes('Contact CTA')&&html.includes('Phone'));assert.equal((html.match(/<img\b/g)||[]).length,count);assert(!/src="\s*"/.test(html));cases.push({name:'contact-'+name,images:count});geometryCases.push({name:'contact-'+name,html});}
 assert.equal(JSON.stringify(contact),original,'Projection must preserve stored config');

 const {buildSlotRenderPlan}=load('src/components/page-composition/build-slot-render-plan.ts');
 const {VENISIA_THEME_MODULE_PRESENTATION}=load('src/components/page-composition/slot-module-nodes.tsx');
 const {isPageModulePubliclyVisible}=load('src/lib/page-blocks/admin-utils.ts');
 const records=[{id:25,slug:'home-story',config:story.template.config,order:10},{id:28,slug:'home-projects',config:{title:'Projects title'},order:20},{id:26,slug:'home-trust',config:{title:'Trust title',items:[{title:'Trust item',description:'Trust body'}]},order:30},{id:27,slug:'home-contact',config:contact.template.config,order:40}];
 const entries=records.map(row=>({kind:'block',assignmentId:row.id,sortOrder:row.order,block:{assignmentId:row.id,templateId:row.id,blockType:'content',slot:'main',sortOrder:row.order,isVisible:true,template:{id:row.id,slug:row.slug,variant:row.slug,status:'published',config:mapPageBlockImageSources(row.config,()=> '')}}}));
 const projects=[{id:1,slug:'fixture',code:'F',englishName:'Project',shortDescription:'Project body',location:{label:'Location'},cardImage:{src:image,alt:'Project'}}];
 const plan=buildSlotRenderPlan([...entries].reverse(),{homepageProjects:projects},VENISIA_THEME_MODULE_PRESENTATION);
 assert.deepEqual(plan.map(p=>p.assignmentId),[25,28,26,27]);
 const noImageProjects=projects.map(p=>({...p,cardImage:{...p.cardImage,src:""}}));
 const noImagePlan=buildSlotRenderPlan(entries,{homepageProjects:noImageProjects},VENISIA_THEME_MODULE_PRESENTATION);
 const projectValid=renderToStaticMarkup(plan.find(p=>p.assignmentId===28).node);
 const projectEmpty=renderToStaticMarkup(noImagePlan.find(p=>p.assignmentId===28).node);
 assert(projectEmpty.includes('Project body'));assert.equal((projectEmpty.match(/<img\b/g)||[]).length,0);
 assert.equal((projectValid.match(/home-project-card group/g)||[]).length,(projectEmpty.match(/home-project-card group/g)||[]).length);
 assert(!/src="\s*"/.test(projectEmpty));

 for(const item of plan){const html=renderToStaticMarkup(item.node);assert(html.includes('<section'),item.key+' must render an actual section');}
 assert.equal(new Set(plan.map(p=>p.assignmentId)).size,4);
 assert.equal(isPageModulePubliclyVisible(false,'published'),false);assert.equal(isPageModulePubliclyVisible(true,'draft'),false);
 const visibleEntries=entries.filter(e=>isPageModulePubliclyVisible(e.block.isVisible,e.block.template.status));
 assert.equal(buildSlotRenderPlan(visibleEntries,{homepageProjects:projects},VENISIA_THEME_MODULE_PRESENTATION).length,4);

 // A zero-result collection does not own the independently authored shell.
 const zeroProjectPlan=buildSlotRenderPlan(entries,{homepageProjects:[]},VENISIA_THEME_MODULE_PRESENTATION);
 assert.deepEqual(zeroProjectPlan.map(p=>p.assignmentId),[25,28,26,27]);
 const zeroProjectHtml=renderToStaticMarkup(zeroProjectPlan.find(p=>p.assignmentId===28).node);
 assert(zeroProjectHtml.includes('Projects title'));assert(!zeroProjectHtml.includes('<img'));assert(!zeroProjectHtml.includes('home-project-card group'));
 const {parseMediaHubModuleConfig}=load('src/lib/media-hub-modules/parse-config.ts');
 const {MEDIA_HUB_COLLECTION_CAPABILITIES}=load('src/lib/media-hub-modules/presentation-contract.ts');
 const {isMediaHubModuleRenderable,renderMediaHubSection}=load('src/components/media-center/renderMediaHubSections.tsx');
 let emptyLayouts=0;
 for(const [sectionKey,capability] of Object.entries(MEDIA_HUB_COLLECTION_CAPABILITIES)){
  for(const layout of capability.view.layouts){
   const config=parseMediaHubModuleConfig({source:'topics',placement:'hub',contentHierarchy:{mode:capability.view.variants[layout].contentHierarchyMode},presentation:{title:'Retained title',description:'Retained description',ctaText:'Retained CTA',collectionView:{layout}}},sectionKey);
   assert.equal(config.presentation.collectionView.layout,layout);
   const hubModule={assignmentId:101,sortOrder:10,slot:'main',isVisible:true,sectionKey,config,sectionData:{kind:sectionKey,items:[]}};
   assert(isMediaHubModuleRenderable(hubModule),sectionKey+'/'+layout);
   assert.equal(buildSlotRenderPlan([{kind:'media-hub',assignmentId:101,sortOrder:10,module:hubModule}],{},VENISIA_THEME_MODULE_PRESENTATION).length,1);
   const html=renderToStaticMarkup(renderMediaHubSection(hubModule));
   assert(html.includes('Retained title')&&html.includes('Retained description')&&html.includes('Retained CTA'),sectionKey+'/'+layout);
   assert(!html.includes('<img')&&!html.includes('<article'),'No phantom items');
   const hidden={...hubModule,isVisible:false};assert.equal(isMediaHubModuleRenderable(hidden),false);assert.equal(renderMediaHubSection(hidden),null);
   assert.equal(buildSlotRenderPlan([{kind:'media-hub',assignmentId:101,sortOrder:10,module:hidden}],{},VENISIA_THEME_MODULE_PRESENTATION).length,0);
   emptyLayouts++;
  }
 }
 const Feed=load('src/components/feed-modules/FeedModuleSection.tsx');
 const feed={presentation:{emptyBehavior:'hide',title:'Feed title'},payload:{kind:'articles',items:[]}};
 assert.equal(Feed.isFeedModuleRenderable(feed),false);assert.equal(renderToStaticMarkup(React.createElement(Feed.default,{module:feed})),'');
 assert.equal(buildSlotRenderPlan([{kind:'feed',assignmentId:102,sortOrder:20,module:feed}],{},VENISIA_THEME_MODULE_PRESENTATION).length,0);
 const Featured=load('src/components/featured/FeaturedModuleSection.tsx');
 const featured={items:[],source:{kind:'topics'},presentation:{variant:'list',title:'Featured title',description:'Featured copy',eyebrow:'Featured eyebrow'}};
 assert(Featured.isFeaturedModuleRenderable(featured));
 const featuredHtml=renderToStaticMarkup(React.createElement(Featured.default,{module:featured}));
 assert(featuredHtml.includes('Featured title')&&featuredHtml.includes('Featured copy'));assert(!featuredHtml.includes('<img')&&!featuredHtml.includes('<article'));
 const hiddenFeatured={...featured,presentation:{...featured.presentation,showTitle:false,showDescription:false,showEyebrow:false}};
 assert.equal(Featured.isFeaturedModuleRenderable(hiddenFeatured),false);
 assert.equal(renderToStaticMarkup(React.createElement(Featured.default,{module:hiddenFeatured})),'');
 const ProjectFeatured=load('src/components/projects/ProjectsFeaturedSection.tsx').default;
 const featuredProjectsHtml=renderToStaticMarkup(React.createElement(ProjectFeatured,{projects:[],title:'Project shell',subtitle:'Project copy'}));
 assert(featuredProjectsHtml.includes('Project shell')&&featuredProjectsHtml.includes('Project copy'));assert(!featuredProjectsHtml.includes('<img')&&!featuredProjectsHtml.includes('<article'));
 assert.equal(renderToStaticMarkup(React.createElement(ProjectFeatured,{projects:[],showTitle:false,showSubtitle:false})), '');
 console.log('PASS Empty module ownership: '+emptyLayouts+' Media Hub layouts retain title/copy/CTA in the actual render plan; Home/Featured/Projects retain static shells; Feed explicit hide remains collapsible.');
 console.log('PASS Home deleted-media rendering: '+cases.length+' real React/Next Image cases; published copy/CTA survives missing images; deleted image stays absent');return { cases, geometryCases, html: renderToStaticMarkup(React.createElement("main", {dir:"rtl",className:"bg-[#05070B] text-white"}, plan.map(item=>React.createElement("div", {key:item.key,"data-fixture-assignment":item.assignmentId,className:"@container/slot-module"},item.node)))) };
}
