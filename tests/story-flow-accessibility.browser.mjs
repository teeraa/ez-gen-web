// Isolated browser fixtures: no generation, provider requests, or database writes.
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13107',dir=process.env.ARTIFACT_DIR||'/tmp/story-flow-accessibility';fs.mkdirSync(dir,{recursive:true});
const auth=http.createServer((request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({data:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'free'}}))});
const title='X'.repeat(120),continuity={wardrobe:'ชุดเดิม',lighting:'แสงเช้า',characterState:'กำลังเดิน'};
const project={id:'long-title',title,idea:'ไอเดีย',style:'realistic',modelId:'fixture',quality:'standard',aspectRatio:'16:9',sceneCount:1,moodTags:['Q'.repeat(40)],characterAssetIds:[],revision:1,status:'processing',stage:'storyboard',scenes:[{sceneIndex:1,title,narrative:'N'.repeat(2000),location:'ป่า',characters:[],emotion:'อบอุ่น',continuity,shots:['submitting','unrecognized_future_status','pending'].map((imageStatus,index)=>({id:'shot-'+index,sceneIndex:1,shotIndex:index+1,action:'A'.repeat(2000),characters:[],location:'ป่า',atmosphere:'แสงเช้า',framing:'wide',cameraAngle:'eye level',cameraMovement:'tracking',continuity,imagePrompt:'ภาพ',videoPrompt:'เคลื่อนไหว',durationSeconds:5,imageStatus,videoStatus:'pending',imageUrl:null,videoUrl:null,failureCode:'',failureMessage:'',canRetry:false}))}],outputUrl:null,downloadUrl:null,failureCode:'',failureMessage:'',canRetry:false,completedImages:0,completedVideos:0,totalShots:3};
function luminance(rgb){return rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{const channel=value/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0)}
let browser;const observations=[];
try{
 await new Promise((resolve,reject)=>{auth.once('error',reject);auth.listen(Number(process.env.AUTH_FIXTURE_PORT||18107),'127.0.0.1',resolve)});
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,768,375]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'ezgen_session',value:'local-accessibility-fixture',url:base}]);const page=await context.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await context.route('**/api/proxy/**',route=>{const path=new URL(route.request().url()).pathname.replace('/api/proxy/','');let data;
   if(path==='story-flow/capabilities')data={enabled:true,unavailableReason:'',models:[{id:'fixture',name:'Fixture',aspectRatios:['16:9'],qualities:['standard'],minDuration:5,maxDuration:10}],styles:['realistic'],maxScenes:10,maxShots:20};
   else if(path==='story-flow/projects')data={items:[project],total:1,page:1,limit:20};else if(path==='story-flow/projects/long-title')data=project;else throw new Error('Unexpected fixture path '+path);
   return route.fulfill({json:{data}})
  });
  await page.goto(base+'/studio/story-flow');await page.getByRole('link',{name:new RegExp('^'+title)}).waitFor();await page.getByLabel('แท็กอารมณ์เพิ่มเติม').fill('Q'.repeat(40));await page.getByRole('button',{name:'เพิ่มแท็ก',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'long list title or mood chip overflow');
  const controls=await page.locator('section[aria-label="Story Flow"] input, section[aria-label="Story Flow"] textarea, section[aria-label="Story Flow"] select').evaluateAll(elements=>elements.map(element=>{const computed=getComputedStyle(element);return {tag:element.tagName,border:computed.borderTopColor,background:computed.backgroundColor,outline:computed.outlineStyle}}));
  for(const control of controls){const a=luminance(control.border),b=luminance(control.background);control.contrast=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);assert(control.contrast>=3,`${control.tag} boundary contrast ${control.contrast}`)}
  await page.getByLabel('ชื่อโปรเจกต์ (จำเป็น)').focus();const focus=await page.getByLabel('ชื่อโปรเจกต์ (จำเป็น)').evaluate(element=>({style:getComputedStyle(element).outlineStyle,width:getComputedStyle(element).outlineWidth}));assert.notEqual(focus.style,'none');assert(parseFloat(focus.width)>=3);
  await page.screenshot({path:`${dir}/long-list-controls-${width}.png`});
  await page.goto(base+'/studio/story-flow/long-title');await page.getByText('ภาพ: กำลังส่งคำขอ',{exact:true}).waitFor();await page.getByText('ภาพ: กำลังตรวจสอบสถานะ',{exact:true}).waitFor();await page.getByText('ภาพ: ยังไม่เริ่ม',{exact:true}).waitFor();
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));assert(dimensions.documentWidth<=dimensions.viewport,JSON.stringify(dimensions));assert.deepEqual(pageErrors,[]);await page.screenshot({path:`${dir}/long-title-submitting-${width}.png`});observations.push({width,dimensions,controls,focus,pageErrors,boundary:'Production Next artifact with loopback auth and browser API fixtures; no generation'});await context.close();
 }
 fs.writeFileSync(`${dir}/results.json`,JSON.stringify({status:'PASS',base,observations},null,2));console.log(JSON.stringify({status:'PASS',viewports:observations.map(item=>item.width),dir}));
}finally{await browser?.close();auth.closeAllConnections();await new Promise(resolve=>auth.close(resolve))}
