import {mapHomeProjectsBlock} from '../../src/components/home/home-projects-mappers';
import React from 'react';
import Home from '../../src/components/home/HomeProjectsSection';
import List from '../../src/components/projects/ProjectsListSection';
import Featured from '../../src/components/projects/ProjectsFeaturedSection';
import District from '../../src/components/projects/details/ProjectDistrictSection';
const projects=[1,2,3].map(id=>({id:String(id),slug:'fixture-'+id,code:'QA'+id,englishName:'Project QA',arabicName:'مشروع اختبار',category:'residential',shortDescription:'وصف قصير لاختبار العرض',cardImage:{src:'/original.png',alt:'Card fixture'},location:{label:'القاهرة الجديدة',title:'الموقع',description:'',points:[],governorate:null,city:null,mainArea:null,subArea:null,googleMapsUrl:'#'}}));
export default function ProjectCardGuidanceFixture(){return (<><div data-case="home" className="@container/slot-module"><Home projects={projects} content={mapHomeProjectsBlock({template:{config:{title:"Projects"}}})}/></div><div data-case="grid"><List projects={projects} allProjects={projects} activeFilter="all" onFilterChange={()=>{}} defaultView="cards"/></div><div data-case="list"><List projects={projects} allProjects={projects} activeFilter="all" onFilterChange={()=>{}} defaultView="list"/></div><div data-case="featured"><Featured projects={projects} autoplayMs={999999}/></div><div data-case="district"><District {...projects[0]} presentation={{showLocationLabel:true,showLocationTags:true}}/></div></>);}
