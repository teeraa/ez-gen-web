import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13014';
const artifacts=process.env.ARTIFACT_DIR||'/private/tmp/ez-gen-thai-dialogue-browser';
fs.mkdirSync(artifacts,{recursive:true});
const auth=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-dialogue-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
const long='“วันนี้เราจะพาคุณมารู้จักผลิตภัณฑ์ใหม่ที่ออกแบบมาเพื่อทุกคน\nพร้อมเล่ารายละเอียดวิธีใช้งานและคุณสมบัติที่น่าสนใจ”';
let browser;
const observations=[];
try{
 await new Promise(r=>auth.listen(18094,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,375]){
  const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage(),posts=[],errors=[];
  const capability={enabled:true,textEnabled:true,libraryEnabled:true,libraryAspectRatios:['9:16'],libraryDurations:[5,15],supportsDialogue:true,unavailableReason:null,aspectRatios:['9:16'],durations:[5,15]};
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/proxy/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
   if(path==='studio-pipeline-capabilities')data={...capability,models:[{...capability,id:'violet-motion-2',label:'Seedance 2.5',supportsDraft:true},{...capability,id:'violet-classic',label:'Seedance 1.0 Pro',supportsDraft:false,supportsDialogue:false}]};
   else if(path==='studio-pipelines'&&request.method()==='POST'){
    const body=request.postDataJSON();posts.push(body);data={...body,id:'12345678-1234-4234-8234-123456789abc',isDraft:false,modelLabel:'Seedance 2.5',status:'processing',stage:'video',canRetry:false,canCreateFinal:false,sourceDraftId:null,failureCode:null,failureMessage:null,characterAssetId:'saved-character',videoAssetId:null,characterMediaUrl:null,videoMediaUrl:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   }else if(path==='studio-pipelines')data={items:[],total:0,page:1,limit:20};
   else if(path==='assets')data={items:[],total:0,page:1,limit:20};
   else if(path.startsWith('studio-pipelines/'))data={id:'12345678-1234-4234-8234-123456789abc',status:'processing',stage:'video',characterPrompt:'ตัวละคร',scenePrompt:'ฉาก',dialogue:long,canRetry:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   else throw new Error(`Unexpected fixture request ${request.method()} ${path}`);
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/signin');await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/studio');
  await page.locator('summary').filter({hasText:'ตั้งค่าเพิ่มเติม'}).click();
  const model=page.getByRole('combobox',{name:'โมเดล',exact:true}),duration=page.getByRole('combobox',{name:'ความยาว',exact:true}),dialogue=page.getByRole('textbox',{name:'บทพูด (ไม่บังคับ)',exact:true}),hint=page.locator('#pipeline-dialogue-timing');
  await model.locator('option').filter({hasText:'Seedance 2.5'}).waitFor({state:'attached'});
  await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').fill('ตัวละคร');await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').fill('ฉาก');
  await dialogue.fill('สวัสดีค่ะ ยินดีต้อนรับค่ะ');assert.equal(await hint.count(),0);
  await dialogue.fill(long);await hint.waitFor();assert((await hint.textContent()).includes('ประเมินคร่าว ๆ'));assert.equal(await dialogue.getAttribute('aria-describedby'),'pipeline-dialogue-help pipeline-dialogue-timing');
  const submit=page.getByRole('button',{name:'สร้างวิดีโอ',exact:true});assert(!await submit.isDisabled());
  await duration.selectOption('15');assert.equal(await hint.count(),0);await duration.selectOption('5');await hint.waitFor();
  await dialogue.fill('New product launch details benefits instructions features today '.repeat(5));assert.equal(await hint.count(),0);
  await dialogue.fill('');assert.equal(await hint.count(),0);await dialogue.fill(long);await hint.waitFor();
  await model.selectOption('violet-classic');assert.equal(await hint.count(),0);await page.getByText('ขณะนี้ยังไม่รองรับบทพูด',{exact:true}).waitFor();
  await model.selectOption('violet-motion-2');await hint.waitFor();await dialogue.focus();assert(await dialogue.evaluate(el=>el===document.activeElement));
  const computed=await hint.evaluate(el=>{const s=getComputedStyle(el);return{color:s.color,background:s.backgroundColor,border:s.border,display:s.display};});
  await page.screenshot({path:`${artifacts}/warning-${width}.png`,fullPage:true});
  await submit.click();await page.getByRole('button',{name:'ตรวจสอบสถานะอีกครั้ง',exact:true}).waitFor();assert.equal(posts.length,1);assert.equal(posts[0].dialogue,long);assert.equal(posts[0].durationSeconds,5);assert(!('advisory'in posts[0]));assert.equal(await dialogue.inputValue(),long);
  const original={...posts[0],idempotencyKey:'22345678-1234-4234-8234-123456789abc'};
  await page.evaluate(body=>{sessionStorage.setItem('violet-pipeline-submission',JSON.stringify(body));sessionStorage.setItem('violet-pipeline-draft',JSON.stringify({character:'ตัวละคร',scene:'ฉาก',dialogue:''}));},original);
  await page.reload();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).waitFor();await hint.waitFor();assert(await dialogue.isDisabled());assert.equal(await dialogue.inputValue(),original.dialogue);await page.getByText(`${original.dialogue.length}/1000`,{exact:true}).waitFor();await page.locator('summary').filter({hasText:'ตั้งค่าเพิ่มเติม'}).click();await page.locator('details[open]').waitFor();assert.equal(await duration.inputValue(),'5');assert.equal(posts.length,1);
  await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-pipeline-submission'));assert.deepEqual(posts[1],original);
  const withoutDialogue={...original,idempotencyKey:'32345678-1234-4234-8234-123456789abc'};delete withoutDialogue.dialogue;
  await page.evaluate(({body,stale})=>{sessionStorage.setItem('violet-pipeline-submission',JSON.stringify(body));sessionStorage.setItem('violet-pipeline-draft',JSON.stringify({character:'ตัวละคร',scene:'ฉาก',dialogue:stale}));},{body:withoutDialogue,stale:long});
  await page.reload();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).waitFor();assert(await dialogue.isDisabled());assert.equal(await dialogue.inputValue(),'');await page.getByText('0/1000',{exact:true}).waitFor();assert.equal(await hint.count(),0);assert.equal(posts.length,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  observations.push({width,computed,warningNonblocking:true,exactDialoguePreserved:true,clearOnLongerDuration:true,unsupportedAndEnglishUnchanged:true,immutablePendingReplay:true,pageErrors:errors,boundary:'production/development Next + loopback auth fixture + browser route API fixtures; no live generation'});await context.close();
 }
 fs.writeFileSync(`${artifacts}/results.json`,JSON.stringify({status:'PASS',observations},null,2));console.log(JSON.stringify({status:'PASS',viewports:observations.map(item=>item.width)}));
}finally{await browser?.close();await new Promise(r=>auth.close(r));}
