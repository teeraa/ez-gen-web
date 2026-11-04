import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13014';
const artifacts=process.env.ARTIFACT_DIR||'/private/tmp/ez-gen-draft-web-browser';
fs.mkdirSync(artifacts,{recursive:true});
let authOwner='fixture-user';
const auth=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-draft-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:authOwner,displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
const ids={draft:'12345678-1234-4234-8234-123456789abc',final:'22345678-1234-4234-8234-123456789abc',normal:'32345678-1234-4234-8234-123456789abc'};
let browser;
const observations=[];
try{
 await new Promise(r=>auth.listen(18094,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,375]){
  authOwner='fixture-user';
  const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage();
  const jobs=new Map(),creates=[],finals=[],errors=[],unexpected=[];let dropFinal=true,expired=false,override=false,legacy=false,listFail=false;
  const capability={enabled:true,textEnabled:true,libraryEnabled:true,libraryAspectRatios:['9:16','16:9'],libraryDurations:[5,10],supportsDialogue:true,unavailableReason:null,aspectRatios:['9:16','16:9'],durations:[5,10]};
  const models=()=>[
   {id:'violet-motion-2',label:override?'Seedance 2.5':'Seedance 2.0 Fast',supportsDraft:override,...capability},
   {id:'violet-cinema',label:override?'Seedance 2.5':'Seedance 2.0',supportsDraft:override,...capability},
   {id:'violet-fast',label:override?'Seedance 2.5':'Seedance 2.0 Fast',supportsDraft:override,...capability},
   {id:'violet-realism',label:'Seedance 2.5',supportsDraft:true,...capability},
   {id:'violet-classic',label:override?'Seedance 2.5':'Seedance 1.0 Pro',supportsDraft:override,...capability,aspectRatios:['16:9'],durations:[10]},
  ];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/api/proxy/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
   if(path==='studio-pipeline-capabilities')data={...capability,...(legacy?{}:{models:models()})};
   else if(path==='studio-pipelines'&&request.method()==='POST'){
    const body=request.postDataJSON();creates.push(body);const id=body.draft?ids.draft:ids.normal;
    data={...body,id,isDraft:body.draft===true,modelLabel:models().find(m=>m.id===body.modelId).label,status:'succeeded',stage:'done',canRetry:false,canCreateFinal:body.draft===true,sourceDraftId:null,draftExpiresAt:body.draft?'2099-01-01T00:00:00Z':null,finalUnavailableReason:null,failureCode:null,failureMessage:null,characterAssetId:'saved-character',videoAssetId:'saved-video',characterMediaUrl:null,videoMediaUrl:'/media/studio-landscape.mp4',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};jobs.set(id,data);
   }else if(path==='studio-pipelines'){
    if(listFail)return route.fulfill({status:503,json:{code:'UNAVAILABLE'}});
    data={items:[...jobs.values()].reverse(),total:jobs.size,page:1,limit:20};
   }else if(path.endsWith('/finalize')){
    const body=request.postDataJSON();finals.push({path,body});assert.deepEqual(Object.keys(body),['idempotencyKey']);
    if(expired){Object.assign(jobs.get(ids.draft),{canCreateFinal:false,draftExpiresAt:'2020-01-01T00:00:00Z',finalUnavailableReason:'ฉบับร่างหมดอายุสำหรับสร้างฉบับสมบูรณ์ กรุณาสร้างวิดีโอใหม่'});return route.fulfill({status:409,json:{code:'DRAFT_EXPIRED',message:'untrusted private provider text'}});}
    if(!jobs.has(ids.final))jobs.set(ids.final,{...jobs.get(ids.draft),id:ids.final,isDraft:false,quality:'high',canCreateFinal:false,sourceDraftId:ids.draft,status:'processing',stage:'video',videoAssetId:null,videoMediaUrl:null});
    if(dropFinal){dropFinal=false;await new Promise(r=>setTimeout(r,150));return route.abort('failed');}
    data=jobs.get(ids.final);
   }else if(path.startsWith('studio-pipelines/'))data=jobs.get(path.split('/')[1]);
   else if(path==='assets')data={items:[],total:0,page:1,limit:20};
   else{unexpected.push(`${request.method()} ${path}`);return route.fulfill({status:500,json:{code:'UNEXPECTED'}});}
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/signin');await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/studio');
  await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย',{exact:true}).waitFor();
  await page.locator('summary').filter({hasText:'ตั้งค่าเพิ่มเติม'}).click();await page.locator('details[open]').waitFor();
  const select=page.getByRole('combobox',{name:'โมเดล',exact:true});
  await select.locator('option').filter({hasText:'Seedance 1.0 Pro'}).waitFor({state:'attached'});
  assert((await select.locator('option').allTextContents()).some(text=>text.includes('Seedance 1.0 Pro')));
  assert.equal(await page.locator('#pipeline-draft').count(),0);
  await select.selectOption('violet-classic');assert.equal(await page.getByRole('combobox',{name:'สัดส่วน',exact:true}).inputValue(),'16:9');assert.equal(await page.getByRole('combobox',{name:'ความยาว',exact:true}).inputValue(),'10');
  await select.selectOption('violet-realism');await page.locator('#pipeline-draft').check();
  await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').fill('ตัวละครทดสอบ');await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').fill('เดินในสวน');
  await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByRole('button',{name:'สร้างฉบับสมบูรณ์ (1080p)',exact:true}).waitFor();
  assert.equal(creates[0].draft,true);assert.equal(creates[0].modelId,'violet-realism');
  assert(await page.getByText('เป็นคำขอใหม่ มีค่าใช้จ่ายเพิ่มเติม',{exact:true}).isVisible());
  assert.equal(await page.getByText('ร่าง (Draft) · 480p',{exact:true}).count(),2);
  await page.screenshot({path:`${artifacts}/draft-${width}.png`,fullPage:true});
  const computed=await page.locator('[class*="modeBadge"]').first().evaluate(el=>{const s=getComputedStyle(el);return {display:s.display,border:s.border,color:s.color,background:s.backgroundColor,gap:s.gap};});assert(['flex','inline-flex'].includes(computed.display));
  const finalButton=page.getByRole('button',{name:'สร้างฉบับสมบูรณ์ (1080p)',exact:true});await finalButton.focus();assert(await finalButton.evaluate(el=>el===document.activeElement));await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'ส่งคำขอฉบับสมบูรณ์เดิมอีกครั้ง',exact:true}).waitFor();assert(await page.locator('#pipeline-scene').isDisabled());assert(await select.isDisabled());
  const original=finals[0];await page.reload();await page.getByRole('button',{name:'ส่งคำขอฉบับสมบูรณ์เดิมอีกครั้ง',exact:true}).waitFor();assert(await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).isDisabled());
  await page.getByRole('button',{name:'ส่งคำขอฉบับสมบูรณ์เดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-pipeline-final-submission'));assert.deepEqual(finals[1],original);assert.equal(jobs.size,2);
  assert.equal(await page.getByText('ฉบับสมบูรณ์ (Final) · 1080p',{exact:true}).count(),2);
  assert(jobs.get(ids.draft).isDraft);assert.equal(creates.length,1);
  Object.assign(jobs.get(ids.final),{status:'succeeded',stage:'done',videoAssetId:'saved-final',videoMediaUrl:'/media/studio-landscape.mp4'});await page.getByRole('button',{name:'ตรวจสอบสถานะอีกครั้ง',exact:true}).click();
  await page.getByRole('button',{name:'ดูฉบับร่างต้นฉบับ',exact:true}).waitFor();await page.screenshot({path:`${artifacts}/final-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'ดูฉบับร่างต้นฉบับ',exact:true}).click();await page.getByRole('button',{name:'สร้างฉบับสมบูรณ์ (1080p)',exact:true}).waitFor();
  expired=true;await page.getByRole('button',{name:'สร้างฉบับสมบูรณ์ (1080p)',exact:true}).click();await page.getByRole('alert').filter({hasText:'ฉบับร่างหมดอายุ'}).waitFor();assert.equal(await page.getByText('untrusted private provider text',{exact:false}).count(),0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('violet-pipeline-final-submission')),null);assert(!await page.locator('#pipeline-scene').isDisabled());
  await page.screenshot({path:`${artifacts}/expired-${width}.png`,fullPage:true});
  override=true;await page.reload();await page.locator('summary').filter({hasText:'ตั้งค่าเพิ่มเติม'}).click();await select.selectOption('violet-motion-2');await page.locator('#pipeline-draft').waitFor();assert((await select.locator('option').allTextContents()).every(text=>text.includes('Seedance 2.5')));
  legacy=true;await page.reload();await page.locator('summary').filter({hasText:'ตั้งค่าเพิ่มเติม'}).click();assert.equal(await page.locator('#pipeline-draft').count(),0);assert((await select.locator('option').allTextContents()).every(text=>text.includes('รอข้อมูลโมเดลจริง')));
  listFail=true;await page.reload();await page.getByText('โหลดงานไม่สำเร็จ',{exact:false}).waitFor();assert.equal(await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  listFail=false;legacy=false;expired=false;dropFinal=true;
  Object.assign(jobs.get(ids.draft),{canCreateFinal:true,draftExpiresAt:'2099-01-01T00:00:00Z',finalUnavailableReason:null});
  await page.reload();await page.getByRole('button',{name:'ดูฉบับร่างต้นฉบับ',exact:true}).click();await page.getByRole('button',{name:'สร้างฉบับสมบูรณ์ (1080p)',exact:true}).click();
  await page.getByRole('button',{name:'ส่งคำขอฉบับสมบูรณ์เดิมอีกครั้ง',exact:true}).waitFor();
  assert(await page.evaluate(()=>sessionStorage.getItem('violet-pipeline-final-submission')));
  await page.evaluate(()=>{sessionStorage.setItem('violet-pipeline-draft','private-draft');sessionStorage.setItem('violet-pipeline-submission','private-submission');sessionStorage.setItem('unrelated-fixture','retained');});
  if(width<851)await page.getByRole('button',{name:'เปิดเมนู',exact:true}).click();
  await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await page.waitForURL('**/signin');
  for(const key of ['violet-pipeline-draft','violet-pipeline-submission','violet-pipeline-final-submission'])assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),key),null);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('unrelated-fixture')),'retained');
  authOwner='second-fixture-user';jobs.clear();
  await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('second@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/studio');
  await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'คำขอฉบับสมบูรณ์ที่รอยืนยัน',exact:true}).count(),0);assert(!await page.locator('#pipeline-scene').isDisabled());
  observations.push({width,computed,creates:creates.length,finalRequests:finals.length,immutableFinalReplay:true,logoutClearsFinalRecovery:true,secondOwnerUnlocked:true,keyboard:true,overrideLabels:true,legacyDraftDisabled:true,expiredRecovery:true,pageErrors:errors,boundary:'production Next + loopback auth fixture + browser API route fixtures; no live generation'});await context.close();
 }
 fs.writeFileSync(`${artifacts}/results.json`,JSON.stringify({status:'PASS',observations},null,2));console.log(JSON.stringify({status:'PASS',viewports:observations.map(item=>item.width)}));
}finally{await browser?.close();await new Promise(r=>auth.close(r));}
