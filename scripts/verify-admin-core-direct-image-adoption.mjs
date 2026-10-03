import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import { CORE_DIRECT_IMAGE_VALUES as values, assertCoreImageCatalogResult, assertCoreDirectImageReceipts, assertCoreCompanyImageCompletion } from './fixtures/admin-core-direct-image-adoption.mjs';
import { PRESENTATION_CONTROL_ASSETS as assets } from './fixtures/admin-core-presentation-controls-contract.mjs';
const checks=[],test=(name,fn)=>{fn();checks.push(name);},sourceSha256='d'.repeat(64),ownedRunId='owned-image-control';
const receipt=field=>({receiptId:randomUUID(),sourceSha256,field,altField:field==='og_image'?'og_image_alt':null,routePathname:field==='og_image'?'/admin/pages-blocks/pages/41':'/admin/settings/general',expected:values[field],expectedAlt:field==='og_image'?values.og_image_alt:null,operations:['cancel-original','select','replace','cancel-replace','remove',...(field==='compactLogoUrl'?[]:['select-final'])],catalogAssets:[0,0,1,2,...(field==='compactLogoUrl'?[]:[2])].map(index=>({id:'11111111-1111-4111-8111-111111111111',objectKey:assets[index],publicUrl:'/'+assets[index],displayName:'Owned image '+index})),actualCatalogApi:true,exactTriggerReturn:true,unrelatedFieldsPreserved:true,removeClearedAlt:field==='og_image'?false:null,removePreservedAlt:field==='og_image'?true:null,automaticCoverage:[],globalClosed:false,requiresNativeSaveAndReload:true});
const fixture=()=>{const saved={id:randomUUID(),kind:'form-save-native',caseId:'core-company-settings-accepted-save',status:'partial-not-global-pass',formConsumer:'company-identity-settings',surface:'singleton-settings',writes:[{table:'site_settings',id:'admin.company',deleted:false,json:['logoUrl','compactLogoUrl'].map(field=>({column:'value',path:[field],actual:values[field]})),expectedActorId:7,audit:[{action:'site_settings.update',entity_type:'site_settings',entity_label:'admin.company',actor_admin_user_id:'7'}]}]};const row={id:'core-company-settings-rejection-preservation-save-reload',status:'pass',consumer:'company-identity-settings',reloaded:true,nativeReadbackRequired:true,imageAdoption:['logoUrl','compactLogoUrl'].map(receipt),permissionEvidence:[{caseId:saved.caseId,status:'pass',originalNativeSaveReceipt:saved.id,ownedRunId,originalNativeSaveVerified:true}]};const browser={status:'pass',driverCompleted:true,inventoryOnly:false,cohort:'domain-forms',journeySelection:null,sourceSha256,errors:[],evidence:[row],requiredCases:['form:company-identity-settings:capability:media','collection:settings-pages:capability:media'].map(key=>({key,axis:'media'}))},native={status:'pass',ownedRunId,records:[saved]};return{browser,native,row,saved,run:()=>assertCoreCompanyImageCompletion(browser,native,ownedRunId)};};
test('exact Company image selection and persisted removal join original save and actor audit',()=>{const f=fixture();assert.equal(f.run().nativeSaveReceipt,f.saved.id);});
test('exact OG image and independently preserved/re-authored alt observations qualify only named fragments',()=>assert.equal(assertCoreDirectImageReceipts([receipt('og_image')],['og_image'],sourceSha256).globalClosed,false));
const negatives={
 'wrong-public-path':f=>{f.row.imageAdoption[0].catalogAssets[0].publicUrl='/foreign.jpg';},
 'wrong-catalog-key':f=>{f.row.imageAdoption[0].catalogAssets[0].objectKey=assets[1];},
 'blank-catalog-identity':f=>{f.row.imageAdoption[0].catalogAssets[0].id='';},
 'missing-cancel':f=>{f.row.imageAdoption[0].operations.shift();},
 'missing-replace':f=>{f.row.imageAdoption[0].operations.splice(2,1);},
 'missing-remove':f=>{f.row.imageAdoption[1].operations.pop();},
 'missing-catalog-observation':f=>{f.row.imageAdoption[0].catalogAssets.pop();},
 'wrong-source':f=>{f.row.imageAdoption[0].sourceSha256='c'.repeat(64);},
 'wrong-consumer-route':f=>{f.row.imageAdoption[0].routePathname='/admin/other';},
 'wrong-field':f=>{f.row.imageAdoption[1].field='logoUrl';},
 'duplicate-receipt':f=>{f.row.imageAdoption[1].receiptId=f.row.imageAdoption[0].receiptId;},
 'lost-unrelated-fields':f=>{f.row.imageAdoption[0].unrelatedFieldsPreserved=false;},
 'lost-trigger-focus':f=>{f.row.imageAdoption[0].exactTriggerReturn=false;},
 'automatic-coverage':f=>{f.row.imageAdoption[0].automaticCoverage=['media'];},
 'failed-browser':f=>{f.browser.status='fail';},
 'unfinished-browser':f=>{f.browser.driverCompleted=false;},
 'selected-unrelated-journeys':f=>{f.browser.journeySelection='text-topic-forms';},
 'missing-reload':f=>{f.row.reloaded=false;},
 'missing-save':f=>{f.native.records=[];},
 'duplicate-save':f=>{f.native.records.push(structuredClone(f.saved));},
 'wrong-save-consumer':f=>{f.saved.formConsumer='other';},
 'wrong-setting-namespace':f=>{f.saved.writes[0].id='seo.global';},
 'missing-image-readback':f=>{f.saved.writes[0].json.pop();},
 'native-old-image':f=>{f.saved.writes[0].json[0].actual='/old.jpg';},
 'native-remove-not-persisted':f=>{f.saved.writes[0].json[1].actual=values.logoUrl;},
 'missing-audit':f=>{f.saved.writes[0].audit=[];},
 'wrong-actor':f=>{f.saved.writes[0].audit[0].actor_admin_user_id='8';},
 'duplicate-audit':f=>{f.saved.writes[0].audit.push({...f.saved.writes[0].audit[0]});},
 'wrong-owned-run':f=>{f.native.ownedRunId='foreign';},
 'permission-borrows-save':f=>{f.row.permissionEvidence[0].originalNativeSaveReceipt=randomUUID();},
 'missing-current-applicability':f=>{f.browser.requiredCases.pop();},
};
for(const[name,mutate]of Object.entries(negatives))test('reject '+name,()=>{const f=fixture();mutate(f);assert.throws(f.run);});
test('ambiguous matching catalog search cannot prove selected identity',()=>{const row=receipt('logoUrl').catalogAssets[0];assert.throws(()=>assertCoreImageCatalogResult({assets:[row,row]},assets[0]));});
test('OG removal must preserve the independently authored SEO alt field',()=>{const row=receipt('og_image');row.removePreservedAlt=false;assert.throws(()=>assertCoreDirectImageReceipts([row],['og_image'],sourceSha256));});
const source=readFileSync('src/lib/admin/shell/company-config.ts','utf8'),tree=ts.createSourceFile('company.ts',source,ts.ScriptTarget.Latest,true);
const declarations=['hexColor','companyIdentitySchema','parseAdminCompanyIdentity'].map(name=>{const matches=tree.statements.filter(node=>ts.isFunctionDeclaration(node)?node.name?.text===name:ts.isVariableStatement(node)&&node.declarationList.declarations.some(value=>value.name.getText(tree)===name));assert.equal(matches.length,1);return matches[0].getText(tree).replace(/^export /u,'');}).join('\n');
const parse=new Function('z',ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return parseAdminCompanyIdentity;')(z),authored={key:'qa',name:'QA',adminLabel:'Admin',cmsLabel:'CMS',logoUrl:values.logoUrl,compactLogoUrl:'',publicWebsiteUrl:'/',accentColor:'#112233',accentStrongColor:'#223344',surfaceColor:'#334455'};
test('actual Company parser retains chosen image and explicit compact-image removal',()=>{const value=parse(authored);assert.equal(value.success,true);assert.equal(value.data.logoUrl,values.logoUrl);assert.equal(value.data.compactLogoUrl,'');});
test('actual optional Company image paths allow both explicit clears',()=>assert.equal(parse({...authored,logoUrl:''}).success,true));
test('actual image length and unrelated required-name constraints still reject',()=>{assert.equal(parse({...authored,logoUrl:'x'.repeat(501)}).success,false);assert.equal(parse({...authored,name:''}).success,false);});
console.log(JSON.stringify({status:'pass',count:checks.length,checks,scope:'Controlled receipt/native projection guards; actual authenticated field interaction and owned native execution still pending.',automaticCoverage:[],globalClosed:false}));
