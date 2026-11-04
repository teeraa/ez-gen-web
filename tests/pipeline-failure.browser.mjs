import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13014',artifacts=process.env.ARTIFACT_DIR||'/private/tmp/ez-gen-pipeline-failure-browser';
fs.mkdirSync(artifacts,{recursive:true});
const auth=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-failure-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
let browser;
const observations=[];
try{
 await new Promise(r=>auth.listen(18094,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,375]){
  const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage(),posts=[],errors=[];
  let state={status:'failed',failureCode:'PROVIDER_OUTPUT_REJECTED'};
  const raw='https://fixture.invalid/private?token=private-fixture-token <img onerror=alert(1)>';
  const job=()=>({id:'12345678-1234-4234-8234-123456789abc',characterPrompt:'ตัวละคร',scenePrompt:'ฉาก',dialogue:'',modelId:'violet-realism',modelLabel:'Seedance 2.5',aspectRatio:'9:16',durationSeconds:5,quality:'standard',isDraft:true,canCreateFinal:false,sourceDraftId:null,...state,stage:'video',canRetry:false,failureMessage:raw,characterAssetId:'saved-character',videoAssetId:null,characterMediaUrl:null,videoMediaUrl:null,createdAt:'2026-11-02T00:00:00Z',updatedAt:'2026-11-02T00:00:00Z'});
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/proxy/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
   if(request.method()==='POST'){posts.push(path);return route.fulfill({status:500,json:{code:'UNEXPECTED_MUTATION'}});}
   if(path==='studio-pipeline-capabilities')data={enabled:true,textEnabled:true,libraryEnabled:true,supportsDialogue:true,aspectRatios:['9:16'],durations:[5],unavailableReason:null};
   else if(path==='studio-pipelines')data={items:[job()],total:1,page:1,limit:20};
   else if(path.startsWith('studio-pipelines/'))data=job();else throw new Error(`unexpected ${path}`);
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/signin');await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/studio');
  for(const [name,status,failureCode,expected] of [
   ['policy','failed','PROVIDER_OUTPUT_REJECTED','ผู้ให้บริการปฏิเสธวิดีโอที่สร้างจากการตรวจนโยบายเนื้อหา'],
   ['confirmed-terminal','failed','PROVIDER_GENERATION_FAILED','ผู้ให้บริการยืนยันว่าสร้างวิดีโอไม่สำเร็จ'],
   ['uncertain','needs_attention','PROVIDER_ERROR','ยังยืนยันผลการสร้างไม่ได้'],
   ['unknown-safe','failed',raw,'งานสร้างวิดีโอไม่สำเร็จ'],
  ]){
   state={status,failureCode};await page.reload();const alert=page.getByRole('alert').filter({hasText:expected});await alert.waitFor();const text=await alert.textContent();assert(text.includes('ตัวละครบันทึกแล้ว'));assert(!text.includes('private-fixture-token'));assert(!text.includes('https://'));assert.equal(await page.getByRole('button',{name:'ดำเนินการต่อจากงานเดิม',exact:true}).count(),0);
   if(name==='uncertain')assert(text.includes('ตรวจสอบงานและการใช้งาน'));if(name==='policy')for(const speculative of ['ลิขสิทธิ์','ใบหน้า','กฎหมาย'])assert(!text.includes(speculative));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${artifacts}/${name}-${width}.png`,fullPage:true});
  }
  assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);observations.push({width,readOnly:true,noRetryButton:true,allowlistedFailureCopy:true,rawProviderMessageHidden:true,consoleErrors:errors,boundary:'isolated Next + loopback auth + mocked read-only pipeline API; no live backend/provider calls'});await context.close();
 }
 fs.writeFileSync(`${artifacts}/results.json`,JSON.stringify({status:'PASS',observations},null,2));console.log(JSON.stringify({status:'PASS',viewports:observations.map(item=>item.width)}));
}finally{await browser?.close();await new Promise(r=>auth.close(r));}
