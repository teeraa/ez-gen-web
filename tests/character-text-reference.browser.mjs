import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BASE_URL || 'http://127.0.0.1:13012';
const artifacts=process.env.ARTIFACT_DIR || '/private/tmp/synth-img2img-fe';
fs.mkdirSync(artifacts,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const fixture=http.createServer((req,res)=>res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-character-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid'}})));
let browser;
const observations=[];
try {
 await new Promise(r=>fixture.listen(18092,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,375]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  let support=true,mode='image_to_image',behavior='success',counter=0;const posts=[],jobs=new Map(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('requestfailed',r=>console.error('requestfailed',r.url(),r.failure()));page.on('console',m=>{if(m.type()==='error')console.error('console',m.text())});
  await page.route('**/api/proxy/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname.replace('/api/proxy/','');let data={};
   if(path==='image-capabilities')data={enabled:true,model:'fixture',aspectRatios:['3:4'],categories:['character','product'],supportsReferenceImage:true,...(support===undefined?{}:{supportsCharacterReferenceImage:support,characterReferenceMode:mode,characterReferenceUnavailableReason:support?null:'การสร้างตัวละครจากภาพยังไม่พร้อม'})};
   if(path==='uploads'){await new Promise(r=>setTimeout(r,450));data={uploadId:'12345678-1234-1234-1234-123456789abc',expiresAt:'2099-01-01T00:00:00Z'};}
   if(path==='image-jobs'){
    const body=req.postDataJSON();posts.push(body);
    if(behavior==='network'){behavior='success';return route.abort('failed');}
    if(behavior==='unavailable'){behavior='success';return route.fulfill({status:503,json:{code:'CHARACTER_REFERENCE_UNAVAILABLE',message:'การสร้างตัวละครจากภาพยังไม่พร้อม'}});}
    if(behavior==='generic'){behavior='success';return route.fulfill({status:503,json:{code:'PROVIDER_ERROR',message:'บริการชั่วคราวไม่พร้อม'}});}
    const jobId='job-'+ ++counter;jobs.set(jobId,{jobId,status:'succeeded',rawPrompt:body.prompt,imageCategory:body.category??'character',result:{mediaType:'image',mediaUrl:'data:image/png;base64,'+png.toString('base64')}});data={jobId,status:'queued'};
   }
   if(path.startsWith('jobs/'))data=jobs.get(path.slice(5));
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/signin');await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(base+'/studio');await page.reload({waitUntil:'domcontentloaded'});
  const generate=()=>page.locator('form.idea-composer button.btn-primary');const attach=()=>page.getByRole('button',{name:/เพิ่มภาพอ้างอิง|เปลี่ยนภาพอ้างอิง/});
  await page.getByLabel('อธิบายตัวละครของคุณ').fill('A fictional adult explorer');
  await page.getByText('ใช้ภาพอ้างอิงสร้างตัวละครสังเคราะห์',{exact:false}).waitFor();await page.waitForFunction(()=>!document.querySelector('form.idea-composer button.btn-secondary').disabled);await attach().focus();assert(await attach().evaluate(n=>n===document.activeElement));
  await page.locator('#character-reference').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:png});await page.getByText('กำลังอัปโหลดภาพ…',{exact:true}).waitFor();assert(await generate().isDisabled());await page.getByText('reference.png',{exact:true}).waitFor();
  await page.getByText('สร้างตัวละครสังเคราะห์จากภาพ',{exact:false}).waitFor();await generate().click();await page.getByRole('heading',{name:'ตัวละครของคุณเป็นรูปเป็นร่างแล้ว'}).waitFor();assert(posts.at(-1).referenceImageId);
  await page.screenshot({path:`${artifacts}/success-${width}.png`});
  support=undefined;await page.reload();await attach().waitFor();assert(await attach().isDisabled());assert(await generate().isDisabled());const count=posts.length;await page.locator('form.idea-composer').evaluate(f=>f.requestSubmit());assert.equal(posts.length,count);
  await page.getByRole('button',{name:'นำภาพอ้างอิงออก'}).click();assert(!await generate().isDisabled());await generate().click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-character-submission'));assert.equal(posts.at(-1).referenceImageId,undefined);
  await page.getByRole('group',{name:'ประเภทภาพ'}).getByRole('button',{name:'สร้างสินค้า',exact:true}).click();assert(!await attach().isDisabled());await page.getByRole('group',{name:'ประเภทภาพ'}).getByRole('button',{name:'สร้างตัวละคร',exact:true}).click();
  support=true;mode='unsupported';await page.reload();assert(await attach().isDisabled());
  mode='text_description';await page.reload();assert(await attach().isDisabled());
  mode='image_to_image';await page.reload();await attach().waitFor();await page.locator('#character-reference').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:png});await page.getByText('reference.png',{exact:true}).waitFor();
  behavior='unavailable';await generate().click();await page.getByRole('alert').filter({hasText:'การสร้างตัวละครจากภาพยังไม่พร้อม'}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('violet-character-submission')),null);assert(!await page.getByRole('button',{name:'นำภาพอ้างอิงออก'}).isDisabled());
  behavior='network';await generate().click();await page.getByRole('alert').filter({hasText:'การเชื่อมต่อขัดข้อง'}).waitFor();const pending=posts.at(-1);support=false;await page.reload();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-character-submission'));assert.deepEqual(posts.at(-1),pending);
  support=true;await page.reload();behavior='generic';await generate().click();await page.getByRole('alert').filter({hasText:'บริการชั่วคราวไม่พร้อม'}).waitFor();assert(await page.getByRole('button',{name:'นำภาพอ้างอิงออก'}).isDisabled());await generate().click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-character-submission'));assert.deepEqual(posts.at(-1),posts.at(-2));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.screenshot({path:`${artifacts}/final-${width}.png`});observations.push({width,computed:await page.locator('form.idea-composer').evaluate(n=>({fontFamily:getComputedStyle(n).fontFamily,width:getComputedStyle(n).width,overflowX:getComputedStyle(n).overflowX})),posts:posts.length,errors,scenarios:'success/loading/missing capability/wrong mode/text-only removal/product independence/definitive503/network immutable retry/generic503 immutable retry/keyboard'});await context.close();
 }
 console.log(JSON.stringify({status:'PASS',boundary:'loopback login + browser API fixture, no paid providers',observations},null,2));
} finally {await browser?.close();await new Promise(r=>fixture.close(r));}
