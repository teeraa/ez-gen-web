import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13014',artifacts=process.env.ARTIFACT_DIR||'/private/tmp/ez-gen-studio-writing-browser';
fs.mkdirSync(artifacts,{recursive:true});
const auth=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-writing-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
const sceneText=Array.from({length:40},(_,i)=>`ฉากที่ ${i+1} เดินผ่านสวนยามเช้า`).join('\n'),dialogueText='สวัสดีค่ะ วันนี้ขอแนะนำเรื่องราวของเรา\n'.repeat(10);
let browser;
const observations=[];
try{
 await new Promise(r=>auth.listen(18094,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,768,375]){
  const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage(),posts=[],errors=[];
  const capability={enabled:true,textEnabled:true,libraryEnabled:true,supportsDialogue:true,aspectRatios:['9:16'],durations:[5,15],libraryAspectRatios:['9:16'],libraryDurations:[5,15],unavailableReason:null};
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/proxy/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
   if(request.method()!=='GET'){posts.push(path);return route.fulfill({status:500,json:{code:'UNEXPECTED_MUTATION'}});}
   if(path==='studio-pipeline-capabilities')data={...capability,models:[{...capability,id:'violet-motion-2',label:'Seedance 2.5',supportsDraft:true}]};
   else if(path==='studio-pipelines')data={items:[],total:0,page:1,limit:20};else if(path==='assets')data={items:[],total:0,page:1,limit:20};else throw new Error(`Unexpected fixture path ${path}`);
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/signin');await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/studio');
  const scene=page.getByRole('textbox',{name:'ฉากและการเคลื่อนไหว (จำเป็น)',exact:true}),dialogue=page.getByRole('textbox',{name:'บทพูด (ไม่บังคับ)',exact:true}),toggle=page.getByRole('button',{name:'ขยายพื้นที่เขียน',exact:true});
  await scene.fill(sceneText);await dialogue.fill(dialogueText);await page.locator('#pipeline-dialogue-timing').waitFor();
  const sceneNode=await scene.elementHandle();
  const initial=await scene.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {width:r.width,height:r.height,parentWidth:p.width,resize:s.resize,fontSize:s.fontSize,marginLeft:s.marginLeft,scrollable:el.scrollHeight>el.clientHeight};});
  assert.equal(initial.resize,'vertical');assert.equal(initial.marginLeft,'0px');assert(Math.abs(initial.width-initial.parentWidth)<2);assert(initial.scrollable);assert(initial.height>=(width>850?220:180));
  assert.equal(initial.fontSize,width>850?'14px':'16px');assert.equal(await scene.getAttribute('maxlength'),'2000');assert.equal(await dialogue.getAttribute('maxlength'),'1000');
  await page.getByText(`${sceneText.length}/2000`,{exact:true}).waitFor();await page.getByText(`${dialogueText.length}/1000`,{exact:true}).waitFor();
  await page.locator('#pipeline-scene-limit').filter({hasText:'ขีดจำกัดที่ตั้งไว้ใน Studio'}).waitFor();await page.locator('#pipeline-dialogue-limit').filter({hasText:'1,000'}).waitFor();
  await scene.evaluate(el=>{el.style.height='390px';el.setSelectionRange(4,12);});
  assert.equal(await toggle.count(),0);assert(await sceneNode.evaluate(el=>el.isConnected));assert.equal(await scene.inputValue(),sceneText);assert.deepEqual(await scene.evaluate(el=>[el.selectionStart,el.selectionEnd]),[4,12]);assert.equal(Math.round((await scene.boundingBox()).height),390);assert.equal(await dialogue.inputValue(),dialogueText);
  await page.screenshot({path:`${artifacts}/writing-${width}.png`,fullPage:true});
  const pending={characterPrompt:'ตัวละคร',scenePrompt:sceneText,dialogue:dialogueText,visualStyle:'cinematic_realistic',aspectRatio:'9:16',durationSeconds:5,modelId:'violet-motion-2',quality:'standard',draft:true,idempotencyKey:'22345678-1234-4234-8234-123456789abc'};
  await page.evaluate(body=>{sessionStorage.setItem('violet-pipeline-submission',JSON.stringify(body));sessionStorage.setItem('violet-pipeline-draft',JSON.stringify({character:body.characterPrompt,scene:body.scenePrompt,dialogue:body.dialogue}));},pending);
  await page.reload();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).waitFor();assert(await scene.isDisabled());assert(await dialogue.isDisabled());
  const saved=await page.evaluate(()=>sessionStorage.getItem('violet-pipeline-submission'));
  assert.equal(await toggle.count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('violet-pipeline-submission')),saved);assert.equal(await scene.inputValue(),sceneText);assert.equal(await dialogue.inputValue(),dialogueText);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);
  observations.push({width,initial,noWritingToggle:true,resizingPreservesDOMAndSelection:true,pendingIdentityUnchanged:true,verticalResize:true,noMutations:true,pageErrors:errors,boundary:'isolated Next + loopback auth + read-only API fixtures; user resize checked via computed resize and style-height adjustment'});await context.close();
 }
 fs.writeFileSync(`${artifacts}/results.json`,JSON.stringify({status:'PASS',observations},null,2));console.log(JSON.stringify({status:'PASS',viewports:observations.map(item=>item.width)}));
}finally{await browser?.close();await new Promise(r=>auth.close(r));}
